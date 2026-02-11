---
description: Create implementation plan with research backing
---

# Implementation Plan: $ARGUMENTS

Create a detailed implementation plan suitable for architectural review.

## Planning Protocol

### 1. Research First
Before planning, mentally run `/research $ARGUMENTS`:
- Understand existing patterns
- Identify affected files and services
- Note architectural constraints

### 2. Identify Scope
List all affected components:
- Services to modify
- Files to create/edit
- Tests to add

### 3. Break Into Steps
Create numbered implementation steps:
- Each step should be independently testable
- Order by dependencies
- Estimate complexity (simple/medium/complex)

### 4. Risk Assessment
Identify potential issues:
- Breaking changes
- Performance implications
- Security considerations

### 5. Output Format

---

## Plan: [feature/task name]

### Summary
1-2 sentence overview of what will be implemented.

### Affected Services
- [ ] Service name - What changes

### Implementation Steps

1. **Step name** (complexity)
   - File: `path/to/file.java`
   - Changes: What to modify
   - Tests: What to test

2. **Next step** (complexity)
   ...

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Risk description | How to address |

### Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Open Questions
Questions for the user before proceeding.

---

**Note:** Present this plan for approval before implementation.