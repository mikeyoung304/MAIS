---
status: pending
priority: p1
issue_id: "230"
tags: [data-integrity, code-review, landing-page, transactions]
dependencies: []
source: "code-review-landing-page-visual-editor"
---

# TODO-230: Wrap Publish Operation in Transaction

## Priority: P1 (Critical - Blocks Merge)

## Status: Pending

## Source: Data Integrity Review - Landing Page Visual Editor Plan

## Problem Statement

The plan's publish operation copies draft to published config without transaction protection. If the operation fails mid-way, the system could be left in an inconsistent state where draft is partially cleared but published isn't updated.

**Why It Matters:**
- Partial failures cause data inconsistency
- User sees "Unsaved changes" after publishing
- No rollback mechanism for failed publishes

## Findings

**Failure Scenario:**
1. User clicks Publish
2. Server starts copying draft to published
3. Network error or database timeout mid-operation
4. Draft metadata cleared but published config not updated
5. User sees stale live site, draft appears empty

**Evidence:**
- Plan (lines 117-139): Publish workflow code doesn't show transaction
- Existing pattern in `catalog.repository.ts` uses `prisma.$transaction()` for atomic operations

## Proposed Solutions

### Option A: Prisma Transaction Wrapper (Recommended)
Wrap publish operation in `$transaction()` for atomicity.

**Pros:** Guaranteed atomicity, automatic rollback
**Cons:** None
**Effort:** Small (30 min)
**Risk:** Low

```typescript
async publishLandingPageDraft(tenantId: string): Promise<LandingPageConfig> {
  return await this.prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfig: true },
    });

    const draft = tenant?.landingPageConfig?.draft;
    if (!draft) {
      throw new NotFoundError('No draft to publish');
    }

    const updated = await tx.tenant.update({
      where: { id: tenantId },
      data: {
        landingPageConfig: {
          published: draft,
          publishedAt: new Date().toISOString(),
          draft: null,
          draftUpdatedAt: null,
        },
      },
    });

    return updated.landingPageConfig.published;
  });
}
```

## Recommended Action

**Option A** - Always use transactions for multi-step state changes.

## Technical Details

**Affected Files:**
- `server/src/adapters/prisma/tenant.repository.ts` - Wrap publish in transaction

## Acceptance Criteria

- [ ] Publish operation wrapped in `prisma.$transaction()`
- [ ] Partial failure results in complete rollback
- [ ] Unit test: Simulated failure leaves draft unchanged
- [ ] E2E test: Published config only updates on full success

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-04 | Created | Data integrity review of landing page visual editor plan |

## Tags

data-integrity, code-review, landing-page, transactions
