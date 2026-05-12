
// 初期化: localStorage からBGMと問題数と演出を復元
(function init() {
  const savedBgmValue = parseInt(localStorage.getItem('kuku_bgm') || '0');
  const savedBgm = Number.isFinite(savedBgmValue)
    ? Math.min(Math.max(savedBgmValue, 0), BGM_SONGS.length - 1)
    : 0;
  document.getElementById('app').dataset.screen = 'title';
  if (savedBgm !== 0) {
    currentSongIndex = savedBgm;
    document.querySelectorAll('.bgm-option').forEach((el, i) => {
      el.classList.toggle('bgm-active', i === savedBgm);
    });
  }
  document.getElementById('question-count-display').textContent = totalQuestions;

  // 演出 復元（デフォルト: 'new'）
  const savedFx = localStorage.getItem('kuku_fx') === 'legacy' ? 'legacy' : 'new';
  const isLegacy = savedFx === 'legacy';
  document.body.classList.toggle('legacy-fx', isLegacy);
  const newBtn = document.getElementById('fx-btn-new');
  const legacyBtn = document.getElementById('fx-btn-legacy');
  if (newBtn) newBtn.classList.toggle('fx-active', !isLegacy);
  if (legacyBtn) legacyBtn.classList.toggle('fx-active', isLegacy);
})();

