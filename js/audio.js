
let currentBgmKey = null;
let isBgmStarting = false;
let isBgmPlaying = false;
let audioInitPromise = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioInitPromise = audioInitPromise || audioCtx.resume()
      .catch((error) => {
        console.warn('Audio resume failed', error);
      })
      .finally(() => {
        audioInitPromise = null;
      });
  }
  if (!audioInitialized) {
    isMuted = false;
    updateMuteIcon();
    audioInitialized = true;
  }
  startBgm();
}

function toggleMute() {
  if (!audioCtx) {
    initAudio();
    return;
  }
  isMuted = !isMuted;
  updateMuteIcon();
  if (isMuted) {
    stopBgm();
    synth.cancel();
  } else {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    startBgm();
  }
}

function updateMuteIcon() {
  const btn = document.getElementById('mute-btn');
  btn.textContent = isMuted ? '🔇' : '🔊';
}


function selectSong(index) {
  const previousSongIndex = currentSongIndex;
  currentSongIndex = index;
  localStorage.setItem('kuku_bgm', index);
  noteIndex = 0;
  document.querySelectorAll('.bgm-option').forEach((el, i) => {
    el.classList.toggle('bgm-active', i === index);
  });
  if (!isMuted && previousSongIndex !== index) {
    stopBgm();
  }
  initAudio();
  playSe('btn');
}

function startBgm() {
  if (isMuted) return;
  const song = BGM_SONGS[currentSongIndex];
  if (!song) return;
  const requestedKey = getBgmKey(song, currentSongIndex);
  if ((isBgmPlaying || isBgmStarting) && currentBgmKey === requestedKey) return;
  if (bgmTimer || activeToneEngine || isBgmPlaying || isBgmStarting) {
    stopBgm();
  }

  if (song.useTone) {
    currentBgmKey = requestedKey;
    isBgmStarting = true;
    isBgmPlaying = false;
    bgmTimer = 'tone';
    const token = ++bgmStartToken;
    startToneEngine(() => token === bgmStartToken && bgmTimer === 'tone' && !isMuted)
      .then((started) => {
        if (token !== bgmStartToken) {
          return;
        }
        isBgmStarting = false;
        isBgmPlaying = !!started;
        if (!started && bgmTimer === 'tone') {
          bgmTimer = null;
          currentBgmKey = null;
        }
      })
      .catch((error) => {
        if (token !== bgmStartToken) return;
        console.warn('BGM start failed', error);
        isBgmStarting = false;
        isBgmPlaying = false;
        bgmTimer = null;
        currentBgmKey = null;
      });
    return;
  }
  currentBgmKey = requestedKey;
  isBgmStarting = false;
  isBgmPlaying = true;
  bgmStartToken++;
  scheduleNextNote();
}

function stopBgm() {
  bgmStartToken++;
  stopToneEngine();
  if (bgmTimer && bgmTimer !== 'tone') clearTimeout(bgmTimer);
  bgmTimer = null;
  currentBgmKey = null;
  isBgmStarting = false;
  isBgmPlaying = false;
}

function scheduleNextNote() {
  if (isMuted) {
    bgmTimer = null;
    isBgmPlaying = false;
    return;
  }
  if (!audioCtx) {
    isBgmPlaying = false;
    return;
  }

  const song = BGM_SONGS[currentSongIndex];
  if (!song) {
    bgmTimer = null;
    isBgmPlaying = false;
    currentBgmKey = null;
    return;
  }
  if (song.useTone) { bgmTimer = 'tone'; return; }
  const freq = song.melody[noteIndex % song.melody.length];
  const now = audioCtx.currentTime;

  if (freq > 0) {
    playBgmTone(freq, song.waveType, song.gain, song.tempo * 0.92, now);
  }

  if (song.harmony && noteIndex % 2 === 0) {
    const harmonyFreq = song.harmony[noteIndex % song.harmony.length];
    if (harmonyFreq > 0) {
      playBgmTone(harmonyFreq, 'triangle', song.harmonyGain || 0.01, song.tempo * 1.25, now + 0.015);
    }
  }

  if (song.bass && noteIndex % 2 === 0) {
    const bassFreq = song.bass[Math.floor(noteIndex / 2) % song.bass.length];
    playBgmTone(bassFreq, 'square', song.bassGain || 0.016, song.tempo * 1.65, now, -7);
  }

  if (song.beat) {
    playBgmBeat(noteIndex, now, song.tempo);
  }

  noteIndex++;
  bgmTimer = setTimeout(scheduleNextNote, song.tempo * 1000);
}

function getBgmKey(song, index) {
  return song.useTone ? `tone:${song.toneBuilder}` : `web:${index}`;
}

function disconnectAudioNodes(nodes) {
  nodes.forEach((node) => {
    if (!node || typeof node.disconnect !== 'function') return;
    try {
      node.disconnect();
    } catch (error) {
      // 既に切断済みの場合は何もしない
    }
  });
}

function playBgmTone(freq, waveType, level, duration, startTime, detune = 0) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = waveType;
  osc.frequency.setValueAtTime(freq, startTime);
  osc.detune.setValueAtTime(detune, startTime);
  gain.gain.setValueAtTime(level, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
  osc.onended = () => {
    disconnectAudioNodes([osc, gain]);
    osc.onended = null;
  };
}

function playBgmBeat(index, now, tempo) {
  const hat = audioCtx.createOscillator();
  const hatGain = audioCtx.createGain();
  hat.type = 'square';
  hat.frequency.setValueAtTime(index % 2 === 0 ? 4200 : 3100, now);
  hatGain.gain.setValueAtTime(index % 4 === 0 ? 0.018 : 0.01, now);
  hatGain.gain.exponentialRampToValueAtTime(0.001, now + Math.min(0.055, tempo * 0.55));
  hat.connect(hatGain);
  hatGain.connect(audioCtx.destination);
  hat.start(now);
  hat.stop(now + Math.min(0.06, tempo * 0.6));
  hat.onended = () => {
    disconnectAudioNodes([hat, hatGain]);
    hat.onended = null;
  };

  if (index % 4 === 0) {
    const kick = audioCtx.createOscillator();
    const kickGain = audioCtx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(150, now);
    kick.frequency.exponentialRampToValueAtTime(55, now + 0.09);
    kickGain.gain.setValueAtTime(0.05, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    kick.connect(kickGain);
    kickGain.connect(audioCtx.destination);
    kick.start(now);
    kick.stop(now + 0.13);
    kick.onended = () => {
      disconnectAudioNodes([kick, kickGain]);
      kick.onended = null;
    };
  }
}
