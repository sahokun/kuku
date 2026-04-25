# PR #10 レビュー指摘修正プラン

## タスク概要・目的
PR #10 (sahokun/kuku, develop → main) に対する Copilot Review からの指摘 6 件を、
単一ファイル `index.html` に修正適用する。これにより develop を main へマージできる
品質に揃える。

このプロジェクトは小学2年生向けの九九学習Webアプリで、個人情報を扱わない。
セキュリティ系の指摘は重要度を割り引いて評価したが、今回の 6 件はいずれも
「機能・UX・互換性」観点であり、すべて採用する。

## 採否判断と重要度（2エージェントの分析を統合）

| # | 指摘 | 採否 | 重要度 | 統合判断の根拠 |
|---|---|---|---|---|
| 1 | equation で `stageRight=q.b` が露出（line 1591） | 採用 | HIGH | 学習問題として成立しなくなる機能バグ。両プランナー一致 |
| 2 | prefers-reduced-motion を JS にも反映（line 1599） | 採用 | MEDIUM | アクセシビリティ。実装コスト低 |
| 3 | `-webkit-backdrop-filter` 併記（line 348 .mode-section） | 採用 | LOW | iOS/iPad ターゲットで再現性向上、3行追加のみ |
| 4 | 同上（line 546 .question-area） | 採用 | LOW | 同上 |
| 5 | 同上（line 772 .score-board） | 採用 | LOW | 同上 |
| 6 | `launchBurst` の `target` null 参照（line 1769） | 採用 | MEDIUM | endGame→setTimeout の間に画面遷移されると例外になる |

## 採用アプローチと根拠
- **共通ヘルパー追加**: `prefersReducedMotion()` を 1 つだけ追加し、JS 駆動アニメ
  （`element.animate()`、`launchBurst` の DOM スパーク生成）の両方をガードする。
  → 両プランナー共通の推奨。重複コード回避と将来の拡張性で勝る。
- **stageRight の表示は "?" 文字列に切替**（DOM 削除/`display:none` 等は採らない）。
  → レイアウト崩れを起こさず、`stageNumber` の `${q.a}×?` 表記と整合する。
- **CSS は標準プロパティの直前に `-webkit-` プレフィックスを併記**。検索/置換しやすい慣習に従う。
- **launchBurst の null guard は早期 return**。try/catch より意図が明確。
- **endGame 側の追加防御（GPT 提案）は採用しない**。launchBurst 内の null guard で
  十分カバーでき、変更範囲を局所化したい。

## 実装ステップ（すべて `index.html` 内の局所変更）

### Step 1: 共通ヘルパー `prefersReducedMotion()` を追加
- 場所: `updateStage()` 関数の直前（既存ヘルパー群の近く）
- 内容:
  ```js
  function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  ```

### Step 2: `updateStage()` の修正（指摘1, 2）
- 1591行: `stageRight.textContent = q.b;`
  → `stageRight.textContent = currentQuestionType === "equation" ? "?" : q.b;`
- 1592-1599行: `stageNumber.animate(...)` を `if (!prefersReducedMotion())` でガード

### Step 3: `launchBurst()` の修正（指摘2, 6）
- 関数冒頭の `if (!layer || !app) return;` の直後に:
  ```js
  if (prefersReducedMotion()) return;
  ```
- `const target = ... || document.querySelector('.question-area');` の直後に:
  ```js
  if (!target) return;
  ```

### Step 4: CSS にプレフィックス追加（指摘3-5）
- line 349 `backdrop-filter: blur(8px);` の **直前** に
  `-webkit-backdrop-filter: blur(8px);` を追加（.mode-section）
- line 547 同様に追加（.question-area）
- line 773 同様に追加（.score-board）

## テスト方針（手動・ブラウザ）
1. **段モード（通常出題）**: stageRight に b の数字が表示される（既存挙動維持）
2. **くみあわせ等の equation モード**: stageRight に "?" が表示され、回答後の次問題でも正しく更新される
3. **OS で「視差効果を減らす」ON**: ステージの pop アニメが出ない、正解時のスパーク粒子が出ない、それ以外（テキスト更新・SE・スコア集計）は動く
4. **iOS Safari でガラス背景**: `.mode-section` `.question-area` `.score-board` の背景がぼけて見える
5. **endGame 直後の高速タップ**: 正解→「もういっかい」を 0.18 秒以内に連打してもコンソールエラーが出ない

## リスクと対策
- **reduced motion ユーザーで「正解のフィードバックが弱くなる」可能性**
  → SE と `hit-correct` overlay は別経路で残るため、フィードバック自体は維持。OS で明示的に
     設定したユーザーの意図に沿う挙動なので許容。
- **launchBurst 早期 return で稀に演出が出ない**
  → 高速タップで画面遷移後の稀ケースのみ。例外で止まるよりまし。
- **CSS プレフィックス追加**
  → 副作用なし。

## 影響ファイル
- `index.html` のみ（CSS 部分 3 箇所、JS 部分 3 箇所＋ヘルパー追加）
