# Logo Upload Security - Quick Reference

## Risk Matrix

```
                    CRITICAL         HIGH            MEDIUM          LOW
                    --------         ----            ------          ---

FILE VALIDATION     No Magic #       SVG XSS         Double Ext      -
                    No Virus Scan    MIME Spoofing   Ext Parsing

RATE LIMITING       -                -               No Upload       -
                                                     Specific Limit

FILE PERMISSIONS    -                -               Dir: 0755        -
                                                     File: 0644

STORAGE             -                -               No Quota        Env Var
                                                                      Config

HEADERS             -                -               Missing          -
                                                     Security

ISOLATION           PASS ✓           -               -               -
AUTHENTICATION      PASS ✓           -               -               -
PATH TRAVERSAL      PASS ✓           -               -               -
```

## Upload Flow Security Checklist

```
1. Client sends file
   └─ MIME type: User-controlled ❌

2. Multer middleware
   └─ Size limit: 2MB ✓
   └─ File filter: MISSING ❌

3. Service validation
   └─ MIME type check: Client-based only ❌
   └─ Magic number validation: MISSING ❌
   └─ Virus scan: MISSING ❌
   └─ Buffer check: ✓

4. Filename generation
   └─ Path traversal protection: ✓
   └─ Extension from original: Risky ⚠️
   └─ Randomization: Strong ✓

5. File storage
   └─ Directory permissions: 0755 (WORLD-READABLE) ❌
   └─ File permissions: 0644 (WORLD-READABLE) ❌
   └─ Location: Local filesystem ⚠️

6. Static serving
   └─ Authentication: NONE ⚠️
   └─ Security headers: MISSING ❌
   └─ Content-Disposition: NOT SET ⚠️

7. Rate limiting
   └─ Request limit: 120/15min ⚠️
   └─ Upload specific: MISSING ❌
   └─ Per-user quota: MISSING ❌
```

## Vulnerability Quick Reference

| Issue                      | Severity | Impact                | Fix Time |
| -------------------------- | -------- | --------------------- | -------- |
| No magic number validation | CRITICAL | Arbitrary file upload | 2 hours  |
| No virus scanning          | CRITICAL | Malware distribution  | 4 hours  |
| MIME type spoofing         | HIGH     | Bypass validation     | 1 hour   |
| SVG XSS vectors            | HIGH     | Script execution      | 1 hour   |
| Weak file permissions      | MEDIUM   | Privacy leak          | 30 min   |
| No upload rate limit       | MEDIUM   | Disk exhaustion       | 1 hour   |
| Missing security headers   | MEDIUM   | MIME sniffing attacks | 30 min   |

## Code Quality Scores

```
Authentication:        █████████░ 95%  STRONG
Authorization:         █████████░ 95%  STRONG
Path Traversal:        █████████░ 95%  STRONG
File Size Validation:  ████████░░ 85%  GOOD
MIME Type Checking:    ██████░░░░ 60%  WEAK
File Content Verify:   ██░░░░░░░░ 20%  CRITICAL
Rate Limiting:         ████░░░░░░ 40%  WEAK
Virus Scanning:        █░░░░░░░░░ 5%   MISSING
File Permissions:      ███░░░░░░░ 30%  WEAK
Security Headers:      ███░░░░░░░ 30%  WEAK
```

## Tenant Isolation Security

```
Upload Route:           /v1/tenant/admin/logo
├─ JWT Verification:    ✓ REQUIRED
├─ Tenant ID Check:     ✓ REQUIRED
├─ Package Ownership:   ✓ VERIFIED
├─ Filename in Array:   ✓ VERIFIED (for deletion)
└─ Cross-Tenant Access: ✓ BLOCKED

Result: EXCELLENT tenant isolation
```

## Deployment Readiness

```
Development:  ✓ READY (with warnings)
Staging:      ⚠ CONDITIONAL (implement Priority 1)
Production:   ✗ NOT READY (implement Priority 1 & 2)

Before Production Must Implement:
  [ ] Magic number validation
  [ ] Virus scanning
  [ ] Upload-specific rate limiting
  [ ] Fix file permissions
  [ ] Add security headers
  [ ] Remove SVG or sandbox it
```

## Attack Scenarios & Mitigations

### Attack 1: Malware Upload

```
Attacker:  Uploads executable.exe as image.jpeg
Current:   VULNERABLE - MIME type spoofing allows it
Fix:       Add magic number validation with file-type library
Risk:      CRITICAL - Malware could spread via download
```

### Attack 2: Disk Exhaustion

```
Attacker:  Upload 120 × 5MB files in 15 minutes = 600MB
Current:   VULNERABLE - No upload-specific rate limiting
Fix:       Implement per-tenant upload quota + per-hour limits
Risk:      MEDIUM - Can cause DoS
```

### Attack 3: XSS via SVG

```
Attacker:  Upload <svg onload="steal_data()"> file
Current:   VULNERABLE - SVG allows scripts
Fix:       Remove SVG or serve with Content-Disposition: attachment
Risk:      MEDIUM - Only if SVG embedded in pages
```

### Attack 4: MIME Type Spoofing

```
Attacker:  curl -F "logo=@shell.php;type=image/jpeg"
Current:   VULNERABLE - Only checks MIME header
Fix:       Validate actual file magic numbers
Risk:      HIGH - Shell execution if served wrong
```

### Attack 5: Arbitrary File Deletion

```
Attacker:  DELETE /v1/tenant/admin/packages/123/photos/other_tenant_file.jpg
Current:   PROTECTED - Filename must exist in package's photos array
Fix:       Already implemented ✓
Risk:      NONE - Properly secured
```

## Tenant Isolation: PASS

```
Scenario 1: Tenant A tries to delete Tenant B's photo
Result:    ✓ BLOCKED - Different tenantId verification

Scenario 2: Unauthenticated user tries to upload
Result:    ✓ BLOCKED - JWT required

Scenario 3: Admin token used on tenant routes
Result:    ✓ BLOCKED - Token type validation

Scenario 4: Tenant A gets Tenant B's logo URL
Result:    ✓ BLOCKED - Each tenant's own branding record

Scenario 5: Attacker tries path traversal in filename
Result:    ✓ BLOCKED - Random filename generation
```

## Environment Configuration

```
✓ Configurable upload directory via UPLOAD_DIR env var
✓ Configurable max file size via MAX_UPLOAD_SIZE_MB env var
✓ Separate limits for logos (2MB) vs photos (5MB)
⚠ No env var for allowed MIME types (hardcoded in code)
⚠ No env var for security headers
```

## Next Steps Priority List

```
IMMEDIATE (Week 1):
  1. Add file-type library for magic number validation
  2. Implement basic virus scanning
  3. Add upload-specific rate limiting
  4. Fix file permissions (0o600, 0o700)

BEFORE PRODUCTION (Week 2-3):
  5. Add security headers for uploads
  6. Disable SVG uploads or sandbox them
  7. Implement per-tenant storage quotas
  8. Set up security monitoring/alerting

OPTIONAL (Week 4+):
  9. Migrate to cloud storage (S3/Cloudinary)
  10. Add image optimization with sharp
  11. Implement CDN for faster delivery
  12. Add automated security scanning
```

## Files to Review

```
🔴 server/src/services/upload.service.ts
   Lines: 44-90 (MIME validation needs enhancement)
   Lines: 95-100 (Extension handling needs review)

🟢 server/src/middleware/tenant-auth.ts
   All: Excellent implementation

🟡 server/src/routes/tenant-admin.routes.ts
   Lines: 30-43 (Multer config needs fileFilter)
   Lines: 75-125 (Upload logic solid)

🟡 server/src/middleware/rateLimiter.ts
   Lines: 16-26 (Needs upload-specific limiter)

🟡 server/src/app.ts
   Lines: 87-93 (Needs security headers)
```
