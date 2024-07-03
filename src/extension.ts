// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// 自前のユーティリティ
import * as ryutils from './ryutils';

import { CONFIGURATION_NAME } from './ryQuickPickBase';
import { MyQuickPick, CONFIG_KEY_LAST_DIRECTORY, RyFavoriteQuickPick } from './myQuickPick';
import { i18n } from './i18n';
import { MESSAGES } from './i18nTexts';










// 設定のキー名。package.json の configuration/properties 内のキー名と一致させる。
const CONFIG_KEY_START_DIRECTORY = 'startDirectory';










/**
 * 指定されたパスを絶対パスに変換する。
 * 既に絶対パスの場合はそのまま、相対パスの場合はOSに応じたルートディレクトリを先頭に付加して絶対パスに変換する。
 *
 * @param inputPath 変換したいパス文字列
 * @returns 絶対パスに変換された文字列
 *
 * @example
 * // Windows環境の場合
 * ensureAbsolutePath('folder/file.txt') // 返り値: 'C:\folder\file.txt'
 * ensureAbsolutePath('C:\folder\file.txt') // 返り値: 'C:\folder\file.txt'
 *
 * // Unix系環境の場合
 * ensureAbsolutePath('folder/file.txt') // 返り値: '/folder/file.txt'
 * ensureAbsolutePath('/folder/file.txt') // 返り値: '/folder/file.txt'
 *
 * @throws {Error} inputPathが文字列でない場合
 */
function ensureAbsolutePath(inputPath: string): string
{
	/**
	 * Windows環境でルートディレクトリ `C:\` を取得する。
	 * Windows以外では正しく取得できない。ネットワークドライブなんかも無理。
	 * @returns
	 */
	function getWindowsRootDirectory(): string
	{
		return process.cwd().split(path.sep)[0] + path.sep;
	}

	inputPath = path.normalize(inputPath);

	// 絶対パスならそのまま返す。
	if (path.isAbsolute(inputPath))
	{
		return inputPath;
	}

	// OSごとにルートディレクトリを決定
	// '/' は path.sep と等価だけど、ルートディレクトリであるということを示すために敢えて '/' と書いた。
	const rootDir = process.platform === 'win32' ? getWindowsRootDirectory() : '/';

	// ルートディレクトリから始まる絶対パスを作成
	return path.join(rootDir, inputPath);
};










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
		// 最後に表示したディレクトリを取得。取得した値は必ず絶対パスだと想定する。
		const lastDirectory = ensureAbsolutePath(config.get<string>(CONFIG_KEY_LAST_DIRECTORY) ?? '');

		// ディレクトリが存在するか確認
		if (fs.existsSync(lastDirectory))
		{
			return lastDirectory;
		}
		else
		{
			console.log(`Romly Path Maker: Last directory not found: ${lastDirectory}`);
			return ryutils.getWorkspaceDirectory() || ryutils.getActiveEditorDirectory() || fallbackDir;
		}
	}
	else if (startDirectory === 'Workspace')
	{
		return ryutils.getWorkspaceDirectory() || ryutils.getActiveEditorDirectory() || fallbackDir;
	}
	else if (startDirectory === 'Editor')
	{
		return ryutils.getActiveEditorDirectory() || fallbackDir;
	}
	else
	{
		return fallbackDir;
	}
}










// このメソッドは拡張機能が有効化されたときに呼び出される
// コマンドが初めて実行されたときに拡張機能が有効化される
export function activate(context: vscode.ExtensionContext)
{
	// コマンドは package.json ファイルで定義されている
	// 次に、 registerCommand を使用してコマンドの実装を提供する
	// commandId パラメータは package.json の command フィールドと一致する必要がある
	context.subscriptions.push(vscode.commands.registerCommand('romly-path-maker.show', () =>
	{
		const startDir = getStartDirectory();
		MyQuickPick.createMyQuickPick(startDir);
	}));

	// お気に入り表示コマンド
	context.subscriptions.push(vscode.commands.registerCommand('romly-path-maker.showFavorites', () =>
	{
		const quickPick = new RyFavoriteQuickPick();
		if (quickPick.numFavorites > 0)
		{
			quickPick.show();
		}
		else
		{
			vscode.window.showInformationMessage(i18n(MESSAGES.noFavorites));
		}
	}));
}

// このメソッドは拡張機能が無効化されたときに呼び出される
export function deactivate()
{
}
