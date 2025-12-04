# Sprint 2.2: Type Safety Assessment & Execution Plan

## Executive Summary

**Goal:** Eliminate all explicit and implicit `any` types, improve TypeScript strictness, and ensure type safety for agent and admin mutation flows.

**Current State:**

- ✅ `strict: true` already enabled in tsconfig.json
- ❌ 117 explicit `: any` type annotations (14 files)
- ❌ 49 `as any` type casts (10 files)
- ❌ `noUnusedLocals: false` (should be true)
- ❌ `noUnusedParameters: false` (should be true)

**Target State:**

- ✅ All `any` types replaced with proper types
- ✅ Stricter compiler options enabled
- ✅ JSON fields properly typed (branding, photos, metadata)
- ✅ Full type safety for mutation flows
- ✅ Test coverage maintained

---

## Current TypeScript Configuration Analysis

**File:** `server/tsconfig.json`

### ✅ Good Settings (Already Enabled)

| Setting                            | Value | Impact                                                                   |
| ---------------------------------- | ----- | ------------------------------------------------------------------------ |
| `strict`                           | true  | Enables strictNullChecks, strictFunctionTypes, strictBindCallApply, etc. |
| `noImplicitReturns`                | true  | Function return types must be explicit                                   |
| `noFallthroughCasesInSwitch`       | true  | Switch cases must have break/return                                      |
| `forceConsistentCasingInFileNames` | true  | Case-sensitive imports                                                   |

### ❌ Settings to Enable (Not Strict Enough)

| Setting                      | Current           | Recommended | Impact                                   |
| ---------------------------- | ----------------- | ----------- | ---------------------------------------- |
| `noUnusedLocals`             | false             | **true**    | Error on unused variables                |
| `noUnusedParameters`         | false             | **true**    | Error on unused function parameters      |
| `exactOptionalPropertyTypes` | undefined         | **true**    | Stricter optional property handling      |
| `noUncheckedIndexedAccess`   | undefined         | **true**    | Index signatures return `T \| undefined` |
| `noImplicitAny`              | true (via strict) | true        | Already enforced via `strict: true`      |
| `strictNullChecks`           | true (via strict) | true        | Already enforced via `strict: true`      |

---

## `any` Type Audit Results

### Explicit `: any` Annotations (117 occurrences, 14 files)

| File                                          | Count | Priority | Notes                                    |
| --------------------------------------------- | ----- | -------- | ---------------------------------------- |
| `generated/prisma/index.d.ts`                 | 44    | LOW      | Generated file, ignore                   |
| `generated/prisma/runtime/library.d.ts`       | 44    | LOW      | Generated file, ignore                   |
| `routes/index.ts`                             | 11    | **HIGH** | Route handlers, critical for type safety |
| `routes/tenant-admin.routes.ts`               | 3     | **HIGH** | Tenant mutation routes                   |
| `adapters/prisma/tenant.repository.ts`        | 3     | **HIGH** | Repository layer                         |
| `middleware/cache.ts`                         | 2     | MEDIUM   | Cache middleware                         |
| `adapters/prisma/catalog.repository.ts`       | 1     | **HIGH** | Catalog repository                       |
| `types/express.d.ts`                          | 1     | LOW      | Intentional any for Express extension    |
| `middleware/tenant.ts`                        | 1     | MEDIUM   | Tenant middleware                        |
| `lib/ports.ts`                                | 1     | MEDIUM   | Port definitions                         |
| `controllers/tenant-admin.controller.ts`      | 1     | **HIGH** | Admin controller                         |
| `routes/admin/stripe.routes.ts`               | 1     | MEDIUM   | Stripe routes                            |
| `lib/entities.ts`                             | 1     | MEDIUM   | Entity definitions                       |
| `generated/prisma/runtime/index-browser.d.ts` | 3     | LOW      | Generated file, ignore                   |

**High Priority Files (9 files, ~21 occurrences after excluding generated code):**

- `routes/index.ts`
- `routes/tenant-admin.routes.ts`
- `adapters/prisma/tenant.repository.ts`
- `adapters/prisma/catalog.repository.ts`
- `controllers/tenant-admin.controller.ts`

### `as any` Casts (49 occurrences, 10 files)

| File                                     | Count | Priority | Notes                                 |
| ---------------------------------------- | ----- | -------- | ------------------------------------- |
| `services/audit.service.test.ts`         | 27    | LOW      | Test file, mocks (acceptable)         |
| `routes/tenant-admin.routes.ts`          | 9     | **HIGH** | Route handlers casting Prisma results |
| `controllers/tenant-admin.controller.ts` | 3     | **HIGH** | Controller casting branding JSON      |
| `routes/index.ts`                        | 3     | **HIGH** | ts-rest route compatibility           |
| `middleware/auth.ts`                     | 1     | MEDIUM   | Auth middleware                       |
| `services/stripe-connect.service.ts`     | 2     | MEDIUM   | Stripe integration                    |
| `routes/webhooks.routes.ts`              | 1     | MEDIUM   | Webhook handler                       |
| `routes/tenant.routes.ts`                | 1     | MEDIUM   | Tenant routes                         |
| `routes/tenant-auth.routes.ts`           | 1     | MEDIUM   | Auth routes                           |
| `adapters/prisma/booking.repository.ts`  | 1     | **HIGH** | Repository layer                      |

**High Priority Files (5 files, ~22 occurrences after excluding test mocks):**

- `routes/tenant-admin.routes.ts` (9 casts)
- `controllers/tenant-admin.controller.ts` (3 casts)
- `routes/index.ts` (3 casts)
- `adapters/prisma/booking.repository.ts` (1 cast)

---

## Root Cause Analysis

### Why Do We Have So Many `any` Types?

**1. Prisma JSON Fields (Primary Cause - ~30% of issues)**

- Prisma represents JSON columns as `JsonValue` type
- Converting `JsonValue` to structured types requires casting
- Files affected: `tenant.repository.ts`, `tenant-admin.routes.ts`, `controllers/tenant-admin.controller.ts`

**Example:**

```typescript
// Current (uses any)
const branding = (tenant.branding as any) || {};

// Should be (properly typed)
const branding = tenant.branding as BrandingConfig | null;
```

**2. ts-rest Express Integration (~20% of issues)**

- ts-rest expects specific function signatures
- Express middleware has different type structure
- Files affected: `routes/index.ts`

**Example:**

```typescript
// Current (uses any)
getPackages: async ({ req }: { req: any }) => {
  // ...
};

// Should be (properly typed)
getPackages: async ({ req }: { req: TenantRequest }) => {
  // ...
};
```

**3. Express Middleware Type Extensions (~15% of issues)**

- `res.locals.tenantAuth` not typed in Express
- `req.file` from multer not typed
- Files affected: `tenant-admin.routes.ts`, `middleware/*`

**Example:**

```typescript
// Current (uses any)
await uploadService.uploadLogo(req.file as any, tenantId);

// Should be (properly typed)
await uploadService.uploadLogo(req.file, tenantId);
// uploadLogo signature: uploadLogo(file: Express.Multer.File, tenantId: string)
```

**4. Dynamic Object Manipulation (~10% of issues)**

- Array filtering, JSON parsing, dynamic properties
- Files affected: `routes/tenant-admin.routes.ts`

**Example:**

```typescript
// Current (uses any)
const currentPhotos = (pkg.photos as any[]) || [];

// Should be (properly typed)
const currentPhotos = (pkg.photos as PackagePhoto[] | null) ?? [];
```

---

## Prioritized Execution Plan

### Phase 1: TypeScript Compiler Strictness (Effort: 15 minutes)

**Goal:** Enable stricter compiler options without breaking the build

**Changes:**

1. Enable `noUnusedLocals: true`
2. Enable `noUnusedParameters: true`
3. Fix any unused variable/parameter warnings

**Acceptance Criteria:**

- [ ] `npm run typecheck` passes with stricter settings
- [ ] All unused locals removed or prefixed with `_` (convention for intentionally unused)
- [ ] All unused parameters removed or prefixed with `_`

---

### Phase 2: Define Proper Types for Prisma JSON Fields (Effort: 30 minutes)

**Goal:** Create type definitions for all Prisma JSON columns

**New Types to Create (`server/src/types/prisma-json.ts`):**

```typescript
/**
 * Branding configuration stored in Tenant.branding JSON field
 */
export interface BrandingConfig {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logo?: string;
}

/**
 * Package photo stored in Package.photos JSON array
 */
export interface PackagePhoto {
  url: string;
  filename: string;
  size: number;
  order: number;
}

/**
 * Audit log metadata stored in ConfigChangeLog.metadata JSON field
 */
export interface AuditMetadata {
  ip?: string;
  userAgent?: string;
  automationType?: string;
  scheduleId?: string;
  triggeredAt?: string;
  batchId?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Add-on IDs stored in Booking.addOnIds JSON array
 */
export type BookingAddOnIds = string[];

/**
 * Type helper for Prisma JSON fields
 */
export type PrismaJson<T> = T | null;
```

**Acceptance Criteria:**

- [ ] All JSON field types defined in `types/prisma-json.ts`
- [ ] Types exported and imported where needed
- [ ] No `as any` casts for JSON field access

---

### Phase 3: Fix High-Priority Route Files (Effort: 1-2 hours)

**Goal:** Remove all `any` types from route handlers

**Files to Fix:**

#### 3a. `routes/index.ts` (11 `: any`, 3 `as any`)

**Current Issues:**

- ts-rest route handlers use `{ req: any }`
- Need proper `TenantRequest` type

**Solution:**

```typescript
import type { TenantRequest } from '../middleware/tenant';

getPackages: async ({ req }: { req: TenantRequest }) => {
  const tenantId = getTenantId(req);
  // ...
};
```

**Estimated Time:** 30 minutes

#### 3b. `routes/tenant-admin.routes.ts` (3 `: any`, 9 `as any`)

**Current Issues:**

- `req.file as any` for multer
- `pkg.photos as any[]` for JSON field
- `tenant.branding as any` for JSON field
- `currentPhotos as any[]` for array operations

**Solution:**

```typescript
import type { PackagePhoto, BrandingConfig } from '../types/prisma-json';
import type { Express } from 'express';

// Use proper Multer type
const file: Express.Multer.File = req.file!;

// Use proper JSON types
const currentPhotos: PackagePhoto[] = (pkg.photos as PackagePhoto[]) ?? [];
const branding: BrandingConfig = (tenant.branding as BrandingConfig) ?? {};
```

**Estimated Time:** 45 minutes

#### 3c. `controllers/tenant-admin.controller.ts` (1 `: any`, 3 `as any`)

**Current Issues:**

- `tenant.branding as any` casts

**Solution:** Same as 3b (use `BrandingConfig` type)

**Estimated Time:** 15 minutes

---

### Phase 4: Fix High-Priority Repository Files (Effort: 30 minutes)

**Goal:** Remove `any` types from data access layer

**Files to Fix:**

#### 4a. `adapters/prisma/catalog.repository.ts` (1 `: any`)

**Current Issue:**

- Return type or parameter using `any`

**Solution:** Use proper domain types from `lib/entities.ts`

**Estimated Time:** 15 minutes

#### 4b. `adapters/prisma/tenant.repository.ts` (3 `: any`)

**Current Issues:**

- Branding update/create with `any`

**Solution:** Use `BrandingConfig` type

**Estimated Time:** 15 minutes

#### 4c. `adapters/prisma/booking.repository.ts` (1 `as any`)

**Current Issue:**

- Add-on IDs casting

**Solution:** Use `BookingAddOnIds` type

**Estimated Time:** 10 minutes

---

### Phase 5: Fix Medium-Priority Files (Effort: 1 hour)

**Goal:** Remove remaining `any` types from middleware and services

**Files to Fix:**

- `middleware/cache.ts` (2 `: any`)
- `middleware/tenant.ts` (1 `: any`)
- `middleware/auth.ts` (1 `as any`)
- `lib/ports.ts` (1 `: any`)
- `routes/admin/stripe.routes.ts` (1 `: any`)
- `services/stripe-connect.service.ts` (2 `as any`)
- `routes/webhooks.routes.ts` (1 `as any`)
- `routes/tenant.routes.ts` (1 `as any`)
- `routes/tenant-auth.routes.ts` (1 `as any`)

**Estimated Time:** 60 minutes total

---

### Phase 6: Test Coverage (Effort: 1 hour)

**Goal:** Ensure type safety doesn't break functionality

**Test Strategy:**

1. **Run existing test suite:**

   ```bash
   npm test
   ```

2. **Add type-specific tests:**
   - Test Prisma JSON field type safety
   - Test route handler type safety
   - Test repository layer type safety

3. **Create type safety regression tests:**

   ```typescript
   // server/src/types/prisma-json.test.ts
   import { describe, it, expectTypeOf } from 'vitest';
   import type { BrandingConfig, PackagePhoto } from './prisma-json';

   describe('Prisma JSON Types', () => {
     it('BrandingConfig should have correct shape', () => {
       const branding: BrandingConfig = {
         primaryColor: '#FF0000',
         secondaryColor: '#00FF00',
         fontFamily: 'Arial',
         logo: 'https://example.com/logo.png',
       };
       expectTypeOf(branding.primaryColor).toEqualTypeOf<string | undefined>();
     });

     it('PackagePhoto should have correct shape', () => {
       const photo: PackagePhoto = {
         url: 'https://example.com/photo.jpg',
         filename: 'photo.jpg',
         size: 1024,
         order: 0,
       };
       expectTypeOf(photo.url).toEqualTypeOf<string>();
     });
   });
   ```

**Acceptance Criteria:**

- [ ] All existing tests pass
- [ ] Type-specific tests added
- [ ] No regressions in functionality

---

## Success Metrics

### Quantitative Metrics

| Metric                           | Before  | Target | Measurement                                                        |
| -------------------------------- | ------- | ------ | ------------------------------------------------------------------ |
| Explicit `: any` (non-generated) | ~73     | 0      | `grep -r ": any" --include="*.ts" \| wc -l`                        |
| `as any` casts (non-test)        | ~22     | 0      | `grep -r "as any" --include="*.ts" --exclude="*.test.ts" \| wc -l` |
| TypeScript strictness score      | 8/12    | 12/12  | Count of enabled strict options                                    |
| Type coverage                    | Unknown | >95%   | Use `type-coverage` tool                                           |

### Qualitative Metrics

- ✅ All route handlers have proper types
- ✅ All repository methods have proper return types
- ✅ All Prisma JSON fields have proper type definitions
- ✅ No implicit `any` types remain
- ✅ IDE autocomplete works for all JSON fields
- ✅ Type errors caught at compile time, not runtime

---

## Risk Assessment

### Low Risk Changes

- Adding type definitions for JSON fields (backward compatible)
- Enabling `noUnusedLocals` and `noUnusedParameters` (catches bugs)
- Replacing `as any` with proper types (improves safety)

### Medium Risk Changes

- Changing route handler signatures (may affect ts-rest integration)
- Modifying Express middleware types (may affect request flow)

### Mitigation Strategies

1. **Incremental Changes:** Fix one file at a time, run tests after each change
2. **Test Coverage:** Ensure all changes are covered by existing tests
3. **Type Testing:** Add type-specific tests to prevent regressions
4. **Rollback Plan:** Each phase is independently committable

---

## Dependencies & Blockers

### No Blockers Identified

- TypeScript already at compatible version
- All dependencies support strict mode
- No breaking changes required

### Dependencies

- Sprint 2.1 audit logging complete ✅
- Test suite passing ✅
- No pending PRs that modify type signatures

---

## Timeline Estimate

| Phase                        | Effort       | Dependencies |
| ---------------------------- | ------------ | ------------ |
| Phase 1: Compiler Strictness | 15 min       | None         |
| Phase 2: Type Definitions    | 30 min       | None         |
| Phase 3: Route Files         | 90 min       | Phase 2      |
| Phase 4: Repository Files    | 40 min       | Phase 2      |
| Phase 5: Middleware/Services | 60 min       | Phase 2      |
| Phase 6: Test Coverage       | 60 min       | Phases 3-5   |
| **Total**                    | **~5 hours** | Sequential   |

**Suggested Schedule:**

- Session 1 (1 hour): Phases 1-2
- Session 2 (2 hours): Phase 3
- Session 3 (1.5 hours): Phases 4-5
- Session 4 (30 min): Phase 6

---

## Next Steps

1. **Get approval** for execution plan
2. **Phase 1:** Enable stricter compiler options
3. **Phase 2:** Create type definitions for Prisma JSON fields
4. **Phases 3-5:** Systematically remove `any` types file by file
5. **Phase 6:** Test coverage and regression testing
6. **PR:** Create comprehensive PR with type safety improvements

---

## References

- **TypeScript Handbook:** https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
- **TypeScript Strict Mode:** https://www.typescriptlang.org/tsconfig#strict
- **Prisma JSON Fields:** https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields
- **Sprint 2.1 Audit Logging:** `SPRINT_2_1_EXECUTIVE_SUMMARY.md`

---

**Last Updated:** January 10, 2025
**Sprint:** 2.2 - Type Safety
**Status:** PLANNING - Ready to execute
**Estimated Effort:** 5 hours total (6 phases)
