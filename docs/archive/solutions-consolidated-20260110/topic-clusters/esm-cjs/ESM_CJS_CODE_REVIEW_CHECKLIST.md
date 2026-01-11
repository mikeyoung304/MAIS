---
title: 'ESM/CJS Module Compatibility - Code Review Checklist'
slug: esm-cjs-code-review-checklist
category: prevention
tags: [code-review, modules, esm, cjs, import-patterns, pr-checklist]
created: 2025-11-29
---

# ESM/CJS Module Compatibility - Code Review Checklist

## Purpose

Use this checklist during code reviews to catch module compatibility issues before they reach production. Reviewers should verify that all new imports follow correct patterns.

**Applies to:** Any PR that adds/modifies npm packages or imports

---

## Import Pattern Verification

### Checklist Item 1: Import Statement Classification

For each new import statement in the PR, classify it:

#### Is it a direct import?

```typescript
import { something } from 'package';
import DefaultExport from 'package';
```

**Review questions:**

- [ ] Package is confirmed ESM-native (has `"type": "module"` in package.json)
- [ ] TypeScript compilation passes with no "Cannot find module" errors
- [ ] Package is not on the "CJS-only" list (check MODULE_COMPATIBILITY.md)
- [ ] No comments like "TODO: convert to createRequire"

**Risk:** Low (if all checks pass)

---

#### Is it a createRequire import?

```typescript
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('package-name');
```

**Review questions:**

- [ ] Package is confirmed CJS-only (no `"type": "module"`)
- [ ] Type assertion is present: `as typeof import('package')`
- [ ] Comment explains WHY createRequire is needed
- [ ] Comment includes link to package repo/issue
- [ ] Import is used only in ONE location (centralize if duplicated)
- [ ] TypeScript compilation passes

**Risk:** Medium (requires careful type casting)

**Example comment:**

```typescript
// file-type v16 is CommonJS-only
// See: https://github.com/sindresorhus/file-type/releases/tag/v16.5.0
// v17+ is ESM - consider upgrading in future
const require = createRequire(import.meta.url);
const fileType = require('file-type') as typeof import('file-type');
```

---

#### Is it a dynamic import?

```typescript
const pkg = await import('package-name');
const result = pkg.functionName();
```

**Review questions:**

- [ ] Import is in an async context (function, method)
- [ ] Error handling is present (try/catch or .catch())
- [ ] Performance impact is acceptable (lazy loading is intentional)
- [ ] No redundant dynamic imports in loop (O(n) calls)
- [ ] TypeScript types are properly inferred or cast

**Risk:** Medium (async patterns need careful handling)

**Example:**

```typescript
// ✅ GOOD: Dynamic import with error handling
async function processFile(buffer: Buffer) {
  try {
    const { fromBuffer } = await import('file-type');
    return await fromBuffer(buffer);
  } catch (error) {
    logger.error({ error }, 'Failed to detect file type');
    throw new FileValidationError('Unable to validate file');
  }
}

// ❌ BAD: No error handling
async function processFile(buffer: Buffer) {
  const { fromBuffer } = await import('file-type'); // What if it fails?
  return await fromBuffer(buffer);
}

// ❌ BAD: Inefficient in loop
for (const file of files) {
  const { validate } = await import('validator'); // Called N times!
  validate(file);
}
```

---

### Checklist Item 2: Package.json Verification

When adding a new package, verify:

```bash
# Check the package.json fields
npm view package-name type
npm view package-name exports
npm view package-name main
```

**Review checklist:**

- [ ] Package exists in `package.json` (either `dependencies` or `devDependencies`)
- [ ] Version is reasonable (not a pre-release like `0.0.1-beta.1`)
- [ ] Version constraint allows updates (use `^` for minor, `~` for patch)
- [ ] TypeScript types are available (`@types/package` or built-in `.d.ts`)
- [ ] No deprecated packages are being used
- [ ] Package is not in both dependencies and devDependencies

**Red flags:**

- ❌ Package version starts with `0.0.` (very new, untested)
- ❌ Package has no recent commits (6+ months old)
- ❌ Package appears in both `dependencies` and `devDependencies`
- ❌ Package is listed but not imported anywhere in code
- ❌ Version is `*` or `latest` (no version pinning)

---

### Checklist Item 3: Type Safety

**For direct imports:**

```typescript
// ✅ GOOD: Types imported from package
import { FileTypeResult } from 'file-type';
import type { Config } from 'package';

// ❌ BAD: Using any
import * as fileType from 'file-type'; // Okay
const result: any = fileType.something; // Not okay!

// ❌ BAD: No types at all
const result = require('package'); // No type information
```

**Review questions:**

- [ ] All imports use specific named exports (not `*`)
- [ ] No `as any` type assertions
- [ ] Types are imported separately when needed: `import type { T }`
- [ ] No `any` types in function signatures
- [ ] TypeScript strict mode passes: `npm run typecheck`

---

**For createRequire imports:**

```typescript
// ✅ GOOD: Type assertion present
const pkg = require('package') as typeof import('package');

// ✅ GOOD: Explicit interface provided
const pkg = require('package') as {
  fromBuffer: (buffer: Buffer) => Promise<Result>;
};

// ❌ BAD: No type information
const pkg = require('package');
pkg.something(); // No IntelliSense!

// ❌ BAD: Using any
const pkg = require('package') as any;
```

**Review questions:**

- [ ] Type assertion is present (`as typeof import(...)` or explicit interface)
- [ ] Type is accurate (matches actual package exports)
- [ ] No `as any` assertions
- [ ] TypeScript compilation passes

---

### Checklist Item 4: Comment Documentation

Every non-obvious import needs a comment explaining why.

**Direct imports (usually no comment needed):**

```typescript
// No comment needed - it's obvious
import { stripe } from 'stripe';
import { PrismaClient } from '@prisma/client';
```

**createRequire imports (comment REQUIRED):**

```typescript
// ✅ GOOD: Clear explanation
// file-type v16 is CommonJS-only (ESM version v17+ available)
// See: https://github.com/sindresorhus/file-type
const require = createRequire(import.meta.url);
const fileType = require('file-type') as typeof import('file-type');

// ❌ BAD: No explanation
const require = createRequire(import.meta.url);
const fileType = require('file-type');
```

**Comment template:**

```typescript
// [PACKAGE] [VERSION] is [ESM|CJS|DUAL]-only
// See: [GITHUB ISSUE/DISCUSSION URL or PACKAGE.JSON field]
// [Any migration path or upgrade notes]
const require = createRequire(import.meta.url);
const pkg = require('package') as typeof import('package');
```

**Review questions:**

- [ ] All CJS imports have comments
- [ ] Comments explain why the pattern is necessary
- [ ] Comments include package repo link or issue reference
- [ ] Comments mention any migration path (e.g., "v17+ is ESM")
- [ ] No outdated or wrong information in comments

---

### Checklist Item 5: Centralized Imports

**Principle:** Import packages in one place, re-export if needed elsewhere.

**Good pattern:**

```typescript
// ✅ server/src/adapters/file-type.adapter.ts (centralized)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fileType = require('file-type') as typeof import('file-type');

export async function detectFileType(buffer: Buffer) {
  return await fileType.fromBuffer(buffer);
}

// ✅ server/src/services/upload.service.ts (uses adapter)
import { detectFileType } from '../adapters/file-type.adapter';

async function validateFile(buffer: Buffer) {
  const detected = await detectFileType(buffer);
  // ...
}
```

**Bad pattern:**

```typescript
// ❌ Duplicated in multiple files
// services/upload.service.ts
const require = createRequire(import.meta.url);
const fileType = require('file-type');

// services/validation.service.ts
const require = createRequire(import.meta.url);
const fileType = require('file-type');

// services/processor.service.ts
const require = createRequire(import.meta.url);
const fileType = require('file-type');
```

**Review questions:**

- [ ] createRequire is used only once (not duplicated in multiple files)
- [ ] If multiple files need the package, is it re-exported from central location?
- [ ] Adapter pattern is used if needed (see ARCHITECTURE.md)

---

## Testing Verification

### Checklist Item 6: Unit Tests

When new imports are added, verify tests cover the new code:

**Review questions:**

- [ ] Unit tests exist for functions using new package
- [ ] Tests pass: `npm test` returns 100% pass rate
- [ ] Tests cover both success and error paths
- [ ] No tests are skipped or marked `.skip`
- [ ] Test coverage has not decreased

**Example test for file-type:**

```typescript
// ✅ GOOD: Tests the actual file-type usage
test('should detect JPEG from buffer', async () => {
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const service = new UploadService(mockRepo);

  const result = await service.validateFile({
    buffer: jpegBuffer,
    mimetype: 'image/jpeg',
    // ... other fields
  });

  // Should not throw
  expect(result).toBeUndefined();
});

// ✅ GOOD: Tests error cases
test('should reject invalid file type', async () => {
  const invalidBuffer = Buffer.from([0x00, 0x00]);
  const service = new UploadService(mockRepo);

  await expect(
    service.validateFile({
      buffer: invalidBuffer,
      mimetype: 'image/jpeg',
      // ...
    })
  ).rejects.toThrow('File validation failed');
});
```

---

### Checklist Item 7: Integration Tests

If package interacts with other systems, verify integration tests:

**Review questions:**

- [ ] Integration tests exist for new code
- [ ] Tests pass: `npm run test:integration`
- [ ] Database interactions are tested (if applicable)
- [ ] External APIs are mocked (not called in tests)
- [ ] Tests use proper cleanup/setup

**Example:**

```typescript
// ✅ GOOD: Integration test with database
test('should store file after validation', async () => {
  const service = new UploadService(
    prismaMockRepository,
    supabaseAdapter,
    new FileTypeAdapter() // Real file-type usage
  );

  const uploadedFile = await service.upload(tenantId, file);

  // Verify database was updated
  const storedFile = await db.segment.findUnique({
    where: { id: uploadedFile.segmentId },
  });
  expect(storedFile.imageUrl).toBeDefined();
});
```

---

### Checklist Item 8: E2E Tests

For user-facing features, verify E2E tests:

**Review questions:**

- [ ] E2E tests exist for features using new package
- [ ] Tests pass: `npm run test:e2e`
- [ ] Tests use real tsx runtime (not mocked)
- [ ] User workflows are tested end-to-end
- [ ] Tests work in both development and production

**Example:**

```typescript
// ✅ GOOD: E2E test of actual user flow
test('user should be able to upload image', async () => {
  await page.goto('http://localhost:5173/admin/segments');
  await page.locator('input[type="file"]').setInputFiles('image.jpg');
  await page.locator('button:has-text("Upload")').click();

  // Image should appear on page
  await expect(page.locator('img[alt="Hero"]')).toBeVisible();

  // Image should be in database
  const segment = await db.segment.findFirst({
    where: { tenantId },
  });
  expect(segment.imageUrl).toBeDefined();
});
```

---

## Compatibility Checklist

### Checklist Item 9: TypeScript Compilation

```bash
# Run before approving
npm run typecheck
```

**Should see:**

- ✅ 0 TypeScript errors
- ✅ No "Cannot find module" messages
- ✅ No "Cannot assign type" messages

**Review output:**

```bash
# ✅ GOOD
$ npm run typecheck
0 errors

# ❌ BAD
$ npm run typecheck
src/services/upload.service.ts:5:27 - error TS2307: Cannot find module 'file-type'.
src/services/upload.service.ts:10:5 - error TS2322: Type 'any' is not assignable to type 'FileTypeResult'.
```

---

### Checklist Item 10: Runtime Compatibility

Verify the PR works in actual runtime:

**Before approving:**

```bash
# 1. Development mode
npm run dev:api
# Should start without errors

# 2. Can connect and make requests
curl http://localhost:3001/health
# Should return 200

# 3. Feature using new package works
# (Test the specific feature that uses the package)

# 4. Production build
npm run build
# Should complete without errors

# 5. Can start built version
npm start
# Should start without errors
```

**Review questions:**

- [ ] Development mode starts: `npm run dev:api`
- [ ] No "Cannot find module" at runtime
- [ ] Feature using new package works correctly
- [ ] Production build completes: `npm run build`
- [ ] Built code can start: `npm start`

---

### Checklist Item 11: Package.json Consistency

**Verify changes to package.json:**

```bash
# Check diff
git diff package.json
git diff server/package.json

# Verify format
npm install --no-save  # Ensure package.json is valid
```

**Review checklist:**

- [ ] New dependency is in `dependencies`, not `devDependencies` (unless it's dev-only)
- [ ] Version is reasonable and pinned
- [ ] No duplicate dependencies
- [ ] Package.json is properly formatted (no syntax errors)
- [ ] Lock file is updated (package-lock.json or pnpm-lock.yaml)

---

## Module Compatibility Verification

### Checklist Item 12: Dual Package Hazard Prevention

For packages with both ESM and CJS exports:

**Review questions:**

- [ ] Only ONE import pattern is used in entire codebase
- [ ] No mixing of `import` and `require` for same package
- [ ] No duplicate module instances (run test if uncertain)

**Test for dual package hazard:**

```typescript
// Add this test to verify no duplicate instances
test('file-type should not be loaded twice', async () => {
  // This ensures we're not importing both ESM and CJS versions
  const service = new UploadService(repo);
  const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

  // Should work without state mismatches
  const result = await service.validateFile({
    buffer,
    mimetype: 'image/jpeg',
    // ... other fields
  });

  expect(result).toBeUndefined();
});
```

---

### Checklist Item 13: Alternative Packages

For CJS-only packages, verify no better alternative exists:

**Review questions:**

- [ ] Is there a newer ESM version of this package?
- [ ] Did author indicate ESM support is coming?
- [ ] Is there a maintained ESM alternative?
- [ ] Would upgrading package version fix the issue?

**Example decision:**

```typescript
// file-type situation:
// - v16: CJS-only (we use createRequire)
// - v17+: ESM-native
//
// DECISION: Use v16 with createRequire now
// PLAN: Monitor v17 for possible upgrade

// If v17 becomes stable:
// - Update import to: import { fromBuffer } from 'file-type';
// - Remove createRequire wrapper
// - Simplify code
```

**Review comment template:**

```
Package: file-type@16.5.4
Status: CJS-only, ESM alternative exists (v17+)
Decision: Acceptable with createRequire pattern
Future: Plan to upgrade to v17+ when stable
```

---

## Common Issues to Look For

### Issue: "Cannot find module 'xyz'"

**Signs in PR:**

```typescript
// ❌ RED FLAG: Direct import of CJS package
import { something } from 'cjs-only-package';
```

**What to do:**

1. Ask author to check package.json for `"type": "module"`
2. If CJS-only, request createRequire wrapper
3. Verify TypeScript compilation passes

---

### Issue: "Type 'never' is not assignable to type 'T'"

**Signs in PR:**

```typescript
// ❌ RED FLAG: No type assertion
const pkg = require('package');
const result: ExpectedType = pkg.method(); // Type error!
```

**What to do:**

1. Ask author to add type assertion: `as typeof import('package')`
2. Or provide explicit interface: `as { method: (...) => ... }`
3. Verify TypeScript strict mode passes

---

### Issue: Module loaded twice (duplicate instances)

**Signs in PR:**

- State is not shared between modules
- Singleton pattern breaks
- Configuration not applied globally

**What to do:**

```typescript
// Test to check
test('singleton pattern works', () => {
  import { logger } from 'package';
  const logger2 = require('package').logger;

  if (logger !== logger2) {
    throw new Error('DUAL PACKAGE HAZARD: Two instances loaded');
  }
});
```

---

## Approval Decision Tree

```
Does PR add/modify imports?
├─ NO → Skip module checks, continue with other review items
└─ YES → Answer these questions:

  1. Is import pattern correct for package type?
     NO → REQUEST CHANGES
     YES → Continue

  2. Is type safety verified (npm run typecheck)?
     NO → REQUEST CHANGES
     YES → Continue

  3. Are there appropriate comments explaining the pattern?
     NO → REQUEST CHANGES (for CJS imports)
     YES → Continue

  4. Do all tests pass (npm test, npm run test:e2e)?
     NO → REQUEST CHANGES
     YES → Continue

  5. Is the import centralized (not duplicated)?
     NO → REQUEST CHANGES
     YES → Continue

  6. Is there a better alternative package?
     YES → COMMENT (suggest alternative, don't require)
     NO → Continue

  7. All checks passed?
     YES → APPROVE (with optional notes)
     NO → REQUEST CHANGES
```

---

## Review Comment Examples

### Approving a good import:

```
Great! I reviewed the module compatibility:
- Direct import for ESM-native package ✅
- TypeScript types verified ✅
- Tests cover the new code ✅
- No type issues in npm run typecheck ✅

Approved!
```

---

### Requesting changes for CJS import without comment:

````
This uses createRequire for a CJS package, which is good.
However, could you add a comment explaining why?

Something like:
```typescript
// file-type v16 is CommonJS-only
// See: https://github.com/sindresorhus/file-type/releases
// v17+ is ESM - consider upgrading in future
const require = createRequire(import.meta.url);
const fileType = require('file-type') as typeof import('file-type');
````

This helps future developers understand the pattern.

```

---

### Requesting changes for type safety:

```

I see the createRequire import here, but it's missing the type assertion:

```typescript
// ❌ No type information
const fileType = require('file-type');

// ✅ Add type assertion
const fileType = require('file-type') as typeof import('file-type');
```

This provides IntelliSense and catches type errors at compile time.

```

---

## Quick Checklist Summary

Before approving:

- [ ] Import pattern is correct for package type
- [ ] TypeScript compilation passes (`npm run typecheck`)
- [ ] All tests pass (`npm test`)
- [ ] E2E tests pass (`npm run test:e2e`)
- [ ] CJS imports have explanatory comments
- [ ] No duplicate imports of same package
- [ ] Type assertions are present where needed
- [ ] Package.json is updated correctly
- [ ] Lock file is committed

---

**Last Updated:** 2025-11-29
**Used by:** Code reviewers on every PR
**Priority:** Critical
```
