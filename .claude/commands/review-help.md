---
description: Quick reference for the review and planning commands
---

# Review commands — quick reference

## Commands

### `/review-commit`
Quick review of the latest commit, or of staged changes if there are any. Use during active
development, before committing.

### `/review-pr`
Comprehensive review of the whole branch against `main`. Use before opening a PR.

### `/plan <feature>`
Reviewable implementation plan via the `architect` subagent. No code is written.

### `/research <topic>`
Compress what the codebase and specs already say about a topic. No code is written.

### `/review-help`
This message.

## Which subagents get launched

| Diff contains                    | Subagents |
| -------------------------------- | --------- |
| Backend only                     | `code-reviewer` |
| Frontend, no visual change       | `code-reviewer` |
| Frontend with visual change      | `code-reviewer` + `ux-reviewer` |

"Visual change" means `frontend/src/ui/`, `frontend/src/modules/**/components/`,
`frontend/src/modules/**/pages/`, `src/index.css`, or `src/app/`.

## Typical workflow

```
1. /research <topic>      — understand what already exists
2. /plan <feature>        — get an architect plan, approve it
3. implement              — be-dev / fe-dev
4. /review-commit         — quick feedback while iterating
5. /review-pr             — before opening the PR
```

## Focus areas

- **Correctness** — does it do what was asked
- **Parity invariants** — bool-before-numeric, availability ownership,
  `common/datetimes.py` types, explicit rule registration, camelCase wire format
- **Conventions** — `.claude/specs/backend-conventions.md`, `frontend-conventions.md`,
  `architecture-patterns.md`
- **Tests** — pytest against a real database (never mocked), Vitest with `fetch` stubbed
- **Security** — validation at the edge, no injection
- **Scope creep** — changes to `docker-compose.yaml`, Flyway migrations,
  `.github/workflows/`, or `backend/` that were not asked for

## Severity levels

- **Critical** — broken behaviour, parity break, security issue; blocks the commit/PR
- **High** — convention violation, missing test for new behaviour; fix before merge
- **Medium** — worth fixing, not blocking
- **Low** — style, nits

## Notes

- `backend/` (Quarkus) is a **read-only behavioural reference** — not built, not tested, not
  deployed. It is never reviewed as active code.
- A push to `main` deploys to production. There is no staging.
- Review commands never commit, push, or open PRs.

See `.claude/commands/README.md` for more.
