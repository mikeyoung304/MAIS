# Sprint 2.1: CLI Scripts & Automation Audit Strategy

## Overview

This document reviews all CLI scripts, automation tools, and non-request-context mutations in the Elope codebase and defines the audit strategy for each.

---

## CLI Scripts Inventory

### 1. `server/create-macon-tenant.ts`

**Purpose:** One-time tenant creation script for Macon, GA tenant

**Mutations:**

- Creates Tenant record with initial branding
- Sets commission percentage
- Generates API keys

**Audit Strategy:** ✅ **SKIP AUDITING**

**Rationale:**

- One-time setup script (not production automation)
- Creates initial state (no "before" state to audit)
- Can be re-run safely (uses upsert)
- Branding changes after creation WILL be audited

**Recommendation:** Acceptable to skip audit logging

---

### 2. `server/fix-admin-user.ts`

**Purpose:** Updates admin user email and password

**Mutations:**

- Modifies User table only
- Changes email from admin@example.com to admin@elope.com

**Audit Strategy:** ✅ **OUT OF SCOPE**

**Rationale:**

- User table is NOT in audit scope (Sprint 2.1 focuses on Package/Branding/Blackout)
- Platform admin operations (not tenant-scoped)
- One-time migration script

**Recommendation:** No audit required (User changes not tracked in Sprint 2.1)

---

### 3. `server/prisma/seed.ts`

**Purpose:** Seeds database with sample data for development

**Mutations:**

- Creates User (admin)
- Creates Packages (classic, garden, luxury)
- Creates AddOns
- Creates BlackoutDate (Christmas)
- Links packages to add-ons

**Audit Strategy:** ✅ **SKIP AUDITING**

**Rationale:**

- Development/test data only (not production)
- Initial seed (no before state)
- Creates sample data for local development
- Uses upsert (idempotent)

**Recommendation:** Acceptable to skip audit logging

---

## Automation Inventory

### Cron Jobs

**Status:** ❌ **NONE FOUND**

No cron jobs or scheduled tasks exist in the codebase.

**Future Recommendation:** When adding cron jobs, use system audit context:

```typescript
const SYSTEM_AUDIT_CONTEXT = {
  email: 'system@elope.internal',
  role: 'PLATFORM_ADMIN' as const,
  userId: undefined,
};
```

---

### Batch Import/Export

**Status:** ❌ **NONE FOUND**

No batch import or export functionality exists.

**Future Recommendation:** Batch operations should:

1. Log each entity mutation individually
2. Use system context with metadata indicating batch ID
3. Include reason field: "Batch import - ID: batch_123"

---

### Migration Scripts

**Status:** ✅ **NONE WITH DATA CHANGES**

Prisma migrations found, but no data migrations that modify Package/Branding/Blackout.

**Future Recommendation:** Data migrations should log changes with system context.

---

## Edge Cases & Special Scenarios

### 1. Error Handlers

**Question:** Do error handlers modify data?

**Answer:** ❌ NO

Error handlers in `server/src/middleware/error-handler.ts` only log errors, do not mutate tenant data.

---

### 2. Webhook Handlers

**Question:** Do webhooks modify audited entities?

**Answer:** ✅ PARTIALLY

**File:** `server/src/routes/webhooks.routes.ts`

**Mutations:**

- Updates Booking status (NOT in audit scope)
- No Package/Branding/Blackout modifications

**Audit Strategy:** ✅ **NO AUDIT REQUIRED** (Bookings not in Sprint 2.1 scope)

---

### 3. Admin Tools

**Question:** Are there any CLI admin tools?

**Answer:** ❌ NO

No additional admin CLI tools found beyond the 3 scripts listed above.

---

### 4. Background Jobs

**Question:** Any background processing?

**Answer:** ❌ NO

No background job processors (Bull, BeeQueue, etc.) configured.

---

## Audit Strategy Summary

### Current Scripts (All Acceptable)

| Script                 | Mutations         | Audit? | Rationale      |
| ---------------------- | ----------------- | ------ | -------------- |
| create-macon-tenant.ts | Tenant + Branding | NO     | One-time setup |
| fix-admin-user.ts      | User table        | NO     | Out of scope   |
| prisma/seed.ts         | All tables        | NO     | Dev/test data  |

### Future Automation (Guidelines)

| Type            | Audit Required? | Context                   |
| --------------- | --------------- | ------------------------- |
| Cron jobs       | YES             | System context            |
| Batch imports   | YES             | System context + batch ID |
| Data migrations | YES             | System context + reason   |
| Webhooks        | CONDITIONAL     | Depends on entity         |
| Error handlers  | NO              | Read-only                 |

---

## System Audit Context Pattern

For future automation that requires audit logging:

```typescript
// Define system user for automation
export const SYSTEM_AUDIT_CONTEXT = {
  email: 'system@elope.internal',
  role: 'PLATFORM_ADMIN' as const,
  userId: undefined,
};

// Usage in cron job
async function processScheduledPriceUpdates() {
  const updates = await getScheduledPriceUpdates();

  for (const update of updates) {
    await catalogService.updatePackage(
      update.tenantId,
      update.packageId,
      { priceCents: update.newPrice },
      {
        ...SYSTEM_AUDIT_CONTEXT,
        metadata: {
          automationType: 'scheduled_price_update',
          scheduleId: update.scheduleId,
          triggeredAt: new Date().toISOString(),
        },
        reason: `Scheduled price update: ${update.reason}`,
      }
    );
  }
}
```

---

## Migration Path for CLI Scripts

### Phase 1: Current State (Sprint 2.1) ✅

- Setup scripts skip auditing (acceptable)
- All production mutations via API are audited

### Phase 2: Production Automation (Sprint 5+)

- Add system audit context to any new automation
- Cron jobs MUST audit changes
- Batch operations MUST audit each entity

### Phase 3: Comprehensive Audit (Sprint 6+)

- Audit User table changes (platform admin operations)
- Audit Booking mutations (currently out of scope)
- Add audit log viewer UI for ops team

---

## Verification Checklist

- [x] All CLI scripts reviewed
- [x] No cron jobs found
- [x] No batch operations found
- [x] No data migrations with tenant data
- [x] Webhooks reviewed (Bookings only, out of scope)
- [x] System audit context pattern documented
- [x] Future automation guidelines established

---

## Questions & Answers

**Q: Should seed scripts audit in production?**
A: Seeds should NOT run in production. If they must, use system context.

**Q: How to audit CLI tools run by support team?**
A: Support tools should prompt for reason and use system context with support ticket ID in metadata.

**Q: What if automation fails mid-batch?**
A: Audit logs will show partial completion. Use batch ID in metadata to identify related changes.

**Q: Should audit log itself be auditable?**
A: No. ConfigChangeLog is append-only, no updates/deletes allowed. Modifications require direct database access.

---

**Last Updated:** January 10, 2025
**Sprint:** 2.1 - Audit Logging System
**Status:** COMPLETE - All CLI scripts reviewed, none require audit logging
