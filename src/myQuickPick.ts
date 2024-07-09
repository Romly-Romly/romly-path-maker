import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

// 自前の国際化文字列リソースの読み込み
import { COMMON_TEXTS, i18n, i18nPlural, I18NText } from "./i18n";
import { MESSAGES } from "./i18nTexts";

import * as ryutils from './ryutils';
import { RyConfiguration, RyListType, RyPathItemsType } from './ryConfiguration';
import
{
	RyQuickPickBase,
	RyQuickPickItem,
	FileListStatus,
	ListFilesResult,
	EXTENSION_NAME_FOR_ERROR,
	RyPathQPItem,
	maskUserNameDirectory,
	MyFileType,
	RyPath,
	RyPathActionQPItem,
	RyPathAction,
	RyValidPathQPItem,
	COMMAND_LABEL_PREFIX,
} from './ryQuickPickBase';
import { InputPathQuickPick } from './ryInputPathQuickPick';











/**
 * 指定されたディレクトリ内のファイルをリストアップし、必要に応じてエラーメッセージを表示する。
 *
 * @param directory ファイルをリストアップするディレクトリのパス
 * @returns listFilesInDirectory の結果をそのまま返す。
 */
function listFilesAndHandleError(directory: RyPath): ListFilesResult
{
	const listFiles = directory.listFiles();
	if (listFiles.result === FileListStatus.SUCCESS)
	{
		return listFiles;
	}
	else if (listFiles.path.type === MyFileType.notFound)
	{
		vscode.window.showErrorMessage(i18n(MESSAGES['error.directoryNotFound'], { dir: directory.fullPath }));
	}
	else
	{
		const msg = i18n(MESSAGES['error.listFilesFailed'], { dir: directory.fullPath });
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










interface ITruncatedSet
{
	truncatedItems: RyPathQPItem[];
	showRemainingItem: RyShowRemainingDirectoriesQPItem;
}

/**
 * vscode の this._theQuickPick をラッパーしてこの拡張機能用に使いやすくしたクラス。
 * 2024/06/30
 */
export class MyQuickPick extends RyQuickPickBase
{
	// 現在表示しているディレクトリ
	private readonly _path: RyPath;

	// RyPathItemsType の各値に対する Record<RyPathItemsType, ITruncatedSet> のセット
	private readonly _truncatedSets: Record<RyPathItemsType, ITruncatedSet>;

	constructor(directory: RyPath)
	{
		super();
		this._path = directory;

		// ファイルとディレクトリの表示数制限用のセットを初期化
		this._truncatedSets = {} as Record<RyPathItemsType, ITruncatedSet>;
		for (const type of Object.values(RyPathItemsType))
		{
			this._truncatedSets[type] =
			{
				truncatedItems: [],
				showRemainingItem: new RyShowRemainingDirectoriesQPItem(this, type)
			};
		}

		const files = listFilesAndHandleError(directory);
		if (files.result === FileListStatus.SUCCESS)
		{
			// 最後に表示したディレクトリとして設定に保存しておく
			RyConfiguration.setLastDirectory(directory.fullPath).catch((error) => console.error(error));

			this._theQuickPick.items = this.createQuickPickItems(files);
			this._theQuickPick.title = maskUserNameDirectory(this._path.fullPath);
		}
		else
		{
			this._theQuickPick.title = 'error';
		}
		this.updateList();
	}

	public static makePlaceholderText(): string
	{
		if (RyConfiguration.getPathPresentation() === 'relative')
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

	protected override get placeholderText(): string
	{
		return MyQuickPick.makePlaceholderText();
	}

	public show(): void
	{
		this._theQuickPick.show();
	}

	get path(): RyPath
	{
		return this._path;
	}

	/**
	 * 指定されたディレクトリへの移動コマンド情報を quickPickItems に追加する。
	 *
	 * @param items 追加先。
	 * @param directory 現在のディレクトリ。
	 * @param labelKey アイテムのラベルの文字列リソースのキー。
	 * @param targetDir 移動先のディレクトリ。
	 */
	private addGotoDirectoryItem(items: vscode.QuickPickItem[], directory: RyPath, label: I18NText, targetDir: string): void
	{
		const targetPath = RyPath.createFromString(targetDir);
		if (targetPath.isValidPath && targetPath.isDirectory &&
			!targetPath.equals(directory))
		{
			items.push(new MyQuickPickGotoDirItem(this, i18n(label), targetPath));
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

		let indent = 0;
		return this.stringPathListToPathItemList(hierarchy, true, (item, index) =>
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
		// 相対パスを求める
		const relativePath = path.relative(baseDir, fullPath);

		const itemsInRoute: { indent: number, fullPath: string }[] = [];
		let currentPath: string = baseDir;
		let indent = 0;
		ryutils.splitPath(relativePath).forEach(pathComponent =>
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
		items.push(...this.stringPathListToPathItemList(
			itemsInRoute.map(item => item.fullPath), true,
			(item, index) => item.indent = itemsInRoute[index].indent));

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
		const files = listFilesResult.files;
		const baseDir = RyConfiguration.getBaseDirectory();
		const showRoute = RyConfiguration.getShowPathRoute();

		const quickPickItems: vscode.QuickPickItem[] = [];

		let showDoubleDot = false;
		let indent: number;
		if (this.getPathPresentation() === 'relative' && baseDir !== '')
		{
			// 基準ディレクトリが見付からない、ディレクトリでない、エラーの場合
			const baseDirInfo = RyPath.createFromString(baseDir);
			if (baseDirInfo.type !== MyFileType.directory)
			{
				quickPickItems.push({ label: i18n(MESSAGES.baseDirectory), kind: vscode.QuickPickItemKind.Separator });

				// エラーであることを示すアイテムを追加
				const baseDirItems = this.convertFileInfosToPathQPItems([baseDirInfo]);
				quickPickItems.push(...baseDirItems);

				// 現在のディレクトリを表示
				quickPickItems.push(...this.convertFileInfosToPathQPItems([listFilesResult.path]));

				indent = 1;
			}
			else
			{
				// 相対パス経路
				const relativeRoute = this.createRelativeRouteFromBaseDirectory(listFilesResult.path.fullPath, baseDir);

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
			const absoluteRoute = this.createDirectoryTreeItems(listFilesResult.path.fullPath);

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

		const dirOnly = files.filter(path => path.isDirectory);
		const fileOnly = files.filter(path => path.type === MyFileType.file);
		if (RyConfiguration.getGroupDirectories())
		{
			// まずディレクトリ
			quickPickItems.push({ label: i18nPlural(COMMON_TEXTS.directories, dirOnly.length), kind: vscode.QuickPickItemKind.Separator });

			// 親ディレクトリへ移動するためのアイテム（絶対パスモードでは不要）
			if (showDoubleDot)
			{
				const info = RyPath.createFromString(path.dirname(listFilesResult.path.fullPath));
				const item = new RyValidPathQPItem(this, info, true);
				item.indent = indent;
				quickPickItems.push(item);
			}

			// 各ディレクトリ
			quickPickItems.push(...this.createLimitedPathQPItems(dirOnly, indent, RyPathItemsType.directories));

			// 次にファイル
			quickPickItems.push({ label: i18nPlural(COMMON_TEXTS.files, fileOnly.length), kind: vscode.QuickPickItemKind.Separator });
			quickPickItems.push(...this.createLimitedPathQPItems(fileOnly, indent, RyPathItemsType.files));
		}
		else
		{
			// 親ディレクトリへ移動するためのアイテム（絶対パスモードでは不要）
			if (showDoubleDot)
			{
				const info = RyPath.createFromString(path.dirname(listFilesResult.path.fullPath));
				if (info.type === MyFileType.directory)
				{
					quickPickItems.push(new RyValidPathQPItem(this, info, true));
				}
			}

			// ファイルの数を表示
			quickPickItems.push({ label: i18nPlural(COMMON_TEXTS.directories, dirOnly.length) + ' / ' + i18nPlural(COMMON_TEXTS.files, fileOnly.length), kind: vscode.QuickPickItemKind.Separator });

			quickPickItems.push(...this.createLimitedPathQPItems(files, indent, RyPathItemsType.mixed));
		}

		// ------------------------------------------------------------
		// ピン留めされているアイテムを追加
		const pinList = RyConfiguration.getList(RyListType.pinned);
		if (pinList.length > 0)
		{
			const items = this.stringPathListToPathItemList(
				pinList.map(item => item.path),
				false,
				(item, index) =>
				{
					if (item instanceof RyValidPathQPItem)
					{
						item.isPinnedItem = true;
					}
				});
			if (items.length > 0)
			{
				quickPickItems.push({ label: i18n(MESSAGES.quickAccesses), kind: vscode.QuickPickItemKind.Separator });
				quickPickItems.push(...items);
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

		// パスをクリップボードにコピー
		result.push(new RyPathActionQPItem(this, this._path, RyPathAction.copyToClipboard));

		// パスをエディターに挿入する（アクティブなエディターがある場合のみ）
		if (ryutils.isActiveEditorVisible())
		{
			result.push(new RyPathActionQPItem(this, this._path, RyPathAction.insertToEditor));
		}

		// パスをターミナルに挿入する
		if (vscode.window.activeTerminal)
		{
			result.push(new RyPathActionQPItem(this, this._path, RyPathAction.insertToTermnal));
		}

		// このディレクトリをワークスペースとして開く
		result.push(new RyOpenAsWorkspaceCommandQPItem(this, false));
		result.push(new RyOpenAsWorkspaceCommandQPItem(this, true));

		// このディレクトリをエクスプローラーに表示する
		result.push(new MyQuickPickRevealInExprolerItem(this));

		// このディレクトリをお気に入りに登録
		result.push(new RyPathActionQPItem(this, this._path, this._path.isListed(RyListType.favorite) ? RyPathAction.removeFromFavorite : RyPathAction.addToFavorite));

		// このディレクトリをピン留め
		result.push(new RyPathActionQPItem(this, this._path, this._path.isListed(RyListType.pinned) ? RyPathAction.removeFromPinned : RyPathAction.addToPinned));

		return result;
	}

	private createCommands(): vscode.QuickPickItem[]
	{
		const baseDir = RyConfiguration.getBaseDirectory();
		const result: vscode.QuickPickItem[] = [];

		result.push({ label: i18n(MESSAGES.commands), kind: vscode.QuickPickItemKind.Separator });

		// 基準ディレクトリを設定するコマンド。表示しているのが基準ディレクトリの場合は追加しない。
		if (baseDir !== this._path.fullPath)
		{
			result.push(new MyQuickPickSetBaseDirectoryItem(this, this._path.fullPath));
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
		this.addGotoDirectoryItem(result, this._path, MESSAGES.gotoWorkspaceDir, ryutils.getWorkspaceDirectory());
		const activeEditorDirectory = ryutils.getActiveEditorDirectory();
		if (activeEditorDirectory)
		{
			this.addGotoDirectoryItem(result, this._path, MESSAGES.gotoEditingFileDir, activeEditorDirectory);
		}
		this.addGotoDirectoryItem(result, this._path, MESSAGES.gotoUserDir, os.homedir());

		return result;
	}

	protected override getButtons(): vscode.QuickInputButton[]
	{
		return [
			// 絶対パス／相対パス切り替えボタン
			this.createTogglePathPresentationButton(),

			// ディレクトリとファイルを分けて表示する設定の切り替えボタン
			this.createToggleGroupDirectoriesButton(),

			// 隠しファイルの表示設定ボタン
			this.createShowHiddenFilesButton(),
		];
	}

	protected override createItems(): vscode.QuickPickItem[]
	{
		const files = listFilesAndHandleError(this._path);
		if (files)
		{
			return this.createQuickPickItems(files);
		}
		else
		{
			return [];
		}
	}

	public override showDirectory(directory: RyPath): void
	{
		const quickPick = new MyQuickPick(directory);
		if (quickPick.path.isValidPath)
		{
			quickPick.show();
		}
	}

	public override onListChanged(listType: RyListType): void
	{
		this.updateList();
	}

	/**
	 * リスト内で選択済みのパスを設定する。
	 * @param aPath
	 * @param fromQuickAccess クイックアクセス内のアイテムから検索する場合は true を指定。
	 */
	public setActivePath(aPath: RyPath, fromQuickAccess: boolean): void
	{
		const found = this._theQuickPick.items.find(item =>
		{
			// fromQuickAccess が true の時はクイックアクセスのみ、 false の時は通常のアイテムのみ検索
			if ((item instanceof RyValidPathQPItem) &&
				(fromQuickAccess === item.isPinnedItem && item.equalPath(aPath)))
			{
				return true;
			}

			return false;
		});

		if (found)
		{
			this._theQuickPick.activeItems = [found];
		}
	}

	/**
	 * 省略されている残りのディレクトリを表示する。
	 */
	public showRemainingItems(itemsType: RyPathItemsType): void
	{
		const truncatedItems = this._truncatedSets[itemsType].truncatedItems;
		const showRemainingItem = this._truncatedSets[itemsType].showRemainingItem;

		// 省略したディレクトリがなければ何もしない
		if (truncatedItems.length === 0)
		{
			return;
		}

		const items = this._theQuickPick.items;

		// 自身に当たる部分を取り除き、そこに残りのディレクトリを追加する
		const index = items.indexOf(showRemainingItem);
		if (index >= 0)
		{
			this._theQuickPick.items = [
				...items.slice(0, index),
				...truncatedItems,
				...items.slice(index + 1)
			];

			this._theQuickPick.activeItems = [truncatedItems[0]];
			truncatedItems.length = 0;
		}
	}

	/**
	 * RyPath[] から RyPathQPItem[] に変換する。ただし、設定の最大表示数に従って余剰分は別のリストに保存する。
	 * @param paths
	 * @param indent
	 * @param pathItemsType
	 * @returns
	 */
	private createLimitedPathQPItems(paths: RyPath[], indent: number, pathItemsType: RyPathItemsType): vscode.QuickPickItem[]
	{
		const result: vscode.QuickPickItem[] = [];

		const dirItems = this.convertFileInfosToPathQPItems(paths, (item, index) => item.indent = indent );
		const max = RyConfiguration.getMaxItemsToDisplay(pathItemsType);
		if (max > 0 && dirItems.length > max)
		{
			// 最大表示数までは普通に追加
			result.push(...dirItems.slice(0, max));

			// 残りは別のリストに追加して保存しておく
			this._truncatedSets[pathItemsType].truncatedItems.push(...dirItems.slice(max));

			// 残りを表示するためのアイテムを追加
			result.push(this._truncatedSets[pathItemsType].showRemainingItem);

			this._truncatedSets[pathItemsType].showRemainingItem.indent = indent;
			this._truncatedSets[pathItemsType].showRemainingItem.remainCount = dirItems.length - max;
		}
		else
		{
			result.push(...dirItems);
		}

		return result;
	}
}










/**
 * 残りのディレクトリを表示するための QuickPickItem
 * 2024/07/07
 */
class RyShowRemainingDirectoriesQPItem extends RyQuickPickItem
{
	private readonly _pathItemsType: RyPathItemsType;
	private _indent: number = 0;
	private _remainCount: number = 0;

	constructor(aQuickPick: RyQuickPickBase, directories: RyPathItemsType)
	{
		super(aQuickPick);
		this._pathItemsType = directories;
		this.indent = 0;
	}

	private updateLabel(): void
	{
		let msg;
		switch (this._pathItemsType)
		{
			case RyPathItemsType.directories:
				msg = MESSAGES.showRestDirectories;
				break;
			case RyPathItemsType.files:
				msg = MESSAGES.showRestFiles;
				break;
			case RyPathItemsType.mixed:
				msg = MESSAGES.showRestItems;
				break;
		}
		this.label = RyPathQPItem.indentToSpaces(this._indent) + i18n(msg, { count: String(this._remainCount) });
	}

	/**
	 * 残りのディレクトリ／ファイル数を設定するアクセスメソッド。ラベルに表示されるだけ。
	 */
	public set remainCount(value: number)
	{
		this._remainCount = value;
		this.updateLabel();
	}

	/**
	 * ラベルのインデントを設定するアクセスメソッド。
	 */
	public set indent(value: number)
	{
		this._indent = value;
		this.updateLabel();
	}

	public override didAccept(): void
	{
		if (this._ownerQuickPick instanceof MyQuickPick)
		{
			this._ownerQuickPick.showRemainingItems(this._pathItemsType);
		}
	}
}










class MyQuickPickGotoDirItem extends RyQuickPickItem
{
	private _targetPath: RyPath;

	/**
	 * コンストラクタ。
	 * @param label QuickPickItem のラベル。
	 * @param fullPath コマンドに関連付けられたパス。
	 */
	constructor(aQuickPick: RyQuickPickBase, label: string, aTargetPath: RyPath)
	{
		super(aQuickPick);
		this.label = COMMAND_LABEL_PREFIX + label;
		this.description = maskUserNameDirectory(aTargetPath.fullPath);
		this._targetPath = aTargetPath;
	}

	override didAccept(): void
	{
		// そのディレクトリへ移動
		const quickPick = new MyQuickPick(this._targetPath);
		if (quickPick.path.isValidPath)
		{
			this.ownerQuickPick.dispose();
			quickPick.show();
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
		// 基準ディレクトリとして設定
		RyConfiguration.setBaseDirectory(this._targetDirectory)
			.then(() =>
			{
				const quickPick = new MyQuickPick((this.ownerQuickPick as MyQuickPick).path);
				if (quickPick.path.isValidPath)
				{
					// 基準ディレクトリを更新した旨を表示
					vscode.window.showInformationMessage(i18n(this._targetDirectory === '' ? MESSAGES.baseDirectoryCleared : MESSAGES.baseDirectoryUpdated, { dir: maskUserNameDirectory(this._targetDirectory) }));

					this.ownerQuickPick.dispose();
					quickPick.show();
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
		const backDir = (this._ownerQuickPick as MyQuickPick).path;
		InputPathQuickPick.createQuickPick(backDir);
	}
}










/**
 * 「ワークスペースとして開く」コマンドの QuickPickItem。
 */
class RyOpenAsWorkspaceCommandQPItem extends RyQuickPickItem
{
	private readonly _path: RyPath;
	private readonly _newWindow: boolean;

	constructor(aQuickPick: MyQuickPick, newWindow: boolean)
	{
		super(aQuickPick);
		this._newWindow = newWindow;
		const icon = newWindow ? 'empty-window' : 'window';
		const msg = newWindow ? MESSAGES.openDirectoryAsWorkspaceInNewWindow : MESSAGES.openInAppCommandLabel;
		this.label = `${COMMAND_LABEL_PREFIX} \$(${icon}) ` + i18n(msg, { app: 'VS Code' });
		this._path = aQuickPick.path;
	}

	override didAccept(): void
	{
		// Codeでディレクトリを開く
		this._path.openAsWorkspace(this._newWindow);
	}
}










/**
 * 「このディレクトリをエクスプローラーで開く」コマンドの QuickPickItem。
 */
class MyQuickPickRevealInExprolerItem extends RyQuickPickItem
{
	private _path: RyPath;

	constructor(aQuickPick: MyQuickPick)
	{
		super(aQuickPick);
		this.label = `${COMMAND_LABEL_PREFIX} $(folder-opened) ` + i18n(MESSAGES.revealInExplorerCommandLabel, { app: ryutils.getOsDependentExplorerAppName() });
		this.description = '';
		this._path = aQuickPick.path;
	}

	override didAccept(): void
	{
		// ディレクトリを開く
		this._path.openDirectory();
	}
}










/**
 * お気に入り／クイックアクセス／履歴を表示するための QuickPick
 */
export class RyCertainListQuickPick extends RyQuickPickBase
{
	private readonly _listType: RyListType;
	private _numItems: number = 0;

	constructor(listType: RyListType)
	{
		super();
		this._listType = listType;
		switch (listType)
		{
			case RyListType.favorite:
				this._theQuickPick.title = i18n(MESSAGES.favoriteQuickPickTitle);
				break;

			case RyListType.pinned:
				this._theQuickPick.title = i18n(MESSAGES.quickAccesses);
				break;

			case RyListType.history:
				this._theQuickPick.title = i18n(MESSAGES.historyQuickPickTitle);
				break;
		}
		this.updateList();
	}

	/**
	 * RyPathQPItem[] をディレクトリとファイルに分け、セパレーターを挿入したリストに変換する。
	 * @param items
	 * @returns
	 */
	public static separatePathItemsIfNeeded(items: RyPathQPItem[]): vscode.QuickPickItem[]
	{
		if (RyConfiguration.getGroupDirectories())
		{
			// ディレクトリとファイルを分ける
			const dirOnly = items.filter(item => item.path.isDirectory);
			const fileOnly = items.filter(item => item.path.type === MyFileType.file);

			// まずディレクトリ
			const quickPickItems: vscode.QuickPickItem[] = [];
			quickPickItems.push({ label: i18nPlural(COMMON_TEXTS.directories, dirOnly.length), kind: vscode.QuickPickItemKind.Separator });
			quickPickItems.push(...dirOnly);

			// 次にファイル
			quickPickItems.push({ label: i18nPlural(COMMON_TEXTS.files, fileOnly.length), kind: vscode.QuickPickItemKind.Separator });
			quickPickItems.push(...fileOnly);
			return quickPickItems;
		}
		else
		{
			return items;
		}
	}

	protected override get placeholderText(): string
	{
		return MyQuickPick.makePlaceholderText();
	}

	protected override createItems(): vscode.QuickPickItem[]
	{
		this._numItems = 0;

		// リストを読み込む
		const list = RyConfiguration.getList(this._listType);

		// 履歴については追加日の逆順に並び替え
		if (this._listType === RyListType.history)
		{
			list.sort((a, b) => b.added - a.added);
		}

		const pathItems = this.stringPathListToPathItemList(
			list.map(item => item.path),
			false,
			(item, index) => this._numItems++);

		const items = RyCertainListQuickPick.separatePathItemsIfNeeded(pathItems);

		// お気に入りリストの場合、ディレクトリとファイルを分けない時は並び替えや削除ボタンを有効にする。
		if (!RyConfiguration.getGroupDirectories() && this._listType === RyListType.favorite)
		{
			items.forEach((item, index) =>
			{
				if (item instanceof RyValidPathQPItem)
				{
					// 上への移動ボタンは先頭には追加しない
					if (index > 0)
					{
						item.addButton(new RyCertainListQPItemButtonMove(item, true, this._listType));
					}

					// 下への移動ボタンは末尾には追加しない
					if (index < items.length - 1)
					{
						item.addButton(new RyCertainListQPItemButtonMove(item, false, this._listType));
					}
				}
				return item;
			});
		}

		return items;
	}

	protected override getButtons(): vscode.QuickInputButton[]
	{
		return [
			// 絶対パス／相対パス切り替えボタン
			this.createTogglePathPresentationButton(),

			// ディレクトリとファイルを分けて表示する設定の切り替えボタン
			this.createToggleGroupDirectoriesButton(),

			// 隠しファイルの表示設定ボタン
			this.createShowHiddenFilesButton(),
		];
	}

	/**
	 * 指定されたパスの項目をアクティブにする。
	 * パスを選択して戻ってきた時なんかに必要な処理。
	 * @param aPath
	 */
	public setActiveItem(aPath: RyPath): void
	{
		for (let i = 0; i < this._theQuickPick.items.length; i++)
		{
			const item = this._theQuickPick.items[i];
			if (item instanceof RyValidPathQPItem)
			{
				if ((item as RyValidPathQPItem).equalPath(aPath))
				{
					this._theQuickPick.activeItems = [item];
					break;
				}
			}
		}
	}

	public show(): void
	{
		this._theQuickPick.show();
	}

	public override onListChanged(listType: RyListType): void
	{
		if (listType === this._listType)
		{
			// 空になったらクイックピックを閉じる
			if (this.numItems === 0)
			{
				this.dispose();
			}
			else
			{
				this.updateList();
			}
		}
	}

	public override showDirectory(directory: RyPath): void
	{
		const quickPick = new MyQuickPick(directory);
		if (quickPick.path.isValidPath)
		{
			quickPick.show();
		}
	}

	public get numItems(): number
	{
		return this._numItems;
	}
}










/**
 * リストからパスを削除するボタン
 * 2024/07/07
 */
class RyCertainListQPItemButtonMove extends ryutils.RyQPItemButton
{
	private readonly _moveUp: boolean;

	private readonly _targetPath: RyPath;

	private readonly _listType: RyListType;

	constructor(owner: RyValidPathQPItem, moveUp: boolean, aListType: RyListType)
	{
		super(owner, new vscode.ThemeIcon(moveUp ? 'chevron-up' : 'chevron-down'));
		this._moveUp = moveUp;
		this._targetPath = owner.path;
		this._listType = aListType;
	}

	public override onClick(): void
	{
		// 設定からリストを読み込み
		const list = RyConfiguration.getList(this._listType);

		const index = list.findIndex(item => this._targetPath.equals(item.path));
		if (index >= 0)
		{
			let changed = false;

			const item = list.splice(index, 1)[0];
			if (this._moveUp)
			{
				// 一つ上に移動
				if (index > 1)
				{
					list.splice(index - 1, 0, item);
					changed = true;
				}
			}
			else
			{
				// 1つ下に移動
				if (index < list.length - 1)
				{
					list.splice(index + 1, 0, item);
					changed = true;
				}
			}

			// 保存
			if (changed)
			{
				RyConfiguration.saveList(this._listType, list).then(() =>
				{
					// 保存完了したらリストを更新してアクティブにする
					if (this.ownerItem instanceof RyValidPathQPItem)
					{
						if (this.ownerItem._ownerQuickPick instanceof RyCertainListQuickPick)
						{
							this.ownerItem._ownerQuickPick.updateList();
							this.ownerItem._ownerQuickPick.setActiveItem(this._targetPath);
						}
					}
				});
			}
		}
	}
}