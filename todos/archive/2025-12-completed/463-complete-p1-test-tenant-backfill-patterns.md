---
status: complete
priority: p1
issue_id: '463'
tags: [code-review, test-data-isolation, data-integrity]
dependencies: []
---

**Resolution:** Verified 2025-12-29 - Initial backfill was comprehensive. Only 4 real tenants remain (la-petit-mariage, little-bit-farm, macon-headshots, plate). No additional tenants needed flagging.

# P1: Backfill Pattern May Miss Test Tenants

## Problem Statement

The SQL backfill used narrow patterns (`%-test-%`, `e2e-%`, `mais-test`) that don't match all test tenant naming conventions used in the test infrastructure. Test tenants with patterns like `auth-prevention-*`, `consistency-test-*`, `first-business-*` are not flagged and will appear as "real" tenants.

**Why it matters:** Dashboard shows inflated "real tenant" count and platform stats are polluted with test data.

## Findings

### Discovery 1: Backfill patterns narrower than test infrastructure

**Source:** Data Integrity Review Agent
**Location:** `server/test/helpers/vitest-global-setup.ts` lines 46-54

Test infrastructure uses these patterns NOT covered by backfill:

```typescript
{ slug: { startsWith: 'hash-test-business-' } },
{ slug: { startsWith: 'test-business-' } },
{ slug: { startsWith: 'first-business-' } },
{ slug: { startsWith: 'no-match-test-' } },
{ slug: { endsWith: '-tenant-a' } },
{ slug: { endsWith: '-tenant-b' } },
{ slug: { startsWith: 'test-tenant-' } },
{ slug: { startsWith: 'auth-prevention-' } },
```

### Discovery 2: Plan document has comprehensive patterns

**Source:** Data Integrity Review Agent
**Location:** `plans/test-data-isolation-best-practices.md` lines 137-172

Many more patterns documented but not used in backfill.

## Proposed Solutions

### Solution 1: Re-run Comprehensive Backfill (Recommended)

**Effort:** Small | **Risk:** Low

Run this SQL to catch all test tenants:

```sql
UPDATE "Tenant"
SET is_test_tenant = true
WHERE is_test_tenant = false
  AND (
    -- From vitest-global-setup.ts
    slug LIKE 'hash-test-business-%'
    OR slug LIKE 'test-business-%'
    OR slug LIKE 'first-business-%'
    OR slug LIKE 'no-match-test-%'
    OR slug LIKE '%-tenant-a'
    OR slug LIKE '%-tenant-b'
    OR slug LIKE 'test-tenant-%'
    OR slug LIKE 'auth-prevention-%'
    -- From test plan
    OR slug LIKE 'e2e-%'
    OR slug LIKE '%-test-%'
    OR slug LIKE 'consistency-test-%'
    OR slug LIKE 'forgot-test-%'
    OR slug LIKE 'whitespace-test-%'
    OR slug LIKE 'route-dup-test-%'
    OR slug LIKE 'auth-case-test-%'
    OR slug LIKE 'file-sink-test-%'
    OR slug LIKE 'notification-test-%'
    OR slug LIKE 'cancellation-flow-%'
    OR slug LIKE 'payment-flow-%'
  )
  -- Safety: Protected real tenants
  AND slug NOT IN ('mais', 'handled', 'little-bit-farm', 'la-petit-mariage', 'macon-headshots', 'plate');
```

### Solution 2: Query-Based Verification First

**Effort:** Tiny | **Risk:** None

Before re-running backfill, verify what would be affected:

```sql
-- Preview: What tenants would be flagged?
SELECT slug, name, is_test_tenant
FROM "Tenant"
WHERE is_test_tenant = false
  AND (slug LIKE 'first-business-%' OR slug LIKE 'auth-prevention-%' OR ...)
ORDER BY slug;

-- Verify real tenants are safe
SELECT slug, is_test_tenant
FROM "Tenant"
WHERE slug IN ('mais', 'handled', 'little-bit-farm', 'la-petit-mariage', 'macon-headshots', 'plate');
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- Database only (no code changes)

**Database Changes:**

- UPDATE to flag additional test tenants

## Acceptance Criteria

- [ ] All test tenant patterns from vitest-global-setup.ts are covered
- [ ] No false positives (real tenants marked as test)
- [ ] Dashboard shows correct count of real tenants
- [ ] Verification query confirms 4 real tenants remain

## Work Log

| Date       | Action                     | Outcome/Learning                                    |
| ---------- | -------------------------- | --------------------------------------------------- |
| 2025-12-29 | Initial backfill           | 74 tenants flagged, but patterns incomplete         |
| 2025-12-29 | Code review identified gap | Additional patterns needed from test infrastructure |

## Resources

- `plans/test-data-isolation-best-practices.md` - Comprehensive pattern list
- `server/test/helpers/vitest-global-setup.ts` - Test cleanup patterns
