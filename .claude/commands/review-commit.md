# Code Review for Current Commit

Please launch the code-review-mentor agent to review only the changes in the most recent commit or staged changes.

Focus on:
1. **Code Quality**: Design patterns, naming conventions, code organization
2. **Security**: Input validation, SQL injection risks, authentication issues
3. **Best Practices**: Java/Quarkus conventions, reactive programming
4. **Testing**: Test coverage for new/modified code
5. **Reactive Logging**: All logging in reactive code MUST be inside the chain (`.invoke()`, `.onItem()`, etc.)
   - **Why**: Reactive ops are lazy - logging outside executes at definition time, not execution time
   - **Correct**: `return uni.invoke(x -> Log.info("Value: " + x)).map(...)`
   - **Incorrect**: `Log.info("Getting value"); return uni.map(...)`
6. **Project Standards**:
   - Explicit imports (no wildcards)
   - YAML config format
   - Proper error handling with Mutiny
   - Repository pattern compliance

Provide:
- Quick summary of findings (Critical/High/Medium/Low severity)
- Specific line numbers and files
- Quick fix recommendations
- Acknowledgment of good practices

Use the Task tool with subagent_type=code-review-mentor for this review.