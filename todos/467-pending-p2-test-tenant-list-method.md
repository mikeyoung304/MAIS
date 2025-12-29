---
status: pending
priority: p2
issue_id: '467'
tags: [code-review, test-data-isolation, architecture]
dependencies: []
---

# P2: `list()` Method Not Updated - Potential Data Leakage

## Problem Statement

The `list()` method in tenant repository still returns all tenants (including test tenants) when called. Any code using `list()` will see test tenants.

**Why it matters:** Inconsistent filtering - some endpoints hide test tenants, others don't.

## Findings

### Discovery 1: list() has no isTestTenant filter

**Source:** Architecture Review Agent
**Location:** `server/src/adapters/prisma/tenant.repository.ts` lines 166-171

```typescript
async list(onlyActive = false): Promise<Tenant[]> {
  return await this.prisma.tenant.findMany({
    where: onlyActive ? { isActive: true } : undefined,
    // Missing: isTestTenant filter
  });
}
```

## Proposed Solutions

### Solution 1: Add Parameter to list() (Recommended)

**Effort:** Small | **Risk:** Low

```typescript
async list(options: { onlyActive?: boolean; includeTestTenants?: boolean } = {}): Promise<Tenant[]> {
  const { onlyActive = false, includeTestTenants = false } = options;

  const where: Prisma.TenantWhereInput = {};
  if (onlyActive) where.isActive = true;
  if (!includeTestTenants) where.isTestTenant = false;

  return await this.prisma.tenant.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { createdAt: 'desc' },
  });
}
```

### Solution 2: Deprecate list() in Favor of listWithStats()

**Effort:** Medium | **Risk:** Medium

Audit all callers of `list()` and migrate to `listWithStats()`.

**Pros:** Consolidates to one method with proper filtering
**Cons:** Breaking change, needs caller audit

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/adapters/prisma/tenant.repository.ts` - `list()` method
- All callers of `list()` (need audit)

**Database Changes:** None

## Acceptance Criteria

- [ ] list() accepts includeTestTenants parameter
- [ ] Default behavior excludes test tenants
- [ ] All callers audited and updated if needed

## Work Log

| Date       | Action              | Outcome/Learning                                |
| ---------- | ------------------- | ----------------------------------------------- |
| 2025-12-29 | Architecture review | list() method inconsistent with listWithStats() |

## Resources

- Grep for `list()` callers: `grep -r "\.list(" server/src/`
