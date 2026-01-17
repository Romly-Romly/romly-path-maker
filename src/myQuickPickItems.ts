import * as vscode from 'vscode';
import * as path from 'path';

// 自前の国際化文字列リソースの読み込み
import * as i18n from "./i18n";
import { MESSAGES } from "./i18nTexts";

import { RyConfiguration } from './ryConfiguration';
import * as ryutils from './ryutils';
import * as Proj from './projectCommon';
import { RyPath, MyFileType } from './ryPath';
import { RyQuickPickBase } from './ryQuickPickBase';
import { RyPathQPItem } from './ryQuickPickItems';
import { RyFileActionQuickPick, PreviousQuickPickType } from './myQuickPick';










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
				aLabel = Proj.maskUserNameDirectory(aPath.filenameOnly);
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
		this.description = Proj.maskUserNameDirectory(desc);

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
				const prevState = { type: PreviousQuickPickType.browser, path: this._path, wasQuickAccess: this.isPinnedItem };
				new RyFileActionQuickPick(this._path, prevState, this.ownerQuickPick.baseDirectory).show();
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
				Proj.openDirectory(this.path);
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
		const label = `\$(${icon}) ` + Proj.maskUserNameDirectory(path.basename(aFileInfo.fullPath));
		super(aQuickPick, aFileInfo, label);

		// description にはフルパスを表示
		this.description = Proj.maskUserNameDirectory(aFileInfo.fullPath);

		// 見付からないだけのものはピン留め、お気に入りできるけどエラーはだめ。
		if (aFileInfo.type !== MyFileType.error)
		{
			this.addPinAndFavoriteButton();
		}
	}
}










/**
 * RyPath[] を RyPathQPItem[] に変換する。
 * @param infos
 * @returns
 */
export function convertFileInfosToPathQPItems(
	infos: RyPath[],
	quickPick: RyQuickPickBase,
	itemType: RyValidPathQPItemType,
	callback: (item: RyPathQPItem, index: number) => void = () => null): RyPathQPItem[]
{
	const items: RyPathQPItem[] = [];

	infos.forEach((fileInfo, index) =>
	{
		const item = fileInfo.isValidPath
			? new RyValidPathQPItem(quickPick, fileInfo, itemType)
			: new RyErrorPathQPItem(quickPick, fileInfo);
		items.push(item);
		callback(item, index);
	});

	return items;
}
