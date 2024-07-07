# Change Log

## 日本語(Japanese)

[English is here](#english英語)

### [2.0.0] - 2024-07-07

#### 追加
- ファイルを選択した時に操作メニューを表示する機能を追加し、それをディフォルトの動作にした。
- 絶対パス表示と相対パス表示を切り替える機能を追加。
- 基準ディレクトリからの経路にあるディレクトリを表示するようにした。
- 階層をインデントで表すようにした。
- クイックアクセス機能を追加。アイテムのピンボタンでクイックアクセスにピン留めできます。ピン留めしたアイテムは表示しているディレクトリに関係なく常に表示されるようになります。
- お気に入り機能を追加。アイテムの☆ボタンでお気に入りに登録できます。お気に入りは `Romly: Path-Maker - Favorites` で呼び出せるようになります。
- 履歴機能を追加。使用したパスは自動的に保存され、 `Romly: Path-Maker - History` で呼び出せるようになりました。
- ファイル／ディレクトリの数を表示するようにした。
- ディレクトリ／ファイルを表示する最大数を設定できるようにした。
- 「このディレクトリをエクスプローラーで開く」コマンドを追加。
- 「パスを入力して移動」から元のディレクトリに戻れるようにした。

#### 変更
- 上の階層へ戻るアイテムのアイコンをフォルダから矢印に変更しました。
- 「パスを入力して移動」でディレクトリが見付からない場合はエラーを表示するようにした。
- ユーザー名ディレクトリを隠す時の代替文字列を指定できるようにした。

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

### [2.0.0] - 2024-07-07

#### Added
- Added a feature to display an action menu when a file is selected, and made this the default behavior.
- Added a feature to switch between absolute path and relative path.
- Now displaying directories along the path from the base directory.
- Implemented indentation to show hierarchical structure.
- Added the quick access list. You can pin items to the quick access using the pin button. Pinned items will always be displayed regardless of the current directory.
- Added the favorite list. You can add items to favorites using the ☆ button. Favorites can be accessed via `Romly: Path-Maker - Favorites`.
- Added history feature. Used paths are now automatically saved and can be recalled using `Romly: Path-Maker - History`.
- Display the number of files/directories.
- Implemented a feature to set the max number of directories/files to display.
- Added "Open this directory in Explorer" command.
- Now it's possible to return to the directory where you were from "Enter path to move".

#### Changed
- Changed the icon for the item to go up from a folder to an arrow.
- Now displaying an error message when a directory is not found using "Go to input path".
- Added the ability to specify an alternative string when hiding the username in paths.

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
