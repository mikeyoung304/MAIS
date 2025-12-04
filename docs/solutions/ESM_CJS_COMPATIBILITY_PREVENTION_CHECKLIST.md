---
title: 'ESM/CJS Compatibility Prevention Checklist'
slug: esm-cjs-prevention-checklist
category: prevention
tags: [npm, package-selection, esm, cjs, module-compatibility, checklist]
created: 2025-11-29
---

# ESM/CJS Compatibility Prevention Checklist

## Purpose

This checklist prevents module compatibility issues BEFORE adding a package to your project. Use it every time you run `npm install`.

**Current Node.js Version:** 25.x
**Module System:** Pure ESM (`"type": "module"` in server/package.json)
**Runtime:** tsx (treats all `.ts` files as ESM)

---

## Pre-Installation Investigation (5 minutes)

### Step 1: Package Metadata (2 minutes)

Before running `npm install`, investigate the package on npm:

```bash
# View package info
npm view package-name

# Or check npm.js.com/package/package-name
```

Create a mental checklist:

#### Question 1: What is the package's module type?

- [ ] Package has `"type": "module"` → Pure ESM ✅
- [ ] Package has no `"type"` field → CJS or dual ⚠️
- [ ] Package is in `node_modules` with mixed exports → Investigate further

**Where to check:**

```bash
npm view package-name type
npm view package-name exports
npm view package-name main
```

**Example:**

```bash
$ npm view file-type type
# (returns nothing) → CJS-only

$ npm view file-type exports
{ import: [...], require: [...] }
# Dual support (but v16 is actually CJS)
```

#### Question 2: Are there recent issues about ESM?

- [ ] Check GitHub repo: `/issues` tab
- [ ] Search for "ESM", "pure ESM", "require", "import"
- [ ] Check recent closed issues (last 3 months)
- [ ] Look at PR history for module-related changes

**Red flags:**

- ❌ "Cannot find module in ESM" (unresolved, no workaround)
- ❌ "ESM support removed in v2.0" (means it used to work)
- ✅ "Using createRequire works" (community has workaround)
- ✅ "Upgrade to v2.0 for ESM support" (clear path forward)

#### Question 3: What version should I install?

Check if there's a newer ESM-native version:

```bash
npm view package-name versions --json | tail -20
```

**Decision:**

- If v17+ is ESM and you need v16 features → File a GitHub issue to check for backports
- If v17+ is ESM and v16 works fine → Consider upgrading preemptively
- If v16 is latest → Use `createRequire` wrapper (like file-type)

---

### Step 2: Analyze the package.json

Get the actual package.json:

```bash
npm view package-name package.json
```

Or visit `https://unpkg.com/package-name/package.json`

#### Checklist:

```json
{
  "name": "file-type",
  "version": "16.5.4",

  // ✅ Check these fields
  "type": "module", // Pure ESM?

  "main": "index.js", // CJS entry point

  "exports": {
    // Modern conditional exports
    "import": "./index.js", // ESM entry
    "require": "./cjs-index.js" // CJS entry
  },

  "module": "index.esm.js", // ESM fallback (older packages)

  // ❌ Check Node version compatibility
  "engines": {
    "node": ">=10" // Supports Node 25? Usually yes for >=10
  }
}
```

**Key Investigation:**

| Field               | What It Means             | Action                                       |
| ------------------- | ------------------------- | -------------------------------------------- |
| `"type": "module"`  | Pure ESM package          | Use direct import: `import { x } from 'pkg'` |
| No `type` field     | CJS-only                  | Use `createRequire`                          |
| `"exports.import"`  | Has ESM entry point       | Use direct import                            |
| `"exports.require"` | Has CJS entry point       | Package supports both                        |
| `"main"`            | Entry point               | Must resolve to valid file                   |
| `"module"`          | ESM entry (older pattern) | Fallback for older packages                  |

---

### Step 3: Check for Dual Package Issues

**Risk:** If package has both ESM and CJS exports, you might accidentally import both, creating duplicate instances.

**Prevention:**

```bash
# Check what the package actually exports
npm view package-name exports
```

**Safe patterns:**

```json
{
  "exports": {
    "import": "./index.js", // Only one ESM entry
    "require": "./index.cjs" // Only one CJS entry
  }
}
```

**Dangerous patterns:**

```json
{
  "exports": {
    ".": "./index.js", // Default - imports JS
    "./package.json": "./package.json" // Allows esmeta.json import
  },
  "main": "./index.cjs" // CJS fallback
}
```

When in doubt, test with both import styles:

```typescript
// Test 1: ESM import
import * as pkg1 from 'package';

// Test 2: CJS require
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg2 = require('package');

// Are they the same object?
console.log(pkg1 === pkg2); // Should be true
```

---

## Installation & Verification

### Step 4: Install with Caution

```bash
# Start with a minor version constraint
npm install package-name@^16.5.0

# Or test in a dev branch first
npm install package-name --save-dev
npm install package-name --save (for production)
```

### Step 5: Verify Installation

```bash
# Check that the package is in node_modules
ls node_modules/package-name/

# Look for key files
cat node_modules/package-name/package.json | grep -E '"type"|"main"|"exports"'

# Check if types are available
ls node_modules/package-name/*.d.ts
```

**Success criteria:**

- ✅ Package installed to `node_modules/`
- ✅ No warnings during install
- ✅ TypeScript definitions available (`.d.ts` files)
- ✅ Main entry point exists

---

## Implementation Assessment

### Step 6: Determine Import Pattern

Based on package.json investigation, choose ONE pattern:

#### Pattern A: Direct Import (ESM-native packages)

**Conditions:**

- Package has `"type": "module"`
- OR Package has `"exports.import"`
- AND No import issues reported on GitHub

**Implementation:**

```typescript
// ✅ Use direct import
import { functionName } from 'package-name';
import DefaultExport from 'package-name';

// ✅ TypeScript gets types automatically
const result = functionName(); // Full IntelliSense
```

**Examples in MAIS:**

- `import { PrismaClient } from '@prisma/client'`
- `import express from 'express'`
- `import { stripe } from 'stripe'`

**Test:**

```bash
npm run typecheck  # Should pass
npm test           # Should pass
```

---

#### Pattern B: createRequire (CJS packages or dual packages)

**Conditions:**

- Package is CJS-only (no `"type": "module"`)
- OR Package has both ESM and CJS exports
- AND You need to import it at module level (not lazy-loaded)

**Implementation:**

```typescript
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fileType = require('file-type') as typeof import('file-type');

// Usage
const detected = await fileType.fromBuffer(buffer);
```

**Why this works:**

- `createRequire` creates a CommonJS `require()` function scoped to current module
- Works in pure ESM mode (Node.js compatibility layer)
- Type assertion tells TypeScript to treat it as ESM

**Real example from MAIS:**

```typescript
// server/src/services/upload.service.ts
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fileType = require('file-type') as {
  fromBuffer: (buffer: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
};
```

**Test:**

```bash
npm run typecheck  # Check type assertions
npm test           # Verify require works
```

---

#### Pattern C: Dynamic Import (Lazy loading)

**Conditions:**

- Package is CJS-only
- You only need it in certain code paths
- Early loading is not required

**Implementation:**

```typescript
async function validateFile(buffer: Buffer) {
  // ✅ Import only when needed
  const { fromBuffer } = await import('file-type');
  const detected = await fromBuffer(buffer);
  return detected;
}
```

**When to use:**

- Heavy packages used occasionally
- Optional dependencies
- Circular dependency breaking

**Test:**

```bash
npm test           # Verify async behavior
npm run test:e2e   # Full flow testing
```

---

#### Pattern D: Conditional Imports (Future-proofing)

**Conditions:**

- Package provides both ESM and CJS
- You want to use ESM if available, fall back to CJS

**Implementation:**

```typescript
// ✅ Progressive enhancement
let fileType: any;

try {
  // Try ESM first (Node.js might support it in future)
  fileType = await import('file-type');
} catch (e) {
  // Fall back to CJS
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  fileType = require('file-type');
}

export default fileType;
```

**When to use:**

- Packages that might upgrade to ESM soon
- Maximum compatibility requirements

---

### Step 7: Risk Assessment

Rate the package using this matrix:

| Factor             | Low Risk       | Medium Risk        | High Risk               |
| ------------------ | -------------- | ------------------ | ----------------------- |
| Module Type        | ESM-native     | Dual export        | CJS-only                |
| Active Maintenance | Recent commits | 1-3 months old     | 6+ months old           |
| Issues on GitHub   | None about ESM | Some closed issues | Unresolved ESM issues   |
| Usage in MAIS      | 0 dependencies | Used in 1-2 places | Many files depend on it |
| Import Pattern     | Direct import  | createRequire      | Dynamic import needed   |
| Test Coverage      | High (>80%)    | Medium (50-80%)    | Low (<50%)              |
| Size               | Small (<100KB) | Medium (100KB-1MB) | Large (>1MB)            |

**Scoring:**

- All low: ✅ Safe to install
- Mostly low: ✅ Safe with testing
- Mixed: ⚠️ Install but plan careful testing
- Any high: ❌ Investigate alternative or upgrade version

---

## Common Package Risk Profiles

### ✅ Low Risk Pattern: ESM-native (stripe, zod, prisma)

```typescript
// Direct import - no special handling
import { stripe } from 'stripe';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
```

**Prevention steps:**

1. Just install normally: `npm install stripe`
2. Import directly
3. Run tests

---

### ⚠️ Medium Risk Pattern: Dual export (express, multer)

```typescript
// Express: has both ESM and CJS
import express from 'express';
// Works due to "exports.import"

// Multer: CJS-only, but widely used
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const multer = require('multer');
```

**Prevention steps:**

1. Check package.json carefully
2. Test in both modes
3. Add comments explaining why this pattern is used

---

### ❌ High Risk Pattern: Outdated CJS (old-package v1)

```typescript
// ❌ Avoid if possible
npm view old-package versions
// If latest is from 2019, consider alternatives

// ✅ If forced to use:
// 1. Add comment explaining why
// 2. Plan for deprecation
// 3. Weekly checks for alternative
```

---

## Post-Installation Checklist

After installation, verify everything works:

```bash
# Step 1: TypeScript compilation
npm run typecheck
# Should pass with 0 errors

# Step 2: Unit tests
npm test
# Should pass 100%

# Step 3: Integration tests (if any)
npm run test:integration
# Should pass 100%

# Step 4: E2E tests
npm run test:e2e
# Should pass 100%

# Step 5: Development mode
npm run dev:api
# Should start without errors

# Step 6: Build check
npm run build
# Should produce valid dist/

# Step 7: Check built files
ls server/dist/
file server/dist/*.js
# Should be valid JavaScript
```

---

## Documentation Requirements

After installation, document the package in your PR:

### Required Comment in Code

```typescript
// ✅ When using createRequire
// file-type v16 is CommonJS-only
// See: https://github.com/sindresorhus/file-type/issues/XXX
// Alternative: Upgrade to v17+ (ESM) when available
const require = createRequire(import.meta.url);
const fileType = require('file-type') as typeof import('file-type');
```

### Required Entry in Dependencies Table

Update `CLAUDE.md` or `docs/MODULE_COMPATIBILITY.md`:

```markdown
| Package   | Version | Type | Pattern       | Status | Notes                                          |
| --------- | ------- | ---- | ------------- | ------ | ---------------------------------------------- |
| file-type | ^16.5.4 | CJS  | createRequire | ✅     | ESM version (v17+) available, consider upgrade |
```

---

## Troubleshooting: Issues After Installation

### Issue: "Cannot find module 'package-name'"

```bash
# Cause: Package not found in node_modules
# Fix:
npm install
npm run typecheck

# If still fails:
rm -rf node_modules
npm install
```

### Issue: "TypeError: 'require' is not a function"

```typescript
// ❌ Wrong pattern
import { createRequire } from 'module';
const req = createRequire; // Forgot to call it!
const pkg = req('package');

// ✅ Correct pattern
const require = createRequire(import.meta.url);
const pkg = require('package');
```

### Issue: "Cannot find module types"

```typescript
// ❌ Type assertion missing
const pkg = require('package');
pkg.method(); // No IntelliSense!

// ✅ Type assertion added
const pkg = require('package') as typeof import('package');
pkg.method(); // Full IntelliSense!
```

### Issue: Module imported twice (Dual package hazard)

```typescript
// Test if modules are the same
import { something as esm } from 'package';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const cjs = require('package');

console.log(esm === cjs); // Should be true

if (esm !== cjs) {
  console.warn('DUAL PACKAGE HAZARD: Two instances of package loaded');
  // Fix: Use only one import style throughout codebase
}
```

---

## Decision Tree: Package-by-Package

Use this flowchart when evaluating a new package:

```
1. Does the package have "type": "module" in package.json?
   YES → Use direct import
   NO → Go to 2

2. Does package.json have "exports.import"?
   YES → Use direct import (package supports both)
   NO → Go to 3

3. Have you used this package in Node.js 25 before?
   YES → Use that same pattern
   NO → Go to 4

4. Is this a popular package (>1M weekly downloads)?
   YES → Probably safe, use createRequire
   NO → Go to 5

5. Check GitHub issues for "ESM" in the last 6 months:
   Any unresolved issues? → Don't install, find alternative
   Only closed issues? → Safe to use createRequire
```

---

## Prevention Success Checklist

After adding a new package, you've succeeded when:

- [ ] TypeScript compilation passes: `npm run typecheck`
- [ ] All tests pass: `npm test`
- [ ] E2E tests pass: `npm run test:e2e`
- [ ] Development mode works: `npm run dev:api`
- [ ] Build completes: `npm run build`
- [ ] Code is commented explaining the pattern used
- [ ] MODULE_COMPATIBILITY.md is updated
- [ ] No "Cannot find module" errors anywhere
- [ ] Module is not loaded twice (no dual package hazard)
- [ ] PR review checklist is passed (see ESM_CJS_CODE_REVIEW_CHECKLIST.md)

---

## Quick Reference Links

- **npm view command:** `npm view package-name`
- **npm package page:** `https://npmjs.com/package/package-name`
- **GitHub search ESM issues:** `site:github.com package-name ESM`
- **Node.js module docs:** https://nodejs.org/api/modules.html
- **ESM compatibility:** https://nodejs.org/api/esm.html

---

**Last Updated:** 2025-11-29
**Used by:** Every npm install in MAIS
**Priority:** Critical
