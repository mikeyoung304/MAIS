---
status: resolved
priority: p1
issue_id: "195"
tags: [code-review, dry, refactoring]
dependencies: []
---

# Duplicate DTO Mapping (Same 6 Lines Repeated 10+ Times)

## Problem Statement

The add-on DTO mapping is done inline in each route handler, with the exact same transformation repeated 4+ times for add-ons and 6+ times for packages.

### Why It Matters
- Code repetition across multiple routes
- Risk of inconsistent DTO shapes
- When you add a field, you have to update it in 10 places
- Impossible to know if all mappings are identical

## Findings

**Source:** DHH Review, Code Quality Review, Architecture Review

**Evidence:**
```typescript
// Lines 1031-1038, 1067-1074, 1104-1111, 1151-1158 - IDENTICAL code
const addOnsDto = addOns.map((addOn) => ({
  id: addOn.id,
  packageId: addOn.packageId,
  title: addOn.title,
  description: addOn.description,
  priceCents: addOn.priceCents,
  photoUrl: addOn.photoUrl,
}));
```

**Location:** `server/src/routes/tenant-admin.routes.ts` - lines 1031, 1067, 1104, 1151

## Proposed Solutions

### Option A: Create Mapper Functions (Recommended)
**Pros:** Single source of truth, easy to test, explicit
**Cons:** Slightly more files
**Effort:** Small (15 minutes)
**Risk:** Low

```typescript
// lib/dto-mappers.ts (or at top of routes file)
export const mapAddOnToDto = (addOn: AddOn) => ({
  id: addOn.id,
  packageId: addOn.packageId,
  title: addOn.title,
  description: addOn.description,
  priceCents: addOn.priceCents,
  photoUrl: addOn.photoUrl,
});

export const mapPackageToDto = (pkg: Package) => ({
  id: pkg.id,
  slug: pkg.slug,
  title: pkg.title,
  // ...
});

// Usage in routes
res.json(addOns.map(mapAddOnToDto));
res.json(mapAddOnToDto(addOn));
```

### Option B: Use Class-Based Transformers
**Pros:** OOP pattern, can add validation
**Cons:** Over-engineering for this use case
**Effort:** Medium (45 minutes)
**Risk:** Low

## Recommended Action

Option A - Simple mapper functions at top of routes file.

## Technical Details

**Affected Files:**
- `server/src/routes/tenant-admin.routes.ts`

**Database Changes:** None

## Acceptance Criteria

- [ ] `mapAddOnToDto` function created
- [ ] `mapPackageToDto` function created (if time permits)
- [ ] All inline mappings replaced with function calls
- [ ] Tests verify DTO structure matches contract schema
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-03 | Created from code review | Extract repeated patterns to functions |

## Resources

- DRY Principle: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
