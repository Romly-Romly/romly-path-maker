// 自前の国際化文字列リソースの読み込み
import * as i18n from "./i18n";
import { MESSAGES } from "./i18nTexts";

import { RyPath, MyFileType } from './ryPath';
import { RyQuickPickBase, RyQuickPickItem } from './ryQuickPickBase';
import { RyPathQPItem } from './ryQuickPickItems';
import * as ryutils from './ryutils';
import * as Proj from './projectCommon';
import { MyQuickPick } from './myQuickPick';










export class RyInsertPathToTerminalActionQPItem extends RyPathQPItem
{
	constructor(aQuickPick: RyQuickPickBase, aPath: RyPath)
	{
		// ラベルは言語によらず英語で固定(QuickPickで探しやすいように)
		// detail に翻訳を追加
		const aLabel = `${Proj.COMMAND_LABEL_PREFIX} $(terminal) ` + i18n.en(MESSAGES['directoryAction.insertToTerminal']);
		const translated = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES['directoryAction.insertToTerminal']) : '';
		super(aQuickPick, aPath, aLabel);
		this.description = translated;
	}

	override didAccept(): void
	{
		// アクティブなターミナルにパスを挿入
		this.insertToTerminal();
		this.ownerQuickPick.dispose();
	}
}










export class MyQuickPickGotoDirItem extends RyQuickPickItem
{
	private readonly _quickPick: RyQuickPickBase;

	private _targetPath: RyPath;

	private readonly _baseDirectory: string;

	/**
	 * コンストラクタ。
	 * @param label QuickPickItem のラベル。
	 * @param fullPath コマンドに関連付けられたパス。
	 */
	constructor(aQuickPick: RyQuickPickBase, labelKey: i18n.I18NText, aTargetPath: RyPath, baseDirectory: string)
	{
		super();
		this._quickPick = aQuickPick;
		this.label = Proj.COMMAND_LABEL_PREFIX + i18n.en(labelKey);
		this.description = i18n.localeKey() !== 'en' ? i18n.t(labelKey) : '';
		this.detail = Proj.maskUserNameDirectory(aTargetPath.fullPath);
		this._targetPath = aTargetPath;
		this._baseDirectory = baseDirectory;
	}

	override didAccept(): void
	{
		// そのディレクトリへ移動
		const quickPick = new MyQuickPick(this._targetPath, this._baseDirectory);
		if (quickPick.path.isValidPath)
		{
			this._quickPick.dispose();
			quickPick.show();
		}
	}
}










/**
 * 「ワークスペースとして開く」コマンドの QuickPickItem。
 */
export class RyOpenAsWorkspaceCommandQPItem extends RyQuickPickItem
{
	private readonly _path: RyPath;
	private readonly _newWindow: boolean;

	constructor(path: RyPath, newWindow: boolean)
	{
		super();
		this._newWindow = newWindow;
		const icon = newWindow ? 'empty-window' : 'window';
		const msg = newWindow ? MESSAGES.openDirectoryAsWorkspaceInNewWindow : MESSAGES.openInAppCommandLabel;
		this.label = `${Proj.COMMAND_LABEL_PREFIX} \$(${icon}) ` + i18n.en(msg, { app: 'VS Code' });
		this.description = i18n.localeKey() !== 'en' ? i18n.t(msg, { app: 'VS Code' }) : '';
		this._path = path;
	}

	override didAccept(): void
	{
		// Codeでディレクトリを開く
		Proj.openAsWorkspace(this._path, this._newWindow);
	}
}










/**
 * 「このディレクトリをエクスプローラーで開く」コマンドの QuickPickItem。
 */
export class MyQuickPickRevealInExprolerItem extends RyQuickPickItem
{
	private _path: RyPath;

	constructor(path: RyPath)
	{
		super();
		this.label = `${Proj.COMMAND_LABEL_PREFIX} $(folder-opened) ` + i18n.en(MESSAGES.revealInExplorerCommandLabel, { app: ryutils.getOsDependentExplorerAppName(true) });
		this.description = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES.revealInExplorerCommandLabel, { app: ryutils.getOsDependentExplorerAppName() }) : '';
		this._path = path;
	}

	override didAccept(): void
	{
		// ディレクトリを開く
		Proj.openDirectory(this._path);
	}
}










/**
 * 「このディレクトリをGitKrakenで開く」コマンドの QuickPickItem。
 */
export class MyOpenInGitKrakenQPItem extends RyQuickPickItem
{
	private readonly _ownerQuickPick: RyQuickPickBase;

	private _path: RyPath;

	constructor(aQuickPick: RyQuickPickBase, aPath: RyPath)
	{
		super();
		this._ownerQuickPick = aQuickPick;
		this.label = `${Proj.COMMAND_LABEL_PREFIX} $(github) ` + i18n.en(MESSAGES.openThisDirectoryWithApp, { app: 'GitKraken' });
		this.description = i18n.localeKey() !== 'en' ? i18n.t(MESSAGES.openThisDirectoryWithApp, { app: 'GitKraken' }) : '';
		this._path = aPath;
	}

	override didAccept(): void
	{
		// ディレクトリ GitKraken で開く
		ryutils.openWithGitKraken(this._path.fullPath);

		this._ownerQuickPick.hide();
	}

	/**
	 * 現状の環境で GitKraken を開くがサポートされているか。
	 * とりまOSしか見てない(GitKraken がインストールされているかは見てない)
	 */
	static get isSupported(): boolean
	{
		// Windows/Macのみ対応
		return process.platform === 'win32' || process.platform === 'darwin';
	}
}










/**
 * ディレクトリが見付からなかったかエラーだった事を示す QuickPickItem
 * 2024/07/01
 */
export class RyDirectoryErrorQPItem extends RyQuickPickItem
{
	constructor(dir: RyPath)
	{
		super();
		this.label = dir.type === MyFileType.notFound ? i18n.t(MESSAGES.directoryNotFoundItemLabel) : i18n.t(MESSAGES.directoryErrorItemLabel);
		this.detail = dir.fullPath;
		this.alwaysShow = true;
	}
}
