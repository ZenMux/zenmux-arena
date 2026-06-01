<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="56">
</picture>

# ZenMux Arena

**Ein offenes Labor für anbieterübergreifende Experimente mit Frontier-LLMs.**
Eine Frage, auf viele Arten gestellt, über viele Modelle hinweg — gemessen, aggregiert und visualisiert.

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

<sub>Die Vorzeigestudie — <b>„Who Are You?“</b> — gerendert im integrierten Graph Studio. Jeder Pfeil: ein Modell von Anbieter <i>A</i>, das behauptet, Anbieter <i>B</i> zu sein.</sub>

<br/>

<!-- README-I18N:START -->

[English](./README.md) | [简体中文](./README.zh-Hans.md) | [繁體中文](./README.zh-Hant.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Русский](./README.ru.md) | [Español](./README.es.md) | [Français](./README.fr.md) | **Deutsch** | [Português](./README.pt.md)

<!-- README-I18N:END -->

</div>

---

## Was ist das?

**ZenMux Arena** ist ein Forschungs-Harness **+** ein Next.js-Viewer, um die *gleiche* Sonde gegen die Frontier-Modelle vieler Anbieter laufen zu lassen und die rohen Antworten in einen Graphen, Tabellen und einen Bericht im arxiv-Stil zu verwandeln.

Es ist als **Knotenpunkt für eine wachsende Reihe von Experimenten** konzipiert, nicht für ein einzelnes. Die gemeinsame Registry liegt in [`src/lib/experiments.ts`](src/lib/experiments.ts); jede Studie erscheint automatisch auf der Startseite und in der Seitenleiste. Heute liefert die Arena eine **live** geschaltete Studie aus und reserviert Platz für weitere:

| Studie | Welche Frage sie stellt | Status |
|---|---|---|
| 🫆 **[Who Are You?](#-im-fokus-who-are-you)** | *Welcher Anbieter behauptet jedes Modell zu sein — in zehn Sprachen?* | ✅ **Live** |
| 🧭 *Weitere Experimente* | Anbieterübergreifende Sonden zu Verweigerung, Speichelleckerei, Wissensgrenzen, Persona-Stabilität… | 🔜 *Demnächst* |

> Möchten Sie Ihre eigene Sonde hinzufügen? Siehe **[Ein neues Experiment hinzufügen](#ein-neues-experiment-hinzufügen)** — es ist ein Registry-Eintrag plus eine Konfigurationsdatei.

Jeder Modellaufruf läuft über **[ZenMux](https://zenmux.ai)s Anthropic-Messages-Endpunkt** (`https://zenmux.ai/api/anthropic`) mit dem offiziellen [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript)-Client, sodass ein API-Schlüssel jeden getesteten Anbieter erreicht.

---

## 🫆 Im Fokus: "Who Are You?"

> **Anbieterübergreifende Identitätsverwirrung bei Frontier-LLMs**

Eine systematische Studie: eine Frage — **„Who are you?“** — in **10 Sprachen** übersetzen, die neuesten Modelle jedes Anbieters **jeweils N-mal** fragen und dann ein separates *Extraktor*-Modell verwenden, um den **Anbieter zu kennzeichnen, den jede Antwort vorgibt zu sein** (z. B. ein Claude-Modell, das *„I am Qwen“* antwortet). Wir aggregieren die anbieterübergreifende Verwirrung in einen Graphen + Bericht.

Der aktuelle Stimulus ist eine **De-Branding-/Identitätsabfrage-Sonde**: Der Anweisungstext bleibt Byte für Byte über alle zehn Sprachen identisch (nur die abschließende *„Respond in &lt;Language&gt;.“*-Klausel variiert), und er fordert das Modell ausdrücklich auf, jede System-Prompt-Persona beiseitezulegen und das *zugrunde liegende* Modell zu melden. Den genauen Wortlaut und die alternative Baseline mit der bloßen Frage finden Sie in `config/study.yaml` oberhalb des `languages:`-Blocks.

### Wichtigste Ergebnisse

Aus dem neuesten gepoolten Lauf (`mix-20260601T062425`): **27 Modelle × 10 Sprachen × 40 Wiederholungen ≈ 29.700 Antworten.**

| Kennzahl | Wert | Bedeutung |
|---|--:|---|
| 🟢 **Selbstidentifikation** | **85,2 %** | antwortete mit seinem *eigenen* wahren Anbieter |
| 🔴 **Anbieterübergreifende Verwirrung** | **7,1 %** | gab einen *anderen* Anbieter an |
| ⚪ **Unbekannt** | **2,4 %** | antwortete, gab aber keine Identität an |
| ⛔ **Verweigert** | **5,3 %** | lehnte die Antwort ab |

**Einige der auffälligsten Verwechslungen** *(Modell eines Anbieters → Anbieter, den es vorgab)*:

```
tencent   → anthropic   29.2%   (321/1100)
z-ai      → google      25.0%   (275/1100)
kwai      → qwen        13.5%   (148/1100)
bytedance → openai       7.2%   (317/4400)
```

> Lesen Sie die vollständige Ausarbeitung im generierten `report.md` oder erkunden Sie sie interaktiv unter **[`/research`](#-der-web-viewer)**.

---

## ⚡ Schnellstart

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

Bearbeiten Sie **[`config/study.yaml`](config/study.yaml)**, um auszuwählen, welche Modelle, Sprachen und Wiederholungsanzahl getestet werden sollen. Jeder Modelleintrag koppelt eine ZenMux-Modell-`id` mit ihrem **Ground-Truth-`vendor`** (eine der kanonischen ids in [`research/lib/vendors.ts`](research/lib/vendors.ts) — 27 Anbieter sind registriert):

```yaml
models:
  - { id: "anthropic/claude-opus-4.8:anthropic", vendor: anthropic, label: "Claude Opus 4.8" }
  - { id: "qwen/qwen3.7-max:alibaba",            vendor: qwen,      label: "Qwen3.7 Max" }
  - { id: "openai/gpt-5.5:openai",               vendor: openai,    label: "GPT-5.5" }
  # ...
```

> Die `id` verwendet ZenMux' vollständige Modell-id **einschließlich** des `:provider`-Routing-Suffix (`:anthropic` / `:openai` / `:alibaba`…). Der `vendor` ist der *wahre* Hersteller des Modells — er wird mit dem vom Extraktor *behaupteten* Anbieter verglichen, um die Verwirrungsrate zu berechnen.

---

## 🔬 Wie die Pipeline funktioniert

Die Pipeline ist **bewusst in unabhängige Stufen aufgeteilt**, sodass Sie die Daten prüfen können, bevor Sie einen Bericht schreiben. Jede Stufe liest die Datei der vorherigen Stufe:

```
config/study.yaml
  └─▶ records.jsonl       ask        model × lang × repeat  → raw answers
        └─▶ extractions.jsonl   extract    claimed vendor per answer (extractor model)
              └─▶ aggregate.json      aggregate  edges + per-cell distributions + summary
                    └─▶ report.md           report     arxiv-style write-up
                          ⋯ graph PNG/SVG    ← rendered on demand in the web Graph Studio
```

Jeder Lauf lebt in seinem eigenen **mit Zeitstempel versehenen Verzeichnis**: `results/<study.id>/<stamp>/`.

| Befehl | Was er tut |
|---|---|
| `pnpm study:test` | **Stufe 1** — ask → extract → aggregate, verkettet mit einem Vollständigkeits-Gate |
| `pnpm study:report` | **Stufe 2** — `aggregate.json` in ein `report.md` im arxiv-Stil verwandeln |
| `pnpm study:run` | Nur der Ask-Durchlauf (automatische Wiederholungsrunden + Resume) |
| `pnpm study:extract` | Nur der Identitätsextraktions-Durchlauf (benötigt vollständige Datensätze) |
| `pnpm study:aggregate` | Nur Join + Zusammenfassung (benötigt vollständige Datensätze) |
| `pnpm study:mix` | Mehrere Läufe zu einem zusammengeführten Ergebnis poolen (**keine API-Aufrufe**) |

Wenn die Aggregation fertig ist, gibt sie die Kennzahlen direkt auf Ihrem Terminal aus:

```
[aggregate] selfRate=85.2% confusion=7.1% unknown=2.4% refused=5.3%
[aggregate]   tencent -> anthropic: 29.2% (321/1100)
[aggregate]   z-ai    -> google:    25.0% (275/1100)
```

<details>
<summary><b>Resume, Auto-Retry &amp; das Vollständigkeits-Gate</b></summary>

<br/>

**Per Design wiederaufnehmbar.** Alles ist JSONL, nur anhängend und nach dem Resume-Schlüssel `model::lang::repeat` dedupliziert. Ein erneuter Lauf füllt nur das, was fehlt.

- **Kein `--run`** → erstellt einen frischen, mit Zeitstempel versehenen Lauf.
- **`--run <stamp>`** → setzt diesen Lauf fort und füllt nur fehlende/fehlgeschlagene Anfragen.
- **`--run latest`** → setzt den jüngsten Lauf fort.

```bash
pnpm study:run --run 20260601T053656      # top up an unfinished run
```

`study:run` hat eine **äußere Wiederholungsrunden-Schleife** (`--max-rounds`, Standard 5) über dem exponentiellen Backoff pro Anfrage, sodass vorübergehende Fehler automatisch erneut versucht werden.

**Vollständigkeits-Gate.** `study:extract` und `study:aggregate` verweigern die Ausführung, sofern nicht *jede* erwartete `model × lang × repeat`-Zelle einen erfolgreichen Datensatz hat — sie beenden sich mit einem Wert ungleich null, was das verkettete `study:test` anhält, bevor es auf unvollständigen Daten arbeiten kann. Übergeben Sie `--force`, um dies zu übersteuern.

</details>

<details>
<summary><b>Läufe mischen — gestaffelte Daten zu einem Ergebnis poolen</b></summary>

<br/>

Eine Studie wird in der Regel in Etappen erhoben (ein großer Lauf, ein Follow-up, das ein Modell hinzufügt, ein Nachschlag, der Wiederholungen hinzufügt). `study:mix` poolt mehrere Läufe zu **einem zusammengeführten Ergebnis**. Es macht **keine API-Aufrufe** und aggregiert **nicht** automatisch.

```bash
pnpm study:mix --runs 20260531T175027,20260601T012758   # specific runs
pnpm study:mix --all                                     # every native run (skips mix-* dirs)

pnpm study:aggregate --run mix-<stamp>    # then aggregate the mix as usual
pnpm study:report    --run mix-<stamp>
```

Die Zusammenführungseinheit ist die **`generationId`** (die eindeutige `message.id` der API), *nicht* der Resume-Schlüssel — denn zwei Läufe desselben Modells erzeugen kollidierende Schlüssel, sodass ein naives Verketten-und-Deduplizieren die Überlappung stillschweigend verwerfen würde. Nach dem Poolen wird jede überlebende Antwort in einen frischen eindeutigen Schlüssel umnummeriert, sodass sich der Mix für `aggregate`, `browse` und `export` wie ein nativer Lauf verhält — mit **null nachgelagerten Änderungen**. Eine `mix.json`-Beidatei markiert das Verzeichnis und lockert das rechteckige Vollständigkeits-Gate (ein Mix ist per Design ungleichmäßig). Stimulusübergreifendes Mischen wird **gewarnt, nicht blockiert**.

</details>

---

## 🖥️ Der Web-Viewer

```bash
pnpm dev      # → http://localhost:3000
```

| Route | Was es ist |
|---|---|
| **[`/`](http://localhost:3000)** | Der Arena-Knotenpunkt — Karten für jedes Experiment, Live-Statistiken und ein „Überrasch mich“-Einstieg. |
| **[`/research`](http://localhost:3000/research)** | Die Berichtsseite — Kernkennzahlen, der interaktive Beziehungsgraph (über einen Knoten fahren, um seine Kanten hervorzuheben, über eine Kante fahren für genaue Wahrscheinlichkeiten, nach Sprache filtern) und Übersichtstabellen. |
| **[`/research/studio`](http://localhost:3000/research/studio)** | **Graph Studio** — Abstand / Knotengröße / Krümmung / Schwellenwert / Palette / Beschriftungen / Hintergrund live einstellen, ziehen, um Kanten umzuformen, Anbieter ausblenden, dann **PNG/SVG exportieren** (WYSIWYG; die exportierte Fußzeile trägt das ZenMux-Badge + die Repo-URL). **Dies ist der einzige Ort, an dem der Graph gerendert wird.** |
| **[`/research/browse`](http://localhost:3000/research/browse)** | Roh-Antwort-Browser — jede `records.jsonl`-Antwort, gruppiert nach Modell → Sprache, jede mit ihrer vollständigen Extraktionskennzeichnung gezeigt. Für ein `mix`-Verzeichnis ist jede Antwort mit ihrem Quelllauf markiert. |

> 📌 Der Beziehungsgraph (PNG/SVG) wird **nur aus dem Graph Studio gerendert und exportiert**, niemals aus der CLI. Die Pipeline stoppt bei `aggregate.json`; alles Visuelle wird aus dem Browser gesteuert.

---

## 🗂️ Projektstruktur

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
<summary><b>Architekturhinweise</b></summary>

<br/>

- **Zwei Hälften, eine Quelle der Wahrheit.** Die Pipeline (`research/*`, ausgeführt mit `tsx`) und der Viewer (`src/app/*`, Next.js 16 / React 19) teilen sich `research/lib/types.ts`.
- **Die Konfiguration ist pro Lauf fixiert.** Ein frisches `study:run` erstellt einen Schnappschuss von `config/study.yaml` im Lauf-Verzeichnis; Resume liest den *Schnappschuss*, sodass das Bearbeiten der Live-Konfiguration einen laufenden Lauf nie beschädigt.
- **Der Extraktor ist defensiv.** Ein separates Modell kennzeichnet jede Antwort; das Parsen versucht striktes JSON → erste balancierte `{…}` → als letztes Mittel einen Alias-Scan und normalisiert unerwartete Kennzeichnungen über `vendorFromText` oder fällt auf `unknown` zurück.
- **Anbieter-Taxonomie.** `research/lib/vendors.ts` ist die kanonische Registry, mit `aliases` (inkl. chinesischer Namen wie 通义千问 / 文心一言), die am längsten zuerst abgeglichen werden. Drei Pseudo-Anbieter — `self`, `unknown`, `refused` — sind analytische Kategorien, keine echten Hersteller.
- **Graph-Rendering ist webexklusiv.** `buildGraphSvg` baut das SVG von Hand; `/api/export` rastert es via `@resvg/resvg-js` zu PNG. Das Studio steuert sowohl die Live-Vorschau als auch den Export aus einer gemeinsamen `RenderConfig`, sodass der Export WYSIWYG ist.
- **Frontend-Stack.** Next.js 16 · React 19 · Tailwind v4 (CSS-first, kein `tailwind.config.js`) · shadcn/ui (`radix-nova`, Basis `neutral`, `lucide`-Icons). Die Studio-/Browse-Seiten sind RSC + `force-dynamic`, sodass frische Läufe beim Neuladen ohne Rebuild erscheinen.

</details>

---

## Ein neues Experiment hinzufügen

Die Arena ist auf Wachstum ausgelegt. Grob gesagt:

1. **Eine Konfiguration verfassen** — kopieren Sie `config/study.yaml`, geben Sie ihr eine **eindeutige `study.id`** (Lauf-Verzeichnisse sind `results/<study.id>/<stamp>/`) und legen Sie die Modelle, Sprachen, Wiederholungen, den Prompt und den Extraktor fest.
2. **Die Pipeline ausführen** — `pnpm study:run --config config/your-study.yaml` (dann `extract` / `aggregate` / `report`, jeweils mit `--config` und `--run latest`).
3. **Registrieren** — fügen Sie einen Eintrag zu [`src/lib/experiments.ts`](src/lib/experiments.ts) hinzu, damit es auf dem Knotenpunkt und in der Seitenleiste erscheint.

> ⚠️ Verwenden Sie nicht `pnpm study:test --config foo.yaml` — `study:test` verkettet drei Befehle mit `&&`, sodass das zusätzliche Flag nur den *letzten* erreicht. Verwenden Sie die schrittweisen Befehle mit einem expliziten `--config` bei jedem.

---

## 🤝 Mitwirken

Issues und PRs sind willkommen — neue Experimente, mehr Anbieter, Politur am Viewer oder Methodikkritik.

- Frontend-Änderungen (`src/app/**`, `src/components/**`) folgen den Konventionen in **[`CLAUDE.md`](CLAUDE.md)** (shadcn über die Registry, Tailwind v4, RSC-first).
- `pnpm lint` vor dem Öffnen eines PR.
- Die Forschungs-Pipeline (`research/**`) ist reines TypeScript ohne Test-Runner — `study:test` *ist* die Datenpipeline, keine Unit-Suite.

---

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="36">
</picture>

<br/><br/>

**Forschung von [thinkthinking](https://github.com/thinkthinking) · ermöglicht durch [ZenMux.ai](https://zenmux.ai)**

Alle Modellaufrufe laufen über die ZenMux Anthropic Messages API — ein Schlüssel, jeder Anbieter.

<sub>Mit <a href="https://nextjs.org">Next.js</a> aufgesetzt · siehe die ursprüngliche create-next-app-Dokumentation unter <a href="https://nextjs.org/docs">nextjs.org/docs</a>.</sub>

</div>
