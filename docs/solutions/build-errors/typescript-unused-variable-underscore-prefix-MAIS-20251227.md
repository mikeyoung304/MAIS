# TypeScript Unused Variable Build Errors (TS6133)

**Document:** TypeScript Unused Variable Underscore Prefix Pattern
**Created:** 2025-12-27
**Status:** Active Prevention Strategy
**Severity:** Critical (blocks production deployment)
**Commits:** `f6ad73c` (initial fix), `27a9298` (revert incorrect prefixes)

---

## Executive Summary

Production builds (Render) failed with ~49 TS6133 errors because `noUnusedParameters: true` is enforced. The fix is to prefix truly unused parameters with underscore (`_`). However, **4 variables were incorrectly prefixed** because they were actually used in logger calls - this pattern is easy to miss.

**Key Decision Rule:** Only prefix a parameter with `_` if it is truly never read anywhere in the function body. If the variable appears in ANY expression (including logger.debug calls), it IS used and must NOT be prefixed.

---

## Problem Analysis

### Root Cause

TypeScript's `noUnusedParameters: true` setting (in `server/tsconfig.json`) treats unused parameters as errors during production builds:

```json
{
  "compilerOptions": {
    "noUnusedParameters": true
  }
}
```

Development builds may not enforce this strictly, but production builds (Render) do, causing deployment failures.

### Error Pattern

```
error TS6133: 'req' is declared but its value is never read.
error TS6133: 'tenantId' is declared but its value is never read.
error TS6133: 'serviceId' is declared but its value is never read.
```

### Files Affected (20 files, 49 instances)

| File | Count | Examples |
|------|-------|----------|
| `server/src/adapters/mock/index.ts` | 14+ | `_tenantId`, `_packageIds`, `_serviceId` |
| `server/src/routes/tenant-admin.routes.ts` | 11 | `_req` in route handlers |
| `server/src/routes/tenant-admin-landing-page.routes.ts` | 5 | `_req` in route handlers |
| `server/src/middleware/rateLimiter.ts` | 8 | `_req` in rate limiter handlers |
| Various other routes | ~11 | `_req` parameters |

---

## Solution

### Step 1: Identify Truly Unused Parameters

A parameter is "unused" ONLY if:
1. It never appears after the function signature
2. It's required for interface/type compliance but not needed in implementation

**Correct Pattern - Truly Unused:**
```typescript
// tenantId required by interface, but mock doesn't use it
async getAllPackages(_tenantId: string): Promise<Package[]> {
  return Array.from(packages.values());  // No tenantId reference
}
```

**Incorrect Pattern - Actually Used:**
```typescript
// WRONG: serviceId IS used in logger.debug!
async findTimeslotBookings(
  _tenantId: string,
  date: Date,
  _serviceId?: string  // <- WRONG! See line below
): Promise<TimeslotBooking[]> {
  logger.debug(
    { date: date.toISOString(), serviceId: serviceId || 'all' },  // <- USED HERE!
    'findTimeslotBookings called'
  );
  return [];
}
```

### Step 2: Apply Underscore Prefix to Truly Unused Only

```typescript
// CORRECT: Route handler where req is not used
router.get('/packages', async (_req: Request, res: Response, next: NextFunction) => {
  const tenantId = res.locals.tenantAuth.tenantId;  // Uses res, not req
  // ...
});

// CORRECT: Mock adapter where tenantId is not used (filtering not needed in mock)
async getPackageBySlug(_tenantId: string, slug: string): Promise<Package | null> {
  return packages.get(slug) || null;  // Mock ignores tenantId
}

// INCORRECT - DO NOT prefix if variable is used in any way:
async findAppointments(
  tenantId: string,  // NO underscore - used in logger.debug below
  filters?: { status?: string }
): Promise<AppointmentDto[]> {
  logger.debug({ tenantId, filters }, 'findAppointments called');  // USED!
  return [];
}
```

### Step 3: Verify with TypeScript Check

```bash
npm run typecheck

# Should pass with no TS6133 errors
# If you see "Cannot find name 'variableName'" after prefixing,
# the variable WAS used and you prefixed incorrectly
```

---

## The 4 Variables That Were Incorrectly Prefixed

These were reverted in commit `27a9298`:

| Variable | Function | Why It Was Used |
|----------|----------|-----------------|
| `serviceId` | `findTimeslotBookings` | Used in `logger.debug({ serviceId: serviceId || 'all' })` |
| `serviceId` | `findTimeslotBookingsInRange` | Used in `logger.debug({ serviceId: serviceId || 'all' })` |
| `tenantId` | `findAppointments` | Used in `logger.debug({ tenantId, filters })` |
| `balanceAmountCents` | `completeBalancePayment` | Used in assignment expression |

### What Made These Easy to Miss

1. **Logger calls are often at the end of the function** - easy to overlook during quick scanning
2. **The variable appears in an object literal** - `{ tenantId }` shorthand makes usage subtle
3. **Grep for the variable name works**, but quick visual inspection misses it

---

## Decision Tree

```
Is the parameter used ANYWHERE in the function body?
├─ YES (in any expression, logger, assignment, condition)
│   └─ DO NOT prefix with underscore
│      Keep: `param: Type`
│
└─ NO (never appears after function signature)
    └─ IS it required for interface compliance?
        ├─ YES (interface requires it)
        │   └─ Prefix with underscore
        │      Change to: `_param: Type`
        │
        └─ NO (just dead code)
            └─ Consider removing entirely
               or prefix if signature matters
```

---

## Verification Script

Before committing, run this to verify you haven't incorrectly prefixed:

```bash
# 1. TypeScript check - catches incorrect prefixes via "Cannot find name" errors
npm run typecheck

# 2. Search for potentially incorrect prefixes in mock adapter
# This finds functions with _prefixed params - manually verify each isn't used in body
grep -n "_tenantId\|_serviceId\|_packageId" server/src/adapters/mock/index.ts

# 3. Full build test (mimics Render's build)
npm run build
```

---

## Code Examples

### Correct: Express Route Handler (req not used)

```typescript
// req is declared for Express signature but only res is needed
router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = res.locals.tenantAuth.tenantId;
    const data = await dashboardService.getData(tenantId);
    res.json(data);
  } catch (error) {
    next(error);
  }
});
```

### Correct: Mock Adapter (tenantId not needed for mock filtering)

```typescript
// Mock doesn't do tenant filtering, so tenantId is truly unused
async getAllPackages(_tenantId: string): Promise<Package[]> {
  return Array.from(packages.values());
}
```

### Incorrect: Variable Used in Logger (DO NOT prefix)

```typescript
// WRONG - tenantId IS used in logger.debug
async findAppointments(
  _tenantId: string,  // <- WRONG! Remove the underscore
  filters?: { limit?: number }
): Promise<AppointmentDto[]> {
  logger.debug({ tenantId, filters }, 'findAppointments called');  // <- USED HERE
  return [];
}

// CORRECT
async findAppointments(
  tenantId: string,  // <- Correct: no underscore because it's used below
  filters?: { limit?: number }
): Promise<AppointmentDto[]> {
  logger.debug({ tenantId, filters }, 'findAppointments called');
  return [];
}
```

### Incorrect: Variable Used in Assignment (DO NOT prefix)

```typescript
// WRONG - balanceAmountCents might be used
async completeBalancePayment(
  _tenantId: string,
  bookingId: string,
  _balanceAmountCents: number  // <- Check if used!
): Promise<Booking | null> {
  // If there's any assignment like:
  // (booking as any).balancePaidAmount = balanceAmountCents;
  // Then DO NOT prefix!
}
```

---

## Common Mistake Patterns

### Pattern 1: Logger.debug with Object Shorthand

```typescript
// Easy to miss - tenantId is used via shorthand
logger.debug({ tenantId, count });  // tenantId IS used here
```

### Pattern 2: Conditional Use of Optional Parameter

```typescript
// serviceId is used even with fallback
logger.debug({ serviceId: serviceId || 'all' });  // serviceId IS used
```

### Pattern 3: Parameter Passed to Another Function

```typescript
// tenantId is used by being passed to service
async getPackages(_tenantId: string) {  // WRONG if...
  return this.service.getAll(_tenantId);  // ...it's used here
}
```

---

## Prevention Checklist

Before prefixing any parameter with underscore:

- [ ] Search for the parameter name in the entire function body
- [ ] Check logger.debug/info/warn/error calls for the variable
- [ ] Check object literals for shorthand usage: `{ paramName }`
- [ ] Check if variable is passed to other functions
- [ ] Run `npm run typecheck` to verify no "Cannot find name" errors
- [ ] Run `npm run build` to ensure production build passes

---

## Related Documentation

- `server/tsconfig.json` - TypeScript strict settings
- `docs/solutions/TYPESCRIPT-BUILD-QUICK-REFERENCE.md` - General TypeScript patterns
- `docs/solutions/TYPESCRIPT-BUILD-AND-SEED-DRIFT-PREVENTION.md` - Full prevention strategy

---

## Git History

| Commit | Description |
|--------|-------------|
| `f6ad73c` | Initial fix: prefixed 49 unused variables with underscore |
| `27a9298` | Revert: 4 variables were incorrectly prefixed (actually used in logger calls) |
