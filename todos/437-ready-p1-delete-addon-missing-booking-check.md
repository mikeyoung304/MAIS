---
status: ready
priority: p1
issue_id: "437"
tags: [code-review, data-integrity, trust-tier, agent-tools]
dependencies: []
---

# delete_addon Should Escalate to T3 if Has Bookings

## Problem Statement

The `delete_addon` tool uses T2 regardless of whether the add-on is referenced by existing bookings. Deleting an add-on with bookings could orphan booking data or cause display issues.

**Why it matters:**
- Bookings may reference deleted add-ons
- Historical reporting could be affected
- Price calculations may break for existing bookings

## Findings

- **Location:** `server/src/agent/tools/write-tools.ts` (deleteAddonTool)
- Current trust tier: T2 (hardcoded)
- No check for existing bookings referencing this add-on
- TRUST_TIERS T3 examples: "deletes with existing bookings"
- Similar pattern needed as package delete logic

## Proposed Solutions

### Option A: Check Bookings and Escalate (Recommended)

**Approach:** Query for bookings with this add-on; if any exist, use T3.

**Pros:**
- Protects data integrity
- Follows trust tier documentation
- Dynamic tier based on impact

**Cons:**
- Additional query

**Effort:** Small (1 hour)

**Risk:** Low

---

### Option B: Always T3 for Addon Delete

**Approach:** Hardcode T3 for all addon deletions.

**Pros:**
- Simpler implementation

**Cons:**
- Over-cautious for unused addons

**Effort:** Small (15 minutes)

**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `server/src/agent/tools/write-tools.ts` (deleteAddonTool)

**Related components:**
- Booking model relationship to AddOn
- Similar logic may exist in deletePackageTool

**Database changes:** None

## Resources

- TRUST_TIERS in types.ts
- Commit 0d3cba5

## Acceptance Criteria

- [ ] delete_addon checks for existing bookings
- [ ] Escalates to T3 if bookings reference the add-on
- [ ] Tests verify escalation with booking references
- [ ] Tests pass

## Work Log

### 2025-12-26 - Initial Discovery

**By:** trust-tier-reviewer agent (code review)

**Actions:**
- Identified missing booking check in addon deletion

**Learnings:**
- Delete operations need to check for dependent data
