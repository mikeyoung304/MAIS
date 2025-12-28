---
title: Batch P2/P3 Code Review Resolution - Tenant Multi-Page Sites
date: 2025-12-25
category: code-review-patterns
severity: P2/P3
status: resolved
components:
  - apps/web/src/app/t/[slug]/(site)
  - apps/web/src/app/t/_domain
  - apps/web/src/components/tenant
  - apps/web/src/lib
tags:
  - code-review
  - tenant-sites
  - next.js
  - accessibility
  - performance
  - code-quality
  - dry-principle
  - react-memoization
commit: 661d464
pr: '#18'
resolution_time: 50min
findings_resolved: 15
---

# Batch P2/P3 Code Review Resolution - Tenant Multi-Page Sites

## Problem Summary

PR #18 (tenant multi-page sites) introduced a feature with 17 code review findings. After resolving the 2 P1 accessibility violations, 15 P2/P3 findings remained across these categories:

- **Code Duplication** (4 findings): formatPrice, navItems, tierOrder duplicated
- **Performance** (3 findings): Missing cache(), useMemo, useCallback
- **Accessibility** (2 findings): Missing aria-current, low contrast error text
- **Error Handling** (2 findings): Missing error boundaries, AbortController
- **Validation** (1 finding): Missing domain parameter validation
- **Architecture** (3 findings): Broken navigation links, unused props, animation jank

## Root Cause

The multi-page tenant sites feature duplicated code between slug-based routes (`/t/[slug]/*`) and domain-based routes (`/t/_domain/*`) without extracting shared utilities. This created maintenance burden and inconsistent behavior.

## Solution

### 1. Extract Shared Utilities

Created three new utility files to eliminate duplication:

**lib/format.ts** - Price formatting

```typescript
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
```

**lib/packages.ts** - Package tier ordering

```typescript
export const TIER_ORDER: Record<string, number> = {
  BASIC: 0,
  STANDARD: 1,
  PREMIUM: 2,
  CUSTOM: 3,
};
```

**components/tenant/navigation.ts** - Navigation configuration

```typescript
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '' },
  { label: 'Services', path: '/services' },
  { label: 'About', path: '/about' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Contact', path: '/contact' },
];

export function buildNavHref(basePath: string, item: NavItem, domainParam?: string): string {
  // Handles both slug-based and domain-based routes
}
```

### 2. Request Deduplication with cache()

Wrapped `getTenantByDomain` with React's `cache()` to prevent duplicate API calls during SSR:

```typescript
// Before: Multiple calls per request
export async function getTenantByDomain(domain: string) { ... }

// After: Deduplicated within same request
export const getTenantByDomain = cache(async (domain: string) => { ... });
```

### 3. Domain Validation Helper

Added validation before database lookup to prevent errors:

```typescript
export function validateDomain(domain: string | undefined): string {
  if (!domain) throw new InvalidDomainError('Domain parameter is required');
  const sanitized = domain.trim().toLowerCase();
  if (!DOMAIN_PATTERN.test(sanitized)) throw new InvalidDomainError('Invalid domain format');
  return sanitized;
}
```

### 4. Error Boundaries for Domain Routes

Added `error.tsx` to all domain route folders:

```typescript
// apps/web/src/app/t/_domain/error.tsx (and subdirectories)
'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    logger.error('Domain storefront error boundary caught error', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

### 5. Accessibility: aria-current for Active Links

Added `aria-current="page"` to active navigation links:

```typescript
<Link
  href={item.href}
  aria-current={isActiveLink(item.href) ? 'page' : undefined}
  className={isActiveLink(item.href) ? 'text-sage' : 'text-text-muted'}
>
  {item.label}
</Link>
```

### 6. WCAG AA Color Contrast

Changed error text from `red-500` to `red-700` for proper contrast:

```typescript
// Before: Fails WCAG AA (4.14:1 on white)
<p className="text-red-500">Error message</p>

// After: Passes WCAG AA (6.05:1 on white)
<p className="text-red-700">Error message</p>
```

### 7. AbortController for Form Cleanup

Added proper cleanup to ContactForm to prevent state updates on unmounted components:

```typescript
const abortControllerRef = useRef<AbortController | null>(null);

useEffect(() => {
  return () => abortControllerRef.current?.abort();
}, []);

const handleSubmit = useCallback(async (e: React.FormEvent) => {
  abortControllerRef.current?.abort();
  abortControllerRef.current = new AbortController();

  try {
    await fetch(url, { signal: abortControllerRef.current.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    setStatus('error');
  }
}, []);
```

### 8. React Memoization

Added `useMemo` for arrays and `useCallback` for functions:

```typescript
// Memoize navItems array
const navItems = useMemo<NavItemWithHref[]>(
  () =>
    NAV_ITEMS.map((item) => ({
      label: item.label,
      href: buildNavHref(basePath, item, domainParam),
    })),
  [basePath, domainParam]
);

// Memoize isActiveLink with JSDoc
/**
 * Determines if a navigation link is active based on current pathname.
 */
const isActiveLink = useCallback(
  (href: string) => {
    const hrefPath = href.split('?')[0] || '/';
    return pathname.startsWith(hrefPath);
  },
  [pathname]
);
```

### 9. CSS Grid Animation for FAQ Accordion

Replaced max-height hack with CSS Grid for smoother animations:

```typescript
// Before: Jerky animation with arbitrary max-height
<div className={isOpen ? 'max-h-96' : 'max-h-0'}>

// After: Smooth CSS Grid animation
<div style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
  <div className="overflow-hidden">
    {content}
  </div>
</div>
```

## Files Changed

### New Files (8)

- `apps/web/src/lib/format.ts`
- `apps/web/src/lib/packages.ts`
- `apps/web/src/components/tenant/navigation.ts`
- `apps/web/src/app/t/_domain/error.tsx`
- `apps/web/src/app/t/_domain/about/error.tsx`
- `apps/web/src/app/t/_domain/services/error.tsx`
- `apps/web/src/app/t/_domain/faq/error.tsx`
- `apps/web/src/app/t/_domain/contact/error.tsx`

### Modified Files (13)

- `apps/web/src/lib/tenant.ts` - cache(), validateDomain
- `apps/web/src/components/tenant/TenantNav.tsx` - memoization, aria-current
- `apps/web/src/components/tenant/TenantFooter.tsx` - shared nav config
- `apps/web/src/app/t/[slug]/(site)/TenantLandingPage.tsx` - shared formatPrice
- `apps/web/src/app/t/[slug]/(site)/services/page.tsx` - shared utilities
- `apps/web/src/app/t/[slug]/(site)/faq/page.tsx` - remove unused prop
- `apps/web/src/app/t/[slug]/(site)/faq/FAQAccordion.tsx` - CSS Grid, remove prop
- `apps/web/src/app/t/[slug]/(site)/contact/ContactForm.tsx` - AbortController, contrast
- `apps/web/src/app/t/_domain/layout.tsx` - validation, basePath/domainParam
- `apps/web/src/app/t/_domain/about/page.tsx` - validation, proper links
- `apps/web/src/app/t/_domain/services/page.tsx` - validation, shared utilities
- `apps/web/src/app/t/_domain/faq/page.tsx` - validation, domainParam
- `apps/web/src/app/t/_domain/contact/page.tsx` - validation

## Prevention Strategies

### Code Duplication Checklist

- [ ] Check if utility function exists in `lib/` before creating new one
- [ ] If same code appears in 2+ files, extract to shared module
- [ ] Use shared config for navigation, constants, formatters

### Performance Checklist

- [ ] Wrap shared SSR data fetchers with `cache()`
- [ ] Use `useMemo` for arrays/objects created in render
- [ ] Use `useCallback` for functions passed to child components
- [ ] Add AbortController to fetch operations in useEffect/handlers

### Accessibility Checklist

- [ ] Add `aria-current="page"` to active navigation links
- [ ] Use `text-red-700` (not red-500) for error messages
- [ ] Every dynamic route has `error.tsx` boundary

### Validation Checklist

- [ ] Validate URL parameters before database lookup
- [ ] Use custom error classes for clear error handling
- [ ] Return 404 for invalid parameters, not 500

## Metrics

| Metric            | Value            |
| ----------------- | ---------------- |
| Resolution time   | ~50 minutes      |
| Findings resolved | 15 (11 P2, 4 P3) |
| Files created     | 8                |
| Files modified    | 13               |
| Lines added       | 621              |
| Lines removed     | 157              |
| TypeScript errors | 0                |

## Related Documentation

- [Next.js Migration Lessons](nextjs-migration-lessons-learned-MAIS-20251225.md)
- [React Memoization Quick Reference](../react-performance/REACT-MEMOIZATION-QUICK-REFERENCE.md)
- [ADR-014: Next.js App Router Migration](../../adrs/ADR-014-nextjs-app-router-migration.md)
- [Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)

## Key Takeaways

1. **Extract shared logic early** - DRY violations compound quickly in route-based architectures
2. **React cache() is essential for SSR** - Prevents redundant API calls during server rendering
3. **Error boundaries are non-negotiable** - Every dynamic route needs `error.tsx`
4. **Accessibility is table stakes** - aria-current, color contrast, semantic HTML
5. **Cleanup prevents memory leaks** - AbortController for fetch, proper memoization deps
6. **CSS Grid > max-height** - For animations, CSS Grid provides smoother, more predictable results
