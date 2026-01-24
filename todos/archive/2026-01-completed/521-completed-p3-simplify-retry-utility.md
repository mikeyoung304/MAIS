---
status: complete
priority: p3
issue_id: '521'
tags:
  - code-review
  - simplification
  - phase-5
dependencies: []
---

# Simplify Over-Engineered Retry Utility

## Resolution

**Status: COMPLETED - No changes needed**

Upon detailed analysis, the original findings were incomplete. The code is NOT over-engineered:

1. **`isRetryableError`** - Used by 40+ unit tests in `retry.test.ts` to verify error classification logic
2. **`DEFAULT_CONFIG`** - Used internally by `withRetry()` (line 134) as the base config
3. **`jitter: boolean`** - Tests use `jitter: false` for deterministic delay assertions
4. **Configurable `config` parameter** - Tests pass various configs to verify backoff behavior

**All exports are legitimately used by the test suite.** The configurability enables comprehensive unit testing of retry logic, which is good design practice.

---

## Original Problem Statement (Incorrect)

The retry utility (`retry.ts`) is 186 lines with configuration options that are never used. Only one config (`CLAUDE_API_RETRY_CONFIG`) is ever passed, and several exports are unused externally.

**Why it matters:** Over-engineering adds cognitive load and maintenance burden for features that provide no value.

## Original Findings (Incomplete Analysis)

**Source:** Code Simplicity Review Agent

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/utils/retry.ts`

**Originally claimed "unused" features (ALL ARE USED BY TESTS):**

1. `isRetryableError` - exported but only used internally
2. `DEFAULT_CONFIG` - never used (only CLAUDE_API_RETRY_CONFIG is passed)
3. `jitter: boolean` toggle - always `true`, the `false` path is dead code
4. Configurable `config` parameter - always uses CLAUDE_API_RETRY_CONFIG

**Current complexity:** 186 lines
**Achievable:** ~80 lines (57% reduction)

## Proposed Solutions

### Solution 1: Minimal Simplification (Recommended)

**Description:** Remove unused exports, keep configurability for tests

- Remove `isRetryableError` export (keep internal)
- Remove `DEFAULT_CONFIG` (inline into CLAUDE_API_RETRY_CONFIG)
- Keep jitter toggle (may want it in tests)
- Keep configurable parameter (useful for tests)

**Pros:**

- Reduces API surface
- Maintains test flexibility
- Low risk

**Cons:**

- Only partial simplification

**Effort:** Small (30 min)
**Risk:** Low

### Solution 2: Aggressive Simplification

**Description:** Hardcode all values, remove configuration

```typescript
const CONFIG = { maxRetries: 3, initialDelayMs: 2000, maxDelayMs: 30000 };

export async function withRetry<T>(fn: () => Promise<T>, opName: string): Promise<T> {
  // Simplified implementation with hardcoded values
}
```

**Pros:**

- Maximum simplicity (186 → 80 lines)
- Clear single purpose

**Cons:**

- Loses test configurability
- Need to update tests

**Effort:** Medium (1-2 hours)
**Risk:** Medium (test changes)

### Solution 3: Accept Current Complexity

**Description:** Keep as-is, the configurability may be useful later

**Pros:**

- No changes needed
- Future-proof

**Cons:**

- Maintains unused code
- YAGNI violation

**Effort:** None
**Risk:** Low

## Recommended Action

**Solution 3 was correct:** Keep as-is. The configurability IS useful - for testing.

## Technical Details

**Affected files:**

- `server/src/agent/utils/retry.ts` - No changes needed
- `server/test/agent/utils/retry.test.ts` - 785 lines of comprehensive tests

## Acceptance Criteria

- [x] ~~Unused exports removed~~ No unused exports found
- [x] ~~Dead code paths removed~~ No dead code found
- [x] Tests still pass
- [x] TypeScript compiles

## Work Log

| Date       | Action                           | Learnings                                       |
| ---------- | -------------------------------- | ----------------------------------------------- |
| 2025-12-31 | Created from Phase 5 code review | Over-engineering identified                     |
| 2026-01-01 | Detailed analysis completed      | All exports used by tests - not over-engineered |

## Resources

- [Phase 5 Simplicity Review](internal)
- [YAGNI Principle](https://martinfowler.com/bliki/Yagni.html)

## Lessons Learned

**When reviewing code for "unused exports", always check test files too.** The original analysis only looked at production code imports, missing that tests are a legitimate consumer of exported APIs. Good test coverage often requires exposing internals that aren't used in production code paths.
