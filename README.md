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

- **HTML5 / CSS3 / Vanilla JavaScript**（1ファイル構成）
- **Web Audio API** — BGM・こうかおんのせいせい
- **Web Speech API** — 九九の日本語よみあげ
- **Google Fonts** — M PLUS Rounded 1c
- ビルドツール・フレームワーク不使用

---

## たいしょうユーザー

- 新2年生（1年生おわり）くらいのこども

---

## ライセンス

[MIT License](LICENSE)
