# Impersonation: Quick Reference for Developers

## The Rule

When a platform admin impersonates a tenant, they should be treated as `TENANT_ADMIN` for UI/permissions, even though their JWT says `PLATFORM_ADMIN`.

## The Pattern

```typescript
// ✅ DO THIS
const { user, isImpersonating } = useAuth();
const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;

// ❌ DON'T DO THIS
const { user } = useAuth();
if (user.role === 'PLATFORM_ADMIN') { ... }  // Ignores impersonation!
```

## Checklist for Role-Based Components

Before committing code that checks `user.role`:

- [ ] Component imports `isImpersonating` from useAuth
- [ ] Component calculates `effectiveRole` (not using raw `user.role`)
- [ ] All role checks use `effectiveRole`
- [ ] Admin-only features are hidden when impersonating
- [ ] Tests include impersonation scenarios

## Code Example

### Before (Buggy)

```typescript
export function RoleBasedNav() {
  const { user } = useAuth();

  const navItems = user.role === 'PLATFORM_ADMIN'
    ? adminNav
    : tenantNav;  // ❌ Shows admin nav even when impersonating!
```

### After (Fixed)

```typescript
export function RoleBasedNav() {
  const { user, isImpersonating } = useAuth();

  const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;
  const navItems = effectiveRole === 'PLATFORM_ADMIN'
    ? adminNav
    : tenantNav;  // ✅ Correctly shows tenant nav when impersonating
```

## Testing Impersonation

**Unit test**:

```typescript
it('shows tenant nav when impersonating', () => {
  const { getByText } = render(
    <AuthContext.Provider value={{
      user: { role: 'PLATFORM_ADMIN' },
      isImpersonating: () => true,
      impersonation: { tenantId: '123', ... }
    }}>
      <RoleBasedNav />
    </AuthContext.Provider>
  );

  expect(getByText('Tenant overview')).toBeInTheDocument();
});
```

**E2E test**:

```typescript
test('admin impersonation shows tenant nav', async ({ page }) => {
  // Login as admin
  // Click "Sign in as Tenant"
  // Verify nav shows tenant items, not admin items
});
```

## Key Files

| File                                                | Purpose                                    |
| --------------------------------------------------- | ------------------------------------------ |
| `client/src/contexts/AuthContext/AuthProvider.tsx`  | Provides `isImpersonating()` helper        |
| `client/src/contexts/AuthContext/services.ts`       | Auth state restoration from localStorage   |
| `client/src/components/navigation/RoleBasedNav.tsx` | Example of fixed role-based component      |
| `client/src/components/auth/ProtectedRoute.tsx`     | Multi-layer protection with effective role |
| `server/test/routes/auth-impersonation.spec.ts`     | Backend impersonation tests                |

## Common Mistakes

| Mistake                         | Impact                               | Fix                                    |
| ------------------------------- | ------------------------------------ | -------------------------------------- |
| Check only `user.role`          | Admin nav visible when impersonating | Add `isImpersonating()` check          |
| Not calculating `effectiveRole` | Duplicate role checks everywhere     | Use single `const effectiveRole = ...` |
| Direct token parsing            | Type unsafe, duplicated logic        | Use `useAuth().isImpersonating()`      |
| Missing tests for impersonation | Bug remains undetected               | Add E2E test for full flow             |
| No ImpersonationBanner visible  | Confusing UX                         | Display banner during impersonation    |

## When You Need to Check Role

### For Navigation/UI

```typescript
// Calculate effective role ONCE at component level
const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;

// Use effective role for all decisions in that component
if (effectiveRole === 'PLATFORM_ADMIN') { ... }
if (effectiveRole === 'TENANT_ADMIN') { ... }
```

### For Admin Features

```typescript
// Check ACTUAL role (not effective) when hiding admin-only features
const canAccessAdminFeatures = user.role === 'PLATFORM_ADMIN' && !isImpersonating();
```

### For Data Queries

```typescript
// Backend already filters by tenantId from middleware
// No special logic needed - backend handles impersonation context
```

## Red Flags in Code Review

When you see these, ask about impersonation handling:

- ✋ `user.role ===` without nearby `isImpersonating()` check
- ✋ Role checks in multiple nested components (should be at top level)
- ✋ Admin controls not explicitly hidden during impersonation
- ✋ No tests for impersonation scenarios
- ✋ Direct token parsing instead of using `useAuth()` context

## Debug Checklist

If impersonation isn't working:

1. Verify token has `impersonating` field: `token.split('.')[1] |> btoa |> JSON.parse`
2. Check `isImpersonating()` returns true: `console { useAuth().isImpersonating() }`
3. Verify `effectiveRole` is calculated: `console { effectiveRole }`
4. Ensure ProtectedRoute allows the route: Check `allowedRoles` includes effective role
5. Clear browser cache: `localStorage.clear()` then re-login

## Reference

Full guide: `docs/prevention-strategies/IMPERSONATION_NAVIGATION_BUG_PREVENTION.md`

Architecture details: `ARCHITECTURE.md` (search for "impersonation")

Backend tests: `server/test/routes/auth-impersonation.spec.ts`
