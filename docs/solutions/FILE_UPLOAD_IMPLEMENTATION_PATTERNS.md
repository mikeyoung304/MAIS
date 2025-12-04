# File Upload Implementation Patterns for MAIS

Proven patterns and refactorings for file upload features in the MAIS multi-tenant platform.

---

## Pattern 1: Repository-Based Storage Architecture

### Current Issue

- UploadService is a singleton with no DI
- Tightly coupled to both Supabase and filesystem
- Hard to test with mocks
- Can't easily swap implementations

### Solution: Repository Pattern

```typescript
// lib/ports.ts - Add storage interface

export interface StorageRepository {
  /**
   * Upload file to storage
   * @param tenantId - Tenant ID for path organization
   * @param folder - Folder within tenant ('logos' | 'packages' | 'segments')
   * @param filename - Generated filename (unique, safe)
   * @param content - File content (Buffer)
   * @param mimetype - File MIME type
   * @returns Public or signed URL to access file
   */
  upload(
    tenantId: string,
    folder: 'logos' | 'packages' | 'segments',
    filename: string,
    content: Buffer,
    mimetype: string
  ): Promise<string>;

  /**
   * Delete file from storage
   * @param tenantId - Tenant ID
   * @param folder - Folder within tenant
   * @param filename - Filename to delete
   */
  delete(
    tenantId: string,
    folder: 'logos' | 'packages' | 'segments',
    filename: string
  ): Promise<void>;

  /**
   * Get signed URL for file (valid for 1 hour)
   * Used for private file access
   */
  getSignedUrl(
    tenantId: string,
    folder: 'logos' | 'packages' | 'segments',
    filename: string,
    expiresIn?: number
  ): Promise<string>;
}
```

### Implementation 1: Supabase (Real Mode)

```typescript
// adapters/supabase.storage.ts

export class SupabaseStorageRepository implements StorageRepository {
  private readonly bucket = 'images';

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly logger: Logger
  ) {}

  async upload(
    tenantId: string,
    folder: 'logos' | 'packages' | 'segments',
    filename: string,
    content: Buffer,
    mimetype: string
  ): Promise<string> {
    const path = this.buildPath(tenantId, folder, filename);

    const { error, data } = await this.supabase.storage.from(this.bucket).upload(path, content, {
      contentType: mimetype,
      upsert: false,
      cacheControl: '3600', // Cache for 1 hour
    });

    if (error) {
      this.logger.error(
        { tenantId, folder, filename, error: error.message },
        'Supabase upload failed'
      );
      throw new UploadFailedError(`Failed to upload ${filename}: ${error.message}`);
    }

    // Construct public URL
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      throw new ConfigurationError('SUPABASE_URL not configured');
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${this.bucket}/${path}`;

    this.logger.info({ tenantId, folder, filename, url: publicUrl }, 'File uploaded to Supabase');

    return publicUrl;
  }

  async delete(
    tenantId: string,
    folder: 'logos' | 'packages' | 'segments',
    filename: string
  ): Promise<void> {
    const path = this.buildPath(tenantId, folder, filename);

    const { error } = await this.supabase.storage.from(this.bucket).remove([path]);

    if (error) {
      // Log but don't throw - file may already be deleted
      this.logger.warn(
        { path, error: error.message },
        'Supabase delete failed (file may already be deleted)'
      );
      return;
    }

    this.logger.info({ path }, 'File deleted from Supabase');
  }

  async getSignedUrl(
    tenantId: string,
    folder: 'logos' | 'packages' | 'segments',
    filename: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const path = this.buildPath(tenantId, folder, filename);

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new UrlGenerationError(`Failed to generate signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  private buildPath(tenantId: string, folder: string, filename: string): string {
    return `${tenantId}/${folder}/${filename}`;
  }
}
```

### Implementation 2: Filesystem (Mock Mode)

```typescript
// adapters/filesystem.storage.ts

export class FileSystemStorageRepository implements StorageRepository {
  constructor(
    private readonly baseDir: string,
    private readonly baseUrl: string,
    private readonly logger: Logger
  ) {}

  async upload(
    tenantId: string,
    folder: 'logos' | 'packages' | 'segments',
    filename: string,
    content: Buffer,
    mimetype: string
  ): Promise<string> {
    const filepath = this.buildFilepath(tenantId, folder, filename);

    // Ensure directory exists
    const dir = path.dirname(filepath);
    await fs.promises.mkdir(dir, { recursive: true });

    // Write file
    await fs.promises.writeFile(filepath, content);

    this.logger.info({ filepath, size: content.length }, 'File written to filesystem');

    // Return URL
    return this.buildUrl(tenantId, folder, filename);
  }

  async delete(
    tenantId: string,
    folder: 'logos' | 'packages' | 'segments',
    filename: string
  ): Promise<void> {
    const filepath = this.buildFilepath(tenantId, folder, filename);

    if (!fs.existsSync(filepath)) {
      this.logger.debug({ filepath }, 'File does not exist');
      return;
    }

    await fs.promises.unlink(filepath);
    this.logger.info({ filepath }, 'File deleted from filesystem');
  }

  async getSignedUrl(
    tenantId: string,
    folder: 'logos' | 'packages' | 'segments',
    filename: string
  ): Promise<string> {
    // Filesystem has no real signing - just return public URL
    return this.buildUrl(tenantId, folder, filename);
  }

  private buildFilepath(tenantId: string, folder: string, filename: string): string {
    // Use path.join to prevent traversal attacks
    return path.join(this.baseDir, tenantId, folder, filename);
  }

  private buildUrl(tenantId: string, folder: string, filename: string): string {
    return `${this.baseUrl}/uploads/${tenantId}/${folder}/${filename}`;
  }
}
```

### Dependency Injection Setup

```typescript
// di.ts - Update to use repository pattern

import { createMockContainer } from './di.mock';
import { createRealContainer } from './di.real';

export function createContainer(): Container {
  if (process.env.ADAPTERS_PRESET === 'real') {
    return createRealContainer();
  } else {
    return createMockContainer();
  }
}

// di.real.ts
export function createRealContainer(): Container {
  const supabase = getSupabaseClient();

  const storageRepository = new SupabaseStorageRepository(supabase, logger);

  const uploadService = new UploadService(storageRepository, new FileTypeValidator(), logger);

  return {
    // ... other services
    storageRepository,
    uploadService,
  };
}

// di.mock.ts
export function createMockContainer(): Container {
  const storageRepository = new FileSystemStorageRepository(
    path.join(process.cwd(), 'uploads'),
    'http://localhost:3001',
    logger
  );

  const uploadService = new UploadService(storageRepository, new FileTypeValidator(), logger);

  return {
    // ... other services
    storageRepository,
    uploadService,
  };
}
```

---

## Pattern 2: File Validation with Magic Bytes

### Current Issue

- Only checks MIME type header from multer
- Vulnerable to MIME spoofing
- No protection against ZIP files disguised as images

### Solution: Two-Layer Validation

```typescript
// lib/validators/fileTypeValidator.ts

import { fileTypeFromBuffer } from 'file-type';

export interface DetectedFileType {
  ext: string;
  mime: string;
}

export class FileTypeValidator {
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml',
  ];

  /**
   * Validate file content against allowed MIME types
   * Uses magic bytes to detect actual format, not header
   */
  async validateFileContent(buffer: Buffer, declaredMimetype: string): Promise<DetectedFileType> {
    // Layer 1: Check declared MIME type
    if (!this.allowedMimeTypes.includes(declaredMimetype)) {
      throw new InvalidMimeTypeError(`Declared type "${declaredMimetype}" not allowed`);
    }

    // Layer 2: Detect actual format from magic bytes
    let detected: Awaited<ReturnType<typeof fileTypeFromBuffer>> | undefined;

    try {
      detected = await fileTypeFromBuffer(buffer);
    } catch (error) {
      throw new FileValidationError('Failed to detect file type from content');
    }

    if (!detected) {
      throw new FileValidationError('File content could not be identified - magic bytes missing');
    }

    // Layer 3: Verify detected MIME matches allowed types
    if (!this.allowedMimeTypes.includes(detected.mime)) {
      throw new FileContentMismatchError(
        `File content is "${detected.mime}" but declared as "${declaredMimetype}"`
      );
    }

    // Layer 4: Verify detected MIME matches declared MIME
    if (detected.mime !== declaredMimetype) {
      // Allow some flexibility (e.g., image/jpg vs image/jpeg)
      const isSimilar = this.areSimilarTypes(detected.mime, declaredMimetype);
      if (!isSimilar) {
        throw new MimeSpoofingError(
          `MIME type mismatch: detected "${detected.mime}", declared "${declaredMimetype}"`
        );
      }
    }

    return {
      ext: detected.fileTypeFromBuffer ? `.${detected.ext}` : '.bin',
      mime: detected.mime,
    };
  }

  /**
   * Special validation for SVG files (can contain scripts)
   */
  validateSvgContent(buffer: Buffer): void {
    const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 1000));

    // Check for dangerous SVG patterns
    const dangerousPatterns = [
      /<script/i,
      /onclick/i,
      /onload/i,
      /javascript:/i,
      /<iframe/i,
      /<embed/i,
      /<object/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        throw new SvgSecurityError(`SVG contains potentially dangerous content: ${pattern}`);
      }
    }
  }

  private areSimilarTypes(detected: string, declared: string): boolean {
    // image/jpeg and image/jpg are equivalent
    if (
      (detected === 'image/jpeg' && declared === 'image/jpg') ||
      (detected === 'image/jpg' && declared === 'image/jpeg')
    ) {
      return true;
    }

    return detected === declared;
  }
}
```

### Usage in UploadService

```typescript
// services/upload.service.ts

export class UploadService {
  constructor(
    private readonly storageRepository: StorageRepository,
    private readonly fileTypeValidator: FileTypeValidator,
    private readonly logger: Logger
  ) {}

  async uploadLogo(tenantId: string, file: UploadedFile): Promise<UploadResult> {
    try {
      // Validate file
      const validation = await this.validateFileForUpload(
        file,
        'logo',
        2 // 2MB limit
      );

      // Generate filename
      const filename = this.generateFilename(file.originalname, 'logo');

      // Upload
      const url = await this.storageRepository.upload(
        tenantId,
        'logos',
        filename,
        file.buffer,
        validation.mime
      );

      return {
        url,
        filename,
        size: file.size,
        mimetype: validation.mime,
      };
    } catch (error) {
      this.logger.error({ tenantId, error }, 'Logo upload failed');
      throw error;
    }
  }

  private async validateFileForUpload(
    file: UploadedFile,
    uploadType: 'logo' | 'photo' | 'hero',
    maxSizeMB: number
  ): Promise<DetectedFileType> {
    // Size validation
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new FileSizeExceededError(maxSizeMB);
    }

    // Buffer validation
    if (!file.buffer || file.buffer.length === 0) {
      throw new EmptyFileError();
    }

    // Content validation (two-layer)
    const detected = await this.fileTypeValidator.validateFileContent(file.buffer, file.mimetype);

    // SVG special handling
    if (detected.mime === 'image/svg+xml') {
      this.fileTypeValidator.validateSvgContent(file.buffer);
    }

    return detected;
  }

  private generateFilename(originalName: string, prefix: string): string {
    // Only use extension from originalName (prevents path traversal)
    const ext = path.extname(originalName);

    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(8).toString('hex');

    return `${prefix}-${timestamp}-${randomStr}${ext}`;
  }
}
```

---

## Pattern 3: Tenant-Scoped File Management with Database Tracking

### Current Issue

- Files uploaded but not tracked in database
- Can't cascade delete files when entity deleted
- Orphaned files accumulate
- No ownership verification before deletion

### Solution: Database-Backed File Management

```typescript
// prisma/schema.prisma

model UploadedFile {
  id String @id @default(cuid())
  tenantId String
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  // File metadata
  filename String @db.VarChar(255)
  folder String @db.VarChar(50) // 'logos' | 'packages' | 'segments'
  mimetype String @db.VarChar(100)
  size Int // bytes
  url String @db.Text // Public or signed URL

  // Relationship to entity
  packageId String?
  package Package? @relation(fields: [packageId], references: [id], onDelete: Cascade)

  segmentId String?
  segment Segment? @relation(fields: [segmentId], references: [id], onDelete: Cascade)

  // Metadata
  uploadedAt DateTime @default(now())
  createdBy String? // User ID who uploaded
  expiresAt DateTime? // For temporary uploads

  @@unique([tenantId, folder, filename]) // Prevent duplicates per tenant
  @@index([tenantId, folder])
  @@index([tenantId, packageId])
  @@index([tenantId, segmentId])
}

model Package {
  id String @id @default(cuid())
  tenantId String

  // ... existing fields

  photos UploadedFile[] // Cascade delete when package deleted
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, slug])
  @@index([tenantId])
}

model Segment {
  id String @id @default(cuid())
  tenantId String

  // ... existing fields

  heroImage UploadedFile? // Cascade delete when segment deleted
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, slug])
  @@index([tenantId])
}
```

### Service with Database Tracking

```typescript
// services/upload.service.ts (Enhanced)

export class UploadService {
  constructor(
    private readonly storageRepository: StorageRepository,
    private readonly fileTypeValidator: FileTypeValidator,
    private readonly db: PrismaClient,
    private readonly logger: Logger
  ) {}

  async uploadPackagePhoto(
    tenantId: string,
    packageId: string,
    file: UploadedFile
  ): Promise<UploadResult> {
    // Verify package exists and belongs to tenant
    const pkg = await this.db.package.findFirst({
      where: { id: packageId, tenantId },
    });

    if (!pkg) {
      throw new PackageNotFoundError();
    }

    try {
      // Validate file
      const detected = await this.validateFileForUpload(file, 'photo', 5);

      // Generate filename
      const filename = this.generateFilename(file.originalname, 'package');

      // Upload to storage
      const url = await this.storageRepository.upload(
        tenantId,
        'packages',
        filename,
        file.buffer,
        detected.mime
      );

      // Track in database (with cascade delete)
      await this.db.uploadedFile.create({
        data: {
          tenantId,
          filename,
          folder: 'packages',
          mimetype: detected.mime,
          size: file.size,
          url,
          packageId,
          createdBy: this.getCurrentUserId(), // Optional: track who uploaded
        },
      });

      this.logger.info({ tenantId, packageId, filename }, 'Package photo uploaded and tracked');

      return {
        url,
        filename,
        size: file.size,
        mimetype: detected.mime,
      };
    } catch (error) {
      this.logger.error({ tenantId, packageId, error }, 'Photo upload failed');
      throw error;
    }
  }

  /**
   * Delete file with ownership verification
   * Database cascade will clean up relations
   */
  async deleteFile(
    tenantId: string,
    folder: 'logos' | 'packages' | 'segments',
    filename: string
  ): Promise<void> {
    try {
      // Query database to verify ownership
      const file = await this.db.uploadedFile.findFirst({
        where: { tenantId, folder, filename },
      });

      if (!file) {
        throw new FileNotFoundError(`File ${filename} not found in ${folder}`);
      }

      // Delete from storage
      await this.storageRepository.delete(tenantId, folder, filename);

      // Delete from database (cascade cleanup happens automatically)
      await this.db.uploadedFile.delete({
        where: { id: file.id },
      });

      this.logger.info({ tenantId, folder, filename }, 'File deleted successfully');
    } catch (error) {
      this.logger.error({ tenantId, folder, filename, error }, 'Delete failed');
      throw error;
    }
  }

  /**
   * Get all files for a tenant
   */
  async getTenantFiles(tenantId: string, folder?: 'logos' | 'packages' | 'segments') {
    return this.db.uploadedFile.findMany({
      where: folder ? { tenantId, folder } : { tenantId },
    });
  }

  /**
   * Find orphaned files (uploaded but not linked to entity)
   */
  async findOrphanedFiles(tenantId: string) {
    return this.db.uploadedFile.findMany({
      where: {
        tenantId,
        AND: [{ packageId: null }, { segmentId: null }],
      },
    });
  }

  /**
   * Clean up expired or orphaned files
   */
  async cleanupOrphanedFiles(tenantId: string) {
    const orphaned = await this.findOrphanedFiles(tenantId);

    for (const file of orphaned) {
      try {
        await this.deleteFile(tenantId, file.folder as any, file.filename);
      } catch (error) {
        this.logger.warn(
          { tenantId, file: file.filename, error },
          'Failed to cleanup orphaned file'
        );
      }
    }

    this.logger.info({ tenantId, count: orphaned.length }, 'Orphaned files cleaned up');
  }

  private getCurrentUserId(): string | undefined {
    // Implement based on context (req.user.id, etc.)
    return undefined;
  }
}
```

---

## Pattern 4: Rate Limiting for Uploads

### Current Issue

- No rate limiting on upload endpoints
- Single tenant can exhaust quota
- Concurrent uploads can cause memory exhaustion

### Solution: Middleware-Based Rate Limiting

```typescript
// middleware/uploadRateLimiter.ts

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from 'redis';

// For development (memory store)
const createMemoryLimiter = () => {
  return rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 uploads per minute per tenant
    message: 'Upload rate limit exceeded. Please wait before uploading again.',
    standardHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => {
      // Use tenantId if available, fallback to IP
      const tenantId = res.locals.tenantAuth?.tenantId;
      return tenantId ? `uploads:${tenantId}` : `uploads:${req.ip}`;
    },
  });
};

// For production (Redis store for distributed rate limiting)
const createRedisLimiter = () => {
  const client = redis.createClient({
    url: process.env.REDIS_URL,
  });

  return rateLimit({
    store: new RedisStore({
      client,
      prefix: 'uploads:', // Key format: uploads:tenant_id
      expiry: 60,
    }),
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: 'Upload rate limit exceeded. Please wait before uploading again.',
    keyGenerator: (req) => {
      const tenantId = req.tenantAuth?.tenantId;
      return tenantId || req.ip;
    },
  });
};

export const uploadRateLimiter = process.env.REDIS_URL
  ? createRedisLimiter()
  : createMemoryLimiter();

/**
 * Separate, stricter limiter for file size quota (e.g., 100MB per day per tenant)
 */
export const uploadQuotaLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 100 * 1024 * 1024, // 100MB per day (this is just a counter)
  keyGenerator: (req) => `quota:${req.tenantAuth?.tenantId || req.ip}`,
  // Custom skip/handler to accumulate bytes instead of just counting requests
});
```

### Route Integration

```typescript
// routes/tenant-admin.routes.ts

import { uploadRateLimiter } from '../middleware/uploadRateLimiter';

const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
    files: 1, // Single file only
  },
});

/**
 * POST /v1/tenant-admin/logo
 * Upload tenant logo
 *
 * Rate limit: 10 uploads/minute per tenant
 * File limit: 2MB
 */
router.post(
  '/logo',
  uploadRateLimiter, // Apply rate limiter first
  uploadLogo.single('file'),
  handleMulterError,
  async (req: Request, res: Response) => {
    const tenantAuth = res.locals.tenantAuth;

    if (!tenantAuth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
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
          error: 'File size exceeds 2MB limit',
        });
      }

      if (error instanceof InvalidMimeTypeError) {
        return res.status(400).json({
          error: 'Invalid file type. Allowed: JPG, PNG, WebP, SVG',
        });
      }

      if (error instanceof MimeSpoofingError) {
        return res.status(400).json({
          error: 'File content does not match file type',
        });
      }

      container.logger.error({ tenantId: tenantAuth.tenantId, error }, 'Logo upload failed');

      return res.status(500).json({
        error: 'Upload failed. Please try again.',
      });
    }
  }
);
```

---

## Pattern 5: Proper Error Handling

### Current Issue

- Generic error messages don't distinguish between issues
- Some errors leak internal details
- No clear HTTP status codes

### Solution: Domain Errors with Mapping

```typescript
// lib/errors/uploadErrors.ts

/**
 * Base class for upload-related errors
 */
export abstract class UploadError extends Error {
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      type: this.name,
    };
  }
}

export class FileSizeExceededError extends UploadError {
  readonly statusCode = 413; // Payload Too Large

  constructor(maxSizeMB: number) {
    super(`File size exceeds ${maxSizeMB}MB limit`);
  }
}

export class InvalidMimeTypeError extends UploadError {
  readonly statusCode = 400; // Bad Request

  constructor() {
    super('Invalid file type');
  }
}

export class MimeSpoofingError extends UploadError {
  readonly statusCode = 400; // Bad Request

  constructor(message: string) {
    super(`File content validation failed: ${message}`);
  }
}

export class EmptyFileError extends UploadError {
  readonly statusCode = 400; // Bad Request

  constructor() {
    super('File is empty');
  }
}

export class FileNotFoundError extends UploadError {
  readonly statusCode = 404; // Not Found

  constructor(filename?: string) {
    super(filename ? `File not found: ${filename}` : 'File not found');
  }
}

export class FileContentMismatchError extends UploadError {
  readonly statusCode = 400; // Bad Request

  constructor(message: string) {
    super(`File validation failed: ${message}`);
  }
}

export class SvgSecurityError extends UploadError {
  readonly statusCode = 400; // Bad Request

  constructor(message: string) {
    super(`SVG validation failed: ${message}`);
  }
}

export class UploadFailedError extends UploadError {
  readonly statusCode = 500; // Internal Server Error

  constructor(message: string) {
    super(`Upload failed: ${message}`);
  }
}

export class PackageNotFoundError extends UploadError {
  readonly statusCode = 404; // Not Found

  constructor() {
    super('Package not found');
  }
}
```

### Error Handler Middleware

```typescript
// middleware/errorHandler.ts

export const uploadErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const logger = container.logger;

  if (error instanceof UploadError) {
    // Known upload error - return appropriate status code
    logger.warn(
      {
        tenantId: res.locals.tenantAuth?.tenantId,
        error: error.name,
        message: error.message,
      },
      'Upload error'
    );

    return res.status(error.statusCode).json({
      error: error.message,
    });
  }

  if (error.message.includes('Unexpected field')) {
    // Multer error - wrong field name
    logger.warn({ error: error.message }, 'Multer validation error');

    return res.status(400).json({
      error: 'Invalid form field',
    });
  }

  if (error.message.includes('File too large')) {
    // Multer size error
    logger.warn({ error: error.message }, 'File too large');

    return res.status(413).json({
      error: 'File is too large',
    });
  }

  // Unknown error - log and return generic message
  logger.error(
    {
      tenantId: res.locals.tenantAuth?.tenantId,
      error: error.message,
      stack: error.stack,
    },
    'Unexpected upload error'
  );

  return res.status(500).json({
    error: 'An unexpected error occurred during upload',
  });
};
```

---

## Summary

These patterns provide:

1. **Repository Pattern** - Swappable storage implementations (Supabase ↔ Filesystem)
2. **Magic Byte Validation** - Protection against MIME spoofing
3. **Database Tracking** - File-to-entity relationship and cascade deletion
4. **Rate Limiting** - Prevention of quota exhaustion and memory attacks
5. **Proper Error Handling** - Clear errors with appropriate HTTP status codes

When implementing file uploads, apply all five patterns to ensure:

- Security (tenant isolation, MIME validation, ownership verification)
- Reliability (cascade deletion, orphaned file detection)
- Maintainability (dependency injection, clear error handling)
- Testability (mockable repository, isolated validation logic)
- Performance (rate limiting, proper resource management)
