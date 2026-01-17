import * as vscode from 'vscode';
import * as ryutils from './ryutils';

// 自前の国際化文字列リソースの読み込み
import * as i18n from "./i18n";
import { MESSAGES } from "./i18nTexts";

import { RyPath } from './ryPath';
import { RyConfiguration, RyPathPresentation, RyListType } from './ryConfiguration';
import * as Proj from './projectCommon';










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

	constructor()
	{
		this.label = '';
		this.description = '';
		this.buttons = [];
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

	protected makePlaceholderText(): string
	{
		console.log("makePlaceholderText 1");
		const presentation = RyConfiguration.getPathPresentation();
		console.log("makePlaceholderText 2: presentation =", presentation);
		if (presentation === 'relative')
		{
			console.log("makePlaceholderText 3");
			if (this.baseDirectory === '')
			{
				console.log("makePlaceholderText 4");
				return `${i18n.t(MESSAGES.baseDirectory)}: ${i18n.t(MESSAGES.baseDirectoryUnset)}`;
			}
			else
			{
				console.log("makePlaceholderText 5");
				console.log(this.baseDirectory);
				console.log("makePlaceholderText 5.1");
				const shorten = ryutils.shortenPath(this.baseDirectory, 60, 2, 2);
				console.log("makePlaceholderText 5.5");
				console.log(shorten);
				const masked = Proj.maskUserNameDirectory(shorten);
				console.log("makePlaceholderText 6");
				console.log(masked);
				const result = `${i18n.t(MESSAGES.baseDirectory)}: ${masked}`;
				// const result = `${i18n.t(MESSAGES.baseDirectory)}: ${maskUserNameDirectory(ryutils.shortenPath(this.baseDirectory, 60, 2, 2))}`;
				console.log("makePlaceholderText 7");
				console.log(result);
				return result;
			}
		}
		else
		{
			console.log("makePlaceholderText 6");
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
		console.log("get baseDirectory: " + this._baseDirectory);
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
	// public readonly updateList = () =>
	// {
	// 	console.log("updateList 1");
	// 	console.log(this._theQuickPick);
	// 	// this._theQuickPick.placeholder = this.placeholderText;
	// 	console.log("updateList 2");
	// 	this._theQuickPick.items = this.createItems();
	// 	console.log("updateList 3");
	// 	this._theQuickPick.buttons = this.getButtons();
	// 	console.log("updateList 4");
	// };

	updateList()
	{
		console.log("updateList 1");
		// console.log(this._theQuickPick);
		this._theQuickPick.placeholder = this.placeholderText;
		console.log("updateList 2");
		this._theQuickPick.items = this.createItems();
		console.log("updateList 3");
		this._theQuickPick.buttons = this.getButtons();
		console.log("updateList 4");
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

	public setPathPresentation(value: RyPathPresentation): void
	{
		RyConfiguration.setPathPresentation(value).then(() =>
		{
			// 設定の変更に伴うQuickPick自体の更新
			this.updateList();

			// 入力中のテキストをクリア
			this._theQuickPick.value = '';
		});
	}
}
