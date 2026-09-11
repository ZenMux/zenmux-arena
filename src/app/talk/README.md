# 如果 Token 会说话

Interactive Chinese research talk at `/talk`. Thirty scenes follow the identity
article, Token Economics article, and the completed OEJTS study. The data-driven
charts remain interactive; the deck does not make new research/model calls.

## Presenting

- Open `/talk` in a desktop browser. A 1440 × 900 stage fits the available window.
- Arrow keys, Space, PageUp/PageDown navigate; Home/End go to first/last scene.
- G opens the outline, F toggles fullscreen, N opens speaker notes, ? opens help.
- Notes are visible in the projected page. They are not a private presenter window.
- Every scene has a stable URL hash, e.g. `/talk#identity-graph`, `/talk#live`,
  `/talk#mbti-explorer`. Browser back/forward works.
- Revisiting a scene keeps controls through React Activity; hidden live scenes
  pause effects. Online slides have explicit loading, retry and source states.

## Sources and boundaries

Identity is pinned to `who-are-you/mix-20260601T062425` (29,700 answers).
The prompt-family and language comparisons retain source metadata; the
unbranded instructions were English with a target response language.
The count/degree scene follows the article: counts include all cross-identity
answers; degree counts only canonical vendor nodes, excluding `other:*` targets.
The existing `RelationshipGraph` is rendered directly.

The Value Map and Value Ladder use the existing parsing/computation code.
The listing is live per fetch; bounded launch-window usage uses the same 24-hour
Next Data Cache policy as Token Economics. `LiveLeaderboard` and Deals' feed and
trend chart read existing shared-snapshot APIs. `to`, stale/degraded state, and
PAYG/subscription accounting are preserved. A successful fetch does not imply
fresh coverage. Method calculators are clearly labeled teaching examples.

OEJTS is pinned to `llm-mbti-oejts/20260911T040759`: 27 models, 432 valid
administrations, 12 stable profiles. Its loader discloses Azure Mistral and the
8192/16384/50000 output budgets. The score/distribution tests re-score every
questionnaire. Original OEJTS 1.2 attribution and CC BY-NC-SA 4.0 remain visible.

The title and slow, evidence-led chapter pacing acknowledge CCTV's
《如果国宝会说话》. Original narration is in `story.ts`; no program audio is used.

## Implementation

`TalkPlayer.tsx` owns hash navigation, fullscreen, keyboard isolation, notes and
per-scene boundaries. `story.ts` contains headings, source links and speaker
notes. Chapter panels are dynamically imported, and no billing/listing work
runs while building or displaying the cover. KaTeX renders local math fonts and
semantic MathML. Animation uses browser transform/opacity and honors reduced
motion; this is an interactive web presentation, not a Remotion video export.

Shared economics charts have optional `presentation` props; defaults retain the
existing research pages. The stage is isolated from normal product layouts.

Validation:

```sh
pnpm lint
pnpm exec tsc --noEmit
pnpm exec tsx --test src/app/talk/mbti/data.test.ts src/app/talk/economics/data/loader.test.ts
pnpm build
```
