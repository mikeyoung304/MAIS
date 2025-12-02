# Authentication Context Implementation

This directory contains the unified authentication context for the MAIS application with role-based access control.

## Files

### Core Implementation

- **AuthContext.tsx** - Main authentication context with React hooks
  - Manages user authentication state
  - Handles JWT token storage and validation
  - Provides role-based access control methods
  - Auto-refreshes auth state on mount
  - Periodically checks token expiration

### Documentation

- **AUTH_CONTEXT_USAGE.md** - Complete usage guide with examples
- **AUTH_QUICK_REFERENCE.md** - Quick reference for common patterns
- **README.md** - This file

## Related Files

### Type Definitions

- `/client/src/types/auth.ts` - TypeScript interfaces and types

### Utilities

- `/client/src/lib/auth.ts` - JWT decode, validation, and token management utilities

### Backend

- `/server/src/lib/ports.ts` - Backend token payload interfaces
- `/server/src/services/identity.service.ts` - Platform admin authentication
- `/server/src/services/tenant-auth.service.ts` - Tenant admin authentication

## Quick Start

### 1. Use the Hook

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();
  // ... your component logic
}
```

### 2. Login

```tsx
// Platform Admin
await login('admin@example.com', 'password', 'PLATFORM_ADMIN');

// Tenant Admin
await login('tenant@example.com', 'password', 'TENANT_ADMIN');
```

### 3. Check Role

```tsx
const { isPlatformAdmin, isTenantAdmin } = useAuth();

if (isPlatformAdmin()) {
  // Platform admin logic
}

if (isTenantAdmin()) {
  // Tenant admin logic
}
```

## Features

### Token Management

- JWT tokens stored in localStorage
- Separate storage keys for platform and tenant admins
- Automatic token validation on mount
- Auto-logout on token expiration (checked every 60 seconds)

### Role-Based Access Control

- Two roles: `PLATFORM_ADMIN` and `TENANT_ADMIN`
- Type-safe user objects with role-specific fields
- Helper methods for role checking
- Automatic role validation during login

### Security

- JWT signature validation happens on backend
- Frontend only decodes tokens (no signature verification)
- Tokens expire after 7 days (configured on backend)
- Secure localStorage practices
- Clear all auth state on logout

### Type Safety

- Full TypeScript support
- Union types for different user types
- Type guards for role-specific fields
- Inferred types from backend contracts

## API Overview

| Property/Method      | Description                        |
| -------------------- | ---------------------------------- |
| `user`               | Current user object                |
| `role`               | Current user role                  |
| `tenantId`           | Tenant ID (tenant admins only)     |
| `token`              | JWT token                          |
| `isAuthenticated`    | True if user is logged in          |
| `isLoading`          | True during initial auth check     |
| `login()`            | Login method                       |
| `logout()`           | Logout method                      |
| `isPlatformAdmin()`  | Check if platform admin            |
| `isTenantAdmin()`    | Check if tenant admin              |
| `hasRole()`          | Check specific role                |
| `refreshAuth()`      | Manually refresh auth state        |

## Architecture

```
┌─────────────────────────────────────────────┐
│              main.tsx                        │
│  ┌───────────────────────────────────────┐  │
│  │     QueryClientProvider                │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │      AuthProvider                │  │  │
│  │  │  ┌───────────────────────────┐  │  │  │
│  │  │  │    RouterProvider          │  │  │  │
│  │  │  │  ┌─────────────────────┐  │  │  │  │
│  │  │  │  │     AppShell         │  │  │  │  │
│  │  │  │  │  ┌───────────────┐  │  │  │  │  │
│  │  │  │  │  │   Routes       │  │  │  │  │  │
│  │  │  │  │  │   Components   │  │  │  │  │  │
│  │  │  │  │  │   Can use      │  │  │  │  │  │
│  │  │  │  │  │   useAuth()    │  │  │  │  │  │
│  │  │  │  │  └───────────────┘  │  │  │  │  │
│  │  │  │  └─────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────┘  │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Token Payload Structures

### Platform Admin Token

```json
{
  "userId": "user-123",
  "email": "admin@example.com",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Tenant Admin Token

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

## User Object Structures

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

## Storage Keys

- `adminToken` - Platform admin JWT token
- `tenantToken` - Tenant admin JWT token

## Best Practices

1. **Always check `isLoading`** before rendering auth-dependent UI
2. **Use helper methods** (`isPlatformAdmin()`, `isTenantAdmin()`) instead of direct role comparison
3. **Handle errors** from the `login()` method
4. **Clear sensitive data** on logout
5. **Use TypeScript** for type safety
6. **Wrap protected routes** with authentication checks

## Common Patterns

See [AUTH_QUICK_REFERENCE.md](./AUTH_QUICK_REFERENCE.md) for common usage patterns.

## Full Documentation

See [AUTH_CONTEXT_USAGE.md](./AUTH_CONTEXT_USAGE.md) for complete documentation with detailed examples.

## Support

For questions or issues:

1. Check the documentation files in this directory
2. Review TypeScript types in `/client/src/types/auth.ts`
3. Consult the backend API documentation
4. Check the team documentation in `/docs`
