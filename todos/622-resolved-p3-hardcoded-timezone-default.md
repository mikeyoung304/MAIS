---
status: resolved
priority: p3
issue_id: 622
tags: [code-review, booking-links, timezone, phase-1]
dependencies: []
created: 2026-01-05
resolved: 2026-01-05
---

# Hardcoded Timezone Default Instead of Tenant Setting

## Problem Statement

The timezone is hardcoded to `'America/New_York'` in multiple places instead of using the tenant's actual timezone setting. This will cause incorrect booking URL generation and availability calculations for non-US tenants.

## Findings

**Source:** security-sentinel, architecture-strategist, performance-oracle

**Evidence:**

```typescript
// booking-link-tools.ts:98
timezone: 'America/New_York', // Default, should be fetched from tenant settings

// booking-link-executors.ts:270
timezone: 'America/New_York', // Default, should be from tenant settings
```

The comments acknowledge this is a known issue for Phase 1.

**Risk:**
- Tenants in other timezones will have incorrect availability windows
- Booking confirmations may show wrong times
- Customer-facing booking pages may display incorrect available slots

## Proposed Solutions

### Option 1: Fetch from Tenant settings (Phase 1)

**Pros:** Correct solution, respects tenant configuration
**Cons:** Requires tenant model to have timezone field (may already exist)
**Effort:** Medium
**Risk:** Low

Check if Tenant model has timezone field, if not add it in Phase 1 migration.

### Option 2: Use Service.timezone field

**Pros:** Per-service timezone already exists in schema
**Cons:** Still needs default from tenant, complexity
**Effort:** Small to use existing field
**Risk:** Very low

The Service model already has `timezone String` field. The executor sets it to hardcoded value. Could default to tenant timezone when creating.

### Option 3: Accept timezone in tool input

**Pros:** Explicit, no assumption
**Cons:** Puts burden on caller/agent
**Effort:** Small
**Risk:** Low

## Recommended Action

**TRIAGE RESULT: FIX BEFORE PRODUCTION** (2/3 FIX BEFORE PROD, 1/3 DEFER)

**Reviewers:** security-sentinel, architecture-strategist, data-integrity-guardian

**Decision:** Add timezone to Tenant model in Phase 1 migration. Hardcoded timezone breaks multi-tenant design for non-US tenants.

**Implementation:** Option 1 - Fetch from Tenant settings (Phase 1)

## Technical Details

**Affected Files:**
- `server/src/agent/tools/booking-link-tools.ts` (line 98)
- `server/src/agent/executors/booking-link-executors.ts` (line 270)
- Potentially `server/prisma/schema.prisma` (Tenant model timezone field)

**Existing Service.timezone:**
The Service model already has a timezone field, but it's set to the hardcoded default on creation.

## Acceptance Criteria

- [x] Timezone comes from tenant settings (or sensible default) - Added `timezone` field to Tenant model with default `America/New_York`
- [x] Service.timezone reflects actual tenant timezone - Executor now fetches tenant timezone when creating services
- [x] Non-US tenants have correct availability calculations - getTenantInfo utility updated to return stored timezone

## Work Log

| Date       | Action                           | Learnings                                    |
| ---------- | -------------------------------- | -------------------------------------------- |
| 2026-01-05 | Created during /workflows:review | Identified by multiple reviewers, acknowledged in code comments |
| 2026-01-05 | Resolved in Phase 1 | Added timezone field to Tenant model via migration 23. Updated getTenantInfo to fetch stored timezone. Updated executor to use tenant timezone when creating services. |

## Resources

- PR: Booking Links Phase 0 - commit 1bd733c9
- Phase 1 plan for timezone migration
