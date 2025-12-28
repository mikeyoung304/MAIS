---
title: TypeScript Unused Variable Build Errors (TS6133) - Underscore Prefix Pattern
problem_type: build-errors
component: typescript-build
severity: high
symptoms:
  - "Render build failed with TS6133: 'variable' is declared but never read"
  - '~49 unused variable warnings across 20 files'
  - 'noUnusedLocals and noUnusedParameters compiler options enforced in production'
  - 'Build passes locally but fails on Render due to stricter tsconfig'
  - 'Second build failure after incorrectly prefixing variables that ARE used'
root_cause: |
  TypeScript strict mode with noUnusedLocals/noUnusedParameters flags treats unused
  variables as errors in production builds. Many API route handlers and mock adapters
  declare parameters for interface compliance but don't use them (e.g., `req` when only
  `res.locals.tenantAuth` is needed). The initial fix incorrectly prefixed 4 variables
  that were actually used in logger calls within the function body.
solution_summary: |
  Prefix truly unused parameters with underscore (_) to suppress TS6133 warnings while
  preserving function signatures. CRITICAL: Before prefixing any variable, search the
  entire function body for usages - including logger calls, error messages, and
  conditional branches. Variables used in logger.info/debug/error calls ARE used.
files_affected:
  - server/src/adapters/mock/index.ts
  - server/src/routes/tenant-admin.routes.ts
  - server/src/routes/tenant-admin-landing-page.routes.ts
  - server/src/routes/tenant-admin-calendar.routes.ts
  - server/src/routes/tenant-admin-billing.routes.ts
  - server/src/routes/tenant-admin-stripe.routes.ts
  - server/src/routes/tenant-auth.routes.ts
  - server/src/middleware/sanitize.ts
  - server/src/lib/errors/request-context.ts
  - server/src/services/scheduling-availability.service.ts
verified: true
date_solved: 2025-12-27
related_commits:
  - f6ad73c # Initial fix - prefix unused variables (20 files, 49 instances)
  - 27a9298 # Revert - 4 variables were actually used in function body
tags:
  - typescript
  - build-errors
  - noUnusedLocals
  - noUnusedParameters
  - TS6133
  - underscore-prefix
  - render-deployment
  - production-build
---

# TypeScript Unused Variable Build Errors (TS6133)

## Problem

Render production build failed with ~49 TypeScript TS6133 errors:

```
error TS6133: 'req' is declared but its value is never read.
error TS6133: 'tenantId' is declared but its value is never read.
error TS6133: 'serviceId' is declared but its value is never read.
```

Local `npm run typecheck` passed, but Render's production build failed.

## Root Cause

1. **Stricter production settings**: Render's build environment enforces `noUnusedLocals` and `noUnusedParameters` as errors
2. **Accumulated technical debt**: ~49 unused variables across 20 files had accumulated over time
3. **Common patterns**: Express route handlers declare `req` but only use `res.locals.tenantAuth`

## Solution

### Step 1: Identify Truly Unused Variables

Prefix **truly unused** parameters with underscore (`_`) to suppress TS6133 warnings:

```typescript
// BEFORE - TypeScript error: 'req' is declared but never read
router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  const tenantId = getTenantId(res); // Only res is used
  // ...
});

// AFTER - Underscore prefix suppresses warning
router.get('/profile', async (_req: Request, res: Response, next: NextFunction) => {
  const tenantId = getTenantId(res);
  // ...
});
```

### Step 2: Verify Variable Is Actually Unused

**CRITICAL**: Before prefixing, search the **entire function body** for usages!

```typescript
// WRONG - serviceId IS used in logger call!
async findTimeslotBookings(
  _tenantId: string,
  date: Date,
  _serviceId?: string  // WRONG! Used below!
): Promise<TimeslotBooking[]> {
  logger.debug(
    { date: date.toISOString(), serviceId: serviceId || 'all' },  // <-- USED HERE!
    'findTimeslotBookings called'
  );
  return [];
}

// CORRECT - serviceId is used, don't prefix it
async findTimeslotBookings(
  _tenantId: string,
  date: Date,
  serviceId?: string  // CORRECT - no underscore because it's used
): Promise<TimeslotBooking[]> {
  logger.debug(
    { date: date.toISOString(), serviceId: serviceId || 'all' },
    'findTimeslotBookings called'
  );
  return [];
}
```

## Critical Mistake Made

Four variables were incorrectly prefixed because they **were** used in the function body:

| Variable             | Function                      | Why It Was Used                                           |
| -------------------- | ----------------------------- | --------------------------------------------------------- |
| `serviceId`          | `findTimeslotBookings`        | `logger.debug({ serviceId: serviceId \|\| 'all' })`       |
| `serviceId`          | `findTimeslotBookingsInRange` | `logger.debug({ serviceId: serviceId \|\| 'all' })`       |
| `tenantId`           | `findAppointments`            | `logger.debug({ tenantId, filters })`                     |
| `balanceAmountCents` | `completeBalancePayment`      | `(booking as any).balancePaidAmount = balanceAmountCents` |

This caused a **second build failure** that required a follow-up commit to fix.

## Decision Tree

```
Is variable used ANYWHERE in function body?
│
├── YES (used in logger, assignment, conditional, template, etc.)
│   └── DO NOT prefix with _ (it's NOT unused!)
│
└── NO (truly never referenced after declaration)
    │
    ├── Required by interface/callback signature?
    │   └── Prefix with _ (e.g., _req, _tenantId)
    │
    └── Not required?
        └── REMOVE IT entirely
```

## Common Patterns Fixed

### Route Handlers (30+ instances)

```typescript
// Express routes often need req for signature but only use res
router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  const tenantAuth = res.locals.tenantAuth;
  // ...
});
```

### Mock Adapters (11 instances)

```typescript
// Mock adapters ignore tenantId (no actual tenant isolation in mock mode)
async findById(_tenantId: string, id: string): Promise<Booking | null> {
  return bookings.get(id) || null;
}
```

### Middleware Functions

```typescript
// Middleware may not use all Express handler params
export function sanitizeInput(options: SanitizeOptions = {}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Only req and next are used, res is not
    if (req.body) {
      /* ... */
    }
    next();
  };
}
```

## Verification

```bash
# Run typecheck locally with production-equivalent settings
npm run typecheck

# Search for potential unused variables
grep -rn "error TS6133" .
```

## Prevention Strategies

### 1. Match Local and Production TypeScript Settings

Ensure `tsconfig.json` has these settings enabled:

```json
{
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 2. Pre-commit Check

Add to `.husky/pre-commit`:

```bash
npm run typecheck || {
  echo "TypeScript check failed. Fix errors before committing."
  exit 1
}
```

### 3. Code Review Checklist

- [ ] If prefixing a variable with `_`, verify it's not used in:
  - Logger calls (`logger.debug`, `logger.info`, etc.)
  - Object shorthand (`{ param }`)
  - Assignments or conditional expressions
  - Template literals or string concatenation

## Related Documentation

- [TYPESCRIPT-BUILD-ERRORS-RESOLUTION-20251227.md](../TYPESCRIPT-BUILD-ERRORS-RESOLUTION-20251227.md) - Other TypeScript build errors
- [PRISMA-TYPESCRIPT-BUILD-PREVENTION.md](../PRISMA-TYPESCRIPT-BUILD-PREVENTION.md) - Prisma-specific TypeScript issues
- [ts-rest-any-type-library-limitations-MAIS-20251204.md](../best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md) - When `any` is acceptable

## Key Lesson

**The underscore prefix (`_`) tells TypeScript: "I know this variable exists but I'm intentionally not using it."**

If you ARE using it—even just passing it to a logger—then it's NOT unused and should NOT have the underscore prefix.
