---
status: ready
priority: p2
issue_id: "445"
tags: [code-review, trust-tier, agent-tools]
dependencies: []
---

# upsert_package T2 for Price Changes Too Low

## Problem Statement

The `upsert_package` tool uses T2 for all changes including price modifications. Price changes have significant financial impact and may warrant T3 for large changes.

**Why it matters:**
- Price changes affect all future bookings
- Could be exploited via prompt injection
- Financial operations need careful confirmation

## Findings

- **Location:** `server/src/agent/tools/write-tools.ts` (upsertPackageTool)
- Currently T2 for all operations
- Price field included in schema
- Consider: T3 if price changes by significant amount

## Proposed Solutions

### Option A: T3 for Significant Price Changes

**Approach:** Escalate to T3 if price changes by >20% or >$100.

**Pros:**
- Protects against accidental large changes
- Allows small adjustments at T2

**Cons:**
- More complex logic

**Effort:** Medium (1-2 hours)

**Risk:** Low

---

### Option B: T3 for All Price Changes

**Approach:** Any price modification requires T3.

**Pros:**
- Simple, safe

**Cons:**
- More friction for small adjustments

**Effort:** Small (30 minutes)

**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `server/src/agent/tools/write-tools.ts`

**Database changes:** None

## Acceptance Criteria

- [ ] Price changes have appropriate trust tier
- [ ] Tests verify tier escalation
- [ ] Tests pass

## Work Log

### 2025-12-26 - Initial Discovery

**By:** trust-tier-reviewer agent

**Actions:**
- Reviewed package tool trust tier

**Learnings:**
- Financial changes need careful tier assignment
