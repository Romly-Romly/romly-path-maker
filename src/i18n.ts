const i18n =
{
	'files':
	{
		'ja': 'ファイル',
		'en': 'Files'
	},
	'directories':
	{
		'ja': 'ディレクトリ',
		'en': 'Directories'
	},
	'copyPathToClipboard':
	{
		'ja': 'パスをクリップボードにコピーする',
		'en': 'Copy path to clipboard'
	},
	'openInEditor':
	{
		'ja': 'エディタで開く',
		'en': 'Open in editor'
	},
	'insertPathToActiveTerminal':
	{
		'ja': 'パスをアクティブなターミナルに挿入する',
		'en': 'Insert path to active terminal'
	},
	'revealInFileExplorer':
	{
		'ja': 'ファイルエクスプローラーを開く',
		'en': 'Reveal in File Explorer'
	},
	'commands':
	{
		'ja': 'コマンド',
		'en': 'Commands'
	},
	'command.setBaseDirectory':
	{
		'ja': 'このディレクトリを基準ディレクトリとして設定する',
		'en': 'Set this directory as base directory'
	},
	'command.clearBaseDirectory':
	{
		'ja': '基準ディレクトリをクリアする',
		'en': 'Clear base directory'
	},
	'showHiddenFiles':
	{
		'ja': '隠しファイル（.で始まるファイル）を表示する。',
		'en': 'Show hidden files (files starting with a dot).',
	},
	'hideHiddenFiles':
	{
		'ja': '隠しファイル（.で始まるファイル）を隠す。',
		'en': 'Hide hidden files (files starting with a dot).',
	},
	'gotoWorkspaceDir':
	{
		'ja': 'ワークスペースのディレクトリに移動する',
		'en': 'Go to workspace directory',
	},
	'gotoEditingFileDir':
	{
		'ja': '編集中のファイルのディレクトリに移動する',
		'en': 'Go to editing file directory',
	},
	'gotoUserDir':
	{
		'ja': 'ユーザーのディレクトリに移動する',
		'en': 'Go to user directory',
	},
	'error.couldntRetrieveFiles':
	{
		'ja': 'ファイル一覧を取得できませんでした',
		'en': "Couldn't retrieve files",
	},
	'couldNotOpenFile':
	{
		'ja': 'ファイルを開けませんでした',
		'en': 'Could not open file',
	},
	'baseDirectory':
	{
		'ja': '基準ディレクトリ: {dir}',
		'en': 'Base Dir: {dir}',
	},
	'baseDirectoryUpdated':
	{
		'ja': '基準ディレクトリを設定しました: {dir}',
		'en': 'Base directory is set: {dir}',
	},
	'error.couldntSetBaseDirectory':
	{
		'ja': '基準ディレクトリを設定できませんでした',
		'en': "Couldn't set base directory",
	},
	'openDirectoryAsWorkspace':
	{
		'ja': 'このディレクトリをCodeで開く',
		'en': 'Open directory in Code',
	},
	'error.couldntOpenWorkspace':
	{
		'ja': 'ディレクトリを開けませんでした',
		'en': "Couldn't open directory",
	},
};

/**
 * 言語設定に対応する文字列を取得する。
 *
 * @param key - i18nオブジェクト内の特定のキー。
 * @param values - プレースホルダーを置き換えるためのオブジェクト。キーがプレースホルダー名、値が置き換え文字列。
 * @returns プレースホルダーが置き換えられたテキスト。
 */
function i18nText(key: string, values: { [valueName: string]: string } = {}): string
{
	const localeKey = <string>JSON.parse(<string>process.env.VSCODE_NLS_CONFIG).locale;
	const text = i18n[key as keyof typeof i18n];
	let s = text[localeKey as keyof typeof text];
	for (const valueName in values)
	{
		s = s.replace(`{${valueName}}`, values[valueName]);
	}
	return s;
}

export default i18nText;