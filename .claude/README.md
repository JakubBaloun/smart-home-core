# Smart Home Core - Claude Code Structure

Production-grade `.claude` configuration for Smart Home Core development.

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Research = Compressing Truth** | `/research` command before complex tasks |
| **Planning = Mental Alignment** | `/plan` command for reviewable implementation plans |
| **Feature-Grouped Specs** | One spec per domain area, concise and actionable |
| **Spec-Backed Parity** | The Quarkus code in `backend/` is the behavioural reference |

## Structure

```
.claude/
├── CLAUDE.md                    # Project context for Claude Code (committed)
├── settings.json                # Team-shared: hooks + common permissions (committed)
├── settings.local.json          # Personal overrides (gitignored)
├── commands/
│   ├── research.md              # /research <topic>
│   ├── plan.md                  # /plan <feature>
│   ├── review-commit.md         # /review-commit <hash>
│   ├── review-pr.md             # /review-pr <PR-number>
│   └── review-help.md           # /review-help
├── skills/
│   └── codebase-research/       # Auto-invoked for complex tasks
├── specs/                       # Domain-specific patterns
│   ├── coding-standards.md      # Python style, typing, docstrings, layout
│   ├── architecture-patterns.md # Sync architecture, sessions, wiring, parity
│   ├── mqtt-patterns.md         # paho-mqtt, Zigbee2MQTT integration
│   ├── testing-patterns.md      # pytest patterns
│   └── git-workflow.md          # Commit format, PR rules
└── scripts/                     # Utility scripts
    └── statusline.sh            # Status line configuration
```

## Installation

The `.claude` folder is already set up in the project. For personal customization:

```bash
# Create personal settings override (optional)
cp .claude/settings.local.json.example .claude/settings.local.json

# Edit permissions, add hooks, etc.
vim .claude/settings.local.json
```

**Note:** `settings.local.json` is gitignored and personal.

## Commands

| Command | Purpose |
|---------|---------|
| `/research <topic>` | Research codebase patterns before implementation |
| `/plan <feature>` | Create architectural implementation plan |
| `/review-commit <hash>` | Review a specific commit |
| `/review-pr <PR-number>` | Review a pull request |
| `/review-help` | Show code review commands help |

## Skills

| Skill | Trigger |
|-------|---------|
| `codebase-research` | Auto-invoked for multi-feature changes, unfamiliar code areas, or pattern questions |

## Specifications

Detailed patterns and conventions in `.claude/specs/`:

- **coding-standards.md** - Python style, typing, docstrings, package layout, Flyway migrations
- **architecture-patterns.md** - Layering, SQLAlchemy sessions, startup wiring, parity contract
- **mqtt-patterns.md** - paho-mqtt integration, Zigbee2MQTT topics, device commands
- **testing-patterns.md** - pytest, testcontainers, TestClient, monkeypatch conventions
- **git-workflow.md** - Commit message format, branching strategy

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

## Quick Tips

- **Before complex tasks:** Use `/research` to understand existing patterns
- **For new features:** Use `/plan` to create reviewable implementation plan
- **Architecture questions:** Reference `.claude/specs/architecture-patterns.md`
- **MQTT integration:** Reference `.claude/specs/mqtt-patterns.md`
- **Writing tests:** Reference `.claude/specs/testing-patterns.md`

## Tech Stack Quick Reference

- **Framework:** FastAPI + Pydantic v2 (`backend-python/`)
- **Language:** Python 3.12
- **Database:** PostgreSQL 17 + SQLAlchemy 2.0 (sync); Flyway owns the schema
- **Messaging:** MQTT (Mosquitto) + Zigbee2MQTT via paho-mqtt
- **Build:** pip / `pyproject.toml`
- **Testing:** pytest + testcontainers
- **Deployment:** Docker Compose on Raspberry Pi 5
