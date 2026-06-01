# 「你是谁？」研究报告 — LaTeX 工程

A reproducible, arXiv-style Chinese research report for the study **"Who Are You? —
Cross-Vendor Identity Confusion in Frontier LLMs."** Every number, figure, and table is
derived from a single source of truth — the pooled mix aggregate at
`results/who-are-you/mix-20260601T062425/aggregate.json` (29,700 answers).

## 一键构建 / Build

```bash
bash paper/build.sh        # regenerate figures+tables, then compile main.pdf (XeLaTeX ×2)
```

The script prepends `/Library/TeX/texbin` to `PATH` (where BasicTeX installs `xelatex`),
regenerates all artifacts, and compiles twice to resolve cross-references. Output: `paper/main.pdf`.

### 手动分步 / Manual steps

```bash
npx tsx paper/scripts/build_all.ts          # 1. stats.json -> figures (PNG/SVG) + LaTeX tables
cd paper && xelatex main.tex && xelatex main.tex   # 2. compile twice
```

## 工程结构 / Layout

```
paper/
├── main.tex            # the report (front matter → methods → overall → per-vendor → discussion)
├── preamble.tex        # ctexart + fandol setup, the `finding` callout box, colors, headers
├── build.sh            # one-shot: regenerate data artifacts + compile
├── figures/            # GENERATED — do not hand-edit
│   ├── stats.json      #   single source of truth (variant/lang/vendor/model breakdowns)
│   ├── fig_vendor_bars.{png,svg}        # per-vendor outcome composition
│   ├── fig_variant_gradient.{png,svg}   # the 3-variant gradient (central result)
│   ├── fig_lang_heatmap.{png,svg}       # language × vendor confusion heatmap
│   ├── fig_model_scatter.{png,svg}      # per-model self-rate (all 27)
│   └── fig_graph.{png,svg}              # the directional confusion graph (studio-identical)
├── tables/             # GENERATED — booktabs fragments + headline macros
│   ├── macros.tex      #   \statTotal, \statCross, … (headline numbers as macros)
│   └── tab_*.tex       #   vendor / variant / lang / model / edges tables
└── scripts/            # tsx figure + table generators (reuse research/lib/*)
    ├── figlib.ts       #   shared helpers (vendorColor, logoDataUri, resvg, label recovery)
    ├── stats.ts        #   the one-pass join → stats.json
    ├── fig_*.ts        #   one script per figure
    ├── gen_tables.ts   #   stats.json → LaTeX tables + macros
    └── build_all.ts    #   runs all of the above in order
```

## 设计要点 / Design notes

- **单一真相源。** `stats.ts` joins records↔extractions ONCE and writes `stats.json`;
  every figure and every table reads from it, so a chart and a table can never disagree.
- **复用生产渲染。** The figure scripts import `research/lib/{geometry,svg,vendors}.ts` — the
  exact `vendorColor`, `logoDataUri`, and the studio's `buildGraphSvg()`. The flagship graph
  (`fig_graph`) is byte-for-byte the web export, with `isOffByDefault` hiding the one-off
  hallucinated `other:*` brands just like the studio's vendor picker.
- **可复现字体。** Compiled with `\documentclass[fontset=fandol]{ctexart}`; Fandol ships with
  TeX Live, so the build does not depend on any system-installed CJK font.
- **标签恢复。** The mix's merged `study.yaml` drops friendly model labels, so `figlib.ts`
  re-reads them from the live `config/study.yaml` (falling back to the aggregate otherwise).

## 工具链 / Toolchain

- **XeLaTeX** (TeX Live 2026 / BasicTeX). Packages: `ctex`, `xeCJK`, `booktabs`, `caption`,
  `subcaption`, `float`, `geometry`, `titlesec`, `enumitem`, `microtype`, `xcolor`, `hyperref`,
  `fancyhdr`, `pdflscape`, `footmisc`, `fandol` fonts. The `finding` box needs only `xcolor`
  (no `tcolorbox`/`mdframed`, which BasicTeX lacks).
- **Node + tsx** for figure/table generation (`@resvg/resvg-js` rasterizes SVG→PNG with the
  bundled `research/assets/NotoSansSC-Regular.otf`).
- `latexmk` is NOT required (BasicTeX omits it); `build.sh` calls `xelatex` directly.
