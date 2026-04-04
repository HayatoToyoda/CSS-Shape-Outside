# CSS-Shape-Outside

Nothing 系のタイポグラフィとドットグリッド上に、**ビューポート右端で回転するワイヤーフレーム六角形**と、それに**本文が寄っていく**挙動を載せたシングルページのデモです。ビルドツールは不要で、`index.html` だけで動きます。

[![Deploy GitHub Pages](https://github.com/HayatoToyoda/CSS-Shape-Outside/actions/workflows/pages.yml/badge.svg)](https://github.com/HayatoToyoda/CSS-Shape-Outside/actions/workflows/pages.yml)

## ライブデモ

GitHub Pages（`main` プッシュで自動デプロイ）:

**https://hayatoyoda.github.io/CSS-Shape-Outside/**

## 特徴

| 項目 | 内容 |
|------|------|
| **六角形** | SVG。外周は実線、内部は点線ガイド。反時計回りに回転（8 秒周期）。 |
| **サイズ・位置** | 上下頂点間（長い対角線）が `100svh` と一致するようスケール。幾何中心は **`50vh` の縦中央**（`position: fixed` + `top: calc(50vh - height/2)`）。右端では中心がビューポート右辺に乗るように配置。 |
| **本文** | `section.content` 内の各 `<p>` に対し、回転中の六角形の**外周の左側**と重ならないよう `padding-right` を毎フレーム計算。水平辺では右側の辺を誤検出しないよう、凸六角形の左交点のみを使用。 |
| **テーマ** | ヘッダーでダーク / ライト切替。`localStorage` に保存。 |
| **アクセシビリティ** | `prefers-reduced-motion: reduce` のときはテーマ以外の動きを抑制。 |
| **レイアウト** | 768px / 1200px 付近で余白・タイポを調整。 |

## 技術スタック

| 領域 | 内容 |
|------|------|
| マークアップ・スタイル | 単一の [`index.html`](index.html)（埋め込み CSS）。 |
| アニメーション | CSS `@keyframes`（六角形の `transform: rotate`）。 |
| スクリプト | テーマ切り替え + 六角形と段落の当たり判定（`requestAnimationFrame`）。 |

`shape-outside` だけではフロートの高さ内の段落にしか効かないため、**スクロールと回転の両方で全段落を揃える**目的では、段落単位の `padding-right` を採用しています。

## ローカルで開く

```bash
npx --yes serve .
```

ブラウザで `index.html` を直接開いても動作します。`localStorage` は同一オリジン（例: `http://127.0.0.1:...`）で有効です。

## ブラウザ

**Chrome / Edge / Safari** の最新版を想定。`100svh` や `prefers-reduced-motion` を利用しています。

## GitHub Pages

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) が `main` へのプッシュで `_site` に `index.html` と `.nojekyll` を載せてデプロイします。

1. リポジトリの **Settings → Pages**
2. **Source** を **GitHub Actions** に設定（初回のみ）
3. **Actions** でワークフローが成功したら、上記ライブデモ URL で公開

`.nojekyll` は Jekyll を無効にし、静的ファイルをそのまま配信するためのものです。

## リポジトリ

- **GitHub:** [HayatoToyoda/CSS-Shape-Outside](https://github.com/HayatoToyoda/CSS-Shape-Outside)
