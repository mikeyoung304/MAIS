# Remaining Lint Issues - Practical Fix Guide

> **Quick Start:** Start with the [5-Minute Quick Wins](#5-minute-quick-wins) section below to fix 9 parsing errors immediately.

## Table of Contents

1. [Quick Stats](#quick-stats)
2. [5-Minute Quick Wins](#5-minute-quick-wins) ⚡
3. [Current Status by Severity](#current-status-by-severity)
4. [Critical Errors Breakdown](#critical-errors-breakdown-140-total)
5. [Quality Errors Breakdown](#quality-errors-breakdown-268-total)
6. [Fix Patterns for Each Error Type](#fix-patterns-for-each-error-type)
   - [no-unsafe-member-access](#1-no-unsafe-member-access-58-errors)
   - [no-unsafe-assignment](#2-no-unsafe-assignment-39-errors)
   - [no-unsafe-call](#3-no-unsafe-call-27-errors)
   - [no-unsafe-argument](#4-no-unsafe-argument-10-errors)
   - [no-explicit-any](#5-no-explicit-any-6-errors)
   - [require-await](#6-require-await-38-errors)
   - [explicit-function-return-type](#7-explicit-function-return-type-35-errors)
   - [no-unused-vars](#8-no-unused-vars-31-errors)
   - [prefer-nullish-coalescing](#9-prefer-nullish-coalescing-76-errors)
   - [restrict-template-expressions](#10-restrict-template-expressions-29-errors)
   - [no-unnecessary-condition](#11-no-unnecessary-condition-25-errors)
   - [And 9 more...](#12-no-non-null-assertion-9-errors)
7. [Special Case: Parsing Errors](#special-case-parsing-errors-9-errors)
8. [File-by-File Fix Guide](#file-by-file-fix-guide)
9. [Automated Fix Opportunities](#automated-fix-opportunities)
10. [Testing Strategy](#testing-strategy)
11. [Time Estimates](#time-estimates)
12. [Quick Reference: Common Patterns](#quick-reference-common-patterns)
13. [Summary: Fix Order by Impact](#summary-fix-order-by-impact)
14. [Quick Checklist](#quick-checklist)
15. [Complete Error Type Reference](#appendix-complete-error-type-reference)

---

## Quick Stats

**Total Remaining:** 426 problems (408 errors, 18 warnings)

- **Critical Errors:** 140 (type safety issues that could cause runtime errors)
- **Quality Errors:** 268 (code quality and style issues)
- **Auto-fixable:** 4 errors (use `npm run lint -- --fix`)

## 5-Minute Quick Wins

Before diving into the full guide, fix these 9 parsing errors that prevent linting from working properly:

### Step 1: Fix Duplicate Imports (3 files)

These files have duplicate `import { getErrorMessage }` statements that need to be removed:

```bash
# Open each file and remove duplicate import lines
client/src/features/tenant-admin/BlackoutsManager.tsx
client/src/features/tenant-admin/BrandingEditor.tsx
client/src/features/tenant-admin/TenantBookingList.tsx
```

**What to do:**

1. Open the file
2. Look for multiple lines with `import { getErrorMessage } from '@elope/shared';`
3. Keep only ONE at the top of the file
4. Delete all the others scattered throughout the imports

**Before:**

```typescript
import { useState, useCallback } from 'react';
import { getErrorMessage } from '@elope/shared';
import { Plus, Trash2 } from 'lucide-react';
import { getErrorMessage } from '@elope/shared'; // ❌ Delete this
import { Card } from '@/components/ui/card';
import { getErrorMessage } from '@elope/shared'; // ❌ Delete this
```

**After:**

```typescript
import { useState, useCallback } from 'react';
import { getErrorMessage } from '@elope/shared'; // ✅ Keep only one
import { Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
```

### Step 2: Run Auto-fix

```bash
npm run lint -- --fix
```

This will automatically fix 4 simple formatting errors.

### Step 3: Verify Progress

```bash
npm run lint 2>&1 | tail -1
```

You should now see **413 problems** instead of 426. You just fixed 13 errors in 5 minutes!

---

## Current Status by Severity

### 🔴 Critical - Type Safety Issues (140 errors)

These could cause runtime errors and should be fixed first.

### 🟡 Quality - Code Quality Issues (268 errors)

These are style/quality improvements that won't cause runtime errors.

### 🔵 Warnings (18 warnings)

Console statements that are acceptable in development.

---

## Critical Errors Breakdown (140 total)

### By Error Type

| Error Type                | Count | Severity | Auto-fix? |
| ------------------------- | ----- | -------- | --------- |
| `no-unsafe-member-access` | 58    | Critical | No        |
| `no-unsafe-assignment`    | 39    | Critical | No        |
| `no-unsafe-call`          | 27    | Critical | No        |
| `no-unsafe-argument`      | 10    | Critical | No        |
| `no-explicit-any`         | 6     | Critical | No        |

**Total Critical:** 140 errors

### Top Files with Critical Errors

| File                                             | Errors | Primary Issues                        |
| ------------------------------------------------ | ------ | ------------------------------------- |
| `/server/src/adapters/mock/index.ts`             | 44     | unsafe-member-access, require-await   |
| `/client/src/contexts/AuthContext.tsx`           | 9      | unsafe-member-access, unsafe-call     |
| `/client/src/features/admin/Dashboard.tsx`       | 14     | unsafe-member-access, unsafe-call     |
| `/client/src/features/admin/PackagesManager.tsx` | 15     | unsafe-member-access, unsafe-call     |
| `/client/src/features/booking/DatePicker.tsx`    | 13     | unsafe-member-access, unsafe-call     |
| `/server/src/routes/tenant-auth.routes.ts`       | 17     | unsafe-member-access, no-explicit-any |
| `/server/src/middleware/tenant-auth.ts`          | 11     | unsafe-member-access, no-explicit-any |

---

## Quality Errors Breakdown (268 total)

### By Priority

| Priority | Error Type                      | Count | Impact                          |
| -------- | ------------------------------- | ----- | ------------------------------- |
| P1       | `require-await`                 | 38    | Performance - unnecessary async |
| P2       | `explicit-function-return-type` | 35    | Type clarity                    |
| P3       | `no-unused-vars`                | 31    | Dead code                       |
| P4       | `restrict-template-expressions` | 29    | Type safety in templates        |
| P5       | `no-unnecessary-condition`      | 25    | Logic clarity                   |
| P6       | `prefer-nullish-coalescing`     | 76    | Style preference                |
| P7       | `no-non-null-assertion`         | 9     | Type safety                     |
| P8       | Other                           | 25    | Various                         |

---

## Fix Patterns for Each Error Type

### 1. `no-unsafe-member-access` (58 errors)

**Problem:** Accessing properties on unknown/error types without type guards.

#### Pattern A: Error Handling

```typescript
// ❌ BEFORE
catch (err) {
  if (err.status === 401) {
    console.error(err.body.error);
  }
}

// ✅ AFTER
catch (err) {
  const errorMessage = getErrorMessage(err);

  // If you need to check status
  if (isHttpError(err) && err.status === 401) {
    console.error(errorMessage);
  }
}
```

**Helper to add:**

```typescript
// client/src/lib/error-helpers.ts
export function isHttpError(error: unknown): error is { status: number; body: { error: string } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  );
}
```

#### Pattern B: API Response Access

```typescript
// ❌ BEFORE
const result = await apiCall();
const data = result.body;

// ✅ AFTER
const result = await apiCall();
if (!result.body || typeof result.body !== 'object') {
  throw new Error('Invalid response');
}
const data = result.body as ExpectedType;
```

### 2. `no-unsafe-assignment` (39 errors)

**Problem:** Assigning unknown types to typed variables.

#### Pattern A: API Error Handling

```typescript
// ❌ BEFORE
catch (error) {
  const apiError = error;
  setError(apiError.message);
}

// ✅ AFTER
catch (error) {
  const errorMessage = getErrorMessage(error);
  setError(errorMessage);
}
```

#### Pattern B: Metadata Access

```typescript
// ❌ BEFORE
const metadata = session.metadata;

// ✅ AFTER
const metadata = session.metadata as Record<string, string> | undefined;
if (!metadata) {
  throw new Error('Missing metadata');
}
```

### 3. `no-unsafe-call` (27 errors)

**Problem:** Calling unknown functions without type guards.

```typescript
// ❌ BEFORE
catch (error) {
  toast.error(String(error));
}

// ✅ AFTER
catch (error) {
  const errorMessage = getErrorMessage(error);
  toast.error(errorMessage);
}
```

### 4. `no-unsafe-argument` (10 errors)

**Problem:** Passing unknown types to functions expecting specific types.

```typescript
// ❌ BEFORE
setTenantId(metadata.tenantId);

// ✅ AFTER
const metadata = session.metadata as Record<string, string> | undefined;
if (!metadata?.tenantId) {
  throw new Error('Missing tenant ID');
}
setTenantId(metadata.tenantId);
```

### 5. `no-explicit-any` (6 errors)

**Problem:** Using `any` type instead of proper types.

```typescript
// ❌ BEFORE
const tenantAuth: any = req.tenantAuth;

// ✅ AFTER
interface TenantAuth {
  tenantId: string;
  slug: string;
  email: string;
}

const tenantAuth = req.tenantAuth as TenantAuth;
```

### 6. `require-await` (38 errors)

**Problem:** Async functions with no await expressions.

```typescript
// ❌ BEFORE
const refetch = async () => {
  execute();
};

// ✅ AFTER
const refetch = () => {
  void execute();
};
```

### 7. `explicit-function-return-type` (35 errors)

**Problem:** Missing return type annotations.

```typescript
// ❌ BEFORE
const handleSubmit = (data) => {
  return processData(data);
};

// ✅ AFTER
const handleSubmit = (data: FormData): Promise<void> => {
  return processData(data);
};
```

### 8. `no-unused-vars` (31 errors)

**Problem:** Variables defined but never used.

```typescript
// ❌ BEFORE
import { hasStatusCode, ApiError } from './api';

// ✅ AFTER
import { ApiError } from './api';

// OR if it's a parameter you need to keep:
function handler(_unusedParam: string, usedParam: number) {
  return usedParam * 2;
}
```

### 9. `prefer-nullish-coalescing` (76 errors)

**Problem:** Using `||` instead of `??` for fallback values.

```typescript
// ❌ BEFORE
const value = input || 'default';

// ✅ AFTER
const value = input ?? 'default';

// Why? Because || returns 'default' for 0, '', false
// But ?? only returns 'default' for null/undefined
```

**Auto-fix available:** Many of these can be fixed with `--fix` flag.

### 10. `restrict-template-expressions` (29 errors)

**Problem:** Using numbers/booleans in template literals.

```typescript
// ❌ BEFORE
const message = `Photo ${index}`;
const label = `${count} items`;

// ✅ AFTER
const message = `Photo ${String(index)}`;
const label = `${count.toString()} items`;
```

### 11. `no-unnecessary-condition` (25 errors)

**Problem:** Conditions that are always true/false.

```typescript
// ❌ BEFORE
if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'development') {
  // ...
}

// ✅ AFTER
if (import.meta.env.MODE === 'development') {
  // ...
}
```

### 12. `no-non-null-assertion` (9 errors)

**Problem:** Using `!` operator to assert non-null.

```typescript
// ❌ BEFORE
const user = users.find((u) => u.id === id)!;

// ✅ AFTER
const user = users.find((u) => u.id === id);
if (!user) {
  throw new Error(`User ${id} not found`);
}
```

### 13. `await-thenable` (4 errors)

**Problem:** Using `await` on non-Promise values.

```typescript
// ❌ BEFORE
const result = await syncFunction();

// ✅ AFTER
const result = syncFunction();
```

### 14. `no-misused-promises` (3 errors)

**Problem:** Using promises in places that expect non-async callbacks.

```typescript
// ❌ BEFORE
onClick={async () => await handleClick()}

// ✅ AFTER
onClick={() => { void handleClick(); }}
```

### 15. `no-unnecessary-type-assertion` (3 errors)

**Problem:** Type assertions that don't change the type.

```typescript
// ❌ BEFORE
const value = someString as string;

// ✅ AFTER
const value = someString;
```

### 16. `unbound-method` (2 errors)

**Problem:** Using class methods without binding `this`.

```typescript
// ❌ BEFORE
onClick={this.handleClick}

// ✅ AFTER
onClick={() => this.handleClick()}
// OR in constructor:
this.handleClick = this.handleClick.bind(this);
```

### 17. `prefer-optional-chain` (1 error)

**Problem:** Using nested conditionals instead of optional chaining.

```typescript
// ❌ BEFORE
if (user && user.profile && user.profile.name) {
  console.log(user.profile.name);
}

// ✅ AFTER
if (user?.profile?.name) {
  console.log(user.profile.name);
}
```

### 18. `no-var-requires` (1 error)

**Problem:** Using `require()` instead of ES6 imports.

```typescript
// ❌ BEFORE
const module = require('./module');

// ✅ AFTER
import module from './module';
```

### 19. `array-type` (1 error)

**Problem:** Inconsistent array type syntax.

```typescript
// ❌ BEFORE
const items: Array<string> = [];

// ✅ AFTER
const items: string[] = [];
```

### 20. `no-confusing-void-expression` (1 error)

**Problem:** Returning void expressions from arrow functions.

```typescript
// ❌ BEFORE
const handler = () => doSomething(); // where doSomething returns void

// ✅ AFTER
const handler = () => {
  doSomething();
};
```

---

## Special Case: Parsing Errors (9 errors)

### Issue: Duplicate Imports

Three files have duplicate `getErrorMessage` imports:

1. `/client/src/features/tenant-admin/BlackoutsManager.tsx`
2. `/client/src/features/tenant-admin/BrandingEditor.tsx`
3. `/client/src/features/tenant-admin/TenantBookingList.tsx`

**Fix:** Remove all duplicate import lines.

```typescript
// ❌ BEFORE (multiple lines)
import { getErrorMessage } from '@elope/shared';
import { Card } from '@/components/ui/card';
import { getErrorMessage } from '@elope/shared';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@elope/shared';

// ✅ AFTER (single import at top)
import { getErrorMessage } from '@elope/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
```

### Issue: Files Not in tsconfig

Some script files are linted but not in tsconfig:

- `server/prisma/seed.ts`
- `server/scripts/*.ts`

**Fix:** Already handled by `.eslintrc.cjs` ignore patterns for these directories.

---

## File-by-File Fix Guide

### Priority 1: Critical Files (Fix First)

#### 1. **Parsing Errors** (5 minutes)

Fix the 3 files with duplicate imports:

```bash
# These files need manual editing to remove duplicate imports
client/src/features/tenant-admin/BlackoutsManager.tsx
client/src/features/tenant-admin/BrandingEditor.tsx
client/src/features/tenant-admin/TenantBookingList.tsx
```

**Action:** Open each file, find duplicate `import { getErrorMessage }` lines, keep only one at the top.

#### 2. **server/src/adapters/mock/index.ts** (30 minutes)

44 errors - mostly `require-await` and type safety issues.

**Approach:**

1. Remove `async` from functions that don't use `await`
2. Add proper type guards for unknown data access
3. Add return types to all functions

**Example fix:**

```typescript
// ❌ BEFORE
async getPackageBySlug(slug: string) {
  return Array.from(packages.values()).find(p => p.slug === slug);
}

// ✅ AFTER
getPackageBySlug(slug: string): Package | undefined {
  return Array.from(packages.values()).find(p => p.slug === slug);
}
```

#### 3. **client/src/contexts/AuthContext.tsx** (20 minutes)

14 errors - error handling and type safety.

**Approach:**

1. Replace direct error property access with `getErrorMessage()`
2. Add type guards for error status checks
3. Remove unused `hasStatusCode` import
4. Add explicit return types

**Example fix:**

```typescript
// ❌ BEFORE
catch (error) {
  if (error.status === 401) {
    toast.error(String(error.body?.error || error.body?.message || error.body));
  }
}

// ✅ AFTER
catch (error) {
  const errorMessage = getErrorMessage(error);

  if (isHttpError(error) && error.status === 401) {
    toast.error(errorMessage);
  }
}
```

#### 4. **client/src/features/admin/Dashboard.tsx** (25 minutes)

22 errors - similar error handling patterns.

**Approach:**

1. Replace error property access with helper functions
2. Fix duplicate condition checks
3. Remove unused imports

#### 5. **client/src/features/admin/PackagesManager.tsx** (25 minutes)

20 errors - error handling and nullish coalescing.

**Approach:**

1. Fix error handling in all catch blocks
2. Replace `||` with `??` for default values
3. Add explicit function return types

#### 6. **server/src/routes/tenant-auth.routes.ts** (20 minutes)

17 errors - `any` types and unsafe access.

**Approach:**

1. Define proper interface for tenant auth
2. Replace `any` with typed interfaces
3. Add type guards for metadata access

**Example fix:**

```typescript
// ❌ BEFORE
const tenantAuth: any = req.tenantAuth;
setUserId(tenantAuth.tenantId);

// ✅ AFTER
interface TenantAuth {
  tenantId: string;
  slug: string;
  email: string;
}

const tenantAuth = req.tenantAuth as TenantAuth;
if (!tenantAuth?.tenantId) {
  throw new Error('Missing tenant ID');
}
setUserId(tenantAuth.tenantId);
```

### Priority 2: Medium Impact Files (Fix Second)

| File                                               | Errors | Time   | Main Issues                    |
| -------------------------------------------------- | ------ | ------ | ------------------------------ |
| `client/src/pages/Success.tsx`                     | 24     | 20 min | require-await, unsafe access   |
| `client/src/lib/package-photo-api.test.example.ts` | 24     | 15 min | Missing return types, console  |
| `client/src/features/booking/DatePicker.tsx`       | 13     | 15 min | Error handling                 |
| `client/src/features/catalog/PackagePage.tsx`      | 11     | 15 min | Nullish coalescing, conditions |
| `client/src/widget/WidgetApp.tsx`                  | 18     | 20 min | Error handling                 |

### Priority 3: Low Impact Files (Fix Last)

| File                                   | Errors   | Time     | Main Issues          |
| -------------------------------------- | -------- | -------- | -------------------- |
| `client/src/lib/api.ts`                | 10       | 15 min   | Nullish coalescing   |
| `client/src/lib/auth.ts`               | 7        | 10 min   | Template expressions |
| `client/src/hooks/usePackagePhotos.ts` | 7        | 10 min   | Nullish coalescing   |
| `client/src/hooks/useApi.ts`           | 3        | 5 min    | require-await        |
| Various small files                    | 1-5 each | 5-10 min | Mixed issues         |

---

## Automated Fix Opportunities

### Auto-fixable with `--fix` (4 errors)

```bash
npm run lint -- --fix
```

This will automatically fix some simple issues like spacing and formatting.

### Semi-automated: Find and Replace

#### Replace `||` with `??` for default values (76 instances)

**Be careful:** Only replace when the left side could be 0, '', or false legitimately.

**Safe pattern:**

```typescript
// Safe to replace - string that shouldn't be empty
const name = input || 'default';  →  const name = input ?? 'default';

// DON'T replace - number where 0 is valid
const count = input || 10;  // Keep as ||
```

**Command to find:**

```bash
npm run lint 2>&1 | grep "prefer-nullish-coalescing"
```

### Scripts That Could Help

#### 1. Remove Unused Imports Script

Create `scripts/fix-unused-imports.sh`:

```bash
#!/bin/bash
# Remove common unused imports
find client/src -name "*.tsx" -o -name "*.ts" | while read file; do
  sed -i.bak 's/import { hasStatusCode, \(.*\) } from/import { \1 } from/g' "$file"
  sed -i.bak 's/import { \(.*\), hasStatusCode } from/import { \1 } from/g' "$file"
  rm -f "$file.bak"
done
```

#### 2. Add Return Types Script

Create `scripts/add-return-types.sh`:

```bash
#!/bin/bash
# Find functions missing return types
npm run lint 2>&1 | grep "explicit-function-return-type" | cut -d: -f1 | sort -u
```

---

## Testing Strategy

### After Each Fix

1. **Run TypeScript Compiler**

   ```bash
   npm run typecheck
   ```

2. **Run Linter**

   ```bash
   npm run lint
   ```

3. **Run Related Tests**

   ```bash
   # If fixing client code
   npm run test:client

   # If fixing server code
   npm run test:server
   ```

### Before Committing

1. **Full Test Suite**

   ```bash
   npm test
   ```

2. **Build Check**

   ```bash
   npm run build
   ```

3. **Manual Testing**
   - Test login flow (if touched auth)
   - Test package creation (if touched admin)
   - Test booking flow (if touched booking)

### Regression Prevention

1. **Create a branch**

   ```bash
   git checkout -b fix/lint-errors
   ```

2. **Commit frequently**
   - After each file or small group of files
   - With descriptive messages
   - Easy to rollback if something breaks

3. **Test incrementally**
   - Don't fix all 426 errors before testing
   - Fix 20-30, test, commit
   - Repeat

---

## Time Estimates

### By Priority

| Priority                 | Errors  | Estimated Time | Files        |
| ------------------------ | ------- | -------------- | ------------ |
| **Critical Path**        |         |                |              |
| P0: Parsing errors       | 9       | 5 min          | 3 files      |
| P1: High-impact files    | 140     | 2-3 hours      | 7 files      |
| **Quality Improvements** |         |                |              |
| P2: Medium-impact files  | 90      | 1.5-2 hours    | 10 files     |
| P3: Low-impact files     | 187     | 1-2 hours      | 50+ files    |
| **Total**                | **426** | **5-7 hours**  | **71 files** |

### Recommended Schedule

#### Day 1: Critical Errors (3 hours)

- [ ] Fix 3 parsing errors (5 min)
- [ ] Fix mock adapter (30 min)
- [ ] Fix AuthContext (20 min)
- [ ] Fix admin Dashboard (25 min)
- [ ] Fix PackagesManager (25 min)
- [ ] Fix tenant-auth routes (20 min)
- [ ] Test everything (1 hour)

#### Day 2: Quality Improvements (4 hours)

- [ ] Fix remaining error handling (1 hour)
- [ ] Replace `||` with `??` (1 hour)
- [ ] Add missing return types (1 hour)
- [ ] Remove unused variables (30 min)
- [ ] Fix template expressions (30 min)

---

## Quick Reference: Common Patterns

### Error Handling Template

```typescript
try {
  const result = await apiCall();
  // Handle success
} catch (error) {
  const errorMessage = getErrorMessage(error);

  // If you need status check
  if (isHttpError(error)) {
    if (error.status === 401) {
      // Handle unauthorized
    } else if (error.status === 404) {
      // Handle not found
    }
  }

  // Show error to user
  toast.error(errorMessage);
}
```

### Type Guard Template

```typescript
function isHttpError(error: unknown): error is {
  status: number;
  body: { error: string; message?: string };
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  );
}
```

### Nullish Coalescing Decision Tree

```
Is the left side a string/object/array?
├─ Yes → Use ?? (safe)
└─ No → Is 0/false/'' a valid value?
    ├─ Yes → Keep || (intentional)
    └─ No → Use ?? (safe)
```

---

## Progress Tracking

### Create Issues for Each Priority

```markdown
## P0: Parsing Errors (5 min)

- [ ] BlackoutsManager.tsx - Remove duplicate imports
- [ ] BrandingEditor.tsx - Remove duplicate imports
- [ ] TenantBookingList.tsx - Remove duplicate imports

## P1: Critical Files (3 hours)

- [ ] server/src/adapters/mock/index.ts (44 errors)
- [ ] client/src/contexts/AuthContext.tsx (14 errors)
- [ ] client/src/features/admin/Dashboard.tsx (22 errors)
- [ ] client/src/features/admin/PackagesManager.tsx (20 errors)
- [ ] server/src/routes/tenant-auth.routes.ts (17 errors)

## P2: Medium Impact (2 hours)

- [ ] client/src/pages/Success.tsx (24 errors)
- [ ] client/src/features/booking/DatePicker.tsx (13 errors)
- [ ] ... (continue for other files)
```

---

## Success Criteria

### Phase 1: Critical (Target: < 50 errors)

- ✅ All parsing errors fixed
- ✅ All `no-explicit-any` fixed
- ✅ All error handling using type guards
- ✅ All tests passing

### Phase 2: Quality (Target: < 10 errors)

- ✅ All `require-await` fixed
- ✅ All `no-unused-vars` fixed
- ✅ All missing return types added
- ✅ Most `prefer-nullish-coalescing` fixed

### Phase 3: Polish (Target: 0 errors)

- ✅ All template expressions properly typed
- ✅ All unnecessary conditions removed
- ✅ All warnings addressed
- ✅ Build passing with no lint errors

---

## Getting Help

If you get stuck on a specific error:

1. **Check the pattern above** for that error type
2. **Look at similar fixed files** in the codebase
3. **Run TypeScript compiler** to see if there are underlying type issues
4. **Search ESLint docs** for the specific rule

### Useful Links

- ESLint TypeScript Rules: https://typescript-eslint.io/rules/
- Type Guards Guide: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- Error Handling Best Practices: https://kentcdodds.com/blog/get-a-catch-block-error-message-with-typescript

---

## Summary: Fix Order by Impact

This table shows the optimal order to fix errors for maximum impact with minimum effort:

| Order | Task                                    | Errors Fixed | Time    | Difficulty | Impact |
| ----- | --------------------------------------- | ------------ | ------- | ---------- | ------ |
| 1     | Fix parsing errors (duplicate imports)  | 9            | 5 min   | Easy       | High   |
| 2     | Run `--fix` for auto-fixable errors     | 4            | 1 min   | Easy       | Low    |
| 3     | Fix `server/src/adapters/mock/index.ts` | 44           | 30 min  | Medium     | High   |
| 4     | Create error helper functions           | 0            | 15 min  | Medium     | High   |
| 5     | Fix all error handling (12 files)       | 80+          | 2 hours | Medium     | High   |
| 6     | Remove `require-await` (38 instances)   | 38           | 45 min  | Easy       | Medium |
| 7     | Add missing return types (35 instances) | 35           | 1 hour  | Easy       | Medium |
| 8     | Remove unused variables (31 instances)  | 31           | 30 min  | Easy       | Low    |
| 9     | Replace `\|\|` with `??` (76 instances) | 76           | 1 hour  | Easy       | Low    |
| 10    | Fix template expressions (29 instances) | 29           | 30 min  | Easy       | Low    |
| 11    | Fix remaining edge cases                | 80           | 1 hour  | Hard       | Medium |

**Total:** 426 errors → 5-7 hours

---

## Quick Checklist

Copy this checklist to track your progress:

```markdown
## Lint Error Fix Progress

### Phase 1: Quick Wins (30 min)

- [ ] Fix 3 files with duplicate imports (5 min)
- [ ] Run `npm run lint -- --fix` (1 min)
- [ ] Create `isHttpError()` helper function (10 min)
- [ ] Test helpers work (5 min)
- [ ] Commit: "fix: remove duplicate imports and add error helpers"

### Phase 2: Critical Errors (3 hours)

- [ ] Fix server/src/adapters/mock/index.ts (30 min)
- [ ] Fix client/src/contexts/AuthContext.tsx (20 min)
- [ ] Fix client/src/features/admin/Dashboard.tsx (25 min)
- [ ] Fix client/src/features/admin/PackagesManager.tsx (25 min)
- [ ] Fix server/src/routes/tenant-auth.routes.ts (20 min)
- [ ] Fix server/src/middleware/tenant-auth.ts (15 min)
- [ ] Fix client/src/features/booking/DatePicker.tsx (15 min)
- [ ] Test all critical paths (30 min)
- [ ] Commit: "fix: improve type safety in error handling and auth"

### Phase 3: Quality Improvements (2 hours)

- [ ] Remove all `require-await` (45 min)
- [ ] Add all missing return types (1 hour)
- [ ] Remove all unused variables (30 min)
- [ ] Test everything (15 min)
- [ ] Commit: "refactor: remove unnecessary async and add return types"

### Phase 4: Style Improvements (2 hours)

- [ ] Replace `||` with `??` (1 hour)
- [ ] Fix template expressions (30 min)
- [ ] Fix unnecessary conditions (20 min)
- [ ] Fix remaining edge cases (30 min)
- [ ] Final test suite run (20 min)
- [ ] Commit: "style: use nullish coalescing and fix template expressions"

### Final Verification

- [ ] Run `npm run lint` - should show 0 errors
- [ ] Run `npm run typecheck` - should pass
- [ ] Run `npm test` - should pass
- [ ] Run `npm run build` - should succeed
- [ ] Manual smoke test of key features
- [ ] Create PR: "fix: resolve all 426 lint errors"
```

---

## Appendix: Complete Error Type Reference

| Error Code                      | Count | Severity | Auto-fix? | Pattern Section                                    |
| ------------------------------- | ----- | -------- | --------- | -------------------------------------------------- |
| `prefer-nullish-coalescing`     | 76    | Low      | Partial   | [#9](#9-prefer-nullish-coalescing-76-errors)       |
| `no-unsafe-member-access`       | 58    | High     | No        | [#1](#1-no-unsafe-member-access-58-errors)         |
| `no-unsafe-assignment`          | 39    | High     | No        | [#2](#no-unsafe-assignment-39-errors)              |
| `require-await`                 | 38    | Medium   | No        | [#6](#6-require-await-38-errors)                   |
| `explicit-function-return-type` | 35    | Medium   | No        | [#7](#7-explicit-function-return-type-35-errors)   |
| `no-unused-vars`                | 31    | Medium   | Partial   | [#8](#8-no-unused-vars-31-errors)                  |
| `restrict-template-expressions` | 29    | Medium   | No        | [#10](#10-restrict-template-expressions-29-errors) |
| `no-unsafe-call`                | 27    | High     | No        | [#3](#3-no-unsafe-call-27-errors)                  |
| `no-unnecessary-condition`      | 25    | Low      | No        | [#11](#11-no-unnecessary-condition-25-errors)      |
| `no-unsafe-argument`            | 10    | High     | No        | [#4](#4-no-unsafe-argument-10-errors)              |
| `no-non-null-assertion`         | 9     | Medium   | No        | [#12](#12-no-non-null-assertion-9-errors)          |
| `no-explicit-any`               | 6     | High     | No        | [#5](#5-no-explicit-any-6-errors)                  |
| `await-thenable`                | 4     | Medium   | No        | [#13](#13-await-thenable-4-errors)                 |
| `no-misused-promises`           | 3     | Medium   | No        | [#14](#14-no-misused-promises-3-errors)            |
| `no-unnecessary-type-assertion` | 3     | Low      | No        | [#15](#15-no-unnecessary-type-assertion-3-errors)  |
| `unbound-method`                | 2     | Medium   | No        | [#16](#16-unbound-method-2-errors)                 |
| `prefer-optional-chain`         | 1     | Low      | Yes       | [#17](#17-prefer-optional-chain-1-error)           |
| `no-var-requires`               | 1     | Medium   | No        | [#18](#18-no-var-requires-1-error)                 |
| `array-type`                    | 1     | Low      | Yes       | [#19](#19-array-type-1-error)                      |
| `no-confusing-void-expression`  | 1     | Low      | No        | [#20](#20-no-confusing-void-expression-1-error)    |
| `no-console` (warnings)         | 18    | Info     | No        | N/A                                                |

**Total:** 426 problems

---

## Need Help?

If you're working through this guide and get stuck:

1. **Check the specific pattern** for your error type in the sections above
2. **Look at the file-by-file guidance** for context-specific help
3. **Run the TypeScript compiler** (`npm run typecheck`) to see underlying issues
4. **Test incrementally** - don't fix everything before testing
5. **Commit frequently** - makes it easy to rollback if needed

**Remember:** The goal is not perfection on the first pass. Fix the critical errors first, test thoroughly, then improve quality incrementally.
