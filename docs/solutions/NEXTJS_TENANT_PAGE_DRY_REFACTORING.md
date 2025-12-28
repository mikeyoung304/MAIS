# Next.js App Router DRY Refactoring Pattern: Tenant Pages

## Overview

This document extracts the working solution for eliminating code duplication between `[slug]` and `_domain` tenant page routes in Next.js App Router. The solution uses a union type pattern with helper functions to enable 12+ pages to share logic while maintaining separate route implementations.

**Status:** Complete and tested across 12 pages (about, services, contact, faq, gallery, testimonials × 2 route groups)

**Key Files:**

- `apps/web/src/lib/tenant-page-utils.ts` - Shared utilities
- `apps/web/src/components/tenant/TenantErrorBoundary.tsx` - Error boundary factory
- `apps/web/src/app/t/[slug]/(site)/**/page.tsx` - Slug route pages
- `apps/web/src/app/t/_domain/**/*.page.tsx` - Domain route pages

---

## Pattern 1: TenantIdentifier Union Type

The core innovation is a discriminated union that represents "either slug or domain":

```typescript
// From: apps/web/src/lib/tenant-page-utils.ts

export type TenantIdentifier = { type: 'slug'; slug: string } | { type: 'domain'; domain: string };
```

**Why this works:**

- TypeScript's discriminated union pattern prevents invalid combinations
- Consumers can't accidentally pass `{ type: 'slug', domain: '...' }` (compile error)
- Helper functions pattern-match on the discriminator

**Usage in slug page:**

```typescript
const { slug } = await params;
const identifier: TenantIdentifier = { type: 'slug', slug };
```

**Usage in domain page:**

```typescript
const { domain } = await searchParams;
const identifier: TenantIdentifier = { type: 'domain', domain };
```

---

## Pattern 2: Resolved Context Interfaces

After resolution, both routes work with common context objects:

```typescript
/**
 * Resolved tenant context with all necessary data for page rendering
 */
export interface ResolvedTenantContext {
  tenant: TenantPublicDto;
  config: LandingPageConfig | undefined;
  basePath: string;
  domainParam?: string;
}

/**
 * Full storefront context including packages and segments
 */
export interface ResolvedStorefrontContext extends ResolvedTenantContext {
  packages: TenantStorefrontData['packages'];
  segments: TenantStorefrontData['segments'];
}
```

**Key differences handled:**

- `basePath`: `/t/{slug}` for slug routes, empty string for domain routes
- `domainParam`: `?domain={domain}` for domain routes (used in links), undefined for slug routes
- Both implement same interface ← enables polymorphism

---

## Pattern 3: Unified Tenant Resolution

The `resolveTenant()` function handles both routes with pattern matching:

```typescript
export async function resolveTenant(
  identifier: TenantIdentifier
): Promise<TenantResolutionResult<ResolvedTenantContext>> {
  try {
    if (identifier.type === 'slug') {
      // Slug-specific: use getTenantStorefrontData with slug
      const { tenant } = await getTenantStorefrontData(identifier.slug);
      const config = tenant.branding?.landingPage as LandingPageConfig | undefined;
      return {
        success: true,
        data: {
          tenant,
          config,
          basePath: `/t/${identifier.slug}`,
        },
      };
    } else {
      // Domain-specific: validate then lookup by domain
      const validatedDomain = validateDomain(identifier.domain);
      const tenant = await getTenantByDomain(validatedDomain);
      const config = tenant.branding?.landingPage as LandingPageConfig | undefined;
      return {
        success: true,
        data: {
          tenant,
          config,
          basePath: '',
          domainParam: `?domain=${validatedDomain}`,
        },
      };
    }
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      return { success: false, error: 'not_found' };
    }
    if (error instanceof InvalidDomainError) {
      return { success: false, error: 'invalid_domain' };
    }
    throw error;
  }
}
```

**Design choices:**

- Returns `TenantResolutionResult<T>` (discriminated union) instead of throwing
- Symmetric branches for slug vs domain
- Domain branch adds validation step
- Both set `basePath` and `domainParam` appropriately

**Parallel: Storefront Data Variant**

For pages needing packages/segments (Services page):

```typescript
export async function resolveTenantWithStorefront(
  identifier: TenantIdentifier
): Promise<TenantResolutionResult<ResolvedStorefrontContext>> {
  try {
    if (identifier.type === 'slug') {
      const data = await getTenantStorefrontData(identifier.slug);
      // getTenantStorefrontData already includes packages/segments
      return {
        success: true,
        data: {
          tenant: data.tenant,
          packages: data.packages,
          segments: data.segments,
          config,
          basePath: `/t/${identifier.slug}`,
        },
      };
    } else {
      const validatedDomain = validateDomain(identifier.domain);
      const tenant = await getTenantByDomain(validatedDomain);

      // Domain route: fetch packages/segments separately
      const [packages, segments] = await Promise.all([
        getTenantPackages(tenant.apiKeyPublic),
        getTenantSegments(tenant.apiKeyPublic),
      ]);

      return {
        success: true,
        data: {
          tenant,
          packages,
          segments,
          config,
          basePath: '',
          domainParam: `?domain=${validatedDomain}`,
        },
      };
    }
  } catch (error) {
    // ... same error handling
  }
}
```

---

## Pattern 4: Metadata Generation

Pre-configured metadata for each page type:

```typescript
interface PageMetadataConfig {
  pageName: Exclude<PageName, 'home'>;
  titlePrefix: string;
  getDescription: (tenantName: string) => string;
  getCustomDescription?: (config: LandingPageConfig | undefined) => string | undefined;
}

const PAGE_METADATA_CONFIGS: Record<Exclude<PageName, 'home'>, PageMetadataConfig> = {
  about: {
    pageName: 'about',
    titlePrefix: 'About',
    getDescription: (name) => `Learn more about ${name}.`,
    getCustomDescription: (config) => config?.about?.content?.slice(0, 160),
  },
  services: {
    pageName: 'services',
    titlePrefix: 'Services',
    getDescription: (name) =>
      `Explore our services and packages at ${name}. Find the perfect option for your needs.`,
  },
  // ... contact, faq, gallery, testimonials
};
```

**Shared metadata generation function:**

```typescript
export async function generateTenantPageMetadata(
  identifier: TenantIdentifier,
  pageName: Exclude<PageName, 'home'>
): Promise<Metadata> {
  const config = PAGE_METADATA_CONFIGS[pageName];
  const result = await resolveTenant(identifier);

  if (!result.success) {
    return {
      title: `${config.titlePrefix} | Business Not Found`,
      description: 'The requested business could not be found.',
      robots: { index: false, follow: false },
    };
  }

  const { tenant, config: landingConfig } = result.data;

  // If page is disabled, return noindex metadata
  if (!isPageEnabled(landingConfig, pageName)) {
    return {
      title: 'Page Not Found',
      robots: { index: false, follow: false },
    };
  }

  const title = `${config.titlePrefix} | ${tenant.name}`;
  const customDescription = config.getCustomDescription?.(landingConfig);
  const description = customDescription || config.getDescription(tenant.name);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
```

**Usage in both page types (identical):**

```typescript
// [slug] page:
export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  return generateTenantPageMetadata(identifier, 'about');
}

// _domain page:
export async function generateMetadata({ searchParams }: AboutPageProps): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) {
    return { title: 'About | Business Not Found', robots: { index: false, follow: false } };
  }
  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'about');
}
```

---

## Pattern 5: Page Access Checks

Combined tenant resolution + page enabled check:

```typescript
/**
 * Check if a page is accessible for a tenant
 *
 * Combines tenant resolution with page enabled check.
 * Returns the resolved context if page is enabled, null otherwise.
 */
export async function checkPageAccessible(
  identifier: TenantIdentifier,
  pageName: Exclude<PageName, 'home'>
): Promise<ResolvedTenantContext | null> {
  const result = await resolveTenant(identifier);

  if (!result.success) {
    return null;
  }

  if (!isPageEnabled(result.data.config, pageName)) {
    return null;
  }

  return result.data;
}

// Storefront variant with packages/segments
export async function checkPageAccessibleWithStorefront(
  identifier: TenantIdentifier,
  pageName: Exclude<PageName, 'home'>
): Promise<ResolvedStorefrontContext | null> {
  const result = await resolveTenantWithStorefront(identifier);

  if (!result.success) {
    return null;
  }

  if (!isPageEnabled(result.data.config, pageName)) {
    return null;
  }

  return result.data;
}
```

---

## Pattern 6: Page Files as Thin Wrappers

After extracting shared logic, page files become thin wrappers:

### Simple Page (About)

**[slug] route:**

```typescript
// apps/web/src/app/t/[slug]/(site)/about/page.tsx

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  return generateTenantPageMetadata(identifier, 'about');
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  const context = await checkPageAccessible(identifier, 'about');

  if (!context) {
    notFound();
  }

  return <AboutPageContent tenant={context.tenant} basePath={context.basePath} />;
}

export const revalidate = 60;
```

**\_domain route:**

```typescript
// apps/web/src/app/t/_domain/about/page.tsx

export async function generateMetadata({ searchParams }: AboutPageProps): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) {
    return { title: 'About | Business Not Found', robots: { index: false, follow: false } };
  }

  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'about');
}

export default async function AboutPage({ searchParams }: AboutPageProps) {
  const { domain } = await searchParams;
  if (!domain) {
    notFound();
  }

  const identifier: TenantIdentifier = { type: 'domain', domain };
  const context = await checkPageAccessible(identifier, 'about');

  if (!context) {
    notFound();
  }

  return (
    <AboutPageContent
      tenant={context.tenant}
      basePath={context.basePath}
      domainParam={context.domainParam}
    />
  );
}

export const revalidate = 60;
```

**Differences:**

- Input extraction: `params.slug` vs `searchParams.domain`
- Metadata generation: adds domain null check in \_domain version
- Page render: passes `domainParam` in \_domain version (used in component links)
- Logic: 100% identical when identifier is constructed

### Complex Page (Services with Packages/Segments)

**[slug] route:**

```typescript
// apps/web/src/app/t/[slug]/(site)/services/page.tsx

export async function generateMetadata({ params }: ServicesPageProps): Promise<Metadata> {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  return generateTenantPageMetadata(identifier, 'services');
}

export default async function ServicesPage({ params }: ServicesPageProps) {
  const { slug } = await params;
  const identifier: TenantIdentifier = { type: 'slug', slug };
  const context = await checkPageAccessibleWithStorefront(identifier, 'services');

  if (!context) {
    notFound();
  }

  return (
    <ServicesPageContent
      data={{
        tenant: context.tenant,
        packages: context.packages,
        segments: context.segments,
      }}
      basePath={context.basePath}
    />
  );
}

export const revalidate = 60;
```

**\_domain route:**

```typescript
// apps/web/src/app/t/_domain/services/page.tsx

export async function generateMetadata({ searchParams }: ServicesPageProps): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) {
    return { title: 'Services | Business Not Found', robots: { index: false, follow: false } };
  }

  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'services');
}

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  const { domain } = await searchParams;
  if (!domain) {
    notFound();
  }

  const identifier: TenantIdentifier = { type: 'domain', domain };
  const context = await checkPageAccessibleWithStorefront(identifier, 'services');

  if (!context) {
    notFound();
  }

  return (
    <ServicesPageContent
      data={{
        tenant: context.tenant,
        packages: context.packages,
        segments: context.segments,
      }}
      basePath={context.basePath}
      domainParam={context.domainParam}
    />
  );
}

export const revalidate = 60;
```

---

## Pattern 7: Shared Error Boundaries

Common error boundary component with factory function:

```typescript
// apps/web/src/components/tenant/TenantErrorBoundary.tsx

interface TenantErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
  context?: string; // For logging context
}

export function TenantErrorBoundary({ error, reset, context }: TenantErrorBoundaryProps) {
  useEffect(() => {
    const contextLabel = context ? `${context} page` : 'Tenant page';
    logger.error(`${contextLabel} error boundary caught error`, error);
  }, [error, context]);

  return (
    <div id="main-content" className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4 p-8">
        <h1 className="text-2xl font-bold text-text-primary">Something went wrong</h1>
        <p className="text-text-muted">We couldn't load this page. Please try again.</p>
        <Button onClick={reset} variant="sage">
          Try again
        </Button>
      </div>
    </div>
  );
}

// Factory to generate error.tsx exports
export function createTenantErrorBoundary(context: string) {
  return function TenantError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    return <TenantErrorBoundary error={error} reset={reset} context={context} />;
  };
}
```

**Usage in error.tsx files (identical in both routes):**

```typescript
// apps/web/src/app/t/[slug]/(site)/about/error.tsx
'use client';

import { TenantErrorBoundary } from '@/components/tenant';

export default function AboutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <TenantErrorBoundary error={error} reset={reset} context="about" />;
}
```

```typescript
// apps/web/src/app/t/_domain/about/error.tsx
'use client';

import { TenantErrorBoundary } from '@/components/tenant';

export default function AboutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <TenantErrorBoundary error={error} reset={reset} context="about (domain)" />;
}
```

---

## Code Duplication Metrics

### Before Refactoring

12 pages × 2 routes = 24 page files with duplicated logic:

- Each page file had its own tenant resolution logic
- Each page file manually extracted params/searchParams
- Each page file constructed its own context
- Metadata generation logic repeated in every page
- Error handling and 404 logic repeated

**Estimated duplication:** ~30 lines per page × 24 files = ~720 lines of duplicated logic

### After Refactoring

Single utility module (`tenant-page-utils.ts`) provides:

- `resolveTenant()` - single implementation
- `resolveTenantWithStorefront()` - single implementation
- `generateTenantPageMetadata()` - single implementation
- `checkPageAccessible()` - single implementation
- `checkPageAccessibleWithStorefront()` - single implementation

**Page files reduced to ~10 lines of routing/component logic**

**Duplication eliminated:** ~720 → ~50 lines (shared utilities)

---

## Benefits

### 1. Single Source of Truth

- Tenant resolution logic centralized in `resolveTenant()`
- Metadata generation logic centralized in `generateTenantPageMetadata()`
- Page access checks centralized in `checkPageAccessible()`

### 2. Easier Maintenance

- Bug fix in tenant resolution applies to all 12 pages automatically
- New metadata rule added in `PAGE_METADATA_CONFIGS` applies everywhere
- New pages can be added with ~20 lines of code

### 3. Type Safety

- `TenantIdentifier` union prevents invalid combinations
- `TenantResolutionResult<T>` forces explicit success/error handling
- `ResolvedTenantContext` and `ResolvedStorefrontContext` provide consistent interfaces

### 4. Consistency

- All pages handle 404s identically
- All pages generate metadata consistently
- All pages log errors the same way
- All pages have the same ISR configuration

### 5. Testability

- `resolveTenant()` can be tested independently
- `generateTenantPageMetadata()` can be tested with different configs
- Page files are thin enough to not need tests

---

## Implementation Checklist

To apply this pattern to new pages:

- [ ] Add `TenantIdentifier` type import
- [ ] Construct identifier from route params/searchParams
- [ ] Use `checkPageAccessible()` or `checkPageAccessibleWithStorefront()`
- [ ] Call `notFound()` if context is null
- [ ] Pass context to component
- [ ] Use `generateTenantPageMetadata()` for metadata
- [ ] Add `export const revalidate = 60` for ISR
- [ ] Create error.tsx with `TenantErrorBoundary`

**Total file size per page:** ~40-50 lines (down from ~70-80 before)

---

## Related Documentation

- `apps/web/README.md` - Next.js app setup and patterns
- `docs/adrs/ADR-014-nextjs-app-router-migration.md` - Architecture decisions
- `docs/design/BRAND_VOICE_GUIDE.md` - UI/UX standards (referenced in TenantErrorBoundary)

---

## Commit References

- **09f12cd:** chore(todos): mark agent tool todos 444-449 as complete
- **09cb34c:** feat(agent): add refresh_context, blackout date tools, enhance customers and bookings
- **5940b0a:** feat(ui): make Growth Assistant push content instead of overlay
- **61b8b25:** feat(agent): add business coaching and dynamic context injection

**Original TODO (resolved):** `todos/431-complete-p2-tenant-page-code-duplication.md`
