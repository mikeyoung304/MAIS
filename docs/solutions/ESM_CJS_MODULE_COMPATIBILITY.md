# ESM/CJS Module Compatibility in Node.js 25

**Date Solved:** 2025-11-29
**Severity:** Critical
**Component:** server/upload-service
**Category:** Runtime Errors
**Tags:** esm, commonjs, node-25, module-system, file-type

---

## Executive Summary

Node.js 25 with tsx runs in pure ESM mode, preventing direct use of CommonJS-only libraries via named imports. The `file-type` v16 library is CommonJS-only, causing runtime failures during file upload validation.

**Symptoms:**

- `ReferenceError: require is not defined in ES module scope`
- `Cannot use named import syntax in ESM for CommonJS module`
- File upload validation fails with no clear error message

**Root Cause:**
ESM modules cannot directly import from CommonJS packages using named imports. The `file-type` v16 library exports CommonJS format, incompatible with ESM import syntax.

**Solution:**
Use Node's built-in `createRequire` function to create a CommonJS-compatible require function within ESM context.

---

## The Problem

### Scenario 1: Direct require() Fails

```typescript
// ❌ WRONG: Node 25 ESM doesn't have require() in scope
const fileType = require('file-type');
// Error: ReferenceError: require is not defined in ES module scope
```

### Scenario 2: ESM Import Also Fails

```typescript
// ❌ WRONG: Named imports from CJS module fail in pure ESM
import { fromBuffer } from 'file-type';
// Error: Cannot use named import syntax in ES module scope
```

### Scenario 3: Default Import Doesn't Work Either

```typescript
// ❌ WRONG: Default import from CJS also fails
import fileType from 'file-type';
// Returns undefined or wrong structure
```

### Error Messages Encountered

**Attempt 1: Direct require()**

```
ReferenceError: require is not defined in ES module scope
    at /Users/mikeyoung/CODING/MAIS/server/src/services/upload.service.ts:18
```

**Attempt 2: ESM named import**

```
SyntaxError: The requested module 'file-type' is not a valid module target
    for this operation at /Users/mikeyoung/CODING/MAIS/server/src/services/upload.service.ts:14
```

---

## The Solution

### Using createRequire from Node's module Package

```typescript
import { createRequire } from 'module';

// Create a CommonJS-compatible require function
const require = createRequire(import.meta.url);

// Now you can require CommonJS modules
const fileType = require('file-type') as {
  fromBuffer: (buffer: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
};

// Use it normally
const detectedType = await fileType.fromBuffer(buffer);
```

### How It Works

1. **`createRequire(import.meta.url)`** - Creates a require function scoped to the current ESM module
2. **`import.meta.url`** - The absolute file URL of the current module (ESM-only feature)
3. **Type assertion** - Add `as` clause to provide TypeScript type information
4. **Direct require call** - Call the created require function like normal CommonJS

### Implementation Details

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/upload.service.ts`

**Before (Broken):**

```typescript
import { fromBuffer as detectFileType } from 'file-type';

// In validateFile method:
const detectedType = await detectFileType(file.buffer);
```

**After (Fixed):**

```typescript
import { createRequire } from 'module';

// file-type v16 is CommonJS - use createRequire for ESM compatibility in Node 25+
const require = createRequire(import.meta.url);
const fileType = require('file-type') as {
  fromBuffer: (buffer: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
};

// In validateFile method:
const detectedType = await fileType.fromBuffer(file.buffer);
```

---

## Why This Approach

### Why Not Other Solutions?

**Option 1: Dynamic ESM Import**

```typescript
const fileType = await import('file-type');
// Problem: Doesn't work with CommonJS modules that lack ESM wrapper
```

**Option 2: Upgrade file-type to v18 (ESM native)**

```typescript
// Problem: Breaking changes, different API, requires extensive refactoring
```

**Option 3: Configure TypeScript to use CommonJS target**

```typescript
// Problem: Defeats purpose of ESM benefits, breaks modern Node tooling
```

**Why createRequire is best:**

- No external dependencies
- Works with pure ESM execution environment
- Minimal code changes
- Type-safe with TypeScript
- Forward-compatible with future Node versions

---

## Implementation Checklist

### For Current Issue

- [x] Import `createRequire` from `module` package
- [x] Create scoped require function using `import.meta.url`
- [x] Replace named ESM imports with require call
- [x] Add TypeScript type assertion for type safety
- [x] Update JSDoc comment explaining the pattern
- [x] Test file upload validation with various file types
- [x] Verify magic byte detection still works

### For Similar Issues

When encountering `ReferenceError: require is not defined` or similar CJS compatibility issues:

1. **Identify the problem module**

   ```bash
   npm ls {module-name}  # Check version and ESM support
   npm view {module-name} types  # Check if ESM wrapper exists
   ```

2. **Check if ESM alternative exists**

   ```bash
   npm search {module-name} --long | grep esm
   ```

3. **If upgrading is not viable, use createRequire:**

   ```typescript
   import { createRequire } from 'module';
   const require = createRequire(import.meta.url);
   const module = require('package-name');
   ```

4. **Add type assertion for TypeScript:**
   ```typescript
   const module = require('package-name') as {
     // your interface here
   };
   ```

---

## Testing

### Unit Test (Magic Byte Detection)

```typescript
test('validates file by magic bytes', async () => {
  const service = new UploadService();

  // Create buffer with PNG magic bytes
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...]);

  const file: UploadedFile = {
    fieldname: 'image',
    originalname: 'test.png',
    encoding: '7bit',
    mimetype: 'image/png',
    buffer: pngBuffer,
    size: pngBuffer.length,
  };

  // Should pass validation
  await service.uploadLogo(file, 'tenant-1');
  // ...
});
```

### Test Attack Scenario

```typescript
test('rejects PHP shell disguised as image', async () => {
  const service = new UploadService();

  // Create buffer with PHP code but PNG extension
  const phpBuffer = Buffer.from('<?php system($_GET["cmd"]); ?>');

  const file: UploadedFile = {
    fieldname: 'image',
    originalname: 'photo.png',
    encoding: '7bit',
    mimetype: 'image/png', // Declared as PNG
    buffer: phpBuffer, // Actually PHP code
    size: phpBuffer.length,
  };

  // Should throw validation error
  expect(() => service.uploadLogo(file, 'tenant-1')).rejects.toThrow('File validation failed');
});
```

---

## Performance Impact

**None.** Using `createRequire` is a compile-time operation that creates a function reference. There's no runtime overhead:

- File-type detection still uses the same library
- Same algorithm, same performance
- Only difference: how the module is loaded

---

## Compatibility Matrix

| Node Version | ESM Mode | Solution         | Status          |
| ------------ | -------- | ---------------- | --------------- |
| 18-20        | Optional | Direct require() | Works           |
| 21-24        | Optional | Direct require() | Works           |
| 25+          | Pure ESM | createRequire()  | ✅ Required     |
| Future       | Pure ESM | createRequire()  | ✅ Future-proof |

---

## Rollback Plan

If this approach causes issues:

1. **Immediate:** Revert to version control

   ```bash
   git revert <commit-hash>
   ```

2. **Alternative:** Upgrade file-type to v18+ (ESM native)
   ```bash
   npm install file-type@latest
   ```
   Then refactor to use ESM import syntax.

---

## Related Issues

- **File Upload Security:** `/docs/solutions/SECURE_FILE_UPLOAD_DEFENSE_IN_DEPTH.md`
- **Node Runtime Errors:** See typescript/tsx configuration in `server/tsconfig.json`
- **Module Resolution:** Check `package.json` "type" field and "exports" definition

---

## Key Takeaway

In modern Node.js with pure ESM execution, `createRequire` is the standard way to import CommonJS-only libraries. This pattern is officially recommended by Node.js and is not a workaround—it's the correct solution.

**Pin this pattern for reference:**

```typescript
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const myModule = require('commonjs-only-package');
```
