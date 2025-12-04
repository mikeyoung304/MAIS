# Sprint 2.1: Audit Log Rollback Guide

## Rollback Demonstration & Procedures

This guide demonstrates how to use the audit log system to rollback changes and recover data. All examples use real SQL queries against the ConfigChangeLog table.

---

## Table of Contents

1. [Rollback Use Cases](#rollback-use-cases)
2. [Query Examples](#query-examples)
3. [Manual Rollback Procedures](#manual-rollback-procedures)
4. [Automated Rollback Scripts](#automated-rollback-scripts)
5. [Production Safeguards](#production-safeguards)

---

## Rollback Use Cases

### When to Rollback vs. Forward Fix

**Rollback Scenarios:**

- Accidental branding change (wrong color uploaded)
- Pricing error (wrong price entered)
- Package deletion mistake
- Blackout date error

**Forward Fix Scenarios:**

- Intentional changes that need adjustment
- Data corruption requiring investigation
- Changes spanning multiple entities

---

## Query Examples

### 1. View Audit History for Entity

```sql
-- Get full history for a package
SELECT
  id,
  operation,
  email,
  role,
  "beforeSnapshot",
  "afterSnapshot",
  reason,
  "createdAt"
FROM "ConfigChangeLog"
WHERE "tenantId" = 'tenant_123'
  AND "entityType" = 'Package'
  AND "entityId" = 'pkg_abc'
ORDER BY "createdAt" DESC;
```

**Example Output:**

```
| id      | operation | email           | beforeSnapshot      | afterSnapshot       | createdAt           |
|---------|-----------|-----------------|---------------------|---------------------|---------------------|
| log_003 | update    | admin@test.com  | {"price": 12000}    | {"price": 15000}    | 2025-01-10 14:30:00 |
| log_002 | update    | admin@test.com  | {"price": 10000}    | {"price": 12000}    | 2025-01-10 10:00:00 |
| log_001 | create    | admin@test.com  | null                | {"price": 10000}    | 2025-01-01 09:00:00 |
```

### 2. Find Most Recent Good State

```sql
-- Get the snapshot before the problematic change
SELECT
  "beforeSnapshot"
FROM "ConfigChangeLog"
WHERE "tenantId" = 'tenant_123'
  AND "entityType" = 'Package'
  AND "entityId" = 'pkg_abc'
  AND "createdAt" < '2025-01-10 14:30:00'  -- Before the bad change
ORDER BY "createdAt" DESC
LIMIT 1;
```

### 3. View Tenant Timeline (Recent Changes)

```sql
-- See last 50 changes for tenant
SELECT
  "changeType",
  operation,
  "entityType",
  "entityId",
  email,
  reason,
  "createdAt"
FROM "ConfigChangeLog"
WHERE "tenantId" = 'tenant_123'
ORDER BY "createdAt" DESC
LIMIT 50;
```

### 4. Find Who Made a Change

```sql
-- Identify who deleted a package
SELECT
  email,
  role,
  "userId",
  "beforeSnapshot",
  "createdAt",
  reason,
  metadata
FROM "ConfigChangeLog"
WHERE "tenantId" = 'tenant_123'
  AND "entityType" = 'Package'
  AND "entityId" = 'pkg_deleted'
  AND operation = 'delete';
```

---

## Manual Rollback Procedures

### Example 1: Rollback Package Price Change

**Scenario:** Admin accidentally changed price from $120 to $150. Need to rollback to $120.

```sql
-- Step 1: Verify the change
SELECT
  "beforeSnapshot"->'priceCents' as old_price,
  "afterSnapshot"->'priceCents' as new_price,
  email,
  "createdAt"
FROM "ConfigChangeLog"
WHERE "tenantId" = 'tenant_macon'
  AND "entityType" = 'Package'
  AND "entityId" = 'pkg_classic'
  AND operation = 'update'
ORDER BY "createdAt" DESC
LIMIT 1;

-- Output: old_price: 12000, new_price: 15000

-- Step 2: Restore to previous price
UPDATE "Package"
SET "priceCents" = 12000
WHERE id = 'pkg_classic'
  AND "tenantId" = 'tenant_macon';

-- Step 3: Log the rollback operation
INSERT INTO "ConfigChangeLog" (
  id,
  "tenantId",
  "changeType",
  operation,
  "entityType",
  "entityId",
  email,
  role,
  "beforeSnapshot",
  "afterSnapshot",
  reason,
  "createdAt"
)
VALUES (
  gen_random_uuid()::text,
  'tenant_macon',
  'package_crud',
  'update',
  'Package',
  'pkg_classic',
  'system@elope.internal',
  'PLATFORM_ADMIN',
  jsonb_build_object('priceCents', 15000),
  jsonb_build_object('priceCents', 12000),
  'Manual rollback: Reverted accidental price increase',
  NOW()
);
```

### Example 2: Restore Deleted Blackout Date

**Scenario:** Admin accidentally deleted a blackout date for Christmas.

```sql
-- Step 1: Find the deleted blackout
SELECT
  "beforeSnapshot"
FROM "ConfigChangeLog"
WHERE "tenantId" = 'tenant_macon'
  AND "entityType" = 'BlackoutDate'
  AND operation = 'delete'
  AND "beforeSnapshot"->>'date' = '2025-12-25';

-- Output: {"id": "blackout_123", "date": "2025-12-25", "reason": "Christmas Holiday"}

-- Step 2: Recreate the blackout
INSERT INTO "BlackoutDate" (
  id,
  "tenantId",
  date,
  reason,
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid()::text,
  'tenant_macon',
  '2025-12-25'::date,
  'Christmas Holiday',
  NOW(),
  NOW()
);

-- Step 3: Log the restoration
INSERT INTO "ConfigChangeLog" (...)
-- Similar to Example 1
```

### Example 3: Rollback Branding Change

**Scenario:** Admin uploaded wrong logo, need to revert to previous logo URL.

```sql
-- Step 1: Get previous branding state
SELECT
  "beforeSnapshot"->>'logo' as old_logo,
  "afterSnapshot"->>'logo' as new_logo
FROM "ConfigChangeLog"
WHERE "tenantId" = 'tenant_macon'
  AND "entityType" = 'Tenant'
  AND "changeType" = 'branding_update'
ORDER BY "createdAt" DESC
LIMIT 1;

-- Step 2: Restore previous logo
UPDATE "Tenant"
SET branding = jsonb_set(
  branding::jsonb,
  '{logo}',
  '"https://old-logo-url.com/logo.png"'::jsonb
)
WHERE id = 'tenant_macon';

-- Step 3: Log the rollback
-- (same pattern as above)
```

---

## Automated Rollback Scripts

### Node.js Rollback Script

```typescript
// server/scripts/rollback-entity.ts
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

interface RollbackOptions {
  tenantId: string;
  entityType: string;
  entityId: string;
  toTimestamp?: Date; // Rollback to state at this time
  toChangeId?: string; // Rollback to specific change
}

async function rollbackEntity(options: RollbackOptions) {
  const { tenantId, entityType, entityId, toTimestamp, toChangeId } = options;

  // Find the target state
  let targetLog;
  if (toChangeId) {
    targetLog = await prisma.configChangeLog.findUnique({
      where: { id: toChangeId },
    });
  } else if (toTimestamp) {
    targetLog = await prisma.configChangeLog.findFirst({
      where: {
        tenantId,
        entityType,
        entityId,
        createdAt: { lte: toTimestamp },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!targetLog || !targetLog.afterSnapshot) {
    throw new Error('Cannot find target state for rollback');
  }

  // Restore entity to target state
  // This would need entity-specific logic
  console.log('Rollback target state:', targetLog.afterSnapshot);

  // For Package:
  if (entityType === 'Package') {
    await prisma.package.update({
      where: { id: entityId },
      data: targetLog.afterSnapshot as any,
    });
  }

  // Log the rollback operation
  await prisma.configChangeLog.create({
    data: {
      tenantId,
      changeType: targetLog.changeType,
      operation: 'update',
      entityType,
      entityId,
      email: 'system@elope.internal',
      role: 'PLATFORM_ADMIN',
      beforeSnapshot: {}, // Current state
      afterSnapshot: targetLog.afterSnapshot,
      reason: `Automated rollback to change ${toChangeId || toTimestamp}`,
    },
  });

  console.log('✅ Rollback completed');
}

// Usage:
// npm run script -- rollback-entity.ts tenant_macon Package pkg_classic 2025-01-01
```

---

## Production Safeguards

### Pre-Rollback Checklist

- [ ] **Verify Tenant ID** - Confirm you're operating on correct tenant
- [ ] **Backup Current State** - Export current entity state before rollback
- [ ] **Check Dependencies** - Ensure rollback won't break related entities
- [ ] **Notify Stakeholders** - Inform tenant admin if customer-facing change
- [ ] **Test in Staging** - Try rollback on staging tenant first if possible

### Rollback Monitoring

```sql
-- Monitor rollback operations
SELECT
  "tenantId",
  "entityType",
  COUNT(*) as rollback_count
FROM "ConfigChangeLog"
WHERE reason ILIKE '%rollback%'
  AND "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY "tenantId", "entityType"
ORDER BY rollback_count DESC;
```

### Emergency Rollback (Last 24 Hours)

```sql
-- Find all changes in last 24 hours for emergency rollback
SELECT
  id,
  "tenantId",
  "entityType",
  "entityId",
  operation,
  email,
  "createdAt",
  reason
FROM "ConfigChangeLog"
WHERE "tenantId" = 'tenant_affected'
  AND "createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" DESC;
```

---

## Forward Fix vs. Rollback Decision Tree

```
Is the change < 1 hour old?
├─ YES: Rollback is safe
└─ NO: Has customer data been affected?
    ├─ YES: Forward fix (preserve bookings/payments)
    └─ NO: Rollback acceptable if low-risk

Has money changed hands?
├─ YES: Forward fix only (financial audit trail)
└─ NO: Rollback acceptable

Multiple entities affected?
├─ YES: Forward fix (complex rollback risky)
└─ NO: Rollback acceptable

Customer-facing impact?
├─ YES: Coordinate with tenant before rollback
└─ NO: Rollback acceptable with internal notification
```

---

## Support Contacts

For rollback assistance:

- **Development Team:** Consult audit log queries
- **Platform Admin:** Execute manual SQL rollbacks
- **Tenant Admin:** Cannot rollback (contact support)

---

**Last Updated:** January 10, 2025
**Sprint:** 2.1 - Audit Logging System
