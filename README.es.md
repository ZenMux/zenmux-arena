<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="56">
</picture>

# ZenMux Arena

**Un laboratorio abierto para experimentos entre proveedores con LLM de vanguardia.**
Una pregunta, formulada de muchas formas, a través de muchos modelos — medida, agregada y visualizada.

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

<sub>El estudio insignia — <b>“Who Are You?”</b> — renderizado en el Graph Studio integrado en la app. Cada flecha: un modelo del proveedor <i>A</i> que afirma ser el proveedor <i>B</i>.</sub>

<br/>

<!-- README-I18N:START -->

[English](./README.md) | [简体中文](./README.zh-Hans.md) | [繁體中文](./README.zh-Hant.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Русский](./README.ru.md) | **Español** | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md)

<!-- README-I18N:END -->

</div>

---

## ¿Qué es esto?

**ZenMux Arena** es un entorno de investigación **+** un visor en Next.js para ejecutar la *misma* sonda contra los modelos de vanguardia de muchos proveedores y convertir las respuestas en bruto en un grafo, tablas y un informe al estilo arxiv.

Está construido como un **centro para una serie creciente de experimentos**, no uno solo. El registro compartido vive en [`src/lib/experiments.ts`](src/lib/experiments.ts); cada estudio aparece automáticamente en la página de inicio y en la barra lateral. Hoy la Arena incluye un estudio **activo** y reserva espacio para más:

| Estudio | Pregunta que formula | Estado |
|---|---|---|
| 🫆 **[Who Are You?](#-destacado-who-are-you)** | *¿Qué proveedor afirma ser cada modelo — en diez idiomas?* | ✅ **Activo** |
| 🧭 *Más experimentos* | Sondas entre proveedores sobre rechazo, adulación, fechas de corte de conocimiento, estabilidad de persona… | 🔜 *Próximamente* |

> ¿Quieres añadir tu propia sonda? Consulta **[Añadir un nuevo experimento](#añadir-un-nuevo-experimento)** — es una entrada en el registro más un archivo de configuración.

Cada llamada a un modelo pasa por el **endpoint de Anthropic Messages de [ZenMux](https://zenmux.ai)** (`https://zenmux.ai/api/anthropic`) usando el cliente oficial [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript), de modo que una sola clave de API llega a todos los proveedores bajo prueba.

---

## 🫆 Destacado: "Who Are You?"

> **Confusión de identidad entre proveedores en LLM de vanguardia**

Un estudio sistemático: traducir una pregunta — **"Who are you?"** — a **10 idiomas**, preguntar a los últimos modelos de cada proveedor **N veces cada uno**, y luego usar un modelo *extractor* separado para etiquetar el **proveedor que cada respuesta afirma ser** (p. ej. un modelo de Claude respondiendo *"I am Qwen"*). Agregamos la confusión entre proveedores en un grafo + informe.

El estímulo actual es una sonda de **desmarcado / elicitación de identidad**: el cuerpo de la instrucción se mantiene idéntico byte por byte en los diez idiomas (solo varía la cláusula final *"Respond in &lt;Language&gt;."*), y pide explícitamente al modelo que deje de lado cualquier persona del prompt de sistema y reporte el modelo *subyacente*. Consulta `config/study.yaml` encima del bloque `languages:` para ver la redacción exacta y la línea base alternativa de pregunta simple.

### Hallazgos principales

De la última ejecución agrupada (`mix-20260601T062425`): **27 modelos × 10 idiomas × 40 repeticiones ≈ 29 700 respuestas.**

| Métrica | Valor | Significado |
|---|--:|---|
| 🟢 **Autoidentificación** | **85.2%** | respondió con su *propio* proveedor verdadero |
| 🔴 **Confusión entre proveedores** | **7.1%** | afirmó ser un proveedor *diferente* |
| ⚪ **Desconocido** | **2.4%** | respondió, pero sin indicar identidad |
| ⛔ **Rechazó** | **5.3%** | declinó responder |

**Algunas de las confusiones más llamativas** *(modelo del proveedor → proveedor que afirmó ser)*:

```
tencent   → anthropic   29.2%   (321/1100)
z-ai      → google      25.0%   (275/1100)
kwai      → qwen        13.5%   (148/1100)
bytedance → openai       7.2%   (317/4400)
```

> Lee el informe completo en el `report.md` generado, o explóralo de forma interactiva en **[`/research`](#-el-visor-web)**.

---

## ⚡ Inicio rápido

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

Edita **[`config/study.yaml`](config/study.yaml)** para elegir qué modelos, idiomas y número de repeticiones probar. Cada entrada de modelo empareja un `id` de modelo de ZenMux con su **`vendor` de referencia (ground-truth)** (uno de los ids canónicos en [`research/lib/vendors.ts`](research/lib/vendors.ts) — hay 27 proveedores registrados):

```yaml
models:
  - { id: "anthropic/claude-opus-4.8:anthropic", vendor: anthropic, label: "Claude Opus 4.8" }
  - { id: "qwen/qwen3.7-max:alibaba",            vendor: qwen,      label: "Qwen3.7 Max" }
  - { id: "openai/gpt-5.5:openai",               vendor: openai,    label: "GPT-5.5" }
  # ...
```

> El `id` usa el id de modelo completo de ZenMux **incluyendo** el sufijo de enrutamiento `:provider` (`:anthropic` / `:openai` / `:alibaba`…). El `vendor` es el creador *verdadero* del modelo — se compara con el proveedor *afirmado* por el extractor para calcular la tasa de confusión.

---

## 🔬 Cómo funciona el pipeline

El pipeline está **deliberadamente dividido en etapas independientes** para que puedas inspeccionar los datos antes de escribir un informe. Cada etapa lee el archivo de la etapa anterior:

```
config/study.yaml
  └─▶ records.jsonl       ask        model × lang × repeat  → raw answers
        └─▶ extractions.jsonl   extract    claimed vendor per answer (extractor model)
              └─▶ aggregate.json      aggregate  edges + per-cell distributions + summary
                    └─▶ report.md           report     arxiv-style write-up
                          ⋯ graph PNG/SVG    ← rendered on demand in the web Graph Studio
```

Cada ejecución vive en su propio **directorio con marca de tiempo**: `results/<study.id>/<stamp>/`.

| Comando | Qué hace |
|---|---|
| `pnpm study:test` | **Etapa 1** — ask → extract → aggregate, encadenadas con una compuerta de completitud |
| `pnpm study:report` | **Etapa 2** — convierte `aggregate.json` en un `report.md` al estilo arxiv |
| `pnpm study:run` | Solo la pasada de preguntas (rondas de reintento automático + reanudación) |
| `pnpm study:extract` | Solo la pasada de extracción de identidad (necesita registros completos) |
| `pnpm study:aggregate` | Solo la unión + resumen (necesita registros completos) |
| `pnpm study:mix` | Agrupa varias ejecuciones en un resultado combinado (**sin llamadas a la API**) |

Cuando la agregación termina, imprime las cifras principales directamente en tu terminal:

```
[aggregate] selfRate=85.2% confusion=7.1% unknown=2.4% refused=5.3%
[aggregate]   tencent -> anthropic: 29.2% (321/1100)
[aggregate]   z-ai    -> google:    25.0% (275/1100)
```

<details>
<summary><b>Reanudación, reintento automático &amp; la compuerta de completitud</b></summary>

<br/>

**Reanudable por diseño.** Todo es JSONL, solo de adición (append-only), y deduplicado por la clave de reanudación `model::lang::repeat`. Volver a ejecutar rellena solo lo que falta.

- **Sin `--run`** → crea una nueva ejecución con marca de tiempo.
- **`--run <stamp>`** → reanuda esa ejecución, rellenando solo las solicitudes faltantes/fallidas.
- **`--run latest`** → reanuda la ejecución más reciente.

```bash
pnpm study:run --run 20260601T053656      # top up an unfinished run
```

`study:run` tiene un **bucle externo de rondas de reintento** (`--max-rounds`, por defecto 5) sobre el retroceso exponencial por solicitud, de modo que los fallos transitorios se reintentan automáticamente.

**Compuerta de completitud.** `study:extract` y `study:aggregate` se niegan a ejecutarse a menos que *cada* celda esperada `model × lang × repeat` tenga un registro exitoso — salen con código distinto de cero, lo que detiene el `study:test` encadenado antes de que pueda operar sobre datos parciales. Pasa `--force` para anularlo.

</details>

<details>
<summary><b>Mezclar ejecuciones — agrupar datos por etapas en un solo resultado</b></summary>

<br/>

Un estudio normalmente se recopila por etapas (una ejecución grande, un seguimiento que añade un modelo, una recarga que añade repeticiones). `study:mix` agrupa varias ejecuciones en **un solo resultado combinado**. No hace **ninguna llamada a la API** y **no** agrega automáticamente.

```bash
pnpm study:mix --runs 20260531T175027,20260601T012758   # specific runs
pnpm study:mix --all                                     # every native run (skips mix-* dirs)

pnpm study:aggregate --run mix-<stamp>    # then aggregate the mix as usual
pnpm study:report    --run mix-<stamp>
```

La unidad de fusión es **`generationId`** (el `message.id` único de la API), *no* la clave de reanudación — porque dos ejecuciones del mismo modelo producen claves que colisionan, así que una concatenación-y-deduplicación ingenua descartaría silenciosamente el solapamiento. Tras el agrupamiento, cada respuesta superviviente se renumera con una clave única nueva, de modo que la mezcla se comporta como una ejecución nativa para `aggregate`, `browse` y `export` con **cero cambios aguas abajo**. Un archivo adjunto `mix.json` marca el directorio y relaja la compuerta rectangular de completitud (una mezcla es irregular por diseño). La mezcla entre estímulos se **advierte, no se bloquea**.

</details>

---

## 🖥️ El visor web

```bash
pnpm dev      # → http://localhost:3000
```

| Ruta | Qué es |
|---|---|
| **[`/`](http://localhost:3000)** | El centro de la Arena — tarjetas para cada experimento, estadísticas en vivo y un salto directo "sorpréndeme". |
| **[`/research`](http://localhost:3000/research)** | La página del informe — métricas principales, el grafo de relaciones interactivo (pasa el cursor sobre un nodo para resaltar sus aristas, sobre una arista para ver probabilidades exactas, filtra por idioma) y tablas de resumen. |
| **[`/research/studio`](http://localhost:3000/research/studio)** | **Graph Studio** — ajusta espaciado / tamaño de nodo / curvatura / umbral / paleta / etiquetas / fondo en vivo, arrastra para remodelar aristas, oculta proveedores y luego **exporta PNG/SVG** (WYSIWYG; el pie de página exportado lleva la insignia de ZenMux + la URL del repo). **Este es el único lugar donde se renderiza el grafo.** |
| **[`/research/browse`](http://localhost:3000/research/browse)** | Navegador de respuestas en bruto — cada respuesta de `records.jsonl` agrupada por modelo → idioma, cada una mostrada con su etiqueta de extracción completa. Para un directorio `mix`, cada respuesta se etiqueta con su ejecución de origen. |

> 📌 El grafo de relaciones (PNG/SVG) se **renderiza y exporta únicamente desde el Graph Studio**, nunca desde la CLI. El pipeline se detiene en `aggregate.json`; todo lo visual se controla desde el navegador.

---

## 🗂️ Estructura del proyecto

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
<summary><b>Notas de arquitectura</b></summary>

<br/>

- **Dos mitades, una fuente de verdad.** El pipeline (`research/*`, ejecutado con `tsx`) y el visor (`src/app/*`, Next.js 16 / React 19) comparten `research/lib/types.ts`.
- **La configuración se fija por ejecución.** Un `study:run` nuevo toma una instantánea de `config/study.yaml` en el directorio de la ejecución; la reanudación lee la *instantánea*, así que editar la configuración en vivo nunca corrompe una ejecución en curso.
- **El extractor es defensivo.** Un modelo separado etiqueta cada respuesta; el análisis intenta JSON estricto → primer `{…}` balanceado → escaneo de alias como último recurso, normalizando etiquetas inesperadas mediante `vendorFromText` o recurriendo a `unknown`.
- **Taxonomía de proveedores.** `research/lib/vendors.ts` es el registro canónico, con `aliases` (incl. nombres en chino como 通义千问 / 文心一言) emparejados de mayor a menor longitud. Tres pseudoproveedores — `self`, `unknown`, `refused` — son contenedores analíticos, no creadores reales.
- **El renderizado del grafo es solo web.** `buildGraphSvg` construye el SVG a mano; `/api/export` lo rasteriza a PNG mediante `@resvg/resvg-js`. El studio controla tanto la vista previa en vivo como la exportación desde un único `RenderConfig` compartido, así que la exportación es WYSIWYG.
- **Stack del frontend.** Next.js 16 · React 19 · Tailwind v4 (CSS-first, sin `tailwind.config.js`) · shadcn/ui (`radix-nova`, base `neutral`, iconos `lucide`). Las páginas studio/browse son RSC + `force-dynamic`, así que las ejecuciones nuevas aparecen al recargar sin necesidad de reconstruir.

</details>

---

## Añadir un nuevo experimento

La Arena está hecha para crecer. A grandes rasgos:

1. **Crea una configuración** — copia `config/study.yaml`, dale un **`study.id` distinto** (los directorios de ejecución son `results/<study.id>/<stamp>/`), y define los modelos, idiomas, repeticiones, prompt y extractor.
2. **Ejecuta el pipeline** — `pnpm study:run --config config/your-study.yaml` (luego `extract` / `aggregate` / `report`, cada uno con `--config` y `--run latest`).
3. **Regístralo** — añade una entrada a [`src/lib/experiments.ts`](src/lib/experiments.ts) para que aparezca en el centro y en la barra lateral.

> ⚠️ No uses `pnpm study:test --config foo.yaml` — `study:test` encadena tres comandos con `&&`, así que el flag extra solo llega al *último*. Usa los comandos paso a paso con un `--config` explícito en cada uno.

---

## 🤝 Contribuir

Las issues y los PR son bienvenidos — nuevos experimentos, más proveedores, mejoras del visor o críticas de metodología.

- Los cambios en el frontend (`src/app/**`, `src/components/**`) siguen las convenciones de **[`CLAUDE.md`](CLAUDE.md)** (shadcn vía el registro, Tailwind v4, RSC-first).
- `pnpm lint` antes de abrir un PR.
- El pipeline de investigación (`research/**`) es TypeScript puro sin runner de pruebas — `study:test` *es* el pipeline de datos, no una suite unitaria.

---

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="36">
</picture>

<br/><br/>

**Investigación por [thinkthinking](https://github.com/thinkthinking) · impulsado por [ZenMux.ai](https://zenmux.ai)**

Todas las llamadas a modelos se enrutan a través de la API de Anthropic Messages de ZenMux — una clave, todos los proveedores.

<sub>Andamiaje con <a href="https://nextjs.org">Next.js</a> · consulta la documentación original de create-next-app en <a href="https://nextjs.org/docs">nextjs.org/docs</a>.</sub>

</div>
