function showTitle() {
  showScreen('title-screen');
  synth.cancel();
  playSe('cancel');
  stopTablePlayback();
  isFreeMode = false;
  streak = 0;
  document.getElementById('app').classList.remove('combo-fever', 'hit-correct', 'hit-incorrect');
  // くみあわせモードをリセット
  if (isCombinationMode) {
    toggleCombinationMode();
  }
}

// くみあわせモード
function toggleCombinationMode() {
  isCombinationMode = !isCombinationMode;
  selectedDans.clear();

  const toggleBtn = document.getElementById('combination-toggle');
  const startBtn = document.getElementById('combination-start');
  const danButtons = document.querySelectorAll('.mode-grid .btn');

  toggleBtn.classList.toggle('btn-primary', isCombinationMode);
  toggleBtn.textContent = isCombinationMode ? 'くみあわせ ON' : 'くみあわせ';
  startBtn.style.display = isCombinationMode ? 'block' : 'none';
  startBtn.disabled = true;

  danButtons.forEach(btn => {
    btn.classList.remove('dan-selected');
  });

  playSe('btn');
}

function handleDanClick(dan) {
  if (!isCombinationMode) {
    startGame(String(dan));
    return;
  }

  const btn = document.querySelector(`.mode-grid .btn[data-dan="${dan}"]`);

  if (selectedDans.has(dan)) {
    selectedDans.delete(dan);
    btn.classList.remove('dan-selected');
  } else {
    selectedDans.add(dan);
    btn.classList.add('dan-selected');
  }

  const startBtn = document.getElementById('combination-start');
  startBtn.disabled = selectedDans.size === 0;

  playSe('btn');
}

function startCombinationGame() {
  if (selectedDans.size === 0) return;
  const mode = Array.from(selectedDans).sort().join(',');
  startGame(mode);
}

// もんだいすう設定
function changeQuestionCount(delta) {
  totalQuestions = Math.min(99, Math.max(1, totalQuestions + delta));
  localStorage.setItem('kuku_question_count', totalQuestions);
  document.getElementById('question-count-display').textContent = totalQuestions;
  playSe('btn');
}

