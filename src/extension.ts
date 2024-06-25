// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';

// 自前のユーティリティ
import * as ryutils from './ryutils';
import * as myinterfaces from './myinterfaces';










// 設定のキー名。package.json の configuration/properties 内のキー名と一致させる。
const CONFIG_KEY_START_DIRECTORY = 'startDirectory';










/**
 * 表示する最初のディレクトリを取得する。
 * 優先順にワークスペースのディレクトリ → エディタのディレクトリ → ユーザーディレクトリ。
 */
function getStartDirectory(): string
{
	const config = vscode.workspace.getConfiguration(myinterfaces.CONFIGURATION_NAME);
	const startDirectory = <string>config.get(CONFIG_KEY_START_DIRECTORY);

	// 共通のフォールバックディレクトリ
	const fallbackDir = os.homedir();

	if (startDirectory === 'Last')
	{
		// ディレクトリが存在するか確認
		const lastDirectory = <string>config.get(myinterfaces.CONFIG_KEY_LAST_DIRECTORY);
		if (fs.existsSync(lastDirectory))
		{
			return lastDirectory;
		}
		else
		{
			return myinterfaces.getWorkspaceDirectory() || ryutils.getActiveEditorDirectory() || fallbackDir;
		}
	}
	else if (startDirectory === 'Workspace')
	{
		return myinterfaces.getWorkspaceDirectory() || ryutils.getActiveEditorDirectory() || fallbackDir;
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
	let disposable = vscode.commands.registerCommand('romly-path-maker.show', () =>
	{
		myinterfaces.showFilesInQuickPick(getStartDirectory());
	});

	context.subscriptions.push(disposable);
}

// このメソッドは拡張機能が無効化されたときに呼び出される
export function deactivate() {}
