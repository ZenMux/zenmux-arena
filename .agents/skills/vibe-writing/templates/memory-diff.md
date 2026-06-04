# Memory Diff

Date:
Work:
Mode: internal audit unless the user asks to inspect memory

## Proposed Changes

| operation | key | old value | new value | evidence | confidence change | importance |
| --- | --- | --- | --- | --- | --- | --- |
| create | `style.avoid.example` | n/a | The author avoids... | `evt_...` | n/a -> 0.70 | 4 |
| reinforce | `collaboration.prefer.example` | seen_count: 1 | seen_count: 2 | `evt_...` | 0.70 -> 0.78 | 3 |

## Event To Append

```json
{"event_id":"evt_YYYYMMDD_001","timestamp":"YYYY-MM-DDTHH:MM:SS+08:00","work_id":"short-slug","user_input_summary":"","assistant_action_summary":"","user_response_summary":"","outcome":"accepted|partially_accepted|rejected|unclear","memory_candidates":[]}
```

## Apply Notes

- Apply supported memory changes silently by default. Do not ask the user whether to save routine writing memories.
- Write runtime memories only under `~/.thinkthinking/memories/vibe-writing`, not inside the installed skill directory.
- Use lower confidence for first-time personality/style hypotheses and raise confidence only after repeated evidence.
- Respect explicit user control: do not remember, inspect memory, update memory, and delete memory requests take priority.
- Do not store credentials, access tokens, private keys, or unrelated secrets.
- Prefer `weaken`, `archive`, or `supersede` when evidence conflicts with an older record.
