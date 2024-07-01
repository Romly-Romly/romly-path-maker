import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import * as ryutils from './ryutils';

// 自前の国際化文字列リソースの読み込み
import { COMMON_TEXTS, i18n, i18nPlural, I18NText } from "./i18n";
import { MESSAGES } from "./i18nTexts";










// 拡張機能の設定のセクション名
export const CONFIGURATION_NAME = 'romly-path-maker';

// 設定のキー名。package.json の configuration/properties 内のキー名と一致させる。
const CONFIG_KEY_GROUP_DIRECTORIES = 'groupDirectories';
const CONFIG_KEY_SHOW_HIDDEN_FILES = 'showHiddenFiles';
const CONFIG_KEY_HIDE_USERNAME = 'hideUserName';
const CONFIG_KEY_BASE_DIRECTORY = 'baseDirectory';
const CONFIG_KEY_SHOW_DIRECTORY_ICONS = 'showDirectoryIcons';
export const CONFIG_KEY_LAST_DIRECTORY = 'lastDirectory';
const CONFIG_KEY_DEFAULT_ACTION = 'defaultAction';
const CONFIG_KEY_PIN_LIST = 'pinnedList';
const CONFIG_KEY_FAVORITE_LIST = 'favoriteList';

//　内部で使用しているQuickPickのボタンの識別子。文字列は識別のみなので何でもおけ。
const BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES = 'toggle_show_hidden_files';
const BUTTON_ID_TOGGLE_GROUP_DIRECTORIES = 'toggle_group_directories';

// コマンドのラベルに付く前置詞
const COMMAND_LABEL_PREFIX = '> ';

const EXTENSION_NAME_FOR_ERROR = 'Romly: Path-Maker';










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
 * 指定されたパス文字列からユーザー名を設定に応じて隠す。
 * 隠す場合は '<username>' に置き換える。
 *
 * @param pathString - マスクを適用するパス文字列。
 * @returns ユーザー名がマスクされたパス、または元のパス文字列。
 */
export function maskUserNameDirectory(pathString: string): string
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

	// 設定を更新
	await vscode.workspace.getConfiguration(CONFIGURATION_NAME).update(key, value, targetScope);
}










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
 * ファイルのパスから MyFileInfo を作成する。ファイル情報を取得したりファイルかディレクトリかを調べたりする。
 * @param fullPath ファイル／ディレクトリのフルパス。
 * @param filterHiddenFiles
 * @returns ファイル情報が取得できなかったり、filterHiddenFiles が true で名前が.で始まる場合は undefined を返す。
 */
function filePathToFileInfo(fullPath: string, filterHiddenFiles: boolean): MyFileInfo | undefined
{
	// 見付からないファイルは省く
	if (!fs.existsSync(fullPath))
	{
		return undefined;
	}

	// ファイル情報が取得できなかったもの（エラー発生）は省く
	try
	{
		const stat = fs.statSync(fullPath);
		if (!filterHiddenFiles || !path.basename(fullPath).startsWith('.'))
		{
			return new MyFileInfo(fullPath, stat.isDirectory());
		}
	}
	catch (err)
	{
		console.error(`Romly Path Maker: statSync failed for: ${fullPath}`, err);
		return undefined;
	}
}










function filePathListToFileInfoList(filePathList: string[]): MyFileInfo[]
{
	const result: MyFileInfo[] = [];
	filePathList.forEach(listPath =>
	{
		const info = filePathToFileInfo(listPath, false);
		if (info)
		{
			result.push(info);
		}
	});
	return result;
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
			const fullPath = path.join(directory, filename);

			// ファイル情報が取得できなかったもの（エラー発生）は省く
			const info = filePathToFileInfo(fullPath, filterHiddenFiles);
			if (info)
			{
				result.push(info);
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
			ryutils.showErrorMessageWithDetailChannel(msg, EXTENSION_NAME_FOR_ERROR, debugErrorMessage, e);
		}
		else
		{
			vscode.window.showErrorMessage(msg);
		}
	}

	return listFiles;
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









abstract class MyQuickPickBase
{
	protected readonly _theQuickPick: vscode.QuickPick<vscode.QuickPickItem>;

	constructor()
	{
		this._theQuickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();

		// QuickPick のボタン押下時の処理
		this._theQuickPick.onDidTriggerButton((button) =>
		{
			const buttonId = (button as ryutils.RyQuickPickButton).id;
			if (buttonId === BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES)
			{
				// 隠しファイルの表示設定を切り替える
				this.showHiddenFiles = !this.showHiddenFiles;
			}
			else if (buttonId === BUTTON_ID_TOGGLE_GROUP_DIRECTORIES)
			{
				// ディレクトリのグループ表示設定を切り替える
				this.toggleGroupDirectories();
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
		if (selection && selection instanceof MyQuickPickAcceptableItem2)
		{
			selection.didAccept();
		}
	}

	private onItemButtonClick(e: vscode.QuickPickItemButtonEvent<vscode.QuickPickItem>): void
	{
		if (e.item instanceof MyQuickPickAcceptableItem2)
		{
			const button = e.button as ryutils.RyQuickPickButton;
			e.item.onButtonClick(button);
		}
	}

	private toggleGroupDirectories()
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		config.update(CONFIG_KEY_GROUP_DIRECTORIES, !config.get(CONFIG_KEY_GROUP_DIRECTORIES), vscode.ConfigurationTarget.Global).then(() =>
		{
			// 設定の変更に伴うQuickPick自体の更新
			this.updateList();
		});
	}

	protected createToggleGroupDirectoriesButton(): ryutils.RyQuickPickButton
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		const groupDirectories = config.get(CONFIG_KEY_GROUP_DIRECTORIES) as boolean;
		return groupDirectories ?
			{ id: BUTTON_ID_TOGGLE_GROUP_DIRECTORIES, iconPath: new vscode.ThemeIcon('folder'), tooltip: i18n(MESSAGES['tooltip.ungroupDirectories']) } :
			{ id: BUTTON_ID_TOGGLE_GROUP_DIRECTORIES, iconPath: new vscode.ThemeIcon('folder-library'), tooltip: i18n(MESSAGES['tooltip.groupDirectories']) };
	}

	protected createShowHiddenFilesButton(): ryutils.RyQuickPickButton
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		const showHiddenFiles = config.get(CONFIG_KEY_SHOW_HIDDEN_FILES);
		return showHiddenFiles ?
			{ id: BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES, iconPath: new vscode.ThemeIcon('eye'), tooltip: i18n(MESSAGES['tooltip.hideHiddenFiles']) } :
			{ id: BUTTON_ID_TOGGLE_SHOW_HIDDEN_FILES, iconPath: new vscode.ThemeIcon('eye-closed'), tooltip: i18n(MESSAGES['tooltip.showHiddenFiles']) };
	}

	public hide(): void
	{
		this._theQuickPick.hide();
	}

	public dispose(): void
	{
		this._theQuickPick.dispose();
	}

	public abstract updateList(): void;

	get showHiddenFiles(): boolean
	{
		return vscode.workspace.getConfiguration(CONFIGURATION_NAME).get<boolean>(CONFIG_KEY_SHOW_HIDDEN_FILES) ?? false;
	}

	set showHiddenFiles(value: boolean)
	{
		vscode.workspace.getConfiguration(CONFIGURATION_NAME).update(CONFIG_KEY_SHOW_HIDDEN_FILES, value, vscode.ConfigurationTarget.Global).then(() =>
		{
			// 設定の変更に伴うQuickPick自体の更新
			this.updateList();
		});
	}
}

/**
 * vscode の this._theQuickPick をラッパーしてこの拡張機能用に使いやすくしたクラス。
 * 2024/06/30
 */
export class MyQuickPick extends MyQuickPickBase
{
	// 現在表示しているディレクトリ
	private readonly _directory: string;

	private constructor(files: ListFilesResult, directory: string)
	{
		super();
		this._directory = directory;

		this._theQuickPick.items = this.createQuickPickItems(files);
		this._theQuickPick.title = maskUserNameDirectory(this._directory);
		this._theQuickPick.buttons = this.createQuickPickButtons();
		this._theQuickPick.placeholder = `${i18n(MESSAGES.baseDirectory)}: ${maskUserNameDirectory(getBaseDirectoryFromConfig())}`;
		this._theQuickPick.show();
	}

	static createMyQuickPick(directory: string): MyQuickPick | undefined
	{
		const files = listFilesAndHandleError(directory);
		if (files.result !== FileListStatus.SUCCESS)
		{
			return undefined;
		}

		// 最後に表示したディレクトリとして設定に保存しておく
		updateSetting(CONFIG_KEY_LAST_DIRECTORY, directory).catch((error) => console.error(error));

		return new MyQuickPick(files, directory);
	}

	get fullPath(): string
	{
		return this._directory;
	}

	/**
	 * 指定されたディレクトリへの移動コマンド情報を quickPickItems に追加する。
	 *
	 * @param items 追加先。
	 * @param directory 現在のディレクトリ。
	 * @param labelKey アイテムのラベルの文字列リソースのキー。
	 * @param targetDir 移動先のディレクトリ。
	 */
	private addGotoDirectoryItem(items: vscode.QuickPickItem[], directory: string, label: I18NText, targetDir: string): void
	{
		if (targetDir !== '' && targetDir !== directory)
		{
			items.push(new MyQuickPickGotoDirItem(this, i18n(label), targetDir));
		}
	}

	/**
	 * QuickPick に表示するアイテムのリストを作成する。
	 * @param directory
	 * @returns
	 */
	private createQuickPickItems(listFilesResult: ListFilesResult): vscode.QuickPickItem[]
	{
		// ディレクトリとファイルを分ける？
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		const groupDirectories = config.get<boolean>(CONFIG_KEY_GROUP_DIRECTORIES);

		const directory = listFilesResult.path;
		const files = listFilesResult.files;
		const baseDir = getBaseDirectoryFromConfig();

		const quickPickItems: vscode.QuickPickItem[] = [];
		const dirOnly = files.filter(fileInfo => fileInfo.isDirectory);
		const fileOnly = files.filter(fileInfo => !fileInfo.isDirectory);
		if (groupDirectories)
		{
			// まずディレクトリ
			quickPickItems.push({ label: i18nPlural(COMMON_TEXTS.directories, dirOnly.length), kind: vscode.QuickPickItemKind.Separator });
			// 先に親ディレクトリへ移動するためのアイテム
			quickPickItems.push(new MyQuickPickDirectoryItem(this, new MyFileInfo(path.dirname(directory), true), true, baseDir));
			dirOnly.forEach((fileInfo) =>
			{
				quickPickItems.push(new MyQuickPickDirectoryItem(this, fileInfo, false, baseDir));
			});

			// 次にファイル
			quickPickItems.push({ label: i18nPlural(COMMON_TEXTS.files, fileOnly.length), kind: vscode.QuickPickItemKind.Separator });
			quickPickItems.push(new MyQuickPickFileItem(this, new MyFileInfo(directory, false), true, baseDir));
			fileOnly.forEach((fileInfo) =>
			{
				quickPickItems.push(new MyQuickPickFileItem(this, fileInfo, false, baseDir));
			});
		}
		else
		{
			// 親ディレクトリへ移動するためのアイテム
			quickPickItems.push(new MyQuickPickDirectoryItem(this, new MyFileInfo(path.dirname(directory), true), true, baseDir));

			// カレントディレクトリを選択するためのアイテム
			quickPickItems.push(new MyQuickPickFileItem(this, new MyFileInfo(directory, false), true, baseDir));

			// ファイルの数を表示
			quickPickItems.push({ label: i18nPlural(COMMON_TEXTS.directories, dirOnly.length) + ' / ' + i18nPlural(COMMON_TEXTS.files, fileOnly.length), kind: vscode.QuickPickItemKind.Separator });

			files.forEach((fileInfo) =>
			{
				if (fileInfo.isDirectory)
				{
					quickPickItems.push(new MyQuickPickDirectoryItem(this, fileInfo, false, baseDir));
				}
				else
				{
					quickPickItems.push(new MyQuickPickFileItem(this, fileInfo, false, baseDir));
				}
			});
		}

		// ------------------------------------------------------------
		// ピン留めされているアイテムを追加

		const pinList = config.get<string[]>(CONFIG_KEY_PIN_LIST) ?? [];
		if (pinList.length > 0)
		{
			// まず存在するファイル／ディレクトリのみに絞り込む
			const fileInfos = filePathListToFileInfoList(pinList);
			if (fileInfos.length > 0)
			{
				quickPickItems.push({ label: i18n(MESSAGES.quickAccesses), kind: vscode.QuickPickItemKind.Separator });
				fileInfos.forEach((info) =>
				{
					if (info.isDirectory)
					{
						quickPickItems.push(new MyQuickPickDirectoryItem(this, info, false, baseDir));
					}
					else
					{
						quickPickItems.push(new MyQuickPickFileItem(this, info, false, baseDir));
					}
				});
			}
		}

		// ------------------------------------------------------------
		// その他コマンドを追加

		quickPickItems.push({ label: i18n(MESSAGES.commands), kind: vscode.QuickPickItemKind.Separator });

		// 基準ディレクトリを設定するコマンド。表示しているのが基準ディレクトリの場合は追加しない。
		if (baseDir !== directory)
		{
			quickPickItems.push(new MyQuickPickSetBaseDirectoryItem(this, directory));
		}

		// 基準ディレクトリをクリアするコマンド。すでに基準ディレクトリが空なら追加しない。
		if (baseDir !== '')
		{
			quickPickItems.push(new MyQuickPickSetBaseDirectoryItem(this, ''));
		}

		// パスを入力して移動するコマンド
		quickPickItems.push(new MyQuickPickInputPathItem(this));

		// 隠しファイルの表示を切り替えるコマンド
		quickPickItems.push(new MyQuickPickToggleShowHiddenFilesItem(this));

		// ワークスペース、編集中のファイル、ユーザーのディレクトリへそれぞれ移動するコマンド
		this.addGotoDirectoryItem(quickPickItems, directory, MESSAGES.gotoWorkspaceDir, ryutils.getWorkspaceDirectory());
		const activeEditorDirectory = ryutils.getActiveEditorDirectory();
		if (activeEditorDirectory)
		{
			this.addGotoDirectoryItem(quickPickItems, directory, MESSAGES.gotoEditingFileDir, activeEditorDirectory);
		}
		this.addGotoDirectoryItem(quickPickItems, directory, MESSAGES.gotoUserDir, os.homedir());
		this.addGotoDirectoryItem(quickPickItems, directory, MESSAGES.backtoBaseDir, getBaseDirectoryFromConfig());

		// その他コマンド
		quickPickItems.push(new MyQuickPickOpenAsWorkspaceCommandItem(this, directory));
		quickPickItems.push(new MyQuickPickRevealInExprolerItem(this, directory));

		return quickPickItems;
	}

	/**
	 * this._theQuickPick （全体）に表示するボタンのリストを作成する。
	 * @returns
	 */
	private createQuickPickButtons(): ryutils.RyQuickPickButton[]
	{
		const result: ryutils.RyQuickPickButton[] = [];

		// ディレクトリとファイルを分けて表示する設定の切り替えボタン
		result.push(this.createToggleGroupDirectoriesButton());

		// 隠しファイルの表示設定ボタン
		result.push(this.createShowHiddenFilesButton());

		return result;
	}

	/**
	 * 表示されているファイルとディレクトリのリストを更新する。
	 * 表示設定やお気に入り、ピン留めに変化があったときに必要な処理。
	 */
	public override updateList(): void
	{
		const files = listFilesAndHandleError(this._directory);
		if (files)
		{
			this._theQuickPick.items = this.createQuickPickItems(files);
			this._theQuickPick.buttons = this.createQuickPickButtons();
		}
	}
}










export abstract class MyQuickPickAcceptableItem2 implements vscode.QuickPickItem
{
	label: string;
	description: string;
	detail: string | undefined = undefined;
	alwaysShow: boolean = false;
	buttons: ryutils.RyQuickPickButton[];

	// 自身が所属する QuickPick への参照を持つ
	_ownerQuickPick: MyQuickPickBase;

	constructor(aQuickPick: MyQuickPickBase)
	{
		this.label = '';
		this.description = '';
		this.buttons = [];
		this._ownerQuickPick = aQuickPick;
	}

	protected get ownerQuickPick(): MyQuickPickBase
	{
		return this._ownerQuickPick;
	}

	/**
	 * QuickPickItem が選択されたときに呼び出される。
	 */
	public didAccept(): void
	{
	}

	onButtonClick(button: ryutils.RyQuickPickButton): void
	{
	}
}










/**
 * ファイルまたはディレクトリを示す QuickPickItem の継承元。
 * この時点で「お気に入りに登録」「ピン留め」ボタンがあるよ。
 */
abstract class MyQuickPickFileSystemEntityItem extends MyQuickPickAcceptableItem2
{
	// ボタン識別用の定数
	private readonly BUTTON_ID_COPY = 'copy';
	private readonly BUTTON_ID_INSERT_PATH_TO_EDITOR = 'insert_path_to_editor';
	private readonly BUTTON_ID_INSERT_PATH_TO_TERMINAL = 'insert_path_to_terminal';
	private readonly BUTTON_ID_OPEN_IN_EDITOR = 'open_in_editor';
	private readonly BUTTON_ID_REVEAL_IN_FILE_EXPLORER = 'reveal_in_file_explorer';
	private readonly BUTTON_ID_PIN = 'pin';
	private readonly BUTTON_ID_FAVORITE = 'favorite';

	fullPath: string;
	insertPath: string;

	iconPath?: vscode.Uri | {
		light: vscode.Uri;
		dark: vscode.Uri;
	} | vscode.ThemeIcon;

	constructor(aQuickPick: MyQuickPickBase, aPath: string)
	{
		super(aQuickPick);
		this.fullPath = path.normalize(aPath);
		this.insertPath = '';

		// ピン留めボタン
		if (this.amIPinned)
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('pinned'), tooltip: i18n(MESSAGES.unpinThis), id: this.BUTTON_ID_PIN });
		}
		else
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('pin'), tooltip: i18n(MESSAGES.pinThis), id: this.BUTTON_ID_PIN });
		}

		// お気に入りに登録ボタン
		if (this.amIFavorite)
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('star-full'), tooltip: i18n(MESSAGES.removeFromFavorite), id: this.BUTTON_ID_FAVORITE });
		}
		else
		{
			this.buttons.push({ iconPath: new vscode.ThemeIcon('star'), tooltip: i18n(MESSAGES.addToFavorite), id: this.BUTTON_ID_FAVORITE });
		}
	}

	/**
	 * このファイル／ディレクトリがクイックアクセスにピン留めされていれば true
	 */
	private get amIPinned(): boolean
	{
		const pinList = vscode.workspace.getConfiguration(CONFIGURATION_NAME).get<string[]>(CONFIG_KEY_PIN_LIST) ?? [];
		return pinList.some(listPath => listPath === this.fullPath);
	}

	/**
	 * このファイル／ディレクトリがお気に入りに登録されていれば true
	 */
	private get amIFavorite(): boolean
	{
		const favorites = vscode.workspace.getConfiguration(CONFIGURATION_NAME).get<string[]>(CONFIG_KEY_FAVORITE_LIST) ?? [];
		return favorites.some(listPath => listPath === this.fullPath);
	}

	private async saveTheList(listKey: string, theList: string[], errorMessage: string, debugErrorMessage: string): Promise<void>
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		try
		{
			await config.update(listKey, theList, vscode.ConfigurationTarget.Global);

			// 書き込みに成功したら表示しているクイックピックを更新する必要がある。
			this.ownerQuickPick.updateList();
		}
		catch (err)
		{
			ryutils.showErrorMessageWithDetailChannel(errorMessage, EXTENSION_NAME_FOR_ERROR, debugErrorMessage, err);
		}
	}

	private async removeFromTheList(listKey: string, errorMessage: string, debugErrorMessage: string): Promise<void>
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		const pinList = config.get<string[]>(listKey) ?? [];

		// 一致するもの全て削除
		const newList = pinList.filter(listPath => listPath !== this.fullPath);

		// 長さが変わっていれば書き込み
		if (newList.length !== pinList.length)
		{
			await this.saveTheList(listKey, newList, errorMessage, debugErrorMessage);
		}
	}

	/**
	 * このファイル／ディレクトリをクイックアクセスから取り除く。
	 */
	private purgeMeFromPinnedList(): void
	{
		this.removeFromTheList(CONFIG_KEY_PIN_LIST, i18n(MESSAGES.failedToWritePinnedList), `Error occurred while updating pinned list.`);
	}

	/**
	 * このファイル／ディレクトリをお気に入りから取り除く。
	 */
	private async removeFromFavoriteList(): Promise<void>
	{
		await this.removeFromTheList(CONFIG_KEY_FAVORITE_LIST, i18n(MESSAGES.failedToWriteFavoriteList), `Error occurred while updating favorite list.`);

		// お気に入りが空になったらクイックピックを閉じる
		if (this._ownerQuickPick instanceof RyFavoriteQuickPick &&
			(this._ownerQuickPick as RyFavoriteQuickPick).numFavorites === 0)
		{
			this._ownerQuickPick.dispose();
		}
	}

	private addMeToTheList(listKey: string, errorMessage: string, debugErrorMessage: string): void
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		const pinList = config.get<string[]>(listKey) ?? [];

		//
		if (!pinList.includes(this.fullPath))
		{
			pinList.push(this.fullPath);
			this.saveTheList(listKey, pinList, errorMessage, debugErrorMessage);
		}
	}

	/**
	 * このファイル／ディレクトリをクイックアクセスにピン留めする。
	 */
	private addMeToPinnedList(): void
	{
		this.addMeToTheList(CONFIG_KEY_PIN_LIST, i18n(MESSAGES.failedToWritePinnedList), `Error occurred while updating pinned list.`);
	}

	/**
	 * このファイル／ディレクトリをお気に入りに登録する。
	 */
	private addToFavoriteList(): void
	{
		this.addMeToTheList(CONFIG_KEY_FAVORITE_LIST, i18n(MESSAGES.failedToWriteFavoriteList), `Error occurred while updating favorite list.`);
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

	/**
	 * このアイテムにアイコンを設定する。ただし、アイコンを表示する設定にしている場合のみ。
	 * @param forceIcon 設定するアイコン名。省略すると 'folder' となる。
	 */
	protected setIcon(icon: string | undefined = 'folder'): void
	{
		if (icon.length > 0)
		{
			// ディレクトリアイコンを表示する？
			const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
			const showIcons = config.get<boolean>(CONFIG_KEY_SHOW_DIRECTORY_ICONS);

			if (showIcons)
			{
				this.iconPath = new vscode.ThemeIcon(icon);
			}
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
			this._ownerQuickPick.dispose();
		}
		else if (button.id === this.BUTTON_ID_INSERT_PATH_TO_EDITOR)
		{
			// エディターにパスを挿入
			ryutils.insertTextToEdtior(this.insertPath);
			this._ownerQuickPick.dispose();
		}
		else if (button.id === this.BUTTON_ID_INSERT_PATH_TO_TERMINAL)
		{
			// アクティブなターミナルにパスを挿入
			ryutils.sendTextToTerminal(this.insertPath);
			this._ownerQuickPick.dispose();
		}
		else if (button.id === this.BUTTON_ID_OPEN_IN_EDITOR)
		{
			// エディタで開く
			openFileInEdtor(this.fullPath);
			this._ownerQuickPick.dispose();
		}
		else if (button.id === this.BUTTON_ID_REVEAL_IN_FILE_EXPLORER)
		{
			// ディレクトリを開く
			ryutils.openDirectory(this.fullPath);
			this._ownerQuickPick.dispose();
		}
		else if (button.id === this.BUTTON_ID_PIN)
		{
			// クイックアクセスにピン留め
			// 登録されていた場合は削除。登録されていない場合は登録。
			const func = this.amIPinned ? this.purgeMeFromPinnedList : this.addMeToPinnedList;
			func.call(this);
		}
		else if (button.id === this.BUTTON_ID_FAVORITE)
		{
			// お気に入りに登録／解除
			const func = this.amIFavorite ? this.removeFromFavoriteList : this.addToFavoriteList;
			func.call(this);
		}
	}
}










class MyQuickPickFileItem extends MyQuickPickFileSystemEntityItem
{
	constructor(aQuickPick: MyQuickPickBase, fileInfo: MyFileInfo, asCurrentDirDot: boolean, baseDirectory: string)
	{
		super(aQuickPick, asCurrentDirDot ? fileInfo.directoryOnly() : fileInfo.fullPath);

		const filenameOnly = fileInfo.filenameOnly();
		const relativePath = getRelativeOrAbsolutePath(baseDirectory, this.fullPath);

		// このアイテムを選択したときに実際に挿入される文字列
		const insertPath = `'${relativePath}'`;

		const description = maskUserNameDirectory(asCurrentDirDot ?
			relativePath :
			(insertPath === filenameOnly ? '' : insertPath));

		this.label = asCurrentDirDot ? '.' : filenameOnly!;
		this.description = description;
		this.insertPath = insertPath;
		this.addCopyButton();
		if (!asCurrentDirDot)
		{
			this.addOpenInEditorButton();
		}
		this.addInsertPathToEditorButton();
		this.addInsertPathToTerminalButton();
	}

	override didAccept(): void
	{
		this.executeFileAction();
		this.ownerQuickPick.hide();
	}
}









class MyQuickPickDirectoryItem extends MyQuickPickFileSystemEntityItem
{
	constructor(aQuickPick: MyQuickPickBase, fileInfo: MyFileInfo, isGoToParent: boolean, baseDirectory: string)
	{
		super(aQuickPick, fileInfo.fullPath);

		// このアイテムを選択したときに実際に挿入されるパス
		const relativePath = getRelativeOrAbsolutePath(baseDirectory, fileInfo.fullPath);

		// ディレクトリ名部分のみ
		const dirName = isGoToParent ? '..' : fileInfo.filenameOnly();

		// このアイテムを選択したときに実際に挿入される文字列
		const insertPath = `'${relativePath}'`;

		this.label = this.makeDirectoryLabel(dirName);
		this.description = insertPath === dirName ? '' : maskUserNameDirectory(insertPath);
		this.insertPath = insertPath;
		this.addCopyButton();
		this.addInsertPathToTerminalButton();
		this.addRevealInFileExplorerButton();

		if (isGoToParent)
		{
			this.setIcon('arrow-up');
		}
		else
		{
			this.setIcon();
		}
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
	override didAccept(): void
	{
		MyQuickPick.createMyQuickPick(this.fullPath);
	}
}










/**
 * CDモードで表示する、ファイルを表す QuickPickItem
 */
class InputPathModeCPItem extends MyQuickPickFileSystemEntityItem
{
	// ディレクトリなら true
	isDirectory: boolean;

	constructor(aQuickPick: MyQuickPickBase, fileInfo: MyFileInfo)
	{
		super(aQuickPick, fileInfo.fullPath);
		this.alwaysShow = true;

		// このアイテムを選択したときに実際に挿入されるパス
		const relativePath = getRelativeOrAbsolutePath(getBaseDirectoryFromConfig(), fileInfo.fullPath);

		// ディレクトリ名部分のみ
		const dirName = fileInfo.filenameOnly();

		// このアイテムを選択したときに実際に挿入される文字列
		const insertPath = `'${relativePath}'`;

		// ラベルは入力中のパスにマッチするようにマスクしない
		this.label = fileInfo.fullPath;
		this.description = insertPath === dirName ? '' : maskUserNameDirectory(insertPath);

		this.insertPath = insertPath;
		this.isDirectory = fileInfo.isDirectory;
		this.addCopyButton();
		this.addInsertPathToTerminalButton();

		if (fileInfo.isDirectory)
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










class MyQuickPickGotoDirItem extends MyQuickPickAcceptableItem2
{
	fullPath: string;

	/**
	 * コンストラクタ。
	 * @param label QuickPickItem のラベル。
	 * @param fullPath コマンドに関連付けられたパス。
	 */
	constructor(aQuickPick: MyQuickPickBase, label: string, fullPath: string)
	{
		super(aQuickPick);
		this.label = COMMAND_LABEL_PREFIX + label;
		this.description = maskUserNameDirectory(fullPath);
		this.fullPath = fullPath;
	}

	override didAccept(): void
	{
		// そのディレクトリへ移動
		if (MyQuickPick.createMyQuickPick(this.fullPath))
		{
			this.ownerQuickPick.dispose();
		}
	}
}










class MyQuickPickSetBaseDirectoryItem extends MyQuickPickAcceptableItem2
{
	private _targetDirectory: string;

	constructor(aQuickPick: MyQuickPick, targetDirectory: string)
	{
		super(aQuickPick);
		this.label = COMMAND_LABEL_PREFIX + (targetDirectory === '' ? i18n(MESSAGES['command.clearBaseDirectory']) : i18n(MESSAGES[ 'command.setBaseDirectory']));
		this.description = '';
		this._targetDirectory = targetDirectory;
	}

	override didAccept(): void
	{
		// ベースディレクトリとして設定
		updateSetting(CONFIG_KEY_BASE_DIRECTORY, this._targetDirectory)
			.then(() =>
			{
				if (MyQuickPick.createMyQuickPick((this.ownerQuickPick as MyQuickPick).fullPath))
				{
					vscode.window.showInformationMessage(i18n(this._targetDirectory === '' ? MESSAGES.baseDirectoryCleared : MESSAGES.baseDirectoryUpdated, { dir: maskUserNameDirectory(this._targetDirectory) }));

					this.ownerQuickPick.dispose();
				}
			})
			.catch((error) => vscode.window.showErrorMessage(i18n(MESSAGES['error.couldntSetBaseDirectory']) + `: ${error}`));
	}
}










/**
 * 隠しファイルの表示切り替えコマンドの QuickPickItem。
 */
class MyQuickPickToggleShowHiddenFilesItem extends MyQuickPickAcceptableItem2
{
	constructor(aQuickPick: MyQuickPick)
	{
		super(aQuickPick);
		this.label = COMMAND_LABEL_PREFIX + i18n(MESSAGES[aQuickPick.showHiddenFiles ? 'hideHiddenFiles' : 'showHiddenFiles']);
		this.description = '';
	}

	override didAccept(): void
	{
		// 隠しファイルの表示設定を切り替える
		this.ownerQuickPick.showHiddenFiles = !this.ownerQuickPick.showHiddenFiles;
	}
}










/**
 * 「パスを入力して移動」コマンドの QuickPickItem。
 */
class MyQuickPickInputPathItem extends MyQuickPickAcceptableItem2
{
	constructor(aQuickPick: MyQuickPick)
	{
		super(aQuickPick);
		this.label = COMMAND_LABEL_PREFIX + i18n(MESSAGES['inputPathCommand.label']);
		this.description = '';
	}

	override didAccept(): void
	{
		this.ownerQuickPick.dispose();
		const backDir = (this._ownerQuickPick as MyQuickPick).fullPath;
		MyInputPathQuickPick.createQuickPick(backDir);
	}
}










/**
 * 「ワークスペースとして開く」コマンドの QuickPickItem。
 */
class MyQuickPickOpenAsWorkspaceCommandItem extends MyQuickPickAcceptableItem2
{
	private readonly _directory: string;

	constructor(aQuickPick: MyQuickPick, aDirectory: string)
	{
		super(aQuickPick);
		this.label = COMMAND_LABEL_PREFIX + i18n(MESSAGES.revealInExplorerCommandLabel, { app: 'VS Code' });
		this.description = '';
		this._directory = aDirectory;

		this.buttons.push({ iconPath: new vscode.ThemeIcon('empty-window'), tooltip: i18n(MESSAGES.openDirectoryAsWorkspaceInNewWindow), id: '' });
	}

	override didAccept(): void
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
 * 「このディレクトリをエクスプローラーで開く」コマンドの QuickPickItem。
 */
class MyQuickPickRevealInExprolerItem extends MyQuickPickAcceptableItem2
{
	private _fullPath: string;

	constructor(aQuickPick: MyQuickPick, fullPath: string)
	{
		super(aQuickPick);
		this.label = COMMAND_LABEL_PREFIX + i18n(MESSAGES.revealInExplorerCommandLabel, { app: ryutils.getOsDependentExplorerAppName() });
		this.description = '';
		this._fullPath = fullPath;
	}

	override didAccept(): void
	{
		// ディレクトリを開く
		ryutils.openDirectory(this._fullPath);
	}
}










/**
 * ディレクトリが見付からなかった事を示す QuickPickItem
 * 2024/07/01
 */
class RyDirectoryNotFoundCPItem extends MyQuickPickAcceptableItem2
{
	constructor(aQuickPick: MyInputPathQuickPick, dir: string)
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
class RyBackToBrowseModeCPItem extends MyQuickPickAcceptableItem2
{
	private readonly _backDirectory: string;

	constructor(aQuickPick: MyInputPathQuickPick, backDir: string)
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
class MyInputPathQuickPick extends MyQuickPickBase
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
		if (endsWithPathSeparator(inputPath))
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
		const items: MyQuickPickAcceptableItem2[] = [];

		// 入力されたパスを解決する
		const inputPath = this._theQuickPick.value;
		const absolutePath = path.resolve(getBaseDirectoryFromConfig(), inputPath);

		const files = listFilesInDirectory(absolutePath);
		if (files.result === FileListStatus.SUCCESS)
		{
			items.push(...files.files.map(fileInfo => new InputPathModeCPItem(this, fileInfo)));
		}
		else if (files.result === FileListStatus.NOT_FOUND)
		{
			items.push(new RyDirectoryNotFoundCPItem(this, absolutePath));
		}

		items.push(new RyBackToBrowseModeCPItem(this, this._backDirectory));
		this._theQuickPick.items = items;
	}

	public override updateList(): void
	{
		this.updateItems();
		this.updateButtons();
	}

	public static createQuickPick(backDirectory: string): MyInputPathQuickPick
	{
		return new MyInputPathQuickPick(backDirectory);
	}
}









/**
 * お気に入りを表示するための QuickPick
 */
export class RyFavoriteQuickPick extends MyQuickPickBase
{
	private _numFavorites: number = 0;

	constructor()
	{
		super();
		this._theQuickPick.title = i18n(MESSAGES.favoriteQuickPickTitle);
		this.updateList();
	}

	public show(): void
	{
		this._theQuickPick.show();
	}

	public override updateList(): void
	{
		const quickPickItems: vscode.QuickPickItem[] = [];
		this._numFavorites = 0;

		// お気に入りを読み込む
		const favorites = vscode.workspace.getConfiguration(CONFIGURATION_NAME).get<string[]>(CONFIG_KEY_FAVORITE_LIST) ?? [];
		const fileInfos = filePathListToFileInfoList(favorites);
		if (fileInfos.length > 0)
		{
			const baseDir = getBaseDirectoryFromConfig();
			fileInfos.forEach((info) =>
			{
				if (info.isDirectory)
				{
					quickPickItems.push(new MyQuickPickDirectoryItem(this, info, false, baseDir));
				}
				else
				{
					quickPickItems.push(new MyQuickPickFileItem(this, info, false, baseDir));
				}
				this._numFavorites++;
			});
		}

		this._theQuickPick.items = quickPickItems;
	}

	override get showHiddenFiles(): boolean
	{
		return false;
	}

	override set showHiddenFiles(value: boolean)
	{
	}

	public get numFavorites(): number
	{
		return this._numFavorites;
	}
}