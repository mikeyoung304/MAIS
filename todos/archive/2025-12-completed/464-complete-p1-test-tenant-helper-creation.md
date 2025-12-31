---
status: complete
priority: p1
issue_id: '464'
tags: [code-review, test-data-isolation, testing]
dependencies: []
---

**Resolution:** Fixed 2025-12-29 - Added `isTestTenant: true` to both `create` and `update` blocks in `createTenantA()` and `createTenantB()` helpers.

# P1: Test Helpers Don't Set `isTestTenant = true` on Creation

## Problem Statement

The test helper functions that create tenants during test runs don't set `isTestTenant: true`. New test tenants will default to `isTestTenant = false` and appear as "real" tenants in the admin dashboard.

**Why it matters:** The problem will recur over time as tests create new tenants, defeating the purpose of the isolation feature.

## Findings

### Discovery 1: integration-setup.ts missing flag

**Source:** Data Integrity Review Agent
**Location:** `server/test/helpers/integration-setup.ts` lines 138-151

```typescript
const createTenantA = async (): Promise<Tenant> => {
  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantASlug },
    update: {},
    create: {
      slug: tenantASlug,
      name: `Test Tenant A (${fileSlug})`,
      apiKeyPublic: `pk_test_${fileSlug}_a`,
      apiKeySecret: `sk_test_${fileSlug}_a_hash`,
      // Missing: isTestTenant: true
    },
  });
```

### Discovery 2: All tenant creation in tests likely affected

**Source:** Data Integrity Review Agent

Need to audit all test files that create tenants directly via Prisma.

## Proposed Solutions

### Solution 1: Update All Test Helpers (Recommended)

**Effort:** Small | **Risk:** Low

Add `isTestTenant: true` to all test tenant creation:

```typescript
create: {
  slug: tenantASlug,
  name: `Test Tenant A (${fileSlug})`,
  apiKeyPublic: `pk_test_${fileSlug}_a`,
  apiKeySecret: `sk_test_${fileSlug}_a_hash`,
  isTestTenant: true, // ADD THIS
},
```

Files to update:

- `server/test/helpers/integration-setup.ts`
- `server/test/helpers/multi-tenant-setup.ts` (if exists)
- Any test files with direct `prisma.tenant.create()` calls

### Solution 2: Database Trigger (Alternative)

**Effort:** Medium | **Risk:** Medium

Create a trigger that auto-sets `isTestTenant = true` for any tenant where slug matches test patterns:

```sql
CREATE OR REPLACE FUNCTION auto_flag_test_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug LIKE '%-test-%' OR NEW.slug LIKE 'e2e-%' OR NEW.slug LIKE 'test-%' THEN
    NEW.is_test_tenant := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_auto_test_flag
BEFORE INSERT ON "Tenant"
FOR EACH ROW EXECUTE FUNCTION auto_flag_test_tenant();
```

**Pros:** Automatic, catches all cases
**Cons:** Hidden magic, harder to debug, doesn't work for CI where patterns vary

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/test/helpers/integration-setup.ts`
- Any other test helpers creating tenants

**Database Changes:** None (unless using trigger solution)

## Acceptance Criteria

- [ ] `createTenantA()` and `createTenantB()` set `isTestTenant: true`
- [ ] Multi-tenant setup helpers set `isTestTenant: true`
- [ ] Running tests doesn't pollute dashboard with new "real" tenants
- [ ] Grep confirms no `prisma.tenant.create` without `isTestTenant`

## Work Log

| Date       | Action                     | Outcome/Learning                                |
| ---------- | -------------------------- | ----------------------------------------------- |
| 2025-12-29 | Code review identified gap | New test tenants won't be flagged automatically |

## Resources

- `server/test/helpers/integration-setup.ts` - Main test helper
