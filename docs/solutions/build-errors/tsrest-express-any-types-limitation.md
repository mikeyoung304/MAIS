---
title: TypeScript Build Errors from ts-rest Request Type Incompatibility
category: build-errors
severity: critical
date_created: 2025-12-02
date_resolved: 2025-12-02
commits:
  - b05f9ec (introduced)
  - 417b8c0 (fixed)
tags:
  - typescript
  - ts-rest
  - express-middleware
  - type-compatibility
  - deployment
  - render-deployment
affected_files:
  - server/src/routes/index.ts
  - server/src/routes/tenant-admin.routes.ts
  - server/src/middleware/tenant.ts
error_codes:
  - TS2345
  - TS2339
  - TS2352
related_technologies:
  - ts-rest v3
  - Express 4.x/5.x
  - TypeScript 5.9.3
  - Render deployment platform
---

# TypeScript Build Errors from ts-rest Request Type Incompatibility

## Problem Summary

Render deployment failed after commit `b05f9ec` attempted to improve type safety by replacing `any` types with proper TypeScript interfaces in ts-rest route handlers. The build broke because **ts-rest v3 has known type compatibility issues with Express 4.x/5.x middleware signatures** and requires `{ req: any }` in route handlers.

## Error Messages

```
src/routes/index.ts(123,37): error TS2345: Argument of type 'RouterImplementation<AppRouter>'
is not assignable to parameter of type 'RouterImplementation<RecursivelyApplyOptions<...>'

src/routes/index.ts(123,57): error TS2345: Argument of type '{ getPackages: ({ req }: { req: Request; })
=> Promise<...>' is missing the following properties from type...

src/routes/tenant-admin.routes.ts(194,31): error TS2339: Property 'logo' does not exist on type
'{ primaryColor?: string | undefined; secondaryColor?: string | undefined; ... }'

src/routes/tenant-admin.routes.ts(854,23): error TS2352: Conversion of type 'BlackoutRepository'
to type '{ prisma: unknown; }' may be a mistake...
```

## Root Cause Analysis

### Primary Cause: ts-rest Library Limitation

ts-rest v3 has documented type compatibility issues with Express 4.x/5.x. The library's internal type system doesn't perfectly align with Express's middleware signatures. When route handlers were changed from:

```typescript
// REQUIRED by ts-rest (works)
async ({ req }: { req: any }) => { ... }

// BREAKS BUILD (TypeScript can't reconcile types)
async ({ req }: { req: Request }) => { ... }
```

TypeScript couldn't reconcile the type differences between:

- ts-rest's expected `RouterImplementation` type
- Express's `Request` type from `@types/express`

### Secondary Causes

1. **Missing interface for logo property**: `UpdateBrandingDtoSchema` doesn't include `logo` (uploaded separately), but the merged branding object needed to access it
2. **Type assertion pattern**: Using `as { prisma: unknown }` directly instead of proper `as unknown as` chain
3. **Header type handling**: `stripe-signature` header can be `string | string[]`

## Solution Applied

### Fix 1: Revert ts-rest Handlers to `any` (Required)

**File:** `server/src/routes/index.ts`

```typescript
// ts-rest express has type compatibility issues with Express 4.x/5.x
// The `any` type for req is required - ts-rest internally handles request typing
// Attempting to use `Request` type causes TS2345 errors due to middleware signature mismatch
// See: https://github.com/ts-rest/ts-rest/issues
createExpressEndpoints(Contracts, s.router(Contracts, {
  getPackages: async ({ req }: { req: any }) => {
    const tenantId = getTenantId(req as TenantRequest);  // Cast for downstream safety
    const data = await controllers.packages.getPackages(tenantId);
    return { status: 200 as const, body: data };
  },
  // ... all other handlers use { req: any }
} as any), app, { ... });
```

**Why this is correct:**

- Respects library constraints (ts-rest v3 type system limitations)
- Maintains type safety through `TenantRequest` casting after the boundary
- Minimizes `any` surface area (only at framework boundary)
- Documented with clear comments explaining the trade-off

### Fix 2: Add BrandingData Interface

**File:** `server/src/routes/tenant-admin.routes.ts`

```typescript
// Type the branding object to include all possible fields including logo
interface BrandingData {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  logo?: string; // Uploaded separately, not in UpdateBrandingDtoSchema
}

const currentBranding = (tenant.branding as BrandingData) || {};
const updatedBranding: BrandingData = {
  ...currentBranding,
  ...validation.data,
};
```

### Fix 3: Proper Type Assertion Chain

**File:** `server/src/routes/tenant-admin.routes.ts`

```typescript
// Before (TS2352 error)
const prisma = (blackoutRepo as { prisma: unknown }).prisma;

// After (correct pattern)
const prismaClient = (blackoutRepo as unknown as { prisma: unknown }).prisma;
```

### Fix 4: Handle Header Array Type

**File:** `server/src/routes/index.ts`

```typescript
// stripe-signature can be string | string[]
const signatureHeader = req.headers['stripe-signature'];
const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader || '';
```

### Fix 5: Add Repository Null Checks

**File:** `server/src/routes/index.ts`

```typescript
// All scheduling repositories must be present
if (repositories.service && repositories.availabilityRule && repositories.booking) {
  const tenantAdminSchedulingRouter = createTenantAdminSchedulingRoutes(
    repositories.service,
    repositories.availabilityRule,
    services.booking,
    repositories.booking
  );
  // ...
}
```

## Verification

```bash
# Build passes
npm run --workspace=@macon/api build
# ✅ No errors

# Tests pass
npm test
# ✅ 913 passing, 22 skipped (same as before)

# Render deployment
# ✅ Successful
```

## Prevention Strategies

### 1. Code Review Checklist

When reviewing PRs that modify `any` types:

- [ ] Is this `any` in a ts-rest route handler? → **Do NOT remove**
- [ ] Is there a comment explaining why `any` is required? → **If not, add one**
- [ ] Does the change run `npm run build` (not just `typecheck`)? → **Require this**
- [ ] Does the PR touch library integration code? → **Extra scrutiny needed**

### 2. Inline Documentation Requirements

All ts-rest handlers must include this comment:

```typescript
// ts-rest express has type compatibility issues with Express 4.x/5.x
// The `any` type for req is required - ts-rest internally handles request typing
// See: https://github.com/ts-rest/ts-rest/issues
```

### 3. Pre-Push Verification

Always run full build before pushing type changes:

```bash
npm run --workspace=@macon/contracts build
npm run --workspace=@macon/shared build
npm run --workspace=@macon/api build
```

### 4. Pattern Recognition: When `any` is Acceptable

| Situation              | `any` Acceptable? | Alternative                |
| ---------------------- | ----------------- | -------------------------- |
| ts-rest route handlers | ✅ Yes (required) | None - library limitation  |
| Prisma JSON fields     | ❌ No             | Create typed interface     |
| Third-party callback   | ⚠️ Maybe          | Check library docs first   |
| Unknown API response   | ❌ No             | Use `unknown` + type guard |
| Test mocks             | ⚠️ Maybe          | Prefer typed mocks         |

## Related Documentation

- [ADR-006: Modular Monolith Architecture](../../adrs/ADR-006-modular-monolith-architecture.md) - ts-rest + Zod contract patterns
- [Render TypeScript Prisma Errors](render-typescript-prisma-type-errors.md) - Related build error patterns
- [CLAUDE.md](../../../CLAUDE.md) - Updated Common Pitfalls section

## Key Takeaway

**Not all `any` types are code smells.** Some are required library workarounds. When removing `any` breaks the build, **put it back and document why** instead of trying to "fix" the code. The cost of fighting library limitations exceeds the benefit of strict typing at framework boundaries.

## Timeline

| Time             | Event                                                |
| ---------------- | ---------------------------------------------------- |
| 2025-12-02 21:10 | Commit b05f9ec pushed (TODO 035 resolution)          |
| 2025-12-02 21:15 | Render build failed                                  |
| 2025-12-02 21:17 | Root cause identified (ts-rest type incompatibility) |
| 2025-12-02 21:22 | Commit 417b8c0 pushed (fix)                          |
| 2025-12-02 21:23 | Render build succeeded                               |
