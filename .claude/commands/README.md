# Claude Code Custom Commands

This directory contains custom slash commands for the EWallet project.

## Code Review Commands

### `/review-pr`
**Use before submitting a PR to Azure DevOps**

Performs a comprehensive code review of all changes in your current branch since it diverged from main. This is the command you should run before creating a pull request.

**When to use:**
- Before creating a PR in Azure DevOps
- After completing a feature or story
- When you want a thorough review of all your changes

**What it checks:**
- Code quality and design patterns
- Security vulnerabilities
- Best practices and conventions
- Test coverage and quality
- Performance issues
- Documentation completeness
- Project-specific standards (imports, config format, reactive patterns, etc.)

**Example usage:**
```
/review-pr
```

---

### `/review-commit`
**Quick review of recent changes**

Reviews only the most recent commit or staged changes. Use this for quick feedback during development.

**When to use:**
- After completing a logical chunk of code
- Before committing changes
- For quick sanity checks during development

**What it checks:**
- Same areas as `/review-pr` but focused on recent changes only
- Faster turnaround for incremental development

**Example usage:**
```
/review-commit
```

---

## How It Works

These commands use Claude Code's built-in `code-review-mentor` agent, which:
- Automatically detects changes using `git diff`
- Analyzes code for quality, security, and best practices
- Provides specific feedback with line numbers
- Suggests concrete improvements

## Tips

1. **Run `/review-pr` before every PR submission** - Catch issues early before team review
2. **Use `/review-commit` frequently** - Get feedback as you code, not just at the end
3. **Address Critical and High severity issues** - These should be fixed before PR submission
4. **Consider Medium/Low issues** - Evaluate based on time and project priorities

## Project-Specific Standards Checked

- ✅ **Explicit imports** (no wildcards, no fully qualified class names in code)
- ✅ **YAML configuration format** (no .properties files)
- ✅ **Proper Mutiny reactive programming patterns**
- ✅ **Reactive logging pattern** - All logging in reactive code MUST be inside the reactive chain
  - Reactive operations are lazy (execute only when subscribed)
  - Logging outside the chain executes at definition time, not execution time
  - ✅ Correct: `return repo.find(id).invoke(x -> Log.infof("Found: %s", x)).map(...)`
  - ❌ Incorrect: `Log.info("Finding..."); return repo.find(id).map(...)`
- ✅ **Correct repository patterns** (Domain vs Pure View)
- ✅ **Hibernate Reactive session management**
- ✅ **Security annotations and role-based access control**
- ✅ **GraphQL API conventions**
- ✅ **Test structure and coverage**

## Customization

You can modify these commands by editing the `.md` files in this directory:
- `/Users/marcelv/EW/EWallet-alt/.claude/commands/review-pr.md`
- `/Users/marcelv/EW/EWallet-alt/.claude/commands/review-commit.md`