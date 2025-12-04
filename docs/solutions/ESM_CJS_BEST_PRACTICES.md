---
title: 'ESM/CJS Module Compatibility - Best Practices Guide'
slug: esm-cjs-best-practices
category: prevention
tags: [modules, esm, cjs, patterns, architecture, best-practices]
created: 2025-11-29
---

# ESM/CJS Module Compatibility - Best Practices Guide

## Overview

This guide provides implementation patterns for handling both ESM and CJS packages in our pure ESM environment (Node.js 25, tsx runtime).

**Project Configuration:**

- `"type": "module"` in server/package.json
- Runtime: tsx (treats all `.ts` files as ESM)
- All imports are ESM-style by default
- CJS packages require special handling

---

## Pattern 1: Direct Imports (ESM-Native Packages)

Use this for packages with `"type": "module"` in their package.json.

### Implementation

```typescript
// ✅ PATTERN: ESM-native packages
import { stripePkg } from 'stripe';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

// ✅ Type imports for interfaces
import type { Price } from 'stripe';
import type { ZodSchema } from 'zod';

// Usage
const client = new PrismaClient();
const priceData: Price = {
  /* ... */
};
```

### When to Use

- Package has `"type": "module"`
- Package has `"exports.import"` field
- Package repo mentions ESM support
- No GitHub issues about ESM compatibility

### Advantages

- ✅ Full TypeScript support
- ✅ Tree-shaking friendly
- ✅ Top-level await available
- ✅ Clean syntax
- ✅ Best performance

### Testing

```typescript
// test/services/example.test.ts
import { describe, it, expect } from 'vitest';
import { stripe } from 'stripe'; // Direct import

describe('stripe integration', () => {
  it('should create price object', async () => {
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: 1000,
      recurring: { interval: 'month' },
    });

    expect(price.id).toBeDefined();
  });
});
```

### Real Example from MAIS

```typescript
// server/src/services/booking.service.ts
import { stripe } from 'stripe';
import { z } from 'zod';
import type { Booking } from '@prisma/client';

export class BookingService {
  async createPayment(bookingId: string) {
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: 5000,
    });

    return price;
  }
}
```

---

## Pattern 2: createRequire (CJS-Only Packages)

Use this for packages without `"type": "module"`.

### Implementation

```typescript
// ✅ PATTERN: CJS-only packages
import { createRequire } from 'module';

// Create a require function scoped to this module
const require = createRequire(import.meta.url);

// Import the CJS package
const fileType = require('file-type') as typeof import('file-type');

// Usage
const detected = await fileType.fromBuffer(buffer);
```

### When to Use

- Package is CJS-only (no `"type": "module"`)
- Package has both ESM and CJS but you need CJS
- Package import needed at module level (not lazy)
- Package is frequently used throughout module

### Advantages

- ✅ Works with CJS packages in pure ESM environment
- ✅ Imports at module level (vs. dynamic import)
- ✅ Works with type assertions
- ✅ Compatible with Node.js 25

### Disadvantages

- ❌ Requires type assertion (`as typeof import(...)`)
- ❌ No tree-shaking
- ❌ Less optimal bundling

### Setup Steps

**Step 1: Import createRequire**

```typescript
import { createRequire } from 'module';
```

**Step 2: Create require function**

```typescript
const require = createRequire(import.meta.url);
```

**Step 3: Require the package**

```typescript
const fileType = require('file-type');
```

**Step 4: Add type assertion**

```typescript
const fileType = require('file-type') as typeof import('file-type');
```

**Step 5: Add explanatory comment**

```typescript
// file-type v16 is CommonJS-only
// See: https://github.com/sindresorhus/file-type
// v17+ is ESM - consider upgrading in future
const require = createRequire(import.meta.url);
const fileType = require('file-type') as typeof import('file-type');
```

### Type Assertion Patterns

#### Pattern A: ESM-style type assertion

Best when package has TypeScript definitions:

```typescript
const fileType = require('file-type') as typeof import('file-type');

// Now you get full IntelliSense
const detected = await fileType.fromBuffer(buffer);
//                              ^-- autocomplete works!
```

#### Pattern B: Explicit interface type

Use when type assertion fails or is too complex:

```typescript
const fileType = require('file-type') as {
  fromBuffer: (buffer: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
  fromFile: (path: string) => Promise<{ mime: string; ext: string } | undefined>;
};

// Still get IntelliSense with explicit types
const detected = await fileType.fromBuffer(buffer);
```

#### Pattern C: Named exports

When package exports individual functions:

```typescript
const { fromBuffer } = require('file-type') as {
  fromBuffer: (buffer: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
};

// Usage
const detected = await fromBuffer(buffer);
```

### Testing createRequire

```typescript
// test/adapters/file-type.adapter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

describe('file-type CJS import', () => {
  let fileType: any;

  beforeEach(() => {
    // Simulate real module loading
    const require = createRequire(import.meta.url);
    fileType = require('file-type');
  });

  it('should detect JPEG files', async () => {
    // JPEG magic bytes
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

    const result = await fileType.fromBuffer(jpegBuffer);

    expect(result).toBeDefined();
    expect(result?.mime).toBe('image/jpeg');
  });

  it('should return undefined for unknown files', async () => {
    const unknownBuffer = Buffer.from([0x00, 0x00, 0x00]);

    const result = await fileType.fromBuffer(unknownBuffer);

    expect(result).toBeUndefined();
  });
});
```

### Real Example from MAIS

```typescript
// server/src/services/upload.service.ts
import { createRequire } from 'module';

// file-type v16 is CommonJS-only (ESM version v17+ available)
// See: https://github.com/sindresorhus/file-type/releases
const require = createRequire(import.meta.url);
const fileType = require('file-type') as {
  fromBuffer: (buffer: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
};

export class UploadService {
  private async validateFile(file: UploadedFile): Promise<void> {
    // Magic byte validation using file-type
    const detected = await fileType.fromBuffer(file.buffer);

    if (!detected) {
      throw new Error('Unable to verify file type');
    }

    if (!this.allowedMimeTypes.includes(detected.mime)) {
      throw new Error('File type not allowed');
    }
  }
}
```

### Adapter Pattern: Centralizing CJS Imports

For better maintainability, wrap CJS imports in an adapter:

```typescript
// server/src/adapters/file-type.adapter.ts
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fileType = require('file-type') as {
  fromBuffer: (buffer: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
};

export async function detectFileType(buffer: Buffer) {
  return await fileType.fromBuffer(buffer);
}

export async function isValidMimeType(buffer: Buffer, allowedTypes: string[]): Promise<boolean> {
  const detected = await fileType.fromBuffer(buffer);
  return detected ? allowedTypes.includes(detected.mime) : false;
}
```

Then use it cleanly:

```typescript
// server/src/services/upload.service.ts
import { detectFileType } from '../adapters/file-type.adapter';

export class UploadService {
  private async validateFile(file: UploadedFile): Promise<void> {
    const detected = await detectFileType(file.buffer);

    if (!detected) {
      throw new Error('Unable to verify file type');
    }

    // ... rest of validation
  }
}
```

**Advantages of adapter pattern:**

- ✅ Hides CJS complexity from service layer
- ✅ Single place to maintain the type assertion
- ✅ Easier testing (can mock the adapter)
- ✅ Cleaner service code
- ✅ Future upgrade path (swap adapter implementation)

---

## Pattern 3: Dynamic Import (Lazy Loading)

Use this for CJS packages that are only needed sometimes.

### Implementation

```typescript
// ✅ PATTERN: Lazy-loaded CJS packages
async function validateAndProcessFile(buffer: Buffer) {
  // Import only when needed
  const { fromBuffer } = await import('file-type');

  const detected = await fromBuffer(buffer);
  return detected;
}
```

### When to Use

- Package is only used in specific code paths
- Package is heavy and not always needed
- Breaking circular dependencies
- Optional dependencies

### Advantages

- ✅ Lazy loading (not loaded if not used)
- ✅ Works with CJS packages
- ✅ Breaks circular dependencies
- ✅ Better code splitting

### Disadvantages

- ❌ Async function required (can't be synchronous)
- ❌ Must handle Promise errors
- ❌ Slightly slower first load

### Implementation

```typescript
// ✅ GOOD: With error handling
async function processFile(buffer: Buffer) {
  try {
    const { fromBuffer } = await import('file-type');
    return await fromBuffer(buffer);
  } catch (error) {
    logger.error({ error }, 'Failed to import file-type');
    throw new FileProcessingError('Unable to process file');
  }
}

// ❌ BAD: No error handling
async function processFile(buffer: Buffer) {
  const { fromBuffer } = await import('file-type'); // What if it fails?
  return await fromBuffer(buffer);
}

// ❌ BAD: Used in loop (inefficient)
async function processFiles(buffers: Buffer[]) {
  for (const buffer of buffers) {
    const { fromBuffer } = await import('file-type'); // Called N times!
    // process(buffer)
  }
}
```

### Testing Dynamic Imports

```typescript
// test/services/processor.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('dynamic imports', () => {
  it('should lazy-load file-type when needed', async () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff]);

    // Module is imported on-demand
    const result = await import('file-type').then((m) => m.fromBuffer(buffer));

    expect(result).toBeDefined();
  });

  it('should handle import errors gracefully', async () => {
    try {
      // Simulate import failure
      const module = await import('non-existent-module');
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
```

### Real Example

```typescript
// server/src/routes/file-upload.routes.ts
async function uploadFile(req: Request, res: Response) {
  const buffer = req.file.buffer;

  // Import file-type only for this upload
  try {
    const { fromBuffer } = await import('file-type');
    const detected = await fromBuffer(buffer);

    if (!detected) {
      return res.status(400).json({ error: 'Invalid file' });
    }

    // Process file
    return res.json({ success: true, mime: detected.mime });
  } catch (error) {
    logger.error({ error }, 'File upload failed');
    return res.status(500).json({ error: 'Upload failed' });
  }
}
```

---

## Pattern 4: Conditional Imports (Future-Proofing)

Use this for packages that might upgrade to ESM.

### Implementation

```typescript
// ✅ PATTERN: Try ESM first, fall back to CJS
let fileType: any;

// Try to use ESM version (might work in future)
try {
  fileType = await import('file-type');
} catch (error) {
  // Fall back to CJS
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  fileType = require('file-type');
}

export const detectFileType = async (buffer: Buffer) => {
  const result = await fileType.fromBuffer(buffer);
  return result;
};
```

### When to Use

- Package might upgrade to ESM soon
- Need maximum compatibility
- Long-term maintenance concerns
- Transitional period between versions

### Advantages

- ✅ Automatically uses ESM when available
- ✅ Graceful fallback to CJS
- ✅ Future-proof implementation

### Disadvantages

- ❌ More complex code
- ❌ Slower module initialization
- ❌ Harder to test and debug

---

## Pattern 5: Dependency Injection

Use this to decouple CJS imports from business logic.

### Implementation

```typescript
// server/src/lib/ports.ts
export interface FileTypeProvider {
  detect(buffer: Buffer): Promise<{ mime: string; ext: string } | undefined>;
}

// server/src/adapters/file-type.adapter.ts
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fileType = require('file-type');

export class FileTypeAdapterImpl implements FileTypeProvider {
  async detect(buffer: Buffer) {
    return await fileType.fromBuffer(buffer);
  }
}

// server/src/services/upload.service.ts
export class UploadService {
  constructor(private fileType: FileTypeProvider) {}

  async validateFile(file: UploadedFile) {
    const detected = await this.fileType.detect(file.buffer);
    // ...
  }
}

// server/src/di.ts (Dependency Injection)
export function createUploadService(preset: string) {
  let fileTypeProvider: FileTypeProvider;

  if (preset === 'mock') {
    // Mock implementation for testing
    fileTypeProvider = new MockFileTypeProvider();
  } else {
    // Real implementation with CJS
    fileTypeProvider = new FileTypeAdapterImpl();
  }

  return new UploadService(fileTypeProvider);
}
```

### Advantages

- ✅ Business logic doesn't know about CJS
- ✅ Easy to mock for testing
- ✅ Follows SOLID principles
- ✅ Supports multiple implementations
- ✅ Future upgrade path (swap implementation)

---

## Migration Patterns: CJS → ESM

When a CJS package upgrades to ESM:

### Step 1: Identify Upgrade Opportunity

```typescript
// Before: v16 (CJS-only)
const require = createRequire(import.meta.url);
const fileType = require('file-type') as typeof import('file-type');

// After: v17+ (ESM)
import { fromBuffer } from 'file-type';
```

### Step 2: Update Package Version

```bash
npm update file-type@latest
# or
npm install file-type@^17.0.0
```

### Step 3: Update Imports

```typescript
// ❌ Remove createRequire
// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);

// ✅ Use direct import
import { fromBuffer } from 'file-type';
```

### Step 4: Update Tests

```typescript
// Before: Had to use createRequire in tests
const require = createRequire(import.meta.url);
const fileType = require('file-type');

// After: Direct import in tests
import { fromBuffer } from 'file-type';
```

### Step 5: Verify All Tests Pass

```bash
npm test
npm run typecheck
npm run test:e2e
```

---

## Error Handling Patterns

### Pattern: Type-Safe Error Handling

```typescript
// ✅ GOOD: Typed error handling
export class FileValidationError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_TYPE' | 'INVALID_SIZE'
  ) {
    super(message);
    this.name = 'FileValidationError';
  }
}

export class UploadService {
  async validateFile(file: UploadedFile): Promise<void> {
    // Validate size
    if (file.size > this.maxSize) {
      throw new FileValidationError('File too large', 'INVALID_SIZE');
    }

    // Validate type
    try {
      const detected = await fileType.fromBuffer(file.buffer);

      if (!detected) {
        throw new FileValidationError('Unable to verify file type', 'INVALID_TYPE');
      }

      if (!this.allowedTypes.includes(detected.mime)) {
        throw new FileValidationError(`File type ${detected.mime} not allowed`, 'INVALID_TYPE');
      }
    } catch (error) {
      if (error instanceof FileValidationError) {
        throw error;
      }

      // Unexpected error
      logger.error({ error, file }, 'Unexpected error during file validation');
      throw new FileValidationError('File validation failed', 'INVALID_TYPE');
    }
  }
}
```

### Pattern: Graceful Fallbacks

```typescript
// ✅ GOOD: Fallback when module unavailable
async function detectFileType(buffer: Buffer) {
  try {
    const { fromBuffer } = await import('file-type');
    return await fromBuffer(buffer);
  } catch (error) {
    logger.warn({ error }, 'file-type unavailable, using filename-based detection');

    // Fallback: Use basic magic byte detection
    return detectMagicBytes(buffer);
  }
}

function detectMagicBytes(buffer: Buffer) {
  // Minimal magic byte detection as fallback
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return { mime: 'image/png', ext: 'png' };
  }
  return undefined;
}
```

---

## Performance Considerations

### Avoid: Repeated Dynamic Imports

```typescript
// ❌ BAD: Import in loop (N imports!)
async function processFiles(files: File[]) {
  for (const file of files) {
    const { fromBuffer } = await import('file-type'); // Called N times!
    const type = await fromBuffer(file.buffer);
    console.log(type);
  }
}

// ✅ GOOD: Import once, reuse
async function processFiles(files: File[]) {
  const { fromBuffer } = await import('file-type'); // Once!

  for (const file of files) {
    const type = await fromBuffer(file.buffer);
    console.log(type);
  }
}
```

### Prefer: Module-Level Imports

```typescript
// ✅ GOOD: Import at module level (loaded once)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fileType = require('file-type');

// Used in multiple functions
export async function validate(buffer: Buffer) {
  return await fileType.fromBuffer(buffer);
}

// ❌ BAD: Reimport in each function
async function validate(buffer: Buffer) {
  const { fromBuffer } = await import('file-type');
  return await fromBuffer(buffer);
}

async function process(buffer: Buffer) {
  const { fromBuffer } = await import('file-type'); // Duplicate!
  return await fromBuffer(buffer);
}
```

---

## Testing Patterns Summary

| Pattern        | Unit Test     | Integration | E2E      | Notes                         |
| -------------- | ------------- | ----------- | -------- | ----------------------------- |
| Direct Import  | ✅ Easy       | ✅ Easy     | ✅ Works | Preferred                     |
| createRequire  | ✅ Works      | ✅ Works    | ✅ Works | Use adapter for cleaner tests |
| Dynamic Import | ✅ With async | ✅ Works    | ✅ Works | Test error cases              |
| Conditional    | ⚠️ Complex    | ✅ Works    | ✅ Works | Test both branches            |

---

## Checklist for Implementation

Before committing code with CJS imports:

- [ ] Pattern chosen based on package type
- [ ] Implementation follows patterns in this guide
- [ ] Type assertions present (if using createRequire)
- [ ] Comments explain why pattern is needed
- [ ] Adapter used for complex CJS packages
- [ ] Tests cover all code paths
- [ ] TypeScript strict mode passes
- [ ] All tests pass (unit, integration, E2E)
- [ ] No duplicate imports of same package
- [ ] Error handling is type-safe

---

**Last Updated:** 2025-11-29
**Used by:** Developers implementing module imports
**Priority:** High
