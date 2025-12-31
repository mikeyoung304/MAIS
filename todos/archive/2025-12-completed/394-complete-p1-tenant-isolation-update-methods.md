---
status: complete
priority: p1
issue_id: '394'
tags:
  - security
  - tenant-isolation
  - code-review
dependencies: []
---

# Cross-Tenant Data Modification Vulnerability in Update/Delete Methods

## Problem Statement

Multiple repository update and delete methods are missing `tenantId` in their WHERE clauses, allowing potential cross-tenant data modification. While ownership is verified before/after the mutation, the database write occurs without tenant filtering, creating a security vulnerability.

## Findings

**Found by:** Security Sentinel + Tenant Isolation Guardian agents

### 1. Booking Repository - `update()` Method (CRITICAL)

**Location:** `server/src/adapters/prisma/booking.repository.ts:847-866`

```typescript
// Line 847-848: Update happens WITHOUT tenantId filter
const updated = await this.prisma.booking.update({
  where: { id: bookingId }, // MISSING: tenantId
  data: updateData,
});

// Line 861-863: Tenant verification happens AFTER the write
if (updated.tenantId !== tenantId) {
  throw new Error('Tenant mismatch');
}
```

**Risk:** Attacker could modify bookings from other tenants by guessing booking IDs.

### 2. Catalog Repository - `updateAddOn()` Method

**Location:** `server/src/adapters/prisma/catalog.repository.ts:351-372`

```typescript
const addOn = await this.prisma.addOn.update({
  where: { id }, // MISSING: tenantId
  data: { ... }
});
```

### 3. Catalog Repository - `deleteAddOn()` Method

**Location:** `server/src/adapters/prisma/catalog.repository.ts:388-390`

### 4. Segment Repository - `update()` and `delete()` Methods

**Location:** `server/src/adapters/prisma/segment.repository.ts:161-163, 185-187`

### 5. Booking Repository - `reschedule()` Nested Update

**Location:** `server/src/adapters/prisma/booking.repository.ts:929-930`

## Proposed Solutions

### Option 1: Add tenantId to WHERE clauses (Recommended)

- Add `tenantId` to all mutation WHERE clauses
- Use compound WHERE: `where: { id, tenantId }`
- Removes TOCTOU race condition vulnerability

```typescript
// BEFORE
where: {
  id: bookingId;
}

// AFTER
where: {
  id: (bookingId, tenantId);
}
```

**Pros:** Defense-in-depth, eliminates race conditions
**Cons:** None
**Effort:** Small
**Risk:** Low

### Option 2: Add database-level RLS

- Enable PostgreSQL Row-Level Security
- Add policies to enforce tenant isolation at DB layer

**Pros:** Defense-in-depth even if app layer fails
**Cons:** More complex setup, performance overhead
**Effort:** Medium
**Risk:** Medium

## Recommended Action

Option 1 - Add tenantId to all mutation WHERE clauses immediately.

## Technical Details

**Files to modify:**

- `server/src/adapters/prisma/booking.repository.ts` - Lines 847, 929
- `server/src/adapters/prisma/catalog.repository.ts` - Lines 351, 388
- `server/src/adapters/prisma/segment.repository.ts` - Lines 161, 185

## Acceptance Criteria

- [ ] All `update()` calls include `tenantId` in WHERE clause
- [ ] All `delete()` calls include `tenantId` in WHERE clause
- [ ] TypeScript compiles without errors
- [ ] Existing tests pass
- [ ] Add integration tests for cross-tenant access attempts

## Work Log

| Date       | Action                                   | Learnings                                  |
| ---------- | ---------------------------------------- | ------------------------------------------ |
| 2025-12-25 | Created from multi-agent security review | Critical TOCTOU vulnerability pattern      |
| 2025-12-25 | **Approved for work** - Status: ready    | P1 security issue - prioritize immediately |

## Resources

- Security Sentinel agent report
- Tenant Isolation Guardian agent report
- OWASP IDOR guidelines
