---
status: complete
priority: p2
issue_id: '5252'
tags: [code-review, security, multi-tenant, pitfall-1]
dependencies: []
triage_batch: 1
triage_decision: RESOLVE - Add JSDoc comments only (intentional admin-only operation)
---

# P2: Cleanup Job Missing Tenant Scoping

## Problem Statement

The `cleanupExpiredSessions` function performs bulk operations without tenant scoping. While functionally correct for a cleanup job, it violates the principle that ALL database operations should be tenant-scoped.

**Why it matters:**

- Pattern violation could mask bugs in future modifications
- Prevents tenant-specific retention policies
- Creates inconsistency with rest of codebase

## Findings

**File:** `server/src/services/session/session.repository.ts:407-428`
**File:** `server/src/jobs/cleanup.ts:73-97`

```typescript
// Phase 1: Soft delete expired sessions - NO tenantId filter!
const softDeleted = await this.prisma.agentSession.updateMany({
  where: {
    lastActivityAt: { lt: cutoff },
    deletedAt: null,
  },
  // Missing: tenantId filter
});

// Phase 2: Hard delete - NO tenantId filter!
const hardDeleted = await this.prisma.agentSession.deleteMany({
  where: {
    deletedAt: { lt: hardDeleteCutoff },
  },
  // Missing: tenantId filter
});
```

**Risk:** If this function were ever accidentally exposed through an API endpoint or called with user-controlled parameters, it could affect all tenants.

## Proposed Solutions

### Option A: Document as intentional admin-only operation (Recommended)

**Pros:** Quick fix, documents intent
**Cons:** Doesn't add tenant-specific capability
**Effort:** Small
**Risk:** Low

```typescript
/**
 * ADMIN ONLY: Cleanup expired sessions across ALL tenants.
 * This is intentionally not tenant-scoped as it's a system maintenance operation.
 * Never expose through user-facing API endpoints.
 */
async cleanupExpiredSessions(...) {
```

### Option B: Add tenantId parameter for tenant-scoped cleanup

**Pros:** Enables tenant-specific retention policies
**Cons:** More code
**Effort:** Medium
**Risk:** Low

### Option C: Mark method as private

**Pros:** Prevents accidental exposure
**Cons:** Less flexible
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A - Add clear documentation that this is an admin-only system operation.

## Technical Details

**Affected files:**

- `server/src/services/session/session.repository.ts`
- `server/src/jobs/cleanup.ts`

## Acceptance Criteria

- [ ] Cleanup functions documented as admin-only
- [ ] Clear warning comments about tenant scoping
- [ ] Consider adding tenantId variant for future use

## Work Log

| Date       | Action                   | Result  |
| ---------- | ------------------------ | ------- |
| 2026-01-22 | Created from code review | Pending |

## Resources

- [CLAUDE.md Pitfall #1](CLAUDE.md)
