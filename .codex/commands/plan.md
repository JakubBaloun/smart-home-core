---
description: Create implementation plan with research backing
---

# Implementation Plan: $ARGUMENTS

Produce a reviewable implementation plan. **No code is written by this command.**

## Protocol

### 1. Delegate to the architect

Launch the `architect` subagent with the request. It is the owner of this command's output —
it reads root `AGENTS.md`, `.codex/AGENTS.md` and the relevant existing module before
proposing anything, and returns the plan in a fixed structure.

Brief it properly: it does not see this conversation. Include the request verbatim, any
constraints already discussed, and anything already ruled out.

If the task genuinely has one obvious implementation (a typo, a single-line fix, a rename),
say so and skip the subagent — the plan would be overhead.

### 2. Fill gaps

If the plan needs current facts about an external library (FastAPI, SQLAlchemy, paho-mqtt,
influxdb-client, Zigbee2MQTT, React, Vite, Tailwind v4), launch the `researcher` subagent
rather than relying on training data.

### 3. Present

Present the architect's plan as-is. Expected shape:

- **Summary** — one paragraph
- **Affected areas** — `backend-python/app/<module>`, `frontend/src/modules/<module>`, infra
- **Approach** — concrete enough to implement without re-deciding architecture
- **Open questions** — genuine ambiguities, not guesses
- **Infra/production impact** — explicit yes/no
- **Test plan** — pytest against a real DB, Vitest for the frontend

### 4. Stop

Present the plan for approval and **stop**. Do not hand off to `be-dev`/`fe-dev` in the same
turn.

If the plan is marked **REQUIRES EXPLICIT APPROVAL** (it touches `docker-compose.yaml`, Flyway
migrations, env vars, `.github/workflows/`, or deployment), say so prominently. A push to
`main` deploys to production — there is no staging.
