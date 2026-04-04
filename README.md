# CSS-Shape-Outside

Nothing 系のタイポグラフィとドットグリッド上に、**ビューポート右端で回転するワイヤーフレーム六角形**と、それに**本文が寄っていく**挙動を載せたシングルページのデモです。

## 特徴

- **六角形（SVG）** — 外周は実線、内部は点線ガイド。反時計回りに回転。
- **サイズ** — SVG の上下頂点間（長い対角線）がビューポートの高さ `100svh` と一致するよう CSS 変数でスケール。幾何中心は **`50vh` の縦中央**（`top: calc(50vh - height/2)`）。
- **本文との関係** — `section.content` 内の各 `<p>` に対し、回転中の六角形の**外周の左側**と重ならないよう、`padding-right` を JavaScript で毎フレーム更新（`requestAnimationFrame`）。水平辺で右側の辺を誤って左端とみなさないよう、凸六角形の左交点のみを使っています。
- **テーマ** — ヘッダーのトグルでダーク / ライトを切り替え（`localStorage` に保存）。
- **レスポンシブ** — 768px / 1200px 付近でレイアウト・余白を調整。

## 技術スタック

| 領域 | 内容 |
|------|------|
| マークアップ・スタイル | 単一の `index.html`（埋め込み CSS）。ビルド不要。 |
| アニメーション | CSS `@keyframes`（六角形の `transform: rotate`）。 |
| スクリプト | テーマ切り替え + 六角形と段落の当たり判定のみ。 |

> 以前は `shape-outside` による回り込みも試していますが、**スクロール位置と回転の両方で全段落の挙動を揃える**には、段落単位の `padding-right` の方が安定しています。

## ローカルで開く

```bash
# 例: カレントディレクトリを静的配信
npx --yes serve .
```

ブラウザで `index.html` を直接開いても動作します（`file://`）。テーマの `localStorage` は同一オリジンで有効です。

## ブラウザ

モダンな **Chrome / Edge / Safari** を想定しています。`100svh` や `prefers-reduced-motion` を利用しています。

## GitHub Pages で公開する

このリポジトリには [`.github/workflows/pages.yml`](.github/workflows/pages.yml) があり、`main` へのプッシュで静的サイトを GitHub Pages にデプロイします。

1. GitHub でリポジトリを開く → **Settings** → **Pages**
2. **Build and deployment** の **Source** を **GitHub Actions** にする（初回のみ）
3. `main` にマージまたはプッシュするとワークフローが走り、完了後に URL が表示される

公開 URL の例（ユーザー名・リポジトリ名は置き換え）:

`https://<ユーザー名>.github.io/CSS-Shape-Outside/`

ルートの `.nojekyll` は Jekyll を無効にし、`index.html` をそのまま配信するためのものです。
