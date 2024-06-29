# Change Log

## 日本語(Japanese)

[English is here](#english英語)

### [1.2.2] - 2024-06-29

#### 変更
- ディレクトリに移動するコマンドでdetailに表示されていたパスをdescriptionに表示するよう変更。
- 「このディレクトリをCodeで開く」を現在のウィンドウで開くよう変更し、新しいウィンドウで開くためのボタンを追加。

### [1.2.1] - 2024-06-27

#### 修正
- ディレクトリ／ファイル分割表示設定、隠しファイル表示設定が切り替わらない事があるバグを修正。
- 拡張機能のアイコンの背景が透過されていなかった問題を修正。
- 前回表示したディレクトリに相対パスが書き込まれていた場合に意図しないディレクトリが表示されてしまっていた不具合を修正。
- 存在しないディレクトリに移動しようとした時にエラーになっていた不具合を修正。
- 編集中のファイルが未保存の時に「編集中のファイルのディレクトリに移動する」コマンドが表示されないよう修正。
- `hideUserName`設定がtrueの時に一部にユーザー名が含まれるファイル名も隠してしまっていた不具合を修正。

### [1.2.0] - 2024-06-25

#### 追加
- 基準ディレクトリにジャンプするコマンドを追加。
- パスを入力して移動するコマンドを追加。
- ディレクトリとファイルを分けて表示する設定を切り替えるボタンを追加。
- パスをエディタに挿入する機能を追加

#### 修正
- 表示言語がja/en以外の時にエラーになってしまっていた不具合を修正。
- ディレクトリとファイルを分けて表示する設定、隠しファイルの表示設定が意図せずワークスペース設定に書き込まれていた不具合を修正。

### [1.1.0] - 2024-06-12

- READMEに英語訳を追加。
- ディレクトリをVS Codeで開くコマンドを追加。

### [1.0.1] - 2024-06-11

- アイコンを追加。

### [1.0.0] - 2024-06-11

- 初回リリース。





-----





## English(英語)

[日本語(Japanese)はこちら](#日本語japanese)

### [1.2.2] - 2024-06-29

#### Changed
- Modified the command for go to directories to display the path in the description instead of the details.
- Changed "Open this directory in Code" to open in the current window and added a button to open in a new window.

### [1.2.1] - 2024-06-27

#### Fixed
- Fixed a bug the directory/file split display setting and the hidden file display setting sometimes wouldn't toggle properly.
- Fixed an issue the background of extension icons wasn't transparent.
- Fixed a bug unintended directory was displayed if a relative path was written to the last viewed directory.
- Fixed an issue where an error occurred when trying to go to a directory that doesn't exist.
- Modified the "Go to editing file directory" command to not appear when the active editor file is unsaved.
- Fixed a bug where filenames partially containing the username were also hidden when the `hideUserName` setting is true.


### [1.2.0] - 2024-06-25

#### Added
- Added a function to jump to the base directory.
- Added a function to jump to input path.
- Added a toggle button to switch between displaying directories and files separately or together.
- Added a feature to insert the path to the editor.

#### Fixed
- Fixed a bug where an error occurred when the display language was set to something other than ja/en.
- Fixed an issue where settings for displaying directories and files separately, and showing hidden files, were unintentionally being written to the workspace settings.

### [1.1.0] - 2024-06-12

- Added English translation to the README.
- Added a function that open the directory in VS Code.

### [1.0.1] - 2024-06-11

- Added icon.

### [1.0.0] - 2024-06-11

- Initial release.
