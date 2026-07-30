---
description: Research a topic before implementation (compress truth)
---

# Research Task: $ARGUMENTS

Before implementing, compress the truth about this topic. **Research only — implement nothing.**

## Protocol

### 1. Search the codebase

Use the `Explore` subagent to find related code:

- Similar implementations in other feature modules
- The layers involved (`models` → `repository` → `service` → `router` on the backend;
  `api` → `components` → `pages` on the frontend)
- Every call site that would be affected

### 2. Check the specs

- `.claude/specs/backend-conventions.md` — Python style, typing, packages, config, Flyway
- `.claude/specs/architecture-patterns.md` — layering, sessions, wiring, parity contract
- `.claude/specs/frontend-conventions.md` — modules, tokens, routing, API layer
- `.claude/specs/mqtt-patterns.md` — paho-mqtt, Zigbee2MQTT topics, consumers, commands
- `.claude/specs/testing-patterns.md` — pytest + testcontainers, Vitest

Prefer an established pattern over a new one.

### 3. Check the documentation

- Root `CLAUDE.md` — tech stack, critical invariants, deployment
- `backend-python/README.md` — **the port's ambiguity log.** If the question is about
  intended behaviour, the answer may already be recorded here with its reasoning.
- `frontend/DESIGN.md` — the binding design system

### 4. Check the behavioural spec

If the question is about *intended behaviour* — status codes, error messages, JSON shapes,
edge cases — read the Quarkus source in `backend/src/main/java/io/smarthome/core/` and
replicate it. Do not infer from general REST convention. `backend/` is read-only: it is not
built, tested or deployed.

If the question is about *how to write Python or React*, `backend/` is irrelevant — use the
specs.

### 5. External libraries

For current facts about FastAPI, SQLAlchemy 2.0, paho-mqtt, influxdb-client, Zigbee2MQTT,
React, Vite or Tailwind v4, launch the `researcher` subagent instead of relying on training
data.

## Output

---

## Research Summary: [topic]

### Existing implementations
- `backend-python/app/device/service.py:123` — what it does

### Patterns in play
- Pattern — where used, why it applies here

### Constraints and invariants
- Anything from `CLAUDE.md` "Critical invariants" that this touches

### Affected modules
- Module — how it's affected

### Recommended approach
How to proceed, grounded in what was found.

### Open questions
Genuine ambiguities needing user input. Do not guess.

---

**This is research only. Do not implement anything yet.** For a full implementation plan,
follow up with `/plan`.
