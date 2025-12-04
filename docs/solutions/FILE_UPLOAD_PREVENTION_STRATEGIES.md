# File Upload Security - Prevention Strategies

**For Development Teams & Code Reviewers**

This document provides actionable prevention strategies based on three critical security vulnerabilities fixed in the MAIS file upload system:

1. **MIME Type Spoofing** - Attackers uploading PHP shells disguised as images
2. **Cross-Tenant Data Leak** - Public URLs allowing unauthorized file access
3. **Orphaned Files** - Cleanup failures causing quota exhaustion

---

## Executive Summary

### The Three Vulnerabilities

| Vulnerability              | Risk                                                  | Prevention                                       |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| **MIME Type Spoofing**     | Arbitrary code execution via malicious file uploads   | Magic byte validation (not Content-Type header)  |
| **Cross-Tenant Data Leak** | One tenant accessing another's files via guessed URLs | Private buckets + signed URLs + tenantId in path |
| **Orphaned Files**         | Storage quota exhaustion from unreferenced files      | Automatic cleanup on entity deletion             |

---

## Prevention Strategy 1: Magic Byte Validation for MIME Type Spoofing

### Problem

Attackers can disguise executable files as images by changing the file extension and MIME type header:

```typescript
❌ VULNERABLE APPROACH
// Only checking Content-Type header
if (file.mimetype !== 'image/jpeg') {
  throw new Error('Invalid file type');
}
// Attacker uploads PHP shell with mimetype: 'image/jpeg'
// Server executes: <?php system($_GET['cmd']); ?>
```

### Prevention Rules

**Rule 1: Never Trust Content-Type Header Alone**

```typescript
❌ WRONG - Only checks header
if (ALLOWED_TYPES.includes(file.mimetype)) {
  // Accept file
}

✅ CORRECT - Validates actual content
const detected = await detectFileType(file.buffer);
if (!ALLOWED_TYPES.includes(detected.mime)) {
  throw new Error('File validation failed');
}
```

**Rule 2: Validate Against Detected Type**

```typescript
// Double-check: declared type must match detected type
const normalizedDeclared = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
const normalizedDetected = detected.mime === 'image/jpg' ? 'image/jpeg' : detected.mime;

if (normalizedDetected !== normalizedDeclared) {
  logger.warn(
    { declared: file.mimetype, detected: detected.mime },
    'SECURITY: MIME type mismatch detected - possible spoofing'
  );
  throw new Error('File validation failed');
}
```

**Rule 3: Special Handling for Formats Without Magic Bytes**

```typescript
// SVG is plain XML text, no standard magic bytes
if (file.mimetype === 'image/svg+xml') {
  const content = file.buffer.toString('utf8', 0, 500).trim();
  const isSvg =
    content.startsWith('<?xml') ||
    content.startsWith('<svg') ||
    content.toLowerCase().includes('<svg');
  if (!isSvg) {
    logger.warn(
      { filename: file.originalname },
      'SECURITY: File claimed to be SVG but does not contain valid SVG content'
    );
    throw new Error('File validation failed');
  }
  return; // SVG is valid
}
```

### Test Cases to Add

```typescript
describe('MIME Type Spoofing Prevention', () => {
  it('should reject PHP file with fake image/jpeg header', async () => {
    const phpFile = createMockFile({
      mimetype: 'image/jpeg',
      buffer: Buffer.from('<?php system($_GET["cmd"]); ?>'),
    });

    await expect(uploadService.uploadLogo(phpFile, 'tenant_123')).rejects.toThrow(
      'Unable to verify file type'
    );
  });

  it('should reject PNG claiming to be JPEG', async () => {
    const mismatchedFile = createMockFile({
      mimetype: 'image/jpeg',
      buffer: PNG_MAGIC, // Real PNG header
    });

    await expect(uploadService.uploadLogo(mismatchedFile, 'tenant_123')).rejects.toThrow(
      'File validation failed'
    );
  });

  it('should reject SVG claiming to contain images but with PHP content', async () => {
    const maliciousSvg = createMockFile({
      mimetype: 'image/svg+xml',
      buffer: Buffer.from('<?php phpinfo(); ?>'),
    });

    await expect(uploadService.uploadLogo(maliciousSvg, 'tenant_123')).rejects.toThrow(
      'File validation failed'
    );
  });

  it('should accept valid JPEG with correct magic bytes', async () => {
    const validFile = createMockFile({
      mimetype: 'image/jpeg',
      buffer: JPEG_MAGIC,
    });

    const result = await uploadService.uploadLogo(validFile, 'tenant_123');
    expect(result).toBeDefined();
  });
});
```

### Implementation Checklist

- [ ] Add `file-type` library: `npm install file-type`
- [ ] Import: `import { fromBuffer as detectFileType } from 'file-type'`
- [ ] Validate before accepting any file upload
- [ ] Log MIME mismatches with SECURITY tag
- [ ] Test with PHP shells, text files, ZIP archives as images
- [ ] Handle SVG specially (no magic bytes)
- [ ] Run: `npm test -- upload.service.test.ts --grep "MIME Type Spoofing"`

---

## Prevention Strategy 2: Tenant Isolation with Signed URLs

### Problem

Public storage URLs allow attackers to access other tenants' files by guessing the path:

```typescript
❌ VULNERABLE APPROACH
// Public bucket, guessable path
const url = `https://xxx.supabase.co/storage/v1/object/public/images/logos/logo-123.jpg`;

// Attacker guesses: /images/tenant-xyz/logos/logo-456.jpg
// Attacker can access another tenant's logo
```

### Prevention Rules

**Rule 1: Use Private Bucket**

```typescript
// Supabase bucket configuration
✅ CORRECT
- Bucket: "images" (PRIVATE, not public)
- Row-level security: ENABLED
- Public access: Only via signed URLs
- RLS policies: Restrict to authenticated users

❌ WRONG
- Bucket: "images" (PUBLIC)
- Row-level security: DISABLED
- Public access: Anyone with path can read
```

**Rule 2: Include TenantId in Storage Path**

```typescript
❌ WRONG - No tenant isolation
const storagePath = `logos/${filename}`;

✅ CORRECT - Tenant-scoped path
const storagePath = `${tenantId}/logos/${filename}`;

// Benefits:
// 1. Files organized by tenant
// 2. Easy to find tenant's files
// 3. Supports RLS policies: WHERE path LIKE '${tenantId}/%'
```

**Rule 3: Generate Signed URLs for Private Bucket**

```typescript
// When serving files, generate signed URL with expiry
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const { data: signedUrlData, error: signedUrlError } = await supabase.storage
  .from('images')
  .createSignedUrl(storagePath, ONE_YEAR_SECONDS);

if (signedUrlError || !signedUrlData) {
  throw new Error('Failed to generate access URL');
}

return signedUrlData.signedUrl; // URL with token, expires in 1 year
```

**Rule 4: Verify Tenant Ownership Before Deletion**

```typescript
async deleteSegmentImage(url: string, tenantId: string): Promise<void> {
  if (!url) return;

  const storagePath = extractStoragePath(url); // Parse: tenant-123/segments/photo.jpg

  // SECURITY: Verify tenant owns this file
  if (!storagePath.startsWith(`${tenantId}/`)) {
    logger.error({ tenantId, storagePath },
      'SECURITY: Attempted cross-tenant file deletion blocked');
    return; // Block silently
  }

  // Safe to delete
  await supabase.storage.from('images').remove([storagePath]);
}
```

### Test Cases to Add

```typescript
describe('Cross-Tenant Isolation', () => {
  it('should block deletion of files from other tenants', async () => {
    // File belongs to tenant-abc
    const url =
      'https://xxx.supabase.co/storage/v1/object/sign/images/tenant-abc/segments/photo.jpg?token=...';

    // Tenant-xyz tries to delete it
    await uploadService.deleteSegmentImage(url, 'tenant-xyz');

    // Should not call Supabase delete
    expect(supabaseDeleteMock).not.toHaveBeenCalled();
  });

  it('should allow deletion of files from same tenant', async () => {
    const url =
      'https://xxx.supabase.co/storage/v1/object/sign/images/tenant-abc/segments/photo.jpg?token=...';

    await uploadService.deleteSegmentImage(url, 'tenant-abc');

    // Should call Supabase delete
    expect(supabaseDeleteMock).toHaveBeenCalledWith([expect.stringMatching(/^tenant-abc\//)]);
  });

  it('should parse signed URLs correctly', async () => {
    const signedUrl =
      'https://xxx.supabase.co/storage/v1/object/sign/images/tenant-abc/segments/photo.jpg?token=abc123&expires=1234567890';

    const path = uploadService.extractStoragePathFromUrl(signedUrl);
    expect(path).toBe('tenant-abc/segments/photo.jpg');
  });

  it('should parse public URLs correctly', async () => {
    const publicUrl =
      'https://xxx.supabase.co/storage/v1/object/public/images/tenant-abc/segments/photo.jpg';

    const path = uploadService.extractStoragePathFromUrl(publicUrl);
    expect(path).toBe('tenant-abc/segments/photo.jpg');
  });
});
```

### Implementation Checklist

- [ ] Verify Supabase bucket "images" is PRIVATE
- [ ] Enable RLS on "images" bucket
- [ ] Add RLS policy: `auth.uid() IS NOT NULL`
- [ ] Update all `uploadToSupabase()` calls to include `tenantId` in path
- [ ] Update deletion to verify tenant ownership
- [ ] Update tests to cover cross-tenant deletion attempts
- [ ] Run: `npm test -- upload.service.test.ts --grep "Cross-Tenant"`
- [ ] Verify in Supabase Studio that bucket is private

---

## Prevention Strategy 3: Orphaned File Cleanup

### Problem

Files remain in storage when database records are deleted, wasting quota:

```typescript
❌ VULNERABLE APPROACH
// Delete package, but photo remains in storage
await db.package.delete({ where: { id: packageId } });
// Storage now has orphaned file: `tenant-123/packages/photo.jpg`
// Quota exhausted after enough deletes
```

### Prevention Rules

**Rule 1: Cleanup Before Entity Deletion**

```typescript
✅ CORRECT - Delete file first, then entity
async deletePackage(tenantId: string, packageId: string): Promise<void> {
  const pkg = await db.package.findUnique({ where: { id: packageId } });
  if (!pkg) throw new NotFoundError();

  // Step 1: Verify tenant owns this package
  if (pkg.tenantId !== tenantId) throw new UnauthorizedError();

  // Step 2: Delete associated files
  if (pkg.photoFilename) {
    const url = `${this.baseUrl}/uploads/packages/${pkg.photoFilename}`;
    await this.uploadService.deletePackagePhoto(pkg.photoFilename);
  }

  // Step 3: Delete database record (now safe, no orphaned files)
  await db.package.delete({ where: { id: packageId } });
}
```

**Rule 2: Handle Cleanup Failures Gracefully**

```typescript
// Cleanup failures should NOT block entity deletion
async deleteSegmentImage(url: string, tenantId: string): Promise<void> {
  if (!url) return;

  try {
    // ... cleanup logic ...
  } catch (error) {
    // Log but don't throw
    logger.warn({ error, url, tenantId },
      'Error deleting segment image - continuing');
    // Caller continues (segment deletion succeeds)
  }
}
```

**Rule 3: Lazy Cleanup for Discovered Orphans**

```typescript
// Periodic job to find and delete orphaned files
async cleanupOrphanedFiles(tenantId: string): Promise<number> {
  // Find all files for tenant
  const { data: files } = await supabase.storage
    .from('images')
    .list(`${tenantId}/packages`, { limit: 1000 });

  let deletedCount = 0;

  for (const file of files || []) {
    // Check if file is referenced in database
    const referencedFile = await db.package.findFirst({
      where: {
        tenantId,
        photoFilename: file.name,
      },
    });

    if (!referencedFile) {
      // Orphaned file found
      await supabase.storage
        .from('images')
        .remove([`${tenantId}/packages/${file.name}`]);
      deletedCount++;
      logger.info({ tenantId, file: file.name }, 'Deleted orphaned file');
    }
  }

  return deletedCount;
}
```

### Test Cases to Add

```typescript
describe('Orphaned File Cleanup', () => {
  it('should delete file when package is deleted', async () => {
    const { tenantId } = await createTestTenant();
    const pkg = await createTestPackage(tenantId);

    // Upload photo
    const file = createMockFile();
    const uploadResult = await uploadService.uploadPackagePhoto(file, pkg.id, tenantId);

    // Update package with photo
    await db.package.update({
      where: { id: pkg.id },
      data: { photoUrl: uploadResult.url, photoFilename: uploadResult.filename },
    });

    // Delete package
    await packageService.deletePackage(tenantId, pkg.id);

    // Photo should be deleted from storage
    expect(uploadService.deletePackagePhotoMock).toHaveBeenCalledWith(
      expect.stringMatching(/^package-\d+-[a-f0-9]{16}\.png$/)
    );
  });

  it('should not block package deletion if cleanup fails', async () => {
    const { tenantId } = await createTestTenant();
    const pkg = await createTestPackage(tenantId);

    // Mock cleanup failure
    uploadService.deletePackagePhotoMock.mockRejectedValueOnce(new Error('Supabase unavailable'));

    // Package deletion should succeed
    await expect(packageService.deletePackage(tenantId, pkg.id)).resolves.toBeUndefined();

    // Package should be deleted despite cleanup failure
    const deleted = await db.package.findUnique({ where: { id: pkg.id } });
    expect(deleted).toBeNull();
  });

  it('should find and cleanup orphaned files', async () => {
    const { tenantId } = await createTestTenant();

    // Simulate orphaned file in storage
    await uploadService.uploadPackagePhoto(createMockFile(), 'package_orphaned', tenantId);

    // Don't create corresponding package (orphaned)

    // Run cleanup
    const deletedCount = await uploadService.cleanupOrphanedFiles(tenantId);

    expect(deletedCount).toBeGreaterThan(0);
  });
});
```

### Implementation Checklist

- [ ] Add cleanup in `deletePackage()` method
- [ ] Add cleanup in `deleteSegment()` method
- [ ] Add cleanup in `deleteTenant()` method
- [ ] Wrap cleanup in try-catch to not block deletions
- [ ] Add logging for cleanup failures
- [ ] Add `cleanupOrphanedFiles()` background job
- [ ] Test cleanup in integration tests
- [ ] Run: `npm test -- upload.service.test.ts --grep "Orphan"`

---

## Code Review Checklist

### File Validation Section

- [ ] Does validation check file content (magic bytes), not just Content-Type?
- [ ] Are all allowed MIME types documented?
- [ ] Is there special handling for SVG (text-based format)?
- [ ] Are MIME mismatches logged with SECURITY tag?
- [ ] Are rejected files NOT written to disk/storage?

### Multi-Tenant Section

- [ ] Does storage path include `${tenantId}` prefix?
- [ ] Is Supabase bucket private (not public)?
- [ ] Are signed URLs generated for file access?
- [ ] Is tenant ownership verified before deletion?
- [ ] Are cross-tenant access attempts logged?

### Cleanup Section

- [ ] Does entity deletion trigger file cleanup?
- [ ] Is cleanup wrapped in try-catch?
- [ ] Is cleanup failure logged without throwing?
- [ ] Is there a background job for orphaned files?
- [ ] Are cleanup operations scoped by tenant?

### Error Handling Section

- [ ] Do errors avoid leaking file paths?
- [ ] Are validation errors specific enough for users?
- [ ] Are SECURITY events always logged?
- [ ] Is tenant context included in logs?

### Testing Section

- [ ] Are MIME spoofing tests present?
- [ ] Are cross-tenant deletion tests present?
- [ ] Are cleanup tests present?
- [ ] Do tests cover error scenarios?
- [ ] Is coverage > 80% for upload service?

---

## Red Flags (Things That Should Never Happen)

| Red Flag                                      | Reason                            | Fix                                       |
| --------------------------------------------- | --------------------------------- | ----------------------------------------- |
| File accepted with only `file.mimetype` check | MIME header can be spoofed        | Add magic byte validation                 |
| Storage path like `logos/${filename}`         | Cross-tenant file access possible | Change to `${tenantId}/logos/${filename}` |
| Public Supabase bucket                        | Anyone can guess file paths       | Make bucket private                       |
| Delete without ownership check                | Cross-tenant deletion possible    | Verify `storagePath.startsWith(tenantId)` |
| No cleanup on entity deletion                 | Storage quota exhaustion          | Add cleanup before delete                 |
| Cleanup failure blocks deletion               | Data stuck in database            | Wrap cleanup in try-catch                 |
| Error message shows file path                 | Information disclosure            | Use generic error message                 |
| SVG files uploaded without validation         | XSS via SVG scripts               | Validate SVG is actual SVG content        |

---

## Security Testing Scenarios

### Scenario 1: MIME Spoofing Attack

**Attack:** Attacker uploads PHP shell as image

```bash
# Create PHP shell
echo '<?php system($_GET["cmd"]); ?>' > shell.php

# Upload with fake JPEG Content-Type
curl -X POST http://localhost:3001/v1/packages/upload-photo \
  -H "X-Tenant-Key: pk_live_test_123" \
  -F "file=@shell.php;type=image/jpeg"

# Expected result: REJECTED with "File validation failed"
```

**Test Expectation:**

- File rejected during validation
- Not written to disk/storage
- Error logged with SECURITY tag

### Scenario 2: Cross-Tenant Access

**Attack:** Tenant tries to access another tenant's file

```bash
# Tenant A uploads logo
curl -X POST http://localhost:3001/v1/tenant-admin/upload-logo \
  -H "X-Tenant-Key: pk_live_tenant_a_123" \
  -F "file=@logo.png"

# Response: { url: "https://xxx.supabase.co/storage/v1/object/sign/images/tenant-a/logos/logo-123.png?token=..." }

# Tenant B tries to delete it
curl -X DELETE http://localhost:3001/v1/tenant-admin/delete-file \
  -H "X-Tenant-Key: pk_live_tenant_b_456" \
  -d '{"url": "https://xxx.supabase.co/storage/v1/object/sign/images/tenant-a/logos/logo-123.png?token=..."}'

# Expected result: File NOT deleted, error logged
```

**Test Expectation:**

- Deletion blocked
- No Supabase deletion request
- Error logged with SECURITY tag

### Scenario 3: Orphaned File Prevention

**Attack:** Fill storage with orphaned files

```bash
# Upload photo
const result = await uploadService.uploadPackagePhoto(file, 'pkg_123', 'tenant_a');

// Delete package
await packageService.deletePackage('tenant_a', 'pkg_123');

// Expected: Photo file also deleted
```

**Test Expectation:**

- File deleted from storage
- No orphaned files remain

---

## Environment Configuration

### Development (Mock Mode)

```bash
ADAPTERS_PRESET=mock
# Files saved to: ./uploads/{logos,packages,segments}/
# No Supabase connection needed
# Tests run without real storage
```

### Testing with Real Storage

```bash
ADAPTERS_PRESET=real
STORAGE_MODE=supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbG...
# Tests use real Supabase but isolated test bucket
```

### Production

```bash
ADAPTERS_PRESET=real
STORAGE_MODE=supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=<from-secrets-manager>
# Production bucket, real storage
```

---

## Monitoring & Alerting

### Metrics to Track

1. **MIME Validation Rejections**
   - Count per day
   - Alert if > 10x normal (possible attack)

2. **Cross-Tenant Access Attempts**
   - Log every block attempt
   - Alert if any blocking occurs

3. **Orphaned Files**
   - Run weekly cleanup check
   - Alert if > 100 orphaned files

4. **Upload Success Rate**
   - Target: > 99%
   - Alert if < 98%

5. **Storage Usage**
   - Track per tenant
   - Alert if single tenant > 50% of quota

### Log Queries

```sql
-- Find MIME spoofing attempts (last 24h)
SELECT * FROM logs
WHERE message LIKE '%MIME type mismatch%'
AND timestamp > now() - interval '24 hours';

-- Find cross-tenant access attempts (last 7d)
SELECT * FROM logs
WHERE message LIKE '%cross-tenant%'
AND timestamp > now() - interval '7 days';

-- Find cleanup failures (last 24h)
SELECT * FROM logs
WHERE message LIKE '%Error deleting%'
AND timestamp > now() - interval '24 hours';
```

---

## Quick Reference: Implementation Steps

### Adding File Upload to New Feature

1. **Plan Phase**
   - [ ] Document allowed file types
   - [ ] Define size limits
   - [ ] Plan cleanup strategy
   - [ ] Review pre-development checklist

2. **Implementation Phase**
   - [ ] Add route that calls UploadService
   - [ ] Validate with magic bytes
   - [ ] Include tenantId in storage path
   - [ ] Add cleanup on entity deletion

3. **Testing Phase**
   - [ ] Unit tests for validation
   - [ ] Integration tests for cleanup
   - [ ] Security tests for spoofing
   - [ ] E2E test for full flow

4. **Review Phase**
   - [ ] Code review against checklist
   - [ ] Security audit
   - [ ] Manual testing

5. **Deployment Phase**
   - [ ] Verify bucket configuration
   - [ ] Test with real storage
   - [ ] Monitor for errors
   - [ ] Setup cleanup job

---

## Common Implementation Mistakes

### Mistake 1: Singleton Upload Service

```typescript
❌ WRONG
import { uploadService } from './services';

class PackageService {
  async deletePackage() {
    // Hard dependency, untestable
    await uploadService.cleanup();
  }
}

✅ CORRECT
class PackageService {
  constructor(private uploadService: UploadService) {}

  async deletePackage() {
    // Injected, testable
    await this.uploadService.cleanup();
  }
}
```

### Mistake 2: No Tenant Scoping in Path

```typescript
❌ WRONG
const path = `logos/${filename}`;

✅ CORRECT
const path = `${tenantId}/logos/${filename}`;
```

### Mistake 3: Not Handling SVG Specially

```typescript
❌ WRONG
// Magic byte detection fails for SVG (text format)
const detected = await detectFileType(file.buffer);
if (!detected) throw; // Rejects valid SVG

✅ CORRECT
if (file.mimetype === 'image/svg+xml') {
  // Check for actual SVG content
  const content = file.buffer.toString('utf8', 0, 500);
  if (!content.includes('<svg')) throw;
  return; // Valid SVG
}
```

### Mistake 4: Cleanup Blocks Deletion

```typescript
❌ WRONG
async deletePackage() {
  await this.uploadService.cleanup(); // Throws if storage down
  await db.package.delete(); // Never reached
}

✅ CORRECT
async deletePackage() {
  try {
    await this.uploadService.cleanup();
  } catch (error) {
    logger.warn('Cleanup failed, continuing...');
    // Continue with deletion
  }
  await db.package.delete();
}
```

---

## Testing Command Reference

```bash
# Run all upload tests
npm test -- upload.service.test.ts

# Run specific test
npm test -- upload.service.test.ts --grep "MIME Type Spoofing"

# Run with coverage
npm test -- upload.service.test.ts --coverage

# Run in watch mode
npm test -- upload.service.test.ts --watch

# Run E2E tests
npm run test:e2e -- upload.spec.ts

# Start in mock mode
ADAPTERS_PRESET=mock npm run dev:api

# Test MIME spoofing manually
curl -X POST http://localhost:3001/v1/packages/upload-photo \
  -H "X-Tenant-Key: pk_live_test_123" \
  -F "file=@shell.php;type=image/jpeg"
```

---

## Related Documentation

- **FILE_UPLOAD_QUICK_REFERENCE.md** - One-page cheat sheet
- **FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md** - Architecture & patterns
- **CLAUDE.md** - Project conventions
- **upload.service.ts** - Implementation reference
- **upload.service.test.ts** - Comprehensive test examples

---

## Summary: The 7 Prevention Rules

1. **Validate file content with magic bytes** - not just Content-Type header
2. **Use private buckets with signed URLs** - not public file paths
3. **Include tenantId in storage paths** - for isolation
4. **Verify tenant ownership before deletion** - prevent cross-tenant access
5. **Cleanup files when entity is deleted** - prevent orphaned files
6. **Handle cleanup failures gracefully** - don't block entity deletion
7. **Log security events** - MIME mismatches, cross-tenant attempts, etc.

**Follow these 7 rules and your file uploads will be secure.**

---

**Last Updated:** November 29, 2025
**Status:** Ready for Production
**Owner:** Engineering Team
