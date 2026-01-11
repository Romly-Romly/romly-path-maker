import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

// 自前の国際化文字列リソースの読み込み
import * as i18n from "./i18n";
import { MESSAGES } from "./i18nTexts";

import * as ryutils from './ryutils';
import { RyConfiguration, RyPathPresentation, RyListType } from './ryConfiguration';
import { RyPath, MyFileType, getRelativeOrAbsolutePath } from './ryPath';
import * as Proj from './projectCommon';










// コマンドのラベルに付く前置詞
export const COMMAND_LABEL_PREFIX = '> ';










/**
 * このディレクトリをVS Codeで開く。
 * @param newWindow 新しいウィンドウで開く場合は true を指定。
 */
export function openAsWorkspace(path: RyPath, newWindow: boolean): void
{
	vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(path.fullPath), newWindow);

	// 履歴に追加
	RyConfiguration.addToTheList(path.fullPath, RyListType.history);
}










export function openDirectory(path: RyPath): void
{
	ryutils.openDirectory(path.fullPath);

	// 履歴に追加
	RyConfiguration.addToTheList(path.fullPath, RyListType.history);
}










/**
 * このファイル／ディレクトリがクイックアクセスにピン留めされていれば true
 */
export function isItemInTheList(path: RyPath, listType: RyListType): boolean
{
	return RyConfiguration.isListed(listType, path.fullPath);
}










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
		return s.replace(/[.*+?^${}()/|[\]\\]/g, '\\$&'); // $&はマッチした全文字列を意味する
	}

	if (RyConfiguration.getHideUserName())
	{
		// ユーザー名の代わりに表示されるべき文字列
		const alternative = RyConfiguration.getHiddenUserNameAlternative();

		const username = path.basename(os.homedir());
		const escapedUsername = escapeRegExp(username);
		const escapedSep = escapeRegExp(path.sep);
		const pattern = `(${escapedSep}|^)${escapedUsername}(${escapedSep}|$)`;
		const regex = new RegExp(pattern, 'gm');
		return pathString.replace(regex, `$1${alternative}$2`);
	}
	else
	{
		return pathString;
	}
}










/**
 * 文字列によるパスのリストを RyPath のリストに変換する。
 * @param stringPaths
 * @param options
 * @returns
 */
export function stringPathListToPathList(
	stringPaths: string[],
	options: IStringPathListToPathItemListOptions): RyPath[]
{
	const showHiddenFiles = RyConfiguration.getShowHiddenFiles();

	// まず RyPath のリストに変換
	const paths: RyPath[] = [];
	stringPaths.forEach(listPath =>
	{
		// 隠しファイルのスキップ
		if (options.forceShowHiddenFiles || showHiddenFiles || !path.basename(listPath).startsWith('.'))
		{
			// エラーになったファイルも RyPath として追加される。
			paths.push(RyPath.createFromString(listPath));
		}
	});

	return paths;
}










export interface IStringPathListToPathItemListOptions
{
	forceShowHiddenFiles: boolean;
}

/**
 * 拡張機能内で使用する各 QuickPick の基底クラス。
 */
export abstract class RyQuickPickBase
{
	//　内部で使用しているQuickPickのボタンの識別子。文字列は識別のみなので何でもおけ。
	private static readonly BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES = 'toggle_show_hidden_files';
	private static readonly BUTTON_ID_TOGGLE_PATH_PRESENTATION = 'togglePathPresentation';
	private static readonly BUTTON_ID_TOGGLE_GROUP_DIRECTORIES = 'toggle_group_directories';

	protected readonly _theQuickPick: vscode.QuickPick<vscode.QuickPickItem>;

	// 基準ディレクトリ
	private readonly _baseDirectory: string;

	constructor(baseDirectory: string)
	{
		this._baseDirectory = baseDirectory;
		this._theQuickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();
		this._theQuickPick.matchOnDetail = true;

		// QuickPick のボタン押下時の処理
		this._theQuickPick.onDidTriggerButton((button) =>
		{
			const buttonId = (button as ryutils.IRyQuickPickButton).id;
			if (buttonId === RyQuickPickBase.BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES)
			{
				// 隠しファイルの表示設定を切り替える
				this.showHiddenFiles = !this.showHiddenFiles;
			}
			else if (buttonId === RyQuickPickBase.BUTTON_ID_TOGGLE_GROUP_DIRECTORIES)
			{
				// ディレクトリのグループ表示設定を切り替える
				this.toggleGroupDirectories();
			}
			else if (buttonId === RyQuickPickBase.BUTTON_ID_TOGGLE_PATH_PRESENTATION)
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
			const button = e.button as ryutils.IRyQuickPickButton;
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

	protected createToggleGroupDirectoriesButton(): ryutils.IRyQuickPickButton
	{
		return RyConfiguration.getGroupDirectories() ?
			{ id: RyQuickPickBase.BUTTON_ID_TOGGLE_GROUP_DIRECTORIES, iconPath: new vscode.ThemeIcon('folder'), tooltip: i18n.t(MESSAGES['tooltip.ungroupDirectories']) } :
			{ id: RyQuickPickBase.BUTTON_ID_TOGGLE_GROUP_DIRECTORIES, iconPath: new vscode.ThemeIcon('folder-library'), tooltip: i18n.t(MESSAGES['tooltip.groupDirectories']) };
	}

	protected createShowHiddenFilesButton(): ryutils.IRyQuickPickButton
	{
		return RyConfiguration.getShowHiddenFiles() ?
			{ id: RyQuickPickBase.BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES, iconPath: new vscode.ThemeIcon('eye'), tooltip: i18n.t(MESSAGES['tooltip.hideHiddenFiles']) } :
			{ id: RyQuickPickBase.BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES, iconPath: new vscode.ThemeIcon('eye-closed'), tooltip: i18n.t(MESSAGES['tooltip.showHiddenFiles']) };
	}

	protected createTogglePathPresentationButton(): ryutils.IRyQuickPickButton
	{
		return RyConfiguration.getPathPresentation() === 'absolute' ?
			{ id: RyQuickPickBase.BUTTON_ID_TOGGLE_PATH_PRESENTATION, iconPath: new vscode.ThemeIcon('list-tree'), tooltip: i18n.t(MESSAGES['tooltip.absolutePathMode']) } :
			{ id: RyQuickPickBase.BUTTON_ID_TOGGLE_PATH_PRESENTATION, iconPath: new vscode.ThemeIcon('list-flat'), tooltip: i18n.t(MESSAGES['tooltip.relativePathMode']) };
	}

	/**
	 * RyPath[] を RyPathQPItem[] に変換する。
	 * @param infos
	 * @returns
	 */
	protected convertFileInfosToPathQPItems(infos: RyPath[], itemType: RyValidPathQPItemType, callback: (item: RyPathQPItem, index: number) => void = () => null): RyPathQPItem[]
	{
		const items: RyPathQPItem[] = [];

		infos.forEach((fileInfo, index) =>
		{
			let item: RyPathQPItem;
			if (fileInfo.isValidPath)
			{
				item = new RyValidPathQPItem(this, fileInfo, itemType);
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

	protected makePlaceholderText(): string
	{
		if (RyConfiguration.getPathPresentation() === 'relative')
		{
			if (this.baseDirectory === '')
			{
				return `${i18n.t(MESSAGES.baseDirectory)}: ${i18n.t(MESSAGES.baseDirectoryUnset)}`;
			}
			else
			{
				return `${i18n.t(MESSAGES.baseDirectory)}: ${maskUserNameDirectory(ryutils.shortenPath(this.baseDirectory, 60, 2, 2))}`;
			}
		}
		else
		{
			return i18n.t(MESSAGES.absolutePathMode);
		}
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

	public get baseDirectory(): string
	{
		return this._baseDirectory;
	}

	protected abstract createItems(): vscode.QuickPickItem[];

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
		this._theQuickPick.items = this.createItems();
		this._theQuickPick.buttons = this.getButtons();
	};

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
	buttons: ryutils.IRyQuickPickButton[];

	// 自身が所属する QuickPick への参照を持つ
	private readonly _ownerQuickPick: RyQuickPickBase;

	constructor(aQuickPick: RyQuickPickBase)
	{
		this.label = '';
		this.description = '';
		this.buttons = [];
		this._ownerQuickPick = aQuickPick;
	}

	public get ownerQuickPick(): RyQuickPickBase
	{
		return this._ownerQuickPick;
	}

	/**
	 * QuickPickItem が選択されたときに呼び出される。
	 */
	public didAccept(): void
	{
	}

	public addButton(button: ryutils.RyQPItemButton): void
	{
		this.buttons.push(button);
	}

	onButtonClick(button: ryutils.IRyQuickPickButton): void
	{
		if (button instanceof ryutils.RyQPItemButton)
		{
			button.onClick();
		}
	}
}










/**
 * ファイルまたはディレクトリを示す QuickPickItem の継承元。
 * ここから有効なパス、無効なパスに分かれる。
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

	resourceUri?: vscode.Uri;

	// インデントを含まないラベル。インデント設定用に保持しておく。
	private _beforeIndentLabel: string;
	private _label: string;

	constructor(aQuickPick: RyQuickPickBase, aPath: RyPath, aLabel: string, beforeIndentLabel: string = '')
	{
		super(aQuickPick);
		this._label = aLabel;
		this._beforeIndentLabel = beforeIndentLabel;
		this._path = aPath;

		// 初期インデントはゼロ（インデント無し）
		this.indent = 0;
	}

	protected addPinAndFavoriteButton(): void
	{
		// ピン留めボタン
		if (RyConfiguration.getButtonVisibility('Pin'))
		{
			if (isItemInTheList(this.path, RyListType.pinned))
			{
				this.buttons.push({ iconPath: new vscode.ThemeIcon('pinned'), tooltip: i18n.t(MESSAGES.unpinThis), id: RyPathQPItem.ButtonId.pin });
			}
			else
			{
				this.buttons.push({ iconPath: new vscode.ThemeIcon('pin'), tooltip: i18n.t(MESSAGES.pinThis), id: RyPathQPItem.ButtonId.pin });
			}
		}

		// お気に入りボタン
		if (RyConfiguration.getButtonVisibility('Favorite'))
		{
			if (isItemInTheList(this.path, RyListType.favorite))
			{
				this.buttons.push({ iconPath: new vscode.ThemeIcon('star-full'), tooltip: i18n.t(MESSAGES.removeFromFavorite), id: RyPathQPItem.ButtonId.favorite });
			}
			else
			{
				this.buttons.push({ iconPath: new vscode.ThemeIcon('star'), tooltip: i18n.t(MESSAGES.addToFavorite), id: RyPathQPItem.ButtonId.favorite });
			}
		}
	}

	protected addCopyButton(): void
	{
		if (RyConfiguration.getButtonVisibility('Copy'))
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('copy'), tooltip: i18n.t(MESSAGES.copyPathToClipboard), id: RyPathQPItem.ButtonId.copy });
		}
	}

	protected addInsertPathToEditorButton(): void
	{
		if (RyConfiguration.getButtonVisibility('InsertToEditor'))
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('insert'), tooltip: i18n.t(MESSAGES.insertPathToActiveEditor), id: RyPathQPItem.ButtonId.insertPathToEditor });
		}
	}

	protected addInsertPathToTerminalButton(): void
	{
		if (RyConfiguration.getButtonVisibility('InsertToTerminal'))
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('terminal'), tooltip: i18n.t(MESSAGES.insertPathToActiveTerminal), id: RyPathQPItem.ButtonId.insertPathToTerminal });
		}
	}

	protected addOpenInEditorButton(): void
	{
		if (RyConfiguration.getButtonVisibility('OpenInEditor'))
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('edit'), tooltip: i18n.t(MESSAGES.openInEditor), id: RyPathQPItem.ButtonId.openInEditor });
		}
	}

	protected addRevealInFileExplorerButton()
	{
		if (RyConfiguration.getButtonVisibility('RevealInShell'))
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('folder-opened'), tooltip: i18n.t(MESSAGES.revealInFileExplorer), id: RyPathQPItem.ButtonId.revealInFileExplorer });
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
	public static indentToSpaces(indent: number): string
	{
		return ' '.repeat(indent * 3);
	}

	override onButtonClick(button: ryutils.IRyQuickPickButton): void
	{
		if (button.id === RyPathQPItem.ButtonId.copy)
		{
			// クリップボードにパスをコピー
			this.copyToClipboard();
			this.ownerQuickPick.dispose();
		}
		else if (button.id === RyPathQPItem.ButtonId.insertPathToEditor)
		{
			// エディターにパスを挿入
			this.insertToEditor();
			this.ownerQuickPick.dispose();
		}
		else if (button.id === RyPathQPItem.ButtonId.insertPathToTerminal)
		{
			// アクティブなターミナルにパスを挿入
			this.insertToTerminal();
			this.ownerQuickPick.dispose();
		}
		else if (button.id === RyPathQPItem.ButtonId.openInEditor)
		{
			// エディタで開く
			this.openInEditor();
			this.ownerQuickPick.dispose();
		}
		else if (button.id === RyPathQPItem.ButtonId.revealInFileExplorer)
		{
			// ディレクトリを開く
			openDirectory(this.path);
			this.ownerQuickPick.dispose();
		}
		else if (button.id === RyPathQPItem.ButtonId.pin || button.id === RyPathQPItem.ButtonId.favorite)
		{
			// お気に入り／クイックアクセス
			// 登録されていた場合は削除。登録されていない場合は登録。
			const list = button.id === RyPathQPItem.ButtonId.pin ? RyListType.pinned : RyListType.favorite;
			if (isItemInTheList(this.path, list))
			{
				this.removeFromTheList(list, () => this.ownerQuickPick.onListChanged(list));
			}
			else
			{
				this.addToTheList(list, () => this.ownerQuickPick.onListChanged(list));
			}
		}
		else if (button.id === RyPathQPItem.ButtonId.openAsWorkspace)
		{
			this.ownerQuickPick.dispose();
			openAsWorkspace(this.path, false);
		}
		else if (button.id === RyPathQPItem.ButtonId.openAsWorkspaceInNewWindow)
		{
			this.ownerQuickPick.dispose();
			openAsWorkspace(this.path, true);
		}
		else
		{
			super.onButtonClick(button);
		}
	}

	/**
	 * ラベルのインデントを設定するアクセスメソッド。
	 */
	public set indent(value: number)
	{
		this.label = this._beforeIndentLabel + RyPathQPItem.indentToSpaces(value) + this._label;
	}

	public get path(): RyPath
	{
		return this._path;
	}

	public equalPath(aPath: RyPath): boolean
	{
		return false;
	}

	/**
	 * このパスから実際に挿入されるパス文字列。相対パスになってたりする。
	 */
	public get rawInsertPath(): string
	{
		if (this.ownerQuickPick.getPathPresentation() === 'relative')
		{
			return getRelativeOrAbsolutePath(this.ownerQuickPick.baseDirectory, this.path.fullPath);
		}
		else
		{
			return this.path.fullPath;
		}
	}

	public copyToClipboard(): void
	{
		ryutils.copyTextToClipboard(RyPath.quotePath(this.rawInsertPath));

		// 履歴に追加
		RyConfiguration.addToTheList(this.path.fullPath, RyListType.history);
	}

	public insertToEditor(): void
	{
		ryutils.insertTextToEdtior(RyPath.quotePath(this.rawInsertPath));

		// 履歴に追加
		RyConfiguration.addToTheList(this.path.fullPath, RyListType.history);
	}

	public insertToTerminal(): void
	{
		ryutils.sendTextToTerminal(RyPath.quotePath(this.rawInsertPath));

		// 履歴に追加
		RyConfiguration.addToTheList(this.path.fullPath, RyListType.history);
	}

	public openInEditor(): void
	{
		ryutils.openFileInEdtor(this.path.fullPath);

		// 履歴に追加
		RyConfiguration.addToTheList(this.path.fullPath, RyListType.history);
	}

	/**
	 * このファイル／ディレクトリをクイックアクセスにピン留めする。
	 */
	public async addToTheList(list: RyListType, callback: () => void): Promise<void>
	{
		try
		{
			await RyConfiguration.addToTheList(this.path.fullPath, list);
			callback();
		}
		catch (err)
		{
			const msg = i18n.t(list === RyListType.pinned ? MESSAGES.failedToWritePinnedList : MESSAGES.failedToWriteFavoriteList);
			const errorMsg = list === RyListType.pinned ? `Error occurred while updating pinned list.` : `Error occurred while updating favorite list.`;
			ryutils.showErrorMessageWithDetailChannel(msg, Proj.EXTENSION_NAME_FOR_ERROR, errorMsg, err);
		}
	}

	/**
	 * このファイル／ディレクトリをクイックアクセスから取り除く。
	 */
	public async removeFromTheList(listType: RyListType, callback: () => void): Promise<void>
	{
		try
		{
			await RyConfiguration.removeFromList(listType, this.path.fullPath);
			callback();
		}
		catch (err)
		{
			const msg = i18n.t(listType === RyListType.pinned ? MESSAGES.failedToWritePinnedList : MESSAGES.failedToWriteFavoriteList);
			const errorMsg = listType === RyListType.pinned ? `Error occurred while updating pinned list.` : `Error occurred while updating favorite list.`;
			ryutils.showErrorMessageWithDetailChannel(msg, Proj.EXTENSION_NAME_FOR_ERROR, errorMsg, err);
		}
	}
}









/**
 * RyValidPathQPItem の表示スタイルを決定する値。
 */
export enum RyValidPathQPItemType
{
	AbsoluteDirectoryTreeItem,
	RelativePathItem,

	// 親ディレクトリに移動するための項目
	GoToParentItem,

	// 現在のディレクトリ内の項目。ディレクトリ、ファイル問わず。
	CurrentDirectoryItem,

	// ピン留めされたアイテムなど、現在のツリーとは関係ない場所にある項目。
	IsolatedItemWithAbsolutePath,
	IsolatedItemWithRelativePath,
}

/**
 * 有効なパスを示す QuickPickItem.
 * ディレクトリかもしれないしファイルかもしれない。
 */
export class RyValidPathQPItem extends RyPathQPItem
{
	// ピン留めされたアイテムか識別するためのフラグ
	public isPinnedItem: boolean = false;

	constructor(aQuickPick: RyQuickPickBase, aPath: RyPath, itemType: RyValidPathQPItemType)
	{
		const isDir: boolean = aPath.type === MyFileType.directory;
		let aLabel: string;
		if (isDir)
		{
			if (itemType === RyValidPathQPItemType.GoToParentItem)
			{
				aLabel = "..";
			}
			else
			{
				aLabel = maskUserNameDirectory(aPath.filenameOnly);
			}
		}
		else
		{
			aLabel = aPath.filenameOnly;
		}
		super(aQuickPick, aPath, aLabel, isDir ? '[DIR] ' : '');
		let desc = '';
		const relativePathToBase = this.rawInsertPath === aPath.filenameOnly ? '' : this.rawInsertPath;
		switch (itemType)
		{
			case RyValidPathQPItemType.GoToParentItem:
				desc = this.path.parentPath.filenameOnly;
				break;

			case RyValidPathQPItemType.AbsoluteDirectoryTreeItem:
				desc = !isDir ? relativePathToBase : '';
				break;

			case RyValidPathQPItemType.RelativePathItem:
				desc = relativePathToBase + (isDir ? path.sep : '');
				break;

			case RyValidPathQPItemType.CurrentDirectoryItem:
				break;

			case RyValidPathQPItemType.IsolatedItemWithAbsolutePath:
				desc = this.path.parent.fullPath;
				break;

			case RyValidPathQPItemType.IsolatedItemWithRelativePath:
				desc = relativePathToBase;
				break;
		}
		this.description = maskUserNameDirectory(desc);

		// resourceUri にパスを設定し、アイコンを Folder ないし File にすると、なぜかアイコンテーマが使える
		this.resourceUri = this.path.uri;
		this.iconPath = isDir ? vscode.ThemeIcon.Folder : vscode.ThemeIcon.File;

		this.addButtons();
	}

	/**
	 * 初期化時に各種ボタンを追加する処理
	 */
	private addButtons()
	{
		this.addPinAndFavoriteButton();
		this.addCopyButton();

		// エディターで開くボタンはファイルのみ
		if (this.path.type === MyFileType.file)
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
				const tip = i18n.t(msg, { app: 'VS Code' });
				this.buttons.push({ iconPath: new vscode.ThemeIcon('window'), tooltip: tip, id: RyPathQPItem.ButtonId.openAsWorkspace });
			}

			// ワークスペースとして開くボタン（新しいウィンドウ）
			if (RyConfiguration.getButtonVisibility('OpenAsWorkspaceInNewWindow'))
			{
				const msg = MESSAGES.openDirectoryAsWorkspaceInNewWindow;
				const tip = i18n.t(msg, { app: 'VS Code' });
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
			this.ownerQuickPick.showDirectory(this._path);
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
				const ryFileActionQuickPick = require('./ryFileActionQuickPick');
				new ryFileActionQuickPick.RyFileActionQuickPick(this._path, { type: ryFileActionQuickPick.PreviousQuickPickType.browser, path: this._path, wasQuickAccess: this.isPinnedItem }).show();
				break;
			case 'Open':
				this.openInEditor();
				break;
			case 'Copy':
				this.copyToClipboard();
				break;
			case 'Editor':
				this.insertToEditor();
				break;
			case 'Terminal':
				this.insertToTerminal();
				break;
			case 'Reveal':
				openDirectory(this.path);
				break;
		}
	}
}










/**
 * 親ディレクトリを示す QuickPickItem
 */
export class RyParentPathQPItem extends RyValidPathQPItem
{
	constructor(aQuickPick: RyQuickPickBase, aPath: RyPath)
	{
		super(aQuickPick, aPath, RyValidPathQPItemType.GoToParentItem);
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
		const label = `\$(${icon}) ` + maskUserNameDirectory(path.basename(aFileInfo.fullPath));
		super(aQuickPick, aFileInfo, label);

		// description にはフルパスを表示
		this.description = maskUserNameDirectory(aFileInfo.fullPath);

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
		// ラベルは言語によらず英語で固定(QuickPickで探しやすいように)
		// detail に翻訳を追加
		let aLabel = '';
		let translated = '';
		switch (action)
		{
			case RyPathAction.copyToClipboard:
				aLabel = `${COMMAND_LABEL_PREFIX} $(copy) ` + i18n.en(MESSAGES['directoryAction.copyToClipboard']);
				translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES['directoryAction.copyToClipboard']) : '';
				break;

			case RyPathAction.insertToEditor:
				aLabel = `${COMMAND_LABEL_PREFIX} $(insert) ` + i18n.en(MESSAGES['directoryAction.insertToEditor']);
				translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES['directoryAction.insertToEditor']) : '';
				break;

			case RyPathAction.insertToTermnal:
				aLabel = `${COMMAND_LABEL_PREFIX} $(terminal) ` + i18n.en(MESSAGES['directoryAction.insertToTerminal']);
				translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES['directoryAction.insertToTerminal']) : '';
				break;

			case RyPathAction.addToFavorite:
				aLabel = `${COMMAND_LABEL_PREFIX} $(star) ` + i18n.en(MESSAGES['directoryAction.addToFavorite']);
				translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES['directoryAction.addToFavorite']) : '';
				break;

			case RyPathAction.removeFromFavorite:
				aLabel = `${COMMAND_LABEL_PREFIX} $(star-full) ` + i18n.en(MESSAGES['directoryAction.removeFromFavorite']);
				translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES['directoryAction.removeFromFavorite']) : '';
				break;

			case RyPathAction.addToPinned:
				aLabel = `${COMMAND_LABEL_PREFIX} $(pin) ` + i18n.en(MESSAGES['directoryAction.addToPinned']);
				translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES['directoryAction.addToPinned']) : '';
				break;

			case RyPathAction.removeFromPinned:
				aLabel = `${COMMAND_LABEL_PREFIX} $(pinned) ` + i18n.en(MESSAGES['directoryAction.removeFromPinned']);
				translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES['directoryAction.removeFromPinned']) : '';
				break;

			case RyPathAction.openInEditor:
				aLabel = `${COMMAND_LABEL_PREFIX} $(edit) ` + i18n.en(MESSAGES.openInEditor);
				translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES.openInEditor) : '';
				break;
		}

		super(aQuickPick, aPath, aLabel);
		this.description = translated;
		this._action = action;
	}

	override didAccept(): void
	{
		switch (this._action)
		{
			// クリップボードにパスをコピー
			case RyPathAction.copyToClipboard:
				this.copyToClipboard();
				this.ownerQuickPick.dispose();
				break;

			// エディターにパスを挿入
			case RyPathAction.insertToEditor:
				this.insertToEditor();
				this.ownerQuickPick.dispose();
				break;

			// アクティブなターミナルにパスを挿入
			case RyPathAction.insertToTermnal:
				this.insertToTerminal();
				this.ownerQuickPick.dispose();
				break;

			// ディレクトリをお気に入りに追加／ピン留め
			case RyPathAction.addToFavorite:
			case RyPathAction.addToPinned:
			{
				const list = this._action === RyPathAction.addToFavorite ? RyListType.favorite : RyListType.pinned;
				this.addToTheList(list, () => this.ownerQuickPick.onListChanged(list));
				break;
			}

			// ディレクトリをお気に入りから削除
			case RyPathAction.removeFromFavorite:
			case RyPathAction.removeFromPinned:
			{
				const list = this._action === RyPathAction.removeFromFavorite ? RyListType.favorite : RyListType.pinned;
				this.removeFromTheList(list, () => this.ownerQuickPick.onListChanged(list));
				break;
			}

			// エディターで開く
			case RyPathAction.openInEditor:
				this.openInEditor();
				break;
		}
	}
}
