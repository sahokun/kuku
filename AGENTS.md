# 九九ぱれーど

<!-- このファイルは AI エージェント（Claude Code・Codex など）と人の両方に向けた、このリポジトリの作業規則。
     「プロジェクト固有」の節はプロジェクトごとに書き換え、「共通の規則」の節は sahokun の全リポジトリで共通に保つ。 -->

## プロジェクト固有

### 概要

子ども（新2年生）向けの九九の学習 Web アプリ。ブラウザだけで動き、ビルドもサーバーも要らない。

- 学習の仕様（上達のステップ・定着・出題・時間・得点）の正は `docs/learning.md`。コードと食い違ったら、どちらが正しいかを確かめて両方を揃える。
- 音声の利用条件と再生成の手順は `docs/VOICE.md`。
- `README.md` は遊ぶ子どもとその家族向け。開発の情報は書かず、この AGENTS.md と `docs/` に書く。

### 技術スタック

- HTML / CSS / Vanilla JavaScript。ビルドツール・フレームワーク・npm の依存は無い。`index.html` が機能別の CSS / JS を `<link>`・`<script>` で読む。
- 音: Web Audio API（音楽・効果音の合成と、同梱した録音音声の再生）。Web Speech API は使わない。
- 描画: SVG・Canvas 2D・WebGL（WebGL が使えないときは CSS の背景に切り替える）。
- 実行時の外部依存は Google Fonts だけ（取得できなくても動く）。

### 構成

```
index.html        画面の構造と読み込み
css/              画面別のスタイル。theme.css は配色・ボタン・共通ナビ、layout.css は画面配置
js/learning.js    学習の判定・出題・保存データの検証（DOM に依存しない。Node のテストの対象）
js/rewards.js     得点・コース・めあて・カレンダー・まぜての出題（同上）
js/app.js         画面・入力・ゲームの進行・停止と復帰
js/journey.js     段のルート・チャレンジ・カレンダー・結果の画面
js/recitation.js  「聞く → 合図 → 復唱」の進行
js/sound.js       音楽・効果音の合成と録音の再生（voice-files.js・voice-manifest.js が音声ファイル）
js/visuals.js     マスコット・粒子・背景の演出
js/store.js       localStorage の読み書き（キーは kuku:learning:v1）
js/version.js     バージョンと「こうしん きろく」
js/diagnostics.js URL が #diagnostics のときだけ動く入力の計測
audio/tsumugi/    録音の MP3 と、file:// 用の同じ内容の JS、manifest
tests/            Node の自動テスト
tools/            起動済みの Chrome で動かすブラウザ検証（tools/README.md）
```

### コマンド

```sh
node --test --experimental-test-isolation=none tests/*.test.cjs   # 自動テスト（CI の learning と同じ）
python3 -m http.server                                             # ローカル配信（index.html を直接開いても動く）
```

### 守ること

- 利用者は新2年生。画面の文字と README はひらがな中心で、漢字は1年生で習うものまで。2年生以降の漢字・難しい言葉は使わない。
- スマホで各画面をスクロールさせない（最大幅 500px のモバイルファースト）。情報が多いときは画面やページを分ける。利用者のピンチズームは妨げない。
- 配色は黄色・黒・白、丸ゴシック体、鳥のキャラクター。
- `file://` で直接開く使い方を残す（音声は `audio/tsumugi/*.js` を使う）。
- 学習の判定は `js/learning.js`・`js/rewards.js` の純粋な関数に置き、テストを足す。
- 仕様を変えたら `docs/learning.md` を直す。利用者に見える変更を出すときは、`js/version.js` の先頭に版（`YYYY.MM.DD`、同じ日の2回目は `.2`）と変更点を足す（形は `tests/version.test.cjs` が確かめる）。
- 正解後の九九の読み上げと、誤答のときの「九九 → いってみよう、せーのっ → 九九」を消さない。読み上げの終わりを待って進める。
- 音声を変えるときは `docs/VOICE.md` の手順で再生成し、MP3・file:// 用の JS・manifest をまとめて更新する。位置を手で直さない。`audio/tsumugi/phrases.json` では「九九」を「くく」と書く（漢字だと「きゅうじゅうきゅう」と読まれる）。
- 音声はアプリの MIT とは別の条件で、「VOICEVOX:春日部つむぎ」のクレジットを画面に出し続ける。

### Issue

- 作業の前に GitHub Issue を確かめ、無ければ作る。1つの Issue を1つの作業単位にする。ラベルは `bug`・`enhancement` など。
- ユーザーの指示がこの文書の規則（特に「共通の規則」のブランチと PR）と食い違うときは、実行の前にユーザーに確かめる。

## 共通の規則

### ブランチと PR

<!-- branch-model:begin -->
- 既定のブランチは `main`。作業はブランチを切り、`main` への PR にする。
- PR は squash merge で取り込む。main の履歴には PR のタイトルだけが 1 コミットとして残る。
<!-- branch-model:end -->
- PR のタイトルは Conventional Commits（`feat: ...`・`fix: ...` など）で、変更の内容が 1 行で分かるように書く。
- PR がマージされたら、作業ブランチは自動で削除される。

### 履歴と公開物に書かないもの

- メールアドレス・トークン・パスワード・個人の環境の情報・AI エージェントのセッションへのリンクを、コミット・PR・Issue・コメントに書かない。
  - 作業ブランチのコミットと PR は、マージ後も GitHub に残り続け、所有者でも消せない。main の履歴も書き換えには強制 push とサポートへの依頼が要る。PR の本文だけは後から編集で直せる。
- コミットの作成者のメールアドレスは、GitHub の noreply アドレス（`<ID>+<ユーザー名>@users.noreply.github.com`）を使う。
- `.env`・鍵ファイル・ローカル設定（`.claude/settings.local.json` など）はコミットしない。

### 依存関係

- 追加・更新する依存は、公開から 7 日以上たったバージョンに限る。公開直後に乗っ取り・差し替えが見つかる事例が多いため。
  - Dependabot のバージョン更新は `cooldown` で 7 日待つ。npm は `.npmrc` の `min-release-age=7` で手作業の更新にも同じ制限を掛ける。
- GitHub Actions のアクションは、フル SHA（40 桁）で固定し、行末にバージョンをコメントで残す（例: `actions/checkout@<SHA> # v7.0.1`）。タグは差し替えられるため。
- Dependabot の PR は、更新を知らせる合図として扱う。CI が通ることと、メジャー更新では変更点を確かめてから取り込む。
