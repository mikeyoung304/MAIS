---
title: Impersonation Navigation Prevention Strategies
category: patterns
component: ImpersonationBanner, TenantsList
date_created: 2026-01-06
severity: critical
tags:
  - impersonation
  - hydration-safety
  - session-management
  - navigation
  - nextjs
  - nextauth
related_docs:
  - docs/solutions/ui-bugs/impersonation-sidebar-navigation-bug.md
  - docs/solutions/patterns/auth-form-accessibility-checklist-MAIS-20251230.md
  - apps/web/README.md
  - apps/web/src/lib/auth.ts
---

# Impersonation Navigation Prevention Strategies

## Overview

This document provides comprehensive prevention strategies for impersonation session management in Next.js. It covers hydration safety, navigation patterns, date formatting, service worker caching, and the isHydrated pattern to prevent future issues when a Platform Admin impersonates a tenant.

**Commit Context:** `2b995961` - "use unstable_update for impersonation session management"

---

## Problem Statement

When a Platform Admin impersonates a tenant, the session state must be carefully managed across server and client to prevent:

1. **Hydration mismatches** - Server renders one thing, client renders another
2. **Stale cache** - RSC cache or service workers serving old session data
3. **Navigation failures** - Router state desynchronized from session state
4. **Session desync** - Backend token cookie mismatched from JWT session

---

## Part 1: Hydration Mismatch Prevention

### What is Hydration?

In Next.js with Server Components:

1. **Server-Side Rendering (SSR):** Server generates HTML from components
2. **Initial Client Load:** Browser renders that HTML (no React yet)
3. **Hydration:** React attaches event listeners and state to the existing HTML
4. **Mismatch:** If server HTML ≠ client HTML, React throws errors and re-renders

### Critical Rule: Session Data is NOT Available on Server

```typescript
// ❌ WRONG - Server renders this, client doesn't have session yet
export function ImpersonationBanner() {
  const { impersonation } = useAuth(); // Not available during SSR!

  // Server: renders null (no session yet)
  // Client: renders banner (session loaded)
  // Result: HYDRATION MISMATCH
  if (!impersonation) return null;

  return <div>Viewing as: {impersonation.tenantSlug}</div>;
}

// ✅ CORRECT - Use isHydrated to ensure both server and client render the same thing
export function ImpersonationBanner() {
  const { impersonation } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true); // Only after hydration
  }, []);

  // Server AND client both return null initially
  if (!isHydrated) return null;

  // After hydration, check session
  if (!impersonation) return null;

  return <div>Viewing as: {impersonation.tenantSlug}</div>;
}
```

### Why This Works

1. **During SSR:** Server returns `null` (no session available yet)
2. **Initial Client Render:** Client also returns `null` (before useEffect runs)
3. **Server HTML === Client HTML:** ✅ No mismatch
4. **After Hydration:** useEffect runs, state updates, component re-renders with session data

### The isHydrated Pattern

This is the **canonical pattern** for handling session-dependent rendering:

```typescript
'use client';

import { useState, useEffect } from 'react';

export function SessionDependentComponent() {
  const { session, isLoading } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  // Mark component as hydrated after first client render
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Return null during:
  // 1. SSR (server always returns null during SSR)
  // 2. Session loading (undefined until auth context loads)
  // 3. Hydration mismatch prevention (wait for useEffect)
  if (!isHydrated || isLoading) {
    return null;
  }

  // Now safe to check session-dependent logic
  if (!session) {
    return null;
  }

  return (
    <div>
      Welcome, {session.user.email}
    </div>
  );
}
```

### Hydration Safety Rules

| Scenario                                            | Action                                                                     | Why                              |
| --------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------- |
| Use `useAuth()`, `useSession()`                     | Always wrap in `isHydrated` check                                          | Session not available during SSR |
| Use client-specific APIs (`localStorage`, `window`) | Check `typeof window !== 'undefined'` OR use `isHydrated`                  | These APIs don't exist on server |
| Render locale-specific content (dates, currency)    | Use hydration-safe formats (ISO strings, cents) OR guard with `isHydrated` | Server locale ≠ client locale    |
| Check browser viewport, scroll position             | Guard with `isHydrated`                                                    | Server has no viewport           |
| Use random values (UUIDs, colors)                   | Generate on client after hydration                                         | Server and client differ         |

---

## Part 2: Navigation Pattern - Which Method to Use?

### Three Navigation Methods in Next.js

#### Method 1: `router.push()` (Soft Navigation)

```typescript
const router = useRouter();
await router.push('/new-page');
```

**When to use:**

- Navigating within cached app (all data current)
- User interaction doesn't require full session refresh
- No session/auth changes involved

**Don't use for impersonation** - RSC cache may be stale

#### Method 2: `startTransition()` (Optimistic Update)

```typescript
import { startTransition } from 'react';

startTransition(() => {
  router.push('/new-page');
});
```

**When to use:**

- Wrapping Server Actions for optimistic UI
- Small, contained updates
- Error recovery within same session

**Don't use for impersonation** - Session update is async side effect, concurrent features can interfere

#### Method 3: `window.location.href` (Hard Navigation) ✅ FOR IMPERSONATION

```typescript
window.location.href = '/new-page';
```

**When to use:**

- Session changed (login, logout, impersonation)
- Need complete page reload
- Must reset all caches (RSC, service workers, SessionProvider)

**Use for impersonation** - Forces:

1. Full page reload
2. RSC cache invalidation
3. Service worker cache bypass
4. SessionProvider refresh
5. Session data re-fetch

### Decision Tree

```
Does the action change the session?
├─ YES (login, logout, impersonate) → window.location.href
└─ NO
   └─ Is it a Server Action with small side effects?
      ├─ YES → startTransition + router.push
      └─ NO → router.push
```

### Impersonation Navigation Pattern

```typescript
// ❌ WRONG - RSC cache may contain old tenant data
const result = await impersonateTenant(tenantId);
if (result.success) {
  router.push(result.redirectTo); // Cache not invalidated!
}

// ✅ CORRECT - Full page reload, all caches cleared
const result = await impersonateTenant(tenantId);
if (result.success) {
  window.location.href = result.redirectTo;
}
```

---

## Part 3: Server Action Pattern for Session Updates

### Critical: Server Actions Don't Automatically Update Session

```typescript
'use server';

export async function impersonateTenant(tenantId: string) {
  // Step 1: Validate user
  const session = await auth();
  if (!session?.user?.role !== 'PLATFORM_ADMIN') {
    return { success: false };
  }

  // Step 2: Call backend API to get new token
  const response = await fetch('/v1/auth/impersonate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${backendToken}` },
    body: JSON.stringify({ tenantId }),
  });

  const data = await response.json();

  // Step 3: Update backend token cookie
  const cookieStore = await cookies();
  cookieStore.set('mais_backend_token', data.token, { ... });

  // ⚠️ PROBLEM: JWT session cookie is NOT updated yet!
  // The next client request will use old JWT from cookie
  // This causes: client thinks old session, backend thinks new session

  // Step 4: Update JWT session cookie using unstable_update
  await unstable_update({
    user: {
      id: data.tenantId,
      email: data.email,
      role: data.role,
      impersonation: data.impersonation,
      backendToken: data.token, // Passed to JWT callback
    } as unknown as { id: string; email: string },
  });

  // Step 5: Invalidate RSC cache
  revalidatePath('/');

  // Step 6: Return redirect URL to client
  // Client will do: window.location.href = result.redirectTo
  return { success: true, redirectTo: '/tenant/dashboard' };
}
```

### Why `unstable_update()` Instead of `signIn()`?

```typescript
// ❌ FAILS in Server Action context
export async function impersonateTenant(tenantId: string) {
  const response = await fetch('/v1/auth/impersonate', { ... });
  const data = await response.json();

  // signIn() uses cookies() internally, conflicts with Server Action's own cookie modifications
  // This can fail silently or throw "Cannot use public-only `signIn()`" error
  await signIn('credentials', {
    email: data.email,
    password: '...', // Problem: we don't have original password!
    redirect: false,
  });
}

// ✅ WORKS in Server Action context
export async function impersonateTenant(tenantId: string) {
  const response = await fetch('/v1/auth/impersonate', { ... });
  const data = await response.json();

  // unstable_update() directly calls jwt callback with new user data
  // Handles session cookie update internally without conflicts
  await unstable_update({
    user: { ... },
  });
}
```

---

## Part 4: Date Formatting - Hydration Safety

### The Problem

```typescript
// ❌ NOT hydration-safe
function TenantCard({ createdAt }: { createdAt: string }) {
  const date = new Date(createdAt);

  // Server: Jan 6, 2026 (UTC)
  // Client: Jan 5, 2026 (EST, -5 hours)
  // HYDRATION MISMATCH!
  return <div>{date.toLocaleDateString()}</div>;
}
```

### The Solution: ISO Date Format

```typescript
// ✅ Hydration-safe - same format everywhere
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  // Returns: "2026-01-06" (always ISO, no locale conversion)
  return date.toISOString().split('T')[0];
}

function TenantCard({ createdAt }: { createdAt: string }) {
  // Server: "2026-01-06"
  // Client: "2026-01-06"
  // No mismatch!
  return <div>{formatDate(createdAt)}</div>;
}
```

### Hydration-Safe Date Formatting Patterns

| Format                                    | Hydration-Safe | Use Case                          |
| ----------------------------------------- | -------------- | --------------------------------- |
| `toISOString()`                           | ✅             | Storage, APIs, internal use       |
| `toISOString().split('T')[0]`             | ✅             | Display date only (YYYY-MM-DD)    |
| `toISOString().split('T')[1].slice(0, 5)` | ✅             | Display time only (HH:mm)         |
| `toLocaleDateString()`                    | ❌             | Locale-dependent, server ≠ client |
| `toLocaleString()`                        | ❌             | Locale-dependent, server ≠ client |
| Custom timezone formatting                | ⚠️             | Only if guarded by `isHydrated`   |

---

## Part 5: Service Worker Debugging - Cache Staleness

### Recognizing Service Worker Cache Issues

```
Symptom: Changes deployed, but user sees old code
Scenario:
  - Fix impersonation cookie rotation
  - Deploy new code
  - User refreshes page but old code still running
  - User reports: "Nothing changed!"
```

### Service Workers Cache the App Shell

```
Next.js
├── App Shell (HTML) - Cached by Service Worker
│   └── Points to /api/tenants
├── JavaScript Bundles - Cached by Service Worker
│   └── Old version of TenantsList.tsx
└── API Responses - Also cached!
    └── /api/impersonate
```

### How to Recognize Service Worker Cache Staleness

1. **In DevTools:**
   - Open DevTools → Application → Service Workers
   - Check if a Service Worker is active
   - Open Network tab → check "Offline" checkbox
   - Does the page still load? → Service Worker is caching

2. **In Code:**

   ```typescript
   // Check if service worker is registered
   if ('serviceWorker' in navigator) {
     const registration = await navigator.serviceWorker.ready;
     console.log('Service Worker:', registration);
   }
   ```

3. **Symptoms of Stale Cache:**
   - Page loads old code even after refresh
   - Console shows old component versions
   - API responses are from old session
   - Hard reload (Cmd+Shift+R) fixes it temporarily

### How to Clear Service Worker Cache

```typescript
// Option 1: User-triggered clear
function ClearCacheButton() {
  const handleClear = async () => {
    // Clear service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(r => r.unregister()));

    // Clear caches
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));

    // Reload page with fresh cache
    window.location.href = '/';
  };

  return <button onClick={handleClear}>Clear Cache & Reload</button>;
}

// Option 2: Automatic on impersonation
export async function impersonateTenant(tenantId: string) {
  // ... impersonation logic ...

  // After successful impersonation, force cache clear on client
  // This happens after window.location.href so it won't execute,
  // but it's good to document the intention

  if (typeof window !== 'undefined') {
    // Next page load will skip service worker cache with ?cache_bust
    window.location.href = result.redirectTo + '?cache_bust=' + Date.now();
  }
}

// Option 3: Next.js built-in cache invalidation
export async function impersonateTenant(tenantId: string) {
  // ...
  // Invalidate all RSC caches
  revalidatePath('/', 'layout');

  // This forces next request to regenerate from server
  return { success: true, redirectTo: '/tenant/dashboard' };
}
```

### Prevention: Never Skip Service Worker Updates

When deploying impersonation fixes:

```bash
# DON'T just push a new Next.js build
npm run build
git push

# DO increment the version number
# This forces service workers to update
# See: apps/web/public/manifest.json version field
```

---

## Part 6: Complete isHydrated Implementation Guide

### Pattern 1: Conditional Rendering (Most Common)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-client';

export function UserWelcome() {
  const { user, isLoading } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Case 1: Server render + initial client render return null
  if (!isHydrated) return null;

  // Case 2: Session still loading
  if (isLoading) return null;

  // Case 3: No user (not authenticated)
  if (!user) return null;

  // Case 4: Render with full session context
  return (
    <div>
      <p>Welcome, {user.email}</p>
      {user.impersonation && (
        <p>You are impersonating {user.impersonation.tenantSlug}</p>
      )}
    </div>
  );
}
```

### Pattern 2: Custom Hydration Hook (Reusable)

```typescript
// lib/useHydrated.ts
'use client';

import { useState, useEffect } from 'react';

export function useHydrated() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
}

// Usage in components
export function ImpersonationBanner() {
  const isHydrated = useHydrated();
  const { impersonation } = useAuth();

  if (!isHydrated) return null;
  if (!impersonation) return null;

  return <div>Impersonating: {impersonation.tenantSlug}</div>;
}
```

### Pattern 3: Skeleton / Loading State

```typescript
'use client';

export function UserWelcome() {
  const { user, isLoading } = useAuth();
  const isHydrated = useHydrated();

  if (!isHydrated || isLoading) {
    // Show placeholder instead of null
    return (
      <div className="h-8 bg-gray-200 rounded animate-pulse" />
    );
  }

  if (!user) return null;

  return <div>Welcome, {user.email}</div>;
}
```

### Anti-Pattern: Removing isHydrated Check

```typescript
// ❌ WRONG - Will cause hydration mismatch
export function ImpersonationBanner() {
  const { impersonation } = useAuth();

  // "I'll just move the check inside the condition"
  // Server renders banner (no session yet, impersonation is undefined)
  // Client renders banner (session loaded, impersonation is defined)
  // MISMATCH!

  return (
    <>
      {impersonation ? (
        <div>Impersonating: {impersonation.tenantSlug}</div>
      ) : null}
    </>
  );
}

// ✅ CORRECT - Wrap the entire return
export function ImpersonationBanner() {
  const { impersonation } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) return null;

  return (
    <>
      {impersonation ? (
        <div>Impersonating: {impersonation.tenantSlug}</div>
      ) : null}
    </>
  );
}
```

---

## Prevention Checklist

Use this checklist when implementing impersonation features:

### Server Action Level

- [ ] Server action validates user is PLATFORM_ADMIN
- [ ] Server action calls backend API to get new token
- [ ] Server action stores token in backend token cookie (httpOnly)
- [ ] Server action uses `unstable_update()` to update JWT session (NOT `signIn()`)
- [ ] Server action calls `revalidatePath()` to invalidate RSC cache
- [ ] Server action returns `{ success, redirectTo }` (NOT redirecting directly)
- [ ] Server action includes error handling with cookie rollback on failure
- [ ] Backend token and JWT session are kept in sync

### Client Action Level

- [ ] Client action awaits server action result
- [ ] Client checks `result.success` before navigating
- [ ] Client uses `window.location.href` for navigation (NOT `router.push()`)
- [ ] Client resets loading state on error
- [ ] Client logs errors for debugging

### Component Level

- [ ] Component uses `isHydrated` pattern for session-dependent rendering
- [ ] Component returns `null` during SSR and hydration
- [ ] Component doesn't show session data until after `useEffect`
- [ ] Component guards all session-dependent logic with checks
- [ ] Component uses hydration-safe date formatting (ISO strings)

### Testing Level

- [ ] Test impersonation start → full page load → verify session updated
- [ ] Test impersonation stop → full page load → verify admin context restored
- [ ] Test hard refresh during impersonation → session persists
- [ ] Test offline behavior → service worker cache cleared on next load
- [ ] Test concurrent impersonation attempts → fails gracefully
- [ ] Test error recovery → session rolled back on server action failure

### Deployment Level

- [ ] Increment service worker version in manifest.json
- [ ] Verify RSC cache invalidation with `revalidatePath('/', 'layout')`
- [ ] Test hard reload (Cmd+Shift+R) after deploying
- [ ] Monitor logs for session desync errors
- [ ] Have rollback plan if service worker cache issues arise

---

## Quick Reference Card (Print & Pin)

```
╔════════════════════════════════════════════════════════════════╗
║          IMPERSONATION NAVIGATION - QUICK REFERENCE            ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║ 1. HYDRATION SAFETY                                            ║
║    ✅ Always use isHydrated pattern for session-dependent UI  ║
║    ✅ Return null during SSR, before useEffect                ║
║    ❌ Never use toLocaleDateString(), only ISO format         ║
║                                                                ║
║ 2. NAVIGATION AFTER IMPERSONATION                             ║
║    ✅ Use window.location.href (full page reload)            ║
║    ❌ Never use router.push() (cache may be stale)           ║
║    ❌ Never use startTransition() (async side effects)       ║
║                                                                ║
║ 3. SERVER ACTION PATTERN                                       ║
║    ✅ Update backend token cookie                            ║
║    ✅ Use unstable_update() for JWT session                  ║
║    ✅ Call revalidatePath() to invalidate RSC cache          ║
║    ✅ Return { success, redirectTo }, don't redirect         ║
║    ❌ Never use signIn() in Server Actions                   ║
║    ❌ Never navigate directly from server action             ║
║                                                                ║
║ 4. DATE FORMATTING                                             ║
║    ✅ ISO format: date.toISOString().split('T')[0]           ║
║    ❌ Never: date.toLocaleDateString()                        ║
║                                                                ║
║ 5. SERVICE WORKER CACHE                                        ║
║    🔧 Clear: DevTools → Application → Service Workers        ║
║    🔧 Unregister → Delete caches → Hard reload               ║
║    ⚠️  Hard reload (Cmd+Shift+R) bypasses service worker     ║
║                                                                ║
║ 6. ERROR RECOVERY                                              ║
║    ✅ Catch unstable_update() errors                         ║
║    ✅ Rollback backend token cookie on error                 ║
║    ✅ Log detailed error messages for debugging              ║
║    ✅ Reset loading state on error                           ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

---

## Code Pattern Examples

### Complete Impersonation Flow

```typescript
// 1. SERVER ACTION (actions.ts)
'use server';

export async function impersonateTenant(tenantId: string) {
  const session = await auth();
  if (session?.user?.role !== 'PLATFORM_ADMIN') {
    return { success: false, error: 'Unauthorized' };
  }

  const backendToken = await getBackendToken();
  const response = await fetch(`${API_URL}/v1/auth/impersonate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${backendToken}` },
    body: JSON.stringify({ tenantId }),
  });

  if (!response.ok) {
    const error = await response.json();
    return { success: false, error: error.message };
  }

  const data = await response.json();
  const cookieStore = await cookies();

  // Store original token for rollback
  const originalToken = cookieStore.get('mais_backend_token')?.value;

  try {
    // Update backend token
    cookieStore.set('mais_backend_token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 4 * 60 * 60,
      path: '/',
    });

    // Update JWT session
    await unstable_update({
      user: {
        id: data.tenantId,
        email: data.email,
        role: data.role,
        tenantId: data.tenantId,
        slug: data.slug,
        impersonation: data.impersonation,
        backendToken: data.token,
      } as unknown as { id: string; email: string },
    });

    // Invalidate all caches
    revalidatePath('/', 'layout');

    return { success: true, redirectTo: '/tenant/dashboard' };
  } catch (error) {
    // Rollback on error
    if (originalToken) {
      cookieStore.set('mais_backend_token', originalToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60,
        path: '/',
      });
    }
    return { success: false, error: 'Failed to impersonate' };
  }
}

// 2. CLIENT COMPONENT (TenantsList.tsx)
'use client';

export function TenantsList({ tenants }: TenantsListProps) {
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const handleImpersonate = async (tenantId: string) => {
    setImpersonatingId(tenantId);

    try {
      const result = await impersonateTenant(tenantId);

      if (result.success) {
        // Full page reload after successful impersonation
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

  // ... rest of component
}

// 3. BANNER COMPONENT (ImpersonationBanner.tsx)
'use client';

export function ImpersonationBanner() {
  const { impersonation, isImpersonating, isLoading } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated || isLoading) {
    return null;
  }

  if (!isImpersonating() || !impersonation) {
    return null;
  }

  const handleExitImpersonation = async () => {
    const result = await stopImpersonation();
    if (result.success) {
      // Full page reload
      window.location.href = result.redirectTo;
    }
  };

  return (
    <div role="alert" className="bg-amber-950/50">
      <div>
        <span>Viewing as: <strong>{impersonation.tenantSlug}</strong></span>
        <Button onClick={handleExitImpersonation}>Exit Impersonation</Button>
      </div>
    </div>
  );
}

// 4. DATE FORMATTING (Hydration-safe)
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // Returns "2026-01-06"
}
```

---

## Related Documentation

- **[Impersonation Sidebar Navigation Bug](../ui-bugs/impersonation-sidebar-navigation-bug.md)** - How to handle role-based nav during impersonation
- **[NextAuth v5 Secure Cookie Prefix](../authentication-issues/nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md)** - HTTPS cookie prefix issues
- **[Auth Form Accessibility Checklist](./auth-form-accessibility-checklist-MAIS-20251230.md)** - WCAG 2.1 AA standards for auth
- **[Next.js App Router Migration](../../adrs/ADR-014-nextjs-app-router-migration.md)** - App Router architecture decisions
- **[Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)** - Tenant data isolation patterns

---

## Troubleshooting Guide

### "Hydration mismatch" console error

**Symptom:** React error about HTML mismatch

**Solution:**

1. Check if component uses session data
2. Add `isHydrated` pattern: return `null` until after `useEffect`
3. Verify server and client return same initial HTML

### User still sees old tenant data after impersonation

**Symptom:** Page loads but shows previous tenant's data

**Root causes:**

1. Service worker cache not cleared
2. RSC cache not invalidated
3. `router.push()` used instead of `window.location.href`

**Solution:**

1. Open DevTools → Application → Service Workers
2. Unregister all service workers
3. Delete all caches
4. Clear browser cache
5. Hard reload (Cmd+Shift+R)
6. Verify `window.location.href` is used for navigation

### "Cannot impersonate while already impersonating" error

**Solution:**

1. User is already impersonating a tenant
2. Must exit current impersonation first
3. Click "Exit Impersonation" banner at top of page

### Session desync: frontend JWT doesn't match backend token

**Symptom:** Some requests fail with 401, others succeed

**Root cause:**

1. Server action failed to update JWT session
2. Backend token cookie updated but JWT session not synced
3. Next request uses mismatched credentials

**Solution:**

1. Add try/catch to server action
2. Rollback backend token cookie on error
3. Log detailed error for debugging
4. Return error to client
5. Let client retry or show error message

---

## Summary

**Key Takeaways:**

1. **Hydration Safety:** Use `isHydrated` pattern for all session-dependent components
2. **Navigation:** Always use `window.location.href` when session changes
3. **Server Actions:** Use `unstable_update()` not `signIn()`, always return result
4. **Dates:** Use ISO format only (`toISOString()`)
5. **Cache:** Service workers require manual clearing, hard reload (Cmd+Shift+R) helps
6. **Testing:** Test full impersonation flow including page reloads

These patterns prevent the majority of impersonation navigation issues.
