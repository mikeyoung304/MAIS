# AuthContext Usage Guide

Complete guide for using the unified AuthContext with role-based access control in the MAIS application.

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [API Reference](#api-reference)
4. [Usage Examples](#usage-examples)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Overview

The AuthContext provides a unified authentication system supporting both Platform Admins and Tenant Admins with:

- JWT token management (decode, validate, store)
- Role-based access control
- Automatic token refresh from localStorage
- Auto-logout on token expiration
- Type-safe user state management

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AppShell                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              AuthProvider                              │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │           All Routes & Components                 │ │  │
│  │  │   - Can access useAuth() hook                     │ │  │
│  │  │   - Role-based routing                            │ │  │
│  │  │   - Auto token validation                         │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Getting Started

### 1. Basic Setup (Already Configured)

The AuthProvider is already wrapped around the app in `AppShell.tsx`:

```tsx
import { AuthProvider } from '@/contexts/AuthContext';

export function AppShell() {
  return (
    <AuthProvider>
      <div>{/* Your app content */}</div>
    </AuthProvider>
  );
}
```

### 2. Using the Auth Hook

Import and use the `useAuth` hook in any component:

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, isPlatformAdmin, logout } = useAuth();

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <p>Welcome, {user.email}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

## API Reference

### AuthContextType Interface

```typescript
interface AuthContextType {
  // State
  user: User | null;
  role: 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | null;
  tenantId: string | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Methods
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
  isPlatformAdmin: () => boolean;
  isTenantAdmin: () => boolean;
  hasRole: (role: UserRole) => boolean;
  refreshAuth: () => void;
}
```

### User Types

```typescript
// Platform Admin User
interface PlatformAdminUser {
  id: string;
  email: string;
  role: 'PLATFORM_ADMIN';
}

// Tenant Admin User
interface TenantAdminUser {
  tenantId: string;
  slug: string;
  email: string;
  role: 'TENANT_ADMIN';
}

type User = PlatformAdminUser | TenantAdminUser;
```

### Methods

#### `login(email, password, role)`

Authenticates user and stores JWT token.

```typescript
await login(email: string, password: string, role: UserRole): Promise<void>
```

**Parameters:**

- `email` (string): User's email address
- `password` (string): User's password
- `role` (UserRole): Either 'PLATFORM_ADMIN' or 'TENANT_ADMIN'

**Throws:**

- Error with message if login fails

**Example:**

```tsx
try {
  await login('admin@example.com', 'password123', 'PLATFORM_ADMIN');
  navigate('/admin');
} catch (error) {
  setError(error.message);
}
```

#### `logout()`

Clears all authentication state and tokens.

```typescript
logout(): void
```

**Example:**

```tsx
<button onClick={logout}>Logout</button>
```

#### `isPlatformAdmin()`

Returns true if current user is a platform admin.

```typescript
isPlatformAdmin(): boolean
```

**Example:**

```tsx
if (isPlatformAdmin()) {
  return <PlatformAdminDashboard />;
}
```

#### `isTenantAdmin()`

Returns true if current user is a tenant admin.

```typescript
isTenantAdmin(): boolean
```

**Example:**

```tsx
if (isTenantAdmin()) {
  return <TenantDashboard tenantId={tenantId} />;
}
```

#### `hasRole(role)`

Returns true if current user has the specified role.

```typescript
hasRole(role: UserRole): boolean
```

**Example:**

```tsx
if (hasRole('TENANT_ADMIN')) {
  // Show tenant-specific features
}
```

#### `refreshAuth()`

Manually refresh authentication state from localStorage.

```typescript
refreshAuth(): void
```

**Example:**

```tsx
useEffect(() => {
  refreshAuth();
}, []);
```

---

## Usage Examples

### Example 1: Login Page

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'PLATFORM_ADMIN' | 'TENANT_ADMIN'>('TENANT_ADMIN');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password, role);

      // Redirect based on role
      if (role === 'PLATFORM_ADMIN') {
        navigate('/admin');
      } else {
        navigate('/tenant/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>Login</h1>

      <div>
        <label>Role:</label>
        <select value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="TENANT_ADMIN">Tenant Admin</option>
          <option value="PLATFORM_ADMIN">Platform Admin</option>
        </select>
      </div>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="error">{error}</p>}

      <button type="submit">Login</button>
    </form>
  );
}
```

### Example 2: Protected Route

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'PLATFORM_ADMIN' | 'TENANT_ADMIN';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, hasRole, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (requiredRole && !hasRole(requiredRole)) {
      navigate('/unauthorized');
    }
  }, [isAuthenticated, hasRole, requiredRole, isLoading, navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return null;
  }

  return <>{children}</>;
}
```

### Example 3: Role-Based UI

```tsx
import { useAuth } from '@/contexts/AuthContext';

export function Dashboard() {
  const { user, role, isPlatformAdmin, isTenantAdmin, tenantId } = useAuth();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user?.email}</p>

      {isPlatformAdmin() && (
        <div>
          <h2>Platform Admin Features</h2>
          <ul>
            <li>
              <a href="/admin/tenants">Manage Tenants</a>
            </li>
            <li>
              <a href="/admin/users">Manage Users</a>
            </li>
            <li>
              <a href="/admin/settings">Platform Settings</a>
            </li>
          </ul>
        </div>
      )}

      {isTenantAdmin() && (
        <div>
          <h2>Tenant Admin Features</h2>
          <p>Tenant ID: {tenantId}</p>
          <ul>
            <li>
              <a href="/tenant/dashboard">Dashboard</a>
            </li>
            <li>
              <a href="/tenant/bookings">Bookings</a>
            </li>
            <li>
              <a href="/tenant/settings">Settings</a>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
```

### Example 4: Navigation with Auth

```tsx
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

export function Navigation() {
  const { isAuthenticated, isPlatformAdmin, isTenantAdmin, logout } = useAuth();

  return (
    <nav>
      <Link to="/">Home</Link>

      {!isAuthenticated && <Link to="/login">Login</Link>}

      {isAuthenticated && (
        <>
          {isPlatformAdmin() && <Link to="/admin">Admin Dashboard</Link>}

          {isTenantAdmin() && <Link to="/tenant/dashboard">Dashboard</Link>}

          <button onClick={logout}>Logout</button>
        </>
      )}
    </nav>
  );
}
```

### Example 5: Auto-Redirect After Login

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function LoginPage() {
  const { isAuthenticated, isPlatformAdmin, isTenantAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      if (isPlatformAdmin()) {
        navigate('/admin');
      } else if (isTenantAdmin()) {
        navigate('/tenant/dashboard');
      }
    }
  }, [isAuthenticated, isPlatformAdmin, isTenantAdmin, isLoading, navigate]);

  // ... rest of login page
}
```

---

## Best Practices

### 1. Always Check Loading State

```tsx
const { user, isLoading } = useAuth();

if (isLoading) {
  return <LoadingSpinner />;
}

// Now safe to use user
```

### 2. Handle Errors Gracefully

```tsx
try {
  await login(email, password, role);
} catch (error) {
  if (error instanceof Error) {
    setError(error.message);
  } else {
    setError('An unexpected error occurred');
  }
}
```

### 3. Use Role Guards for UI

```tsx
// Good
{
  isPlatformAdmin() && <AdminPanel />;
}

// Avoid
{
  role === 'PLATFORM_ADMIN' && <AdminPanel />;
}
```

### 4. Logout on Critical Errors

```tsx
try {
  const result = await api.criticalOperation();
} catch (error) {
  if (error.status === 401) {
    logout();
    navigate('/login');
  }
}
```

### 5. Type-Safe User Access

```tsx
const { user } = useAuth();

// Safe access with type narrowing
if (user?.role === 'TENANT_ADMIN') {
  console.log(user.tenantId); // TypeScript knows this exists
}
```

---

## Troubleshooting

### Problem: "useAuth must be used within AuthProvider"

**Solution:** Ensure the component is rendered inside the `AuthProvider` wrapper.

### Problem: Token expires too quickly

**Solution:** The token expiration is set on the backend (7 days by default). The frontend automatically checks for expiration every 60 seconds and logs out expired users.

### Problem: User state not persisting after refresh

**Solution:** The AuthContext automatically restores state from localStorage. Ensure localStorage is not being cleared by browser extensions or settings.

### Problem: Can't access tenantId for platform admin

**Solution:** `tenantId` is only available for tenant admins. Check the role before accessing:

```tsx
if (isTenantAdmin() && tenantId) {
  // Safe to use tenantId
}
```

### Problem: Login succeeds but user is null

**Solution:** This might be a token decoding issue. Check browser console for JWT decode errors and ensure the token format matches the backend payload.

---

## JWT Token Structure

### Platform Admin Token Payload

```json
{
  "userId": "123",
  "email": "admin@example.com",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Tenant Admin Token Payload

```json
{
  "tenantId": "tenant-123",
  "slug": "wedding-co",
  "email": "admin@wedding.com",
  "type": "tenant",
  "iat": 1234567890,
  "exp": 1234567890
}
```

---

## Related Files

- `/client/src/contexts/AuthContext.tsx` - Main context implementation
- `/client/src/lib/auth.ts` - JWT utilities
- `/client/src/types/auth.ts` - TypeScript type definitions
- `/server/src/lib/ports.ts` - Backend token payload definitions

---

## Support

For issues or questions, refer to:

1. This documentation
2. TypeScript type definitions in `/client/src/types/auth.ts`
3. Backend API documentation
4. Team documentation in `/docs`
