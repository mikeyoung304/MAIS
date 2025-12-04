# Migration Guide: Using the New AuthContext

This guide helps you migrate existing login pages and authentication logic to use the new unified AuthContext.

## Overview

The new AuthContext provides:

- Unified authentication for both Platform Admins and Tenant Admins
- Automatic JWT token management
- Role-based access control
- Type-safe user state

## Before (Old Pattern)

### Old Admin Login

```tsx
// OLD - pages/AdminLogin.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export function AdminLogin() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await api.adminLogin({
        body: { email, password },
      });

      if (result.status === 200) {
        // Manual token storage
        localStorage.setItem('adminToken', result.body.token);
        navigate('/admin');
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Login onLogin={handleLogin} error={error} isLoading={isLoading} />
    </div>
  );
}
```

### Old Tenant Login

```tsx
// OLD - pages/TenantLogin.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export function TenantLogin() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Manual check for existing token
    const token = localStorage.getItem('tenantToken');
    if (token) {
      navigate('/tenant/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await api.tenantLogin({
        body: { email, password },
      });

      if (result.status === 200) {
        // Manual token storage
        (api as any).setTenantToken(result.body.token);
        navigate('/tenant/dashboard');
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <TenantLoginComponent onLogin={handleLogin} error={error} isLoading={isLoading} />
    </div>
  );
}
```

## After (New Pattern with AuthContext)

### New Unified Login Page

```tsx
// NEW - pages/Login.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/contexts/AuthContext';

export function Login() {
  const {
    login,
    isAuthenticated,
    isPlatformAdmin,
    isTenantAdmin,
    isLoading: authLoading,
  } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('TENANT_ADMIN');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      if (isPlatformAdmin()) {
        navigate('/admin');
      } else if (isTenantAdmin()) {
        navigate('/tenant/dashboard');
      }
    }
  }, [isAuthenticated, isPlatformAdmin, isTenantAdmin, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // AuthContext handles token storage and state management
      await login(email, password, role);

      // Redirect based on role
      if (role === 'PLATFORM_ADMIN') {
        navigate('/admin');
      } else {
        navigate('/tenant/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-center">Sign In</h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="role" className="block text-sm font-medium">
              Account Type
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
            >
              <option value="TENANT_ADMIN">Tenant Admin</option>
              <option value="PLATFORM_ADMIN">Platform Admin</option>
            </select>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border rounded-md"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

## Key Changes

### 1. Import AuthContext

```tsx
// Before
import { api } from '../lib/api';

// After
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/contexts/AuthContext';
```

### 2. Use AuthContext Hook

```tsx
// Before
const navigate = useNavigate();
const [error, setError] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(false);

// After
const { login, isAuthenticated, isPlatformAdmin, isTenantAdmin, isLoading } = useAuth();
const navigate = useNavigate();
const [error, setError] = useState<string | null>(null);
const [isSubmitting, setIsSubmitting] = useState(false);
```

### 3. Simplified Login Logic

```tsx
// Before
const result = await api.adminLogin({
  body: { email, password },
});

if (result.status === 200) {
  localStorage.setItem('adminToken', result.body.token);
  navigate('/admin');
}

// After
await login(email, password, role);
navigate(role === 'PLATFORM_ADMIN' ? '/admin' : '/tenant/dashboard');
```

### 4. Auto-Redirect if Already Authenticated

```tsx
// Before - Manual check
useEffect(() => {
  const token = localStorage.getItem('tenantToken');
  if (token) {
    navigate('/tenant/dashboard');
  }
}, [navigate]);

// After - AuthContext handles it
useEffect(() => {
  if (!isLoading && isAuthenticated) {
    if (isPlatformAdmin()) {
      navigate('/admin');
    } else if (isTenantAdmin()) {
      navigate('/tenant/dashboard');
    }
  }
}, [isAuthenticated, isPlatformAdmin, isTenantAdmin, isLoading, navigate]);
```

## Updating Protected Routes

### Before

```tsx
// Manual auth check in component
export function Admin() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  // Component logic
}
```

### After

```tsx
// Use ProtectedRoute component
import { ProtectedRoute } from "@/components/ProtectedRoute";

// In router.tsx
{
  path: "admin",
  element: (
    <ProtectedRoute requiredRole="PLATFORM_ADMIN">
      <Admin />
    </ProtectedRoute>
  ),
}
```

Or use the auth hook:

```tsx
import { useAuth } from '@/contexts/AuthContext';

export function Admin() {
  const { isAuthenticated, isPlatformAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        navigate('/login');
      } else if (!isPlatformAdmin()) {
        navigate('/tenant/dashboard');
      }
    }
  }, [isAuthenticated, isPlatformAdmin, isLoading, navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Component logic
}
```

## Updating Navigation

### Before

```tsx
// Manual auth check
const token = localStorage.getItem('adminToken');

return (
  <nav>
    {!token && <a href="/admin/login">Login</a>}
    {token && <button onClick={handleLogout}>Logout</button>}
  </nav>
);
```

### After

```tsx
import { useAuth } from '@/contexts/AuthContext';

export function Navigation() {
  const { isAuthenticated, user, isPlatformAdmin, isTenantAdmin, logout } = useAuth();

  return (
    <nav>
      {!isAuthenticated && <a href="/login">Login</a>}

      {isAuthenticated && (
        <>
          <span>Welcome, {user?.email}</span>

          {isPlatformAdmin() && <a href="/admin">Admin Dashboard</a>}

          {isTenantAdmin() && <a href="/tenant/dashboard">Dashboard</a>}

          <button onClick={logout}>Logout</button>
        </>
      )}
    </nav>
  );
}
```

## Updating Logout Logic

### Before

```tsx
const handleLogout = () => {
  localStorage.removeItem('adminToken');
  navigate('/admin/login');
};
```

### After

```tsx
import { useAuth } from '@/contexts/AuthContext';

const { logout } = useAuth();

// Just call logout - it handles everything
const handleLogout = () => {
  logout();
  navigate('/login');
};
```

## Benefits of Migration

1. **Centralized Auth Logic** - All auth logic in one place
2. **Type Safety** - Full TypeScript support with proper types
3. **Automatic Token Management** - No manual localStorage handling
4. **Role-Based Access** - Built-in role checking methods
5. **Token Expiration** - Automatic logout on expired tokens
6. **Better DX** - Cleaner, more maintainable code

## Migration Checklist

- [ ] Update imports to use `useAuth` hook
- [ ] Replace manual `localStorage` calls with AuthContext methods
- [ ] Replace direct API calls with `login()` method
- [ ] Update logout logic to use `logout()` method
- [ ] Add role-based redirects using `isPlatformAdmin()` / `isTenantAdmin()`
- [ ] Handle loading states with `isLoading` property
- [ ] Update protected routes to use `ProtectedRoute` or auth checks
- [ ] Test login flow for both roles
- [ ] Test logout flow
- [ ] Test auto-redirect for already authenticated users

## Troubleshooting

### Login not redirecting

Make sure you're checking both `isLoading` and `isAuthenticated`:

```tsx
useEffect(() => {
  if (!isLoading && isAuthenticated) {
    // Redirect logic
  }
}, [isLoading, isAuthenticated]);
```

### Can't access user data

Check if user is authenticated first:

```tsx
const { user, isAuthenticated } = useAuth();

if (isAuthenticated && user) {
  console.log(user.email);
}
```

### Wrong role after login

Verify you're passing the correct role to the login method:

```tsx
await login(email, password, 'PLATFORM_ADMIN'); // or 'TENANT_ADMIN'
```

## Additional Resources

- [Full Usage Guide](./AUTH_CONTEXT_USAGE.md)
- [Quick Reference](./AUTH_QUICK_REFERENCE.md)
- [Type Definitions](/client/src/types/auth.ts)
