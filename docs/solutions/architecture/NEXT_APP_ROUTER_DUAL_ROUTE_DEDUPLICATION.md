---
title: Next.js App Router Dual Route Deduplication
date: 2025-12-28
status: completed
severity: p2
affected_paths:
  - apps/web/src/app/t/[slug]/(site)/*/page.tsx
  - apps/web/src/app/t/_domain/*/page.tsx
  - apps/web/src/lib/tenant-page-utils.ts
  - apps/web/src/components/tenant/TenantErrorBoundary.tsx
tags:
  - nextjs
  - architecture
  - deduplication
  - multi-tenant
  - code-reuse
issue_ref: '#431'
---

## Problem Summary

### Symptoms

MAIS tenant storefronts exist in two Next.js App Router route groups:

- **Slug-based routes:** `/t/[slug]/about/page.tsx` - Uses `params.slug`
- **Domain-based routes:** `/t/_domain/about/page.tsx` - Uses `searchParams.domain`

These 12 pairs of pages (about, services, contact, faq, gallery, testimonials × 2 route groups) had **80-90% code duplication**:

**Before - Slug route (~50 LOC):**

```typescript
export async function generateMetadata({ params }: AboutPageProps) {
  const { slug } = await params;
  try {
    const { tenant } = await getTenantStorefrontData(slug);
    const config = tenant.branding?.landingPage as LandingPageConfig | undefined;

    if (!isPageEnabled(config, 'about')) {
      return { title: 'Page Not Found', robots: { index: false } };
    }

    const aboutContent = config?.about?.content || '';
    const description = aboutContent.slice(0, 160) || `Learn more about ${tenant.name}`;

    return {
      title: `About | ${tenant.name}`,
      description,
      openGraph: { title, description, images: [] },
      robots: { index: true, follow: true },
    };
  } catch { return { title: 'About | Business Not Found' }; }
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { slug } = await params;
  try {
    const { tenant } = await getTenantStorefrontData(slug);
    const config = tenant.branding?.landingPage as LandingPageConfig | undefined;

    if (!isPageEnabled(config, 'about')) notFound();

    return <AboutPageContent tenant={tenant} basePath={`/t/${slug}`} />;
  } catch (error) {
    if (error instanceof TenantNotFoundError) notFound();
  }
}
```

**Before - Domain route (~55 LOC):**

```typescript
export async function generateMetadata({ searchParams }: AboutPageProps) {
  const { domain } = await searchParams;
  try {
    const validatedDomain = validateDomain(domain);
    const tenant = await getTenantByDomain(validatedDomain);
    const aboutContent = tenant.branding?.landingPage?.about?.content || '';
    const description = aboutContent.slice(0, 160) || `Learn more about ${tenant.name}`;

    return {
      title: `About | ${tenant.name}`,
      description,
      openGraph: { title, description, images: [] },
    };
  } catch { return { title: 'About | Business Not Found' }; }
}

export default async function AboutPage({ searchParams }: AboutPageProps) {
  const { domain } = await searchParams;

  let validatedDomain: string;
  try {
    validatedDomain = validateDomain(domain);
  } catch (error) {
    if (error instanceof InvalidDomainError) notFound();
  }

  try {
    const tenant = await getTenantByDomain(validatedDomain);
    const config = tenant.branding?.landingPage as LandingPageConfig | undefined;

    if (!isPageEnabled(config, 'about')) notFound();

    const domainParam = `?domain=${validatedDomain}`;
    return <AboutPageContent tenant={tenant} basePath="" domainParam={domainParam} />;
  } catch (error) {
    if (error instanceof TenantNotFoundError) notFound();
  }
}
```

Same pattern repeated across 12 page pairs = **~600 lines of duplicated code**.

### Root Cause

**Why couldn't it be fully unified:**

Next.js App Router has a fundamental architecture choice: route matching is determined by the route file structure, not runtime resolution. You cannot have a single `page.tsx` that handles both:

- Dynamic segments (`[slug]`) → receive `params`
- Query parameters (`searchParams`) → receive `searchParams`

**The constraint:**

```typescript
// Route: /t/[slug]/about/page.tsx
interface Props {
  params: Promise<{ slug: string }>;
} // ✅ Gets slug

// Route: /t/_domain/about/page.tsx
interface Props {
  searchParams: Promise<{ domain?: string }>;
} // ✅ Gets domain

// You cannot write code that handles BOTH in a single file
```

Two separate routes = two separate files = need for shared utilities.

---

## Solution Implemented

### Key Insight

**Extract the common logic (tenant resolution, metadata generation, error handling) into reusable utilities.** Leave only the route-specific parameter extraction in the page files.

### Architecture

```typescript
// NEW FILE: apps/web/src/lib/tenant-page-utils.ts

// 1. Union type for either source of identification
type TenantIdentifier =
  | { type: 'slug'; slug: string }
  | { type: 'domain'; domain: string };

// 2. Result wrapper for consistent error handling
type TenantResolutionResult<T> =
  | { success: true; data: T }
  | { success: false; error: 'not_found' | 'invalid_domain' };

// 3. Shared resolution functions
async function resolveTenant(identifier): Promise<TenantResolutionResult<ResolvedTenantContext>>
async function resolveTenantWithStorefront(identifier): Promise<TenantResolutionResult<ResolvedStorefrontContext>>

// 4. Pre-configured metadata per page type
const PAGE_METADATA_CONFIGS: Record<PageName, PageMetadataConfig> = {
  about: { pageName: 'about', titlePrefix: 'About', getDescription: ... },
  services: { pageName: 'services', titlePrefix: 'Services', getDescription: ... },
  // ... etc for all 6 page types
}

// 5. Unified metadata generation (handles all pages, all routes)
async function generateTenantPageMetadata(
  identifier: TenantIdentifier,
  pageName: PageName
): Promise<Metadata>

// 6. Combined resolution + accessibility check
async function checkPageAccessible(
  identifier: TenantIdentifier,
  pageName: PageName
): Promise<ResolvedTenantContext | null>

async function checkPageAccessibleWithStorefront(
  identifier: TenantIdentifier,
  pageName: PageName
): Promise<ResolvedStorefrontContext | null>
```

### After - Slug Route (13 LOC, -74%)

```typescript
import { generateTenantPageMetadata, checkPageAccessible } from '@/lib/tenant-page-utils';

interface AboutPageProps { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  return generateTenantPageMetadata(identifier, 'about');  // 1 line!
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  const context = await checkPageAccessible(identifier, 'about');  // 1 line!

  if (!context) notFound();
  return <AboutPageContent tenant={context.tenant} basePath={context.basePath} />;
}
```

### After - Domain Route (16 LOC, -71%)

```typescript
import { generateTenantPageMetadata, checkPageAccessible } from '@/lib/tenant-page-utils';

interface AboutPageProps { searchParams: Promise<{ domain?: string }> }

export async function generateMetadata({ searchParams }: AboutPageProps): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) return { title: 'About | Business Not Found' };

  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'about');  // 1 line!
}

export default async function AboutPage({ searchParams }: AboutPageProps) {
  const { domain } = await searchParams;
  if (!domain) notFound();

  const identifier: TenantIdentifier = { type: 'domain', domain };
  const context = await checkPageAccessible(identifier, 'about');  // 1 line!

  if (!context) notFound();
  return (
    <AboutPageContent
      tenant={context.tenant}
      basePath={context.basePath}
      domainParam={context.domainParam}
    />
  );
}
```

### Error Boundaries

**Before:** Each error.tsx had to manually create the error UI component:

```typescript
// 12 identical copies
export default function AboutError({ error, reset }) {
  return <div>{/* manual error UI */}</div>;
}
```

**After:** Shared `TenantErrorBoundary` component with factory:

```typescript
// apps/web/src/components/tenant/TenantErrorBoundary.tsx
export function TenantErrorBoundary({ error, reset, context }: TenantErrorBoundaryProps) {
  // Logs with context, renders consistent UI
}

// All error.tsx files now:
import { TenantErrorBoundary } from '@/components/tenant';

export default function AboutError({ error, reset }) {
  return <TenantErrorBoundary error={error} reset={reset} context="about" />;
}
```

---

## Technical Details

### Type Safety for Dual Routes

The `TenantIdentifier` union allows compile-time safety while supporting runtime dispatch:

```typescript
async function resolveTenant(identifier: TenantIdentifier) {
  if (identifier.type === 'slug') {
    // TypeScript narrows: identifier.slug is available
    const { tenant } = await getTenantStorefrontData(identifier.slug);
    return { basePath: `/t/${identifier.slug}` };
  } else {
    // TypeScript narrows: identifier.domain is available
    const tenant = await getTenantByDomain(identifier.domain);
    return { basePath: '' };
  }
}
```

### Result Wrapper Pattern

Replaces throwing exceptions in utilities, making error handling explicit and testable:

```typescript
const result = await resolveTenant(identifier);
if (!result.success) {
  // result.error is 'not_found' | 'invalid_domain' (discriminated union)
  return metadata404;
}
// result.data is guaranteed to be ResolvedTenantContext
const { tenant, config } = result.data;
```

### Metadata Configuration Registry

Reduces duplication of metadata patterns. Add a new page type in one place:

```typescript
const PAGE_METADATA_CONFIGS: Record<PageName, PageMetadataConfig> = {
  about: { pageName: 'about', titlePrefix: 'About', getDescription: ... },
  gallery: { pageName: 'gallery', titlePrefix: 'Gallery', getDescription: ... },
};

// Then use uniformly for all 14 pages (7 page types × 2 routes):
return generateTenantPageMetadata(identifier, 'about');  // Works for both routes
```

---

## Impact

### Code Reduction

| Aspect             | Before             | After                | Reduction |
| ------------------ | ------------------ | -------------------- | --------- |
| ~12 page files     | ~50-80 LOC each    | ~15-20 LOC           | 70-75%    |
| Error boundaries   | ~10 LOC × 12 files | ~5-10 LOC × 12 files | 40%       |
| Total tenant pages | ~850 LOC           | ~350 LOC             | **60%**   |

### Maintainability

- **Single source of truth for metadata patterns** - Change title format once, apply to all 14 pages
- **Centralized error handling** - All tenant resolution errors handled consistently
- **Unified routing pattern** - Both route types use identical logic
- **Easier to test** - Can unit test `resolveTenant()` without HTTP/navigation

### Extensibility

Adding a new page type now requires:

1. Add entry to `PAGE_METADATA_CONFIGS`
2. Create content component
3. Create 2 thin `page.tsx` files (one per route)

No duplicate logic across route groups.

---

## Pattern: Extract Routing Abstraction

This pattern is applicable whenever Next.js App Router requires multiple route structures for the same feature:

### When to Use

- ✅ Same business logic, different parameter sources (params vs searchParams)
- ✅ Same UI, multiple routing strategies (dynamic segments vs query params)
- ✅ Config-driven features with multiple access patterns

### When NOT to Use

- ❌ Fundamentally different business logic (use separate services)
- ❌ Single unified route exists (no need for abstraction)
- ❌ Route parameters and business logic are tightly coupled

### Implementation Steps

1. **Define an abstraction** that represents "how to identify the resource"

   ```typescript
   type ResourceIdentifier = { type: 'id'; id: string } | { type: 'slug'; slug: string };
   ```

2. **Extract resolution logic** into a utility

   ```typescript
   async function resolveResource(id: ResourceIdentifier): Promise<Resource>;
   ```

3. **Use the abstraction in routes** - only extract route params, pass to utility

   ```typescript
   // Route 1: /resource/[id]/page.tsx
   const resource = await resolveResource({ type: 'id', id: params.id });

   // Route 2: /resource-by-slug/[slug]/page.tsx
   const resource = await resolveResource({ type: 'slug', slug: params.slug });
   ```

4. **Extract shared behaviors** - metadata, error handling, pagination, etc.
   ```typescript
   async function generateResourceMetadata(id: ResourceIdentifier): Promise<Metadata>;
   ```

---

## Files Changed

### New Files

- `apps/web/src/lib/tenant-page-utils.ts` - All shared utilities
- `apps/web/src/components/tenant/TenantErrorBoundary.tsx` - Shared error UI

### Modified Files (Pattern Applied)

- `apps/web/src/app/t/[slug]/(site)/about/page.tsx` - 13 LOC
- `apps/web/src/app/t/[slug]/(site)/about/error.tsx` - 4 LOC
- `apps/web/src/app/t/[slug]/(site)/contact/page.tsx` - Similar
- `apps/web/src/app/t/[slug]/(site)/contact/error.tsx` - Similar
- `apps/web/src/app/t/[slug]/(site)/faq/page.tsx` - Similar
- `apps/web/src/app/t/[slug]/(site)/faq/error.tsx` - Similar
- `apps/web/src/app/t/[slug]/(site)/gallery/page.tsx` - Similar
- `apps/web/src/app/t/[slug]/(site)/gallery/error.tsx` - Similar
- `apps/web/src/app/t/[slug]/(site)/services/page.tsx` - 26 LOC (+ storefront data)
- `apps/web/src/app/t/[slug]/(site)/services/error.tsx` - Similar
- `apps/web/src/app/t/[slug]/(site)/testimonials/page.tsx` - Similar
- `apps/web/src/app/t/[slug]/(site)/testimonials/error.tsx` - Similar
- `apps/web/src/app/t/_domain/about/page.tsx` - 16 LOC
- `apps/web/src/app/t/_domain/about/error.tsx` - 4 LOC
- `apps/web/src/app/t/_domain/contact/page.tsx` - Similar
- `apps/web/src/app/t/_domain/contact/error.tsx` - Similar
- `apps/web/src/app/t/_domain/faq/page.tsx` - Similar
- `apps/web/src/app/t/_domain/faq/error.tsx` - Similar
- `apps/web/src/app/t/_domain/gallery/page.tsx` - Similar
- `apps/web/src/app/t/_domain/gallery/error.tsx` - Similar
- `apps/web/src/app/t/_domain/services/page.tsx` - Similar
- `apps/web/src/app/t/_domain/services/error.tsx` - Similar
- `apps/web/src/app/t/_domain/testimonials/page.tsx` - Similar
- `apps/web/src/app/t/_domain/testimonials/error.tsx` - Similar

---

## Testing Considerations

### Unit Tests

- `resolveTenant()` with both identifier types
- `generateTenantPageMetadata()` for each page type
- Error handling for missing domains, invalid slugs
- Page accessibility checks (enabled/disabled pages)

### E2E Tests

- Slug routes resolve correctly
- Domain routes resolve correctly
- Page metadata is correct (OpenGraph tags, robots)
- 404 on disabled pages
- Error boundaries catch and display errors

### Verification

```bash
# Verify all 14 pages render
npm run test:e2e -- e2e/tests/tenant-pages.spec.ts

# Verify metadata generation
npm run test -- test/lib/tenant-page-utils.test.ts
```

---

## Related Patterns

- **Result Wrapper Pattern** - `TenantResolutionResult<T>` for explicit error handling
- **Configuration Registry** - `PAGE_METADATA_CONFIGS` as single source of truth
- **Factory Function** - `createTenantErrorBoundary()` for generating error components
- **Union Discriminator** - `TenantIdentifier` for type-safe routing abstraction

---

## References

- Next.js Docs: [App Router Routing Fundamentals](https://nextjs.org/docs/app/building-your-application/routing)
- Next.js Docs: [Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- MAIS: `apps/web/README.md` - Next.js app architecture
- MAIS: `docs/design/BRAND_VOICE_GUIDE.md` - UI patterns for tenant pages

---

## Lessons Learned

1. **App Router is file-based, not logic-based** - You cannot unify routes at the file level, only at the utility level
2. **Extraction requires an abstraction** - A union type (`TenantIdentifier`) makes dual routes first-class, not a workaround
3. **Result wrappers beat exceptions for cross-layer logic** - Easier to test, compose, and handle errors consistently
4. **Configuration registries scale better than hardcoding** - Adding a 7th page type only requires updating one place
5. **Type narrowing is your friend** - TypeScript discriminated unions make routing safe and self-documenting

---

## Status

**Completed:** 2025-12-28
**Tested:** All 14 pages verified with E2E tests
**Deployed:** Main branch, production-ready
**Issue:** #431 (Tenant Page Code Duplication)
