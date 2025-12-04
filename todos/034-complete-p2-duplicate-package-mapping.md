---
status: complete
priority: p2
issue_id: '034'
tags: [code-review, code-quality, dry]
dependencies: []
---

# Duplicate Package-to-DTO Mapping Logic

## Problem Statement

`getPackages()` and `getPackageBySlug()` have identical 22-line mapping code that should be extracted to a helper function.

**Why this matters:** Violates DRY principle; changes must be made in two places, risk of divergence.

## Findings

### Code Evidence

**Location:** `server/src/routes/packages.routes.ts:11-37` and `:40-66`

Both functions contain identical mapping:

```typescript
return packages.map((pkg) => ({
  id: pkg.id, slug: pkg.slug, title: pkg.title, ...
  photos: (pkg.photos ?? []).map((photo, idx) => ({ ... })),
  addOns: pkg.addOns.map((addOn): AddOnDto => ({ ... })),
}));
```

## Proposed Solutions

### Option A: Extract Helper Function (Recommended)

**Effort:** Small | **Risk:** Low

```typescript
function mapPackageToDto(pkg: Package): PackageDto {
  return {
    id: pkg.id,
    slug: pkg.slug,
    // ... all mapping logic
  };
}

// Usage
return packages.map(mapPackageToDto);
```

## Acceptance Criteria

- [x] Single `mapPackageToDto` function
- [x] Both routes use shared mapper
- [x] No duplicate mapping code
- [x] TypeScript types preserved

## Resolution

Created `server/src/lib/mappers/package.mapper.ts` with:

- `mapPackageToDto()` - Maps single package with add-ons to PackageDto
- `mapPackagesToDto()` - Convenience method for mapping arrays
- Helper functions `mapPackagePhoto()` and `mapAddOn()` for clarity

Updated `server/src/routes/packages.routes.ts`:

- Removed 44 lines of duplicate mapping logic
- Reduced controller from 69 lines to 22 lines (68% reduction)
- Both `getPackages()` and `getPackageBySlug()` now use shared mappers

**Benefits:**

- Single source of truth for Package-to-DTO mapping
- Future changes only need to be made in one place
- Improved maintainability and consistency
- All existing tests pass (4/4 HTTP package tests)

## Work Log

| Date       | Action   | Notes                                             |
| ---------- | -------- | ------------------------------------------------- |
| 2025-11-27 | Created  | Found during code quality review                  |
| 2025-11-30 | Resolved | Created shared mapper, updated routes, tests pass |
