# 如果 Token 会说话

Interactive Chinese research talk at `/talk`. Thirty scenes follow identity, the completed OEJTS study, then Token Economics:
“你是谁 → 你是什么性格 → 选择了谁”. The data-driven
charts remain interactive; the deck does not make new research/model calls.

## Presenting

- Open `/talk` in a desktop browser. A 1440 × 900 stage fits the available window.
- At 900px and below, each slide becomes a vertically scrollable reading page
  with a fixed touch pager. Wide charts scroll horizontally; chapter lists and
  model/question controls remain accessible without shrinking the whole slide.
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

The DeepSeek challenge replays the frozen 2026-06-23 through 2026-08-23
UTC window (inclusive dates), with no live fetch or polling during the talk.

The Value Map and Value Ladder use the existing parsing/computation code.
The listing is live per fetch; bounded launch-window usage uses the same 24-hour
Next Data Cache policy as Token Economics. The talk passes its fixed artifact
to `LiveLeaderboard`; the regular research page still polls as before. Deals'
feed and trend chart continue reading the shared-snapshot API. `to`, stale/degraded state, and
PAYG/subscription accounting are preserved. A successful fetch does not imply
fresh coverage. Method calculators are clearly labeled teaching examples.

OEJTS is pinned to `llm-mbti-oejts/20260911T040759`: 27 models, 432 valid
administrations, 22 stable profiles (13 INTJ, 9 ISTJ), and 5 without a stable type.
The 2026-09-17 reanalysis uses only a unique complete-type mode above half
(≥9/16); per-letter statistics are descriptive, not additional gates. The
original questionnaires and pinned study snapshots are unchanged.
`/talk#mbti-gallery` shows all 27 models with local MBTI illustrations, type
shares (count / 16, not confidence), and explicit unstable labels. The closing
MBTI scene includes prompt-perturbation/cache controls as unperformed follow-up work. Its loader discloses Azure Mistral and the
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
pnpm exec tsx --test src/app/talk/mbti/*.test.ts src/app/talk/mbti/*.test.tsx src/app/talk/economics/data/loader.test.ts src/app/talk/economics/history/history.test.tsx
pnpm build
```
