// 自由選択モード
function showFreeSelect() {
  playSe('btn');
  renderFreeSelectTable();
  showScreen('free-select-screen');
}

function renderFreeSelectTable() {
  const container = document.getElementById('free-select-table');
  let html = '<div class="ck-header"></div>';
  for (let a = 1; a <= 9; a++) html += `<div class="ck-header">${a}</div>`;
  for (let b = 1; b <= 9; b++) {
    html += `<div class="ck-header">${b}</div>`;
    for (let a = 1; a <= 9; a++) {
      const key = `${a},${b}`;
      const sel = selectedFreeProblems.has(key) ? ' selected' : '';
      html += `<div class="ck-cell${sel}" onclick="toggleFreeCell(${a},${b})">${a * b}</div>`;
    }
  }
  container.innerHTML = html;
  updateFreeSelectUI();
}

function toggleFreeCell(a, b) {
  const key = `${a},${b}`;
  if (selectedFreeProblems.has(key)) selectedFreeProblems.delete(key);
  else selectedFreeProblems.add(key);
  renderFreeSelectTable();
  playSe('btn');
}

function updateFreeSelectUI() {
  const count = selectedFreeProblems.size;
  document.getElementById('free-select-count').textContent = `${count}もんえらびちゅう`;
  document.getElementById('free-start-btn').disabled = count === 0;
}

function selectAllFree() {
  for (let a = 1; a <= 9; a++)
    for (let b = 1; b <= 9; b++)
      selectedFreeProblems.add(`${a},${b}`);
  renderFreeSelectTable();
  playSe('btn');
}

function clearAllFree() {
  selectedFreeProblems.clear();
  renderFreeSelectTable();
  playSe('btn');
}

function startFreeGame() {
  if (selectedFreeProblems.size === 0) return;
  isFreeMode = true;

  const candidates = [...selectedFreeProblems].map(key => {
    const [a, b] = key.split(',').map(Number);
    return kukuData.find(d => d.a === a && d.b === b);
  }).filter(Boolean);

  currentQuestions = shuffleArray([...candidates]).slice(0, totalQuestions);
  while (currentQuestions.length < totalQuestions) {
    currentQuestions.push(...shuffleArray([...candidates]));
  }
  currentQuestions = currentQuestions.slice(0, totalQuestions);

  score = 0;
  streak = 0;
  document.getElementById('app').classList.remove('combo-fever', 'hit-correct', 'hit-incorrect');
  currentQuestionIndex = 0;
  currentInput = "";
  equationInputB = "";
  isProcessing = false;
  currentQuestionType = "answer";
  document.getElementById('question-text').textContent = '';
  document.getElementById('kuku-reading').innerHTML = '';
  document.getElementById('answer-display').textContent = '\u00A0';
  document.getElementById('answer-display').style.display = '';

  initVoice(); initAudio(); speak("");
  updateStatusBar();
  showScreen('game-screen');
  setTimeout(showNextQuestion, 500);
}

