---
status: pending
priority: p2
issue_id: '252'
tags: [code-review, landing-page, data-integrity, database]
dependencies: []
source: 'plan-review-2025-12-04'
---

# TODO-252: discardLandingPageDraft Missing Transaction Wrapper

## Priority: P2 (Important - Data Integrity)

## Status: Pending

## Source: Plan Review - Data Integrity Guardian

## Problem Statement

The `discardLandingPageDraft()` method at `tenant.repository.ts:649-677` performs read-modify-write **without transaction protection**. If a database failure occurs between reading and writing, the operation leaves partial state.

**Why It Matters:**

- User clicks "Discard" expecting clean state
- Network interruption after read but before write
- Draft remains partially intact
- User sees stale "Unsaved changes" indicator despite clicking Discard

## Findings

### Current Implementation (No Transaction)

```typescript
// tenant.repository.ts:649-677
async discardLandingPageDraft(tenantId: string): Promise<{ success: boolean }> {
  // READ - no transaction
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { landingPageConfig: true },
  });

  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }

  const currentWrapper = this.getLandingPageWrapper(tenant.landingPageConfig);

  const newWrapper: LandingPageDraftWrapper = {
    draft: null,
    draftUpdatedAt: null,
    published: currentWrapper.published,
    publishedAt: currentWrapper.publishedAt,
  };

  // WRITE - separate operation, no atomicity
  await this.prisma.tenant.update({
    where: { id: tenantId },
    data: { landingPageConfig: newWrapper as any },
  });

  logger.info({ tenantId }, 'Landing page draft discarded');
  return { success: true };
}
```

### Contrast with saveLandingPageDraft (Has Transaction)

```typescript
// tenant.repository.ts:544-601
async saveLandingPageDraft(tenantId: string, config: LandingPageConfig) {
  return await this.prisma.$transaction(async (tx) => { // ✓ Transaction
    const tenant = await tx.tenant.findUnique({ ... });
    // ... operations inside transaction
  });
}
```

## Proposed Solutions

### Option A: Wrap in Transaction (Recommended)
- **Effort:** 30 minutes
- **Risk:** Low
- Add `$transaction` wrapper to `discardLandingPageDraft`
- Follow same pattern as `saveLandingPageDraft`
- **Pros:** Consistent with other methods, atomic operation
- **Cons:** Slightly more complex

### Option B: Use Single UPDATE Query
- **Effort:** 15 minutes
- **Risk:** Low
- Skip the read, use JSONB update to clear draft fields directly
- **Pros:** Simpler, faster
- **Cons:** Less readable, raw SQL

## Recommended Action

**Execute Option A:** Add transaction wrapper:

```typescript
async discardLandingPageDraft(tenantId: string): Promise<{ success: boolean }> {
  return await this.prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfig: true },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const currentWrapper = this.getLandingPageWrapper(tenant.landingPageConfig);

    const newWrapper: LandingPageDraftWrapper = {
      draft: null,
      draftUpdatedAt: null,
      published: currentWrapper.published,
      publishedAt: currentWrapper.publishedAt,
    };

    await tx.tenant.update({
      where: { id: tenantId },
      data: { landingPageConfig: newWrapper as any },
    });

    logger.info({ tenantId }, 'Landing page draft discarded');

    return { success: true };
  });
}
```

## Acceptance Criteria

- [ ] `discardLandingPageDraft` wrapped in `$transaction`
- [ ] Uses `tx.tenant.findUnique` and `tx.tenant.update` (not `this.prisma`)
- [ ] Unit test: concurrent discard doesn't corrupt state
- [ ] Manual test: network failure during discard handled gracefully

## Work Log

| Date       | Action  | Notes                                               |
|------------|---------|-----------------------------------------------------|
| 2025-12-04 | Created | Data integrity review identified missing transaction |

## Tags

code-review, landing-page, data-integrity, database
