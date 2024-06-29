// 文字列リソースはja, enロケール必須とする
export interface I18NText
{
	ja: string;
	en: string;
	[key: string]: string;
}





/**
 * 共通の文字列リソース。
 * 文字列のキーがIDEでエラーになるよう、クラスにしてそれぞれの文字列をプロパティとした。
 */
class COMMON_TEXTS_CLASS
{
	yes: I18NText =
	{
		en: 'Yes',
		ja: 'はい',
		fr: 'Oui',
		'zh-cn': '是'
	};
	search: I18NText =
	{
		en: 'Search',
		ja: '検索',
		fr: 'Rechercher',
		'zh-cn': '搜索'
	};
	showErrorDetailButtonCaption: I18NText =
	{
		ja: '詳細を表示',
		en: 'Show Detail',
		fr: 'Afficher les détails',
		'zh-cn': '显示详细信息'
	};

	// 特定の文字列に対応するロケールが見つからない場合のエラーメッセージ
	stringResourceLocaleNotFound: I18NText =
	{
		ja: '文字列リソースのキー "{key}" にロケール en のテキストが見付かりませんでした。',
		en: 'Text resource key "{key}" with locale en not found.',
		fr: 'Clé de ressource textuelle "{key}" avec la locale en non trouvée.',
		'zh-cn': '未找到带有英语区域设置的文本资源键 "{key}"。',
	};
};

// 共通の文字列リソース
export const COMMON_TEXTS = new COMMON_TEXTS_CLASS();










/**
 * 指定された文字列内のプレースホルダーを、与えられた辞書で置き換える。
 * プレースホルダーは {キー名} として記述する。詳しくは例を参照。
 *
 * @param s プレースホルダーを含む元の文字列。
 * @param values キーと値のペアを含む辞書。キーはプレースホルダーの名前、値は置換する文字列。
 * @returns プレースホルダーを全て置換した新しい文字列。
 *
 * @example
 * const template = "こんにちは、{name}さん！今日は{day}です。";
 * const values = { name: "田中", day: "火曜日" };
 * const result = replacePlaceholders(template, values);
 * console.log(result); // "こんにちは、田中さん！今日は火曜日です。"
 */
function replacePlaceholders(s: string, values: Record<string, string>): string
{
	return Object.entries(values).reduce((result, [valueName, value]) =>
	{
		return result.replaceAll(`{${valueName}}`, value);
	}, s);
}










/**
 * 指定されたロケールに対応するメッセージを取得する。ロケールに対応するメッセージがない場合は英語(en)に対応するメッセージを返す。英語も存在しないなら最初のメッセージを返す。
 * @param message ロケールキーとメッセージのペア。
 * @param localeKey 取得したいメッセージのロケールキー。
 * @returns ローカライズされたメッセージ。
 */
function getLocalizedMessage(message: I18NText, localeKey: string, defaultValue: string): string
{
	return message[localeKey] || message['en'] || defaultValue;
}










/**
 * 言語設定に対応する文字列を取得する。
 *
 * @param message 国際化文字列を格納した文字列リソース。
 * @param key i18nオブジェクト内の特定のキー。
 * @param values プレースホルダーを置き換えるためのオブジェクト。キーがプレースホルダー名、値が置き換え文字列。
 * @returns プレースホルダーが置き換えられたテキスト。
 */
export function i18n(message: I18NText, values: Record<string, string> = {}): string
{
	// ロケールを取得
	const localeKey = JSON.parse(<string>process.env.VSCODE_NLS_CONFIG).locale as string;

	// ロケールに対応するメッセージを取得
	const localizedText = getLocalizedMessage(message, localeKey, '');

	// enキーすら見つからない場合は必ずエラー
	if (localizedText === '')
	{
		const varName = Object.keys({message})[0];
		const s = COMMON_TEXTS.stringResourceLocaleNotFound;
		throw new Error(replacePlaceholders(getLocalizedMessage(s, localeKey, s['en']), { key: varName }));
	}
	else
	{
		return replacePlaceholders(localizedText, values);
	}
}