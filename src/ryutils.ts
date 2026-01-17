import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';

// 自前の言語設定の読み込み
import * as i18n from "./i18n";










/**
 * パス文字列がパス区切り文字で終わっているか判定する。
 * @param testPath
 * @returns パス区切り文字で終わっていれば true
 */
export function endsWithPathSeparator(testPath: string): boolean
{
	const normalizedPath = path.normalize(testPath);
	return normalizedPath.endsWith(path.sep);
}










/**
 * パス文字列を各パスに分割する。
 * @param relativePath
 * @returns
 */
export function splitPath(relativePath: string): string[]
{
	// パスを正規化して、余計な '..' などを解決
	const normalizedPath = path.normalize(relativePath);

	// パス区切り文字で分割
	const parts = normalizedPath.split(path.sep);

	// 空要素を削除
	return parts.filter(part => part !== '');
}










/**
 * 文字列をクリップボードにコピーする。
 * @param text コピーする文字列。
 */
export function copyTextToClipboard(text: string): void
{
	vscode.env.clipboard.writeText(text);
}










/**
 * アクティブなエディターが表示されていれば true
 * @returns
 */
export function isActiveEditorVisible(): boolean
{
	const activeEditor = vscode.window.activeTextEditor;
	return Boolean(activeEditor && vscode.window.visibleTextEditors.includes(activeEditor));
}










/**
 * 文字列をアクティブなエディタに挿入する。
 * @param text
 */
export function insertTextToEdtior(text: string): void
{
	if (text && isActiveEditorVisible() && vscode.window.activeTextEditor)
	{
		vscode.window.activeTextEditor.insertSnippet(new vscode.SnippetString(text));
	}
}










/**
 * 文字列をアクティブなターミナルに挿入する。
 * @param text 挿入する文字列。
 */
export function sendTextToTerminal(text: string)
{
	if (text && vscode.window.activeTerminal)
	{
		vscode.window.activeTerminal.sendText(`${text}`, false);

		// フォーカスを移さないとエディタにフォーカスが映ってしまう
		vscode.window.activeTerminal.show();
	}
}










/**
 * OSと言語に応じたエクスプローラーの名前を返す。
 * @returns OSに応じたエクスプローラーの名前。Windowsなら エクスプローラー(Explorer)、Macなら日英ともにFinder、LinuxならFileManager
 */
export function getOsDependentExplorerAppName(forceEnglish: boolean = false): string
{
	let key;
	if (process.platform === 'win32')
	{
		// Windows
		key = i18n.COMMON_TEXTS.windowsExplorer;
	}
	else if (process.platform === 'darwin')
	{
		// Mac
		key = i18n.COMMON_TEXTS.macFinder;
	}
	else
	{
		// Linux
		key = i18n.COMMON_TEXTS.linuxFileManager;
	}

	if (forceEnglish)
	{
		return i18n.en(key);
	}
	else
	{
		return i18n.t(key);
	}
}










/**
 * 指定されたファイルをエディタで開く。
 * @param fullPath 開くファイルのパス。
 */
export async function openFileInEdtor(fullPath: string)
{
	try
	{
		const document = await vscode.workspace.openTextDocument(fullPath);
		await vscode.window.showTextDocument(document);
	}
	catch (error)
	{
		vscode.window.showErrorMessage(i18n.t(i18n.COMMON_TEXTS.couldNotOpenFile) + `: ${error}`);
	}
}









/**
 * 指定されたパスのディレクトリをOSのファイルマネージャで開く。
 * @param path - 開きたいディレクトリのパス。
 */
export function openDirectory(path: string): void
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
 * Windowsで、アプリを指定した引数（ファイルパスなど）付きで起動する。
 * @param execPath アプリの実行パス
 * @param targetPath 開きたいファイルやフォルダのパス
 */
function launchApplicationViaTerminal(execPath: string, targetPath: string): void
{
	// ユーザーの目には見えない、起動専用のターミナルを作成
	const terminal = vscode.window.createTerminal({
		name: "App Launcher",
		hideFromUser: true // ユーザーから隠すフラグ
	});

	// 「ファイル名を指定して実行」と同じコマンドを送る。
	// & をつけることで、アプリを起動した後にターミナルを即座に解放する。
	const command = `& "${execPath}" ${targetPath}`;

	terminal.sendText(command);

	// 念の為、少し(5秒)待ってから解放
	setTimeout(() =>
	{
		terminal.dispose();
	}, 5000);
}










async function launchMacViaApi(scheme: string, authority: string, path: string): Promise<void>
{
	// ファイルパスをURL形式に変換
	// 例: gitkraken://repo/c/path/to/repo
	const uri = vscode.Uri.parse(`${scheme}://${authority}/${path}`);

	try
	{
		await vscode.env.openExternal(uri);
	}
	catch (e)
	{
		console.log(`vscode.env.openExternal(${uri}) failed. Error: ${e}`);
	}
}










/**
 * 指定されたパスを GitKraken で開く
 * @param repoPath
 */
export function openWithGitKraken(repoPath: string): void
{
	let appPath: string;

	if (process.platform === 'darwin')
	{
		launchMacViaApi('gitkraken', 'repo', repoPath);
	}
	else if (process.platform === 'win32')
	{
		// GitKraken の実行ファイルのパスを構築
		// GitKraken はなぜか gitkraken.exe じゃなくて update.exe なんだよなー

		// ちなみに GitKraken の起動コマンドはこんな感じ。
		// レジストリエディタで コンピューター\HKEY_CLASSES_ROOT\Directory\shell\GitKraken\command にあるよ。
		// "C:\Users\<username>\AppData\Local\gitkraken\update.exe" --processStart=gitkraken.exe --process-start-args="-p \"%1\""
		const homeDir = os.homedir();
		appPath = path.join(homeDir, 'AppData', 'Local', 'gitkraken', 'update.exe');
		const options = `--processStart=gitkraken.exe --process-start-args="-p ${repoPath.replace(/"/g, '\\"')}"`;
		launchApplicationViaTerminal(appPath, options);
	}
	else if (process.platform === 'linux')
	{
		// Linuxはとりま未対応
		// appPath = '/usr/bin/gitkraken'; // Linuxでの一般的なインストール先
	}
	else
	{
		throw new Error(`Unsupported platform: ${process.platform}`);
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
 * アクティブなエディターで編集しているファイルのパスを取得する。
 * アクティブなエディターが存在しない場合やファイルが見付からない場合は undefined を返す。
 * @returns ディレクトリパス。アクティブなエディターがない場合やファイルが見付からない場合は undefined 。
 */
export function getActiveEditorDirectory(): string | undefined
{
	const editor = vscode.window.activeTextEditor;
	if (editor)
	{
		const filePath = editor.document.uri.fsPath;

		// ファイルが実際に存在するか確認
		if (fs.existsSync(filePath))
		{
			return path.dirname(filePath);
		}
		else
		{
			// ファイルが見つからない場合
			return undefined;
		}
	}
	else
	{
		// アクティブエディターが見つからなかった
		return undefined;
	}
}










/**
 * 拡張したQuickPickItemのボタン。
 * @property id ボタンの識別子として使う文字列。
 */
export interface IRyQuickPickButton extends vscode.QuickInputButton
{
	id: string;
}










/**
 * さらにボタンクリック時の処理を書けるようにしたボタンクラス。
 * 便宜上IDを持ってるけど使ってない。
 * 2024/07/07
 */
export class RyQPItemButton implements IRyQuickPickButton
{
	private readonly _ownerItem: vscode.QuickPickItem;
	id: string;
	iconPath: vscode.Uri | vscode.ThemeIcon | {dark: vscode.Uri, light: vscode.Uri};
	tooltip?: string;

	constructor(aOwner: vscode.QuickPickItem, aIcon: vscode.ThemeIcon, aTooltip: string = '')
	{
		this._ownerItem = aOwner;
		this.id = '';
		this.iconPath = aIcon;
		this.tooltip = aTooltip;
	}

	public onClick(): void
	{
	}

	public get ownerItem(): vscode.QuickPickItem
	{
		return this._ownerItem;
	}
}




















/**
 * エラーを `vscode.window.showErrorMessage` で表示し、ユーザーの要求に応じて詳細を表示する。
 * @param errorMessage `vscode.window.showErrorMessage` で表示するエラーメッセージ。
 * @param extensionName 詳細を表示する時に出力チャンネルを識別するための拡張機能の名前。 `createOutputChannel` で使用する。
 * @param debugErrorMessage 出力チャンネルに最初に表示するエラーメッセージ。
 * @param error 出力チャンネルに表示する Error オブジェクト、またはcatchしたものをそのまま渡せるように unknow にも対応。
 */
export function showErrorMessageWithDetailChannel(errorMessage: string, extensionName: string, debugErrorMessage: string, error: Error | unknown)
{
	vscode.window.showErrorMessage(errorMessage, i18n.t(i18n.COMMON_TEXTS.showErrorDetailButtonCaption)).then(() =>
	{
		// エラー詳細を Output Channel に表示
		const channel = vscode.window.createOutputChannel(extensionName);
		if (error instanceof Error)
		{
			channel.appendLine(debugErrorMessage);
			channel.appendLine(`Error Message: ${error.message}`);
			channel.appendLine(`Stack Trace: ${error.stack}`);
		}
		else
		{
			channel.appendLine(debugErrorMessage);
			channel.appendLine(`Type: ${typeof error}`);
			channel.appendLine(`Value: ${error}`);
		}
		channel.show();
	});
}










/**
 * パス文字列を指定文字数以内に省略します
 * @param fullPath 完全なパス文字列
 * @param maxLength 最大文字数
 * @param keepStartDirs 先頭から最低限保持するディレクトリ数
 * @param keepEndDirs 末尾から最低限保持するディレクトリ数(ファイル名含む)
 * @returns 省略されたパス文字列
 */
export function shortenPath(fullPath: string, maxLength: number, keepStartDirs: number = 1, keepEndDirs: number = 2): string
{
	if (fullPath.length <= maxLength)
	{
		return fullPath;
	}

	const separator = fullPath.includes('/') ? '/' : '\\';
	const parts = fullPath.split(separator);

	// 保持する先頭部分と末尾部分を取得
	const startParts = parts.slice(0, keepStartDirs);
	const endParts = parts.slice(-keepEndDirs);

	// 最低限の省略形を作成
	const minimalPath = [...startParts, '...', ...endParts].join(separator);

	if (minimalPath.length <= maxLength)
	{
		// 余裕があれば中間部分も追加
		const middleParts = parts.slice(keepStartDirs, -keepEndDirs);

		for (let i = 0; i < middleParts.length; i++)
		{
			const testParts = [...startParts, ...middleParts.slice(0, i + 1), '...', ...endParts];
			const testPath = testParts.join(separator);

			if (testPath.length > maxLength)
			{
				// 1つ前までが限界
				if (i === 0)
				{
					return minimalPath;
				}
				const finalParts = [...startParts, ...middleParts.slice(0, i), '...', ...endParts];
				return finalParts.join(separator);
			}
		}

		// 全部入る場合
		return fullPath;
	}

	return minimalPath;
}