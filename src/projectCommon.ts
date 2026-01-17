import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as ryutils from './ryutils';
import { RyConfiguration, RyListType } from './ryConfiguration';
import { RyPath } from './ryPath';










export const EXTENSION_NAME_FOR_ERROR = 'Romly: Path-Maker';

// コマンドのラベルに付く前置詞
export const COMMAND_LABEL_PREFIX = '> ';










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
		return s.replace(/[.*+?^${}()/|[\]\\]/g, '\\$&'); // $&はマッチした全文字列を意味する
	}

	if (RyConfiguration.getHideUserName())
	{
		// ユーザー名の代わりに表示されるべき文字列
		const alternative = RyConfiguration.getHiddenUserNameAlternative();

		const username = path.basename(os.homedir());
		const escapedUsername = escapeRegExp(username);
		const escapedSep = escapeRegExp(path.sep);
		const pattern = `(${escapedSep}|^)${escapedUsername}(${escapedSep}|$)`;
		const regex = new RegExp(pattern, 'gm');
		return pathString.replace(regex, `$1${alternative}$2`);
	}
	else
	{
		return pathString;
	}
}










/**
 * このファイル／ディレクトリがクイックアクセスにピン留めされていれば true
 */
export function isItemInTheList(path: RyPath, listType: RyListType): boolean
{
	return RyConfiguration.isListed(listType, path.fullPath);
}










/**
 * このディレクトリをVS Codeで開く。
 * @param newWindow 新しいウィンドウで開く場合は true を指定。
 */
export function openAsWorkspace(path: RyPath, newWindow: boolean): void
{
	vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(path.fullPath), newWindow);

	// 履歴に追加
	RyConfiguration.addToTheList(path.fullPath, RyListType.history);
}










export function openDirectory(path: RyPath): void
{
	ryutils.openDirectory(path.fullPath);

	// 履歴に追加
	RyConfiguration.addToTheList(path.fullPath, RyListType.history);
}










export interface IStringPathListToPathItemListOptions
{
	forceShowHiddenFiles: boolean;
}

/**
 * 文字列によるパスのリストを RyPath のリストに変換する。
 * @param stringPaths
 * @param options
 * @returns
 */
export function stringPathListToPathList(stringPaths: string[], options: IStringPathListToPathItemListOptions): RyPath[]
{
	const showHiddenFiles = RyConfiguration.getShowHiddenFiles();

	// まず RyPath のリストに変換
	const paths: RyPath[] = [];
	stringPaths.forEach(listPath =>
	{
		// 隠しファイルのスキップ
		if (options.forceShowHiddenFiles || showHiddenFiles || !path.basename(listPath).startsWith('.'))
		{
			// エラーになったファイルも RyPath として追加される。
			paths.push(RyPath.createFromString(listPath));
		}
	});

	return paths;
}
