---
status: deferred
priority: p3
issue_id: '548'
tags: [code-review, consistency, cleanup]
dependencies: []
---

# Error Message Inconsistency

## Problem Statement

Tools use a mix of error message constants (ErrorMessages) and inline strings. This creates inconsistency and makes localization harder.

## Findings

**Pattern Recognition Specialist:**

> "Some tools return `ErrorMessages.LOAD_SERVICES`, others use inline text like `'Please provide a valid email address'`."

**Examples:**

```typescript
// Uses constant:
return { success: false, error: ErrorMessages.LOAD_SERVICES };

// Uses inline:
return { success: false, error: 'Please provide a valid email address' };
```

**Impact:**

- Inconsistent error handling
- Harder to localize
- Harder to track all error messages

## Proposed Solutions

### Option A: Standardize to constants (Recommended)

Add missing error messages to ErrorMessages and use throughout.

**Pros:** Consistent, localizable
**Cons:** Need to add several constants
**Effort:** Medium (30 min)
**Risk:** Low

### Option B: Document as acceptable

Some inline errors are context-specific and don't need constants.

**Pros:** No code change
**Cons:** Remains inconsistent
**Effort:** Small (5 min)
**Risk:** Low

## Recommended Action

Option A - Standardize to constants

## Technical Details

**Affected Files:**

- `server/src/agent/tools/read-tools.ts` - Multiple inline errors
- `server/src/agent/customer/customer-tools.ts` - Some inline errors

## Acceptance Criteria

- [ ] All error messages use ErrorMessages constants
- [ ] No inline error strings in tools

## Work Log

| Date       | Action                   | Learnings                        |
| ---------- | ------------------------ | -------------------------------- |
| 2026-01-01 | Created from code review | Consistency aids maintainability |
