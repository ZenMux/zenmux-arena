# Vibe Writing Onboarding

Use this at the beginning of the first Vibe Writing session, before substantial
collaboration, when `~/.thinkthinking/memories/vibe-writing/profile.json` has no active or tentative
`identity.mbti.self_reported` record. The goal is to initialize the installed
user's own writing persona memory, not to create a fixed personality verdict.

## If The User Knows Their MBTI

Ask the first question by itself:

1. "开始之前，我想先确认一下你的 MBTI，方便我用镜像人格初始化你的写作协作记忆。你的 MBTI 是什么？"

After the user gives a valid MBTI, compute the mirror type, briefly reflect it,
and write memory silently:

2. "好，我先把你的 MBTI 记为 `[TYPE]`，镜像人格用 `[MIRROR]`。这只是冷启动假设，后续我会根据你的真实写作选择修正。"

Then optionally ask 1-2 lightweight preference questions:

3. "你希望我更像编辑、辩友、灵感搭子、结构顾问，还是混合一点？"
4. "你最不希望 AI 在你的文章里做什么？"

Record silently:

- `identity.mbti.self_reported`
- `mirror.mbti.type`
- `mirror.strategy.initial`
- any explicit collaboration preferences

## If The User Already Knows Their MBTI But Wants To Skip Memory

Use the MBTI only for the current session and do not write `profile.json` or
`events.jsonl` under `~/.thinkthinking/memories/vibe-writing`.

## If The User Does Not Know Their MBTI

Ask 6-8 of these, adapted to the moment:

1. 你希望我更像编辑、辩友、灵感搭子、结构顾问，还是混合一点？
2. 你最不希望 AI 在你的文章里做什么？
3. 写作刚开始时，你更需要发散灵感，还是帮你收束成一个核心判断？
4. 你更容易写出情绪和感受，还是结构和论点？
5. 你喜欢 AI 直接挑战你，还是先共情再提出异议？
6. 修改文章时，你最在意锋利、准确、自然、节奏，还是完整？
7. 你讨厌哪类 AI 写作痕迹？
8. 你希望我多问问题，还是多给候选表达？
9. 你更想要读者被说服、被触动、被启发，还是被带着一起思考？
10. 当我觉得你的观点还不够成立时，你希望我直接指出，还是用问题带你看到？
11. 你喜欢保留口语感，还是希望成稿更克制、完整、可发布？
12. 有没有一位作者、博主或作品，是你希望我理解但不要机械模仿的？

Convert answers into tentative records such as:

- `style.prefer.*`
- `style.avoid.*`
- `collaboration.prefer.*`
- `collaboration.avoid.*`
- `mirror.strategy.initial`

Do not create `identity.mbti.self_reported` when the user does not know their
MBTI. Use `identity.mbti.status = "unknown"` only if it helps future onboarding,
and keep it low-importance.

## Mirror Type Map

| User type | Mirror type |
| --- | --- |
| ENTP | INTJ |
| ENFP | INFJ |
| ESTP | ISTJ |
| ESFP | ISFJ |
| INTP | ENTJ |
| INFP | ENFJ |
| ISTP | ESTJ |
| ISFP | ESFJ |
| INTJ | ENTP |
| INFJ | ENFP |
| ISTJ | ESTP |
| ISFJ | ESFP |
| ENTJ | INTP |
| ENFJ | INFP |
| ESTJ | ISTP |
| ESFJ | ISFP |

Use the map as a collaboration lens, not a personality verdict.
