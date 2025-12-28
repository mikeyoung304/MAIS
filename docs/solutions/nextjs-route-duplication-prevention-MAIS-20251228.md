# Next.js App Router Route Duplication Prevention

**Date:** 2025-12-28
**Status:** Active Prevention Strategy
**Audience:** Frontend developers, code reviewers
**Severity:** Medium (Code maintainability, testing burden)
**Examples:** MAIS tenant storefronts ([slug] vs \_domain routes)

---

## Problem Statement

Multi-route Next.js App Router projects often implement the same page in two places:

- **`[slug]` routes**: `/t/[slug]/about` (slug-based tenant identification)
- **`_domain` routes**: `/t/_domain/about` (custom domain-based identification)

Without shared utilities, each page duplicates:

- Tenant resolution logic
- Metadata generation
- Page enablement checks
- Error handling
- Data fetching patterns

**Impact:**

- Code changes must be made in 2 places (risk of inconsistency)
- Testing burden doubles
- Maintenance cost increases
- Bug fixes don't propagate automatically
- New features require parallel implementation

---

## Solution Pattern: TenantIdentifier Union Type

The MAIS codebase uses a unified abstraction layer in `/apps/web/src/lib/tenant-page-utils.ts`:

```typescript
// Union type - single parameter for both route types
export type TenantIdentifier = { type: 'slug'; slug: string } | { type: 'domain'; domain: string };

// Unified context objects
export interface ResolvedTenantContext {
  tenant: TenantPublicDto;
  config: LandingPageConfig | undefined;
  basePath: string; // '/t/slug' or ''
  domainParam?: string; // '?domain=...' or undefined
}

// Shared utility functions that accept TenantIdentifier
export async function resolveTenant(
  identifier: TenantIdentifier
): Promise<TenantResolutionResult<ResolvedTenantContext>>;

export async function generateTenantPageMetadata(
  identifier: TenantIdentifier,
  pageName: Exclude<PageName, 'home'>
): Promise<Metadata>;

export async function checkPageAccessible(
  identifier: TenantIdentifier,
  pageName: Exclude<PageName, 'home'>
): Promise<ResolvedTenantContext | null>;
```

**Key benefit:** All business logic lives in one place; route implementations are minimal wrappers.

---

## When to Apply This Pattern

### Signs You Need Route Deduplication

Check if your Next.js project has:

- [ ] Multiple routing strategies for the same content (slug-based, domain-based, workspace-based, etc.)
- [ ] 3+ pages that need to work across both route types
- [ ] Metadata generation logic that differs only in how tenant is identified
- [ ] Data fetching that's identical except for the identifier resolution
- [ ] Error boundaries or layouts that are copy-pasted between routes

### Red Flags (Apply Pattern Now)

- Changing a single page requires updates in 2 folders
- A bug is discovered in one route but not automatically fixed in the other
- Testing requires running the same test suite twice
- The page implementation > 80% duplicated between routes
- New features take 2x the effort due to parallel implementation

### When NOT to Apply (Direct Implementation OK)

- Single-route projects (no duplication)
- Fundamentally different page structure between routes (>30% divergence)
- Specialized routes that won't be replicated elsewhere

---

## Checklist: Adding New Tenant Pages

Use this checklist whenever adding a new tenant page to both [slug] and \_domain routes.

### Step 1: Create Shared Utilities (If Not Exists)

- [ ] **Utility file exists**: `/lib/tenant-page-utils.ts` with `TenantIdentifier` type
- [ ] **Includes these functions**:
  - `resolveTenant(identifier)` - Basic tenant + config
  - `resolveTenantWithStorefront(identifier)` - Tenant + packages/segments
  - `generateTenantPageMetadata(identifier, pageName)`
  - `checkPageAccessible(identifier, pageName)`
  - `checkPageAccessibleWithStorefront(identifier, pageName)`
- [ ] **Error types defined**: `TenantNotFoundError`, `InvalidDomainError`

### Step 2: Create Shared Components

- [ ] **Content component** (e.g., `AboutPageContent.tsx`):
  - Takes tenant + config as props
  - Accepts `basePath` prop (for link generation)
  - Accepts optional `domainParam` prop (for query strings)
  - **No route/slug logic** - purely presentational

- [ ] **Error boundary** (if needed):
  - Create at `/components/tenant/TenantErrorBoundary.tsx`
  - Accepts `context` prop for logging
  - Used by both error.tsx files

### Step 3: Implement [slug] Route Page

**File**: `/app/t/[slug]/(site)/[pageName]/page.tsx`

```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AboutPageContent } from '@/components/tenant';
import {
  generateTenantPageMetadata,
  checkPageAccessible,
  type TenantIdentifier,
} from '@/lib/tenant-page-utils';

interface AboutPageProps {
  params: Promise<{ slug: string }>;
}

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

**Checklist for page.tsx**:

- [ ] Uses `Promise<{ slug: string }>` for params (Next.js 15+)
- [ ] Creates `TenantIdentifier` with `{ type: 'slug', slug }`
- [ ] Calls shared utility with identifier
- [ ] Returns `notFound()` if context is null
- [ ] Passes `basePath` to component (not slug directly)
- [ ] Includes `revalidate` for ISR if using SSR

### Step 4: Implement [slug] Route Error Boundary

**File**: `/app/t/[slug]/(site)/[pageName]/error.tsx`

```typescript
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

**Checklist**:

- [ ] Imports `TenantErrorBoundary` component
- [ ] Passes `context` string matching page name
- [ ] 'use client' directive present
- [ ] Props match Next.js error boundary signature

### Step 5: Implement \_domain Route Page

**File**: `/app/t/_domain/[pageName]/page.tsx`

```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AboutPageContent } from '@/components/tenant';
import {
  generateTenantPageMetadata,
  checkPageAccessible,
  type TenantIdentifier,
} from '@/lib/tenant-page-utils';

interface AboutPageProps {
  searchParams: Promise<{ domain?: string }>;
}

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

**Checklist**:

- [ ] Uses `Promise<{ domain?: string }>` for searchParams
- [ ] Checks `if (!domain)` and returns fallback metadata
- [ ] Checks `if (!domain)` and returns `notFound()`
- [ ] Creates `TenantIdentifier` with `{ type: 'domain', domain }`
- [ ] Passes `domainParam` query string to component
- [ ] Reuses same component (no duplicate implementation)

### Step 6: Implement \_domain Route Error Boundary

**File**: `/app/t/_domain/[pageName]/error.tsx`

```typescript
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

**Checklist**:

- [ ] Identical to [slug] version except context includes "(domain)" suffix
- [ ] Helps distinguish in logs which route threw the error

### Step 7: Verify Content Component Accepts Required Props

**File**: `/components/tenant/[PageName]PageContent.tsx`

```typescript
interface AboutPageContentProps {
  tenant: TenantPublicDto;
  basePath: string;              // '/t/slug' or ''
  domainParam?: string;          // '?domain=...' for query strings
}

export function AboutPageContent({
  tenant,
  basePath,
  domainParam = '',
}: AboutPageContentProps) {
  // Use basePath + domainParam for links
  const servicesLink = `${basePath}/services${domainParam}`;

  return (
    <div>
      {/* Links use basePath + domainParam */}
      <Link href={servicesLink}>View Services</Link>
    </div>
  );
}
```

**Checklist**:

- [ ] Accepts `basePath` prop (not `slug` directly)
- [ ] Accepts optional `domainParam` prop
- [ ] Uses `basePath` in all internal links
- [ ] Appends `domainParam` to all links
- [ ] No hardcoded `/t/` routes

---

## Code Review Flags

### What Reviewers Should Look For

#### Flag 1: Duplicate Utility Functions

**Bad**: Logic in page.tsx that differs between [slug] and \_domain

```typescript
// [slug]/page.tsx
const tenant = await getTenantBySlug(slug);

// _domain/page.tsx
const tenant = await getTenantByDomain(domain);
```

**Good**: Unified utility function

```typescript
// Both call same utility with different identifier
const context = await resolveTenant(identifier);
```

**Review action**: Suggest extracting to shared utility file.

---

#### Flag 2: Hardcoded Routes in Components

**Bad**: Component generates its own routes

```typescript
export function AboutPageContent({ tenant }: Props) {
  return (
    <Link href={`/t/${tenant.slug}/services`}>
      View Services
    </Link>
  );
}
```

**Good**: Component receives basePath

```typescript
export function AboutPageContent({ tenant, basePath, domainParam = '' }: Props) {
  return (
    <Link href={`${basePath}/services${domainParam}`}>
      View Services
    </Link>
  );
}
```

**Review action**: Reject if component hardcodes routes. Require basePath + domainParam.

---

#### Flag 3: Route Type Logic in Components

**Bad**: Component checks route type

```typescript
export function AboutPageContent({ routeType, slug, domain }: Props) {
  const servicesPath = routeType === 'slug'
    ? `/t/${slug}/services`
    : `/t/_domain/services?domain=${domain}`;

  return <Link href={servicesPath}>Services</Link>;
}
```

**Good**: Component accepts generated paths

```typescript
export function AboutPageContent({ basePath, domainParam = '' }: Props) {
  return <Link href={`${basePath}/services${domainParam}`}>Services</Link>;
}
```

**Review action**: Require components to be route-agnostic.

---

#### Flag 4: Inconsistent Error Handling

**Bad**: Different error handling between routes

```typescript
// [slug]/page.tsx
if (!context) {
  notFound();
}

// _domain/page.tsx
if (!context) {
  return <ErrorFallback />;  // Different behavior!
}
```

**Good**: Both use same pattern

```typescript
// Both routes
if (!context) {
  notFound();
}
```

**Review action**: Require identical error handling patterns.

---

#### Flag 5: Missing Metadata Noindex for Domain Route

**Bad**: Domain route doesn't check domain param early

```typescript
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { domain } = await searchParams;
  // Missing domain check - could generate metadata without domain!
  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'about');
}
```

**Good**: Domain check happens first

```typescript
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) {
    return { title: 'Page Not Found', robots: { index: false, follow: false } };
  }
  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'about');
}
```

**Review action**: Require domain guard in both generateMetadata and page function.

---

#### Flag 6: Duplicate Context Logic

**Bad**: Both routes have different ways of checking page access

```typescript
// [slug] uses one utility
const context = await checkPageAccessible(identifier, 'about');

// _domain uses different utility
const data = await resolveTenant(identifier);
if (!isPageEnabled(data.config, 'about')) return null;
```

**Good**: Both use same utility

```typescript
// Both routes
const context = await checkPageAccessible(identifier, 'about');
```

**Review action**: Require consistent use of same utilities.

---

#### Flag 7: ISR Revalidation Not Set

**Bad**: Missing revalidate

```typescript
export default async function AboutPage({ params }: Props) {
  // ...
  return <AboutPageContent {...props} />;
}
// No revalidate = full dynamic rendering
```

**Good**: ISR configured

```typescript
export default async function AboutPage({ params }: Props) {
  // ...
  return <AboutPageContent {...props} />;
}

export const revalidate = 60;  // Cache for 60 seconds
```

**Review action**: Require `export const revalidate` for performance.

---

### Review Checklist Template

```markdown
## Route Duplication Review Checklist

- [ ] Both [slug] and \_domain pages use shared utilities
- [ ] No hardcoded routes in content components
- [ ] Components accept basePath + domainParam
- [ ] Error handling identical between routes
- [ ] Domain route has domain guard in metadata function
- [ ] Domain route has domain guard in page function
- [ ] No route-type awareness in shared components
- [ ] ISR revalidation configured
- [ ] TenantIdentifier union type used
- [ ] Error boundaries use TenantErrorBoundary component
```

---

## Testing Approach

### Unit Test Strategy: Shared Utilities

**File**: `/lib/tenant-page-utils.test.ts`

Test the core utility functions once, not per route:

```typescript
describe('resolveTenant', () => {
  test('resolves tenant by slug', async () => {
    const result = await resolveTenant({ type: 'slug', slug: 'test' });
    expect(result.success).toBe(true);
    expect(result.data.basePath).toBe('/t/test');
  });

  test('resolves tenant by domain', async () => {
    const result = await resolveTenant({ type: 'domain', domain: 'example.com' });
    expect(result.success).toBe(true);
    expect(result.data.basePath).toBe('');
    expect(result.data.domainParam).toBe('?domain=example.com');
  });

  test('returns not_found error on invalid tenant', async () => {
    const result = await resolveTenant({ type: 'slug', slug: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('not_found');
  });
});

describe('generateTenantPageMetadata', () => {
  test('generates metadata for slug route', async () => {
    const metadata = await generateTenantPageMetadata({ type: 'slug', slug: 'test' }, 'about');
    expect(metadata.title).toContain('About');
  });

  test('generates metadata for domain route', async () => {
    const metadata = await generateTenantPageMetadata(
      { type: 'domain', domain: 'example.com' },
      'about'
    );
    expect(metadata.title).toContain('About');
  });

  test('returns noindex metadata for nonexistent tenant', async () => {
    const metadata = await generateTenantPageMetadata(
      { type: 'slug', slug: 'nonexistent' },
      'about'
    );
    expect(metadata.robots?.index).toBe(false);
  });
});

describe('checkPageAccessible', () => {
  test('returns context when page is enabled', async () => {
    const context = await checkPageAccessible({ type: 'slug', slug: 'test' }, 'about');
    expect(context).not.toBeNull();
    expect(context?.basePath).toBe('/t/test');
  });

  test('returns null when page is disabled', async () => {
    // Setup tenant with about page disabled
    const context = await checkPageAccessible({ type: 'slug', slug: 'disabled' }, 'about');
    expect(context).toBeNull();
  });
});
```

**Why this approach:**

- Test logic once, not twice
- Utilities work for both route types
- Catch issues that would affect both routes
- Faster to run

---

### E2E Test Strategy: Both Route Types

**File**: `/e2e/tenant-pages.spec.ts`

Test both routes with same expectations:

```typescript
describe('Tenant Pages - Dual Routes', () => {
  describe('[slug] route', () => {
    test('loads about page at /t/[slug]/about', async ({ page }) => {
      await page.goto('/t/test-tenant/about');
      await expect(page.locator('h1')).toContainText('About');
      await expect(page.locator('a:has-text("Services")')).toHaveAttribute(
        'href',
        '/t/test-tenant/services'
      );
    });

    test('shows 404 if page disabled', async ({ page }) => {
      await page.goto('/t/disabled-tenant/about');
      await expect(page.locator('text=Page Not Found')).toBeVisible();
    });

    test('handles errors with error boundary', async ({ page }) => {
      // Setup to trigger error
      await page.goto('/t/error-tenant/about');
      await expect(page.locator('text=Something went wrong')).toBeVisible();
    });
  });

  describe('_domain route', () => {
    test('loads about page at /t/_domain/about?domain=...', async ({ page }) => {
      await page.goto('/t/_domain/about?domain=example.com');
      await expect(page.locator('h1')).toContainText('About');

      // Links should include domain query param
      await expect(page.locator('a:has-text("Services")')).toHaveAttribute(
        'href',
        /services\?domain=example\.com/
      );
    });

    test('shows 404 if domain param missing', async ({ page }) => {
      await page.goto('/t/_domain/about');
      await expect(page.locator('text=Page Not Found')).toBeVisible();
    });

    test('handles invalid domains', async ({ page }) => {
      await page.goto('/t/_domain/about?domain=invalid%00domain');
      await expect(page.locator('text=Page Not Found')).toBeVisible();
    });

    test('handles errors with error boundary', async ({ page }) => {
      await page.goto('/t/_domain/about?domain=error-tenant.com');
      await expect(page.locator('text=Something went wrong')).toBeVisible();
    });
  });

  describe('Content Consistency', () => {
    test('[slug] and _domain routes render identical content', async ({ page }) => {
      const [slugPage, domainPage] = await Promise.all([
        page.goto('/t/test-tenant/about'),
        page.goto('/t/_domain/about?domain=test-tenant.com'),
      ]);

      const slugContent = await page.locator('main').textContent();

      // Reset and fetch domain content
      await page.goto('/t/_domain/about?domain=test-tenant.com');
      const domainContent = await page.locator('main').textContent();

      expect(slugContent).toBe(domainContent);
    });
  });
});
```

**Why this approach:**

- Verifies both routes work identically
- Tests error cases for both routes
- Ensures links include correct basePath/domainParam
- Catches route-type-specific bugs

---

### Integration Test Strategy: Page Rendering

**File**: `/app/t/[slug]/\(site)/about/page.test.tsx`

Test page component in isolation:

```typescript
import { render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';
import AboutPage, { generateMetadata } from './page';

// Mock utilities
jest.mock('@/lib/tenant-page-utils', () => ({
  generateTenantPageMetadata: jest.fn(),
  checkPageAccessible: jest.fn(),
}));

describe('About Page [slug]', () => {
  test('renders when context available', async () => {
    const mockContext = {
      tenant: { id: '1', name: 'Test Tenant', branding: {} },
      basePath: '/t/test',
      config: undefined,
    };

    (checkPageAccessible as jest.Mock).mockResolvedValue(mockContext);

    const result = await AboutPage({
      params: Promise.resolve({ slug: 'test' }),
    });

    expect(screen.getByText('About')).toBeInTheDocument();
  });

  test('returns notFound when context null', async () => {
    (checkPageAccessible as jest.Mock).mockResolvedValue(null);

    expect(() => AboutPage({ params: Promise.resolve({ slug: 'invalid' }) })).toThrow();
  });

  test('generates correct metadata', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'test' }),
    });

    expect(metadata.title).toContain('About');
  });
});
```

---

### Manual Testing Checklist

Before shipping a new page, test both routes:

```markdown
## Manual Testing Checklist

### [slug] Route: /t/test-tenant/about

- [ ] Page loads without errors
- [ ] Content displays correctly
- [ ] All internal links work (no 404s)
- [ ] Internal links don't include query params
- [ ] Metadata in `<head>` correct (title, og:image, etc.)
- [ ] Error page appears when throwing error
- [ ] 404 page appears when page disabled
- [ ] Page includes correct tenant content (not random tenant)

### \_domain Route: /t/\_domain/about?domain=test-tenant.com

- [ ] Page loads without errors
- [ ] Content displays correctly (same as [slug] route)
- [ ] All internal links include ?domain=... query param
- [ ] Metadata in `<head>` correct
- [ ] Page redirects to 404 if domain param missing
- [ ] Page redirects to 404 if domain invalid
- [ ] Error page appears when throwing error
- [ ] 404 page appears when page disabled
- [ ] Page includes correct tenant content (matching domain)

### Content Verification

- [ ] Content is identical between /t/test/about and /t/\_domain/about?domain=test
- [ ] Visual styling is identical
- [ ] Responsive design works on both routes
- [ ] Loading states (Suspense) work on both routes
- [ ] Link colors/hover states identical
```

---

## Common Mistakes & How to Avoid Them

### Mistake 1: Passing Slug Directly to Component

**Wrong:**

```typescript
// [slug]/page.tsx
const { slug } = await params;
return <AboutPageContent slug={slug} />;

// AboutPageContent.tsx
export function AboutPageContent({ slug }: { slug: string }) {
  return <Link href={`/t/${slug}/services`}>Services</Link>;
}
```

**Problem:** Component hardcodes `/t/` prefix. Won't work with \_domain routes.

**Correct:**

```typescript
// [slug]/page.tsx
const context = await checkPageAccessible(identifier, 'about');
return <AboutPageContent tenant={context.tenant} basePath={context.basePath} />;

// AboutPageContent.tsx
export function AboutPageContent({ tenant, basePath, domainParam = '' }: Props) {
  return <Link href={`${basePath}/services${domainParam}`}>Services</Link>;
}
```

---

### Mistake 2: Forgetting Domain Guard in \_domain Route

**Wrong:**

```typescript
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { domain } = await searchParams;
  // No guard! What if domain is undefined?
  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'about');
}
```

**Problem:** Generates metadata for undefined domain. SEO issues.

**Correct:**

```typescript
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) {
    return { title: 'About | Business Not Found', robots: { index: false, follow: false } };
  }
  const identifier: TenantIdentifier = { type: 'domain', domain };
  return generateTenantPageMetadata(identifier, 'about');
}
```

---

### Mistake 3: Duplicating Utility Functions

**Wrong:**

```typescript
// [slug]/page.tsx
const tenant = await getTenantBySlug(slug);

// _domain/page.tsx
const tenant = await getTenantByDomain(domain);

// Later, logic changes...bug in one but not the other!
```

**Problem:** Two functions to maintain. Bug fixes don't propagate.

**Correct:**

```typescript
// Both routes use same utility
const context = await resolveTenant(identifier);
```

---

### Mistake 4: Different Error Handling Between Routes

**Wrong:**

```typescript
// [slug]/page.tsx
if (!context) {
  notFound();
}

// _domain/page.tsx
if (!context) {
  return <div>Not found</div>;
}
```

**Problem:** Inconsistent user experience. One 404s, one shows content.

**Correct:**

```typescript
// Both routes
if (!context) {
  notFound();
}
```

---

### Mistake 5: Not Passing domainParam to Component

**Wrong:**

```typescript
// _domain/page.tsx
return <AboutPageContent tenant={context.tenant} basePath={context.basePath} />;
// Missing domainParam!

// AboutPageContent.tsx
const servicesLink = `${basePath}/services`; // No query param
```

**Problem:** Links on domain route lose domain context. Breaks tenant isolation.

**Correct:**

```typescript
// _domain/page.tsx
return (
  <AboutPageContent
    tenant={context.tenant}
    basePath={context.basePath}
    domainParam={context.domainParam}
  />
);

// AboutPageContent.tsx
const servicesLink = `${basePath}/services${domainParam}`;
```

---

## Quick Reference: Minimal Template

When adding a new page, copy this template and customize:

### Shared Utility (add to tenant-page-utils.ts if needed)

```typescript
export async function checkPageAccessibleForNewPage(
  identifier: TenantIdentifier,
  pageName: 'newpage'
): Promise<ResolvedTenantContext | null> {
  const result = await resolveTenant(identifier);
  if (!result.success) return null;
  if (!isPageEnabled(result.data.config, pageName)) return null;
  return result.data;
}
```

### [slug] Page

```typescript
// apps/web/src/app/t/[slug]/(site)/newpage/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NewPageContent } from '@/components/tenant';
import { generateTenantPageMetadata, checkPageAccessible, type TenantIdentifier } from '@/lib/tenant-page-utils';

interface NewPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: NewPageProps): Promise<Metadata> {
  const { slug } = await params;
  return generateTenantPageMetadata({ type: 'slug', slug }, 'newpage');
}

export default async function NewPage({ params }: NewPageProps) {
  const { slug } = await params;
  const context = await checkPageAccessible({ type: 'slug', slug }, 'newpage');
  if (!context) notFound();
  return <NewPageContent tenant={context.tenant} basePath={context.basePath} />;
}

export const revalidate = 60;
```

### [slug] Error Boundary

```typescript
// apps/web/src/app/t/[slug]/(site)/newpage/error.tsx
'use client';
import { TenantErrorBoundary } from '@/components/tenant';

export default function NewPageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <TenantErrorBoundary error={error} reset={reset} context="newpage" />;
}
```

### \_domain Page

```typescript
// apps/web/src/app/t/_domain/newpage/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NewPageContent } from '@/components/tenant';
import { generateTenantPageMetadata, checkPageAccessible, type TenantIdentifier } from '@/lib/tenant-page-utils';

interface NewPageProps {
  searchParams: Promise<{ domain?: string }>;
}

export async function generateMetadata({ searchParams }: NewPageProps): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) return { title: 'Page Not Found', robots: { index: false, follow: false } };
  return generateTenantPageMetadata({ type: 'domain', domain }, 'newpage');
}

export default async function NewPage({ searchParams }: NewPageProps) {
  const { domain } = await searchParams;
  if (!domain) notFound();
  const context = await checkPageAccessible({ type: 'domain', domain }, 'newpage');
  if (!context) notFound();
  return (
    <NewPageContent
      tenant={context.tenant}
      basePath={context.basePath}
      domainParam={context.domainParam}
    />
  );
}

export const revalidate = 60;
```

### \_domain Error Boundary

```typescript
// apps/web/src/app/t/_domain/newpage/error.tsx
'use client';
import { TenantErrorBoundary } from '@/components/tenant';

export default function NewPageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <TenantErrorBoundary error={error} reset={reset} context="newpage (domain)" />;
}
```

---

## Decision Tree: Should I Use This Pattern?

```
Does my project have multiple routing strategies?
├─ No → Use direct implementation (no pattern needed)
└─ Yes → Will I implement the same page for both routes?
         ├─ No → Use direct implementation
         └─ Yes → Is the logic >70% identical?
                  ├─ No → Use direct implementation
                  └─ Yes → APPLY THIS PATTERN
                           ├─ Create TenantIdentifier union type
                           ├─ Create shared utility functions
                           ├─ Implement minimal page wrappers
                           ├─ Share components via basePath + domainParam
                           └─ Use shared error boundaries
```

---

## Maintenance: Updating Both Routes

When adding a feature that affects both routes:

1. **Modify shared utility first** (tenant-page-utils.ts)
2. **Update shared component** (PageContent.tsx) to accept new props
3. **Update both page.tsx files** to pass new props
4. **Update tests** for both routes

**Verify with:**

```bash
# Run tests for both route types
npm run test:e2e -- tenant-pages

# Manual check
curl http://localhost:3000/t/test/about
curl http://localhost:3000/t/_domain/about?domain=test.com
```

---

## Related Prevention Strategies

- **[mais-critical-patterns](/docs/solutions/patterns/mais-critical-patterns.md)** - Tenant isolation, multi-tenant patterns
- **[nextjs-migration-lessons-learned](/docs/solutions/code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)** - App Router patterns from production migration
- **[BRAND_VOICE_GUIDE](/docs/design/BRAND_VOICE_GUIDE.md)** - Component design principles

---

## Summary

**Key Takeaway:** Use a `TenantIdentifier` union type + shared utilities to implement dual routes without duplication.

**When to Apply:** 3+ pages across 2+ route types
**Maintenance Burden:** Reduced ~60% (change logic once, not twice)
**Test Coverage:** Write utilities once, test both routes with E2E
**Code Review Focus:** Shared utilities, no hardcoded routes, consistent patterns

**Implementation Time:** ~30 minutes per new page (vs. 50 minutes without pattern)
