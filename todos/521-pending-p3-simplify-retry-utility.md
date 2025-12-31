---
status: pending
priority: p3
issue_id: '521'
tags:
  - code-review
  - simplification
  - phase-5
dependencies: []
---

# Simplify Over-Engineered Retry Utility

## Problem Statement

The retry utility (`retry.ts`) is 186 lines with configuration options that are never used. Only one config (`CLAUDE_API_RETRY_CONFIG`) is ever passed, and several exports are unused externally.

**Why it matters:** Over-engineering adds cognitive load and maintenance burden for features that provide no value.

## Findings

**Source:** Code Simplicity Review Agent

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/utils/retry.ts`

**Unused features:**

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

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- `server/src/agent/utils/retry.ts`
- `server/test/agent/utils/retry.test.ts` (if removing exports)

## Acceptance Criteria

- [ ] Unused exports removed
- [ ] Dead code paths removed
- [ ] Tests still pass
- [ ] TypeScript compiles

## Work Log

| Date       | Action                           | Learnings                   |
| ---------- | -------------------------------- | --------------------------- |
| 2025-12-31 | Created from Phase 5 code review | Over-engineering identified |

## Resources

- [Phase 5 Simplicity Review](internal)
- [YAGNI Principle](https://martinfowler.com/bliki/Yagni.html)
