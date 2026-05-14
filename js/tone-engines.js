
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
  const masterGain = new Tone.Gain(0.55).toDestination();

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 }
  }).connect(masterGain);
  kick.volume.value = -7;

  const bass = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.003, decay: 0.09, sustain: 0.22, release: 0.05 }
  }).connect(masterGain);
  bass.volume.value = -16;

  const lead = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.003, decay: 0.05, sustain: 0.12, release: 0.05 }
  }).connect(masterGain);
  lead.volume.value = -19;

  const bassRoots = ['C2', 'C2', 'G1', 'C2', 'Ab1', 'F1', 'G1', 'C2'];
  const bassPattern = [0, 12, 7, null, 0, 12, 7, null];
  const leadByBar = [
    ['C5', null, 'G5', null, 'Eb5', null, 'G5', null],
    ['G4', null, 'D5', null, 'Bb4', null, 'D5', null],
    ['Ab4', null, 'Eb5', null, 'C5', null, 'Eb5', null],
    ['F4', null, 'C5', null, 'Ab4', null, 'C5', null]
  ];

  let step = 0;
  const masterLoop = new Tone.Loop((time) => {
    const bar = Math.floor(step / 8);
    const beatStep = step % 8;
    const root = bassRoots[bar % bassRoots.length];

    if (beatStep % 2 === 0) {
      kick.triggerAttackRelease('C2', '8n', time);
    }

    const bassOffset = bassPattern[beatStep];
    if (bassOffset !== null) {
      const bassNote = Tone.Frequency(root).transpose(bassOffset).toNote();
      bass.triggerAttackRelease(bassNote, '8n', time, beatStep === 0 ? 0.72 : 0.5);
    }

    const leadPattern = leadByBar[bar % leadByBar.length];
    const leadNote = leadPattern[beatStep];
    if (leadNote) {
      lead.triggerAttackRelease(leadNote, '8n', time, 0.42);
    }

    step++;
  }, '8n');

  const loops = [masterLoop];
  const disposables = [masterLoop, lead, bass, kick, masterGain];

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
  const masterGain = new Tone.Gain(0.5).toDestination();

  const chip = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.003, decay: 0.06, sustain: 0.15, release: 0.05 }
  }).connect(masterGain);
  chip.volume.value = -18;

  const bass = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.004, decay: 0.1, sustain: 0.25, release: 0.06 }
  }).connect(masterGain);
  bass.volume.value = -15;

  const accent = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 }
  }).connect(masterGain);
  accent.volume.value = -14;

  const bassRoots = ['C2', 'G2', 'A1', 'F1', 'C2', 'G2', 'F1', 'G2'];
  const bassPattern = [0, null, 12, null, 0, 7, null, 12];
  const melodyByBar = [
    ['C5', null, 'E5', null, 'G5', null, 'C6', null],
    ['D5', null, 'G5', null, 'B5', null, 'D6', null],
    ['E5', null, 'A5', null, 'C6', null, 'E6', null],
    ['F5', null, 'A5', null, 'C6', null, 'F6', null],
    ['C5', null, 'E5', null, 'G5', null, 'C6', null],
    ['B4', null, 'D5', null, 'G5', null, 'B5', null],
    ['F5', null, 'A5', null, 'C6', null, 'F6', null],
    ['G5', null, 'B5', null, 'D6', null, 'G6', null]
  ];

  let step = 0;
  const masterLoop = new Tone.Loop((time) => {
    const bar = Math.floor(step / 8);
    const beatStep = step % 8;
    const root = bassRoots[bar % bassRoots.length];

    if (beatStep === 0) {
      accent.triggerAttackRelease('C5', '8n', time, 0.5);
    }

    const bassOffset = bassPattern[beatStep];
    if (bassOffset !== null) {
      const bassNote = Tone.Frequency(root).transpose(bassOffset).toNote();
      bass.triggerAttackRelease(bassNote, '8n', time, beatStep === 0 ? 0.62 : 0.46);
    }

    const melody = melodyByBar[bar % melodyByBar.length];
    const chipNote = melody[beatStep];
    if (chipNote) {
      chip.triggerAttackRelease(chipNote, '8n', time, 0.42);
    }

    step++;
  }, '8n');

  const loops = [masterLoop];
  const disposables = [masterLoop, accent, bass, chip, masterGain];

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
