---
status: ready
priority: p1
issue_id: "435"
tags: [code-review, security, trust-tier, agent-tools]
dependencies: []
---

# update_booking T2 for Status Changes Too Low

## Problem Statement

The `update_booking` tool uses T2 (soft confirm) for status changes including CANCELLED. Cancellation is a high-impact operation that should require explicit confirmation (T3).

**Why it matters:** Accidental or prompt-injection-triggered cancellations could:
- Lose customer bookings without recourse
- Trigger refund processes
- Cause customer disputes

## Findings

- **Location:** `server/src/agent/tools/write-tools.ts` (updateBookingTool)
- Current logic: T3 only for date changes, T2 for everything else
- Status changes (especially CANCELLED) bundled with notes changes at T2
- TRUST_TIERS documentation says T3 for "Cancellations, refunds, deletes"

## Proposed Solutions

### Option A: T3 for CANCELLED Status (Recommended)

**Approach:** Check if status === 'CANCELLED' and escalate to T3.

**Pros:**
- Protects cancellation operations
- Minimal code change
- Follows trust tier documentation

**Cons:**
- Slightly more friction for legitimate cancellations

**Effort:** Small (30 minutes)

**Risk:** Low

---

### Option B: T3 for All Status Changes

**Approach:** Any status change requires T3.

**Pros:**
- Maximum protection

**Cons:**
- May be over-cautious for benign status updates

**Effort:** Small (30 minutes)

**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `server/src/agent/tools/write-tools.ts` (updateBookingTool)

**Related components:**
- Trust tier definitions in `server/src/agent/tools/types.ts`

**Database changes:** None

## Resources

- TRUST_TIERS constant in types.ts
- Commit 0d3cba5

## Acceptance Criteria

- [ ] CANCELLED status changes require T3
- [ ] Trust tier logic updated in updateBookingTool
- [ ] Tests verify cancellation requires hard confirmation
- [ ] Tests pass

## Work Log

### 2025-12-26 - Initial Discovery

**By:** trust-tier-reviewer agent (code review)

**Actions:**
- Reviewed trust tier assignments for all new write tools
- Identified status change protection gap

**Learnings:**
- Trust tier assignments need per-operation granularity
