import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import * as ryutils from './ryutils';

// 自前の国際化文字列リソースの読み込み
import i18n from "./i18n";
import i18nTexts from "./i18nTexts";










// 拡張機能の設定のセクション名
export const CONFIGURATION_NAME = 'romly-path-maker';

// 設定のキー名。package.json の configuration/properties 内のキー名と一致させる。
const CONFIG_KEY_HIDE_USERNAME = 'hideUserName';
const CONFIG_KEY_SHOW_DIRECTORY_ICONS = 'showDirectoryIcons';
const CONFIG_KEY_SHOW_HIDDEN_FILES = 'showHiddenFiles';
const CONFIG_KEY_BASE_DIRECTORY = 'baseDirectory';
const CONFIG_KEY_GROUP_DIRECTORIES = 'groupDirectories';
export const CONFIG_KEY_LAST_DIRECTORY = 'lastDirectory';
const CONFIG_KEY_DEFAULT_ACTION = 'defaultAction';

//　内部で使用しているQuickPickのボタンの識別子。文字列は識別のみなので何でもおけ。
const BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES = 'toggle_show_hidden_files';
const BUTTON_ID_TOGGLE_GROUP_DIRECTORIES = 'toggle_group_directories';

// 内部で使用しているクイックピックアイテムの識別子。文字列は識別のみなので何でもおけ。
const COMMAND_ID_SET_BASE_DIRECTORY = 'set_base_directory';
const COMMAND_ID_CLEAR_BASE_DIRECTORY = 'clear_base_directory';
const COMMAND_ID_TOGGLE_SHOW_HIDDEN_FILES = 'toggle_show_hidden_files';
const COMMAND_ID_OPEN_DIRECTORY_AS_WORKSPACE = 'open_directory_as_workspace';
const COMMAND_ID_GOTO_DIRECTORY = 'goto_directory';

// コマンドのラベルに付く前置詞
const COMMAND_LABEL_PREFIX = '> ';










class MyFileInfo
{
	fullPath: string;
	isDirectory: boolean;

	constructor(fullPath: string, isDirectory: boolean)
	{
		this.fullPath = fullPath;
		this.isDirectory = isDirectory;
	}

	directoryOnly(): string
	{
		return path.dirname(this.fullPath);
	}

	filenameOnly(): string
	{
		return path.basename(this.fullPath);
	}
}










abstract class MyQuickPickAcceptableItem implements vscode.QuickPickItem
{
	label: string;
	description: string;

	constructor()
	{
		this.label = '';
		this.description = '';
	}

	abstract didAccept(quickPick: vscode.QuickPick<vscode.QuickPickItem>): void;
}

abstract class MyQuickPickFileSystemEntityItem extends MyQuickPickAcceptableItem
{
	// 定数
	private readonly BUTTON_ID_COPY = 'copy';
	private readonly BUTTON_ID_INSERT_PATH_TO_EDITOR = 'insert_path_to_editor';
	private readonly BUTTON_ID_INSERT_PATH_TO_TERMINAL = 'insert_path_to_terminal';
	private readonly BUTTON_ID_OPEN_IN_EDITOR = 'open_in_editor';
	private readonly BUTTON_ID_REVEAL_IN_FILE_EXPLORER = 'reveal_in_file_explorer';

	fullPath: string;
	insertPath: string;
	buttons: ryutils.RyQuickPickButton[];

	iconPath?: vscode.Uri | {
		light: vscode.Uri;
		dark: vscode.Uri;
	} | vscode.ThemeIcon;

	constructor()
	{
		super();
		this.fullPath = '';
		this.insertPath = '';
		this.buttons = [];
	}

	protected addCopyButton(): void
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('copy'), tooltip: i18n(i18nTexts, 'copyPathToClipboard'), id: this.BUTTON_ID_COPY });
	}

	protected addInsertPathToEditorButton(): void
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('insert'), tooltip: i18n(i18nTexts, 'insertPathToActiveEditor'), id: this.BUTTON_ID_INSERT_PATH_TO_EDITOR });
	}

	protected addInsertPathToTerminalButton(): void
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('terminal'), tooltip: i18n(i18nTexts, 'insertPathToActiveTerminal'), id: this.BUTTON_ID_INSERT_PATH_TO_TERMINAL });
	}

	protected addOpenInEditorButton(): void
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('edit'), tooltip: i18n(i18nTexts, 'openInEditor'), id: this.BUTTON_ID_OPEN_IN_EDITOR });
	}

	protected addRevealInFileExplorerButton()
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('folder-opened'), tooltip: i18n(i18nTexts, 'revealInFileExplorer'), id: this.BUTTON_ID_REVEAL_IN_FILE_EXPLORER });
	}

	protected setFolderIcon(): void
	{
		// ディレクトリアイコンを表示する？
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		const showIcons = config.get(CONFIG_KEY_SHOW_DIRECTORY_ICONS) as boolean;

		if (showIcons)
		{
			this.iconPath = new vscode.ThemeIcon('folder');
		}
	}

	protected executeFileAction(): void
	{
		// 設定されているアクションを実行
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		const defaultAction = config.get<string>(CONFIG_KEY_DEFAULT_ACTION);
		switch (defaultAction)
		{
			case 'Open':
				if (this.fullPath)
				{
					openFileInEdtor(this.fullPath);
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

	onButtonClick(button: ryutils.RyQuickPickButton): void
	{
		if (button.id === this.BUTTON_ID_COPY)
		{
			// クリップボードにパスをコピー
			ryutils.copyTextToClipboard(this.insertPath);
		}
		else if (button.id === this.BUTTON_ID_INSERT_PATH_TO_EDITOR)
		{
			ryutils.insertTextToEdtior(this.insertPath);
		}
		else if (button.id === this.BUTTON_ID_INSERT_PATH_TO_TERMINAL)
		{
			// アクティブなターミナルにパスを挿入
			ryutils.sendTextToTerminal(this.insertPath);
		}
		else if (button.id === this.BUTTON_ID_OPEN_IN_EDITOR)
		{
			// エディタで開く
			openFileInEdtor(this.fullPath);
		}
		else if (button.id === this.BUTTON_ID_REVEAL_IN_FILE_EXPLORER)
		{
			// ディレクトリを開く
			ryutils.openDirectory(this.fullPath);
		}
	}
}

class MyQuickPickFileItem extends MyQuickPickFileSystemEntityItem
{
	constructor(fileInfo: MyFileInfo, asCurrentDirDot: boolean, baseDirectory: string)
	{
		super();
		const fullPath = asCurrentDirDot ? fileInfo.directoryOnly() : fileInfo.fullPath;
		const filenameOnly = fileInfo.filenameOnly();
		const relativePath = getRelativeOrAbsolutePath(baseDirectory, fullPath);

		// このアイテムを選択したときに実際に挿入される文字列
		const insertPath = `'${relativePath}'`;

		const description = maskUserNameDirectory(asCurrentDirDot ?
			relativePath :
			(insertPath === filenameOnly ? '' : insertPath));

		this.label = asCurrentDirDot ? '.' : filenameOnly!;
		this.description = description;
		this.fullPath = fullPath;
		this.insertPath = insertPath;
		this.addCopyButton();
		if (!asCurrentDirDot)
		{
			this.addOpenInEditorButton();
		}
		this.addInsertPathToEditorButton();
		this.addInsertPathToTerminalButton();
	}

	override didAccept(quickPick: vscode.QuickPick<vscode.QuickPickItem>): void
	{
		this.executeFileAction();
		quickPick.hide();
	}
}









class MyQuickPickDirectoryItem extends MyQuickPickFileSystemEntityItem
{
	constructor(fileInfo: MyFileInfo, isGoToParent: boolean, baseDirectory: string)
	{
		super();

		// このアイテムを選択したときに実際に挿入されるパス
		const relativePath = getRelativeOrAbsolutePath(baseDirectory, fileInfo.fullPath);

		// ディレクトリ名部分のみ
		const dirName = isGoToParent ? '..' : fileInfo.filenameOnly();

		// このアイテムを選択したときに実際に挿入される文字列
		const insertPath = `'${relativePath}'`;

		this.label = this.makeDirectoryLabel(dirName);
		this.description = insertPath === dirName ? '' : maskUserNameDirectory(insertPath);
		this.fullPath = fileInfo.fullPath;
		this.insertPath = insertPath;
		this.addCopyButton();
		this.addInsertPathToTerminalButton();
		this.addRevealInFileExplorerButton();

		this.setFolderIcon();
	}

	/**
	 * ディレクトリ名をQuickPickItemのラベルとして表示する時の文字列に変換する。
	 * @param directory ディレクトリ名
	 * @returns QuickPickItemのラベルとして表示する文字列。
	 */
	makeDirectoryLabel(directory: string): string
	{
		return path.sep + maskUserNameDirectory(directory);
	}

	/**
	 * このアイテムを選択したときの処理。
	 */
	override didAccept(quickPick: vscode.QuickPick<vscode.QuickPickItem>): void
	{
		showFilesInQuickPick(this.fullPath);
	}
}









/**
 * CDモードで表示する、ファイルを表す QuickPickItem
 */
class MyQuickPickCDModeEntityItem extends MyQuickPickFileSystemEntityItem
{
	// ディレクトリなら true
	isDirectory: boolean;

	constructor(fileInfo: MyFileInfo)
	{
		super();

		// このアイテムを選択したときに実際に挿入されるパス
		const relativePath = getRelativeOrAbsolutePath(getBaseDirectoryFromConfig(), fileInfo.fullPath);

		// ディレクトリ名部分のみ
		const dirName = fileInfo.filenameOnly();

		// このアイテムを選択したときに実際に挿入される文字列
		const insertPath = `'${relativePath}'`;

		// ラベルは入力中のパスにマッチするようにマスクしない
		this.label = fileInfo.fullPath;
		this.description = insertPath === dirName ? '' : maskUserNameDirectory(insertPath);

		this.fullPath = fileInfo.fullPath;
		this.insertPath = insertPath;
		this.isDirectory = fileInfo.isDirectory;
		this.addCopyButton();
		this.addInsertPathToTerminalButton();

		if (fileInfo.isDirectory)
		{
			this.addRevealInFileExplorerButton();
			this.setFolderIcon();
		}
		else
		{
			this.addOpenInEditorButton();
		}
	}

	override didAccept(quickPick: vscode.QuickPick<vscode.QuickPickItem>): void
	{
		// ディレクトリを選択したらそのディレクトリで通常モードに戻る
		if (this.isDirectory)
		{
			const directory = this.fullPath;
			quickPick.title = maskUserNameDirectory(directory);
			quickPick.value = '';
			quickPick.items = createQuickPickItems(directory);
			quickPick.buttons = createQuickPickButtons(quickPick);
		}
		else
		{
			// ファイルを選択したら設定されているアクションを実行
			this.executeFileAction();
			quickPick.hide();
		}
	}
}










class MyQuickPickCommandItem extends MyQuickPickAcceptableItem
{
	detail: string;

	id: string;
	fullPath: string;

	/**
	 * コンストラクタ。
	 * @param label QuickPickItem のラベル。
	 * @param description QuickPickItem の description。
	 * @param detail QuickPickItem の detail。
	 * @param id コマンドを識別するためのID。
	 * @param fullPath コマンドに関連付けられたパス。
	 */
	constructor(label: string, description: string, detail: string, id: string, fullPath: string = '')
	{
		super();
		this.label = COMMAND_LABEL_PREFIX + label;
		this.description = description;
		this.detail = detail;
		this.id = id;
		this.fullPath = fullPath;
	}

	override didAccept(quickPick: vscode.QuickPick<vscode.QuickPickItem>): void
	{
		if (this.id === COMMAND_ID_SET_BASE_DIRECTORY || this.id === COMMAND_ID_CLEAR_BASE_DIRECTORY)
		{
			// ベースディレクトリとして設定
			const newBaseDirectory = this.id === COMMAND_ID_SET_BASE_DIRECTORY ? this.fullPath : '';
			updateSetting(CONFIG_KEY_BASE_DIRECTORY, newBaseDirectory)
			.then(() => {
				// 基準ディレクトリの変更に伴ってアイテムを更新
				quickPick.items = createQuickPickItems(this.fullPath);
				quickPick.placeholder = getPlaceholderText();

				vscode.window.showInformationMessage(i18n(i18nTexts, 'baseDirectoryUpdated', { dir: maskUserNameDirectory(newBaseDirectory) }));
			})
			.catch((error) => vscode.window.showErrorMessage(i18n(i18nTexts, 'error.couldntSetBaseDirectory') + `: ${error}`));
		}
		else if (this.id === COMMAND_ID_TOGGLE_SHOW_HIDDEN_FILES)
		{
			// 隠しファイルの表示設定を切り替える
			toggleShowHiddenFile(quickPick, this.fullPath);
		}
		else if (this.id === COMMAND_ID_OPEN_DIRECTORY_AS_WORKSPACE)
		{
			// Codeでディレクトリを開く
			if (this.fullPath)
			{
				// trueにすることで新しいウィンドウで開く
				vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(this.fullPath), true);
			}
		}
		else if (this.id === COMMAND_ID_GOTO_DIRECTORY)
		{
			// そのディレクトリへ移動
			showFilesInQuickPick(this.fullPath);
		}
	}
}










/**
 * 「パスを入力して移動」コマンドの QuickPickItem。
 */
class MyQuickPickInputPathItem extends MyQuickPickAcceptableItem
{
	constructor()
	{
		super();
		this.label = COMMAND_LABEL_PREFIX + i18n(i18nTexts, 'inputPathCommand.label');
		this.description = '';
	}

	override didAccept(quickPick: vscode.QuickPick<vscode.QuickPickItem>): void
	{
		// QuickPick をパス入力用に変更
		quickPick.title = i18n(i18nTexts, 'inputPathCommand.label');
		quickPick.items = [];
		quickPick.buttons = createQuickPickButtons(quickPick);
	}
}










/**
 * 指定されたファイルをエディタで開く。
 * @param fullPath 開くファイルのパス。
 */
async function openFileInEdtor(fullPath: string)
{
	try
	{
		const document = await vscode.workspace.openTextDocument(fullPath);
		await vscode.window.showTextDocument(document);
	}
	catch (error)
	{
		vscode.window.showErrorMessage(i18n(i18nTexts, 'couldNotOpenFile') + `: ${error}`);
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










/**
 * 指定されたパス文字列からユーザー名を設定に応じて隠す。
 * 隠す場合は '<username>' に置き換える。
 *
 * @param pathString - マスクを適用するパス文字列。
 * @returns ユーザー名がマスクされたパス、または元のパス文字列。
 */
function maskUserNameDirectory(pathString: string): string
{
	// ユーザー名に含まれる正規表現のメタ文字をエスケープする処理
	function escapeRegExp(s: string)
	{
		return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $&はマッチした全文字列を意味する
	}

	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
	const hideUserName = config.get(CONFIG_KEY_HIDE_USERNAME) as boolean;

	if (hideUserName)
	{
		const homeDir = os.homedir();
		const username = path.basename(homeDir);
		const escapedUsername = escapeRegExp(username);
		const regex = new RegExp(`\\b${escapedUsername}\\b`, 'g');
		return pathString.replace(regex, '<username>');
	}
	else
	{
		return pathString;
	}
}









/**
 * QuickPick （全体）に表示するボタンのリストを作成する。
 * @returns
 */
function createQuickPickButtons(quickPick: vscode.QuickPick<vscode.QuickPickItem>): ryutils.RyQuickPickButton[]
{
	const result = [] as ryutils.RyQuickPickButton[];

	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);

	// ディレクトリとファイルを分けて表示する設定の切り替えボタン
	// 通常モードの時のみ表示
	if (!isInCDMode(quickPick))
	{
		const groupDirectories = config.get(CONFIG_KEY_GROUP_DIRECTORIES) as boolean;
		result.push(groupDirectories ?
			{ id: BUTTON_ID_TOGGLE_GROUP_DIRECTORIES, iconPath: new vscode.ThemeIcon('folder'), tooltip: i18n(i18nTexts, 'tooltip.ungroupDirectories') } :
			{ id: BUTTON_ID_TOGGLE_GROUP_DIRECTORIES, iconPath: new vscode.ThemeIcon('folder-library'), tooltip: i18n(i18nTexts, 'tooltip.groupDirectories') });
	}

	// 隠しファイルの表示設定ボタン
	const showHiddenFiles = config.get(CONFIG_KEY_SHOW_HIDDEN_FILES);
	result.push(showHiddenFiles ?
		{ id: BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES, iconPath: new vscode.ThemeIcon('eye'), tooltip: i18n(i18nTexts, 'tooltip.hideHiddenFiles') } :
		{ id: BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES, iconPath: new vscode.ThemeIcon('eye-closed'), tooltip: i18n(i18nTexts, 'tooltip.showHiddenFiles') });

	return result;
}










/**
 * 基準ディレクトリを設定から読み込んで返す。
 * @returns
 */
function getBaseDirectoryFromConfig(): string
{
	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
	return config.get<string>(CONFIG_KEY_BASE_DIRECTORY) ?? '';
}










/**
 * QuickPick のプレースホルダーに表示するテキストを返す。基準ディレクトリを表示。
 * @returns
 */
function getPlaceholderText(): string
{
	return `${i18n(i18nTexts, 'baseDirectory')}: ${maskUserNameDirectory(getBaseDirectoryFromConfig())}`;
}









function listFilesInDirectory(directory: string, filterHiddenFiles: boolean): MyFileInfo[]
{
	const result = [] as MyFileInfo[];
	const files = fs.readdirSync(directory);
	files.forEach((filename) =>
	{
		// ファイル情報が取得できなかったもの（エラー発生）は省く
		try
		{
			const fullPath = path.join(directory, filename);
			const stat = fs.statSync(fullPath);

			if (!filterHiddenFiles || !filename.startsWith('.'))
			{
				result.push(new MyFileInfo(fullPath, stat.isDirectory()));
			}
		}
		catch (err)
		{
		}
	});
	return result;
}










/**
 * 指定されたディレクトリへの移動コマンド情報をquickPickItemsに追加する。
 *
 * @param items - 追加先。
 * @param directory - 現在のディレクトリ。
 * @param labelKey - アイテムのラベルの文字列リソースのキー。
 * @param targetDir - 移動先のディレクトリ。
 */
function addGotoDirectoryItem(items: vscode.QuickPickItem[], directory: string, labelKey: string, targetDir: string): void
{
	if (targetDir !== '' && targetDir !== directory)
	{
		items.push(new MyQuickPickCommandItem(i18n(i18nTexts, labelKey), '', maskUserNameDirectory(targetDir), COMMAND_ID_GOTO_DIRECTORY, targetDir));
	}
}










/**
 * ワークスペースのディレクトリを取得する
 * @returns {string} ワークスペースディレクトリのパス。ワークスペースが存在しない場合は空の文字列を返す。
 */
export function getWorkspaceDirectory(): string
{
	const folders = vscode.workspace.workspaceFolders;
	if (folders && folders.length > 0)
	{
		// 複数ある場合は最初のワークスペースフォルダを使用
		const workspacePath = folders[0].uri.fsPath;
		return workspacePath;
	}
	else
	{
		// ワークスペースのディレクトリが見つからなかった
		return '';
	}
}










/**
 * ワークスペースのスコープに設定を書き込む。ワークスペースが見つからなかった場合にはグローバルスコープに書き込む。
 *
 * @param key 設定のキー。
 * @param value 設定する値。
 * @returns 設定が完了すると解決されるPromise。
 */
async function updateSetting(key: string, value: any): Promise<void>
{
	// ワークスペースが開かれているか確認
	const workspaceFolders = vscode.workspace.workspaceFolders;
	const targetScope = workspaceFolders ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;

	// 設定を取得
	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);

	// 設定を更新
	await config.update(key, value, targetScope);
}









/**
 * QuickPick に表示するアイテムのリストを作成する。
 * @param directory
 * @returns
 */
function createQuickPickItems(directory: string): vscode.QuickPickItem[]
{
	const quickPickItems: vscode.QuickPickItem[] = [];
	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);

	const baseDir = getBaseDirectoryFromConfig();

	// ディレクトリとファイルを分ける？
	const groupDirectories = config.get(CONFIG_KEY_GROUP_DIRECTORIES) as boolean;

	// 隠しファイルを表示する？
	const showHiddenFiles = config.get(CONFIG_KEY_SHOW_HIDDEN_FILES) as boolean;

	// ディレクトリ内のファイルを検索する
	const files = listFilesInDirectory(directory, !showHiddenFiles);

	if (groupDirectories)
	{
		// まずディレクトリ
		quickPickItems.push({ label: i18n(i18nTexts, 'directories'), kind: vscode.QuickPickItemKind.Separator });
		quickPickItems.push(new MyQuickPickDirectoryItem(new MyFileInfo(path.dirname(directory), true), true, baseDir));
		files.filter(fileInfo => fileInfo.isDirectory).forEach((fileInfo) => {
			quickPickItems.push(new MyQuickPickDirectoryItem(fileInfo, false, baseDir));
		});

		// 次にファイル
		quickPickItems.push({ label: i18n(i18nTexts, 'files'), kind: vscode.QuickPickItemKind.Separator });
		quickPickItems.push(new MyQuickPickFileItem(new MyFileInfo(directory, false), true, baseDir));
		files.filter(fileInfo => !fileInfo.isDirectory).forEach((fileInfo) => {
				quickPickItems.push(new MyQuickPickFileItem(fileInfo, false, baseDir));
			});
	}
	else
	{
		// 親ディレクトリへ移動するためのアイテム
		quickPickItems.push(new MyQuickPickDirectoryItem(new MyFileInfo(path.dirname(directory), true), true, baseDir));

		// カレントディレクトリを選択するためのアイテム
		quickPickItems.push(new MyQuickPickFileItem(new MyFileInfo(directory, false), true, baseDir));

		files.forEach((fileInfo) =>
		{
			if (fileInfo.isDirectory)
			{
				quickPickItems.push(new MyQuickPickDirectoryItem(fileInfo, false, baseDir));
			}
			else
			{
				quickPickItems.push(new MyQuickPickFileItem(fileInfo, false, baseDir));
			}
		});
	}

	// ------------------------------------------------------------
	// その他コマンドを追加

	quickPickItems.push({ label: i18n(i18nTexts, 'commands'), kind: vscode.QuickPickItemKind.Separator });

	// 基準ディレクトリを設定するコマンド。表示しているのが基準ディレクトリの場合は追加しない。
	if (baseDir !== directory)
	{
		quickPickItems.push(new MyQuickPickCommandItem(i18n(i18nTexts, 'command.setBaseDirectory'), '', '', COMMAND_ID_SET_BASE_DIRECTORY, directory));
	}

	// 基準ディレクトリをクリアするコマンド。すでに基準ディレクトリが空なら追加しない。
	if (baseDir !== '')
	{
		quickPickItems.push(new MyQuickPickCommandItem(i18n(i18nTexts, 'command.clearBaseDirectory'), '', '', COMMAND_ID_CLEAR_BASE_DIRECTORY));
	}

	// パスを入力して移動するコマンド
	quickPickItems.push(new MyQuickPickInputPathItem());

	// 隠しファイルの表示を切り替えるコマンド
	quickPickItems.push(new MyQuickPickCommandItem(i18n(i18nTexts, showHiddenFiles ? 'hideHiddenFiles' : 'showHiddenFiles'), '', '', COMMAND_ID_TOGGLE_SHOW_HIDDEN_FILES, directory));

	// ワークスペース、編集中のファイル、ユーザーのディレクトリへそれぞれ移動するコマンド
	addGotoDirectoryItem(quickPickItems, directory, 'gotoWorkspaceDir', getWorkspaceDirectory());
	addGotoDirectoryItem(quickPickItems, directory, 'gotoEditingFileDir', ryutils.getActiveEditorDirectory());
	addGotoDirectoryItem(quickPickItems, directory, 'gotoUserDir', os.homedir());
	addGotoDirectoryItem(quickPickItems, directory, 'backtoBaseDir', getBaseDirectoryFromConfig());

	// このディレクトリをワークスペースとして開くコマンド
	quickPickItems.push(new MyQuickPickCommandItem(i18n(i18nTexts, 'openDirectoryAsWorkspace'), '', '', COMMAND_ID_OPEN_DIRECTORY_AS_WORKSPACE, directory));

	return quickPickItems;
}










/**
 * パス文字列がパス区切り文字で終わっているか判定する。
 * @param testPath
 * @returns パス区切り文字で終わっていれば true
 */
function endsWithPathSeparator(testPath: string): boolean
{
	const normalizedPath = path.normalize(testPath);
	return normalizedPath.endsWith(path.sep);
}










/**
 * パス直接入力モードで表示するアイテムのリストを作成する。
 */
function createCDModeQuickPickItems(quickPick: vscode.QuickPick<vscode.QuickPickItem>): vscode.QuickPickItem[]
{
	// パスを解決する
	const inputPath = quickPick.value;
	const absolutePath = path.resolve(getBaseDirectoryFromConfig(), inputPath);

	// ディレクトリが存在するかチェックし、存在する場合はその中のファイルをリストアップして表示するg
	if (fs.existsSync(absolutePath))
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		const filterHiddenFiles = !config.get<boolean>(CONFIG_KEY_SHOW_HIDDEN_FILES);
		const files = listFilesInDirectory(absolutePath, filterHiddenFiles);
		return files.map(fileInfo => new MyQuickPickCDModeEntityItem(fileInfo));
	}
	else
	{
		console.log(`No such directory: ${absolutePath}`);
		return [];
	}
}










/**
 * 隠しファイルの表示設定を切り替える。
 */
function toggleShowHiddenFile(quickPick: vscode.QuickPick<vscode.QuickPickItem>, directory: string)
{
	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
	config.update(CONFIG_KEY_SHOW_HIDDEN_FILES, !config.get(CONFIG_KEY_SHOW_HIDDEN_FILES), vscode.ConfigurationTarget.Global);

	// 設定の変更に伴うQuickPick自体の更新
	quickPick.items = isInCDMode(quickPick) ? createCDModeQuickPickItems(quickPick) : createQuickPickItems(directory);
	quickPick.buttons = createQuickPickButtons(quickPick);
}










function toggleGroupDirectories(quickPick: vscode.QuickPick<vscode.QuickPickItem>, directory: string)
{
	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
	config.update(CONFIG_KEY_GROUP_DIRECTORIES, !config.get(CONFIG_KEY_GROUP_DIRECTORIES), vscode.ConfigurationTarget.Global);

	// 設定の変更に伴うQuickPick自体の更新
	quickPick.items = createQuickPickItems(directory);
	quickPick.buttons = createQuickPickButtons(quickPick);
}










/**
 * パス直接入力モードかを判定する。タイトルを見てるだけ。
 * @param quickPick
 * @returns
 */
function isInCDMode(quickPick: vscode.QuickPick<vscode.QuickPickItem>): boolean
{
	return quickPick.title === i18n(i18nTexts, 'inputPathCommand.label');
}










/**
 * QuickPick の値が変更されたときの処理。
 * @param quickPick
 * @param directory
 */
function handleQuickPickDidChangeValue(quickPick: vscode.QuickPick<vscode.QuickPickItem>, directory: string): void
{
	if (isInCDMode(quickPick))
	{
		// 入力したパスがパス区切り文字で終わっている場合はそのディレクトリのファイルをリストアップする
		const inputPath = quickPick.value;
		if (endsWithPathSeparator(inputPath))
		{
			quickPick.items = createCDModeQuickPickItems(quickPick);
		}

		quickPick.buttons = createQuickPickButtons(quickPick);
	}
}










/**
 * 指定されたディレクトリ内のファイル一覧を QuickPick で表示する。
 * @param directory
 * @returns
 */
export async function showFilesInQuickPick(directory: string)
{
	const quickPickItems = createQuickPickItems(directory);
	if (quickPickItems.length === 0)
	{
		return;
	}

	// 最後に表示したディレクトリとして設定に保存しておく
	updateSetting(CONFIG_KEY_LAST_DIRECTORY, directory).catch((error) => console.error(error));

	const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();
	quickPick.items = quickPickItems;
	quickPick.title = maskUserNameDirectory(directory);
	quickPick.buttons = createQuickPickButtons(quickPick);
	quickPick.placeholder = getPlaceholderText();

	// QuickPick のボタン押下時の処理
	quickPick.onDidTriggerButton((button) =>
	{
		const buttonId = (button as ryutils.RyQuickPickButton).id;
		if (buttonId === BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES)
		{
			// 隠しファイルの表示設定を切り替える
			toggleShowHiddenFile(quickPick, directory);
		}
		else if (buttonId === BUTTON_ID_TOGGLE_GROUP_DIRECTORIES)
		{
			// ディレクトリのグループ表示設定を切り替える
			toggleGroupDirectories(quickPick, directory);
		}
	});

	// 個々のアイテムのボタン押下時の処理
	quickPick.onDidTriggerItemButton(async (e) =>
	{
		if (e.item instanceof MyQuickPickFileSystemEntityItem)
		{
			const button = e.button as ryutils.RyQuickPickButton;
			e.item.onButtonClick(button);
			quickPick.hide();
		}
	});

	// 選択時の処理
	quickPick.onDidAccept(() =>
	{
		const selection = quickPick.selectedItems[0];
		if (selection && selection instanceof MyQuickPickAcceptableItem)
		{
			selection.didAccept(quickPick);
		}
	});

	quickPick.onDidChangeValue(() => handleQuickPickDidChangeValue(quickPick, directory));
	quickPick.show();
}
