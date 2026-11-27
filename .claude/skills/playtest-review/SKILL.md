---
name: playtest-review
description: |
  kuku-playtest（AIテスター muse による九九ぱれーどの日次プレイテスト）の新着報告を取り込み、
  コードと docs/learning.md で裏取りして対応を自分で判断し、修正・確認・develop反映・テスト版の版確認・
  kuku-playtest の印付けまでを一回で行う。「プレイテスト確認」「playtest」「museの報告」「テストプレイ」で使う。
---

# プレイテスト対応（/playtest-review）

## 前提と役割

| 項目 | 内容 |
| --- | --- |
| テスター | muse（AI）。九九を知らない小学2年生として毎日約10分プレイし、ブラウザ自動操作で遊ぶ |
| 報告先 | 非公開リポジトリ `sahokun/kuku-playtest` のIssue（下表）。**Issueのコメントが正**。リポジトリ内の .md は 11/11 以降更新されていない |
| テスト版 | Cloudflare Pages。`develop` に入る（PR のマージ）と自動配信。URLはこのファイル末尾の「環境メモ」 |
| 本番 | GitHub Pages（`main`）。PR・マージはユーザーのみ。触らない |
| muse への伝達 | アプリ内の「メニュー → こうしん きろく」（`js/version.js`）だけ。kuku-playtest へ新しいコメントは書かない |

| Issue | 中身 |
| --- | --- |
| #1 日次ログ | 2026-11-18 の分まで、1日1コメント。到達点・学習状況・新規報告No.・追記したNo. |
| #2 不具合まとめ | 2026-11-18 の分まで、日付ごとのコメントにチェック行 `- [ ] No.N: タイトル（報告No.N／要望M）` |
| #3 UI・分かりにくさまとめ | 同上 |
| #4 成長阻害まとめ | 同上 |
| 日ごとのIssue（#7 以降） | 2026-11-19 の分から、1日1Issue。本文に到達点・学習の進み具合・新規報告のチェック行・再現と解消の確認。要望は `- [ ] 要望N: …` の行 |

ユーザーからの委任: **対応の要否・方法は自分で判断して自分で直し、自分で確認する**。ユーザーに頼むのは環境構築など、どうしても自分でできないことだけ。dev-workflow-solo などの別スキル・サブエージェントには任せない。

## 手順

### 1. 取り込み

```sh
git fetch origin && git status -sb          # develop が origin と揃っているか
gh api "repos/sahokun/kuku-playtest/issues/comments?per_page=100" \
  --jq '.[] | {id, issue: (.issue_url|split("/")|last), created_at, updated_at, body}'
gh issue list -R sahokun/kuku-playtest --state all --json number,title,state   # 新しい日のIssueが増えていないか
.claude/skills/playtest-review/unmarked.sh   # 印のないチェック行（コメントと日ごとのIssue本文の両方）
```

- **未処理の判定は印で行う**: チェック行のうち、✅ / ➖ / ⏸ の印がない行が未処理（`unmarked.sh` が一覧する）。台帳は別に作らない。
- 日ごとのIssue（#7 以降、`gh issue view <N> -R sahokun/kuku-playtest`）と日次ログ（#1）は、前回の対応以降の日を読む。チェック行だけでなく「再現・解消の確認」も読み、同じ問題のくり返しを拾う。到達点の停滞、同じ問題のくり返し、「〇〇に追記」とされたNo.を拾う。
- muse の追記本文の多くは muse 側の資料にあり、GitHub には要約しかない。GitHub にある情報だけで判断する。
- 日次ログに書かれたバージョンを見て、**どの版での観察か**を確かめる。修正前の版での報告を「再発」と扱わない。

### 2. 裏取りと判定

各報告を、該当コードと `docs/learning.md` に照らして次の4つに分ける。

| 判定 | 基準 | 対応 |
| --- | --- | --- |
| 本当の不具合 | コード上で起こりうる。子どもにも起こる | 直す → ✅ |
| 仕様どおり・説明不足 | 仕様どおりだが、画面から理由が読めない | 画面の説明を足す。必要なら仕様も直す → ✅ |
| テストのやり方による誤り | 自動操作の遅れ・見落とし・取り違え。コードで否定できる | 直さない → ➖ |
| 仕様の判断が必要 | 学習設計に関わる | 自分で判断する。今回やらないものは理由を書いて ⏸ |

muse の観察を読むときの注意:
- 自動操作は1回の操作に数秒かかる。「時間切れ」「入力が次の問題に入る」「画面がすぐ進む」は、まずコードで確かめる。
- 「即答0回」はシミュレーションの設定による。muse の回答時間だけを根拠に難しさを調整しない。
- 前の問題の復唱（まずは きいてね → せーのっ → いっしょに）を「次の問題の前に答えが出る」と書くことがある。
- muse はホームの「つぎは これ！」に従って遊ぶ。おすすめの作りが、そのまま到達点に表れる。
- muse はページの文字を DOM から読むので、透明・`hidden` の要素に残った文字も「表示された」と書くことがある（例: 前の回の「10れんぞく！」、消えた後の通知）。画面に出る条件（CSS・`hidden`）までコードで確かめる。
- 自動操作は、押せないボタンへのクリックを、押せるようになるまで待ってから押すことがある。子どもには起きないので、入力の持ち越し（No.22）の再発は、まずこれを疑う。
- muse が引用する「こうしん きろく」の文言は、`js/version.js` と照らす。無い文言を引用していることがある。

主なコードの場所: 進行・入力・タイマーは `js/app.js`（`next` `digit` `answer` `tick`）、定着・星・おまかせ時間は `js/learning.js`（`submitAttempt` `roundPace` `mapStars`）、おすすめ・まぜて・段クリア・めあては `js/rewards.js`（`plan` `mixPlan` `recordRun` `missions`）、結果一覧は `js/results.js`、ルート・結果画面は `js/journey.js`、復唱の流れは `js/recitation.js`。

### 3. 修正（AGENTS.md の「ブランチと PR」どおり）

1. `sahokun/kuku` にIssueを作る。ラベルは `playtest` と `bug` / `enhancement`。1回の対応を1つのIssueにまとめてよい。大きな機能は別のIssueにする。
2. `git fetch origin && git checkout -b fix/<Issue番号>-playtest-<内容> origin/develop`
3. 実装する。仕様を変えたら `docs/learning.md` と `README.md` も直す。UIの文字はひらがな中心（AGENTS.md）。
4. `js/version.js` の先頭に、その日のバージョン（`YYYY.MM.DD`、同じ日の2回目は `.2`）と変更点を足す。変更点は muse が読んで「何を確かめればよいか」が分かる書き方にする。例: 「〇〇の とき、△△に なるように した」
5. 確認する。
   - `node --test --experimental-test-isolation=none tests/*.test.cjs`
   - ブラウザで確認する。`python3 -m http.server` などでローカル配信し、Playwright MCP（`chrome-devtools-wsl-windows` スキル）で 375×667 と 320×480 にして、直した画面を実際に操作する。時計に関わるものは `browser_evaluate` で状態を作る。
   - 保存データ `kuku:learning:v1` は、確認の前に退避して後で戻す。アプリは離脱時に今の状態を保存し直すので、確認用のデータは同じ配信元のアプリ以外のページ（例: `/README.md`）で書き込んでから `index.html` を開く。
   - `tools/verify-*.mjs` は CDP で起動済みの Chrome が必要。使えるときだけ使う（`tools/README.md`）。
6. コミットして push し、develop への PR を作る。PR のタイトルは Conventional Commits（例: `fix: プレイテスト第5回の対応（…）`）、本文の末尾に `Fixes #N`。
7. CI（`learning` など）が通ったら、自分で squash merge する（`gh pr merge <番号> --squash`。2026-11-27 にユーザーが「PR にして自分でマージ」と決めた）。作業ブランチは自動で削除される。ローカルの develop を `git pull --ff-only` で揃える。
8. 1〜2分後、テスト版の `js/version.js` を取得し、新しいバージョンになったことを確かめる。変わらないときは、ほかのファイル（例: `AGENTS.md`）がどのコミットの内容かも見て、配信が止まっていないかを確かめる（止まっていたらユーザーに Cloudflare の確認を頼む）。

### 4. kuku-playtest の印付け（管理用。muse は読まない）

チェック行を、コメント本文（#2〜#4）または日ごとのIssueの本文の書き換えで更新する。新しいコメントは書かない。

```
- [x] ✅ 元の行 → v2026.11.16（sahokun/kuku#27）：何をしたか（短く）
- [x] ➖ ~~元の行~~ → 対応なし：理由（短く）
- [ ] ⏸ 元の行 → 次回以降：何を検討するか
```

報告No.→判定の表を JSON で scratchpad に書き、`mark.py` で置き換える（印のない行だけを変え、表に無いチェック行があれば失敗する。表の形は `mark.py` の先頭）。⏸ の項目は、次の回で直したら手で ✅ に書き換える。

- `- []`（スペースなし）はチェックボックスとして表示されないので、`- [ ]` / `- [x]` に直す。
- チェック行の下の説明の行は変えない。
- 書き換える直前に本文を取り直し、その間に muse が編集していないか確かめる。

```sh
M=.claude/skills/playtest-review/mark.py
gh api repos/sahokun/kuku-playtest/issues/comments/<ID> --jq .body > body.md   # 日ごとのIssueは issues/<N>
python3 -I $M table.json body.md body.out.md
gh api -X PATCH repos/sahokun/kuku-playtest/issues/comments/<ID> -F body=@body.out.md   # 日ごとのIssueは issues/<N>
```

- そのIssueのチェック行がすべて ✅ か ➖ になったら（チェック行の無い日も）、Issue を close してよい。⏸ が残る日のIssueと日次ログ #1 は開いたままにする。

### 5. 報告（ユーザーへ、短く）

- 取り込んだ範囲（何日目まで）と、件数を判定ごとに
- 直したこと（バージョン、kuku Issue）と、確認した内容
- ➖ と ⏸ の理由
- muse のログから見える学習の進み具合の変化。前の版と比べて良くなったか
- ユーザーにしか頼めないことがあれば、それだけ

## 環境メモ

- テスト版URL: https://kuku-develop.pages.dev/ （Cloudflare Pages プロジェクト `kuku-develop`、本番ブランチ develop。版の確認は `curl -s https://kuku-develop.pages.dev/js/version.js | grep version:`）
- 本番: https://sahokun.github.io/kuku/
- 旧テスト版（ChatGPT Sites、もう更新できない）: https://kuku-developer-check.aaoutaa.chatgpt.site/
