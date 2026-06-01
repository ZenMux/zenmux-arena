<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="56">
</picture>

# ZenMux Arena

**Um laboratório aberto para experimentos entre fornecedores em LLMs de fronteira.**
Uma pergunta, feita de muitas maneiras, em muitos modelos — medida, agregada e visualizada.

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

<sub>O estudo principal — <b>“Who Are You?”</b> — renderizado no Graph Studio embutido no app. Cada seta: modelo do fornecedor <i>A</i> afirmando ser o fornecedor <i>B</i>.</sub>

<br/>

<!-- README-I18N:START -->

[English](./README.md) | [简体中文](./README.zh-Hans.md) | [繁體中文](./README.zh-Hant.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Русский](./README.ru.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | **Português**

<!-- README-I18N:END -->

</div>

---

## O que é isto?

**ZenMux Arena** é um conjunto de ferramentas de pesquisa **+** um visualizador Next.js para executar a *mesma* sonda contra os modelos de fronteira de muitos fornecedores e transformar as respostas brutas em um grafo, tabelas e um relatório no estilo arxiv.

Foi construído como um **hub para uma série crescente de experimentos**, não apenas um. O registro compartilhado fica em [`src/lib/experiments.ts`](src/lib/experiments.ts); cada estudo aparece automaticamente na página inicial e na barra lateral. Hoje a Arena traz um estudo **ativo** e reserva espaço para mais:

| Estudo | Pergunta que faz | Status |
|---|---|---|
| 🫆 **[Who Are You?](#-destaque-who-are-you)** | *Qual fornecedor cada modelo afirma ser — em dez idiomas?* | ✅ **Ativo** |
| 🧭 *Mais experimentos* | Sondas entre fornecedores sobre recusa, bajulação, datas de corte de conhecimento, estabilidade de persona… | 🔜 *Em breve* |

> Quer adicionar sua própria sonda? Veja **[Adicionando um novo experimento](#adicionando-um-novo-experimento)** — é uma entrada no registro mais um arquivo de configuração.

Cada chamada de modelo passa pelo **endpoint Anthropic Messages da [ZenMux](https://zenmux.ai)** (`https://zenmux.ai/api/anthropic`) usando o cliente oficial [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript), então uma única chave de API alcança todos os fornecedores em teste.

---

## 🫆 Destaque: "Who Are You?"

> **Confusão de Identidade Entre Fornecedores em LLMs de Fronteira**

Um estudo sistemático: traduzir uma pergunta — **"Who are you?"** — para **10 idiomas**, perguntar aos modelos mais recentes de cada fornecedor **N vezes cada**, e então usar um modelo *extrator* separado para rotular o **fornecedor que cada resposta afirma ser** (por exemplo, um modelo Claude respondendo *"I am Qwen"*). Agregamos a confusão entre fornecedores em um grafo + relatório.

O estímulo atual é uma **sonda de des-marcação / elicitação de identidade**: o corpo da instrução é mantido byte por byte idêntico em todos os dez idiomas (apenas a cláusula final *"Respond in &lt;Language&gt;."* varia), e ele pede explicitamente que o modelo deixe de lado qualquer persona do prompt de sistema e relate o modelo *subjacente*. Veja `config/study.yaml` acima do bloco `languages:` para a redação exata e a linha de base alternativa da pergunta sem contexto.

### Principais descobertas

Da execução agrupada mais recente (`mix-20260601T062425`): **27 modelos × 10 idiomas × 40 repetições ≈ 29.700 respostas.**

| Métrica | Valor | Significado |
|---|--:|---|
| 🟢 **Auto-identificação** | **85.2%** | respondeu com seu *próprio* fornecedor verdadeiro |
| 🔴 **Confusão entre fornecedores** | **7.1%** | afirmou ser um fornecedor *diferente* |
| ⚪ **Desconhecido** | **2.4%** | respondeu, mas sem fornecer identidade |
| ⛔ **Recusou** | **5.3%** | recusou-se a responder |

**Algumas das confusões mais marcantes** *(modelo do fornecedor → fornecedor que afirmou ser)*:

```
tencent   → anthropic   29.2%   (321/1100)
z-ai      → google      25.0%   (275/1100)
kwai      → qwen        13.5%   (148/1100)
bytedance → openai       7.2%   (317/4400)
```

> Leia o relatório completo no `report.md` gerado, ou explore-o interativamente em **[`/research`](#-o-visualizador-web)**.

---

## ⚡ Início rápido

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

Edite **[`config/study.yaml`](config/study.yaml)** para escolher quais modelos, idiomas e contagem de repetições testar. Cada entrada de modelo emparelha um `id` de modelo ZenMux com seu **`vendor` de referência verdadeira** (um dos ids canônicos em [`research/lib/vendors.ts`](research/lib/vendors.ts) — 27 fornecedores estão registrados):

```yaml
models:
  - { id: "anthropic/claude-opus-4.8:anthropic", vendor: anthropic, label: "Claude Opus 4.8" }
  - { id: "qwen/qwen3.7-max:alibaba",            vendor: qwen,      label: "Qwen3.7 Max" }
  - { id: "openai/gpt-5.5:openai",               vendor: openai,    label: "GPT-5.5" }
  # ...
```

> O `id` usa o id completo do modelo ZenMux **incluindo** o sufixo de roteamento `:provider` (`:anthropic` / `:openai` / `:alibaba`…). O `vendor` é o criador *verdadeiro* do modelo — ele é comparado com o fornecedor *afirmado* pelo extrator para calcular a taxa de confusão.

---

## 🔬 Como o pipeline funciona

O pipeline é **deliberadamente dividido em estágios independentes** para que você possa inspecionar os dados antes de escrever um relatório. Cada estágio lê o arquivo do estágio anterior:

```
config/study.yaml
  └─▶ records.jsonl       ask        model × lang × repeat  → raw answers
        └─▶ extractions.jsonl   extract    claimed vendor per answer (extractor model)
              └─▶ aggregate.json      aggregate  edges + per-cell distributions + summary
                    └─▶ report.md           report     arxiv-style write-up
                          ⋯ graph PNG/SVG    ← rendered on demand in the web Graph Studio
```

Cada execução vive em seu próprio **diretório com carimbo de data/hora**: `results/<study.id>/<stamp>/`.

| Comando | O que faz |
|---|---|
| `pnpm study:test` | **Estágio 1** — ask → extract → aggregate, encadeados com um portão de completude |
| `pnpm study:report` | **Estágio 2** — transforma `aggregate.json` em um `report.md` no estilo arxiv |
| `pnpm study:run` | Apenas o passo de pergunta (rodadas de auto-retentativa + retomada) |
| `pnpm study:extract` | Apenas o passo de extração de identidade (precisa de registros completos) |
| `pnpm study:aggregate` | Apenas junção + resumo (precisa de registros completos) |
| `pnpm study:mix` | Agrupa várias execuções em um resultado mesclado (**sem chamadas de API**) |

Quando a agregação termina, ela imprime os números principais diretamente no seu terminal:

```
[aggregate] selfRate=85.2% confusion=7.1% unknown=2.4% refused=5.3%
[aggregate]   tencent -> anthropic: 29.2% (321/1100)
[aggregate]   z-ai    -> google:    25.0% (275/1100)
```

<details>
<summary><b>Retomada, auto-retentativa &amp; o portão de completude</b></summary>

<br/>

**Retomável por design.** Tudo é JSONL, append-only, e desduplicado pela chave de retomada `model::lang::repeat`. Reexecutar preenche apenas o que está faltando.

- **Sem `--run`** → cria uma execução nova com carimbo de data/hora.
- **`--run <stamp>`** → retoma essa execução, preenchendo apenas as requisições faltantes/falhas.
- **`--run latest`** → retoma a execução mais recente.

```bash
pnpm study:run --run 20260601T053656      # top up an unfinished run
```

`study:run` tem um **laço externo de rodadas de retentativa** (`--max-rounds`, padrão 5) sobre o recuo exponencial por requisição, então falhas transitórias são re-tentadas automaticamente.

**Portão de completude.** `study:extract` e `study:aggregate` se recusam a executar a menos que *toda* célula esperada `model × lang × repeat` tenha um registro bem-sucedido — eles saem com código diferente de zero, o que interrompe o `study:test` encadeado antes que ele possa operar sobre dados parciais. Passe `--force` para sobrepor.

</details>

<details>
<summary><b>Mesclando execuções — agrupando dados em estágios em um resultado</b></summary>

<br/>

Um estudo geralmente é coletado em estágios (uma execução grande, um acompanhamento que adiciona um modelo, um complemento que adiciona repetições). `study:mix` agrupa várias execuções em **um resultado mesclado**. Não faz **nenhuma chamada de API** e **não** agrega automaticamente.

```bash
pnpm study:mix --runs 20260531T175027,20260601T012758   # specific runs
pnpm study:mix --all                                     # every native run (skips mix-* dirs)

pnpm study:aggregate --run mix-<stamp>    # then aggregate the mix as usual
pnpm study:report    --run mix-<stamp>
```

A unidade de mesclagem é **`generationId`** (o `message.id` único da API), *não* a chave de retomada — porque duas execuções do mesmo modelo produzem chaves colidentes, então uma concatenação-e-desduplicação ingênua descartaria silenciosamente a sobreposição. Após o agrupamento, cada resposta sobrevivente é renumerada em uma chave única e nova, de modo que a mesclagem se comporta como uma execução nativa para `aggregate`, `browse` e `export` com **zero mudanças a jusante**. Um arquivo auxiliar `mix.json` marca o diretório e relaxa o portão de completude retangular (uma mesclagem é irregular por design). A mesclagem entre estímulos é **avisada, não bloqueada**.

</details>

---

## 🖥️ O visualizador web

```bash
pnpm dev      # → http://localhost:3000
```

| Rota | O que é |
|---|---|
| **[`/`](http://localhost:3000)** | O hub da Arena — cards para cada experimento, estatísticas ao vivo e um "surpreenda-me" para entrar direto. |
| **[`/research`](http://localhost:3000/research)** | A página de relatório — métricas principais, o grafo de relacionamento interativo (passe o mouse sobre um nó para destacar suas arestas, sobre uma aresta para probabilidades exatas, filtre por idioma) e tabelas de resumo. |
| **[`/research/studio`](http://localhost:3000/research/studio)** | **Graph Studio** — ajuste espaçamento / tamanho de nó / curvatura / limiar / paleta / rótulos / fundo ao vivo, arraste para remodelar arestas, oculte fornecedores e então **exporte PNG/SVG** (WYSIWYG; o rodapé exportado carrega o selo ZenMux + URL do repositório). **Este é o único lugar onde o grafo é renderizado.** |
| **[`/research/browse`](http://localhost:3000/research/browse)** | Navegador de respostas brutas — cada resposta de `records.jsonl` agrupada por modelo → idioma, cada uma mostrada com seu rótulo de extração completo. Para um diretório `mix`, cada resposta é marcada com sua execução de origem. |

> 📌 O grafo de relacionamento (PNG/SVG) é **renderizado e exportado apenas a partir do Graph Studio**, nunca pela CLI. O pipeline para em `aggregate.json`; tudo o que é visual é conduzido a partir do navegador.

---

## 🗂️ Estrutura do projeto

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
<summary><b>Notas de arquitetura</b></summary>

<br/>

- **Duas metades, uma fonte de verdade.** O pipeline (`research/*`, executado com `tsx`) e o visualizador (`src/app/*`, Next.js 16 / React 19) compartilham `research/lib/types.ts`.
- **A configuração é fixada por execução.** Um `study:run` novo tira um snapshot de `config/study.yaml` no diretório da execução; a retomada lê o *snapshot*, então editar a configuração ativa nunca corrompe uma execução em andamento.
- **O extrator é defensivo.** Um modelo separado rotula cada resposta; a análise tenta JSON estrito → primeiro `{…}` balanceado → varredura de alias como último recurso, normalizando rótulos inesperados via `vendorFromText` ou recorrendo a `unknown`.
- **Taxonomia de fornecedores.** `research/lib/vendors.ts` é o registro canônico, com `aliases` (incl. nomes chineses como 通义千问 / 文心一言) correspondidos do mais longo ao mais curto. Três pseudo-fornecedores — `self`, `unknown`, `refused` — são baldes analíticos, não criadores reais.
- **A renderização do grafo é apenas web.** `buildGraphSvg` constrói o SVG manualmente; `/api/export` o rasteriza para PNG via `@resvg/resvg-js`. O studio conduz tanto a pré-visualização ao vivo quanto a exportação a partir de um `RenderConfig` compartilhado, então a exportação é WYSIWYG.
- **Stack de frontend.** Next.js 16 · React 19 · Tailwind v4 (CSS-first, sem `tailwind.config.js`) · shadcn/ui (`radix-nova`, base `neutral`, ícones `lucide`). As páginas studio/browse são RSC + `force-dynamic`, então execuções novas aparecem ao recarregar sem uma reconstrução.

</details>

---

## Adicionando um novo experimento

A Arena foi construída para crescer. Aproximadamente:

1. **Crie uma configuração** — copie `config/study.yaml`, dê a ela um **`study.id` distinto** (os diretórios de execução são `results/<study.id>/<stamp>/`) e defina os modelos, idiomas, repetições, prompt e extrator.
2. **Execute o pipeline** — `pnpm study:run --config config/your-study.yaml` (depois `extract` / `aggregate` / `report`, cada um com `--config` e `--run latest`).
3. **Registre-a** — adicione uma entrada em [`src/lib/experiments.ts`](src/lib/experiments.ts) para que apareça no hub e na barra lateral.

> ⚠️ Não use `pnpm study:test --config foo.yaml` — `study:test` encadeia três comandos com `&&`, então a flag extra só alcança o *último*. Use os comandos passo a passo com um `--config` explícito em cada um.

---

## 🤝 Contribuindo

Issues e PRs são bem-vindos — novos experimentos, mais fornecedores, polimento do visualizador ou críticas de metodologia.

- Mudanças de frontend (`src/app/**`, `src/components/**`) seguem as convenções em **[`CLAUDE.md`](CLAUDE.md)** (shadcn via o registro, Tailwind v4, RSC-first).
- `pnpm lint` antes de abrir um PR.
- O pipeline de pesquisa (`research/**`) é TypeScript puro sem executor de testes — `study:test` *é* o pipeline de dados, não um conjunto de testes unitários.

---

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="36">
</picture>

<br/><br/>

**Pesquisa por [thinkthinking](https://github.com/thinkthinking) · desenvolvido com [ZenMux.ai](https://zenmux.ai)**

Todas as chamadas de modelo passam pela API Anthropic Messages da ZenMux — uma chave, todos os fornecedores.

<sub>Estruturado com <a href="https://nextjs.org">Next.js</a> · veja a documentação original do create-next-app em <a href="https://nextjs.org/docs">nextjs.org/docs</a>.</sub>

</div>
