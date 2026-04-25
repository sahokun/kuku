# Issue #2: 問題モードの追加（自由選択）

## Context

現在は段・範囲・くみあわせの3モードのみで、特定の問題（例: 4×1, 4×7, 9×7）だけを選んで練習する手段がない。また問題数は10問に固定されていて変更不可、BGM選択も再訪時にリセットされる。Issue #2はこれら3点を解決する。

## 実装範囲

1. **自由選択モード** — 9×9コンパクト表でセルをトグル選択 → 選んだ問題でクイズ開始
2. **問題数設定** (1〜99) — 全モード共通、localStorageに保存
3. **BGM永続化** — localStorage に保存・復元

---

## ブランチ戦略

```
git checkout -b feature/2-free-select-mode develop
```

---

## 変更ファイル

`index.html` のみ（単一ファイル構成）

---

## 実装詳細

### Step 1: localStorage ヘルパーと初期化

`TOTAL_QUESTIONS = 10` (line 847) を変数化し、ページ読み込み時に localStorage から復元する。

```js
// 変更前
const TOTAL_QUESTIONS = 10;

// 変更後
let totalQuestions = parseInt(localStorage.getItem('kuku_question_count') || '10');
```

`TOTAL_QUESTIONS` を参照している全箇所 (lines 922, 924, 945, 1007, 1162, 1165) を `totalQuestions` に置換。

---

### Step 2: BGM 永続化

`selectSong(index)` (line 1443) に保存処理を追加:

```js
function selectSong(index) {
  currentSongIndex = index;
  localStorage.setItem('kuku_bgm', index);  // 追加
  // ... 既存処理
}
```

ページ読み込み時（DOMContentLoaded または既存の初期化タイミング）に復元:

```js
const savedBgm = parseInt(localStorage.getItem('kuku_bgm') || '0');
selectSong(savedBgm);
```

---

### Step 3: タイトル画面に「もんだいすう」設定UI を追加

「九九表を見る」ボタンの前あたりに追加（HTML）:

```html
<div class="settings-row">
  <span class="settings-label">もんだいすう</span>
  <div class="stepper">
    <button class="btn stepper-btn" onclick="changeQuestionCount(-1)">－</button>
    <span id="question-count-display">10</span>
    <button class="btn stepper-btn" onclick="changeQuestionCount(+1)">＋</button>
  </div>
  <span class="settings-unit">もん</span>
</div>
```

JS 関数:

```js
function changeQuestionCount(delta) {
  totalQuestions = Math.min(99, Math.max(1, totalQuestions + delta));
  localStorage.setItem('kuku_question_count', totalQuestions);
  document.getElementById('question-count-display').textContent = totalQuestions;
  playSe('btn');
}
```

---

### Step 4: 逆問題の位置を可変問題数に対応

`showNextQuestion()` (line 956) の逆問題判定を変更:

```js
// 変更前
const isEquationType = (currentQuestionIndex === 4 || currentQuestionIndex === 9);

// 変更後（5問ごとを逆問題、自由選択モードでは無効）
const isEquationType = !isFreeMode && ((currentQuestionIndex + 1) % 5 === 0);
```

`isFreeMode` は State 変数として追加 (`let isFreeMode = false;`)。

---

### Step 5: タイトル画面に「自由選択」ボタン追加 (HTML)

```html
<button class="btn btn-primary" onclick="showFreeSelect()">
  ✏️ 自由選択
</button>
```

---

### Step 6: 新スクリーン `free-select-screen` 追加 (HTML)

```html
<div id="free-select-screen" class="screen">
  <h2>もんだいをえらぼう</h2>
  <div class="free-select-controls">
    <button class="btn btn-small" onclick="selectAllFree()">すべて</button>
    <button class="btn btn-small" onclick="clearAllFree()">クリア</button>
    <span id="free-select-count">0もん選択中</span>
  </div>
  <div id="free-select-table" class="compact-kuku-table">
    <!-- JS で生成 -->
  </div>
  <div class="free-select-footer">
    <button class="btn btn-secondary" onclick="showTitle()">もどる</button>
    <button class="btn btn-primary" id="free-start-btn" onclick="startFreeGame()" disabled>
      スタート
    </button>
  </div>
</div>
```

---

### Step 7: コンパクト九九表の CSS

```css
.compact-kuku-table {
  display: grid;
  grid-template-columns: 28px repeat(9, 1fr);
  gap: 3px;
  padding: 8px;
  overflow-x: auto;
}

.ck-header {
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; color: var(--gray); font-weight: bold;
}

.ck-cell {
  aspect-ratio: 1;
  display: flex; align-items: center; justify-content: center;
  border-radius: 6px;
  background: #f0f0f0;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  user-select: none;
}

.ck-cell.selected {
  background: var(--main-pink);
  color: white;
  font-weight: bold;
  transform: scale(1.05);
}
```

---

### Step 8: 自由選択モードの JS

```js
// State
let selectedFreeProblems = new Set(); // "a,b" 形式
let isFreeMode = false;

function showFreeSelect() {
  playSe('btn');
  renderFreeSelectTable();
  showScreen('free-select-screen');
}

function renderFreeSelectTable() {
  const container = document.getElementById('free-select-table');
  let html = '';
  // 列ヘッダ行
  html += '<div class="ck-header"></div>';
  for (let a = 1; a <= 9; a++) html += `<div class="ck-header">${a}</div>`;
  // 各行 (b = 1〜9)
  for (let b = 1; b <= 9; b++) {
    html += `<div class="ck-header">${b}</div>`;
    for (let a = 1; a <= 9; a++) {
      const key = `${a},${b}`;
      const sel = selectedFreeProblems.has(key) ? ' selected' : '';
      html += `<div class="ck-cell${sel}" onclick="toggleFreeCell(${a},${b})">${a*b}</div>`;
    }
  }
  container.innerHTML = html;
  updateFreeSelectUI();
}

function toggleFreeCell(a, b) {
  const key = `${a},${b}`;
  if (selectedFreeProblems.has(key)) selectedFreeProblems.delete(key);
  else selectedFreeProblems.add(key);
  const cell = [...document.querySelectorAll('.ck-cell')]
    .find(el => el.onclick?.toString().includes(`${a},${b}`));
  // re-render is simpler
  renderFreeSelectTable();
  playSe('btn');
}

function updateFreeSelectUI() {
  const count = selectedFreeProblems.size;
  document.getElementById('free-select-count').textContent = `${count}もん選択中`;
  document.getElementById('free-start-btn').disabled = count === 0;
}

function selectAllFree() {
  for (let a = 1; a <= 9; a++)
    for (let b = 1; b <= 9; b++)
      selectedFreeProblems.add(`${a},${b}`);
  renderFreeSelectTable();
}

function clearAllFree() {
  selectedFreeProblems.clear();
  renderFreeSelectTable();
}

function startFreeGame() {
  if (selectedFreeProblems.size === 0) return;
  isFreeMode = true;

  const candidates = [...selectedFreeProblems].map(key => {
    const [a, b] = key.split(',').map(Number);
    return kukuData.find(d => d.a === a && d.b === b);
  }).filter(Boolean);

  // totalQuestions 問になるように shuffle & 繰り返し
  currentQuestions = shuffleArray([...candidates]).slice(0, totalQuestions);
  while (currentQuestions.length < totalQuestions) {
    currentQuestions.push(...shuffleArray([...candidates]));
  }
  currentQuestions = currentQuestions.slice(0, totalQuestions);

  score = 0;
  currentQuestionIndex = 0;
  currentInput = "";
  equationInputB = "";
  isProcessing = false;
  currentQuestionType = "answer";

  initVoice(); initAudio(); speak("");
  updateStatusBar();
  showScreen('game-screen');
  setTimeout(showNextQuestion, 500);
}
```

既存 `showTitle()` に `isFreeMode = false;` を追加。

---

### Step 9: `startGame()` を `totalQuestions` 対応に修正

既存の `startGame()` (line 922) の `TOTAL_QUESTIONS` を `totalQuestions` に置換（Step 1 で対応）。
`isFreeMode = false;` も追加。

---

## 検証方法

1. `index.html` をブラウザで開く
2. **BGM永続化**: BGMをわくわくに変更 → リロード → わくわくになっていること
3. **問題数設定**: ステッパーで15問に変更 → リロード後も15問 → 段を選んで15問出題されること
4. **逆問題調整**: 15問設定で5問目・10問目・15問目が逆問題になること
5. **自由選択モード**:
   - 「自由選択」をタップ → コンパクト表が表示される
   - セルをタップするとハイライト、もう一度でオフ
   - 「すべて」「クリア」が機能する
   - 0問選択中はスタートボタンが無効
   - スタートして選んだ問題だけ出題される（問題数は設定値）
   - 自由選択モードでは逆問題が出ない
