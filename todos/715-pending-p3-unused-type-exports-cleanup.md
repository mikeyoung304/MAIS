---
status: pending
priority: p3
issue_id: '715'
tags: [code-review, cleanup, dead-code]
dependencies: []
---

# Unused Type Exports in Codebase

## Problem Statement

Code review identified several exported types that are not imported anywhere else in the codebase. These create noise and potential confusion.

## Evidence

Potentially unused exports found:

1. **HealthCheckResponse** - Defined but not imported
2. **SessionContext** - Exported but only used locally
3. Various internal interfaces exported unnecessarily

## Verification Needed

Before removing, verify with:

```bash
# Check if type is used anywhere
grep -r "HealthCheckResponse" --include="*.ts" --include="*.tsx"
grep -r "SessionContext" --include="*.ts" --include="*.tsx"
```

## Proposed Action

1. Verify each export is truly unused
2. Remove `export` keyword if only used locally
3. Delete type entirely if never used

## Acceptance Criteria

- [ ] Audit all exported types for usage
- [ ] Remove unnecessary exports
- [ ] TypeScript still compiles

## Resources

- Code Simplicity Reviewer: agent a6c2ca6
- Related: ESLint dead code prevention docs
