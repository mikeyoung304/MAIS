---
status: resolved
priority: p1
issue_id: 619
tags: [code-review, architecture, booking-links, duplication, must-fix-now]
dependencies: []
created: 2026-01-05
triaged: 2026-01-05
resolved: 2026-01-05
---

# Duplicate getTenantInfo Function in Tools and Executors

## Problem Statement

The `getTenantInfo()` function is implemented identically in both `booking-link-tools.ts` and `booking-link-executors.ts`. This duplicates database queries (called twice per operation) and creates maintenance burden where changes must be made in both locations.

## Findings

**Source:** performance-oracle, architecture-strategist, code-simplicity-reviewer

**Evidence:**

```typescript
// booking-link-tools.ts:77-100 (22 lines)
async function getTenantInfo(
  prisma: PrismaClient,
  tenantId: string
): Promise<{ slug: string; customDomain?: string; timezone: string } | null> {
  // ... implementation
}

// booking-link-executors.ts:90-112 (22 lines) - NEARLY IDENTICAL
async function getTenantInfo(
  prisma: PrismaClient,
  tenantId: string
): Promise<{ slug: string; customDomain?: string } | null> {
  // ... same implementation without timezone
}
```

**Impact:**

1. 2 database queries per booking link operation where 1 would suffice
2. DRY violation leads to maintenance burden
3. Minor divergence (tools version includes timezone, executors doesn't)

## Proposed Solutions

### Option 1: Extract to shared utility module (Recommended)

**Pros:** DRY, single source of truth, testable in isolation
**Cons:** Adds a new file
**Effort:** Small
**Risk:** Very low

```typescript
// server/src/agent/utils/tenant-info.ts
export async function getTenantInfo(
  prisma: PrismaClient,
  tenantId: string,
  options?: { includeTimezone?: boolean }
): Promise<TenantInfo | null> {
  // ... unified implementation
}
```

### Option 2: Pass tenant info through proposal payload

**Pros:** Avoids second DB call in executor
**Cons:** Larger payloads, requires schema change
**Effort:** Medium
**Risk:** Low

Include `tenantSlug` and `customDomain` in the proposal when created, pass through to executor.

### Option 3: Short-lived cache for tenant info

**Pros:** Performance optimization for high-volume scenarios
**Cons:** Cache invalidation complexity
**Effort:** Medium
**Risk:** Low (tenant slugs rarely change)

## Recommended Action

**TRIAGE RESULT: MUST FIX NOW** (2/3 FIX BEFORE PROD, 1/3 MUST FIX NOW → escalated for enterprise quality)

**Reviewers:** security-sentinel, architecture-strategist, data-integrity-guardian

**Decision:** Extract to shared utility. DRY violation + N+1 query pattern is unacceptable for enterprise-grade code.

**Implementation:** Option 1 - Extract to shared utility module

## Technical Details

**Affected Files:**

- `server/src/agent/tools/booking-link-tools.ts` (lines 77-100)
- `server/src/agent/executors/booking-link-executors.ts` (lines 90-112)
- NEW: `server/src/agent/utils/tenant-info.ts`

**Note:** `createProposal` helper is also duplicated from `onboarding-tools.ts` (lines 54-83). Consider extracting both utilities together.

## Acceptance Criteria

- [x] Single `getTenantInfo` function exists in shared location
- [x] Both tools and executors import from shared location
- [x] No duplicate database queries for tenant info

## Work Log

| Date       | Action                           | Learnings                                                                                      |
| ---------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| 2026-01-05 | Created during /workflows:review | Identified by performance-oracle, architecture-strategist, and code-simplicity-reviewer agents |
| 2026-01-05 | Resolved via parallel agent      | Created server/src/agent/utils/tenant-info.ts with options pattern                             |

## Resources

- PR: Booking Links Phase 0 - commit 1bd733c9
- Similar pattern: `server/src/agent/tools/onboarding-tools.ts` (also has createProposal helper)
