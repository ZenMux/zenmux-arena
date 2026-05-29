---
name: zenmux-codex-pets
description: >-
  Install bundled ZenMux Codex APP pets from this skill into the user's Codex
  pets directory. Use when the user asks to install, copy, enable, set up, or
  use ZenMux pets, Codex pets, Codex APP pets, pet.json pet folders, or the
  bundled pets under zenmux-codex-pets/pets. Trigger on "install ZenMux pets",
  "Codex pets", "安装 ZenMux pets", "安装 Codex 宠物", "复制 pets 到 .codex/pets".
---

# zenmux-codex-pets

Install bundled ZenMux Codex APP pets by copying each pet folder from this
skill's `pets/` directory into the user's Codex pets directory.

## Install Workflow

1. Resolve this skill's directory. The pet source is `pets/` next to this
   `SKILL.md`.
2. Install the bundled pets with the helper script:

   ```bash
   bash scripts/install-pets.sh
   ```

   Run the command from this skill directory, or pass the absolute script path
   if you are elsewhere.

3. Tell the user which pets were installed and where they were copied. The
   default target is `${CODEX_HOME:-$HOME/.codex}/pets`, which is usually
   `~/.codex/pets`.
4. Tell the user they can also install manually by copying every folder under
   this skill's `pets/` directory into `~/.codex/pets`, then using the pets in
   Codex APP.

## Helper Script

Use `scripts/install-pets.sh` for deterministic installation.

Useful options:

```bash
bash scripts/install-pets.sh --list
bash scripts/install-pets.sh --dry-run
bash scripts/install-pets.sh --target /tmp/codex-pets-test
```

The script skips `.DS_Store`, creates the target directory when needed, copies
each pet folder, and prints the installed pet names.

## Communication Guidelines

- Respond in the same language as the user.
- Keep the result concise: list installed pets, target directory, and the manual
  copy option.
- If no pet folders exist under `pets/`, stop and explain that there is nothing
  to install.
