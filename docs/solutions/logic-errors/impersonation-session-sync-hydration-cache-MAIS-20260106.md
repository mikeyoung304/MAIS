# Solution: Impersonation Session Sync, Hydration, and Service Worker Cache

**Date:** 2026-01-06
**Issue:** Multiple cascading failures preventing admin impersonation navigation
**Status:** RESOLVED
**Files Modified:**

- `apps/web/src/app/(protected)/admin/tenants/TenantsList.tsx`
- `apps/web/src/app/(protected)/admin/tenants/actions.ts`
- `apps/web/src/components/layouts/ImpersonationBanner.tsx`

## Root Cause Analysis

This was a **five-layer failure** where each layer broke the next:

### Layer 1: Server Action Form Pattern (Hydration Error)

**Problem:** Form actions in Next.js Client Components caused hydration mismatch:

```tsx
// ❌ BROKEN - Form action pattern
<form action={impersonateTenant}>
  <button type="submit">Impersonate</button>
</form>
```

When a Server Action is wrapped in a `<form>`, Next.js creates a progressive enhancement layer. The server renders the form structure, but the client attaches different event handlers during hydration. If these don't match exactly, you get: `Hydration failed because the server rendered HTML doesn't match what the client is trying to attach handlers to.`

**Technical:** The form element is a **controlled component** on the server (HTML form submission) but React Client Component on the client (with event handlers). This mismatch breaks React's hydration assumption that server and client render identical initial HTML.

### Layer 2: startTransition + setTimeout Anti-pattern (Navigation Blocked)

**Problem:** Using `startTransition` to wrap a Server Action that redirects creates a race condition:

```tsx
// ❌ BROKEN - startTransition blocks navigation
const handleImpersonate = async (tenantId: string) => {
  startTransition(async () => {
    const result = await impersonateTenant(tenantId);
    if (result.success) {
      router.push(result.redirectTo); // Wrapped in transition
    }
  });
};
```

**Why it fails:** React's `startTransition` is designed for **interruptible updates** (showing pending UI, debouncing input). When wrapping a Server Action that changes the entire app state (session token update + JWT refresh), the transition can be **interrupted or suspended**. If the browser navigates before the transition commits, the session state doesn't apply properly.

Combining with `setTimeout` makes it worse:

```tsx
// ❌ WORST - Adds unpredictable delay
setTimeout(() => {
  router.push(result.redirectTo);
}, 1000);
```

This creates a timing window where:

- User clicks button
- Server Action runs (updates JWT cookie)
- setTimeout waits (but redirect hasn't happened yet)
- Session becomes stale while waiting
- Navigation finally happens but RSC cache is outdated

### Layer 3: Date Formatting Hydration Mismatch

**Problem:** `toLocaleDateString()` is locale-dependent and differs between server and client:

```tsx
// ❌ BROKEN - Locale-dependent formatting
const formatted = new Date(dateString).toLocaleDateString('en-US');
// Server might return: "January 6, 2026"
// Client might return: "1/6/2026"
```

**Why it happens:** The Intl API uses the server's locale (usually UTC/en-US) but the client's locale (user's browser timezone). When Next.js compares server HTML to client DOM, the dates don't match → hydration error.

### Layer 4: ImpersonationBanner Conditional Render (Hydration Mismatch)

**Problem:** Rendering the banner based on session data without hydration safety:

```tsx
// ❌ BROKEN - Session state differs between server and client
export function ImpersonationBanner() {
  const { isImpersonating } = useAuth();

  // Server render: session may not be loaded yet (null)
  // Client render: session loaded from context (true/false)
  if (!isImpersonating()) return null;

  return <div>Impersonating...</div>;
}
```

The server has no session data (SSR boundary), so it renders `null`. The client hydrates with session from context, and renders the banner. React detects the mismatch and throws a hydration error.

### Layer 5: Service Worker Caching Stale JavaScript

**Problem:** Service Worker caches old JavaScript bundle before fixes are deployed:

```
User visits site (Service Worker installs, caches all .js bundles)
Developer fixes bugs and deploys new code
User reloads page
Service Worker serves cached OLD .js from cache
User sees old buggy code despite new deployment
```

Each of the above bugs might have been "fixed" in code, but the Service Worker would serve the old cached version. This creates a false sense of resolution.

---

## The Fix

### Fix 1: Replace Form Action with Click Handler

**Before:**

```tsx
// ❌ Server Action form (hydration error)
<form action={impersonateTenant}>
  <button type="submit">Impersonate</button>
</form>
```

**After:**

```tsx
// ✅ Click handler with direct Server Action invocation
const handleImpersonate = async (tenantId: string) => {
  setImpersonatingId(tenantId);
  try {
    const result = await impersonateTenant(tenantId);
    if (result.success) {
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

<Button onClick={() => handleImpersonate(tenant.id)} disabled={impersonatingId === tenant.id}>
  {impersonatingId === tenant.id ? 'Impersonating...' : 'Impersonate'}
</Button>;
```

**Why it works:**

- No `<form>` element = no form submission event → no hydration mismatch
- Direct click handler on a regular `<button>` → server and client render identical initial HTML
- Callback-based state management is safe and predictable

### Fix 2: Use window.location.href Instead of startTransition

**Before:**

```tsx
// ❌ startTransition causes race condition
startTransition(async () => {
  const result = await impersonateTenant(tenantId);
  if (result.success) {
    router.push(result.redirectTo); // Can be interrupted
  }
});

// Or worse: setTimeout anti-pattern
setTimeout(() => {
  router.push(result.redirectTo);
}, 1000);
```

**After:**

```tsx
// ✅ Direct window.location.href (hard navigation)
const result = await impersonateTenant(tenantId);
if (result.success) {
  window.location.href = result.redirectTo; // Immediate, uninterruptible
}
```

**Why it works:**

- `window.location.href` is a **hard navigation** — browser navigates immediately, unaffected by React's concurrent rendering
- Guarantees the session cookie update (from Server Action) is persisted before navigation
- Forces a full page reload, so RSC cache is invalidated and fresh data fetched from server
- Removes timing window where stale state could cause issues

### Fix 3: Use ISO Date Format for Server/Client Consistency

**Before:**

```tsx
// ❌ Locale-dependent (hydration mismatch)
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US');
  // Server: "January 6, 2026" | Client: "1/6/2026"
}
```

**After:**

```tsx
// ✅ ISO format (identical server and client)
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // "2026-01-06"
}
```

**Why it works:**

- `toISOString()` produces UTC time formatted as `YYYY-MM-DDTHH:mm:ss.sssZ`
- `.split('T')[0]` extracts just the date part: `YYYY-MM-DD`
- ISO format is independent of locale, timezone, or browser settings
- Server and client always produce identical string → no hydration mismatch
- Bonus: More compact, easier to read, and sortable as strings

**Applied in:**

```tsx
// In TenantsList.tsx, line 205
<span className="flex items-center gap-1">
  <Calendar className="h-4 w-4" />
  {formatDate(tenant.createdAt)}
</span>
```

### Fix 4: Add isHydrated Guard to ImpersonationBanner

**Before:**

```tsx
// ❌ No hydration safety
export function ImpersonationBanner() {
  const { isImpersonating } = useAuth();

  // Server renders: null (no session)
  // Client renders: banner or null (session loaded)
  // → Hydration error
  if (!isImpersonating()) return null;
  return <div>Impersonating...</div>;
}
```

**After:**

```tsx
// ✅ Hydration-safe with explicit guard
export function ImpersonationBanner() {
  const { impersonation, isImpersonating, isLoading } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  // Mark as hydrated after first client render
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // During SSR and initial hydration, render nothing
  // This ensures server and client both render null initially
  if (!isHydrated || isLoading) {
    return null;
  }

  // After hydration, check actual impersonation state
  if (!isImpersonating() || !impersonation) {
    return null;
  }

  return <div>Impersonating: {impersonation.tenantSlug}</div>;
}
```

**Why it works:**

- During SSR: `isHydrated` is false, render `null` (no session data available)
- During initial client hydration: `isHydrated` still false (effect hasn't run), render `null` (matches server)
- After first render completes: `useEffect` runs, `setIsHydrated(true)`
- Subsequent renders: Session data available from context, render banner if impersonating
- Server and client both render `null` initially → **no hydration mismatch**
- Once component is safe to update, conditional rendering works normally

**Pattern:** This is the **standard Next.js pattern** for components that depend on client-only data (localStorage, session context, etc.).

### Fix 5: Unregister Service Worker and Clear Caches

**Commands executed in browser console:**

```javascript
// Unregister all Service Workers
navigator.serviceWorker.getRegistrations().then((registrations) => {
  registrations.forEach((reg) => reg.unregister());
});

// Clear all caches
caches.keys().then((names) => {
  names.forEach((name) => caches.delete(name));
});

// Clear application cache
if ('applicationCache' in window && window.applicationCache) {
  window.applicationCache.abort();
}
```

**Browser DevTools approach:**

1. Open DevTools → Application tab
2. Service Workers → Unregister
3. Cache Storage → Delete all cache entries
4. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)

**Why it works:**

- Service Worker was caching the old `.js` bundles before fixes
- Unregistering stops the cache from being served
- Deleting caches removes all stored assets
- Hard refresh forces browser to re-fetch everything from server
- Now users get the fixed code with hydration safety restored

---

## Why It Works (Complete Flow)

### Before (Broken)

```
1. User clicks "Impersonate" button
   ↓
2. <form action={...}> wraps Server Action
   → Server renders: <form><button>...
   → Client hydrates: <form> with event handler attached
   ❌ Hydration mismatch (form can be controlled differently)
   ↓
3. Form submission calls impersonateTenant() Server Action
   → Tries to use startTransition + setTimeout
   ❌ Race condition: navigation happens before session updates apply
   ↓
4. router.push() navigates with stale session state
   ❌ RSC cache not invalidated, shows old page
   ↓
5. Date formatting uses toLocaleDateString()
   ❌ Server: "January 6", Client: "1/6" → Hydration error
   ↓
6. ImpersonationBanner renders without hydration guard
   ❌ Server: null, Client: banner → Hydration error
   ↓
7. Service Worker serves cached old .js from before fixes
   ❌ User sees old buggy code despite deployment
```

### After (Fixed)

```
1. User clicks "Impersonate" button
   ↓
2. Click handler calls async handleImpersonate()
   → No <form> element → Server and client HTML match
   ✓ No hydration issue
   ↓
3. Server Action impersonateTenant() runs
   → Updates mais_backend_token cookie
   → Calls unstable_update() to refresh NextAuth session
   ✓ Session state updated server-side
   ↓
4. window.location.href navigates immediately
   → Hard refresh, unaffected by React transitions
   → Forces RSC cache invalidation
   → Forces full session reload
   ✓ Session state definitely applied before navigation
   ↓
5. Date formatting uses ISO format: "2026-01-06"
   → Server: "2026-01-06", Client: "2026-01-06"
   ✓ Server and client render identical HTML
   ↓
6. ImpersonationBanner uses isHydrated guard
   → During SSR: null (no session yet)
   → During hydration: null (isHydrated=false)
   → After hydration: null or banner based on real state
   ✓ Server and client match during hydration
   ↓
7. Service Worker unregistered, caches cleared
   → Browser fetches fresh .js from server
   → Gets the fixed code with all 4 hydration fixes
   ✓ User gets working implementation
```

---

## Key Patterns from This Fix

### Pattern 1: Avoiding Form Actions in Client Components

**When to use `<form action={...}>`:**

- Server Components where form is static (no client state)
- Simple progressive enhancement (works without JavaScript)

**When to use click handlers:**

- Client Components with dynamic state management
- When you need fine-grained control over loading/error states
- When navigation depends on state transitions

```tsx
// ✅ CORRECT - Click handler pattern
'use client';
const [isLoading, setIsLoading] = useState(false);
const handleSubmit = async () => {
  setIsLoading(true);
  try {
    const result = await serverAction();
    if (result.success) handleNavigation();
  } finally {
    setIsLoading(false);
  }
};
<button onClick={handleSubmit} disabled={isLoading}>Submit</button>

// ❌ AVOID - Form action in Client Component
<form action={serverAction}>
  <button type="submit">Submit</button>
</form>
```

### Pattern 2: Using window.location.href for Hard Navigation

**When to use `window.location.href`:**

- Need to guarantee session state is applied
- Want to invalidate RSC cache
- Making cross-domain navigation
- Need uninterruptible navigation

**When NOT to use (prefer `router.push()`):**

- Navigating within app without session changes
- Want soft navigation without full reload
- Want to preserve some client state

```tsx
// ✅ CORRECT - Hard navigation for session changes
const result = await updateSessionAction();
if (result.success) {
  window.location.href = result.redirectTo; // Full page reload
}

// ✅ OK - Soft navigation for non-session changes
import { useRouter } from 'next/navigation';
const router = useRouter();
router.push('/next-page'); // Soft navigation
```

### Pattern 3: Hydration-Safe Conditional Rendering

**Pattern for client-only data:**

```tsx
'use client';

export function ClientOnlyComponent() {
  const { data } = useContext(SessionContext); // Client-only
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Guard: Server and client both render null initially
  if (!isHydrated) return null;

  // Now safe to render based on client data
  return <div>{data}</div>;
}
```

**Applies to:**

- Session data
- localStorage data
- Theme from context
- Any client-side-only state

### Pattern 4: Locale-Independent Date Formatting

**For dates shown in UI:**

```tsx
// ❌ AVOID - Locale-dependent
date.toLocaleDateString(); // Can differ server/client
date.toLocaleString(); // Can differ server/client

// ✅ USE - Locale-independent
date.toISOString().split('T')[0]; // "2026-01-06"
date.toISOString(); // "2026-01-06T..."
date.toUTCString(); // "Mon, 06 Jan 2026 00:00:00 GMT"

// For formatted display with guarantees:
const formatter = new Intl.DateTimeFormat('en-US', {
  /* options */
});
// Intl.DateTimeFormat is deterministic across server/client with same locale
```

### Pattern 5: Service Worker Cache Invalidation

**In development (when Service Worker interferes):**

```javascript
// Browser console: Unregister all Service Workers
navigator.serviceWorker.getRegistrations().then((regs) => {
  regs.forEach((r) => r.unregister());
});

// Clear all caches
caches.keys().then((names) => {
  names.forEach((name) => caches.delete(name));
});

// Hard refresh
location.reload(true); // Ctrl/Cmd + Shift + R
```

**In production (prevent similar issues):**

```javascript
// public/sw.js - Add cache versioning
const CACHE_VERSION = '1.0.0'; // Increment when deploying
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;

// Cleanup old versions on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name.startsWith('app-cache-') && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
  );
});
```

---

## Testing the Fix

### Manual Test: Impersonation Navigation

```bash
# 1. Start the app
npm run dev:all

# 2. Navigate to Admin Tenants page
# http://localhost:3000/admin/tenants

# 3. Click "Impersonate" on a tenant
# Should see:
# - Button shows "Impersonating..."
# - Page navigates to /tenant/dashboard
# - ImpersonationBanner appears at top with "Viewing as: {slug}"
# - No hydration errors in console

# 4. Click "Exit Impersonation" button
# Should see:
# - Banner disappears
# - Navigates back to /admin/tenants
# - No hydration errors in console
```

### Check for Hydration Errors

```javascript
// Browser DevTools → Console
// After any page interaction, check for:
// ❌ "Hydration failed..."
// ❌ "Text content does not match server-rendered HTML..."

// If you see these, there's still a hydration issue
```

### Verify Service Worker Cleanup

```javascript
// Browser DevTools → Console
navigator.serviceWorker.getRegistrations().then((regs) => {
  console.log(`Service Workers: ${regs.length}`);
  regs.forEach((r) => console.log(r.scope));
});

caches.keys().then((names) => {
  console.log(`Caches: ${names.length}`);
  names.forEach((name) => console.log(name));
});

// Both should show empty or minimal entries
```

---

## Prevention Checklist

When implementing session-based navigation in Next.js:

- [ ] Use **click handlers** instead of `<form action={...}>` for client-side state management
- [ ] Use **`window.location.href`** for navigation after session updates
- [ ] **Avoid `startTransition`** when navigation is involved (or wrap navigation in callback, not in transition)
- [ ] Use **ISO date format** (`toISOString().split('T')[0]`) for any dates shown in UI
- [ ] Add **`isHydrated` guard** to components that render based on client-only data
- [ ] Test for **hydration errors** in browser console after every page interaction
- [ ] **Clear Service Worker** and caches after major code changes during development
- [ ] Include cache versioning strategy in Service Worker configuration

---

## Related Solutions

- [nextjs-migration-lessons-learned](../code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md) - Pattern: Next.js safe navigation
- [typescript-unused-variables-build-failure](../build-errors/typescript-unused-variables-build-failure-MAIS-20251227.md) - Related: Hydration guard pattern uses useState for unused state
- [auth-form-accessibility-checklist](auth-form-accessibility-checklist-MAIS-20251230.md) - Related: Form patterns for auth actions
- [nextauth-v5-secure-cookie-prefix](../authentication-issues/nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md) - Related: Session cookie updates and hard navigation

---

## Summary

The impersonation navigation fix required addressing five interconnected layers:

1. **Form actions → Click handlers** (removes hydration mismatch)
2. **startTransition → window.location.href** (guarantees session is applied before navigation)
3. **toLocaleDateString() → ISO format** (ensures server/client dates match)
4. **Conditional render → isHydrated guard** (makes component hydration-safe)
5. **Stale cache → Service Worker cleanup** (ensures browser gets fresh code)

Each fix alone wouldn't fully solve the problem. Together, they create a **resilient impersonation flow** that safely updates session state and navigates without hydration errors.

**Key insight:** Session state changes require **hard navigation** (window.location.href) to guarantee both cookies and RSC cache are updated. Soft navigation (router.push) leaves a window where the cache might be stale.
