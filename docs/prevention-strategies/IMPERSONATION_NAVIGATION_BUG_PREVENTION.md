# Prevention Strategy: Tenant Impersonation Navigation Bug

## Problem Statement

**Bug:** RoleBasedNav component displayed platform admin navigation when a platform admin was impersonating a tenant, creating a security and UX issue.

**Root Cause:** Role-based UI components checked `user.role` to determine which navigation to display, but forgot to account for the impersonation state. When a platform admin impersonated a tenant, their role remained `PLATFORM_ADMIN` in the token, even though they should be treated as `TENANT_ADMIN` for UI purposes.

**Impact:** Security issue - admin navigation exposed to impersonating users; UX issue - inconsistent interface state when switching between admin and tenant contexts.

## Pattern Identified

**When building role-based UI components, developers may:**

1. Check only the stored `user.role` value
2. Forget to check the impersonation state (`impersonation` or `isImpersonating()`)
3. Not distinguish between "actual role" (PLATFORM_ADMIN) and "effective role" (TENANT_ADMIN while impersonating)

This pattern can occur in any component that makes decisions based on user role:

- Navigation components
- Feature toggles
- Permission-based UI visibility
- Admin-only sections
- Dashboard layout selection

---

## Prevention Strategies

### 1. Code Review Checklist for Role-Based Components

**When reviewing components that check `user.role` or make role-based decisions:**

- [ ] **Impersonation check present**: Component explicitly checks `isImpersonating()` or `impersonation` state, not just `user.role`
- [ ] **Effective role calculation**: Component calculates `effectiveRole` as `isImpersonating ? 'TENANT_ADMIN' : user.role`
- [ ] **Correct variable used**: Component uses `effectiveRole` for all authorization checks, not the raw `user.role`
- [ ] **Navigation consistency**: If showing different navigation based on role, ensures impersonation switches to tenant navigation
- [ ] **Permission isolation**: No admin-only features accessible while impersonating
- [ ] **Type safety**: Uses `const { user, isImpersonating } = useAuth()` pattern, not raw token parsing
- [ ] **Banner visibility**: When impersonating, ImpersonationBanner component is visible to provide context
- [ ] **Tests cover impersonation**: Test suite includes scenarios for impersonation state

**Checklist Item for PR Templates:**

```markdown
- [ ] If component checks user role, verified it also handles impersonation state
- [ ] If component makes authorization decisions, uses "effective role" not raw role
- [ ] If component shows admin features, verified they're hidden during impersonation
```

---

### 2. Testing Strategy for Impersonation Scenarios

#### Unit Tests (Vitest)

**Test structure for role-based components:**

```typescript
describe('RoleBasedNav', () => {
  describe('with impersonation', () => {
    it('shows tenant navigation when admin is impersonating', () => {
      // Arrange
      const mockAuth = {
        user: { role: 'PLATFORM_ADMIN', id: 'admin_123', email: 'admin@platform.com' },
        isImpersonating: () => true,
        impersonation: {
          tenantId: 'tenant_456',
          tenantSlug: 'acme-corp',
          tenantEmail: 'admin@acme.com',
          startedAt: new Date().toISOString(),
        },
      };

      // Act
      const { getByText } = render(
        <AuthContext.Provider value={mockAuth}>
          <RoleBasedNav />
        </AuthContext.Provider>
      );

      // Assert: Should show tenant dashboard, not admin dashboard
      expect(getByText('Tenant overview')).toBeInTheDocument();
      expect(queryByText('System overview & tenants')).not.toBeInTheDocument();
    });

    it('hides admin-only navigation when impersonating', () => {
      // Similar structure, verify admin nav items are not present
    });
  });

  describe('without impersonation', () => {
    it('shows platform admin navigation for admin users', () => {
      // Arrange
      const mockAuth = {
        user: { role: 'PLATFORM_ADMIN', id: 'admin_123', email: 'admin@platform.com' },
        isImpersonating: () => false,
        impersonation: null,
      };

      // Act/Assert
      expect(getByText('System overview & tenants')).toBeInTheDocument();
    });

    it('shows tenant navigation for tenant users', () => {
      // Arrange: TENANT_ADMIN role
      // Act/Assert: Shows tenant nav
    });
  });
});
```

#### E2E Tests (Playwright)

**Full impersonation flow:**

```typescript
test.describe('Impersonation Navigation', () => {
  test('admin can impersonate tenant and sees tenant navigation', async ({ page }) => {
    // Step 1: Admin logs in
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@platform.com');
    await page.fill('[name="password"]', 'admin-password');
    await page.click('button:has-text("Login")');

    // Step 2: Verify admin dashboard and nav
    await expect(page).toHaveURL('/admin/dashboard');
    await expect(page.locator('nav')).toContainText('System overview');

    // Step 3: Admin impersonates tenant
    await page.click('button:has-text("Sign in as")');
    await page.click('[data-testid="tenant-acme-corp"]');

    // Step 4: Verify navigation changed to tenant
    await expect(page).toHaveURL('/tenant/dashboard');
    await expect(page.locator('nav')).toContainText('Tenant overview');
    await expect(page.locator('nav')).not.toContainText('System overview');

    // Step 5: Verify impersonation banner visible
    await expect(page.locator('[role="alert"]')).toContainText('Impersonating Tenant');
  });

  test('navigation redirects impersonating admin away from admin routes', async ({ page }) => {
    // Impersonate tenant, then manually navigate to /admin/dashboard
    // Should redirect to /tenant/dashboard
  });

  test('stopping impersonation restores admin navigation', async ({ page }) => {
    // Impersonate -> stop impersonation -> verify admin nav returns
  });
});
```

#### Test Cases Checklist

Required test scenarios:

- [ ] Admin impersonating shows tenant navigation only
- [ ] Admin impersonating cannot access admin routes (ProtectedRoute redirect)
- [ ] ImpersonationBanner displayed during impersonation
- [ ] Stop impersonation button works and restores admin navigation
- [ ] Navigation items match the effective role, not actual role
- [ ] Token contains correct impersonation metadata
- [ ] Multiple impersonation switches work correctly
- [ ] Impersonation persists across page reloads
- [ ] Admin controls (like add/edit features) hidden during impersonation

---

### 3. Best Practice Code Pattern

#### Pattern: Calculate Effective Role

**DO: Calculate and use effective role**

```typescript
// ✅ CORRECT PATTERN

import { useAuth } from '@/contexts/AuthContext';

export function RoleBasedNav({ variant = 'sidebar' }: { variant?: 'sidebar' | 'horizontal' }) {
  const { user, isImpersonating } = useAuth();

  if (!user) return null;

  // Calculate effective role (what role the user is currently acting as)
  const effectiveRole: UserRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;

  // Decision tree based on EFFECTIVE role, not actual role
  const navItems = effectiveRole === 'PLATFORM_ADMIN'
    ? platformAdminNav
    : tenantAdminNav;

  return <nav>{/* render based on effectiveRole */}</nav>;
}
```

**DON'T: Check only user.role**

```typescript
// ❌ WRONG - Doesn't consider impersonation

export function RoleBasedNav({ variant = 'sidebar' }: { variant?: 'sidebar' | 'horizontal' }) {
  const { user } = useAuth();  // Missing isImpersonating

  if (!user) return null;

  // BUG: Shows admin nav even when impersonating
  const navItems = user.role === 'PLATFORM_ADMIN'
    ? platformAdminNav
    : tenantAdminNav;

  return <nav>{/* nav leaks admin items */}</nav>;
}
```

#### Pattern: Multi-Check Permission Helper

**DO: Use helper that checks both role and impersonation**

```typescript
// ✅ Create a helper for "effective role" checks

interface AuthContext {
  user: User | null;
  isImpersonating: () => boolean;
  getEffectiveRole: () => UserRole;  // ← Add this helper
  canAccessAdminFeatures: () => boolean;  // ← Add domain-specific helpers
}

// In AuthProvider
const getEffectiveRole = useCallback((): UserRole => {
  if (isImpersonating()) {
    return 'TENANT_ADMIN';
  }
  return user?.role ?? 'TENANT_ADMIN';
}, [user, isImpersonating]);

const canAccessAdminFeatures = useCallback((): boolean => {
  // Returns true only for actual platform admins, false if impersonating
  return user?.role === 'PLATFORM_ADMIN' && !isImpersonating();
}, [user, isImpersonating]);

// Usage in components
export function AdminFeature() {
  const { canAccessAdminFeatures } = useAuth();

  if (!canAccessAdminFeatures()) {
    return null;  // Hidden during impersonation
  }

  return <AdminControl />;
}
```

#### Pattern: Protected Route with Effective Role

**DO: Use effective role in ProtectedRoute**

```typescript
// ✅ CORRECT - ProtectedRoute checks effective role

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, isImpersonating } = useAuth();
  const location = useLocation();

  if (isLoading) return <Loading />;
  if (!user) return <Navigate to="/login" />;

  // Handle impersonation navigation
  const impersonating = isImpersonating();
  if (impersonating && location.pathname.startsWith('/admin')) {
    return <Navigate to="/tenant/dashboard" replace />;
  }

  // Calculate EFFECTIVE role
  const effectiveRole: UserRole = impersonating ? 'TENANT_ADMIN' : user.role;

  // Check against effective role
  if (!allowedRoles.includes(effectiveRole)) {
    return <Navigate to={effectiveRole === 'PLATFORM_ADMIN'
      ? '/admin/dashboard'
      : '/tenant/dashboard'}
      replace
    />;
  }

  return <>{children}</>;
}
```

---

### 4. Documentation Recommendations

#### For CLAUDE.md (Project Guidelines)

**Add to "Impersonation" section:**

````markdown
## Impersonation State Management

When a platform admin impersonates a tenant:

1. **JWT Structure**: Token has both admin identity AND impersonation metadata
   ```typescript
   {
     userId: 'admin_123',
     role: 'PLATFORM_ADMIN',  // ← Actual role (unchanged)
     impersonating: {          // ← New field indicates impersonation
       tenantId: 'tenant_456',
       tenantSlug: 'acme-corp',
       tenantEmail: 'admin@acme.com',
       startedAt: '2025-11-28T...'
     }
   }
   ```
````

2. **Effective Role**: Components must calculate effective role

   ```typescript
   const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;
   ```

3. **Rule**: Always use `effectiveRole` for UI decisions, never just `user.role`
   - Navigation display
   - Feature toggles
   - Permission checks
   - Admin-only sections

4. **UI Indicators**:
   - ImpersonationBanner always visible when impersonating
   - Navigation matches tenant context
   - Admin controls hidden
   - Session clearly marked in header

### Role-Based Component Checklist

When building components that show/hide based on role:

```typescript
// Import both role and impersonation state
const { user, isImpersonating } = useAuth();

// Calculate effective role
const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;

// Use effective role for all decisions
if (effectiveRole === 'PLATFORM_ADMIN') {
  // Show admin nav
} else {
  // Show tenant nav
}
```

**See:** `docs/prevention-strategies/IMPERSONATION_NAVIGATION_BUG_PREVENTION.md`

````

#### For Development Guide (DEVELOPING.md)

**Add troubleshooting section:**

```markdown
## Impersonation Testing

When testing impersonation features:

1. **Start impersonation**: Click "Sign in as Tenant" from admin dashboard
2. **Verify state change**:
   - Navigation changes to tenant context
   - ImpersonationBanner appears
   - URL shows `/tenant/dashboard`
   - Cannot navigate to admin routes
3. **Stop impersonation**: Click "Exit Impersonation" button
4. **Verify restoration**: Admin nav returns, banner disappears

If impersonation breaks:
- Clear localStorage and re-login
- Check that `isImpersonating()` returns correct boolean
- Verify token contains `impersonating` field
- Check that components use `effectiveRole`, not `user.role`
````

---

## Real-World Examples from Codebase

### Example 1: RoleBasedNav (FIXED)

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/navigation/RoleBasedNav.tsx`

**The fix:**

```typescript
// Line 28: Get impersonating state from context
const { user, isImpersonating } = useAuth();

// Line 91-94: Check BOTH role AND impersonation
const isCurrentlyImpersonating = isImpersonating();
const navItems =
  user.role === 'PLATFORM_ADMIN' && !isCurrentlyImpersonating ? platformAdminNav : tenantAdminNav;
```

**Why this works:**

- Explicitly calls `isImpersonating()` method
- Short-circuits to tenant nav when impersonating
- Clear logical flow: "Show admin nav if admin AND not impersonating"

### Example 2: ProtectedRoute (FIXED)

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/auth/ProtectedRoute.tsx`

**The pattern:**

```typescript
// Line 34: Get impersonation state
const impersonating = isImpersonating();

// Line 37-39: Redirect impersonating admins away from admin routes
if (impersonating && location.pathname.startsWith('/admin')) {
  return <Navigate to="/tenant/dashboard" replace />;
}

// Line 42: Calculate effective role
const effectiveRole: UserRole = impersonating ? 'TENANT_ADMIN' : user.role;

// Line 45: Check against effective role
if (!allowedRoles.includes(effectiveRole)) {
  // ...redirect based on effective role
}
```

**Why this works:**

- Multi-layer defense: prevents access to admin routes entirely
- Explicit effective role calculation
- Routes protected by both role and impersonation state

### Example 3: Dashboard Impersonation Detection (REFERENCE)

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/features/admin/Dashboard.tsx`

**The pattern:**

```typescript
// Lines 59-76: Check token for impersonation metadata
useEffect(() => {
  const token = localStorage.getItem("adminToken");
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.impersonating) {
        setImpersonating({...});
      }
    } catch (error) {
      console.error("Failed to decode JWT:", error);
    }
  }
}, []);

// Lines 215-221: Show banner during impersonation
{impersonating && (
  <ImpersonationBanner
    tenantName={impersonating.tenantName}
    tenantSlug={impersonating.tenantSlug}
    onStopImpersonation={() => setImpersonating(null)}
  />
)}
```

**Note:** This approach (parsing token directly) is okay for this dashboard because it's display-only. Prefer using `useAuth().isImpersonating()` in new code for type safety.

---

## Implementation Checklist

When implementing this pattern in your codebase:

- [ ] Add `isImpersonating()` method to AuthContext (if not present)
- [ ] Add `getEffectiveRole()` helper to AuthContext
- [ ] Review all components that check `user.role`
- [ ] Update components to use `effectiveRole` for UI decisions
- [ ] Add ImpersonationBanner to layouts that admin can impersonate from
- [ ] Add unit tests for impersonation scenarios
- [ ] Add E2E tests for full impersonation flow
- [ ] Update ProtectedRoute to handle impersonation
- [ ] Add to code review checklist
- [ ] Document in CLAUDE.md

---

## Summary

**The Bug:** Components checked only `user.role` and missed the impersonation state.

**The Fix:** Calculate `effectiveRole` that considers both role AND impersonation state.

**Key Pattern:**

```typescript
const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;
// Use effectiveRole for all authorization decisions
```

**Prevents Similar Bugs:** Any component that makes role-based decisions now uses effective role, preventing impersonation from being bypassed by role checks.
