import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import * as ryutils from './ryutils';
import { RyConfiguration } from './ryConfiguration';
import
{
	RyQuickPickBase,
	RyQuickPickItem,
	FileListStatus,
	ListFilesResult,
	listFilesInDirectory,
	EXTENSION_NAME_FOR_ERROR,
	RyPathQPItem,
	maskUserNameDirectory,
	filePathListToFileInfoList,
	RyDirectoryQPItem,
	filePathToFileInfo,
	MyFileType,
} from './ryQuickPickBase';
import { InputPathQuickPick } from './ryInputPathQuickPick';

// 自前の国際化文字列リソースの読み込み
import { COMMON_TEXTS, i18n, i18nPlural, I18NText } from "./i18n";
import { MESSAGES } from "./i18nTexts";










// コマンドのラベルに付く前置詞
const COMMAND_LABEL_PREFIX = '> ';











/**
 * 指定されたディレクトリ内のファイルをリストアップし、必要に応じてエラーメッセージを表示する。
 *
 * @param directory ファイルをリストアップするディレクトリのパス
 * @returns listFilesInDirectory の結果をそのまま返す。
 */
function listFilesAndHandleError(directory: string): ListFilesResult
{
	const listFiles = listFilesInDirectory(directory);
	if (listFiles.result === FileListStatus.SUCCESS)
	{
		return listFiles;
	}
	else if (listFiles.result === FileListStatus.NOT_FOUND)
	{
		vscode.window.showErrorMessage(i18n(MESSAGES['error.directoryNotFound'], { dir: directory }));
	}
	else
	{
		const msg = i18n(MESSAGES['error.listFilesFailed'], { dir: directory });
		const e = listFiles.error;
		if (e !== undefined)
		{
			// エラー詳細を Output Channel に表示
			const debugErrorMessage = `Error occurred while listing files in directory: ${directory}`;
			ryutils.showErrorMessageWithDetailChannel(msg, EXTENSION_NAME_FOR_ERROR, debugErrorMessage, e);
		}
		else
		{
			vscode.window.showErrorMessage(msg);
		}
	}

	return listFiles;
}










/**
 * vscode の this._theQuickPick をラッパーしてこの拡張機能用に使いやすくしたクラス。
 * 2024/06/30
 */
export class MyQuickPick extends RyQuickPickBase
{
	// 現在表示しているディレクトリ
	private readonly _directory: string;

	private constructor(files: ListFilesResult)
	{
		super();
		this._directory = files.path;

		this._theQuickPick.items = this.createQuickPickItems(files);
		this._theQuickPick.title = maskUserNameDirectory(this._directory);
		this._theQuickPick.buttons = this.createQuickPickButtons();
		this._theQuickPick.placeholder = this.placeholderText;
		this._theQuickPick.show();
	}

	private get placeholderText(): string
	{
		if (this.getPathPresentation() === 'relative')
		{
			const baseDir = RyConfiguration.getBaseDirectory();
			if (baseDir === '')
			{
				return `${i18n(MESSAGES.baseDirectory)}: ${i18n(MESSAGES.baseDirectoryUnset)}`;
			}
			else
			{
				return `${i18n(MESSAGES.baseDirectory)}: ${maskUserNameDirectory(baseDir)}`;
			}
		}
		else
		{
			return '';
		}
	}

	static createMyQuickPick(directory: string): MyQuickPick | undefined
	{
		const files = listFilesAndHandleError(directory);
		if (files.result !== FileListStatus.SUCCESS)
		{
			return undefined;
		}

		// 最後に表示したディレクトリとして設定に保存しておく
		RyConfiguration.setLastDirectory(directory).catch((error) => console.error(error));

		return new MyQuickPick(files);
	}

	get fullPath(): string
	{
		return this._directory;
	}

	/**
	 * 指定されたディレクトリへの移動コマンド情報を quickPickItems に追加する。
	 *
	 * @param items 追加先。
	 * @param directory 現在のディレクトリ。
	 * @param labelKey アイテムのラベルの文字列リソースのキー。
	 * @param targetDir 移動先のディレクトリ。
	 */
	private addGotoDirectoryItem(items: vscode.QuickPickItem[], directory: string, label: I18NText, targetDir: string): void
	{
		if (targetDir !== '' && targetDir !== directory)
		{
			items.push(new MyQuickPickGotoDirItem(this, i18n(label), targetDir));
		}
	}

	/**
	 * 指定されたディレクトリまでのディレクトリツリーを作成する。
	 * @param fullPath
	 * @returns
	 */
	private createDirectoryTreeItems(fullPath: string): RyPathQPItem[]
	{
		let currentPath = fullPath;
		const hierarchy = [];
		while (currentPath !== path.parse(currentPath).root)
		{
			hierarchy.unshift(currentPath);
			currentPath = path.dirname(currentPath);
		}

		const fileInfoList = filePathListToFileInfoList(hierarchy);
		let indent = 0;
		return this.convertFileInfosToPathQPItems(fileInfoList, '', (item, index) =>
		{
			item.indent = indent;
			indent++;
		});
	}

	/**
	 * 相対パスの経路上にあるディレクトリを追加する。
	 * @param fullPath
	 * @param baseDir
	 * @returns
	 */
	private createRelativeRouteFromBaseDirectory(fullPath: string, baseDir: string): { quickPickItems: RyPathQPItem[], lastIndent: number }
	{
		/**
		 * パス文字列を各パスに分割する。
		 * @param relativePath
		 * @returns
		 */
		function splitPath(relativePath: string): string[]
		{
			// パスを正規化して、余計な '..' などを解決
			const normalizedPath = path.normalize(relativePath);
			// パス区切り文字で分割
			const parts = normalizedPath.split(path.sep);
			// 空要素を削除
			return parts.filter(part => part !== '');
		}

		// 相対パスを求める
		const relativePath = path.relative(baseDir, fullPath);

		const itemsInRoute: { indent: number, fullPath: string }[] = [];
		let currentPath: string = baseDir;
		let indent = 0;
		splitPath(relativePath).forEach(pathComponent =>
		{
			// カレントディレクトリを示す '.' は無視
			if (pathComponent !== '.')
			{
				const fullPath = path.join(currentPath, pathComponent);
				currentPath = fullPath;
				indent += (pathComponent === '..') ? -1 : 1;
				itemsInRoute.push({ indent: indent, fullPath: fullPath });
			}
		});

		// 先頭に基準ディレクトリそのものを追加
		itemsInRoute.unshift({ indent: itemsInRoute.length > 0 ? itemsInRoute[0].indent + 1 : 0, fullPath: baseDir });

		// インデントの補正（マイナスがないように全体をずらす）
		const minIndent = Math.min(...itemsInRoute.map(item => item.indent));
		itemsInRoute.forEach(item => item.indent -= minIndent);



		const items: RyPathQPItem[] = [];

		// パス文字列のリストをそれぞれのファイル情報に変換してディレクトリとして追加。
		const fileInfoList = filePathListToFileInfoList(itemsInRoute.map(item => item.fullPath));
		items.push(...this.convertFileInfosToPathQPItems(fileInfoList, baseDir, (item, index) => item.indent = itemsInRoute[index].indent));

		return { quickPickItems: items, lastIndent: itemsInRoute[itemsInRoute.length - 1].indent };
	}

	/**
	 * QuickPick に表示するアイテムのリストを作成する。
	 * @param directory
	 * @returns
	 */
	private createQuickPickItems(listFilesResult: ListFilesResult): vscode.QuickPickItem[]
	{
		// ディレクトリとファイルを分ける？
		const groupDirectories = RyConfiguration.getGroupDirectories();
		const directory = listFilesResult.path;
		const files = listFilesResult.files;
		const baseDir = RyConfiguration.getBaseDirectory();
		const showRoute = RyConfiguration.getShowPathRoute();

		const quickPickItems: vscode.QuickPickItem[] = [];

		let showDoubleDot = false;
		let indent: number;
		if (this.getPathPresentation() === 'relative' && baseDir !== '')
		{
			// 基準ディレクトリが見付からない、ディレクトリでない、エラーの場合
			const baseDirInfo = filePathToFileInfo(baseDir, false);
			if (baseDirInfo.type !== MyFileType.directory)
			{
				quickPickItems.push({ label: i18n(MESSAGES.baseDirectory), kind: vscode.QuickPickItemKind.Separator });

				// エラーであることを示すアイテムを追加
				const baseDirItems = this.convertFileInfosToPathQPItems([baseDirInfo], '');
				quickPickItems.push(...baseDirItems);

				// 現在のディレクトリを表示
				const curDirInfo = filePathToFileInfo(directory, false);
				quickPickItems.push(...this.convertFileInfosToPathQPItems([curDirInfo], ''));

				indent = 1;
			}
			else
			{
				// 相対パス経路
				const relativeRoute = this.createRelativeRouteFromBaseDirectory(directory, baseDir);

				// 経路を表示しない場合、インデントを上書き
				if (!showRoute)
				{
					relativeRoute.quickPickItems.forEach(item => item.indent = 0);
				}

				// 基準ディレクトリを表示
				quickPickItems.push({ label: i18n(MESSAGES.baseDirectory), kind: vscode.QuickPickItemKind.Separator });
				quickPickItems.push(relativeRoute.quickPickItems[0]);

				// 基準ディレクトリからの経路を表示
				if (showRoute)
				{
					for (let i = 1; i < relativeRoute.quickPickItems.length - 1; i++)
					{
						quickPickItems.push(relativeRoute.quickPickItems[i]);
					}
				}

				// 現在のディレクトリを表示
				// ただし、基準ディレクトリと現在のディレクトリが同じ場合（経路の長さが1）は基準ディレクトリだけで事足りるので表示しない。
				if (relativeRoute.quickPickItems.length > 1)
				{
					const item = relativeRoute.quickPickItems[relativeRoute.quickPickItems.length - 1];
//					item.indent = 0;
					quickPickItems.push(item);
				}

				indent = showRoute ? relativeRoute.lastIndent + 1 : 1;
			}

			showDoubleDot = true;
		}
		else
		{
			// 絶対パスモード

			// まず仕切り
			quickPickItems.push({ label: i18n(MESSAGES.directoryTree), kind: vscode.QuickPickItemKind.Separator });

			// ディレクトリツリーを作る
			const absoluteRoute = this.createDirectoryTreeItems(directory);

			// 途中経路を表示する？
			if (showRoute)
			{
				quickPickItems.push(...absoluteRoute);
				indent = absoluteRoute.length;
			}
			else
			{
				// 経路を表示しない場合は現在のディレクトリと親ディレクトリだけを表示
				const lastTwo = absoluteRoute.slice(-2);
				lastTwo.forEach((item, index) =>
				{
					item.indent = index;
					quickPickItems.push(item);
				});
				indent = lastTwo.length;
			}
		}

		// ------------------------------------------------------------

		const dirOnly = files.filter(fileInfo => fileInfo.type === MyFileType.directory);
		const fileOnly = files.filter(fileInfo => fileInfo.type === MyFileType.file);
		if (groupDirectories)
		{
			// まずディレクトリ
			quickPickItems.push({ label: i18nPlural(COMMON_TEXTS.directories, dirOnly.length), kind: vscode.QuickPickItemKind.Separator });

			// 親ディレクトリへ移動するためのアイテム（絶対パスモードでは不要）
			if (showDoubleDot)
			{
				const info = filePathToFileInfo(path.dirname(directory), false);
				const item = new RyDirectoryQPItem(this, info, true, baseDir);
				item.indent = indent;
				quickPickItems.push(item);
			}

			// 各ディレクトリ
			quickPickItems.push(...this.convertFileInfosToPathQPItems(dirOnly, baseDir, (item, index) => item.indent = indent ));

			// 次にファイル
			quickPickItems.push({ label: i18nPlural(COMMON_TEXTS.files, fileOnly.length), kind: vscode.QuickPickItemKind.Separator });
			quickPickItems.push(...this.convertFileInfosToPathQPItems(fileOnly, baseDir, (item, index) => item.indent = indent ));
		}
		else
		{
			// 親ディレクトリへ移動するためのアイテム（絶対パスモードでは不要）
			if (showDoubleDot)
			{
				const info = filePathToFileInfo(path.dirname(directory), false);
				if (info.type === MyFileType.directory)
				{
					quickPickItems.push(new RyDirectoryQPItem(this, info, true, baseDir));
				}
			}

			// ファイルの数を表示
			quickPickItems.push({ label: i18nPlural(COMMON_TEXTS.directories, dirOnly.length) + ' / ' + i18nPlural(COMMON_TEXTS.files, fileOnly.length), kind: vscode.QuickPickItemKind.Separator });

			quickPickItems.push(...this.convertFileInfosToPathQPItems(files, baseDir, (item, index) => item.indent = indent));
		}

		// ------------------------------------------------------------
		// ピン留めされているアイテムを追加
		const pinList = RyConfiguration.getPinnedList();
		if (pinList.length > 0)
		{
			// まず存在するファイル／ディレクトリのみに絞り込む
			const fileInfos = filePathListToFileInfoList(pinList);
			if (fileInfos.length > 0)
			{
				quickPickItems.push({ label: i18n(MESSAGES.quickAccesses), kind: vscode.QuickPickItemKind.Separator });
				quickPickItems.push(...this.convertFileInfosToPathQPItems(fileInfos, baseDir));
			}
		}

		// このディレクトリへのアクションを追加
		quickPickItems.push(...this.createActionsToDirectory());

		// その他コマンドを追加
		quickPickItems.push(...this.createCommands());

		return quickPickItems;
	}

	private createActionsToDirectory(): vscode.QuickPickItem[]
	{
		const result: vscode.QuickPickItem[] = [];

		result.push({ label: i18n(MESSAGES.actions), kind: vscode.QuickPickItemKind.Separator });
		result.push(new RyOpenAsWorkspaceCommandQPItem(this));
		result.push(new MyQuickPickRevealInExprolerItem(this));

		return result;
	}

	private createCommands(): vscode.QuickPickItem[]
	{
		const baseDir = RyConfiguration.getBaseDirectory();
		const result: vscode.QuickPickItem[] = [];

		result.push({ label: i18n(MESSAGES.commands), kind: vscode.QuickPickItemKind.Separator });

		// 基準ディレクトリを設定するコマンド。表示しているのが基準ディレクトリの場合は追加しない。
		if (baseDir !== this.fullPath)
		{
			result.push(new MyQuickPickSetBaseDirectoryItem(this, this.fullPath));
		}

		// 基準ディレクトリをクリアするコマンド。すでに基準ディレクトリが空なら追加しない。
		if (baseDir !== '')
		{
			result.push(new MyQuickPickSetBaseDirectoryItem(this, ''));
		}

		// パスを入力して移動するコマンド
		result.push(new RyInputPathCommandQPItem(this));

		// 絶対パスと相対パスを切り替えるコマンド
		result.push(new MyQuickPickTogglePathPresentationItem(this));

		// 隠しファイルの表示を切り替えるコマンド
		result.push(new MyQuickPickToggleShowHiddenFilesItem(this));

		// ワークスペース、編集中のファイル、ユーザーのディレクトリへそれぞれ移動するコマンド
		this.addGotoDirectoryItem(result, this.fullPath, MESSAGES.gotoWorkspaceDir, ryutils.getWorkspaceDirectory());
		const activeEditorDirectory = ryutils.getActiveEditorDirectory();
		if (activeEditorDirectory)
		{
			this.addGotoDirectoryItem(result, this.fullPath, MESSAGES.gotoEditingFileDir, activeEditorDirectory);
		}
		this.addGotoDirectoryItem(result, this.fullPath, MESSAGES.gotoUserDir, os.homedir());

		return result;
	}

	/**
	 * this._theQuickPick （全体）に表示するボタンのリストを作成する。
	 * @returns
	 */
	private createQuickPickButtons(): ryutils.RyQuickPickButton[]
	{
		const result: ryutils.RyQuickPickButton[] = [];

		// 絶対パス／相対パス切り替えボタン
		result.push(this.createTogglePathPresentationButton());

		// ディレクトリとファイルを分けて表示する設定の切り替えボタン
		result.push(this.createToggleGroupDirectoriesButton());

		// 隠しファイルの表示設定ボタン
		result.push(this.createShowHiddenFilesButton());

		return result;
	}

	/**
	 * 表示されているファイルとディレクトリのリストを更新する。
	 * 表示設定やお気に入り、ピン留めに変化があったときに必要な処理。
	 */
	public override updateList(): void
	{
		const files = listFilesAndHandleError(this._directory);
		if (files)
		{
			this._theQuickPick.placeholder = this.placeholderText;
			this._theQuickPick.items = this.createQuickPickItems(files);
			this._theQuickPick.buttons = this.createQuickPickButtons();
		}
	}

	public override showDirectory(directory: string): void
	{
		MyQuickPick.createMyQuickPick(directory);
	}

	public override onPinnedListChanged(): void
	{
		this.updateList();
	}
}










class MyQuickPickGotoDirItem extends RyQuickPickItem
{
	fullPath: string;

	/**
	 * コンストラクタ。
	 * @param label QuickPickItem のラベル。
	 * @param fullPath コマンドに関連付けられたパス。
	 */
	constructor(aQuickPick: RyQuickPickBase, label: string, fullPath: string)
	{
		super(aQuickPick);
		this.label = COMMAND_LABEL_PREFIX + label;
		this.description = maskUserNameDirectory(fullPath);
		this.fullPath = fullPath;
	}

	override didAccept(): void
	{
		// そのディレクトリへ移動
		if (MyQuickPick.createMyQuickPick(this.fullPath))
		{
			this.ownerQuickPick.dispose();
		}
	}
}










class MyQuickPickSetBaseDirectoryItem extends RyQuickPickItem
{
	private _targetDirectory: string;

	constructor(aQuickPick: MyQuickPick, targetDirectory: string)
	{
		super(aQuickPick);
		this.label = COMMAND_LABEL_PREFIX + (targetDirectory === '' ? i18n(MESSAGES['command.clearBaseDirectory']) : i18n(MESSAGES[ 'command.setBaseDirectory']));
		this.description = '';
		this._targetDirectory = targetDirectory;
	}

	override didAccept(): void
	{
		// ベースディレクトリとして設定
		RyConfiguration.setBaseDirectory(this._targetDirectory)
			.then(() =>
			{
				if (MyQuickPick.createMyQuickPick((this.ownerQuickPick as MyQuickPick).fullPath))
				{
					vscode.window.showInformationMessage(i18n(this._targetDirectory === '' ? MESSAGES.baseDirectoryCleared : MESSAGES.baseDirectoryUpdated, { dir: maskUserNameDirectory(this._targetDirectory) }));

					this.ownerQuickPick.dispose();
				}
			})
			.catch((error) => vscode.window.showErrorMessage(i18n(MESSAGES['error.couldntSetBaseDirectory']) + `: ${error}`));
	}
}










/**
 * 隠しファイルの表示切り替えコマンドの QuickPickItem。
 */
class MyQuickPickToggleShowHiddenFilesItem extends RyQuickPickItem
{
	constructor(aQuickPick: MyQuickPick)
	{
		super(aQuickPick);
		this.label = COMMAND_LABEL_PREFIX + i18n(MESSAGES[aQuickPick.showHiddenFiles ? 'hideHiddenFiles' : 'showHiddenFiles']);
		this.description = '';
	}

	override didAccept(): void
	{
		// 隠しファイルの表示設定を切り替える
		this.ownerQuickPick.showHiddenFiles = !this.ownerQuickPick.showHiddenFiles;
	}
}










/**
 * パス表示モードを切り替えるコマンドの QuickPickItem。
 * 2024/07/04
 */
class MyQuickPickTogglePathPresentationItem extends RyQuickPickItem
{
	constructor(aQuickPick: MyQuickPick)
	{
		super(aQuickPick);
		this.label = COMMAND_LABEL_PREFIX + i18n(MESSAGES[aQuickPick.getPathPresentation() === 'absolute' ? 'toRelativePathMode' : 'toAbsolutePathMode']);
	}

	override didAccept(): void
	{
		// パスの表示モードを切り替える
		this.ownerQuickPick.setPathPresentation(this.ownerQuickPick.getPathPresentation() === 'absolute' ? 'relative' : 'absolute');
	}
}










/**
 * 「パスを入力して移動」コマンドの QuickPickItem。
 */
class RyInputPathCommandQPItem extends RyQuickPickItem
{
	constructor(aQuickPick: MyQuickPick)
	{
		super(aQuickPick);
		this.label = COMMAND_LABEL_PREFIX + i18n(MESSAGES['inputPathCommand.label']);
		this.description = '';
	}

	override didAccept(): void
	{
		this.ownerQuickPick.dispose();
		const backDir = (this._ownerQuickPick as MyQuickPick).fullPath;
		InputPathQuickPick.createQuickPick(backDir);
	}
}










/**
 * 「ワークスペースとして開く」コマンドの QuickPickItem。
 */
class RyOpenAsWorkspaceCommandQPItem extends RyQuickPickItem
{
	private readonly _directory: string;

	constructor(aQuickPick: MyQuickPick)
	{
		super(aQuickPick);
		this.label = COMMAND_LABEL_PREFIX + i18n(MESSAGES.revealInExplorerCommandLabel, { app: 'VS Code' });
		this.description = '';
		this._directory = aQuickPick.fullPath;

		this.buttons.push({ iconPath: new vscode.ThemeIcon('empty-window'), tooltip: i18n(MESSAGES.openDirectoryAsWorkspaceInNewWindow), id: '' });
	}

	override didAccept(): void
	{
		// Codeでディレクトリを開く
		if (this._directory)
		{
			vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(this._directory), false);
		}
	}

	override onButtonClick(button: ryutils.RyQuickPickButton): void
	{
		// trueにすることで新しいウィンドウで開く
		vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(this._directory), true);
	}
}










/**
 * 「このディレクトリをエクスプローラーで開く」コマンドの QuickPickItem。
 */
class MyQuickPickRevealInExprolerItem extends RyQuickPickItem
{
	private _fullPath: string;

	constructor(aQuickPick: MyQuickPick)
	{
		super(aQuickPick);
		this.label = COMMAND_LABEL_PREFIX + i18n(MESSAGES.revealInExplorerCommandLabel, { app: ryutils.getOsDependentExplorerAppName() });
		this.description = '';
		this._fullPath = aQuickPick.fullPath;
	}

	override didAccept(): void
	{
		// ディレクトリを開く
		ryutils.openDirectory(this._fullPath);
	}
}










/**
 * お気に入りを表示するための QuickPick
 */
export class RyFavoriteQuickPick extends RyQuickPickBase
{
	private _numFavorites: number = 0;

	constructor()
	{
		super();
		this._theQuickPick.title = i18n(MESSAGES.favoriteQuickPickTitle);
		this.updateList();
	}

	public show(): void
	{
		this._theQuickPick.show();
	}

	public override updateList(): void
	{
		this._numFavorites = 0;

		// お気に入りを読み込む
		const favorites = RyConfiguration.getFavoriteList();
		const fileInfos = filePathListToFileInfoList(favorites);
		const baseDir = RyConfiguration.getBaseDirectory();
		this._theQuickPick.items = this.convertFileInfosToPathQPItems(fileInfos, baseDir, (item, index) => this._numFavorites++);
	}

	override get showHiddenFiles(): boolean
	{
		return false;
	}

	override set showHiddenFiles(value: boolean)
	{
	}

	public override onFavoriteListChanged(): void
	{
		// お気に入りが空になったらクイックピックを閉じる
		if (this.numFavorites === 0)
		{
			this.dispose();
		}
		else
		{
			this.updateList();
		}
	}

	public override showDirectory(directory: string): void
	{
		MyQuickPick.createMyQuickPick(directory);
	}

	public get numFavorites(): number
	{
		return this._numFavorites;
	}
}