---
title: 'ESM/CJS Module Compatibility - Prevention Strategies Index'
slug: esm-cjs-compatibility-index
category: prevention
severity: high
tags: [modules, esm, cjs, node-25, tsx, import-compatibility, prevention-guide]
created: 2025-11-29
---

# ESM/CJS Module Compatibility - Prevention Strategies Index

**Context:** MAIS runs on Node.js 25 with tsx in pure ESM mode (`"type": "module"` in `package.json`). When importing CommonJS packages like `file-type` v16, special handling is required. This index guides you through prevention strategies to avoid module compatibility issues.

## Quick Navigation

1. **[ESM/CJS Compatibility Prevention Checklist](#quick-prevention-checklist)** - Before adding any npm package
2. **[Code Review Checklist](#code-review-checklist-items)** - During PR reviews
3. **[Testing Recommendations](#testing-recommendations)** - Validate module compatibility
4. **[Best Practices Guide](#best-practices-guide)** - Handling CJS packages in ESM projects
5. **[Alternative Approaches](#alternative-approaches)** - When CJS-only packages don't work

---

## Quick Prevention Checklist

Before adding ANY npm package to your project, run through this checklist:

### Step 1: Package Type Investigation

- [ ] Check if package has `"type": "module"` in its `package.json`
- [ ] Check the `"exports"` field (modern packages use conditional exports)
- [ ] Check the `"main"` field (points to entry point)
- [ ] Verify the package supports your Node.js version (currently 25)
- [ ] Check GitHub/npm for recent issues about ESM compatibility

### Step 2: Compatibility Assessment

- [ ] Is this an ESM-only package? ✅ Safe to import directly
- [ ] Is this a CJS-only package? ⚠️ Requires `createRequire` wrapper
- [ ] Does it support both ESM and CJS? ✅ Check `"exports"` field for dual support
- [ ] Is there an ESM alternative package? 🔍 Prefer ESM versions

### Step 3: Implementation Planning

- [ ] Document which pattern you're using (ESM import, createRequire, dynamic import)
- [ ] Add TypeScript types for any CJS imports
- [ ] Plan for testing in both development and production
- [ ] Write a comment explaining why this pattern is needed

### Step 4: Testing & Validation

- [ ] Run `npm run typecheck` - TypeScript validation
- [ ] Run `npm test` - Unit/integration tests
- [ ] Run `npm run test:e2e` - End-to-end tests with tsx
- [ ] Run in mock mode: `ADAPTERS_PRESET=mock npm run dev:api`
- [ ] Run in real mode: `ADAPTERS_PRESET=real npm run dev:api`

---

## Current Module Compatibility Status

| Package     | Version | Type    | Pattern                 | Status     |
| ----------- | ------- | ------- | ----------------------- | ---------- |
| `file-type` | ^16.5.4 | CJS     | `createRequire`         | ✅ Working |
| `express`   | ^4.21.2 | ESM/CJS | Direct import           | ✅ Working |
| `stripe`    | ^19.1.0 | ESM/CJS | Direct import           | ✅ Working |
| `multer`    | ^2.0.2  | CJS     | ⚠️ Uses `createRequire` | ✅ Working |
| `ioredis`   | ^5.8.2  | ESM/CJS | Direct import           | ✅ Working |
| `prisma`    | ^6.17.1 | ESM     | Direct import           | ✅ Working |
| `zod`       | ^3.24.0 | ESM     | Direct import           | ✅ Working |

---

## Files in This Prevention Series

1. **ESM_CJS_COMPATIBILITY_PREVENTION_CHECKLIST.md**
   - Detailed checklist for npm package selection
   - Package investigation techniques
   - Risk assessment framework

2. **ESM_CJS_CODE_REVIEW_CHECKLIST.md**
   - Code review items for module imports
   - Common mistakes to catch during review
   - Testing requirements for import changes

3. **ESM_CJS_TESTING_RECOMMENDATIONS.md**
   - Unit test patterns for CJS packages
   - Integration test setup
   - End-to-end testing in tsx mode
   - Build verification steps

4. **ESM_CJS_BEST_PRACTICES.md**
   - Module import patterns (createRequire, dynamic import, direct import)
   - TypeScript typing for CJS modules
   - Error handling strategies
   - Dependency injection patterns
   - Migration strategies (CJS → ESM)

5. **ESM_CJS_ALTERNATIVES_GUIDE.md**
   - When to upgrade package versions
   - Finding ESM alternatives
   - Conditional imports pattern
   - Vendoring as last resort
   - Community ESM ports

6. **ESM_CJS_QUICK_REFERENCE.md** (Print & Pin)
   - One-page cheat sheet
   - Common patterns
   - Dangerous mistakes
   - Quick decision tree

---

## Key Concepts

### ESM (ECMAScript Modules)

- Modern JavaScript module standard (native to browsers and modern Node.js)
- Syntax: `import`, `export`
- Tree-shaking friendly
- Top-level await support
- **In MAIS:** All `.ts` files are treated as ESM due to `"type": "module"`

### CJS (CommonJS)

- Older Node.js module standard
- Syntax: `require()`, `module.exports`
- Still widely used by older packages
- Synchronous loading

### Dual Package Hazard

- When a package exposes both CJS and ESM, you might accidentally import both versions
- Creates duplicate instances, state mismatches
- Solution: Use `"exports"` field with conditional entry points

---

## Common Issues & Solutions

### Issue: "Cannot find module 'package-name'"

```typescript
// ❌ WRONG - Node.js can't resolve CJS module in pure ESM
import fileType from 'file-type';

// ✅ CORRECT - Use createRequire for CJS packages
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fileType = require('file-type');
```

**Prevention:** Check package.json `"type"` field before importing.

---

### Issue: "Cannot find module 'package-name' in pure ESM mode"

```typescript
// ❌ WRONG - Default export might not exist in CJS
import fileType from 'file-type';

// ✅ CORRECT - Access the correct export
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { fromBuffer } = require('file-type');
```

**Prevention:** Check the actual exports in package.json and `.d.ts` files.

---

### Issue: Types don't work with `createRequire`

```typescript
// ❌ WRONG - TypeScript loses type information
const fileType = require('file-type');
fileType.fromBuffer(buffer); // No autocomplete!

// ✅ CORRECT - Explicitly cast to type
const fileType = require('file-type') as typeof import('file-type');
fileType.fromBuffer(buffer); // Full autocomplete!
```

**Prevention:** Always add type assertions for CJS imports.

---

## Decision Tree: Which Pattern to Use?

```
Is the package ESM-only?
├─ YES → Use direct import: import { thing } from 'package'
└─ NO → Is it CJS-only?
    ├─ YES → Does it need to be imported at module level?
    │        ├─ YES → Use createRequire (see file-type example)
    │        └─ NO → Use dynamic import: const x = await import('package')
    └─ MAYBE → Check "exports" field in package.json
        ├─ Has "exports.import"? → Use conditional exports (it should work)
        └─ No "exports"? → Use createRequire (safer for dual packages)
```

---

## Testing Checklist for Module Changes

When you add or modify module imports:

- [ ] TypeScript compilation: `npm run typecheck`
- [ ] Unit tests pass: `npm test`
- [ ] Integration tests pass: `npm run test:integration`
- [ ] E2E tests pass: `npm run test:e2e`
- [ ] Dev mode works: `npm run dev:api`
- [ ] Production build works: `npm run build`
- [ ] Build verification: Check `server/dist/` for correct imports

---

## Real-World Example: file-type v16

**Challenge:** `file-type` v16 is CommonJS-only, but we're in pure ESM mode.

**Solution Implemented:**

```typescript
// server/src/services/upload.service.ts
import { createRequire } from 'module';

// ✅ PATTERN: createRequire for CJS package
const require = createRequire(import.meta.url);
const fileType = require('file-type') as {
  fromBuffer: (buffer: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
};

// Usage
const detected = await fileType.fromBuffer(buffer);
if (detected?.mime === 'image/jpeg') {
  // ...
}
```

**Tests:**

```typescript
// test/services/upload.service.test.ts
test('should detect JPEG using magic bytes', async () => {
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const detected = await service['validateFile']({
    buffer: jpegBuffer,
    mimetype: 'image/jpeg',
    fieldname: 'image',
    originalname: 'test.jpg',
    encoding: '7bit',
    destination: 'uploads/',
    filename: 'test.jpg',
    path: 'uploads/test.jpg',
    size: 4,
  });
  // Should not throw
});
```

---

## Prevention Success Metrics

After implementing these prevention strategies, you should see:

✅ Zero "Cannot find module" errors in production
✅ All imports resolve correctly in TypeScript
✅ No duplicate module instances or state mismatches
✅ E2E tests pass consistently
✅ New developers can add packages without module conflicts
✅ Code reviews catch module issues before merge

---

## Next Steps

1. **Before Adding Packages:** Read [ESM_CJS_COMPATIBILITY_PREVENTION_CHECKLIST.md](./ESM_CJS_COMPATIBILITY_PREVENTION_CHECKLIST.md)
2. **During Code Review:** Use [ESM_CJS_CODE_REVIEW_CHECKLIST.md](./ESM_CJS_CODE_REVIEW_CHECKLIST.md)
3. **When Testing:** Follow [ESM_CJS_TESTING_RECOMMENDATIONS.md](./ESM_CJS_TESTING_RECOMMENDATIONS.md)
4. **For Implementation:** Reference [ESM_CJS_BEST_PRACTICES.md](./ESM_CJS_BEST_PRACTICES.md)
5. **Quick Decisions:** Keep [ESM_CJS_QUICK_REFERENCE.md](./ESM_CJS_QUICK_REFERENCE.md) handy (print & pin!)

---

## Related Documentation

- **CLAUDE.md** - Project setup and environment
- **DEVELOPING.md** - Development workflow
- **TESTING.md** - Test strategy
- **SCHEMA_DRIFT_PREVENTION.md** - Database migration patterns

---

**Last Updated:** 2025-11-29
**Status:** Active
**Priority:** High (affects all npm package additions)
