---
title: 'Supabase Storage Image Upload - Code Review Findings'
category: code-review-patterns
tags:
  - supabase-storage
  - multi-tenant-isolation
  - file-upload
  - mime-type-validation
  - security
  - architecture
  - performance
severity: critical
component:
  - server/src/services/upload.service.ts
  - server/src/routes/tenant-admin.routes.ts
  - server/src/middleware/rateLimiter.ts
  - client/src/components/ImageUploadField.tsx
symptoms:
  - Public Supabase bucket allows cross-tenant image access
  - MIME type validation bypassed via header manipulation
  - Orphaned files remain when segments deleted
  - UploadService breaks dependency injection pattern
  - Rate limiting per-IP not per-tenant
root_cause:
  - Bucket configured as public without RLS
  - No magic byte validation on uploads
  - No cleanup hooks on entity deletion
  - Singleton pattern bypasses DI container
solution_type: checklist
date_documented: 2025-11-29
review_agents:
  - security-sentinel
  - architecture-strategist
  - performance-oracle
  - code-simplicity-reviewer
  - data-integrity-guardian
  - pattern-recognition-specialist
---

# Supabase Storage Image Upload - Code Review

## Overview

**Review Date:** November 29, 2025
**Feature:** Supabase Storage Image Uploads for segments, logos, packages
**Files Changed:** 8 (6 modified, 2 new)
**Review Method:** 6 parallel specialized agents

## Executive Summary

A comprehensive code review of the Supabase Storage image upload feature identified **3 CRITICAL issues** that block merge, **4 IMPORTANT issues** that should be fixed, and **1 NICE-TO-HAVE enhancement**.

| Severity           | Count | Status           |
| ------------------ | ----- | ---------------- |
| 🔴 P1 CRITICAL     | 3     | **BLOCKS MERGE** |
| 🟡 P2 IMPORTANT    | 4     | Should Fix       |
| 🔵 P3 NICE-TO-HAVE | 1     | Enhancement      |

---

## 🔴 P1 Critical Issues (BLOCKS MERGE)

### P1.1: Public Supabase Bucket Exposes Cross-Tenant Data

**Todo:** `todos/062-pending-p1-supabase-public-bucket-data-leak.md`
**Agent:** Security Sentinel, Data Integrity Guardian

**Problem:**
The Supabase bucket is configured as public, allowing anyone to access any tenant's images by guessing URLs:

```
https://{project}.supabase.co/storage/v1/object/public/images/{tenantId}/segments/image.jpg
```

**Impact:**

- Complete data leakage across all tenants
- GDPR/compliance violations
- Competitors can steal package photos, branding

**Evidence:**

```typescript
// upload.service.ts:151-153
const supabaseUrl = process.env.SUPABASE_URL;
const publicUrl = `${supabaseUrl}/storage/v1/object/public/images/${storagePath}`;
```

**Solution:**

```typescript
// Use signed URLs with expiry
const { data: signedUrlData } = await supabase.storage
  .from('images')
  .createSignedUrl(storagePath, 3600 * 24 * 365); // 1 year expiry

return { url: signedUrlData.signedUrl, ... };
```

**Fix Time:** 2-3 hours

---

### P1.2: MIME Type Validation Can Be Bypassed

**Todo:** `todos/063-pending-p1-mime-type-spoofing-vulnerability.md`
**Agent:** Security Sentinel

**Problem:**
File validation relies solely on client-provided MIME type header, not file content:

```typescript
// Current - trusts client header
if (!this.allowedMimeTypes.includes(file.mimetype)) {
  throw new Error('Invalid file type');
}
```

**Attack Vector:**

```bash
# Upload PHP shell disguised as image
curl -F "file=@webshell.php;type=image/jpeg" /v1/tenant-admin/segment-image
```

**Solution:**

```bash
npm install file-type --workspace=server
```

```typescript
import { fileTypeFromBuffer } from 'file-type';

const detectedType = await fileTypeFromBuffer(file.buffer);
if (!detectedType || !allowedTypes.includes(detectedType.mime)) {
  logger.warn(
    { declaredType: file.mimetype, detectedType: detectedType?.mime },
    'MIME type mismatch - possible spoofing'
  );
  throw new Error('File content does not match declared type');
}
```

**Fix Time:** 1 hour

---

### P1.3: Orphaned Files When Segments Deleted

**Todo:** `todos/064-pending-p1-orphaned-files-no-cleanup.md`
**Agent:** Data Integrity Guardian

**Problem:**
When a segment is deleted, its hero image remains in Supabase Storage forever:

- No `deleteSegmentImage()` method exists
- Segment deletion has no cleanup hook
- Files accumulate, costs increase

**Solution:**

```typescript
// Add to upload.service.ts
async deleteSegmentImage(url: string, tenantId: string): Promise<void> {
  const storagePath = this.extractStoragePath(url);

  // Verify tenant owns this file
  if (!storagePath.startsWith(`${tenantId}/`)) {
    throw new Error('Cannot delete files from other tenants');
  }

  if (this.isRealMode) {
    await this.getSupabaseClient().storage.from('images').remove([storagePath]);
  } else {
    const filepath = path.join(this.segmentImageUploadDir, path.basename(url));
    if (fs.existsSync(filepath)) await fs.promises.unlink(filepath);
  }
}

// Call from segment deletion
async deleteSegment(tenantId: string, id: string) {
  const existing = await this.repository.findById(tenantId, id);
  if (existing?.heroImage) {
    await this.uploadService.deleteSegmentImage(existing.heroImage, tenantId);
  }
  await this.repository.delete(tenantId, id);
}
```

**Fix Time:** 1-2 hours

---

## 🟡 P2 Important Issues (Should Fix)

### P2.1: UploadService Breaks DI Pattern

**Todo:** `todos/065-pending-p2-upload-service-breaks-di-pattern.md`
**Agent:** Architecture Strategist, Pattern Recognition Specialist

**Problem:**
UploadService is a singleton that self-configures via `process.env`, bypassing the established DI container pattern used by other services.

**Current (inconsistent):**

```typescript
export class UploadService {
  constructor() {
    this.isRealMode = process.env.ADAPTERS_PRESET === 'real';
  }
}
export const uploadService = new UploadService(); // Singleton
```

**Expected (per CLAUDE.md):**

```typescript
// ports.ts
export interface StorageProvider {
  upload(
    tenantId: string,
    category: string,
    filename: string,
    file: UploadedFile
  ): Promise<UploadResult>;
}

// di.ts
const storageProvider =
  config.ADAPTERS_PRESET === 'real'
    ? new SupabaseStorageProvider(supabase)
    : new MockStorageProvider();

export const uploadService = new UploadService(storageProvider);
```

**Fix Time:** 4-5 hours

---

### P2.2: Code Duplication in Upload Methods

**Todo:** `todos/066-pending-p2-upload-code-duplication.md`
**Agent:** Code Simplicity Reviewer

**Problem:**
Three nearly identical methods (`uploadLogo`, `uploadPackagePhoto`, `uploadSegmentImage`) with 60+ lines of duplicated code.

**Solution:**

```typescript
async upload(
  file: UploadedFile,
  tenantId: string,
  category: 'logos' | 'packages' | 'segments'
): Promise<UploadResult> {
  const sizeLimits = { logos: 2, packages: 5, segments: 5 };
  this.validateFile(file, sizeLimits[category]);
  const filename = this.generateFilename(file.originalname, category);

  if (this.isRealMode) {
    return this.uploadToSupabase(tenantId, category, filename, file);
  }
  // ... consolidated filesystem logic
}
```

**Fix Time:** 1-2 hours

---

### P2.3: Rate Limiting Per-IP Not Per-Tenant

**Todo:** `todos/067-pending-p2-rate-limiting-per-ip-not-tenant.md`
**Agent:** Performance Oracle, Security Sentinel

**Problem:**
Rate limiter uses IP-based keys, allowing:

- Single tenant with VPN/mobile to bypass via IP rotation
- Corporate users behind NAT to share limits unfairly
- No storage quota enforcement

**Solution:**

```typescript
// Multi-layer rate limiting
export const uploadLimiterIP = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200, // IP layer (DDoS protection)
  keyGenerator: (req) => req.ip,
});

export const uploadLimiterTenant = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50, // Tenant layer (abuse prevention)
  keyGenerator: (req, res) => res.locals.tenantAuth?.tenantId || req.ip,
});

// Apply both
router.post('/segment-image', uploadLimiterIP, uploadLimiterTenant, ...);
```

**Fix Time:** 2-3 hours

---

### P2.4: Memory Exhaustion Risk with Multer

**Todo:** `todos/068-pending-p2-memory-exhaustion-multer.md`
**Agent:** Performance Oracle

**Problem:**
`multer.memoryStorage()` loads entire files into RAM. With 5MB files and concurrent uploads:

- 10 concurrent × 5MB = 50MB memory spike
- Under attack: 100 concurrent × 5MB = 500MB
- Can cause OOM crashes

**Solution:**
Add tenant-level upload concurrency limits:

```typescript
const MAX_CONCURRENT = 3;
const uploadSemaphores = new Map<string, number>();

async function checkConcurrency(tenantId: string): Promise<void> {
  const current = uploadSemaphores.get(tenantId) || 0;
  if (current >= MAX_CONCURRENT) {
    throw new Error('Too many concurrent uploads. Please wait.');
  }
  uploadSemaphores.set(tenantId, current + 1);
}
```

**Fix Time:** 1-2 hours

---

## 🔵 P3 Nice-to-Have

### P3.1: useCallback Overuse in Frontend

**Todo:** `todos/069-pending-p3-usecallback-overuse-frontend.md`
**Agent:** Code Simplicity Reviewer

**Problem:**
7 `useCallback` wrappers in ImageUploadField with no performance benefit (component doesn't pass handlers to memoized children).

**Solution:**
Remove unnecessary useCallbacks, use regular functions:

```typescript
// Remove useCallback from simple handlers
function handleRemove() {
  onChange('');
  setError(null);
}

// Or inline trivial handlers
<div onDragLeave={() => setIsDragging(false)}>
```

**Fix Time:** 30 minutes

---

## Summary Table

| Priority | Issue                   | Component         | Fix Time | Impact         |
| -------- | ----------------------- | ----------------- | -------- | -------------- |
| 🔴 P1    | Public bucket data leak | Supabase config   | 2-3h     | Data breach    |
| 🔴 P1    | MIME type spoofing      | upload.service.ts | 1h       | Malware upload |
| 🔴 P1    | Orphaned files          | service + routes  | 1-2h     | Storage leak   |
| 🟡 P2    | DI pattern violation    | di.ts + service   | 4-5h     | Tech debt      |
| 🟡 P2    | Code duplication        | upload.service.ts | 1-2h     | Maintenance    |
| 🟡 P2    | Rate limit by IP        | rateLimiter.ts    | 2-3h     | Abuse vector   |
| 🟡 P2    | Memory exhaustion       | routes config     | 1-2h     | DoS risk       |
| 🔵 P3    | useCallback overuse     | ImageUploadField  | 0.5h     | Code quality   |

**Total P1 Fix Time:** 4-6 hours (REQUIRED before merge)
**Total All Fixes:** 13-18.5 hours

---

## What's Good ✅

Despite critical findings, the implementation has solid foundations:

- ✅ **Tenant scoping** - Storage paths include tenantId
- ✅ **Rate limiting exists** - uploadLimiter applied to endpoint
- ✅ **File validation** - Size limits and MIME type checking present
- ✅ **Dual-mode architecture** - Mock/real mode separation works
- ✅ **Good UX** - Drag-drop, preview, loading states
- ✅ **Tests added** - 5 new tests for segment image uploads

---

## Prevention Strategies

### Pre-Development Checklist

Before implementing file uploads:

- [ ] Is the storage bucket private or public? (Must be private for tenant data)
- [ ] Will URLs use signed tokens with expiry?
- [ ] Is file content validated (magic bytes), not just headers?
- [ ] Does the service follow the DI pattern in `di.ts`?
- [ ] Is there cleanup logic when entities are deleted?
- [ ] Are rate limits per-tenant, not just per-IP?
- [ ] Is memory usage bounded for large files?

### Code Review Checklist

When reviewing file upload code:

- [ ] Are storage paths tenant-scoped? (`{tenantId}/{folder}/{file}`)
- [ ] Can other tenants access uploaded files?
- [ ] Is MIME type verified against file content?
- [ ] Does entity deletion clean up files?
- [ ] Does the service implement an interface from `ports.ts`?
- [ ] Are there tests for MIME spoofing attacks?
- [ ] Are there tests for cross-tenant access?

### Red Flags

Warning signs of problematic file upload implementations:

- 🚩 Public bucket URLs without signed tokens
- 🚩 MIME validation only (no magic byte check)
- 🚩 Singleton services with `process.env` checks
- 🚩 No delete method for uploaded files
- 🚩 Rate limiting by IP only
- 🚩 `multer.memoryStorage()` without concurrency limits
- 🚩 Excessive `useCallback` without memoized children

---

## Related Documentation

- **CLAUDE.md** - Multi-tenant data isolation rules
- **docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md** - Tenant isolation patterns
- **server/src/di.ts** - Dependency injection patterns
- **server/src/lib/ports.ts** - Service interface definitions

## Related Todos

- `todos/062-pending-p1-supabase-public-bucket-data-leak.md`
- `todos/063-pending-p1-mime-type-spoofing-vulnerability.md`
- `todos/064-pending-p1-orphaned-files-no-cleanup.md`
- `todos/065-pending-p2-upload-service-breaks-di-pattern.md`
- `todos/066-pending-p2-upload-code-duplication.md`
- `todos/067-pending-p2-rate-limiting-per-ip-not-tenant.md`
- `todos/068-pending-p2-memory-exhaustion-multer.md`
- `todos/069-pending-p3-usecallback-overuse-frontend.md`

---

## Appendix: Review Agents Used

| Agent                          | Focus           | Key Findings                     |
| ------------------------------ | --------------- | -------------------------------- |
| Security Sentinel              | Vulnerabilities | Public bucket, MIME spoofing     |
| Architecture Strategist        | Patterns        | DI violation, interface gaps     |
| Performance Oracle             | Scaling         | Memory exhaustion, rate limits   |
| Code Simplicity Reviewer       | Quality         | Duplication, useCallback overuse |
| Data Integrity Guardian        | Data            | Orphaned files, tenant isolation |
| Pattern Recognition Specialist | Consistency     | Architectural deviations         |
