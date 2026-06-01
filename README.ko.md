<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="56">
</picture>

# ZenMux Arena

**프런티어 LLM을 대상으로 한 벤더 간 교차 실험을 위한 오픈 랩.**
하나의 질문을, 여러 방식으로, 여러 모델에 던진 뒤 — 측정하고, 집계하고, 시각화합니다.

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

<sub>대표 연구 — <b>“Who Are You?”</b> — 가 앱 내 Graph Studio로 렌더링된 모습. 각 화살표: 벤더 <i>A</i>의 모델이 벤더 <i>B</i>라고 주장하는 것.</sub>

<br/>

<!-- README-I18N:START -->

[English](./README.md) | [简体中文](./README.zh-Hans.md) | [繁體中文](./README.zh-Hant.md) | [日本語](./README.ja.md) | **한국어** | [Русский](./README.ru.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md)

<!-- README-I18N:END -->

</div>

---

## 이게 무엇인가요?

**ZenMux Arena** 는 여러 벤더의 프런티어 모델에 *동일한* 프로브를 던지고 원시 답변을 그래프, 표, arxiv 스타일 리포트로 바꿔주는 연구 하니스 **+** Next.js 뷰어입니다.

이것은 단일 실험이 아니라 **점점 늘어나는 일련의 실험을 위한 허브**로 설계되었습니다. 공유 레지스트리는 [`src/lib/experiments.ts`](src/lib/experiments.ts) 에 있으며, 모든 연구는 홈페이지와 사이드바에 자동으로 표시됩니다. 현재 Arena는 하나의 **라이브** 연구를 제공하며, 더 많은 연구를 위한 공간을 남겨두고 있습니다:

| 연구 | 던지는 질문 | 상태 |
|---|---|---|
| 🫆 **[Who Are You?](#-주요-연구-who-are-you)** | *각 모델은 어느 벤더라고 주장하는가 — 열 개 언어로?* | ✅ **라이브** |
| 🧭 *추가 실험* | 거부, 아첨, 지식 컷오프, 페르소나 안정성에 대한 벤더 간 프로브… | 🔜 *곧 출시* |

> 자신만의 프로브를 추가하고 싶으신가요? **[새 실험 추가하기](#새-실험-추가하기)** 를 참고하세요 — 레지스트리 항목 하나와 설정 파일 하나면 됩니다.

모든 모델 호출은 공식 [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) 클라이언트를 사용해 **[ZenMux](https://zenmux.ai) 의 Anthropic Messages 엔드포인트** (`https://zenmux.ai/api/anthropic`) 를 통과하므로, 하나의 API 키로 테스트 대상 모든 벤더에 도달합니다.

---

## 🫆 주요 연구: "Who Are You?"

> **프런티어 LLM에서의 벤더 간 정체성 혼동**

체계적인 연구: 하나의 질문 — **"Who are you?"** — 을 **10개 언어**로 번역하고, 각 벤더의 최신 모델에게 **각각 N회** 질문한 뒤, 별도의 *추출기* 모델로 **각 답변이 주장하는 벤더**를 라벨링합니다 (예: Claude 모델이 *"나는 Qwen입니다"* 라고 답하는 경우). 우리는 벤더 간 혼동을 그래프 + 리포트로 집계합니다.

현재 자극은 **디브랜딩 / 정체성 도출 프로브**입니다: 명령 본문은 열 개 언어 전체에서 바이트 단위로 동일하게 유지되며 (뒤따르는 *"Respond in &lt;Language&gt;."* 절만 달라짐), 모델이 어떤 시스템 프롬프트 페르소나든 제쳐두고 *기저* 모델을 보고하도록 명시적으로 요청합니다. 정확한 문구와 대안인 맨질문 베이스라인은 `config/study.yaml` 의 `languages:` 블록 위에서 확인하세요.

### 핵심 발견

최신 풀링 실행(`mix-20260601T062425`) 기준: **27개 모델 × 10개 언어 × 40회 반복 ≈ 29,700개 답변.**

| 지표 | 값 | 의미 |
|---|--:|---|
| 🟢 **자기 식별** | **85.2%** | *자신의* 진짜 벤더로 답함 |
| 🔴 **벤더 간 혼동** | **7.1%** | *다른* 벤더라고 주장함 |
| ⚪ **알 수 없음** | **2.4%** | 답했으나 정체성을 밝히지 않음 |
| ⛔ **거부** | **5.3%** | 답변을 거부함 |

**가장 눈에 띄는 혼동 몇 가지** *(벤더의 모델 → 주장한 벤더)*:

```
tencent   → anthropic   29.2%   (321/1100)
z-ai      → google      25.0%   (275/1100)
kwai      → qwen        13.5%   (148/1100)
bytedance → openai       7.2%   (317/4400)
```

> 전체 분석은 생성된 `report.md` 에서 읽거나, **[`/research`](#-웹-뷰어)** 에서 인터랙티브하게 탐색하세요.

---

## ⚡ 빠른 시작

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

테스트할 모델, 언어, 반복 횟수를 고르려면 **[`config/study.yaml`](config/study.yaml)** 을 편집하세요. 각 모델 항목은 ZenMux 모델 `id` 와 그것의 **그라운드 트루스 `vendor`** ([`research/lib/vendors.ts`](research/lib/vendors.ts) 의 표준 id 중 하나 — 27개 벤더가 등록되어 있음)를 짝지웁니다:

```yaml
models:
  - { id: "anthropic/claude-opus-4.8:anthropic", vendor: anthropic, label: "Claude Opus 4.8" }
  - { id: "qwen/qwen3.7-max:alibaba",            vendor: qwen,      label: "Qwen3.7 Max" }
  - { id: "openai/gpt-5.5:openai",               vendor: openai,    label: "GPT-5.5" }
  # ...
```

> `id` 는 `:provider` 라우팅 접미사(`:anthropic` / `:openai` / `:alibaba`…)를 **포함한** ZenMux의 전체 모델 id를 사용합니다. `vendor` 는 모델의 *진짜* 제작사로 — 추출기가 *주장한* 벤더와 비교되어 혼동률을 계산합니다.

---

## 🔬 파이프라인 작동 방식

파이프라인은 리포트를 작성하기 전에 데이터를 검사할 수 있도록 **의도적으로 독립된 단계로 분리**되어 있습니다. 각 단계는 이전 단계의 파일을 읽습니다:

```
config/study.yaml
  └─▶ records.jsonl       ask        model × lang × repeat  → raw answers
        └─▶ extractions.jsonl   extract    claimed vendor per answer (extractor model)
              └─▶ aggregate.json      aggregate  edges + per-cell distributions + summary
                    └─▶ report.md           report     arxiv-style write-up
                          ⋯ graph PNG/SVG    ← rendered on demand in the web Graph Studio
```

모든 실행은 각자의 **타임스탬프가 찍힌 디렉터리**에 존재합니다: `results/<study.id>/<stamp>/`.

| 명령 | 하는 일 |
|---|---|
| `pnpm study:test` | **1단계** — ask → extract → aggregate, 완전성 게이트와 함께 체이닝 |
| `pnpm study:report` | **2단계** — `aggregate.json` 을 arxiv 스타일 `report.md` 로 변환 |
| `pnpm study:run` | ask 패스만 (자동 재시도 라운드 + 재개) |
| `pnpm study:extract` | 정체성 추출 패스만 (완전한 레코드 필요) |
| `pnpm study:aggregate` | 조인 + 요약만 (완전한 레코드 필요) |
| `pnpm study:mix` | 여러 실행을 하나의 병합 결과로 풀링 (**API 호출 없음**) |

집계가 끝나면 핵심 수치를 터미널에 바로 출력합니다:

```
[aggregate] selfRate=85.2% confusion=7.1% unknown=2.4% refused=5.3%
[aggregate]   tencent -> anthropic: 29.2% (321/1100)
[aggregate]   z-ai    -> google:    25.0% (275/1100)
```

<details>
<summary><b>재개, 자동 재시도 &amp; 완전성 게이트</b></summary>

<br/>

**설계상 재개 가능.** 모든 것은 JSONL이고, 추가 전용이며, 재개 키 `model::lang::repeat` 로 중복 제거됩니다. 다시 실행하면 누락된 것만 채웁니다.

- **`--run` 없음** → 새로운 타임스탬프 실행을 생성합니다.
- **`--run <stamp>`** → 해당 실행을 재개하여 누락/실패한 요청만 채웁니다.
- **`--run latest`** → 가장 최근 실행을 재개합니다.

```bash
pnpm study:run --run 20260601T053656      # top up an unfinished run
```

`study:run` 은 요청별 지수 백오프 위에 **외부 재시도 라운드 루프**(`--max-rounds`, 기본값 5)를 두고 있어, 일시적 실패는 자동으로 재시도됩니다.

**완전성 게이트.** `study:extract` 와 `study:aggregate` 는 기대되는 *모든* `model × lang × repeat` 셀에 성공한 레코드가 있지 않으면 실행을 거부합니다 — 0이 아닌 코드로 종료하며, 이는 부분 데이터로 작동하기 전에 체이닝된 `study:test` 를 중단시킵니다. 우회하려면 `--force` 를 전달하세요.

</details>

<details>
<summary><b>실행 믹싱 — 단계별 데이터를 하나의 결과로 풀링</b></summary>

<br/>

연구는 보통 단계적으로 수집됩니다 (큰 실행 하나, 모델 하나를 추가하는 후속 실행, 반복을 추가하는 보충 실행). `study:mix` 는 여러 실행을 **하나의 병합 결과**로 풀링합니다. **API 호출을 하지 않으며**, 자동 집계도 **하지 않습니다**.

```bash
pnpm study:mix --runs 20260531T175027,20260601T012758   # specific runs
pnpm study:mix --all                                     # every native run (skips mix-* dirs)

pnpm study:aggregate --run mix-<stamp>    # then aggregate the mix as usual
pnpm study:report    --run mix-<stamp>
```

병합 단위는 재개 키가 *아니라* **`generationId`**(API의 고유 `message.id`)입니다 — 같은 모델의 두 실행은 충돌하는 키를 생성하므로 단순한 연결-후-중복제거는 겹치는 부분을 조용히 누락시키기 때문입니다. 풀링 후, 살아남은 모든 답변은 새로운 고유 키로 다시 번호가 매겨지므로, 믹스는 `aggregate`, `browse`, `export` 에 대해 **다운스트림 변경 없이** 네이티브 실행처럼 동작합니다. `mix.json` 사이드카가 디렉터리를 표시하고 직사각형 완전성 게이트를 완화합니다 (믹스는 설계상 들쭉날쭉함). 자극 간 믹싱은 차단되지 않고 **경고**됩니다.

</details>

---

## 🖥️ 웹 뷰어

```bash
pnpm dev      # → http://localhost:3000
```

| 라우트 | 무엇인가 |
|---|---|
| **[`/`](http://localhost:3000)** | Arena 허브 — 모든 실험을 위한 카드, 라이브 통계, 그리고 "surprise me" 바로가기. |
| **[`/research`](http://localhost:3000/research)** | 리포트 페이지 — 핵심 지표, 인터랙티브 관계 그래프 (노드에 마우스를 올리면 해당 엣지를 강조, 엣지에 올리면 정확한 확률 표시, 언어별 필터링), 그리고 요약 표. |
| **[`/research/studio`](http://localhost:3000/research/studio)** | **Graph Studio** — 간격 / 노드 크기 / 곡률 / 임계값 / 팔레트 / 라벨 / 배경을 실시간으로 조정하고, 드래그로 엣지를 재구성하며, 벤더를 숨긴 뒤 **PNG/SVG로 내보내기** (WYSIWYG; 내보낸 푸터에 ZenMux 배지 + 저장소 URL이 담김). **그래프가 렌더링되는 유일한 곳입니다.** |
| **[`/research/browse`](http://localhost:3000/research/browse)** | 원시 답변 브라우저 — 모델 → 언어로 그룹화된 모든 `records.jsonl` 답변을 각각의 전체 추출 라벨과 함께 표시. `mix` 디렉터리의 경우, 각 답변은 그 소스 실행으로 태그됩니다. |

> 📌 관계 그래프(PNG/SVG)는 CLI가 아니라 **Graph Studio에서만 렌더링되고 내보내집니다**. 파이프라인은 `aggregate.json` 에서 멈추며, 모든 시각적 요소는 브라우저에서 구동됩니다.

---

## 🗂️ 프로젝트 구조

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
<summary><b>아키텍처 노트</b></summary>

<br/>

- **두 반쪽, 하나의 단일 진실 원천.** 파이프라인(`research/*`, `tsx` 로 실행)과 뷰어(`src/app/*`, Next.js 16 / React 19)는 `research/lib/types.ts` 를 공유합니다.
- **설정은 실행마다 고정됩니다.** 새 `study:run` 은 `config/study.yaml` 을 실행 디렉터리에 스냅샷으로 남기고, 재개는 *스냅샷*을 읽으므로 라이브 설정을 편집해도 진행 중인 실행을 절대 망가뜨리지 않습니다.
- **추출기는 방어적입니다.** 별도의 모델이 각 답변을 라벨링하며, 파싱은 엄격한 JSON → 첫 번째 균형 잡힌 `{…}` → 최후의 별칭 스캔 순으로 시도하고, 예상치 못한 라벨은 `vendorFromText` 로 정규화하거나 `unknown` 으로 폴백합니다.
- **벤더 분류 체계.** `research/lib/vendors.ts` 가 표준 레지스트리이며, `aliases`(通义千问 / 文心一言 같은 중국어 이름 포함)는 긴 것 우선으로 매칭됩니다. 세 개의 의사 벤더 — `self`, `unknown`, `refused` — 는 실제 제작사가 아니라 분석용 버킷입니다.
- **그래프 렌더링은 웹 전용입니다.** `buildGraphSvg` 가 SVG를 직접 만들고, `/api/export` 가 `@resvg/resvg-js` 로 PNG로 래스터화합니다. 스튜디오는 하나의 공유 `RenderConfig` 로 라이브 미리보기와 내보내기를 모두 구동하므로, 내보내기는 WYSIWYG입니다.
- **프런트엔드 스택.** Next.js 16 · React 19 · Tailwind v4 (CSS 우선, `tailwind.config.js` 없음) · shadcn/ui (`radix-nova`, 베이스 `neutral`, `lucide` 아이콘). 스튜디오/브라우즈 페이지는 RSC + `force-dynamic` 이라, 새 실행이 리빌드 없이 새로고침 시 나타납니다.

</details>

---

## 새 실험 추가하기

Arena는 성장하도록 만들어졌습니다. 대략:

1. **설정 작성** — `config/study.yaml` 을 복사하고, **고유한 `study.id`** 를 부여한 뒤 (실행 디렉터리는 `results/<study.id>/<stamp>/`), 모델, 언어, 반복, 프롬프트, 추출기를 설정합니다.
2. **파이프라인 실행** — `pnpm study:run --config config/your-study.yaml` (이어서 `extract` / `aggregate` / `report`, 각각 `--config` 와 `--run latest` 를 붙여서).
3. **등록** — [`src/lib/experiments.ts`](src/lib/experiments.ts) 에 항목을 추가하여 허브와 사이드바에 나타나게 합니다.

> ⚠️ `pnpm study:test --config foo.yaml` 을 사용하지 마세요 — `study:test` 는 세 명령을 `&&` 로 체이닝하므로 추가 플래그가 *마지막* 명령에만 도달합니다. 각각에 명시적인 `--config` 를 붙인 단계별 명령을 사용하세요.

---

## 🤝 기여하기

이슈와 PR을 환영합니다 — 새 실험, 더 많은 벤더, 뷰어 다듬기, 또는 방법론 비평.

- 프런트엔드 변경(`src/app/**`, `src/components/**`)은 **[`CLAUDE.md`](CLAUDE.md)** 의 관례를 따릅니다 (레지스트리를 통한 shadcn, Tailwind v4, RSC 우선).
- PR을 열기 전에 `pnpm lint`.
- 연구 파이프라인(`research/**`)은 테스트 러너가 없는 순수 TypeScript입니다 — `study:test` *가* 데이터 파이프라인이지, 유닛 스위트가 아닙니다.

---

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="36">
</picture>

<br/><br/>

**Research by [thinkthinking](https://github.com/thinkthinking) · powered by [ZenMux.ai](https://zenmux.ai)**

모든 모델 호출은 ZenMux Anthropic Messages API를 통과합니다 — 하나의 키, 모든 벤더.

<sub>Scaffolded with <a href="https://nextjs.org">Next.js</a> · see the original create-next-app docs at <a href="https://nextjs.org/docs">nextjs.org/docs</a>.</sub>

</div>
</div>
