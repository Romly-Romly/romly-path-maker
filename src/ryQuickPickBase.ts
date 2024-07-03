import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import * as ryutils from './ryutils';
import { RyConfiguration, RyPathPresentation } from './ryConfiguration';

// 自前の国際化文字列リソースの読み込み
import { i18n } from "./i18n";
import { MESSAGES } from "./i18nTexts";










export const EXTENSION_NAME_FOR_ERROR = 'Romly: Path-Maker';










/**
 * 指定されたパス文字列からユーザー名を設定に応じて隠す。
 * 隠す場合は '<username>' に置き換える。
 *
 * @param pathString - マスクを適用するパス文字列。
 * @returns ユーザー名がマスクされたパス、または元のパス文字列。
 */
export function maskUserNameDirectory(pathString: string): string
{
	// ユーザー名に含まれる正規表現のメタ文字をエスケープする処理
	function escapeRegExp(s: string)
	{
		return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $&はマッチした全文字列を意味する
	}

	if (RyConfiguration.getHideUserName())
	{
		const username = path.basename(os.homedir());
		const escapedUsername = escapeRegExp(username);
		const escapedSep = escapeRegExp(path.sep);
		const regex = new RegExp(`${escapedSep}${escapedUsername}(${escapedSep}|$)`, 'g');
		return pathString.replace(regex, `${path.sep}<username>$1`);
	}
	else
	{
		return pathString;
	}
}










/**
 * 相対パスを取得する。ただしベースディレクトリに空文字列を渡した場合は絶対パスを返す。
 *
 * @param baseDir ベースディレクトリ
 * @param fullPath 変換するパス
 * @returns 相対パスまたは絶対パス
 */
export function getRelativeOrAbsolutePath(baseDir: string, fullPath: string): string
{
	if (!baseDir || baseDir.trim() === '')
	{
		// baseDirが空の場合は絶対パスを返す
		return path.resolve(fullPath);
	}
	else
	{
		// baseDirが有効な場合は相対パスを返す
		return path.relative(baseDir, fullPath);
	}
}










export enum MyFileType { file, directory, notFound, error };

export class MyFileInfo
{
	fullPath: string;
	type: MyFileType;

	constructor(fullPath: string, type: MyFileType)
	{
		this.fullPath = fullPath;
		this.type = type;
	}

	filenameOnly(): string
	{
		return path.basename(this.fullPath);
	}

	get isHiddenFile(): boolean
	{
		return path.basename(this.fullPath).startsWith('.');
	}
}










/**
 * ファイルのパスから MyFileInfo を作成する。ファイル情報を取得したりファイルかディレクトリかを調べたりする。
 * @param fullPath ファイル／ディレクトリのフルパス。
 * @param undefinedIfError true の場合、パスが存在しなかったり情報が取得できなかった場合に undefined を返す。
 * @returns MyFileInfo。undefinedIfError が true かつ、パスが見付からなかったり情報が取得できなかった場合は undefined
 */
export function filePathToFileInfo<T extends boolean>(fullPath: string, undefinedIfError: T = true as T): T extends true ? MyFileInfo | undefined : MyFileInfo
{
	// 見付からないファイルは省く
	if (!fs.existsSync(fullPath))
	{
		// 返り値の型を変えるという特殊なことをやってるので、コンパイラを黙らせるために any にキャストしないといけない。他のreturnのとこも同じ。
		return (undefinedIfError ? undefined : new MyFileInfo(fullPath, MyFileType.notFound)) as any;
	}

	// ファイル情報が取得できなかったもの（エラー発生）は省く
	try
	{
		const stat = fs.statSync(fullPath);
		return (new MyFileInfo(fullPath, stat.isDirectory() ? MyFileType.directory : MyFileType.file)) as any;
	}
	catch (err)
	{
		console.error(`Romly Path Maker: statSync failed for: ${fullPath}`, err);
		return (undefinedIfError ? undefined : new MyFileInfo(fullPath, MyFileType.error)) as any;
	}
}










export function filePathListToFileInfoList(filePathList: string[]): MyFileInfo[]
{
	const result: MyFileInfo[] = [];
	filePathList.forEach(listPath =>
	{
		// エラーになったファイルもMyFileInfoとして追加される。
		const info = filePathToFileInfo(listPath, false);
		if (info)
		{
			result.push(info);
		}
	});
	return result;
}







export enum FileListStatus { SUCCESS, NOT_FOUND, ERROR };

/**
 * listFilesInDirectory の結果を表すオブジェクト。
 */
export class ListFilesResult
{
	result: FileListStatus;
	path: string;
	files: MyFileInfo[];
	error?: Error;

	constructor(result: FileListStatus, path: string, files: MyFileInfo[] = [], error: Error | undefined = undefined)
	{
		this.result = result;
		this.path = path;
		this.files = files;
		this.error = error;
	}
}










/**
 * 指定されたディレクトリ内のファイル一覧を MyFileInfo のリストとして取得する。
 *
 * @param directory ファイル一覧を取得したいディレクトリのパス
 * @returns ファイル取得の成否、ファイル情報の配列、エラー情報（ある場合）を含むオブジェクト。
 */
export function listFilesInDirectory(directory: string): ListFilesResult
{
	const filterHiddenFiles = !RyConfiguration.getShowHiddenFiles();

	// ディレクトリの存在チェック
	if (!fs.existsSync(directory))
	{
		return new ListFilesResult(FileListStatus.NOT_FOUND, directory);
	}

	const result = [] as MyFileInfo[];
	let files;
	try
	{
		files = fs.readdirSync(directory);

		// 文中で return する必要があるので forEach ではなく for ループで。
		for (const filename of files)
		{
			const fullPath = path.join(directory, filename);

			// ファイル情報が取得できなかったもの（エラー発生）は省く
			const info = filePathToFileInfo(fullPath, true);
			if (info !== undefined)
			{
				// 隠しファイルの表示設定に応じて省く
				if (!filterHiddenFiles || !info.isHiddenFile)
				{
					result.push(info);
				}
			}
		}
	}
	catch (err)
	{
		return new ListFilesResult(FileListStatus.ERROR, directory, [], err as Error);
	}

	return new ListFilesResult(FileListStatus.SUCCESS, directory, result);
}










/**
 * 拡張機能内で使用する各 QuickPick の基底クラス。
 */
export abstract class RyQuickPickBase
{
	//　内部で使用しているQuickPickのボタンの識別子。文字列は識別のみなので何でもおけ。
	private readonly BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES = 'toggle_show_hidden_files';
	private readonly BUTTON_ID_TOGGLE_PATH_PRESENTATION = 'togglePathPresentation';
	private readonly BUTTON_ID_TOGGLE_GROUP_DIRECTORIES = 'toggle_group_directories';

	protected readonly _theQuickPick: vscode.QuickPick<vscode.QuickPickItem>;

	constructor()
	{
		this._theQuickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();

		// QuickPick のボタン押下時の処理
		this._theQuickPick.onDidTriggerButton((button) =>
		{
			const buttonId = (button as ryutils.RyQuickPickButton).id;
			if (buttonId === this.BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES)
			{
				// 隠しファイルの表示設定を切り替える
				this.showHiddenFiles = !this.showHiddenFiles;
			}
			else if (buttonId === this.BUTTON_ID_TOGGLE_GROUP_DIRECTORIES)
			{
				// ディレクトリのグループ表示設定を切り替える
				this.toggleGroupDirectories();
			}
			else if (buttonId === this.BUTTON_ID_TOGGLE_PATH_PRESENTATION)
			{
				// パスの表示形式を切り替える
				this.setPathPresentation(this.getPathPresentation() === 'relative' ? 'absolute' : 'relative');
			}
		});

		// 選択時の処理
		this._theQuickPick.onDidAccept(() => this.onItemAccept());

		// 個々のアイテムのボタン押下時の処理
		this._theQuickPick.onDidTriggerItemButton(e => this.onItemButtonClick(e));
	}

	private onItemAccept(): void
	{
		const selection = this._theQuickPick.selectedItems[0];
		if (selection && selection instanceof RyQuickPickItem)
		{
			selection.didAccept();
		}
	}

	private onItemButtonClick(e: vscode.QuickPickItemButtonEvent<vscode.QuickPickItem>): void
	{
		if (e.item instanceof RyQuickPickItem)
		{
			const button = e.button as ryutils.RyQuickPickButton;
			e.item.onButtonClick(button);
		}
	}

	private toggleGroupDirectories()
	{
		RyConfiguration.setGroupDirectories(!RyConfiguration.getGroupDirectories()).then(() =>
		{
			// 設定の変更に伴うQuickPick自体の更新
			this.updateList();
		});
	}

	protected createToggleGroupDirectoriesButton(): ryutils.RyQuickPickButton
	{
		return RyConfiguration.getGroupDirectories() ?
			{ id: this.BUTTON_ID_TOGGLE_GROUP_DIRECTORIES, iconPath: new vscode.ThemeIcon('folder'), tooltip: i18n(MESSAGES['tooltip.ungroupDirectories']) } :
			{ id: this.BUTTON_ID_TOGGLE_GROUP_DIRECTORIES, iconPath: new vscode.ThemeIcon('folder-library'), tooltip: i18n(MESSAGES['tooltip.groupDirectories']) };
	}

	protected createShowHiddenFilesButton(): ryutils.RyQuickPickButton
	{
		return RyConfiguration.getShowHiddenFiles() ?
			{ id: this.BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES, iconPath: new vscode.ThemeIcon('eye'), tooltip: i18n(MESSAGES['tooltip.hideHiddenFiles']) } :
			{ id: this.BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES, iconPath: new vscode.ThemeIcon('eye-closed'), tooltip: i18n(MESSAGES['tooltip.showHiddenFiles']) };
	}

	protected createTogglePathPresentationButton(): ryutils.RyQuickPickButton
	{
		return RyConfiguration.getPathPresentation() === 'absolute' ?
			{ id: this.BUTTON_ID_TOGGLE_PATH_PRESENTATION, iconPath: new vscode.ThemeIcon('list-tree'), tooltip: i18n(MESSAGES['tooltip.absolutePathMode']) } :
			{ id: this.BUTTON_ID_TOGGLE_PATH_PRESENTATION, iconPath: new vscode.ThemeIcon('list-flat'), tooltip: i18n(MESSAGES['tooltip.relativePathMode']) };
	}

	/**
	 * MyFileInfo[] を RyPathQPItem[] に変換する。
	 * @param infos
	 * @param baseDirectory 基準ディレクトリを指定。
	 * @returns
	 */
	protected convertFileInfosToPathQPItems(infos: MyFileInfo[], baseDirectory: string, callback: (item: RyPathQPItem, index: number) => void = () => null): RyPathQPItem[]
	{
		const items: RyPathQPItem[] = [];

		infos.forEach((fileInfo, index) =>
		{
			let item: RyPathQPItem;
			if (fileInfo.type === MyFileType.directory)
			{
				item = new RyDirectoryQPItem(this, fileInfo, false, baseDirectory);
			}
			else if (fileInfo.type === MyFileType.file)
			{
				item = new RyFileQPItem(this, fileInfo, baseDirectory);
			}
			else
			{
				item = new RyErrorPathQPItem(this, fileInfo);
			}
			items.push(item);
			callback(item, index);
		});

		return items;
	}

	/**
	 * お気に入りリストの変更時に呼ばれる。
	 * 必要な処理があれば継承先で実装。
	 */
	public onFavoriteListChanged(): void
	{
	}

	public onPinnedListChanged(): void
	{
	}

	public showDirectory(directory: string): void
	{
	}

	public hide(): void
	{
		this._theQuickPick.hide();
	}

	public dispose(): void
	{
		this._theQuickPick.dispose();
	}

	public abstract updateList(): void;

	get showHiddenFiles(): boolean
	{
		return RyConfiguration.getShowHiddenFiles();
	}

	set showHiddenFiles(value: boolean)
	{
		RyConfiguration.setShowHiddenFiles(value).then(() =>
		{
			// 設定の変更に伴うQuickPick自体の更新
			this.updateList();
		});
	}

	protected getPathPresentation(): RyPathPresentation
	{
		return RyConfiguration.getPathPresentation();
	}

	protected setPathPresentation(value: RyPathPresentation)
	{
		RyConfiguration.setPathPresentation(value).then(() =>
		{
			// 設定の変更に伴うQuickPick自体の更新
			this.updateList();
		});
	}
}










/**
 * RyQuickPickBase に追加可能な QuickPickItem の基底クラス。
 */
export abstract class RyQuickPickItem implements vscode.QuickPickItem
{
	label: string;
	description: string;
	detail: string | undefined = undefined;
	alwaysShow: boolean = false;
	buttons: ryutils.RyQuickPickButton[];

	// 自身が所属する QuickPick への参照を持つ
	_ownerQuickPick: RyQuickPickBase;

	constructor(aQuickPick: RyQuickPickBase)
	{
		this.label = '';
		this.description = '';
		this.buttons = [];
		this._ownerQuickPick = aQuickPick;
	}

	protected get ownerQuickPick(): RyQuickPickBase
	{
		return this._ownerQuickPick;
	}

	/**
	 * QuickPickItem が選択されたときに呼び出される。
	 */
	public didAccept(): void
	{
	}

	onButtonClick(button: ryutils.RyQuickPickButton): void
	{
	}
}










/**
 * ファイルまたはディレクトリを示す QuickPickItem の継承元。
 * この時点で「お気に入りに登録」「ピン留め」ボタンがあるよ。
 */
export abstract class RyPathQPItem extends RyQuickPickItem
{
	// ボタン識別用の定数
	private readonly BUTTON_ID_COPY = 'copy';
	private readonly BUTTON_ID_INSERT_PATH_TO_EDITOR = 'insert_path_to_editor';
	private readonly BUTTON_ID_INSERT_PATH_TO_TERMINAL = 'insert_path_to_terminal';
	private readonly BUTTON_ID_OPEN_IN_EDITOR = 'open_in_editor';
	private readonly BUTTON_ID_REVEAL_IN_FILE_EXPLORER = 'reveal_in_file_explorer';
	private readonly BUTTON_ID_PIN = 'pin';
	private readonly BUTTON_ID_FAVORITE = 'favorite';

	fullPath: string;
	insertPath: string;

	iconPath?: vscode.Uri | {
		light: vscode.Uri;
		dark: vscode.Uri;
	} | vscode.ThemeIcon;

	// インデントを含まないラベル。インデント設定用に保持しておく。
	private _label: string;

	constructor(aQuickPick: RyQuickPickBase, aPath: string, aLabel: string)
	{
		super(aQuickPick);
		this._label = aLabel;
		this.fullPath = path.normalize(aPath);
		this.insertPath = '';

		// 初期インデントはゼロ（インデント無し）
		this.indent = 0;
	}

	/**
	 * このファイル／ディレクトリがクイックアクセスにピン留めされていれば true
	 */
	private get amIPinned(): boolean
	{
		return RyConfiguration.isPinned(this.fullPath);
	}

	/**
	 * このファイル／ディレクトリがお気に入りに登録されていれば true
	 */
	private get amIFavorite(): boolean
	{
		return RyConfiguration.isFavorite(this.fullPath);
	}

	/**
	 * このファイル／ディレクトリをクイックアクセスから取り除く。
	 */
	private async purgeMeFromPinnedList(): Promise<void>
	{
		try
		{
			await RyConfiguration.removeFromPinnedList(this.fullPath);
			this._ownerQuickPick.onPinnedListChanged();
		}
		catch (err)
		{
			ryutils.showErrorMessageWithDetailChannel(i18n(MESSAGES.failedToWritePinnedList), EXTENSION_NAME_FOR_ERROR, `Error occurred while updating pinned list.`, err);
		}
	}

	/**
	 * このファイル／ディレクトリをお気に入りから取り除く。
	 */
	private async removeFromFavoriteList(): Promise<void>
	{
		try
		{
			await RyConfiguration.removeFromFavoriteList(this.fullPath);
			this._ownerQuickPick.onFavoriteListChanged();
		}
		catch (err)
		{
			ryutils.showErrorMessageWithDetailChannel(i18n(MESSAGES.failedToWriteFavoriteList), EXTENSION_NAME_FOR_ERROR, `Error occurred while updating favorite list.`, err);
		}
	}

	/**
	 * このファイル／ディレクトリをクイックアクセスにピン留めする。
	 */
	private async addMeToPinnedList(): Promise<void>
	{
		try
		{
			await RyConfiguration.addToPinnedList(this.fullPath);
			this._ownerQuickPick.onPinnedListChanged();
		}
		catch (err)
		{
			ryutils.showErrorMessageWithDetailChannel(i18n(MESSAGES.failedToWritePinnedList), EXTENSION_NAME_FOR_ERROR, `Error occurred while updating pinned list.`, err);
		}
	}

	/**
	 * このファイル／ディレクトリをお気に入りに登録する。
	 */
	private async addToFavoriteList(): Promise<void>
	{
		try
		{
			await RyConfiguration.addToFavoriteList(this.fullPath);
			this._ownerQuickPick.onFavoriteListChanged();
		}
		catch (err)
		{
			ryutils.showErrorMessageWithDetailChannel(i18n(MESSAGES.failedToWriteFavoriteList), EXTENSION_NAME_FOR_ERROR, `Error occurred while updating favorite list.`, err);
		}
	}

	protected addPinAndFavoriteButton(): void
	{
		// ピン留めボタン
		if (this.amIPinned)
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('pinned'), tooltip: i18n(MESSAGES.unpinThis), id: this.BUTTON_ID_PIN });
		}
		else
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('pin'), tooltip: i18n(MESSAGES.pinThis), id: this.BUTTON_ID_PIN });
		}

		// お気に入りボタン
		if (this.amIFavorite)
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('star-full'), tooltip: i18n(MESSAGES.removeFromFavorite), id: this.BUTTON_ID_FAVORITE });
		}
		else
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('star'), tooltip: i18n(MESSAGES.addToFavorite), id: this.BUTTON_ID_FAVORITE });
		}
	}

	protected addCopyButton(): void
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('copy'), tooltip: i18n(MESSAGES.copyPathToClipboard), id: this.BUTTON_ID_COPY });
	}

	protected addInsertPathToEditorButton(): void
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('insert'), tooltip: i18n(MESSAGES.insertPathToActiveEditor), id: this.BUTTON_ID_INSERT_PATH_TO_EDITOR });
	}

	protected addInsertPathToTerminalButton(): void
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('terminal'), tooltip: i18n(MESSAGES.insertPathToActiveTerminal), id: this.BUTTON_ID_INSERT_PATH_TO_TERMINAL });
	}

	protected addOpenInEditorButton(): void
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('edit'), tooltip: i18n(MESSAGES.openInEditor), id: this.BUTTON_ID_OPEN_IN_EDITOR });
	}

	protected addRevealInFileExplorerButton()
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('folder-opened'), tooltip: i18n(MESSAGES.revealInFileExplorer), id: this.BUTTON_ID_REVEAL_IN_FILE_EXPLORER });
	}

	/**
	 * このアイテムにアイコンを設定する。ただし、アイコンを表示する設定にしている場合のみ。
	 * @param forceIcon 設定するアイコン名。省略すると 'folder' となる。
	 */
	protected setIcon(icon: string | undefined = 'folder'): void
	{
		if (icon !== undefined && icon.length > 0)
		{
			if (RyConfiguration.getShowDirectoryIcons())
			{
				this.iconPath = new vscode.ThemeIcon(icon);
			}
		}
	}

	protected executeFileAction(): void
	{
		// 設定されているアクションを実行
		switch (RyConfiguration.getDefaultAction())
		{
			case 'Open':
				if (this.fullPath)
				{
					ryutils.openFileInEdtor(this.fullPath);
				}
				break;
			case 'Copy':
				if (this.insertPath)
				{
					ryutils.copyTextToClipboard(this.insertPath);
				}
				break;
			case 'Editor':
				this.insertPath && ryutils.insertTextToEdtior(this.insertPath);
				break;
			case 'Terminal':
				if (this.insertPath)
				{
					ryutils.sendTextToTerminal(this.insertPath);
				}
				break;
			case 'Reveal':
				if (this.fullPath)
				{
					ryutils.openDirectory(path.dirname(this.fullPath));
				}
				break;
		}
	}

	/**
	 * ラベル用のインデント幅を文字列で作る。
	 * @param indent インデントレベル。
	 * @returns 半角スペースで構成された擬似的なインデント文字列。
	 */
	protected indentToSpaces(indent: number): string
	{
		return '   '.repeat(indent);
	}

	override onButtonClick(button: ryutils.RyQuickPickButton): void
	{
		if (button.id === this.BUTTON_ID_COPY)
		{
			// クリップボードにパスをコピー
			ryutils.copyTextToClipboard(this.insertPath);
			this._ownerQuickPick.dispose();
		}
		else if (button.id === this.BUTTON_ID_INSERT_PATH_TO_EDITOR)
		{
			// エディターにパスを挿入
			ryutils.insertTextToEdtior(this.insertPath);
			this._ownerQuickPick.dispose();
		}
		else if (button.id === this.BUTTON_ID_INSERT_PATH_TO_TERMINAL)
		{
			// アクティブなターミナルにパスを挿入
			ryutils.sendTextToTerminal(this.insertPath);
			this._ownerQuickPick.dispose();
		}
		else if (button.id === this.BUTTON_ID_OPEN_IN_EDITOR)
		{
			// エディタで開く
			ryutils.openFileInEdtor(this.fullPath);
			this._ownerQuickPick.dispose();
		}
		else if (button.id === this.BUTTON_ID_REVEAL_IN_FILE_EXPLORER)
		{
			// ディレクトリを開く
			ryutils.openDirectory(this.fullPath);
			this._ownerQuickPick.dispose();
		}
		else if (button.id === this.BUTTON_ID_PIN)
		{
			// クイックアクセスにピン留め
			// 登録されていた場合は削除。登録されていない場合は登録。
			const func = this.amIPinned ? this.purgeMeFromPinnedList : this.addMeToPinnedList;
			func.call(this);
		}
		else if (button.id === this.BUTTON_ID_FAVORITE)
		{
			// お気に入りに登録／解除
			const func = this.amIFavorite ? this.removeFromFavoriteList : this.addToFavoriteList;
			func.call(this);
		}
	}

	/**
	 * ラベルのインデントを設定するアクセスメソッド。
	 */
	public set indent(value: number)
	{
		this.label = this.indentToSpaces(value) + this._label;
	}
}










class RyFileQPItem extends RyPathQPItem
{
	constructor(aQuickPick: RyQuickPickBase, fileInfo: MyFileInfo, baseDirectory: string)
	{
		const filenameOnly = fileInfo.filenameOnly();
		super(aQuickPick, fileInfo.fullPath, filenameOnly!);

		const relativePath = getRelativeOrAbsolutePath(baseDirectory, this.fullPath);

		// このアイテムを選択したときに実際に挿入される文字列
		const insertPath = `'${relativePath}'`;

		const description = maskUserNameDirectory(insertPath === filenameOnly ? '' : insertPath);

		this.indent = 0;
		this.description = description;
		this.insertPath = insertPath;

		this.addPinAndFavoriteButton();
		this.addCopyButton();
		this.addOpenInEditorButton();
		this.addInsertPathToEditorButton();
		this.addInsertPathToTerminalButton();
	}

	override didAccept(): void
	{
		this.executeFileAction();
		this.ownerQuickPick.hide();
	}
}









export class RyDirectoryQPItem extends RyPathQPItem
{
	/**
	 *
	 * @param aQuickPick
	 * @param fileInfo
	 * @param isGoToParent
	 * @param baseDirectory
	 */
	constructor(aQuickPick: RyQuickPickBase, fileInfo: MyFileInfo, isGoToParent: boolean, baseDirectory: string)
	{
		const icon = isGoToParent ? 'arrow-left' : 'folder';

		// ディレクトリ名部分のみ
		const dirName = isGoToParent ? '..' : fileInfo.filenameOnly();

		super(aQuickPick, fileInfo.fullPath, `\$(${icon}) ` + maskUserNameDirectory(dirName) + path.sep);

		// このアイテムを選択したときに実際に挿入されるパス
		const relativePath = getRelativeOrAbsolutePath(baseDirectory, fileInfo.fullPath);


		// このアイテムを選択したときに実際に挿入される文字列
		const insertPath = `'${relativePath}'`;

		this.indent = 0;
		this.description = insertPath === dirName ? '' : maskUserNameDirectory(insertPath);
		this.insertPath = insertPath;

		this.addPinAndFavoriteButton();
		this.addCopyButton();
		this.addInsertPathToEditorButton();
		this.addInsertPathToTerminalButton();
		this.addRevealInFileExplorerButton();
	}

	/**
	 * このアイテムを選択したときの処理。
	 */
	override didAccept(): void
	{
		this._ownerQuickPick.showDirectory(this.fullPath);
	}
}










/**
 * ファイルが見付からなかったり、エラーがあった事を示す QuickPickItem
 * 2024/07/02
 */
export class RyErrorPathQPItem extends RyPathQPItem
{
	constructor(aQuickPick: RyQuickPickBase, aFileInfo: MyFileInfo)
	{
		const icon = aFileInfo.type === MyFileType.notFound ? 'question' : 'error';
		const label = `\$(${icon}) ` + path.basename(aFileInfo.fullPath);
		super(aQuickPick, aFileInfo.fullPath, label);

		// description にはフルパスを表示
		this.description = aFileInfo.fullPath;

		// 見付からないだけのものはピン留め、お気に入りできるけどエラーはだめ。
		if (aFileInfo.type !== MyFileType.error)
		{
			this.addPinAndFavoriteButton();
		}
	}
}