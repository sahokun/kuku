#!/usr/bin/env bash
# kuku-playtest の、印（✅ / ➖ / ⏸）のないチェック行を一覧する。
# チェック行は、まとめIssue（#2〜#4）のコメントと、日ごとのIssue（2026-11-19 以降）の本文の両方にある。
# 出力: 「場所<TAB>行」。場所は comment:<コメントID>（Issue番号） または issue:<Issue番号>。
set -euo pipefail
readonly REPO='sahokun/kuku-playtest'
readonly FILTER='split("\n")[] | select(test("^- \\[ ?\\] ") and (test("✅|➖|⏸") | not))'

gh api --paginate "repos/${REPO}/issues/comments?per_page=100" --jq "
  .[] | select((.issue_url | split(\"/\") | last) != \"1\")
  | \"comment:\(.id)（#\(.issue_url | split(\"/\") | last)）\" as \$where
  | .body | ${FILTER} | \"\(\$where)\t\(.)\""

gh api --paginate "repos/${REPO}/issues?state=all&per_page=100" --jq "
  .[] | select(.pull_request | not) | select(.number != 1)
  | \"issue:\(.number)\" as \$where
  | (.body // \"\") | ${FILTER} | \"\(\$where)\t\(.)\""
