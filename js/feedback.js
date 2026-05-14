
const feedbackTimers = new Set();
const feedbackElements = new Set();

function setFeedbackTimer(callback, delay) {
  const timerId = setTimeout(() => {
    feedbackTimers.delete(timerId);
    callback();
  }, delay);
  feedbackTimers.add(timerId);
  return timerId;
}

function trackFeedbackElement(element) {
  if (element) feedbackElements.add(element);
  return element;
}

function removeFeedbackElement(element) {
  if (!element) return;
  feedbackElements.delete(element);
  try {
    element.getAnimations().forEach((animation) => animation.cancel());
  } catch (error) {
    // getAnimations 非対応環境では何もしない
  }
  element.remove();
}

function cleanupFeedbackEffects() {
  feedbackTimers.forEach((timerId) => clearTimeout(timerId));
  feedbackTimers.clear();

  Array.from(feedbackElements).forEach((element) => removeFeedbackElement(element));
  feedbackElements.clear();

  const burstLayer = document.getElementById('burst-layer');
  if (burstLayer) {
    Array.from(burstLayer.children).forEach((element) => removeFeedbackElement(element));
  }

  const overlay = document.getElementById('feedback-overlay');
  const icon = document.getElementById('feedback-icon');
  const ring = document.getElementById('feedback-ring');
  const ring2 = document.getElementById('feedback-ring-2');
  const flash = document.getElementById('screen-flash');
  const app = document.getElementById('app');
  [overlay, icon, ring, ring2, flash, app].forEach((element) => {
    if (!element) return;
    try {
      element.getAnimations().forEach((animation) => animation.cancel());
    } catch (error) {
      // getAnimations 非対応環境では何もしない
    }
  });
  if (overlay) overlay.style.opacity = 0;
  if (icon) {
    icon.style.transform = '';
    icon.classList.remove('pop-correct', 'pop-incorrect', 'correct', 'incorrect');
  }
  if (ring) ring.classList.remove('active', 'correct', 'incorrect');
  if (ring2) ring2.classList.remove('active', 'correct', 'incorrect');
  if (flash) flash.classList.remove('active', 'correct', 'incorrect', 'fever');
  if (app) app.classList.remove('hit-correct', 'hit-incorrect', 'shake-correct', 'shake-incorrect', 'zoom-pop');
}

function showFeedback(isCorrect) {
  cleanupFeedbackEffects();
  const overlay = document.getElementById('feedback-overlay');
  const icon = document.getElementById('feedback-icon');
  const ring = document.getElementById('feedback-ring');
  const ring2 = document.getElementById('feedback-ring-2');
  const app = document.getElementById('app');
  const flash = document.getElementById('screen-flash');
  const isFever = streak >= 3;
  const legacy = isLegacyFx();

  overlay.style.opacity = 1;
  icon.textContent = isCorrect ? '⭕' : '❌';
  icon.className = 'feedback-icon ' + (isCorrect ? 'correct' : 'incorrect');

  // シンプル(legacy) モード
  if (legacy) {
    icon.style.transform = 'scale(0)';
    app.classList.toggle('combo-fever', isFever);
    app.classList.remove('hit-correct', 'hit-incorrect', 'shake-correct', 'shake-incorrect', 'zoom-pop');
    void app.offsetWidth;
    app.classList.add(isCorrect ? 'hit-correct' : 'hit-incorrect');
    launchBurst(isCorrect, isFever);
    requestAnimationFrame(() => { icon.style.transform = 'scale(1)'; });
    setFeedbackTimer(() => {
      icon.style.transform = 'scale(0)';
      overlay.style.opacity = 0;
      app.classList.remove('hit-correct', 'hit-incorrect');
    }, 1200);
    return;
  }

  // ド派手モード
  ring.className = 'feedback-ring ' + (isCorrect ? 'correct' : 'incorrect');
  ring2.className = 'feedback-ring ' + (isCorrect ? 'correct' : 'incorrect');
  ring.style.transitionDelay = '';
  ring2.style.transitionDelay = '';

  // 画面フラッシュ
  flash.className = 'screen-flash';
  void flash.offsetWidth;
  if (isFever && isCorrect) {
    flash.classList.add('active', 'fever');
  } else {
    flash.classList.add('active', isCorrect ? 'correct' : 'incorrect');
  }

  app.classList.toggle('combo-fever', isFever);
  app.classList.remove('hit-correct', 'hit-incorrect', 'shake-correct', 'shake-incorrect', 'zoom-pop');
  void app.offsetWidth;
  app.classList.add(isCorrect ? 'hit-correct' : 'hit-incorrect');
  app.classList.add(isCorrect ? 'shake-correct' : 'shake-incorrect');
  if (isCorrect) app.classList.add('zoom-pop');

  // アニメ再起動 トリック
  void icon.offsetWidth;
  icon.classList.add(isCorrect ? 'pop-correct' : 'pop-incorrect');
  void ring.offsetWidth;
  ring.classList.add('active');
  setFeedbackTimer(() => {
    void ring2.offsetWidth;
    ring2.classList.add('active');
  }, 100);

  launchBurst(isCorrect, isFever);
  if (isCorrect) {
    if (isFever) {
      launchLasers(true);
      launchConfetti(4);
    }
  }

  setFeedbackTimer(() => {
    overlay.style.opacity = 0;
    icon.classList.remove('pop-correct', 'pop-incorrect');
    ring.classList.remove('active');
    ring2.classList.remove('active');
    flash.classList.remove('active', 'correct', 'incorrect', 'fever');
    app.classList.remove('hit-correct', 'hit-incorrect', 'shake-correct', 'shake-incorrect', 'zoom-pop');
  }, 1200);
}

function getParticleBudget(layer, requested) {
  if (!layer) return 0;
  const remaining = PARTICLE_CAP - layer.childElementCount;
  if (remaining <= 0) return 0;
  return Math.min(requested, remaining);
}

function launchLasers(isBig) {
  if (prefersReducedMotion() || isLegacyFx()) return;
  const layer = document.getElementById('burst-layer');
  if (!layer) return;
  const requested = isBig ? 3 : 0;
  const count = getParticleBudget(layer, requested);
  if (count === 0) return;
  const colors = ['#FFD700', '#FF69B4', '#4ECDC4', '#65D6FF', '#A8F04F'];
  for (let i = 0; i < count; i++) {
    const laser = document.createElement('div');
    laser.className = 'laser-burst';
    laser.style.setProperty('--angle', `${(360 / count) * i + Math.random() * 12}deg`);
    laser.style.setProperty('--laser-color', colors[i % colors.length]);
    layer.appendChild(laser);
    trackFeedbackElement(laser);
    setFeedbackTimer(() => removeFeedbackElement(laser), 520);
  }
}

function launchConfetti(count) {
  if (prefersReducedMotion() || isLegacyFx()) return;
  const layer = document.getElementById('burst-layer');
  if (!layer) return;
  count = getParticleBudget(layer, count);
  if (count === 0) return;
  const colors = ['#FFD700', '#FF2FA8', '#22D9FF', '#A8F04F', '#FF7A90', '#9370DB'];
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.setProperty('--cx', `${Math.random() * 100}%`);
    c.style.setProperty('--csize', `${5 + Math.random() * 5}px`);
    c.style.setProperty('--ccolor', colors[i % colors.length]);
    c.style.setProperty('--crot', `${Math.random() * 360}deg`);
    c.style.setProperty('--cdx', `${(Math.random() - 0.5) * 140}px`);
    c.style.setProperty('--clife', `${850 + Math.random() * 350}ms`);
    layer.appendChild(c);
    trackFeedbackElement(c);
    setFeedbackTimer(() => removeFeedbackElement(c), 1400);
  }
}

function launchShootingStar() {
  if (prefersReducedMotion() || isLegacyFx()) return;
  const layer = document.getElementById('burst-layer');
  if (!layer) return;
  if (getParticleBudget(layer, 1) === 0) return;
  const colors = ['#FFD700', '#65D6FF', '#FF69B4', '#A8F04F'];
  const star = document.createElement('div');
  star.className = 'shooting-star';
  const startX = Math.random() * 60;
  const startY = Math.random() * 30;
  star.style.setProperty('--ssx', `${startX}%`);
  star.style.setProperty('--ssy', `${startY}%`);
  star.style.setProperty('--ssdx', `${150 + Math.random() * 120}px`);
  star.style.setProperty('--ssdy', `${110 + Math.random() * 90}px`);
  star.style.setProperty('--ssc', colors[Math.floor(Math.random() * colors.length)]);
  layer.appendChild(star);
  trackFeedbackElement(star);
  setFeedbackTimer(() => removeFeedbackElement(star), 900);
}

function launchBurst(isCorrect, isBig) {
  const layer = document.getElementById('burst-layer');
  const app = document.getElementById('app');
  if (!layer || !app) return;
  if (prefersReducedMotion()) return;

  const legacy = isLegacyFx();
  const appRect = app.getBoundingClientRect();
  const target = document.querySelector('.screen.active .question-area, .screen.active .score-board') || document.querySelector('.question-area');
  if (!target) return;
  const questionRect = target.getBoundingClientRect();
  const centerX = questionRect.left - appRect.left + questionRect.width / 2;
  const centerY = questionRect.top - appRect.top + questionRect.height / 2;
  const requested = isBig ? 18 : (isCorrect ? 12 : 8);
  const count = getParticleBudget(layer, requested);
  const symbols = isCorrect
    ? (legacy ? ['★', '×', '+', '♪'] : ['★', '✦', '♥', '♪', '✿', '◆', '✺'])
    : (legacy ? ['×', '?', '！'] : ['×', '?', '！', '✗']);
  const colors = isCorrect
    ? (legacy
      ? ['#FFD700', '#FF69B4', '#4ECDC4', '#A8F04F', '#65D6FF']
      : ['#FFD700', '#FF69B4', '#4ECDC4', '#A8F04F', '#65D6FF', '#FF2FA8', '#FFFFFF'])
    : ['#FF7A90', '#9370DB', '#FFD700'];

  for (let i = 0; i < count; i++) {
    const spark = document.createElement('span');
    const angle = (Math.PI * 2 * i / count) + Math.random() * (legacy ? 0.3 : 0.4);
    const distance = legacy
      ? (isBig ? 120 : 90) + Math.random() * (isBig ? 70 : 45)
      : (isBig ? 150 : 105) + Math.random() * (isBig ? 80 : 55);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance - Math.random() * (legacy ? 28 : 40);
    spark.className = 'spark';
    spark.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    spark.style.setProperty('--left', `${centerX}px`);
    spark.style.setProperty('--top', `${centerY}px`);
    spark.style.setProperty('--x', `${x}px`);
    spark.style.setProperty('--y', `${y}px`);
    spark.style.setProperty('--spin', `${(Math.random() * (legacy ? 720 : 1080) - (legacy ? 360 : 540)).toFixed(0)}deg`);
    spark.style.setProperty('--spark-color', colors[i % colors.length]);
    spark.style.setProperty('--spark-size', legacy
      ? `${13 + Math.random() * (isBig ? 10 : 8)}px`
      : `${15 + Math.random() * (isBig ? 14 : 10)}px`);
    spark.style.setProperty('--spark-life', legacy
      ? `${560 + Math.random() * 220}ms`
      : `${620 + Math.random() * 260}ms`);
    layer.appendChild(spark);
    trackFeedbackElement(spark);
    setFeedbackTimer(() => removeFeedbackElement(spark), legacy ? 900 : 1050);
  }
}

function endGame() {
  invalidateGameSession();
  cleanupFeedbackEffects();
  cleanupStageAnimation();
  showScreen('result-screen');
  playSe('result');
  const isPerfect = score === totalQuestions;
  document.getElementById('app').classList.toggle('combo-fever', isPerfect);

  const finalScoreEl = document.getElementById('final-score');
  const legacy = isLegacyFx();

  if (legacy) {
    finalScoreEl.textContent = `${score} / ${totalQuestions}`;
    setFeedbackTimer(() => {
      if (score > 0) launchBurst(true, isPerfect);
    }, 180);
  } else {
    finalScoreEl.textContent = `0 / ${totalQuestions}`;

    // スコアカウントアップ
    const stepDuration = Math.max(60, Math.min(180, 1200 / Math.max(1, score)));
    let displayed = 0;
    const tickScore = () => {
      if (displayed >= score) return;
      displayed++;
      finalScoreEl.textContent = `${displayed} / ${totalQuestions}`;
      if (displayed === score || displayed % 2 === 0) playSe('btn');
      if (displayed < score) setFeedbackTimer(tickScore, stepDuration);
    };
    setFeedbackTimer(tickScore, 400);

    // 初回 大バースト
    setFeedbackTimer(() => {
      if (score > 0) launchBurst(true, isPerfect);
    }, 180);

    // 紙吹雪は1回だけにしてリザルト遷移時のピーク負荷を抑える
    if (score > 0) {
      setFeedbackTimer(() => launchConfetti(4), 260);
    }

    // パーフェクト時も小規模な追加演出1回に抑える
    if (isPerfect) {
      setFeedbackTimer(() => launchLasers(true), 560);
      setFeedbackTimer(launchShootingStar, 620);
    }
  }

  const msgEl = document.getElementById('perfect-msg');
  if (isPerfect) {
    msgEl.textContent = "すごい！ぜんもんせいかい！";
    speak("すごい！ぜんもんせいかい！");
  } else if (score >= 7) {
    msgEl.textContent = "よくがんばったね！";
    speak("よくがんばったね！");
  } else {
    msgEl.textContent = "またチャレンジしてね！";
    speak("またチャレンジしてね！");
  }
}
