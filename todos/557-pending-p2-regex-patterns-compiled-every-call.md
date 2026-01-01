---
status: resolved
priority: p3
issue_id: '557'
tags: [code-review, performance, agent-ecosystem, invalidated]
dependencies: []
---

# RESOLVED: Regex Patterns - Finding Invalidated

> **Quality-First Triage:** Finding invalidated. "JS regex literals compile at parse time, not execution time. Not a real performance issue."

## Problem Statement

The `softConfirmPendingT2()` method compiles **10+ regex patterns on every call**:

```typescript
// proposal.service.ts:255-276
const rejectionPatterns = [
  /^no,?\s*(don'?t|cancel|stop|wait)\b/i,
  /^wait[,!]?\s*(don'?t|stop|cancel|no)\b/i,
  // ... 10+ more patterns
];
```

These regexes are compiled fresh on each invocation instead of being compiled once at module load time.

**Why it matters:** ~0.1-0.5ms overhead per call for regex compilation. Called on every chat turn with T2 proposals.

## Findings

| Reviewer             | Finding                                |
| -------------------- | -------------------------------------- |
| Performance Reviewer | P2: Regex patterns compiled every call |

## Proposed Solutions

### Option 1: Hoist to Module Scope (Recommended)

**Effort:** Trivial (15 minutes)

Move regex array to module level:

```typescript
// At top of proposal.service.ts
const REJECTION_PATTERNS = [
  /^no,?\s*(don'?t|cancel|stop|wait)\b/i,
  /^wait[,!]?\s*(don'?t|stop|cancel|no)\b/i,
  // ... more patterns
] as const;

// In method
const rejectionPatterns = REJECTION_PATTERNS; // No compilation
```

**Pros:**

- Trivial change
- Zero overhead after first load

**Cons:**

- None

## Recommended Action

Implement **Option 1** immediately - this is a quick win.

## Technical Details

**Affected Files:**

- `server/src/agent/proposals/proposal.service.ts`

**Current Overhead:**

- 10+ regex compilations per `softConfirmPendingT2()` call

**After Fix:**

- 10+ regex compilations once at module load
- Zero per-call overhead

## Acceptance Criteria

- [ ] Move rejectionPatterns array to module scope
- [ ] Verify pattern matching behavior unchanged
- [ ] Tests still pass

## Work Log

| Date       | Action                   | Learnings                        |
| ---------- | ------------------------ | -------------------------------- |
| 2026-01-01 | Created from code review | Performance Oracle flagged as P2 |

## Resources

- JavaScript regex compilation: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp
