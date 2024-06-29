import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import * as ryutils from './ryutils';

// 自前の国際化文字列リソースの読み込み
import { i18n, I18NText } from "./i18n";
import { MESSAGES } from "./i18nTexts";










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
	buttons: ryutils.RyQuickPickButton[];

	constructor()
	{
		this.label = '';
		this.description = '';
		this.buttons = [];
	}

	abstract didAccept(quickPick: vscode.QuickPick<vscode.QuickPickItem>): void;

	onButtonClick(button: ryutils.RyQuickPickButton): void
	{
	}
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

	iconPath?: vscode.Uri | {
		light: vscode.Uri;
		dark: vscode.Uri;
	} | vscode.ThemeIcon;

	constructor()
	{
		super();
		this.fullPath = '';
		this.insertPath = '';
	}

	protected addCopyButton(): void
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('copy'), tooltip: i18n(MESSAGES.copyPathToClipboard), id: this.BUTTON_ID_COPY });
	}

	protected addInsertPathToEditorButton(): void
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('insert'), tooltip: i18n(MESSAGES.insertPathToActiveEditor), id: this.BUTTON_ID_INSERT_PATH_TO_EDITOR });
	}

	protected addInsertPathToTerminalButton(): void
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('terminal'), tooltip: i18n(MESSAGES.insertPathToActiveTerminal), id: this.BUTTON_ID_INSERT_PATH_TO_TERMINAL });
	}

	protected addOpenInEditorButton(): void
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('edit'), tooltip: i18n(MESSAGES.openInEditor), id: this.BUTTON_ID_OPEN_IN_EDITOR });
	}

	protected addRevealInFileExplorerButton()
	{
		this.buttons.push({ iconPath: new vscode.ThemeIcon('folder-opened'), tooltip: i18n(MESSAGES.revealInFileExplorer), id: this.BUTTON_ID_REVEAL_IN_FILE_EXPLORER });
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

	override onButtonClick(button: ryutils.RyQuickPickButton): void
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
 * 指定されたディレクトリ内のファイルをリストアップし、必要に応じてエラーメッセージを表示する。
 *
 * @param directory ファイルをリストアップするディレクトリのパス
 * @returns listFilesInDirectory の結果をそのまま返す。
 */
function listFilesAndHandleError(directory: string): ListFilesResult
{
	const listFiles = listFilesInDirectory(directory);
	if (listFiles.result === FileListStatus.SUCCESS)
	{
		return listFiles;
	}
	else if (listFiles.result === FileListStatus.NOT_FOUND)
	{
		vscode.window.showErrorMessage(i18n(MESSAGES['error.directoryNotFound'], { dir: directory }));
	}
	else
	{
		const msg = i18n(MESSAGES['error.listFilesFailed'], { dir: directory });
		const e = listFiles.error;
		if (e !== undefined)
		{
			// エラー詳細を Output Channel に表示
			const debugErrorMessage = `Error occurred while listing files in directory: ${directory}`;
			ryutils.showErrorMessageWithDetailChannel(msg, 'Romly: Path-Maker', debugErrorMessage, e);
		}
		else
		{
			vscode.window.showErrorMessage(msg);
		}
	}

	return listFiles;
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

			// ディレクトリ内のファイルを検索する
			const files = listFilesAndHandleError(directory);
			if (files)
			{
				quickPick.title = maskUserNameDirectory(directory);
				quickPick.value = '';
				quickPick.items = createQuickPickItems(files);
				quickPick.buttons = createQuickPickButtons(quickPick);
			}
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
			.then(() =>
			{
				const files = listFilesAndHandleError(this.fullPath);
				if (files)
				{
					// 基準ディレクトリの変更に伴ってアイテムを更新
					quickPick.items = createQuickPickItems(files);
					quickPick.placeholder = getPlaceholderText();

					vscode.window.showInformationMessage(i18n(MESSAGES.baseDirectoryUpdated, { dir: maskUserNameDirectory(newBaseDirectory) }));
				}
			})
			.catch((error) => vscode.window.showErrorMessage(i18n(MESSAGES['error.couldntSetBaseDirectory']) + `: ${error}`));
		}
		else if (this.id === COMMAND_ID_TOGGLE_SHOW_HIDDEN_FILES)
		{
			// 隠しファイルの表示設定を切り替える
			toggleShowHiddenFile(quickPick, this.fullPath);
		}
		else if (this.id === COMMAND_ID_GOTO_DIRECTORY)
		{
			// そのディレクトリへ移動
			showFilesInQuickPick(this.fullPath);
		}
	}
}










/**
 * 「ワークスペースとして開く」コマンドの QuickPickItem。
 */
class MyQuickPickOpenAsWorkspaceCommandItem extends MyQuickPickAcceptableItem
{
	private readonly _directory: string;

	constructor(aDirectory: string)
	{
		super();
		this.label = COMMAND_LABEL_PREFIX + i18n(MESSAGES.openDirectoryAsWorkspace);
		this.description = '';
		this._directory = aDirectory;

		this.buttons.push({ iconPath: new vscode.ThemeIcon('empty-window'), tooltip: i18n(MESSAGES.openDirectoryAsWorkspaceInNewWindow), id: '' });
	}

	override didAccept(quickPick: vscode.QuickPick<vscode.QuickPickItem>): void
	{
		// Codeでディレクトリを開く
		if (this._directory)
		{
			vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(this._directory), false);
		}
	}

	override onButtonClick(button: ryutils.RyQuickPickButton): void
	{
		// trueにすることで新しいウィンドウで開く
		vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(this._directory), true);
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
		this.label = COMMAND_LABEL_PREFIX + i18n(MESSAGES['inputPathCommand.label']);
		this.description = '';
	}

	override didAccept(quickPick: vscode.QuickPick<vscode.QuickPickItem>): void
	{
		// QuickPick をパス入力用に変更
		quickPick.title = i18n(MESSAGES['inputPathCommand.label']);
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
		vscode.window.showErrorMessage(i18n(MESSAGES.couldNotOpenFile) + `: ${error}`);
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
	const hideUserName = config.get<boolean>(CONFIG_KEY_HIDE_USERNAME);

	if (hideUserName)
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
			{ id: BUTTON_ID_TOGGLE_GROUP_DIRECTORIES, iconPath: new vscode.ThemeIcon('folder'), tooltip: i18n(MESSAGES['tooltip.ungroupDirectories']) } :
			{ id: BUTTON_ID_TOGGLE_GROUP_DIRECTORIES, iconPath: new vscode.ThemeIcon('folder-library'), tooltip: i18n(MESSAGES['tooltip.groupDirectories']) });
	}

	// 隠しファイルの表示設定ボタン
	const showHiddenFiles = config.get(CONFIG_KEY_SHOW_HIDDEN_FILES);
	result.push(showHiddenFiles ?
		{ id: BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES, iconPath: new vscode.ThemeIcon('eye'), tooltip: i18n(MESSAGES['tooltip.hideHiddenFiles']) } :
		{ id: BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES, iconPath: new vscode.ThemeIcon('eye-closed'), tooltip: i18n(MESSAGES['tooltip.showHiddenFiles']) });

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
	return `${i18n(MESSAGES.baseDirectory)}: ${maskUserNameDirectory(getBaseDirectoryFromConfig())}`;
}









enum FileListStatus { SUCCESS, NOT_FOUND, ERROR };

/**
 * listFilesInDirectory の結果を表すオブジェクト。
 */
class ListFilesResult
{
	result: FileListStatus;
	path: string;
	files: MyFileInfo[];
	error?: Error;

	constructor(result: FileListStatus, path: string, files: MyFileInfo[] = [], error: Error | undefined = undefined)
	{
		this.result = result;
		this.path = path;
		this.files = files;
		this.error = error;
	}
}

/**
 * 指定されたディレクトリ内のファイル一覧を MyFileInfo のリストとして取得する。
 *
 * @param directory ファイル一覧を取得したいディレクトリのパス
 * @returns ファイル取得の成否、ファイル情報の配列、エラー情報（ある場合）を含むオブジェクト。
 */
function listFilesInDirectory(directory: string): ListFilesResult
{
	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
	const filterHiddenFiles = !config.get<boolean>(CONFIG_KEY_SHOW_HIDDEN_FILES);

	// ディレクトリの存在チェック
	if (!fs.existsSync(directory))
	{
		return new ListFilesResult(FileListStatus.NOT_FOUND, directory);
	}

	const result = [] as MyFileInfo[];
	let files;
	try
	{
		files = fs.readdirSync(directory);
		for (const filename of files)	// 文中で return する必要があるので forEach ではなく for ループで。
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
				console.error(`Romly Path Maker: readdirSync failed for: ${filename}`, err);
			}
		}
	}
	catch (err)
	{
		return new ListFilesResult(FileListStatus.ERROR, directory, [], err as Error);
	}

	return new ListFilesResult(FileListStatus.SUCCESS, directory, result);
}










/**
 * 指定されたディレクトリへの移動コマンド情報を quickPickItems に追加する。
 *
 * @param items 追加先。
 * @param directory 現在のディレクトリ。
 * @param labelKey アイテムのラベルの文字列リソースのキー。
 * @param targetDir 移動先のディレクトリ。
 */
function addGotoDirectoryItem(items: vscode.QuickPickItem[], directory: string, label: I18NText, targetDir: string): void
{
	if (targetDir !== '' && targetDir !== directory)
	{
		items.push(new MyQuickPickCommandItem(i18n(label), maskUserNameDirectory(targetDir), '', COMMAND_ID_GOTO_DIRECTORY, targetDir));
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
function createQuickPickItems(listFilesResult: ListFilesResult): vscode.QuickPickItem[]
{
	// ディレクトリとファイルを分ける？
	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
	const groupDirectories = config.get<boolean>(CONFIG_KEY_GROUP_DIRECTORIES);

	const directory = listFilesResult.path;
	const files = listFilesResult.files;
	const baseDir = getBaseDirectoryFromConfig();

	const quickPickItems: vscode.QuickPickItem[] = [];
	if (groupDirectories)
	{
		// まずディレクトリ
		quickPickItems.push({ label: i18n(MESSAGES.directories), kind: vscode.QuickPickItemKind.Separator });
		quickPickItems.push(new MyQuickPickDirectoryItem(new MyFileInfo(path.dirname(directory), true), true, baseDir));
		files.filter(fileInfo => fileInfo.isDirectory).forEach((fileInfo) => {
			quickPickItems.push(new MyQuickPickDirectoryItem(fileInfo, false, baseDir));
		});

		// 次にファイル
		quickPickItems.push({ label: i18n(MESSAGES.files), kind: vscode.QuickPickItemKind.Separator });
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

	quickPickItems.push({ label: i18n(MESSAGES.commands), kind: vscode.QuickPickItemKind.Separator });

	// 基準ディレクトリを設定するコマンド。表示しているのが基準ディレクトリの場合は追加しない。
	if (baseDir !== directory)
	{
		quickPickItems.push(new MyQuickPickCommandItem(i18n(MESSAGES[ 'command.setBaseDirectory']), '', '', COMMAND_ID_SET_BASE_DIRECTORY, directory));
	}

	// 基準ディレクトリをクリアするコマンド。すでに基準ディレクトリが空なら追加しない。
	if (baseDir !== '')
	{
		quickPickItems.push(new MyQuickPickCommandItem(i18n(MESSAGES['command.clearBaseDirectory']), '', '', COMMAND_ID_CLEAR_BASE_DIRECTORY));
	}

	// パスを入力して移動するコマンド
	quickPickItems.push(new MyQuickPickInputPathItem());

	// 隠しファイルの表示を切り替えるコマンド
	const showHiddenFiles = config.get<string>(CONFIG_KEY_SHOW_HIDDEN_FILES);
	quickPickItems.push(new MyQuickPickCommandItem(i18n(MESSAGES[showHiddenFiles ? 'hideHiddenFiles' : 'showHiddenFiles']), '', '', COMMAND_ID_TOGGLE_SHOW_HIDDEN_FILES, directory));

	// ワークスペース、編集中のファイル、ユーザーのディレクトリへそれぞれ移動するコマンド
	addGotoDirectoryItem(quickPickItems, directory, MESSAGES.gotoWorkspaceDir, getWorkspaceDirectory());
	const activeEditorDirectory = ryutils.getActiveEditorDirectory();
	if (activeEditorDirectory)
	{
		addGotoDirectoryItem(quickPickItems, directory, MESSAGES.gotoEditingFileDir, activeEditorDirectory);
	}
	addGotoDirectoryItem(quickPickItems, directory, MESSAGES.gotoUserDir, os.homedir());
	addGotoDirectoryItem(quickPickItems, directory, MESSAGES.backtoBaseDir, getBaseDirectoryFromConfig());

	// このディレクトリをワークスペースとして開くコマンド
	quickPickItems.push(new MyQuickPickOpenAsWorkspaceCommandItem(directory));

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

	const files = listFilesInDirectory(absolutePath);
	if (files.result === FileListStatus.SUCCESS)
	{
		return files.files.map(fileInfo => new MyQuickPickCDModeEntityItem(fileInfo));
	}
	else if (files.result === FileListStatus.NOT_FOUND)
	{
		console.log(`Romly Path Maker: No such directory: ${absolutePath}`);
	}

	return [];
}










/**
 * 隠しファイルの表示設定を切り替える。
 */
function toggleShowHiddenFile(quickPick: vscode.QuickPick<vscode.QuickPickItem>, directory: string)
{
	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
	const currentValue = config.get<boolean>(CONFIG_KEY_SHOW_HIDDEN_FILES);
	config.update(CONFIG_KEY_SHOW_HIDDEN_FILES, !currentValue, vscode.ConfigurationTarget.Global).then(() =>
	{
		// 設定の変更に伴うQuickPick自体の更新
		if (isInCDMode(quickPick))
		{
			quickPick.items = createCDModeQuickPickItems(quickPick);
			quickPick.buttons = createQuickPickButtons(quickPick);
		}
		else
		{
			const files = listFilesAndHandleError(directory);
			if (files)
			{
				quickPick.items = createQuickPickItems(files);
				quickPick.buttons = createQuickPickButtons(quickPick);
			}
		}
	});
}










function toggleGroupDirectories(quickPick: vscode.QuickPick<vscode.QuickPickItem>, directory: string)
{
	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
	config.update(CONFIG_KEY_GROUP_DIRECTORIES, !config.get(CONFIG_KEY_GROUP_DIRECTORIES), vscode.ConfigurationTarget.Global).then(() =>
	{
		// 設定の変更に伴うQuickPick自体の更新
		const files = listFilesAndHandleError(directory);
		if (files)
		{
			quickPick.items = createQuickPickItems(files);
			quickPick.buttons = createQuickPickButtons(quickPick);
		}
	});
}










/**
 * パス直接入力モードかを判定する。タイトルを見てるだけ。
 * @param quickPick
 * @returns
 */
function isInCDMode(quickPick: vscode.QuickPick<vscode.QuickPickItem>): boolean
{
	return quickPick.title === i18n(MESSAGES['inputPathCommand.label']);
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
 * @param directory 表示するディレクトリのフルパス。
 */
export function showFilesInQuickPick(directory: string): void
{
	const files = listFilesAndHandleError(directory);
	if (files.result !== FileListStatus.SUCCESS)
	{
		return;
	}

	// 最後に表示したディレクトリとして設定に保存しておく
	updateSetting(CONFIG_KEY_LAST_DIRECTORY, directory).catch((error) => console.error(error));

	const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();
	quickPick.items = createQuickPickItems(files);
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
		if (e.item instanceof MyQuickPickAcceptableItem)
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
