// 九九データ (読み仮名付き)
// q_read / a_read: 画面表示用（ひらがな）
// q_speak / a_speak: 読み上げ用（省略時は q_read / a_read を使用）
//   語末の「は」は iPhone 等で助詞「わ」と解釈されるため、カタカナ「ハ」で指定して回避する
const kukuData = [
  // 1の段
  { a: 1, b: 1, q_read: "いんいちが", a_read: "いち" },
  { a: 1, b: 2, q_read: "いんにが", a_read: "に" },
  { a: 1, b: 3, q_read: "いんさんが", a_read: "さん" },
  { a: 1, b: 4, q_read: "いんしが", a_read: "し" },
  { a: 1, b: 5, q_read: "いんごが", a_read: "ご" },
  { a: 1, b: 6, q_read: "いんろくが", a_read: "ろく" },
  { a: 1, b: 7, q_read: "いんしちが", a_read: "しち" },
  { a: 1, b: 8, q_read: "いんはちが", a_read: "はち" },
  { a: 1, b: 9, q_read: "いんくが", a_read: "く" },
  // 2の段
  { a: 2, b: 1, q_read: "にいちが", a_read: "に" },
  { a: 2, b: 2, q_read: "ににんが", a_read: "し" },
  { a: 2, b: 3, q_read: "にさんが", a_read: "ろく" },
  { a: 2, b: 4, q_read: "にしが", a_read: "はち" },
  { a: 2, b: 5, q_read: "にご", a_read: "じゅう" },
  { a: 2, b: 6, q_read: "にろく", a_read: "じゅうに" },
  { a: 2, b: 7, q_read: "にしち", a_read: "じゅうし" },
  { a: 2, b: 8, q_read: "にはち", a_read: "じゅうろく" },
  { a: 2, b: 9, q_read: "にく", a_read: "じゅうはち" },
  // 3の段
  { a: 3, b: 1, q_read: "さんいちが", a_read: "さん" },
  { a: 3, b: 2, q_read: "さんにが", a_read: "ろく" },
  { a: 3, b: 3, q_read: "さざんが", a_read: "く" },
  { a: 3, b: 4, q_read: "さんし", a_read: "じゅうに" },
  { a: 3, b: 5, q_read: "さんご", a_read: "じゅうご" },
  { a: 3, b: 6, q_read: "さぶろく", a_read: "じゅうはち" },
  { a: 3, b: 7, q_read: "さんしち", a_read: "にじゅういち" },
  { a: 3, b: 8, q_read: "さんぱ", a_read: "にじゅうし" },
  { a: 3, b: 9, q_read: "さんく", a_read: "にじゅうしち" },
  // 4の段
  { a: 4, b: 1, q_read: "しいちが", a_read: "し" },
  { a: 4, b: 2, q_read: "しにが", a_read: "はち" },
  { a: 4, b: 3, q_read: "しさん", a_read: "じゅうに" },
  { a: 4, b: 4, q_read: "しし", a_read: "じゅうろく" },
  { a: 4, b: 5, q_read: "しご", a_read: "にじゅう" },
  { a: 4, b: 6, q_read: "しろく", a_read: "にじゅうし" },
  { a: 4, b: 7, q_read: "ししち", a_read: "にじゅうはち" },
  { a: 4, b: 8, q_read: "しは", a_read: "さんじゅうに", q_speak: "しハ" },
  { a: 4, b: 9, q_read: "しく", a_read: "さんじゅうろく" },
  // 5の段
  { a: 5, b: 1, q_read: "ごいちが", a_read: "ご" },
  { a: 5, b: 2, q_read: "ごに", a_read: "じゅう" },
  { a: 5, b: 3, q_read: "ごさん", a_read: "じゅうご" },
  { a: 5, b: 4, q_read: "ごし", a_read: "にじゅう" },
  { a: 5, b: 5, q_read: "ごご", a_read: "にじゅうご" },
  { a: 5, b: 6, q_read: "ごろく", a_read: "さんじゅう" },
  { a: 5, b: 7, q_read: "ごしち", a_read: "さんじゅうご" },
  { a: 5, b: 8, q_read: "ごは", a_read: "しじゅう", q_speak: "ごハ" },
  { a: 5, b: 9, q_read: "ごく", a_read: "しじゅうご" },
  // 6の段
  { a: 6, b: 1, q_read: "ろくいちが", a_read: "ろく" },
  { a: 6, b: 2, q_read: "ろくに", a_read: "じゅうに" },
  { a: 6, b: 3, q_read: "ろくさん", a_read: "じゅうはち" },
  { a: 6, b: 4, q_read: "ろくし", a_read: "にじゅうし" },
  { a: 6, b: 5, q_read: "ろくご", a_read: "さんじゅう" },
  { a: 6, b: 6, q_read: "ろくろく", a_read: "さんじゅうろく" },
  { a: 6, b: 7, q_read: "ろくしち", a_read: "しじゅうに" },
  { a: 6, b: 8, q_read: "ろくは", a_read: "しじゅうはち", q_speak: "ろくハ" },
  { a: 6, b: 9, q_read: "ろっく", a_read: "ごじゅうし" },
  // 7の段
  { a: 7, b: 1, q_read: "しちいちが", a_read: "しち" },
  { a: 7, b: 2, q_read: "しちに", a_read: "じゅうし" },
  { a: 7, b: 3, q_read: "しちさん", a_read: "にじゅういち" },
  { a: 7, b: 4, q_read: "しちし", a_read: "にじゅうはち" },
  { a: 7, b: 5, q_read: "しちご", a_read: "さんじゅうご" },
  { a: 7, b: 6, q_read: "しちろく", a_read: "しじゅうに" },
  { a: 7, b: 7, q_read: "しちしち", a_read: "しじゅうく" },
  { a: 7, b: 8, q_read: "しちは", a_read: "ごじゅうろく", q_speak: "しちハ" },
  { a: 7, b: 9, q_read: "しちく", a_read: "ろくじゅうさん" },
  // 8の段
  { a: 8, b: 1, q_read: "はちいちが", a_read: "はち" },
  { a: 8, b: 2, q_read: "はちに", a_read: "じゅうろく" },
  { a: 8, b: 3, q_read: "はちさん", a_read: "にじゅうし" },
  { a: 8, b: 4, q_read: "はちし", a_read: "さんじゅうに" },
  { a: 8, b: 5, q_read: "はちご", a_read: "しじゅう" },
  { a: 8, b: 6, q_read: "はちろく", a_read: "しじゅうはち" },
  { a: 8, b: 7, q_read: "はちしち", a_read: "ごじゅうろく" },
  { a: 8, b: 8, q_read: "はっぱ", a_read: "ろくじゅうし" },
  { a: 8, b: 9, q_read: "はっく", a_read: "しちじゅうに" },
  // 9の段
  { a: 9, b: 1, q_read: "くいちが", a_read: "く" },
  { a: 9, b: 2, q_read: "くに", a_read: "じゅうはち" },
  { a: 9, b: 3, q_read: "くさん", a_read: "にじゅうしち" },
  { a: 9, b: 4, q_read: "くし", a_read: "さんじゅうろく" },
  { a: 9, b: 5, q_read: "くご", a_read: "しじゅうご" },
  { a: 9, b: 6, q_read: "くろく", a_read: "ごじゅうし" },
  { a: 9, b: 7, q_read: "くしち", a_read: "ろくじゅうさん" },
  { a: 9, b: 8, q_read: "くは", a_read: "しちじゅうに", q_speak: "くハ" },
  { a: 9, b: 9, q_read: "くく", a_read: "はちじゅういち" },
];

// ゲーム状態
let currentQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let streak = 0;
let currentInput = "";
let isProcessing = false;
let currentQuestionType = "answer"; // "answer"（通常）or "equation"（逆問題: Q5, Q10）
let equationInputB = "";
let totalQuestions = parseInt(localStorage.getItem('kuku_question_count') || '10');

// くみあわせモード
let isCombinationMode = false;
let selectedDans = new Set();

// 自由選択モード
let isFreeMode = false;
let selectedFreeProblems = new Set(); // "a,b" 形式

// 音声合成
const synth = window.speechSynthesis;
let voice = null;
// パーティクル同時生存数の上限。iPhone Safari のメモリ不足対策。
const PARTICLE_CAP = 200;
// 九九の表モード
let isPlayingTable = false;
let tablePlaybackData = [];
let tablePlaybackIndex = 0;
// --- Audio System ---
let audioCtx = null;
let isMuted = true;
let bgmTimer = null;
let audioInitialized = false;
const BGM_SONGS = [
  {
    name: "ゆったり",
    tempo: 0.4,
    waveType: "sine",
    gain: 0.03,
    melody: [523.25, 587.33, 659.25, 783.99, 659.25, 783.99, 1046.50, 783.99,
             523.25, 659.25, 587.33, 523.25, 392.00, 523.25, 587.33, 659.25]
  },
  {
    name: "わくわく",
    useTone: true,
    toneBuilder: "wakuwaku",
    tempo: 0.2
  },
  {
    name: "たのしい",
    tempo: 0.18,
    waveType: "triangle",
    gain: 0.025,
    melody: [659.25, 783.99, 659.25, 523.25, 659.25, 783.99, 1046.50, 783.99,
             659.25, 523.25, 392.00, 523.25, 659.25, 523.25, 783.99, 659.25,
             1046.50, 783.99, 659.25, 783.99, 523.25, 659.25, 392.00, 523.25]
  },
  {
    name: "キラキラ",
    tempo: 0.22,
    waveType: "sine",
    gain: 0.03,
    melody: [1046.50, 1046.50, 783.99, 783.99, 880.00, 880.00, 783.99, 0,
             698.46, 698.46, 659.25, 659.25, 587.33, 587.33, 523.25, 0,
             783.99, 783.99, 698.46, 698.46, 659.25, 659.25, 587.33, 0,
             783.99, 783.99, 698.46, 698.46, 659.25, 659.25, 587.33, 0,
             1046.50, 1046.50, 783.99, 783.99, 880.00, 880.00, 783.99, 0,
             698.46, 698.46, 659.25, 659.25, 587.33, 587.33, 523.25, 0]
  },
  {
    name: "ノリノリ",
    useTone: true,
    toneBuilder: "norinori",
    tempo: 0.12
  }
];
let currentSongIndex = 0;
let noteIndex = 0;
// --- Tone.js engines ---
let toneEngines = {};
let activeToneId = null;
let toneRunning = false;
