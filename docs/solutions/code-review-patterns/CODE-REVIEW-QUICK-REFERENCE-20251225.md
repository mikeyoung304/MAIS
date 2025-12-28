# Code Review Quick Reference: P2/P3 Pattern Solutions

**Source:** Commit 661d464 - P2/P3 Code Review Resolution (15 findings)
**Read the full guide:** `P2-P3-CODE-REVIEW-RESOLUTION-20251225.md`

---

## 1. Extract Shared Utilities (Code Duplication)

**Problem:** Same function copy-pasted in 2+ files

**Solution:** Create shared `lib/` or config files

```typescript
// ✅ CORRECT: Single source of truth
// lib/format.ts
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

// Usage in multiple files
import { formatPrice } from '@/lib/format';
const price = formatPrice(9999); // "$100"
```

**Files to extract:**

- Currency formatting → `lib/format.ts`
- Package sorting → `lib/packages.ts`
- Navigation config → `components/tenant/navigation.ts`

---

## 2. Deduplicate SSR Requests with `cache()`

**Problem:** Same function called multiple times in one SSR render (layout + page, metadata + component)

**Solution:** Wrap with React `cache()` to deduplicate within request

```typescript
// ✅ CORRECT: One API call per request
import { cache } from 'react';

export const getTenantByDomain = cache(async (domain: string) => {
  const response = await fetch(`/api/tenants/by-domain/${domain}`);
  return response.json();
});

// In layout.tsx
const tenant1 = await getTenantByDomain('example.com'); // Calls API

// In page.tsx (same request)
const tenant2 = await getTenantByDomain('example.com'); // Returns cached value

// In next request
const tenant3 = await getTenantByDomain('example.com'); // Calls API again
```

**Scope:** Per-request only (doesn't persist across HTTP requests)

---

## 3. Validate User Input Before Database Lookup

**Problem:** Accepting unvalidated domain parameters causes crashes or unclear errors

**Solution:** Create validation function that throws descriptive errors

```typescript
// ✅ CORRECT: Validation before lookup
export class InvalidDomainError extends Error {
  constructor(reason: string) {
    super(`Invalid domain: ${reason}`);
    this.name = 'InvalidDomainError';
  }
}

const DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)*\.[a-zA-Z]{2,}$/;

export function validateDomain(domain: string | undefined): string {
  if (!domain) throw new InvalidDomainError('Domain is required');
  if (!DOMAIN_PATTERN.test(domain)) throw new InvalidDomainError('Invalid format');
  return domain.trim().toLowerCase();
}

// Usage
const domain = validateDomain(searchParams.domain);
const tenant = await getTenantByDomain(domain);
```

---

## 4. Add Error Boundaries to Dynamic Routes

**Problem:** Single error crashes entire route subtree with no fallback

**Solution:** Add `error.tsx` to every dynamic route segment

```typescript
// ✅ CORRECT: Error boundary for route
// app/t/_domain/error.tsx
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
    logger.error('Route error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Something went wrong</h2>
        <Button onClick={reset} className="mt-4">Try again</Button>
      </div>
    </div>
  );
}
```

**Structure:**

```
app/
├── t/[slug]/
│   ├── (site)/services/
│   │   ├── page.tsx
│   │   └── error.tsx ← REQUIRED
│   └── error.tsx ← REQUIRED
├── t/_domain/
│   ├── page.tsx
│   ├── error.tsx ← REQUIRED
│   ├── services/
│   │   ├── page.tsx
│   │   └── error.tsx ← REQUIRED
│   └── [slug]/
│       └── error.tsx ← REQUIRED
```

---

## 5. Add `aria-current="page"` to Active Navigation

**Problem:** Screen reader users can't tell which page they're on

**Solution:** Add `aria-current="page"` to active links

```typescript
// ✅ CORRECT: Accessible active link
const isActive = pathname.startsWith(href);

<Link
  href={href}
  aria-current={isActive ? 'page' : undefined}
  className={isActive ? 'text-sage' : 'text-gray-500'}
>
  {label}
</Link>
```

**Rendered HTML:**

```html
<!-- Active link -->
<a href="/services" aria-current="page" class="text-sage">Services</a>

<!-- Inactive link -->
<a href="/about" class="text-gray-500">About</a>
```

---

## 6. Use WCAG AA Contrast Colors for Error Text

**Problem:** Error messages use `text-red-500` (3.92:1 ratio) - fails WCAG AA

**Solution:** Use `text-red-700` (5.5:1 ratio) - passes WCAG AA

```typescript
// ❌ WRONG: Fails WCAG AA
<p className="text-red-500">{errors.name}</p>

// ✅ CORRECT: Passes WCAG AA
<p className="text-red-700">{errors.name}</p>
```

**Contrast values:**

- `text-red-500`: 3.92:1 → FAILS WCAG AA
- `text-red-700`: 5.5:1 → PASSES WCAG AA ✓

Apply to all: error messages, alerts, status indicators

---

## 7. Clean Up Form State with AbortController

**Problem:** Component unmounts while form submission pending → state update warning

**Solution:** Abort in-flight requests on unmount

```typescript
// ✅ CORRECT: Abort requests on unmount
const abortControllerRef = useRef<AbortController | null>(null);

// Cleanup on unmount
useEffect(() => {
  return () => {
    abortControllerRef.current?.abort();
  };
}, []);

// Use in form submission
const handleSubmit = async (e: React.FormEvent) => {
  // Cancel previous request
  abortControllerRef.current?.abort();
  abortControllerRef.current = new AbortController();

  try {
    await fetch('/api/submit', {
      method: 'POST',
      signal: abortControllerRef.current.signal,
      body: JSON.stringify(formData),
    });
  } catch (error) {
    // Ignore abort errors
    if (error instanceof DOMException && error.name === 'AbortError') return;
    setStatus('error');
  }
};
```

---

## 8. Memoize Navigation Arrays with `useMemo`

**Problem:** `navItems` array recreated on every render

**Solution:** Memoize to prevent child re-renders

```typescript
// ✅ CORRECT: Memoized nav items
const navItems = useMemo<NavItemWithHref[]>(
  () =>
    NAV_ITEMS.map((item) => ({
      label: item.label,
      href: buildNavHref(basePath, item, domainParam),
    })),
  [basePath, domainParam] // Only recreate if these change
);
```

**When to memoize:**

- Array/object passed to child components
- Created from other state (basePath, props)
- Used in dependency arrays

---

## 9. Document Callbacks with `useCallback` + JSDoc

**Problem:** Complex functions need explanation; recreating on every render wastes memory

**Solution:** Use `useCallback` and add JSDoc

```typescript
// ✅ CORRECT: Documented callback
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
```

---

## 10. Remove Unused Props and Improve Animations

**Problem:** Unused `tenantName` prop clutters interface; max-height animations have visible gaps

**Solution:** Remove unused props; use CSS Grid for animations

```typescript
// ❌ WRONG: Unused prop
<FAQAccordion tenantName={tenant.name} />

// ✅ CORRECT: Clean interface
<FAQAccordion />

// ❌ WRONG: Fixed max-height
<div style={{ maxHeight: isOpen ? '500px' : '0' }}>

// ✅ CORRECT: CSS Grid (smooth, content-aware)
<div style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
  <div className="overflow-hidden">{content}</div>
</div>
```

---

## Resolution Workflow (50 minutes)

1. **Group by category** (5 min) - Duplication, optimization, errors, a11y, perf
2. **Implement high-impact first** (30 min) - Utilities, errors, validation, a11y
3. **Test** (10 min) - `npm run typecheck && npm run test:e2e`
4. **Document** (5 min) - Clear commit message with findings captured

---

## Checklist for Code Reviews

Use this when reviewing Next.js storefronts:

- [ ] Shared utilities extracted to `lib/` or config files
- [ ] SSR functions wrapped with `cache()` if called 2+ times
- [ ] User input validated before database lookup
- [ ] Error boundaries on all dynamic route segments
- [ ] `aria-current="page"` on active navigation links
- [ ] Error text uses WCAG AA colors (≥4.5:1 contrast)
- [ ] Form submissions handle unmount with AbortController
- [ ] Navigation/validation logic memoized appropriately
- [ ] No unused props or parameters
- [ ] TypeScript passes with no `any` (except library limitations)
- [ ] E2E tests pass for modified routes

---

## See Also

- **Full guide:** `P2-P3-CODE-REVIEW-RESOLUTION-20251225.md` (1087 lines)
- **Related patterns:** `docs/solutions/`
- **Accessibility:** `docs/design/BRAND_VOICE_GUIDE.md`
