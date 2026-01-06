---
module: MAIS
date: 2026-01-06
problem_type: Hydration Mismatch & Navigation Anti-Pattern
component:
  - apps/web/src/app/(protected)/admin/tenants/TenantsList.tsx
  - apps/web/src/components/layouts/ImpersonationBanner.tsx
  - apps/web/src/app/(protected)/admin/tenants/actions.ts
phase: Frontend Development (Next.js)
symptoms:
  - Impersonation buttons not navigating after click
  - Hydration error "Expected server HTML to contain a matching form in div"
  - setTimeout inside startTransition not firing
  - Service worker caching stale JavaScript
  - Date formatting mismatch between server and client
severity: P1
related_files:
  - apps/web/src/app/(protected)/admin/tenants/TenantsList.tsx
  - apps/web/src/components/layouts/ImpersonationBanner.tsx
  - apps/web/src/app/(protected)/admin/tenants/actions.ts
tags:
  - nextjs
  - hydration-mismatch
  - server-actions
  - navigation
  - startTransition
  - service-worker
  - vite-migration
  - impersonation
  - session-management
---

# Next.js Client Navigation & Hydration Anti-Patterns

This document captures the root causes and solutions for impersonation navigation failures that occurred after the Vite → Next.js migration.

## Executive Summary

**Problem:** Clicking "Impersonate" or "Exit Impersonation" buttons did nothing - no navigation occurred.

**Root Causes (5 layers):**

1. Server Action `<form>` pattern caused "form in div" hydration error
2. `startTransition` + `setTimeout` anti-pattern blocked navigation side effects
3. `toLocaleDateString()` caused server/client date mismatch
4. `ImpersonationBanner` conditional render without hydration guard
5. Service worker cached stale JavaScript

**Solution:** Replace all patterns with hydration-safe alternatives and use `window.location.href` for session-changing navigation.

---

## Root Cause Analysis

### Layer 1: Server Action Form Pattern

**The Problem:**

```tsx
// ❌ BROKEN: Server Action form causes hydration mismatch
<form action={impersonateTenant.bind(null, tenant.id)} className="flex-1">
  <Button type="submit">Impersonate</Button>
</form>
```

Server Actions with `<form action={...}>` create a form element on the server, but React's hydration expects the same structure. When combined with client-side state, this causes:

```
Error: Expected server HTML to contain a matching form in div
```

### Layer 2: startTransition + setTimeout Anti-Pattern

**The Problem:**

```tsx
// ❌ BROKEN: startTransition swallows navigation side effects
const handleImpersonate = (tenantId: string) => {
  startTransition(async () => {
    const result = await impersonateTenant(tenantId);
    if (result.success) {
      // This setTimeout NEVER fires when React is in error recovery mode
      setTimeout(() => {
        window.location.assign(result.redirectTo);
      }, 0);
    }
  });
};
```

React's concurrent rendering can skip scheduled effects when:

- A hydration error triggers error recovery mode
- The transition is interrupted or deprioritized
- Multiple state updates compete for priority

### Layer 3: Date Formatting Hydration Mismatch

**The Problem:**

```tsx
// ❌ BROKEN: Locale-dependent, server/client differ
{
  new Date(tenant.createdAt).toLocaleDateString();
}
// Server: "1/6/2026" (en-US locale)
// Client: "06/01/2026" (browser locale)
```

### Layer 4: Conditional Render Without Hydration Guard

**The Problem:**

```tsx
// ❌ BROKEN: Session state differs between SSR and client
export function ImpersonationBanner() {
  const { isImpersonating } = useAuth();

  // During SSR: session is null, returns null
  // During hydration: session may be loaded, returns banner
  // = MISMATCH
  if (!isImpersonating()) {
    return null;
  }
  return <Banner />;
}
```

### Layer 5: Service Worker Caching Stale Code

Even after fixing the code, the browser served old JavaScript from service worker cache, making it appear the fixes weren't working.

---

## The Fix

### Fix 1: Replace Form with onClick Handler

```tsx
// ✅ CORRECT: Direct async/await with window.location.href
const handleImpersonate = async (tenantId: string) => {
  setImpersonatingId(tenantId);

  try {
    const result = await impersonateTenant(tenantId);

    if (result.success) {
      // Full page reload ensures fresh session state
      window.location.href = result.redirectTo;
    } else {
      setImpersonatingId(null);
      console.error('Impersonation failed:', result.error);
    }
  } catch (error) {
    setImpersonatingId(null);
    console.error('Impersonation error:', error);
  }
};

// In JSX:
<Button onClick={() => handleImpersonate(tenant.id)}>Impersonate</Button>;
```

### Fix 2: Use Hydration-Safe Date Formatting

```tsx
// ✅ CORRECT: ISO format is consistent everywhere
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // "2026-01-06"
}

// In JSX:
<span>{formatDate(tenant.createdAt)}</span>;
```

### Fix 3: Add isHydrated Guard to Conditional Components

```tsx
// ✅ CORRECT: Hydration-safe conditional rendering
export function ImpersonationBanner() {
  const { impersonation, isImpersonating, isLoading } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  // Mark as hydrated after first client render
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // During SSR and initial hydration, render nothing
  // Both server and client agree on this
  if (!isHydrated || isLoading) {
    return null;
  }

  // After hydration, check actual impersonation state
  if (!isImpersonating() || !impersonation) {
    return null;
  }

  return <Banner />;
}
```

### Fix 4: Clear Service Worker Cache

```typescript
// In browser console or programmatically:
const registrations = await navigator.serviceWorker.getRegistrations();
for (const reg of registrations) {
  await reg.unregister();
}

// Clear all caches
caches.keys().then((names) => names.forEach((name) => caches.delete(name)));

// Hard reload
location.reload(true);
```

---

## Why It Works

### window.location.href vs router.push vs startTransition

| Method                 | Use Case                     | Session Changes?              |
| ---------------------- | ---------------------------- | ----------------------------- |
| `window.location.href` | Full page reload needed      | ✅ Yes - forces fresh cookies |
| `router.push()`        | SPA navigation, same session | ❌ No - uses cached session   |
| `startTransition`      | Non-blocking updates         | ❌ No - can be interrupted    |

**Rule:** When the session/authentication state changes, use `window.location.href` to ensure the browser sends fresh cookies and the server returns fresh data.

### isHydrated Pattern

The `isHydrated` pattern ensures server and client render identical HTML during the critical hydration phase:

```
Timeline:
1. Server renders component → returns null (session not loaded)
2. HTML sent to browser
3. React hydrates → matches server (null)
4. useEffect runs → sets isHydrated = true
5. Re-render → now checks actual session state
6. No mismatch!
```

---

## Prevention Checklist

### Before Committing Navigation Code

- [ ] No `<form action={serverAction}>` patterns (use onClick)
- [ ] No `startTransition` + `setTimeout` for navigation
- [ ] Session-changing navigation uses `window.location.href`
- [ ] Date formatting uses ISO format (`toISOString().split('T')[0]`)
- [ ] Conditional components have `isHydrated` guard
- [ ] No `window`/`document` access during render

### During Code Review

- [ ] Search for `toLocaleDateString()` → flag as hydration risk
- [ ] Search for `startTransition.*setTimeout` → flag as anti-pattern
- [ ] Search for `<form action={` → verify no hydration issues
- [ ] Check conditional returns for `isHydrated` guard

### When Debugging "Navigation Not Working"

1. Check browser console for hydration errors
2. Verify service worker isn't caching old code:
   ```bash
   # DevTools → Application → Service Workers → Unregister
   ```
3. Clear Next.js cache:
   ```bash
   cd apps/web && rm -rf .next .turbo && npm run dev
   ```
4. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

---

## Quick Reference Card

```
NEXT.JS NAVIGATION & HYDRATION QUICK REFERENCE

SESSION CHANGES (login, logout, impersonation):
✅ window.location.href = '/path'
❌ router.push('/path')
❌ startTransition(() => navigate())

DATE FORMATTING:
✅ date.toISOString().split('T')[0]
❌ date.toLocaleDateString()

CONDITIONAL RENDERING WITH SESSION:
✅ const [isHydrated, setIsHydrated] = useState(false);
   useEffect(() => setIsHydrated(true), []);
   if (!isHydrated) return null;
❌ if (!session) return null;  // Direct check

SERVER ACTIONS:
✅ <Button onClick={() => serverAction()}>
❌ <form action={serverAction}>

DEBUGGING STALE CODE:
1. DevTools → Application → Service Workers → Unregister
2. Hard refresh (Cmd+Shift+R)
3. rm -rf apps/web/.next && npm run dev
```

---

## Related Documentation

- [Hydration Mismatch Prevention](../HYDRATION_MISMATCH_PREVENTION-MAIS-20251231.md) - Comprehensive hydration safety guide
- [Next.js Migration Lessons Learned](./nextjs-migration-lessons-learned-MAIS-20251225.md) - Post-migration review
- [Turbopack HMR Cache Staleness](../dev-workflow/TURBOPACK_HMR_MODULE_CACHE_STALENESS_PREVENTION.md) - Dev server cache issues
- [Service Worker Cache Prevention](../dev-workflow/SERVICE_WORKER_CACHE_STALE_BUNDLES_PREVENTION.md) - PWA cache debugging

---

## Test Verification

After applying fixes, verify with this test:

1. Log in as platform admin
2. Navigate to `/admin/tenants`
3. Click "Impersonate" on any tenant
4. **Expected:** Page navigates to `/tenant/dashboard` with impersonation banner
5. Click "Exit Impersonation" in banner
6. **Expected:** Page navigates to `/admin/tenants` without banner
7. Check browser console - **no hydration errors**

---

## Key Insight

> **When React's concurrent features (startTransition, Suspense) conflict with imperative side effects (navigation, cookies), the imperative operation loses.**
>
> Solution: Don't mix them. Use `window.location.href` for operations that MUST complete.

---

**Version:** 1.0
**Last Updated:** 2026-01-06
**Status:** Active
