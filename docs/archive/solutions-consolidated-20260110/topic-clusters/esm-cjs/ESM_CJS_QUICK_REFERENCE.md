---
title: 'ESM/CJS Module Compatibility - Quick Reference (Print & Pin!)'
slug: esm-cjs-quick-reference
category: prevention
tags: [cheat-sheet, modules, esm, cjs, quick-reference, developer-guide]
created: 2025-11-29
priority: P0
---

# ESM/CJS Module Compatibility - Quick Reference

**Print this page and pin it to your desk!**

---

## Step-by-Step: Adding a New Package

### 1. Check Package Type (2 minutes)

```bash
npm view package-name type
npm view package-name exports
```

**What you're looking for:**

- `"type": "module"` → ESM-native ✅
- No `type` field → CJS ⚠️
- `"exports.import"` → ESM-first ✅
- `"exports.require"` → Dual export ⚠️

---

### 2. Choose Import Pattern

```typescript
// ESM-native packages (type: module or exports.import)
import { feature } from 'esm-package'; // ✅ Direct import

// CJS-only packages (no type field)
const require = createRequire(import.meta.url);
const pkg = require('cjs-package') as typeof import('cjs-package'); // ⚠️ createRequire

// Infrequently used CJS
const pkg = await import('lazy-package'); // ℹ️ Dynamic import
```

---

### 3. Add Comment (for CJS only)

```typescript
// CJS-only package - See: https://github.com/package/repo
// v2.0+ supports ESM, consider upgrading in future
const require = createRequire(import.meta.url);
const pkg = require('package') as typeof import('package');
```

---

### 4. Run Tests

```bash
npm run typecheck    # Must pass
npm test             # Must pass
npm run test:e2e     # Must pass
```

**All green? Commit! ✅**

---

## Common Patterns at a Glance

### Direct Import (ESM-native)

```typescript
import { stripe } from 'stripe';
import { z } from 'zod';
import type { Config } from 'package';

// No comment needed - obvious
```

**When:** Package has `"type": "module"`

---

### createRequire (CJS-only)

```typescript
// file-type v16 is CJS-only - See: github.com/sindresorhus/file-type
const require = createRequire(import.meta.url);
const fileType = require('file-type') as typeof import('file-type');

await fileType.fromBuffer(buffer);
```

**When:** Package has NO `"type": "module"`, used frequently

---

### Dynamic Import (Lazy-loaded)

```typescript
async function validateFile(buffer: Buffer) {
  const { fromBuffer } = await import('file-type');
  return await fromBuffer(buffer);
}
```

**When:** Package rarely used, safe to lazy-load

---

## Dangerous Mistakes

### ❌ NEVER: Direct import of CJS-only package

```typescript
import fileType from 'file-type'; // BOOM! Cannot find module
```

**Fix:** Use `createRequire` or upgrade package to ESM

---

### ❌ NEVER: Missing type assertion

```typescript
const pkg = require('package');
pkg.method(); // No autocomplete, type errors!
```

**Fix:** Add type assertion:

```typescript
const pkg = require('package') as typeof import('package');
```

---

### ❌ NEVER: Import in loop

```typescript
for (const file of files) {
  const { validate } = await import('validator'); // N imports!
}
```

**Fix:** Import once, reuse:

```typescript
const { validate } = await import('validator'); // Once!
for (const file of files) {
  validate(file);
}
```

---

### ❌ NEVER: Missing CJS comments

```typescript
const require = createRequire(import.meta.url);
const pkg = require('package'); // Why is this here?
```

**Fix:** Always add comment explaining:

```typescript
// package v1 is CJS-only - See: github.com/org/package
// v2.0+ is ESM, plan to upgrade
const require = createRequire(import.meta.url);
const pkg = require('package') as typeof import('package');
```

---

### ❌ NEVER: Duplicate imports

```typescript
// ❌ Two different files doing:
// src/service-1.ts
const pkg = require('package');

// src/service-2.ts
const pkg = require('package'); // Duplicated!

// Better: Create adapter
// src/adapters/package.adapter.ts
const pkg = require('package'); // Once!

// src/service-1.ts, src/service-2.ts
import { packageAdapter } from '../adapters/package.adapter';
```

---

## Decision Tree: Quick Reference

```
Is package ESM-native (type: "module")?
│
├─ YES → Use direct import
│        ✅ import { x } from 'package'
│
└─ NO → How often is it used?
   │
   ├─ FREQUENTLY (in 3+ files)
   │  └─ Use createRequire
   │     ⚠️ const require = createRequire(import.meta.url);
   │        const pkg = require('package') as typeof import('package');
   │
   └─ RARELY (in 1-2 places)
      └─ Use dynamic import
         ℹ️ const pkg = await import('package');
```

---

## Checklist: Before Commit

- [ ] TypeScript: `npm run typecheck` passes
- [ ] Tests: `npm test` passes
- [ ] E2E: `npm run test:e2e` passes
- [ ] No "Cannot find module" errors
- [ ] CJS imports have comments
- [ ] No duplicate imports of same package
- [ ] Type assertions present (if createRequire)
- [ ] Build succeeds: `npm run build`

---

## Quick Fixes for Errors

### "Cannot find module 'xyz'"

```typescript
// ❌ WRONG: Direct import of CJS
import { pkg } from 'cjs-package';

// ✅ FIX: Check package.json
// If no "type": "module", use createRequire:
const require = createRequire(import.meta.url);
const pkg = require('cjs-package');
```

---

### "Cannot assign type 'never' to type 'T'"

```typescript
// ❌ WRONG: Missing type assertion
const pkg = require('package');

// ✅ FIX: Add type assertion
const pkg = require('package') as typeof import('package');
```

---

### "TypeError: module.fromBuffer is not a function"

```typescript
// ❌ WRONG: Importing wrong export
const fileType = require('file-type');
fileType.fromBuffer(buffer); // Doesn't exist!

// ✅ FIX: Import correct export
const { fromBuffer } = require('file-type') as typeof import('file-type');
await fromBuffer(buffer);
```

---

## Package Status in MAIS

| Package     | Status      | Pattern       | Notes                     |
| ----------- | ----------- | ------------- | ------------------------- |
| `file-type` | ⚠️ CJS v16  | createRequire | Upgrade to v17+ available |
| `stripe`    | ✅ ESM v19+ | Direct import | Fully ESM                 |
| `zod`       | ✅ ESM      | Direct import | Fully ESM                 |
| `express`   | ✅ ESM/CJS  | Direct import | Works with both           |
| `multer`    | ⚠️ CJS v2   | createRequire | Monitor for ESM version   |
| `prisma`    | ✅ ESM      | Direct import | Fully ESM                 |

---

## When to Use Each Pattern

| Situation                    | Pattern        | Example                             |
| ---------------------------- | -------------- | ----------------------------------- |
| Package is ESM-native        | Direct import  | `import { z } from 'zod'`           |
| CJS package, used often      | createRequire  | `const pkg = require('pkg') as ...` |
| CJS package, used rarely     | Dynamic import | `const pkg = await import('pkg')`   |
| Package might upgrade to ESM | Monitor & plan | Check npm for new version quarterly |

---

## File Examples

### ✅ Good: CJS with createRequire

`server/src/services/upload.service.ts`

```typescript
import { createRequire } from 'module';

// file-type v16 is CJS-only (v17+ is ESM)
// See: https://github.com/sindresorhus/file-type
const require = createRequire(import.meta.url);
const fileType = require('file-type') as {
  fromBuffer: (buf: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
};

export async function detectFileType(buffer: Buffer) {
  return await fileType.fromBuffer(buffer);
}
```

### ✅ Good: Direct ESM import

`server/src/services/booking.service.ts`

```typescript
import { stripe } from 'stripe';
import type { Price } from 'stripe';

export async function createStripePrice(amount: number): Promise<Price> {
  return await stripe.prices.create({
    currency: 'usd',
    unit_amount: amount,
  });
}
```

### ✅ Good: Adapter pattern (centralizes CJS)

`server/src/adapters/file-type.adapter.ts`

```typescript
// Centralize CJS import
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fileType = require('file-type') as typeof import('file-type');

export async function detectFileType(buffer: Buffer) {
  return await fileType.fromBuffer(buffer);
}
```

`server/src/services/upload.service.ts`

```typescript
// Use adapter - clean service code
import { detectFileType } from '../adapters/file-type.adapter';

export async function validateFile(buffer: Buffer) {
  const detected = await detectFileType(buffer);
  // ...
}
```

---

## Code Review Checklist

Reviewing PR that adds/modifies imports?

- [ ] Import pattern matches package type
- [ ] Type assertions present (if createRequire)
- [ ] CJS imports have explanatory comments
- [ ] TypeScript compilation passes
- [ ] All tests pass
- [ ] No duplicate imports
- [ ] No "Cannot find module" errors

---

## Useful Commands

```bash
# Check package module type
npm view package-name type
npm view package-name exports

# Verify TypeScript
npm run typecheck

# Run all tests
npm test

# Run E2E tests
npm run test:e2e

# Build and verify
npm run build
npm run verify:build
```

---

## When to Escalate

❌ Package not available in CJS or ESM?
→ Ask on GitHub issues or switch packages

❌ Module loading errors that don't make sense?
→ Check for dual package hazard: test importing both ways

❌ Breaking changes in new version?
→ Evaluate alternatives before upgrading

---

## Key File Locations

- **Current CJS usage:** `server/src/services/upload.service.ts`
- **Pattern examples:** `server/src/services/*.ts`
- **Test examples:** `test/services/upload.service.test.ts`
- **Adapter pattern:** `server/src/adapters/*.adapter.ts`
- **Full guide:** `docs/solutions/ESM_CJS_BEST_PRACTICES.md`

---

## Remember

1. **ESM-native packages:** Direct import (clean, preferred)
2. **CJS-only packages:** createRequire with comment (acceptable, common)
3. **Lazy-loaded packages:** Dynamic import (for rare use cases)
4. **Always add comments:** Explain why pattern is needed
5. **Always test:** TypeScript, unit, integration, E2E
6. **Centralize CJS:** Use adapters to hide complexity

---

**Last Updated:** 2025-11-29
**Print & Pin:** Yes!
**Priority:** Critical
**Keep Handy:** Yes, keep at your desk
