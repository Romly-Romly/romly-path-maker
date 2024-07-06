import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// 自前の国際化文字列リソースの読み込み
import { i18n } from "./i18n";
import { MESSAGES } from "./i18nTexts";

import * as ryutils from './ryutils';
import { RyConfiguration, RyPathPresentation, RyListType } from './ryConfiguration';










export const EXTENSION_NAME_FOR_ERROR = 'Romly: Path-Maker';

// コマンドのラベルに付く前置詞
export const COMMAND_LABEL_PREFIX = '> ';










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
function getRelativeOrAbsolutePath(baseDir: string, fullPath: string): string
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










export enum FileListStatus { SUCCESS, ERROR };

/**
 * listFilesInDirectory の結果を表すオブジェクト。
 */
export class ListFilesResult
{
	result: FileListStatus;
	path: RyPath;
	files: RyPath[];
	error?: Error;

	constructor(result: FileListStatus, path: RyPath, files: RyPath[] = [], error: Error | undefined = undefined)
	{
		this.result = result;
		this.path = path;
		this.files = files;
		this.error = error;
	}
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
	 * RyPath[] を RyPathQPItem[] に変換する。
	 * @param infos
	 * @returns
	 */
	protected convertFileInfosToPathQPItems(infos: RyPath[], callback: (item: RyPathQPItem, index: number) => void = () => null): RyPathQPItem[]
	{
		const items: RyPathQPItem[] = [];

		infos.forEach((fileInfo, index) =>
		{
			let item: RyPathQPItem;
			if (fileInfo.isValidPath)
			{
				item = new RyValidPathQPItem(this, fileInfo);
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
	 * お気に入り／クイックアクセスのリスト変更時に呼ばれる。
	 * 必要な処理があれば継承先で実装。
	 */
	public onListChanged(listType: RyListType): void
	{
	}

	public showDirectory(directory: RyPath): void
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

	protected get placeholderText(): string
	{
		return '';
	}

	protected abstract updateItems(): void;

	protected getButtons(): vscode.QuickInputButton[]
	{
		return [];
	}

	/**
	 * readonly プロパティを使って擬似的に final メソッドにしてる。
	 */
	public readonly updateList = () =>
	{
		this._theQuickPick.placeholder = this.placeholderText;
		this.updateItems();
		this._theQuickPick.buttons = this.getButtons();
	}

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

	public getPathPresentation(): RyPathPresentation
	{
		return RyConfiguration.getPathPresentation();
	}

	public setPathPresentation(value: RyPathPresentation)
	{
		RyConfiguration.setPathPresentation(value).then(() =>
		{
			// 設定の変更に伴うQuickPick自体の更新
			this.updateList();
		});
	}

	protected stringPathListToPathItemList(stringPaths: string[], forceShowHiddenFiles: boolean, callback: (item: RyPathQPItem, index: number) => void = () => null): RyPathQPItem[]
	{
		const showHiddenFiles = RyConfiguration.getShowHiddenFiles();

		const paths: RyPath[] = [];
		stringPaths.forEach(listPath =>
		{
			// 隠しファイルのスキップ
			if (forceShowHiddenFiles || showHiddenFiles || !path.basename(listPath).startsWith('.'))
			{
				// エラーになったファイルも RyPath として追加される。
				paths.push(RyPath.createFromString(listPath));
			}
		});

		const items: RyPathQPItem[] = [];
		paths.forEach((fileInfo, index) =>
		{
			let item: RyPathQPItem;
			if (fileInfo.isValidPath)
			{
				item = new RyValidPathQPItem(this, fileInfo);
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










export class RyPath
{
	// このオブジェクトが示すパス。初期化時に `path.normalize` してある。
	readonly _fullPath: string;

	readonly _type: MyFileType;

	constructor(aPath: string, type: MyFileType)
	{
		this._fullPath = aPath;
		this._type = type;
	}

	/**
	 * ファイルのパスから RyPath を作成する。ファイル情報を取得したりファイルかディレクトリかを調べたりする。
	 * @param fullPath ファイル／ディレクトリのフルパス。
	 * @returns RyPath 。 undefinedIfError が true かつ、パスが見付からなかったり情報が取得できなかった場合は undefined
	 */
	static createFromString(fullPath: string): RyPath
	{
		// ファイルが見付からない
		if (!fs.existsSync(fullPath))
		{
			return new RyPath(fullPath, MyFileType.notFound);
		}

		try
		{
			const stat = fs.statSync(fullPath);
			return new RyPath(fullPath, stat.isDirectory() ? MyFileType.directory : MyFileType.file);
		}
		catch (err)
		{
			// ファイル情報が取得できなかった
			console.error(`Romly Path Maker: statSync failed for: ${fullPath}`, err);
			return new RyPath(fullPath, MyFileType.error);
		}
	}

	public get fullPath(): string
	{
		return this._fullPath;
	}

	public get type(): MyFileType
	{
		return this._type;
	}

	public get isDirectory(): boolean
	{
		return this._type === MyFileType.directory;
	}

	public get filenameOnly(): string
	{
		return path.basename(this.fullPath);
	}

	public get isHiddenFile(): boolean
	{
		return path.basename(this.fullPath).startsWith('.');
	}

	public get parentPath(): RyPath
	{
		return RyPath.createFromString(path.dirname(this.fullPath));
	}

	public get isValidPath(): boolean
	{
		return !(this._type === MyFileType.notFound || this._type === MyFileType.error);
	}

	/**
	 * このパスから実際に挿入される文字列。
	 */
	public get insertPath(): string
	{
		if (RyConfiguration.getPathPresentation() === 'relative')
		{
			const baseDir = RyConfiguration.getBaseDirectory();
			const relativePath = getRelativeOrAbsolutePath(baseDir, this._fullPath);

			return `'${relativePath}'`;
		}
		else
		{
			return `'${this._fullPath}'`;
		}
	}

	public copyToClipboard(): void
	{
		ryutils.copyTextToClipboard(this.insertPath);

		// 履歴に追加
		RyConfiguration.addToTheList(this.fullPath, RyListType.history)
	}

	public insertToEditor(): void
	{
		ryutils.insertTextToEdtior(this.insertPath);

		// 履歴に追加
		RyConfiguration.addToTheList(this.fullPath, RyListType.history)
	}

	public insertToTerminal(): void
	{
		ryutils.sendTextToTerminal(this.insertPath);

		// 履歴に追加
		RyConfiguration.addToTheList(this.fullPath, RyListType.history)
	}

	public openDirectory(): void
	{
		// ディレクトリを開く
		// if (isDirectory)
		// {
		// 	ryutils.openDirectory(path.dirname(this._fullPath));
		// }
		// else
		// {
			ryutils.openDirectory(this._fullPath);
//		}

		// 履歴に追加
		RyConfiguration.addToTheList(this.fullPath, RyListType.history)
	}

	public openInEditor(): void
	{
		ryutils.openFileInEdtor(this.fullPath);

		// 履歴に追加
		RyConfiguration.addToTheList(this.fullPath, RyListType.history)
	}

	/**
	 * このディレクトリをVS Codeで開く。
	 * @param newWindow 新しいウィンドウで開く場合は true を指定。
	 */
	public openAsWorkspace(newWindow: boolean): void
	{
		vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(this.fullPath), newWindow);

		// 履歴に追加
		RyConfiguration.addToTheList(this.fullPath, RyListType.history)
	}

	/**
	 * このファイル／ディレクトリがクイックアクセスにピン留めされていれば true
	 */
	public isListed(listType: RyListType): boolean
	{
		return RyConfiguration.isListed(listType, this.fullPath);
	}

	/**
	 * このファイル／ディレクトリをクイックアクセスにピン留めする。
	 */
	public async addToTheList(list: RyListType, callback: () => void): Promise<void>
	{
		try
		{
			await RyConfiguration.addToTheList(this.fullPath, list);
			callback();
		}
		catch (err)
		{
			const msg = i18n(list === RyListType.pinned ? MESSAGES.failedToWritePinnedList : MESSAGES.failedToWriteFavoriteList);
			const errorMsg = list === RyListType.pinned ? `Error occurred while updating pinned list.` : `Error occurred while updating favorite list.`;
			ryutils.showErrorMessageWithDetailChannel(msg, EXTENSION_NAME_FOR_ERROR, errorMsg, err);
		}
	}

	/**
	 * このファイル／ディレクトリをクイックアクセスから取り除く。
	 */
	public async removeFromTheList(listType: RyListType, callback: () => void): Promise<void>
	{
		try
		{
			await RyConfiguration.removeFromList(listType, this.fullPath);
			callback();
		}
		catch (err)
		{
			const msg = i18n(listType === RyListType.pinned ? MESSAGES.failedToWritePinnedList : MESSAGES.failedToWriteFavoriteList);
			const errorMsg = listType === RyListType.pinned ? `Error occurred while updating pinned list.` : `Error occurred while updating favorite list.`;
			ryutils.showErrorMessageWithDetailChannel(msg, EXTENSION_NAME_FOR_ERROR, errorMsg, err);
		}
	}

	/**
	 * このパスが指定されたパスと同じファイル／ディレクトリを示すものであれば true
	 * @param other
	 * @returns
	 */
	public equals(other: RyPath): boolean
	{
		// コンストラクタで normalize してるハズなので単純に比較。
		let path1 = this._fullPath;
		let path2 = other.fullPath;
		const isWindows = os.platform() === 'win32';
		if (isWindows)
		{
			path1 = path1.toLowerCase();
			path2 = path2.toLowerCase();
		}
		return path1 === path2;
	}

	/**
	 * ディレクトリ内のファイル一覧を取得する。
	 * @returns ファイル取得の成否、ファイル情報の配列、エラー情報（ある場合）を含むオブジェクト。
	 */
	public listFiles(): ListFilesResult
	{
		const filterHiddenFiles = !RyConfiguration.getShowHiddenFiles();

		// ディレクトリの存在チェック
		if (!this.isValidPath)
		{
			return new ListFilesResult(FileListStatus.ERROR, this);
		}

		const result = [] as RyPath[];
		let files;
		try
		{
			files = fs.readdirSync(this.fullPath);

			// 文中で return する必要があるので forEach ではなく for ループで。
			for (const filename of files)
			{
				const fullPath = path.join(this.fullPath, filename);

				// ファイル情報が取得できなかったもの（エラー発生）は省く
				const info = RyPath.createFromString(fullPath);
				if (info.isValidPath)
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
			return new ListFilesResult(FileListStatus.ERROR, this, [], err as Error);
		}

		return new ListFilesResult(FileListStatus.SUCCESS, this, result);
	}
}










/**
 * ファイルまたはディレクトリを示す QuickPickItem の継承元。
 */
export abstract class RyPathQPItem extends RyQuickPickItem
{
	// ボタン識別用の定数
	static ButtonId =
	{
		copy: 'copy',
		insertPathToEditor: 'insertPathToEditor',
		insertPathToTerminal: 'insertPathToTerminal',
		openInEditor: 'openInEditor',
		revealInFileExplorer: 'revealInFileExplorer',
		openAsWorkspace: 'openAsWorkspace',
		openAsWorkspaceInNewWindow: 'openAsWorkspaceInNewWindow',
		pin: 'pin',
		favorite: 'favorite'
	} as const;

	protected readonly _path: RyPath;

	iconPath?: vscode.Uri | {
		light: vscode.Uri;
		dark: vscode.Uri;
	} | vscode.ThemeIcon;

	// インデントを含まないラベル。インデント設定用に保持しておく。
	private _label: string;

	constructor(aQuickPick: RyQuickPickBase, aPath: RyPath, aLabel: string)
	{
		super(aQuickPick);
		this._label = aLabel;
		this._path = aPath;

		// 初期インデントはゼロ（インデント無し）
		this.indent = 0;
	}

	protected addPinAndFavoriteButton(): void
	{
		// ピン留めボタン
		if (RyConfiguration.getButtonVisibility('Pin'))
		{
			if (this._path.isListed(RyListType.pinned))
			{
				this.buttons.push({ iconPath: new vscode.ThemeIcon('pinned'), tooltip: i18n(MESSAGES.unpinThis), id: RyPathQPItem.ButtonId.pin });
			}
			else
			{
				this.buttons.push({ iconPath: new vscode.ThemeIcon('pin'), tooltip: i18n(MESSAGES.pinThis), id: RyPathQPItem.ButtonId.pin });
			}
		}

		// お気に入りボタン
		if (RyConfiguration.getButtonVisibility('Favorite'))
		{
			if (this._path.isListed(RyListType.favorite))
			{
				this.buttons.push({ iconPath: new vscode.ThemeIcon('star-full'), tooltip: i18n(MESSAGES.removeFromFavorite), id: RyPathQPItem.ButtonId.favorite });
			}
			else
			{
				this.buttons.push({ iconPath: new vscode.ThemeIcon('star'), tooltip: i18n(MESSAGES.addToFavorite), id: RyPathQPItem.ButtonId.favorite });
			}
		}
	}

	protected addCopyButton(): void
	{
		if (RyConfiguration.getButtonVisibility('Copy'))
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('copy'), tooltip: i18n(MESSAGES.copyPathToClipboard), id: RyPathQPItem.ButtonId.copy });
		}
	}

	protected addInsertPathToEditorButton(): void
	{
		if (RyConfiguration.getButtonVisibility('InsertToEditor'))
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('insert'), tooltip: i18n(MESSAGES.insertPathToActiveEditor), id: RyPathQPItem.ButtonId.insertPathToEditor });
		}
	}

	protected addInsertPathToTerminalButton(): void
	{
		if (RyConfiguration.getButtonVisibility('InsertToTerminal'))
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('terminal'), tooltip: i18n(MESSAGES.insertPathToActiveTerminal), id: RyPathQPItem.ButtonId.insertPathToTerminal });
		}
	}

	protected addOpenInEditorButton(): void
	{
		if (RyConfiguration.getButtonVisibility('OpenInEditor'))
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('edit'), tooltip: i18n(MESSAGES.openInEditor), id: RyPathQPItem.ButtonId.openInEditor });
		}
	}

	protected addRevealInFileExplorerButton()
	{
		if (RyConfiguration.getButtonVisibility('RevealInShell'))
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('folder-opened'), tooltip: i18n(MESSAGES.revealInFileExplorer), id: RyPathQPItem.ButtonId.revealInFileExplorer });
		}
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
		if (button.id === RyPathQPItem.ButtonId.copy)
		{
			// クリップボードにパスをコピー
			this._path.copyToClipboard();
			this._ownerQuickPick.dispose();
		}
		else if (button.id === RyPathQPItem.ButtonId.insertPathToEditor)
		{
			// エディターにパスを挿入
			this._path.insertToEditor();
			this._ownerQuickPick.dispose();
		}
		else if (button.id === RyPathQPItem.ButtonId.insertPathToTerminal)
		{
			// アクティブなターミナルにパスを挿入
			this._path.insertToTerminal();
			this._ownerQuickPick.dispose();
		}
		else if (button.id === RyPathQPItem.ButtonId.openInEditor)
		{
			// エディタで開く
			this._path.openInEditor();
			this._ownerQuickPick.dispose();
		}
		else if (button.id === RyPathQPItem.ButtonId.revealInFileExplorer)
		{
			// ディレクトリを開く
			this._path.openDirectory();
			this._ownerQuickPick.dispose();
		}
		else if (button.id === RyPathQPItem.ButtonId.pin || button.id === RyPathQPItem.ButtonId.favorite)
		{
			// お気に入り／クイックアクセス
			// 登録されていた場合は削除。登録されていない場合は登録。
			const list = button.id === RyPathQPItem.ButtonId.pin ? RyListType.pinned : RyListType.favorite;
			if (this._path.isListed(list))
			{
				this._path.removeFromTheList(list, () => this._ownerQuickPick.onListChanged(list));
			}
			else
			{
				this._path.addToTheList(list, () => this._ownerQuickPick.onListChanged(list));
			}
		}
		else if (button.id === RyPathQPItem.ButtonId.openAsWorkspace)
		{
			this._ownerQuickPick.dispose();
			this._path.openAsWorkspace(false);
		}
		else if (button.id === RyPathQPItem.ButtonId.openAsWorkspaceInNewWindow)
		{
			this._ownerQuickPick.dispose();
			this._path.openAsWorkspace(true);
		}
	}

	/**
	 * ラベルのインデントを設定するアクセスメソッド。
	 */
	public set indent(value: number)
	{
		this.label = this.indentToSpaces(value) + this._label;
	}

	public get path(): RyPath
	{
		return this._path;
	}

	public equalPath(aPath: RyPath): boolean
	{
		return false;
	}
}









export class RyValidPathQPItem extends RyPathQPItem
{
	// ピン留めされたアイテムか識別するためのフラグ
	public isPinnedItem: boolean = false;

	constructor(aQuickPick: RyQuickPickBase, aPath: RyPath, isGoToParent: boolean = false)
	{
		let aLabel: string;
		if (aPath.type === MyFileType.directory)
		{
			if (isGoToParent)
			{
				aLabel = `\$(arrow-left) ..` + path.sep;
			}
			else
			{
				aLabel = `\$(folder) ` + maskUserNameDirectory(aPath.filenameOnly) + path.sep;
			}
		}
		else
		{
			aLabel = aPath.filenameOnly;
		}
		super(aQuickPick, aPath, aLabel);

		if (aPath.type === MyFileType.directory)
		{
			const nameOnly = isGoToParent ? '..' : aPath.filenameOnly;
			this.description = maskUserNameDirectory(this._path.insertPath === nameOnly ? '' : this._path.insertPath);
		}
		else
		{
			this.description = maskUserNameDirectory(this._path.insertPath === aPath.filenameOnly ? '' : this._path.insertPath);
		}

		this.addPinAndFavoriteButton();
		this.addCopyButton();

		// エディターで開くボタンはファイルのみ
		if (aPath.type === MyFileType.file)
		{
			this.addOpenInEditorButton();
		}

		if (ryutils.isActiveEditorVisible())
		{
			this.addInsertPathToEditorButton();
		}

		if (vscode.window.activeTerminal)
		{
			this.addInsertPathToTerminalButton();
		}

		this.addRevealInFileExplorerButton();

		if (this.path.isDirectory)
		{
			// ワークスペースとして開くボタン
			if (RyConfiguration.getButtonVisibility('OpenAsWorkspace'))
			{
				const msg = MESSAGES.openInAppCommandLabel;
				const tip = i18n(msg, { app: 'VS Code' });
				this.buttons.push({ iconPath: new vscode.ThemeIcon('window'), tooltip: tip, id: RyPathQPItem.ButtonId.openAsWorkspace });
			}

			// ワークスペースとして開くボタン（新しいウィンドウ）
			if (RyConfiguration.getButtonVisibility('OpenAsWorkspaceInNewWindow'))
			{
				const msg = MESSAGES.openDirectoryAsWorkspaceInNewWindow;
				const tip = i18n(msg, { app: 'VS Code' });
				this.buttons.push({ iconPath: new vscode.ThemeIcon('empty-window'), tooltip: tip, id: RyPathQPItem.ButtonId.openAsWorkspaceInNewWindow });
			}
		}
	}

	public override equalPath(aPath: RyPath): boolean
	{
		return this._path.equals(aPath);
	}

	override didAccept(): void
	{
		if (this._path.type === MyFileType.directory)
		{
			this._ownerQuickPick.showDirectory(this._path);
		}
		else
		{
			this.executeFileAction();
			this.ownerQuickPick.hide();
		}
	}

	protected executeFileAction(): void
	{
		// 設定されているアクションを実行
		switch (RyConfiguration.getDefaultAction())
		{
			case 'Menu':
				// 循環参照を避けるためにここでインポートしてる
				const { RyFileActionQuickPick, PreviousQuickPickType } = require('./ryFileActionQuickPick');
				new RyFileActionQuickPick(this._path, { type: PreviousQuickPickType.browser, path: this._path, wasQuickAccess: this.isPinnedItem }).show();
				break;
			case 'Open':
				this._path.openInEditor();
				break;
			case 'Copy':
				this._path.copyToClipboard();
				break;
			case 'Editor':
				this._path.insertToEditor();
				break;
			case 'Terminal':
				this._path.insertToTerminal();
				break;
			case 'Reveal':
				this._path.openDirectory();
				break;
		}
	}
}










/**
 * ファイルが見付からなかったり、エラーがあった事を示す QuickPickItem
 * 2024/07/02
 */
export class RyErrorPathQPItem extends RyPathQPItem
{
	constructor(aQuickPick: RyQuickPickBase, aFileInfo: RyPath)
	{
		const icon = aFileInfo.type === MyFileType.notFound ? 'question' : 'error';
		const label = `\$(${icon}) ` + path.basename(aFileInfo.fullPath);
		super(aQuickPick, aFileInfo, label);

		// description にはフルパスを表示
		this.description = aFileInfo.fullPath;

		// 見付からないだけのものはピン留め、お気に入りできるけどエラーはだめ。
		if (aFileInfo.type !== MyFileType.error)
		{
			this.addPinAndFavoriteButton();
		}
	}
}










export enum RyPathAction { copyToClipboard, insertToEditor, insertToTermnal, addToFavorite, removeFromFavorite, addToPinned, removeFromPinned, openInEditor };

export class RyPathActionQPItem extends RyPathQPItem
{
	private readonly _action: RyPathAction;

	constructor(aQuickPick: RyQuickPickBase, aPath: RyPath, action: RyPathAction)
	{
		let aLabel = '';
		switch (action)
		{
			case RyPathAction.copyToClipboard:
				aLabel = `${COMMAND_LABEL_PREFIX} $(copy) ` + i18n(MESSAGES['directoryAction.copyToClipboard']);
				break;

			case RyPathAction.insertToEditor:
				aLabel = `${COMMAND_LABEL_PREFIX} $(insert) ` + i18n(MESSAGES['directoryAction.insertToEditor']);
				break;

			case RyPathAction.insertToTermnal:
				aLabel = `${COMMAND_LABEL_PREFIX} $(terminal) ` + i18n(MESSAGES['directoryAction.insertToTerminal']);
				break;

			case RyPathAction.addToFavorite:
				aLabel = `${COMMAND_LABEL_PREFIX} $(star) ` + i18n(MESSAGES['directoryAction.addToFavorite']);
				break;

			case RyPathAction.removeFromFavorite:
				aLabel = `${COMMAND_LABEL_PREFIX} $(star-full) ` + i18n(MESSAGES['directoryAction.removeFromFavorite']);
				break;

			case RyPathAction.addToPinned:
				aLabel = `${COMMAND_LABEL_PREFIX} $(pin) ` + i18n(MESSAGES['directoryAction.addToPinned']);
				break;

			case RyPathAction.removeFromPinned:
				aLabel = `${COMMAND_LABEL_PREFIX} $(pinned) ` + i18n(MESSAGES['directoryAction.removeFromPinned']);
				break;

			case RyPathAction.openInEditor:
				aLabel = `${COMMAND_LABEL_PREFIX} $(edit) ` + i18n(MESSAGES.openInEditor);
				break;
		}

		super(aQuickPick, aPath, aLabel);
		this._action = action;
	}

	override didAccept(): void
	{
		switch (this._action)
		{
			// クリップボードにパスをコピー
			case RyPathAction.copyToClipboard:
				this._path.copyToClipboard();
				this._ownerQuickPick.dispose();
				break;

			// エディターにパスを挿入
			case RyPathAction.insertToEditor:
				this._path.insertToEditor();
				this._ownerQuickPick.dispose();
				break;

			// アクティブなターミナルにパスを挿入
			case RyPathAction.insertToTermnal:
				this._path.insertToTerminal();
				this._ownerQuickPick.dispose();
				break;

			// ディレクトリをお気に入りに追加／ピン留め
			case RyPathAction.addToFavorite:
			case RyPathAction.addToPinned:
			{
				const list = this._action === RyPathAction.addToFavorite ? RyListType.favorite : RyListType.pinned;
				this._path.addToTheList(list, () => this._ownerQuickPick.onListChanged(list));
				break;
			}

			// ディレクトリをお気に入りから削除
			case RyPathAction.removeFromFavorite:
			case RyPathAction.removeFromPinned:
			{
				const list = this._action === RyPathAction.removeFromFavorite ? RyListType.favorite : RyListType.pinned;
				this._path.removeFromTheList(list, () => this._ownerQuickPick.onListChanged(list));
				break;
			}

			// エディターで開く
			case RyPathAction.openInEditor:
				this._path.openInEditor();
				break;
		}
	}
}
