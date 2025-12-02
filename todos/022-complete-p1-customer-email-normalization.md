---
status: complete
priority: p1
issue_id: "022"
tags: [code-review, security, data-integrity, multi-tenant]
dependencies: []
---

# Customer Email Normalization Inconsistency

## Problem Statement

Customer creation in booking upsert does NOT normalize email to lowercase, while the Customer model has a composite unique constraint on `@@unique([tenantId, email])`. This creates duplicate customer records when users book with different email casings.

**Why this matters:** The same customer using "John@Example.com" and "john@example.com" creates two separate customer records, breaking customer history tracking and violating data integrity.

## Findings

### Code Evidence

**Location:** `server/src/adapters/prisma/booking.repository.ts:164`

```typescript
const customer = await tx.customer.upsert({
  where: {
    tenantId_email: {
      tenantId,
      email: booking.email,  // NOT NORMALIZED!
    },
  },
  create: {
    tenantId,
    email: booking.email,  // NOT NORMALIZED!
    ...
  },
```

### Inconsistency with Other Code

- `server/src/adapters/prisma/tenant.repository.ts:91,125` - Email IS normalized with `.toLowerCase()`
- Auth routes normalize email on lookup
- Customer creation does NOT normalize

### Impact

- Duplicate customer records per tenant
- Broken customer booking history
- Incorrect customer count metrics
- Potential unique constraint violations under race conditions

## Proposed Solutions

### Option A: Normalize in Repository (Recommended)
**Effort:** Small | **Risk:** Low

Update `booking.repository.ts` to normalize email:

```typescript
const customer = await tx.customer.upsert({
  where: {
    tenantId_email: {
      tenantId,
      email: booking.email.toLowerCase(),  // ADD NORMALIZATION
    },
  },
  create: {
    tenantId,
    email: booking.email.toLowerCase(),  // ADD NORMALIZATION
    ...
  },
```

**Pros:**
- Simple one-line fix
- Consistent with tenant email handling
- No migration needed

**Cons:**
- Existing duplicate records need cleanup

### Option B: Add Database Constraint
**Effort:** Medium | **Risk:** Medium

Add PostgreSQL lower() function to unique constraint:
```sql
CREATE UNIQUE INDEX idx_customer_email_ci ON "Customer" (tenantId, LOWER(email));
```

**Pros:**
- Database enforces consistency
- Cannot be bypassed

**Cons:**
- Requires migration
- Must clean existing duplicates first

## Recommended Action

Implement **Option A** immediately, then schedule **Option B** as follow-up.

## Technical Details

**Files to Update:**
- `server/src/adapters/prisma/booking.repository.ts:162-167`

**Database Cleanup Required:**
```sql
-- Find duplicates
SELECT tenantId, LOWER(email), COUNT(*)
FROM "Customer"
GROUP BY tenantId, LOWER(email)
HAVING COUNT(*) > 1;

-- Merge duplicates (manual process)
```

## Acceptance Criteria

- [ ] Email normalized to lowercase in customer upsert
- [ ] Existing tests pass
- [ ] New test: booking with different email casing creates same customer
- [ ] Data cleanup script for existing duplicates

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during comprehensive code review |

## Resources

- Data Integrity Guardian analysis
- Security Sentinel review confirmed multi-tenant pattern violation
