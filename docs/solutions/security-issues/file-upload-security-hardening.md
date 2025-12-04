---
title: 'File Upload Security Hardening: MIME Spoofing, Cross-Tenant Leaks, and Orphaned Files'
slug: file-upload-security-hardening
category: security-issues
severity: critical
component: upload-service
symptoms:
  - 'MIME type validation bypass allowing PHP shells disguised as images'
  - 'Public Supabase bucket URLs expose cross-tenant image access'
  - 'Segment deletion orphans files indefinitely with no cleanup mechanism'
  - 'Attackers can enumerate tenant IDs to access competitor data'
  - 'Storage costs grow unbounded with no reclamation mechanism'
root_cause: 'Three independent security gaps in file upload implementation: (1) client-provided MIME types trusted without magic byte verification, (2) public bucket configuration allowing URL-based enumeration attacks, (3) missing cleanup logic when database records are deleted'
solution_type: implementation
date_solved: 2025-11-29
files_changed:
  - server/src/services/upload.service.ts
  - server/src/services/segment.service.ts
  - server/test/services/upload.service.test.ts
  - server/test/http/tenant-admin-photos.test.ts
  - server/vitest.config.ts
  - client/src/components/ImageUploadField.tsx
tests_added: 15
tests_passing: 841
tags:
  - security
  - file-upload
  - mime-type-validation
  - multi-tenant-isolation
  - supabase-storage
  - magic-bytes
  - signed-urls
  - orphan-cleanup
  - owasp
---

# File Upload Security Hardening

## Problem Statement

The file upload implementation had three critical security vulnerabilities that could lead to remote code execution, data leakage, and unbounded storage costs:

### Vulnerability 1: MIME Type Spoofing (CWE-434)

**Attack Vector:** Attacker uploads a PHP shell with a fake `Content-Type: image/jpeg` header. The server trusts the declared MIME type without verifying actual file content.

```bash
# Attack example
curl -X POST /v1/tenant-admin/segments/hero-image \
  -H "Content-Type: multipart/form-data" \
  -F "image=@shell.php;type=image/jpeg"
```

**Risk:** Remote code execution if files are served from an executable context.

### Vulnerability 2: Cross-Tenant Data Leak (CWE-284)

**Attack Vector:** Public Supabase bucket URLs follow predictable patterns. Attacker enumerates tenant IDs to access competitors' images.

```
# Predictable URL pattern
https://xxx.supabase.co/storage/v1/object/public/images/tenant-abc/segments/photo.jpg
https://xxx.supabase.co/storage/v1/object/public/images/tenant-xyz/segments/photo.jpg  # Guessed!
```

**Risk:** Exposure of confidential business imagery across tenants.

### Vulnerability 3: Orphaned Files (Storage Leak)

**Attack Vector:** Deleting a segment removes the database record but leaves the file in storage. Files accumulate indefinitely.

**Risk:** Unbounded storage costs; potential data retention compliance violations.

---

## Solution: Defense in Depth

Three independent security layers implemented to address each vulnerability:

### Layer 1: Magic Byte Validation

**File:** `server/src/services/upload.service.ts:102-162`

Validates actual file content using magic bytes, not just the declared MIME type:

```typescript
import { fromBuffer as detectFileType } from 'file-type';

private async validateFile(file: UploadedFile, maxSizeMB?: number): Promise<void> {
  // ... size and buffer checks ...

  // CRITICAL: Verify actual file content via magic bytes
  const detectedType = await detectFileType(file.buffer);

  // SVG files don't have magic bytes (they're XML text)
  if (file.mimetype === 'image/svg+xml') {
    const content = file.buffer.toString('utf8', 0, 500).trim();
    const isSvg = content.startsWith('<?xml') || content.startsWith('<svg') ||
                  content.toLowerCase().includes('<svg');
    if (!isSvg) {
      logger.warn({ declaredType: file.mimetype, filename: file.originalname },
        'SECURITY: File claimed to be SVG but does not contain valid SVG content');
      throw new Error('File validation failed');
    }
    return;
  }

  if (!detectedType) {
    throw new Error('Unable to verify file type. File may be corrupted.');
  }

  if (!this.allowedMimeTypes.includes(detectedType.mime)) {
    logger.warn({ declared: file.mimetype, detected: detectedType.mime },
      'SECURITY: MIME type mismatch detected - possible spoofing attempt');
    throw new Error('File validation failed');
  }

  // Verify detected type matches declared type (defense in depth)
  const normalizedDeclared = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
  const normalizedDetected = detectedType.mime === 'image/jpg' ? 'image/jpeg' : detectedType.mime;
  if (normalizedDetected !== normalizedDeclared) {
    throw new Error('File validation failed');
  }
}
```

**Magic Bytes Reference:**
| Format | Magic Bytes (Hex) |
|--------|-------------------|
| PNG | `89 50 4E 47 0D 0A 1A 0A` |
| JPEG | `FF D8 FF E0` or `FF D8 FF E1` |
| WebP | `52 49 46 46 ... 57 45 42 50` |
| SVG | Text-based (content inspection) |

### Layer 2: Signed URLs with Private Bucket

**File:** `server/src/services/upload.service.ts:181-225`

Changed from public URLs to cryptographically signed URLs:

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

  if (error) throw new Error('Failed to upload image to storage');

  // Generate signed URL with 1-year expiry for private bucket
  const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('images')
    .createSignedUrl(storagePath, ONE_YEAR_SECONDS);

  if (signedUrlError || !signedUrlData) {
    throw new Error('Failed to generate access URL');
  }

  return {
    url: signedUrlData.signedUrl,  // Includes token parameter
    filename,
    size: file.size,
    mimetype: file.mimetype,
  };
}
```

**URL Format Change:**

```
# Before (public, enumerable)
https://xxx.supabase.co/storage/v1/object/public/images/tenant-abc/segments/photo.jpg

# After (signed, non-enumerable)
https://xxx.supabase.co/storage/v1/object/sign/images/tenant-abc/segments/photo.jpg?token=abc123...
```

### Layer 3: Orphaned File Cleanup

**Files:**

- `server/src/services/upload.service.ts:432-470` (delete method)
- `server/src/services/segment.service.ts:259-285` (integration)

Automatic cleanup when database records are deleted:

```typescript
// upload.service.ts
async deleteSegmentImage(url: string, tenantId: string): Promise<void> {
  if (!url) return;

  try {
    if (this.isRealMode && url.includes('supabase')) {
      const storagePath = this.extractStoragePathFromUrl(url);

      // SECURITY: Verify tenant owns this file before deletion
      if (!storagePath.startsWith(`${tenantId}/`)) {
        logger.error({ tenantId, storagePath, url },
          'SECURITY: Attempted cross-tenant file deletion blocked');
        return; // Don't throw - just block and log
      }

      const supabase = this.getSupabaseClient();
      await supabase.storage.from('images').remove([storagePath]);
    } else {
      // Mock mode: delete from local filesystem
      const filename = path.basename(new URL(url).pathname);
      const filepath = path.join(this.segmentImageUploadDir, filename);
      if (fs.existsSync(filepath)) {
        await fs.promises.unlink(filepath);
      }
    }
  } catch (error) {
    // Don't throw - cleanup failures shouldn't block segment deletion
    logger.warn({ error, url, tenantId }, 'Error deleting segment image - continuing');
  }
}
```

```typescript
// segment.service.ts
async deleteSegment(tenantId: string, id: string): Promise<void> {
  const existing = await this.repository.findById(tenantId, id);
  if (!existing) {
    throw new NotFoundError(`Segment not found or access denied: ${id}`);
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
  this.invalidateSegmentCache(tenantId, existing.slug);
}
```

---

## Implementation Details

### Package Added

```bash
npm install file-type@16  # v16 for CJS compatibility
```

Note: `file-type` v17+ is ESM-only and requires different import handling.

### Environment Variable

Added `STORAGE_MODE` for test isolation:

```typescript
// Determine storage mode
this.isRealMode =
  process.env.STORAGE_MODE === 'supabase' ||
  (process.env.ADAPTERS_PRESET === 'real' &&
    !!process.env.SUPABASE_URL &&
    process.env.STORAGE_MODE !== 'local');
```

```typescript
// vitest.config.ts - Force local storage in tests
env: { ...env, STORAGE_MODE: 'local' },
```

### Migration Script

Created `server/scripts/migrate-to-signed-urls.ts` for existing data migration.

---

## Verification

### Test Results

```
Test Files  47 passed (47)
     Tests  841 passed | 6 skipped (847)
```

### Security Tests Added

| Test Case                                  | Result     |
| ------------------------------------------ | ---------- |
| PHP file with fake image/jpeg header       | Rejected   |
| Plain text file with fake image/png header | Rejected   |
| PNG file claiming to be JPEG               | Rejected   |
| JPEG file claiming to be PNG               | Rejected   |
| Valid JPEG with correct Content-Type       | Accepted   |
| Cross-tenant deletion attempt              | Blocked    |
| Cleanup on segment deletion                | Successful |

---

## Prevention Strategies

### Code Review Checklist

- [ ] Magic byte validation present (not just MIME type check)
- [ ] TenantId included in storage path
- [ ] Signed URLs generated (not public URLs)
- [ ] Ownership verified before file deletion
- [ ] Cleanup wrapped in try-catch (non-blocking)
- [ ] MIME mismatches logged with `SECURITY:` prefix

### Red Flags to Watch For

| Pattern                                    | Risk                | Fix                       |
| ------------------------------------------ | ------------------- | ------------------------- |
| `file.mimetype` without `detectFileType()` | MIME spoofing       | Add magic byte validation |
| `getPublicUrl()` in multi-tenant app       | Data leak           | Use `createSignedUrl()`   |
| Delete entity without file cleanup         | Orphaned files      | Add cleanup before delete |
| Storage path without `tenantId/` prefix    | Cross-tenant access | Prefix with tenant ID     |

---

## Related Documentation

- [FILE_UPLOAD_PREVENTION_GUIDE.md](../FILE_UPLOAD_PREVENTION_GUIDE.md) - Comprehensive prevention strategies
- [FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md](../FILE_UPLOAD_IMPLEMENTATION_PATTERNS.md) - Implementation patterns
- [UPLOAD_SECURITY_INDEX.md](../UPLOAD_SECURITY_INDEX.md) - Navigation hub
- [plans/fix-supabase-storage-security-issues.md](/plans/fix-supabase-storage-security-issues.md) - Original plan

## OWASP References

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- CWE-434: Unrestricted Upload of File with Dangerous Type
- CWE-284: Improper Access Control
- OWASP A4:2021 Insecure Design
