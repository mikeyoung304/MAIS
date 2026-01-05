---
status: resolved
priority: p2
issue_id: '634'
tags: [code-review, dependency-injection, tenant-provisioning, architecture]
dependencies: []
---

# TenantProvisioningService Not in DI Container

## Problem Statement

The `TenantProvisioningService` is instantiated directly in route files rather than being created once in the DI container and injected.

**Why it matters:**

- Inconsistent with other services in the DI pattern
- Multiple instances created (one per route file)
- Harder to test - can't inject mock provisioning service easily
- No centralized lifecycle management

## Findings

### Evidence from Code Review

**DHH Reviewer:** "The `TenantProvisioningService` is instantiated directly in the routes rather than through the DI container"

**Architecture Reviewer:** "The service is created twice: In `admin/tenants.routes.ts` (line 27) and in `routes/index.ts` (line 520)"

**Locations:**

```typescript
// admin/tenants.routes.ts line 27
const provisioningService = new TenantProvisioningService(prisma);

// auth.routes.ts uses it via options.tenantProvisioningService
```

**Current DI pattern (other services):**

```typescript
// di.ts - other services are created centrally
const catalogService = new CatalogService(...);
const services = {
  catalog: catalogService,
  // ... but no tenantProvisioning
};
```

## Proposed Solutions

### Option A: Add to DI Container (Recommended)

**Pros:** Consistent with existing patterns, single instance, testable
**Cons:** Minor refactor to route factories
**Effort:** Small
**Risk:** Low

```typescript
// In di.ts
const tenantProvisioningService = new TenantProvisioningService(prisma);

const services = {
  // ...existing services...
  tenantProvisioning: tenantProvisioningService,
};
```

Then pass to route factories via options.

### Option B: Keep Direct Instantiation

**Pros:** Works as-is
**Cons:** Inconsistent, harder to test, multiple instances
**Effort:** None
**Risk:** Technical debt

## Recommended Action

**Option A** - Add to DI container and pass to route factories

## Technical Details

**Affected Files:**

- `server/src/di.ts` - Create and export service
- `server/src/routes/admin/tenants.routes.ts` - Receive via options
- `server/src/routes/index.ts` - Pass from container

## Acceptance Criteria

- [x] `TenantProvisioningService` created in `buildContainer()`
- [x] Service passed to admin routes via options
- [x] Service passed to auth routes via options
- [x] Remove direct instantiation in route files
- [x] Existing tests pass

## Work Log

| Date       | Action                          | Learnings                                        |
| ---------- | ------------------------------- | ------------------------------------------------ |
| 2026-01-05 | Created from multi-agent review | DI inconsistency noted by 2 reviewers            |
| 2026-01-05 | Resolved: Added to DI container | Updated di.ts, routes use options object pattern |

## Resources

- Code Review: Tenant Provisioning Integrity PR
- Pattern: Service injection in di.ts
