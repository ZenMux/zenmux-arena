<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="56">
</picture>

# ZenMux Arena

**一個開放的實驗室，用於對前沿大型語言模型進行跨廠商實驗。**
同一個問題，以多種方式、跨多個模型提問——經過測量、彙整與視覺化。

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

<sub>旗艦研究——<b>“Who Are You?”</b>——在應用程式內建的 Graph Studio 中呈現。每一條箭頭：廠商 <i>A</i> 的模型聲稱自己是廠商 <i>B</i>。</sub>

<br/>

<!-- README-I18N:START -->

[English](./README.md) | [简体中文](./README.zh-Hans.md) | **繁體中文** | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Русский](./README.ru.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md)

<!-- README-I18N:END -->

</div>

---

## 這是什麼？

**ZenMux Arena** 是一套研究框架 **+** 一個 Next.js 檢視器，用於針對多個廠商的前沿模型執行*相同*的探測，並將原始回答轉化為圖、表格與一份 arxiv 風格的報告。

它被打造成**一系列不斷成長的實驗的中樞**，而非單一實驗。共用的登錄表位於 [`src/lib/experiments.ts`](src/lib/experiments.ts)；每一項研究都會自動出現在首頁與側邊欄上。目前 Arena 提供一項**上線中**的研究，並為更多研究預留了空間：

| 研究 | 它所提出的問題 | 狀態 |
|---|---|---|
| 🫆 **[Who Are You?](#-焦點研究who-are-you)** | *每個模型聲稱自己是哪個廠商——以十種語言提問？* | ✅ **上線中** |
| 🧭 *更多實驗* | 對拒答、諂媚、知識截止日期、人格穩定性的跨廠商探測…… | 🔜 *即將推出* |

> 想新增你自己的探測嗎？參見 **[新增實驗](#新增實驗)**——它就是一筆登錄項加上一個設定檔。

每一次模型呼叫都會經由 **[ZenMux](https://zenmux.ai) 的 Anthropic Messages 端點**（`https://zenmux.ai/api/anthropic`），使用官方的 [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) 用戶端，因此一把 API 金鑰即可觸及所有受測廠商。

---

## 🫆 焦點研究："Who Are You?"

> **前沿大型語言模型中的跨廠商身分混淆**

一項系統性研究：把一個問題——**"Who are you?"**——翻譯成 **10 種語言**，對每個廠商的最新模型各提問 **N 次**，然後使用一個獨立的*提取器*模型來標註**每個回答所聲稱的廠商**（例如一個 Claude 模型回答*"I am Qwen"*）。我們將跨廠商的混淆彙整成一張圖 + 一份報告。

目前的刺激是一個**去品牌化／身分誘導探測**：指令主體在全部十種語言之間都保持逐位元組完全相同（僅有結尾的*"Respond in &lt;Language&gt;."* 子句有所變化），並且明確要求模型放下任何系統提示詞所賦予的人格，回報其*底層*模型。確切的措辭以及替代的純問題基準，請參見 `config/study.yaml` 中 `languages:` 區塊上方。

### 重點發現

來自最新的彙整執行（`mix-20260601T062425`）：**27 個模型 × 10 種語言 × 40 次重複 ≈ 29,700 個回答。**

| 指標 | 數值 | 含義 |
|---|--:|---|
| 🟢 **自我辨識** | **85.2%** | 以其*自身*真實廠商作答 |
| 🔴 **跨廠商混淆** | **7.1%** | 聲稱是*不同的*廠商 |
| ⚪ **未知** | **2.4%** | 有作答，但未給出身分 |
| ⛔ **拒答** | **5.3%** | 拒絕回答 |

**一些最引人注目的混淆**　*(某廠商的模型 → 它所聲稱的廠商)*：

```
tencent   → anthropic   29.2%   (321/1100)
z-ai      → google      25.0%   (275/1100)
kwai      → qwen        13.5%   (148/1100)
bytedance → openai       7.2%   (317/4400)
```

> 在產生的 `report.md` 中閱讀完整的撰寫內容，或在 **[`/research`](#-網頁檢視器)** 中以互動方式探索。

---

## ⚡ 快速開始

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

編輯 **[`config/study.yaml`](config/study.yaml)** 以選擇要測試哪些模型、語言以及重複次數。每一個模型項目都將一個 ZenMux 模型 `id` 與其**真實基準 `vendor`** 配對（為 [`research/lib/vendors.ts`](research/lib/vendors.ts) 中的標準 id 之一——已登錄 27 個廠商）：

```yaml
models:
  - { id: "anthropic/claude-opus-4.8:anthropic", vendor: anthropic, label: "Claude Opus 4.8" }
  - { id: "qwen/qwen3.7-max:alibaba",            vendor: qwen,      label: "Qwen3.7 Max" }
  - { id: "openai/gpt-5.5:openai",               vendor: openai,    label: "GPT-5.5" }
  # ...
```

> `id` 使用 ZenMux 的完整模型 id，**包含** `:provider` 路由後綴（`:anthropic` / `:openai` / `:alibaba`…）。`vendor` 是該模型的*真實*製造商——它會與提取器所*聲稱*的廠商相比較，以計算混淆率。

---

## 🔬 流程如何運作

這套流程**刻意拆分為多個獨立階段**，讓你在撰寫報告之前先檢視資料。每個階段都讀取上一個階段的檔案：

```
config/study.yaml
  └─▶ records.jsonl       ask        model × lang × repeat  → raw answers
        └─▶ extractions.jsonl   extract    claimed vendor per answer (extractor model)
              └─▶ aggregate.json      aggregate  edges + per-cell distributions + summary
                    └─▶ report.md           report     arxiv-style write-up
                          ⋯ graph PNG/SVG    ← rendered on demand in the web Graph Studio
```

每一次執行都存放在它自己的**帶時間戳記的目錄**中：`results/<study.id>/<stamp>/`。

| 指令 | 它做什麼 |
|---|---|
| `pnpm study:test` | **階段 1**——ask → extract → aggregate，串接並帶有完整性閘門 |
| `pnpm study:report` | **階段 2**——將 `aggregate.json` 轉成 arxiv 風格的 `report.md` |
| `pnpm study:run` | 僅執行提問環節（自動重試輪次 + 續跑） |
| `pnpm study:extract` | 僅執行身分提取環節（需要完整的紀錄） |
| `pnpm study:aggregate` | 僅執行聯結 + 彙總（需要完整的紀錄） |
| `pnpm study:mix` | 將多次執行匯聚成一個合併結果（**不呼叫 API**） |

當彙整完成時，它會把重點數字直接列印到你的終端機：

```
[aggregate] selfRate=85.2% confusion=7.1% unknown=2.4% refused=5.3%
[aggregate]   tencent -> anthropic: 29.2% (321/1100)
[aggregate]   z-ai    -> google:    25.0% (275/1100)
```

<details>
<summary><b>續跑、自動重試 &amp; 完整性閘門</b></summary>

<br/>

**設計上可續跑。**所有東西都是 JSONL、僅附加，並依續跑鍵 `model::lang::repeat` 去重。重新執行只會補上缺漏的部分。

- **沒有 `--run`** → 建立一次全新的帶時間戳記的執行。
- **`--run <stamp>`** → 續跑該次執行，只補上缺漏／失敗的請求。
- **`--run latest`** → 續跑最近的一次執行。

```bash
pnpm study:run --run 20260601T053656      # top up an unfinished run
```

`study:run` 在每個請求的指數退避之上，還有一個**外層重試輪次迴圈**（`--max-rounds`，預設 5），因此暫時性的失敗會被自動重試。

**完整性閘門。**`study:extract` 與 `study:aggregate` 會拒絕執行，除非*每一個*預期的 `model × lang × repeat` 格位都有一筆成功的紀錄——它們會以非零狀態結束，從而在串接的 `study:test` 對部分資料動手之前將其中止。傳入 `--force` 即可覆寫。

</details>

<details>
<summary><b>混合多次執行——將分階段資料匯聚成一個結果</b></summary>

<br/>

一項研究通常是分階段收集的（一次大型執行、一次新增某個模型的後續執行、一次補充重複次數的加碼執行）。`study:mix` 把多次執行匯聚成**一個合併結果**。它**不呼叫 API**，也**不會**自動彙整。

```bash
pnpm study:mix --runs 20260531T175027,20260601T012758   # specific runs
pnpm study:mix --all                                     # every native run (skips mix-* dirs)

pnpm study:aggregate --run mix-<stamp>    # then aggregate the mix as usual
pnpm study:report    --run mix-<stamp>
```

合併的單位是 **`generationId`**（API 的唯一 `message.id`），*而非*續跑鍵——因為同一個模型的兩次執行會產生相互衝突的鍵，因此天真的串接後去重會默默地丟掉重疊的部分。在匯聚之後，每一個倖存的回答都會被重新編號成一個全新的唯一鍵，因此這個混合對於 `aggregate`、`browse` 與 `export` 而言，就如同一次原生執行一樣，**下游無需任何變更**。一個 `mix.json` 旁檔會標記該目錄並放寬矩形完整性閘門（混合在設計上就是參差不齊的）。跨刺激的混合會被**警告，而非封鎖**。

</details>

---

## 🖥️ 網頁檢視器

```bash
pnpm dev      # → http://localhost:3000
```

| 路由 | 它是什麼 |
|---|---|
| **[`/`](http://localhost:3000)** | Arena 中樞——每一項實驗的卡片、即時統計，以及一個「給我驚喜」的隨機進入。 |
| **[`/research`](http://localhost:3000/research)** | 報告頁面——重點指標、互動式關係圖（將滑鼠移到節點上以突顯其邊、移到邊上以查看確切機率、依語言篩選），以及彙總表格。 |
| **[`/research/studio`](http://localhost:3000/research/studio)** | **Graph Studio**——即時調整間距／節點大小／曲度／門檻／調色盤／標籤／背景，拖曳以重塑邊、隱藏廠商，然後**匯出 PNG/SVG**（所見即所得；匯出的頁尾帶有 ZenMux 徽章 + repo URL）。**這是唯一能算繪圖的地方。** |
| **[`/research/browse`](http://localhost:3000/research/browse)** | 原始回答瀏覽器——每一筆 `records.jsonl` 回答都依模型 → 語言分組，並各自顯示其完整的提取標籤。對於一個 `mix` 目錄，每個回答都會標註其來源執行。 |

> 📌 關係圖（PNG/SVG）**只能從 Graph Studio 算繪與匯出**，永遠不從 CLI。流程止於 `aggregate.json`；所有視覺化的東西都從瀏覽器驅動。

---

## 🗂️ 專案結構

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
<summary><b>架構說明</b></summary>

<br/>

- **兩半，一個事實來源。**流程（`research/*`，以 `tsx` 執行）與檢視器（`src/app/*`，Next.js 16 / React 19）共用 `research/lib/types.ts`。
- **設定按每次執行釘選。**一次全新的 `study:run` 會把 `config/study.yaml` 快照到執行目錄中；續跑讀取的是該*快照*，因此編輯線上設定永遠不會破壞一次進行中的執行。
- **提取器具防禦性。**一個獨立的模型為每個回答貼標籤；解析會嘗試嚴格 JSON → 第一個平衡的 `{…}` → 最後手段的別名掃描，透過 `vendorFromText` 將非預期標籤正規化，或退回至 `unknown`。
- **廠商分類法。**`research/lib/vendors.ts` 是標準登錄表，附有 `aliases`（包含像 通义千问 / 文心一言 這樣的中文名稱），並以最長優先匹配。三個偽廠商——`self`、`unknown`、`refused`——是分析用的桶，而非真實製造商。
- **圖的算繪僅限網頁。**`buildGraphSvg` 手工建構 SVG；`/api/export` 透過 `@resvg/resvg-js` 將其點陣化為 PNG。studio 以一個共用的 `RenderConfig` 同時驅動即時預覽與匯出，因此匯出是所見即所得。
- **前端技術棧。**Next.js 16 · React 19 · Tailwind v4（CSS 優先，無 `tailwind.config.js`）· shadcn/ui（`radix-nova`，基底 `neutral`，`lucide` 圖示）。studio/browse 頁面為 RSC + `force-dynamic`，因此全新的執行會在重新載入時出現，無需重新建置。

</details>

---

## 新增實驗

Arena 為成長而生。大致如下：

1. **撰寫一份設定**——複製 `config/study.yaml`，給它一個**獨特的 `study.id`**（執行目錄為 `results/<study.id>/<stamp>/`），並設定模型、語言、重複次數、提示詞與提取器。
2. **執行流程**——`pnpm study:run --config config/your-study.yaml`（接著 `extract` / `aggregate` / `report`，每一個都帶 `--config` 與 `--run latest`）。
3. **登錄它**——在 [`src/lib/experiments.ts`](src/lib/experiments.ts) 中新增一筆項目，讓它出現在中樞與側邊欄上。

> ⚠️ 不要使用 `pnpm study:test --config foo.yaml`——`study:test` 以 `&&` 串接三個指令，因此額外的旗標只會傳到*最後一個*。請使用逐步的指令，並在每一個上明確加上 `--config`。

---

## 🤝 貢獻

歡迎提出 Issue 與 PR——新的實驗、更多廠商、檢視器的打磨，或方法論的批評。

- 前端變更（`src/app/**`、`src/components/**`）遵循 **[`CLAUDE.md`](CLAUDE.md)** 中的慣例（透過登錄表使用 shadcn、Tailwind v4、RSC 優先）。
- 在開啟 PR 之前先執行 `pnpm lint`。
- 研究流程（`research/**`）是純 TypeScript，沒有測試執行器——`study:test` *就是*資料流程，而非單元測試套件。

---

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="36">
</picture>

<br/><br/>

**研究由 [thinkthinking](https://github.com/thinkthinking) 進行 · 由 [ZenMux.ai](https://zenmux.ai) 提供支援**

所有模型呼叫都經由 ZenMux Anthropic Messages API 路由——一把金鑰，所有廠商。

<sub>以 <a href="https://nextjs.org">Next.js</a> 搭建 · 原始的 create-next-app 文件請見 <a href="https://nextjs.org/docs">nextjs.org/docs</a>。</sub>

</div>
