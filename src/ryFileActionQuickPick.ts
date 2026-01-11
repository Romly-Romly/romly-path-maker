import * as vscode from 'vscode';

// 自前の国際化文字列リソースの読み込み
import * as i18n from "./i18n";
import { MESSAGES } from "./i18nTexts";

import * as ryutils from './ryutils';
import { RyPath } from './ryPath';
import
{
	RyQuickPickBase,
	RyQuickPickItem,
	maskUserNameDirectory,
	RyPathAction,
	RyPathActionQPItem,
	isItemInTheList
} from './ryQuickPickBase';

import { MyQuickPick, RyCertainListQuickPick } from './myQuickPick';
import { RyListType } from './ryConfiguration';










export enum PreviousQuickPickType { browser, favorite, pinned, history };

/**
 * 操作メニューから戻るために必要な情報を保存しておく型。
 */
type PreviousState =
{
	// ファイルブラウザを表示していたか、その他のリストを表示していたか。
	type: PreviousQuickPickType;

	// その中でどのパスが選択されていたか ＝ 操作対象ファイルのパス
	path: RyPath;

	// （ファイルブラウザの時のみ）クイックパス内のファイルを選択してきたか。
	wasQuickAccess: boolean;
};

/**
 * ファイルに対する操作メニューを表示する QuickPick
 * 2024/07/05
 */
export class RyFileActionQuickPick extends RyQuickPickBase
{
	private readonly _path: RyPath;

	private readonly _previousState: PreviousState;

	static RyReturnQPItem = class extends RyQuickPickItem
	{
		constructor(aQuickPick: RyFileActionQuickPick)
		{
			super(aQuickPick);
			this.label = i18n.t(MESSAGES.goBack);
		}

		public override didAccept(): void
		{
			// 元のディレクトリの表示に戻る
			const prevState = (this.ownerQuickPick as RyFileActionQuickPick)._previousState;
			if (prevState.type === PreviousQuickPickType.browser)
			{
				const quickPick = new MyQuickPick(prevState.path.parentPath, this.ownerQuickPick.baseDirectory);
				quickPick.setActivePath(prevState.path, prevState.wasQuickAccess);
				quickPick.show();
			}
			else
			{
				let listType: RyListType | undefined = undefined;
				switch (prevState.type)
				{
					case PreviousQuickPickType.favorite:
						listType = RyListType.favorite;
						break;
					case PreviousQuickPickType.pinned:
						listType = RyListType.pinned;
						break;
					case PreviousQuickPickType.history:
						listType = RyListType.history;
						break;
				}
				if (listType !== undefined)
				{
					const quickPick = new RyCertainListQuickPick(listType, this.ownerQuickPick.baseDirectory);
					quickPick.setActiveItem(prevState.path);
					quickPick.show();
				}
			}
		}
	};

	constructor(filePath: RyPath, previousState: PreviousState, baseDirectory: string)
	{
		super(baseDirectory);
		this._path = filePath;
		this._previousState = previousState;

		this._theQuickPick.title = maskUserNameDirectory(this._path.fullPath);
		//this._theQuickPick.buttons = this.createQuickPickButtons();
		this.updateList();
	}

	protected override get placeholderText(): string
	{
		return i18n.t(MESSAGES.actionToTheFile, { filename: this._path.filenameOnly });
	}

	protected override createItems(): vscode.QuickPickItem[]
	{
		const items: vscode.QuickPickItem[] = [];

		// ファイルパスをクリップボードにコピー
		items.push(new RyPathActionQPItem(this, this._path, RyPathAction.copyToClipboard));

		// エディターで開く
		items.push(new RyPathActionQPItem(this, this._path, RyPathAction.openInEditor));

		// エディターにパスを挿入
		if (ryutils.isActiveEditorVisible())
		{
			items.push(new RyPathActionQPItem(this, this._path, RyPathAction.insertToEditor));
		}

		// ターミナルにパスを挿入
		if (vscode.window.activeTerminal)
		{
			items.push(new RyPathActionQPItem(this, this._path, RyPathAction.insertToTermnal));
		}

		// お気に入り
		items.push(isItemInTheList(this._path, RyListType.favorite) ?
			new RyPathActionQPItem(this, this._path, RyPathAction.removeFromFavorite) :
			new RyPathActionQPItem(this, this._path, RyPathAction.addToFavorite));

		// ピン留め
		items.push(isItemInTheList(this._path, RyListType.pinned) ?
			new RyPathActionQPItem(this, this._path, RyPathAction.removeFromPinned) :
			new RyPathActionQPItem(this, this._path, RyPathAction.addToPinned));

		items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });

		// 戻る
		items.push(new RyFileActionQuickPick.RyReturnQPItem(this));

		return items;
	}

	public show(): void
	{
		this._theQuickPick.show();
	}
}