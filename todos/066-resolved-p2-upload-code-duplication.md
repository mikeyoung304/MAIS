---
status: resolved
priority: p2
issue_id: "066"
tags: [code-review, code-quality, dry, refactor]
dependencies: []
resolution_date: 2025-12-02
---

# Triple Method Duplication in UploadService

## Problem Statement

The UploadService has three nearly identical upload methods (`uploadLogo`, `uploadPackagePhoto`, `uploadSegmentImage`) that follow the exact same pattern: validate → generate filename → upload (real vs mock). This violates DRY principle and makes maintenance harder.

**Why This Matters:**
- 60+ lines of duplicated code
- Bug fixes need to be applied in 3 places
- Adding new upload types requires copy-paste
- DHH-style simplicity violation

## Resolution Summary

Implemented **Option B** (hybrid approach) - created a private unified `upload()` method with category-based configuration while preserving public wrapper methods for backward compatibility. This solution provides the best of both worlds:
- Eliminates 60+ lines of duplication
- Maintains existing API contracts (no breaking changes)
- Single point of change for core upload logic
- Clean, type-safe implementation

## Findings

### Evidence from Code Review

**Current Duplication:**
```typescript
async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
  this.validateFile(file);
  const filename = this.generateFilename(file.originalname, 'logo');
  if (this.isRealMode) return this.uploadToSupabase(tenantId, 'logos', filename, file);
  // filesystem logic...
}

async uploadPackagePhoto(file: UploadedFile, packageId: string, tenantId?: string): Promise<UploadResult> {
  this.validateFile(file, this.maxPackagePhotoSizeMB);
  const filename = this.generateFilename(file.originalname, 'package');
  if (this.isRealMode && tenantId) return this.uploadToSupabase(tenantId, 'packages', filename, file);
  // filesystem logic...
}

async uploadSegmentImage(file: UploadedFile, tenantId: string): Promise<UploadResult> {
  this.validateFile(file, this.maxPackagePhotoSizeMB);
  const filename = this.generateFilename(file.originalname, 'segment');
  if (this.isRealMode) return this.uploadToSupabase(tenantId, 'segments', filename, file);
  // filesystem logic...
}
```

### Code Simplicity Reviewer Assessment
- 95% identical code across 3 methods
- Only differences: directory path, size limit, filename prefix
- Could be one parameterized method

## Proposed Solutions

### Option A: Single Parameterized Upload Method (Recommended)

**Description:** One `upload()` method that accepts upload type as parameter.

**Pros:**
- Eliminates 60+ lines
- Single point of change
- Clear, simple API

**Cons:**
- Breaking change for callers
- Less explicit method names

**Effort:** Small (1-2 hours)
**Risk:** Low

```typescript
type UploadCategory = 'logos' | 'packages' | 'segments';

const SIZE_LIMITS: Record<UploadCategory, number> = {
  logos: 2,
  packages: 5,
  segments: 5,
};

async upload(
  file: UploadedFile,
  tenantId: string,
  category: UploadCategory
): Promise<UploadResult> {
  this.validateFile(file, SIZE_LIMITS[category]);
  const filename = this.generateFilename(file.originalname, category);

  if (this.isRealMode) {
    return this.uploadToSupabase(tenantId, category, filename, file);
  }

  const uploadDir = path.join(process.cwd(), 'uploads', category);
  fs.mkdirSync(uploadDir, { recursive: true });
  const filepath = path.join(uploadDir, filename);
  await fs.promises.writeFile(filepath, file.buffer);

  return {
    url: `${this.baseUrl}/uploads/${category}/${filename}`,
    filename,
    size: file.size,
    mimetype: file.mimetype,
  };
}

// Thin wrappers for backwards compatibility (optional)
async uploadLogo(file: UploadedFile, tenantId: string) {
  return this.upload(file, tenantId, 'logos');
}
```

### Option B: Keep Wrappers, Extract Common Logic

**Description:** Keep public methods, extract shared logic to private method.

**Pros:**
- No breaking changes
- Preserves explicit API
- Still reduces duplication

**Cons:**
- More indirection
- Still 3 public methods to maintain

**Effort:** Small (1 hour)
**Risk:** Low

## Recommended Action

**Option A** for cleaner API, or **Option B** if backwards compatibility is critical.

## Technical Details

**Affected Files:**
- `server/src/services/upload.service.ts` - Consolidate methods
- `server/src/routes/tenant-admin.routes.ts` - Update calls if API changes
- `server/test/services/upload.service.test.ts` - Update tests

## Implementation Details

### Changes Made

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/upload.adapter.ts`

Created a private `upload()` method that consolidates all common upload logic:

```typescript
private async upload(
  file: UploadedFile,
  tenantId: string,
  category: 'logos' | 'packages' | 'segments',
  options: {
    maxSizeMB?: number;
    logContext?: Record<string, unknown>;
    errorContext?: Record<string, unknown>;
  } = {}
): Promise<UploadResult>
```

**Key Features:**
- Category-based routing (logos/packages/segments)
- Configurable size limits per category via options
- Optional log/error context for enhanced debugging
- Supports both real (Supabase) and mock (local filesystem) modes
- Dynamic directory mapping based on category
- Automatic filename prefix generation from category

**Preserved Public API:**
- `uploadLogo(file, tenantId)` - Wrapper for logos (2MB limit)
- `uploadPackagePhoto(file, packageId, tenantId?)` - Wrapper for packages (5MB limit)
- `uploadSegmentImage(file, tenantId)` - Wrapper for segments (5MB limit)

### Code Reduction

**Before:** 77 lines of duplicated code across 3 methods
**After:** 58 lines total (1 private method + 3 thin wrappers)
**Savings:** ~25% reduction, single point of change for core logic

## Acceptance Criteria

- [x] Single upload method handles all categories
- [x] Size limits configurable per category
- [x] Existing tests pass (backward compatible)
- [x] No code duplication between upload paths
- [x] Maintains type safety (TypeScript strict mode)
- [x] Preserves existing API contracts

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-29 | Created | Found during code review - Code Simplicity Reviewer |
| 2025-12-02 | Resolved | Implemented hybrid approach with private unified method + public wrappers |

## Resources

- DRY Principle: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
