---
status: complete
priority: p2
issue_id: "241"
tags: [architecture, landing-page, layering]
dependencies: []
source: "code-review-pr-14"
---

# TODO-241: Consider Adding Service Layer for Landing Page Operations

## Priority: P2 (Important - Technical Debt)

## Status: Complete

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

- [x] Decide: Add service layer or document exception
- [x] If adding service: Move sanitization logic to service
- [x] If documenting: Add comment in routes explaining pattern

## Resolution

**Decision: Add LandingPageService (Option A)**

Created `server/src/services/landing-page.service.ts` following the same pattern as `PackageDraftService`:

**Files Changed:**
1. `server/src/services/landing-page.service.ts` - New service with:
   - `getDraft()`, `saveDraft()`, `publish()`, `discardDraft()` - draft operations
   - `getConfig()`, `updateConfig()`, `toggleSection()` - legacy operations
   - Sanitization logic moved from routes to service
   - Audit logging on all operations

2. `server/src/routes/tenant-admin-landing-page.routes.ts` - Updated to:
   - Accept `LandingPageService` instead of `TenantRepository`
   - Remove `sanitizeObject` import (handled by service)
   - Add architecture comment documenting the pattern

3. `server/src/routes/index.ts` - Updated to:
   - Pass `landingPageService` to route factory
   - Add type to Services interface

4. `server/src/di.ts` - Updated to:
   - Create `LandingPageService` instance
   - Add to Container interface and both mock/real builders

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-04 | Created | Code review of PR #14 |
| 2025-12-04 | Resolved | Added LandingPageService for architectural consistency |

## Tags

architecture, landing-page, layering
