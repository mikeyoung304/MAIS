---
status: pending
priority: p3
issue_id: "191"
tags: [code-review, organization, documentation]
dependencies: []
---

# Type Verification File in Wrong Location

## Problem Statement

The file `server/test/type-safety-verification.ts` (85 lines) is a documentation file demonstrating EventEmitter type safety, not an actual test. It's placed in the `test/` directory but isn't a runnable test.

## Findings

**Location:** `server/test/type-safety-verification.ts`

**File Purpose:**
- Demonstrates compile-time type errors
- Shows valid and invalid usage patterns
- Not a runnable test (no test runner imports)

**Current Location:**
```
server/test/
├── type-safety-verification.ts  # ❌ Documentation, not a test
├── services/
└── seeds/
```

## Proposed Solutions

### Solution 1: Move to docs/examples (Recommended)
- Relocate to `docs/examples/event-emitter-type-safety.ts`
- Document in README as example code
- **Pros:** Clear separation of concerns
- **Cons:** File move
- **Effort:** Small (5 minutes)
- **Risk:** None

### Solution 2: Convert to actual test
- Add vitest imports and assertions
- Make it a real compile-time test
- **Pros:** Test coverage
- **Cons:** More complex
- **Effort:** Medium (30 minutes)
- **Risk:** Low

## Recommended Action

Implement **Solution 1** for clarity.

## Technical Details

**Proposed Move:**
```
# From
server/test/type-safety-verification.ts

# To
docs/examples/event-emitter-type-safety.ts
```

## Acceptance Criteria

- [ ] File moved to appropriate location
- [ ] README updated to reference example
- [ ] No broken imports

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-03 | Created | Found during code review of commit 45024e6 |

## Resources

- Commit: 45024e6 (introduced type verification file)
