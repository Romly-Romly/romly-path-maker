// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as os from 'os';

// 自前の言語設定の読み込み
import i18nText from "./i18n";










// 拡張機能の設定のセクション名
const CONFIGURATION_NAME = 'romly-path-maker';

// 設定のキー名。package.json の configuration/properties 内のキー名と一致させる。
const CONFIG_KEY_BASE_DIRECTORY = 'baseDirectory';
const CONFIG_KEY_SHOW_DIRECTORY_ICONS = 'showDirectoryIcons';
const CONFIG_KEY_SHOW_HIDDEN_FILES = 'showHiddenFiles';
const CONFIG_KEY_START_DIRECTORY = 'startDirectory';
const CONFIG_KEY_LAST_DIRECTORY = 'lastDirectory';
const CONFIG_KEY_HIDE_USERNAME = 'hideUserName';
const CONFIG_KEY_DEFAULT_ACTION = 'defaultAction';
const CONFIG_KEY_GROUP_DIRECTORIES = 'groupDirectories';

//　内部で使用しているQuickPickのボタンの識別子。文字列は識別のみなので何でもおけ。
const BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES = 'toggle_show_hidden_files';

// 内部で使用しているクイックピックアイテムの識別子。文字列は識別のみなので何でもおけ。
const COMMAND_ID_SET_BASE_DIRECTORY = 'set_base_directory';
const COMMAND_ID_CLEAR_BASE_DIRECTORY = 'clear_base_directory';
const COMMAND_ID_GOTO_DIR = 'goto_dir';
const COMMAND_ID_TOGGLE_SHOW_HIDDEN_FILES = 'toggle_show_hidden_files';
const COMMAND_ID_OPEN_DIRECTORY_AS_WORKSPACE = 'open_directory_as_workspace';

// 内部で使用しているQuickPickItemそれぞれのボタンの識別子。文字列は識別のみなので何でもおけ。
const BUTTON_ID_REVEAL_IN_FILE_EXPLORER = 'reveal';
const BUTTON_ID_INSERT_PATH_TO_ACTIVE_TERMINAL = 'insert_path_to_active_terminal';
const BUTTON_ID_COPY_PATH = 'copy_path';
const BUTTON_ID_OPEN_IN_EDITOR = 'open_in_editor';

// ディレクトリ移動用の文字。この文字を入力すると移動用のディレクトリ一覧を表示する。
const DIR_NAVIGATION_PREFIX = '/';

// コマンドのラベルに付く前置詞
const COMMAND_LABEL_PREFIX = '> ';










/**
 * 必要な情報を保持できるようにした QuickPickItem。
 *
 * @property {string} id - コマンドの識別子として使う文字列。
 * @property {string} fullPath - このアイテムが示すファイル（またはディレクトリ）の完全なパス。
 * @property {string} insertPath - このアイテムを選択したときに挿入されるパス。
 * @property {MyQuickPickButton[]} buttons - アイテムに関連付けられたカスタムボタンの配列。
 */
interface MyQuickPickItem extends vscode.QuickPickItem
{
	id?: string;
	fullPath?: string;
	insertPath?: string;
	buttons?: MyQuickPickButton[];
}



/**
 * 拡張した QuickInput のボタン。
 * @property id ボタンの識別子として使う文字列。
 */
interface MyQuickInputButton extends vscode.QuickInputButton
{
	id: string;
}



/**
 * 拡張したQuickPickItemのボタン。
 * @property id ボタンの識別子として使う文字列。
 */
interface MyQuickPickButton extends vscode.QuickInputButton
{
	id: string;
}










/**
 * アクティブなエディターで編集しているファイルのパスを取得する。
 * アクティブなエディターが存在しない場合は空文字列を返す。
 * @returns ディレクトリパス。アクティブなエディターがない場合は空文字列。
 */
function getCurrentEditorDirectory(): string
{
	const editor = vscode.window.activeTextEditor;
	if (editor)
	{
		const filePath = editor.document.uri.fsPath;
		return path.dirname(filePath);
	}
	else
	{
		// アクティブエディターが見つからなかった
		return '';
	}
}










/**
 * ワークスペースのディレクトリを取得する
 * @returns {string} ワークスペースディレクトリのパス。ワークスペースが存在しない場合は空の文字列を返す。
 */
function getWorkspaceDirectory(): string
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
 * 表示する最初のディレクトリを取得する。
 * 優先順にワークスペースのディレクトリ → エディタのディレクトリ → ユーザーディレクトリ。
 */
function getStartDirectory(): string
{
	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
	const startDirectory = <string>config.get(CONFIG_KEY_START_DIRECTORY);

	// 共通のフォールバックディレクトリ
	const fallbackDir = os.homedir();

	if (startDirectory === 'Last')
	{
		// ディレクトリが存在するか確認
		const lastDirectory = <string>config.get(CONFIG_KEY_LAST_DIRECTORY);
		if (fs.existsSync(lastDirectory))
		{
			return lastDirectory;
		}
		else
		{
			return getWorkspaceDirectory() || getCurrentEditorDirectory() || fallbackDir;
		}
	}
	else if (startDirectory === 'Workspace')
	{
		return getWorkspaceDirectory() || getCurrentEditorDirectory() || fallbackDir;
	}
	else if (startDirectory === 'Editor')
	{
		return getCurrentEditorDirectory() || fallbackDir;
	}
	else
	{
		return fallbackDir;
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
 * ディレクトリ名をQuickPickItemのラベルとして表示する時の文字列に変換する。
 * @param directory ディレクトリ名
 * @returns QuickPickItemのラベルとして表示する文字列。
 */
function createDirectoryLabel(directory: string): string
{
	return path.sep + maskUserNameDirectory(directory);
}










/**
 * ファイル用のQuickPickItemを生成する。
 *
 * @param {string} currentPath - 現在のディレクトリパス
 * @param {string} directory - QuickPickItemを生成するディレクトリのパス
 * @param {boolean} asCurrentDirDot - trueの場合、カレントディレクトリを示すアイテム(.)として生成。
 * @param {string} filename - 対象のファイル名
 * @returns {MyQuickPickItem} ファイルのQuickPickアイテム
 */
function createQuickPickItemForFile(currentPath: string, directory: string, asCurrentDirDot: boolean, filename?: string): MyQuickPickItem
{
	const fullPath = asCurrentDirDot ? directory : path.join(directory, filename!);
	const relativePath = getRelativeOrAbsolutePath(currentPath, fullPath);

	// このアイテムを選択したときに実際に挿入される文字列
	const insertPath = `'${relativePath}'`;

	const description = maskUserNameDirectory(asCurrentDirDot ?
		relativePath :
		(insertPath === filename ? '' : insertPath));

	const item = {} as MyQuickPickItem;
	item.label = asCurrentDirDot ? '.' : filename!;
	item.description = description;
	item.fullPath = fullPath;
	item.insertPath = insertPath;
	item.buttons = [];
	item.buttons.push({ iconPath: new vscode.ThemeIcon('copy'), tooltip: i18nText('copyPathToClipboard'), id: BUTTON_ID_COPY_PATH });
	if (!asCurrentDirDot)
	{
		item.buttons.push({ iconPath: new vscode.ThemeIcon('edit'), tooltip: i18nText('openInEditor'), id: BUTTON_ID_OPEN_IN_EDITOR });
	}
	item.buttons.push({ iconPath: new vscode.ThemeIcon('terminal'), tooltip: i18nText('insertPathToActiveTerminal'), id: BUTTON_ID_INSERT_PATH_TO_ACTIVE_TERMINAL });
	return item;
}










/**
 * ディレクトリ用のQuickPickItemを生成する。
 *
 * @param {string} baseDir - 基準となる現在のパス。
 * @param {string} fullPath - アイテムに対応するディレクトリの完全なパス。
 * @param {boolean} isParent - 親ディレクトリのアイテムかどうか。
 * @returns {MyQuickPickItem} 作成されたQuickPickアイテム。
 */
function createQuickPickItemForDirectory(baseDir: string, fullPath: string, isParent: boolean): MyQuickPickItem
{
	// このアイテムを選択したときに実際に挿入されるパス
	const relativePath = getRelativeOrAbsolutePath(baseDir, fullPath);

	// ディレクトリ名部分のみ
	const dirName = isParent ? '..' : path.basename(fullPath);

	// このアイテムを選択したときに実際に挿入される文字列
	const insertPath = `'${relativePath}'`;

	// ディレクトリアイコンを表示する？
	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
	const showIcons = config.get(CONFIG_KEY_SHOW_DIRECTORY_ICONS) as boolean;

	const item = {} as MyQuickPickItem;
	item.label = createDirectoryLabel(dirName);
	item.description = insertPath === dirName ? '' : maskUserNameDirectory(insertPath);
	item.fullPath = fullPath;
	item.insertPath = insertPath;
	item.id = COMMAND_ID_GOTO_DIR;
	item.buttons = [
		{ iconPath: new vscode.ThemeIcon('copy'), tooltip: i18nText('copyPathToClipboard'), id: BUTTON_ID_COPY_PATH },
		{ iconPath: new vscode.ThemeIcon('terminal'), tooltip: i18nText('insertPathToActiveTerminal'), id: BUTTON_ID_INSERT_PATH_TO_ACTIVE_TERMINAL },
		{ iconPath: new vscode.ThemeIcon('folder-opened'), tooltip: i18nText('revealInFileExplorer'), id: BUTTON_ID_REVEAL_IN_FILE_EXPLORER },
	];
	if (showIcons)
	{
		item.iconPath = new vscode.ThemeIcon('folder');
	}
	return item;
}










/**
 * 指定されたディレクトリへの移動コマンド情報をquickPickItemsに追加する。
 *
 * @param items - 追加先。
 * @param directory - 現在のディレクトリ。
 * @param labelKey - アイテムのラベルの文字列リソースのキー。
 * @param targetDir - 移動先のディレクトリ。
 */
function addGotoDirectoryItem(items: MyQuickPickItem[], directory: string, labelKey: string, targetDir: string): void
{
	if (targetDir !== '' && targetDir !== directory)
	{
		items.push({ id: COMMAND_ID_GOTO_DIR, label: COMMAND_LABEL_PREFIX + i18nText(labelKey), detail: maskUserNameDirectory(targetDir), fullPath: targetDir });
	}
}










function createQuickPickItems(directory: string): MyQuickPickItem[]
{
	const quickPickItems: MyQuickPickItem[] = [];
	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);

	const baseDir = config.get<string>(CONFIG_KEY_BASE_DIRECTORY) || '';

	// ディレクトリとファイルを分ける？
	const groupDirectories = config.get(CONFIG_KEY_GROUP_DIRECTORIES) as boolean;

	// 隠しファイルを表示する？
	const showHiddenFiles = config.get(CONFIG_KEY_SHOW_HIDDEN_FILES) as boolean;

	try
	{
		const files = fs.readdirSync(directory);

		if (groupDirectories)
		{
			// ディレクトリとファイルのリストに分ける
			const dirList: string[] = [];
			const fileList: string[] = [];
			files.forEach((filename) =>
			{
				// 隠しファイルを省く
				if (!showHiddenFiles && filename.startsWith('.'))
				{
					return;
				}

				// ファイル情報が取得できなかったもの（エラー発生）は省く
				try
				{
					const stat = fs.statSync(path.join(directory, filename));
					if (stat.isDirectory())
					{
						dirList.push(filename);
					}
					else
					{
						fileList.push(filename);
					}
				}
				catch (err)
				{
				}
			});

			// まずディレクトリ
			quickPickItems.push({ label: i18nText('directories'), kind: vscode.QuickPickItemKind.Separator });
			quickPickItems.push(createQuickPickItemForDirectory(baseDir, path.dirname(directory), true));
			quickPickItems.push(...dirList.map((filename) =>
			{
				return createQuickPickItemForDirectory(baseDir, path.join(directory, filename), false);
			}));

			// 次にファイル
			quickPickItems.push({ label: i18nText('files'), kind: vscode.QuickPickItemKind.Separator });
			quickPickItems.push(createQuickPickItemForFile(baseDir, directory, true));
			quickPickItems.push(...fileList.map((filename) =>
			{
				return createQuickPickItemForFile(baseDir, directory, false, filename);
			}));
		}
		else
		{
			// 親ディレクトリへ移動するためのアイテム
			quickPickItems.push(createQuickPickItemForDirectory(baseDir, path.dirname(directory), true));

			// カレントディレクトリを選択するためのアイテム
			quickPickItems.push(createQuickPickItemForFile(baseDir, directory, true));

			files.forEach((filename) =>
			{
				// 隠しファイルを省く
				if (!showHiddenFiles && filename.startsWith('.'))
				{
					return;
				}

				// ファイル情報が取得できなかったもの（エラー発生）は省く
				try
				{
					const stat = fs.statSync(path.join(directory, filename));
					if (stat.isDirectory())
					{
						quickPickItems.push(createQuickPickItemForDirectory(baseDir, path.join(directory, filename), false));
					}
					else
					{
						quickPickItems.push(createQuickPickItemForFile(baseDir, directory, false, filename));
					}
				}
				catch (err)
				{
				}
			});
		}

		quickPickItems.push({ label: i18nText('commands'), kind: vscode.QuickPickItemKind.Separator });

		// ------------------------------------------------------------
		// その他コマンドを追加

		// 基準ディレクトリを設定するコマンド
		if (baseDir !== directory)
		{
			quickPickItems.push({ id: COMMAND_ID_SET_BASE_DIRECTORY, label: COMMAND_LABEL_PREFIX + i18nText('command.setBaseDirectory'), detail: maskUserNameDirectory(directory), buttons: [] });
		}

		// 基準ディレクトリをクリアするコマンド
		if (baseDir !== '')
		{
			quickPickItems.push({ id: COMMAND_ID_CLEAR_BASE_DIRECTORY, label: COMMAND_LABEL_PREFIX + i18nText('command.clearBaseDirectory') });
		}

		// 隠しファイルの表示を切り替えるコマンド
		quickPickItems.push({ id: COMMAND_ID_TOGGLE_SHOW_HIDDEN_FILES, label: COMMAND_LABEL_PREFIX + i18nText(showHiddenFiles ? 'hideHiddenFiles' : 'showHiddenFiles') });

		// ワークスペースのディレクトリへ移動するコマンド
		addGotoDirectoryItem(quickPickItems, directory, 'gotoWorkspaceDir', getWorkspaceDirectory());

		// 編集中のファイルのディレクトリへ移動するコマンド
		addGotoDirectoryItem(quickPickItems, directory, 'gotoEditingFileDir', getCurrentEditorDirectory());

		// ユーザーのディレクトリへ移動するコマンド
		addGotoDirectoryItem(quickPickItems, directory, 'gotoUserDir', os.homedir());

		// このディレクトリをワークスペースとして開くコマンド
		quickPickItems.push({ id: COMMAND_ID_OPEN_DIRECTORY_AS_WORKSPACE, label: COMMAND_LABEL_PREFIX + i18nText('openDirectoryAsWorkspace'), fullPath: directory });
	}
	catch (err)
	{
		// readdirSyncのエラー
		vscode.window.showErrorMessage(i18nText('error.couldntRetrieveFiles') + `: ${err}`);
	}

	return quickPickItems;
}










/**
 * ナビゲーション用のQuickPickアイテムの一覧を生成する。
 *
 * @param {string} directory - QuickPickアイテムを生成するディレクトリのパス
 * @returns {MyQuickPickItem[]} ナビゲーション用のQuickPickアイテムの配列
 */
function createQuickPickItemsForNavigation(directory: string): MyQuickPickItem[]
{
	const quickPickItems: MyQuickPickItem[] = [];

	try
	{
		const files = fs.readdirSync(directory);

		// ディレクトリとファイルのリストに分ける
		const dirList: string[] = [];
		const fileList: string[] = [];
		files.forEach((filename) =>
		{
			// ファイル情報が取得できなかったもの（エラー発生）は省く
			try
			{
				const stat = fs.statSync(path.join(directory, filename));
				if (stat.isDirectory())
				{
					dirList.push(filename);
				}
				else
				{
					fileList.push(filename);
				}
			}
			catch (err)
			{
			}
		});

		// ----------------------------------------
		// まずナビゲーション用のディレクトリ一覧を追加。これらは選択するとディレクトリを移動。
		quickPickItems.push({ label: 'Navigation', kind: vscode.QuickPickItemKind.Separator });
		quickPickItems.push({ label: DIR_NAVIGATION_PREFIX + '..', description: 'Go to parent directory', id: COMMAND_ID_GOTO_DIR, buttons: [] });
		quickPickItems.push(...dirList.map((filename) => { return { label: DIR_NAVIGATION_PREFIX + filename, description: 'Go to ' + filename, id: COMMAND_ID_GOTO_DIR, buttons: [] }; }));
	}
	catch (err)
	{
		// readdirSyncのエラー
		vscode.window.showErrorMessage(`ファイル一覧を取得できませんでした: ${err}`);
	}

	return quickPickItems;
}










/**
 * 指定されたパスのディレクトリをOSのファイルマネージャで開く。
 * @param path - 開きたいディレクトリのパス。
 */
function openDirectory(path: string): void
{
	// OSに応じたコマンドを実行
	if (process.platform === 'darwin')
	{
		// Macの場合、Finderでディレクトリを開く
		exec(`open "${path}"`);
	}
	else if (process.platform === 'win32')
	{
		// Windowsの場合、Explorerでディレクトリを開く
		exec(`explorer "${path}"`);
	}
	else if (process.platform === 'linux')
	{
		// Linuxの場合、nautilusでディレクトリを開く（デフォルトのファイルマネージャを使用）
		exec(`nautilus "${path}"`);
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
		vscode.window.showErrorMessage(i18nText('couldNotOpenFile') + `: ${error}`);
	}
}










/**
 * 文字列をクリップボードにコピーする。
 * @param text コピーする文字列。
 */
function copyTextToClipboard(text: string): void
{
	vscode.env.clipboard.writeText(text);
}










/**
 * 文字列をアクティブなターミナルに挿入する。
 * @param text 挿入する文字列。
 */
function sendTextToTerminal(text: string)
{
	if (text && vscode.window.activeTerminal)
	{
		vscode.window.activeTerminal.sendText(`${text}`, false);
	}
}










/**
 * 隠しファイルの表示設定を切り替える。
 */
async function toggleShowHiddenFile(quickPick: vscode.QuickPick<MyQuickPickItem>, directory: string)
{
	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
	await config.update(CONFIG_KEY_SHOW_HIDDEN_FILES, !config.get(CONFIG_KEY_SHOW_HIDDEN_FILES));

	// 設定の変更に伴うQuickPick自体の更新
	quickPick.items = createQuickPickItems(directory);
	quickPick.buttons = createQuickPickButtons();
}










/**
 * QuickPick （全体）に表示するボタンのリストを作成する。
 * @returns
 */
function createQuickPickButtons(): MyQuickPickButton[]
{
	const result = [] as MyQuickPickButton[];

	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
	const showHiddenFiles = config.get(CONFIG_KEY_SHOW_HIDDEN_FILES);
	if (showHiddenFiles)
	{
		result.push({ id: BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES, iconPath: new vscode.ThemeIcon('eye'), tooltip: i18nText('hideHiddenFiles') });
	}
	else
	{
		result.push({ id: BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES, iconPath: new vscode.ThemeIcon('eye-closed'), tooltip: i18nText('showHiddenFiles') });
	}

	return result;
}










/**
 * QuickPick のプレースホルダーに表示するテキストを返す。基準ディレクトリを表示。
 * @returns
 */
function getPlaceholderText(): string
{
	const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
	const baseDirectory = config.get<string>(CONFIG_KEY_BASE_DIRECTORY) ?? '';
	return i18nText('baseDirectory', { dir: maskUserNameDirectory(baseDirectory) });
}










/**
 * QuickPick のアイテムが選択された時の処理。
 * @param quickPick
 * @param item
 * @param directory
 */
async function onItemSelected(quickPick: vscode.QuickPick<MyQuickPickItem>, item: MyQuickPickItem, directory: string)
{
	if (item.id === COMMAND_ID_SET_BASE_DIRECTORY || item.id === COMMAND_ID_CLEAR_BASE_DIRECTORY)
	{
		// ベースディレクトリとして設定
		const newBaseDirectory = item.id === COMMAND_ID_SET_BASE_DIRECTORY ? directory : '';
		try
		{
			const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
			await config.update(CONFIG_KEY_BASE_DIRECTORY, newBaseDirectory, vscode.ConfigurationTarget.Workspace);
			vscode.window.showInformationMessage(i18nText('baseDirectoryUpdated', { dir: maskUserNameDirectory(newBaseDirectory) }));

			// 基準ディレクトリの変更に伴ってアイテムを更新
			quickPick.items = createQuickPickItems(directory);
			quickPick.placeholder = getPlaceholderText();
		}
		catch (error)
		{
			vscode.window.showErrorMessage(i18nText('error.couldntSetBaseDirectory') + `: ${error}`);
		}
	}
	else if (item.id === COMMAND_ID_GOTO_DIR)
	{
		// そのディレクトリへ移動
		if (item.fullPath)
		{
			showFilesInQuickPick(item.fullPath);
		}
	}
	else if (item.id === COMMAND_ID_TOGGLE_SHOW_HIDDEN_FILES)
	{
		// 隠しファイルの表示設定を切り替える
		toggleShowHiddenFile(quickPick, directory);
	}
	else if (item.id === COMMAND_ID_OPEN_DIRECTORY_AS_WORKSPACE)
	{
		// Codeでディレクトリを開く
		if (item.fullPath)
		{
			// trueにすることで新しいウィンドウで開く
			vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(item.fullPath), true);
		}
	}
	else
	{
		// ディフォルトのアクションを実行
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		const defaultAction = config.get(CONFIG_KEY_DEFAULT_ACTION) as string;
		switch (defaultAction)
		{
			case 'Open':
				if (item.fullPath)
				{
					openFileInEdtor(item.fullPath);
				}
				break;
			case 'Copy':
				if (item.insertPath)
				{
					copyTextToClipboard(item.insertPath);
				}
				break;
			case 'Terminal':
				if (item.insertPath)
				{
					sendTextToTerminal(item.insertPath);
				}
				break;
			case 'Reveal':
				if (item.fullPath)
				{
					openDirectory(path.dirname(item.fullPath));
				}
				break;
		}
		quickPick.hide();
	}
}










/**
 * ワークスペースのスコープに設定を書き込む。ワークスペースが見つからなかった場合にはグローバルスコープに書き込む。
 *
 * @param key - 設定のキー。
 * @param value - 設定する値。
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
 * 指定されたディレクトリ内のファイル一覧を QuickPick で表示する。
 * @param directory
 * @returns
 */
async function showFilesInQuickPick(directory: string)
{
	const quickPickItems = createQuickPickItems(directory);
	if (quickPickItems.length === 0)
	{
		return;
	}

	// 最後に表示したディレクトリとして設定に保存しておく
	updateSetting(CONFIG_KEY_LAST_DIRECTORY, directory).catch((error) => console.error(error));

	const quickPick = vscode.window.createQuickPick<MyQuickPickItem>();
	quickPick.items = quickPickItems;
	quickPick.title = maskUserNameDirectory(directory);
	quickPick.buttons = createQuickPickButtons();
	quickPick.placeholder = getPlaceholderText();



	// QuickPick のボタン押下時の処理
	quickPick.onDidTriggerButton((button) =>
	{
		const buttonId = (button as MyQuickPickButton).id;
		if (buttonId === BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES)
		{
			// 隠しファイルの表示設定を切り替える
			toggleShowHiddenFile(quickPick, directory);
		}
	});

	// 個々のアイテムのボタン押下時の処理
	quickPick.onDidTriggerItemButton(async (e) =>
	{
		const button = e.button as MyQuickPickButton;
		if (button.id === BUTTON_ID_REVEAL_IN_FILE_EXPLORER && e.item.fullPath)
		{
			// ディレクトリを開く
			openDirectory(e.item.fullPath);
		}
		else if (button.id === BUTTON_ID_OPEN_IN_EDITOR && e.item.fullPath)
		{
			// エディタで開く
			openFileInEdtor(e.item.fullPath);
		}
		else if (button.id === BUTTON_ID_INSERT_PATH_TO_ACTIVE_TERMINAL && e.item.insertPath)
		{
			// ターミナルにパスを挿入
			if (vscode.window.activeTerminal)
			{
				vscode.window.activeTerminal.sendText(`${e.item.insertPath}`, false);
			}
		}
		else if (button.id === BUTTON_ID_COPY_PATH && e.item.insertPath)
		{
			// クリップボードにパスをコピー
			copyTextToClipboard(e.item.insertPath);
		}
	});

	// 選択時の処理
	quickPick.onDidAccept(() =>
	{
		const selection = quickPick.selectedItems[0];
		if (selection)
		{
			onItemSelected(quickPick, selection, directory);
		}
	});

	quickPick.onDidChangeValue(() =>
	{
		const value = quickPick.value;

		// ナビゲーション用の文字を入力したら移動用のディレクトリ一覧を表示
		if (value === DIR_NAVIGATION_PREFIX)
		{
			quickPick.items = createQuickPickItemsForNavigation(directory);
		}
		else if (value === '')
		{
			quickPick.items = createQuickPickItems(directory);
		}
	});

	quickPick.show();
}










// このメソッドは拡張機能が有効化されたときに呼び出される
// コマンドが初めて実行されたときに拡張機能が有効化される
export function activate(context: vscode.ExtensionContext)
{
	// コマンドは package.json ファイルで定義されている
	// 次に、 registerCommand を使用してコマンドの実装を提供する
	// commandId パラメータは package.json の command フィールドと一致する必要がある
	let disposable = vscode.commands.registerCommand('romly-path-maker.show', () =>
	{
		showFilesInQuickPick(getStartDirectory());
	});

	context.subscriptions.push(disposable);
}

// このメソッドは拡張機能が無効化されたときに呼び出される
export function deactivate() {}
