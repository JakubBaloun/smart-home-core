---
description: Review uncommitted changes for issues
allowed-tools: Bash(git:*), Read, Grep, Glob
---

Review all uncommitted changes (both staged and unstaged) in the current repository.

Here are the current changes:

Staged diff:
!`git diff --cached`

Unstaged diff:
!`git diff`

Changed files:
!`git status --short`

For each changed file, review the full file context if needed to understand the changes.

Provide a structured review covering:

1. **Bugs & correctness** - type mismatches, wrong logic, null safety, missing error handling
2. **Conventions** - verify changes follow the project's CLAUDE.md conventions (annotations, naming, patterns)
3. **Database migrations** - if SQL migrations are changed, check column types match entity fields, verify indexes, check for missing trailing newline
4. **Missing pieces** - anything that should exist but doesn't (e.g., missing annotations, missing tests)

Format the review as:
- List each file with its issues (if any)
- Mark severity: **Critical** (will break), **Warning** (should fix), **Nit** (minor improvement)
- End with a short summary and whether changes are ready to commit
