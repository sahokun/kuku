
function buildToneEngineNoriNori() {
  const limiter = new Tone.Limiter(-2).toDestination();
  const masterComp = new Tone.Compressor({ threshold: -16, ratio: 3.5, attack: 0.005, release: 0.12 }).connect(limiter);
  const reverb = new Tone.Reverb({ decay: 3.2, wet: 0.22 }).connect(masterComp);
  const pingpong = new Tone.PingPongDelay({ delayTime: '8n.', feedback: 0.32, wet: 0.2 }).connect(reverb);

  // Lead: super-saw
  const leadFilter = new Tone.Filter({ frequency: 2400, type: 'lowpass', rolloff: -24, Q: 1.5 });
  const leadAuto = new Tone.AutoFilter({ frequency: '2m', baseFrequency: 500, octaves: 3.2, depth: 0.9, wet: 0.55 }).start();
  const lead = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 28 },
    envelope: { attack: 0.005, decay: 0.18, sustain: 0.25, release: 0.18 }
  });
  lead.chain(leadFilter, leadAuto, pingpong);
  lead.volume.value = -16;

  // Bass: rubber/acid
  const bass = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { Q: 3, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.004, decay: 0.18, sustain: 0.35, release: 0.1 },
    filterEnvelope: { attack: 0.004, decay: 0.16, sustain: 0.25, release: 0.2, baseFrequency: 140, octaves: 3.6 }
  }).connect(masterComp);
  bass.volume.value = -10;

  // Pad
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsine', count: 3, spread: 32 },
    envelope: { attack: 0.9, decay: 0.5, sustain: 0.65, release: 2.2 }
  }).connect(reverb);
  pad.volume.value = -28;

  // Pluck (counter-melody)
  const pluck = new Tone.PluckSynth({ attackNoise: 0.6, dampening: 4200, resonance: 0.8 }).connect(pingpong);
  pluck.volume.value = -18;

  // Kick
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.04, octaves: 6,
    envelope: { attack: 0.001, decay: 0.36, sustain: 0.01, release: 1.0 }
  }).connect(masterComp);
  kick.volume.value = -3;

  // Clap (white noise + filter)
  const clapFilter = new Tone.Filter(1800, 'bandpass');
  const clap = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 }
  });
  clap.chain(clapFilter, masterComp);
  clap.volume.value = -14;

  // Hat
  const hatHp = new Tone.Filter(7500, 'highpass');
  const hat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5
  });
  hat.chain(hatHp, masterComp);
  hat.volume.value = -34;

  // Open hat (longer)
  const openHat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.25, release: 0.05 },
    harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5
  });
  openHat.chain(hatHp, masterComp);
  openHat.volume.value = -36;

  // ---- Patterns ----
  // 16-bar progression: Cm - Cm - Gm - Cm - Abmaj7 - Fm - Gm - Cm (per 2bar)
  const chordProg = [
    ['C4','Eb4','G4'], ['C4','Eb4','G4'],
    ['G3','Bb3','D4'], ['C4','Eb4','G4'],
    ['Ab3','C4','Eb4','G4'], ['F3','Ab3','C4'],
    ['G3','Bb3','D4'], ['C4','Eb4','G4']
  ];
  const bassRoots = ['C2','C2','G1','C2','Ab1','F1','G1','C2'];

  // Lead arpeggio per bar (16 sixteenth notes each)
  const arpFor = (root) => {
    const map = {
      'C2': ['C5','G5','Eb5','Bb5','C5','G5','Eb5','Bb5','D5','G5','Eb5','Bb5','C5','G5','Eb5','Bb5'],
      'G1': ['G4','D5','Bb4','F5','G4','D5','Bb4','F5','A4','D5','Bb4','F5','G4','D5','Bb4','F5'],
      'Ab1':['Ab4','Eb5','C5','G5','Ab4','Eb5','C5','G5','Bb4','Eb5','C5','G5','Ab4','Eb5','C5','G5'],
      'F1': ['F4','C5','Ab4','Eb5','F4','C5','Ab4','Eb5','G4','C5','Ab4','Eb5','F4','C5','Ab4','Eb5']
    };
    return map[root] || map['C2'];
  };

  let bar = 0;
  let sixteenth = 0;

  // 4-on-the-floor kick (eighth-note based with empty beats)
  const kickLoop = new Tone.Loop((time) => {
    kick.triggerAttackRelease('C2', '8n', time);
  }, '4n');

  // Clap on beats 2 & 4
  const clapLoop = new Tone.Loop((time) => {
    clap.triggerAttackRelease('16n', time);
  }, '2n');

  // Hats: 8th notes, accents on offbeats
  let hatStep = 0;
  const hatLoop = new Tone.Loop((time) => {
    const onBeat = hatStep % 2 === 0;
    if (hatStep % 8 === 7) {
      openHat.triggerAttackRelease('C5', '16n', time, 0.6);
    } else {
      hat.triggerAttackRelease('C5', '32n', time, onBeat ? 0.35 : 0.7);
    }
    hatStep++;
  }, '8n');

  // Bass: octave-jumping eighths with occasional ghost notes
  let bassStep = 0;
  const bassLoop = new Tone.Loop((time) => {
    const root = bassRoots[bar % bassRoots.length];
    const high = Tone.Frequency(root).transpose(12).toNote();
    const pos = bassStep % 8;
    const note = (pos % 2 === 0) ? root : high;
    const vel = (pos === 0) ? 0.95 : (pos % 2 === 0 ? 0.7 : 0.55);
    bass.triggerAttackRelease(note, '8n', time, vel);
    bassStep++;
  }, '8n');

  // Pad: hold chord per bar
  const padLoop = new Tone.Loop((time) => {
    const ch = chordProg[bar % chordProg.length];
    pad.triggerAttackRelease(ch, '1m', time, 0.6);
  }, '1m');

  // Lead arpeggio: 16th notes, drops out on bar 4 & 12 for variation
  const leadLoop = new Tone.Loop((time) => {
    const localBar = bar % 8;
    const skipBar = (localBar === 3 || localBar === 7);
    if (!skipBar) {
      const root = bassRoots[bar % bassRoots.length];
      const arp = arpFor(root);
      const n = arp[sixteenth % arp.length];
      lead.triggerAttackRelease(n, '16n', time, 0.55);
    }
    sixteenth++;
  }, '16n');

  // Pluck counter-melody: every other bar, syncopated
  let pluckStep = 0;
  const pluckLoop = new Tone.Loop((time) => {
    if (bar % 2 === 1) {
      const root = bassRoots[bar % bassRoots.length];
      const arp = arpFor(root);
      const n = arp[(pluckStep * 3) % arp.length];
      pluck.triggerAttackRelease(Tone.Frequency(n).transpose(12).toNote(), time);
    }
    pluckStep++;
  }, '4n');

  // Bar counter
  const barLoop = new Tone.Loop((time) => {
    bar++;
  }, '1m');

  // Riser/sweep effect every 8 bars (simple filter automation on lead)
  const sweepLoop = new Tone.Loop((time) => {
    if (bar % 8 === 7) {
      leadFilter.frequency.cancelScheduledValues(time);
      leadFilter.frequency.setValueAtTime(400, time);
      leadFilter.frequency.exponentialRampToValueAtTime(8000, time + Tone.Time('1m').toSeconds());
    }
  }, '1m');

  return {
    bpm: 128,
    loops: [kickLoop, clapLoop, hatLoop, bassLoop, padLoop, leadLoop, pluckLoop, barLoop, sweepLoop],
    reset() {
      bar = 0; sixteenth = 0; hatStep = 0; bassStep = 0; pluckStep = 0;
    },
    start() {
      this.reset();
      Tone.Transport.bpm.value = this.bpm;
      kickLoop.start(0);
      clapLoop.start('0:1');
      hatLoop.start(0);
      bassLoop.start(0);
      padLoop.start(0);
      leadLoop.start('0:0:2');
      pluckLoop.start(0);
      barLoop.start('0:3:3');
      sweepLoop.start(0);
    },
    stop() {
      this.loops.forEach(l => l.stop());
    }
  };
}

function buildToneEngineWakuwaku() {
  const limiter = new Tone.Limiter(-2).toDestination();
  const masterComp = new Tone.Compressor({ threshold: -16, ratio: 3, attack: 0.005, release: 0.15 }).connect(limiter);
  const reverb = new Tone.Reverb({ decay: 4.2, wet: 0.28 }).connect(masterComp);
  const delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.22, wet: 0.18 }).connect(reverb);
  const chorus = new Tone.Chorus({ frequency: 1.4, depth: 0.7, wet: 0.55 }).start().connect(reverb);

  // Strings pad
  const strings = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 30 },
    envelope: { attack: 0.55, decay: 0.4, sustain: 0.85, release: 1.6 }
  });
  const stringsFilter = new Tone.Filter(2400, 'lowpass');
  strings.chain(stringsFilter, chorus);
  strings.volume.value = -22;

  // Bell (FM)
  const bell = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01,
    modulationIndex: 14,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 1.4 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.5 }
  }).connect(delay);
  bell.volume.value = -22;

  // Chiptune lead (square)
  const chip = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.005, decay: 0.08, sustain: 0.2, release: 0.1 }
  });
  const chipFilter = new Tone.Filter(3800, 'lowpass');
  chip.chain(chipFilter, delay);
  chip.volume.value = -16;

  // Pluck/piano-ish
  const pluck = new Tone.PluckSynth({ attackNoise: 0.4, dampening: 4500, resonance: 0.85 }).connect(reverb);
  pluck.volume.value = -14;

  // Bouncy bass
  const bass = new Tone.MonoSynth({
    oscillator: { type: 'triangle' },
    filter: { Q: 1.5, type: 'lowpass' },
    envelope: { attack: 0.005, decay: 0.18, sustain: 0.4, release: 0.2 },
    filterEnvelope: { attack: 0.005, decay: 0.14, sustain: 0.4, release: 0.2, baseFrequency: 220, octaves: 2.5 }
  }).connect(masterComp);
  bass.volume.value = -10;

  // Drums
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.04, octaves: 5,
    envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.8 }
  }).connect(masterComp);
  kick.volume.value = -6;

  const snareFilter = new Tone.Filter(1500, 'highpass');
  const snare = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.002, decay: 0.13, sustain: 0 }
  });
  snare.chain(snareFilter, masterComp);
  snare.volume.value = -16;

  const shakerHp = new Tone.Filter(8000, 'highpass');
  const shaker = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.002, decay: 0.04, sustain: 0 }
  });
  shaker.chain(shakerHp, masterComp);
  shaker.volume.value = -28;

  const crash = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.6, release: 0.2 },
    harmonicity: 5.1, modulationIndex: 18, resonance: 6000, octaves: 1
  }).connect(reverb);
  crash.volume.value = -22;

  // ---- Patterns ----
  // 8-bar diatonic progression (C major): C - G - Am - F - C - G - F - G
  const chordProg = [
    ['C4','E4','G4'], ['G3','B3','D4'], ['A3','C4','E4'], ['F3','A3','C4'],
    ['C4','E4','G4'], ['G3','B3','D4'], ['F3','A3','C4'], ['G3','B3','D4']
  ];
  const bassRoots = ['C2','G2','A1','F1','C2','G2','F1','G2'];

  // Chip melody (16 sixteenths per bar, 8 bars)
  const melodyByBar = [
    ['C5','E5','G5','C6','G5','E5','G5','C6','E6','G6','E6','C6','G5','E5','D5','C5'],
    ['D5','G5','B5','D6','B5','G5','B5','D6','G6','D6','B5','G5','D5','B4','A4','G4'],
    ['E5','A5','C6','E6','C6','A5','C6','E6','A6','E6','C6','A5','E5','C5','B4','A4'],
    ['F5','A5','C6','F6','C6','A5','F5','C5','A4','F4','A4','C5','F5','A5','G5','F5'],
    ['C5','E5','G5','C6','E6','G6','E6','C6','G5','E5','C5','G4','C5','E5','G5','C6'],
    ['B4','D5','G5','B5','D6','G6','D6','B5','G5','D5','B4','G4','D5','B4','A4','G4'],
    ['F5','A5','C6','F6','A6','F6','C6','A5','F5','C5','A4','F4','C5','F5','A5','C6'],
    ['G5','B5','D6','G6','B6','G6','D6','B5','G5','D5','B4','G4','G5','B5','D6','G6']
  ];

  let bar = 0;
  let sixteenth = 0;
  let bassStep = 0;
  let shakerStep = 0;
  let kickStep = 0;
  let bellStep = 0;
  let pluckStep = 0;

  // Kick: 1 & 3
  const kickLoop = new Tone.Loop((time) => {
    if (kickStep % 2 === 0) {
      kick.triggerAttackRelease('C2', '8n', time);
    }
    kickStep++;
  }, '4n');

  // Snare: beats 2 & 4
  const snareLoop = new Tone.Loop((time) => {
    snare.triggerAttackRelease('16n', time);
  }, '2n');

  // Shaker 16ths
  const shakerLoop = new Tone.Loop((time) => {
    const accent = (shakerStep % 4 === 2) ? 0.55 : ((shakerStep % 2 === 1) ? 0.45 : 0.25);
    shaker.triggerAttackRelease('64n', time, accent);
    shakerStep++;
  }, '16n');

  // Bouncy bass: octave-jumping eighths
  const bassLoop = new Tone.Loop((time) => {
    const root = bassRoots[bar % bassRoots.length];
    const high = Tone.Frequency(root).transpose(12).toNote();
    const pos = bassStep % 8;
    const note = (pos % 2 === 0) ? root : high;
    const vel = (pos === 0) ? 0.95 : 0.7;
    bass.triggerAttackRelease(note, '16n', time, vel);
    bassStep++;
  }, '8n');

  // Strings pad: hold chord per bar
  const stringsLoop = new Tone.Loop((time) => {
    const ch = chordProg[bar % chordProg.length];
    strings.triggerAttackRelease(ch, '1m', time, 0.5);
  }, '1m');

  // Bell arpeggio every other bar
  const bellLoop = new Tone.Loop((time) => {
    if (bar % 2 === 1) {
      const ch = chordProg[bar % chordProg.length];
      const note = ch[bellStep % ch.length];
      const up = Tone.Frequency(note).transpose(12).toNote();
      bell.triggerAttackRelease(up, '8n', time, 0.55);
    }
    bellStep++;
  }, '8n');

  // Chiptune lead: 16ths, drops on bar 4 & 8 of cycle
  const chipLoop = new Tone.Loop((time) => {
    const localBar = bar % 8;
    const skip = (localBar === 3 || localBar === 7);
    if (!skip) {
      const mel = melodyByBar[bar % melodyByBar.length];
      const n = mel[sixteenth % mel.length];
      chip.triggerAttackRelease(n, '16n', time, 0.55);
    }
    sixteenth++;
  }, '16n');

  // Pluck counter: every other bar offbeats
  const pluckLoop = new Tone.Loop((time) => {
    if (bar % 2 === 0 && pluckStep % 2 === 1) {
      const ch = chordProg[bar % chordProg.length];
      const n = ch[pluckStep % ch.length];
      pluck.triggerAttackRelease(Tone.Frequency(n).transpose(12).toNote(), time);
    }
    pluckStep++;
  }, '4n');

  // Crash on cycle start
  const crashLoop = new Tone.Loop((time) => {
    if (bar % 8 === 0) {
      crash.triggerAttackRelease('C5', '2n', time, 0.45);
    }
  }, '1m');

  // Bar advance (end of bar)
  const barLoop = new Tone.Loop((time) => {
    bar++;
  }, '1m');

  return {
    bpm: 138,
    loops: [kickLoop, snareLoop, shakerLoop, bassLoop, stringsLoop, bellLoop, chipLoop, pluckLoop, crashLoop, barLoop],
    reset() {
      bar = 0; sixteenth = 0; bassStep = 0; shakerStep = 0;
      kickStep = 0; bellStep = 0; pluckStep = 0;
    },
    start() {
      this.reset();
      Tone.Transport.bpm.value = this.bpm;
      kickLoop.start(0);
      snareLoop.start('0:1');
      shakerLoop.start(0);
      bassLoop.start(0);
      stringsLoop.start(0);
      bellLoop.start('0:0:2');
      chipLoop.start('0:0:2');
      pluckLoop.start(0);
      crashLoop.start(0);
      barLoop.start('0:3:3');
    },
    stop() {
      this.loops.forEach(l => l.stop());
    }
  };
}

const TONE_BUILDERS = {
  norinori: buildToneEngineNoriNori,
  wakuwaku: buildToneEngineWakuwaku
};

async function startToneEngine() {
  if (typeof Tone === 'undefined') return;
  const song = BGM_SONGS[currentSongIndex];
  const id = song && song.toneBuilder;
  if (!id || !TONE_BUILDERS[id]) return;
  try {
    if (Tone.context.state !== 'running') await Tone.start();

    // Stop a different engine if running
    if (toneRunning && activeToneId && activeToneId !== id) {
      const prev = toneEngines[activeToneId];
      if (prev) prev.stop();
      toneRunning = false;
    }

    if (!toneEngines[id]) {
      toneEngines[id] = TONE_BUILDERS[id]();
    }
    const eng = toneEngines[id];
    if (!eng) return;
    if (toneRunning && activeToneId === id) return;

    eng.start();
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start('+0.05');
    }
    activeToneId = id;
    toneRunning = true;
  } catch (e) {
    console.warn('Tone start failed', e);
  }
}

function stopToneEngine() {
  if (!toneRunning) return;
  try {
    if (activeToneId && toneEngines[activeToneId]) {
      toneEngines[activeToneId].stop();
    }
    if (typeof Tone !== 'undefined' && Tone.Transport.state === 'started') {
      Tone.Transport.stop();
    }
  } catch (_) {}
  toneRunning = false;
}
