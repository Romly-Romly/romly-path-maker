import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

import { i18nPluralWithLocale, COMMON_TEXTS } from '../i18n';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
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

	test('英語の複数形テスト', () =>
	{
		const correct = ['0 files', '1 file', '2 files', '3 files'];
		check('en', correct);
	});

	test('日本語の複数形テスト', () =>
	{
		const correct = ['0 ファイル', '1 ファイル', '2 ファイル'];
		check('ja', correct);
	});

	test('アラビア語の複数形テスト', () =>
	{
		const correct1 =
		[
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
		];
		const correct2 =
		[
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
		];
		check('ar', correct1);
		check('ar', correct2, 99);
	});

	test('ロシア語の複数形テスト', () =>
	{
		const correct =
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
		];
		check('ru', correct);
	});

	test('ポーランド語の複数形テスト', () =>
	{
		const correctPolish =
		[
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
		];
		check('pl', correctPolish);
	});

	test('アイルランド語の複数形テスト', () =>
	{
		const correct =
		[
			'0 comhad',	// other
			'1 comhad',	// singular
			'2 chomhad',	// two
			'3 chomhad',	// few (3-6)
			'4 chomhad',
			'5 chomhad',
		];
		check('ga', correct);
	});

	test('ウェールズ語の複数形テスト', () =>
	{
		const correct =
		[
			'0 ffeil',     // other
			'1 ffeil',     // singular
			'2 ffeil',     // two
		];
		check('cy', correct);
	});
});