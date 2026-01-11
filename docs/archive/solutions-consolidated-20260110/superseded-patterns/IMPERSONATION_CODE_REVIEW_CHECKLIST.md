# Impersonation Navigation - Code Review Checklist

Use this checklist when reviewing pull requests that implement or modify impersonation features.

**Reference:** Based on commit `2b995961` - "use unstable_update for impersonation session management"

---

## Quick Review (5 Minutes)

For urgent reviews, check these 8 critical items:

- [ ] **Navigation:** Uses `window.location.href` not `router.push()`
- [ ] **Server Action:** Uses `unstable_update()` not `signIn()`
- [ ] **Cache Invalidation:** Calls `revalidatePath()` after session update
- [ ] **Hydration Safety:** Session-dependent components use `isHydrated` check
- [ ] **Error Handling:** Try/catch blocks with cookie rollback
- [ ] **Date Formatting:** Uses ISO format only (no `toLocaleDateString()`)
- [ ] **Return vs Redirect:** Server action returns `{ success, redirectTo }` not redirecting
- [ ] **Session Sync:** Both backend token cookie AND JWT session updated

**If all 8 pass:** ✅ Code is safe to merge
**If any fail:** ❌ Request changes

---

## Full Code Review Checklist

### Part 1: Server Action (impersonateTenant / stopImpersonation)

#### Authentication & Authorization

- [ ] Validates current user exists
- [ ] Checks `user.role === 'PLATFORM_ADMIN'`
- [ ] Prevents nested impersonation (checks `!user.impersonation`)
- [ ] Gets backend token via `getBackendToken()`
- [ ] Logs authentication failures with details

#### API Communication

- [ ] Calls correct backend endpoint (`/v1/auth/impersonate` or `/v1/auth/stop-impersonation`)
- [ ] Sets correct HTTP method (POST)
- [ ] Includes `Authorization: Bearer {backendToken}` header
- [ ] Sends correct body format: `{ tenantId }` for impersonate
- [ ] Handles non-OK response gracefully
- [ ] Logs API errors without exposing sensitive data

#### Cookie Management

- [ ] Gets `cookieStore` via `await cookies()`
- [ ] Stores original token BEFORE updating
- [ ] Sets `mais_backend_token` cookie with correct options:
  - [ ] `httpOnly: true` (not accessible from JavaScript)
  - [ ] `secure: process.env.NODE_ENV === 'production'` (HTTPS only in prod)
  - [ ] `sameSite: 'lax'` (CSRF protection)
  - [ ] `path: '/'` (available across all routes)
  - [ ] `maxAge` set appropriately (4 hours for impersonation, 24 hours for admin)

#### Session Update (unstable_update)

- [ ] Uses `unstable_update()` NOT `signIn()`
- [ ] Passes user object with all required fields:
  - [ ] `id` (new tenantId for impersonate, original id for stop-impersonate)
  - [ ] `email` (new email from API response)
  - [ ] `role` (from API response)
  - [ ] `tenantId` (new tenant id for impersonate, undefined for stop-impersonate)
  - [ ] `slug` (new slug for impersonate, undefined for stop-impersonate)
  - [ ] `impersonation` (impersonation data from API, undefined to clear)
  - [ ] `backendToken` (new token from API, passed to JWT callback)
- [ ] Casts to `as unknown as { id: string; email: string }` (required for NextAuth type compatibility)
- [ ] Wraps in try/catch for error handling

#### RSC Cache Invalidation

- [ ] Calls `revalidatePath()` after successful session update
- [ ] Uses `revalidatePath('/', 'layout')` to invalidate ALL caches
- [ ] Called BEFORE returning to client (while server action still executing)

#### Return Value

- [ ] Returns result object (not redirecting):
  - [ ] `{ success: true, redirectTo: '/path' }` on success
  - [ ] `{ success: false, error: 'message' }` on failure
- [ ] Doesn't use `redirect()` function
- [ ] Doesn't use `nextResponse()`
- [ ] Error messages are user-friendly (no internal stack traces)

#### Error Handling & Rollback

- [ ] Catches `unstable_update()` errors
- [ ] Logs error with logger (not console.log)
- [ ] Restores original backend token cookie if update fails
- [ ] Deletes cookie entirely if no original token exists
- [ ] Returns error message to client
- [ ] Session remains in consistent state after error

#### Logging

- [ ] Logs successful impersonation start with:
  - [ ] Admin email
  - [ ] Target tenant ID
  - [ ] Target tenant slug
- [ ] Logs successful impersonation stop with admin email
- [ ] Logs all errors with appropriate severity
- [ ] Never logs sensitive data (API keys, full tokens, passwords)

---

### Part 2: Client Component

#### Hydration Safety

- [ ] Imports or defines `useHydrated` hook
- [ ] Calls `useHydrated()` or has local `isHydrated` state
- [ ] Initializes `isHydrated` to `false`
- [ ] Has `useEffect` that sets `isHydrated(true)`
- [ ] Returns `null` if `!isHydrated`
- [ ] Returns `null` if `isLoading` (session still loading)
- [ ] Only accesses session data AFTER hydration check

#### Session Data Access

- [ ] Uses `useAuth()` or similar hook to get session
- [ ] Checks for undefined/null session data
- [ ] Doesn't render session-dependent content during SSR
- [ ] Doesn't assume impersonation data exists

#### Server Action Invocation

- [ ] Calls server action directly (not wrapped in startTransition)
- [ ] Awaits the server action result
- [ ] Checks `result.success` before navigating
- [ ] Doesn't assume success
- [ ] Has error handling (try/catch or result check)
- [ ] Logs errors appropriately

#### Navigation After Server Action

- [ ] Uses `window.location.href` for navigation (NOT `router.push()`)
- [ ] Gets redirect URL from server action result
- [ ] Only navigates if `result.success === true`
- [ ] Performs full page reload (no soft navigation)
- [ ] Browser clears all caches on reload

#### Loading State Management

- [ ] Has `isLoading` or `isPending` state for button
- [ ] Sets loading state BEFORE calling server action
- [ ] Resets loading state on error
- [ ] Button shows appropriate text during loading ("Impersonating...", "Exiting...")
- [ ] Button is disabled during loading
- [ ] Loading state doesn't prevent error recovery

#### Error Handling

- [ ] Has try/catch wrapping server action
- [ ] Catches errors and logs them
- [ ] Shows user-friendly error messages (via toast, alert, or component state)
- [ ] Allows user to retry on error
- [ ] Doesn't silently fail

#### Accessibility

- [ ] Loading state changes are announced (aria-busy, aria-label)
- [ ] Button has descriptive label
- [ ] Error messages are perceivable (not just color)
- [ ] Keyboard navigation works (keyboard can invoke button)
- [ ] Screen readers can understand state changes

---

### Part 3: Impersonation Banner Component

#### Hydration Safety

- [ ] Uses `useHydrated` hook (see Part 2 above)
- [ ] Returns `null` during SSR and hydration
- [ ] Returns `null` if `isLoading`
- [ ] Returns `null` if not impersonating
- [ ] All hydration checks pass before accessing session

#### Session Data

- [ ] Only accesses `impersonation` data
- [ ] Checks `isImpersonating()` and `impersonation` exists
- [ ] Displays `tenantSlug` and `tenantEmail` from impersonation data
- [ ] Doesn't make assumptions about data structure

#### Exit Button

- [ ] Calls `stopImpersonation()` on click
- [ ] Has loading state (`isExiting`)
- [ ] Shows "Exiting..." text while loading
- [ ] Button is disabled during loading
- [ ] Uses `window.location.href` after successful exit
- [ ] Has error handling

#### Accessibility

- [ ] Banner has `role="alert"`
- [ ] Banner has `aria-live="polite"`
- [ ] Button has descriptive aria-label
- [ ] Meaningful text content (not just icons)
- [ ] Color not sole indicator of status
- [ ] Keyboard navigation works

#### Styling & Visibility

- [ ] Fixed position banner doesn't overlap critical content
- [ ] High z-index to stay on top
- [ ] Visible and readable (sufficient contrast)
- [ ] Responsive on mobile
- [ ] Can be easily identified as warning/alert

---

### Part 4: Date Formatting

#### Hydration Safety

- [ ] Uses `formatDate()` utility or equivalent
- [ ] Returns ISO format (YYYY-MM-DD)
- [ ] Never uses `toLocaleDateString()`
- [ ] Never uses `toLocaleString()`
- [ ] If using relative time (e.g., "2 hours ago"), guarded by `isHydrated`

#### Date Utility Functions

- [ ] `formatDate()` returns ISO format
- [ ] `formatDateTime()` returns ISO with time
- [ ] `formatRelativeTime()` returns null or formatted string (guarded by `isHydrated`)
- [ ] All functions handle invalid dates gracefully
- [ ] Functions are reusable across components

#### Usage

- [ ] Formats all dates before display
- [ ] Passes `dateString` (from API) not `Date` object
- [ ] No date formatting logic in components
- [ ] Centralized date utils used consistently

---

### Part 5: Type Safety

#### TypeScript Interfaces

- [ ] `ImpersonationContext` or `ImpersonationData` interface defined
- [ ] `ImpersonationResult` type defined with `success | { success, redirectTo }`
- [ ] Types imported from correct location
- [ ] No `any` types except where documented as necessary
- [ ] Session types include impersonation data
- [ ] API response types match actual API responses

#### Type Casting

- [ ] `as unknown as { id: string; email: string }` used for unstable_update
- [ ] Reason documented (NextAuth type compatibility)
- [ ] No unnecessary type casting
- [ ] No implicit `any` types

---

### Part 6: Error Handling & Logging

#### Error Messages

- [ ] User-friendly error messages (not stack traces)
- [ ] Specific enough to diagnose issue (not generic "failed")
- [ ] No sensitive data exposed (tokens, API keys, full emails)
- [ ] Consistent error formatting
- [ ] Examples: "Impersonation failed", "Cannot impersonate while already impersonating"

#### Logging

- [ ] Uses `logger` utility (not `console.log`)
- [ ] Logs authentication failures
- [ ] Logs API errors
- [ ] Logs session update failures
- [ ] Logs successful impersonation with context
- [ ] Appropriate log levels (error, warn, info)
- [ ] No sensitive data logged (tokens, full passwords)

#### Monitoring & Debugging

- [ ] Errors are traceable via logs
- [ ] Timestamps included in logs
- [ ] Tenant/admin context included in logs
- [ ] Related errors linked together

---

### Part 7: Testing

#### Server Action Tests

- [ ] Test unauthorized user cannot impersonate
- [ ] Test unauthorized user cannot stop impersonation
- [ ] Test successful impersonation flow
- [ ] Test successful stop-impersonation flow
- [ ] Test API failure handling
- [ ] Test session update failure with cookie rollback
- [ ] Test nested impersonation prevention
- [ ] Test correct redirect URLs returned

#### Component Tests

- [ ] Test banner doesn't render during hydration
- [ ] Test banner renders when impersonating
- [ ] Test banner doesn't render when not impersonating
- [ ] Test exit button calls stopImpersonation
- [ ] Test loading state during exit
- [ ] Test error state and retry
- [ ] Test TenantsList impersonate button calls server action
- [ ] Test loading state during impersonation

#### E2E Tests

- [ ] Admin can impersonate tenant (full flow)
- [ ] Impersonation banner appears and contains correct info
- [ ] Admin can exit impersonation (full flow)
- [ ] Page reloads and session is updated
- [ ] Date formatting is consistent
- [ ] Hard refresh maintains impersonation session
- [ ] Concurrent impersonation attempts fail gracefully

---

### Part 8: Related Files & Context

#### Check These Files

- [ ] `apps/web/src/lib/auth.ts` - JWT callback handles trigger='update'
- [ ] `apps/web/src/lib/auth-client.ts` - `useAuth()` hook exposes impersonation
- [ ] `apps/web/src/hooks/useHydrated.ts` - Reusable hydration hook
- [ ] `apps/web/src/lib/date-utils.ts` - Date formatting utilities
- [ ] `server/src/routes/auth.routes.ts` - Backend impersonation endpoints
- [ ] Test files exist and pass

#### Check These Patterns

- [ ] Consistent with existing codebase patterns
- [ ] Follows multi-tenant isolation rules
- [ ] Consistent with other session-dependent features
- [ ] Doesn't duplicate existing utilities
- [ ] Error handling consistent with rest of app

---

## Review Templates

### Comment Template for Hydration Issues

````markdown
**Hydration Safety Issue**

This component renders session-dependent content without checking `isHydrated`.

**Current Code:**

```typescript
if (!impersonation) return null;
return <div>{impersonation.slug}</div>;
```
````

**Problem:**

- Server render: null (no session)
- Client render (before useEffect): null
- Client render (after useEffect): shows impersonation
- Hydration mismatch → React re-renders

**Fix:**

```typescript
const isHydrated = useHydrated();
if (!isHydrated) return null;
if (!impersonation) return null;
return <div>{impersonation.slug}</div>;
```

**Reference:** [Hydration Safety Part 1](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-1-hydration-mismatch-prevention)

````

### Comment Template for Navigation Issues

```markdown
**Navigation Pattern Issue**

This uses `router.push()` for impersonation, but should use `window.location.href`.

**Problem with `router.push()`:**
- Doesn't clear service worker cache
- RSC cache may contain old tenant data
- SessionProvider not refreshed
- Session cookie may be stale

**Fix:**
```typescript
const result = await impersonateTenant(tenantId);
if (result.success) {
  window.location.href = result.redirectTo; // Full page reload
}
````

**Reference:** [Navigation Pattern Part 2](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-2-navigation-pattern---which-method-to-use)

````

### Comment Template for Server Action Issues

```markdown
**Server Action Pattern Issue**

This uses `signIn()` in a Server Action, but should use `unstable_update()`.

**Problems with `signIn()` in Server Actions:**
- Internal cookie handling conflicts
- Requires password (we don't have it)
- Unreliable in Server Action context

**Fix:**
```typescript
await unstable_update({
  user: {
    id: data.tenantId,
    email: data.email,
    role: data.role,
    impersonation: data.impersonation,
    backendToken: data.token,
  } as unknown as { id: string; email: string },
});
````

**Reference:** [Server Action Pattern Part 3](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-3-server-action-pattern-for-session-updates)

```

---

## Red Flags (Auto-Reject)

These items should be rejected immediately:

1. ❌ **Using `router.push()` for impersonation navigation**
   - Must use `window.location.href`
   - Full page reload required for session changes

2. ❌ **Using `signIn()` in Server Action**
   - Must use `unstable_update()`
   - signIn() is unreliable in Server Action context

3. ❌ **Missing `revalidatePath()` call**
   - RSC cache won't be invalidated
   - User sees stale tenant data

4. ❌ **Session-dependent content without `isHydrated` check**
   - Causes hydration mismatch
   - React throws errors

5. ❌ **Using `toLocaleDateString()` for display**
   - Server/client timezone mismatch
   - Hydration mismatch on dates

6. ❌ **Missing error handling / cookie rollback**
   - Session desync on errors
   - 401 errors after failure

7. ❌ **Server action redirects instead of returning result**
   - Client can't control navigation
   - Can't do window.location.href

8. ❌ **Nested impersonation allowed**
   - Security issue
   - Unexpected behavior

9. ❌ **Logging sensitive data**
   - Tokens, full emails, passwords exposed in logs
   - Security vulnerability

10. ❌ **No TypeScript types**
    - Runtime errors possible
    - Harder to maintain

---

## Approval Criteria

✅ **Approve if ALL of these are true:**

1. Passes all critical items from "Quick Review (5 Minutes)"
2. Passes relevant sections from "Full Code Review Checklist"
3. Has tests covering main flows
4. No red flags detected
5. Code is consistent with existing patterns
6. Error messages are user-friendly
7. Logging is appropriate (no sensitive data)
8. TypeScript types are correct
9. Accessibility is addressed
10. Related documentation is updated

❌ **Request changes if ANY of these are true:**

1. Any critical item from quick review fails
2. Red flag detected
3. Tests are missing for critical flows
4. Hydration mismatch likely
5. Session desync possible
6. Error handling inadequate
7. Inconsistent with existing patterns
8. Sensitive data logged/exposed

---

## Summary

**Impersonation is security-critical** because it allows admins to view the system as customers.

Focus your review on:
1. **Session integrity** - Can't have desync between client/server
2. **Hydration safety** - Must match server and client renders
3. **Navigation** - Must fully reload, not soft navigate
4. **Error handling** - Must rollback on failure
5. **Logging** - No sensitive data exposed

When in doubt, refer to the [Prevention Strategies](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md) document.
```
