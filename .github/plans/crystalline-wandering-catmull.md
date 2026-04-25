# 実装プラン: Issue #4 メニューデザイン変更 + CLAUDE.md ターゲット追加

## Context
Issue #4 の要件として、タイトル画面のメニューレイアウトを2点変更する。
また、ユーザー指示により CLAUDE.md に対象ユーザー（新2年生）を追記する。

---

## 変更1: CLAUDE.md ターゲットユーザー追記

**対象ファイル**: `/home/wsl/workspace/kuku/CLAUDE.md` と `/home/wsl/workspace/kuku/.claude/CLAUDE.md`

`## 設計方針` セクションに以下を追加:

```
- 対象ユーザー: 新2年生（1年生修了程度）
- UI テキストは1年生で習う語彙・ひらがな中心。2年生以降の漢字・難語は使わない
```

---

## 変更2: 九九のひょう ボタンを おんがく と だんをえらんでね の間に移動

**対象ファイル**: `index.html`

### HTML変更
- 現在位置 (line 677-679): まとめてセクションの後
- 移動先: おんがくセクション (line 644) の直後、だんをえらんでね (line 646) の直前

**移動後の構造**:
```
おんがく → 九九のひょう → だんをえらんでね → まとめて（ぜんぶ含む） → くみあわせ
```

---

## 変更3: くみあわせ を ぜんぶ の下に移動（ひらがな表記のまま）

### HTML変更

#### だんをえらんでね セクション（line 646-663）を修正
- `<div class="dan-header">` から `id="combination-toggle"` ボタンを削除
- `id="combination-start"` ボタンを削除
- セクションヘッダーをシンプルに `<h2>だんをえらんでね</h2>` のみに
- `handleDanClick(n)` → `startGame(String(n))` に直接変更（トグル不要になる）

**変更前**:
```html
<div class="dan-header">
  <h2>だんをえらんでね</h2>
  <button id="combination-toggle" ... onclick="toggleCombinationMode()">くみあわせ</button>
</div>
...
<button id="combination-start" ... style="display: none;" disabled>スタート</button>
```

**変更後**:
```html
<h2>だんをえらんでね</h2>
```
ボタン onclick: `handleDanClick(n)` → `startGame('n')` に直接変更

#### まとめて セクション（line 665-675）にくみあわせエリアを追加

ぜんぶボタンの後に追加:
```html
<!-- くみあわせエリア -->
<button class="btn combination-toggle-btn"
        style="grid-column: span 2;"
        onclick="toggleCombinationSection()">くみあわせ</button>
<div id="combination-area" style="display: none; grid-column: span 2;">
  <div class="combination-dan-grid">
    <!-- 1〜9のだん ボタン（data-dan属性付き、onclick="handleCombinationDanClick(n)"） -->
  </div>
  <button id="combination-start" class="btn btn-primary"
          style="width: 100%;"
          onclick="startCombinationGame()" disabled>スタート</button>
</div>
```

### JavaScript変更（index.html内）

#### `handleDanClick(dan)` を削除（だんをえらんでね側のボタンは直接 startGame を呼ぶ）

#### `toggleCombinationMode()` → `toggleCombinationSection()` にリネーム・刷新
```javascript
function toggleCombinationSection() {
  const area = document.getElementById('combination-area');
  const isOpen = area.style.display !== 'none';
  area.style.display = isOpen ? 'none' : 'block';
  selectedDans.clear();
  // くみあわせエリア内のボタンの選択状態をリセット
  document.querySelectorAll('.combination-dan-grid .btn').forEach(btn => {
    btn.classList.remove('dan-selected');
  });
  document.getElementById('combination-start').disabled = true;
  playSe('btn');
}
```

#### 新関数 `handleCombinationDanClick(dan)` を追加
```javascript
function handleCombinationDanClick(dan) {
  const btn = document.querySelector(`.combination-dan-grid .btn[data-dan="${dan}"]`);
  if (selectedDans.has(dan)) {
    selectedDans.delete(dan);
    btn.classList.remove('dan-selected');
  } else {
    selectedDans.add(dan);
    btn.classList.add('dan-selected');
  }
  document.getElementById('combination-start').disabled = selectedDans.size === 0;
  playSe('btn');
}
```

#### `startCombinationGame()` はそのまま利用可能（selectedDans を読む）

#### グローバル変数 `isCombinationMode` は不要になる（削除）

### CSS変更（任意）
- `.combination-dan-grid` に既存の `.mode-grid` と同様のグリッドスタイルを適用（CSS クラスの再利用または新定義）
- `.combination-toggle-btn` のアクティブ時スタイル（必要に応じてトグル状態を `.btn-primary` で表現）

---

## ブランチ戦略
1. `develop` から `feature/4-menu-redesign` を作成
2. 変更を実装・コミット（複数WIPコミットOK）
3. 完了後 `develop` に squash merge、`feature/4-menu-redesign` 削除

---

## 検証方法
1. ブラウザで `index.html` を直接開く
2. タイトル画面の構成を確認:
   - おんがく → 九九のひょう → だんをえらんでね → まとめて（ぜんぶ含む） → くみあわせ
3. だんをえらんでね のボタンをクリック → 即座にゲーム開始することを確認
4. まとめて の範囲ボタン → 即座にゲーム開始することを確認
5. 九九のひょう ボタン → 表が表示されることを確認
6. くみあわせ ボタン → エリアが展開されることを確認
7. くみあわせエリアでだんを選択 → スタートボタンが有効化されることを確認
8. スタート → ゲーム開始することを確認
