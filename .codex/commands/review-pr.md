---
description: Comprehensive code review of the current branch against main
---

# Code Review: pull request

Comprehensive review of every change on the current branch since it diverged from `main`.
Run this before opening a PR.

## Protocol

### 1. Establish the diff

```bash
git diff main...HEAD --stat
git log main..HEAD --oneline
```

Review **all** commits on the branch, not just the most recent one.

### 2. Delegate

- **Always** launch the `code-reviewer` subagent over the full branch diff.
- **Additionally**, if the branch touches visual output — anything under `frontend/src/ui/`,
  `frontend/src/modules/**/components/`, `frontend/src/modules/**/pages/`, `src/index.css`,
  or `src/app/` — launch the `ux-reviewer` subagent in parallel.
- If the branch is backend-only, do not launch `ux-reviewer`.

Hand each subagent the concrete file list and the branch's intent; they do not see this
conversation.

### 3. Report

One merged report, severity-ordered, every finding with `file:line`:

| Severity | Meaning |
| -------- | ------- |
| Critical | Broken behaviour, parity break, security issue — blocks the PR |
| High     | Convention violation, missing test for new behaviour — fix before merge |
| Medium   | Worth fixing, not blocking |
| Low      | Style, nits |

Close with what was done well.

## Review areas

1. **Correctness** — does it do what the branch set out to do
2. **Parity invariants** — root `AGENTS.md` "Critical invariants": bool-before-numeric,
   availability ownership, `common/datetimes.py` types, explicit rule registration,
   camelCase wire format, `Decimal` as JSON number
3. **Conventions** — `.codex/specs/backend-conventions.md`,
   `.codex/specs/frontend-conventions.md`, `.codex/specs/architecture-patterns.md`
4. **Layering** — repositories take a `Session` and never open one; services own transactions;
   routers never import a repository; `mqtt/` and `automation/` call services
5. **Tests** — pytest against a real database (never mocked), Vitest with `fetch` stubbed at
   the edge; new behaviour actually covered
6. **Security** — input validated at the edge, no injection via raw SQL or shell
7. **Scope creep** — **the most important check.** Flag anything touching
   `docker-compose.yaml`, Flyway migrations, `.github/workflows/`, or `backend/` that the
   branch did not explicitly set out to change. A push to `main` deploys to production.

`backend/` (Quarkus) is a read-only behavioural reference — not built, not tested, not
deployed. Do not review it as active code.

Do not create the PR and do not push. This command reviews only.
