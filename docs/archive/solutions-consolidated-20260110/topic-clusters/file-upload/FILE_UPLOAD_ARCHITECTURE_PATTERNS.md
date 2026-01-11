# File Upload Architecture Patterns

**For System Design & Advanced Implementation**

This document describes architectural patterns for implementing secure, multi-tenant file uploads in distributed systems.

---

## Pattern 1: Dual-Mode Storage (Mock vs. Real)

### Problem

Testing file uploads requires either:

- Real cloud storage (expensive, slow, requires credentials)
- Mock filesystem (doesn't test integration)

### Solution: Dual-Mode Service

```typescript
// UploadService automatically selects based on environment
export class UploadService {
  private isRealMode: boolean;

  constructor() {
    // Use Supabase in real mode, filesystem in mock mode
    this.isRealMode =
      process.env.STORAGE_MODE === 'supabase' ||
      (process.env.ADAPTERS_PRESET === 'real' &&
        !!process.env.SUPABASE_URL &&
        process.env.STORAGE_MODE !== 'local');
  }

  async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
    await this.validateFile(file);
    const filename = this.generateFilename(file.originalname, 'logo');

    if (this.isRealMode) {
      // Use Supabase Storage with signed URLs
      return this.uploadToSupabase(tenantId, 'logos', filename, file);
    } else {
      // Use local filesystem
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
}
```

### Benefits

| Mode     | Use Case                               | Speed   | Cost        | Auth        |
| -------- | -------------------------------------- | ------- | ----------- | ----------- |
| **Mock** | Unit/E2E tests, development            | Instant | Free        | None        |
| **Real** | Integration tests, staging, production | ~500ms  | $5-10/month | Service key |

### Environment Control

```bash
# Development (fastest, no external deps)
ADAPTERS_PRESET=mock npm run dev:api
# Filesystem: ./uploads/{logos,packages,segments}/

# Integration tests (isolated test bucket)
ADAPTERS_PRESET=real STORAGE_MODE=supabase npm run test:integration
# Supabase: test-images-bucket (separate from production)

# Production (real storage)
ADAPTERS_PRESET=real npm run start
# Supabase: production bucket
```

---

## Pattern 2: Dependency Injection for Storage

### Problem

Hard-coding storage imports makes code untestable:

```typescript
❌ WRONG
import { uploadService } from './services';

class PackageService {
  async deletePackage(id: string) {
    // Can't mock uploadService in tests
    await uploadService.cleanup(id);
  }
}
```

### Solution: Constructor Injection

```typescript
✅ CORRECT
interface FileStorage {
  uploadFile(file: UploadedFile, tenantId: string): Promise<UploadResult>;
  deleteFile(filename: string): Promise<void>;
  deleteSegmentImage(url: string, tenantId: string): Promise<void>;
}

class PackageService {
  constructor(
    private uploadService: FileStorage,
    private packageRepo: PackageRepository
  ) {}

  async deletePackage(tenantId: string, id: string): Promise<void> {
    const pkg = await this.packageRepo.findById(tenantId, id);

    // Cleanup (can be mocked in tests)
    if (pkg.photoUrl) {
      await this.uploadService.deleteFile(pkg.photoUrl);
    }

    // Delete database record
    await this.packageRepo.delete(tenantId, id);
  }
}

// In tests
class MockFileStorage implements FileStorage {
  async uploadFile(): Promise<UploadResult> {
    return { url: 'mock-url', filename: 'mock.jpg', size: 1024, mimetype: 'image/jpeg' };
  }

  async deleteFile(): Promise<void> {
    // Mock implementation
  }

  async deleteSegmentImage(): Promise<void> {
    // Mock implementation
  }
}

// In main.ts (DI setup)
const uploadService = new UploadService();
const packageService = new PackageService(uploadService, packageRepo);
```

### Benefits

1. **Testability:** Mock storage in tests
2. **Flexibility:** Switch implementations at runtime
3. **Maintainability:** Dependencies explicit in constructor
4. **Separation of Concerns:** Service doesn't know storage details

---

## Pattern 3: Transaction-Based Cleanup

### Problem

Deletion can fail halfway:

```
1. Delete from database ✅
2. Delete from storage ❌ (network error)
→ Orphaned database record (can't re-upload)
```

### Solution: Database First, Cleanup After

```typescript
async deletePackage(tenantId: string, id: string): Promise<void> {
  // Fetch before delete (can't read after)
  const pkg = await this.packageRepo.findById(tenantId, id);

  // Transaction 1: Delete database (critical, must succeed)
  await this.packageRepo.delete(tenantId, id);

  // Transaction 2: Cleanup storage (can fail, won't block)
  try {
    if (pkg.photoUrl) {
      await this.uploadService.deleteFile(pkg.photoUrl);
    }
  } catch (error) {
    // Log but don't throw
    logger.warn({ error, packageId: id }, 'Storage cleanup failed');
    // Entity is deleted from database
    // File will be found and deleted by cleanup job
  }
}
```

### Flow Diagram

```
┌─────────────────┐
│ Delete Request  │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Fetch Package   │
│ (get photo URL) │
└────────┬────────┘
         ↓
┌─────────────────┐      ┌──────────────────┐
│ Delete from DB  │─────→│ Delete Succeeds  │
└────────┬────────┘      │ Entity is gone   │
         ↓               └──────────────────┘
    ❌ FAILS?
         ↓
    ✅ Return Error
    (transaction rolled back)

         ↓ (if success)
┌─────────────────┐
│ Delete from     │
│ Storage         │
└────────┬────────┘
         ↓
    ❌ FAILS?
         ↓
    Log Error (don't throw)
    File will be cleanup by job
```

---

## Pattern 4: Lazy Orphan Cleanup

### Problem

Real-time cleanup adds latency to every deletion. What if Supabase is slow?

### Solution: Background Job

```typescript
// In services/cleanup.service.ts
export class OrphanCleanupService {
  constructor(
    private uploadService: UploadService,
    private packageRepo: PackageRepository,
    private segmentRepo: SegmentRepository,
    private tenantRepo: TenantRepository
  ) {}

  // Run every hour
  @Cron('0 * * * *')
  async cleanupOrphanedFiles(): Promise<void> {
    logger.info('Starting orphaned file cleanup...');

    const tenants = await this.tenantRepo.findAll();

    for (const tenant of tenants) {
      try {
        const count = await this.cleanupTenantOrphans(tenant.id);
        if (count > 0) {
          logger.info({ tenantId: tenant.id, count }, 'Cleaned up orphaned files');
        }
      } catch (error) {
        logger.error({ tenantId: tenant.id, error }, 'Cleanup failed for tenant');
      }
    }
  }

  private async cleanupTenantOrphans(tenantId: string): Promise<number> {
    let deletedCount = 0;

    // Check packages folder
    deletedCount += await this.cleanupFolder(
      tenantId,
      'packages',
      async (filename) => {
        const exists = await this.packageRepo.findByPhotoFilename(tenantId, filename);
        return !exists;
      }
    );

    // Check segments folder
    deletedCount += await this.cleanupFolder(
      tenantId,
      'segments',
      async (filename) => {
        const exists = await this.segmentRepo.findByImageFilename(tenantId, filename);
        return !exists;
      }
    );

    return deletedCount;
  }

  private async cleanupFolder(
    tenantId: string,
    folder: string,
    isOrphanedFn: (filename: string) => Promise<boolean>
  ): Promise<number> {
    const supabase = this.getSupabaseClient();
    const { data: files } = await supabase.storage
      .from('images')
      .list(`${tenantId}/${folder}`);

    let deletedCount = 0;

    for (const file of files || []) {
      if (await isOrphanedFn(file.name)) {
        try {
          await supabase.storage
            .from('images')
            .remove([`${tenantId}/${folder}/${file.name}`]);
          deletedCount++;
          logger.debug({ tenantId, folder, filename: file.name }, 'Deleted orphaned file');
        } catch (error) {
          logger.warn({ error, tenantId, filename: file.name }, 'Failed to delete orphan');
        }
      }
    }

    return deletedCount;
  }
}

// In app.ts
const cleanupService = new OrphanCleanupService(...);
// Cron job runs automatically
```

### Benefits

1. **No Impact on Deletion Latency:** Cleanup runs separately
2. **Resilient:** If Supabase is slow, deletion still succeeds
3. **Batch Efficient:** Processes many files per run
4. **Per-Tenant Isolation:** Can cleanup one tenant without affecting others

---

## Pattern 5: Multi-Layer Validation

### Problem

Single validation point can be bypassed. Better to validate at multiple layers:

```
Frontend        Route        Service        Storage
                ↓            ↓              ↓
Submit       Size check   Magic bytes    RLS policy
file
```

### Solution: Defense in Depth

**Layer 1: Frontend (UX)**

```typescript
// client/src/features/admin/segments/SegmentForm/HeroFields.tsx
const validateFileSize = (file: File): boolean => {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  return file.size <= MAX_SIZE;
};

const validateFiletype = (file: File): boolean => {
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
  return ALLOWED.includes(file.type);
};

if (!validateFileSize(file)) {
  setError('File too large (max 5MB)');
  return;
}
if (!validateFiletype(file)) {
  setError('Invalid file type (JPEG, PNG, WebP only)');
  return;
}
```

**Layer 2: Route (Protocol)**

```typescript
// server/src/routes/packages.routes.ts
const uploadPhotoSchema = {
  body: z.object({
    file: z.instanceof(Buffer).refine((b) => b.length <= 5 * 1024 * 1024, 'File too large'),
  }),
};

router.post('/packages/:id/upload-photo', validateRequest(uploadPhotoSchema), async (req) => {
  // Multer already validated size via middleware
  const result = await packageService.uploadPhoto(req.tenantId, req.params.id, req.file);
  return { status: 200, body: result };
});
```

**Layer 3: Service (Business Logic)**

```typescript
// server/src/services/upload.service.ts
async uploadPackagePhoto(file: UploadedFile, packageId: string, tenantId?: string): Promise<UploadResult> {
  // Validate file (magic bytes)
  await this.validateFile(file, this.maxPackagePhotoSizeMB);

  // Verify ownership
  const pkg = await this.packageRepo.findById(tenantId, packageId);
  if (!pkg) throw new NotFoundError();

  // Upload
  if (this.isRealMode && tenantId) {
    return this.uploadToSupabase(tenantId, 'packages', filename, file);
  }
  // ... mock mode
}
```

**Layer 4: Storage (Policy)**

```sql
-- Supabase: RLS policy on "images" bucket
-- Only users can upload to their own tenant path
CREATE POLICY "Tenant isolation" ON storage.objects
FOR ALL USING (
  bucket_id = 'images'
  AND auth.uid()::text = (storage.foldername(name))[1] -- first part is tenantId
);

-- Only authenticated users
CREATE POLICY "Authenticated users" ON storage.objects
FOR ALL USING (auth.role() = 'authenticated');
```

### Benefit: Layered Security

Even if one layer is bypassed, others catch the attack:

- Frontend malfunction? → Route validates
- Route vulnerability? → Service validates
- Service compromise? → Storage RLS enforces

---

## Pattern 6: Supabase Bucket Configuration

### Secure Bucket Setup

```typescript
// Supabase Studio Configuration

// 1. Create bucket
const { data: bucket } = await supabase.storage.createBucket('images', {
  public: false,  // PRIVATE bucket (not public)
  fileSizeLimit: 5 * 1024 * 1024, // 5MB max
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
});

// 2. Enable RLS
CREATE POLICY "Enable read for authenticated users with valid token" ON storage.objects
AS SELECT
  CASE
    WHEN bucket_id = 'images' THEN true
    ELSE false
  END
FOR SELECT
USING (auth.role() = 'authenticated');

// 3. Signed URLs only for private access
// When serving files to users:
const { data, error } = await supabase.storage
  .from('images')
  .createSignedUrl(`${tenantId}/logos/logo-123.png`, 3600 * 24 * 365); // 1 year

// Share this signed URL, never the public path
return data.signedUrl;
```

### Why This Matters

| Setting               | Public Bucket      | Private Bucket         |
| --------------------- | ------------------ | ---------------------- |
| **Direct URL Access** | ✅ Anyone can view | ❌ Token required      |
| **Guessable Paths**   | ✅ Easy to access  | ❌ Protected by RLS    |
| **Signed URLs**       | ❌ Not needed      | ✅ Required            |
| **Scaling Cost**      | Higher             | Lower (less bandwidth) |
| **Security**          | ❌ Poor            | ✅ Good                |

---

## Pattern 7: Monitoring & Observability

### Structured Logging

```typescript
// Log all security-relevant events
if (!ALLOWED_TYPES.includes(detectedType.mime)) {
  logger.warn(
    {
      tenantId,
      filename: file.originalname,
      declared: file.mimetype,
      detected: detectedType.mime,
      size: file.size,
      timestamp: new Date().toISOString(),
    },
    'SECURITY: MIME type mismatch detected - possible spoofing attempt'
  );
}

// Cross-tenant access attempt
if (!storagePath.startsWith(`${tenantId}/`)) {
  logger.error(
    {
      tenantId,
      storagePath,
      url,
      timestamp: new Date().toISOString(),
      source: 'file_upload_service',
    },
    'SECURITY: Attempted cross-tenant file deletion blocked'
  );
}

// Cleanup failures (important for ops)
logger.warn(
  {
    tenantId,
    packageId,
    photoFilename,
    error: error.message,
    timestamp: new Date().toISOString(),
    context: 'orphan_cleanup_job',
  },
  'File cleanup failed - will be retried'
);
```

### Monitoring Dashboard

```
File Upload Metrics
─────────────────────────────────────────────────────

Uploads (24h):
├─ Successful: 1,234 ✅
├─ MIME rejections: 3 🔴
├─ Size rejections: 1 🟡
└─ Other errors: 2 🟠

Cross-Tenant Attempts: 0 ✅
Cleanup Failures: 0 ✅
Orphaned Files: 0 ✅

Storage Usage:
├─ Total: 15.3 GB / 100 GB
├─ Logos: 2.1 GB
├─ Package photos: 8.5 GB
└─ Segment images: 4.7 GB

Top Uploaders (by count):
├─ Tenant A: 450 uploads
├─ Tenant B: 380 uploads
└─ Tenant C: 220 uploads
```

---

## Pattern 8: Rate Limiting Strategy

### Token Bucket Algorithm

```typescript
// In middleware/rateLimiter.ts
class RateLimiter {
  private buckets = new Map<string, TokenBucket>();

  getRateLimiter(limit: number, windowSeconds: number) {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = `${req.tenantId}:${req.path}`;

      if (!this.buckets.has(key)) {
        this.buckets.set(key, new TokenBucket(limit, windowSeconds));
      }

      const bucket = this.buckets.get(key)!;

      if (!bucket.consume(1)) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: bucket.getRetryAfter(),
        });
      }

      next();
    };
  }
}

class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillSeconds: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  consume(count: number): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = (elapsed / this.refillSeconds) * this.capacity;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getRetryAfter(): number {
    return Math.ceil(((this.capacity - this.tokens) * this.refillSeconds) / this.capacity);
  }
}

// In routes
router.post(
  '/upload-photo',
  uploadLimiter(10, 60), // 10 uploads per 60 seconds per tenant
  async (req) => {
    // ... handler
  }
);
```

### Limits

| Endpoint      | Limit | Period   | Why                    |
| ------------- | ----- | -------- | ---------------------- |
| Logo upload   | 5     | per hour | Logo changes rare      |
| Package photo | 10    | per hour | Photo uploads moderate |
| Segment image | 10    | per hour | Image uploads moderate |
| Bulk import   | 100   | per day  | Admin operation        |

---

## Summary: Architectural Principles

1. **Dual-Mode Storage:** Same code, different backends (test vs. production)
2. **Dependency Injection:** Make everything testable
3. **Transaction Safety:** Delete DB first, cleanup after
4. **Lazy Cleanup:** Background jobs for orphans
5. **Defense in Depth:** Validate at multiple layers
6. **Bucket Security:** Private buckets, RLS, signed URLs
7. **Observability:** Structured logging, monitoring, alerting
8. **Rate Limiting:** Protect against abuse

Follow these patterns and your file upload system will be **scalable, testable, and secure**.

---

**Last Updated:** November 29, 2025
**Status:** Ready for Production
**Owner:** Engineering Team
