---
description: Research a topic before implementation (compress truth)
---

# Research Task: $ARGUMENTS

Before implementing, compress the truth about this topic by conducting thorough research.

## Research Protocol

### 1. Search Phase
Use the Explore agent to find all related code:
- Search for similar implementations
- Find related classes, interfaces, and patterns
- Identify affected services

### 2. Pattern Phase
Identify existing patterns and conventions:
- Check `.claude/specs/` for relevant patterns
- Look for similar features in other services
- Note any architectural constraints

### 3. Documentation Phase
Check existing documentation:
- `SERVICES.md` for service responsibilities
- `docs/` for detailed documentation
- Service-specific READMEs

### 4. Summary Phase
Produce a concise research report in this format:

---

## Research Summary: [topic]

### Existing Implementations
- `path/to/file.java:123` - Brief description of what it does

### Patterns Used
- Pattern name - Where used, why relevant

### Key Decisions
- Decision point - Rationale

### Affected Services
- Service name - How it's affected

### Recommended Approach
Based on research, suggest how to proceed with implementation.

### Open Questions
List any ambiguities that need user clarification.

---

**Important:** This is research only. Do not implement anything yet.