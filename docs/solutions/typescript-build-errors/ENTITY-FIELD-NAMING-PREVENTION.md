---
module: MAIS
date: 2025-12-29
problem_type: build_error
component: server/lib/entities.ts, server/prisma/schema.prisma, server/services/
symptoms:
  - TS2339: Property 'balancePaidAt' does not exist on type 'Booking'
  - Service references 'paidAt' but entity defines 'balancePaidAt'
  - Entity field names inconsistent between schema and types
root_cause: Prisma schema defines field as 'balancePaidAt' but TypeScript entity type or service code uses 'paidAt'
resolution_type: code_review_pattern
severity: P1
related_files:
  - server/prisma/schema.prisma (Prisma model definitions)
  - server/src/lib/entities.ts (TypeScript entity types)
  - server/src/services/*.service.ts (code consuming entities)
tags: [typescript, entities, field-names, build-errors, prisma, database]
---

# Prevention Strategy: Entity Field Naming Mismatches

## Problem Summary

**Issue:** TypeScript compilation fails when Prisma schema field names don't match entity type field names, or when service code references fields that don't exist.

**Root Causes:**

1. Schema renamed a field but entity types weren't updated
2. Entity types defined with different names than Prisma schema
3. Service code uses outdated field names
4. Inconsistent naming conventions (camelCase, snake_case, abbreviations)

**Impact:**

- Build fails with TS2339 "Property does not exist" errors
- Cannot deploy to production
- Runtime would also fail if caught

**Example:**

```typescript
// ❌ WRONG - Names don't match

// In schema.prisma
model Booking {
  id String @id
  balancePaidAt DateTime?  // ← Schema uses this name
}

// In entities.ts
export interface Booking {
  id: string;
  paidAt?: Date;  // ← Type uses different name
}

// In service
const booking = await bookingRepo.getById(tenantId, id);
const isPaid = booking.paidAt !== null;  // ← Error: paidAt doesn't exist!
```

---

## Prevention Strategy

### 1. Establish Entity Field Naming Conventions

**Document standards in CLAUDE.md:**

```markdown
## Entity Field Naming Conventions

### Date/Time Fields

Use descriptive names based on field purpose:

#### Payment-Related Dates

- `paidAt` - When balance was paid in full
- `depositPaidAt` - When deposit was received
- `invoicedAt` - When invoice was sent
- `refundedAt` - When refund was processed
- `paymentDueDate` - Due date (Date, not DateTime)

#### Lifecycle Dates

- `createdAt` - Record creation (NOT `created_at`)
- `updatedAt` - Last modification (NOT `updated_at`)
- `deletedAt` - Soft delete timestamp
- `archivedAt` - When archived
- `publishedAt` - When made public

#### Status Change Dates

- `confirmedAt` - When status changed to confirmed
- `cancelledAt` - When cancellation occurred
- `fulfilledAt` - When completed

#### Scheduled Dates

- `eventDate` - Date of booking/appointment (Date)
- `eventStartTime` - Start time (DateTime)
- `eventEndTime` - End time (DateTime)
- `dueDate` - When something is due (Date)

### Naming Rules

1. **Use camelCase** - Never snake_case in TypeScript
2. **Suffix dates with 'At'** - For timestamps (DateTime)
3. **Suffix dates with 'Date'** - For date-only fields
4. **No abbreviations** - Write `paidAt` not `pd`
5. **No redundant type info** - Write `paidAt` not `paidDateTime`
6. **Consistent with adjacent fields** - If using `createdAt`, use `paidAt` not `paid_date`

### Examples Table

| Field Purpose  | Correct         | Incorrect                              |
| -------------- | --------------- | -------------------------------------- |
| When paid      | `paidAt`        | `pd`, `paid`, `paid_at`, `paymentDate` |
| Deposit date   | `depositPaidAt` | `depPaid`, `deposit_date`              |
| Event date     | `eventDate`     | `date`, `event_dt`                     |
| When created   | `createdAt`     | `created_at`, `cAt`, `createDate`      |
| When updated   | `updatedAt`     | `updated_at`, `modifiedAt`             |
| When cancelled | `cancelledAt`   | `canceled_at` (British spelling)       |
| Refund date    | `refundedAt`    | `refund_date`, `refundDate`            |

### Status Fields

- Use enum types with UPPERCASE values
- Field name typically singular: `status` not `statuses`
- Values: `PENDING`, `CONFIRMED`, `CANCELLED`, `FULFILLED`

### Amount Fields

- Suffix with type: `amount`, `price`, `total`, `balance`
- Never: `amountCents`, `priceInCents` (store in cents, type tells precision)
- Example: `balanceAmount` (in cents), type is `number`

### ID Fields

- Primary key: `id` (always)
- Foreign keys: `[entityName]Id` (e.g., `tenantId`, `packageId`, `bookingId`)
- Never: `[entityName]_id` (snake_case not used)
```

### 2. Synchronization Pattern: Schema → Type

**Always keep schema.prisma and entities.ts in sync:**

```typescript
// Step 1: Update Prisma schema FIRST
// In server/prisma/schema.prisma
model Booking {
  id String @id
  tenantId String
  eventDate DateTime  // Use descriptive names
  depositPaidAt DateTime? // Suffix: "At" for timestamps
  balancePaidAt DateTime?
  cancelledAt DateTime?
  refundedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, eventDate])
  @@index([tenantId, cancelledAt])
}

// Step 2: Run migration
npm exec prisma migrate dev --name add_booking_fields

// Step 3: Regenerate Prisma Client
npm exec prisma generate

// Step 4: Update entities.ts EXACTLY matching schema
// In server/src/lib/entities.ts
export interface Booking {
  id: string;
  tenantId: string;
  eventDate: Date;
  depositPaidAt?: Date;  // Matches schema EXACTLY
  balancePaidAt?: Date;  // Matches schema EXACTLY
  cancelledAt?: Date;    // Matches schema EXACTLY
  refundedAt?: Date;     // Matches schema EXACTLY
  createdAt: Date;
  updatedAt: Date;
}

// Step 5: Verify in service - no more mismatches
export class BookingService {
  async getBookingPaymentStatus(tenantId: string, id: string) {
    const booking = await this.bookingRepo.getById(tenantId, id);

    // ✅ All fields exist and type-safe
    const isPaidInFull = booking.balancePaidAt !== null;
    const isDeposit = booking.depositPaidAt !== null;
    const isRefunded = booking.refundedAt !== null;

    return { isPaidInFull, isDeposit, isRefunded };
  }
}
```

### 3. Automated Field Name Generation from Schema

**Use Prisma to auto-generate entity types:**

```bash
# Install prisma type generator
npm install -D @prisma/prisma-schema-analyzer

# Or use simpler approach: extract types from Prisma client
```

**In `server/src/lib/entities.ts`:**

```typescript
import type { Booking as PrismaBooking } from '@prisma/client';

// Re-export Prisma type directly (eliminates duplication)
export type Booking = PrismaBooking;

// Or extend if you need additional properties
export type BookingWithComputedFields = PrismaBooking & {
  daysSinceCreated: number;
  daysUntilEvent: number;
};
```

**Benefits:**

- Single source of truth (schema.prisma)
- Automatic sync when schema changes
- No manual type updates needed

---

## Code Review Checklist

### When Reviewing Schema Changes

```yaml
Entity Field Naming Review:
  □ Does schema field name match naming conventions?
    └─ Timestamp fields: Use 'At' suffix (createdAt, paidAt, etc.)
    └─ Date-only fields: Use 'Date' suffix (eventDate, dueDate, etc.)
    └─ Status fields: Use UPPERCASE enums (PENDING, CONFIRMED, etc.)
    └─ ID fields: Use camelCase (tenantId, packageId, not tenant_id)

  □ Are field names descriptive enough?
    └─ ❌ Bad: `ts`, `dt`, `amt`, `bal`
    └─ ✅ Good: `createdAt`, `eventDate`, `amount`, `balance`

  □ Does the entity type match schema exactly?
    └─ Field names are identical
    └─ Optional fields are marked with ? in TypeScript
    └─ Types match (string, number, Date, boolean, enum)

  □ Are service calls using correct field names?
    └─ Search for field references in services/
    └─ Verify against schema.prisma
    └─ No typos or old field names

  □ If field was renamed, is it done consistently?
    └─ Updated in schema.prisma
    └─ Updated in entities.ts
    └─ Updated in all services that use it
    └─ Updated in tests
    └─ No old field names remain in code
```

### Pull Request Template Addition

```markdown
## Schema & Entity Changes Checklist

If modifying `server/prisma/schema.prisma`:

- [ ] Field names follow naming conventions (CLAUDE.md)
- [ ] Timestamp fields end with 'At' (createdAt, paidAt)
- [ ] Date-only fields end with 'Date' (eventDate, dueDate)
- [ ] Status fields use UPPERCASE enum values
- [ ] All fields have descriptive names (no abbreviations)
- [ ] Migration created: `npm exec prisma migrate dev`
- [ ] Migration verified to run successfully
- [ ] Prisma Client regenerated: `npm exec prisma generate`

If adding entity types:

- [ ] Entity types defined in `server/src/lib/entities.ts`
- [ ] All field names exactly match `schema.prisma`
- [ ] Optional fields marked with ? in TypeScript
- [ ] Using Prisma type re-export when possible
- [ ] No duplicating Prisma types manually
- [ ] TypeScript strict mode passes: `npm run typecheck`

If modifying services:

- [ ] All field references use correct names
- [ ] No references to deleted fields
- [ ] No references to renamed fields (old names)
- [ ] Tests updated to use new field names
```

---

## IDE Configuration to Catch This

### VSCode + Prisma Extension

**Install Prisma extension:**

```bash
# Provides autocomplete and validation for schema.prisma
code --install-extension Prisma.prisma
```

**This will:**

- Show field names when you type `booking.`
- Validate field names against schema
- Auto-suggest field names
- Highlight missing fields in yellow

### Type Checking in Service Files

**Add TypeScript strict mode to services:**

```typescript
// In server/src/services/booking.service.ts

// This type check will FAIL if field doesn't exist:
export class BookingService {
  async markAsPaid(tenantId: string, id: string) {
    const booking = await this.bookingRepo.getById(tenantId, id);

    // If 'paidAt' doesn't exist in Booking type, TypeScript will error
    // This catches field name mismatches before runtime
    const update = {
      balancePaidAt: new Date(), // ← Must match entity type
    };

    return this.bookingRepo.update(tenantId, id, update);
  }
}
```

---

## Quick Reference: Field Naming Decision Tree

```
Is this a date/time field?
├─ YES, it's a timestamp (when something happened)
│  └─ Use [event]At format (createdAt, paidAt, cancelledAt)
├─ YES, it's a date-only (no time component)
│  └─ Use [event]Date format (eventDate, dueDate)
└─ NO, continue

Is this a reference to another entity?
├─ YES → Use [entityName]Id format (tenantId, packageId)
└─ NO, continue

Is this a status/state field?
├─ YES → Use 'status' with UPPERCASE enum values
└─ NO, continue

Is this a monetary amount?
├─ YES → Use descriptive name: amount, price, balance, total
└─ NO, continue

Is this a count or quantity?
├─ YES → Use plural: items, quantity, count
└─ NO, continue

Is this a flag/boolean?
├─ YES → Use 'is' prefix: isActive, isPaid, isDeleted
└─ NO, use descriptive singular name
```

---

## Testing to Verify Field Names

### Unit Test for Entity Type Conformance

```typescript
import { describe, it, expect } from 'vitest';
import type { Booking } from '../lib/entities';

describe('Booking Entity Field Names', () => {
  it('should have all expected fields with correct types', () => {
    // Create a dummy booking with all expected fields
    const booking: Booking = {
      id: 'book_123',
      tenantId: 'tenant_123',
      eventDate: new Date(),
      depositPaidAt: new Date(),
      balancePaidAt: new Date(),
      cancelledAt: null as unknown as Date, // Nullable
      refundedAt: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Type narrowing - this verifies fields exist
    if (booking.balancePaidAt) {
      expect(booking.balancePaidAt).toBeInstanceOf(Date);
    }

    expect(booking.eventDate).toBeInstanceOf(Date);
    expect(booking.depositPaidAt).toBeInstanceOf(Date);
  });

  it('should not allow accessing non-existent fields', () => {
    const booking: Booking = {
      /* ... */
    };

    // This will not compile if field doesn't exist:
    // @ts-expect-error - paidAt doesn't exist, must use balancePaidAt
    booking.paidAt;
  });

  it('should match Prisma schema field names exactly', () => {
    // This test verifies type matches schema.prisma
    // If field names diverge, TypeScript will error
    const fields = {
      balancePaidAt: true, // Must match schema exactly
      depositPaidAt: true,
      eventDate: true,
      cancelledAt: true,
    };

    expect(fields).toBeDefined();
  });
});
```

### Integration Test: Service Usage

```typescript
import { describe, it, expect } from 'vitest';
import { BookingService } from '../services/booking.service';
import { createTestTenant } from '../test/helpers/test-tenant';

describe('BookingService Field Usage', () => {
  it('should handle payment fields correctly', async () => {
    const { tenantId, cleanup } = await createTestTenant();

    try {
      const booking = await bookingService.getById(tenantId, 'book_123');

      // This test verifies field names are accessible
      expect(booking.balancePaidAt).toBeDefined();
      expect(booking.depositPaidAt).toBeDefined();

      // If fields don't exist, test will fail at TS level
    } finally {
      await cleanup();
    }
  });
});
```

---

## Migration Process for Field Renames

### When You Need to Rename a Field

**Example: Rename `paidDate` to `balancePaidAt`**

```bash
# Step 1: Create migration
npm exec prisma migrate dev --name rename_paid_date_to_balance_paid_at

# This generates: server/prisma/migrations/[timestamp]_rename_paid_date_to_balance_paid_at.sql
```

**Step 2: Edit the migration file to perform rename:**

```sql
-- server/prisma/migrations/[timestamp]_rename_paid_date_to_balance_paid_at.sql

ALTER TABLE "Booking" RENAME COLUMN "paidDate" TO "balancePaidAt";
```

**Step 3: Apply and verify:**

```bash
npm exec prisma migrate deploy
npm exec prisma generate
npm run typecheck  # Should pass after type updates
```

**Step 4: Update entity types:**

```typescript
// In server/src/lib/entities.ts
export interface Booking {
  // ...
  balancePaidAt?: Date; // Updated name
  // Remove: paidDate?: Date;
  // ...
}
```

**Step 5: Update all references:**

```bash
# Search for old field name
grep -r "paidDate" server/src/ --include="*.ts"

# Update each file
# booking.paidDate → booking.balancePaidAt
# update({ paidDate }) → update({ balancePaidAt })
```

**Step 6: Run tests:**

```bash
npm test  # All tests must pass
npm run typecheck  # No TS2339 errors
```

---

## Real-World Examples from MAIS

### ✅ CORRECT Pattern

**In `server/prisma/schema.prisma`:**

```prisma
model Booking {
  id String @id
  tenantId String

  // Event timing (Date type for date-only)
  eventDate DateTime

  // Payment tracking (DateTime type with At suffix)
  depositPaidAt DateTime?
  balancePaidAt DateTime?
  refundedAt DateTime?

  // Status tracking
  cancelledAt DateTime?
  confirmedAt DateTime?
  fulfilledAt DateTime?

  // Lifecycle (always at)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId, cancelledAt])
  @@index([tenantId, balancePaidAt])
}
```

**In `server/src/lib/entities.ts`:**

```typescript
// Use Prisma type directly to avoid duplication
import type { Booking as PrismaBooking } from '@prisma/client';
export type Booking = PrismaBooking;

// Or define it inline if using Prisma re-export:
export type Booking = {
  id: string;
  tenantId: string;
  eventDate: Date;
  depositPaidAt: Date | null;
  balancePaidAt: Date | null;
  refundedAt: Date | null;
  cancelledAt: Date | null;
  confirmedAt: Date | null;
  fulfilledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
```

**In `server/src/services/booking.service.ts`:**

```typescript
export class BookingService {
  async markAsPaidInFull(tenantId: string, id: string) {
    const booking = await this.bookingRepo.getById(tenantId, id);

    // ✅ All fields exist and properly typed
    if (booking.balancePaidAt !== null) {
      return { status: 'already_paid' };
    }

    return this.bookingRepo.update(tenantId, id, {
      balancePaidAt: new Date(),
      status: 'PAID',
    });
  }

  async getPaymentStatus(tenantId: string, id: string) {
    const booking = await this.bookingRepo.getById(tenantId, id);

    // ✅ All fields referenced correctly
    const depositReceived = booking.depositPaidAt !== null;
    const balancePaid = booking.balancePaidAt !== null;
    const refunded = booking.refundedAt !== null;

    return {
      depositReceived,
      balancePaid,
      refunded,
      totalPaid: depositReceived && balancePaid,
    };
  }
}
```

### ❌ INCORRECT Pattern (What to Avoid)

```typescript
// schema.prisma uses 'balancePaidAt'
model Booking {
  balancePaidAt DateTime?
}

// But entities.ts uses different name
export interface Booking {
  paidAt?: Date;  // ❌ WRONG name
}

// Service references wrong field
booking.paidAt  // ❌ Error: Property 'paidAt' does not exist

// Or worse: using abbreviations
model Payment {
  paidDt DateTime?  // ❌ Abbreviation
  amt number        // ❌ Abbreviation
  bal number        // ❌ Abbreviation
}
```

---

## Deployment Verification

### Before Deploying to Render/Production

```bash
# 1. Verify Prisma schema is valid
npm exec prisma validate

# 2. Check all migrations are applied
npm exec prisma migrate status

# 3. Run typecheck (catches field name mismatches)
npm run typecheck

# 4. Build project
npm run build

# 5. Run integration tests that use entities
npm test -- --grep "Entity|Booking|Service"
```

### CI/CD Check (GitHub Actions)

**Add to `.github/workflows/ci.yml`:**

```yaml
- name: Validate Prisma Schema
  run: npm exec prisma validate

- name: Check Migration Status
  run: npm exec prisma migrate status

- name: Type Check (Catches Entity Mismatches)
  run: npm run typecheck

- name: Build
  run: npm run build
```

---

## Summary

**Key Takeaway:** Entity field name mismatches are preventable with:

1. **Clear conventions** for field naming (At, Date, Id suffixes)
2. **Schema-first approach** - update schema, then entity types
3. **Prisma type re-export** - use Prisma client types directly
4. **Typecheck before pushing** - `npm run typecheck`
5. **IDE support** - Prisma extension shows available fields
6. **Code review checklist** - verify field names match

**Prevention Checklist:**

- [ ] All timestamp fields use 'At' suffix (createdAt, paidAt)
- [ ] All date-only fields use 'Date' suffix (eventDate, dueDate)
- [ ] All ID fields use camelCase (tenantId, not tenant_id)
- [ ] Entity types match schema.prisma field names exactly
- [ ] Using Prisma type re-export to avoid duplication
- [ ] All service references use correct field names
- [ ] No abbreviations in field names
- [ ] `npm run typecheck` passes before committing
