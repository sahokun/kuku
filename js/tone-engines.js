
function disposeToneNodes(disposables) {
  disposables.forEach((node) => {
    if (!node || typeof node.dispose !== 'function') return;
    if (node.disposed) return;
    try {
      node.dispose();
    } catch (error) {
      console.warn('Tone node dispose failed', error);
    }
  });
}

function stopToneLoops(loops) {
  loops.forEach((loop) => {
    if (!loop || typeof loop.stop !== 'function') return;
    try {
      loop.stop();
    } catch (error) {
      console.warn('Tone loop stop failed', error);
    }
  });
}

function resetToneTransport() {
  if (typeof Tone === 'undefined') return;
  if (!Tone.Transport) return;
  try {
    if (typeof Tone.Transport.stop === 'function') Tone.Transport.stop();
    if (typeof Tone.Transport.cancel === 'function') Tone.Transport.cancel(0);
    Tone.Transport.position = 0;
  } catch (error) {
    console.warn('Tone transport reset failed', error);
  }
}

function createManagedToneEngine({ bpm, loops, disposables, start }) {
  let started = false;
  let stopped = true;
  let disposed = false;

  return {
    bpm,
    loops,
    disposables,
    start() {
      if (disposed || started) return;
      started = true;
      stopped = false;
      start.call(this);
    },
    stop() {
      if (disposed || stopped) return;
      stopToneLoops(this.loops);
      stopped = true;
      started = false;
    },
    dispose() {
      if (disposed) return;
      this.stop();
      disposeToneNodes(this.disposables);
      this.loops = [];
      this.disposables = [];
      disposed = true;
    }
  };
}

function buildToneEngineNoriNori() {
  const limiter = new Tone.Limiter(-2).toDestination();
  const masterComp = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.006, release: 0.12 }).connect(limiter);
  const delay = new Tone.PingPongDelay({ delayTime: '8n.', feedback: 0.2, wet: 0.12 }).connect(masterComp);

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.035,
    octaves: 5,
    envelope: { attack: 0.001, decay: 0.25, sustain: 0.01, release: 0.18 }
  }).connect(masterComp);
  kick.volume.value = -4;

  const bass = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { Q: 1.5, type: 'lowpass', rolloff: -12 },
    envelope: { attack: 0.004, decay: 0.14, sustain: 0.35, release: 0.08 },
    filterEnvelope: { attack: 0.004, decay: 0.12, sustain: 0.2, release: 0.12, baseFrequency: 120, octaves: 2.5 }
  }).connect(masterComp);
  bass.volume.value = -11;

  const lead = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.004, decay: 0.08, sustain: 0.18, release: 0.08 }
  }).connect(delay);
  lead.volume.value = -17;

  const clapFilter = new Tone.Filter(1800, 'bandpass').connect(masterComp);
  const clap = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.02 }
  }).connect(clapFilter);
  clap.volume.value = -15;

  const hatFilter = new Tone.Filter(6500, 'highpass').connect(masterComp);
  const hat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.01 }
  }).connect(hatFilter);
  hat.volume.value = -28;

  const bassRoots = ['C2', 'C2', 'G1', 'C2', 'Ab1', 'F1', 'G1', 'C2'];
  const bassPattern = [0, 12, null, 12, 0, null, 12, null, 0, 12, null, 7, 0, null, 12, null];
  const leadByBar = [
    ['C5', null, 'G5', null, 'Eb5', null, 'G5', null, 'Bb5', null, 'G5', null, 'Eb5', null, 'C5', null],
    [null, 'G4', null, 'D5', 'Bb4', null, 'D5', null, 'F5', null, 'D5', null, 'Bb4', null, 'G4', null],
    ['Ab4', null, 'Eb5', null, 'C5', null, 'Eb5', null, 'G5', null, 'Eb5', null, 'C5', null, 'Ab4', null],
    ['F4', null, 'C5', null, 'Ab4', null, 'C5', null, 'Eb5', null, 'C5', null, 'Ab4', null, 'F4', null]
  ];

  let step = 0;
  const masterLoop = new Tone.Loop((time) => {
    const bar = Math.floor(step / 16);
    const beatStep = step % 16;
    const root = bassRoots[bar % bassRoots.length];

    if (beatStep % 4 === 0) {
      kick.triggerAttackRelease('C2', '8n', time);
    }

    if (beatStep === 4 || beatStep === 12) {
      clap.triggerAttackRelease('16n', time, 0.75);
    } else if (beatStep === 2 || beatStep === 6 || beatStep === 10 || beatStep === 14) {
      hat.triggerAttackRelease('32n', time, beatStep === 14 ? 0.55 : 0.38);
    }

    const bassOffset = bassPattern[beatStep];
    if (bassOffset !== null) {
      const bassNote = Tone.Frequency(root).transpose(bassOffset).toNote();
      bass.triggerAttackRelease(bassNote, '16n', time, beatStep === 0 ? 0.9 : 0.65);
    }

    if (beatStep % 2 === 0 || beatStep === 5 || beatStep === 13) {
      const leadPattern = leadByBar[bar % leadByBar.length];
      const leadNote = leadPattern[beatStep];
      if (leadNote) {
        lead.triggerAttackRelease(leadNote, '16n', time, 0.5);
      }
    }

    step++;
  }, '16n');

  const loops = [masterLoop];
  const disposables = [masterLoop, hat, hatFilter, clap, clapFilter, lead, bass, kick, delay, masterComp, limiter];

  return createManagedToneEngine({
    bpm: 126,
    loops,
    disposables,
    start() {
      step = 0;
      Tone.Transport.bpm.value = this.bpm;
      masterLoop.start(0);
    }
  });
}

function buildToneEngineWakuwaku() {
  const limiter = new Tone.Limiter(-2).toDestination();
  const masterComp = new Tone.Compressor({ threshold: -18, ratio: 2.8, attack: 0.006, release: 0.14 }).connect(limiter);
  const delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.16, wet: 0.1 }).connect(masterComp);

  const chip = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.004, decay: 0.07, sustain: 0.18, release: 0.07 }
  }).connect(delay);
  chip.volume.value = -16;

  const bell = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.002, decay: 0.32, sustain: 0, release: 0.18 }
  }).connect(delay);
  bell.volume.value = -20;

  const bass = new Tone.MonoSynth({
    oscillator: { type: 'triangle' },
    filter: { Q: 1.2, type: 'lowpass', rolloff: -12 },
    envelope: { attack: 0.005, decay: 0.12, sustain: 0.35, release: 0.1 },
    filterEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.25, release: 0.12, baseFrequency: 180, octaves: 2 }
  }).connect(masterComp);
  bass.volume.value = -11;

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.035,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.22, sustain: 0.01, release: 0.16 }
  }).connect(masterComp);
  kick.volume.value = -7;

  const rhythmFilter = new Tone.Filter(5200, 'highpass').connect(masterComp);
  const rhythm = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.01 }
  }).connect(rhythmFilter);
  rhythm.volume.value = -26;

  const snareFilter = new Tone.Filter(1800, 'bandpass').connect(masterComp);
  const snare = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.02 }
  }).connect(snareFilter);
  snare.volume.value = -18;

  const bassRoots = ['C2', 'G2', 'A1', 'F1', 'C2', 'G2', 'F1', 'G2'];
  const bassPattern = [0, null, 12, null, 0, 7, null, 12, 0, null, 12, null, 7, null, 12, null];
  const melodyByBar = [
    ['C5', null, 'E5', null, 'G5', null, 'C6', null, 'G5', null, 'E5', null, 'D5', null, 'C5', null],
    ['D5', null, 'G5', null, 'B5', null, 'D6', null, 'B5', null, 'G5', null, 'A4', null, 'G4', null],
    ['E5', null, 'A5', null, 'C6', null, 'E6', null, 'C6', null, 'A5', null, 'B4', null, 'A4', null],
    ['F5', null, 'A5', null, 'C6', null, 'F6', null, 'C6', null, 'A5', null, 'G5', null, 'F5', null],
    ['C5', null, 'E5', null, 'G5', null, 'C6', null, 'E6', null, 'G6', null, 'E6', null, 'C6', null],
    ['B4', null, 'D5', null, 'G5', null, 'B5', null, 'D6', null, 'G6', null, 'A4', null, 'G4', null],
    ['F5', null, 'A5', null, 'C6', null, 'F6', null, 'A6', null, 'F6', null, 'C6', null, 'A5', null],
    ['G5', null, 'B5', null, 'D6', null, 'G6', null, 'B6', null, 'G6', null, 'D6', null, 'B5', null]
  ];

  let step = 0;
  const masterLoop = new Tone.Loop((time) => {
    const bar = Math.floor(step / 16);
    const beatStep = step % 16;
    const root = bassRoots[bar % bassRoots.length];

    if (beatStep === 0 || beatStep === 8) {
      kick.triggerAttackRelease('C2', '8n', time, beatStep === 0 ? 0.75 : 0.55);
    }
    if (beatStep === 4 || beatStep === 12) {
      snare.triggerAttackRelease('16n', time, 0.5);
    } else if (beatStep % 2 === 1) {
      rhythm.triggerAttackRelease('64n', time, beatStep % 4 === 3 ? 0.45 : 0.28);
    }

    const bassOffset = bassPattern[beatStep];
    if (bassOffset !== null) {
      const bassNote = Tone.Frequency(root).transpose(bassOffset).toNote();
      bass.triggerAttackRelease(bassNote, '16n', time, beatStep === 0 ? 0.82 : 0.58);
    }

    const melody = melodyByBar[bar % melodyByBar.length];
    const chipNote = melody[beatStep];
    if (chipNote && bar % 8 !== 3 && bar % 8 !== 7) {
      chip.triggerAttackRelease(chipNote, '16n', time, 0.48);
    }

    if ((beatStep === 0 || beatStep === 10) && bar % 2 === 0) {
      const bellNote = Tone.Frequency(root).transpose(24).toNote();
      bell.triggerAttackRelease(bellNote, '8n', time, beatStep === 0 ? 0.42 : 0.28);
    }

    step++;
  }, '16n');

  const loops = [masterLoop];
  const disposables = [masterLoop, snare, snareFilter, rhythm, rhythmFilter, kick, bass, bell, chip, delay, masterComp, limiter];

  return createManagedToneEngine({
    bpm: 132,
    loops,
    disposables,
    start() {
      step = 0;
      Tone.Transport.bpm.value = this.bpm;
      masterLoop.start(0);
    }
  });
}

const TONE_BUILDERS = {
  norinori: buildToneEngineNoriNori,
  wakuwaku: buildToneEngineWakuwaku
};

function disposeActiveToneEngine() {
  if (!activeToneEngine) return;
  const engine = activeToneEngine;
  activeToneEngine = null;
  activeToneId = null;
  toneRunning = false;
  try {
    engine.stop();
  } catch (error) {
    console.warn('Tone engine stop failed', error);
  }
  try {
    engine.dispose();
  } catch (error) {
    console.warn('Tone engine dispose failed', error);
  }
}

async function startToneEngine(shouldContinue) {
  if (typeof Tone === 'undefined') return false;
  const song = BGM_SONGS[currentSongIndex];
  const id = song && song.toneBuilder;
  if (!id || !TONE_BUILDERS[id]) return false;
  try {
    if (toneRunning && activeToneId === id && activeToneEngine) return true;

    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    if (shouldContinue && !shouldContinue()) return false;

    disposeActiveToneEngine();
    resetToneTransport();

    const engine = TONE_BUILDERS[id]();
    activeToneEngine = engine;
    activeToneId = id;

    engine.start();
    Tone.Transport.start('+0.05');
    toneRunning = true;
    return true;
  } catch (error) {
    console.warn('Tone start failed', error);
    disposeActiveToneEngine();
    resetToneTransport();
    return false;
  }
}

function stopToneEngine() {
  disposeActiveToneEngine();
  resetToneTransport();
}
