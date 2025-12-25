---
module: MAIS
date: 2025-12-25
problem_type: code_review_reference
component: code_review_checklists
severity: P2
tags: [code-review, quick-reference, checklist, daily-use]
---

# Code Review Quick Reference Card

**Print this and post it next to your desk!**

---

## 1-Minute Duplication Check

```typescript
// ❌ Code appears in 2+ files?
formatPrice() → Extract to lib/format.ts
navItems[] → Extract to components/tenant/navigation.ts
TIER_ORDER → Extract to lib/packages.ts

// ✅ When in doubt, extract if:
- Used by 2+ components
- More than 5 lines of logic
- Business logic (not just styling)
```

---

## 1-Minute Performance Check

```typescript
// ❌ Red flags:
[] = NAV_ITEMS.map(...) // Array in render
() => { ... } // Function in render passed to child
await fetch() // SSR function called twice in same request
fetch({...}) // No AbortController in form submission

// ✅ Fixes:
useMemo(() => NAV_ITEMS.map(...), [deps])
useCallback(() => { ... }, [deps])
export const getTenant = cache(async () => { ... })
const signal = abortControllerRef.current.signal
```

---

## 1-Minute Accessibility Check

```
Main element check:
  ├─ Only 1 <main id="main-content">? ✓
  ├─ In root layout, not child? ✓
  ├─ No duplicates? ✓

Navigation check:
  ├─ <nav aria-label="...">? ✓
  ├─ aria-current="page" on active link? ✓
  ├─ Proper heading hierarchy? ✓

Color check:
  ├─ Error text is red-700 or darker? ✓
  ├─ 4.5:1 contrast ratio? ✓
  └─ Test with WebAIM contrast checker

Form check:
  ├─ aria-describedby on errors? ✓
  ├─ aria-invalid="true/false"? ✓
  ├─ aria-required="true"? ✓
  └─ role="alert" on error message? ✓
```

---

## 1-Minute Error Handling Check

```
Dynamic route [slug]?
  ├─ Has error.tsx? ✓
  └─ Has reset() button? ✓

Nested routes with data fetching?
  ├─ Each level has error.tsx? ✓
  ├─ Logs to logger service? ✓
  └─ Provides recovery option? ✓

API error handling?
  ├─ Custom error classes? ✓
  ├─ Try-catch with instanceof? ✓
  └─ User-friendly error message? ✓
```

---

## 1-Minute Validation Check

```
Route parameters used?
  ├─ Validated before query? ✓
  ├─ Length checked? ✓
  ├─ Format validated (regex)? ✓
  └─ Clear error message? ✓

Search params used?
  ├─ Type-checked? ✓
  ├─ Not null-checked? ✓
  ├─ Sanitized? ✓
  └─ Custom error thrown? ✓
```

---

## Copy-Paste Templates

### Memoized Navigation Items
```typescript
const navItems = useMemo<NavItemWithHref[]>(
  () =>
    NAV_ITEMS.map((item) => ({
      label: item.label,
      href: buildNavHref(basePath, item, domainParam),
    })),
  [basePath, domainParam]
);
```

### Memoized Callback
```typescript
const handleClick = useCallback((value: string) => {
  // Logic here
}, [dependency1, dependency2]);
```

### SSR Data Deduplication
```typescript
export const getTenantData = cache(
  async (slug: string): Promise<TenantData> => {
    const response = await fetch(`/api/tenants/${slug}`);
    return response.json();
  }
);
```

### Form Cleanup on Unmount
```typescript
const abortControllerRef = useRef<AbortController | null>(null);

useEffect(() => {
  return () => {
    abortControllerRef.current?.abort();
  };
}, []);

const handleSubmit = useCallback(async () => {
  abortControllerRef.current?.abort();
  abortControllerRef.current = new AbortController();

  try {
    const response = await fetch('/api/endpoint', {
      signal: abortControllerRef.current.signal,
    });
    if (abortControllerRef.current?.signal.aborted) return;
    // Update state
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return; // Silently ignore
    }
    // Handle error
  }
}, []);
```

### Error Boundary
```typescript
'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    logger.error('Route error boundary', { error });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Something went wrong</h2>
        <button onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
```

### Domain Validation
```typescript
const DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)*\.[a-zA-Z]{2,}$/;

export function validateDomain(domain: string | undefined): string {
  if (!domain || typeof domain !== 'string') {
    throw new InvalidDomainError('Domain is required');
  }

  const sanitized = domain.trim().toLowerCase();

  if (sanitized.length === 0) {
    throw new InvalidDomainError('Domain cannot be empty');
  }

  if (sanitized.length > 253) {
    throw new InvalidDomainError('Domain too long');
  }

  if (!DOMAIN_PATTERN.test(sanitized)) {
    throw new InvalidDomainError('Invalid domain format');
  }

  return sanitized;
}
```

### Active Link Detection with JSDoc
```typescript
/**
 * Determines if a navigation link is active based on current pathname.
 *
 * - Home link: exact match only
 * - Other links: prefix match
 *
 * @param href - Link to check
 * @returns true if link should be styled as active
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

## Decision Trees (30-Second Diagrams)

### Extract or Keep?
```
Is code duplicated in 2+ files?
├─ YES
│  ├─ Utility function? → lib/[domain].ts
│  ├─ Component? → components/shared/
│  ├─ Constant? → lib/constants.ts with JSDoc
│  └─ Configuration? → components/[domain]/config.ts
└─ NO → Keep in component file
```

### Add useMemo?
```
Is array/object created in render?
├─ YES
│  ├─ Passed to child component? → YES, use useMemo
│  ├─ Used in dependency array? → YES, use useMemo
│  ├─ Expensive computation? → YES, use useMemo
│  └─ Otherwise? → Maybe not needed
└─ NO → Proceed with normal variable
```

### Add useCallback?
```
Is function created in render?
├─ YES
│  ├─ Passed to child component? → YES, use useCallback
│  ├─ Used in useEffect? → YES, use useCallback
│  ├─ Is an event handler? → Use useCallback
│  └─ Simple prop setter? → Maybe not needed
└─ NO → Use regular function
```

### Add error.tsx?
```
Is this a dynamic route?
├─ YES (has [param])
│  ├─ Has async data fetching? → Add error.tsx
│  ├─ Complex component? → Add error.tsx
│  └─ Simple component? → Add error.tsx (safe)
└─ NO → Optional, but recommended for resilience
```

---

## Red Flags During Review

| Red Flag | Action |
|----------|--------|
| Same function in 2 files | Ask: "Can we extract to lib/?" |
| Array created in render | Check: "Is it memoized?" |
| Function passed to child | Check: "Is it wrapped with useCallback?" |
| No error.tsx in dynamic route | Flag: "Add error boundary" |
| Form with fetch/promise | Check: "Does it use AbortController?" |
| No aria-current on nav | Flag: "Add accessibility" |
| Error text in red-500 | Check: "Contrast ratio OK?" |
| Route param never validated | Flag: "Add validation" |
| Long parameter in URL | Check: "Is it length-validated?" |
| Multiple SSR calls possible | Check: "Is it wrapped with cache()?" |

---

## Common Issues (Sorted by Severity)

### P1 - Security/Accessibility
- [ ] Duplicate id attributes (WCAG violation)
- [ ] Nested `<main>` elements (invalid HTML)
- [ ] Unvalidated route parameters
- [ ] Missing error boundaries on dynamic routes

### P2 - Performance/UX
- [ ] Code duplication across files
- [ ] Missing cache() in SSR functions
- [ ] Array recreation without useMemo
- [ ] No AbortController cleanup
- [ ] Missing aria-current on nav

### P3 - Polish/Maintainability
- [ ] Missing JSDoc comments
- [ ] Color contrast warning (just below AA)
- [ ] Unused component props
- [ ] Animation performance issues

---

## Tools to Use During Review

```bash
# Find duplicated code
grep -r "formatPrice" apps/web/src

# Check for issues
npm run lint

# Test accessibility
# 1. Install axe DevTools: https://deque.com/axe/devtools/
# 2. Open DevTools → axe DevTools
# 3. Scan page for violations

# Test color contrast
# https://webaim.org/resources/contrastchecker/

# Test keyboard navigation
# Tab through all interactive elements

# Check React profiling
# React DevTools → Profiler → Record interaction
```

---

## 5-Point Review Checklist

Every PR should pass these 5 checks:

1. **No Duplication** - Shared code extracted
2. **Performance Optimized** - useMemo/useCallback/cache() where needed
3. **Accessibility** - WCAG AA compliant
4. **Error Handling** - error.tsx on dynamic routes
5. **Validation** - Parameters validated before use

If any fail, request changes before approval.

---

**Last Updated:** 2025-12-25
**Based on:** Commit 661d464 (PR #18 code review findings)
**Full Details:** See CODE-REVIEW-PREVENTION-STRATEGIES.md
