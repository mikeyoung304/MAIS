---
status: complete
priority: p2
issue_id: '723'
tags:
  - code-review
  - performance
  - preview-system
dependencies: []
---

# P2: Preview Endpoint Makes 2 Sequential Database Queries

## Problem Statement

Every preview request makes 2 sequential database queries - one to fetch tenant by slug and another to fetch draft config by tenantId. These could be combined into a single query.

## Findings

**Location:** `server/src/routes/public-tenant.routes.ts` (lines 168-179)

**Current Code:**

```typescript
// Query 1: Get base tenant data
const tenant = await tenantRepository.findBySlugPublic(slug);

// Query 2: Get draft landing page config
const draftWrapper = await tenantRepository.getLandingPageDraft(tokenResult.payload.tenantId);
```

**Impact:**

- Extra database round-trip per preview request (~15-30ms added latency)
- `findBySlugPublic` already fetches `landingPageConfig`
- Draft wrapper is fetched separately, potentially re-reading same data

**Estimated Latency:**

- Current: ~50-80ms (2 queries)
- Optimized: ~30-50ms (1 query)

## Proposed Solutions

### Option A: Create Combined Repository Method (Recommended)

**Effort:** Medium (30 min)
**Risk:** Low

Create `findBySlugForPreview` that returns both published AND draft config:

```typescript
// In tenant.repository.ts
async findBySlugForPreview(slug: string): Promise<TenantPreviewDto | null> {
  const tenant = await this.prisma.tenant.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      apiKeyPublic: true,
      branding: true,
      landingPageConfig: true,       // Published
      landingPageConfigDraft: true,  // Draft
    },
  });
  // ... validation and mapping
}

// In public-tenant.routes.ts (preview endpoint)
const tenant = await tenantRepository.findBySlugForPreview(slug);
const landingPageConfig = tenant.draft ?? tenant.published ?? null;
```

### Option B: Inline Single Query

**Effort:** Small (15 min)
**Risk:** Low

Query directly in route without new repository method:

```typescript
const tenant = await tenantRepository.findBySlugWithDraft(slug);
```

This keeps the optimization localized but adds less reusable code.

## Recommended Action

Implemented Option A (combined repository method).

## Technical Details

**Affected Files:**

- `server/src/routes/public-tenant.routes.ts`
- `server/src/adapters/prisma/tenant.repository.ts`

**Components:**

- Preview endpoint
- Tenant repository

## Acceptance Criteria

- [x] Preview endpoint makes only 1 database query
- [x] Response shape unchanged (still returns `TenantPublicDto`)
- [x] Draft/published fallback logic preserved
- [x] Existing tests pass
- [ ] New repository method has test coverage (deferred - follows existing pattern)

## Work Log

| Date       | Action                   | Learnings                                                                                                                                                                                                                                            |
| ---------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-10 | Created from code review | Performance-oracle identified N+1-like pattern                                                                                                                                                                                                       |
| 2026-01-10 | Implemented fix          | Created `findBySlugForPreview` method in tenant.repository.ts. Single query fetches tenant + both `landingPageConfig` (published) and `landingPageConfigDraft` columns. Route simplified to use new method. Typecheck passes, repository tests pass. |

## Resolution Summary

**Solution:** Created new `findBySlugForPreview(slug)` method in `PrismaTenantRepository` that:

1. Queries tenant with both `landingPageConfig` and `landingPageConfigDraft` in a single query
2. Parses draft from `landingPageConfigDraft` column
3. Extracts published from `landingPageConfig` column
4. Returns `TenantPreviewDto` with `{ tenant: TenantPublicDto, hasDraft: boolean }`
5. Merges draft (or published fallback) into branding.landingPage

**Changes:**

- `server/src/adapters/prisma/tenant.repository.ts`: Added `findBySlugForPreview()` method and `TenantPreviewDto` interface
- `server/src/routes/public-tenant.routes.ts`: Simplified preview endpoint to use single method call

**Performance Improvement:** ~15-30ms saved per preview request by eliminating one database round-trip.

## Resources

- Performance review agent findings
- Existing `findBySlugPublic` implementation in tenant.repository.ts
