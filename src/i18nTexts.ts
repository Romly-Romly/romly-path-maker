import { LocalizedMessages } from "./i18n";

const messages: LocalizedMessages =
{
	'files':
	{
		ja: 'ファイル',
		en: 'Files'
	},
	'directories':
	{
		ja: 'ディレクトリ',
		en: 'Directories'
	},
	'copyPathToClipboard':
	{
		ja: 'パスをクリップボードにコピーする',
		en: 'Copy path to clipboard'
	},
	'openInEditor':
	{
		ja: 'エディタで開く',
		en: 'Open in editor'
	},
	'insertPathToActiveEditor':
	{
		ja: 'パスをアクティブなエディタに挿入する',
		en: 'Insert path to active editor'
	},
	'insertPathToActiveTerminal':
	{
		ja: 'パスをアクティブなターミナルに挿入する',
		en: 'Insert path to active terminal'
	},
	'revealInFileExplorer':
	{
		ja: 'ファイルエクスプローラーを開く',
		en: 'Reveal in File Explorer'
	},
	'commands':
	{
		ja: 'コマンド',
		en: 'Commands'
	},
	'command.setBaseDirectory':
	{
		ja: 'このディレクトリを基準ディレクトリとして設定する',
		en: 'Set this directory as base directory'
	},
	'command.clearBaseDirectory':
	{
		ja: '基準ディレクトリをクリアする',
		en: 'Clear base directory'
	},
	'showHiddenFiles':
	{
		ja: '隠しファイル（.で始まるファイル）を表示する',
		en: 'Show hidden files (files starting with a dot)',
	},
	'hideHiddenFiles':
	{
		ja: '隠しファイル（.で始まるファイル）を隠す',
		en: 'Hide hidden files (files starting with a dot)',
	},
	'tooltip.showHiddenFiles':
	{
		ja: '隠しファイル（.で始まるファイル）を表示する。',
		en: 'Show hidden files (files starting with a dot).',
	},
	'tooltip.hideHiddenFiles':
	{
		ja: '隠しファイル（.で始まるファイル）を隠す。',
		en: 'Hide hidden files (files starting with a dot).',
	},
	'tooltip.groupDirectories':
	{
		ja: 'ディレクトリとファイルを分けて表示する。',
		en: 'Group directories and files.',
	},
	'tooltip.ungroupDirectories':
	{
		ja: 'ディレクトリとファイルを分けずに表示する。',
		en: 'Ungroup directories and files.',
	},
	'gotoWorkspaceDir':
	{
		ja: 'ワークスペースのディレクトリに移動',
		en: 'Go to workspace directory',
	},
	'gotoEditingFileDir':
	{
		ja: '編集中のファイルのディレクトリに移動',
		en: 'Go to editing file directory',
	},
	'gotoUserDir':
	{
		ja: 'ユーザーのディレクトリに移動',
		en: 'Go to user directory',
	},
	'backtoBaseDir':
	{
		ja: '基準ディレクトリに戻る',
		en: 'Back to base directory',
	},
	'couldNotOpenFile':
	{
		ja: 'ファイルを開けませんでした',
		en: 'Could not open file',
	},
	'baseDirectory':
	{
		ja: '基準ディレクトリ',
		en: 'Base Dir',
	},
	'baseDirectoryUpdated':
	{
		ja: '基準ディレクトリを設定しました: {dir}',
		en: 'Base directory is set: {dir}',
	},
	'error.couldntSetBaseDirectory':
	{
		ja: '基準ディレクトリを設定できませんでした',
		en: "Couldn't set base directory",
	},
	openDirectoryAsWorkspace:
	{
		ja: 'このディレクトリをCodeで開く',
		en: 'Open this directory in Code',
	},
	openDirectoryAsWorkspaceInNewWindow:
	{
		ja: 'このディレクトリを新しいウインドウで開く',
		en: 'Open this directory in new window',
	},
	'error.couldntOpenWorkspace':
	{
		ja: 'ディレクトリを開けませんでした',
		en: "Couldn't open directory",
	},
	'inputPathCommand.label':
	{
		ja: 'パスを入力して移動',
		en: 'Go to input path',
	},
	'error.directoryNotFound':
	{
		ja: 'ディレクトリ {dir} は存在しません。',
		en: 'Directory "{dir}" not found.',
	},
	'error.listFilesFailed':
	{
		ja: '{dir} 内のファイル取得に失敗しました。',
		en: 'Failed to get files in "{dir}".',
	},
};

export default messages;