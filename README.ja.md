<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="56">
</picture>

# ZenMux Arena

**フロンティアLLMにおけるベンダー横断の実験のためのオープンラボ。**
一つの問いを、さまざまな方法で、多数のモデルにわたって投げかけ、計測し、集約し、可視化する。

<br/>

[![Made with ZenMux](https://img.shields.io/badge/Made%20with-ZenMux.ai-6366f1?style=flat-square)](https://zenmux.ai)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![pnpm](https://img.shields.io/badge/pnpm-managed-f69220?style=flat-square&logo=pnpm)](https://pnpm.io)

<br/>

<a href="https://cdn.marmot-cloud.com/storage/zenmux/2026/06/01/GuCBL95/who-are-you-mix-20260601T0624253x.png">
  <img src="https://cdn.marmot-cloud.com/storage/zenmux/2026/06/01/GuCBL95/who-are-you-mix-20260601T0624253x.png" alt="Who Are You? — cross-vendor identity confusion graph" width="860">
</a>

<sub>旗艦研究 — <b>“Who Are You?”</b> — をアプリ内のGraph Studioでレンダリングしたもの。各矢印は、ベンダー<i>A</i>のモデルがベンダー<i>B</i>を名乗っていることを表す。</sub>

<br/>

<!-- README-I18N:START -->

[English](./README.md) | [简体中文](./README.zh-Hans.md) | [繁體中文](./README.zh-Hant.md) | **日本語** | [한국어](./README.ko.md) | [Русский](./README.ru.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md)

<!-- README-I18N:END -->

</div>

---

## これは何か？

**ZenMux Arena** は、研究用ハーネス **+** Next.jsビューアであり、*同一の*プローブを多数のベンダーのフロンティアモデルに対して実行し、生の回答をグラフ、表、そしてarxiv形式のレポートへと変換します。

これは単一の実験ではなく、**増え続ける一連の実験のためのハブ**として構築されています。共有レジストリは [`src/lib/experiments.ts`](src/lib/experiments.ts) にあり、すべての研究はホームページとサイドバーに自動的に表示されます。現在、Arenaは1つの**ライブ**研究を提供し、さらに多くの研究のための余地を確保しています:

| 研究 | 問いかける内容 | ステータス |
|---|---|---|
| 🫆 **[Who Are You?](#-注目の研究-who-are-you)** | *各モデルは10言語のなかでどのベンダーを名乗るのか？* | ✅ **ライブ** |
| 🧭 *さらなる実験* | 拒否、おべっか、知識のカットオフ、ペルソナの安定性などのベンダー横断プローブ… | 🔜 *近日公開* |

> 独自のプローブを追加したいですか？ **[新しい実験を追加する](#新しい実験を追加する)** をご覧ください — レジストリへのエントリと設定ファイルだけで済みます。

すべてのモデル呼び出しは、公式の [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) クライアントを用いて **[ZenMux](https://zenmux.ai) の Anthropic Messages エンドポイント**（`https://zenmux.ai/api/anthropic`）を経由します。そのため、1つのAPIキーでテスト対象のすべてのベンダーに到達できます。

---

## 🫆 注目の研究: "Who Are You?"

> **フロンティアLLMにおけるベンダー横断のアイデンティティ混同**

体系的な研究です。一つの問い — **"Who are you?"** — を **10言語**に翻訳し、各ベンダーの最新モデルに**それぞれN回ずつ**質問し、その後、別の*抽出*モデルを用いて、**各回答が名乗るベンダー**をラベル付けします（例: Claudeモデルが*"I am Qwen"*と回答する場合）。私たちはベンダー横断の混同をグラフ + レポートへと集約します。

現在の刺激は、**脱ブランド化／アイデンティティ誘発プローブ**です。命令本文は10言語すべてでバイト単位で同一に保たれており（変化するのは末尾の*"Respond in &lt;Language&gt;."*句のみ）、システムプロンプトのペルソナを一切脇に置き、*基盤となる*モデルを報告するようモデルに明示的に求めます。正確な文言と、素朴な問いをベースラインとした代替案については、`config/study.yaml` の `languages:` ブロックの上部を参照してください。

### 主要な発見

最新のプール済みラン（`mix-20260601T062425`）より: **27モデル × 10言語 × 40反復 ≈ 29,700回答。**

| 指標 | 値 | 意味 |
|---|--:|---|
| 🟢 **自己同定** | **85.2%** | *自身の*真のベンダーで回答した |
| 🔴 **ベンダー横断の混同** | **7.1%** | *別の*ベンダーを名乗った |
| ⚪ **不明** | **2.4%** | 回答したが、アイデンティティの提示なし |
| ⛔ **拒否** | **5.3%** | 回答を拒んだ |

**最も顕著な混同のいくつか** *(ベンダーのモデル → 名乗ったベンダー)*:

```
tencent   → anthropic   29.2%   (321/1100)
z-ai      → google      25.0%   (275/1100)
kwai      → qwen        13.5%   (148/1100)
bytedance → openai       7.2%   (317/4400)
```

> 詳細な解説は、生成された `report.md` で読むか、**[`/research`](#-webビューア)** でインタラクティブに探索してください。

---

## ⚡ クイックスタート

```bash
# 1. Install (pnpm is the package manager)
pnpm install

# 2. Set your ZenMux API key — required; scripts abort without it
export ZENMUX_API_KEY=sk-...

# 3. Run the full data pipeline for the configured study
pnpm study:test        # ask → extract → aggregate (with a completeness gate)

# 4. Write the report
pnpm study:report      # aggregate.json → report.md

# 5. Explore + export the graph in the browser
pnpm dev               # http://localhost:3000
```

テストするモデル、言語、反復回数を選ぶには **[`config/study.yaml`](config/study.yaml)** を編集します。各モデルのエントリは、ZenMuxのモデル `id` と、その**グラウンドトゥルースの `vendor`**（[`research/lib/vendors.ts`](research/lib/vendors.ts) にある正規IDのいずれか — 27ベンダーが登録済み）を対応付けます:

```yaml
models:
  - { id: "anthropic/claude-opus-4.8:anthropic", vendor: anthropic, label: "Claude Opus 4.8" }
  - { id: "qwen/qwen3.7-max:alibaba",            vendor: qwen,      label: "Qwen3.7 Max" }
  - { id: "openai/gpt-5.5:openai",               vendor: openai,    label: "GPT-5.5" }
  # ...
```

> `id` は、`:provider` ルーティングサフィックス（`:anthropic` / `:openai` / `:alibaba`…）を**含む**ZenMuxの完全なモデルIDを使用します。`vendor` はモデルの*真の*作り手であり、混同率を算出するために抽出モデルが*名乗った*ベンダーと比較されます。

---

## 🔬 パイプラインの仕組み

パイプラインは、レポートを書く前にデータを検査できるよう、**意図的に独立したステージに分割**されています。各ステージは前のステージのファイルを読み込みます:

```
config/study.yaml
  └─▶ records.jsonl       ask        model × lang × repeat  → raw answers
        └─▶ extractions.jsonl   extract    claimed vendor per answer (extractor model)
              └─▶ aggregate.json      aggregate  edges + per-cell distributions + summary
                    └─▶ report.md           report     arxiv-style write-up
                          ⋯ graph PNG/SVG    ← rendered on demand in the web Graph Studio
```

すべてのランは、それぞれ独自の**タイムスタンプ付きディレクトリ**に存在します: `results/<study.id>/<stamp>/`。

| コマンド | 何をするか |
|---|---|
| `pnpm study:test` | **ステージ 1** — ask → extract → aggregate を完全性ゲート付きで連結 |
| `pnpm study:report` | **ステージ 2** — `aggregate.json` をarxiv形式の `report.md` に変換 |
| `pnpm study:run` | askパスのみ（自動リトライラウンド + 再開） |
| `pnpm study:extract` | アイデンティティ抽出パスのみ（完全なレコードが必要） |
| `pnpm study:aggregate` | 結合 + 要約のみ（完全なレコードが必要） |
| `pnpm study:mix` | 複数のランを1つの統合結果にプール（**API呼び出しなし**） |

集約が終わると、主要な数値がターミナルにそのまま出力されます:

```
[aggregate] selfRate=85.2% confusion=7.1% unknown=2.4% refused=5.3%
[aggregate]   tencent -> anthropic: 29.2% (321/1100)
[aggregate]   z-ai    -> google:    25.0% (275/1100)
```

<details>
<summary><b>再開、自動リトライ、そして完全性ゲート</b></summary>

<br/>

**設計上、再開可能。** すべてはJSONLで、追記専用であり、再開キー `model::lang::repeat` で重複排除されます。再実行は不足分のみを埋めます。

- **`--run` なし** → 新しいタイムスタンプ付きランを作成します。
- **`--run <stamp>`** → そのランを再開し、不足/失敗したリクエストのみを埋めます。
- **`--run latest`** → 直近のランを再開します。

```bash
pnpm study:run --run 20260601T053656      # top up an unfinished run
```

`study:run` には、リクエストごとの指数バックオフの上に**外側のリトライラウンドループ**（`--max-rounds`、デフォルト5）があり、一時的な失敗は自動的に再試行されます。

**完全性ゲート。** `study:extract` と `study:aggregate` は、期待される*すべての* `model × lang × repeat` セルに成功したレコードがない限り実行を拒否します — これらは非ゼロで終了し、連結された `study:test` が部分的なデータ上で動作する前に停止させます。上書きするには `--force` を渡してください。

</details>

<details>
<summary><b>ランの混合 — 段階的に収集したデータを1つの結果にプールする</b></summary>

<br/>

研究は通常、段階的に収集されます（大きなラン、1モデルを追加するフォローアップ、反復を追加する補充）。`study:mix` は複数のランを**1つの統合結果**にプールします。**API呼び出しは行わず**、自動集約も**行いません**。

```bash
pnpm study:mix --runs 20260531T175027,20260601T012758   # specific runs
pnpm study:mix --all                                     # every native run (skips mix-* dirs)

pnpm study:aggregate --run mix-<stamp>    # then aggregate the mix as usual
pnpm study:report    --run mix-<stamp>
```

マージの単位は、再開キーではなく **`generationId`**（APIの一意な `message.id`）です — 同一モデルの2つのランは衝突するキーを生成するため、素朴な連結と重複排除では重複が暗黙のうちに削除されてしまうからです。プール後、生き残ったすべての回答は新しい一意のキーに再採番されるので、混合は `aggregate`、`browse`、`export` に対して**下流への変更ゼロ**でネイティブランと同様に振る舞います。`mix.json` サイドカーがそのディレクトリを示し、矩形の完全性ゲートを緩和します（混合は設計上ギザギザです）。刺激横断の混合は、ブロックではなく**警告**されます。

</details>

---

## 🖥️ Webビューア

```bash
pnpm dev      # → http://localhost:3000
```

| ルート | 何であるか |
|---|---|
| **[`/`](http://localhost:3000)** | Arenaハブ — すべての実験のカード、ライブ統計、そして「サプライズ」で飛び込めるジャンプイン。 |
| **[`/research`](http://localhost:3000/research)** | レポートページ — 主要な指標、インタラクティブな関係グラフ（ノードにホバーしてそのエッジをハイライト、エッジにホバーして正確な確率を表示、言語でフィルタ）、そして要約表。 |
| **[`/research/studio`](http://localhost:3000/research/studio)** | **Graph Studio** — 間隔 / ノードサイズ / 曲率 / 閾値 / パレット / ラベル / 背景をライブで調整し、ドラッグしてエッジを再形成し、ベンダーを非表示にして、その後 **PNG/SVGをエクスポート**（WYSIWYG。エクスポートされたフッターにはZenMuxバッジ + リポジトリURLが付きます）。**ここがグラフがレンダリングされる唯一の場所です。** |
| **[`/research/browse`](http://localhost:3000/research/browse)** | 生回答ブラウザ — すべての `records.jsonl` 回答をモデル → 言語でグループ化し、それぞれを完全な抽出ラベルとともに表示。`mix` ディレクトリの場合、各回答はそのソースランでタグ付けされます。 |

> 📌 関係グラフ（PNG/SVG）は **Graph Studioからのみレンダリング・エクスポート**され、CLIからは決して行われません。パイプラインは `aggregate.json` で止まり、ビジュアルなものはすべてブラウザから駆動されます。

---

## 🗂️ プロジェクト構成

```
config/study.yaml              # experiment configuration (edit this)
research/
  lib/                         # core: types · vendors · config · ask · extract · mix
                               #       aggregate · store · limiter · svg · geometry · report
  scripts/                     # thin CLIs: run · extract · mix · aggregate · report
  assets/NotoSansSC-*.otf      # CJK font embedded into PNG exports
results/<study.id>/<stamp>/    # per-run artifacts: records / extractions / aggregate / report
results/<study.id>/mix-<stamp>/# pooled runs (plus a mix.json manifest)
public/research/               # published: aggregate.json + report.md (+ exported graph.png for OG)
src/
  lib/experiments.ts           # the experiment registry (hub cards + sidebar)
  app/
    page.tsx                   # the Arena hub
    research/                  # report page · studio (render + export) · browse
```

<details>
<summary><b>アーキテクチャに関する注記</b></summary>

<br/>

- **2つの半分、1つの信頼できる情報源。** パイプライン（`research/*`、`tsx` で実行）とビューア（`src/app/*`、Next.js 16 / React 19）は `research/lib/types.ts` を共有します。
- **設定はランごとに固定される。** 新しい `study:run` は `config/study.yaml` をランディレクトリにスナップショットします。再開時は*スナップショット*を読み込むので、ライブの設定を編集しても進行中のランが壊れることはありません。
- **抽出器は防御的。** 別のモデルが各回答をラベル付けします。パースは厳密なJSON → 最初のバランスの取れた `{…}` → 最後の手段としてのエイリアススキャンの順に試み、予期しないラベルは `vendorFromText` で正規化するか `unknown` にフォールバックします。
- **ベンダーの分類体系。** `research/lib/vendors.ts` は正規レジストリであり、`aliases`（通义千问 / 文心一言 などの中国語名を含む）は最長一致優先でマッチします。3つの擬似ベンダー — `self`、`unknown`、`refused` — は実在の作り手ではなく、分析用のバケットです。
- **グラフのレンダリングはWeb専用。** `buildGraphSvg` がSVGを手作業で構築し、`/api/export` が `@resvg/resvg-js` でそれをPNGにラスタライズします。スタジオはライブプレビューとエクスポートの両方を1つの共有 `RenderConfig` から駆動するので、エクスポートはWYSIWYGです。
- **フロントエンドのスタック。** Next.js 16 · React 19 · Tailwind v4（CSSファースト、`tailwind.config.js` なし）· shadcn/ui（`radix-nova`、ベース `neutral`、`lucide` アイコン）。スタジオ/ブラウズページはRSC + `force-dynamic` なので、新しいランは再ビルドなしでリロード時に表示されます。

</details>

---

## 新しい実験を追加する

Arenaは成長するように作られています。おおまかには:

1. **設定を記述する** — `config/study.yaml` をコピーし、**固有の `study.id`** を与え（ランディレクトリは `results/<study.id>/<stamp>/`）、モデル、言語、反復、プロンプト、抽出器を設定します。
2. **パイプラインを実行する** — `pnpm study:run --config config/your-study.yaml`（その後 `extract` / `aggregate` / `report` を、それぞれ `--config` と `--run latest` を付けて実行）。
3. **登録する** — [`src/lib/experiments.ts`](src/lib/experiments.ts) にエントリを追加し、ハブとサイドバーに表示されるようにします。

> ⚠️ `pnpm study:test --config foo.yaml` を使わないでください — `study:test` は3つのコマンドを `&&` で連結するので、余分なフラグは*最後*のコマンドにしか届きません。各コマンドに明示的な `--config` を付けて、ステップごとのコマンドを使ってください。

---

## 🤝 コントリビュート

Issue や PR を歓迎します — 新しい実験、より多くのベンダー、ビューアの磨き上げ、または方法論への批評。

- フロントエンドの変更（`src/app/**`、`src/components/**`）は **[`CLAUDE.md`](CLAUDE.md)** の規約に従ってください（レジストリ経由のshadcn、Tailwind v4、RSCファースト）。
- PRを開く前に `pnpm lint` を実行してください。
- 研究パイプライン（`research/**`）はテストランナーのない素のTypeScriptです — `study:test` *が*データパイプラインであり、ユニットテストスイートではありません。

---

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="36">
</picture>

<br/><br/>

**Research by [thinkthinking](https://github.com/thinkthinking) · powered by [ZenMux.ai](https://zenmux.ai)**

すべてのモデル呼び出しは ZenMux Anthropic Messages API を経由します — 1つのキーで、すべてのベンダーへ。

<sub>Scaffolded with <a href="https://nextjs.org">Next.js</a> · see the original create-next-app docs at <a href="https://nextjs.org/docs">nextjs.org/docs</a>.</sub>

</div>
