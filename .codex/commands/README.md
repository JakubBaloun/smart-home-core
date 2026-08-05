# Codex command templates

Slash commands for the Smart Home Core project. Each `.md` file in this directory is one
command, named after the file.

| Command                  | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `/research <topic>`      | Compress what the codebase and specs already say            |
| `/plan <feature>`        | Reviewable implementation plan via the `architect` subagent |
| `/review-commit`         | Review the latest commit or staged changes                  |
| `/review-pr`             | Review the whole branch against `main`                      |
| `/review-help`           | Quick reference for the above                               |

## How they work

The commands are thin: they establish scope and then delegate to the subagents in
`.codex/agents/`.

- `/plan` → `architect` (and `researcher` when external-library facts are needed)
- `/review-commit`, `/review-pr` → `code-reviewer`, plus `ux-reviewer` when the diff touches
  visual output
- `/research` → `Explore` for codebase search, `researcher` for external docs

Subagents do not see the main conversation, so the commands hand them the concrete file list
and the intent.

## What they will not do

- **Never commit, push, or open a PR.** Those happen only when explicitly asked.
- **Never treat `backend/` as active code.** The Quarkus source is a read-only behavioural
  reference — it is not built, tested or deployed.
- **Never implement from `/plan` or `/research` in the same turn.** Both stop at output.

## Customization

Edit the `.md` files here. Frontmatter is:

```markdown
---
description: shown in the slash-command list
---
```

`$ARGUMENTS` interpolates whatever the user typed after the command name.

New command = new `.md` file in this directory. Behaviour that belongs to a role rather than a
workflow step belongs in `.codex/agents/` instead; project facts and conventions belong in
`.codex/specs/`.
