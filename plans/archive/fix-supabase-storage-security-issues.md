# Fix Supabase Storage Security Issues

## Overview

This plan addresses **3 critical security vulnerabilities** in the Supabase Storage file upload implementation. Following code review feedback, this is a **minimal, focused plan** that fixes actual security issues without unnecessary architectural refactoring.

**Total Effort:** 6-7 hours (1 day focused development)

## Problem Statement

The current file upload implementation has three critical security vulnerabilities that **must be fixed before production deployment**:

1. **Cross-Tenant Data Leakage**: Public Supabase bucket allows any user to access any tenant's images by guessing the URL structure (`/storage/v1/object/public/images/tenant-123/segments/data.jpg`)
2. **Malicious File Upload**: MIME type validation trusts client headers, allowing PHP shells disguised as `image/jpeg` to be uploaded
3. **Storage Bloat & GDPR Violation**: Deleting segments leaves orphaned files in storage indefinitely

## Proposed Solution

### Architecture

Keep the existing `UploadService` singleton pattern. Add security hardening without architectural changes:

```
┌─────────────────────────────────────────────────────────────────┐
│                        tenant-admin.routes.ts                    │
│  POST /segment-image → multer → ipRateLimit → handler           │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UploadService (existing singleton)            │
│  • uploadLogo(), uploadPackagePhoto(), uploadSegmentImage()     │
│  • NEW: validateFile() with magic byte detection                │
│  • NEW: deleteSegmentImage() for cleanup                        │
│  • Generates signed URLs (1-year expiry) instead of public URLs │
└─────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        Mock Mode (filesystem)          Real Mode (Supabase)
        if (this.isRealMode)            Private bucket + signed URLs
```

### Implementation Tasks

#### Task 1: Magic Byte Validation (1 hour)

**Problem:** Current `validateFile()` trusts client-provided MIME type headers. An attacker can upload `shell.php` with `Content-Type: image/jpeg`.

**Solution:** Use `file-type` package to detect actual file content via magic bytes.

**Steps:**

- [ ] Install `file-type` package: `npm install file-type --workspace=server`
- [ ] Update `validateFile()` to be async and call `fileTypeFromBuffer()`
- [ ] Compare detected MIME type against declared MIME type
- [ ] Log warnings for mismatches (security audit trail)
- [ ] Use generic error message (don't reveal detection mechanism)

**File:** `server/src/services/upload.service.ts`

```typescript
import { fileTypeFromBuffer } from 'file-type';

private async validateFile(file: UploadedFile, maxSizeMB?: number): Promise<void> {
  // Existing size check
  const maxSize = maxSizeMB || this.maxFileSizeMB;
  const maxSizeBytes = maxSize * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(`File size exceeds maximum of ${maxSize}MB`);
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw new Error('File buffer is empty');
  }

  // Check declared MIME type (basic filter)
  if (!this.allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(`Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
  }

  // CRITICAL: Verify actual file content via magic bytes
  const detectedType = await fileTypeFromBuffer(file.buffer);

  if (!detectedType) {
    logger.warn({ declaredType: file.mimetype, filename: file.originalname },
      'Could not detect file type from magic bytes');
    throw new Error('Unable to verify file type. File may be corrupted.');
  }

  if (!this.allowedMimeTypes.includes(detectedType.mime)) {
    logger.warn({ declared: file.mimetype, detected: detectedType.mime, filename: file.originalname },
      'SECURITY: MIME type mismatch detected - possible spoofing attempt');
    throw new Error('File validation failed'); // Generic message
  }
}
```

**Update all upload methods to await validation:**

```typescript
async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
  await this.validateFile(file, 2); // Now async
  // ... rest unchanged
}
```

**Tests to add:** `server/test/services/upload.service.test.ts`

- [ ] PHP file with fake `image/jpeg` header is rejected
- [ ] Valid JPEG with correct header is accepted
- [ ] PNG file with fake `image/jpeg` header is rejected
- [ ] Empty buffer is rejected
- [ ] File exceeding size limit is rejected

---

#### Task 2: Private Bucket + Signed URLs (2-3 hours)

**Problem:** Supabase bucket is public. Anyone can access any tenant's images by guessing URLs.

**Solution:** Change bucket to private, generate signed URLs with 1-year expiry.

**Steps:**

**2a. Supabase Dashboard Configuration:**

- [ ] Go to Supabase Dashboard → Storage → `images` bucket
- [ ] Change bucket from "Public" to "Private"
- [ ] Note: RLS policies are optional since we use service role key (application-level enforcement)

**2b. Update uploadToSupabase() to generate signed URLs:**

**File:** `server/src/services/upload.service.ts`

```typescript
private async uploadToSupabase(
  tenantId: string,
  folder: 'logos' | 'packages' | 'segments',
  filename: string,
  file: UploadedFile
): Promise<UploadResult> {
  const supabase = this.getSupabaseClient();
  const storagePath = `${tenantId}/${folder}/${filename}`;

  const { error } = await supabase.storage
    .from('images')
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    logger.error({ tenantId, folder, error: error.message }, 'Supabase upload failed');
    throw new Error('Failed to upload image to storage');
  }

  // Generate signed URL with 1-year expiry
  const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('images')
    .createSignedUrl(storagePath, ONE_YEAR_SECONDS);

  if (signedUrlError || !signedUrlData) {
    logger.error({ tenantId, folder, error: signedUrlError }, 'Failed to create signed URL');
    throw new Error('Failed to generate access URL');
  }

  logger.info({ tenantId, folder, filename, size: file.size }, 'File uploaded with signed URL');

  return {
    url: signedUrlData.signedUrl,
    filename,
    size: file.size,
    mimetype: file.mimetype,
  };
}
```

**2c. Migration script for existing URLs:**

**File:** `server/scripts/migrate-to-signed-urls.ts` (new file)

```typescript
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

async function migrateToSignedUrls() {
  console.log('Starting URL migration...');

  // Migrate segment heroImages
  const segments = await prisma.segment.findMany({
    where: { heroImage: { not: null } },
    select: { id: true, tenantId: true, heroImage: true },
  });

  console.log(`Found ${segments.length} segments with images`);

  let success = 0;
  let failed = 0;

  for (const segment of segments) {
    try {
      const storagePath = extractStoragePath(segment.heroImage!);

      const { data, error } = await supabase.storage
        .from('images')
        .createSignedUrl(storagePath, ONE_YEAR_SECONDS);

      if (error || !data) {
        console.error(`Failed for segment ${segment.id}:`, error);
        failed++;
        continue;
      }

      await prisma.segment.update({
        where: { id: segment.id },
        data: { heroImage: data.signedUrl },
      });

      success++;
      console.log(`✓ Migrated segment ${segment.id}`);
    } catch (err) {
      console.error(`Error migrating segment ${segment.id}:`, err);
      failed++;
    }
  }

  // TODO: Add similar migration for Package photos if needed

  console.log(`\nMigration complete: ${success} success, ${failed} failed`);
}

function extractStoragePath(url: string): string {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  const bucketIndex = pathParts.indexOf('images');
  if (bucketIndex === -1) throw new Error(`Invalid storage URL: ${url}`);
  return pathParts.slice(bucketIndex + 1).join('/');
}

migrateToSignedUrls()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Run migration:**

```bash
# After changing bucket to private
cd server
npx tsx scripts/migrate-to-signed-urls.ts
```

---

#### Task 3: Orphaned File Cleanup (1 hour)

**Problem:** Deleting segments leaves heroImage files in Supabase Storage indefinitely.

**Solution:** Add `deleteSegmentImage()` method and call it from segment deletion.

**Steps:**

**3a. Add delete method to UploadService:**

**File:** `server/src/services/upload.service.ts`

```typescript
/**
 * Delete segment hero image from storage
 * Validates tenant ownership before deletion
 */
async deleteSegmentImage(url: string, tenantId: string): Promise<void> {
  if (!url) return;

  try {
    if (this.isRealMode && url.includes('supabase')) {
      const storagePath = this.extractStoragePathFromUrl(url);

      // SECURITY: Verify tenant owns this file
      if (!storagePath.startsWith(`${tenantId}/`)) {
        logger.error({ tenantId, storagePath, url },
          'SECURITY: Attempted cross-tenant file deletion blocked');
        return; // Don't throw - just block and log
      }

      const supabase = this.getSupabaseClient();
      const { error } = await supabase.storage
        .from('images')
        .remove([storagePath]);

      if (error) {
        logger.warn({ error: error.message, storagePath },
          'Supabase delete failed - file may already be deleted');
      } else {
        logger.info({ tenantId, storagePath }, 'Segment image deleted from storage');
      }
    } else {
      // Mock mode: delete from local filesystem
      const filename = path.basename(new URL(url).pathname);
      const filepath = path.join(this.segmentImageUploadDir, filename);
      if (fs.existsSync(filepath)) {
        await fs.promises.unlink(filepath);
        logger.info({ filename }, 'Segment image deleted from local storage');
      }
    }
  } catch (error) {
    logger.warn({ error, url, tenantId }, 'Error deleting segment image - continuing');
    // Don't throw - cleanup failures shouldn't block segment deletion
  }
}

private extractStoragePathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const bucketIndex = pathParts.indexOf('images');
    if (bucketIndex === -1) throw new Error('Invalid storage URL format');
    return pathParts.slice(bucketIndex + 1).join('/');
  } catch (error) {
    logger.error({ url, error }, 'Failed to extract storage path from URL');
    throw new Error('Invalid storage URL format');
  }
}
```

**3b. Wire cleanup into segment deletion:**

**File:** `server/src/services/segment.service.ts`

```typescript
import { uploadService } from './upload.service';

async deleteSegment(tenantId: string, id: string): Promise<void> {
  const existing = await this.repository.findById(tenantId, id);
  if (!existing) {
    throw new NotFoundError(`Segment not found: ${id}`);
  }

  // Clean up heroImage BEFORE deleting segment from database
  if (existing.heroImage) {
    try {
      await uploadService.deleteSegmentImage(existing.heroImage, tenantId);
    } catch (err) {
      logger.warn({ err, heroImage: existing.heroImage, segmentId: id },
        'Failed to delete segment image - continuing with segment deletion');
    }
  }

  await this.repository.delete(tenantId, id);
  logger.info({ tenantId, segmentId: id }, 'Segment deleted with image cleanup');
}
```

**Tests to add:**

- [ ] Deleting segment with heroImage removes file from storage
- [ ] Deleting segment without heroImage succeeds
- [ ] Cross-tenant deletion attempt is blocked and logged
- [ ] Cleanup failure doesn't block segment deletion

---

#### Task 4: Frontend Cleanup (30 minutes)

**Problem:** `ImageUploadField.tsx` has 7 unnecessary `useCallback` wrappers adding ~50 lines of boilerplate.

**Solution:** Remove useCallback wrappers, use regular functions.

**File:** `client/src/components/ImageUploadField.tsx`

```typescript
// BEFORE (example)
const handleDrop = useCallback(
  (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  },
  [handleFileSelect]
);

// AFTER
function handleDrop(e: React.DragEvent) {
  e.preventDefault();
  setIsDragging(false);
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelect(file);
}
```

**Steps:**

- [ ] Remove all `useCallback` imports and wrappers
- [ ] Convert to regular function declarations
- [ ] Remove dependency arrays
- [ ] Verify drag/drop, click upload, and remove all work

---

## Acceptance Criteria

### Security Requirements (Must Pass)

- [ ] PHP file with `Content-Type: image/jpeg` is rejected
- [ ] PNG file with `Content-Type: image/jpeg` header is rejected
- [ ] Valid JPEG with correct header is accepted
- [ ] Direct public bucket URL access returns 403 Forbidden
- [ ] Signed URLs work for image access
- [ ] Deleting segment removes heroImage from Supabase Storage
- [ ] Cross-tenant file deletion attempt is blocked and logged

### Functional Requirements

- [ ] All existing upload functionality works unchanged
- [ ] Migration script successfully converts existing URLs
- [ ] Frontend drag/drop and click upload still work

### Quality Gates

- [ ] All 771+ existing server tests pass
- [ ] New security tests for MIME spoofing (minimum 5 test cases)
- [ ] E2E test for upload → delete → verify cleanup flow

---

## Implementation Order

1. **Task 1: Magic Byte Validation** (1 hour) - No dependencies, quick security win
2. **Task 2: Private Bucket + Signed URLs** (2-3 hours) - Critical data leak fix
3. **Task 3: Orphaned File Cleanup** (1 hour) - GDPR compliance
4. **Task 4: Migration Script** (1-2 hours) - Required before going live
5. **Task 5: Frontend Cleanup** (30 min) - Nice to have, do if time permits

**Total: 6-7 hours**

---

## Risk Analysis

| Risk                              | Likelihood | Impact | Mitigation                                              |
| --------------------------------- | ---------- | ------ | ------------------------------------------------------- |
| Breaking existing image URLs      | HIGH       | MEDIUM | Run migration script BEFORE changing bucket to private  |
| False positive MIME rejection     | LOW        | LOW    | `file-type` is mature; test thoroughly with real images |
| Migration script partial failure  | MEDIUM     | MEDIUM | Script logs failures; can re-run for failed items       |
| Cleanup failure blocking deletion | LOW        | LOW    | Cleanup is wrapped in try/catch, failures logged only   |

---

## Deferred Items (Future Consideration)

The following items were considered but deferred based on code review feedback:

| Item                                 | Reason for Deferral                       | When to Revisit                       |
| ------------------------------------ | ----------------------------------------- | ------------------------------------- |
| StorageProvider DI interface         | YAGNI - no second storage provider exists | When/if S3 or R2 support is needed    |
| Code deduplication (CATEGORY_CONFIG) | Current duplication is minor and readable | When adding 4th upload type           |
| Tenant-scoped rate limiting          | IP-based limiting is sufficient for MVP   | Post-launch if abuse patterns emerge  |
| Memory concurrency limiter           | Theoretical problem at current scale      | If memory issues appear in monitoring |
| Signed URL refresh endpoint          | 1-year expiry is sufficient               | If shorter expiry is needed later     |

---

## Files Modified

| File                                          | Changes                                                      |
| --------------------------------------------- | ------------------------------------------------------------ |
| `server/src/services/upload.service.ts`       | Add magic byte validation, signed URLs, deleteSegmentImage() |
| `server/src/services/segment.service.ts`      | Add cleanup call in deleteSegment()                          |
| `server/test/services/upload.service.test.ts` | Add MIME spoofing security tests                             |
| `server/scripts/migrate-to-signed-urls.ts`    | New migration script                                         |
| `client/src/components/ImageUploadField.tsx`  | Remove useCallback wrappers                                  |

---

## References

### Internal

- Todo files: `todos/062-064-*.md` (P1 issue details)
- Code review: `docs/solutions/code-review-patterns/supabase-storage-upload-review.md`
- Upload service: `server/src/services/upload.service.ts`

### External

- [file-type npm package](https://www.npmjs.com/package/file-type)
- [Supabase Storage Signed URLs](https://supabase.com/docs/guides/storage/serving/downloads)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

---

_Simplified plan based on code review feedback. Original 8-task plan reduced to 4 essential tasks._
