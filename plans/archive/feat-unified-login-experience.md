# feat: Unified Login Experience

## Overview

Consolidate the login experience so all users (platform admins and tenant admins) use the same `/login` route. After authentication, users are automatically routed to their appropriate dashboard based on their role.

**Current State:** Backend already supports unified login (`POST /v1/auth/login` tries tenant first, then admin). Frontend has separate routes but Login.tsx already implements the try-both-roles pattern.

**Target State:** Single `/login` page, automatic role-based redirect, remove legacy routes.

---

## Problem Statement

Users currently see different login URLs:

- `/login` - Unified (current)
- `/admin/login` - Legacy redirect
- `/tenant/login` - Legacy redirect

The backend already handles unified auth correctly - this is a frontend cleanup and UX polish task.

---

## Proposed Solution

### Phase 1: Verify Current Implementation (30 min)

The Login.tsx already implements the correct pattern:

1. Try PLATFORM_ADMIN login first
2. If fails, try TENANT_ADMIN login
3. Redirect based on role

**Verify these files work correctly:**

- `client/src/pages/Login.tsx` - Unified login page
- `client/src/router.tsx` - Route configuration with redirects
- `client/src/contexts/AuthContext/AuthProvider.tsx` - Auth state management

### Phase 2: Frontend Polish (Optional)

Minor UX improvements:

- Show "Signing in..." loading state
- Clear error message on retry
- Add "Remember me" checkbox (optional)

---

## Technical Details

### Backend (No Changes Needed)

The unified endpoint already exists at `server/src/routes/auth.routes.ts:257-295`:

```typescript
// POST /v1/auth/login - Unified login
// 1. Tries tenant login first (findByEmail)
// 2. Falls back to platform admin login
// 3. Returns role, email, tenantId/userId in response
```

### Frontend Flow (Already Implemented)

`client/src/pages/Login.tsx:69-104`:

```typescript
// 1. Try PLATFORM_ADMIN login
await login(values.email, values.password, 'PLATFORM_ADMIN');

// 2. If fails, try TENANT_ADMIN login
await login(values.email, values.password, 'TENANT_ADMIN');

// 3. On success, useEffect redirects based on role
if (role === 'PLATFORM_ADMIN') navigate('/admin/dashboard');
else if (role === 'TENANT_ADMIN') navigate('/tenant/dashboard');
```

### Router Configuration (Already Correct)

`client/src/router.tsx:50-96`:

```typescript
// Legacy redirects already in place
{ path: "/admin/login", element: <Navigate to="/login" replace /> },
{ path: "/tenant/login", element: <Navigate to="/login" replace /> },
```

---

## Acceptance Criteria

### Functional

- [x] Single `/login` route for all users (already done)
- [x] Platform admin login → `/admin/dashboard` (already done)
- [x] Tenant admin login → `/tenant/dashboard` (already done)
- [x] Legacy routes redirect to `/login` (already done)
- [ ] Test with real credentials to verify flow works

### Non-Functional

- [ ] No TypeScript errors
- [ ] Login responds within 2 seconds
- [ ] Error messages are clear and helpful

---

## Testing Checklist

### Manual Testing Required

1. **Platform Admin Login**
   - Email: `mike@maconheadshots.com`
   - Password: `@Nupples8`
   - Expected: Redirect to `/admin/dashboard`

2. **Tenant Admin Login**
   - Email: `Elope@ment.com` (La Petit Mariage)
   - Expected: Redirect to `/tenant/dashboard`

3. **Invalid Credentials**
   - Try wrong password
   - Expected: Clear error message

4. **Legacy Route Redirects**
   - Visit `/admin/login` → Should redirect to `/login`
   - Visit `/tenant/login` → Should redirect to `/login`

---

## What's NOT Included

Per KISS principle, these are deferred:

- HttpOnly cookie migration (production hardening)
- Refresh token implementation
- Multi-role user support (admin who is also tenant)
- Deep link preservation (return to intended page after login)

---

## Files Summary

**No files need modification** - the unified login is already implemented.

**Files to verify:**

- `client/src/pages/Login.tsx` - Unified login page
- `client/src/router.tsx` - Route configuration
- `client/src/contexts/AuthContext/` - Auth state management
- `server/src/routes/auth.routes.ts` - Backend unified endpoint

---

## References

### Internal Files

- Login page: `client/src/pages/Login.tsx:69-104`
- Auth routes: `server/src/routes/auth.routes.ts:257-295`
- Router config: `client/src/router.tsx:50-96`
- Auth context: `client/src/contexts/AuthContext/AuthProvider.tsx`

### Research Findings

- Backend unified login already implemented and working
- Frontend already has try-admin-then-tenant pattern
- Legacy routes already redirect to unified `/login`
