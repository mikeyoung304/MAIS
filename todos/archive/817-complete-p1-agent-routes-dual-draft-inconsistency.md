---
status: pending
priority: p1
issue_id: 817
tags: [code-review, data-integrity, agent, storefront]
dependencies: []
---

# Agent Routes Ignore Legacy Draft Source (Data Integrity Risk)

## Problem Statement

The internal agent routes (`/storefront/publish` and `/storefront/discard`) only check `landingPageConfigDraft` column, ignoring the legacy `landingPageConfig.draft` wrapper format. This creates data integrity issues for tenants with legacy data.

**Why it matters:**

- Tenants with legacy Visual Editor drafts will see "No draft to publish" error
- Agent discard doesn't clear legacy draft, leaving orphaned data
- Repository methods correctly handle BOTH sources, but agent routes don't
- Inconsistent behavior between REST API and agent API

## Findings

**From Data Integrity Review:**

Agent publish route (`internal-agent.routes.ts:1616-1627`):

```typescript
if (!tenant.landingPageConfigDraft) {
  res.status(400).json({ error: 'No draft to publish' }); // WRONG: doesn't check wrapper.draft
  return;
}
```

Correct repository implementation (`tenant.repository.ts:1050-1083`):

```typescript
// 1. First, try Build Mode column (landingPageConfigDraft)
if (tenant.landingPageConfigDraft) { ... }
// 2. Fall back to Visual Editor wrapper format
if (!draftToPublish) {
  const currentWrapper = this.getLandingPageWrapper(tenant.landingPageConfig);
  if (currentWrapper.draft) { ... }
}
```

**Additional Issues Found:**

1. Agent discard only clears column, not wrapper.draft
2. Missing transaction safety (repository uses `$transaction`)
3. Draft version not reset after publish/discard

## Proposed Solutions

### Option A: Delegate to Repository Methods (Recommended)

**Pros:**

- Single source of truth for publish/discard logic
- Gets transaction safety, dual-draft support, version reset for free
- Minimal code change

**Cons:**

- None significant

**Effort:** Small (30 minutes)
**Risk:** Low

```typescript
// internal-agent.routes.ts - Fix for publish
router.post('/storefront/publish', async (req: Request, res: Response) => {
  const { tenantId } = TenantIdSchema.parse(req.body);
  const result = await tenantRepo.publishLandingPageDraft(tenantId); // Use repo method
  res.json({ success: true, action: 'published', ...result });
});

// internal-agent.routes.ts - Fix for discard
router.post('/storefront/discard', async (req: Request, res: Response) => {
  const { tenantId } = TenantIdSchema.parse(req.body);
  const result = await tenantRepo.discardLandingPageDraft(tenantId); // Use repo method
  res.json({ success: true, action: 'discarded', ...result });
});
```

### Option B: Duplicate Dual-Draft Logic in Routes

**Pros:**

- Routes maintain direct control

**Cons:**

- Code duplication
- Must sync changes in two places
- Error-prone

**Effort:** Medium (1-2 hours)
**Risk:** Medium

## Recommended Action

Implement Option A - delegate to repository methods.

## Technical Details

**Affected files:**

- `server/src/routes/internal-agent.routes.ts` (lines 1604-1671)

**Test verification:**

- Existing integration tests (`landing-page-routes.spec.ts`) already test repository methods
- Agent routes should pass same tests when delegating

## Acceptance Criteria

- [ ] Agent publish route uses `tenantRepo.publishLandingPageDraft()`
- [ ] Agent discard route uses `tenantRepo.discardLandingPageDraft()`
- [ ] Legacy `landingPageConfig.draft` data is cleared on discard
- [ ] Draft version is reset on publish/discard
- [ ] Transaction wrapping provides atomicity

## Work Log

| Date       | Action                       | Learnings                                     |
| ---------- | ---------------------------- | --------------------------------------------- |
| 2026-02-01 | Code review identified issue | 4 different implementations of same operation |

## Resources

- PR: feat/realtime-storefront-preview branch
- Related: tenant.repository.ts publishLandingPageDraft/discardLandingPageDraft
