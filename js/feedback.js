
function showFeedback(isCorrect) {
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
    setTimeout(() => {
      icon.style.transform = 'scale(0)';
      overlay.style.opacity = 0;
      app.classList.remove('hit-correct', 'hit-incorrect');
    }, 1500);
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
  setTimeout(() => {
    void ring2.offsetWidth;
    ring2.classList.add('active');
  }, 120);

  launchBurst(isCorrect, isFever);
  if (isCorrect) {
    launchLasers(isFever);
    if (isFever) launchConfetti(20);
  }

  setTimeout(() => {
    overlay.style.opacity = 0;
    icon.classList.remove('pop-correct', 'pop-incorrect');
    ring.classList.remove('active');
    ring2.classList.remove('active');
    flash.classList.remove('active', 'correct', 'incorrect', 'fever');
    app.classList.remove('hit-correct', 'hit-incorrect', 'shake-correct', 'shake-incorrect', 'zoom-pop');
  }, 1500);
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
  const requested = isBig ? 12 : 8;
  const count = getParticleBudget(layer, requested);
  if (count === 0) return;
  const colors = ['#FFD700', '#FF69B4', '#4ECDC4', '#65D6FF', '#A8F04F'];
  for (let i = 0; i < count; i++) {
    const laser = document.createElement('div');
    laser.className = 'laser-burst';
    laser.style.setProperty('--angle', `${(360 / count) * i + Math.random() * 12}deg`);
    laser.style.setProperty('--laser-color', colors[i % colors.length]);
    layer.appendChild(laser);
    setTimeout(() => laser.remove(), 800);
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
    c.style.setProperty('--csize', `${6 + Math.random() * 8}px`);
    c.style.setProperty('--ccolor', colors[i % colors.length]);
    c.style.setProperty('--crot', `${Math.random() * 360}deg`);
    c.style.setProperty('--cdx', `${(Math.random() - 0.5) * 280}px`);
    c.style.setProperty('--clife', `${1800 + Math.random() * 1400}ms`);
    layer.appendChild(c);
    setTimeout(() => c.remove(), 3400);
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
  star.style.setProperty('--ssdx', `${200 + Math.random() * 200}px`);
  star.style.setProperty('--ssdy', `${150 + Math.random() * 150}px`);
  star.style.setProperty('--ssc', colors[Math.floor(Math.random() * colors.length)]);
  layer.appendChild(star);
  setTimeout(() => star.remove(), 1500);
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
  const requested = legacy
    ? (isBig ? 42 : (isCorrect ? 28 : 18))
    : (isBig ? 90 : (isCorrect ? 60 : 36));
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
    const angle = (Math.PI * 2 * i / count) + Math.random() * (legacy ? 0.45 : 0.6);
    const distance = legacy
      ? (isBig ? 180 : 120) + Math.random() * (isBig ? 120 : 70)
      : (isBig ? 240 : 160) + Math.random() * (isBig ? 180 : 110);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance - Math.random() * (legacy ? 45 : 70);
    spark.className = 'spark';
    spark.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    spark.style.setProperty('--left', `${centerX}px`);
    spark.style.setProperty('--top', `${centerY}px`);
    spark.style.setProperty('--x', `${x}px`);
    spark.style.setProperty('--y', `${y}px`);
    spark.style.setProperty('--spin', `${(Math.random() * (legacy ? 720 : 1080) - (legacy ? 360 : 540)).toFixed(0)}deg`);
    spark.style.setProperty('--spark-color', colors[i % colors.length]);
    spark.style.setProperty('--spark-size', legacy
      ? `${14 + Math.random() * (isBig ? 18 : 12)}px`
      : `${18 + Math.random() * (isBig ? 28 : 18)}px`);
    spark.style.setProperty('--spark-life', legacy
      ? `${780 + Math.random() * 420}ms`
      : `${900 + Math.random() * 600}ms`);
    layer.appendChild(spark);
    setTimeout(() => spark.remove(), legacy ? 1300 : 1600);
  }

  if (legacy) return;

  // 二次バースト（少し遅れて 別方向に）
  if (isCorrect) {
    setTimeout(() => {
      const secondRequested = isBig ? 50 : 30;
      const secondCount = getParticleBudget(layer, secondRequested);
      if (secondCount === 0) return;
      for (let i = 0; i < secondCount; i++) {
        const spark = document.createElement('span');
        const angle = (Math.PI * 2 * i / secondCount) + Math.PI / secondCount;
        const distance = (isBig ? 200 : 140) + Math.random() * 100;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance - Math.random() * 50;
        spark.className = 'spark';
        spark.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        spark.style.setProperty('--left', `${centerX}px`);
        spark.style.setProperty('--top', `${centerY}px`);
        spark.style.setProperty('--x', `${x}px`);
        spark.style.setProperty('--y', `${y}px`);
        spark.style.setProperty('--spin', `${(Math.random() * 720 - 360).toFixed(0)}deg`);
        spark.style.setProperty('--spark-color', colors[i % colors.length]);
        spark.style.setProperty('--spark-size', `${16 + Math.random() * 14}px`);
        spark.style.setProperty('--spark-life', `${800 + Math.random() * 500}ms`);
        layer.appendChild(spark);
        setTimeout(() => spark.remove(), 1400);
      }
    }, 180);
  }
}

function endGame() {
  showScreen('result-screen');
  playSe('result');
  const isPerfect = score === totalQuestions;
  document.getElementById('app').classList.toggle('combo-fever', isPerfect);

  const finalScoreEl = document.getElementById('final-score');
  const legacy = isLegacyFx();

  if (legacy) {
    finalScoreEl.textContent = `${score} / ${totalQuestions}`;
    setTimeout(() => {
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
      playSe('btn');
      if (displayed < score) setTimeout(tickScore, stepDuration);
    };
    setTimeout(tickScore, 400);

    // 初回 大バースト
    setTimeout(() => {
      if (score > 0) launchBurst(true, isPerfect);
    }, 180);

    // 紙吹雪 連発
    if (score > 0) {
      const burstCount = isPerfect ? 4 : Math.min(5, Math.ceil(score / 2));
      for (let i = 0; i < burstCount; i++) {
        setTimeout(() => launchConfetti(isPerfect ? 30 : 18), 300 + i * 280);
      }
    }

    // パーフェクト時 花火連発＋流れ星
    if (isPerfect) {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          launchBurst(true, true);
          launchLasers(true);
        }, 700 + i * 450);
      }
      for (let i = 0; i < 4; i++) {
        setTimeout(launchShootingStar, 600 + i * 250);
      }
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

