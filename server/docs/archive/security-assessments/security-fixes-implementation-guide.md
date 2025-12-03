# Logo Upload Security - Implementation Fixes

## Fix 1: Add Magic Number Validation (CRITICAL)

### Current Code
```typescript
// server/src/services/upload.service.ts - Lines 71-90
private validateFile(file: UploadedFile, maxSizeMB?: number): void {
  const maxSize = maxSizeMB || this.maxFileSizeMB;
  const maxSizeBytes = maxSize * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(`File size exceeds maximum of ${maxSize}MB`);
  }

  // VULNERABLE: Only checks MIME type from client
  if (!this.allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(
      `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`
    );
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw new Error('File buffer is empty');
  }
}
```

### Fixed Code
```typescript
import FileType from 'file-type';

private validateFile(file: UploadedFile, maxSizeMB?: number): void {
  // Check file size
  const maxSize = maxSizeMB || this.maxFileSizeMB;
  const maxSizeBytes = maxSize * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(`File size exceeds maximum of ${maxSize}MB`);
  }

  // Check buffer exists
  if (!file.buffer || file.buffer.length === 0) {
    throw new Error('File buffer is empty');
  }

  // CRITICAL: Validate MIME type from client (defense in depth)
  if (!this.allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(
      `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`
    );
  }

  // NEW: Validate actual file magic numbers
  this.validateFileContent(file);
}

// NEW: Validate file content using magic numbers
private async validateFileContent(file: UploadedFile): Promise<void> {
  try {
    const fileType = await FileType.fromBuffer(file.buffer);
    
    if (!fileType) {
      throw new Error('Unable to determine file type (empty or unsupported)');
    }

    // Whitelist of allowed MIME types from actual file content
    const allowedContentTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      // Remove image/svg+xml as it can contain scripts
    ];

    if (!allowedContentTypes.includes(fileType.mime)) {
      throw new Error(
        `Invalid file type detected: ${fileType.mime}. ` +
        `File claims to be ${file.mimetype} but contains ${fileType.mime} data`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid file type')) {
      throw error;
    }
    throw new Error('File validation failed: unable to verify file integrity');
  }
}
```

### Installation
```bash
npm install file-type
npm install --save-dev @types/file-type
```

### Update package.json
```json
{
  "dependencies": {
    "file-type": "^18.5.0"
  }
}
```

---

## Fix 2: Add Virus Scanning (CRITICAL)

### Option A: ClamAV Integration (Recommended for production)

```typescript
import NodeClam from 'clamscan';

export class UploadService {
  private clamscan: NodeClam | null = null;

  constructor() {
    // ... existing code ...
    this.initializeClamAV();
  }

  private async initializeClamAV(): Promise<void> {
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CLAMAV === 'true') {
      try {
        const clamscan = await new NodeClam().init({
          clamdscan: {
            host: process.env.CLAMAV_HOST || 'localhost',
            port: parseInt(process.env.CLAMAV_PORT || '3310'),
          },
        });
        this.clamscan = clamscan;
        logger.info('ClamAV virus scanner initialized');
      } catch (error) {
        logger.warn(
          'ClamAV not available, continuing without virus scanning. ' +
          'This is acceptable for development but NOT for production.'
        );
      }
    }
  }

  async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
    try {
      // Validate file
      await this.validateFile(file);

      // NEW: Scan for viruses
      if (this.clamscan) {
        const scanResult = await this.clamscan.scanBuffer(file.buffer);
        if (scanResult.isInfected) {
          logger.warn(
            { tenantId, detections: scanResult.viruses },
            'Malicious file rejected'
          );
          throw new Error(
            'File failed security scanning - malware detected'
          );
        }
      }

      // ... rest of existing code ...
    } catch (error) {
      logger.error({ error, tenantId }, 'Error uploading logo');
      throw error;
    }
  }
}
```

### Option B: VirusTotal Integration (Cloud-based)

```typescript
import axios from 'axios';

export class UploadService {
  private virusTotalApiKey: string | undefined;

  constructor() {
    // ... existing code ...
    this.virusTotalApiKey = process.env.VIRUSTOTAL_API_KEY;
  }

  private async scanWithVirusTotal(buffer: Buffer): Promise<boolean> {
    if (!this.virusTotalApiKey) {
      return true; // Skip scanning if API key not configured
    }

    try {
      const formData = new FormData();
      formData.append('file', new Blob([buffer]));

      const response = await axios.post(
        'https://www.virustotal.com/api/v3/files',
        formData,
        {
          headers: {
            'x-apikey': this.virusTotalApiKey,
            ...formData.getHeaders(),
          },
        }
      );

      const fileId = response.data.data.id;

      // Check analysis results
      const analysisResponse = await axios.get(
        `https://www.virustotal.com/api/v3/files/${fileId}`,
        {
          headers: { 'x-apikey': this.virusTotalApiKey },
        }
      );

      const stats = analysisResponse.data.data.attributes.last_analysis_stats;
      const hasThreats = stats.malicious > 0 || stats.suspicious > 0;

      if (hasThreats) {
        logger.warn(
          { stats },
          'File marked as suspicious/malicious by VirusTotal'
        );
      }

      return !hasThreats;
    } catch (error) {
      logger.warn({ error }, 'VirusTotal scanning failed, allowing upload');
      return true; // Don't block on scanning failures
    }
  }

  async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
    try {
      // Validate file
      await this.validateFile(file);

      // NEW: Scan for viruses
      const isSafe = await this.scanWithVirusTotal(file.buffer);
      if (!isSafe) {
        throw new Error('File failed security scanning - malware detected');
      }

      // ... rest of existing code ...
    } catch (error) {
      logger.error({ error, tenantId }, 'Error uploading logo');
      throw error;
    }
  }
}
```

### Installation
```bash
# Option A: ClamAV
npm install clamscan

# Option B: VirusTotal
npm install axios
```

### Environment Configuration
```bash
# .env file
ENABLE_CLAMAV=true
CLAMAV_HOST=localhost
CLAMAV_PORT=3310

# OR

VIRUSTOTAL_API_KEY=your_api_key_here
```

---

## Fix 3: Implement Upload-Specific Rate Limiting (HIGH)

### Current Code
```typescript
// server/src/middleware/rateLimiter.ts - Missing upload limiter
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120, // Too generous for file uploads
});
```

### Fixed Code
```typescript
// server/src/middleware/rateLimiter.ts - Add this new limiter

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10, // 10 uploads per hour per tenant
  keyGenerator: (req, res) => {
    // Rate limit by tenant ID instead of IP
    const tenantId = res.locals.tenantAuth?.tenantId || 'unknown';
    return tenantId;
  },
  skip: (req) => !req.file, // Only count requests with files
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'upload_rate_limit_exceeded',
      message: 'Too many uploads. Maximum 10 per hour per tenant.',
      retryAfter: 3600,
    }),
});

// Separate limiter for package photos (more lenient)
export const packagePhotoUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 20, // 20 photo uploads per hour per tenant
  keyGenerator: (req, res) => {
    const tenantId = res.locals.tenantAuth?.tenantId || 'unknown';
    return `${tenantId}:packages`;
  },
  skip: (req) => !req.file,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      error: 'package_photo_upload_rate_limit_exceeded',
      message: 'Too many photo uploads. Maximum 20 per hour.',
      retryAfter: 3600,
    }),
});
```

### Update Routes
```typescript
// server/src/routes/tenant-admin.routes.ts - Lines 241-245

import { uploadLimiter, packagePhotoUploadLimiter } from '../middleware/rateLimiter';

// NEW: Apply upload-specific rate limiting
router.post(
  '/logo',
  uploadLimiter, // Add this line
  upload.single('logo'),
  (req, res) => controller.uploadLogo(req, res)
);

// NEW: Apply package photo-specific rate limiting
router.post(
  '/packages/:id/photos',
  packagePhotoUploadLimiter, // Add this line
  uploadPackagePhoto.single('photo'),
  handleMulterError,
  async (req: Request, res: Response, next: NextFunction) => {
    // ... existing code ...
  }
);
```

---

## Fix 4: Fix File Permissions (MEDIUM)

### Current Code
```typescript
// server/src/services/upload.service.ts - Lines 61-66 (Bad permissions)
private ensureUploadDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    // Creates directory with 0755 permissions (world-readable)
    logger.info({ uploadDir: dir }, 'Created upload directory');
  }
}

// Lines 118 and 159 (Bad file permissions)
await fs.promises.writeFile(filepath, file.buffer);
// Creates files with 0644 permissions (world-readable)
```

### Fixed Code
```typescript
private ensureUploadDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    // FIX: Create with restrictive permissions (owner only)
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    logger.info({ uploadDir: dir }, 'Created upload directory with 0700 permissions');
  }
}

async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
  try {
    // ... validation ...
    const filepath = path.join(this.logoUploadDir, filename);
    
    // FIX: Write file with restrictive permissions (owner only)
    await fs.promises.writeFile(filepath, file.buffer, { mode: 0o600 });
    
    // ... rest of code ...
  }
}

async uploadPackagePhoto(file: UploadedFile, packageId: string): Promise<UploadResult> {
  try {
    // ... validation ...
    const filepath = path.join(this.packagePhotoUploadDir, filename);
    
    // FIX: Write file with restrictive permissions (owner only)
    await fs.promises.writeFile(filepath, file.buffer, { mode: 0o600 });
    
    // ... rest of code ...
  }
}
```

### Verify Permissions
```bash
# After fix, check:
ls -la /uploads/logos/
# Should show: drwx------ (0700 for directory)
# Files should show: -rw------- (0600)

# Before fix showed:
# drwxr-xr-x (0755) - WORLD READABLE
# -rw-r--r-- (0644) - WORLD READABLE
```

---

## Fix 5: Add Security Headers for Uploaded Files (MEDIUM)

### Current Code
```typescript
// server/src/app.ts - Lines 87-93
app.use('/uploads/logos', express.static(logoUploadDir));
app.use('/uploads/packages', express.static(packagePhotoUploadDir));
```

### Fixed Code
```typescript
// server/src/app.ts

// Middleware to add security headers to uploaded files
function addSecurityHeadersToUploads(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing - browsers must respect Content-Type
  res.set('X-Content-Type-Options', 'nosniff');

  // Prevent framing attacks
  res.set('X-Frame-Options', 'DENY');

  // Prevent XSS attacks in older browsers
  res.set('X-XSS-Protection', '1; mode=block');

  // Prevent referrer leaking
  res.set('Referrer-Policy', 'no-referrer');

  // Restrict content policy
  res.set('Content-Security-Policy', "default-src 'none'; object-src 'none'");

  // Optional: Force download instead of inline display
  // Useful if you want to prevent execution
  res.set('Content-Disposition', 'inline'); // Change to 'attachment' if needed

  next();
}

// Apply to logo uploads
app.use(
  '/uploads/logos',
  addSecurityHeadersToUploads,
  express.static(logoUploadDir)
);

// Apply to package photos
app.use(
  '/uploads/packages',
  addSecurityHeadersToUploads,
  express.static(packagePhotoUploadDir)
);

logger.info('Security headers configured for uploaded files');
```

### Verify Headers
```bash
curl -I http://localhost:5000/uploads/logos/logo-123456-abc123.jpg

# Should see:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Content-Security-Policy: default-src 'none'; object-src 'none'
```

---

## Fix 6: Remove SVG Upload Support (HIGH)

### Current Code
```typescript
// server/src/services/upload.service.ts - Lines 44-50
private allowedMimeTypes: string[] = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/svg+xml', // VULNERABLE: Can contain scripts
  'image/webp',
];
```

### Option A: Remove SVG (Recommended)
```typescript
private allowedMimeTypes: string[] = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  // image/svg+xml removed - can contain embedded scripts
];
```

### Option B: Handle SVG Safely (If SVG support needed)
```typescript
private allowedMimeTypes: string[] = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml', // With special handling
];

// Add SVG sanitization
import DOMPurify from 'isomorphic-dompurify';

private sanitizeSVG(svgBuffer: Buffer): Buffer {
  const svgString = svgBuffer.toString('utf-8');
  const clean = DOMPurify.sanitize(svgString, { USE_PROFILES: { svg: true } });
  return Buffer.from(clean);
}

async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
  try {
    // ... validation ...
    
    // If SVG, sanitize it
    let fileBuffer = file.buffer;
    if (file.mimetype === 'image/svg+xml') {
      fileBuffer = this.sanitizeSVG(file.buffer);
    }

    const filepath = path.join(this.logoUploadDir, filename);
    await fs.promises.writeFile(filepath, fileBuffer);
    
    // ... rest of code ...
  }
}
```

### Installation (if using Option B)
```bash
npm install isomorphic-dompurify
npm install --save-dev @types/isomorphic-dompurify
```

---

## Fix 7: Implement Storage Quota per Tenant (MEDIUM)

### New Service: StorageQuotaService
```typescript
// server/src/services/storage-quota.service.ts

import { PrismaClient } from '../generated/prisma';

export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
  percentageUsed: number;
}

export class StorageQuotaService {
  private readonly prisma: PrismaClient;
  private readonly defaultLimitMB: number = 100; // 100MB per tenant

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getStorageUsage(tenantId: string): Promise<StorageUsage> {
    // Get all files for this tenant
    const uploads = await this.prisma.upload.findMany({
      where: { tenantId },
    });

    const usedBytes = uploads.reduce((sum, u) => sum + u.sizeBytes, 0);
    const limitBytes = this.defaultLimitMB * 1024 * 1024;

    return {
      usedBytes,
      limitBytes,
      percentageUsed: Math.round((usedBytes / limitBytes) * 100),
    };
  }

  async checkQuota(tenantId: string, fileSizeBytes: number): Promise<boolean> {
    const usage = await this.getStorageUsage(tenantId);
    return usage.usedBytes + fileSizeBytes <= usage.limitBytes;
  }

  async enforceQuota(tenantId: string, fileSizeBytes: number): Promise<void> {
    const hasQuota = await this.checkQuota(tenantId, fileSizeBytes);
    if (!hasQuota) {
      const usage = await this.getStorageUsage(tenantId);
      throw new Error(
        `Storage quota exceeded. Current: ${Math.round(usage.usedBytes / 1024 / 1024)}MB / ` +
        `${Math.round(usage.limitBytes / 1024 / 1024)}MB`
      );
    }
  }
}
```

### Update UploadService
```typescript
// server/src/services/upload.service.ts

import { StorageQuotaService } from './storage-quota.service';

export class UploadService {
  private quotaService: StorageQuotaService;

  constructor(quotaService: StorageQuotaService) {
    this.quotaService = quotaService;
    // ... rest of constructor ...
  }

  async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
    try {
      // NEW: Check storage quota before upload
      await this.quotaService.enforceQuota(tenantId, file.size);

      // ... existing validation and upload ...
    } catch (error) {
      logger.error({ error, tenantId }, 'Error uploading logo');
      throw error;
    }
  }

  async uploadPackagePhoto(file: UploadedFile, packageId: string): Promise<UploadResult> {
    try {
      // Get tenant ID from package
      const pkg = await this.catalogService.getPackageById(tenantId, packageId);
      
      // NEW: Check storage quota before upload
      await this.quotaService.enforceQuota(pkg.tenantId, file.size);

      // ... existing validation and upload ...
    } catch (error) {
      logger.error({ error, packageId }, 'Error uploading package photo');
      throw error;
    }
  }
}
```

---

## Fix 8: Update Multer Configuration (MINOR)

### Current Code
```typescript
// server/src/routes/tenant-admin.routes.ts - Lines 30-43
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB for logos
  },
  // MISSING: fileFilter
});
```

### Fixed Code
```typescript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB for logos
  },
  // NEW: Add file filter for early rejection
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new Error(
        `Invalid file type: ${file.mimetype}. ` +
        `Allowed: ${allowedMimeTypes.join(', ')}`
      ));
    } else {
      cb(null, true);
    }
  },
});

const uploadPackagePhoto = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for package photos
  },
  // NEW: Add file filter
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new Error(
        `Invalid file type: ${file.mimetype}. ` +
        `Allowed: ${allowedMimeTypes.join(', ')}`
      ));
    } else {
      cb(null, true);
    }
  },
});
```

---

## Testing the Fixes

### Test 1: Magic Number Validation
```bash
# Create fake image (executable content with image MIME type)
echo -e 'MZ\x90\x00' > fake_image.jpg

# Should now be rejected
curl -F "logo=@fake_image.jpg;type=image/jpeg" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/v1/tenant/admin/logo

# Expected: 400 Bad Request - Invalid file type detected
```

### Test 2: Rate Limiting
```bash
# Try uploading 11 times in an hour
for i in {1..11}; do
  curl -F "logo=@test.jpg" \
    -H "Authorization: Bearer $TOKEN" \
    http://localhost:5000/v1/tenant/admin/logo
done

# 11th request should return 429 Too Many Requests
```

### Test 3: File Permissions
```bash
# Check directory permissions
ls -la /uploads/logos/
# Should show: drwx------

# Check file permissions
ls -la /uploads/logos/logo-*.jpg
# Should show: -rw-------
```

### Test 4: Security Headers
```bash
curl -I http://localhost:5000/uploads/logos/logo-test.jpg | grep -E "X-Content-Type|X-Frame|CSP"

# Should see:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Content-Security-Policy: default-src 'none'
```

### Test 5: Storage Quota
```bash
# Try uploading file that exceeds quota
# (Adjust limit to test - e.g., set to 1MB)
curl -F "logo=@large_file.jpg" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/v1/tenant/admin/logo

# Should return: 413 Payload Too Large - Storage quota exceeded
```

---

## Deployment Checklist

- [ ] Install file-type package
- [ ] Install virus scanning (ClamAV or VirusTotal)
- [ ] Update upload.service.ts with magic number validation
- [ ] Update upload.service.ts with virus scanning
- [ ] Add uploadLimiter to rateLimiter.ts
- [ ] Update tenant-admin.routes.ts to use rate limiters
- [ ] Fix file/directory permissions in upload.service.ts
- [ ] Add security headers middleware in app.ts
- [ ] Remove SVG from allowed MIME types or sanitize
- [ ] Implement StorageQuotaService
- [ ] Update Multer fileFilter configuration
- [ ] Run security tests
- [ ] Update error messages for clarity
- [ ] Add logging for security events
- [ ] Setup monitoring/alerts for upload attempts
- [ ] Document changes in changelog
- [ ] Update API documentation
- [ ] Test in staging environment
- [ ] Deploy to production

---

## Rollback Plan

If issues occur during deployment:

1. **Keep previous upload.service.ts backed up**
2. **Have database rollback plan for quota table**
3. **Monitor error rates post-deployment**
4. **Keep git history for quick revert**: `git revert <commit-hash>`

## Monitoring After Deployment

```typescript
// Add metrics tracking
logger.info({
  event: 'file_upload',
  tenantId,
  filename,
  fileSize,
  uploadDuration: Date.now() - startTime,
  magicNumberValid: true,
  virusScanResult: 'clean',
  rateLimitRemaining: 10 - 1,
  storageUsagePercent: 45,
}, 'File uploaded successfully');
```

