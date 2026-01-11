# TypeScript Build Errors: Repository Interface Mismatches and Type Inference

**Date:** 2025-12-29
**Category:** Build Errors / Type Safety
**Severity:** P1 (Build Blocking)
**Status:** Resolved

## Overview

This document captures 5 common TypeScript build errors that occur when repository interfaces, data types, and imports don't match between service implementations and their dependencies. These are typically discovered during the build phase after code changes.

---

## Error 1: Wrong Method Name on Repository Interface

### Problem Description

Build error during compilation:

```
Property 'getById' does not exist on type 'BookingRepository'
```

Service code attempts to call `getById()` but the interface defines `findById()`.

### Root Cause Analysis

The `BookingRepository` interface was defined with the naming convention `find*` for read operations (following repository pattern best practices), but the service implementation used `get*` naming which doesn't match:

```typescript
// ❌ Interface defines findById
interface BookingRepository {
  findById(tenantId: string, id: string): Promise<Booking | null>;
  create(tenantId: string, data: CreateBookingInput): Promise<Booking>;
}

// ❌ Service calls getById (wrong name)
export class BookingService {
  constructor(private readonly bookingRepo: BookingRepository) {}

  async getBookingDetails(tenantId: string, id: string) {
    return this.bookingRepo.getById(tenantId, id); // ❌ Method doesn't exist
  }
}
```

### Solution

Change the service method call to match the repository interface exactly:

```typescript
// ✅ CORRECT: Match the interface name
export class BookingService {
  constructor(private readonly bookingRepo: BookingRepository) {}

  async getBookingDetails(tenantId: string, id: string) {
    return this.bookingRepo.findById(tenantId, id); // ✅ Correct method name
  }
}
```

### Key Insight

**Repository naming conventions are contracts.** In the MAIS codebase:

- Use `find*` for read operations (e.g., `findById`, `findBySlug`, `findMany`)
- Use `create*` for writes (e.g., `create`)
- Use `update*` for updates (e.g., `updateById`)
- Use `delete*` for deletes (e.g., `deleteById`)

These conventions are enforced across all repository interfaces in `server/src/lib/ports.ts`. When implementing a service, always reference the port (interface) definition first before calling repository methods.

---

## Error 2: Wrong Field Name in Update Input Type

### Problem Description

Build error during compilation:

```
'paidAt' does not exist in type 'BookingUpdateInput'
```

Service code attempts to set `paidAt` but the interface defines `balancePaidAt`.

### Root Cause Analysis

The `BookingUpdateInput` interface was designed with semantic precision—the field represents when the balance was paid, not just when it was paid. The service implementation used a generic name:

```typescript
// ❌ Interface defines balancePaidAt
type BookingUpdateInput = {
  status?: BookingStatus;
  balancePaidAt?: Date;
  notes?: string;
};

// ❌ Service uses wrong field name
async function markAsPaymentReceived(tenantId: string, id: string) {
  await this.bookingRepo.update(tenantId, id, {
    status: 'paid',
    paidAt: new Date(), // ❌ Field doesn't exist
  });
}
```

### Solution

Use the exact field name defined in the input type:

```typescript
// ✅ CORRECT: Match the interface field name
async function markAsPaymentReceived(tenantId: string, id: string) {
  await this.bookingRepo.update(tenantId, id, {
    status: 'paid',
    balancePaidAt: new Date(), // ✅ Correct field name
  });
}
```

### Key Insight

**Input types encode domain semantics.** In the MAIS codebase:

- `paidAt` could be ambiguous (deposit? full amount? partial?)
- `balancePaidAt` is explicit (the remaining balance was paid)
- Always use the most specific field name available

When adding new fields to update inputs, choose names that clarify the business logic. Search `packages/contracts/src/schemas/` to see how input types are defined before using them in services.

---

## Error 3: Private Property Naming Convention

### Problem Description

Build error during compilation:

```
Property 'eventEmitter' does not exist on type 'BookingService'
```

Service constructor injects `eventEmitter` but the property is stored as `_eventEmitter`.

### Root Cause Analysis

MAIS follows the TypeScript convention of prefixing private properties with underscore. The constructor parameter and the private property have different names:

```typescript
// ❌ Constructor parameter doesn't match private property
export class BookingService {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly eventEmitter: EventEmitter // ❌ Constructor param
  ) {}

  async createBooking(data: CreateBookingInput) {
    // ❌ Trying to access undefined private property
    this.eventEmitter.emit('booking:created', {
      /* ... */
    });
  }
}
```

The actual private property should be `_eventEmitter`:

```typescript
// ✅ CORRECT: Constructor parameter becomes prefixed private property
export class BookingService {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly _eventEmitter: EventEmitter // ✅ Private with underscore
  ) {}

  async createBooking(data: CreateBookingInput) {
    this._eventEmitter.emit('booking:created', {
      /* ... */
    }); // ✅ Access private property
  }
}
```

### Key Insight

**Private property naming is consistent across MAIS.** The pattern is:

- Constructor parameter: `camelCase` (no prefix)
- Private property: `_camelCase` (underscore prefix)

TypeScript automatically converts constructor parameters with `private readonly` into private properties. If you write `private readonly eventEmitter`, TypeScript creates `this._eventEmitter`. Always reference the underscore-prefixed name when accessing the property within the class.

**See also:** `docs/solutions/build-errors/typescript-unused-variables-build-failure.md` for when underscore prefixes should be used.

---

## Error 4: Wrong Import Source for Exported Function

### Problem Description

Build error during compilation:

```
Module '"./public-customer-chat.routes"' has no exported member 'registerCustomerProposalExecutor'
```

Import statement tries to get the function from the wrong file.

### Root Cause Analysis

The function `registerCustomerProposalExecutor` is defined in `executor-registry.ts` but the code tries to import it from `public-customer-chat.routes.ts`. These are different modules with different responsibilities:

```typescript
// ❌ Wrong import source
import { registerCustomerProposalExecutor } from '../agent/customer/public-customer-chat.routes';

// Later in code:
registerCustomerProposalExecutor(executor); // ❌ Function doesn't exist at this export location
```

The actual export is in the registry module:

```typescript
// server/src/agent/customer/executor-registry.ts
export function registerCustomerProposalExecutor(executor: Executor): void {
  customerExecutorRegistry.register(executor);
}

// server/src/agent/customer/public-customer-chat.routes.ts
// This file only exports route handlers, not the registry function
export const publicCustomerChatRouter = tsRestExpress(contract, {
  /* ... */
});
```

### Solution

Import from the correct source file:

```typescript
// ✅ CORRECT: Import from executor-registry.ts
import { registerCustomerProposalExecutor } from '../agent/customer/executor-registry';

// Later in code:
registerCustomerProposalExecutor(executor); // ✅ Function exists at this export location
```

### Key Insight

**Exports are module-specific.** Always:

1. Check which module actually exports the function (search with `export function <name>` or `export const <name>`)
2. Import from that module, not from a related module
3. Use IDE "Go to Definition" (Cmd+Click in VSCode) to verify the correct import path

In the MAIS agent architecture:

- `executor-registry.ts` - Manages executor registration
- `public-customer-chat.routes.ts` - Defines API routes
- These are separate concerns with different exports

---

## Error 5: Complex Type Inference Failure

### Problem Description

Build error during compilation:

```
Property 'where' does not exist on type...
```

When using `Parameters<typeof prisma.package.findMany>[0]` to infer the first parameter type, TypeScript can't determine the correct shape because the first parameter can be `undefined`.

### Root Cause Analysis

Prisma's `findMany` method accepts an optional first parameter. When using type inference with `Parameters`, TypeScript attempts to extract the argument type, but the union with `undefined` makes type narrowing fail:

```typescript
// ❌ Type inference fails because first parameter is optional
type FindManyPackageInput = Parameters<typeof prisma.package.findMany>[0];

function buildPackageQuery(tenantId: string): FindManyPackageInput {
  return {
    where: {
      // ❌ Property 'where' does not exist
      tenantId,
      active: true,
    },
  };
}
```

The type `Parameters<typeof prisma.package.findMany>[0]` resolves to `FindManyArgs | undefined`, which doesn't have a `where` property directly.

### Solution

Use the explicit Prisma input type instead of type inference:

```typescript
// ✅ CORRECT: Use explicit Prisma.PackageWhereInput
import { Prisma } from '@prisma/client';

function buildPackageQuery(tenantId: string): Prisma.PackageFindManyArgs {
  return {
    where: {
      // ✅ Property exists and is properly typed
      tenantId,
      active: true,
    },
    orderBy: { createdAt: 'desc' },
  };
}

// Or for just the where clause:
function buildPackageWhere(tenantId: string): Prisma.PackageWhereInput {
  return {
    tenantId,
    active: true,
  };
}
```

### Key Insight

**Prisma types are explicit and available.** Instead of trying to infer types from runtime values:

- Use `Prisma.<Model>FindManyArgs` for the full find query
- Use `Prisma.<Model>WhereInput` for the where clause
- Use `Prisma.<Model>CreateInput` for create operations
- Use `Prisma.<Model>UpdateInput` for update operations

These types are generated automatically by Prisma when you run `prisma generate`. They provide full TypeScript support and avoid the pitfalls of parameter type inference.

**See also:** `docs/solutions/database-issues/database-client-mismatch-MAIS-20251204.md` for more Prisma type patterns.

---

## Common Thread: Static Analysis During Build

All 5 errors share a pattern: **TypeScript's static type checker catches interface contract violations at build time**, not runtime. This is valuable because:

1. **Method name mismatches** (Error 1) - Repository interfaces are contracts
2. **Field name mismatches** (Error 2) - Input types enforce data shape
3. **Property access errors** (Error 3) - Private property naming is consistent
4. **Import resolution failures** (Error 4) - Module exports are specific
5. **Type inference limits** (Error 5) - Explicit types are more reliable than inference

### Prevention Strategy

Before committing code that touches services, repositories, or Prisma models:

```bash
# Run the full build to catch all type errors
npm run typecheck

# Fix in this order:
# 1. Check repository interface (server/src/lib/ports.ts) for correct method names
# 2. Check input types (packages/contracts/src/schemas/) for field names
# 3. Check constructor parameters match property names (with underscore)
# 4. Check import paths with "Go to Definition"
# 5. Use explicit Prisma types instead of inference
```

### Related Documentation

- `docs/solutions/best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md` - When `any` is acceptable
- `docs/solutions/logic-errors/cascading-entity-type-errors-MAIS-20251204.md` - Preventing type cascades
- `docs/solutions/build-errors/typescript-unused-variables-build-failure.md` - Underscore prefix decision tree
- `packages/contracts/src/schemas/` - All input/output type definitions
- `server/src/lib/ports.ts` - Repository interface definitions
