---
status: ready
priority: p1
issue_id: "436"
tags: [code-review, security, trust-tier, agent-tools]
dependencies: []
---

# update_deposit_settings T2 Too Low for Financial Config

## Problem Statement

The `update_deposit_settings` tool uses T2 (soft confirm) for changing deposit percentages and balance due days. These are financial configuration changes that affect all future bookings and should require explicit confirmation.

**Why it matters:** Incorrect deposit settings could:
- Charge customers wrong amounts
- Affect cash flow (0% deposit = no upfront payment)
- Create accounting discrepancies
- Be difficult to reverse once bookings are made

## Findings

- **Location:** `server/src/agent/tools/write-tools.ts` (updateDepositSettingsTool)
- Currently hardcoded to T2
- Deposit percentage ranges 0-100% with significant financial impact
- balanceDueDays affects payment timing for all bookings
- T3 examples include "financial impact operations"

## Proposed Solutions

### Option A: Escalate to T3 (Recommended)

**Approach:** Change trust tier from T2 to T3 for deposit settings.

**Pros:**
- Protects financial configuration
- Consistent with trust tier philosophy

**Cons:**
- More friction for legitimate changes

**Effort:** Small (15 minutes)

**Risk:** Low

---

### Option B: T3 Only for Significant Changes

**Approach:** T2 for small changes, T3 if depositPercent changes by >20% or set to 0.

**Pros:**
- Balanced friction

**Cons:**
- More complex logic

**Effort:** Medium (1 hour)

**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `server/src/agent/tools/write-tools.ts` (updateDepositSettingsTool)

**Related components:**
- Deposit executor in `executors/index.ts`

**Database changes:** None

## Resources

- Trust tier definitions in types.ts
- Commit 0d3cba5

## Acceptance Criteria

- [ ] Deposit settings changes require T3
- [ ] Trust tier updated in tool definition
- [ ] Tests verify financial config requires hard confirmation
- [ ] Tests pass

## Work Log

### 2025-12-26 - Initial Discovery

**By:** trust-tier-reviewer agent (code review)

**Actions:**
- Identified financial config at insufficient trust tier

**Learnings:**
- Financial configuration changes need T3 protection
