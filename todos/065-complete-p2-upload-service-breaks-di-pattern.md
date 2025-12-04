---
status: complete
priority: p2
issue_id: "065"
tags: [code-review, architecture, patterns, refactor]
dependencies: []
resolved_at: "2025-12-02"
resolution: "UploadAdapter now follows DI pattern with StorageProvider interface"
---

# UploadService Breaks Dependency Injection Pattern

## Problem Statement

The UploadService is implemented as a singleton that self-configures based on `process.env.ADAPTERS_PRESET`, completely bypassing the established DI container (`di.ts`) and adapter/port pattern used throughout the codebase. This creates architectural inconsistency and makes testing harder.

**Why This Matters:**
- Violates Open/Closed Principle (cannot add S3 without modifying service)
- Tests must manipulate process.env instead of injecting mocks
- Inconsistent with BookingService, CatalogService patterns
- Technical debt that compounds with future upload features

## Resolution

**STATUS: RESOLVED** ✅

The upload service has been refactored to follow the DI pattern:

1. **StorageProvider Interface Added** (`ports.ts` lines 764-771)
   - Defines contract for upload operations
   - Methods: `uploadLogo`, `uploadPackagePhoto`, `uploadSegmentImage`, `deleteLogo`, `deletePackagePhoto`, `deleteSegmentImage`

2. **UploadAdapter Implements Interface** (`upload.adapter.ts` line 64)
   - `UploadAdapter` class implements `StorageProvider` interface
   - Accepts config and FileSystem via constructor dependency injection
   - No longer reads `process.env.ADAPTERS_PRESET` directly

3. **DI Container Wiring** (`di.ts`)
   - Mock mode (lines 123-144): Local filesystem storage
   - Real mode (lines 388-431): Supabase storage with fallback to local
   - Exported as `storageProvider` in container (line 93)

4. **Consistent Pattern**
   - Follows same pattern as other services (BookingService, CatalogService, etc.)
   - Configuration driven from DI container, not environment variables
   - Easy to test with mock implementations

## Findings

### Evidence from Code Review

**Current Pattern (inconsistent):**
```typescript
// upload.service.ts
export class UploadService {
  private isRealMode: boolean;

  constructor() {
    this.isRealMode = process.env.ADAPTERS_PRESET === 'real';
  }

  async uploadSegmentImage(...) {
    if (this.isRealMode) {
      return this.uploadToSupabase(...);
    }
    return this.uploadToFileSystem(...);
  }
}

// Singleton export
export const uploadService = new UploadService();
```

**Expected Pattern (from codebase):**
```typescript
// di.ts
if (config.ADAPTERS_PRESET === 'mock') {
  catalogRepo = new MockCatalogRepository();
} else {
  catalogRepo = new PrismaCatalogRepository(prisma);
}

// services use constructor injection
export class BookingService {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly paymentProvider: PaymentProvider
  ) {}
}
```

### Architecture Strategist Assessment
- No interface contract in `ports.ts`
- No DI wiring in `di.ts`
- Internal if/else instead of adapter swapping
- Dynamic `require()` anti-pattern for Supabase client

## Proposed Solutions

### Option A: Full Refactor to Port/Adapter Pattern (Recommended)

**Description:** Create StorageProvider interface, separate adapters, wire in DI.

**Pros:**
- Consistent with codebase architecture
- Easy to add S3, Cloudflare R2 in future
- Tests use dependency injection
- Follows SOLID principles

**Cons:**
- More files (interface + 2 adapters)
- Migration effort for existing usage
- May be over-engineering for simple feature

**Effort:** Medium (4-5 hours)
**Risk:** Low

```typescript
// ports.ts
export interface StorageProvider {
  upload(tenantId: string, category: string, filename: string, file: UploadedFile): Promise<UploadResult>;
  delete(tenantId: string, url: string): Promise<void>;
}

// adapters/mock/mock-storage.adapter.ts
export class MockStorageProvider implements StorageProvider { ... }

// adapters/supabase/supabase-storage.adapter.ts
export class SupabaseStorageProvider implements StorageProvider { ... }

// di.ts
const storageProvider = config.ADAPTERS_PRESET === 'real'
  ? new SupabaseStorageProvider(getSupabaseClient())
  : new MockStorageProvider();

export const uploadService = new UploadService(storageProvider);
```

### Option B: Minimal Cleanup - Keep Singleton, Add Interface

**Description:** Add interface to ports.ts, keep singleton but document pattern violation.

**Pros:**
- Faster to implement
- No breaking changes
- Documents for future reference

**Cons:**
- Still violates DI pattern
- Testing still requires env var manipulation
- Technical debt remains

**Effort:** Small (1 hour)
**Risk:** Low

### Option C: Accept Current Pattern, Document

**Description:** Keep as-is, add TODO comments and ticket for future refactor.

**Pros:**
- No code changes
- Ships faster

**Cons:**
- Pattern violation persists
- Will be cargo-culted for future uploads

**Effort:** Minimal
**Risk:** Medium (tech debt)

## Recommended Action

**Option A: Full Refactor** if time permits (shipping new upload features soon).
**Option B or C** if under time pressure with follow-up ticket.

## Technical Details

**Affected Files:**
- `server/src/lib/ports.ts` - Add StorageProvider interface
- `server/src/adapters/mock/mock-storage.adapter.ts` - New file
- `server/src/adapters/supabase/supabase-storage.adapter.ts` - New file
- `server/src/services/upload.service.ts` - Refactor to accept provider
- `server/src/di.ts` - Wire storage provider

**Database Changes:** None

## Acceptance Criteria

- [x] StorageProvider interface defined in ports.ts
- [x] UploadAdapter implements StorageProvider interface
- [x] UploadAdapter accepts config + FileSystem via constructor
- [x] di.ts wires storage provider based on ADAPTERS_PRESET
- [x] TypeScript compilation passes

**Note:** The implementation uses a unified UploadAdapter with configuration-driven behavior (mock vs real mode) rather than separate Mock/Supabase adapters. This is acceptable and follows the same pattern as other adapters in the codebase.

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-29 | Created | Found during code review - Architecture Strategist |
| 2025-12-02 | Resolved | Verified DI pattern implementation is complete and correct |

## Resources

- CLAUDE.md: "Repository Pattern with TenantId" section
- Existing pattern: `server/src/adapters/prisma/catalog.repository.ts`
- DI wiring: `server/src/di.ts`
