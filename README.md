# CSS-Shape-Outside

Nothing 系のタイポグラフィとドットグリッド上に、**ビューポート右端で回転・ドリフトするワイヤーフレーム六角形**と、それを避けながら**本文が行単位で流動的に組み替わる**挙動を載せたシングルページのデモです。本文は `@chenglou/pretext` を使って Canvas に描画しています。

[![Deploy GitHub Pages](https://github.com/HayatoToyoda/CSS-Shape-Outside/actions/workflows/pages.yml/badge.svg)](https://github.com/HayatoToyoda/CSS-Shape-Outside/actions/workflows/pages.yml)

## ライブデモ

GitHub Pages（`main` プッシュで自動デプロイ）:

**https://HayatoToyoda.github.io/CSS-Shape-Outside/**

> **Note:** `*.github.io` のホスト名は GitHub 側のバーチャルホスト設定の都合で、**GitHub ユーザー名の大文字・小文字と一致した URL だけ**が 200 を返すことがあります。README や共有リンクは `HayatoToyoda` の表記を維持してください（`hayatoyoda.github.io` だと 404 になります）。

## 特徴

| 項目 | 内容 |
|------|------|
| **六角形** | SVG。外周は実線、内部は点線ガイド。反時計回りに回転しつつ、スクロールに連動して微小ドリフトします。 |
| **サイズ・位置** | 上下頂点間（長い対角線）が `100svh` と一致するようスケール。幾何中心は **`50vh` の縦中央**（`position: fixed` + `top: calc(50vh - height/2)`）。右端では中心がビューポート右辺に乗るように配置。 |
| **本文** | ソース段落を `@chenglou/pretext` で事前解析し、各行ごとに六角形の輪郭を避ける可用幅を計算して Canvas に再描画します。 |
| **テーマ** | ヘッダーでダーク / ライト切替。`localStorage` に保存。 |
| **アクセシビリティ** | `prefers-reduced-motion: reduce` のときは六角形の回転・ドリフトと本文の連続再配置を停止します。 |
| **レイアウト** | 768px / 1200px 付近で余白・タイポを調整。 |

## 技術スタック

| 領域 | 内容 |
|------|------|
| マークアップ・スタイル | [`index.html`](index.html)（埋め込み CSS）。 |
| レイアウトエンジン | [`@chenglou/pretext`](https://github.com/chenglou/pretext) |
| アプリスクリプト | [`main.js`](main.js)（テーマ切り替え + Pretext 組版 + Canvas 描画 + 六角形モーション） |
| ビルド | Vite |

`shape-outside` や段落単位の `padding-right` ではなく、**行ごとに可用幅を変更しながら本文を再ルーティングする**方針に切り替えています。これにより、六角形の自転とスクロールによるドリフトに合わせて、本文が誌面的に押し出される表現を狙っています。

## ローカルで開く

```bash
npm install
npm run dev
```

本番ビルドは以下です。

```bash
npm run build
```

`localStorage` にテーマ設定を保存します。

## ブラウザ

**Chrome / Edge / Safari** の最新版を想定。`100svh` や `prefers-reduced-motion` を利用しています。

## GitHub Pages

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) が `main` へのプッシュで依存関係をインストールし、Vite で生成した `dist/` を GitHub Pages にデプロイします。

1. リポジトリの **Settings → Pages**
2. **Source** を **GitHub Actions** に設定（初回のみ）
3. **Actions** でワークフローが成功したら、上記ライブデモ URL で公開

`.nojekyll` は Pages 上で生成物をそのまま配信するために配置しています。

## リポジトリ

- **GitHub:** [HayatoToyoda/CSS-Shape-Outside](https://github.com/HayatoToyoda/CSS-Shape-Outside)
