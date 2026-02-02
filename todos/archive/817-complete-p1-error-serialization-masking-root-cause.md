---
status: ready
priority: p1
issue_id: '817'
tags: [code-review, real-time-preview, debugging, logging]
dependencies: []
---

# Error Serialization Masks Root Cause in useDraftConfig

## Problem Statement

The `useDraftConfig` hook's error logging produces `{"error":{}}` - an empty object that hides the actual error message. This makes it impossible to diagnose why the draft fetch is failing.

JavaScript `Error` objects have non-enumerable properties (`message`, `stack`, `name`), so when serialized to JSON, they become `{}`.

**Impact:** Cannot determine the actual root cause of preview failures. Debug sessions are blind without proper error visibility.

## Findings

### Evidence from Playwright E2E logs:

```
[ERROR] [useDraftConfig] Failed to fetch draft {"error":{}}
```

### Location of the bug:

**File:** `apps/web/src/hooks/useDraftConfig.ts:139-141`

```typescript
} catch (error) {
  logger.error('[useDraftConfig] Failed to fetch draft', { error }); // Error becomes {}
  throw error;
}
```

### Root Cause Analysis

1. The `error` variable can be an `Error` object
2. JSON.stringify on Error objects returns `{}` because Error properties are non-enumerable
3. The actual error message is never logged
4. This pattern exists in multiple places in the codebase

### Related Pitfalls

- This is a common JavaScript gotcha not explicitly listed in CLAUDE.md pitfalls
- Consider adding as Pitfall #93: "Error object JSON serialization"

## Proposed Solutions

### Solution 1: Serialize Error Properties Explicitly (Recommended)

**Pros:** Simple, targeted fix. Preserves stack trace for debugging.
**Cons:** Requires manual pattern in each catch block.
**Effort:** Small (30 min)
**Risk:** Low

```typescript
} catch (error) {
  logger.error('[useDraftConfig] Failed to fetch draft', {
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : undefined,
    errorName: error instanceof Error ? error.name : undefined,
  });
  throw error;
}
```

### Solution 2: Create Error Serialization Utility

**Pros:** Reusable across codebase. Enforces consistent error logging.
**Cons:** Requires updating all existing logger.error calls.
**Effort:** Medium (2 hours)
**Risk:** Low

```typescript
// lib/error-utils.ts
export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error.cause ? { cause: serializeError(error.cause) } : {}),
    };
  }
  return { value: String(error) };
}

// Usage:
logger.error('[useDraftConfig] Failed to fetch draft', serializeError(error));
```

### Solution 3: Update Logger to Auto-Detect Errors

**Pros:** Zero changes to calling code. Transparent fix.
**Cons:** May have unintended side effects if logger is used elsewhere.
**Effort:** Medium (1 hour)
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

### Affected Files

- `apps/web/src/hooks/useDraftConfig.ts` (lines 139-141)
- `apps/web/src/lib/api.client.ts` (line 84 - `.catch(() => null)` masks errors)
- Potentially other files using same pattern

### Acceptance Criteria

- [ ] Error messages are visible in logs when useDraftConfig fails
- [ ] Stack traces are preserved for debugging
- [ ] All P1/P2 catch blocks in the preview data flow are fixed
- [ ] Pattern documented for future development

## Work Log

| Date       | Action                              | Learnings                                                  |
| ---------- | ----------------------------------- | ---------------------------------------------------------- |
| 2026-02-02 | Created via multi-agent code review | Empty error object pattern identified as debugging blocker |

## Resources

- PR: N/A (discovered in code review)
- Related: Real-time preview investigation
- Similar patterns: Search `logger.error.*{ error }` to find all instances
