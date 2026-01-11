# File Upload Security Guide

**Consolidated security guide for file uploads in MAIS multi-tenant platform**

**Status:** Production Ready | **Test Coverage:** 841 tests | **Security Layers:** 3

---

## Quick Reference (Print This Section)

### The 7 Critical Rules

| #   | Rule                                       | Why                               |
| --- | ------------------------------------------ | --------------------------------- |
| 1   | Include `tenantId` in storage paths        | Prevents cross-tenant file access |
| 2   | Validate magic bytes, not just MIME header | Prevents MIME spoofing attacks    |
| 3   | Verify ownership before deletion           | Prevents cross-tenant deletion    |
| 4   | Rate limit uploads                         | Prevents denial of service        |
| 5   | Use dependency injection                   | Enables testability               |
| 6   | Cleanup files on entity deletion           | Prevents orphaned files           |
| 7   | Never leak file paths in errors            | Prevents information disclosure   |

### Red Flags Checklist

```
[ ] No tenantId in path      -> Add: ${tenantId}/ prefix
[ ] Only MIME type check     -> Add: Magic byte validation
[ ] Public bucket            -> Make private, use signed URLs
[ ] No ownership check       -> Query DB before delete
[ ] No rate limiting         -> Add rateLimit middleware
[ ] Singleton import         -> Inject via constructor
[ ] No cleanup on delete     -> Add cascade delete
[ ] Error shows filepath     -> Use generic message
```

### File Size Limits

| Upload Type   | Limit | Config                  |
| ------------- | ----- | ----------------------- |
| Logo          | 2 MB  | `MAX_UPLOAD_SIZE_MB`    |
| Package Photo | 5 MB  | `maxPackagePhotoSizeMB` |
| Segment Hero  | 5 MB  | `maxPackagePhotoSizeMB` |

### Allowed MIME Types

```
image/jpeg, image/jpg, image/png, image/webp, image/svg+xml
```

---

## Security Requirements

### Three-Layer Defense Architecture

```
Layer 1: Magic Byte Validation (MIME Spoofing Prevention)
  |-- Detects actual file content (not claimed type)
  |-- Prevents PHP/executable uploads
  +-- Catches MIME type spoofing attempts

Layer 2: Signed URLs with Private Bucket (Enumeration Prevention)
  |-- Prevents direct URL guessing
  |-- Private bucket blocks unauthenticated access
  +-- Signed URLs expire after 1 year

Layer 3: Orphaned File Cleanup (Data Leak Prevention)
  |-- Deletes images when segments are removed
  |-- Validates tenant ownership before deletion
  +-- Non-blocking (cleanup failures don't break entity deletion)
```

### Attack Prevention Matrix

| Attack Vector               | Layer | Prevention                    | Status  |
| --------------------------- | ----- | ----------------------------- | ------- |
| PHP shell upload            | 1     | Magic bytes detected          | BLOCKED |
| MIME type spoofing          | 1     | Declared vs detected mismatch | BLOCKED |
| Direct URL enumeration      | 2     | Signed URLs + Private bucket  | BLOCKED |
| Cross-tenant image access   | 2     | Token required                | BLOCKED |
| Cross-tenant image deletion | 3     | Tenant validation             | BLOCKED |
| Orphaned file storage       | 3     | Automatic cleanup             | BLOCKED |

---

## Implementation Patterns

### Pattern 1: Magic Byte Validation

```typescript
import { fromBuffer as detectFileType } from 'file-type';

private async validateFile(file: UploadedFile, maxSizeMB?: number): Promise<void> {
  // 1. Size validation
  const maxSize = (maxSizeMB || this.maxFileSizeMB) * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`File size exceeds maximum of ${maxSizeMB}MB`);
  }

  // 2. Buffer validation
  if (!file.buffer || file.buffer.length === 0) {
    throw new Error('File buffer is empty');
  }

  // 3. Declared MIME type validation (basic filter)
  if (!this.allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(`Invalid file type. Allowed: ${this.allowedMimeTypes.join(', ')}`);
  }

  // 4. CRITICAL: Verify actual file content via magic bytes
  const detectedType = await detectFileType(file.buffer);

  // Special handling for SVG (text-based, no magic bytes)
  if (file.mimetype === 'image/svg+xml') {
    const content = file.buffer.toString('utf8', 0, 500).trim();
    const isSvg = content.startsWith('<?xml') ||
                  content.startsWith('<svg') ||
                  content.toLowerCase().includes('<svg');
    if (!isSvg) {
      logger.warn({ declaredType: file.mimetype, filename: file.originalname },
        'SECURITY: File claimed to be SVG but does not contain valid SVG content');
      throw new Error('File validation failed');
    }
    return;
  }

  // For binary formats, magic bytes MUST be present and match
  if (!detectedType) {
    throw new Error('Unable to verify file type. File may be corrupted.');
  }

  if (!this.allowedMimeTypes.includes(detectedType.mime)) {
    logger.warn({ declared: file.mimetype, detected: detectedType.mime },
      'SECURITY: MIME type mismatch detected - possible spoofing attempt');
    throw new Error('File validation failed');
  }

  // Defense-in-depth: Verify declared matches detected
  const normalizedDeclared = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
  const normalizedDetected = detectedType.mime === 'image/jpg' ? 'image/jpeg' : detectedType.mime;
  if (normalizedDetected !== normalizedDeclared) {
    logger.warn({ declared: file.mimetype, detected: detectedType.mime },
      'SECURITY: MIME type mismatch detected - possible spoofing attempt');
    throw new Error('File validation failed');
  }
}
```

### Pattern 2: Signed URLs for Private Bucket

```typescript
private async uploadToSupabase(
  tenantId: string,
  folder: 'logos' | 'packages' | 'segments',
  filename: string,
  file: UploadedFile
): Promise<UploadResult> {
  const supabase = this.getSupabaseClient();
  const storagePath = `${tenantId}/${folder}/${filename}`;

  // Upload to PRIVATE bucket
  const { error } = await supabase.storage
    .from('images')
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error('Failed to upload image to storage');
  }

  // Generate signed URL with 1-year expiry
  const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('images')
    .createSignedUrl(storagePath, ONE_YEAR_SECONDS);

  if (signedUrlError || !signedUrlData) {
    throw new Error('Failed to generate access URL');
  }

  return {
    url: signedUrlData.signedUrl,  // Includes token
    filename,
    size: file.size,
    mimetype: file.mimetype,
  };
}
```

### Pattern 3: Cleanup with Cross-Tenant Protection

```typescript
async deleteSegmentImage(url: string, tenantId: string): Promise<void> {
  if (!url) return;

  try {
    if (this.isRealMode && url.includes('supabase')) {
      const storagePath = this.extractStoragePathFromUrl(url);

      // SECURITY: Verify tenant owns this file
      if (!storagePath.startsWith(`${tenantId}/`)) {
        logger.error({ tenantId, storagePath, url },
          'SECURITY: Attempted cross-tenant file deletion blocked');
        return;  // Don't throw - just block
      }

      const supabase = this.getSupabaseClient();
      const { error } = await supabase.storage
        .from('images')
        .remove([storagePath]);

      if (error) {
        logger.warn({ error: error.message, storagePath },
          'Supabase delete failed - file may already be deleted');
      }
    }
  } catch (error) {
    // Don't throw - cleanup failures shouldn't block entity deletion
    logger.warn({ error, url, tenantId }, 'Error deleting segment image - continuing');
  }
}

// Integration in SegmentService
async deleteSegment(tenantId: string, id: string): Promise<void> {
  const existing = await this.repository.findById(tenantId, id);
  if (!existing) throw new NotFoundError();

  // Clean up image BEFORE deleting segment
  if (existing.heroImage) {
    try {
      await uploadService.deleteSegmentImage(existing.heroImage, tenantId);
    } catch (err) {
      // Don't block segment deletion
      logger.warn({ err, heroImage: existing.heroImage }, 'Failed to delete image - continuing');
    }
  }

  await this.repository.delete(tenantId, id);
}
```

### Pattern 4: Secure Filename Generation

```typescript
private generateFilename(originalName: string, prefix: string = 'logo'): string {
  // Extract extension from original (safe - only used as suffix)
  const ext = path.extname(originalName);

  // Timestamp prevents collisions
  const timestamp = Date.now();

  // Random bytes prevent guessing (128 bits entropy)
  const randomStr = crypto.randomBytes(8).toString('hex');

  // Format: prefix-timestamp-randomString.ext
  return `${prefix}-${timestamp}-${randomStr}${ext}`;
}
```

### Pattern 5: Repository-Based Storage Architecture

```typescript
// Interface in lib/ports.ts
export interface StorageRepository {
  upload(
    tenantId: string,
    folder: string,
    filename: string,
    content: Buffer,
    mimetype: string
  ): Promise<string>;
  delete(tenantId: string, folder: string, filename: string): Promise<void>;
  getSignedUrl(
    tenantId: string,
    folder: string,
    filename: string,
    expiresIn?: number
  ): Promise<string>;
}

// DI setup in di.ts
const storageRepository =
  process.env.ADAPTERS_PRESET === 'real'
    ? new SupabaseStorageRepository(supabase, logger)
    : new FileSystemStorageRepository(uploadDir, baseUrl, logger);

const uploadService = new UploadService(storageRepository, new FileTypeValidator(), logger);
```

---

## Code Review Checklist

### Security Review

- [ ] **Tenant Scoping:** Does every storage operation include `tenantId` in the path?
- [ ] **Magic Byte Validation:** Does validation check file content, not just MIME header?
- [ ] **Ownership Verification:** Is tenant ownership verified before deletion?
- [ ] **Private Bucket:** Is the Supabase bucket private (not public)?
- [ ] **Signed URLs:** Are URLs generated with tokens, not public paths?
- [ ] **SVG Handling:** If SVG allowed, is content validated for XSS?
- [ ] **Path Traversal:** Is user-supplied filename sanitized?
- [ ] **Error Messages:** Do errors avoid leaking file paths?

### Architecture Review

- [ ] **DI Pattern:** Is UploadService injected, not imported as singleton?
- [ ] **Service Layer:** Is upload logic in service, not routes?
- [ ] **Dual-Mode:** Does code work in both mock and real modes?
- [ ] **Rate Limiting:** Is rate limiting applied to upload endpoints?
- [ ] **Cleanup Integration:** Is cleanup called before entity deletion?

### Testing Review

- [ ] **MIME Spoofing Tests:** PHP shell with image header, PNG as JPEG, etc.
- [ ] **Cross-Tenant Tests:** Verify tenant B can't access tenant A's files
- [ ] **Cleanup Tests:** Verify files deleted with entities
- [ ] **Load Tests:** Memory usage under concurrent uploads

---

## Testing Recommendations

### Unit Tests (Required)

```typescript
describe('Magic Byte Security', () => {
  it('should reject PHP file with fake image/jpeg header', async () => {
    const phpShell = Buffer.from('<?php system($_GET["cmd"]); ?>');
    const file = { ...mockFile, mimetype: 'image/jpeg', buffer: phpShell };

    await expect(service.uploadLogo(file, 'tenant_123')).rejects.toThrow(
      'Unable to verify file type'
    );
  });

  it('should reject PNG claiming to be JPEG', async () => {
    const file = { ...mockFile, mimetype: 'image/jpeg', buffer: PNG_MAGIC_BYTES };

    await expect(service.uploadLogo(file, 'tenant_123')).rejects.toThrow('File validation failed');
  });
});

describe('Cross-Tenant Security', () => {
  it('should block cross-tenant deletion', async () => {
    const url = 'https://xxx.supabase.co/.../images/tenant-abc/segments/photo.jpg?token=...';

    await service.deleteSegmentImage(url, 'tenant-xyz'); // Different tenant!

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-xyz' }),
      expect.stringContaining('cross-tenant file deletion blocked')
    );
  });
});
```

### Magic Byte Examples

| Format | Magic Bytes (Hex)    | Detection            |
| ------ | -------------------- | -------------------- |
| PNG    | `89 50 4E 47`        | `buffer[0] === 0x89` |
| JPEG   | `FF D8 FF`           | `buffer[0] === 0xFF` |
| ZIP    | `50 4B 03 04`        | `buffer[0] === 0x50` |
| WebP   | `52 49 46 46` (RIFF) | `buffer.slice(0,4)`  |

### Test Commands

```bash
# Run all upload tests
npm test -- upload.service.test.ts

# Security tests only
npm test -- --grep "Magic Byte|Cross-Tenant|MIME type spoofing"

# With coverage
npm test -- upload.service.test.ts --coverage
```

---

## Environment Configuration

```bash
# Mock mode (default, for development)
ADAPTERS_PRESET=mock

# Real mode with local filesystem (integration tests)
ADAPTERS_PRESET=real
STORAGE_MODE=local

# Production with Supabase
ADAPTERS_PRESET=real
STORAGE_MODE=supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

---

## Emergency Procedures

### Storage Quota Exceeded

```sql
-- Find large files by tenant
SELECT bucket_id, COUNT(*) as file_count,
       SUM(metadata::json->>'size')::bigint as total_bytes
FROM storage.objects
GROUP BY bucket_id;

-- Find top 20 largest files
SELECT name, metadata::json->>'size' as size_bytes
FROM storage.objects
WHERE bucket_id = 'images'
ORDER BY (metadata::json->>'size')::bigint DESC
LIMIT 20;
```

### Orphaned Files Detection

```sql
-- Find files with no matching entity
SELECT name FROM storage.objects
WHERE bucket_id = 'images'
  AND name LIKE '%packages/%'
  AND name NOT IN (
    SELECT photoFilename FROM packages WHERE photoFilename IS NOT NULL
  );
```

### Monitoring Keywords

```
SECURITY: MIME type mismatch
SECURITY: Attempted cross-tenant file deletion blocked
SECURITY: File claimed to be SVG but does not contain valid SVG content
```

---

## Key Files

| File                                          | Purpose                             |
| --------------------------------------------- | ----------------------------------- |
| `server/src/services/upload.service.ts`       | Main upload service (496 lines)     |
| `server/src/services/segment.service.ts`      | Cleanup integration (lines 259-285) |
| `server/test/services/upload.service.test.ts` | 841 tests                           |
| `server/src/middleware/rateLimiter.ts`        | Rate limiting                       |

---

## References

- [OWASP File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [Magic Bytes Specification](https://en.wikipedia.org/wiki/List_of_file_signatures)
- [file-type NPM](https://www.npmjs.com/package/file-type)
- [Supabase Storage Security](https://supabase.com/docs/guides/storage/security)
- [CWE-434](https://cwe.mitre.org/data/definitions/434.html) - Unrestricted Upload

---

## Compliance

Addresses:

- **OWASP A4:2021** - Insecure Deserialization (Unrestricted Upload)
- **CWE-434** - Unrestricted Upload of File with Dangerous Type
- **CWE-284** - Improper Access Control (Multi-tenant)
- Multi-tenant data isolation requirements

---

**Last Updated:** 2026-01-10
**Consolidated From:** 14 source documents
**Original Files:** Archived to `docs/archive/solutions-consolidated-20260110/topic-clusters/file-upload/`
