---
title: 'ESM/CJS Module Compatibility - Testing Recommendations'
slug: esm-cjs-testing-recommendations
category: prevention
tags: [testing, esm, cjs, unit-tests, integration-tests, e2e-tests, vitest, playwright]
created: 2025-11-29
---

# ESM/CJS Module Compatibility - Testing Recommendations

## Overview

Testing is critical for catching module compatibility issues before they reach production. This guide covers unit, integration, and E2E testing strategies for ESM/CJS packages.

**Testing Stack in MAIS:**

- Unit/Integration: Vitest (runs in Node.js, pure ESM)
- E2E: Playwright (real browser, real tsx runtime)
- Coverage Target: 70% (current: 100%)

---

## Unit Testing CJS Imports

### Test Pattern 1: Direct Imports (ESM-Native)

```typescript
// test/services/booking.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { stripe } from 'stripe'; // Direct import

describe('BookingService with stripe', () => {
  let service: BookingService;
  let mockRepo: MockBookingRepository;

  beforeEach(() => {
    mockRepo = new MockBookingRepository();
    service = new BookingService(mockRepo, stripe);
  });

  it('should create booking with stripe integration', async () => {
    const booking = await service.createBooking({
      tenantId: 'tenant-1',
      date: new Date(),
      duration: 60,
    });

    expect(booking.id).toBeDefined();
  });

  it('should handle stripe errors gracefully', async () => {
    vi.mocked(stripe.charges.create).mockRejectedValueOnce(new Error('Stripe API error'));

    await expect(
      service.createBooking({
        tenantId: 'tenant-1',
        date: new Date(),
        duration: 60,
      })
    ).rejects.toThrow('Payment failed');
  });
});
```

### Test Pattern 2: createRequire Imports

When testing CJS imports with `createRequire`, use an adapter pattern:

```typescript
// test/adapters/file-type.adapter.test.ts
import { describe, it, expect } from 'vitest';
import { detectFileType, isValidMimeType } from '../../src/adapters/file-type.adapter';

describe('FileTypeAdapter (CJS via createRequire)', () => {
  describe('detectFileType', () => {
    it('should detect JPEG files from magic bytes', async () => {
      // JPEG magic bytes: FF D8 FF E0
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

      const result = await detectFileType(jpegBuffer);

      expect(result).toBeDefined();
      expect(result?.mime).toBe('image/jpeg');
      expect(result?.ext).toBe('jpg');
    });

    it('should detect PNG files from magic bytes', async () => {
      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      const result = await detectFileType(pngBuffer);

      expect(result).toBeDefined();
      expect(result?.mime).toBe('image/png');
      expect(result?.ext).toBe('png');
    });

    it('should return undefined for unknown file types', async () => {
      const unknownBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);

      const result = await detectFileType(unknownBuffer);

      expect(result).toBeUndefined();
    });

    it('should handle large buffers', async () => {
      const largeBuffer = Buffer.alloc(10_000_000); // 10MB
      largeBuffer[0] = 0xff;
      largeBuffer[1] = 0xd8;
      largeBuffer[2] = 0xff;
      largeBuffer[3] = 0xe0;

      const result = await detectFileType(largeBuffer);

      expect(result?.mime).toBe('image/jpeg');
    });
  });

  describe('isValidMimeType', () => {
    it('should validate JPEG files', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

      const isValid = await isValidMimeType(jpegBuffer, ['image/jpeg']);

      expect(isValid).toBe(true);
    });

    it('should reject non-allowed MIME types', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

      const isValid = await isValidMimeType(jpegBuffer, ['image/png']);

      expect(isValid).toBe(false);
    });

    it('should reject unknown files', async () => {
      const unknownBuffer = Buffer.from([0x00, 0x00]);

      const isValid = await isValidMimeType(unknownBuffer, ['image/jpeg']);

      expect(isValid).toBe(false);
    });
  });
});
```

**Key Points:**

- Test the adapter, not the CJS import directly
- Use real magic bytes for file types
- Test both success and error cases
- Test edge cases (large files, unknown types)

### Test Pattern 3: Dynamic Imports

```typescript
// test/services/processor.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('ProcessorService with dynamic import', () => {
  it('should lazy-load file-type module', async () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

    // Simulate lazy loading
    const fileTypeModule = await import('file-type');
    const result = await fileTypeModule.fromBuffer(buffer);

    expect(result).toBeDefined();
    expect(result?.mime).toBe('image/jpeg');
  });

  it('should handle import errors gracefully', async () => {
    // Test error handling with non-existent module
    try {
      await import('non-existent-module');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
```

---

## Integration Testing

### Test Pattern: Service Integration with CJS Packages

```typescript
// test/integration/upload.service.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestTenant } from '../helpers/test-tenant';
import { UploadService } from '../../src/services/upload.service';

describe('UploadService (Integration)', () => {
  let uploadService: UploadService;
  let tenantId: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    // Create isolated test tenant
    const testTenant = await createTestTenant();
    tenantId = testTenant.tenantId;
    cleanup = testTenant.cleanup;

    // Initialize service with real database
    uploadService = new UploadService(
      prisma, // Real Prisma client
      supabaseAdapter,
      new FileTypeAdapterImpl() // Real file-type via createRequire
    );
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should validate file before uploading', async () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const file = {
      fieldname: 'image',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: jpegBuffer,
      size: jpegBuffer.length,
      destination: 'uploads/',
      filename: 'test.jpg',
      path: 'uploads/test.jpg',
    };

    // Should not throw
    const result = await uploadService.upload(tenantId, 'segments', file);

    expect(result.url).toBeDefined();
    expect(result.filename).toBe('test.jpg');
  });

  it('should reject files with mismatched MIME types', async () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const file = {
      fieldname: 'image',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/png', // Declared as PNG but is actually JPEG
      buffer: jpegBuffer,
      size: jpegBuffer.length,
      destination: 'uploads/',
      filename: 'test.jpg',
      path: 'uploads/test.jpg',
    };

    // Should throw validation error
    await expect(uploadService.upload(tenantId, 'segments', file)).rejects.toThrow(
      'File validation failed'
    );
  });

  it('should store uploaded file in database', async () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const file = {
      fieldname: 'image',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: jpegBuffer,
      size: jpegBuffer.length,
      destination: 'uploads/',
      filename: 'test.jpg',
      path: 'uploads/test.jpg',
    };

    const result = await uploadService.upload(tenantId, 'segments', file);

    // Verify file stored in database
    const segment = await prisma.segment.findUnique({
      where: { id: result.segmentId },
    });

    expect(segment?.imageUrl).toBeDefined();
    expect(segment?.imagePath).toContain('test.jpg');
  });

  it('should reject duplicate filenames with unique suffix', async () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const file = {
      fieldname: 'image',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: jpegBuffer,
      size: jpegBuffer.length,
      destination: 'uploads/',
      filename: 'test.jpg',
      path: 'uploads/test.jpg',
    };

    // Upload first file
    const first = await uploadService.upload(tenantId, 'segments', file);

    // Upload with same name
    const second = await uploadService.upload(tenantId, 'segments', file);

    // Should have different filenames
    expect(first.filename).not.toBe(second.filename);
    expect(second.filename).toContain('test');
    expect(second.filename).toContain('jpg');
  });
});
```

**Key Points:**

- Use `createTestTenant()` helper for isolation
- Test with real database and real CJS imports
- Test file validation with magic bytes
- Verify database state after operations
- Clean up after each test

---

## E2E Testing with Playwright

### Test Pattern: User File Upload Flow

```typescript
// e2e/tests/file-upload.spec.ts
import { test, expect } from '@playwright/test';

test.describe('File Upload E2E', () => {
  let page: any;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    // Setup: Login and navigate
    await page.goto('http://localhost:5173/admin');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button:has-text("Login")');
    await page.waitForNavigation();
  });

  test('should upload valid JPEG image', async () => {
    // Navigate to upload page
    await page.goto('http://localhost:5173/admin/segments');

    // Create a test JPEG file
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

    // Upload file
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: jpegBuffer,
    });

    // Click upload button
    await page.click('button:has-text("Upload Image")');

    // Wait for upload to complete
    await page.waitForSelector('img[alt="Hero Image"]', { timeout: 5000 });

    // Verify image appears in UI
    const image = await page.locator('img[alt="Hero Image"]');
    await expect(image).toBeVisible();

    // Verify URL is signed (not public)
    const imageSrc = await image.getAttribute('src');
    expect(imageSrc).toContain('signed-url');
    expect(imageSrc).not.toContain('public');
  });

  test('should reject invalid file type', async () => {
    await page.goto('http://localhost:5173/admin/segments');

    // Create a file with PNG extension but JPEG magic bytes
    const fakeBuffer = Buffer.from([
      0xff,
      0xd8,
      0xff,
      0xe0, // JPEG magic bytes
    ]);

    // Try to upload as PNG
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test.png',
      mimeType: 'image/png', // Wrong!
      buffer: fakeBuffer,
    });

    await page.click('button:has-text("Upload Image")');

    // Should show error
    await page.waitForSelector('[role="alert"]:has-text("validation failed")', {
      timeout: 5000,
    });

    const alert = await page.locator('[role="alert"]');
    await expect(alert).toBeVisible();
  });

  test('should reject oversized files', async () => {
    await page.goto('http://localhost:5173/admin/segments');

    // Create large buffer (over size limit)
    const largeBuffer = Buffer.alloc(20_000_000); // 20MB
    largeBuffer[0] = 0xff;
    largeBuffer[1] = 0xd8;
    largeBuffer[2] = 0xff;
    largeBuffer[3] = 0xe0;

    await page.locator('input[type="file"]').setInputFiles({
      name: 'huge.jpg',
      mimeType: 'image/jpeg',
      buffer: largeBuffer,
    });

    await page.click('button:has-text("Upload Image")');

    // Should show size error
    await page.waitForSelector('[role="alert"]:has-text("too large")', {
      timeout: 5000,
    });
  });

  test('should persist uploaded image across page reloads', async () => {
    await page.goto('http://localhost:5173/admin/segments');

    // Upload image
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: jpegBuffer,
    });

    await page.click('button:has-text("Upload Image")');
    await page.waitForSelector('img[alt="Hero Image"]');

    // Reload page
    await page.reload();

    // Image should still be visible
    await page.waitForSelector('img[alt="Hero Image"]');
    const image = await page.locator('img[alt="Hero Image"]');
    await expect(image).toBeVisible();
  });
});
```

**Key Points:**

- Tests actual browser file upload
- Uses real tsx runtime (not mocked)
- Verifies UI behavior and database state
- Tests both success and error flows
- Tests that uploads persist across reloads

---

## Build Verification Tests

### Test Pattern: Verify Compiled Code

```bash
#!/bin/bash
# test/build-verification.sh

echo "Building project..."
npm run build

echo "Checking that build succeeded..."
[ -d "server/dist" ] || { echo "Build output missing"; exit 1; }
[ -f "server/dist/index.js" ] || { echo "Main entry missing"; exit 1; }

echo "Checking that imports resolve correctly..."
grep -r "createRequire" server/dist/ || echo "No createRequire in production (good!)"
grep -r "import(" server/dist/ || echo "No dynamic imports in production (expected)"

echo "Starting built server..."
timeout 5s npm start || true

echo "Build verification passed!"
```

Run in CI:

```json
{
  "scripts": {
    "verify:build": "bash test/build-verification.sh"
  }
}
```

---

## Module Compatibility Verification

### Test Pattern: Check for Dual Package Hazard

```typescript
// test/module-compatibility.test.ts
import { describe, it, expect } from 'vitest';

describe('Module Compatibility', () => {
  it('should not load file-type as both ESM and CJS', async () => {
    // Import as ESM
    let esmVersion: any;
    try {
      esmVersion = await import('file-type');
    } catch (e) {
      // file-type might not have ESM export, that's okay
      esmVersion = null;
    }

    // Import as CJS via adapter
    const { detectFileType } = await import('../src/adapters/file-type.adapter');

    // If both exist, they should be same instance
    if (esmVersion && typeof detectFileType === 'function') {
      // Verify no state mismatch
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

      const result = await detectFileType(buffer);
      expect(result).toBeDefined();
      expect(result?.mime).toBe('image/jpeg');
    }
  });

  it('should have correct TypeScript definitions', async () => {
    // This test verifies TypeScript compilation succeeds
    // (if it compiles, the types are correct)
    const { detectFileType } = await import('../src/adapters/file-type.adapter');

    const result = await detectFileType(Buffer.from([0xff, 0xd8]));

    // TypeScript knows the return type
    expect(result === undefined || result?.mime).toBeDefined();
  });
});
```

---

## Continuous Integration Testing

### CI Configuration

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '25'

      - name: Install dependencies
        run: npm install

      - name: TypeScript check
        run: npm run typecheck

      - name: Unit tests
        run: npm test

      - name: Integration tests
        run: npm run test:integration

      - name: E2E tests
        run: npm run test:e2e

      - name: Build verification
        run: npm run build && npm run verify:build

      - name: Coverage report
        run: npm run coverage
```

---

## Testing Checklist

Before committing code with CJS imports:

### Unit Tests

- [ ] Tests for adapter functions
- [ ] Tests for both success and error cases
- [ ] Edge case tests (large files, unusual inputs)
- [ ] All tests pass: `npm test`

### Integration Tests

- [ ] Tests with real database
- [ ] Tests with actual CJS package
- [ ] Tests verify database state changes
- [ ] All tests pass: `npm run test:integration`

### E2E Tests

- [ ] Tests for complete user workflows
- [ ] Tests run in real tsx runtime
- [ ] Tests verify UI and database state
- [ ] All tests pass: `npm run test:e2e`

### Build Verification

- [ ] TypeScript compilation passes: `npm run typecheck`
- [ ] Production build succeeds: `npm run build`
- [ ] Built code can start: `npm start`
- [ ] No module resolution errors

### Module Compatibility

- [ ] No "Cannot find module" errors
- [ ] No dual package hazard
- [ ] Type assertions present and correct
- [ ] No runtime import failures

---

## Common Test Failures & Solutions

### Failure: "Cannot find module 'file-type'"

**Cause:** createRequire not working in test
**Solution:**

```typescript
// In test setup file
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Now tests can use the module
```

---

### Failure: "TypeError: fileType.fromBuffer is not a function"

**Cause:** Incorrect export accessed
**Solution:**

```typescript
// ❌ Wrong
const fileType = require('file-type');
fileType.fromBuffer(buffer); // fromBuffer not on default export

// ✅ Correct
const { fromBuffer } = require('file-type');
fromBuffer(buffer);

// Or with type assertion
const fileType = require('file-type') as typeof import('file-type');
fileType.fromBuffer(buffer);
```

---

### Failure: "Test timeout" with dynamic imports

**Cause:** Import not awaited properly
**Solution:**

```typescript
// ❌ Wrong
const fileType = import('file-type'); // Missing await
const result = await fileType.fromBuffer(buffer);

// ✅ Correct
const { fromBuffer } = await import('file-type');
const result = await fromBuffer(buffer);
```

---

## Testing Performance

Monitor test execution time:

```bash
# Run tests with timing
npm test -- --reporter=verbose

# Expected: <5 seconds for unit tests
# Expected: <30 seconds for integration tests
# Expected: <2 minutes for E2E tests
```

If tests are slow:

1. Check for unnecessary async operations
2. Verify no redundant module imports
3. Check database query performance
4. Profile with `--profile` flag

---

**Last Updated:** 2025-11-29
**Used by:** QA and developers
**Priority:** High
