# TypeScript Build & Seed Configuration - Quick Reference

**Print and Pin This!**

---

## When You Change the Database Schema

```bash
1. Edit server/prisma/schema.prisma
2. npm exec prisma migrate dev --name descriptive_name
3. npm exec prisma generate
4. npm run typecheck
5. Update all references to changed properties
6. npm run lint  # Check for unused parameters
7. npm test
```

---

## Property Name Mismatches

### Pattern 1: Schema Property Changed

```typescript
// Schema change: heroImageUrl -> heroImage
// ❌ Code still uses old name
segment.heroImageUrl; // TypeScript error: Property 'heroImageUrl' does not exist

// ✅ Update to new name
segment.heroImage;
```

**Find all references:**

```bash
cd server
rg "heroImageUrl" src/  # Find all references
```

**Fix:**

```bash
npm run typecheck  # Shows all property mismatch errors
# Fix each one, then run again
```

### Pattern 2: Enum Status Comparison

```typescript
enum BookingStatus {
  PENDING = 'PENDING',
  DEPOSIT_PAID = 'DEPOSIT_PAID', // Underscore in enum
  PAID = 'PAID',
}

// ❌ String comparison with wrong format
if (booking.status === 'depositpaid') {
} // Missing underscore

// ❌ Unsafe type assertion
const statusKey = booking.status.toLowerCase() as keyof typeof bookingsByStatus;

// ✅ Type-safe comparison
if (booking.status === BookingStatus.DEPOSIT_PAID) {
}

// ✅ If you need normalized string, use type guard
const normalizedStatus = booking.status.toLowerCase().replace('_', '');
if (normalizedStatus === 'depositpaid' && normalizedStatus in bookingsByStatus) {
  const statusKey = normalizedStatus as keyof typeof bookingsByStatus;
}
```

---

## Unused Parameters

### Pattern: Parameter Named But Not Used

```typescript
// ❌ Parameter renamed to _tenantId but code still references tenantId
async function findBookingsNeedingReminders(_tenantId: string) {
  logger.debug({ tenantId, count: result.length }); // ❌ tenantId undefined
}

// ✅ Reference the parameter with its actual name
async function findBookingsNeedingReminders(_tenantId: string) {
  logger.debug({ tenantId: _tenantId, count: result.length }); // ✅
}
```

**TypeScript catches this:**

```bash
npm run typecheck

# Output:
# error TS6133: '_tenantId' is declared but its value is never read
# error TS2552: Cannot find name 'tenantId'. Did you mean '_tenantId'?
```

---

## Type Assertions

### When Type Assertions Are OK

```typescript
// ✅ OK: You're using `as unknown as Type` pattern (safer)
const obj = { checkAvailability: async () => ({ available: true }) };
const service = obj as unknown as AvailabilityService;

// ✅ OK: You're using type guard before assertion
if (normalizedStatus in bookingsByStatus) {
  const statusKey = normalizedStatus as keyof typeof bookingsByStatus;
}

// ✅ OK: With comment explaining why
// Note: This is a stub object for testing purposes
const mockService = {
  /* ... */
} as unknown as AvailabilityService;
```

### When Type Assertions Are NOT OK

```typescript
// ❌ NO: Direct bypass of type system
const statusKey = booking.status as keyof typeof bookingsByStatus; // Unsafe!

// ❌ NO: Using `as any`
const value = something as any; // Defeats TypeScript

// ❌ NO: Without explanation
const service = mockData as AvailabilityService;
```

---

## Seed Configuration Issues

### Environment Variables in Seeds

**Problem:** Seed uses `ADMIN_EMAIL` env var, but `.env` has different value.

```typescript
// server/prisma/seeds/platform.ts
const adminEmail = process.env.ADMIN_EMAIL;
const admin = await tx.user.create({
  data: { email: adminEmail, ... }
});

// .env
ADMIN_EMAIL=support@mais.com

// .env.example
ADMIN_EMAIL=admin@localhost  // Different!

// Result: Inconsistency causes auth failures
```

**Solution:**

```bash
# 1. Check what your seed expects
grep "process.env.ADMIN_EMAIL" server/prisma/seeds/platform.ts

# 2. Set the right value in .env
export ADMIN_EMAIL=support@mais.com

# 3. Run the seed
npm exec prisma db seed

# 4. Verify it worked
npm run db:info  # Check admin user created
```

### Seed Validation

**Add to your seed file:**

```typescript
// Before using the env var
if (!adminEmail || !adminEmail.includes('@')) {
  throw new Error(`Invalid ADMIN_EMAIL: "${adminEmail}"`);
}

// After seed completes
const verifyAdmin = await prisma.user.findUnique({
  where: { email: adminEmail },
});

if (!verifyAdmin) {
  throw new Error(`Seed failed: Admin user not found at ${adminEmail}`);
}
```

---

## Pre-Commit Checklist

Before running `git commit`:

```bash
# 1. TypeScript check
npm run typecheck  # ← Must pass

# 2. Lint check
npm run lint       # ← Must pass

# 3. Schema consistency
cd server
npm exec prisma generate
git diff --exit-code src/generated/prisma  # ← No diff = good

# 4. Tests
npm test           # ← Should all pass

# 5. Build
npm run build      # ← Must succeed
```

**If any step fails, fix it before committing.**

---

## Common Error Messages & Fixes

### Error: Property does not exist on type

```
error TS2339: Property 'heroImageUrl' does not exist on type 'Segment'
```

**Fix:**

```bash
# 1. Check schema for correct property name
grep "heroImage" server/prisma/schema.prisma

# 2. Update code to use correct name
# server/src/routes/tenant-admin.routes.ts
- segment.heroImageUrl
+ segment.heroImage

# 3. Verify fix
npm run typecheck
```

### Error: Unused parameter

```
error TS6133: '_tenantId' is declared but its value is never read
```

**Fix:**

```bash
# Either remove the underscore if parameter is used
- async findBookings(_tenantId: string) {
-   logger.debug({ tenantId, ... })  # ❌ Wrong variable name
+ async findBookings(tenantId: string) {
+   logger.debug({ tenantId, ... })  # ✅ Matches parameter

# Or use the _tenantId with underscore if truly unused
- async findBookings(tenantId: string) {  # Never used
+ async findBookings(_tenantId: string) {  # Intentionally unused
```

### Error: Cannot find name 'tenantId'

```
error TS2552: Cannot find name 'tenantId'. Did you mean '_tenantId'?
```

**Fix:** Use correct parameter name

```typescript
// Parameter declared with underscore
async function findBookings(_tenantId: string) {
  // Use the parameter as declared
  logger.debug({ tenantId: _tenantId, ... });  // ✅
}
```

### Error: Type assertion issue

```
error TS2352: Conversion of type 'BookingStatus' to type 'keyof typeof bookingsByStatus' may be a mistake
```

**Fix:** Use type guard instead of assertion

```typescript
// ❌ Direct assertion
const statusKey = booking.status as keyof typeof bookingsByStatus;

// ✅ Type guard first
if (booking.status in bookingsByStatus) {
  const statusKey = booking.status as keyof typeof bookingsByStatus;
  // Now safe to use statusKey
}
```

---

## Seed Commands

```bash
# Production: Platform admin only
export ADMIN_EMAIL=support@mais.com
export ADMIN_DEFAULT_PASSWORD=$(openssl rand -base64 32)
npm exec prisma db seed -- --seed=production

# Development: Platform + demo data
npm exec prisma db seed

# E2E: Test tenant with fixed keys
SEED_MODE=e2e npm exec prisma db seed

# Specific tenant
SEED_MODE=la-petit-mariage npm exec prisma db seed

# All seeds (testing)
SEED_MODE=all npm exec prisma db seed
```

---

## Files to Know

| File                                     | Purpose                       | Edit When                            |
| ---------------------------------------- | ----------------------------- | ------------------------------------ |
| `server/prisma/schema.prisma`            | Database schema definition    | Adding/modifying tables/fields       |
| `server/src/generated/prisma/index.d.ts` | Auto-generated Prisma types   | After schema change (auto-generated) |
| `server/prisma/seeds/platform.ts`        | Platform admin seed           | Changing admin setup process         |
| `.env.example`                           | Example environment variables | Adding new env vars to seeds         |
| `server/tsconfig.json`                   | TypeScript strict mode        | Rarely - already configured          |

---

## Decision Tree

### I just edited schema.prisma

```
Did you add/rename a field?
  ├─ YES
  │  └─ npm exec prisma generate
  │     npm run typecheck
  │     Update all code references
  └─ NO
     └─ npm run typecheck
```

### I'm getting TypeScript errors after schema change

```
Error mentions a property name?
  ├─ YES
  │  └─ Check schema for correct name
  │     Update code to match schema
  │     npm run typecheck
  └─ NO
     └─ Check error message
        npm run typecheck --verbose
```

### Environment variable mismatch in seed

```
Seed expects ADMIN_EMAIL but it's different?
  ├─ YES
  │  └─ Set correct value: export ADMIN_EMAIL=...
  │     npm exec prisma db seed
  └─ NO
     └─ Check .env.example matches seed comments
        Update .env.example if needed
```

---

## Prevention Summary

| Issue                  | How to Prevent                                     |
| ---------------------- | -------------------------------------------------- |
| Property name mismatch | `npm run typecheck` after schema changes           |
| Type comparison errors | Use enums, not string literals                     |
| Unused parameters      | TypeScript catches with `noUnusedParameters: true` |
| Seed config drift      | Document env vars in seed file + validate in code  |
| Build failures         | Run `npm run build` before commit                  |
