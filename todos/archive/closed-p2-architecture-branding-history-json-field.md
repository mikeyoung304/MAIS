---
status: closed
closed_date: '2026-02-08'
closed_reason: 'Dead code — storefront-executors.ts deleted during Phase 5. _previousBranding feature no longer exists (0 grep hits in server/src/).'
priority: p2
triage_date: '2026-01-12'
triage_by: master-architect-triage
verified: true
defer_reason: Works correctly - architectural debt, not bug. Consider Option B (cleanup job) when time permits.
effort: 2-4hrs
---

# P2: Branding History Storage in JSON Field Risks Data Loss

**Source:** Code Review - Architecture
**PR:** #28 feat/agent-system-integrity-fixes
**Date:** 2026-01-12
**Reviewer:** architecture-strategist

## Issue

The branding history for `revert_branding` is stored in a JSON field (`branding._previousBranding`) within the tenant record, not in a dedicated database table. This pattern has several risks:

1. No transaction isolation - history is updated inline with branding changes
2. Array truncation to 5 entries happens silently without audit trail
3. 24-hour TTL is only enforced at revert time, not cleaned up automatically
4. JSON field updates require read-modify-write, increasing TOCTOU risk even with advisory locks

## Location

- `server/src/agent/executors/storefront-executors.ts:577-605`

## Impact

Data could be lost or corrupted if there are edge cases in the JSON manipulation. The 5-entry limit means users can't revert beyond that, with no warning. No observability into history growth.

## Recommended Fix

Consider either:

**Option A: Separate Table**

```sql
CREATE TABLE branding_history (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenant(id),
  previous_state JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  INDEX idx_tenant_expires (tenant_id, expires_at)
);
```

**Option B: Scheduled Cleanup + Metrics**

- Add a cron job to clean up expired `_previousBranding` entries
- Add metrics for history size per tenant
- Add logging when history is truncated

## Severity Justification

P2 because data integrity is at risk, but the impact is limited to branding revert functionality (not core booking/payment flows).
