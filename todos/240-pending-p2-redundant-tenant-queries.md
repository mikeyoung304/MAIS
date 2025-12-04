---
status: pending
priority: p2
issue_id: "240"
tags: [performance, landing-page, database]
dependencies: []
source: "code-review-pr-14"
---

# TODO-240: Eliminate Redundant Tenant Queries in Draft Operations

## Priority: P2 (Important - Should Fix Before Merge)

## Status: Pending

## Source: Code Review - PR #14 (Performance Oracle)

## Problem Statement

Several draft methods query the tenant table multiple times when one query would suffice. For example, `getLandingPageDraft` reads the tenant to get config, then could potentially read it again.

**Why It Matters:**
- Extra database round-trips add latency
- Auto-save fires every 2 seconds, multiplying the overhead
- PostgreSQL connection pool gets unnecessary load

## Findings

**Evidence:**
- `tenant.repository.ts:588-600`: saveLandingPageDraft reads tenant, then updates
- Pattern is correct for read-modify-write but could use single UPDATE with RETURNING

## Proposed Solution

**Option A: Use UPDATE...RETURNING (Recommended)**

For save operations where we don't need to read first:

```typescript
async saveLandingPageDraft(
  tenantId: string,
  config: LandingPageConfig
): Promise<{ success: boolean; savedAt: string }> {
  const now = new Date().toISOString();

  // Single query with JSON manipulation
  await this.prisma.$executeRaw`
    UPDATE "Tenant"
    SET "landingPageConfig" = jsonb_set(
      COALESCE("landingPageConfig", '{}'),
      '{draft}',
      ${JSON.stringify(config)}::jsonb
    )
    WHERE id = ${tenantId}
  `;

  return { success: true, savedAt: now };
}
```

**Option B: Accept Current Pattern**

The read-modify-write pattern is acceptable for correctness. The performance impact is minimal given auto-save debouncing.

## Acceptance Criteria

- [ ] Review each draft method for unnecessary queries
- [ ] Document decision (optimize or accept current pattern)
- [ ] If optimizing, ensure atomicity is maintained

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-04 | Created | Code review of PR #14 |

## Tags

performance, landing-page, database
