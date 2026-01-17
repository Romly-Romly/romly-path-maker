import * as vscode from 'vscode';
import * as ryutils from './ryutils';

import { RyPath, getRelativeOrAbsolutePath } from './ryPath';
import { RyQuickPickBase, RyQuickPickItem } from './ryQuickPickBase';

// 自前の国際化文字列リソースの読み込み
import * as i18n from "./i18n";
import { MESSAGES } from "./i18nTexts";

import * as Proj from './projectCommon';
import { RyConfiguration, RyListType } from './ryConfiguration';










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

	// 自身が所属する QuickPick への参照を持つ
	private readonly _ownerQuickPick: RyQuickPickBase;

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
		super();
		this._label = aLabel;
		this._beforeIndentLabel = beforeIndentLabel;
		this._path = aPath;
		this._ownerQuickPick = aQuickPick;

		// 初期インデントはゼロ（インデント無し）
		this.indent = 0;
	}

	protected addPinAndFavoriteButton(): void
	{
		// ピン留めボタン
		if (RyConfiguration.getButtonVisibility('Pin'))
		{
			if (Proj.isItemInTheList(this.path, RyListType.pinned))
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
			if (Proj.isItemInTheList(this.path, RyListType.favorite))
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
			ryutils.openDirectory(this.path.fullPath);
			this.ownerQuickPick.dispose();
		}
		else if (button.id === RyPathQPItem.ButtonId.pin || button.id === RyPathQPItem.ButtonId.favorite)
		{
			// お気に入り／クイックアクセス
			// 登録されていた場合は削除。登録されていない場合は登録。
			const list = button.id === RyPathQPItem.ButtonId.pin ? RyListType.pinned : RyListType.favorite;
			if (Proj.isItemInTheList(this.path, list))
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
			Proj.openAsWorkspace(this.path, false);
		}
		else if (button.id === RyPathQPItem.ButtonId.openAsWorkspaceInNewWindow)
		{
			this.ownerQuickPick.dispose();
			Proj.openAsWorkspace(this.path, true);
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

	public get ownerQuickPick(): RyQuickPickBase
	{
		return this._ownerQuickPick;
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









export enum RyPathAction {
	copyToClipboard,
	insertToEditor,
	addToFavorite,
	removeFromFavorite,
	addToPinned,
	removeFromPinned,
	openInEditor
};

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
				aLabel = `${Proj.COMMAND_LABEL_PREFIX} $(copy) ` + i18n.en(MESSAGES['directoryAction.copyToClipboard']);
				translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES['directoryAction.copyToClipboard']) : '';
				break;

			case RyPathAction.insertToEditor:
				aLabel = `${Proj.COMMAND_LABEL_PREFIX} $(insert) ` + i18n.en(MESSAGES['directoryAction.insertToEditor']);
				translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES['directoryAction.insertToEditor']) : '';
				break;

			case RyPathAction.addToFavorite:
				aLabel = `${Proj.COMMAND_LABEL_PREFIX} $(star) ` + i18n.en(MESSAGES['directoryAction.addToFavorite']);
				translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES['directoryAction.addToFavorite']) : '';
				break;

			case RyPathAction.removeFromFavorite:
				aLabel = `${Proj.COMMAND_LABEL_PREFIX} $(star-full) ` + i18n.en(MESSAGES['directoryAction.removeFromFavorite']);
				translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES['directoryAction.removeFromFavorite']) : '';
				break;

			case RyPathAction.addToPinned:
				aLabel = `${Proj.COMMAND_LABEL_PREFIX} $(pin) ` + i18n.en(MESSAGES['directoryAction.addToPinned']);
				translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES['directoryAction.addToPinned']) : '';
				break;

			case RyPathAction.removeFromPinned:
				aLabel = `${Proj.COMMAND_LABEL_PREFIX} $(pinned) ` + i18n.en(MESSAGES['directoryAction.removeFromPinned']);
				translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES['directoryAction.removeFromPinned']) : '';
				break;

			case RyPathAction.openInEditor:
				aLabel = `${Proj.COMMAND_LABEL_PREFIX} $(edit) ` + i18n.en(MESSAGES.openInEditor);
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










