import * as vscode from 'vscode';










// 拡張機能の設定のセクション名
const CONFIGURATION_NAME = 'romly-path-maker';

// 設定のキー名。package.json の configuration/properties 内のキー名と一致させる。
const CONFIG_KEY_GROUP_DIRECTORIES = 'groupDirectories';
const CONFIG_KEY_SHOW_HIDDEN_FILES = 'showHiddenFiles';
const CONFIG_KEY_BASE_DIRECTORY = 'baseDirectory';
const CONFIG_KEY_HIDE_USERNAME = 'hideUserName';
const CONFIG_KEY_FAVORITE_LIST = 'favoriteList';
const CONFIG_KEY_PIN_LIST = 'pinnedList';
const CONFIG_KEY_SHOW_DIRECTORY_ICONS = 'showDirectoryIcons';
const CONFIG_KEY_DEFAULT_ACTION = 'defaultAction';
const CONFIG_KEY_SHOW_RELATIVE_ROUTE = 'showRelativeRoute';
const CONFIG_KEY_PATH_PRESENTATION = 'pathPresentation';
const CONFIG_KEY_LAST_DIRECTORY = 'lastDirectory';
const CONFIG_KEY_START_DIRECTORY = 'startDirectory';










export type RyPathPresentation = 'absolute' | 'relative';
export type RyDefaultAction = 'Open' | 'Copy' | 'Editor' | 'Terminal' | 'Reveal';

/**
 * 拡張機能の設定への読み書きをまとめたクラス。
 * 2024/07/04
 */
export class RyConfiguration
{
	/**
	 * ワークスペースのスコープに設定を書き込む。ワークスペースが見つからなかった場合にはグローバルスコープに書き込む。
	 *
	 * @param key 設定のキー。
	 * @param value 設定する値。
	 * @returns 設定が完了すると解決されるPromise。
	 */
	static async updateSetting(key: string, value: any): Promise<void>
	{
		// ワークスペースが開かれているか確認
		const workspaceFolders = vscode.workspace.workspaceFolders;
		const targetScope = workspaceFolders ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;

		// 設定を更新
		await vscode.workspace.getConfiguration(CONFIGURATION_NAME).update(key, value, targetScope);
	}

	public static getStartDirectory(): string
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		return config.get<string>(CONFIG_KEY_START_DIRECTORY) ?? 'Last';
	}

	public static getLastDirectory(): string
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		return config.get<string>(CONFIG_KEY_LAST_DIRECTORY) ?? '';
	}

	public static setLastDirectory(value: string): Promise<void>
	{
		return RyConfiguration.updateSetting(CONFIG_KEY_LAST_DIRECTORY, value);
	}

	/**
	 * 基準ディレクトリを設定から読み込んで返す。
	 * @returns
	 */
	public static getBaseDirectory(): string
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		return config.get<string>(CONFIG_KEY_BASE_DIRECTORY) ?? '';
	}

	public static setBaseDirectory(value: string): Promise<void>
	{
		return RyConfiguration.updateSetting(CONFIG_KEY_BASE_DIRECTORY, value);
	}

	public static getHideUserName(): boolean
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		return config.get<boolean>(CONFIG_KEY_HIDE_USERNAME) ?? false;
	}

	public static getShowHiddenFiles(): boolean
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		return config.get<boolean>(CONFIG_KEY_SHOW_HIDDEN_FILES) ?? false;
	}

	public static setShowHiddenFiles(value: boolean): Thenable<void>
	{
		return vscode.workspace.getConfiguration(CONFIGURATION_NAME).update(CONFIG_KEY_SHOW_HIDDEN_FILES, value, vscode.ConfigurationTarget.Global);
	}

	public static getGroupDirectories(): boolean
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		return config.get<boolean>(CONFIG_KEY_GROUP_DIRECTORIES) ?? true;
	}

	public static setGroupDirectories(value: boolean): Thenable<void>
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		return config.update(CONFIG_KEY_GROUP_DIRECTORIES, value, vscode.ConfigurationTarget.Global);
	}

	public static getPathPresentation(): RyPathPresentation
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		const style = config.get<string>(CONFIG_KEY_PATH_PRESENTATION);
		if (style === 'absolute')
		{
			return 'absolute';
		}
		else
		{
			return 'relative';
		}
	}

	public static setPathPresentation(value: RyPathPresentation): Thenable<void>
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		return config.update(CONFIG_KEY_PATH_PRESENTATION, value, vscode.ConfigurationTarget.Global);
	}

	public static isPinned(path: string): boolean
	{
		return RyConfiguration.getPinnedList().some(listPath => listPath === path);
	}

	public static isFavorite(path: string): boolean
	{
		return RyConfiguration.getFavoriteList().some(listPath => listPath === path);
	}

	public static getPinnedList(): string[]
	{
		return vscode.workspace.getConfiguration(CONFIGURATION_NAME).get<string[]>(CONFIG_KEY_PIN_LIST) ?? [];
	}

	public static getFavoriteList(): string[]
	{
		return vscode.workspace.getConfiguration(CONFIGURATION_NAME).get<string[]>(CONFIG_KEY_FAVORITE_LIST) ?? [];
	}

	private static addToList(listKey: string, path: string): Thenable<void>
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		const list = config.get<string[]>(listKey) ?? [];

		//
		if (!list.includes(path))
		{
			list.push(path);
			return RyConfiguration.saveList(listKey, list);
		}
		else
		{
			return Promise.resolve();
		}
	}

	private static saveList(listKey: string, theList: string[]): Thenable<void>
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		return config.update(listKey, theList, vscode.ConfigurationTarget.Global);
	}

	public static addToPinnedList(path: string): Thenable<void>
	{
		return RyConfiguration.addToList(CONFIG_KEY_PIN_LIST, path);
	}

	public static addToFavoriteList(path: string): Thenable<void>
	{
		return RyConfiguration.addToList(CONFIG_KEY_FAVORITE_LIST, path);
	}

	private static removeFromList(listKey: string, path: string): Thenable<void>
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		const pinList = config.get<string[]>(listKey) ?? [];

		// 一致するもの全て削除
		const newList = pinList.filter(listPath => listPath !== path);

		// 長さが変わっていれば書き込み
		if (newList.length !== pinList.length)
		{
			return RyConfiguration.saveList(listKey, newList);
		}
		else
		{
			return Promise.resolve();
		}
	}

	public static removeFromPinnedList(path: string): Thenable<void>
	{
		return RyConfiguration.removeFromList(CONFIG_KEY_PIN_LIST, path);
	}

	public static removeFromFavoriteList(path: string): Thenable<void>
	{
		return RyConfiguration.removeFromList(CONFIG_KEY_FAVORITE_LIST, path);
	}

	/**
	 * ディレクトリアイコンを表示する？
	 * @returns
	 */
	public static getShowDirectoryIcons(): boolean
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		return config.get<boolean>(CONFIG_KEY_SHOW_DIRECTORY_ICONS) ?? true;
	}

	public static getShowPathRoute(): boolean
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		return config.get<boolean>(CONFIG_KEY_SHOW_RELATIVE_ROUTE) ?? true;
	}

	public static getDefaultAction(): RyDefaultAction
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		return config.get<RyDefaultAction>(CONFIG_KEY_DEFAULT_ACTION) ?? 'Terminal';
	}
}