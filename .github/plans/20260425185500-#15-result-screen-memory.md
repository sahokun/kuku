# Plan: Issue #15 リザルト画面メモリ最適化

## タスク概要と目的
iPhone Safari でリザルト画面（特にパーフェクト時 10/10）の演出中にページがリロードされる現象を解消する。原因は短時間に大量の DOM パーティクル（spark / confetti / laser / shooting-star）が積み重なってメモリ不足に陥ること。本タスクでは (1) 同時生存パーティクル数を 200 に制限、(2) `.spark` の重い CSS（多段 text-shadow / filter:brightness アニメーション）を軽減、(3) パーフェクト時の演出連発回数を削減 の3点を index.html 単一ファイルに対して適用し、見栄えを保ちつつ Safari でクラッシュしないようにする。

## 採用アプローチと根拠（2エージェントの統合）
- **上限ガード方式 = 「残数方式」を採用**
  - 各 launch 関数のループ直前で `remaining = 200 - layer.childElementCount` を計算し、要求数とのうち小さい方だけ生成する。
  - 理由：launchBurst の二次バースト（180ms 後の setTimeout 内）や、endGame の連発 setTimeout 群でも、その時点の生存数で再評価できるため厳密。Opus 案の「1個ずつ判定するヘルパー関数」だと launchBurst のように `--x/--y/--spin/--spark-color/--spark-life` を都度 setProperty する処理がループ内で重く、関数化で得られる統一感より残数方式の素直さが勝つ。
  - 共通ロジックは小さなヘルパー `getParticleBudget(layer, requested)` に切り出して4関数で再利用する。
- **text-shadow の強度 = `0 0 12px currentColor` を採用**
  - Opus(10px) と GPT(12px) の中で GPT の 12px を採用。Opus の「白フチ消失で残光感は維持」の方針自体は同意だが、12px の方が暗所視認性が良く 1 段化のデメリットを最小化できる。実機で暗ければ 14px に戻す余地を残す。
  - `filter: brightness(...)` は 0% / 100% キーフレーム両方から削除（両エージェント一致）。
- **連発回数削減の数値**
  - 両エージェントの提案値（8→4 / 6→3 / 8→4）が一致。そのまま採用。
- **cap=200 の妥当性**
  - 単発 launchBurst(isBig=true) は 90 個、二次バースト 50 個 = 最大 140 個。連発で重なる setTimeout 同士の競合が問題なので 200 に余裕がある。実機で不足/余剰なら定数 1 箇所で調整。

## 実装ステップ（具体的なファイルパス・行・差分）

### Step 1: パーティクル上限ヘルパーを追加
- 場所: `index.html` の `function launchLasers(isBig) {` （L2424）の直前
- 追加コード:
```js
    // パーティクル同時生存数の上限。iPhone Safari のメモリ不足対策。
    const PARTICLE_CAP = 200;
    function getParticleBudget(layer, requested) {
      if (!layer) return 0;
      const remaining = PARTICLE_CAP - layer.childElementCount;
      if (remaining <= 0) return 0;
      return Math.min(requested, remaining);
    }
```

### Step 2: launchLasers / launchConfetti / launchShootingStar / launchBurst を上限ガードに置換

**launchLasers (L2428-2430)**
```diff
-      const count = isBig ? 12 : 8;
+      const requested = isBig ? 12 : 8;
+      const count = getParticleBudget(layer, requested);
+      if (count === 0) return;
       const colors = ['#FFD700', '#FF69B4', '#4ECDC4', '#65D6FF', '#A8F04F'];
       for (let i = 0; i < count; i++) {
```

**launchConfetti (L2440-2445)**
```diff
     function launchConfetti(count) {
       if (prefersReducedMotion() || isLegacyFx()) return;
       const layer = document.getElementById('burst-layer');
       if (!layer) return;
+      count = getParticleBudget(layer, count);
+      if (count === 0) return;
       const colors = ['#FFD700', '#FF2FA8', '#22D9FF', '#A8F04F', '#FF7A90', '#9370DB'];
       for (let i = 0; i < count; i++) {
```

**launchShootingStar (L2462-2464)**
```diff
       const layer = document.getElementById('burst-layer');
       if (!layer) return;
+      if (getParticleBudget(layer, 1) === 0) return;
       const colors = ['#FFD700', '#65D6FF', '#FF69B4', '#A8F04F'];
       const star = document.createElement('div');
```

**launchBurst 一次バースト (L2490-2502)**
```diff
-      const count = legacy
+      const requested = legacy
         ? (isBig ? 42 : (isCorrect ? 28 : 18))
         : (isBig ? 90 : (isCorrect ? 60 : 36));
+      const count = getParticleBudget(layer, requested);
       const symbols = isCorrect
         ? (legacy ? ['★', '×', '+', '♪'] : ['★', '✦', '♥', '♪', '✿', '◆', '✺'])
         : (legacy ? ['×', '?', '！'] : ['×', '?', '！', '✗']);
       const colors = isCorrect
         ? (legacy
           ? ['#FFD700', '#FF69B4', '#4ECDC4', '#A8F04F', '#65D6FF']
           : ['#FFD700', '#FF69B4', '#4ECDC4', '#A8F04F', '#65D6FF', '#FF2FA8', '#FFFFFF'])
         : ['#FF7A90', '#9370DB', '#FFD700'];

       for (let i = 0; i < count; i++) {
```
※ count=0 でも legacy 早期 return ロジックを壊さないよう、ループは for で自然にスキップ（早期 return は入れない）。

**launchBurst 二次バースト (L2531-2536)**
```diff
       if (isCorrect) {
         setTimeout(() => {
-          const secondCount = isBig ? 50 : 30;
+          const secondRequested = isBig ? 50 : 30;
+          const secondCount = getParticleBudget(layer, secondRequested);
+          if (secondCount === 0) return;
           for (let i = 0; i < secondCount; i++) {
             const spark = document.createElement('span');
             const angle = (Math.PI * 2 * i / secondCount) + Math.PI / secondCount;
```

### Step 3: .spark CSS 軽減

**L383**
```diff
-      text-shadow: 0 2px 0 rgba(255,255,255,0.9), 0 0 14px currentColor;
+      text-shadow: 0 0 12px currentColor;
```

**L491-495 sparkFly キーフレーム**
```diff
     @keyframes sparkFly {
-      0% { opacity: 1; transform: translate3d(-50%, -50%, 0) scale(0.3) rotate(0deg); filter: brightness(2); }
+      0% { opacity: 1; transform: translate3d(-50%, -50%, 0) scale(0.3) rotate(0deg); }
       30% { opacity: 1; transform: translate3d(calc(var(--x) * 0.45 - 50%), calc(var(--y) * 0.4 - 50%), 0) scale(1.6) rotate(calc(var(--spin) * 0.4)); }
       72% { opacity: 1; transform: translate3d(calc(var(--x) * 0.85 - 50%), calc(var(--y) * 0.85 - 50%), 0) scale(1.4) rotate(calc(var(--spin) * 0.8)); }
-      100% { opacity: 0; transform: translate3d(calc(var(--x) - 50%), calc(var(--y) + 60px - 50%), 0) scale(0.6) rotate(var(--spin)); filter: brightness(0.6); }
+      100% { opacity: 0; transform: translate3d(calc(var(--x) - 50%), calc(var(--y) + 60px - 50%), 0) scale(0.6) rotate(var(--spin)); }
     }
```

### Step 4: endGame() の連発回数削減

**L2593 紙吹雪連発のパーフェクト時上限**
```diff
-          const burstCount = isPerfect ? 8 : Math.min(5, Math.ceil(score / 2));
+          const burstCount = isPerfect ? 4 : Math.min(5, Math.ceil(score / 2));
```

**L2601 花火＋レーザー連発回数**
```diff
-          for (let i = 0; i < 6; i++) {
+          for (let i = 0; i < 3; i++) {
             setTimeout(() => {
               launchBurst(true, true);
               launchLasers(true);
             }, 700 + i * 450);
           }
```

**L2607 流れ星連発回数**
```diff
-          for (let i = 0; i < 8; i++) {
+          for (let i = 0; i < 4; i++) {
             setTimeout(launchShootingStar, 600 + i * 250);
           }
```

## テスト方針
- **PC ブラウザでの機能確認**: `index.html` を Chrome / Firefox で開き、(a) 通常正解時のバースト演出、(b) スコア 1〜9 の通常リザルト、(c) スコア 10/10 のパーフェクトリザルト の3シナリオで演出が再生されることを目視確認。
- **DOM ノード数計測**: Chrome DevTools の Console で `setInterval(() => console.log(document.getElementById('burst-layer').childElementCount), 200)` を仕掛け、10/10 演出中のピーク値が 200 を超えないこと、最終的に 0 に戻ることを確認。
- **Performance パネル**: Recording 中に Layout/Paint の Long Task が大幅に減っていることを確認（特に sparkFly の filter 削除効果）。
- **iPhone Safari 実機**: 10/10 を最低 3 回連続で出して、リロード（Safari の "A problem occurred with this webpage" を含む）が発生しないこと、演出が最後まで再生されることを確認。
- **後方互換**: 正解/不正解時の単発 launchBurst（最大 90 個）は cap=200 内に収まるため見た目に変化なし。`prefersReducedMotion` / `isLegacyFx` のショートカットは触らないので既存挙動を維持。

## リスクと対策
- **演出見栄えの劣化（白フチ・brightness 喪失）**
  - 対策: text-shadow を 10px ではなく 12px に設定し残光感を確保。実機で暗ければ L383 の 12px → 14px に微調整可能（1 行）。
- **正解時演出への副作用**
  - 対策: 単発 launchBurst の最大個数 90 < cap=200 なので、ゲーム中の正解演出は影響を受けない。endGame の連発時のみガードが効く設計。
- **パーフェクト時の華やかさ低下**
  - 対策: 回数を半減しても 1 回あたりは isBig=true のフル演出（90 spark + 12 laser、その後二次 50 spark）が走るため、視覚的な「うわっ」感は残る。実機評価後に増減可。
- **cap=200 が大きすぎ/小さすぎ**
  - 対策: 定数 `PARTICLE_CAP` を 1 箇所変更するだけで全 launch に波及する設計。Safari クラッシュが続く場合は 150 → 120 と段階的に下げる。
- **getParticleBudget の二次バースト評価タイミング**
  - 対策: 180ms 後に再計算するため、一次バーストの spark が remove() される前でも残数を正しく見積もれる。`if (secondCount === 0) return;` で早期離脱しメモリ確保失敗を防ぐ。

## ファイル一覧
- 変更: /home/wsl/workspace/kuku/index.html
