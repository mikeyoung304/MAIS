---
status: pending
priority: p2
issue_id: 816
tags: [code-review, agent, security, multi-tenant]
dependencies: [811]
---

# Package Tool Must Verify Tenant Ownership Before Mutations

## Problem Statement

When implementing package management tools (#811), the `update_package` and `delete_package` operations MUST verify that the target package belongs to the requesting tenant. Without this check, a malicious or confused agent could modify another tenant's packages.

**Why it matters:**

- Cross-tenant data modification is a CRITICAL security violation
- Violates CLAUDE.md rule: "ALL database queries MUST be scoped by tenantId"
- Could allow pricing manipulation or service disruption across tenants

## Findings

**From Security Agent:**

> **Attack Vector:** Agent calls `update_package` or `delete_package` for a package belonging to a different tenant.
>
> Scenario:
>
> ```
> Tenant A's agent calls:
>   create_package(name: "Premium", price: 5000) ✓ Creates for Tenant A
>
> Tenant B's agent calls:
>   update_package(packageId: "pkg_123", price: 100)
>   ← pkg_123 belongs to Tenant A but Tenant B's agent updated it
> ```

**Correct pattern (from CLAUDE.md):**

```typescript
// CORRECT - Tenant-scoped mutation
const pkg = await prisma.package.findUnique({
  where: { id: packageId },
});
if (!pkg || pkg.tenantId !== tenantId) {
  throw new NotFoundError('Package not found');
}
// Now safe to update...

// WRONG - Allows cross-tenant access
const pkg = await prisma.package.update({
  where: { id: packageId }, // No tenant check!
  data: { ...updates },
});
```

## Proposed Solutions

### Option A: Backend Route Validates Ownership (Recommended)

**Pros:**

- Centralized security check
- Works for all clients (agent, admin UI, etc.)
- Follows existing pattern in tenant-admin.routes.ts

**Cons:**

- Requires fetch-before-mutate (two queries)

**Effort:** Small (30 minutes)
**Risk:** Low

**Implementation in internal-agent.routes.ts:**

```typescript
router.post('/manage-packages', async (req, res) => {
  const { tenantId, action, packageId, ...data } = ManagePackagesSchema.parse(req.body);

  // Verify tenant exists
  const tenant = await tenantRepo.findById(tenantId);
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  if (action === 'update' || action === 'delete') {
    // CRITICAL: Verify package belongs to tenant
    const pkg = await catalogService.getPackageById(packageId);
    if (!pkg || pkg.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Package not found' });
    }
  }

  // Now safe to proceed with mutation
  const result = await catalogService[actionMethod](tenantId, ...);
  return res.json(result);
});
```

### Option B: Database Compound Where Clause

**Pros:**

- Single query
- Guaranteed tenant scoping

**Cons:**

- Requires Prisma compound unique index
- Less explicit error message

**Effort:** Medium (1 hour)
**Risk:** Low

```typescript
// Use compound where clause
await prisma.package.update({
  where: {
    id_tenantId: { id: packageId, tenantId }, // Compound key
  },
  data: { ...updates },
});
```

## Recommended Action

Implement Option A as part of #811 (package management tools).

The backend route handler MUST verify ownership before any update/delete.

## Technical Details

**Affected files:**

- `server/src/routes/internal-agent.routes.ts` - Add ownership check
- `server/src/services/catalog.service.ts` - Verify methods scope by tenant

**Existing pattern to follow:**

From `tenant-admin.routes.ts` (lines 537-545):

```typescript
// Verify segment belongs to tenant
const segment = await segmentRepo.findById(segmentId);
if (!segment || segment.tenantId !== tenantId) {
  res.status(404).json({ error: 'Segment not found' });
  return;
}
```

**Audit logging:**

All package mutations should log:

```typescript
logger.info(
  {
    action: 'package_updated',
    tenantId,
    packageId,
    changes: Object.keys(data),
  },
  '[Agent] Package mutation'
);
```

## Acceptance Criteria

- [ ] Backend route verifies `pkg.tenantId === requestingTenantId` before update/delete
- [ ] 404 returned (not 403) to avoid leaking package existence
- [ ] Audit log includes tenantId, packageId, and action
- [ ] Test: Tenant A cannot update Tenant B's package

## Work Log

| Date       | Action                  | Learnings                               |
| ---------- | ----------------------- | --------------------------------------- |
| 2026-02-01 | Security agent analysis | Cross-tenant mutation is critical risk  |
| 2026-02-01 | Pattern review          | Existing code in tenant-admin.routes.ts |

## Resources

- [CLAUDE.md](CLAUDE.md) - Multi-tenant data isolation rules
- [Security Analysis](docs/solutions/security-issues/P1-SECURITY-PREVENTION-STRATEGIES.md)
- [tenant-admin.routes.ts](server/src/routes/tenant-admin.routes.ts) - Ownership check pattern
