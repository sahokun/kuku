
function playSe(type) {
  if (isMuted || !audioCtx) return;
  const now = audioCtx.currentTime;
  const connectSeNodes = (source, gainNode) => {
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    source.onended = () => {
      disconnectSeNodes([source, gainNode]);
      source.onended = null;
    };
  };
  if (type === 'result') {
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      connectSeNodes(o, g);
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.05, now + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
      o.start(now + i * 0.1);
      o.stop(now + i * 0.1 + 0.4);
    });
    return;
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  connectSeNodes(osc, gain);

  if (type === 'btn') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'correct') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.linearRampToValueAtTime(1046.50, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'incorrect') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.3);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'cancel') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else {
    disconnectSeNodes([osc, gain]);
  }
}

function disconnectSeNodes(nodes) {
  nodes.forEach((node) => {
    if (!node || typeof node.disconnect !== 'function') return;
    try {
      node.disconnect();
    } catch (error) {
      // 既に切断済みなら無視する
    }
  });
}
