import * as path from 'path';

import * as ryutils from './ryutils';
import
{
	RyQuickPickBase,
	RyQuickPickItem,
	maskUserNameDirectory,
	getBaseDirectoryFromConfig,
	listFilesInDirectory,
	RyPathQPItem,
	MyFileInfo,
	FileListStatus,
	getRelativeOrAbsolutePath,
	MyFileType,
} from './ryQuickPickBase';
import { MyQuickPick } from './myQuickPick';

// 自前の国際化文字列リソースの読み込み
import { i18n } from "./i18n";
import { MESSAGES } from "./i18nTexts";










/**
 * CDモードで表示する、ファイルを表す QuickPickItem
 */
class InputPathModeQPItem extends RyPathQPItem
{
	// ディレクトリなら true
	isDirectory: boolean;

	constructor(aQuickPick: RyQuickPickBase, fileInfo: MyFileInfo)
	{
		super(aQuickPick, fileInfo.fullPath, fileInfo.fullPath);
		this.alwaysShow = true;

		// このアイテムを選択したときに実際に挿入されるパス
		const relativePath = getRelativeOrAbsolutePath(getBaseDirectoryFromConfig(), fileInfo.fullPath);

		// ディレクトリ名部分のみ
		const dirName = fileInfo.filenameOnly();

		// このアイテムを選択したときに実際に挿入される文字列
		const insertPath = `'${relativePath}'`;

		// ラベルは入力中のパスにマッチするようにマスクしない
		this.description = insertPath === dirName ? '' : maskUserNameDirectory(insertPath);

		this.insertPath = insertPath;
		this.isDirectory = fileInfo.type === MyFileType.directory;

		this.addPinAndFavoriteButton();
		this.addCopyButton();
		this.addInsertPathToTerminalButton();

		if (fileInfo.type === MyFileType.directory)
		{
			this.addRevealInFileExplorerButton();
			this.setIcon();
		}
		else
		{
			this.addOpenInEditorButton();
		}
	}

	override didAccept(): void
	{
		// ディレクトリを選択したらそのディレクトリで通常モードに戻る
		if (this.isDirectory)
		{
			this.ownerQuickPick.dispose();

			// 新しい QuickPick を表示する
			MyQuickPick.createMyQuickPick(this.fullPath);
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
 * ディレクトリが見付からなかった事を示す QuickPickItem
 * 2024/07/01
 */
class RyDirectoryNotFoundQPItem extends RyQuickPickItem
{
	constructor(aQuickPick: InputPathQuickPick, dir: string)
	{
		super(aQuickPick);
		this.label = i18n(MESSAGES.directoryNotFoundItemLabel);
		this.detail = dir;
		this.alwaysShow = true;
	}
}










/**
 * ブラウズモードに戻るための QuickPickItem
 * 2024/07/01
 */
class RyBackToBrowseModeQPItem extends RyQuickPickItem
{
	private readonly _backDirectory: string;

	constructor(aQuickPick: InputPathQuickPick, backDir: string)
	{
		super(aQuickPick);
		this._backDirectory = backDir;
		this.label = i18n(MESSAGES.backToBrowseModeItemLabel, { dir: path.basename(backDir) });
		this.alwaysShow = true;
	}

	override didAccept(): void
	{
		this.ownerQuickPick.dispose();
		MyQuickPick.createMyQuickPick(this._backDirectory);
	}
}










/**
 * パスを直接入力するための QuickPick
 */
export class InputPathQuickPick extends RyQuickPickBase
{
	// パス直接入力モードの前に表示されていたディレクトリ。ブラウズモードに戻る時に使う。
	private _backDirectory: string;

	constructor(backDirectory: string)
	{
		super();
		this._backDirectory = backDirectory;
		this._theQuickPick.title = i18n(MESSAGES['inputPathCommand.label']);
		this._theQuickPick.placeholder = `${i18n(MESSAGES.baseDirectory)}: ${maskUserNameDirectory(getBaseDirectoryFromConfig())}`;
		this._theQuickPick.onDidChangeValue(() => this.handleQuickPickDidChangeValue());
		this.updateButtons();
		this.updateItems();
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
			this.updateItems();
		}

		this.updateButtons();
	}

	/**
	 * QuickPick のボタンの更新。生成時と、表示設定が変わった時などに必要。
	 */
	private updateButtons(): void
	{
		this._theQuickPick.buttons =
		[
			// 隠しファイルの表示設定ボタン
			this.createShowHiddenFilesButton()
		];
	}

	/**
	 * 表示するアイテムのリストを作成する。
	 */
	private updateItems(): void
	{
		const items: RyQuickPickItem[] = [];

		// 入力されたパスを解決する
		const inputPath = this._theQuickPick.value;
		const absolutePath = path.resolve(getBaseDirectoryFromConfig(), inputPath);

		const files = listFilesInDirectory(absolutePath);
		if (files.result === FileListStatus.SUCCESS)
		{
			items.push(...files.files.map(fileInfo => new InputPathModeQPItem(this, fileInfo)));
		}
		else if (files.result === FileListStatus.NOT_FOUND)
		{
			items.push(new RyDirectoryNotFoundQPItem(this, absolutePath));
		}

		items.push(new RyBackToBrowseModeQPItem(this, this._backDirectory));
		this._theQuickPick.items = items;
	}

	public override updateList(): void
	{
		this.updateItems();
		this.updateButtons();
	}

	public override showDirectory(directory: string): void
	{
		MyQuickPick.createMyQuickPick(directory);
	}

	public static createQuickPick(backDirectory: string): InputPathQuickPick
	{
		return new InputPathQuickPick(backDirectory);
	}
}