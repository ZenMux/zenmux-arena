# MBTI-style item banks for the LLM personality study — licensing & method survey

Research memo for the planned study: *do frontier LLMs differ in "MBTI personality type"?*
Everything below was verified against primary sources (official PDFs / license pages), not
secondary blog claims. Item banks live next to this file as JSON.

---

## 1. The headline constraint: the real MBTI is not usable

The **MBTI® is not an option**, at any price point that makes sense, and not at all if you
want an open repo:

- Copyright is held by the **Myers & Briggs Foundation**; **The Myers-Briggs Company** is the
  exclusive publisher. `MBTI`, `Myers-Briggs`, `Myers-Briggs Type Indicator`, `Step I` are
  registered trademarks.
- Form M (93 items) item text, answer choices and scoring keys are **proprietary and actively
  enforced**. You may not host, digitize, translate, or embed them.
- It is a **restricted assessment**: to administer it you must be a certified practitioner or
  hold a relevant Master's. Researchers are normally licensed to reprint only a **handful of
  sample items**, never the full instrument.
- Practical consequence: you could not publish your item bank, your prompts, or your repo.

**16Personalities is equally unusable**: it is the proprietary *NERIS Type Indicator®*
(NERIS Analytics Ltd.), all items copyrighted, republishing forbidden by their ToS. It is
also *not* the MBTI — it is Big Five wearing four-letter clothes, plus an
Assertive/Turbulent (-A/-T) fifth axis derived from Neuroticism.

What is **not** protected: the four dichotomies themselves and the 16 four-letter codes
(INTJ, ENFP...). Those descend from Jung's *Psychological Types* (1921, public domain).
So you can legitimately build a 16-type study — you just need your own/open items and must
avoid calling it "the MBTI".

> Naming guidance for the paper: say *"MBTI-style four-dichotomy typology"* or
> *"Jungian type dichotomies"*, and add a footnote that the study is unaffiliated with, and
> does not use, the MBTI® instrument.

---

## 2. The two viable open item banks

### Option A — OEJTS 1.2 (`oejts-1.2.json`) · closest to MBTI · ⚠️ NonCommercial

**Open Extended Jungian Type Scales 1.2**, Eric Jorgenson / Open Psychometrics.

- Purpose-built as an open-source MBTI analogue: outputs the four dichotomies and a
  4-letter type directly. No Big Five detour.
- **32 bipolar items**, 8 per dimension, 5-point semantic-differential scale
  (e.g. `makes lists 1—2—3—4—5 relies on memory`).
- Empirically developed: 278-item pool → screened on **25,568** participants who knew their
  own type, retained items that maximally discriminated along one dichotomy.
- Transparent published scoring (see §3).
- **License: CC BY-NC-SA 4.0** — verified in the official PDF *and* Appendix B of the
  development page. This is the catch:
  - **NonCommercial**: ZenMux is a commercial entity. A study published on a commercial
    product's site, used for marketing/brand purposes, is a genuine legal gray zone.
  - **ShareAlike**: derivatives (your translations, your prompt renderings) must be
    released under the same NC-SA terms, which is viral into your repo.
  - Author's own caveat, verbatim: *"The OEJTS come with no guarantees of reliability or
    accuracy of any kind."*

Note: the npm package `@openjung/core` (MIT) wraps OEJTS and has zh/ja/ko translations, but
(a) MIT-relicensing NC-SA items is legally dubious, and (b) I diffed it against the official
PDF — it **silently flips the poles** of several items (Q2, Q9, Q14, Q17, Q24, Q25, Q26...)
so it can use plain sums instead of signed equations. Do not trust it as a source of truth;
use the verified `oejts-1.2.json` here.

### Option B — IPIP Big-Five Factor Markers, 50-item (`ipip-bfm-50.json`) · truly free ✅

**International Personality Item Pool** (Goldberg / Oregon Research Institute).

- **License: public domain.** Verified verbatim at `ipip.ori.org/newPermission.htm`:
  > *"Because the IPIP has been placed in the public domain, permission has already been
  > automatically granted for any person to use IPIP items, scales, and inventories for any
  > purpose, commercial or non-commercial."*
  You may copy, edit, translate, and ship commercially. No fee, no permission, no
  ShareAlike virality. Citation is courtesy, not obligation.
- **50 items**, 10 per factor, 5-point Likert (Very Inaccurate → Very Accurate), with
  documented +/− keying. Verified: exactly 10 items per factor, keying intact.
- Measures Big Five (Extraversion, Agreeableness, Conscientiousness, Emotional Stability,
  Intellect/Imagination) — **including Neuroticism, which MBTI lacks entirely.**
- Scales up/down freely within the same public-domain family: **Mini-IPIP (20 items)** for a
  cheap version, **IPIP-NEO-120/300** for 30 facets, plus community translations
  (Chinese, Japanese, and others) at `ipip.ori.org/newItemTranslations.htm`.
- Big Five → four-letter mapping is empirically grounded (McCrae & Costa, 1989):
  E↔Extraversion `r≈.74`, N↔Openness `r≈.69–.72`, F↔Agreeableness `r≈.44`,
  J↔Conscientiousness `r≈.49`. Note the T/F and J/P links are only **moderate** — a
  Big-Five-derived type is a defensible proxy, not an identity.

### Also free, if you want a cheap third anchor

- **TIPI** (10 items, Gosling et al. 2003). Author's explicit statement: *"ANYONE CAN USE IT
  FOR ANY PURPOSE. NO NEED TO ASK ME FOR PERMISSION."* 20+ free translations. Very low
  internal consistency by design — fine as a convergence check, not a primary measure.
- **TRAIT** (8,000 scenario-based MC items, CC-BY 4.0, `mirlab/TRAIT` on HF). LLM-specific,
  built precisely to fix refusal + prompt-sensitivity; Big Five + Dark Triad, no 16 types.

### Licensing summary

| Instrument | Items | Output | License | Commercial | Human-comparable |
| --- | --- | --- | --- | --- | --- |
| MBTI® Form M | 93 | 16 types | proprietary, restricted | ❌ | ❌ can't publish |
| 16Personalities / NERIS | ~60 | 16 types +A/-T | proprietary | ❌ | ❌ |
| **OEJTS 1.2** | 32 | **16 types directly** | CC BY-NC-SA 4.0 | ⚠️ **NC** | ✅ |
| **IPIP-BFM-50** | 50 | Big Five (→ type) | **public domain** | ✅ | ✅ |
| Mini-IPIP | 20 | Big Five | public domain | ✅ | ✅ |
| TIPI | 10 | Big Five | free, any purpose | ✅ | ✅ |
| TRAIT | 8,000 | Big Five + SD-3 | CC-BY 4.0 | ✅ | ❌ LLM-only |

---

## 3. Verified scoring methods

### OEJTS 1.2 — official signed equations (transcribed from the PDF)

Each item answered 1–5. Four scores, each mathematically spanning exactly **8–40**
(I asserted this programmatically for all four — a good regression test for your implementation):

```text
IE = 30 − Q3 − Q7 − Q11 + Q15 − Q19 + Q23 + Q27 − Q31     > 24 → E, else I
SN = 12 + Q4 + Q8 + Q12 + Q16 + Q20 − Q24 − Q28 + Q32     > 24 → N, else S
FT = 30 − Q2 + Q6 + Q10 − Q14 − Q18 + Q22 − Q26 − Q30     > 24 → T, else F
JP = 18 + Q1 + Q5 − Q9 + Q13 − Q17 + Q21 − Q25 + Q29      > 24 → P, else J
```

The signs are **not** uniform per dimension — item poles were written in mixed orientation
on purpose (an anti-acquiescence design). This is exactly what `@openjung/core` broke.

**Report the continuous 8–40 score, not just the letter.** A model at IE=24.4 and one at
IE=39 both read "E" but are nothing alike, and threshold-straddling is the single biggest
source of fake instability in LLM type studies.

### IPIP-50 — keyed sum

Per factor: reverse `−`-keyed items as `6 − raw`, then sum the 10 items → **10–50**.
For a type letter, threshold at a **reference distribution**, not the scale midpoint:
use human norms if you want "is this model unusual for a person", or the cross-model median
if you want "how do models differ from each other". State which you chose — it changes every
letter.

---

## 4. What the literature says you must do (or your result is an artifact)

This is the part that decides whether the study is publishable or dismissible. Applying human
self-report inventories to LLMs has well-documented failure modes:

1. **Option-order / position bias — the killer.** Models favor the first or last option, and
   favor the token "A" over "B", independent of content. Swapping which pole is on the left
   can flip a profile from ENFP to ISTJ. **Mitigation: counterbalance every item — present it
   both as (left,right) and (right,left) and average.** This alone doubles cost and is
   non-negotiable.
2. **Prompt-format sensitivity.** Semantically identical rewordings swing scores materially.
   **Mitigation: 2–3 fixed prompt templates as an explicit factor; report between-template
   variance as a reliability statistic, don't hide it.**
3. **Neutral-midpoint / acquiescence collapse.** RLHF'd models pile onto "3" and onto
   agreement. Heston (2025) removed the neutral option and used a 4-point forced scale mapped
   back to 1,2,4,5. Effective, but document it as a deviation.
4. **Refusal.** Safety-tuned models answer *"As an AI I have no personality."* This is data,
   not an error — **log refusals as a first-class outcome and report refusal rate per model.**
   (Heston had to drop GPT-4 entirely for this. Your existing `refused` bucket concept in
   `research/lib/vendors.ts` is the right instinct.)
5. **Persona leakage.** A system prompt as bland as "You are a helpful assistant" rewrites the
   whole profile. **Use a fixed, minimal, identical system prompt for every model, and publish
   it verbatim.**
6. **Temperature / seed drift.** Sample repeatedly at a fixed temperature; report per-cell
   variance. N=1 measures nothing.
7. **Construct validity — the honest framing.** An LLM has no introspective self. You are
   measuring *the persona its training and alignment produce when asked to self-describe*.
   Also expect the Big Five factor structure to partially collapse (inter-trait `r ≥ .90`) on
   LLM data, and dichotomization to destroy information (McCrae & Costa's core critique;
   they also found **no interaction effects** between letters — an INTJ is just I+N+T+J).

**Prior art to position against**: Heston (2025) ran exactly OEJTS + IPIP on 4 models,
**15 administrations each** (n=60 per instrument, powered a priori via G*Power for MANOVA at
medium effect size), 4-point forced scale, and found Claude 3 Opus INTJ 15/15, ChatGPT-3.5
ENTJ 7/15, Gemini/Grok INFJ. That is your baseline to extend — more models, more languages,
and crucially the **order-counterbalancing they did not do**.

---

## 5. Recommended design for your study

**Instrument: use both, IPIP-50 as primary, OEJTS as the typological layer.**

- IPIP-50 is the **publishable, commercially safe, human-comparable** backbone, and it covers
  Neuroticism so you get a real trait profile plus convergent validity.
- OEJTS gives the headline "claude-opus-5 is an INTJ" that makes the study legible — and its
  32 items are cheap.
- Two instruments measuring overlapping constructs = **convergent validity**, the strongest
  rigor-per-dollar move available. Agreement between them is itself a finding.
- ⚠️ **Decide the OEJTS NC question deliberately.** Options: (a) run IPIP-50 only and derive
  types via the Big-Five mapping — fully commercial-safe; (b) include OEJTS but keep the
  NC-SA items out of the commercially-operated product surface, attribute clearly, and mark
  that portion CC BY-NC-SA; (c) email Open Psychometrics for permission. If the study will
  live on a ZenMux-branded page, I'd lean (a) for the shipped artifact and treat OEJTS as a
  secondary, clearly-licensed appendix.

**Cost control** — the honest budget math. Cost scales as
`models × items × languages × orders × templates × repeats`, which explodes fast. Prune in
this order:

1. **Batch items, don't loop them.** One request carrying all 32 (or 50) items, answered as a
   JSON array, instead of one request per item. ~30–50× fewer calls. This is the single
   biggest lever and costs you almost nothing methodologically (note it as within-context
   administration, same as a human seeing a full paper form).
2. **Keep order-counterbalancing (×2). Don't cut this** — it's the difference between a
   finding and an artifact.
3. **Repeats: 15 per cell** matches the published power analysis. Start there.
4. **Languages: start with 2 (en + zh), not 10.** Your identity study needed 10 because the
   question *was* linguistic; here language is a moderator, and you can add more later since
   the pipeline resumes. Cross-language type stability is a great second paper.
5. **Templates: 2**, not 5.
6. Skip logprob analysis — most ZenMux endpoints won't expose it; repeated sampling is the
   practical substitute.

Rough shape: `20 models × 2 instruments × 2 orders × 2 templates × 2 langs × 15 repeats`
≈ **4,800 requests** of ~1–2k output tokens. Very manageable, and it degrades gracefully:
drop to 1 language / 1 template for a pilot (~1,200 requests) before committing.

**Reuse your existing harness.** This maps almost 1:1 onto the `who-are-you` pipeline —
`records.jsonl → extractions.jsonl → aggregate.json`, resume key
`model::lang::repeat` extended to `model::instrument::order::template::lang::repeat`,
completeness gate, and the same "extractor model parses the answer defensively" trick for
turning prose into item scores. Preserve the `ask`/`extract`-never-throws invariant and the
refusal bucket.

**Report, at minimum**: continuous scores with 95% CIs per model; type modal + frequency
(e.g. "INTJ 15/15"); refusal rate; order-flip disagreement rate; between-template variance;
OEJTS-vs-IPIP agreement. A model whose type is unstable across orders is a *result*, not a
failed measurement — arguably the most interesting one.

---

## 6. Files here

| File | Contents |
| --- | --- |
| `oejts-1.2.json` | 32 items verbatim from the official PDF, dimensions, official signed scoring equations, license metadata |
| `ipip-bfm-50.json` | 50 items with factor + keying, response scale, stem, scoring rule, public-domain notice |

Both were transcribed from primary sources and machine-checked (OEJTS: all four equations
span exactly 8–40; IPIP: exactly 10 items per factor with keying preserved).

## Sources

- OEJTS 1.2 instrument (items, license, scoring): <https://openpsychometrics.org/tests/OJTS/development/OEJTS1.2.pdf>
- OEJTS development + license Appendix B: <https://openpsychometrics.org/tests/OEJTS/development/>
- IPIP permission (public domain): <https://ipip.ori.org/newPermission.htm>
- IPIP-50 items + administration guidance: <https://ipip.ori.org/new_ipip-50-item-scale.htm>
- IPIP translations: <https://ipip.ori.org/newItemTranslations.htm>
- MBTI permissions/trademarks: <https://www.myersbriggs.org/using-type-as-a-professional/mbti-permission-trademarks/>, <https://www.themyersbriggs.com/en-us/support/copyright-and-permissions>
- Heston (2025), *Do LLMs Have a Personality?* (OEJTS+IPIP on 4 models, n=15 each): <https://doi.org/10.1101/2025.03.14.25323987>
- Lee et al., NAACL 2025, *TRAIT*: <https://arxiv.org/abs/2406.14703>
- Jiang et al., NeurIPS 2023, *MPI / Evaluating and Inducing Personality in PLMs*: <https://arxiv.org/abs/2206.07550>
- Option-order sensitivity in MC questions: <https://arxiv.org/abs/2308.11483>
- McCrae & Costa (1989), MBTI reinterpreted via the FFM: <https://pubmed.ncbi.nlm.nih.gov/2709300/>
- TIPI (free for any purpose): <https://gosling.psy.utexas.edu/scales-weve-developed/ten-item-personality-measure-tipi/>
