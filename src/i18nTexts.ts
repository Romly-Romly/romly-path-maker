import { I18NText } from "./i18n";

class ProjectMessages
{
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
		en: 'Commands',
		'zh-cn': '命令',
		fr: 'Commandes',
	};

	actions: I18NText =
	{
		ja: 'アクション',
		en: 'Actions',
		'zh-cn': '操作',
		fr: 'Actions',
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

	'tooltip.absolutePathMode': I18NText =
	{
		ja: '絶対パスで表示。',
		en: 'Show absolute paths.',
	};

	'tooltip.relativePathMode': I18NText =
	{
		ja: '相対パスで表示。',
		en: 'Show relative paths.',
	};

	toAbsolutePathMode: I18NText =
	{
		ja: '絶対パスモードへ',
		en: 'Absolute path mode',
	};

	toRelativePathMode: I18NText =
	{
		ja: '相対パスモードへ',
		en: 'Relative path mode',
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

	baseDirectory: I18NText =
	{
		ja: '基準ディレクトリ',
		en: 'Base Dir',
	};

	baseDirectoryUnset: I18NText =
	{
		ja: '未設定',
		en: 'Unset',
	};

	baseDirectoryUpdated: I18NText =
	{
		ja: '基準ディレクトリを設定しました: {dir}',
		en: 'Base directory is set: {dir}',
	};
	baseDirectoryCleared: I18NText =
	{
		ja: '基準ディレクトリをクリアしました。',
		en: 'Base directory is cleared.',
	};
	'error.couldntSetBaseDirectory': I18NText =
	{
		ja: '基準ディレクトリを設定できませんでした',
		en: "Couldn't set base directory",
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

	revealInExplorerCommandLabel: I18NText =
	{
		ja: 'このディレクトリを{app}で開く',
		en: 'Open this directory in {app}',
		fr: "Ouvrir ce répertoire dans {app}",
		'zh-cn': '在{app}中打开此目录',
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

	pinThis: I18NText =
	{
		ja: 'クイックアクセスにピン留めする',
		en: 'Pin to quick access',
	};

	unpinThis: I18NText =
	{
		ja: 'クイックアクセスからピン留めを解除',
		en: 'Unpin from quick access',
	};

	addToFavorite: I18NText =
	{
		ja: 'お気に入りに追加する',
		en: 'Add to favorites',
	};

	removeFromFavorite: I18NText =
	{
		ja: 'お気に入りから削除する',
		en: 'Remove from favorites',
	};

	failedToWritePinnedList: I18NText =
	{
		ja: 'クイックアクセスの書き込みに失敗しました。',
		en: 'Failed to write the quick access list.',
	};

	failedToWriteFavoriteList: I18NText =
	{
		ja: 'お気に入りの書き込みに失敗しました。',
		en: 'Failed to write the favorite list.',
	};

	quickAccesses: I18NText =
	{
		ja: 'クイックアクセス',
		en: 'Quick Access',
	};

	favoriteQuickPickTitle: I18NText =
	{
		ja: 'お気に入り',
		en: 'Favorites',
	};

	directoryNotFoundItemLabel: I18NText =
	{
		ja: 'ディレクトリが見付かりません。',
		en: 'The directory not found.',
	};

	backToBrowseModeItemLabel: I18NText =
	{
		ja: '{dir} に戻る',
		en: 'Back to "{dir}"',
	};

	noFavorites: I18NText =
	{
		ja: 'お気に入りがありません。',
		en: 'No favorite items.',
	};

	directoryTree: I18NText =
	{
		ja: 'ディレクトリツリー',
		en: 'Directory tree',
	};
};

export const MESSAGES = new ProjectMessages();