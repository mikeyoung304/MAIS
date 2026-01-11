# File Upload Security Patterns - Implementation Guide

## Pattern 1: Magic Byte Validation Flow

### Before (Vulnerable)

```typescript
async uploadLogo(file: any, tenantId: string) {
  // Only checks declared MIME type
  if (file.mimetype !== 'image/jpeg') throw new Error('Invalid type');

  // Attacker uploads PHP shell with image/jpeg header ❌
  await fs.writeFile(path, file.buffer);
}
```

### After (Secure)

```typescript
async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
  // 1. Validate file (includes magic bytes)
  await this.validateFile(file);

  // 2. Generate unique filename
  const filename = this.generateFilename(file.originalname, 'logo');

  // 3. Upload (filesystem or Supabase)
  if (this.isRealMode) {
    return this.uploadToSupabase(tenantId, 'logos', filename, file);
  }

  const filepath = path.join(this.logoUploadDir, filename);
  await fs.promises.writeFile(filepath, file.buffer);

  return {
    url: `${this.baseUrl}/uploads/logos/${filename}`,
    filename,
    size: file.size,
    mimetype: file.mimetype,
  };
}

private async validateFile(file: UploadedFile, maxSizeMB?: number): Promise<void> {
  // Size validation
  const maxSize = (maxSizeMB || this.maxFileSizeMB) * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`File size exceeds maximum of ${maxSize}MB`);
  }

  // Buffer validation
  if (!file.buffer || file.buffer.length === 0) {
    throw new Error('File buffer is empty');
  }

  // Declared MIME validation (first filter)
  if (!this.allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(`Invalid file type. Allowed: ${this.allowedMimeTypes.join(', ')}`);
  }

  // CRITICAL: Actual content validation via magic bytes
  const detectedType = await detectFileType(file.buffer);

  // Special handling: SVG (text-based, no magic bytes)
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

  // Binary formats MUST have detectable magic bytes
  if (!detectedType) {
    logger.warn({ declaredType: file.mimetype, filename: file.originalname },
      'Could not detect file type from magic bytes');
    throw new Error('Unable to verify file type. File may be corrupted.');
  }

  // Detected type must be in whitelist
  if (!this.allowedMimeTypes.includes(detectedType.mime)) {
    logger.warn({ declared: file.mimetype, detected: detectedType.mime, filename: file.originalname },
      'SECURITY: MIME type mismatch detected - possible spoofing attempt');
    throw new Error('File validation failed');
  }

  // Defense-in-depth: Normalize and compare
  const normalizedDeclared = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
  const normalizedDetected = detectedType.mime === 'image/jpg' ? 'image/jpeg' : detectedType.mime;
  if (normalizedDetected !== normalizedDeclared) {
    logger.warn({ declared: file.mimetype, detected: detectedType.mime, filename: file.originalname },
      'SECURITY: MIME type mismatch detected - possible spoofing attempt');
    throw new Error('File validation failed');
  }
}
```

### Key Points

1. **Async validation**: Magic byte detection requires I/O
2. **Multiple filters**: Declared → Detected → Normalized comparison
3. **SVG special case**: Text-based format requires content inspection
4. **Security logging**: All validation failures logged with context

---

## Pattern 2: Signed URL Architecture

### Before (Vulnerable)

```typescript
// Public bucket, anyone can enumerate URLs
const {
  data: { publicUrl },
} = await supabase.storage
  .from('public-images') // ❌ Public!
  .getPublicUrl(`${tenantId}/logos/file.jpg`);

// URL: https://bucket.supabase.co/public-images/tenant-abc/logos/file.jpg
// Attacker can try: tenant-xyz, tenant-123, etc. ❌
```

### After (Secure)

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
    .from('images')  // ✅ Private bucket
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    logger.error({ tenantId, folder, error: error.message }, 'Supabase upload failed');
    throw new Error('Failed to upload image to storage');
  }

  // Generate signed URL with cryptographic token + expiry
  const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('images')
    .createSignedUrl(storagePath, ONE_YEAR_SECONDS);  // ✅ Includes token

  if (signedUrlError || !signedUrlData) {
    logger.error({ tenantId, folder, error: signedUrlError }, 'Failed to create signed URL');
    throw new Error('Failed to generate access URL');
  }

  logger.info(
    { tenantId, folder, filename, size: file.size },
    'File uploaded to Supabase Storage with signed URL'
  );

  return {
    url: signedUrlData.signedUrl,  // ✅ URL includes: ?token=xxx&expires=yyy
    filename,
    size: file.size,
    mimetype: file.mimetype,
  };
}
```

### Key Points

1. **Private bucket**: Default deny, opt-in with signed URL
2. **Signed URLs**: Cryptographic tokens prevent enumeration
3. **Token expiry**: 1 year for business requirements (adjustable)
4. **Path structure**: `{tenantId}/folder/filename` for cleanup validation

---

## Pattern 3: Orphaned File Cleanup

### Before (Vulnerable)

```typescript
async deleteSegment(tenantId: string, id: string): Promise<void> {
  // Just delete from database
  // Image left in storage forever ❌ Orphaned + potential data leak
  await this.repository.delete(tenantId, id);
}
```

### After (Secure)

```typescript
async deleteSegment(tenantId: string, id: string): Promise<void> {
  // 1. Verify ownership
  const existing = await this.repository.findById(tenantId, id);
  if (!existing) {
    throw new NotFoundError(`Segment not found or access denied: ${id}`);
  }

  // 2. Clean up image BEFORE database deletion
  // This creates a natural transaction boundary
  if (existing.heroImage) {
    try {
      await uploadService.deleteSegmentImage(existing.heroImage, tenantId);
    } catch (err) {
      // Don't block segment deletion if cleanup fails
      // Log for audit trail
      logger.warn({ err, heroImage: existing.heroImage, segmentId: id },
        'Failed to delete segment image - continuing with segment deletion');
    }
  }

  // 3. Delete segment
  await this.repository.delete(tenantId, id);

  // 4. Invalidate cache
  this.invalidateSegmentCache(tenantId, existing.slug);

  logger.info({ tenantId, segmentId: id }, 'Segment deleted with image cleanup');
}

// In UploadService
async deleteSegmentImage(url: string, tenantId: string): Promise<void> {
  if (!url) return;  // Handle empty/null URLs

  try {
    if (this.isRealMode && url.includes('supabase')) {
      // Extract path from signed URL or public URL
      const storagePath = this.extractStoragePathFromUrl(url);
      // Example: 'tenant-abc/segments/segment-123.jpg'

      // SECURITY: Verify tenant ownership
      if (!storagePath.startsWith(`${tenantId}/`)) {
        // Attempted cross-tenant deletion! Block it.
        logger.error({ tenantId, storagePath, url },
          'SECURITY: Attempted cross-tenant file deletion blocked');
        return;  // Don't throw, just block
      }

      const supabase = this.getSupabaseClient();
      const { error } = await supabase.storage
        .from('images')
        .remove([storagePath]);

      if (error) {
        logger.warn({ error: error.message, storagePath },
          'Supabase delete failed - file may already be deleted');
      } else {
        logger.info({ tenantId, storagePath }, 'Segment image deleted from Supabase storage');
      }
    } else {
      // Mock mode: local filesystem
      const filename = path.basename(new URL(url).pathname);
      const filepath = path.join(this.segmentImageUploadDir, filename);
      if (fs.existsSync(filepath)) {
        await fs.promises.unlink(filepath);
        logger.info({ filename }, 'Segment image deleted from local storage');
      }
    }
  } catch (error) {
    // Don't throw - cleanup failures shouldn't break segment deletion
    logger.warn({ error, url, tenantId }, 'Error deleting segment image - continuing');
  }
}

private extractStoragePathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove query params (for signed URLs)
    const pathname = urlObj.pathname;
    const pathParts = pathname.split('/');

    // Find 'images' bucket in path
    const bucketIndex = pathParts.indexOf('images');
    if (bucketIndex === -1) {
      throw new Error('Invalid storage URL format');
    }

    // Extract path after bucket: tenant-id/folder/filename
    return pathParts.slice(bucketIndex + 1).join('/');
  } catch (error) {
    logger.error({ url, error }, 'Failed to extract storage path from URL');
    throw new Error('Invalid storage URL format');
  }
}
```

### Key Points

1. **Cleanup before database deletion**: Creates clear ordering
2. **Non-blocking cleanup**: Try-catch prevents cascade failures
3. **Tenant validation**: Extracts tenantId from path, compares with request
4. **Dual mode support**: Works in both mock (filesystem) and real (Supabase) modes
5. **Error isolation**: Cleanup failures logged but don't break segment deletion

---

## Pattern 4: Filename Generation (Security)

```typescript
private generateFilename(originalName: string, prefix: string = 'logo'): string {
  // Extract extension from original (safe - only used as suffix)
  const ext = path.extname(originalName);

  // Timestamp prevents collisions
  const timestamp = Date.now();

  // Random bytes prevent guessing
  const randomStr = crypto.randomBytes(8).toString('hex');  // 16 hex chars = 128 bits entropy

  // Format: prefix-timestamp-randomString.ext
  // Example: logo-1732500000000-a1b2c3d4e5f6g7h8.png
  return `${prefix}-${timestamp}-${randomStr}${ext}`;
}
```

### Security Properties

- **No user input in filename**: Extension only (safe)
- **High entropy randomness**: `crypto.randomBytes()` (128 bits)
- **Timestamp uniqueness**: Prevents duplicates even with same extension
- **Path traversal resistant**: `path.extname()` extracts only extension

---

## Pattern 5: Multi-Mode Architecture

```typescript
export class UploadService {
  private isRealMode: boolean;

  constructor() {
    // Use Supabase storage ONLY when explicitly configured
    this.isRealMode =
      process.env.STORAGE_MODE === 'supabase' ||
      (process.env.ADAPTERS_PRESET === 'real' &&
        !!process.env.SUPABASE_URL &&
        process.env.STORAGE_MODE !== 'local');

    // Only create local directories in mock mode
    if (!this.isRealMode) {
      this.ensureUploadDir(this.logoUploadDir);
      this.ensureUploadDir(this.packagePhotoUploadDir);
      this.ensureUploadDir(this.segmentImageUploadDir);
    }
  }

  private getSupabaseClient(): SupabaseClient {
    if (!this.supabase) {
      // Lazy initialization: only when actually needed
      // Prevents startup errors in mock mode
      const { getSupabaseClient } = require('../config/database');
      this.supabase = getSupabaseClient();
      logger.info('UploadService: Supabase client initialized for storage');
    }
    return this.supabase;
  }

  async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
    // Validation works in both modes
    await this.validateFile(file);

    const filename = this.generateFilename(file.originalname, 'logo');

    // Branch based on mode
    if (this.isRealMode) {
      return this.uploadToSupabase(tenantId, 'logos', filename, file);
    }

    // Mock mode: filesystem
    const filepath = path.join(this.logoUploadDir, filename);
    await fs.promises.writeFile(filepath, file.buffer);

    return {
      url: `${this.baseUrl}/uploads/logos/${filename}`,
      filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
```

### Key Points

1. **Lazy initialization**: Supabase client only created when needed
2. **Explicit mode selection**: Environment variables control behavior
3. **Test-friendly**: Can use real DB with local filesystem storage
4. **No magic strings**: Explicit `STORAGE_MODE` configuration

---

## Testing Patterns

### Pattern 1: Security Test (Magic Bytes)

```typescript
describe('Magic Byte Security Validation', () => {
  it('should reject PHP file with fake image/jpeg Content-Type header', async () => {
    const phpShell = Buffer.from('<?php system($_GET["cmd"]); ?>');

    const maliciousFile = createMockFile({
      originalname: 'shell.php.jpg',
      mimetype: 'image/jpeg', // ❌ Fake header
      buffer: phpShell, // ✅ Real content (PHP)
      size: phpShell.length,
    });

    // Should be rejected despite fake MIME type
    await expect(service.uploadLogo(maliciousFile, 'tenant_123')).rejects.toThrow(
      'Unable to verify file type'
    );

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should reject PNG file claiming to be JPEG', async () => {
    const mismatchedFile = createMockFile({
      originalname: 'image.jpg',
      mimetype: 'image/jpeg', // ❌ Declared type
      buffer: PNG_MAGIC_BYTES, // ✅ Actual type
      size: PNG_MAGIC_BYTES.length,
    });

    await expect(service.uploadLogo(mismatchedFile, 'tenant_123')).rejects.toThrow(
      'File validation failed'
    );

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should accept valid JPEG with correct header', async () => {
    const validFile = createMockFile({
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      buffer: JPEG_MAGIC_BYTES,
      size: JPEG_MAGIC_BYTES.length,
    });

    const result = await service.uploadLogo(validFile, 'tenant_123');
    expect(result).toBeDefined();
    expect(result.filename).toMatch(/^logo-.*\.jpg$/);
    expect(mockWriteFile).toHaveBeenCalled();
  });
});
```

### Pattern 2: Cross-Tenant Security Test

```typescript
describe('Cross-Tenant Security', () => {
  it('should block cross-tenant deletion attempts', async () => {
    // URL belongs to tenant-abc
    const url =
      'https://xxx.supabase.co/storage/v1/object/sign/images/tenant-abc/segments/photo.jpg?token=xxx';

    // But request comes from tenant-xyz
    await service.deleteSegmentImage(url, 'tenant-xyz');

    // Should NOT delete and should log error
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-xyz',
        storagePath: expect.stringMatching(/^tenant-abc\//), // Mismatch detected
      }),
      expect.stringContaining('SECURITY: Attempted cross-tenant file deletion blocked')
    );
  });
});
```

---

## Environment Configuration

```bash
# Mock mode (default, for development)
ADAPTERS_PRESET=mock
STORAGE_MODE=local  # Default

# Real mode with filesystem (integration tests + real DB)
ADAPTERS_PRESET=real
STORAGE_MODE=local  # Override to use local filesystem

# Real mode with Supabase (production)
ADAPTERS_PRESET=real
STORAGE_MODE=supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Checklist for Adding Similar Features

When implementing secure uploads for new file types:

1. **Magic Byte Validation**
   - [ ] Add MIME type to whitelist
   - [ ] Test magic bytes are detected correctly
   - [ ] Test spoofing is blocked

2. **Signed URLs**
   - [ ] Verify bucket is private
   - [ ] Test signed URLs include tokens
   - [ ] Test direct URL access fails

3. **Cleanup**
   - [ ] Add deletion method to service
   - [ ] Integrate into parent deletion flow
   - [ ] Test cross-tenant deletion is blocked
   - [ ] Test cleanup failures don't cascade

4. **Testing**
   - [ ] Unit tests for validation
   - [ ] Integration tests for cleanup
   - [ ] Security tests for cross-tenant access
   - [ ] Mock vs real mode tests
