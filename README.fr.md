<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="56">
</picture>

# ZenMux Arena

**Un laboratoire ouvert pour des expériences inter-fournisseurs sur les LLM de pointe.**
Une seule question, posée de multiples façons, à travers de nombreux modèles — mesurée, agrégée et visualisée.

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

<sub>L'étude phare — <b>« Who Are You? »</b> — rendue dans le Graph Studio intégré à l'application. Chaque flèche : un modèle du fournisseur <i>A</i> prétendant être le fournisseur <i>B</i>.</sub>

<br/>

<!-- README-I18N:START -->

[English](./README.md) | [简体中文](./README.zh-Hans.md) | [繁體中文](./README.zh-Hant.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Русский](./README.ru.md) | [Español](./README.es.md) | **Français** | [Deutsch](./README.de.md) | [Português](./README.pt.md)

<!-- README-I18N:END -->

</div>

---

## Qu'est-ce que c'est ?

**ZenMux Arena** est un banc d'essai de recherche **+** une visionneuse Next.js permettant d'exécuter la *même* sonde contre les modèles de pointe de nombreux fournisseurs et de transformer les réponses brutes en un graphe, des tableaux et un rapport de style arxiv.

Il est conçu comme un **hub pour une série croissante d'expériences**, et non comme une seule. Le registre partagé se trouve dans [`src/lib/experiments.ts`](src/lib/experiments.ts) ; chaque étude apparaît automatiquement sur la page d'accueil et dans la barre latérale. Aujourd'hui, l'Arena propose une étude **en direct** et réserve de la place pour d'autres :

| Étude | Question posée | Statut |
|---|---|---|
| 🫆 **[Who Are You?](#-en-vedette--who-are-you)** | *Quel fournisseur chaque modèle prétend-il être — en dix langues ?* | ✅ **En direct** |
| 🧭 *Plus d'expériences* | Sondes inter-fournisseurs sur le refus, la flagornerie, les dates de coupure des connaissances, la stabilité des personas… | 🔜 *Bientôt disponible* |

> Vous souhaitez ajouter votre propre sonde ? Voir **[Ajouter une nouvelle expérience](#ajouter-une-nouvelle-expérience)** — il s'agit d'une entrée de registre plus un fichier de configuration.

Chaque appel de modèle passe par **le point de terminaison Anthropic Messages de [ZenMux](https://zenmux.ai)** (`https://zenmux.ai/api/anthropic`) à l'aide du client officiel [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript), de sorte qu'une seule clé API atteint chaque fournisseur testé.

---

## 🫆 En vedette : "Who Are You?"

> **Confusion d'identité inter-fournisseurs chez les LLM de pointe**

Une étude systématique : traduire une seule question — **« Who are you? »** — en **10 langues**, l'interroger auprès des derniers modèles de chaque fournisseur **N fois chacun**, puis utiliser un modèle *extracteur* distinct pour étiqueter le **fournisseur que chaque réponse prétend être** (p. ex. un modèle Claude répondant *« I am Qwen »*). Nous agrégeons la confusion inter-fournisseurs en un graphe + rapport.

Le stimulus actuel est une **sonde de débranding / d'élicitation d'identité** : le corps de l'instruction est maintenu identique octet par octet dans les dix langues (seule la clause finale *« Respond in &lt;Language&gt;. »* varie), et il demande explicitement au modèle de mettre de côté tout persona de prompt système et de rapporter le modèle *sous-jacent*. Voir `config/study.yaml` au-dessus du bloc `languages:` pour la formulation exacte et la référence alternative de la question brute.

### Principaux résultats

D'après le dernier run mutualisé (`mix-20260601T062425`) : **27 modèles × 10 langues × 40 répétitions ≈ 29 700 réponses.**

| Métrique | Valeur | Signification |
|---|--:|---|
| 🟢 **Auto-identification** | **85.2%** | a répondu avec son *propre* fournisseur réel |
| 🔴 **Confusion inter-fournisseurs** | **7.1%** | a prétendu être un fournisseur *différent* |
| ⚪ **Inconnu** | **2.4%** | a répondu, mais sans donner d'identité |
| ⛔ **Refusé** | **5.3%** | a refusé de répondre |

**Quelques-unes des confusions les plus frappantes** *(modèle du fournisseur → fournisseur revendiqué)* :

```
tencent   → anthropic   29.2%   (321/1100)
z-ai      → google      25.0%   (275/1100)
kwai      → qwen        13.5%   (148/1100)
bytedance → openai       7.2%   (317/4400)
```

> Lisez le compte rendu complet dans le `report.md` généré, ou explorez-le de manière interactive à **[`/research`](#-la-visionneuse-web)**.

---

## ⚡ Démarrage rapide

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

Modifiez **[`config/study.yaml`](config/study.yaml)** pour choisir quels modèles, langues et nombre de répétitions tester. Chaque entrée de modèle associe un `id` de modèle ZenMux à son **`vendor` de référence** (l'un des ids canoniques dans [`research/lib/vendors.ts`](research/lib/vendors.ts) — 27 fournisseurs sont enregistrés) :

```yaml
models:
  - { id: "anthropic/claude-opus-4.8:anthropic", vendor: anthropic, label: "Claude Opus 4.8" }
  - { id: "qwen/qwen3.7-max:alibaba",            vendor: qwen,      label: "Qwen3.7 Max" }
  - { id: "openai/gpt-5.5:openai",               vendor: openai,    label: "GPT-5.5" }
  # ...
```

> L'`id` utilise l'id de modèle complet de ZenMux **y compris** le suffixe de routage `:provider` (`:anthropic` / `:openai` / `:alibaba`…). Le `vendor` est le créateur *réel* du modèle — il est comparé au fournisseur *revendiqué* par l'extracteur pour calculer le taux de confusion.

---

## 🔬 Comment fonctionne le pipeline

Le pipeline est **délibérément découpé en étapes indépendantes** afin que vous puissiez inspecter les données avant de rédiger un rapport. Chaque étape lit le fichier de l'étape précédente :

```
config/study.yaml
  └─▶ records.jsonl       ask        model × lang × repeat  → raw answers
        └─▶ extractions.jsonl   extract    claimed vendor per answer (extractor model)
              └─▶ aggregate.json      aggregate  edges + per-cell distributions + summary
                    └─▶ report.md           report     arxiv-style write-up
                          ⋯ graph PNG/SVG    ← rendered on demand in the web Graph Studio
```

Chaque run réside dans son propre **répertoire horodaté** : `results/<study.id>/<stamp>/`.

| Commande | Ce qu'elle fait |
|---|---|
| `pnpm study:test` | **Étape 1** — ask → extract → aggregate, enchaînés avec une barrière de complétude |
| `pnpm study:report` | **Étape 2** — transforme `aggregate.json` en un `report.md` de style arxiv |
| `pnpm study:run` | Passe d'interrogation uniquement (rounds de nouvelle tentative automatiques + reprise) |
| `pnpm study:extract` | Passe d'extraction d'identité uniquement (nécessite des enregistrements complets) |
| `pnpm study:aggregate` | Jointure + synthèse uniquement (nécessite des enregistrements complets) |
| `pnpm study:mix` | Mutualise plusieurs runs en un seul résultat fusionné (**aucun appel API**) |

Lorsque l'agrégation se termine, elle imprime les chiffres principaux directement dans votre terminal :

```
[aggregate] selfRate=85.2% confusion=7.1% unknown=2.4% refused=5.3%
[aggregate]   tencent -> anthropic: 29.2% (321/1100)
[aggregate]   z-ai    -> google:    25.0% (275/1100)
```

<details>
<summary><b>Reprise, nouvelle tentative automatique &amp; la barrière de complétude</b></summary>

<br/>

**Reprenable par conception.** Tout est en JSONL, en ajout seul, et dédupliqué par la clé de reprise `model::lang::repeat`. Réexécuter ne remplit que ce qui manque.

- **Pas de `--run`** → crée un nouveau run horodaté.
- **`--run <stamp>`** → reprend ce run, en remplissant uniquement les requêtes manquantes/échouées.
- **`--run latest`** → reprend le run le plus récent.

```bash
pnpm study:run --run 20260601T053656      # top up an unfinished run
```

`study:run` possède une **boucle externe de rounds de nouvelle tentative** (`--max-rounds`, par défaut 5) par-dessus le backoff exponentiel par requête, de sorte que les échecs transitoires sont automatiquement réessayés.

**Barrière de complétude.** `study:extract` et `study:aggregate` refusent de s'exécuter tant que *chaque* cellule attendue `model × lang × repeat` ne possède pas un enregistrement réussi — ils sortent avec un code non nul, ce qui interrompt le `study:test` enchaîné avant qu'il ne puisse opérer sur des données partielles. Passez `--force` pour outrepasser.

</details>

<details>
<summary><b>Mutualiser des runs — regrouper des données échelonnées en un seul résultat</b></summary>

<br/>

Une étude est généralement recueillie par étapes (un grand run, un suivi qui ajoute un modèle, un complément qui ajoute des répétitions). `study:mix` mutualise plusieurs runs en **un seul résultat fusionné**. Il ne fait **aucun appel API** et **n'agrège pas** automatiquement.

```bash
pnpm study:mix --runs 20260531T175027,20260601T012758   # specific runs
pnpm study:mix --all                                     # every native run (skips mix-* dirs)

pnpm study:aggregate --run mix-<stamp>    # then aggregate the mix as usual
pnpm study:report    --run mix-<stamp>
```

L'unité de fusion est **`generationId`** (le `message.id` unique de l'API), et *non* la clé de reprise — car deux runs du même modèle produisent des clés en collision, de sorte qu'une concaténation-et-déduplication naïve écarterait silencieusement le chevauchement. Après la mutualisation, chaque réponse survivante est renumérotée en une nouvelle clé unique, de sorte que le mix se comporte comme un run natif pour `aggregate`, `browse` et `export` avec **zéro changement en aval**. Un fichier annexe `mix.json` marque le répertoire et assouplit la barrière de complétude rectangulaire (un mix est irrégulier par conception). La mutualisation inter-stimuli est **signalée par un avertissement, mais pas bloquée**.

</details>

---

## 🖥️ La visionneuse web

```bash
pnpm dev      # → http://localhost:3000
```

| Route | Ce que c'est |
|---|---|
| **[`/`](http://localhost:3000)** | Le hub de l'Arena — des cartes pour chaque expérience, des statistiques en direct, et un saut « surprenez-moi ». |
| **[`/research`](http://localhost:3000/research)** | La page de rapport — métriques principales, le graphe de relations interactif (survolez un nœud pour mettre en évidence ses arêtes, survolez une arête pour les probabilités exactes, filtrez par langue), et tableaux de synthèse. |
| **[`/research/studio`](http://localhost:3000/research/studio)** | **Graph Studio** — ajustez en direct l'espacement / la taille des nœuds / la courbure / le seuil / la palette / les étiquettes / l'arrière-plan, glissez pour remodeler les arêtes, masquez des fournisseurs, puis **exportez en PNG/SVG** (WYSIWYG ; le pied de page exporté porte le badge ZenMux + l'URL du dépôt). **C'est le seul endroit où le graphe est rendu.** |
| **[`/research/browse`](http://localhost:3000/research/browse)** | Navigateur de réponses brutes — chaque réponse de `records.jsonl` regroupée par modèle → langue, chacune affichée avec son étiquette d'extraction complète. Pour un répertoire `mix`, chaque réponse est étiquetée avec son run source. |

> 📌 Le graphe de relations (PNG/SVG) est **rendu et exporté uniquement depuis le Graph Studio**, jamais depuis la CLI. Le pipeline s'arrête à `aggregate.json` ; tout ce qui est visuel est piloté depuis le navigateur.

---

## 🗂️ Structure du projet

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
<summary><b>Notes d'architecture</b></summary>

<br/>

- **Deux moitiés, une seule source de vérité.** Le pipeline (`research/*`, exécuté avec `tsx`) et la visionneuse (`src/app/*`, Next.js 16 / React 19) partagent `research/lib/types.ts`.
- **La config est figée par run.** Un nouveau `study:run` prend un instantané de `config/study.yaml` dans le répertoire du run ; la reprise lit l'*instantané*, de sorte que modifier la config en direct ne corrompt jamais un run en cours.
- **L'extracteur est défensif.** Un modèle distinct étiquette chaque réponse ; l'analyse tente du JSON strict → le premier `{…}` équilibré → en dernier recours, un balayage d'alias, en normalisant les étiquettes inattendues via `vendorFromText` ou en se rabattant sur `unknown`.
- **Taxonomie des fournisseurs.** `research/lib/vendors.ts` est le registre canonique, avec des `aliases` (y compris des noms chinois comme 通义千问 / 文心一言) appariés du plus long au plus court. Trois pseudo-fournisseurs — `self`, `unknown`, `refused` — sont des catégories analytiques, et non de véritables créateurs.
- **Le rendu du graphe est exclusivement web.** `buildGraphSvg` construit le SVG à la main ; `/api/export` le rastérise en PNG via `@resvg/resvg-js`. Le studio pilote à la fois l'aperçu en direct et l'export à partir d'une même `RenderConfig` partagée, de sorte que l'export est WYSIWYG.
- **Pile frontend.** Next.js 16 · React 19 · Tailwind v4 (CSS-first, sans `tailwind.config.js`) · shadcn/ui (`radix-nova`, base `neutral`, icônes `lucide`). Les pages studio/browse sont RSC + `force-dynamic`, de sorte que les runs récents apparaissent au rechargement sans reconstruction.

</details>

---

## Ajouter une nouvelle expérience

L'Arena est conçue pour croître. En gros :

1. **Rédigez une config** — copiez `config/study.yaml`, donnez-lui un **`study.id` distinct** (les répertoires de run sont `results/<study.id>/<stamp>/`), et définissez les modèles, langues, répétitions, prompt et extracteur.
2. **Exécutez le pipeline** — `pnpm study:run --config config/your-study.yaml` (puis `extract` / `aggregate` / `report`, chacun avec `--config` et `--run latest`).
3. **Enregistrez-la** — ajoutez une entrée à [`src/lib/experiments.ts`](src/lib/experiments.ts) afin qu'elle apparaisse sur le hub et dans la barre latérale.

> ⚠️ N'utilisez pas `pnpm study:test --config foo.yaml` — `study:test` enchaîne trois commandes avec `&&`, de sorte que le drapeau supplémentaire n'atteint que la *dernière*. Utilisez les commandes étape par étape avec un `--config` explicite sur chacune.

---

## 🤝 Contribuer

Les issues et les PR sont les bienvenues — nouvelles expériences, plus de fournisseurs, peaufinage de la visionneuse, ou critiques méthodologiques.

- Les changements frontend (`src/app/**`, `src/components/**`) suivent les conventions de **[`CLAUDE.md`](CLAUDE.md)** (shadcn via le registre, Tailwind v4, RSC-first).
- `pnpm lint` avant d'ouvrir une PR.
- Le pipeline de recherche (`research/**`) est du TypeScript ordinaire sans test runner — `study:test` *est* le pipeline de données, pas une suite de tests unitaires.

---

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="36">
</picture>

<br/><br/>

**Recherche par [thinkthinking](https://github.com/thinkthinking) · propulsé par [ZenMux.ai](https://zenmux.ai)**

Tous les appels de modèle transitent par l'API Anthropic Messages de ZenMux — une clé, tous les fournisseurs.

<sub>Échafaudé avec <a href="https://nextjs.org">Next.js</a> · voir la documentation originale de create-next-app sur <a href="https://nextjs.org/docs">nextjs.org/docs</a>.</sub>

</div>
