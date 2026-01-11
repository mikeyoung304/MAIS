# ESM/CJS Module Compatibility Guide

**Last Updated:** 2026-01-10
**Consolidated from:** 9 separate ESM/CJS documents
**Priority:** High (affects all npm package additions)

---

## Overview

MAIS runs on Node.js 25+ with tsx in **pure ESM mode** (`"type": "module"` in `server/package.json`). CommonJS packages require special handling via `createRequire`.

**Key Facts:**

- All `.ts` files are treated as ESM
- Direct `require()` is not available in ESM scope
- CJS packages need `createRequire` wrapper
- Type assertions required for TypeScript support

---

## Quick Reference (Print & Pin)

### Decision Tree

```
Is package ESM-native (type: "module")?
|
+-- YES --> Direct import: import { x } from 'package'
|
+-- NO --> Use createRequire:
           const require = createRequire(import.meta.url);
           const pkg = require('package') as typeof import('package');
```

### Common Patterns

```typescript
// Pattern 1: ESM-native packages (stripe, zod, prisma)
import { stripe } from 'stripe';
import { z } from 'zod';

// Pattern 2: CJS-only packages (file-type v16)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fileType = require('file-type') as typeof import('file-type');

// Pattern 3: Lazy-loaded (infrequent use)
const { fromBuffer } = await import('file-type');
```

### Before Commit Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run test:e2e` passes
- [ ] CJS imports have explanatory comments
- [ ] Type assertions present for CJS imports
- [ ] No duplicate imports of same package

---

## Package Investigation (Before npm install)

### Step 1: Check Package Type

```bash
npm view package-name type        # "module" = ESM-native
npm view package-name exports     # Check for .import/.require
```

### Step 2: Determine Pattern

| Package.json Field | Module Type | Pattern to Use |
| ------------------ | ----------- | -------------- |
| `"type": "module"` | Pure ESM    | Direct import  |
| No `type` field    | CJS-only    | createRequire  |
| `"exports.import"` | Dual export | Direct import  |

### Step 3: Check for Issues

```bash
# Search GitHub for ESM compatibility issues
site:github.com package-name ESM
```

---

## Implementation Patterns

### Pattern 1: Direct Import (ESM-Native)

**When:** Package has `"type": "module"` or `"exports.import"`

```typescript
import { stripe } from 'stripe';
import { PrismaClient } from '@prisma/client';
import type { Config } from 'package';
```

**Advantages:** Full TypeScript support, tree-shaking, top-level await

### Pattern 2: createRequire (CJS-Only)

**When:** Package has no `"type": "module"`, used frequently

```typescript
import { createRequire } from 'module';

// file-type v16 is CommonJS-only
// See: https://github.com/sindresorhus/file-type
// v17+ is ESM - consider upgrading in future
const require = createRequire(import.meta.url);
const fileType = require('file-type') as typeof import('file-type');

// Usage
const detected = await fileType.fromBuffer(buffer);
```

**Required Elements:**

1. Import `createRequire` from 'module'
2. Create require function with `import.meta.url`
3. Add type assertion: `as typeof import('package')`
4. Add comment explaining why CJS is needed

### Pattern 3: Dynamic Import (Lazy Loading)

**When:** Package rarely used, acceptable to lazy-load

```typescript
async function validateFile(buffer: Buffer) {
  try {
    const { fromBuffer } = await import('file-type');
    return await fromBuffer(buffer);
  } catch (error) {
    logger.error({ error }, 'Failed to detect file type');
    throw new FileValidationError('Unable to validate file');
  }
}
```

**Note:** Always include error handling for dynamic imports.

### Pattern 4: Adapter Pattern (Centralize CJS)

**When:** CJS package used in multiple files

```typescript
// server/src/adapters/file-type.adapter.ts
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fileType = require('file-type') as typeof import('file-type');

export async function detectFileType(buffer: Buffer) {
  return await fileType.fromBuffer(buffer);
}

// In services - clean import
import { detectFileType } from '../adapters/file-type.adapter';
```

---

## Common Issues & Solutions

### Issue: "Cannot find module 'xyz'"

**Cause:** Direct import of CJS package in ESM environment

```typescript
// WRONG
import fileType from 'file-type';

// FIX
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fileType = require('file-type') as typeof import('file-type');
```

### Issue: "ReferenceError: require is not defined"

**Cause:** Using `require()` directly in ESM

```typescript
// WRONG
const fileType = require('file-type');

// FIX
const require = createRequire(import.meta.url);
const fileType = require('file-type');
```

### Issue: No TypeScript IntelliSense

**Cause:** Missing type assertion

```typescript
// WRONG - no autocomplete
const pkg = require('package');

// FIX - full IntelliSense
const pkg = require('package') as typeof import('package');

// Alternative: explicit interface
const pkg = require('package') as {
  fromBuffer: (buffer: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
};
```

### Issue: Dual Package Hazard

**Cause:** Importing same package as both ESM and CJS

**Prevention:** Use only ONE import pattern throughout codebase

```typescript
// Test for dual loading
import * as pkg1 from 'package';
const pkg2 = require('package');
console.log(pkg1 === pkg2); // Should be true
```

---

## Testing Recommendations

### Unit Tests for CJS Adapters

```typescript
import { describe, it, expect } from 'vitest';
import { detectFileType } from '../../src/adapters/file-type.adapter';

describe('FileTypeAdapter', () => {
  it('should detect JPEG from magic bytes', async () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const result = await detectFileType(jpegBuffer);

    expect(result?.mime).toBe('image/jpeg');
    expect(result?.ext).toBe('jpg');
  });

  it('should return undefined for unknown types', async () => {
    const unknownBuffer = Buffer.from([0x00, 0x00, 0x00]);
    const result = await detectFileType(unknownBuffer);

    expect(result).toBeUndefined();
  });
});
```

### Integration Test Pattern

```typescript
import { createTestTenant } from '../helpers/test-tenant';

test('should validate file before uploading', async () => {
  const { tenantId, cleanup } = await createTestTenant();

  try {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const result = await uploadService.upload(tenantId, 'segments', {
      buffer: jpegBuffer,
      mimetype: 'image/jpeg',
      originalname: 'test.jpg',
    });

    expect(result.url).toBeDefined();
  } finally {
    await cleanup();
  }
});
```

### Build Verification

```bash
npm run typecheck    # TypeScript compilation
npm test             # Unit tests
npm run test:e2e     # E2E with real tsx runtime
npm run build        # Production build succeeds
```

---

## Code Review Checklist

When reviewing PRs with module imports:

### Import Classification

- [ ] Import pattern matches package type (ESM vs CJS)
- [ ] Type assertions present for createRequire imports
- [ ] No `as any` type assertions

### Documentation

- [ ] CJS imports have explanatory comments
- [ ] Comments include package repo link
- [ ] Migration path noted (if ESM version available)

### Centralization

- [ ] createRequire used in only ONE location per package
- [ ] Adapter pattern used if package needed in multiple files

### Testing

- [ ] Unit tests exist for new imports
- [ ] `npm run typecheck` passes
- [ ] All tests pass

### Package.json

- [ ] New dependency in correct section (dependencies vs devDependencies)
- [ ] Version constraint appropriate (^ for minor, ~ for patch)
- [ ] Lock file updated

---

## Current Package Status

| Package     | Version | Type | Pattern       | Notes           |
| ----------- | ------- | ---- | ------------- | --------------- |
| `file-type` | ^16.5.4 | CJS  | createRequire | v17+ is ESM     |
| `stripe`    | ^19.1.0 | ESM  | Direct import | Fully ESM       |
| `zod`       | ^3.24.0 | ESM  | Direct import | Fully ESM       |
| `express`   | ^4.21.2 | Dual | Direct import | Works with both |
| `multer`    | ^2.0.2  | CJS  | createRequire | Monitor for ESM |
| `prisma`    | ^6.17.1 | ESM  | Direct import | Fully ESM       |
| `ioredis`   | ^5.8.2  | Dual | Direct import | Built-in ESM    |

---

## Upgrade Path: CJS to ESM

When a CJS package releases ESM version:

### 1. Check Upgrade Viability

```bash
npm view package-name versions --json | tail -5
npm view package-name@latest readme  # Check for breaking changes
```

### 2. Test Upgrade

```bash
npm install package-name@latest
npm run typecheck
npm test
```

### 3. Update Imports

```typescript
// Before: createRequire
const require = createRequire(import.meta.url);
const pkg = require('package') as typeof import('package');

// After: Direct import
import { feature } from 'package';
```

### 4. Remove Comment

Remove the "CJS-only" comment since it no longer applies.

---

## Dangerous Mistakes to Avoid

| Mistake                | Example                           | Fix                         |
| ---------------------- | --------------------------------- | --------------------------- |
| Direct import of CJS   | `import x from 'cjs-pkg'`         | Use createRequire           |
| Missing type assertion | `const pkg = require('x')`        | Add `as typeof import('x')` |
| Import in loop         | `for (...) { await import('x') }` | Import once outside loop    |
| Duplicate imports      | createRequire in multiple files   | Centralize in adapter       |
| Missing CJS comment    | No explanation for createRequire  | Add comment with link       |

---

## Related Documentation

- **CLAUDE.md** - Project setup and environment
- **DEVELOPING.md** - Development workflow
- **TESTING.md** - Test strategy

---

## Archive Note

This document consolidates content from 9 original files moved to:
`docs/archive/solutions-consolidated-20260110/topic-clusters/esm-cjs/`

Original files:

- ESM_CJS_ALTERNATIVES_GUIDE.md
- ESM_CJS_BEST_PRACTICES.md
- ESM_CJS_CODE_REVIEW_CHECKLIST.md
- ESM_CJS_COMPATIBILITY_INDEX.md
- ESM_CJS_COMPATIBILITY_PREVENTION_CHECKLIST.md
- ESM_CJS_IMPLEMENTATION_SUMMARY.md
- ESM_CJS_MODULE_COMPATIBILITY.md
- ESM_CJS_QUICK_REFERENCE.md
- ESM_CJS_TESTING_RECOMMENDATIONS.md
