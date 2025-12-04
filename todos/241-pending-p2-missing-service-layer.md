---
status: pending
priority: p2
issue_id: "241"
tags: [architecture, landing-page, layering]
dependencies: []
source: "code-review-pr-14"
---

# TODO-241: Consider Adding Service Layer for Landing Page Operations

## Priority: P2 (Important - Technical Debt)

## Status: Pending

## Source: Code Review - PR #14 (Architecture Strategist)

## Problem Statement

The landing page routes call the repository directly, bypassing the service layer pattern used elsewhere in the codebase. This violates the established layered architecture:

```
routes/ → services/ → adapters/repositories/
```

**Why It Matters:**
- Inconsistent with existing patterns (booking, catalog, scheduling all have services)
- Business logic (sanitization, validation) lives in routes instead of services
- Harder to unit test business logic in isolation

## Findings

**Current Pattern:**
```typescript
// tenant-admin-landing-page.routes.ts
router.put('/draft', async (req, res, next) => {
  const data = LandingPageConfigSchema.parse(req.body);
  const sanitized = sanitizeObject(data);
  const result = await tenantRepo.saveLandingPageDraft(tenantId, sanitized);
  res.json(result);
});
```

**Standard Pattern (other routes):**
```typescript
// packages.routes.ts
router.post('/', async (req, res, next) => {
  const result = await catalogService.createPackage(tenantId, req.body);
  res.json(result);
});
```

## Proposed Solution

**Option A: Add LandingPageService (Recommended for consistency)**

```typescript
// landing-page.service.ts
export class LandingPageService {
  constructor(private tenantRepo: TenantRepository) {}

  async saveDraft(tenantId: string, config: LandingPageConfig): Promise<SaveResult> {
    const sanitized = sanitizeObject(config, { allowHtml: [] });
    return this.tenantRepo.saveLandingPageDraft(tenantId, sanitized);
  }

  async publish(tenantId: string): Promise<PublishResult> {
    return this.tenantRepo.publishLandingPageDraft(tenantId);
  }
}
```

**Option B: Document Exception**

Accept that landing page routes are thin and the "business logic" is minimal (just sanitization). Document this as an intentional deviation for simplicity.

## Acceptance Criteria

- [ ] Decide: Add service layer or document exception
- [ ] If adding service: Move sanitization logic to service
- [ ] If documenting: Add comment in routes explaining pattern

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-04 | Created | Code review of PR #14 |

## Tags

architecture, landing-page, layering
