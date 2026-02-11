# Code Review Commands - Quick Reference

## Available Commands

### 📋 `/review-pr`
**Full PR review before Azure DevOps submission**
- Reviews all changes since branch diverged from main
- Comprehensive analysis of code quality, security, best practices
- Use this before creating any pull request

### ⚡ `/review-commit`
**Quick review of recent changes**
- Reviews only the latest commit or staged changes
- Faster feedback for iterative development
- Use this during active coding

### ❓ `/review-help`
**Show this help message**

---

## Typical Workflow

```
1. Make code changes
2. Run /review-commit for quick feedback
3. Address any issues
4. Commit your changes
5. Before creating PR: Run /review-pr
6. Address Critical/High severity issues
7. Create PR in Azure DevOps
```

## Review Focus Areas

- **Code Quality**: Design patterns, SOLID principles, organization
- **Security**: Vulnerabilities, validation, authentication
- **Best Practices**: Java/Quarkus conventions, reactive patterns
- **Testing**: Coverage, quality, edge cases
- **Performance**: Queries, reactive chains, N+1 problems
- **Documentation**: JavaDoc, comments
- **Reactive Logging**: Logging MUST be inside reactive chains (`.invoke()`)
  - ❌ Wrong: `Log.info("msg"); return uni.map(...)`
  - ✅ Right: `return uni.invoke(x -> Log.info("msg")).map(...)`
- **Project Standards**: Imports, config format, patterns

## Severity Levels

- 🔴 **Critical**: Must fix before PR (security, bugs, breaking changes)
- 🟠 **High**: Should fix before PR (quality issues, bad practices)
- 🟡 **Medium**: Consider fixing (improvements, minor issues)
- 🟢 **Low**: Nice to have (style, minor optimizations)

---

For more details, see: `.claude/commands/README.md`