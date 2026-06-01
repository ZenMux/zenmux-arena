<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="56">
</picture>

# ZenMux Arena

**Открытая лаборатория для кросс-вендорных экспериментов над передовыми LLM.**
Один вопрос, заданный множеством способов, во множестве моделей — измеренный, агрегированный и визуализированный.

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

<sub>Флагманское исследование — <b>«Who Are You?»</b> — отрисованное во встроенной Graph Studio. Каждая стрелка: модель вендора <i>A</i>, выдающая себя за вендора <i>B</i>.</sub>

<br/>

<!-- README-I18N:START -->

[English](./README.md) | [简体中文](./README.zh-Hans.md) | [繁體中文](./README.zh-Hant.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | **Русский** | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md)

<!-- README-I18N:END -->

</div>

---

## Что это?

**ZenMux Arena** — это исследовательский каркас **+** просмотрщик на Next.js для запуска *одного и того же* зондирующего запроса к передовым моделям множества вендоров и превращения сырых ответов в граф, таблицы и отчёт в стиле arxiv.

Он построен как **хаб для растущей серии экспериментов**, а не для одного. Общий реестр живёт в [`src/lib/experiments.ts`](src/lib/experiments.ts); каждое исследование автоматически появляется на главной странице и в боковой панели. Сегодня Arena поставляется с одним **активным** исследованием и резервирует место для новых:

| Исследование | Какой вопрос задаёт | Статус |
|---|---|---|
| 🫆 **[Who Are You?](#-в-центре-внимания-who-are-you)** | *За какого вендора выдаёт себя каждая модель — на десяти языках?* | ✅ **Активно** |
| 🧭 *Больше экспериментов* | Кросс-вендорные зонды отказов, угодливости, границ знаний, устойчивости персоны… | 🔜 *Скоро* |

> Хотите добавить собственный зонд? Смотрите **[Добавление нового эксперимента](#добавление-нового-эксперимента)** — это запись в реестре плюс файл конфигурации.

Каждый вызов модели проходит через **эндпоинт Anthropic Messages от [ZenMux](https://zenmux.ai)** (`https://zenmux.ai/api/anthropic`) с использованием официального клиента [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript), поэтому один API-ключ достаёт до каждого тестируемого вендора.

---

## 🫆 В центре внимания: "Who Are You?"

> **Кросс-вендорная путаница идентичности у передовых LLM**

Систематическое исследование: перевести один вопрос — **«Who are you?»** — на **10 языков**, задать новейшим моделям каждого вендора **N раз каждой**, затем использовать отдельную модель-*экстрактор*, чтобы пометить **вендора, за которого выдаёт себя каждый ответ** (например, модель Claude, отвечающая *«I am Qwen»*). Мы агрегируем кросс-вендорную путаницу в граф + отчёт.

Текущий стимул — это **зонд де-брендинга / выявления идентичности**: тело инструкции удерживается байт-в-байт идентичным во всех десяти языках (варьируется только завершающее предложение *«Respond in &lt;Language&gt;.»*), и оно явно просит модель отбросить любую персону из системного промпта и сообщить *базовую* модель. Смотрите `config/study.yaml` над блоком `languages:` для точной формулировки и альтернативного базового варианта с голым вопросом.

### Ключевые выводы

Из последнего объединённого прогона (`mix-20260601T062425`): **27 моделей × 10 языков × 40 повторов ≈ 29 700 ответов.**

| Метрика | Значение | Смысл |
|---|--:|---|
| 🟢 **Самоидентификация** | **85.2%** | ответ со *своим* истинным вендором |
| 🔴 **Кросс-вендорная путаница** | **7.1%** | заявлен *другой* вендор |
| ⚪ **Неизвестно** | **2.4%** | ответ дан, но без указания идентичности |
| ⛔ **Отказ** | **5.3%** | отказались отвечать |

**Несколько самых ярких случаев путаницы** *(модель вендора → вендор, за которого она себя выдала)*:

```
tencent   → anthropic   29.2%   (321/1100)
z-ai      → google      25.0%   (275/1100)
kwai      → qwen        13.5%   (148/1100)
bytedance → openai       7.2%   (317/4400)
```

> Читайте полное описание в сгенерированном `report.md` или исследуйте его интерактивно по адресу **[`/research`](#-веб-просмотрщик)**.

---

## ⚡ Быстрый старт

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

Отредактируйте **[`config/study.yaml`](config/study.yaml)**, чтобы выбрать, какие модели, языки и число повторов тестировать. Каждая запись модели сопоставляет ZenMux-овский `id` модели с её **истинным `vendor`** (одним из канонических id в [`research/lib/vendors.ts`](research/lib/vendors.ts) — зарегистрировано 27 вендоров):

```yaml
models:
  - { id: "anthropic/claude-opus-4.8:anthropic", vendor: anthropic, label: "Claude Opus 4.8" }
  - { id: "qwen/qwen3.7-max:alibaba",            vendor: qwen,      label: "Qwen3.7 Max" }
  - { id: "openai/gpt-5.5:openai",               vendor: openai,    label: "GPT-5.5" }
  # ...
```

> `id` использует полный id модели ZenMux **включая** суффикс маршрутизации `:provider` (`:anthropic` / `:openai` / `:alibaba`…). `vendor` — это *истинный* создатель модели; он сравнивается с *заявленным* вендором от экстрактора для вычисления доли путаницы.

---

## 🔬 Как работает конвейер

Конвейер **намеренно разбит на независимые стадии**, чтобы вы могли осмотреть данные перед написанием отчёта. Каждая стадия читает файл предыдущей стадии:

```
config/study.yaml
  └─▶ records.jsonl       ask        model × lang × repeat  → raw answers
        └─▶ extractions.jsonl   extract    claimed vendor per answer (extractor model)
              └─▶ aggregate.json      aggregate  edges + per-cell distributions + summary
                    └─▶ report.md           report     arxiv-style write-up
                          ⋯ graph PNG/SVG    ← rendered on demand in the web Graph Studio
```

Каждый прогон живёт в собственном **каталоге с меткой времени**: `results/<study.id>/<stamp>/`.

| Команда | Что она делает |
|---|---|
| `pnpm study:test` | **Стадия 1** — ask → extract → aggregate, сцеплены с воротами полноты |
| `pnpm study:report` | **Стадия 2** — превратить `aggregate.json` в отчёт `report.md` в стиле arxiv |
| `pnpm study:run` | Только проход опроса (раунды автоповтора + возобновление) |
| `pnpm study:extract` | Только проход извлечения идентичности (нужны полные записи) |
| `pnpm study:aggregate` | Только объединение + сведение (нужны полные записи) |
| `pnpm study:mix` | Объединить несколько прогонов в один сведённый результат (**без вызовов API**) |

Когда агрегация завершается, она печатает ключевые цифры прямо в ваш терминал:

```
[aggregate] selfRate=85.2% confusion=7.1% unknown=2.4% refused=5.3%
[aggregate]   tencent -> anthropic: 29.2% (321/1100)
[aggregate]   z-ai    -> google:    25.0% (275/1100)
```

<details>
<summary><b>Возобновление, автоповтор &amp; ворота полноты</b></summary>

<br/>

**Возобновляемо по замыслу.** Всё представлено в JSONL, только с дозаписью, и дедуплицируется по ключу возобновления `model::lang::repeat`. Повторный запуск заполняет только то, чего не хватает.

- **Без `--run`** → создаёт свежий прогон с меткой времени.
- **`--run <stamp>`** → возобновляет тот прогон, заполняя только отсутствующие/неудавшиеся запросы.
- **`--run latest`** → возобновляет самый недавний прогон.

```bash
pnpm study:run --run 20260601T053656      # top up an unfinished run
```

У `study:run` есть **внешний цикл раундов повтора** (`--max-rounds`, по умолчанию 5) поверх экспоненциальной задержки на каждый запрос, так что временные сбои переповторяются автоматически.

**Ворота полноты.** `study:extract` и `study:aggregate` отказываются запускаться, если *в каждой* ожидаемой ячейке `model × lang × repeat` нет успешной записи — они завершаются с ненулевым кодом, что останавливает сцеплённый `study:test` до того, как он сможет работать с частичными данными. Передайте `--force`, чтобы переопределить.

</details>

<details>
<summary><b>Смешивание прогонов — объединение поэтапных данных в один результат</b></summary>

<br/>

Исследование обычно собирается поэтапно (большой прогон, последующий прогон, добавляющий одну модель, дозаправка, добавляющая повторы). `study:mix` объединяет несколько прогонов в **один сведённый результат**. Он не делает **никаких вызовов API** и **не** агрегирует автоматически.

```bash
pnpm study:mix --runs 20260531T175027,20260601T012758   # specific runs
pnpm study:mix --all                                     # every native run (skips mix-* dirs)

pnpm study:aggregate --run mix-<stamp>    # then aggregate the mix as usual
pnpm study:report    --run mix-<stamp>
```

Единица объединения — **`generationId`** (уникальный `message.id` от API), *а не* ключ возобновления — потому что два прогона одной и той же модели порождают сталкивающиеся ключи, поэтому наивная конкатенация-и-дедупликация молча отбросила бы пересечение. После объединения каждый уцелевший ответ перенумеровывается в свежий уникальный ключ, так что смешение ведёт себя как нативный прогон для `aggregate`, `browse` и `export` с **нулевыми изменениями ниже по потоку**. Сопроводительный файл `mix.json` помечает каталог и ослабляет прямоугольные ворота полноты (смешение по замыслу неровное). Смешивание разных стимулов **сопровождается предупреждением, но не блокируется**.

</details>

---

## 🖥️ Веб-просмотрщик

```bash
pnpm dev      # → http://localhost:3000
```

| Маршрут | Что это |
|---|---|
| **[`/`](http://localhost:3000)** | Хаб Arena — карточки для каждого эксперимента, живая статистика и переход «удиви меня». |
| **[`/research`](http://localhost:3000/research)** | Страница отчёта — ключевые метрики, интерактивный граф связей (наведите на узел, чтобы подсветить его рёбра, наведите на ребро для точных вероятностей, фильтруйте по языку) и сводные таблицы. |
| **[`/research/studio`](http://localhost:3000/research/studio)** | **Graph Studio** — настраивайте интервалы / размер узлов / кривизну / порог / палитру / подписи / фон вживую, тяните, чтобы переформировать рёбра, скрывайте вендоров, затем **экспортируйте PNG/SVG** (WYSIWYG; экспортированный нижний колонтитул несёт бейдж ZenMux + URL репозитория). **Это единственное место, где отрисовывается граф.** |
| **[`/research/browse`](http://localhost:3000/research/browse)** | Просмотрщик сырых ответов — каждый ответ из `records.jsonl`, сгруппированный по модели → языку, каждый показан с полной меткой извлечения. Для каталога `mix` каждый ответ помечен своим исходным прогоном. |

> 📌 Граф связей (PNG/SVG) **отрисовывается и экспортируется только из Graph Studio**, никогда из CLI. Конвейер останавливается на `aggregate.json`; всё визуальное управляется из браузера.

---

## 🗂️ Структура проекта

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
<summary><b>Заметки об архитектуре</b></summary>

<br/>

- **Две половины, один источник истины.** Конвейер (`research/*`, запускается через `tsx`) и просмотрщик (`src/app/*`, Next.js 16 / React 19) разделяют `research/lib/types.ts`.
- **Конфигурация закрепляется за каждым прогоном.** Свежий `study:run` делает снимок `config/study.yaml` в каталог прогона; возобновление читает *снимок*, поэтому правка живой конфигурации никогда не портит выполняющийся прогон.
- **Экстрактор защищён.** Отдельная модель помечает каждый ответ; разбор пробует строгий JSON → первый сбалансированный `{…}` → сканирование псевдонимов как последнее средство, нормализуя неожиданные метки через `vendorFromText` или откатываясь к `unknown`.
- **Таксономия вендоров.** `research/lib/vendors.ts` — канонический реестр с `aliases` (включая китайские имена вроде 通义千问 / 文心一言), сопоставляемыми по принципу «сначала самое длинное». Три псевдо-вендора — `self`, `unknown`, `refused` — это аналитические корзины, а не реальные создатели.
- **Отрисовка графа только в вебе.** `buildGraphSvg` вручную собирает SVG; `/api/export` растеризует его в PNG через `@resvg/resvg-js`. Студия управляет и живым предпросмотром, и экспортом из одного общего `RenderConfig`, поэтому экспорт WYSIWYG.
- **Фронтенд-стек.** Next.js 16 · React 19 · Tailwind v4 (CSS-first, без `tailwind.config.js`) · shadcn/ui (`radix-nova`, базовый цвет `neutral`, иконки `lucide`). Страницы studio/browse — это RSC + `force-dynamic`, поэтому свежие прогоны появляются при перезагрузке без пересборки.

</details>

---

## Добавление нового эксперимента

Arena построена для роста. Примерно так:

1. **Напишите конфигурацию** — скопируйте `config/study.yaml`, дайте ей **отдельный `study.id`** (каталоги прогонов — `results/<study.id>/<stamp>/`) и задайте модели, языки, повторы, промпт и экстрактор.
2. **Запустите конвейер** — `pnpm study:run --config config/your-study.yaml` (затем `extract` / `aggregate` / `report`, каждый с `--config` и `--run latest`).
3. **Зарегистрируйте его** — добавьте запись в [`src/lib/experiments.ts`](src/lib/experiments.ts), чтобы он появился на хабе и в боковой панели.

> ⚠️ Не используйте `pnpm study:test --config foo.yaml` — `study:test` сцепляет три команды через `&&`, поэтому дополнительный флаг достигает только *последней* из них. Используйте пошаговые команды с явным `--config` на каждой.

---

## 🤝 Участие

Issue и PR приветствуются — новые эксперименты, больше вендоров, полировка просмотрщика или критика методологии.

- Изменения фронтенда (`src/app/**`, `src/components/**`) следуют соглашениям в **[`CLAUDE.md`](CLAUDE.md)** (shadcn через реестр, Tailwind v4, RSC-first).
- `pnpm lint` перед открытием PR.
- Исследовательский конвейер (`research/**`) — это обычный TypeScript без раннера тестов: `study:test` *и есть* конвейер данных, а не набор юнит-тестов.

---

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="36">
</picture>

<br/><br/>

**Исследование от [thinkthinking](https://github.com/thinkthinking) · работает на [ZenMux.ai](https://zenmux.ai)**

Все вызовы моделей маршрутизируются через API Anthropic Messages от ZenMux — один ключ, каждый вендор.

<sub>Заскаффолжено с <a href="https://nextjs.org">Next.js</a> · смотрите оригинальную документацию create-next-app по адресу <a href="https://nextjs.org/docs">nextjs.org/docs</a>.</sub>

</div>
