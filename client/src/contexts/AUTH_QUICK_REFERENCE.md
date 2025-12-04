# AuthContext Quick Reference

Quick reference guide for common authentication patterns in the MAIS application.

## Import

```tsx
import { useAuth } from '@/contexts/AuthContext';
```

## Common Patterns

### 1. Check if User is Logged In

```tsx
const { isAuthenticated } = useAuth();

if (isAuthenticated) {
  // User is logged in
}
```

### 2. Get Current User Info

```tsx
const { user, role, tenantId } = useAuth();

console.log(user?.email); // User email
console.log(role); // 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | null
console.log(tenantId); // Tenant ID (only for tenant admins)
```

### 3. Login

```tsx
const { login } = useAuth();

// Platform Admin Login
await login('admin@example.com', 'password', 'PLATFORM_ADMIN');

// Tenant Admin Login
await login('tenant@example.com', 'password', 'TENANT_ADMIN');
```

### 4. Logout

```tsx
const { logout } = useAuth();

logout(); // Clears all auth state
```

### 5. Check User Role

```tsx
const { isPlatformAdmin, isTenantAdmin, hasRole } = useAuth();

// Method 1: Use helper methods
if (isPlatformAdmin()) {
  // Platform admin specific code
}

if (isTenantAdmin()) {
  // Tenant admin specific code
}

// Method 2: Use hasRole
if (hasRole('PLATFORM_ADMIN')) {
  // Platform admin specific code
}
```

### 6. Conditional Rendering Based on Role

```tsx
const { isPlatformAdmin, isTenantAdmin } = useAuth();

return (
  <div>
    {isPlatformAdmin() && <PlatformAdminPanel />}
    {isTenantAdmin() && <TenantAdminPanel />}
  </div>
);
```

### 7. Protected Route Component

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

function ProtectedPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return <div>Protected content</div>;
}
```

### 8. Login Form Example

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await login(email, password, 'TENANT_ADMIN');
      navigate('/tenant/dashboard');
    } catch (err) {
      setError('Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p>{error}</p>}
      <button type="submit">Login</button>
    </form>
  );
}
```

### 9. Navigation with Auth Status

```tsx
const { isAuthenticated, user, logout } = useAuth();

return (
  <nav>
    {!isAuthenticated ? (
      <a href="/login">Login</a>
    ) : (
      <>
        <span>Welcome, {user?.email}</span>
        <button onClick={logout}>Logout</button>
      </>
    )}
  </nav>
);
```

### 10. Show Loading State

```tsx
const { isLoading, user } = useAuth();

if (isLoading) {
  return <div>Loading user data...</div>;
}

return <div>Welcome, {user?.email}</div>;
```

## API Quick Reference

| Property/Method     | Type                                         | Description                        |
| ------------------- | -------------------------------------------- | ---------------------------------- |
| `user`              | `User \| null`                               | Current user object                |
| `role`              | `'PLATFORM_ADMIN' \| 'TENANT_ADMIN' \| null` | Current user role                  |
| `tenantId`          | `string \| null`                             | Tenant ID (tenant admins only)     |
| `token`             | `string \| null`                             | JWT token                          |
| `isAuthenticated`   | `boolean`                                    | True if user is logged in          |
| `isLoading`         | `boolean`                                    | True during initial auth check     |
| `login()`           | `(email, password, role) => Promise<void>`   | Login method                       |
| `logout()`          | `() => void`                                 | Logout method                      |
| `isPlatformAdmin()` | `() => boolean`                              | Check if platform admin            |
| `isTenantAdmin()`   | `() => boolean`                              | Check if tenant admin              |
| `hasRole()`         | `(role: UserRole) => boolean`                | Check specific role                |
| `refreshAuth()`     | `() => void`                                 | Manually refresh auth from storage |

## User Object Types

### Platform Admin User

```typescript
{
  id: string;
  email: string;
  role: 'PLATFORM_ADMIN';
}
```

### Tenant Admin User

```typescript
{
  tenantId: string;
  slug: string;
  email: string;
  role: 'TENANT_ADMIN';
}
```

## Common Errors

### "useAuth must be used within AuthProvider"

You're using `useAuth()` outside the `AuthProvider` wrapper. Make sure your component is rendered inside `<AuthProvider>`.

### Token Expired

The AuthContext automatically handles token expiration. Users are logged out when their token expires.

### Wrong Role

If login succeeds but user gets wrong role, verify you're passing the correct role to the `login()` method.

## Related Documentation

- [Full Documentation](./AUTH_CONTEXT_USAGE.md)
- Type Definitions: `/client/src/types/auth.ts`
- JWT Utils: `/client/src/lib/auth.ts`
