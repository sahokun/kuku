# 検証ツール

アプリの実行にこれらのツールは不要です。自動テストはリポジトリ直下のREADMEを参照してください。

## ブラウザ検証

Node.jsからCDPで起動済みChromeへ接続します。対象はこのチェックアウトの `index.html` を直接開いた既存タブです。ブラウザやタブの起動・終了は行いません。

| スクリプト | 確認する内容 |
| --- | --- |
| `verify-browser.mjs` | 学習の進行、保存、回答時間、画面遷移、音声・演出 |
| `verify-mobile.mjs` | 縦7条件・横1条件の画面配置、初期倍率、結果表示、CPU負荷 |
| `verify-voice.mjs` | 録音の準備範囲、待機、再試行、中断 |
| `verify-diagnostics.mjs` | 診断条件の切り替え、停止の検出、通常データの保護 |

第1引数はCDP接続先です。省略時は `http://127.0.0.1:9223` を使います。以下は接続先を明示する例です。実際に起動しているChromeの接続先へ置き換えてください。

```sh
node tools/verify-browser.mjs http://127.0.0.1:9223
node tools/verify-mobile.mjs http://127.0.0.1:9223
node tools/verify-voice.mjs http://127.0.0.1:9223
node tools/verify-diagnostics.mjs http://127.0.0.1:9223
```

スクリプトは同じタブを操作するため1本ずつ実行します。Windows Chromeへの接続でWindows版Node.jsを使う場合、スクリプトのパスもWindowsからアクセスできる形式で渡してください。

## 保存データと後始末

検証に応じて学習状態・時計・音声処理を一時的に差し替えます。元の `kuku:learning:v1` を退避し、終了時の `finally` で保存状態を戻してページを再読み込みします。診断の検証では `kuku:diagnostics:learning:v1` も復元します。検証中は同じ配信元の別タブでアプリを操作しないでください。

画面サイズやCPU制限など、各ツールが変更したCDP設定も終了時に戻します。プロセスの強制終了・ブラウザ切断では後始末が完了しない場合があります。

スクリーンショットはWindowsでは `%TEMP%/kuku-check`、その他では `/tmp/kuku-check` に保存します。実際のファイルパスは `SCREENSHOT` 行で出力します。`PASS` は各確認項目の通過を表し、失敗は例外と非ゼロの終了コードで知らせます。Chromeのエミュレーション・CPU制限での結果はiPhone実機の検証結果とは区別してください。

## 音声の生成

`generate-voice.py` の準備・実行方法と音声の利用条件は [音声ファイル](../docs/VOICE.md) を参照してください。
