---
title: ESM/CJS Module Compatibility - file-type in Node.js 25
category: deployment-issues
severity: critical
component: server/upload-service
tags: [esm, commonjs, node-25, module-system, file-type, render, createRequire]
date_solved: 2025-11-29
symptoms:
  - 'ReferenceError: require is not defined in ES module scope'
  - "The requested module 'file-type' does not provide an export named 'fromBuffer'"
  - Server fails to start on Render deployment
  - Works locally but fails in production
root_cause: |
  Node.js 25 with tsx runs in pure ESM mode where require() is not globally available.
  The file-type v16 library is CommonJS-only, and ESM named imports don't work with
  CommonJS modules. Direct require() calls fail because ESM doesn't provide require().
---

# ESM/CJS Module Compatibility: file-type in Node.js 25

## Problem

When deploying to Render (Node.js 25), the server fails to start with module import errors. The `file-type` v16 package (used for magic byte validation) is CommonJS, but Node.js 25 runs tsx in pure ESM mode.

**User Impact:**

- Server crashes on startup in production
- File upload security validation unavailable
- Platform admin photo uploads fail

**Error Messages:**

Attempt 1 - Named ESM import:

```
Error: The requested module 'file-type' does not provide an export named 'fromBuffer'
```

Attempt 2 - Direct require():

```
ReferenceError: require is not defined in ES module scope, you can use import instead
    at <anonymous> (/opt/render/project/src/server/src/services/upload.service.ts:18:18)
```

## Investigation

### Step 1: Named Import Attempt

```typescript
// FAILED - CJS doesn't have real named exports
import { fromBuffer } from 'file-type';
```

**Why it failed:** CommonJS modules use `module.exports`, not ES6 named exports. Node.js can't resolve named exports from CJS packages.

### Step 2: require() Attempt

```typescript
// FAILED - require not available in ESM
const fileType = require('file-type');
```

**Why it failed:** In pure ESM mode (`"type": "module"` in package.json), the `require()` function is not globally available.

### Step 3: Environment Analysis

- **Local development:** Works because tsx may use different module resolution
- **Render production:** Node.js 25 with stricter ESM/CJS boundary enforcement
- **Package version:** `file-type@16.5.4` is CommonJS-only (v17+ is ESM)

## Root Cause

**ESM vs CJS Incompatibility in Node.js 25:**

1. **Project Configuration:** `server/package.json` has `"type": "module"` → all files treated as ESM
2. **TypeScript Output:** `tsconfig.json` has `"module": "ES2022"` → ESM output
3. **Package Type:** `file-type` v16 only supports CommonJS (`module.exports`)
4. **Node.js 25:** Stricter ESM/CJS boundary enforcement than earlier versions

The fundamental mismatch: ESM cannot directly access CJS exports without a bridge mechanism.

## Solution

Use `createRequire` from Node's built-in `module` package to create a CommonJS require function within ESM context.

### Implementation

**File:** `server/src/services/upload.service.ts` (lines 10-19)

```typescript
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../lib/core/logger';

// file-type v16 is CommonJS - use createRequire for ESM compatibility in Node 25+
const require = createRequire(import.meta.url);
const fileType = require('file-type') as {
  fromBuffer: (buffer: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
};
```

### Why This Works

1. **`createRequire` Bridge:** Imported from Node's built-in `module` package, creates a `require()` function usable inside ESM
2. **`import.meta.url` Context:** Provides the correct module path so `require()` resolves packages relative to current module
3. **Type Safety:** TypeScript annotation ensures IDE and compiler understand the expected structure
4. **Cross-Version Compatible:** Works in Node.js 20+ and Node.js 25+

### Technical Breakdown

```typescript
// Step 1: Import createRequire from Node's module API
import { createRequire } from 'module';

// Step 2: Create require function bound to this module's context
// import.meta.url = file:///path/to/upload.service.ts
const require = createRequire(import.meta.url);

// Step 3: Use require() to load the CommonJS package
const fileType = require('file-type');

// Step 4: Use the loaded module for magic byte validation
const detectedType = await fileType.fromBuffer(file.buffer);
```

## Code Changes

### Files Modified

| File                                    | Changes                                               |
| --------------------------------------- | ----------------------------------------------------- |
| `server/src/services/upload.service.ts` | Added `createRequire` import, replaced direct require |

### Diff

```diff
 import fs from 'fs';
 import path from 'path';
 import crypto from 'crypto';
+import { createRequire } from 'module';
 import { SupabaseClient } from '@supabase/supabase-js';
 import { logger } from '../lib/core/logger';

-// file-type is a CommonJS module, use require for compatibility with Node 25+ ESM
-// eslint-disable-next-line @typescript-eslint/no-var-requires
-const fileType = require('file-type') as { fromBuffer: ... };
+// file-type v16 is CommonJS - use createRequire for ESM compatibility in Node 25+
+const require = createRequire(import.meta.url);
+const fileType = require('file-type') as { fromBuffer: ... };
```

## Prevention Strategies

### When Adding New npm Packages

1. **Check Package Type:**

   ```bash
   npm info <package> type  # Look for "module" or "commonjs"
   ```

2. **Check for ESM Version:**
   - Review package changelog for ESM migration
   - file-type v17+ is ESM-native (but may have API changes)

3. **Use Decision Tree:**
   - Package is ESM-native? → Use standard import
   - Package is CJS-only? → Use `createRequire` pattern
   - Package has ESM version? → Consider upgrade

### Code Review Checklist

- [ ] New CJS packages use `createRequire` pattern
- [ ] Import has proper TypeScript type annotation
- [ ] No direct `require()` calls in ESM files
- [ ] Test passes on Node.js 25+ environment

### Testing Recommendations

```typescript
// Unit test for CJS import
describe('file-type CJS import', () => {
  it('should import file-type via createRequire', async () => {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const fileType = require('file-type');

    expect(fileType.fromBuffer).toBeDefined();
    expect(typeof fileType.fromBuffer).toBe('function');
  });
});
```

## Alternative Approaches

### Option 1: Upgrade to file-type v17+ (ESM-native)

```typescript
// file-type v17+ is ESM
import { fileTypeFromBuffer } from 'file-type';
```

**Pros:** Native ESM, cleaner code
**Cons:** API changes, requires testing, version bump

### Option 2: Dynamic Import

```typescript
const fileType = await import('file-type');
```

**Pros:** No createRequire needed
**Cons:** Requires top-level await, async initialization overhead

### Option 3: Use Different Library

**Pros:** May find ESM-native alternative
**Cons:** API differences, requires rewrites and testing

## Security Context

This fix enables critical security validation. The `file-type` package detects file types from magic bytes (binary signatures), preventing MIME type spoofing attacks:

```typescript
// Attack scenario prevented:
const maliciousFile = {
  originalname: 'shell.php.jpg',
  mimetype: 'image/jpeg', // Attacker claims JPEG
  buffer: Buffer.from('<?php system($_GET["cmd"]); ?>'), // Actually PHP
};

// With magic byte validation:
const detectedType = await fileType.fromBuffer(file.buffer);
// detectedType = undefined (not a valid image)
// → Upload rejected, attack prevented
```

## Verification

**Before Fix:**

- Server crashes on Render with `require is not defined`

**After Fix:**

- Server starts successfully
- Magic byte validation functional
- 75 upload service tests pass
- File upload security intact

**Test Command:**

```bash
npm test -- test/services/upload.service.test.ts
```

## Related Documentation

- `docs/solutions/security-issues/file-upload-security-hardening.md` - Magic byte validation implementation
- `docs/solutions/CODE_REFERENCE_SECURE_UPLOADS.md` - Complete upload service reference
- `docs/solutions/deployment-issues/vercel-vite-monorepo-typescript-incremental-cache.md` - ESM export patterns
- `docs/solutions/authentication-issues/impersonation-upload-auth-failure.md` - Related upload auth fix

## See Also

### Similar Issues

- ESM/CJS compatibility with other packages
- Dynamic imports in server initialization
- Module resolution in monorepo workspaces

### Follow-up Tasks

- Consider upgrading to `file-type` v17+ when API stabilizes
- Document pattern in team onboarding materials
- Add ESLint rule to detect bare `require()` in ESM files

## Commits

- `f722109` - fix(upload): use createRequire for file-type CJS module in Node 25 ESM
