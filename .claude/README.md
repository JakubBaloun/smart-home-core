# Smart Home Core - Claude Code Structure

Production-grade `.claude` configuration for Smart Home Core development.

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Research = Compressing Truth** | `/research` command before complex tasks |
| **Planning = Mental Alignment** | `/plan` command for reviewable implementation plans |
| **Feature-Grouped Specs** | One spec per domain area, concise and actionable |
| **Reactive-First Development** | Mutiny patterns, non-blocking I/O |

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
│   ├── coding-standards.md      # Java style, imports, JavaDoc
│   ├── reactive-patterns.md     # Mutiny, Uni/Multi patterns
│   ├── mqtt-patterns.md         # MQTT, Zigbee2MQTT integration
│   ├── testing-patterns.md      # Unit/integration test patterns
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

- **coding-standards.md** - Java imports, formatting, JavaDoc conventions, Flyway migrations
- **reactive-patterns.md** - Mutiny `Uni`/`Multi` patterns, reactive composition, error handling
- **mqtt-patterns.md** - MQTT broker integration, Zigbee2MQTT patterns, device communication
- **testing-patterns.md** - `@QuarkusTest`, REST Assured patterns, integration tests
- **git-workflow.md** - Commit message format, branching strategy

## Customization

### Add Permissions
Edit `.claude/settings.local.json`:
```json
{
  "permissions": {
    "allow": [
      "Bash(docker:*)",
      "Bash(./mvnw:*)"
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
- **Working with reactive code:** Reference `.claude/specs/reactive-patterns.md`
- **MQTT integration:** Reference `.claude/specs/mqtt-patterns.md`
- **Writing tests:** Reference `.claude/specs/testing-patterns.md`

## Tech Stack Quick Reference

- **Framework:** Quarkus 3.30.x (reactive stack)
- **Language:** Java 25
- **Database:** PostgreSQL 17 + Hibernate Reactive
- **Messaging:** MQTT (Mosquitto) + Zigbee2MQTT
- **Build:** Maven wrapper (`./mvnw`)
- **Testing:** JUnit 5 + REST Assured
- **Deployment:** Docker Compose on Raspberry Pi 5
