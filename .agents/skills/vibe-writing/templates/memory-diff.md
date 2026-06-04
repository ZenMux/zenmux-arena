# Memory Diff

Date:
Work:
Decision: pending confirmation

## Proposed Changes

| operation | key | old value | new value | evidence | confidence change | importance | confirmation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| create | `style.avoid.example` | n/a | The author avoids... | `evt_...` | n/a -> 0.70 | 4 | required |
| reinforce | `collaboration.prefer.example` | seen_count: 1 | seen_count: 2 | `evt_...` | 0.70 -> 0.78 | 3 | not required |

## Event To Append

```json
{"event_id":"evt_YYYYMMDD_001","timestamp":"YYYY-MM-DDTHH:MM:SS+08:00","work_id":"short-slug","user_input_summary":"","assistant_action_summary":"","user_response_summary":"","outcome":"accepted|partially_accepted|rejected|unclear","memory_candidates":[]}
```

## Apply Notes

- Ask before applying high-impact memories: MBTI/type claims, long-term personality judgments, strong preferences, taboos, or private facts.
- Write runtime memories only under `~/.thinkthinking/memories/vibe-writing`, not inside the installed skill directory.
- For low-risk project context, append the event and update the profile record after briefly telling the user.
- Prefer `weaken`, `archive`, or `supersede` when evidence conflicts with an older record.
