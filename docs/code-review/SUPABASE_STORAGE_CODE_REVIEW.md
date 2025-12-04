# Supabase Storage Image Upload - Code Review Summary

## Executive Overview

A comprehensive 6-parallel-agent code review of the Supabase Storage Image Uploads feature revealed **8 significant findings** across security, architecture, performance, and code quality. This document consolidates the findings and provides actionable solutions for each category.

**Review Scope:** Implementation plan (`feat-supabase-storage-uploads.md`), backend service (`upload.service.ts`), frontend component (`ImageUploadField.tsx`), and test suite.

**Review Team:** 6 specialized agents analyzing in parallel

- Security Sentinel (vulnerability detection)
- Data Integrity Guardian (multi-tenant isolation)
- Architecture Strategist (pattern consistency)
- Code Simplicity Reviewer (DRY principle, cognitive load)
- Performance Oracle (resource utilization)
- Pattern Recognition Specialist (codebase alignment)

---

## P1 CRITICAL Issues (Must Fix Before Deployment)

### 1. Public Supabase Bucket Exposes Cross-Tenant Data

**Severity:** CRITICAL | **Status:** Pending | **Effort:** 2-3 hours

#### Problem

The Supabase Storage bucket is configured as **public**, allowing any user who knows or guesses the URL structure to access any tenant's uploaded images. This violates core multi-tenant isolation principles and creates a data leak vulnerability.

**Attack Vector:**

```bash
# Attacker can enumerate tenant IDs and access images
curl https://your-supabase.com/storage/v1/object/public/images/tenant-123/segments/sensitive.jpg
curl https://your-supabase.com/storage/v1/object/public/images/competitor-id/packages/data.jpg
```

**Impact:**

- Complete data leakage across all tenants
- GDPR/compliance violations if customer data is uploaded
- Competitors can steal package photos, branding, hero images
- Violates multi-tenant isolation principle from CLAUDE.md

#### Evidence

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/upload.service.ts` (lines 151-153)

```typescript
// Current implementation exposes public URLs
const supabaseUrl = process.env.SUPABASE_URL;
const publicUrl = `${supabaseUrl}/storage/v1/object/public/images/${storagePath}`;
```

#### Recommended Solution: Private Bucket with Signed URLs

**Implementation:**

1. Change Supabase bucket from public to private via Dashboard
2. Generate signed URLs with 1-year expiry on upload
3. Test cross-tenant access is blocked

```typescript
// upload.service.ts - REPLACE public URL generation
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

  if (error) throw new Error('Failed to upload image');

  // CRITICAL: Use signed URL instead of public URL
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('images')
    .createSignedUrl(storagePath, 3600 * 24 * 365); // 1 year expiry

  if (signedUrlError || !signedUrlData) {
    throw new Error('Failed to generate signed URL');
  }

  return {
    url: signedUrlData.signedUrl,
    filename,
    size: file.size,
    mimetype: file.mimetype,
  };
}
```

**Acceptance Criteria:**

- [ ] Supabase bucket changed from public to private
- [ ] Upload returns signed URLs with 1-year expiry
- [ ] Integration test verifies cross-tenant access is blocked
- [ ] Frontend handles signed URL format correctly

**Reference Issues:**

- GitHub Issue: #062 (Public Supabase Bucket Data Leak)
- Security Risk: Multi-tenant data isolation violation

---

### 2. MIME Type Spoofing Vulnerability

**Severity:** CRITICAL | **Status:** Pending | **Effort:** 1 hour

#### Problem

File upload validation relies solely on client-provided MIME type without verifying actual file contents. An attacker can upload malicious files (PHP shells, executables) by setting a fake `Content-Type: image/jpeg` header.

**Attack Vector:**

```bash
# Attacker uploads PHP shell disguised as image
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@webshell.php;type=image/jpeg" \
  https://api.example.com/v1/tenant-admin/segment-image
```

**Impact:**

- Potential for malicious file uploads disguised as images
- XSS vulnerabilities via SVG files (if added to allowlist)
- In filesystem mode, could lead to code execution if files are served
- Compliance violations for secure file handling

#### Evidence

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/upload.service.ts` (lines 95-108)

```typescript
// Current implementation - trusts client-provided mimetype
private validateFile(file: UploadedFile, maxSizeMB?: number): void {
  // Check mime type
  if (!this.allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(
      `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`
    );
  }
  // ... no content-based validation
}
```

#### Recommended Solution: Magic Number Validation

**Implementation:**

Step 1: Install the `file-type` package

```bash
npm install file-type --workspace=server
```

Step 2: Update validation to check magic bytes

```typescript
import { fileTypeFromBuffer } from 'file-type';

private async validateFile(file: UploadedFile, maxSizeMB?: number): Promise<void> {
  // Check file size
  const maxSize = maxSizeMB || this.maxFileSizeMB;
  const maxSizeBytes = maxSize * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(`File size exceeds maximum of ${maxSize}MB`);
  }

  // Check declared MIME type
  if (!this.allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(`Invalid file type: ${file.mimetype}`);
  }

  // CRITICAL: Verify actual file content via magic numbers
  const detectedType = await fileTypeFromBuffer(file.buffer);
  if (!detectedType || !this.allowedMimeTypes.includes(detectedType.mime)) {
    logger.warn(
      { declaredType: file.mimetype, detectedType: detectedType?.mime },
      'MIME type mismatch detected - possible spoofing attempt'
    );
    throw new Error('File content does not match declared type');
  }

  // Check buffer exists
  if (!file.buffer || file.buffer.length === 0) {
    throw new Error('File buffer is empty');
  }
}
```

Step 3: Update upload methods to await validation

```typescript
async uploadSegmentImage(file: UploadedFile, tenantId: string): Promise<UploadResult> {
  await this.validateFile(file, this.maxPackagePhotoSizeMB); // NOW ASYNC
  // ... rest of logic
}
```

**Acceptance Criteria:**

- [ ] `file-type` package installed
- [ ] `validateFile` checks magic bytes against declared MIME type
- [ ] Mismatch logs warning with both types for security monitoring
- [ ] Test: PHP file with image/jpeg header is rejected
- [ ] Test: Valid JPEG with image/jpeg header is accepted
- [ ] Test: PNG file with image/jpeg header is rejected

**Reference Issues:**

- GitHub Issue: #063 (MIME Type Spoofing Vulnerability)
- OWASP Reference: File Upload Cheat Sheet

---

### 3. Orphaned Files: No Cleanup When Segments Deleted

**Severity:** CRITICAL | **Status:** Pending | **Effort:** 1 hour

#### Problem

When a segment is deleted or its heroImage is updated, the old image file remains in Supabase Storage indefinitely. There is no cleanup mechanism, leading to storage bloat, cost leakage, and GDPR compliance issues (deleted content remains).

**Impact:**

- Unlimited growth of orphaned files (~$0.021/GB/month cost in Supabase)
- GDPR "right to erasure" may be violated
- No way to reclaim storage from deleted segments
- Cost explosion from untracked storage growth

#### Evidence

**Current gaps:**

- `segment.service.ts` - `deleteSegment()` has no image cleanup logic
- `upload.service.ts` - `deleteSegmentImage()` method does NOT exist
- No cleanup on segment updates when heroImage changes

#### Recommended Solution: Delete on Segment Deletion

**Implementation:**

Step 1: Add delete method to UploadService

```typescript
// upload.service.ts - Add this method
private async deleteFromSupabase(
  tenantId: string,
  folder: 'logos' | 'packages' | 'segments',
  filename: string
): Promise<void> {
  const supabase = this.getSupabaseClient();
  const storagePath = `${tenantId}/${folder}/${filename}`;

  const { error } = await supabase.storage
    .from('images')
    .remove([storagePath]);

  if (error) {
    logger.warn({ storagePath, error: error.message }, 'Supabase delete failed');
    // Don't throw - file may already be deleted
  }
}

async deleteSegmentImage(url: string, tenantId: string): Promise<void> {
  // Extract filename from URL (either signed URL or path)
  const filename = url.split('/').pop() || '';

  // Security: Verify tenant owns this file
  if (!url.includes(`/${tenantId}/`)) {
    throw new Error('Cannot delete files from other tenants');
  }

  if (this.isRealMode) {
    // Extract storage path from signed URL
    const match = url.match(/\/images\/(.+)\?/);
    const storagePath = match ? match[1] : url;

    const supabase = this.getSupabaseClient();
    const { error } = await supabase.storage.from('images').remove([storagePath]);
    if (error) logger.warn({ error: error.message }, 'Supabase delete failed');
  } else {
    // Mock mode: delete from filesystem
    const filepath = path.join(this.segmentImageUploadDir, filename);
    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
    }
  }
}
```

Step 2: Add cleanup to segment deletion

```typescript
// segment.service.ts - Update deleteSegment()
async deleteSegment(tenantId: string, id: string): Promise<void> {
  const existing = await this.repository.findById(tenantId, id);
  if (!existing) throw new NotFoundError(`Segment not found: ${id}`);

  // Clean up heroImage before deletion
  if (existing.heroImage) {
    try {
      await this.uploadService.deleteSegmentImage(existing.heroImage, tenantId);
    } catch (err) {
      logger.warn(
        { error: err, heroImage: existing.heroImage },
        'Failed to delete segment image - continuing with deletion'
      );
    }
  }

  // Delete segment from database
  await this.repository.delete(tenantId, id);
}
```

**Acceptance Criteria:**

- [ ] `deleteSegmentImage(url, tenantId)` method exists in UploadService
- [ ] `deleteSegment()` cleans up heroImage before deletion
- [ ] Tenant ownership verified before file deletion (security)
- [ ] Deletion failure logged but doesn't block segment deletion
- [ ] Test: Delete segment with heroImage removes file from storage
- [ ] Test: Delete segment without heroImage succeeds

**Reference Issues:**

- GitHub Issue: #064 (Orphaned Files No Cleanup)
- GDPR Compliance: Right to Erasure (Article 17)

---

## P2 Important Issues (Should Fix in This Sprint)

### 4. UploadService Breaks Dependency Injection Pattern

**Severity:** P2 | **Status:** Pending | **Effort:** 4-5 hours | **Priority:** High

#### Problem

The UploadService is implemented as a singleton that self-configures based on `process.env.ADAPTERS_PRESET`, completely bypassing the established DI container (`di.ts`) and adapter/port pattern used throughout the codebase. This violates architectural consistency.

**Impact:**

- Violates Open/Closed Principle (cannot add S3 without modifying service)
- Tests must manipulate process.env instead of injecting mocks
- Inconsistent with BookingService, CatalogService patterns
- Technical debt compounds with future upload features

#### Evidence

**Current pattern (non-DI):**

```typescript
// upload.service.ts
export class UploadService {
  constructor() {
    this.isRealMode = process.env.ADAPTERS_PRESET === 'real';
  }
  // ... internal if/else logic
}

// Singleton export - bypasses DI
export const uploadService = new UploadService();
```

**Expected pattern (from codebase):**

```typescript
// di.ts - switches implementations
if (config.ADAPTERS_PRESET === 'mock') {
  catalogRepo = new MockCatalogRepository();
} else {
  catalogRepo = new PrismaCatalogRepository(prisma);
}

// Services use constructor injection
export class BookingService {
  constructor(private readonly bookingRepo: BookingRepository) {}
}
```

#### Recommended Solution: Port/Adapter Pattern

**Implementation:**

Step 1: Define StorageProvider interface in ports.ts

```typescript
// server/src/lib/ports.ts
export interface StorageProvider {
  upload(
    tenantId: string,
    category: 'logos' | 'packages' | 'segments',
    filename: string,
    file: UploadedFile
  ): Promise<UploadResult>;

  delete(tenantId: string, url: string): Promise<void>;
}
```

Step 2: Create mock adapter

```typescript
// server/src/adapters/mock/mock-storage.adapter.ts
import path from 'path';
import fs from 'fs';
import { StorageProvider, UploadedFile, UploadResult } from '../../lib/ports';

export class MockStorageProvider implements StorageProvider {
  private uploadDirs: Record<string, string> = {
    logos: path.join(process.cwd(), 'uploads', 'logos'),
    packages: path.join(process.cwd(), 'uploads', 'packages'),
    segments: path.join(process.cwd(), 'uploads', 'segments'),
  };

  constructor() {
    Object.values(this.uploadDirs).forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async upload(
    tenantId: string,
    category: 'logos' | 'packages' | 'segments',
    filename: string,
    file: UploadedFile
  ): Promise<UploadResult> {
    const dir = this.uploadDirs[category];
    const filepath = path.join(dir, filename);
    await fs.promises.writeFile(filepath, file.buffer);

    return {
      url: `${process.env.API_BASE_URL || 'http://localhost:3001'}/uploads/${category}/${filename}`,
      filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  async delete(tenantId: string, url: string): Promise<void> {
    const filename = url.split('/').pop() || '';
    const category = url.includes('/logos/')
      ? 'logos'
      : url.includes('/packages/')
        ? 'packages'
        : 'segments';
    const filepath = path.join(this.uploadDirs[category], filename);
    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
    }
  }
}
```

Step 3: Create Supabase adapter

```typescript
// server/src/adapters/supabase/supabase-storage.adapter.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { StorageProvider, UploadedFile, UploadResult } from '../../lib/ports';
import { logger } from '../../lib/core/logger';

export class SupabaseStorageProvider implements StorageProvider {
  constructor(private readonly supabase: SupabaseClient) {}

  async upload(
    tenantId: string,
    category: 'logos' | 'packages' | 'segments',
    filename: string,
    file: UploadedFile
  ): Promise<UploadResult> {
    const storagePath = `${tenantId}/${category}/${filename}`;

    const { error } = await this.supabase.storage.from('images').upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

    if (error) throw new Error('Failed to upload image');

    // Generate signed URL with 1-year expiry
    const { data: signedUrlData, error: signedUrlError } = await this.supabase.storage
      .from('images')
      .createSignedUrl(storagePath, 3600 * 24 * 365);

    if (signedUrlError || !signedUrlData) {
      throw new Error('Failed to generate signed URL');
    }

    logger.info({ tenantId, category, filename }, 'File uploaded to Supabase');

    return {
      url: signedUrlData.signedUrl,
      filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  async delete(tenantId: string, url: string): Promise<void> {
    // Extract storage path from signed URL or direct URL
    const match = url.match(/\/images\/(.+?)(?:\?|$)/);
    const storagePath = match ? match[1] : url;

    // Security: Verify tenant owns this file
    if (!storagePath.startsWith(`${tenantId}/`)) {
      throw new Error('Cannot delete files from other tenants');
    }

    const { error } = await this.supabase.storage.from('images').remove([storagePath]);
    if (error) {
      logger.warn({ error: error.message }, 'Supabase delete failed');
    }
  }
}
```

Step 4: Refactor UploadService to accept provider

```typescript
// server/src/services/upload.service.ts - SIMPLIFIED
import { StorageProvider, UploadedFile, UploadResult } from '../lib/ports';
import { logger } from '../lib/core/logger';

export class UploadService {
  private maxFileSizeMB: number = 2;
  private maxPackagePhotoSizeMB: number = 5;
  private allowedMimeTypes: string[] = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/svg+xml',
    'image/webp',
  ];

  constructor(private readonly storageProvider: StorageProvider) {}

  private async validateFile(file: UploadedFile, maxSizeMB?: number): Promise<void> {
    const maxSize = maxSizeMB || this.maxFileSizeMB;
    const maxSizeBytes = maxSize * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      throw new Error(`File size exceeds maximum of ${maxSize}MB`);
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Invalid file type: ${file.mimetype}`);
    }

    // MIME type validation with file-type package
    const { fileTypeFromBuffer } = await import('file-type');
    const detectedType = await fileTypeFromBuffer(file.buffer);
    if (!detectedType || !this.allowedMimeTypes.includes(detectedType.mime)) {
      logger.warn({ declared: file.mimetype, detected: detectedType?.mime }, 'MIME mismatch');
      throw new Error('File content does not match declared type');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('File buffer is empty');
    }
  }

  private generateFilename(originalName: string, prefix: string): string {
    const ext = require('path').extname(originalName);
    const timestamp = Date.now();
    const randomStr = require('crypto').randomBytes(8).toString('hex');
    return `${prefix}-${timestamp}-${randomStr}${ext}`;
  }

  async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
    await this.validateFile(file);
    const filename = this.generateFilename(file.originalname, 'logo');
    return this.storageProvider.upload(tenantId, 'logos', filename, file);
  }

  async uploadPackagePhoto(
    file: UploadedFile,
    packageId: string,
    tenantId: string
  ): Promise<UploadResult> {
    await this.validateFile(file, this.maxPackagePhotoSizeMB);
    const filename = this.generateFilename(file.originalname, 'package');
    return this.storageProvider.upload(tenantId, 'packages', filename, file);
  }

  async uploadSegmentImage(file: UploadedFile, tenantId: string): Promise<UploadResult> {
    await this.validateFile(file, this.maxPackagePhotoSizeMB);
    const filename = this.generateFilename(file.originalname, 'segment');
    return this.storageProvider.upload(tenantId, 'segments', filename, file);
  }

  async deleteSegmentImage(url: string, tenantId: string): Promise<void> {
    return this.storageProvider.delete(tenantId, url);
  }
}
```

Step 5: Wire in DI container

```typescript
// server/src/di.ts
import { getSupabaseClient } from './config/database';
import { UploadService } from './services/upload.service';
import { MockStorageProvider } from './adapters/mock/mock-storage.adapter';
import { SupabaseStorageProvider } from './adapters/supabase/supabase-storage.adapter';

export function createRealContainer(): Container {
  // ... existing providers
  const supabaseClient = getSupabaseClient();
  const storageProvider = new SupabaseStorageProvider(supabaseClient);
  const uploadService = new UploadService(storageProvider);

  return {
    // ... existing services
    uploadService,
  };
}

export function createMockContainer(): Container {
  // ... existing providers
  const storageProvider = new MockStorageProvider();
  const uploadService = new UploadService(storageProvider);

  return {
    // ... existing services
    uploadService,
  };
}
```

**Acceptance Criteria:**

- [ ] StorageProvider interface defined in ports.ts
- [ ] MockStorageProvider implements interface
- [ ] SupabaseStorageProvider implements interface
- [ ] UploadService accepts StorageProvider via constructor
- [ ] di.ts wires correct provider based on ADAPTERS_PRESET
- [ ] Tests inject mock provider directly (no env var manipulation)
- [ ] All existing tests pass with refactored service

**Reference Issues:**

- GitHub Issue: #065 (UploadService DI Pattern Violation)
- CLAUDE.md: "Repository Pattern with TenantId" section

---

### 5. Triple Method Duplication in UploadService

**Severity:** P2 | **Status:** Pending | **Effort:** 1-2 hours

#### Problem

The UploadService has three nearly identical upload methods (`uploadLogo`, `uploadPackagePhoto`, `uploadSegmentImage`) that follow the exact same pattern. This violates DRY principle and makes maintenance harder.

**Impact:**

- 60+ lines of duplicated code
- Bug fixes need to be applied in 3 places
- Adding new upload types requires copy-paste
- Increased cognitive load for maintenance

#### Evidence

```typescript
// All three follow identical pattern
async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
  this.validateFile(file);
  const filename = this.generateFilename(file.originalname, 'logo');
  // ... upload logic (identical across all three)
}

async uploadPackagePhoto(file: UploadedFile, packageId: string, tenantId?: string): Promise<UploadResult> {
  this.validateFile(file, this.maxPackagePhotoSizeMB);
  const filename = this.generateFilename(file.originalname, 'package');
  // ... upload logic (identical)
}

async uploadSegmentImage(file: UploadedFile, tenantId: string): Promise<UploadResult> {
  this.validateFile(file, this.maxPackagePhotoSizeMB);
  const filename = this.generateFilename(file.originalname, 'segment');
  // ... upload logic (identical)
}
```

#### Recommended Solution: Single Parameterized Method

**Implementation:**

```typescript
// server/src/services/upload.service.ts
type UploadCategory = 'logos' | 'packages' | 'segments';

const SIZE_LIMITS: Record<UploadCategory, number> = {
  logos: 2,
  packages: 5,
  segments: 5,
};

private async validateFile(file: UploadedFile, maxSizeMB?: number): Promise<void> {
  const maxSize = maxSizeMB || this.maxFileSizeMB;
  const maxSizeBytes = maxSize * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    throw new Error(`File size exceeds maximum of ${maxSize}MB`);
  }

  if (!this.allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(`Invalid file type: ${file.mimetype}`);
  }

  // MIME type validation with file-type
  const { fileTypeFromBuffer } = await import('file-type');
  const detectedType = await fileTypeFromBuffer(file.buffer);
  if (!detectedType || !this.allowedMimeTypes.includes(detectedType.mime)) {
    logger.warn(
      { declared: file.mimetype, detected: detectedType?.mime },
      'MIME mismatch'
    );
    throw new Error('File content does not match declared type');
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw new Error('File buffer is empty');
  }
}

private generateFilename(originalName: string, prefix: string): string {
  const ext = path.extname(originalName);
  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(8).toString('hex');
  return `${prefix}-${timestamp}-${randomStr}${ext}`;
}

// SINGLE PARAMETERIZED METHOD
private async upload(
  file: UploadedFile,
  tenantId: string,
  category: UploadCategory
): Promise<UploadResult> {
  // Single validation call with category-specific limit
  await this.validateFile(file, SIZE_LIMITS[category]);

  // Single filename generation
  const filename = this.generateFilename(file.originalname, category);

  // Single storage operation
  return this.storageProvider.upload(tenantId, category, filename, file);
}

// PUBLIC METHODS - thin wrappers for backwards compatibility
async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
  return this.upload(file, tenantId, 'logos');
}

async uploadPackagePhoto(
  file: UploadedFile,
  packageId: string,
  tenantId: string
): Promise<UploadResult> {
  return this.upload(file, tenantId, 'packages');
}

async uploadSegmentImage(file: UploadedFile, tenantId: string): Promise<UploadResult> {
  return this.upload(file, tenantId, 'segments');
}
```

**Benefits:**

- Eliminates 60+ lines of duplication
- Single point of change for all uploads
- Clear size limits mapping
- Easy to add new categories in future

**Acceptance Criteria:**

- [ ] Single `upload()` method handles all categories
- [ ] Size limits defined in SIZE_LIMITS config
- [ ] Public wrapper methods maintain backwards compatibility
- [ ] All existing tests pass with refactored implementation

**Reference Issues:**

- GitHub Issue: #066 (Upload Code Duplication)
- DRY Principle: Don't Repeat Yourself

---

### 6. Rate Limiting is Per-IP, Not Per-Tenant

**Severity:** P2 | **Status:** Pending | **Effort:** 2-3 hours

#### Problem

The upload rate limiter uses IP-based limiting (100 uploads/hour/IP), which doesn't prevent per-tenant abuse. A single tenant with dynamic IPs can bypass limits, while shared IPs punish multiple tenants unfairly. No storage quota enforcement exists.

**Impact:**

- One tenant can exhaust storage quota (cost explosion)
- Mobile users with changing IPs bypass limits
- Corporate users behind NAT share rate limit unfairly
- No defense against storage exhaustion attacks

#### Evidence

**Current Implementation:**

```typescript
// server/src/middleware/rateLimiter.ts
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'test' ? 500 : 100, // per IP only
  // No tenant-level limiting
});
```

**Attack Scenario:**

```
Malicious tenant uses 10 different IPs (VPN/mobile):
- 10 IPs × 100 uploads/hour × 5MB = 5GB/hour storage consumption
- No per-tenant limit stops this
- Supabase storage bill explodes ($5+ per hour at current pricing)
```

#### Recommended Solution: Multi-Layer Rate Limiting

**Implementation:**

Step 1: Update middleware with both limiters

```typescript
// server/src/middleware/rateLimiter.ts

// Layer 1: IP-level (DDoS protection)
export const uploadLimiterIP = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200, // Higher limit for shared IPs
  keyGenerator: (req) => req.ip || 'unknown',
  message: { error: 'too_many_uploads_ip' },
  skip: (req) => req.path?.includes('/health'), // Skip health checks
});

// Layer 2: Tenant-level (quota enforcement)
export const uploadLimiterTenant = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Per tenant per hour
  keyGenerator: (req, res) => res.locals.tenantAuth?.tenantId || req.ip || 'unknown',
  skip: (req, res) => !res.locals.tenantAuth, // Only apply to authenticated
  message: { error: 'too_many_uploads_tenant' },
});
```

Step 2: Apply both limiters to upload routes

```typescript
// server/src/routes/tenant-admin.routes.ts

router.post(
  '/segment-image',
  uploadLimiterIP, // Layer 1: Protect against DDoS
  uploadLimiterTenant, // Layer 2: Protect against tenant abuse
  uploadSegmentImage.single('file'),
  handleMulterError,
  async (req: Request, res: Response) => {
    // ... upload handling
  }
);

// Apply to all upload endpoints
router.post('/logo', uploadLimiterIP, uploadLimiterTenant /* ... */);
router.post('/package-photo', uploadLimiterIP, uploadLimiterTenant /* ... */);
```

**Limits:**

- **IP-level:** 200 uploads/hour (protects against distributed attacks)
- **Tenant-level:** 50 uploads/hour (prevents single-tenant abuse)
- **Storage:** ~250MB/hour per tenant (50 uploads × 5MB max)
- **Daily:** ~6GB per tenant (24 hours × 250MB)

**Acceptance Criteria:**

- [ ] IP-level rate limiter (200/hour) for DDoS protection
- [ ] Tenant-level rate limiter (50/hour) for abuse prevention
- [ ] Both applied to upload endpoints
- [ ] Test: Single IP can do 200 uploads
- [ ] Test: Single tenant limited to 50 uploads regardless of IP count
- [ ] Error messages distinguish IP vs tenant limits

**Reference Issues:**

- GitHub Issue: #067 (Rate Limiting Per-IP Not Per-Tenant)
- express-rate-limit docs: keyGenerator option

---

### 7. Memory Exhaustion Risk with Multer memoryStorage

**Severity:** P2 | **Status:** Pending | **Effort:** 2-3 hours

#### Problem

File uploads use `multer.memoryStorage()` which loads entire files into RAM. With 5MB files and 100 uploads/hour rate limit, concurrent requests can cause memory spikes of 200-500MB, potentially crashing the server.

**Impact:**

- 10 concurrent 5MB uploads = 50MB+ memory spike
- Under attack: 100 requests/minute × 5MB = 500MB consumption
- Node.js GC pressure causes CPU spikes
- OOM crashes in production

#### Evidence

**Current Configuration:**

```typescript
const upload = multer({
  storage: multer.memoryStorage(), // Entire file in RAM
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
});
```

**Memory Impact Analysis:**

```
Normal load: 10 concurrent uploads × 5MB = 50MB
High load: 50 concurrent uploads × 5MB = 250MB
Attack: 100 concurrent uploads × 5MB = 500MB

Plus Node.js overhead, V8 heap, Buffer copies = 2-3x multiplier
Peak memory under attack: 500-1500MB
```

#### Recommended Solution: Tenant-Level Concurrency Limits

**Implementation:**

Step 1: Create concurrency management

```typescript
// server/src/lib/concurrency-limiter.ts
import { logger } from './core/logger';

export class ConcurrencyLimiter {
  private uploadSemaphores = new Map<string, number>();
  private readonly MAX_CONCURRENT_PER_TENANT = 3;

  async acquire(tenantId: string): Promise<void> {
    const current = this.uploadSemaphores.get(tenantId) || 0;
    if (current >= this.MAX_CONCURRENT_PER_TENANT) {
      logger.warn({ tenantId, current }, 'Upload concurrency limit exceeded');
      throw new Error(
        `Too many concurrent uploads (${current}/${this.MAX_CONCURRENT_PER_TENANT}). Please wait.`
      );
    }
    this.uploadSemaphores.set(tenantId, current + 1);
  }

  release(tenantId: string): void {
    const current = this.uploadSemaphores.get(tenantId) || 1;
    this.uploadSemaphores.set(tenantId, Math.max(0, current - 1));
  }

  getStatus(tenantId: string): { current: number; max: number } {
    return {
      current: this.uploadSemaphores.get(tenantId) || 0,
      max: this.MAX_CONCURRENT_PER_TENANT,
    };
  }
}

export const concurrencyLimiter = new ConcurrencyLimiter();
```

Step 2: Apply concurrency check to routes

```typescript
// server/src/routes/tenant-admin.routes.ts
import { concurrencyLimiter } from '../lib/concurrency-limiter';

router.post(
  '/segment-image',
  uploadSegmentImage.single('file'),
  handleMulterError,
  async (req: Request, res: Response) => {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check concurrency before processing
    try {
      await concurrencyLimiter.acquire(tenantAuth.tenantId);
    } catch (error) {
      return res.status(429).json({
        error: error instanceof Error ? error.message : 'Too many uploads',
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const result = await container.uploadService.uploadSegmentImage(
        req.file as UploadedFile,
        tenantAuth.tenantId
      );
      res.status(201).json(result);
    } catch (error) {
      logger.error({ error }, 'Segment image upload failed');
      res.status(500).json({ error: 'Failed to upload image' });
    } finally {
      // Always release concurrency slot
      concurrencyLimiter.release(tenantAuth.tenantId);
    }
  }
);
```

**Memory Protection:**

- Max 3 concurrent uploads per tenant = 15MB per tenant max
- With 100 tenants = 1.5GB theoretical max (realistic: 200-400MB)
- Prevents memory exhaustion attacks

**Acceptance Criteria:**

- [ ] Max 3 concurrent uploads per tenant enforced
- [ ] Exceeded concurrency returns 429 with clear message
- [ ] Concurrency always released (even on error)
- [ ] Test: Concurrent uploads limited to 3 per tenant
- [ ] Test: Error response is 429 (Too Many Requests)

**Reference Issues:**

- GitHub Issue: #068 (Memory Exhaustion Multer)
- Multer disk storage docs for future enhancement

---

## P3 Enhancement Issues (Nice to Have)

### 8. useCallback Overuse in ImageUploadField Component

**Severity:** P3 | **Status:** Pending | **Effort:** 30 minutes

#### Problem

The ImageUploadField component wraps every handler in `useCallback`, adding 50+ lines of boilerplate with zero performance benefit. The component doesn't pass handlers to memoized children.

**Impact:**

- 50+ lines of unnecessary code
- Cognitive overhead (dependency arrays to track)
- Cargo-culting React patterns
- Obscures simple logic

#### Evidence

**Current Over-Engineering:**

```typescript
// 7 useCallback wrappers, none necessary
const validateFile = useCallback((file: File): string | null => { ... }, [maxSizeMB]);
const uploadFile = useCallback(async (file: File) => { ... }, [uploadEndpoint, onChange, validateFile]);
const handleDragOver = useCallback((e: React.DragEvent) => { ... }, [disabled, isUploading]);
const handleDragLeave = useCallback((e: React.DragEvent) => { ... }, []);
const handleDrop = useCallback((e: React.DragEvent) => { ... }, [disabled, isUploading, uploadFile]);
const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { ... }, [uploadFile]);
const handleRemove = useCallback(() => { ... }, [onChange]);
const handleClick = useCallback(() => { ... }, [disabled, isUploading]);
```

#### Recommended Solution: Remove All useCallbacks

**Implementation:**

```typescript
// client/src/components/ImageUploadField.tsx
import { useState, useRef } from 'react';
import { Upload, X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  uploadEndpoint: string;
  disabled?: boolean;
  maxSizeMB?: number;
  className?: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];

export function ImageUploadField({
  label,
  value,
  onChange,
  uploadEndpoint,
  disabled = false,
  maxSizeMB = 5,
  className = ''
}: ImageUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Invalid file type. Allowed: JPG, PNG, WebP, SVG';
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('tenantToken');
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed (${response.status})`);
      }

      const data = await response.json();
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-white/90 text-lg">{label}</Label>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
          e.target.value = '';
        }}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {value ? (
        <div className="relative group w-32 h-32">
          <img
            src={value}
            alt="Uploaded"
            className="w-full h-full object-cover rounded-lg border border-white/20"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => {
              onChange('');
              setError(null);
            }}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !isUploading) setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (!disabled && !isUploading) {
              const file = e.dataTransfer.files[0];
              if (file) uploadFile(file);
            }
          }}
          className={`
            flex flex-col items-center justify-center gap-2 p-6
            border-2 border-dashed rounded-lg cursor-pointer
            transition-colors duration-200
            ${isDragging ? 'border-macon-orange bg-macon-orange/10' : 'border-white/20 hover:border-white/40'}
            ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 text-white/60 animate-spin" />
              <span className="text-sm text-white/60">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-white/60" />
              <span className="text-sm text-white/60">
                Drag & drop or click to upload
              </span>
              <span className="text-xs text-white/40">
                Max {maxSizeMB}MB - JPG, PNG, WebP, SVG
              </span>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
```

**Benefits:**

- 50+ lines removed
- Clearer code flow
- No dependency arrays to maintain
- Identical performance (React will re-render inline functions same as memoized)

**Acceptance Criteria:**

- [ ] No `useCallback` in ImageUploadField
- [ ] Regular functions or inline handlers used
- [ ] Component still works correctly
- [ ] Lines reduced by ~50
- [ ] All E2E tests pass

**Reference Issues:**

- GitHub Issue: #069 (useCallback Overuse)
- Kent C. Dodds: When to useCallback - https://kentcdodds.com/blog/usememo-and-usecallback

---

## Summary: Issue Severity & Timeline

### Critical Path (Must Fix Before Deployment)

| #   | Issue                     | Effort | Status  | Fix Priority |
| --- | ------------------------- | ------ | ------- | ------------ |
| 1   | Public Bucket Data Leak   | 2-3h   | Pending | P1 Blocker   |
| 2   | MIME Type Spoofing        | 1h     | Pending | P1 Blocker   |
| 3   | Orphaned Files No Cleanup | 1h     | Pending | P1 Blocker   |

**Total Critical: 4-5 hours**

### Important (Should Fix This Sprint)

| #   | Issue                  | Effort | Status  | Fix Priority |
| --- | ---------------------- | ------ | ------- | ------------ |
| 4   | DI Pattern Violation   | 4-5h   | Pending | P2 High      |
| 5   | Code Duplication       | 1-2h   | Pending | P2 High      |
| 6   | Rate Limiting Per-IP   | 2-3h   | Pending | P2 High      |
| 7   | Memory Exhaustion Risk | 2-3h   | Pending | P2 High      |

**Total Important: 9-13 hours**

### Enhancements (Nice to Have)

| #   | Issue               | Effort | Status  | Fix Priority |
| --- | ------------------- | ------ | ------- | ------------ |
| 8   | useCallback Overuse | 30min  | Pending | P3 Nice      |

**Total Enhancements: 30 minutes**

---

## Recommended Implementation Order

1. **Day 1 (Security First):**
   - Fix #1: Private bucket + signed URLs (2-3h)
   - Fix #2: MIME type validation with file-type (1h)
   - Fix #3: Cleanup on segment deletion (1h)
   - **Subtotal: 4-5 hours** (ready for security review)

2. **Day 2 (Architecture + Performance):**
   - Fix #4: Refactor to DI pattern (4-5h)
   - Fix #6: Multi-layer rate limiting (2-3h)
   - **Subtotal: 6-8 hours**

3. **Day 3 (Polish):**
   - Fix #5: Consolidate upload methods (1-2h)
   - Fix #7: Concurrency limits (2-3h)
   - Fix #8: Remove useCallback (30min)
   - **Subtotal: 3.5-5.5 hours**

**Total Timeline: 13-18.5 hours (2-3 days of focused development)**

---

## Key Files Affected

### Backend

- `/Users/mikeyoung/CODING/MAIS/server/src/services/upload.service.ts` - Main refactoring target
- `/Users/mikeyoung/CODING/MAIS/server/src/di.ts` - DI wiring
- `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin.routes.ts` - Endpoint updates
- `/Users/mikeyoung/CODING/MAIS/server/src/middleware/rateLimiter.ts` - Rate limit enhancement
- `/Users/mikeyoung/CODING/MAIS/server/src/lib/ports.ts` - StorageProvider interface (new)
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/supabase/supabase-storage.adapter.ts` - New file
- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/mock/mock-storage.adapter.ts` - New file

### Frontend

- `/Users/mikeyoung/CODING/MAIS/client/src/components/ImageUploadField.tsx` - useCallback removal
- `/Users/mikeyoung/CODING/MAIS/client/src/features/admin/segments/SegmentForm/HeroFields.tsx` - Component integration

### Tests

- `/Users/mikeyoung/CODING/MAIS/server/test/services/upload.service.test.ts` - Update with new tests
- `/Users/mikeyoung/CODING/MAIS/server/test/e2e/segment-image-upload.spec.ts` - New E2E tests

---

## Code Review Methodology

This review was conducted using a 6-parallel-agent approach:

1. **Security Sentinel** - Identified vulnerabilities (public buckets, MIME spoofing, rate limit gaps)
2. **Data Integrity Guardian** - Found orphaned file leakage and multi-tenant isolation issues
3. **Architecture Strategist** - Detected DI pattern violations
4. **Code Simplicity Reviewer** - Found duplication and over-engineering (useCallback)
5. **Performance Oracle** - Identified memory exhaustion risks and optimization gaps
6. **Pattern Recognition Specialist** - Aligned findings with CLAUDE.md and codebase patterns

Each agent reviewed findings independently, then consolidated results for consensus-based severity scoring.

---

## References

- **CLAUDE.md** - Project configuration and patterns guide
- **Supabase Docs** - Storage, Signed URLs, RLS policies
- **OWASP** - File Upload Security Cheat Sheet
- **express-rate-limit** - Rate limiting implementation
- **React DevTools** - useCallback best practices
