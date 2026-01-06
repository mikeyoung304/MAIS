# Impersonation Navigation - Complete Solutions Index

This index organizes all impersonation-related solutions and prevention strategies for the MAIS codebase.

**Last Updated:** 2026-01-06
**Commit:** `2b995961` - "use unstable_update for impersonation session management"

---

## Quick Links

### For Quick Answers (Under 2 Minutes)

- **[Impersonation Quick Reference](./IMPERSONATION_QUICK_REFERENCE.md)** ⭐ **START HERE**
  - One-minute decision tree
  - Five-point checklist
  - DO/DON'T patterns
  - Print & pin card
  - **Read time:** 2 minutes

### For Complete Understanding (Comprehensive Guide)

- **[Impersonation Navigation Prevention Strategies](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md)**
  - Complete problem statement
  - 6-part prevention framework
  - Detailed explanations with examples
  - Code patterns for each concern
  - Troubleshooting guide
  - **Read time:** 15-20 minutes

### For Implementation (Copy-Paste Ready Code)

- **[Impersonation Code Patterns](./IMPERSONATION_CODE_PATTERNS.md)**
  - 8 complete code patterns
  - Server actions with full error handling
  - Client components with hydration safety
  - Utility functions (date formatting)
  - Type definitions
  - Test templates
  - **Read time:** 10-15 minutes

### Related Documentation

- **[Impersonation Sidebar Navigation Bug](../ui-bugs/impersonation-sidebar-navigation-bug.md)** - Role-based navigation during impersonation
- **[NextAuth v5 Secure Cookie Issues](../authentication-issues/nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md)** - Cookie handling in production
- **[Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)** - Tenant scoping patterns

---

## The 6 Core Prevention Strategies

### 1. Hydration Mismatch Prevention

**Problem:** Server renders one thing, client renders another → React hydration errors

**Solution:** The `isHydrated` pattern

```typescript
// Return null during SSR and initial client render
if (!isHydrated) return null;

// Render session-dependent content only after hydration
return <div>{user.email}</div>;
```

**Key Documents:**

- Part 1 of [Prevention Strategies](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-1-hydration-mismatch-prevention)
- Pattern 1 of [Code Patterns](./IMPERSONATION_CODE_PATTERNS.md#pattern-1-the-ishydrated-hook)
- Quick Reference: Rule #1

**Files to Check:**

- `apps/web/src/hooks/useHydrated.ts` (reusable hook)
- `apps/web/src/components/layouts/ImpersonationBanner.tsx` (example usage)

---

### 2. Navigation Pattern Selection

**Problem:** Wrong navigation method can cause stale cache, session desync, or lost state

**Solution:** Use `window.location.href` for session changes

```typescript
// ✅ When session changes (impersonation)
window.location.href = '/tenant/dashboard';

// ❌ Don't use router.push() - RSC cache may be stale
// ❌ Don't use startTransition() - async side effects interfere
```

**Key Documents:**

- Part 2 of [Prevention Strategies](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-2-navigation-pattern---which-method-to-use)
- Quick Reference: Rule #2

**Decision Tree:**

```
Does the action change the session?
├─ YES → window.location.href
└─ NO → use router.push() or startTransition()
```

---

### 3. Server Action Pattern

**Problem:** Session updates in Server Actions require special handling due to cookie conflicts

**Solution:** `unstable_update()` instead of `signIn()` + `revalidatePath()`

```typescript
// Step 1: Update backend token cookie
cookieStore.set('mais_backend_token', data.token, { ... });

// Step 2: Update JWT session
await unstable_update({
  user: { id, email, role, impersonation, backendToken: data.token }
});

// Step 3: Invalidate RSC cache
revalidatePath('/', 'layout');

// Step 4: Return redirect URL (don't redirect from server action)
return { success: true, redirectTo: '/tenant/dashboard' };
```

**Key Documents:**

- Part 3 of [Prevention Strategies](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-3-server-action-pattern-for-session-updates)
- Pattern 3 & 6 of [Code Patterns](./IMPERSONATION_CODE_PATTERNS.md#pattern-3-server-action---impersonate-tenant)

**Files to Update:**

- `apps/web/src/app/(protected)/admin/tenants/actions.ts`
- `apps/web/src/lib/auth.ts` (JWT callback with trigger='update')

---

### 4. Date Formatting - Hydration Safety

**Problem:** Locale-dependent dates differ between server and client → hydration mismatch

**Solution:** ISO format only (`YYYY-MM-DD`)

```typescript
// ✅ Hydration-safe
const dateStr = date.toISOString().split('T')[0]; // "2026-01-06"

// ❌ NOT hydration-safe
const dateStr = date.toLocaleDateString(); // Server: Jan 6, Client: Jan 5 (diff timezone)
```

**Key Documents:**

- Part 4 of [Prevention Strategies](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-4-date-formatting---hydration-safety)
- Pattern 2 of [Code Patterns](./IMPERSONATION_CODE_PATTERNS.md#pattern-2-hydration-safe-date-formatting)

**Files to Check:**

- `apps/web/src/lib/date-utils.ts` (formatDate, formatDateTime, formatRelativeTime)
- `apps/web/src/app/(protected)/admin/tenants/TenantsList.tsx` (usage example)

---

### 5. Service Worker Cache Debugging

**Problem:** Service worker caches old code → user sees stale session despite redeployment

**Solution:** Recognize cache issues, know how to clear them

**Signs of Service Worker Cache Issues:**

- Page loads old code even after refresh
- Hard reload (Cmd+Shift+R) fixes it temporarily
- DevTools shows service worker is registered and active

**How to Clear:**

```typescript
// DevTools Method:
// 1. F12 → Application → Service Workers
// 2. Click "Unregister" for each worker
// 3. Application → Cache Storage → Delete all
// 4. Hard reload: Cmd+Shift+R

// Code Method:
const registrations = await navigator.serviceWorker.getRegistrations();
for (const reg of registrations) await reg.unregister();
```

**Key Documents:**

- Part 5 of [Prevention Strategies](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-5-service-worker-debugging---cache-staleness)
- Quick Reference: Nuclear Option section

---

### 6. The isHydrated Pattern Implementation

**Problem:** Components render differently on server vs client when using hooks

**Solution:** Always guard session-dependent logic with `isHydrated` check

**Canonical Pattern:**

```typescript
'use client';

import { useState, useEffect } from 'react';

export function SessionComponent() {
  const { session } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Safe: both server and client return null initially
  if (!isHydrated) return null;

  // Safe: now we know session is available
  return <div>{session.user.email}</div>;
}
```

**Key Documents:**

- Part 6 of [Prevention Strategies](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-6-complete-ishydrated-implementation-guide)
- Pattern 1 of [Code Patterns](./IMPERSONATION_CODE_PATTERNS.md#pattern-1-the-ishydrated-hook)

**Files to Check:**

- `apps/web/src/hooks/useHydrated.ts` (reusable hook)
- `apps/web/src/components/layouts/ImpersonationBanner.tsx` (usage example)

---

## Use Cases & Scenarios

### Scenario 1: User Clicks "Impersonate Tenant"

**Flow:**

1. User clicks button in TenantsList
2. Client calls `impersonateTenant(tenantId)` server action
3. Server action:
   - Validates user is PLATFORM_ADMIN
   - Fetches new token from backend API
   - Updates `mais_backend_token` cookie
   - Updates JWT session with `unstable_update()`
   - Invalidates RSC cache with `revalidatePath()`
   - Returns `{ success: true, redirectTo: '/tenant/dashboard' }`
4. Client:
   - Checks `result.success`
   - Uses `window.location.href` for full page reload
5. Page reloads:
   - Service worker cache bypassed
   - RSC cache invalidated
   - SessionProvider refreshed
   - ImpersonationBanner renders (after hydration)

**Prevention Checklist:**

- [ ] Server action validates PLATFORM_ADMIN
- [ ] Server action uses `unstable_update()` not `signIn()`
- [ ] Client uses `window.location.href` not `router.push()`
- [ ] Client checks `result.success` before navigating
- [ ] Server action calls `revalidatePath()`
- [ ] Server action includes error handling with rollback

---

### Scenario 2: User Sees ImpersonationBanner

**Flow:**

1. User loads page while impersonating
2. ImpersonationBanner component renders:
   - Returns `null` during SSR (no session yet)
   - Returns `null` during initial client render (before useEffect)
   - useEffect runs, sets `isHydrated = true`
   - Component re-renders with session data
   - Banner shows: "Viewing as: bella-weddings (bella@example.com)"
3. User clicks "Exit Impersonation"
4. Client calls `stopImpersonation()` server action
5. Server action clears impersonation from JWT
6. Client navigates with `window.location.href`

**Prevention Checklist:**

- [ ] Component uses `isHydrated` pattern
- [ ] Component returns `null` during hydration
- [ ] Server action uses `unstable_update()` to clear impersonation
- [ ] Client uses `window.location.href` for navigation
- [ ] Server action includes error handling with rollback

---

### Scenario 3: Tenant Displays Current Date

**Flow:**

1. Component receives tenant with `createdAt: "2026-01-06T12:34:56Z"`
2. Component calls `formatDate(tenant.createdAt)`
3. Function returns `"2026-01-06"` (ISO format)
4. Server renders: `"2026-01-06"`
5. Client renders: `"2026-01-06"`
6. No hydration mismatch ✅

**Prevention Checklist:**

- [ ] Always use `formatDate()` for ISO format
- [ ] Never use `toLocaleDateString()`
- [ ] If using relative time (e.g., "2 hours ago"), guard with `isHydrated`

---

## Implementation Checklist

Use this checklist when implementing impersonation features:

### Server Action Level

- [ ] Validates user is PLATFORM_ADMIN
- [ ] Prevents nested impersonation attempts
- [ ] Calls backend API to get new token
- [ ] Updates backend token cookie (httpOnly, secure)
- [ ] Uses `unstable_update()` to sync JWT session (NOT `signIn()`)
- [ ] Calls `revalidatePath('/', 'layout')` to invalidate RSC cache
- [ ] Returns `{ success, redirectTo }` (NOT redirecting)
- [ ] Includes try/catch with cookie rollback on error
- [ ] Logs detailed error messages for debugging
- [ ] Stores original token for rollback if session update fails

### Client Action Level

- [ ] Awaits server action result
- [ ] Checks `result.success` before navigating
- [ ] Uses `window.location.href` for navigation (NOT `router.push()`)
- [ ] Resets loading state on error
- [ ] Logs errors for debugging
- [ ] Doesn't use `startTransition()` (async side effects)

### Component Level

- [ ] Uses `isHydrated` pattern for session-dependent rendering
- [ ] Returns `null` during SSR and hydration
- [ ] Doesn't access session data until after `useEffect`
- [ ] Guards all session-dependent logic with checks
- [ ] Uses hydration-safe date formatting (ISO strings)
- [ ] Includes accessibility attributes (role="alert", aria-live)

### Testing Level

- [ ] Test impersonation start → full page reload → session updated
- [ ] Test impersonation exit → admin context restored
- [ ] Test hard refresh during impersonation → session persists
- [ ] Test offline behavior → service worker cache cleared on reload
- [ ] Test concurrent impersonation → fails gracefully
- [ ] Test error recovery → session rolled back on failure
- [ ] Test hydration → banner doesn't show during SSR

### Deployment Level

- [ ] Increment service worker version in manifest.json
- [ ] Verify `revalidatePath()` works correctly
- [ ] Test hard reload (Cmd+Shift+R) after deployment
- [ ] Monitor logs for session desync errors
- [ ] Have rollback plan for service worker issues

---

## Common Mistakes & How to Avoid Them

| Mistake                                     | Symptom                                 | Prevention                                                       |
| ------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| Using `router.push()` for impersonation     | Stale data after impersonation          | Always use `window.location.href` for session changes            |
| Using `startTransition()`                   | Navigation fails silently               | Don't wrap server actions with side effects in startTransition   |
| Using `signIn()` in Server Action           | "Cannot use public-only signIn()" error | Always use `unstable_update()` in Server Actions                 |
| Missing `revalidatePath()`                  | Page loads stale RSC data               | Always call `revalidatePath('/', 'layout')` after session change |
| Rendering session data without `isHydrated` | Hydration mismatch error                | Always use `isHydrated` pattern and return null during hydration |
| Using `toLocaleDateString()`                | Hydration mismatch on dates             | Always use `formatDate()` with ISO format                        |
| Not rolling back token on error             | Session desync, 401 errors              | Always store original token and rollback in catch block          |
| Service worker cache stuck                  | User sees stale code                    | Hard reload (Cmd+Shift+R) or unregister service workers          |

---

## File Organization

```
docs/solutions/patterns/
├── IMPERSONATION_SOLUTIONS_INDEX.md (this file)
├── IMPERSONATION_QUICK_REFERENCE.md (2-min summary)
├── IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md (comprehensive)
├── IMPERSONATION_CODE_PATTERNS.md (copy-paste code)
└── ...

docs/solutions/ui-bugs/
├── impersonation-sidebar-navigation-bug.md (role-based nav)
└── ...

docs/solutions/authentication-issues/
├── nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md
└── ...

apps/web/src/
├── hooks/
│   └── useHydrated.ts (reusable hook)
├── lib/
│   ├── auth.ts (NextAuth config)
│   ├── auth-client.ts (useAuth hook)
│   ├── date-utils.ts (hydration-safe formatting)
│   └── logger.ts (structured logging)
├── components/
│   └── layouts/
│       └── ImpersonationBanner.tsx (hydration-safe banner)
└── app/
    └── (protected)/
        └── admin/
            └── tenants/
                ├── actions.ts (impersonateTenant, stopImpersonation)
                ├── TenantsList.tsx (component with impersonation)
                ├── types.ts (TypeScript interfaces)
                └── page.tsx (route)
```

---

## Quick Navigation by Use Case

### "I just joined the team and need to understand impersonation"

1. Read [Quick Reference](./IMPERSONATION_QUICK_REFERENCE.md) (2 min)
2. Read [Prevention Strategies](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md) (15 min)
3. Browse [Code Patterns](./IMPERSONATION_CODE_PATTERNS.md) as needed

### "I'm implementing impersonation for a new feature"

1. Start with [Code Patterns](./IMPERSONATION_CODE_PATTERNS.md)
2. Copy Pattern 1-6 as templates
3. Refer to [Prevention Strategies](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md) for explanations
4. Use [Quick Reference](./IMPERSONATION_QUICK_REFERENCE.md) checklist

### "I see a hydration mismatch error"

1. Check [Quick Reference](./IMPERSONATION_QUICK_REFERENCE.md) - Rule #1
2. Read Part 1 of [Prevention Strategies](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-1-hydration-mismatch-prevention)
3. Add `isHydrated` pattern from [Code Patterns](./IMPERSONATION_CODE_PATTERNS.md#pattern-1-the-ishydrated-hook)

### "User sees stale data after impersonation"

1. Check [Quick Reference](./IMPERSONATION_QUICK_REFERENCE.md) - Debugging section
2. Read Part 5 of [Prevention Strategies](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-5-service-worker-debugging---cache-staleness)
3. Clear service worker cache (hard reload + unregister)
4. Verify `window.location.href` is used (not `router.push()`)

### "Session desync, getting 401 errors"

1. Check [Quick Reference](./IMPERSONATION_QUICK_REFERENCE.md) - Debugging section
2. Read Part 3 of [Prevention Strategies](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-3-server-action-pattern-for-session-updates)
3. Verify error handling with cookie rollback
4. Check logs for `unstable_update()` failures

---

## Related Prevention Patterns

These documents complement the impersonation patterns:

- **[Multi-Tenant Isolation Patterns](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)** - How tenant data is scoped
- **[Role-Based Navigation Bug](../ui-bugs/impersonation-sidebar-navigation-bug.md)** - Effective role calculation during impersonation
- **[NextAuth v5 Secure Cookies](../authentication-issues/nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md)** - Cookie handling in production
- **[Express Route Ordering](../code-review-patterns/express-route-ordering-auth-fallback-security-MAIS-20260102.md)** - Backend API route security
- **[Auth Form Accessibility](./auth-form-accessibility-checklist-MAIS-20251230.md)** - WCAG 2.1 AA for auth forms

---

## Version History

| Version | Date       | Changes                                                  |
| ------- | ---------- | -------------------------------------------------------- |
| 1.0     | 2026-01-06 | Initial release - all 6 prevention strategies documented |

---

## Support

If you have questions about impersonation patterns:

1. Check the quick reference card first
2. Search the relevant prevention strategy document
3. Look for similar code patterns in `apps/web/src/`
4. Check the related documentation links
5. Review the troubleshooting guide in [Prevention Strategies](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#troubleshooting-guide)

For bugs or improvements to these documents, please file an issue with the label `documentation`.
