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
const CONFIG_KEY_RECENT_LIST = 'recentList';
const CONFIG_KEY_SHOW_DIRECTORY_ICONS = 'showDirectoryIcons';
const CONFIG_KEY_DEFAULT_ACTION = 'defaultAction';
const CONFIG_KEY_SHOW_RELATIVE_ROUTE = 'showRelativeRoute';
const CONFIG_KEY_PATH_PRESENTATION = 'pathPresentation';
const CONFIG_KEY_LAST_DIRECTORY = 'lastDirectory';
const CONFIG_KEY_START_DIRECTORY = 'startDirectory';










export type RyPathPresentation = 'absolute' | 'relative';
export type RyDefaultAction = 'Menu' | 'Open' | 'Copy' | 'Editor' | 'Terminal' | 'Reveal';
export type RyButtonName = 'Copy' | 'InsertToEditor' | 'InsertToTerminal' | 'OpenInEditor' | 'RevealInShell' | 'OpenAsWorkspace' | 'OpenAsWorkspaceInNewWindow' | 'Pin' | 'Favorite';

// アイテムを表示する最大数の種類。
export enum RyPathItemsType
{
	directories = 'maxDirectories',
	files = 'maxFiles',
	mixed = 'maxDirectoriesAndFiles'
}

// リストの種類
// 都合上、文字列は設定のキーにしてある。
export enum RyListType
{
	favorite = CONFIG_KEY_FAVORITE_LIST,
	pinned = CONFIG_KEY_PIN_LIST,
	history = CONFIG_KEY_RECENT_LIST
};

/**
 * お気に入りやピン留めの各項目の形式。
 * 2024/07/05
 */
export interface RyPathListItem
{
	path: string;

	// 追加日。1970/1/1からのミリ秒数
	added: number;
}

/**
 * 拡張機能の設定への読み書きをまとめたクラス。
 * 2024/07/04
 */
export class RyConfiguration
{
	// 履歴の最大数
	public static MAX_HISTORY_SIZE = 100;

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

	/**
	 * `getHideUserName`が`true`の時にユーザー名の代わりに表示されるべき文字列を取得する。
	 * @returns
	 */
	public static getHiddenUserNameAlternative(): string
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		return config.get<string>('hiddenUserNameAlternative') ?? '<username>';
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

	public static isListed(listType: RyListType, path: string): boolean
	{
		return RyConfiguration.getList(listType).some(item => item.path === path);
	}

	/**
	 * 指定されたリストを読み込む。
	 * @param list リストの種類を指定。
	 * @returns
	 */
	public static getList(list: RyListType): RyPathListItem[]
	{
		const rawList = vscode.workspace.getConfiguration(CONFIGURATION_NAME).get<any[]>(list);

		// 配列になっていない
		if (!Array.isArray(rawList))
		{
			return [];
		}

		const validatedList: RyPathListItem[] = [];
		for (const item of rawList)
		{
			if (item === null)
			{
				continue;
			}

			// 文字列の場合、パスとして追加。追加日は0とする。
			if (typeof item === 'string')
			{
				validatedList.push({ path: item, added: 0 });
				continue;
			}

			const { path, added } = item;
			if (typeof path !== 'string')
			{
				// 正しい型になっていないものはスキップ
				continue;
			}

			let addedTimestamp;
			if (typeof added === 'string')
			{
				addedTimestamp = Date.parse(added);
				if (isNaN(addedTimestamp))
				{
					// 日付が無効
					continue;
				}
			}
			else if (typeof added === 'number')
			{
				addedTimestamp = added;
			}
			else
			{
				// added が stringでも number でもない
				continue;
			}

			validatedList.push({ path, added: addedTimestamp });
		}

		return validatedList;
	}

	public static saveList(listKey: RyListType, theList: RyPathListItem[]): Thenable<void>
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);

		const saveList = theList.map(item =>
		{
			return { path: item.path, added: new Date(item.added).toISOString() };
		});

		return config.update(listKey, saveList, vscode.ConfigurationTarget.Global);
	}

	/**
	 * 指定されたパスをリストに追加する。ただし既に追加されている場合は追加日を更新する。
	 * @param path 追加するパス。
	 * @param toList リストの種類を指定する。
	 * @param maxListSize リストの最大サイズを指定する。既にリストがこのサイズ以上の場合は追加しない。0を指定した場合は必ず追加する。
	 * @returns
	 */
	public static addToTheList(path: string, toList: RyListType, maxListSize: number = 0): Thenable<void>
	{
		let list = RyConfiguration.getList(toList);

		// リストの最大サイズを超えている場合は追加しない
		if (maxListSize > 0 && list.length >= maxListSize)
		{
			return Promise.resolve();
		}

		const currentTime = Date.now();
		let updated = false;
		list = list.map(item =>
		{
			// パスが一致する場合、addedを更新
			if (item.path === path)
			{
				updated = true;
				// ...でitemのプロパティ一通り追加できるらしい
				return { ...item, added: currentTime };
			}
			// パスが一致しない場合、そのまま返す
			return item;
		});

		if (!updated)
		{
			list.push({ path: path, added: currentTime });
		}

		return RyConfiguration.saveList(toList, list);
	}

	public static removeFromList(list: RyListType, path: string): Thenable<void>
	{
		const pinList = RyConfiguration.getList(list);

		// 一致するもの全て削除
		const newList = pinList.filter(item => item.path !== path);

		// 長さが変わっていれば書き込み
		if (newList.length !== pinList.length)
		{
			return RyConfiguration.saveList(list, newList);
		}
		else
		{
			return Promise.resolve();
		}
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

	/**
	 * アイテムに表示する各ボタンの表示設定を取得する。
	 * @param buttonName ボタン名を指定。
	 * @returns true なら表示。
	 */
	public static getButtonVisibility(buttonName: RyButtonName): boolean
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		const names = config.get<string[]>('itemButtonVisibility') || [];
		return names.includes(buttonName);
	}

	/**
	 * ディレクトリ／ファイルを表示する最大数を取得する。
	 * @returns
	 */
	public static getMaxItemsToDisplay(pathItemsType: RyPathItemsType): number
	{
		const config = vscode.workspace.getConfiguration(CONFIGURATION_NAME);
		return config.get<number>(pathItemsType) ?? (pathItemsType === RyPathItemsType.mixed ? 10 : 5);
	}
}