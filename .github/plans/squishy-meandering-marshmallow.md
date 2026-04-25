# CLAUDE.md 統合プラン

## Context

プロジェクトルート (`CLAUDE.md`) と `.claude/CLAUDE.md` の2ファイルがほぼ同一内容で存在している。
2つとも同じスコープで読み込まれるため冗長。
唯一の差異は `Co-Authored-By` の値のみ。

- ルート: `Claude Opus 4.6 <noreply@anthropic.com>`
- .claude/: `Claude Code <noreply@anthropic.com>`

ユーザー方針: **`Co-Authored-By` を `Claude Code` に統一したうえで `.claude/CLAUDE.md` を削除する**。

## 変更手順

### 1. `CLAUDE.md`（ルート）を編集

対象行（Squash Merge コミットメッセージテンプレート内）:
```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```
↓ 変更後
```
Co-Authored-By: Claude Code <noreply@anthropic.com>
```

### 2. `.claude/CLAUDE.md` を削除

```
rm .claude/CLAUDE.md
```

## 変更ファイル

- `/home/wsl/workspace/kuku/CLAUDE.md` — Co-Authored-By を1行修正
- `/home/wsl/workspace/kuku/.claude/CLAUDE.md` — 削除

## 検証

- ルートの `CLAUDE.md` に `Claude Code` の記述があることを確認
- `.claude/CLAUDE.md` が存在しないことを確認
- `.claude/` ディレクトリ自体は残存（plans/, memory/ などが存在するため）
