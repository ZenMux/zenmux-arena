# Identity research panels

The parent server page imports `loadIdentityTalkData` from `./data`; the client
player imports `IdentityPanel` from `./IdentityPanel`. Types are exported from
`./types`. Do not re-export the server loader through a client barrel.

```tsx
const data = loadIdentityTalkData(); // synchronous; await is also safe in an RSC
<IdentityPanel data={data} view="overview" />
```

Views: `method | overview | prompts | languages | graph | cases`.
The panel occupies **100% width × 570px**. It is designed for approximately
1300px of content within a 1440×900 slide; the parent owns heading/navigation.
There are no fetches or model calls from the client.

## Fixed research snapshot

- `who-are-you/mix-20260601T062425`: **29,700** answers, 27 models, 16 tested
  vendors, 10 languages; generated answers from **2026-05-30 17:53 UTC through
  2026-06-01 06:17 UTC**. This is historical research, not current model behavior.
- Self 25,310; cross-vendor 2,112; refused 1,574; unknown 704.
- Bare: `20260530T175319`, `20260601T012758`, `20260601T030822`;
  386 / 10,800 = **3.6%**.
- Probed: `20260531T175027`, `20260601T031851`;
  338 / 8,100 = **4.2%**.
- Unbranded: `20260601T053656`; 1,388 / 10,800 = **12.9%**.

The loader checks source contributions and prompts against `mix.json`, then
reconciles all four outcome counts. Rates are weighted by actual cell counts.
The immutable JSON imports avoid runtime path discovery and standalone tracing
of the full answer logs. Missing/inconsistent article data fails explicitly;
there is no silent `latest` substitution.

`evidence.json` contains 64 allowlisted original excerpts (54 for method controls,
plus selected cases/controls; overlap is deduplicated). Every excerpt retains its
original run, key, generation ID and timestamp. Responses over 900 characters
are explicitly marked as excerpts. No raw extractor output, usage or credentials
are serialized.

To regenerate the bounded sample, from the repo root:

```sh
node src/app/talk/identity/generate-evidence.mjs
```

This maintenance script reads the published local logs; the runtime loader only
imports the small output. Method repetition controls calculate a plan and do not
resample the study or trigger new calls. Method playback selects only cross-vendor
mistakes across all models and labels each excerpt with its actual model. Of the
30 language/family combinations, 27 offer two recorded mistakes each. Bare
Traditional Chinese and probed Simplified/Traditional Chinese have zero
cross-vendor answers in the source aggregates and show an explicit empty state.
The generator checks coverage against those aggregates; correct self-identification,
refusals and unknown identity never fill a method bucket. The other views retain
their full-study statistics and explicitly labeled case/control excerpts.

## Interpretation and integration notes

- The unbranded stimulus is an **English instruction requesting a target response
  language**. These groups were collected in stages, not a causal randomized trial.
- Prompt/KV cache reuses input computation. It must not be described as evidence
  of cached complete responses; response-cache behavior was not established.
- The graph directly renders the existing `RelationshipGraph`, with its native
  vendor visibility/focus controls and node clicks. All-language edge thickness
  follows the existing renderer's maximum per-language rate; side counts use the
  selected language. Rare discovered targets are initially hidden, still counted.
- Graph typography/cropping is scoped CSS adapting the existing square renderer
  to a slide. Include graph focus, labels, language changes and extreme vendor
  visibility states in the parent's final browser QA.
- Stable controls are derived from the snapshot's eight 100%-self models, not a
  claim of permanent or universal identity reliability.
- No permanent preview route is included.

## Validation performed

- Identity-scope ESLint.
- Runtime count/source reconciliation; 3.6/4.2/12.9 rates; eight stable controls;
  30 language/family selections; JSON serialization.
- Exact excerpt/prompt/provenance and extraction generation-ID joins checked
  against original logs.
- Browser checks at 1440×900: total/category switching, bare/unbranded recorded
  response reveal, prompt-family chart switching, language heatmap selection and
  self/cross metric switching, and live graph rendering.
- Full `/talk` interaction coverage and production build belong to parent QA.
