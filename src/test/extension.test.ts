import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

import { i18nPluralWithLocale, COMMON_TEXTS } from '../i18n';

suite('Extension Test Suite', () =>
{
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () =>
	{
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});

/**
 * 言語ごとの複数形のテスト。
 * 2024/06/30
 */
suite('Pluralization Test Suite', () =>
{
	vscode.window.showInformationMessage('複数形のテストを開始します。');

	function check(locale: string, correct: string[], start: number = 0)
	{
		for (let i = start; i < start + correct.length; i++)
		{
			const translated = i18nPluralWithLocale(COMMON_TEXTS.files, i, locale);
			console.log(`${translated} === ${correct[i - start]}`);
			assert.strictEqual(translated, correct[i - start]);
		}
	}

	const TEXTS =
	{
		ja: { 0: ['0 ファイル', '1 ファイル', '2 ファイル'] },
		en: { 0: ['0 files', '1 file', '2 files', '3 files'] },
		ar:	{
			0: [
				'0 ملفات',	// milaaffaat (zero)
				'1 ملف',	// milaff (singular)
				'2 ملفان',	// milaffaan (dual)
				'3 ملفات',	// milaaffaat (few)
				'4 ملفات',
				'5 ملفات',
				'6 ملفات',
				'7 ملفات',
				'8 ملفات',
				'9 ملفات',
				'10 ملفات',
				'11 ملفًا',	// milaffan (many)
				'12 ملفًا',
				'13 ملفًا',
				'14 ملفًا',
				'15 ملفًا',
			],
			99: [
				'99 ملفًا',	 // milaffan (many)
				'100 ملف',		 // milaff (singular)
				'101 ملف',
				'102 ملف',
				'103 ملفات',	 // milaaffaat (few)
				'104 ملفات',
				'105 ملفات',
				'106 ملفات',
				'107 ملفات',
				'108 ملفات',
				'109 ملفات',
				'110 ملفات',
				'111 ملفًا',		// milaffan (many)
				'112 ملفًا',
				'113 ملفًا',
				'114 ملفًا',
				'115 ملفًا'
			]
		},
		ru: { 0:
			[
				'0 файлов',		// other
				'1 файл',			// singular
				'2 файла',		 // few (2-4, except 12-14)
				'3 файла',
				'4 файла',
				'5 файлов',		// other (5-20)
				'6 файлов',
				'7 файлов',
				'8 файлов',
				'9 файлов',
				'10 файлов',
				'11 файлов',
				'12 файлов',
				'13 файлов',
				'14 файлов',
				'15 файлов',
				'16 файлов',
				'17 файлов',
				'18 файлов',
				'19 файлов',
				'20 файлов',
				'21 файл',		 // singular (x1, except 11)
				'22 файла',		// few (x2-x4, except 12-14)
				'23 файла',
				'24 файла',
				'25 файлов',	 // other
				'26 файлов',
				'27 файлов',
				'28 файлов',
				'29 файлов',
				'30 файлов',
				'31 файл',		 // singular
				'32 файла',		// few
				'33 файла',
				'34 файла',
				'35 файлов',	 // other
			]
		},
		pl: { 0: [
			'0 plików',		// many
			'1 plik',			// singular
			'2 pliki',		 // few (2-4, except 12-14)
			'3 pliki',
			'4 pliki',
			'5 plików',		// many (5-21, except those ending in 2-4)
			'6 plików',
			'7 plików',
			'8 plików',
			'9 plików',
			'10 plików',
			'11 plików',
			'12 plików',
			'13 plików',
			'14 plików',
			'15 plików',
			'16 plików',
			'17 plików',
			'18 plików',
			'19 plików',
			'20 plików',
			'21 plików',	 // many (unlike Russian)
			'22 pliki',		// few
			'23 pliki',
			'24 pliki',
			'25 plików',	 // many
			'26 plików',
			'27 plików',
			'28 plików',
			'29 plików',
			'30 plików',
			'31 plików',	 // many (unlike Russian)
			'32 pliki',		// few
			'33 pliki',
			'34 pliki',
			'35 plików',	 // many
		] },
		ga: { 0: [
			'0 comhad',	// other
			'1 comhad',	// singular
			'2 chomhad',	// two
			'3 chomhad',	// few (3-6)
			'4 chomhad',
			'5 chomhad',
		]},
		cy: { 0: [
			'0 ffeil',     // other
			'1 ffeil',     // singular
			'2 ffeil',     // two
		]},
		fr: { 0: ['0 fichier', '1 fichier', '2 fichiers', '3 fichiers'] },
		es: { 0: ['0 archivos', '1 archivo', '2 archivos', '3 archivos'] },
		'zh-cn': { 0: ['0 文件', '1 文件', '2 文件', '3 文件'] },
		'zh-tw': { 0: ['0 檔案', '1 檔案', '2 檔案', '3 檔案'] },
		'pt-br': { 0: ['0 arquivos', '1 arquivo', '2 arquivos', '3 arquivos'] },
		de: { 0: ['0 Dateien', '1 Datei', '2 Dateien', '3 Dateien'] },
		it: { 0: ['0 file', '1 file', '2 file', '3 file'] },
		cs: { 0: [
			'0 souborů',  // other
			'1 soubor',   // singular
			'2 soubory',  // few (2-4)
			'3 soubory',
			'4 soubory',
			'5 souborů'   // other (5+)
		]},
		bg: { 0: [
			'0 файла',    // other
			'1 файл',     // singular
			'2 файла',    // few (2-...)
			'3 файла',
			'4 файла',
			'5 файла'
		]},
		tr: { 0: ['0 dosya', '1 dosya', '2 dosya', '3 dosya'] },
		hu: { 0: ['0 fájl', '1 fájl', '2 fájl', '3 fájl'] },
		ko: { 0: ['0 파일', '1 파일', '2 파일', '3 파일'] }
	};

	for (const [locale, texts] of Object.entries(TEXTS))
	{
		test(`${locale}の複数形テスト`, () =>
		{
			for (const [offset, correct] of Object.entries(texts))
			{
				check(locale, correct, parseInt(offset));
			}
		});
	}
});