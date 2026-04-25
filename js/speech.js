
function initVoice() {
  const voices = synth.getVoices();
  // 日本語の音声を探す
  voice = voices.find(v => v.lang === 'ja-JP') || voices[0];
}

if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = initVoice;
}

function speak(text) {
  if (synth.speaking) {
    synth.cancel();
  }
  const utterThis = new SpeechSynthesisUtterance(text);
  if (voice) utterThis.voice = voice;
  utterThis.lang = 'ja-JP';
  utterThis.rate = 1.0;
  utterThis.pitch = 1.2; // 子供向けに少し高め
  synth.speak(utterThis);
}

// 九九データから読み上げ用テキストを取得（q_speak/a_speak 優先、無ければ q_read/a_read）
function getQSpeak(q) { return q.q_speak || q.q_read; }
function getASpeak(q) { return q.a_speak || q.a_read; }
function getFullSpeak(q) { return getQSpeak(q) + getASpeak(q); }
