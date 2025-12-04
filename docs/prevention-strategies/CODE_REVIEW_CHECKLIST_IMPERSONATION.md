# Code Review Checklist: Impersonation-Safe Role-Based Components

Use this checklist when reviewing PRs that contain role-based UI, authentication, or permission logic.

## Pre-Review Questions

- [ ] Does this PR modify any component that checks `user.role`?
- [ ] Does this PR add new role-based UI or authorization logic?
- [ ] Does this PR touch ProtectedRoute, authentication, or navigation?
- [ ] Does this PR add new admin-only features?

**If you answered YES to any of the above, complete the checklist below.**

---

## Core Checklist Items

### 1. Impersonation State Awareness

**What to check:**

```typescript
// ✅ Component imports isImpersonating
const { user, isImpersonating } = useAuth();

// ❌ Missing - only imports user
const { user } = useAuth();
```

**Questions for author:**

- [ ] Does the component check `isImpersonating()` state?
- [ ] Is there a logical reason NOT to check impersonation state? (If so, document it)

**What to do if missing:**

- Request author add `isImpersonating()` check
- Ask: "What should happen when a platform admin is impersonating a tenant?"

---

### 2. Effective Role Calculation

**What to check:**

```typescript
// ✅ Component calculates effective role
const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;
// All subsequent checks use effectiveRole

// ❌ Component uses raw user.role
if (user.role === 'PLATFORM_ADMIN') { ... }  // Ignores impersonation
```

**Questions for author:**

- [ ] Is there a single point where effective role is calculated?
- [ ] Are all role checks using effective role, not raw role?
- [ ] Is the effective role calculation clear and documented?

**What to do if missing:**

- Request author add effective role calculation
- Look for every instance of `user.role` and ask: "Should this check impersonation?"

---

### 3. Navigation Consistency

**If component renders navigation:**

```typescript
// ✅ Navigation matches effective role
const navItems = effectiveRole === 'PLATFORM_ADMIN' ? adminNavigation : tenantNavigation;

// ❌ Navigation shows admin items even when impersonating
const navItems =
  user.role === 'PLATFORM_ADMIN'
    ? adminNavigation // Wrong! Shows admin nav while impersonating
    : tenantNavigation;
```

**Checks:**

- [ ] Navigation items list matches the role being displayed
- [ ] Admin-specific nav items (e.g., "Manage Tenants") are hidden when impersonating
- [ ] Tenant nav is always used when `isImpersonating() === true`
- [ ] Navigation changes immediately when impersonation state changes

**What to look for:**

- Navigate impersonating to each nav item - should work within tenant context
- Navigate to `/admin/dashboard` while impersonating - should redirect to `/tenant/dashboard`

---

### 4. Feature/Control Visibility

**If component shows admin-only features:**

```typescript
// ✅ Admin controls hidden when impersonating
if (user.role === 'PLATFORM_ADMIN' && !isImpersonating()) {
  return <AdminOnlyControl />;
}

// ❌ Shows admin controls even when impersonating
if (user.role === 'PLATFORM_ADMIN') {
  return <AdminOnlyControl />;  // SECURITY ISSUE
}
```

**Checks:**

- [ ] Admin-only buttons (Create Tenant, Edit Settings, etc.) are not visible when impersonating
- [ ] Admin controls that appear are safe to use in tenant context
- [ ] The component explicitly hides controls rather than relying on permissions
- [ ] Any dangerous operations require double-check that impersonation is off

**Red flags:**

- "Add Tenant" button visible while impersonating
- "Change Commission" control visible while impersonating
- Admin panel accessible while impersonating

---

### 5. Route Protection

**If component is ProtectedRoute or route guard:**

```typescript
// ✅ Routes protected by effective role
const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;
if (!allowedRoles.includes(effectiveRole)) {
  return <Navigate to={redirectPath} />;
}

// ✅ Admins impersonating redirected away from admin routes
if (isImpersonating() && pathname.startsWith('/admin')) {
  return <Navigate to="/tenant/dashboard" />;
}

// ❌ Routes only check user.role
if (!allowedRoles.includes(user.role)) { ... }  // Impersonation bypasses check

// ❌ No redirect for admin routes when impersonating
const isAdmin = user.role === 'PLATFORM_ADMIN';  // Doesn't check impersonation
```

**Checks:**

- [ ] Routes allowed by effective role, not actual role
- [ ] Admin routes have explicit check to redirect impersonating users
- [ ] Tenant routes allow impersonating admins (treated as tenant)
- [ ] All route transitions tested with impersonation active

**Test scenario:**

```
1. Admin logs in
2. Admin impersonates tenant
3. Try to navigate to /admin/dashboard
4. Should redirect to /tenant/dashboard
```

---

### 6. Impersonation Context Display

**If impersonation is possible in this component:**

```typescript
// ✅ Clear visual indication of impersonation
{isImpersonating() && (
  <ImpersonationBanner
    tenantName={impersonation?.tenantSlug}
    onExit={handleStopImpersonation}
  />
)}

// ❌ No visual indication
// (User doesn't know they're impersonating)
```

**Checks:**

- [ ] If impersonation is possible, ImpersonationBanner is always visible
- [ ] Banner shows tenant name/slug
- [ ] Banner has exit button
- [ ] Banner is prominent and hard to miss
- [ ] Banner appears immediately after impersonation starts

---

### 7. Type Safety

**What to check:**

```typescript
// ✅ Type-safe impersonation checks
const isImpersonating = useAuth().isImpersonating(); // Returns boolean
const impersonation = useAuth().impersonation; // Typed as ImpersonationData | null

// ✅ Types prevent logic errors
type EffectiveRole = 'PLATFORM_ADMIN' | 'TENANT_ADMIN'; // Exhaustive

// ❌ Type-unsafe
const token = localStorage.getItem('token');
const payload = JSON.parse(atob(token?.split('.')[1]));
const isImpersonating = !!payload.impersonating; // Fragile

// ❌ Missing types
const role: any = useAuth().role; // Can't verify at compile time
```

**Checks:**

- [ ] Component uses `useAuth()` context, not direct token parsing (unless display-only)
- [ ] Impersonation state has proper TypeScript types
- [ ] Role values are exhaustive enums, not strings
- [ ] No `any` types in auth-related code

---

### 8. Test Coverage

**What to check in test files:**

```typescript
// ✅ Tests cover impersonation scenarios
describe('RoleBasedNav', () => {
  describe('during impersonation', () => {
    it('shows tenant nav when admin impersonating', () => { ... });
    it('hides admin controls when impersonating', () => { ... });
  });
});

// ❌ No impersonation tests
// Only tests admin and tenant separately
```

**Checks:**

- [ ] Tests include scenario where `isImpersonating() === true`
- [ ] Tests include scenario where `isImpersonating() === false`
- [ ] Tests verify correct nav/controls show in each scenario
- [ ] E2E tests cover full impersonation flow (start → impersonate → stop)
- [ ] Tests use proper mock setup, not token parsing

**Test scenarios to verify exist:**

- [ ] Admin user WITHOUT impersonation shows admin nav
- [ ] Admin user WITH impersonation shows tenant nav
- [ ] Regular tenant user always shows tenant nav
- [ ] Impersonation banner appears when impersonating
- [ ] Impersonation banner disappears when stopped
- [ ] Navigating to admin route while impersonating redirects to tenant

---

### 9. Documentation

**What to check:**

```typescript
// ✅ Clear comments explaining impersonation handling
// When impersonating a tenant, show tenant navigation instead of platform admin
const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;

// ❌ No explanation
// Just the code with no context
const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;
```

**Checks:**

- [ ] Component has comment explaining how it handles impersonation
- [ ] If skipping impersonation check, there's a comment explaining why
- [ ] Complex impersonation logic has clear variable names
- [ ] Docs reference impersonation strategy guide if relevant

---

## Sign-Off Checklist

**Before approving PR:**

- [ ] All applicable items above are satisfied or explicitly N/A
- [ ] No code paths bypass impersonation checks
- [ ] Tests pass including impersonation scenarios
- [ ] Feature works correctly in both impersonation states
- [ ] UX is clear about current role/impersonation state

## Common Issues Found

Record these when found (helps identify patterns):

- [ ] Missing `isImpersonating()` check
- [ ] Using raw `user.role` instead of `effectiveRole`
- [ ] Admin controls not hidden during impersonation
- [ ] No tests for impersonation scenarios
- [ ] Route not protected against impersonation bypass
- [ ] Missing ImpersonationBanner
- [ ] Confusing UX (unclear what role user is in)
- [ ] Type-unsafe token parsing

## If You Find Issues

**Template response:**

> I noticed this component checks `user.role` but doesn't account for impersonation state. When a platform admin is impersonating a tenant, they should be treated as `TENANT_ADMIN` for UI purposes.
>
> Suggested fix:
>
> ```typescript
> const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;
> // Use effectiveRole instead of user.role
> ```
>
> Please see the impersonation prevention guide: `docs/prevention-strategies/IMPERSONATION_NAVIGATION_BUG_PREVENTION.md`

---

## Questions to Ask Author

If you're unsure:

1. "What should happen when a platform admin is impersonating a tenant?"
2. "Can this feature be accessed by an impersonating admin? Should it be?"
3. "How does this component know whether impersonation is active?"
4. "What would break if we started impersonating a tenant?"
5. "Are all role checks considering impersonation state?"

---

## Reference

- **Full Guide:** `docs/prevention-strategies/IMPERSONATION_NAVIGATION_BUG_PREVENTION.md`
- **Quick Ref:** `docs/prevention-strategies/IMPERSONATION_QUICK_REFERENCE.md`
- **Types:** `client/src/types/auth.ts`
- **Example:** `client/src/components/navigation/RoleBasedNav.tsx`
- **Tests:** `server/test/routes/auth-impersonation.spec.ts`
