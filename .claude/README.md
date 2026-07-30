# Smart Home Core - Claude Code Structure

Production-grade `.claude` configuration for Smart Home Core development.

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Research = Compressing Truth** | `/research` command before complex tasks |
| **Planning = Mental Alignment** | `/plan` → `architect` subagent, reviewable before code |
| **Roles over Prompts** | One subagent per role in `agents/`, with scoped tool access |
| **Feature-Grouped Specs** | One spec per domain area, concise and actionable |
| **Spec-Backed Parity** | The Quarkus code in `backend/` is the behavioural reference |

## Structure

```
.claude/
├── CLAUDE.md                    # Project context for Claude Code (committed)
├── settings.json                # Team-shared: common permissions (committed)
├── settings.local.json          # Personal overrides (gitignored)
├── agents/                      # Subagent role definitions
│   ├── architect.md             # Plans non-trivial work; writes no code
│   ├── be-dev.md                # Implements in backend-python/
│   ├── fe-dev.md                # Implements in frontend/
│   ├── code-reviewer.md         # Independent review pass
│   ├── ux-reviewer.md           # Visual review against DESIGN.md
│   └── researcher.md            # External library/protocol facts
├── commands/
│   ├── research.md              # /research <topic>
│   ├── plan.md                  # /plan <feature>
│   ├── review-commit.md         # /review-commit
│   ├── review-pr.md             # /review-pr
│   └── review-help.md           # /review-help
├── skills/
│   └── codebase-research/       # Auto-invoked for complex tasks
├── specs/                       # Domain-specific patterns
│   ├── backend-conventions.md   # Python style, typing, docstrings, layout
│   ├── frontend-conventions.md  # Modules, tokens, routing, review checklist
│   ├── architecture-patterns.md # Sync architecture, sessions, wiring, parity
│   ├── mqtt-patterns.md         # paho-mqtt, Zigbee2MQTT integration
│   ├── testing-patterns.md      # pytest (backend) + Vitest (frontend)
│   └── git-workflow.md          # Commit format, PR rules
└── scripts/                     # Utility scripts
    └── statusline.sh            # Status line configuration
```

## Installation

The `.claude` folder is already set up in the project. For personal customization:

```bash
# Create personal settings override (optional)
cp .claude/settings.local.json.example .claude/settings.local.json
```

**Note:** `settings.local.json` is gitignored and personal.

### Plugins

Installed at user scope (not committed — install once per machine):

```bash
claude plugin install superpowers@claude-plugins-official

claude plugin marketplace add JuliusBrussee/caveman
claude plugin install caveman@caveman
```

## Subagents

| Agent | Model | When to use |
|-------|-------|-------------|
| `architect` | opus | Non-trivial or cross-module work, or anything touching compose/migrations/deploy — **before** any code |
| `be-dev` | sonnet | Implementing in `backend-python/` |
| `fe-dev` | sonnet | Implementing in `frontend/` |
| `code-reviewer` | opus | Independent review after non-trivial implementation |
| `ux-reviewer` | sonnet | After any frontend change with visual output |
| `researcher` | sonnet | Authoritative facts about external libraries |

Skip `architect` for typo fixes, one-line bug fixes, and tasks with one obvious
implementation — those go straight to `be-dev`/`fe-dev`.

## Commands

| Command | Purpose |
|---------|---------|
| `/research <topic>` | Research codebase patterns before implementation |
| `/plan <feature>` | Create architectural implementation plan via `architect` |
| `/review-commit` | Review the latest commit or staged changes |
| `/review-pr` | Review the whole branch against `main` |
| `/review-help` | Show code review commands help |

## Skills

| Skill | Trigger |
|-------|---------|
| `codebase-research` | Auto-invoked for multi-feature changes, unfamiliar code areas, or pattern questions |

## Specifications

Detailed patterns and conventions in `.claude/specs/`:

- **backend-conventions.md** - Python style, typing, docstrings, package layout, Flyway migrations
- **frontend-conventions.md** - Module structure, color tokens, `ModuleManifest`, kiosk isolation, review checklist
- **architecture-patterns.md** - Layering, SQLAlchemy sessions, startup wiring, parity contract
- **mqtt-patterns.md** - paho-mqtt integration, Zigbee2MQTT topics, device commands
- **testing-patterns.md** - pytest + testcontainers (backend), Vitest + Testing Library (frontend)
- **git-workflow.md** - Commit message format, branching strategy

`reactive-patterns.md` was deleted rather than translated — the Python port is deliberately
synchronous and had no Mutiny equivalent. `architecture-patterns.md` replaces it.

## Customization

### Add Permissions
Edit `.claude/settings.local.json`:
```json
{
  "permissions": {
    "allow": [
      "Bash(docker:*)",
      "Bash(pytest:*)"
    ]
  }
}
```

### Add Specs
Create `.claude/specs/{domain}-patterns.md` for new domain patterns.

### Add Commands
Create `.claude/commands/{name}.md` for custom commands.

### Add Subagents
Create `.claude/agents/{name}.md` with `name`, `description`, `tools` and `model` frontmatter.
Scope `tools` to the minimum the role needs.

## Quick Tips

- **Before complex tasks:** Use `/research` to understand existing patterns
- **For new features:** Use `/plan` to get an `architect` plan you can approve
- **Architecture questions:** Reference `.claude/specs/architecture-patterns.md`
- **MQTT integration:** Reference `.claude/specs/mqtt-patterns.md`
- **Writing tests:** Reference `.claude/specs/testing-patterns.md`
- **Frontend work:** Reference `.claude/specs/frontend-conventions.md` and `frontend/DESIGN.md`

## Tech Stack Quick Reference

- **Backend:** FastAPI + Pydantic v2, Python 3.12 (`backend-python/`)
- **Frontend:** React 19 + TypeScript + Vite + Tailwind v4 (`frontend/`)
- **Database:** PostgreSQL 17 + SQLAlchemy 2.0 (sync); Flyway owns the schema
- **Telemetry:** InfluxDB 2.x
- **Messaging:** MQTT (Mosquitto) + Zigbee2MQTT via paho-mqtt
- **Build:** pip / `pyproject.toml`; npm / Vite
- **Testing:** pytest + testcontainers; Vitest + Testing Library
- **Deployment:** Docker Compose on Raspberry Pi 5
