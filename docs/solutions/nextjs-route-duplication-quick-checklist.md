# Next.js Route Duplication: Quick Checklist & Reference

**Quick decision tree:** Am I building a page that needs both [slug] AND \_domain routes?

- Yes → Use this checklist
- No → Skip it

---

## 10-Minute Implementation Checklist

Use when adding a new tenant page to both `/t/[slug]` and `/t/_domain` routes.

### Pre-flight (2 min)

- [ ] Understand page name (e.g., 'services', 'faq', 'gallery')
- [ ] Check if shared utilities exist in `/lib/tenant-page-utils.ts`
- [ ] Create or update content component (e.g., `ServicesPageContent.tsx`)

### Step 1: [slug] Route Page (3 min)

**File:** `/app/t/[slug]/(site)/[page]/page.tsx`

Copy template below, replace `[page]` and `[Page]`:

```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { [Page]PageContent } from '@/components/tenant';
import {
  generateTenantPageMetadata,
  checkPageAccessible,
  type TenantIdentifier,
} from '@/lib/tenant-page-utils';

interface [Page]PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: [Page]PageProps): Promise<Metadata> {
  const { slug } = await params;
  return generateTenantPageMetadata({ type: 'slug', slug }, '[page]');
}

export default async function [Page]Page({ params }: [Page]PageProps) {
  const { slug } = await params;
  const context = await checkPageAccessible({ type: 'slug', slug }, '[page]');
  if (!context) notFound();
  return <[Page]PageContent tenant={context.tenant} basePath={context.basePath} />;
}

export const revalidate = 60;
```

**Pre-commit check:**

- [ ] `params` is `Promise<{ slug: string }>`
- [ ] `TenantIdentifier` created with `{ type: 'slug', slug }`
- [ ] `checkPageAccessible` called with identifier and page name
- [ ] `notFound()` called if context is null
- [ ] `revalidate = 60` exported

### Step 2: [slug] Error Boundary (1 min)

**File:** `/app/t/[slug]/(site)/[page]/error.tsx`

```typescript
'use client';
import { TenantErrorBoundary } from '@/components/tenant';

export default function [Page]Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <TenantErrorBoundary error={error} reset={reset} context="[page]" />;
}
```

**Pre-commit check:**

- [ ] `'use client'` directive present
- [ ] Passes `context="[page]"` (e.g., "services", "faq")

### Step 3: \_domain Route Page (3 min)

**File:** `/app/t/_domain/[page]/page.tsx`

```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { [Page]PageContent } from '@/components/tenant';
import {
  generateTenantPageMetadata,
  checkPageAccessible,
  type TenantIdentifier,
} from '@/lib/tenant-page-utils';

interface [Page]PageProps {
  searchParams: Promise<{ domain?: string }>;
}

export async function generateMetadata({ searchParams }: [Page]PageProps): Promise<Metadata> {
  const { domain } = await searchParams;
  if (!domain) {
    return { title: '[Page] | Business Not Found', robots: { index: false, follow: false } };
  }
  return generateTenantPageMetadata({ type: 'domain', domain }, '[page]');
}

export default async function [Page]Page({ searchParams }: [Page]PageProps) {
  const { domain } = await searchParams;
  if (!domain) notFound();
  const context = await checkPageAccessible({ type: 'domain', domain }, '[page]');
  if (!context) notFound();
  return (
    <[Page]PageContent
      tenant={context.tenant}
      basePath={context.basePath}
      domainParam={context.domainParam}
    />
  );
}

export const revalidate = 60;
```

**Pre-commit check:**

- [ ] `searchParams` is `Promise<{ domain?: string }>`
- [ ] Domain guard in `generateMetadata` with fallback metadata
- [ ] Domain guard in page function with `notFound()`
- [ ] `TenantIdentifier` created with `{ type: 'domain', domain }`
- [ ] `domainParam` passed to component

### Step 4: \_domain Error Boundary (1 min)

**File:** `/app/t/_domain/[page]/error.tsx`

```typescript
'use client';
import { TenantErrorBoundary } from '@/components/tenant';

export default function [Page]Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <TenantErrorBoundary error={error} reset={reset} context="[page] (domain)" />;
}
```

**Pre-commit check:**

- [ ] Context includes "(domain)" suffix

### Step 5: Content Component (depends on logic)

**File:** `/components/tenant/[Page]PageContent.tsx`

Required props:

```typescript
interface [Page]PageContentProps {
  tenant: TenantPublicDto;
  basePath: string;           // '/t/slug' or ''
  domainParam?: string;       // '?domain=...' or undefined
}
```

Required in all links:

```typescript
// WRONG: const link = `/services`;
// WRONG: const link = `/t/${tenant.slug}/services`;

// CORRECT:
const link = `${basePath}/services${domainParam || ''}`;
```

**Pre-commit check:**

- [ ] Accepts `tenant`, `basePath`, `domainParam` props
- [ ] All links use `${basePath}...${domainParam || ''}`
- [ ] No hardcoded `/t/` or `/t/_domain/`
- [ ] No route-type awareness in component

---

## Common Mistakes Quick Reference

| Mistake                  | Wrong                                             | Right                                       |
| ------------------------ | ------------------------------------------------- | ------------------------------------------- |
| Hardcoded routes         | `href="/t/${slug}/services"`                      | `href="${basePath}/services${domainParam}"` |
| No domain guard          | `await checkPageAccessible(identifier, 'page')`   | Check `if (!domain)` first in \_domain      |
| Missing query param      | `href="${basePath}/services"`                     | `href="${basePath}/services${domainParam}"` |
| Slug in component props  | `<Component slug={slug} />`                       | `<Component basePath={basePath} />`         |
| Different error handling | [slug] uses `notFound()`, \_domain uses component | Both use `notFound()`                       |
| No revalidate            | Page rendered fully dynamic                       | `export const revalidate = 60;`             |

---

## Code Review Red Flags (5 seconds)

Reject PR if you see:

- [ ] `href=` containing hardcoded `/t/` or slug
- [ ] Component receiving `slug` or `domain` props
- [ ] Different error handling between routes
- [ ] \_domain page missing domain guard
- [ ] `domainParam` not passed to component
- [ ] Content duplicated between [slug] and \_domain

---

## Testing Checklist (Before Deploy)

Run these tests:

```bash
# Unit test shared utilities
npm run test -- lib/tenant-page-utils.test.ts

# E2E test both routes
npm run test:e2e -- tenant-pages
```

Manual checks:

- [ ] `/t/test-tenant/[page]` loads and renders correctly
- [ ] `/t/_domain/[page]?domain=test.com` loads identically
- [ ] All links on [slug] route don't have query params
- [ ] All links on \_domain route include `?domain=test.com`
- [ ] Error page shows on both routes when throwing
- [ ] 404 page shows when page disabled on both routes
- [ ] Metadata correct in `<head>` for both routes

---

## File Structure Reference

```
apps/web/src/
├── lib/
│   ├── tenant-page-utils.ts              // Shared utilities (resolveTenant, etc.)
│   └── tenant.ts                         // Tenant data fetching
├── components/
│   └── tenant/
│       ├── TenantErrorBoundary.tsx       // Shared error boundary
│       ├── [Page]PageContent.tsx         // Shared page content
│       └── sections/                     // Shared section components
└── app/
    └── t/
        ├── [slug]/
        │   └── (site)/
        │       └── [page]/
        │           ├── page.tsx          // [slug] page
        │           └── error.tsx         // [slug] error
        └── _domain/
            └── [page]/
                ├── page.tsx              // _domain page
                └── error.tsx             // _domain error
```

---

## TenantIdentifier Type

```typescript
// Only type you need to know:
type TenantIdentifier = { type: 'slug'; slug: string } | { type: 'domain'; domain: string };

// Usage in both routes:
const identifier: TenantIdentifier = { type: 'slug', slug }; // [slug]
const identifier: TenantIdentifier = { type: 'domain', domain }; // _domain
```

---

## When to Use Each Utility

| Function                                      | Use For                                | Returns                                             |
| --------------------------------------------- | -------------------------------------- | --------------------------------------------------- |
| `resolveTenant(id)`                           | Basic page data                        | `ResolvedTenantContext` (tenant + config)           |
| `resolveTenantWithStorefront(id)`             | Pages needing packages/segments        | `ResolvedStorefrontContext` (+ packages + segments) |
| `generateTenantPageMetadata(id, page)`        | Metadata in page/generateMetadata      | `Metadata` object                                   |
| `checkPageAccessible(id, page)`               | Check if page enabled + return context | `ResolvedTenantContext \| null`                     |
| `checkPageAccessibleWithStorefront(id, page)` | Check if page enabled + need packages  | `ResolvedStorefrontContext \| null`                 |

---

## Domain Route Tips

**Why \_domain route exists:** Supports custom domains (e.g., tenant uses their own domain)

**Special handling required:**

1. Check domain param exists (both in metadata & page)
2. Return 404 if missing
3. Pass domainParam to all components
4. All links need `?domain=...` query param

**Query string pattern:**

```typescript
// From _domain route, store domain param:
const domainParam = `?domain=${domain}`;

// Then append to all links:
<Link href={`${basePath}/services${domainParam}`}>
```

---

## Common Page Names

Use these exactly in `checkPageAccessible(id, 'PAGE_NAME')`:

- `'about'`
- `'services'`
- `'contact'`
- `'faq'`
- `'gallery'`
- `'testimonials'`

---

## Troubleshooting

**Q: Links not working on \_domain route?**
A: Check `domainParam` is passed to component and appended to all `href` values.

**Q: 404 on \_domain route even though page exists?**
A: Domain guard missing. Check `if (!domain) notFound()` in both page() and generateMetadata().

**Q: Metadata says "Business Not Found" but page loads?**
A: Domain guard in generateMetadata. Check returns proper metadata when domain provided.

**Q: Content differs between [slug] and \_domain?**
A: Check they use same component and same utilities. Verify component doesn't hardcode routes.

**Q: Error boundary not showing on \_domain?**
A: Check error.tsx has `'use client'` directive and imports `TenantErrorBoundary`.

---

## One-Liner Remember

**"TenantIdentifier goes to utilities; basePath + domainParam go to components."**

---

## See Full Guide

For detailed explanation, code review guidelines, testing strategy, and architecture rationale:

→ Read `/docs/solutions/nextjs-route-duplication-prevention-MAIS-20251228.md`
