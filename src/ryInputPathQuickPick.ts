import * as vscode from 'vscode';
import * as path from 'path';

import * as ryutils from './ryutils';
import { RyConfiguration } from './ryConfiguration';
import
{
	RyQuickPickBase,
	RyQuickPickItem,
	maskUserNameDirectory,
	RyPath,
	RyValidPathQPItem,
	FileListStatus,
	MyFileType,
} from './ryQuickPickBase';
import { MyQuickPick, RyCertainListQuickPick } from './myQuickPick';

// 自前の国際化文字列リソースの読み込み
import { i18n } from "./i18n";
import { MESSAGES } from "./i18nTexts";










/**
 * パス直接入力モードで表示する、ファイルを表す QuickPickItem
 * alwaysShow が true で、選択した時の挙動がちょっと違う。
 */
class InputPathModeQPItem extends RyValidPathQPItem
{
	constructor(aQuickPick: RyQuickPickBase, fileInfo: RyPath)
	{
		super(aQuickPick, fileInfo);
		this.alwaysShow = true;
	}

	override didAccept(): void
	{
		// ディレクトリを選択したらそのディレクトリで通常モードに戻る
		if (this._path.type === MyFileType.directory)
		{
			this.ownerQuickPick.dispose();

			// 新しい QuickPick を表示する
			const quickPick = new MyQuickPick(this.path);
			if (quickPick.path.isValidPath)
			{
				quickPick.show();
			}
		}
		else
		{
			// ファイルを選択したら設定されているアクションを実行
			this.executeFileAction();
			this.ownerQuickPick.dispose();
		}
	}
}










/**
 * ディレクトリが見付からなかったかエラーだった事を示す QuickPickItem
 * 2024/07/01
 */
class RyDirectoryErrorQPItem extends RyQuickPickItem
{
	constructor(aQuickPick: InputPathQuickPick, dir: RyPath)
	{
		super(aQuickPick);
		this.label = dir.type === MyFileType.notFound ? i18n(MESSAGES.directoryNotFoundItemLabel) : i18n(MESSAGES.directoryErrorItemLabel);
		this.detail = dir.fullPath;
		this.alwaysShow = true;
	}
}










/**
 * ブラウズモードに戻るための QuickPickItem
 * 2024/07/01
 */
class RyBackToBrowseModeQPItem extends RyQuickPickItem
{
	private readonly _backDirectory: RyPath;

	constructor(aQuickPick: InputPathQuickPick, backPath: RyPath)
	{
		super(aQuickPick);
		this._backDirectory = backPath;
		this.label = i18n(MESSAGES.backToBrowseModeItemLabel, { dir: backPath.filenameOnly });
		this.alwaysShow = true;
	}

	override didAccept(): void
	{
		this.ownerQuickPick.dispose();

		const quickPick = new MyQuickPick(this._backDirectory);
		if (quickPick.path.isValidPath)
		{
			quickPick.show();
		}
	}
}










/**
 * パスを直接入力するための QuickPick
 */
export class InputPathQuickPick extends RyQuickPickBase
{
	// パス直接入力モードの前に表示されていたディレクトリ。ブラウズモードに戻る時に使う。
	private _backDirectory: RyPath;

	constructor(backDirectory: RyPath)
	{
		super();
		this._backDirectory = backDirectory;
		this._theQuickPick.title = i18n(MESSAGES['inputPathCommand.label']);
		this._theQuickPick.onDidChangeValue(() => this.handleQuickPickDidChangeValue());
		this.updateList();
		this._theQuickPick.show();
	}

	/**
	 * QuickPick の値が変更されたときの処理。
	 * @param quickPick
	 */
	private handleQuickPickDidChangeValue(): void
	{
		// 入力したパスがパス区切り文字で終わっている場合はそのディレクトリのファイルをリストアップする
		const inputPath = this._theQuickPick.value;
		if (ryutils.endsWithPathSeparator(inputPath))
		{
			this._theQuickPick.items = this.createItems();
		}
	}

	protected override get placeholderText(): string
	{
		return `${i18n(MESSAGES.baseDirectory)}: ${maskUserNameDirectory(RyConfiguration.getBaseDirectory())}`;
	}

	protected override getButtons(): vscode.QuickInputButton[]
	{
		return [
			// ディレクトリとファイルを分けて表示する設定の切り替えボタン
			this.createToggleGroupDirectoriesButton(),

			// 隠しファイルの表示設定ボタン
			this.createShowHiddenFilesButton()
		];
	}

	/**
	 * 表示するアイテムのリストを作成する。
	 */
	protected override createItems(): vscode.QuickPickItem[]
	{
		const items: vscode.QuickPickItem[] = [];

		// 入力されたパスを解決する
		const inputPath = this._theQuickPick.value;
		const absolutePath = path.resolve(RyConfiguration.getBaseDirectory(), inputPath);
		const ryPath = RyPath.createFromString(absolutePath);

		const files = ryPath.listFiles();
		if (files.result === FileListStatus.SUCCESS)
		{
			const pathItems = files.files.map(fileInfo => new InputPathModeQPItem(this, fileInfo));
			items.push(...RyCertainListQuickPick.separatePathItemsIfNeeded(pathItems));
		}
		else if (files.result === FileListStatus.ERROR)
		{
			items.push(new RyDirectoryErrorQPItem(this, files.path));
		}

		items.push(new RyBackToBrowseModeQPItem(this, this._backDirectory));
		return items;
	}

	public override showDirectory(directory: RyPath): void
	{
		const quickPick = new MyQuickPick(directory);
		if (quickPick.path.isValidPath)
		{
			quickPick.show();
		}
	}

	public static createQuickPick(backDirectory: RyPath): InputPathQuickPick
	{
		return new InputPathQuickPick(backDirectory);
	}
}