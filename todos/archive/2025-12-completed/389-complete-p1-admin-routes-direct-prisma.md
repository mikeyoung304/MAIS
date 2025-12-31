---
status: complete
priority: p1
issue_id: '389'
tags:
  - architecture
  - code-review
  - repository-pattern
dependencies: []
---

# Admin Routes Using Direct Prisma Instead of Repository

## Problem Statement

Multiple admin route files directly use `prisma.tenant.*` queries instead of going through the repository/service layer. This violates the established architecture pattern and bypasses tenant isolation safeguards.

## Findings

**Affected Files:**

1. `server/src/routes/admin/tenants.routes.ts` (lines 33, 73)
   - Uses `prisma.tenant.findMany()` directly
   - Uses `prisma.tenant.update()` directly

2. `server/src/routes/admin/stripe.routes.ts` (lines 73-74)
   - Direct Prisma queries for tenant data

3. `server/src/routes/stripe-connect-webhooks.routes.ts` (multiple lines)
   - Direct Prisma usage in webhook handlers

**Example of violation:**

```typescript
// BAD - Direct Prisma in route
const tenants = await prisma.tenant.findMany({ ... });

// GOOD - Through repository
const tenants = await tenantRepo.findAll();
```

**Impact:**

- Bypasses any logging/auditing in repository layer
- Makes testing harder (can't mock repository)
- Inconsistent with rest of codebase

## Proposed Solutions

### Option 1: Refactor to use TenantRepository (Recommended)

- Inject `TenantRepository` via DI container
- Replace all direct Prisma calls with repository methods
- Add any missing repository methods

**Pros:** Consistent architecture, testable, maintainable
**Cons:** Requires adding methods to repository
**Effort:** Medium
**Risk:** Low

### Option 2: Create AdminTenantService

- Create dedicated service for admin operations
- Service uses repository internally

**Pros:** Clean separation of admin vs tenant operations
**Cons:** More abstraction layers
**Effort:** Medium-Large
**Risk:** Low

## Recommended Action

Option 1 - Refactor to use existing TenantRepository

## Technical Details

**Affected files:**

- `server/src/routes/admin/tenants.routes.ts`
- `server/src/routes/admin/stripe.routes.ts`
- `server/src/routes/stripe-connect-webhooks.routes.ts`
- `server/src/adapters/prisma/tenant.repository.ts` (add methods)

## Acceptance Criteria

- [ ] No direct `prisma.tenant.*` calls in route files
- [ ] All queries go through TenantRepository
- [ ] Repository has all needed methods
- [ ] Tests updated to use repository mocks
- [ ] TypeScript compiles without errors

## Work Log

| Date       | Action                        | Learnings                                 |
| ---------- | ----------------------------- | ----------------------------------------- |
| 2025-12-25 | Created from multi-agent scan | Found during deprecated patterns analysis |

## Resources

- CLAUDE.md architecture patterns section
- Existing repository implementations in `server/src/adapters/prisma/`
