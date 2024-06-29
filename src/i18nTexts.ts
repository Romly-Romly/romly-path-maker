import { I18NText } from "./i18n";

class ProjectMessages
{
	files: I18NText =
	{
		ja: 'ファイル',
		en: 'Files'
	};
	directories: I18NText =
	{
		ja: 'ディレクトリ',
		en: 'Directories'
	};
	copyPathToClipboard: I18NText =
	{
		ja: 'パスをクリップボードにコピーする',
		en: 'Copy path to clipboard'
	};
	openInEditor: I18NText =
	{
		ja: 'エディタで開く',
		en: 'Open in editor'
	};
	insertPathToActiveEditor: I18NText =
	{
		ja: 'パスをアクティブなエディタに挿入する',
		en: 'Insert path to active editor'
	};
	insertPathToActiveTerminal: I18NText =
	{
		ja: 'パスをアクティブなターミナルに挿入する',
		en: 'Insert path to active terminal'
	};
	revealInFileExplorer: I18NText =
	{
		ja: 'ファイルエクスプローラーを開く',
		en: 'Reveal in File Explorer'
	};
	commands: I18NText =
	{
		ja: 'コマンド',
		en: 'Commands'
	};
	'command.setBaseDirectory': I18NText =
	{
		ja: 'このディレクトリを基準ディレクトリとして設定する',
		en: 'Set this directory as base directory'
	};
	'command.clearBaseDirectory': I18NText =
	{
		ja: '基準ディレクトリをクリアする',
		en: 'Clear base directory'
	};
	showHiddenFiles: I18NText =
	{
		ja: '隠しファイル（.で始まるファイル）を表示する',
		en: 'Show hidden files (files starting with a dot)',
	};
	hideHiddenFiles: I18NText =
	{
		ja: '隠しファイル（.で始まるファイル）を隠す',
		en: 'Hide hidden files (files starting with a dot)',
	};
	'tooltip.showHiddenFiles': I18NText =
	{
		ja: '隠しファイル（.で始まるファイル）を表示する。',
		en: 'Show hidden files (files starting with a dot).',
	};
	'tooltip.hideHiddenFiles': I18NText =
	{
		ja: '隠しファイル（.で始まるファイル）を隠す。',
		en: 'Hide hidden files (files starting with a dot).',
	};
	'tooltip.groupDirectories': I18NText =
	{
		ja: 'ディレクトリとファイルを分けて表示する。',
		en: 'Group directories and files.',
	};
	'tooltip.ungroupDirectories': I18NText =
	{
		ja: 'ディレクトリとファイルを分けずに表示する。',
		en: 'Ungroup directories and files.',
	};
	gotoWorkspaceDir: I18NText =
	{
		ja: 'ワークスペースのディレクトリに移動',
		en: 'Go to workspace directory',
	};
	gotoEditingFileDir: I18NText =
	{
		ja: '編集中のファイルのディレクトリに移動',
		en: 'Go to editing file directory',
	};
	gotoUserDir: I18NText =
	{
		ja: 'ユーザーのディレクトリに移動',
		en: 'Go to user directory',
	};
	backtoBaseDir: I18NText =
	{
		ja: '基準ディレクトリに戻る',
		en: 'Back to base directory',
	};
	couldNotOpenFile: I18NText =
	{
		ja: 'ファイルを開けませんでした',
		en: 'Could not open file',
	};
	baseDirectory: I18NText =
	{
		ja: '基準ディレクトリ',
		en: 'Base Dir',
	};
	baseDirectoryUpdated: I18NText =
	{
		ja: '基準ディレクトリを設定しました: {dir}',
		en: 'Base directory is set: {dir}',
	};
	'error.couldntSetBaseDirectory': I18NText =
	{
		ja: '基準ディレクトリを設定できませんでした',
		en: "Couldn't set base directory",
	};
	openDirectoryAsWorkspace: I18NText =
	{
		ja: 'このディレクトリをCodeで開く',
		en: 'Open this directory in Code',
	};
	openDirectoryAsWorkspaceInNewWindow: I18NText =
	{
		ja: 'このディレクトリを新しいウインドウで開く',
		en: 'Open this directory in new window',
	};
	'error.couldntOpenWorkspace': I18NText =
	{
		ja: 'ディレクトリを開けませんでした',
		en: "Couldn't open directory",
	};
	'inputPathCommand.label': I18NText =
	{
		ja: 'パスを入力して移動',
		en: 'Go to input path',
	};
	'error.directoryNotFound': I18NText =
	{
		ja: 'ディレクトリ {dir} は存在しません。',
		en: 'Directory "{dir}" not found.',
	};
	'error.listFilesFailed': I18NText =
	{
		ja: '{dir} 内のファイル取得に失敗しました。',
		en: 'Failed to get files in "{dir}".',
	};
};

export const MESSAGES = new ProjectMessages();