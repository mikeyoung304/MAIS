---
status: pending
priority: p3
issue_id: '638'
tags: [followup, tenant-provisioning, code-review, technical-debt]
dependencies: []
---

# Tenant Provisioning P3 Follow-up Items

## Overview

Three P3 findings from the multi-agent code review of the tenant provisioning integrity fix.
These are technical debt items that improve code quality but are not blocking.

## Items

### 1. Duplicate Segment Resolution Logic (#635)

**Problem:** The `resolveSegmentId` helper in `storefront-executors.ts` duplicates logic from `onboarding-executors.ts`.

**Location:**
- `server/src/agent/executors/storefront-executors.ts`
- `server/src/agent/executors/onboarding-executors.ts`

**Proposed Solution:** Extract to shared utility in `server/src/agent/utils/segment-resolver.ts`

**Effort:** Small

---

### 2. Missing Unit Tests for TenantProvisioningService (#636)

**Problem:** The new `TenantProvisioningService` has no dedicated unit tests.

**Location:** `server/src/services/tenant-provisioning.service.ts`

**Proposed Solution:** Create `server/test/services/tenant-provisioning.service.test.ts` with:
- Test `createFullyProvisioned()` success path
- Test `createFromSignup()` success path
- Test transaction rollback on segment creation failure
- Test transaction rollback on package creation failure

**Effort:** Medium

---

### 3. Unsafe Type Assertion in Executor Registry (#637)

**Problem:** The executor registry uses `as ProposalExecutor` type assertion without runtime validation.

**Location:** `server/src/agent/proposals/executor-registry.ts`

**Proposed Solution:** Add Zod runtime validation or type guard before assertion.

**Effort:** Small

---

## Acceptance Criteria

- [ ] Extract segment resolution to shared utility (#635)
- [ ] Add unit tests for TenantProvisioningService (#636)
- [ ] Add runtime validation to executor registry (#637)
- [ ] All tests pass

## Work Log

| Date       | Action                          | Learnings                              |
| ---------- | ------------------------------- | -------------------------------------- |
| 2026-01-05 | Created from P2 fix completion  | Consolidate P3 items for follow-up PR  |

## Resources

- Parent PR: fix/tenant-provisioning-integrity
- Related todos: #635, #636, #637
