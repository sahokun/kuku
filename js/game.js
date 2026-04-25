
// 画面切り替え
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
  document.getElementById('app').dataset.screen = screenId.replace('-screen', '');
}

// ゲーム開始
function startGame(mode) {
  // 音声初期化（ユーザー操作トリガー）
  initVoice();
  initAudio();
  speak(""); // ダミー再生でアンロック

  isFreeMode = false;
  score = 0;
  streak = 0;
  document.getElementById('app').classList.remove('combo-fever', 'hit-correct', 'hit-incorrect');
  currentQuestionIndex = 0;
  currentInput = "";
  isProcessing = false;
  currentQuestionType = "answer";
  equationInputB = "";
  document.getElementById('question-text').textContent = '';
  document.getElementById('kuku-reading').innerHTML = '';
  document.getElementById('answer-display').textContent = '\u00A0';
  document.getElementById('answer-display').style.display = '';
  
  // 問題生成
  let candidates = [];

  if (mode.includes(',')) {
    // くみあわせモード: カンマ区切りの段リスト
    const dans = mode.split(',').map(Number);
    candidates = kukuData.filter(d => dans.includes(d.a));
  } else if (mode.includes('-')) {
    const [start, end] = mode.split('-').map(Number);
    candidates = kukuData.filter(d => d.a >= start && d.a <= end);
  } else {
    const target = Number(mode);
    candidates = kukuData.filter(d => d.a === target);
  }

  // ランダムに10問選ぶ（重複ありにするか？なしにするか？ -> なし推奨だが候補が少ない場合はあり）
  // シャッフルして先頭10個を取る
  currentQuestions = shuffleArray([...candidates]).slice(0, totalQuestions);
  // もし候補が10個未満なら（例：1つの段は9個しかない）、補充する
  while (currentQuestions.length < totalQuestions) {
    const randomQ = candidates[Math.floor(Math.random() * candidates.length)];
    currentQuestions.push(randomQ);
  }

  updateStatusBar();
  showScreen('game-screen');
  
  // 少し待ってから最初の問題を表示
  setTimeout(showNextQuestion, 500);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function showNextQuestion() {
  if (currentQuestionIndex >= totalQuestions) {
    endGame();
    return;
  }

  const q = currentQuestions[currentQuestionIndex];
  const questionTextEl = document.getElementById('question-text');
  const answerDisplayEl = document.getElementById('answer-display');
  const kukuReadingEl = document.getElementById('kuku-reading');

  // 5問ごとに逆問題（自由選択モードでは逆問題なし）
  const isEquationType = !isFreeMode && ((currentQuestionIndex + 1) % 5 === 0);
  currentQuestionType = isEquationType ? "equation" : "answer";
  updateStage(q);

  // 入力状態リセット
  currentInput = "";
  equationInputB = "";

  if (currentQuestionType === "equation") {
    // 逆問題: 左の数と答えを表示し、右の数だけ穴埋め
    const answer = q.a * q.b;
    questionTextEl.innerHTML =
      '<div class="equation-display">' +
      '<span class="equation-answer-part">' + q.a + '</span>' +
      '<span class="equation-operator">&times;</span>' +
      '<span id="slot-b" class="equation-slot active-slot">?</span>' +
      '<span class="equation-operator">=</span>' +
      '<span class="equation-answer-part">' + answer + '</span>' +
      '</div>';

    // よみがな: 式部分が空欄、答え部分を表示
    kukuReadingEl.innerHTML =
      '<span class="kuku-blank">' + q.q_read + '</span>' +
      '<span>' + q.a_read + '</span>';

    // 通常の入力欄を非表示
    answerDisplayEl.style.display = 'none';

    // 「あなうめもんだい」を読み上げ
    speak("あなうめもんだい");
  } else {
    // 通常問題: 式を表示し、答えを入力させる
    questionTextEl.textContent = q.a + ' \u00d7 ' + q.b + ' = ?';

    // よみがな: 式部分を表示、答え部分が空欄
    kukuReadingEl.innerHTML =
      '<span>' + q.q_read + '</span>' +
      '<span class="kuku-blank">' + q.a_read + '</span>';

    // 通常の入力欄を表示
    answerDisplayEl.style.display = '';

    // 式の読みを読み上げ
    speak(getQSpeak(q));
  }

  updateInputDisplay();
  updateStatusBar();
  isProcessing = false;
}

function updateStatusBar() {
  document.getElementById('question-counter').textContent = `もんだい ${currentQuestionIndex + 1}/${totalQuestions}`;
  document.getElementById('score-display').textContent = `スコア: ${score}`;
  document.getElementById('combo-display').textContent = `れんぞく: ${streak}`;
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isLegacyFx() {
  return document.body.classList.contains('legacy-fx');
}

function selectFx(mode) {
  const isLegacy = mode === 'legacy';
  document.body.classList.toggle('legacy-fx', isLegacy);
  localStorage.setItem('kuku_fx', mode);
  const newBtn = document.getElementById('fx-btn-new');
  const legacyBtn = document.getElementById('fx-btn-legacy');
  if (newBtn) newBtn.classList.toggle('fx-active', !isLegacy);
  if (legacyBtn) legacyBtn.classList.toggle('fx-active', isLegacy);
  playSe('btn');
}

function updateStage(q) {
  const stageNumber = document.getElementById('stage-number');
  const stageLeft = document.getElementById('stage-left');
  const stageRight = document.getElementById('stage-right');
  if (!stageNumber || !q) return;

  stageNumber.textContent = currentQuestionType === "equation" ? `${q.a}×?` : `${q.a}×${q.b}`;
  stageLeft.textContent = q.a;
  stageRight.textContent = currentQuestionType === "equation" ? "?" : q.b;
  if (!prefersReducedMotion()) {
    stageNumber.animate(
      [
        { transform: 'rotateX(10deg) rotateY(-16deg) translateY(0) translateZ(20px) scale(0.88)' },
        { transform: 'rotateX(-8deg) rotateY(18deg) translateY(-10px) translateZ(44px) scale(1.08)' },
        { transform: 'rotateX(10deg) rotateY(-16deg) translateY(0) translateZ(20px) scale(1)' }
      ],
      { duration: 520, easing: 'cubic-bezier(0.2, 1.4, 0.3, 1)' }
    );
  }
}

function inputNum(num) {
  if (isProcessing) return;

  if (currentQuestionType === "equation") {
    // 逆問題: 右の数を1桁入力
    if (equationInputB !== "") return; // 入力済み
    equationInputB = String(num);
    updateEquationDisplay();
    playSe('btn');
  } else {
    // 通常問題
    if (currentInput === "0") currentInput = "";
    if (currentInput.length >= 2) return; // 2桁まで
    currentInput += num;
    updateInputDisplay();
    playSe('btn');
  }
}

function clearInput() {
  if (isProcessing) return;

  if (currentQuestionType === "equation") {
    equationInputB = "";
    updateEquationDisplay();
  } else {
    currentInput = "";
    updateInputDisplay();
  }
  playSe('cancel');
}

function updateInputDisplay() {
  const display = document.getElementById('answer-display');
  display.textContent = currentInput || '\u00A0'; // 空の場合は&nbsp;を表示
}

function updateEquationDisplay() {
  const slotB = document.getElementById('slot-b');
  if (!slotB) return;

  if (equationInputB !== "") {
    slotB.textContent = equationInputB;
    slotB.classList.remove('active-slot');
    slotB.classList.add('filled-slot');
  } else {
    slotB.textContent = '?';
    slotB.classList.remove('filled-slot');
    slotB.classList.add('active-slot');
  }
}

function submitAnswer() {
  if (isProcessing) return;

  const q = currentQuestions[currentQuestionIndex];
  const kukuReadingEl = document.getElementById('kuku-reading');

  if (currentQuestionType === "equation") {
    // 逆問題: 右の数の入力必須
    if (equationInputB === "") return;

    isProcessing = true;
    const userB = Number(equationInputB);

    // q.bと一致するか判定
    const isCorrect = (userB === q.b);

    if (isCorrect) {
      score++;
      streak++;
      showFeedback(true);
      playSe('correct');
    } else {
      streak = 0;
      showFeedback(false);
      playSe('incorrect');
    }
    updateStatusBar();

    // よみがな: 式部分(q_read)を公開して完成
    kukuReadingEl.innerHTML =
      '<span class="kuku-revealed">' + q.q_read + '</span>' +
      '<span>' + q.a_read + '</span>';

    // 正解の読み上げ
    setTimeout(() => {
      speak(getFullSpeak(q));
    }, 500);

    // 次の問題へ
    setTimeout(() => {
      currentQuestionIndex++;
      showNextQuestion();
    }, 2500);

  } else {
    // 通常問題
    if (currentInput === "") return;

    isProcessing = true;
    const userAnswer = Number(currentInput);
    const correctAnswer = q.a * q.b;
    const isCorrect = userAnswer === correctAnswer;

    if (isCorrect) {
      score++;
      streak++;
      showFeedback(true);
      playSe('correct');
    } else {
      streak = 0;
      showFeedback(false);
      playSe('incorrect');
    }
    updateStatusBar();

    // よみがな: 答え部分(a_read)を公開して完成
    kukuReadingEl.innerHTML =
      '<span>' + q.q_read + '</span>' +
      '<span class="kuku-revealed">' + q.a_read + '</span>';

    // 正解の読み上げ
    setTimeout(() => {
      speak(getFullSpeak(q));
    }, 500);

    // 次の問題へ
    setTimeout(() => {
      currentQuestionIndex++;
      showNextQuestion();
    }, 2500);
  }
}
