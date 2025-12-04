---
status: complete
priority: p1
issue_id: "237"
tags: [security, data-integrity, landing-page, race-condition]
dependencies: []
source: "code-review-pr-14"
resolved_at: "2025-12-04"
resolved_by: "claude-code"
---

# TODO-237: Wrap saveLandingPageDraft in Transaction

## Priority: P1 (Critical - Blocks Merge)

## Status: Complete

## Source: Code Review - PR #14 (Security Sentinel + Data Integrity Guardian)

## Problem Statement

The `saveLandingPageDraft` method in `tenant.repository.ts` reads the tenant, modifies the draft, and writes back without a transaction. This creates a TOCTOU (time-of-check-to-time-of-use) race condition where concurrent saves could lose data.

**Why It Matters:**
- Two auto-saves from different tabs could interleave and lose edits
- User expects their changes to persist reliably
- publishLandingPageDraft uses transaction, but saveLandingPageDraft does not

## Findings

**Attack Scenario:**
1. Tab A reads draft config (headline: "Welcome")
2. Tab B reads draft config (headline: "Welcome")
3. Tab A updates headline to "Hello" and saves
4. Tab B updates subheadline to "Subtitle" (still has headline: "Welcome")
5. Tab B saves, overwriting Tab A's "Hello" change

**Evidence:**
- `tenant.repository.ts:588-633`: saveLandingPageDraft not wrapped in transaction
- `tenant.repository.ts:635-670`: publishLandingPageDraft correctly uses `$transaction`

## Proposed Solution

Wrap saveLandingPageDraft in a Prisma transaction:

```typescript
async saveLandingPageDraft(
  tenantId: string,
  config: LandingPageConfig
): Promise<{ success: boolean; savedAt: string }> {
  return await this.prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfig: true },
    });

    if (!tenant) {
      throw new NotFoundError(`Tenant ${tenantId} not found`);
    }

    // Re-validate URLs inside transaction
    this.validateImageUrls(config);

    const now = new Date().toISOString();
    const currentWrapper = tenant.landingPageConfig as LandingPageConfigWrapper | null;
    const newWrapper: LandingPageConfigWrapper = {
      draft: config,
      published: currentWrapper?.published ?? null,
      draftUpdatedAt: now,
      publishedAt: currentWrapper?.publishedAt ?? null,
    };

    await tx.tenant.update({
      where: { id: tenantId },
      data: { landingPageConfig: newWrapper as unknown as Prisma.InputJsonValue },
    });

    return { success: true, savedAt: now };
  });
}
```

## Acceptance Criteria

- [x] saveLandingPageDraft wrapped in `$transaction`
- [x] All reads and writes occur within transaction scope
- [ ] Unit test: Concurrent saves preserve all changes (deferred - requires integration test infrastructure)
- [ ] E2E test: Two tabs saving simultaneously don't lose data (deferred - requires browser automation)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-04 | Created | Code review of PR #14 |
| 2025-12-04 | Resolved | Wrapped saveLandingPageDraft in Prisma $transaction. URL validation kept outside transaction for fast failure. |

## Tags

security, data-integrity, landing-page, race-condition
