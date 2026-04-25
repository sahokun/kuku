## Plan: README作成 + main マージ

GitHub Pages URL（https://sahokun.github.io/kuku/）を含む README.md を作成し、
既存の差分（CLAUDE.md・.github/agents/）とまとめて feature ブランチでコミット → develop squash merge → main マージまで実施する。

> ⚠️ 注意: ユーザーは「masterマージ」と言っているが、このリポジトリの本番ブランチは `main`（`master` ブランチは存在しない）。
> deploy.yml も `push: branches: [main]` なので、`main` へのマージとして進める。

---

**Steps**

1. **feature ブランチ作成**
   - `develop` から `feature/readme-and-docs` を作成
   - `git checkout -b feature/readme-and-docs develop`

2. **README.md を作成**（ルート `/home/wsl/workspace/kuku/README.md`）
   - 内容構成:
     - タイトル: `# 九九学習アプリ`
     - GitHub Pages バッジ / リンク: `https://sahokun.github.io/kuku/`
     - アプリの概要（子ども向け九九学習Webアプリ）
     - 機能一覧（段ごと練習、自由選択モード、問題数設定、音声読み上げ、BGM/効果音）
     - 技術スタック（HTML5/CSS3/Vanilla JS、Web Audio API、Web Speech API）
     - ローカル動作確認方法（`index.html` をブラウザで開くだけ）

3. **全変更をステージ & コミット**
   - `git add README.md CLAUDE.md .github/agents/`
   - コミットメッセージ（feature ブランチは自由形式でOK）:
     ```
     Add README.md and update docs
     ```

4. **develop へ squash merge**
   - `git checkout develop`
   - `git merge --squash feature/readme-and-docs`
   - CLAUDE.md のコミットメッセージフォーマットに従ったコミット:
     ```
     README.md 作成・docs 更新 #(Issue番号なし → 省略)

     - README.md を新規作成（GitHub Pages リンク・機能説明・技術スタック）
     - CLAUDE.md の Co-Authored-By 表記を修正
     - .github/agents/Plan(Advanced).agent.md を追加

     Co-Authored-By: Claude Code <noreply@anthropic.com>
     ```
   - `git push origin develop`

5. **feature ブランチ削除**
   - `git branch -d feature/readme-and-docs`
   - リモートは未 push なので削除不要

6. **develop → main マージ**（ユーザー明示指示のため実施）
   - `git checkout main`
   - `git merge develop`
   - `git push origin main`（deploy.yml が起動し GitHub Pages に自動デプロイ）

7. **develop へ戻る**
   - `git checkout develop`

**Verification**

- `main` push 後は GitHub Actions の Pages デプロイが成功していることを確認
- `https://sahokun.github.io/kuku/` でアプリが表示されればOK
- `git log --oneline main` で squash コミットが1つ入っていることを確認

**Decisions**

- "masterマージ" → `main` マージとして解釈（`master` ブランチは存在しない）
- Issue番号なし → コミットメッセージの `Fixes #N` 行は省略
- feature ブランチはリモートへ push せず（ローカルのみ）
