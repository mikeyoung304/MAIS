---
module: MAIS
date: 2025-12-27
problem_type: required_reading
component: all
symptoms:
  - Critical patterns all agents must know before code generation
  - Cross-tenant data leakage prevention
  - Type safety and build stability
root_cause: institutional_knowledge
resolution_type: reference_doc
severity: P0
tags: [required-reading, critical-patterns, multi-tenant, security, typescript]
---

# MAIS Critical Patterns (Required Reading)

**Purpose:** Patterns that ALL agents must apply before generating code. These prevent P0/P1 issues.

**When to read:** Before ANY code generation, planning, or review task.

---

## Pattern 1: Multi-Tenant Query Isolation

**Impact:** P0 - Cross-tenant data leakage (security vulnerability)

```typescript
// ❌ WRONG - Returns data from ALL tenants
const packages = await prisma.package.findMany({
  where: { active: true },
});

// ✅ CORRECT - Always scope by tenantId FIRST
const packages = await prisma.package.findMany({
  where: { tenantId, active: true },
});
```

**Rule:** Every Prisma query MUST include `tenantId` in the WHERE clause.

---

## Pattern 2: Tenant-Scoped Cache Keys

**Impact:** P0 - Cache returns wrong tenant's data

```typescript
// ❌ WRONG - Cache key collision across tenants
const key = 'catalog:packages';
const key = `packages:${packageId}`;

// ✅ CORRECT - Include tenantId in cache key
const key = `tenant:${tenantId}:catalog:packages`;
const key = `tenant:${tenantId}:packages:${packageId}`;
```

**Rule:** All cache keys MUST include `tenant:${tenantId}:` prefix.

---

## Pattern 3: Repository Interface Signature

**Impact:** P1 - Forgetting tenant isolation in new queries

```typescript
// ❌ WRONG - tenantId optional or missing
interface PackageRepository {
  getById(id: string): Promise<Package>;
  getAll(): Promise<Package[]>;
}

// ✅ CORRECT - tenantId REQUIRED as first parameter
interface PackageRepository {
  getById(tenantId: string, id: string): Promise<Package>;
  getAll(tenantId: string): Promise<Package[]>;
}
```

**Rule:** Repository methods MUST require `tenantId` as first parameter.

---

## Pattern 4: Email Normalization

**Impact:** P1 - Duplicate accounts from case variations

```typescript
// ❌ WRONG - Case-sensitive email matching
const user = await prisma.user.findUnique({
  where: { email: inputEmail },
});

// ✅ CORRECT - Normalize before storage AND queries
const email = inputEmail.toLowerCase().trim();
const user = await prisma.user.findUnique({
  where: { email },
});
```

**Rule:** Always normalize email with `.toLowerCase().trim()` before storage and lookup.

---

## Pattern 5: Single Prisma Client Instance

**Impact:** P1 - Connection pool exhaustion, database errors

```typescript
// ❌ WRONG - Creating new instances
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ✅ CORRECT - Use DI container singleton
import { container } from '../di';
const prisma = container.prisma;

// In services/adapters - inject via constructor
constructor(private readonly prisma: PrismaClient) {}
```

**Rule:** Never instantiate `new PrismaClient()`. Always use DI container.

---

## Pattern 6: ts-rest Route Handler Types

**Impact:** P2 - Incorrect "fix" breaks build, library limitation

```typescript
// ❌ WRONG - Removing `any` breaks ts-rest
const handler: AppRoute = async ({ req }) => { ... };

// ✅ CORRECT - Keep `{ req: any }` for ts-rest compatibility
const handler: AppRoute = async ({ req }: { req: any }) => { ... };
```

**Rule:** ts-rest route handlers REQUIRE `{ req: any }`. This is a library limitation, not a bug.

**Reference:** [ts-rest-any-type-library-limitations](../best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md)

---

## Pattern 7: Foreign Key Ownership Validation

**Impact:** P1 - Cross-tenant resource access

```typescript
// ❌ WRONG - Accept foreign key without validation
await createBooking({
  packageId: input.packageId, // Could belong to different tenant!
});

// ✅ CORRECT - Validate ownership first
const pkg = await packageService.getById(tenantId, input.packageId);
if (!pkg) throw new NotFoundError('Package not found');
await createBooking({ packageId: pkg.id });
```

**Rule:** Validate foreign key ownership by fetching through tenant-scoped service.

---

## Pattern 8: Logger Instead of Console

**Impact:** P2 - No structured logging, debugging issues

```typescript
// ❌ WRONG - console.log in production code
console.log('Creating booking', data);

// ✅ CORRECT - Use structured logger
logger.info({ action: 'booking_created', tenantId, bookingId }, 'Booking created');
```

**Rule:** Use `logger` from `@/lib/logger` or `server/src/lib/core/logger`. Never `console.log`.

---

## Pattern 9: Prisma JSON Field Updates

**Impact:** P2 - TypeScript build failures

```typescript
// ❌ WRONG - Direct object assignment
await prisma.package.update({
  data: { photos: newPhotos },
});

// ✅ CORRECT - Cast to Prisma.InputJsonValue
import { Prisma } from '../../generated/prisma';
await prisma.package.update({
  data: { photos: newPhotos as Prisma.InputJsonValue },
});

// ✅ CORRECT - Clear JSON field
await prisma.package.update({
  data: { draftPhotos: Prisma.JsonNull },
});
```

**Rule:** JSON fields require `as Prisma.InputJsonValue` for updates, `Prisma.JsonNull` for clearing.

---

## Pattern 10: Advisory Locks for Race Conditions

**Impact:** P0 - Double bookings, data corruption

```typescript
// ❌ WRONG - Check-then-act without locking (TOCTOU vulnerability)
const existing = await prisma.booking.findFirst({ where: { date } });
if (existing) throw new ConflictError();
await prisma.booking.create({ data: { date } });

// ✅ CORRECT - Advisory lock + transaction
await prisma.$transaction(async (tx) => {
  const lockId = hashTenantDate(tenantId, date);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  const existing = await tx.booking.findFirst({ where: { tenantId, date } });
  if (existing) throw new BookingConflictError(date);

  await tx.booking.create({ data: { tenantId, date, ... } });
});
```

**Rule:** Use advisory locks + transactions for any check-then-act operations.

---

## Quick Checklist

Before generating code, verify:

- [ ] All queries include `tenantId` in WHERE clause
- [ ] Cache keys include `tenant:${tenantId}:` prefix
- [ ] Repository methods require `tenantId` as first param
- [ ] Email normalized with `.toLowerCase().trim()`
- [ ] Using DI container for Prisma (not `new PrismaClient()`)
- [ ] ts-rest handlers keep `{ req: any }` type
- [ ] Foreign keys validated through tenant-scoped service
- [ ] Using logger, not console.log
- [ ] JSON fields use proper Prisma types
- [ ] Race-prone operations use advisory locks

---

## Related Documentation

- [Prevention Strategies Index](../PREVENTION-STRATEGIES-INDEX.md) - Full navigation hub
- [Prevention Quick Reference](../PREVENTION-QUICK-REFERENCE.md) - Print and pin
- [Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)

---

**Last Updated:** 2025-12-27
**Maintainer:** Auto-generated from compound-engineering workflow
