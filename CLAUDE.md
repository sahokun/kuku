# 九九学習アプリ

## プロジェクト概要
- 子ども向けの九九（かけ算）学習Webアプリ
- ブラウザで動作するインタラクティブなクイズ形式
- かわいいデザインと音声読み上げで楽しく学習できる
- 段ごと・範囲指定・くみあわせなど多彩な出題モード

## 技術スタック
- HTML5 / CSS3 / Vanilla JavaScript（単一ファイル構成）
- Web Audio API（BGM・効果音の生成）
- Web Speech API（九九の日本語読み上げ）
- Google Fonts（M PLUS Rounded 1c）
- ビルドツール・フレームワーク不使用

## 開発環境
- WSL2 (Linux)
- ブラウザで `index.html` を直接開いて動作確認

## プロジェクト構造
```
kuku/
├── index.html    # アプリ本体（HTML/CSS/JS すべて含む）
├── CLAUDE.md     # プロジェクト指示書
├── .gitignore
└── .claude/      # Claude Code 設定
```

## 設計方針
- モバイルファースト・レスポンシブデザイン（最大幅500px）
- かわいいデザイン（パステルカラー、丸ゴシック体、アニメーション）
- 外部依存を最小限に（CDN のフォント読み込みのみ）
- ブラウザ単体で完結（サーバー・ビルド不要）
- 単一ファイル構成（`index.html` にすべて集約）

## ターゲットユーザー
- 対象: 新2年生（1年生修了程度）
- UI テキストはひらがな中心。1年生で習う漢字（一〜十など）は可。2年生以降の漢字・難しい言葉は使わない

## 注意事項
- `.ai/` ディレクトリはユーザーのメタデータ領域。明示的な指示がない限り閲覧・変更しない
- Claudeの思考は英語で行い、返答は日本語で行う
- **ユーザーの指示がこのドキュメントのルール（特に Git 運用ルール）と矛盾する場合は、実行前にユーザーに確認を取ること**

## Git運用ルール

### ブランチ戦略: `main` ← `develop` ← `feature/*` の3層

| ブランチ | 役割 | 誰が操作 |
|---------|------|---------|
| `main` | 本番リリース | ユーザーのみ |
| `develop` | 動作確認・自動デプロイ | Claude (squash merge のみ) |
| `feature/*` | 開発作業 | Claude (自由にコミット) |

### feature/* ブランチでの作業
- `develop` から作成（例: `git checkout -b feature/22-branch-strategy develop`）
- 細かいコミットOK（WIP、実験、修正など自由）
- `git push -u origin feature/*` でリモートにバックアップ

### feature/* → develop: Squash Merge
- 実装完了時に `git checkout develop && git merge --squash feature/xxx` で反映
- `git merge` は必ず `--no-edit` を付ける（エディタが起動してターミナルが応答不能になるのを防ぐ）
- **1つの機能 = develop 上で1コミット**（動作確認の単位）
- コミットメッセージ形式:
  ```
  機能の概要 #Issue番号

  - 変更点1
  - 変更点2

  Fixes #N

  Co-Authored-By: Claude Code <noreply@anthropic.com>
  ```
- マージ後に feature ブランチを削除（ローカル + リモート）
- **squash merge 後は `git push origin develop` まで行う**（ユーザーがすぐ動作確認できるように）
- push 前は必ず `git fetch origin` でリモートの状態を確認し、ローカルが遅れていないかチェックする

### develop → main: ユーザー指示のみ
- ユーザーが develop で動作確認後に実施
- Claudeは `main` に直接 push/merge しない

### 大きな機能（複数回の動作確認が必要な場合）
- サブ機能に分割: `feature/22-part1-api`, `feature/22-part2-ui`
- 各サブ機能を個別に squash merge = 個別の動作確認単位

## Issue駆動開発
- 作業開始前にGitHub Issueを確認・作成する
- Issueラベル: `bug`, `enhancement` など
- 1つのIssueは1つの作業単位に対応させる
