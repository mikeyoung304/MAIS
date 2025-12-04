# File Upload Security & Architecture Prevention Guide

## Overview

This guide provides comprehensive prevention strategies for file upload features in the MAIS multi-tenant platform, based on vulnerabilities identified in the Supabase Storage implementation. The guide covers pre-development checklists, code review criteria, testing strategies, architectural patterns, and red flags.

---

## 1. Pre-Development Checklist

Before implementing any file upload feature, review this checklist:

### Multi-Tenant Isolation

- [ ] **Tenant Scoping Plan**: Document how files will be organized by tenant
  - Storage path must include `tenantId` (e.g., `{tenantId}/logos/filename`)
  - Supabase bucket must NOT be public (only signed URLs allowed)
  - RLS policies must prevent cross-tenant access
- [ ] **Bucket Configuration Review**: Verify bucket settings before implementation
  - [ ] Bucket is **private** (not public)
  - [ ] RLS is **enabled**
  - [ ] Service role key used only server-side (never client-side)
  - [ ] Public read access only via signed URLs or allowed paths
- [ ] **No Direct Client Uploads**: Verify uploads proxy through API with tenant validation
  - Signed URLs add complexity without matching current auth model
  - Direct-to-Supabase uploads bypass tenant middleware validation
  - Use existing JWT auth in proxy pattern

### File Content Validation

- [ ] **Content-Type Bypass Prevention**:
  - [ ] Plan to validate file content, not just MIME type header
  - [ ] List which formats will need magic byte verification (e.g., PNG, JPEG)
  - [ ] Decide on validation library (e.g., `file-type` npm package)
- [ ] **Format Whitelisting**:
  - [ ] Document exactly which formats are allowed
  - [ ] Create separate whitelist per upload type (logos, photos, hero images)
  - [ ] Reject format variations not explicitly tested (e.g., new WebP versions)
- [ ] **Malware Scanning** (if applicable):
  - [ ] For production: Plan virus scanning integration
  - [ ] For MVP: Document manual review process for suspicious uploads

### Dependency Injection & Architecture

- [ ] **DI Container Integration**: Plan UploadService injection, not singleton usage
  - [ ] Identify all places that import `uploadService` singleton
  - [ ] Plan to inject via DI container instead
  - [ ] Make service mockable for testing
  - [ ] Support dual-mode (mock filesystem vs. real Supabase)
- [ ] **No Direct Supabase Calls**: Verify all storage operations go through service
  - [ ] No direct `supabase.storage` calls in routes or components
  - [ ] Create repository interface for all storage operations
  - [ ] Mock repository in tests

### Rate Limiting & Resource Protection

- [ ] **Rate Limiting Strategy**:
  - [ ] Define limits per endpoint (e.g., 10 uploads/minute per tenant)
  - [ ] Plan token bucket or sliding window approach
  - [ ] Consider aggregate limits (total MB per hour)
  - [ ] Test with load testing to verify limits prevent memory exhaustion
- [ ] **Memory Management**:
  - [ ] Set multer `fileSize` limit (5MB for package/hero photos, 2MB for logos)
  - [ ] Set `limits.files` to 1 (single file upload only)
  - [ ] Stream large files instead of buffering entire payload
  - [ ] Test memory usage during concurrent uploads

### Lifecycle Management

- [ ] **Cleanup Strategy**: Document file deletion flow
  - [ ] Plan cascade deletion when entity deleted (e.g., when package deleted)
  - [ ] Decide on orphaned file cleanup (cron job or lazy deletion)
  - [ ] Add database record linking file to entity (enable cascade deletes)
  - [ ] Test cleanup in integration tests
- [ ] **File Expiration** (if applicable):
  - [ ] Plan expiration policy for temporary/temporary uploads
  - [ ] Decide on retention period
  - [ ] Implement background job for expired file cleanup

### Error Handling & Observability

- [ ] **Error Strategy**:
  - [ ] Plan domain errors for different failure scenarios
  - [ ] Decide on user-facing error messages (generic vs. detailed)
  - [ ] Document retry logic for transient failures (Supabase timeouts)
- [ ] **Logging & Monitoring**:
  - [ ] Plan what gets logged (file size, upload duration, failures)
  - [ ] Decide what alerts to configure (quota exceeded, error rate spikes)
  - [ ] Add structured logging with tenant context

### Testing Approach

- [ ] **Test Plan Review**:
  - [ ] Unit tests for validation logic and filename generation
  - [ ] Integration tests with mock Supabase for CRUD operations
  - [ ] E2E tests for full upload-to-display flow
  - [ ] Security tests for MIME spoofing, path traversal, overflow
  - [ ] Load tests for concurrent uploads and rate limiting

---

## 2. Code Review Checklist

When reviewing file upload code, ask these critical questions:

### Security Review

#### Multi-Tenant Isolation

- [ ] **Tenant Scoping**: Does every storage operation include `tenantId` in the path?

  ```typescript
  // ✅ CORRECT
  const path = `${tenantId}/logos/${filename}`;

  // ❌ WRONG - Missing tenantId
  const path = `logos/${filename}`;
  ```

- [ ] **RLS Policies**: Are row-level security policies enforced on storage metadata table?
  - Is bucket private (not public)?
  - Do policies prevent SELECT/INSERT/UPDATE/DELETE across tenant boundaries?
- [ ] **Service Role Key**: Is service role key only used server-side, never exposed to client?
  - Check for client-side environment variables leaking key
  - Verify key not in browser console logs
- [ ] **Ownership Verification**: Before deleting a file, is tenant ownership verified?

  ```typescript
  // ✅ CORRECT
  const file = await db.file.findFirst({ where: { id, tenantId } });
  if (!file) throw new Error('File not found');

  // ❌ WRONG - No tenant check
  const file = await db.file.findFirst({ where: { id } });
  ```

#### File Content Validation

- [ ] **Magic Byte Verification**: Is file content validated beyond MIME type header?
  - Does code check magic bytes (file signatures) to prevent MIME spoofing?
  - Example: PNG files start with `89 50 4E 47` (hex)

  ```typescript
  // ✅ CORRECT
  import fileType from 'file-type';
  const detected = await fileType.fromBuffer(file.buffer);
  if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
    throw new Error('File content does not match allowed types');
  }

  // ❌ WRONG - MIME type header can be spoofed
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error('Invalid type');
  }
  ```

- [ ] **Extension Whitelisting**: Are file extensions validated against whitelist?

  ```typescript
  // ✅ CORRECT
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error('Invalid extension');
  }

  // ❌ WRONG - All extensions accepted
  const ext = path.extname(filename);
  ```

- [ ] **No Executable Formats**: Are executable formats (EXE, COM, BAT, etc.) rejected?
- [ ] **SVG Restrictions**: If SVG allowed, is it validated to prevent XSS?
  - SVGs can contain JavaScript - do you parse and sanitize?

#### Path Traversal Prevention

- [ ] **Filename Sanitization**: Is user-supplied filename sanitized?

  ```typescript
  // ✅ CORRECT
  const ext = path.extname(originalname);
  const filename = `${prefix}-${timestamp}-${random}${ext}`;
  // Attacker filename "../../etc/passwd" becomes "logo-123456-abc.png"

  // ❌ WRONG - User input in path
  const filename = sanitizePath(originalname); // Still risky
  ```

- [ ] **No Direct File Paths**: Does code construct storage paths directly from user input?
  ```typescript
  // ❌ WRONG - Vulnerable
  const path = `uploads/${req.body.folder}/${req.body.filename}`;
  ```

#### Rate Limiting & Resource Protection

- [ ] **Upload Limits**: Are file size limits enforced at multer AND validation layers?

  ```typescript
  // ✅ CORRECT - Two layers
  multer({ limits: { fileSize: 5 * 1024 * 1024 } })
  // Then in service:
  if (file.size > MAX_SIZE) throw new Error(...);

  // ❌ RISKY - Multer alone
  multer({ limits: { fileSize: 10 * 1024 * 1024 } }) // Too large
  ```

- [ ] **Concurrent Upload Limits**: Are concurrent uploads limited per tenant?
  - Does rate limiter limit uploads per minute?
  - Does code prevent 100 concurrent 5MB uploads exhausting memory?
- [ ] **Aggregate Limits**: Is total storage per tenant limited?
  - Can a tenant upload 1000 images and fill storage?
  - Is there a cleanup/archival strategy?
- [ ] **Memory Protection**:
  - [ ] Does multer use memory storage (for small uploads only)?
  - [ ] For large files, does code stream instead of buffer?
  - [ ] Are large files split into chunks?

#### Error Handling

- [ ] **No Sensitive Data in Errors**: Are error messages safe for users?

  ```typescript
  // ✅ CORRECT
  throw new Error('File upload failed');

  // ❌ WRONG - Leaks paths/internals
  throw new Error(`Failed to write to ${filepath}: ${err.message}`);
  ```

- [ ] **Graceful Failure**: Does code handle storage service outages?
  - Does Supabase timeout trigger user-friendly error?
  - Is retry logic exponential backoff?
- [ ] **Cleanup on Failure**: If upload fails midway, is partial data cleaned up?

### Architectural Review

#### Dependency Injection

- [ ] **DI Pattern**: Is UploadService injected, not imported as singleton?

  ```typescript
  // ✅ CORRECT
  constructor(private uploadService: UploadService) {}

  // ❌ WRONG
  import { uploadService } from '../../services';
  uploadService.uploadLogo(...);
  ```

- [ ] **Testability**: Can service be mocked for testing?

  ```typescript
  // ✅ CORRECT
  const mockUploadService = { uploadLogo: vi.fn() };
  const route = createRoute(mockUploadService);

  // ❌ WRONG - Can't mock singleton
  ```

- [ ] **Dual-Mode Support**: Does code work with both mock filesystem and real Supabase?
  - Is there conditional logic: `if (ADAPTERS_PRESET === 'real')`?
  - Are both paths tested?

#### Code Organization

- [ ] **Service Layer**: Is upload logic in service, not routes?
  - Routes only: validate request, call service, map response
  - Service contains: validation, Supabase/filesystem logic, error handling
- [ ] **No Duplication**: Is upload logic repeated across routes?

  ```typescript
  // ❌ BAD - Duplicated in 3 routes
  // route 1: validate, upload, return
  // route 2: validate, upload, return
  // route 3: validate, upload, return

  // ✅ GOOD - Single service method
  await uploadService.uploadLogo(file, tenantId);
  ```

- [ ] **Single Responsibility**: Does each method do one thing?
  - uploadLogo: upload a logo
  - deletePackagePhoto: delete a package photo
  - (not: validate, upload, resize, cache, AND cleanup)

#### Type Safety

- [ ] **UploadedFile Interface**: Is multer file type properly defined?
  ```typescript
  interface UploadedFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  }
  ```
- [ ] **UploadResult Type**: Does return type match API contract?
  - Ensure consistency: all upload methods return same shape
- [ ] **No `any` Types**: Are there type assertions without reason?

#### Repository Pattern

- [ ] **Storage Interface**: Is there a StorageRepository interface?

  ```typescript
  interface StorageRepository {
    uploadLogo(tenantId: string, file: UploadedFile): Promise<UploadResult>;
    deletePackagePhoto(tenantId: string, filename: string): Promise<void>;
    getSignedUrl(tenantId: string, path: string): Promise<string>;
  }

  // Implementations:
  // - SupabaseStorageRepository (real mode)
  // - FileSystemStorageRepository (mock mode)
  ```

- [ ] **All Methods Require TenantId**:

  ```typescript
  // ✅ CORRECT
  async uploadLogo(tenantId: string, file: UploadedFile): Promise<UploadResult>

  // ❌ WRONG
  async uploadLogo(file: UploadedFile): Promise<UploadResult>
  ```

### Contract & API Review

#### API Endpoint

- [ ] **Correct HTTP Method**: POST for uploads, DELETE for removal
- [ ] **Proper Status Codes**: 201 Created, 400 Bad Request, 401 Unauthorized, 413 Payload Too Large, 429 Too Many Requests
- [ ] **Response Format**: Consistent with API contracts
  ```typescript
  // ✅ CORRECT
  {
    status: 201,
    body: {
      url: "https://...",
      filename: "logo-123-abc.png",
      size: 102400,
      mimetype: "image/png"
    }
  }
  ```
- [ ] **Error Response**: Clear error messages
  ```typescript
  // ✅ CORRECT
  {
    status: 400,
    body: { error: "File size exceeds 5MB limit" }
  }
  ```

#### Frontend Integration

- [ ] **File Input Attributes**: Does `<input>` have `accept` attribute?

  ```html
  <!-- ✅ CORRECT -->
  <input type="file" accept="image/jpeg,image/png,image/webp" />

  <!-- ❌ WRONG -->
  <input type="file" />
  ```

- [ ] **Preview Safety**: If showing image preview, is URL validated?

  ```typescript
  // ✅ CORRECT - Only from API response
  const response = await uploadFile();
  setImageUrl(response.url); // From trusted source

  // ❌ WRONG - From user input
  setImageUrl(userProvidedUrl); // Could be malicious
  ```

---

## 3. Testing Recommendations

Every file upload feature should have comprehensive tests covering these areas:

### Unit Tests (UploadService)

#### Validation Tests

```typescript
describe('File Validation', () => {
  // File size validation
  it('should reject files exceeding size limit', async () => {
    const file = { ...mockFile, size: 6 * 1024 * 1024 }; // 6MB, limit 5MB
    await expect(service.uploadPackagePhoto(file, 'tenant_1')).rejects.toThrow();
  });

  // MIME type validation
  it('should reject non-image MIME types', async () => {
    const file = { ...mockFile, mimetype: 'application/pdf' };
    await expect(service.uploadLogo(file, 'tenant_1')).rejects.toThrow();
  });

  // Magic byte validation (CRITICAL - prevents MIME spoofing)
  it('should reject MIME type spoofing (PNG header in JPG file)', async () => {
    // Create buffer with PNG magic bytes but JPEG MIME type
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
    const file = { ...mockFile, mimetype: 'image/jpeg', buffer: pngBuffer };
    await expect(service.uploadLogo(file, 'tenant_1')).rejects.toThrow();
  });

  // Empty buffer validation
  it('should reject empty files', async () => {
    const file = { ...mockFile, buffer: Buffer.alloc(0), size: 0 };
    await expect(service.uploadLogo(file, 'tenant_1')).rejects.toThrow();
  });
});
```

#### Filename Generation Tests

```typescript
describe('Filename Generation', () => {
  // Path traversal prevention
  it('should not allow path traversal in generated filename', async () => {
    const malicious = { ...mockFile, originalname: '../../etc/passwd.png' };
    const result = await service.uploadLogo(malicious, 'tenant_1');
    expect(result.filename).not.toContain('..');
    expect(result.filename).not.toContain('/');
  });

  // Uniqueness
  it('should generate unique filenames for concurrent uploads', async () => {
    const results = await Promise.all([
      service.uploadLogo(mockFile, 'tenant_1'),
      service.uploadLogo(mockFile, 'tenant_1'),
      service.uploadLogo(mockFile, 'tenant_1'),
    ]);
    const filenames = results.map((r) => r.filename);
    expect(new Set(filenames).size).toBe(3); // All unique
  });
});
```

#### Tenant Isolation Tests

```typescript
describe('Multi-Tenant Isolation', () => {
  // Verify tenant scoping in Supabase paths
  it('should include tenantId in Supabase storage path', async () => {
    // Mock Supabase upload to capture path
    const uploadSpy = vi.spyOn(supabase.storage.from('images'), 'upload');

    await service.uploadLogo(mockFile, 'tenant_abc');

    expect(uploadSpy).toHaveBeenCalledWith(
      expect.stringContaining('tenant_abc/'),
      expect.any(Buffer),
      expect.any(Object)
    );
  });

  // Verify different tenants have separate paths
  it('should store logos in tenant-specific paths', async () => {
    const uploadSpy = vi.spyOn(supabase.storage.from('images'), 'upload');

    await service.uploadLogo(mockFile, 'tenant_1');
    await service.uploadLogo(mockFile, 'tenant_2');

    const paths = uploadSpy.mock.calls.map((call) => call[0]);
    expect(paths[0]).toContain('tenant_1/');
    expect(paths[1]).toContain('tenant_2/');
    expect(paths[0]).not.toEqual(paths[1]);
  });
});
```

### Integration Tests (with Database)

#### File Lifecycle Tests

```typescript
describe('File Lifecycle (Integration)', () => {
  // Upload, link to entity, cleanup
  it('should cascade delete files when package is deleted', async () => {
    // Create package
    const pkg = await db.package.create({ data: { tenantId, name: 'Test' } });

    // Upload photo
    const result = await uploadService.uploadPackagePhoto(mockFile, pkg.id, tenantId);

    // Link photo to package
    await db.package.update({
      where: { id: pkg.id },
      data: { photoUrl: result.url, photoFilename: result.filename },
    });

    // Delete package
    await db.package.delete({ where: { id: pkg.id } });

    // Verify file is deleted from Supabase
    const { data } = await supabase.storage.from('images').list(`${tenantId}/packages/`);
    expect(data).not.toContainEqual(expect.objectContaining({ name: result.filename }));
  });

  // Orphaned file detection
  it('should identify orphaned files (no associated entity)', async () => {
    // Upload file
    const result = await uploadService.uploadPackagePhoto(mockFile, 'package_1', tenantId);

    // Don't link to any package

    // List files and check for orphans
    const { data: files } = await supabase.storage.from('images').list(`${tenantId}/packages/`);

    const linkedFiles = await db.package.findMany({
      where: { photoFilename: { in: files.map((f) => f.name) } },
      select: { photoFilename: true },
    });

    const orphans = files.filter((f) => !linkedFiles.some((p) => p.photoFilename === f.name));

    expect(orphans.length).toBeGreaterThan(0);
  });
});
```

### E2E Tests (Playwright)

#### Upload Flow

```typescript
test.describe('Image Upload E2E', () => {
  test('should upload logo via drag-drop and display preview', async ({ page }) => {
    await page.goto('/tenant/settings');

    // Drag file to upload zone
    const uploadZone = page.locator('[data-testid="logo-upload"]');
    await uploadZone.dragAndDropFiles('test-logo.png');

    // Wait for upload to complete
    await page.waitForResponse(
      (resp) => resp.url().includes('/tenant-admin/logo') && resp.status() === 201
    );

    // Verify preview appears
    const preview = page.locator('[data-testid="logo-preview"]');
    await expect(preview).toBeVisible();
    await expect(preview.locator('img')).toHaveAttribute('src', /logo-\d+-/);
  });

  test('should show error for oversized file', async ({ page }) => {
    await page.goto('/tenant/settings');

    // Try to upload 10MB file (exceeds 5MB limit)
    const largeFile = await createTestFile(10 * 1024 * 1024);
    const uploadZone = page.locator('[data-testid="package-photo-upload"]');
    await uploadZone.dragAndDropFiles(largeFile);

    // Wait for error message
    const error = page.locator('[role="alert"]');
    await expect(error).toContainText('5MB');
  });

  test('should show error for invalid file type', async ({ page }) => {
    await page.goto('/tenant/settings');

    // Try to upload PDF
    const uploadZone = page.locator('[data-testid="logo-upload"]');
    await uploadZone.dragAndDropFiles('document.pdf');

    const error = page.locator('[role="alert"]');
    await expect(error).toContainText('Invalid file type');
  });
});
```

### Security Tests

#### MIME Spoofing Prevention

```typescript
describe('MIME Spoofing Prevention', () => {
  it('should reject file with PNG header but JPEG extension', async () => {
    const pngData = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47, // PNG magic bytes
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ]);

    const file = {
      ...mockFile,
      originalname: 'fake.jpg',
      mimetype: 'image/jpeg',
      buffer: pngData,
      size: pngData.length,
    };

    await expect(service.uploadLogo(file, 'tenant_1')).rejects.toThrow();
  });

  it('should reject file with ZIP header disguised as image', async () => {
    const zipData = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // ZIP magic bytes

    const file = {
      ...mockFile,
      originalname: 'archive.png',
      mimetype: 'image/png',
      buffer: zipData,
      size: zipData.length,
    };

    await expect(service.uploadLogo(file, 'tenant_1')).rejects.toThrow();
  });
});
```

#### Path Traversal Prevention

```typescript
describe('Path Traversal Prevention', () => {
  it('should safely handle malicious filenames', async () => {
    const maliciousNames = [
      '../../etc/passwd.png',
      '../../../admin/secret.jpg',
      'normal/../../../evil.png',
      'file.png/../../../escape.jpg',
    ];

    for (const name of maliciousNames) {
      const result = await service.uploadLogo({ ...mockFile, originalname: name }, 'tenant_1');

      // Should not contain parent directory traversal
      expect(result.filename).not.toContain('..');
      expect(result.filename).not.toContain('admin');
      expect(result.filename).not.toContain('etc');
    }
  });
});
```

#### Multi-Tenant Isolation

```typescript
describe('Multi-Tenant Isolation (Security)', () => {
  it("should prevent accessing another tenant's files", async () => {
    // Upload as tenant_1
    const result = await uploadService.uploadLogo(mockFile, 'tenant_1');

    // Try to access as tenant_2
    const { data: files } = await supabase.storage.from('images').list('tenant_2/logos/');

    // Should not see tenant_1's file
    expect(files.map((f) => f.name)).not.toContain(result.filename);
  });

  it('should verify tenant owns file before deletion', async () => {
    // Upload as tenant_1
    const result = await uploadService.uploadLogo(mockFile, 'tenant_1');

    // Try to delete as tenant_2
    await expect(uploadService.deleteLogoAsTenan('tenant_2', result.filename)).rejects.toThrow(
      'File not found'
    );
  });
});
```

### Load & Performance Tests

#### Rate Limiting

```typescript
describe('Rate Limiting', () => {
  it('should enforce per-tenant upload limits', async () => {
    const results: Promise<UploadResult>[] = [];

    // Attempt 15 uploads rapidly (limit is 10/minute)
    for (let i = 0; i < 15; i++) {
      results.push(uploadService.uploadLogo(mockFile, 'tenant_1'));
    }

    const settled = await Promise.allSettled(results);
    const failures = settled.filter((s) => s.status === 'rejected');

    // At least 5 should be rate limited
    expect(failures.length).toBeGreaterThanOrEqual(5);
    expect(failures[0].reason).toMatch(/rate limit|too many/i);
  });
});
```

#### Memory Protection

```typescript
describe('Memory Protection', () => {
  it('should handle concurrent uploads without memory exhaustion', async () => {
    const memBefore = process.memoryUsage().heapUsed;

    // 20 concurrent 5MB uploads
    const promises = Array(20)
      .fill(null)
      .map(() => uploadService.uploadPackagePhoto(mockFile, 'package_1', 'tenant_1'));

    await Promise.all(promises);

    const memAfter = process.memoryUsage().heapUsed;
    const memIncrease = (memAfter - memBefore) / 1024 / 1024; // MB

    // Should not increase by more than 150MB (20 * 5MB * 2 for overhead)
    expect(memIncrease).toBeLessThan(150);
  });
});
```

---

## 4. Architectural Patterns

### Proper Service Structure

```typescript
// services/upload.service.ts

/**
 * Storage repository interface - all storage implementations implement this
 */
export interface StorageRepository {
  uploadLogo(tenantId: string, file: UploadedFile): Promise<UploadResult>;
  uploadPackagePhoto(
    tenantId: string,
    file: UploadedFile,
    packageId: string
  ): Promise<UploadResult>;
  uploadSegmentImage(tenantId: string, file: UploadedFile): Promise<UploadResult>;
  deleteFile(tenantId: string, folder: string, filename: string): Promise<void>;
  getSignedUrl(tenantId: string, folder: string, filename: string): Promise<string>;
}

/**
 * Upload service - business logic only, no storage implementation
 */
export class UploadService {
  private readonly maxLogoSizeMB = 2;
  private readonly maxPhotSizeMB = 5;
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml',
  ];

  constructor(
    private readonly storageRepo: StorageRepository,
    private readonly fileTypeValidator: FileTypeValidator,
    private readonly logger: Logger
  ) {}

  /**
   * Validate file before upload
   */
  private validateFile(file: UploadedFile, maxSizeMB: number): void {
    // Size validation
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new FileSizeExceededError(maxSizeMB);
    }

    // MIME type header validation (first layer)
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new InvalidMimeTypeError();
    }

    // Magic byte validation (second layer - prevents MIME spoofing)
    const detected = this.fileTypeValidator.detect(file.buffer);
    if (!detected || !this.allowedMimeTypes.includes(detected.mimeType)) {
      throw new InvalidFileContentError('File content does not match MIME type');
    }

    // Buffer validation
    if (!file.buffer || file.buffer.length === 0) {
      throw new EmptyFileError();
    }
  }

  /**
   * Generate unique, safe filename
   */
  private generateFilename(originalName: string, prefix: string): string {
    // Extract only extension, ignore path traversal attempts
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `${prefix}-${timestamp}-${random}${ext}`;
  }

  /**
   * Upload logo (max 2MB)
   */
  async uploadLogo(tenantId: string, file: UploadedFile): Promise<UploadResult> {
    try {
      this.validateFile(file, this.maxLogoSizeMB);
      const filename = this.generateFilename(file.originalname, 'logo');

      const result = await this.storageRepo.uploadLogo(tenantId, {
        ...file,
        generatedFilename: filename,
      });

      this.logger.info({ tenantId, filename, size: file.size }, 'Logo uploaded successfully');

      return result;
    } catch (error) {
      this.logger.error({ tenantId, error }, 'Logo upload failed');
      throw error;
    }
  }

  /**
   * Upload package photo (max 5MB)
   */
  async uploadPackagePhoto(
    tenantId: string,
    packageId: string,
    file: UploadedFile
  ): Promise<UploadResult> {
    try {
      this.validateFile(file, this.maxPhotSizeMB);
      const filename = this.generateFilename(file.originalname, 'package');

      const result = await this.storageRepo.uploadPackagePhoto(
        tenantId,
        {
          ...file,
          generatedFilename: filename,
        },
        packageId
      );

      this.logger.info(
        { tenantId, packageId, filename, size: file.size },
        'Package photo uploaded'
      );

      return result;
    } catch (error) {
      this.logger.error({ tenantId, packageId, error }, 'Photo upload failed');
      throw error;
    }
  }

  /**
   * Delete file with tenant verification
   */
  async deleteFile(
    tenantId: string,
    folder: 'logos' | 'packages' | 'segments',
    filename: string
  ): Promise<void> {
    try {
      // Verify ownership before deletion
      const file = await this.verifyFileOwnership(tenantId, folder, filename);
      if (!file) {
        throw new FileNotFoundError();
      }

      await this.storageRepo.deleteFile(tenantId, folder, filename);

      this.logger.info({ tenantId, folder, filename }, 'File deleted successfully');
    } catch (error) {
      this.logger.error({ tenantId, folder, filename, error }, 'Delete failed');
      throw error;
    }
  }

  /**
   * Verify file ownership (query database)
   */
  private async verifyFileOwnership(
    tenantId: string,
    folder: string,
    filename: string
  ): Promise<File | null> {
    // Query database to verify file is owned by tenant
    // This prevents tenant A from deleting tenant B's files
    return db.file.findFirst({
      where: {
        tenantId,
        folder,
        filename,
      },
    });
  }
}
```

### Dual-Mode Storage Repository

```typescript
// adapters/storage/storage.adapter.ts

/**
 * Supabase Storage Implementation (Real Mode)
 */
export class SupabaseStorageRepository implements StorageRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly logger: Logger
  ) {}

  async uploadLogo(
    tenantId: string,
    file: UploadedFile & { generatedFilename: string }
  ): Promise<UploadResult> {
    const path = `${tenantId}/logos/${file.generatedFilename}`;

    const { error } = await this.supabase.storage.from('images').upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false, // Prevent overwriting
    });

    if (error) {
      throw new UploadFailedError(error.message);
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/images/${path}`;

    return {
      url: publicUrl,
      filename: file.generatedFilename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  async getSignedUrl(tenantId: string, folder: string, filename: string): Promise<string> {
    const path = `${tenantId}/${folder}/${filename}`;

    const { data, error } = await this.supabase.storage.from('images').createSignedUrl(path, 3600); // 1 hour expiry

    if (error) {
      throw new UrlGenerationError(error.message);
    }

    return data.signedUrl;
  }

  async deleteFile(tenantId: string, folder: string, filename: string): Promise<void> {
    const path = `${tenantId}/${folder}/${filename}`;

    const { error } = await this.supabase.storage.from('images').remove([path]);

    if (error) {
      this.logger.warn({ path, error: error.message }, 'Delete failed');
      // Don't throw - file may already be deleted
    }
  }
}

/**
 * Filesystem Storage Implementation (Mock Mode)
 */
export class FileSystemStorageRepository implements StorageRepository {
  private readonly baseDir: string;

  constructor(
    baseDir: string,
    private readonly logger: Logger
  ) {
    this.baseDir = baseDir;
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async uploadLogo(
    tenantId: string,
    file: UploadedFile & { generatedFilename: string }
  ): Promise<UploadResult> {
    const tenantDir = path.join(this.baseDir, tenantId, 'logos');
    this.ensureDirectory(tenantDir);

    const filepath = path.join(tenantDir, file.generatedFilename);
    await fs.promises.writeFile(filepath, file.buffer);

    return {
      url: `/uploads/${tenantId}/logos/${file.generatedFilename}`,
      filename: file.generatedFilename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  async deleteFile(tenantId: string, folder: string, filename: string): Promise<void> {
    const filepath = path.join(this.baseDir, tenantId, folder, filename);

    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
    }
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
```

### Rate Limiting Integration

```typescript
// middleware/uploadRateLimiter.ts

export const uploadRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute per tenant
  keyGenerator: (req) => {
    const tenantId = req.tenantAuth?.tenantId;
    if (!tenantId) return req.ip;
    return `uploads:${tenantId}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Upload rate limit exceeded. Please wait before uploading again.',
    });
  },
});

// In routes:
router.post(
  '/logo',
  uploadRateLimiter, // Apply rate limiter
  uploadLogoMiddleware.single('file'),
  async (req, res) => {
    // Handle upload
  }
);
```

### Proper Route Implementation

```typescript
// routes/tenant-admin.routes.ts

/**
 * Upload logo endpoint
 * POST /v1/tenant-admin/logo
 * Authentication: JWT tenant token
 * Rate limit: 10/minute per tenant
 */
router.post(
  '/logo',
  uploadRateLimiter,
  uploadLogoMiddleware.single('file'),
  handleMulterError,
  async (req: Request, res: Response) => {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const result = await container.uploadService.uploadLogo(
        tenantAuth.tenantId,
        req.file as UploadedFile
      );

      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof FileSizeExceededError) {
        return res.status(413).json({
          error: `File exceeds maximum size of ${error.maxSize}MB`,
        });
      }

      if (error instanceof InvalidMimeTypeError) {
        return res.status(400).json({
          error: 'Invalid file type. Allowed: JPG, PNG, WebP, SVG',
        });
      }

      container.logger.error({ tenantId: tenantAuth.tenantId, error }, 'Logo upload failed');

      return res.status(500).json({ error: 'Upload failed' });
    }
  }
);
```

---

## 5. Red Flags

Watch for these warning signs during code review or testing:

### Security Red Flags

1. **Missing `tenantId` in storage paths**
   - Any storage operation not scoped by tenant
   - Example: `bucket/${folder}/${filename}` instead of `bucket/${tenantId}/${folder}/${filename}`

2. **Public bucket with no RLS**
   - Bucket is public and any file can be accessed
   - No row-level security policies
   - Service role key exposed to frontend

3. **MIME type validation only**

   ```typescript
   // RED FLAG - Only checks header
   if (!ALLOWED_TYPES.includes(file.mimetype)) { ... }
   ```

4. **No magic byte verification**
   - "Trusted" MIME type from multer without validating actual content
   - Allows MIME spoofing (PNG content with JPEG header)

5. **File path constructed from user input**

   ```typescript
   // RED FLAG
   const path = `uploads/${req.body.folder}/${req.body.filename}`;
   ```

6. **No file size limit enforcement**

   ```typescript
   // RED FLAG - No size check
   const file = req.file;
   await uploadFile(file);
   ```

7. **Unlimited concurrent uploads**
   - No rate limiting
   - Allows memory exhaustion attack
   - 100 concurrent 5MB uploads = 500MB memory spike

8. **No tenant ownership verification before deletion**

   ```typescript
   // RED FLAG - Could delete another tenant's file
   await supabase.storage.from('images').remove([filename]);
   ```

9. **SVG files allowed without sanitization**
   - SVG can contain `<script>` tags
   - Can execute JavaScript when displayed
   - Must parse and sanitize or reject SVG entirely

10. **Error messages leaking internals**
    ```typescript
    // RED FLAG
    throw new Error(`Failed to write to ${filepath}: ${err.message}`);
    ```

### Architectural Red Flags

11. **Singleton import instead of DI**

    ```typescript
    // RED FLAG
    import { uploadService } from './services';
    uploadService.uploadLogo(...);
    ```

12. **Direct Supabase calls outside service layer**

    ```typescript
    // RED FLAG - Direct storage access in route
    await supabase.storage.from('images').upload(...);
    ```

13. **Duplicated upload logic across multiple routes**
    - Same validation, upload, error handling in 3+ places
    - Changes require updating all copies

14. **No separation between validation and storage**
    - Validation logic mixed with Supabase/filesystem calls
    - Hard to test validation independently

15. **No TypeScript types for file uploads**

    ```typescript
    // RED FLAG
    async uploadLogo(file: any, tenantId?: string) { ... }
    ```

16. **Optional tenantId parameter**

    ```typescript
    // RED FLAG
    async uploadPackagePhoto(file: UploadedFile, packageId: string, tenantId?: string)
    // What happens if tenantId is undefined?
    ```

17. **No database record linking file to entity**
    - File uploaded but not tracked in database
    - Can't cascade delete files when entity is deleted
    - Orphaned files accumulate

18. **No cleanup on failed uploads**
    - Partial file left in Supabase if upload fails
    - Can exhaust storage quota

19. **Same bucket for all environments**
    - Production and staging files mixed
    - Risk of staging data leaking to production

### Testing Red Flags

20. **No tests for MIME spoofing**
    - Only tests valid uploads
    - Missing security test case

21. **No integration tests with real Supabase**
    - Only unit tests with mocks
    - Real-mode bugs discovered in production

22. **No multi-tenant isolation tests**
    - Tests don't verify tenant B can't access tenant A's files
    - Cross-tenant vulnerability not caught

23. **No load/stress tests**
    - Memory exhaustion vulnerability not caught
    - Rate limiting not tested with realistic load

24. **Tests don't verify cleanup**
    - Files uploaded but never deleted in tests
    - Orphaned file problem not caught

### Operational Red Flags

25. **No monitoring/alerting for uploads**
    - Can't detect storage quota exceeded
    - Can't detect spike in failed uploads
    - Can't track per-tenant usage

26. **No logging with tenant context**

    ```typescript
    // RED FLAG - Hard to debug per-tenant issues
    logger.info(`File uploaded: ${filename}`);

    // GOOD - Tenant context included
    logger.info({ tenantId, filename }, 'File uploaded');
    ```

27. **No rate limiting on upload endpoints**
    - Single tenant can exhaust storage
    - Denial of service vulnerability

28. **No file expiration or cleanup policy**
    - Storage grows unbounded
    - No way to free up space from old uploads

29. **Service role key in environment variable without protection**
    - Any code can access it
    - No secret encryption

30. **No audit log for file operations**
    - Can't track who uploaded or deleted files
    - Compliance requirement for sensitive data

---

## 6. Common Implementation Mistakes

### Mistake 1: Missing Tenant Scoping

```typescript
// ❌ WRONG
async uploadLogo(file: UploadedFile) {
  const filename = this.generateFilename(file.originalname);
  const path = `logos/${filename}`; // No tenantId!

  await supabase.storage.from('images').upload(path, file.buffer);
}

// ✅ CORRECT
async uploadLogo(tenantId: string, file: UploadedFile) {
  const filename = this.generateFilename(file.originalname);
  const path = `${tenantId}/logos/${filename}`; // Include tenantId

  await supabase.storage.from('images').upload(path, file.buffer);
}
```

### Mistake 2: MIME Spoofing Vulnerability

```typescript
// ❌ WRONG - Only checks header
validateFile(file: UploadedFile) {
  if (!this.allowedMimeTypes.includes(file.mimetype)) {
    throw new Error('Invalid type');
  }
}

// ✅ CORRECT - Validates actual content
async validateFile(file: UploadedFile) {
  // Check header
  if (!this.allowedMimeTypes.includes(file.mimetype)) {
    throw new Error('Invalid type');
  }

  // Check magic bytes
  const detected = await fileType.fromBuffer(file.buffer);
  if (!detected || !this.allowedMimeTypes.includes(detected.mime)) {
    throw new Error('File content does not match MIME type');
  }
}
```

### Mistake 3: No Ownership Verification

```typescript
// ❌ WRONG - Can delete any file
async deleteFile(filename: string) {
  await supabase.storage.from('images').remove([filename]);
}

// ✅ CORRECT - Verify ownership first
async deleteFile(tenantId: string, folder: string, filename: string) {
  // Query database to verify tenant owns the file
  const file = await db.file.findFirst({
    where: { tenantId, folder, filename }
  });

  if (!file) {
    throw new FileNotFoundError();
  }

  await supabase.storage.from('images')
    .remove([`${tenantId}/${folder}/${filename}`]);
}
```

### Mistake 4: No Cleanup on Delete

```typescript
// ❌ WRONG - File orphaned in Supabase
async deletePackage(packageId: string) {
  await db.package.delete({ where: { id: packageId } });
  // Photo file left in Supabase!
}

// ✅ CORRECT - Cascade delete files
async deletePackage(tenantId: string, packageId: string) {
  const pkg = await db.package.findUnique({
    where: { id: packageId }
  });

  if (!pkg) throw new Error('Not found');

  // Delete file first
  if (pkg.photoFilename) {
    await this.uploadService.deleteFile(
      tenantId,
      'packages',
      pkg.photoFilename
    );
  }

  // Then delete record
  await db.package.delete({ where: { id: packageId } });
}
```

### Mistake 5: No Rate Limiting

```typescript
// ❌ WRONG - No rate limit
router.post('/logo', async (req, res) => {
  // Tenant can upload 1000 files/second
});

// ✅ CORRECT - Rate limit per tenant
router.post(
  '/logo',
  rateLimit({
    max: 10, // 10 per minute
    keyGenerator: (req) => `uploads:${res.locals.tenantAuth.tenantId}`,
  }),
  async (req, res) => {
    // Limited to 10 uploads/minute per tenant
  }
);
```

---

## 7. Quick Reference Checklist

Print and post this quick reference for developers:

### Before Implementation

- [ ] Identified all upload types (logos, photos, hero images)
- [ ] Defined size limits per type
- [ ] Planned tenant scoping strategy
- [ ] Planned cleanup/lifecycle management
- [ ] Designed file-to-entity linking (database)
- [ ] Chose magic byte validation library
- [ ] Designed rate limiting strategy
- [ ] Created tests for MIME spoofing, path traversal, memory exhaustion

### During Implementation

- [ ] Used DI pattern (not singleton)
- [ ] Created StorageRepository interface
- [ ] Implemented dual-mode (mock + real)
- [ ] Added tenantId to all storage paths
- [ ] Validated magic bytes, not just MIME header
- [ ] Rejected SVG or sanitized it
- [ ] Added rate limiting middleware
- [ ] Verified file ownership before deletion
- [ ] Added cleanup on entity deletion
- [ ] Logged with tenant context

### Code Review

- [ ] Is tenantId in all paths?
- [ ] Is magic byte validation present?
- [ ] Are MIME spoofing tests included?
- [ ] Is rate limiting enforced?
- [ ] Can file be deleted by unauthorized tenant?
- [ ] Are files cleaned up on entity deletion?
- [ ] Are error messages safe (no leaks)?
- [ ] Is service injected, not imported?
- [ ] Are tests for multi-tenant isolation present?
- [ ] Are load tests for rate limiting present?

### Before Deployment

- [ ] All tests pass locally
- [ ] TypeScript compilation succeeds
- [ ] E2E tests pass in both mock and real modes
- [ ] Load tested with concurrent uploads
- [ ] Security audit completed
- [ ] Supabase bucket is private (not public)
- [ ] RLS policies verified
- [ ] Service role key rotated
- [ ] Monitoring/alerting configured
- [ ] Runbook for quota exceeded created

---

## References

- **CLAUDE.md** - Project patterns and commands
- **ARCHITECTURE.md** - System design principles
- **DEVELOPING.md** - Development workflow
- **upload.service.ts** - Current implementation
- **upload.service.test.ts** - Test examples
- **ImageUploadField.tsx** - Frontend component
- **tenant-admin.routes.ts** - Route definitions
