# TypeScript Build Guide

**Consolidated Guide for TypeScript Build Errors in MAIS**

This guide consolidates all TypeScript build error patterns, ts-rest integration issues, and quick fixes for the MAIS codebase.

---

## Quick Reference

### Pre-Commit Checklist

```bash
npm run typecheck           # Must pass
npm run lint                # Must pass
npm run build               # Must succeed
cd apps/web && npx tsc --noEmit  # Verify Next.js compatibility
```

### Common Error Types

| Error Code | Meaning                   | Quick Fix                                 |
| ---------- | ------------------------- | ----------------------------------------- |
| TS2339     | Property does not exist   | Check schema for correct property name    |
| TS2345     | Type mismatch in argument | Use type guard before assertion           |
| TS2322     | Type not assignable       | Check enum values match Prisma schema     |
| TS2307     | Cannot find module        | Check import path, verify symlink config  |
| TS6133     | Declared but never read   | Remove unused or prefix with `_`          |
| TS2694     | Cannot find namespace     | Use `import { Prisma }` not `import type` |

---

## Part 1: ts-rest Integration Issues

### The `{ req: any }` Pattern

ts-rest v3 has type compatibility issues with Express 4.x/5.x. The `any` type for req is **required** and must not be removed.

```typescript
// CORRECT - Required pattern for ts-rest
getPackages: async ({ req }: { req: any }) => {
  const tenantId = getTenantId(req as TenantRequest);
  // ...
};

// WRONG - Causes TS2345 errors
getPackages: async ({ req }: { req: Request }) => {
  // Type incompatibility with ts-rest
};
```

**Why:** ts-rest's internal type system doesn't align with Express's Request type. The `any` is handled safely because:

- Immediately cast to `TenantRequest` for downstream type safety
- Contract-driven types from Zod schemas drive type inference
- Interior of handlers remains fully typed

**Key Files:**

- `server/src/routes/index.ts` - Route handlers with `{ req: any }`
- `docs/solutions/best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md` - Full explanation

---

## Part 2: Prisma JSON Types

### Import Pattern

```typescript
// CORRECT - Import Prisma as value for runtime access
import { Prisma, type PrismaClient } from '../../generated/prisma';

// WRONG - Type-only import can't access Prisma.JsonNull
import type { Prisma } from '../../generated/prisma';
```

### JSON Field Writes

```typescript
// CORRECT - Cast to InputJsonValue
await prisma.package.update({
  data: {
    photos: photos as Prisma.InputJsonValue,
    draftPhotos: Prisma.JsonNull, // Clear JSON field
  },
});

// WRONG - Direct assignment fails
await prisma.package.update({
  data: { photos }, // Type error
});
```

### ChatMessage[] to Prisma JSON

```typescript
// CORRECT - Double assertion via unknown
await prisma.session.update({
  data: {
    messages: session.messages as unknown as Prisma.InputJsonValue,
  },
});

// WRONG - Direct cast fails
await prisma.session.update({
  data: { messages: session.messages }, // Type error
});
```

### Clearing JSON Fields

```typescript
// JSON fields use Prisma.JsonNull
draftPhotos: Prisma.JsonNull,

// String/number fields use null directly
draftTitle: null,
```

---

## Part 3: Property Name Mismatches

### Problem Pattern

Schema changes property name, but code still uses old name.

```typescript
// Schema has: heroImage String?
// Code uses:  segment.heroImageUrl  // WRONG - undefined

// CORRECT
if (segment.heroImage) {
  images.push({ url: segment.heroImage });
}
```

### Fix Process

```bash
# 1. Check schema for correct name
grep "heroImage" server/prisma/schema.prisma

# 2. Find all references to old name
rg "heroImageUrl" server/src/

# 3. Update and verify
npm run typecheck
```

---

## Part 4: Type-Safe Comparisons

### Unsafe Type Assertion

```typescript
// WRONG - Assertion before validation
const statusKey = booking.status.toLowerCase() as keyof typeof bookingsByStatus;
if (bookingsByStatus[statusKey]) { ... }  // May be undefined

// CORRECT - Validate then assert
const normalizedStatus = booking.status.toLowerCase().replace('_', '');
if (normalizedStatus in bookingsByStatus) {
  const statusKey = normalizedStatus as keyof typeof bookingsByStatus;
  bookingsByStatus[statusKey]++;
}
```

### Enum Comparisons

```typescript
// WRONG - String literal comparison
if (booking.status === 'depositpaid') {
}

// CORRECT - Use enum value
if (booking.status === BookingStatus.DEPOSIT_PAID) {
}
```

---

## Part 5: Unused Variables

### Decision Tree

```
Is the variable used ANYWHERE in the function body?
|
+-- YES (used in logger, assignment, conditional, template)
|   --> DO NOT prefix with _
|       The variable is used. TypeScript won't complain.
|
+-- NO (truly never referenced)
    |
    +-- Is it a required function parameter?
    |   +-- YES --> Prefix with _
    |   |          arr.map((_item, index) => index)
    |   +-- NO --> REMOVE IT
    |
    +-- Is it a destructured value you don't need?
        +-- YES --> const { needed, ..._ } = obj
        +-- NO --> REMOVE IT
```

### Common Fixes

```typescript
// Variable passed to logger IS used - DO NOT prefix
catch (error) {
  logger.error({ error }, 'Failed');  // error IS used
  throw new Error('Failed');
}

// Truly unused callback param - prefix with _
array.forEach((item, _index) => process(item));

// Remove unused destructured values
const { data } = await fetchData();  // Don't destructure error if not used
```

---

## Part 6: Repository Interface Mismatches

### Method Names

```typescript
// Interface defines findById
interface BookingRepository {
  findById(tenantId: string, id: string): Promise<Booking | null>;
}

// WRONG - Wrong method name
this.bookingRepo.getById(tenantId, id);

// CORRECT - Match interface exactly
this.bookingRepo.findById(tenantId, id);
```

### Field Names

```typescript
// Interface defines balancePaidAt
type BookingUpdateInput = {
  balancePaidAt?: Date;
};

// WRONG
{
  paidAt: new Date();
}

// CORRECT
{
  balancePaidAt: new Date();
}
```

### Import Sources

```typescript
// Function is in executor-registry.ts, not routes
// WRONG
import { registerExecutor } from './public-chat.routes';

// CORRECT
import { registerExecutor } from './executor-registry';
```

---

## Part 7: Agent Tool Requirements

### trustTier is Mandatory

Every `AgentTool` must have a `trustTier`:

```typescript
// CORRECT
{
  name: 'get_services',
  description: 'Get available services',
  parameters: z.object({ ... }),
  trustTier: 'T1'  // Required!
}

// Trust Tier Guide:
// T1: Read-only, auto-execute
// T2: Creates resources, soft-confirm
// T3: Bookings/payments, user-confirm
```

### SessionType Values

Only use Prisma-defined values:

```typescript
// CORRECT - Prisma enum values
sessionType: 'ADMIN' as const;
sessionType: 'CUSTOMER' as const;

// WRONG - Doesn't exist in Prisma
sessionType: 'BUSINESS' as const;
```

---

## Part 8: React Hook Ordering

Hooks must be called before any early returns:

```typescript
// WRONG - Hook after return
function Component({ data }) {
  if (!data) return null;  // Early return
  const handler = useCallback(() => {}, []);  // Error!
  return <button onClick={handler}>Click</button>;
}

// CORRECT - Hooks before returns
function Component({ data }) {
  const handler = useCallback(() => {}, []);  // Hook first
  if (!data) return null;  // Early return after
  return <button onClick={handler}>Click</button>;
}
```

---

## Part 9: Symlinks in TypeScript

### Problem

Symlinks in source directories cause path resolution failures:

```
server/src/adapters/lib -> ../lib   # Symlink
```

Import `../generated/prisma/client` resolves incorrectly through symlink.

### Fix

```json
// server/tsconfig.json
{
  "compilerOptions": {
    "preserveSymlinks": true
  },
  "exclude": [
    "src/adapters/lib" // Exclude symlink path
  ]
}
```

---

## Part 10: Configuration Alignment

### TypeScript Strictness

Ensure local matches production:

```json
// apps/web/tsconfig.json
{
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Pre-commit Hook

```bash
#!/bin/sh
npm run typecheck
cd apps/web && npx tsc --noEmit --noUnusedLocals --noUnusedParameters
```

---

## Code Review Checklist

### Schema Changes

- [ ] Prisma migration created (`prisma migrate dev`)
- [ ] Prisma Client regenerated (`prisma generate`)
- [ ] All property references updated across codebase
- [ ] No `rg "oldPropertyName"` results

### Type Safety

- [ ] No `as any` without justification
- [ ] Type guards before type assertions
- [ ] Explicit Prisma types (not inference)

### Imports

- [ ] `{ Prisma }` not `type { Prisma }` when using JsonNull
- [ ] Import paths verified with "Go to Definition"

### Tools and Sessions

- [ ] All AgentTools have `trustTier`
- [ ] SessionType uses 'ADMIN' or 'CUSTOMER' only
- [ ] ChatMessage[] uses double assertion to InputJsonValue

### React

- [ ] All hooks before any returns
- [ ] No conditional hook calls

---

## Quick Verification Commands

```bash
# Full TypeScript check
npm run typecheck

# Check for property mismatches
rg "propertyName" server/src/

# Find tools missing trustTier
grep -A5 "name:.*get_\|name:.*update_" server/src/agent/tools/*.ts | grep -B5 "parameters:" | grep -L "trustTier"

# Check for invalid SessionType
grep -rn "SessionType.*BUSINESS" server/src/

# Find type assertions in diff
git diff | grep "as "

# Verify Prisma types generated
git diff --name-only | grep "generated/prisma"

# Check symlink configuration
grep "preserveSymlinks" server/tsconfig.json
```

---

## Related Documentation

- `docs/solutions/best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md`
- `docs/solutions/best-practices/any-types-quick-reference-MAIS-20251204.md`
- `docs/solutions/database-issues/prisma-7-json-type-breaking-changes-MAIS-20260102.md`
- `docs/solutions/patterns/REACT_HOOKS_EARLY_RETURN_PREVENTION.md`

---

## Archived Source Files

The following files were consolidated into this guide:

| Original File                                                                    | Content                   |
| -------------------------------------------------------------------------------- | ------------------------- |
| `PRISMA-TYPESCRIPT-BUILD-PREVENTION.md`                                          | Prisma JSON types         |
| `TYPESCRIPT-TSREST-BUILD-ERROR.md`                                               | ts-rest `any` pattern     |
| `TYPESCRIPT-BUILD-AND-SEED-DRIFT-PREVENTION.md`                                  | Schema drift, seed config |
| `TYPESCRIPT-BUILD-CODE-REVIEW-CHECKLIST.md`                                      | Code review items         |
| `TYPESCRIPT-BUILD-ERRORS-RESOLUTION-20251227.md`                                 | Specific error fixes      |
| `TYPESCRIPT-BUILD-QUICK-REFERENCE.md`                                            | Quick reference card      |
| `build-errors/typescript-unused-variables-build-failure-MAIS-20251227.md`        | Unused variables          |
| `build-errors/typescript-build-errors-repository-interface-mismatch.md`          | Interface mismatches      |
| `build-errors/agent-orchestrator-typescript-build-patterns-MAIS-20260101.md`     | Agent/orchestrator types  |
| `build-errors/typescript-symlink-path-resolution-build-failure-MAIS-20260108.md` | Symlink resolution        |

Originals archived at: `docs/archive/solutions-consolidated-20260110/topic-clusters/typescript-build/`

---

**Last Updated:** 2026-01-10
**Status:** Active Prevention Strategy
