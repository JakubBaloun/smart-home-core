# Git Workflow

> Git and PR rules for Smart Home Core development.

## Critical Rules

- **NEVER create pull requests** - Only prepare code changes
- **NEVER run git push commands** - Only commit locally when explicitly asked
- **ONLY commit when explicitly asked** - Do not commit unless user requests

## Commit Message Format

Use conventional commits format for clear, structured commit history.

**Format:** `type(scope): description`

**Examples:**
```
feat(device): add REST API endpoints for device management
fix(mqtt): handle reconnection on broker disconnect
docs(readme): update installation instructions
refactor(device): extract mapper to separate class
test(device): add integration tests for update endpoint
chore(deps): upgrade Quarkus to 3.30.1
```

## Types

| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes nor adds features |
| `test` | Adding/fixing tests |
| `chore` | Build, tooling, dependencies |
| `perf` | Performance improvements |

## Scope (Optional)

Common scopes for this project:

- `device` - Device management feature
- `telemetry` - Telemetry/sensor data feature
- `automation` - Automation/rules feature
- `mqtt` - MQTT integration
- `zigbee` - Zigbee2MQTT integration
- `db` - Database migrations, repository changes
- `api` - REST API changes
- `config` - Configuration changes
- `docker` - Docker/deployment changes
- `ci` - GitHub Actions, CI/CD

## Branch Strategy

- `main` - Production-ready code
- `feat/*` - Feature branches (e.g., `feat/device-api`)
- `fix/*` - Bug fix branches (e.g., `fix/mqtt-reconnect`)
- `chore/*` - Maintenance branches (e.g., `chore/upgrade-deps`)

## Pull Request Guidelines

When creating PRs (via `gh pr create`):

1. **Title:** Use same format as commit messages
2. **Description:** Include:
   - **Summary:** What changes were made
   - **Why:** Motivation for the changes
   - **Test plan:** How to verify the changes
3. **Keep PRs focused:** One feature/fix per PR
4. **Link issues:** Reference related GitHub issues if applicable

## Co-authoring

All commits should include Claude Code co-authorship:

```
feat(device): add device listing endpoint

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

This is automatically handled by Claude Code's commit workflow.
