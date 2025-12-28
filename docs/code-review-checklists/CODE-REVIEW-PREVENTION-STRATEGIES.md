---
module: MAIS
date: 2025-12-25
problem_type: code_review_guidelines
component: code_review_checklists
symptoms:
  - Code duplication across multiple files (formatPrice, navigation, tier ordering)
  - Missing React performance optimizations (memoization, cache())
  - WCAG violations (duplicate ids, nested main elements, low contrast)
  - Missing error boundaries in dynamic routes
  - Incomplete async cleanup (AbortController)
  - Missing parameter validation (domain validation)
root_cause: Code review findings from PR #18 (tenant multi-page sites)
resolution_type: checklist_and_reference
severity: P2
tags: [code-review, checklist, performance, accessibility, error-handling, duplication]
---

# Code Review Prevention Strategies

**Based on fixes from commit 661d464: "fix(web): resolve P2/P3 code review findings from PR #18"**

This document provides prevention strategies for the 15 code review findings discovered in the tenant multi-page sites feature. Use these checklists during code review to catch similar issues early.

---

## 1. Code Duplication Prevention

### Problem Statement

Three separate instances of `formatPrice`, navigation configuration, and package tier ordering were duplicated across multiple components.

**Files affected:**

- `TenantLandingPage.tsx` - formatPrice inline
- `services/page.tsx` - formatPrice inline
- `TenantNav.tsx` + `TenantFooter.tsx` - separate navItems arrays
- Multiple pages - TIER_ORDER duplicated

---

### Prevention Checklist: Shared Utilities

#### When to Extract (Decision Tree)

```
Is the code used in 2+ files?
├─ YES: Extract to shared utility
│   ├─ If function: lib/*.ts or components/shared/
│   ├─ If constant: lib/*.ts with jsdoc
│   └─ If component: components/shared/ or components/ui/
└─ NO: Keep in component file
    ├─ Unless it's >20 lines
    └─ Or it's a "business logic" function
```

#### Code Duplication Patterns to Watch For

```typescript
// ❌ PATTERN 1: Inline formatting logic repeated
// In TenantLandingPage.tsx
const formattedPrice = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
}).format(cents / 100);

// In services/page.tsx (identical)
const formattedPrice = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
}).format(cents / 100);

// ✅ FIX: Extract to lib/format.ts
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

// Usage in both files:
import { formatPrice } from '@/lib/format';
const formatted = formatPrice(packagePrice);
```

```typescript
// ❌ PATTERN 2: Navigation array duplicated in components
// In TenantNav.tsx
const navItems = [
  { label: 'Home', path: '' },
  { label: 'Services', path: '/services' },
  // ... repeated in TenantFooter.tsx
];

// ✅ FIX: Extract to components/tenant/navigation.ts
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '' },
  { label: 'Services', path: '/services' },
];

// With helper function for shared logic:
export function buildNavHref(basePath: string, item: NavItem, domainParam?: string): string {
  // Shared href building logic
}
```

```typescript
// ❌ PATTERN 3: Magic constants repeated
// In landing page
const tierOrder: Record<string, number> = {
  BASIC: 0,
  STANDARD: 1,
  PREMIUM: 2,
};

// In services page (identical)
const tierOrder: Record<string, number> = {
  BASIC: 0,
  STANDARD: 1,
  PREMIUM: 2,
};

// ✅ FIX: Extract to lib/packages.ts
export const TIER_ORDER: Record<string, number> = {
  BASIC: 0,
  STANDARD: 1,
  PREMIUM: 2,
  CUSTOM: 3,
};

// With helper function:
export function sortPackagesByTier<T extends { tier: string }>(packages: T[]): T[] {
  return [...packages].sort((a, b) => {
    const orderA = TIER_ORDER[a.tier] ?? 99;
    const orderB = TIER_ORDER[b.tier] ?? 99;
    return orderA - orderB;
  });
}
```

#### Documentation Requirements

When extracting shared utilities, include:

```typescript
/**
 * Module Description (brief, one-liner)
 *
 * Shared utilities for [domain/feature].
 */

/**
 * Function/Constant Description
 *
 * Brief explanation of what it does and when to use.
 *
 * @param param1 - Description
 * @returns Description of return value
 * @throws Error conditions if applicable
 *
 * @example
 * // Show common usage
 * const result = functionName(value);
 */
```

---

## 2. Performance Optimization Checklist

### Problem Statement

Missing React and Next.js performance optimizations:

- No `useMemo` for arrays created in renders
- No `useCallback` for event handlers
- Missing `cache()` wrapper for SSR data functions
- No `AbortController` cleanup for async operations

---

### Prevention Checklist: React Performance

#### useMemo Pattern

**When to use:**

- Arrays/objects created in render that are passed to children
- Expensive computations in renders
- Dependency arrays have 2+ items
- Performance concern is verified (not premature optimization)

```typescript
// ❌ PROBLEM: navItems array recreated on every render
export function TenantNav({ tenant, basePath, domainParam }: Props) {
  // This array is created fresh on every render
  const navItems = NAV_ITEMS.map((item) => ({
    label: item.label,
    href: buildNavHref(basePath, item, domainParam),
  }));

  // Passed to child, causes unnecessary re-renders
  return <Navigation items={navItems} />;
}

// ✅ FIX: Memoize the array
export function TenantNav({ tenant, basePath, domainParam }: Props) {
  const navItems = useMemo<NavItemWithHref[]>(
    () =>
      NAV_ITEMS.map((item) => ({
        label: item.label,
        href: buildNavHref(basePath, item, domainParam),
      })),
    [basePath, domainParam] // Recreate only when these change
  );

  return <Navigation items={navItems} />;
}
```

**Dependency array rules:**

- Include all external variables used in the memoized function
- If a dependency changes often, useMemo may hurt performance
- Don't include the component's props unless needed

#### useCallback Pattern

**When to use:**

- Event handlers passed to child components
- Functions used in useEffect dependencies
- Click/change handlers in lists or forms

```typescript
// ❌ PROBLEM: Callback recreated on every render
export function ContactForm({ onSubmit }: Props) {
  const handleSubmit = (e: React.FormEvent) => {
    // Process form...
  };

  // Passed to Button, causes unnecessary re-renders
  return <Button onClick={handleSubmit}>Submit</Button>;
}

// ✅ FIX: Memoize the callback
export function ContactForm({ onSubmit }: Props) {
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    // Process form...
  }, [onSubmit]); // Include dependencies

  return <Button onClick={handleSubmit}>Submit</Button>;
}

// ✅ With JSDoc for complex logic:
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

#### Next.js cache() Pattern

**When to use:**

- SSR functions called by both `generateMetadata()` and page components
- Shared data fetching across routes
- Database queries in Server Components

```typescript
// ❌ PROBLEM: Duplicate API calls in same request
// tenant.ts
export async function getTenantByDomain(domain: string) {
  const response = await fetch(`/api/tenants/by-domain/${domain}`);
  return response.json();
}

// layout.tsx calls it
const tenant = await getTenantByDomain(domain);

// generateMetadata also calls it (duplicate!)
export async function generateMetadata() {
  const tenant = await getTenantByDomain(domain);
  return { title: tenant.name };
}

// ✅ FIX: Wrap with React cache()
export const getTenantByDomain = cache(async (domain: string): Promise<TenantPublicDto> => {
  const response = await fetch(`/api/tenants/by-domain/${domain}`);
  return response.json();
});

// Usage: Same function in layout and generateMetadata
// Request deduplication automatically happens
const tenant = await getTenantByDomain(domain); // Called once per request
```

**Key rules:**

- `cache()` only works in Server Components and routes
- Caching is per-request, not global
- Use with data fetching functions, not side effects

---

### Prevention Checklist: Async Cleanup

#### AbortController Pattern

**When to use:**

- Fetch requests in components
- Promises that may outlive component unmount
- Form submissions that take time

```typescript
// ❌ PROBLEM: In-flight request completes after unmount
export function ContactForm() {
  const handleSubmit = async (e: React.FormEvent) => {
    const response = await fetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    // If component unmounts before response, state update warning!
    setStatus('success');
  };

  return <form onSubmit={handleSubmit}>...</form>;
}

// ✅ FIX: Use AbortController for cleanup
export function ContactForm() {
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      // Cancel any previous request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          body: JSON.stringify(formData),
          signal: abortControllerRef.current.signal, // Attach signal
        });

        // Check if aborted before updating state
        if (abortControllerRef.current?.signal.aborted) return;

        setStatus('success');
      } catch (error) {
        // Silently ignore aborted requests
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setStatus('error');
      }
    },
    [formData]
  );

  return <form onSubmit={handleSubmit}>...</form>;
}
```

**With mock promises (for testing):**

```typescript
// Simulate async operation with abort support
const handleSubmit = useCallback(async (e: React.FormEvent) => {
  abortControllerRef.current = new AbortController();

  try {
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(resolve, 1000);
      abortControllerRef.current!.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });

    if (abortControllerRef.current?.signal.aborted) return;
    setStatus('success');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return; // Silently ignore
    }
    setStatus('error');
  }
}, []);
```

---

## 3. Accessibility Checklist

### Problem Statement

Three WCAG violations found:

- Duplicate `id="main-content"` in page components
- Nested `<main>` elements (invalid HTML)
- Low contrast error text (red-500 → red-700)
- Missing `aria-current="page"` on active nav links

---

### Prevention Checklist: WCAG Compliance

#### HTML Structure Rules

```typescript
// ❌ VIOLATION: Duplicate IDs
// Root layout provides one
<main id="main-content">
  {/* ... */}
</main>

// But child component also tries to set it (invalid!)
export function FAQAccordion() {
  return (
    <div id="main-content"> {/* ← Duplicate ID! */}
      {/* ... */}
    </div>
  );
}

// ✅ FIX: Root layout provides skip link, components use semantic HTML
// Root layout (single <main id="main-content">)
export default function RootLayout({ children }: Props) {
  return (
    <html>
      <body>
        <a href="#main-content" className="sr-only">
          Skip to main content
        </a>
        <main id="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}

// Child component uses <div> or <section>
export function FAQAccordion() {
  return (
    <div> {/* Regular div, no id */}
      {/* ... */}
    </div>
  );
}
```

```typescript
// ❌ VIOLATION: Nested <main> elements
// Parent layout
<main>
  <TenantLayout>
    {/* Child also renders <main> */}
    <main> {/* ← Invalid nesting! */}
      {children}
    </main>
  </TenantLayout>
</main>

// ✅ FIX: Only root layout renders <main>, others use <div>
// Root layout
<main id="main-content">
  {children}
</main>

// Child layout
<div className="layout-container">
  {children}
</div>
```

#### ARIA Attributes for Navigation

```typescript
// ❌ PROBLEM: No indication of active page
export function TenantNav() {
  return (
    <nav>
      {navItems.map((item) => (
        <Link href={item.href} className="nav-link">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

// ✅ FIX: Add aria-current="page" to active link
export function TenantNav() {
  const pathname = usePathname();

  const isActiveLink = useCallback((href: string) => {
    const hrefPath = href.split('?')[0] || '/';
    return pathname === hrefPath || pathname.startsWith(hrefPath);
  }, [pathname]);

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

#### Color Contrast Rules

WCAG AA requires minimum 4.5:1 contrast ratio for normal text.

```typescript
// ❌ Problem: red-500 (rgb(239, 68, 68)) on white is 3.95:1 ratio
<p className="text-red-500">Error message</p>

// ✅ Solution: red-700 (rgb(185, 28, 28)) on white is 5.6:1 ratio
<p className="text-red-700" role="alert">
  Error message
</p>

// Test with WebAIM contrast checker:
// https://webaim.org/resources/contrastchecker/
```

Tailwind color accessibility:

- For dark text on light background: Use `-700` or `-800`
- For light text on dark background: Use `-100` or `-200`
- Test all combinations in your design system

#### Form Validation Accessibility

```typescript
// ✅ PATTERN: Accessible form field with error
<div className="form-field">
  <label htmlFor="email">
    Email <span className="text-red-500" aria-hidden="true">*</span>
  </label>

  <input
    type="email"
    id="email"
    aria-describedby={errors.email ? 'email-error' : undefined}
    aria-invalid={errors.email ? 'true' : 'false'}
    aria-required="true"
    className={errors.email ? 'border-red-300' : 'border-neutral-200'}
  />

  {errors.email && (
    <p id="email-error" className="mt-1 text-red-700" role="alert">
      {errors.email}
    </p>
  )}
</div>
```

Key attributes:

- `aria-describedby` links input to error message
- `aria-invalid="true"` tells screen readers field has error
- `aria-required="true"` indicates required field
- `role="alert"` makes error announcement immediate

---

## 4. Error Handling Checklist

### Problem Statement

Missing error boundaries in dynamic routes prevent proper error display and recovery.

---

### Prevention Checklist: Next.js Error Boundaries

#### When to Add error.tsx

```
Dynamic route segment detected?
├─ [slug] routes: YES
├─ _domain routes: YES
├─ catch-all routes: YES
├─ Optional routes: YES
└─ Static routes: Maybe (depends on complexity)

Is there async data fetching?
├─ YES: Add error.tsx
└─ NO: Optional, but recommended
```

#### Error Boundary Template

```typescript
// apps/web/src/app/t/_domain/error.tsx
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
    logger.error('Domain storefront error boundary caught error', {
      error: error.message,
      digest: error.digest,
    });
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

#### File Structure for Dynamic Routes

```
app/
├── t/
│   ├── [slug]/
│   │   ├── error.tsx           # ← Required for [slug] errors
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── (site)/
│   │       ├── error.tsx       # ← Required for subpage errors
│   │       ├── page.tsx
│   │       └── contact/
│   │           ├── error.tsx   # ← Required for nested routes
│   │           └── page.tsx
│   ├── _domain/
│   │   ├── error.tsx           # ← Required for domain routes
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── about/
│   │       ├── error.tsx       # ← Required for nested domain routes
│   │       └── page.tsx
```

**Rule:** Add `error.tsx` to every folder with a dynamic route segment or async data fetching.

#### Error Boundary Patterns

```typescript
// ✅ PATTERN 1: Simple error boundary
export default function Error({ error, reset }: ErrorProps) {
  return (
    <div className="error-container">
      <h2>Something went wrong</h2>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}

// ✅ PATTERN 2: With error details (development only)
export default function Error({ error, reset }: ErrorProps) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div>
      <h2>Something went wrong</h2>
      {isDevelopment && (
        <details>
          <summary>Error Details (dev only)</summary>
          <pre>{error.message}</pre>
        </details>
      )}
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}

// ✅ PATTERN 3: With specific error handling
export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    logger.error('Error caught by boundary', { error });
  }, [error]);

  if (error.message.includes('not found')) {
    return <NotFoundFallback />;
  }

  if (error.message.includes('unauthorized')) {
    return <UnauthorizedFallback />;
  }

  return <GenericErrorFallback reset={reset} />;
}
```

---

## 5. Validation Checklist

### Problem Statement

Missing parameter validation before database queries creates opportunities for malformed requests and unclear error messages.

---

### Prevention Checklist: Input Validation

#### Domain Parameter Validation

```typescript
// ❌ PROBLEM: No validation before database query
export async function getTenantByDomain(domain: string) {
  const url = `${API_BASE_URL}/v1/public/tenants/by-domain/${domain}`;
  const response = await fetch(url);
  return response.json();
}

// Called with untrusted input:
const domain = searchParams.get('domain'); // Could be anything!
const tenant = await getTenantByDomain(domain);

// ✅ FIX: Validate before using
export class InvalidDomainError extends Error {
  constructor(reason: string) {
    super(`Invalid domain: ${reason}`);
    this.name = 'InvalidDomainError';
  }
}

const DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)*\.[a-zA-Z]{2,}$/;

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

// Usage: Validate early, clear error messages
try {
  const domain = validateDomain(searchParams.get('domain'));
  const tenant = await getTenantByDomain(domain);
} catch (error) {
  if (error instanceof InvalidDomainError) {
    // Clear error message to user
    return <ErrorPage message={error.message} />;
  }
  throw error;
}
```

#### Validation Error Patterns

```typescript
// ✅ PATTERN: Custom error classes with clear messages
export class ValidationError extends Error {
  constructor(field: string, reason: string) {
    super(`Invalid ${field}: ${reason}`);
    this.name = 'ValidationError';
  }
}

export class InvalidDomainError extends Error {
  constructor(reason: string) {
    super(`Invalid domain: ${reason}`);
    this.name = 'InvalidDomainError';
  }
}

// ✅ PATTERN: Validation with clear error handling
export function validateEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('email', 'is required');
  }

  const sanitized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(sanitized)) {
    throw new ValidationError('email', 'is invalid format');
  }

  return sanitized;
}

// Usage with try-catch
try {
  const domain = validateDomain(searchParams.get('domain'));
  const email = validateEmail(formData.get('email'));
} catch (error) {
  if (error instanceof ValidationError || error instanceof InvalidDomainError) {
    return { error: error.message, status: 400 };
  }
  throw error;
}
```

#### Validation in Server Components

```typescript
// ✅ PATTERN: Validate in layout or page before fetching
export default async function DomainLayout({
  searchParams,
  children,
}: {
  searchParams: Record<string, string>;
  children: React.ReactNode;
}) {
  try {
    const domain = validateDomain(searchParams.domain);
    const tenant = await getTenantByDomain(domain);

    return (
      <TenantProvider tenant={tenant}>
        {children}
      </TenantProvider>
    );
  } catch (error) {
    if (error instanceof InvalidDomainError) {
      return <NotFound />;
    }
    throw error;
  }
}
```

---

## 6. Code Review Checklist Template

Use this checklist when reviewing PRs for Next.js components:

### Before Merging

#### Code Duplication

- [ ] No inline formatting functions (extract to `lib/`)
- [ ] No duplicated navigation/menu configuration
- [ ] No magic constants repeated across files
- [ ] Constants have single source of truth

#### Performance

- [ ] Arrays/objects in render are wrapped with `useMemo`
- [ ] Event handlers use `useCallback` when passed to children
- [ ] SSR functions wrapped with `cache()` to prevent duplicate calls
- [ ] Async operations use `AbortController` for cleanup
- [ ] No unnecessary re-renders of child components

#### Accessibility

- [ ] No duplicate `id` attributes in page
- [ ] Only one `<main id="main-content">` per page (in root layout)
- [ ] Active navigation links have `aria-current="page"`
- [ ] Error text uses WCAG AA compliant color (red-700 or darker)
- [ ] Form fields have `aria-describedby`, `aria-invalid`, `aria-required`

#### Error Handling

- [ ] Dynamic routes have `error.tsx` error boundary
- [ ] All nested routes with async data have error boundaries
- [ ] Error boundary logs to monitoring service
- [ ] Error boundary provides "Try again" recovery option
- [ ] No unhandled promise rejections

#### Input Validation

- [ ] Route parameters validated before use
- [ ] Domain parameters validated with regex
- [ ] Search parameters validated for type and length
- [ ] Custom validation errors explain what's wrong
- [ ] Error messages are user-friendly (not technical)

#### TypeScript

- [ ] No `any` types (except ts-rest library limitation)
- [ ] All functions have return types
- [ ] Error types are properly caught (`instanceof`)
- [ ] No type assertions without reason

#### Documentation

- [ ] Complex functions have JSDoc comments
- [ ] Extracted utilities explain when to use them
- [ ] Non-obvious logic is commented
- [ ] Component props are documented in interface

---

## 7. Prevention Pattern Library

### Quick Reference: Extract Utilities

```bash
# Step 1: Identify duplication
grep -r "formatPrice\|new Intl\.NumberFormat" apps/web/src

# Step 2: Create utility file
touch apps/web/src/lib/format.ts

# Step 3: Extract function with jsdoc
# See lib/format.ts example above

# Step 4: Update imports in all files
# Replace inline logic with import

# Step 5: Test formatting in all contexts
npm run test -- format.test.ts
```

### Quick Reference: Add Performance Optimizations

```typescript
// Step 1: Identify expensive renders
// Profile with React DevTools, look for:
// - Array/object created in render
// - Function passed to child
// - SSR function called multiple times

// Step 2: Add useMemo/useCallback
import { useMemo, useCallback } from 'react';

// Step 3: Define dependencies carefully
const navItems = useMemo(
  () => NAV_ITEMS.map(/* ... */),
  [basePath, domainParam] // Only these trigger recalculation
);

// Step 4: Test with React DevTools Profiler
// Verify component doesn't re-render unnecessarily
```

### Quick Reference: Fix Accessibility

```typescript
// Step 1: Run axe DevTools browser extension
// https://www.deque.com/axe/devtools/

// Step 2: Fix violations by type:
// WCAG Level A (must fix):
// - Duplicate IDs
// - Missing alt text
// - Nested main elements
// - Missing form labels

// WCAG Level AA (should fix):
// - Color contrast < 4.5:1
// - Missing aria-current on active nav

// Step 3: Test with keyboard only
// Tab through all interactive elements
// Verify focus is visible
```

---

## References

### Related Documentation

- [BRAND_VOICE_GUIDE.md](../../design/BRAND_VOICE_GUIDE.md) - UI/UX patterns
- [apps/web/README.md](../../../apps/web/README.md) - Next.js patterns
- [PREVENTION-QUICK-REFERENCE.md](./PREVENTION-QUICK-REFERENCE.md) - Daily development checklist

### External Resources

- [WCAG 2.1 Level AA](https://www.w3.org/WAI/WCAG21/quickref/) - Accessibility standards
- [React Hooks Performance](https://react.dev/reference/react/useMemo) - useMemo/useCallback docs
- [Next.js error.tsx](https://nextjs.org/docs/app/building-your-application/routing/error-handling) - Error boundaries
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) - Color contrast validation

---

## Contributing to This Document

Found a code review issue not covered here? Add it to the checklist:

1. Identify the issue pattern
2. Provide before/after code examples
3. Add decision tree or checklist item
4. Link to related documentation
5. Commit with: `docs: add [issue-type] prevention strategy`

---

Last Updated: 2025-12-25
Issue Reference: Commit 661d464 (PR #18 code review fixes)
