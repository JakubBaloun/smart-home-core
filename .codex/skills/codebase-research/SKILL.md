---
name: codebase-research
description: Automatically researches relevant codebase patterns when implementing features. Activates for multi-service changes, unfamiliar code areas, or pattern-related questions. Does NOT activate for simple single-file edits.
---

# Codebase Research Skill

This skill automatically activates when detecting:
- Implementation requests affecting multiple features
- Changes in unfamiliar code areas
- Questions about architectural patterns
- Cross-cutting concerns (MQTT, event bus, automation rules, database access)

## Activation Criteria

**DO activate for:**
- "Implement feature X across multiple components"
- "Add capability similar to [existing feature]"
- "How does [pattern] work in this codebase?"
- Changes touching device + telemetry + mqtt together
- Changes spanning `backend-python/` and `frontend/` together
- MQTT integration, event-bus or automation-rule questions

**DO NOT activate for:**
- Simple bug fixes in one file
- Adding a single method
- Documentation updates
- Test additions for existing code

## Research Protocol

When activated, automatically:

### 1. Find Similar Implementations
Search for existing patterns that match the request:
- Use Grep to find related class names
- Check similar features in other domain packages
- Look for established conventions in existing code

### 2. Check Architecture Patterns
Reference pattern specs in `.codex/specs/`:
- `architecture-patterns.md` - Layering, sessions, wiring, Quarkus parity contract
- `mqtt-patterns.md` - paho-mqtt / Zigbee2MQTT integration patterns
- `testing-patterns.md` - pytest (backend) and Vitest (frontend) patterns
- `backend-conventions.md` - Python style, typing, package layout
- `frontend-conventions.md` - Modules, tokens, routing, API layer

### 3. Identify Affected Features
Determine which feature areas are affected:

Backend (`backend-python/app/`):
- Device management (`device/`)
- Telemetry pipeline (`telemetry/`)
- Recipes and tags (`recipe/`)
- Automation rules (`automation/`)
- MQTT integration (`mqtt/`)
- Common infrastructure (`common/`)

Frontend (`frontend/src/modules/`):
- `devices/`, `temperature/`, `recipes/` (including kiosk cook mode)

### 4. Summarize Before Proceeding
Provide a brief summary:
```
Research Summary:
- Found N similar implementations in [features]
- Relevant patterns: [list]
- Suggested approach: [brief]
```

## Integration with Commands

This skill complements:
- `/research` - Explicit, detailed research
- `/plan` - Implementation planning

The skill provides automatic, lightweight research.
The commands provide explicit, comprehensive research.

## Example Activation

**Good activation:**
- "Add MQTT consumer for telemetry data similar to device consumer"
- "Implement a repository for telemetry like the device repository"
- "How do we handle MQTT reconnection in this codebase?"
- "Add a new feature module to the frontend rail"

**Should NOT activate:**
- "Add getter for name field" (too simple)
- "Update README" (documentation only)
- "Fix typo in log message" (trivial change)
