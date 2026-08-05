---
description: Code review of the latest commit or staged changes
---

# Code Review: current commit

Review only the changes in the most recent commit, or the staged changes if there are any.

## Protocol

### 1. Establish the diff

```bash
git diff --cached --stat        # staged, if non-empty this is the scope
git diff HEAD~1 --stat          # otherwise the last commit
```

State which scope you picked before reviewing.

### 2. Delegate

- **Always** launch the `code-reviewer` subagent with the diff scope. It covers backend and
  frontend alike.
- **Additionally**, if the diff touches visual output — anything under `frontend/src/ui/`,
  `frontend/src/modules/**/components/`, `frontend/src/modules/**/pages/`, `src/index.css`,
  or `src/app/` — launch the `ux-reviewer` subagent in parallel.
- If the diff is backend-only, do not launch `ux-reviewer`.

Give each subagent the concrete file list; they do not see this conversation.

### 3. Report

Merge both reports into one:

| Severity | Meaning |
| -------- | ------- |
| Critical | Broken behaviour, parity break, security issue — fix before committing |
| High     | Convention violation, missing test for new behaviour |
| Medium   | Worth fixing, not blocking |
| Low      | Style, nits |

Every finding needs `file:line`. Note what was done well, briefly.

## Project-specific things that must be checked

These come from real bugs in this repo — see root `AGENTS.md` "Critical invariants":

- `isinstance(x, bool)` checked **before** the numeric branch in telemetry and rule code
- `device.available` / `last_seen` written only by the availability consumer
- Datetime fields use the annotated types from `app/common/datetimes.py`, never bare `datetime`
- New automation rules added to the explicit list in `automation/registry.py`
- Pydantic schema fields stay **camelCase** on the wire
- New tests run against a real database (testcontainers / `TEST_DB_URL`), never a mock
- No hardcoded colors outside the `[data-theme]` blocks in `frontend/src/index.css`

**Scope creep is the highest-value check.** Flag any change to `docker-compose.yaml`, Flyway
migrations, `.github/workflows/`, or `backend/` that was not explicitly requested.

`backend/` (Quarkus) is a read-only behavioural reference — it is not built, tested or
deployed. Do not review it as active code, and do not suggest changes to it.
