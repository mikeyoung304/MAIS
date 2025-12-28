---
module: MAIS
date: 2025-12-25
problem_type: code_review_reference
component: code_review_checklists
severity: P3
tags: [code-review, MAIS-patterns, best-practices, examples]
---

# MAIS-Specific Code Review Patterns

**Real examples from the MAIS codebase with before/after comparisons.**

---

## 1. Next.js Multi-Page Tenant Storefronts

### Pattern: Slug-Based vs Domain-Based Routing

The tenant storefront supports two routing patterns:

1. **Slug-based:** `/t/jane-photography/services`
2. **Domain-based:** `janephotography.com/services` (custom domain)

Code should handle both patterns transparently.

#### Navigation Building

```typescript
// FILE: apps/web/src/components/tenant/navigation.ts

// Single source of truth for navigation structure
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '' },
  { label: 'Services', path: '/services' },
  { label: 'About', path: '/about' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Contact', path: '/contact' },
];

/**
 * Build full href from basePath and nav item
 *
 * Handles both slug-based paths (/t/slug) and domain-based paths
 * with query parameters.
 *
 * @example
 * // Slug-based: /t/jane/services
 * buildNavHref('/t/jane', { label: 'Services', path: '/services' })
 *
 * // Domain-based: /services?domain=example.com
 * buildNavHref('', { label: 'Services', path: '/services' }, '?domain=example.com')
 */
export function buildNavHref(basePath: string, item: NavItem, domainParam?: string): string {
  // For home page with domain param, return root with param
  if (item.path === '' && domainParam) {
    return `/${domainParam}`;
  }

  // For home page without domain param, return basePath
  if (item.path === '') {
    return basePath || '/';
  }

  // For other pages
  const fullPath = `${basePath}${item.path}`;

  // Append domain param if present
  if (domainParam) {
    return `${fullPath}${domainParam}`;
  }

  return fullPath;
}
```

**Code Review Checklist:**

- [ ] NAV_ITEMS is in single file (not duplicated)
- [ ] buildNavHref handles both slug and domain routes
- [ ] Documentation explains both patterns
- [ ] Tests cover edge cases (home page, subpages, domain params)

---

## 2. Tenant Data Fetching with Cache

### Pattern: SSR Data Deduplication

Next.js `generateMetadata()` and page components often call the same data function. Without `cache()`, you get duplicate API calls per request.

```typescript
// FILE: apps/web/src/lib/tenant.ts

/**
 * Fetch tenant public data by custom domain
 *
 * Used by middleware rewrite for custom domain resolution.
 * Wrapped with React's cache() to deduplicate calls within the same request.
 *
 * @param domain - Custom domain (e.g., "janephotography.com")
 * @returns TenantPublicDto with branding and landing page config
 * @throws TenantNotFoundError if no tenant has this domain
 * @throws TenantApiError for other API failures
 */
export const getTenantByDomain = cache(async (domain: string): Promise<TenantPublicDto> => {
  const url = `${API_BASE_URL}/v1/public/tenants/by-domain/${encodeURIComponent(domain)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    next: { revalidate: 60 }, // ISR: revalidate every 60s
  });

  if (response.status === 404) {
    throw new TenantNotFoundError(domain);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new TenantApiError(`Failed to fetch tenant by domain: ${errorBody}`, response.status);
  }

  return response.json();
});

/**
 * Fetch all storefront data for a tenant in parallel
 *
 * Optimized for SSR - fetches tenant, packages, and segments concurrently.
 * Wrapped with React's cache() to deduplicate calls within the same request.
 *
 * @param slug - Tenant slug
 * @returns Complete storefront data
 */
export const getTenantStorefrontData = cache(
  async (slug: string): Promise<TenantStorefrontData> => {
    // First fetch tenant to get API key
    const tenant = await getTenantBySlug(slug);

    // Then fetch packages and segments in parallel
    const [packages, segments] = await Promise.all([
      getTenantPackages(tenant.apiKeyPublic),
      getTenantSegments(tenant.apiKeyPublic),
    ]);

    return { tenant, packages, segments };
  }
);
```

**Usage in layout and page:**

```typescript
// FILE: apps/web/src/app/t/[slug]/(site)/layout.tsx

import { getTenantStorefrontData } from '@/lib/tenant';

export async function generateMetadata({
  params: { slug },
}: {
  params: { slug: string };
}): Promise<Metadata> {
  // ✓ Calls getTenantStorefrontData
  const { tenant } = await getTenantStorefrontData(slug);

  return {
    title: tenant.name,
    description: tenant.branding?.tagline,
  };
}

export default async function Layout({
  params: { slug },
  children,
}: {
  params: { slug: string };
  children: React.ReactNode;
}) {
  // ✓ Calls getTenantStorefrontData again (but cache() deduplicates!)
  const { tenant, packages, segments } = await getTenantStorefrontData(slug);

  return (
    <TenantProvider data={{ tenant, packages, segments }}>
      {children}
    </TenantProvider>
  );
}
```

**Key Points:**

- Both `generateMetadata` and component call same function
- `cache()` wrapper prevents duplicate API calls in same request
- Each new request starts with fresh cache
- Works seamlessly with ISR (60s revalidation)

**Code Review Checklist:**

- [ ] SSR functions wrapped with `cache()`
- [ ] No duplicate fetch calls in same request
- [ ] `next: { revalidate: 60 }` set for ISR pages
- [ ] Error classes are domain-specific (TenantNotFoundError, etc.)
- [ ] Functions are async (not promises in variables)

---

## 3. Error Boundaries for Dynamic Routes

### Pattern: Nested error boundaries

Dynamic routes need error boundaries at each level to handle route-specific errors.

```typescript
// FILE: apps/web/src/app/t/_domain/error.tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    logger.error('Domain storefront error boundary caught error', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="text-center space-y-4 p-8">
        <h2 className="text-2xl font-bold text-text-primary">
          Something went wrong
        </h2>
        <p className="text-text-muted">
          We encountered an unexpected error. Please try again.
        </p>
        <Button onClick={reset} variant="default">
          Try again
        </Button>
      </div>
    </div>
  );
}
```

**Needed in all these locations:**

```
apps/web/src/app/t/
├── [slug]/
│   ├── error.tsx ← Handles slug route errors
│   ├── (site)/
│   │   ├── error.tsx ← Handles site group errors
│   │   ├── contact/
│   │   │   ├── error.tsx ← Handles contact page errors
│   │   │   └── page.tsx
│   │   ├── faq/
│   │   │   ├── error.tsx ← Handles FAQ page errors
│   │   │   └── page.tsx
│   │   └── services/
│   │       ├── error.tsx ← Handles services page errors
│   │       └── page.tsx
│   └── layout.tsx
└── _domain/
    ├── error.tsx ← Handles domain route errors
    ├── layout.tsx
    ├── about/
    │   ├── error.tsx ← Handles domain about errors
    │   └── page.tsx
    ├── contact/
    │   ├── error.tsx ← Handles domain contact errors
    │   └── page.tsx
    └── services/
        ├── error.tsx ← Handles domain services errors
        └── page.tsx
```

**Code Review Checklist:**

- [ ] Every `[param]` route has `error.tsx`
- [ ] Every nested segment with data fetching has `error.tsx`
- [ ] Error boundary uses `logger.error()` for monitoring
- [ ] Error boundary provides `reset()` recovery button
- [ ] No unhandled promise rejections in route handlers
- [ ] Error messages don't expose sensitive info

---

## 4. Form Submission with Cleanup

### Pattern: AbortController for unmount safety

Long-running form submissions need cleanup to prevent memory leaks.

```typescript
// FILE: apps/web/src/app/t/[slug]/(site)/contact/ContactForm.tsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export function ContactForm({ tenantName, basePath }: ContactFormProps) {
  const [status, setStatus] = useState<FormStatus>('idle');
  const abortControllerRef = useRef<AbortController | null>(null);

  // ✓ Cleanup on unmount - abort any in-flight requests
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // ✓ Mark form as submitting
    setStatus('submitting');

    // ✓ Cancel any previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      // ✓ Phase 1: Simulate success (Phase 2 will use real API)
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(resolve, 1000);
        abortControllerRef.current!.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

      // ✓ Don't update state if aborted
      if (abortControllerRef.current?.signal.aborted) return;

      setStatus('success');
    } catch (error) {
      // ✓ Silently ignore aborted requests
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setStatus('error');
    }
  }, []);

  // Form JSX...
}
```

**Why this matters:**

- User submits form
- User navigates away before response
- Component unmounts
- Response arrives → setState warning + memory leak
- AbortController prevents this

**Code Review Checklist:**

- [ ] useEffect cleanup aborts pending requests
- [ ] AbortController signal passed to fetch
- [ ] State update guarded with `signal.aborted` check
- [ ] AbortError caught and handled silently
- [ ] Form shows loading state during submission
- [ ] Success/error states provide recovery options

---

## 5. Formatting Utilities (Single Source of Truth)

### Pattern: Extracting formatting functions

```typescript
// FILE: apps/web/src/lib/format.ts

/**
 * Formatting Utilities
 *
 * Shared formatting functions for the storefront.
 */

/**
 * Format price from cents to dollars
 *
 * Uses Intl.NumberFormat for consistent currency formatting.
 *
 * @param cents - Price in cents (e.g., 9999 = $99.99)
 * @returns Formatted currency string (e.g., "$100")
 *
 * @example
 * formatPrice(9999)  // "$100"
 * formatPrice(15000) // "$150"
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
```

**Before (duplication):**

```typescript
// In TenantLandingPage.tsx
const formattedPrice = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
}).format(packagePrice / 100);

// In services/page.tsx (identical)
const formattedPrice = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
}).format(packagePrice / 100);

// In multiple other files...
```

**After (single source):**

```typescript
// In any file that needs formatting
import { formatPrice } from '@/lib/format';

const formattedPrice = formatPrice(packagePrice);
```

**Code Review Checklist:**

- [ ] No Intl.NumberFormat duplication across files
- [ ] Utility function has clear JSDoc with examples
- [ ] Function is pure (no side effects)
- [ ] Named exports, not default export
- [ ] Tests verify formatting in all contexts

---

## 6. Memoization for Navigation

### Pattern: Memoizing derived data

```typescript
// FILE: apps/web/src/components/tenant/TenantNav.tsx
'use client';

import { useMemo, useCallback } from 'react';
import { NAV_ITEMS, buildNavHref } from './navigation';

interface TenantNavProps {
  tenant: TenantPublicDto;
  basePath?: string;
  domainParam?: string;
}

export function TenantNav({ tenant, basePath: basePathProp, domainParam }: TenantNavProps) {
  // Use provided basePath or default to slug-based path
  const basePath = basePathProp ?? `/t/${tenant.slug}`;

  // ✓ Memoize navItems (only recreate when basePath or domainParam changes)
  const navItems = useMemo<NavItemWithHref[]>(
    () =>
      NAV_ITEMS.map((item) => ({
        label: item.label,
        href: buildNavHref(basePath, item, domainParam),
      })),
    [basePath, domainParam]
  );

  // ✓ Memoize isActiveLink function with JSDoc
  /**
   * Determines if a navigation link is active based on current pathname.
   *
   * - Home link: exact match only (prevents home from being "active" on subpages)
   * - Other links: prefix match (allows /services to match /services/foo)
   *
   * @param href - The navigation link href to check
   * @returns true if the link should be styled as active
   */
  const isActiveLink = useCallback(
    (href: string) => {
      const hrefPath = href.split('?')[0] || '/';
      const homeHref = domainParam ? '/' : basePath;

      if (hrefPath === homeHref || hrefPath === '') {
        return pathname === homeHref || pathname === '/';
      }
      return pathname.startsWith(hrefPath);
    },
    [basePath, domainParam, pathname]
  );

  return (
    <nav aria-label="Main navigation">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActiveLink(item.href) ? 'page' : undefined}
          className={isActiveLink(item.href) ? 'active' : ''}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

**Code Review Checklist:**

- [ ] Array/object memoized with useMemo
- [ ] Dependencies include all external variables
- [ ] Callbacks memoized with useCallback
- [ ] JSDoc explains complex logic
- [ ] aria-current set based on active link
- [ ] No inline styling, use className

---

## 7. Domain Parameter Validation

### Pattern: Validating before database queries

```typescript
// FILE: apps/web/src/lib/tenant.ts

/**
 * Domain validation pattern
 *
 * Matches valid domain names with:
 * - Alphanumeric first character
 * - Alphanumeric characters and hyphens in labels
 * - TLD of 2+ characters
 * - Supports subdomains
 */
const DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)*\.[a-zA-Z]{2,}$/;

/**
 * Custom error for invalid domain format
 */
export class InvalidDomainError extends Error {
  constructor(reason: string) {
    super(`Invalid domain: ${reason}`);
    this.name = 'InvalidDomainError';
  }
}

/**
 * Validate and sanitize domain parameter
 *
 * Validates domain format for security and returns sanitized value.
 * Use this before calling getTenantByDomain to provide clear error messages.
 *
 * @param domain - Domain string to validate
 * @returns Sanitized domain string (lowercase, trimmed)
 * @throws InvalidDomainError if domain is invalid
 *
 * @example
 * const domain = validateDomain(searchParams.domain);
 * const tenant = await getTenantByDomain(domain);
 */
export function validateDomain(domain: string | undefined): string {
  if (!domain || typeof domain !== 'string') {
    throw new InvalidDomainError('Domain parameter is required');
  }

  const sanitized = domain.trim().toLowerCase();

  if (sanitized.length === 0) {
    throw new InvalidDomainError('Domain cannot be empty');
  }

  if (sanitized.length > 253) {
    throw new InvalidDomainError('Domain too long (max 253 characters)');
  }

  if (!DOMAIN_PATTERN.test(sanitized)) {
    throw new InvalidDomainError('Invalid domain format');
  }

  return sanitized;
}
```

**Usage in route:**

```typescript
// FILE: apps/web/src/app/t/_domain/layout.tsx

export default async function DomainLayout({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  try {
    // ✓ Validate before using
    const domain = validateDomain(searchParams.domain);

    // ✓ Then fetch with validated domain
    const tenant = await getTenantByDomain(domain);

    return (
      <TenantProvider tenant={tenant}>
        {children}
      </TenantProvider>
    );
  } catch (error) {
    // ✓ Clear error message to user
    if (error instanceof InvalidDomainError) {
      return <NotFound />;
    }
    throw error; // Let error boundary handle
  }
}
```

**Code Review Checklist:**

- [ ] Domain validated before database query
- [ ] Domain regex validates format correctly
- [ ] Length limits enforced (max 253 chars)
- [ ] Custom error class with clear message
- [ ] Type checking (typeof domain === 'string')
- [ ] Sanitization (trim, lowercase)

---

## Pattern Summary Table

| Pattern           | File Location      | Key File      |
| ----------------- | ------------------ | ------------- |
| Navigation Config | components/tenant/ | navigation.ts |
| Data Fetching     | lib/               | tenant.ts     |
| Formatting        | lib/               | format.ts     |
| Utilities         | lib/               | packages.ts   |
| Error Boundaries  | app/[route]/       | error.tsx     |
| Validation        | lib/               | tenant.ts     |
| Components        | components/tenant/ | \*.tsx        |

---

## Testing MAIS Patterns

### Test file locations:

```
server/test/services/          → Business logic
apps/web/__tests__/             → Component tests
e2e/tests/                      → End-to-end tests
```

### Example test for formatting:

```typescript
import { formatPrice } from '@/lib/format';

describe('formatPrice', () => {
  it('formats cents to dollars', () => {
    expect(formatPrice(9999)).toBe('$100');
    expect(formatPrice(15000)).toBe('$150');
    expect(formatPrice(100)).toBe('$1');
  });
});
```

---

## References

- **[CODE-REVIEW-PREVENTION-STRATEGIES.md](./CODE-REVIEW-PREVENTION-STRATEGIES.md)** - Full prevention guide
- **[CODE-REVIEW-QUICK-REFERENCE.md](./CODE-REVIEW-QUICK-REFERENCE.md)** - 1-minute checklist
- **[apps/web/README.md](../../../apps/web/README.md)** - Next.js architecture
- **[CLAUDE.md](../../../CLAUDE.md)** - Project-specific patterns

---

**Last Updated:** 2025-12-25
**Commit Reference:** 661d464 (PR #18 fixes)
