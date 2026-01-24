---
status: complete
priority: p1
issue_id: '5258'
tags: [code-review, security, agent-tools, pr-28]
source: PR #28 multi-agent review
---

# P1: Branding Revert Validates After TTL Check (TOCTOU)

## Problem Statement

The `revert_branding` executor checks TTL expiration **before** validating the history data structure with Zod. This creates a TOCTOU-like issue where the executor accesses unvalidated JSON field data.

**Why it matters:** JSON fields are untrusted runtime data. Accessing `previous.timestamp` before validation violates Common Pitfall #62 and the prevention pattern documented in `ZOD_PARAMETER_VALIDATION_PREVENTION.md`.

## Findings

**Location:** `server/src/agent/executors/storefront-executors.ts` (lines 796-828)

**Current order (INCORRECT):**

```typescript
// Type assertion, no runtime validation yet!
const history = branding._previousBranding as Array<{ timestamp: number }>;

// Check TTL BEFORE validation
if (Date.now() - previous.timestamp > TWENTY_FOUR_HOURS_MS) {
  // Accesses unvalidated data
  return error;
}

// Validation happens AFTER TTL check
const historyResult = PreviousBrandingHistorySchema.safeParse(branding._previousBranding);
```

**Vulnerability:** If `branding._previousBranding` is corrupted (e.g., `timestamp` is a string, array, or object), the TTL check could throw or behave unexpectedly.

## Proposed Solutions

### Option A: Validate First (Recommended)

**Pros:** Follows established pattern, simple fix
**Cons:** None
**Effort:** Small (5 min)

```typescript
// Get branding data
const branding = (tenant?.branding as Record<string, unknown>) || {};

// VALIDATE FIRST - before accessing any fields
const historyResult = PreviousBrandingHistorySchema.safeParse(branding._previousBranding);
if (!historyResult.success) {
  return {
    success: false,
    error: 'Branding history is corrupted. Cannot revert.',
    canRevert: false,
  };
}

const history = historyResult.data;

// NOW safe to access validated data
const previous = history[0];
if (Date.now() - previous.timestamp > TWENTY_FOUR_HOURS_MS) {
  // ...
}
```

## Technical Details

**Affected files:**

- `server/src/agent/executors/storefront-executors.ts`

**Related patterns:**

- `docs/solutions/patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md`
- Common Pitfall #62 in CLAUDE.md

## Acceptance Criteria

- [ ] Zod validation occurs BEFORE any access to history data
- [ ] Corrupted history returns clean error message
- [ ] Existing tests still pass
- [ ] Add test case for corrupted history format

## Work Log

| Date       | Action                                      | Learnings                                        |
| ---------- | ------------------------------------------- | ------------------------------------------------ |
| 2026-01-22 | Identified during PR #28 multi-agent review | Security + Architecture agents both flagged this |

## Resources

- PR #28: Agent system integrity fixes
- Security review agent finding P1-2
- Architecture review agent finding P1-2
