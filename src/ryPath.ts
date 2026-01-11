import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';










export enum MyFileType { file, directory, notFound, error };










/**
 * 相対パスを取得する。ただしベースディレクトリに空文字列を渡した場合は絶対パスを返す。
 *
 * @param baseDir ベースディレクトリ
 * @param fullPath 変換するパス
 * @returns 相対パスまたは絶対パス
 */
export function getRelativeOrAbsolutePath(baseDir: string, fullPath: string): string
{
	if (!baseDir || baseDir.trim() === '')
	{
		// baseDirが空の場合は絶対パスを返す
		return path.resolve(fullPath);
	}
	else
	{
		// baseDirが有効な場合は相対パスを返す
		return path.relative(baseDir, fullPath);
	}
}










export enum FileListStatus { SUCCESS, ERROR };

/**
 * listFilesInDirectory の結果を表すオブジェクト。
 */
export class ListFilesResult
{
	result: FileListStatus;
	path: RyPath;
	files: RyPath[];
	error?: Error;

	constructor(result: FileListStatus, path: RyPath, files: RyPath[] = [], error: Error | undefined = undefined)
	{
		this.result = result;
		this.path = path;
		this.files = files;
		this.error = error;
	}
}










export class RyPath
{
	// このオブジェクトが示すパス。初期化時に `path.normalize` してある。
	readonly _fullPath: string;

	readonly _type: MyFileType;

	constructor(aPath: string, type: MyFileType)
	{
		this._fullPath = aPath;
		this._type = type;
	}

	get parent(): RyPath
	{
		return RyPath.createFromString(path.dirname(this._fullPath));
	}

	/**
	 * ファイルのパスから RyPath を作成する。ファイル情報を取得したりファイルかディレクトリかを調べたりする。
	 * @param fullPath ファイル／ディレクトリのフルパス。
	 * @returns RyPath 。 undefinedIfError が true かつ、パスが見付からなかったり情報が取得できなかった場合は undefined
	 */
	static createFromString(fullPath: string): RyPath
	{
		// ファイルが見付からない
		if (!fs.existsSync(fullPath))
		{
			return new RyPath(fullPath, MyFileType.notFound);
		}

		try
		{
			const stat = fs.statSync(fullPath);
			return new RyPath(fullPath, stat.isDirectory() ? MyFileType.directory : MyFileType.file);
		}
		catch (err)
		{
			// ファイル情報が取得できなかった
			console.error(`Romly Path Maker: statSync failed for: ${fullPath}`, err);
			return new RyPath(fullPath, MyFileType.error);
		}
	}

	public get fullPath(): string
	{
		return this._fullPath;
	}

	public get uri(): vscode.Uri
	{
		return vscode.Uri.file(this.fullPath);
	}

	public get type(): MyFileType
	{
		return this._type;
	}

	public get isDirectory(): boolean
	{
		return this._type === MyFileType.directory;
	}

	/**
	 * ファイル名のみを返す。ルートディレクトリで実行した場合はドライブレターを返す。
	 */
	public get filenameOnly(): string
	{
		const parsed = path.parse(this.fullPath);

		// もしパスがルートそのものだった場合は、rootの値を返しますわ
		if (this.fullPath === parsed.root)
		{
			return parsed.root;
		}

		return parsed.base;
	}

	public get isHiddenFile(): boolean
	{
		return path.basename(this.fullPath).startsWith('.');
	}

	public get parentPath(): RyPath
	{
		return RyPath.createFromString(path.dirname(this.fullPath));
	}

	/**
	 * ルートディレクトリかどうか。Windows であれば c:\
	 */
	public get isRoot(): boolean
	{
		return path.dirname(this.fullPath) === this.fullPath;
	}

	public get isValidPath(): boolean
	{
		return !(this._type === MyFileType.notFound || this._type === MyFileType.error);
	}

	/**
	 * パス文字列を挿入するために引用符で囲む。
	 * @param aPath
	 * @returns
	 */
	public static quotePath(aPath: string): string
	{
		return "'" + aPath + "'";
	}

	/**
	 * このパスが指定されたパスと同じファイル／ディレクトリを示すものであれば true
	 * @param other
	 * @returns
	 */
	public equals(other: RyPath | string): boolean
	{
		let path1 = this._fullPath;
		let path2: string;
		if (other instanceof RyPath)
		{
			// コンストラクタで normalize してるハズなので単純に比較。
			path2 = other.fullPath;
		}
		else
		{
			path2 = other;
		}

		// Windowsでは大文字と小文字を区別しないよう小文字に変換してから比較する。
		const isWindows = os.platform() === 'win32';
		if (isWindows)
		{
			path1 = path1.toLowerCase();
			path2 = path2.toLowerCase();
		}
		return path1 === path2;
	}

	/**
	 * ディレクトリ内のファイル一覧を取得する。
	 * @returns ファイル取得の成否、ファイル情報の配列、エラー情報（ある場合）を含むオブジェクト。
	 */
	public listFiles(showHiddenFiles: boolean): ListFilesResult
	{
		// ディレクトリの存在チェック
		if (!this.isValidPath)
		{
			return new ListFilesResult(FileListStatus.ERROR, this);
		}

		const result = [] as RyPath[];
		let files;
		try
		{
			files = fs.readdirSync(this.fullPath);

			// 文中で return する必要があるので forEach ではなく for ループで。
			for (const filename of files)
			{
				const fullPath = path.join(this.fullPath, filename);

				// ファイル情報が取得できなかったもの（エラー発生）は省く
				const info = RyPath.createFromString(fullPath);
				if (info.isValidPath)
				{
					// 隠しファイルの表示設定に応じて省く
					if (showHiddenFiles || !info.isHiddenFile)
					{
						result.push(info);
					}
				}
			}
		}
		catch (err)
		{
			return new ListFilesResult(FileListStatus.ERROR, this, [], err as Error);
		}

		return new ListFilesResult(FileListStatus.SUCCESS, this, result);
	}
}
