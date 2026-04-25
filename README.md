# 九九学習アプリ 🔢

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-公開中-brightgreen)](https://sahokun.github.io/kuku/)

> **▶ アプリを開く → https://sahokun.github.io/kuku/**

子ども向けの九九（かけ算）学習 Web アプリです。  
ブラウザだけで動くクイズ形式で、楽しく九九を覚えられます。

---

## きのう（機能）

| きのう | せつめい |
|--------|----------|
| 🎯 段ごとれんしゅう | 1の段〜9の段からえらんでれんしゅう |
| 🎲 じゆうせんたく | すきな段をくみあわせてれんしゅう |
| 📝 もんだいすせってい | まい回のもんだいすをかえられる |
| 🔊 こえよみあげ | 九九を日本語でよみあげてくれる |
| 🎵 BGM・こうかおん | たのしいおとつきでもりあがる |
| 🏆 けっかひょうじ | せいかいすう・じかんをまとめて見られる |

---

## つかいかた

**ブラウザでそのまま使えます。インストール不要！**

1. 上の GitHub Pages リンクを開く
2. れんしゅうしたい段をえらぶ
3. こたえをタップ！

### ローカルで動かす

```bash
# リポジトリをクローン
git clone https://github.com/sahokun/kuku.git

# index.html をブラウザで開くだけ
open kuku/index.html   # macOS
# または xdg-open kuku/index.html (Linux)
# または kuku\index.html をダブルクリック (Windows)
```

---

## ぎじゅつ（技術スタック）

- **HTML5 / CSS3 / Vanilla JavaScript**
- **Web Audio API** — BGM・こうかおんのせいせい
- **Web Speech API** — 九九の日本語よみあげ
- **Google Fonts** — M PLUS Rounded 1c
- ビルドツール・フレームワーク不使用

---

## ファイル構成

```
kuku/
├── index.html          # HTML シェル（構造のみ）
├── css/
│   ├── base.css        # CSS 変数・リセット・共通アニメーション
│   ├── layout.css      # 共通レイアウト・ボタン基本スタイル
│   ├── title.css       # タイトル画面
│   ├── game.css        # ゲーム画面・数字パッド
│   ├── feedback.css    # フィードバック・リザルト画面・ミュートボタン
│   ├── table.css       # 九九の表画面
│   └── result.css      # メディアクエリ（レスポンシブ・アクセシビリティ）
└── js/
    ├── state.js        # グローバル定数・状態変数（kukuData, BGM_SONGS 等）
    ├── speech.js       # Web Speech API ラッパー（initVoice / speak）
    ├── game.js         # 画面切り替え・ゲーム進行・回答判定
    ├── feedback.js     # フィードバック表示・パーティクル・endGame
    ├── title.js        # タイトル画面ロジック
    ├── free-select.js  # 自由選択モード
    ├── table.js        # 九九の表モード・読み上げ再生
    ├── audio.js        # Web Audio API（BGM ビート生成・selectSong）
    ├── tone-engines.js # Tone.js エンジン（ノリノリ・わくわく）
    ├── se.js           # 効果音（playSe）
    └── init.js         # 起動時初期化 IIFE
```

---

## たいしょうユーザー

- 新2年生（1年生おわり）くらいのこども

---

## ライセンス

[MIT License](LICENSE)
