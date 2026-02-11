# Code Review for Pull Request

Please launch the code-review-mentor agent to perform a comprehensive code review of all changes in the current branch since it diverged from the main branch.

Focus on:
1. **Code Quality**: Design patterns, SOLID principles, code organization
2. **Security**: Potential vulnerabilities, data validation, authentication/authorization
3. **Best Practices**: Java/Quarkus conventions, reactive programming patterns, error handling
4. **Testing**: Test coverage, test quality, edge cases
5. **Performance**: Database queries, N+1 problems, reactive chain efficiency
6. **Documentation**: JavaDoc completeness, inline comments where needed
7. **Reactive Logging Pattern**: Logging must follow reactive principles (see `LOGGING_STRATEGY.md`)
   - **Service layer**: ALL logs MUST be inside `.invoke()` (lazy execution)
   - **Resource layer - Entry logs**: Can be outside (request already received) OR inside first `.invoke()` (for consistency)
   - **Resource layer - Exit logs**: MUST be inside `.invoke()` (to access actual results)
   - **When to log vs rely on tracing**:
     - ✅ Log: Business operations (ipaStartMatching, ipaManualMatch), simple CRUD (findById)
     - ❌ Don't log: Framework operations (findByCriteria, countByCriteria) - rely on `tracer.withSpan()`
   - **Why**: Reactive operations are lazy - logging outside executes at definition time, not execution time
   - **Correct Service**: `return repo.find(id).invoke(x -> Log.infof("Found: %s", x)).map(...)`
   - **Incorrect Service**: `Log.info("Finding..."); return repo.find(id).map(...)`
   - **See**: `LOGGING_STRATEGY.md` for full patterns and Jan Peremsky's philosophy
8. **Project-Specific Standards**:
   - Follows existing patterns in the codebase
   - Uses explicit imports (no wildcards, no fully qualified names in code)
   - YAML configuration format (no .properties files)
   - Proper Mutiny reactive patterns
   - Repository patterns (Domain vs Pure View)

After the review, provide:
- Summary of findings with severity levels (Critical/High/Medium/Low)
- Specific code locations with line numbers
- Recommended fixes with code examples where applicable
- Positive feedback on what was done well

Use the Task tool with subagent_type=code-review-mentor to perform this review.