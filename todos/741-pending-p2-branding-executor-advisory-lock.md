---
status: pending
priority: p2
issue_id: 741
tags: [code-review, security, toctou, database, pr-27]
dependencies: []
---

# P2: Branding Executor JSON Update Lacks Advisory Lock

## Problem Statement

The `update_storefront_branding` executor is documented as intentionally skipping advisory locks because it "writes only to scalar columns." However, line 569 shows a read-modify-write pattern on the `branding` JSON field:

```typescript
branding: { ...((tenant?.branding as Record<string, unknown>) || {}), ...updates }
```

This IS a TOCTOU-vulnerable pattern where concurrent updates could overwrite each other.

**Impact:** Two concurrent updates to `fontFamily` and `logo` could race, with one overwriting the other's changes.

## Findings

**Reviewer:** data-integrity-guardian

**Location:** `server/src/agent/executors/storefront-executors.ts:540-605`

**Comment (lines 532-538):**

```typescript
// NOTE: Does NOT use advisory lock (unlike other write executors)
// Rationale: This executor writes ONLY to scalar columns (primaryColor,
// secondaryColor, etc.) and the branding JSON field, NOT to landingPageConfigDraft.
// PostgreSQL guarantees atomicity for individual column updates. No TOCTOU risk
// because we're not doing read-modify-write on complex JSON structures.
```

**Actual Code (line 569):**

```typescript
branding: { ...((tenant?.branding as Record<string, unknown>) || {}), ...updates }
```

This IS a read-modify-write pattern!

## Proposed Solutions

### Solution A: Add Advisory Lock (Recommended)

- **Pros:** Consistent with other executors, eliminates race condition
- **Cons:** Small performance overhead (~5ms)
- **Effort:** Small (15 minutes)
- **Risk:** Low

```typescript
return await prisma.$transaction(
  async (tx) => {
    const lockId = hashTenantStorefront(tenantId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    // ... existing branding update logic
  },
  { timeout: STOREFRONT_TRANSACTION_TIMEOUT_MS, isolationLevel: STOREFRONT_ISOLATION_LEVEL }
);
```

### Solution B: Document Risk and Accept (Not Recommended)

- **Pros:** No code change
- **Cons:** Leaves race condition unaddressed
- **Effort:** None
- **Risk:** Medium (concurrent branding updates rare but possible)

## Recommended Action

Solution A - Add advisory lock for consistency with other 6 executors.

## Technical Details

**Affected Files:**

- `server/src/agent/executors/storefront-executors.ts` (lines 540-605)

**Coverage:** Would bring advisory lock coverage to 7/7 executors (100%)

## Acceptance Criteria

- [ ] `update_storefront_branding` wrapped in `$transaction` with advisory lock
- [ ] Comment updated to reflect lock usage
- [ ] Test added for concurrent branding updates
- [ ] All existing tests pass

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-01-11 | Created | From PR #27 multi-agent review |

## Resources

- PR #27: https://github.com/mikeyoung304/MAIS/pull/27
- ADR-013: Advisory locks for TOCTOU prevention
