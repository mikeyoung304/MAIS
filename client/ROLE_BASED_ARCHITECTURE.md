# Role-Based Dashboard Architecture

## Overview

This document describes the role-based authentication and dashboard selection system implemented for the MAIS business growth platform. The system supports two distinct user roles with separate dashboards and access patterns.

## User Roles

### PLATFORM_ADMIN

- **Purpose**: Full system administration
- **Access Level**: System-wide
- **Dashboard**: `/admin/dashboard` (PlatformAdminDashboard)
- **Capabilities**:
  - View all tenants in the system
  - Manage tenant accounts (create, update, deactivate)
  - System-wide statistics and analytics
  - Platform configuration
  - Commission management
  - NO access to tenant-specific content

### TENANT_ADMIN

- **Purpose**: Individual tenant business management
- **Access Level**: Single tenant only
- **Dashboard**: `/tenant/dashboard` (TenantAdminDashboard)
- **Capabilities**:
  - Manage their packages
  - View their bookings
  - Configure blackout dates
  - Customize branding
  - Upload photos
  - Tenant-specific settings
  - NO access to other tenants' data
  - NO access to platform-wide features

## Database Schema Changes

### User Model Updates

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String?
  passwordHash String
  role         UserRole @default(USER)
  tenantId     String?  // Links TENANT_ADMIN to their tenant
  tenant       Tenant?  @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
}

enum UserRole {
  USER
  ADMIN
  PLATFORM_ADMIN  // New: System administrators
  TENANT_ADMIN    // New: Tenant business owners
}
```

### Tenant Model Updates

```prisma
model Tenant {
  // ... existing fields ...
  users         User[] // Tenant admin users
  // ... other relations ...
}
```

## Authentication Flow

### Unified Login

1. User navigates to `/login`
2. Enters email and password
3. System attempts authentication
4. On success, stores JWT token and user data
5. Redirects based on role:
   - `PLATFORM_ADMIN` → `/admin/dashboard`
   - `TENANT_ADMIN` → `/tenant/dashboard`

### Token Storage

- **Token**: `localStorage.authToken`
- **User Data**: `localStorage.authUser` (JSON)
- **Legacy Support**: Old `adminToken` and `tenantToken` are cleared on logout

## Route Protection

### ProtectedRoute Component

Location: `/client/src/components/auth/ProtectedRoute.tsx`

```tsx
<ProtectedRoute allowedRoles={['PLATFORM_ADMIN']}>
  <PlatformAdminDashboard />
</ProtectedRoute>
```

**Behavior**:

- Checks if user is authenticated
- Validates user role against `allowedRoles`
- Redirects to `/login` if not authenticated
- Redirects to appropriate dashboard if wrong role

### Router Configuration

Location: `/client/src/router.tsx`

```tsx
// Platform Admin Routes
{
  path: "admin/dashboard",
  element: (
    <ProtectedSuspenseWrapper allowedRoles={["PLATFORM_ADMIN"]}>
      <PlatformAdminDashboard />
    </ProtectedSuspenseWrapper>
  ),
}

// Tenant Admin Routes
{
  path: "tenant/dashboard",
  element: (
    <ProtectedSuspenseWrapper allowedRoles={["TENANT_ADMIN"]}>
      <TenantAdminDashboard />
    </ProtectedSuspenseWrapper>
  ),
}
```

## AuthContext API

Location: `/client/src/contexts/AuthContext.tsx`

### State

```tsx
interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  tenantId?: string; // Only for TENANT_ADMIN
  tenantName?: string; // Only for TENANT_ADMIN
  tenantSlug?: string; // Only for TENANT_ADMIN
}
```

### Methods

- `login(token: string, user: AuthUser)` - Store auth data and set user
- `logout()` - Clear auth data and redirect to login
- `hasRole(role: UserRole)` - Check if user has specific role

### Usage

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, logout, hasRole } = useAuth();

  if (hasRole('PLATFORM_ADMIN')) {
    // Show platform admin features
  }

  return <button onClick={logout}>Logout</button>;
}
```

## Dashboard Components

### PlatformAdminDashboard

Location: `/client/src/pages/admin/PlatformAdminDashboard.tsx`

**Features**:

- System metrics cards (total tenants, bookings, revenue, commission)
- Tenants list with search
- Tenant management actions
- System-wide analytics
- NO tenant-specific content

**Key Metrics**:

- Total Tenants / Active Tenants
- Total Bookings (all tenants)
- Total Revenue (all tenants)
- Platform Commission

**API Endpoints** (to be implemented):

- `platformGetAllTenants()` - List all tenants with stats
- `platformGetStats()` - System-wide statistics

### TenantAdminDashboard

Location: `/client/src/pages/tenant/TenantAdminDashboard.tsx`

**Features**:

- Tenant metrics cards (packages, bookings, blackouts, branding)
- Tabbed interface:
  - Packages - Manage wedding packages
  - Bookings - View booking list
  - Blackouts - Manage blackout dates
  - Branding - Customize widget appearance
- Tenant isolation enforced

**Reuses Existing Components**:

- `TenantPackagesManager`
- `TenantBookingList`
- `BlackoutsManager`
- `BrandingEditor`

## Navigation

### RoleBasedNav Component

Location: `/client/src/components/navigation/RoleBasedNav.tsx`

**Platform Admin Navigation**:

- Dashboard - System overview
- Tenants - Manage all tenants
- System Settings - Platform configuration

**Tenant Admin Navigation**:

- Dashboard - Tenant overview
- Packages - Manage packages
- Bookings - View bookings
- Blackouts - Blackout dates
- Branding - Customize branding
- Settings - Tenant settings

**Variants**:

- `sidebar` - Vertical navigation with descriptions
- `horizontal` - Compact horizontal navigation

## Tenant Isolation

### Security Measures

1. **Database Level**:
   - All tenant data includes `tenantId` field
   - Unique constraints: `@@unique([tenantId, slug])`
   - Cascade deletes: `onDelete: Cascade`

2. **API Level** (to be implemented):
   - JWT token includes `tenantId` for TENANT_ADMIN
   - All queries filtered by `tenantId`
   - Authorization middleware validates tenant access

3. **Client Level**:
   - ProtectedRoute validates role
   - AuthContext provides tenant context
   - API calls include proper authorization headers

### Data Access Rules

**PLATFORM_ADMIN**:

- ✅ Can access all tenants
- ✅ Can view system-wide statistics
- ✅ Can manage tenant accounts
- ❌ Cannot access tenant-specific operational data

**TENANT_ADMIN**:

- ✅ Can access only their tenant data
- ✅ Can manage packages, bookings, settings for their tenant
- ❌ Cannot access other tenants' data
- ❌ Cannot access platform-wide features
- ❌ Cannot view or modify system settings

## Migration Path

### Legacy Support

The system maintains backward compatibility during migration:

1. **Old Routes**: Redirect to new structure
   - `/admin/login` → `/login`
   - `/tenant/login` → `/login`
   - `/admin` → `/admin/dashboard`

2. **Token Cleanup**: Old tokens cleared on logout
   - `adminToken` (legacy)
   - `tenantToken` (legacy)

3. **Existing Login**: Current `/login` page already implements dual auth
   - Tries admin login first
   - Falls back to tenant login
   - This will be replaced with unified endpoint

## API Updates Required

### Server-Side Implementation

1. **Unified Login Endpoint**:

   ```typescript
   POST /v1/auth/login
   Body: { email, password }
   Response: { token, user: AuthUser }
   ```

2. **Platform Admin Endpoints**:

   ```typescript
   GET /v1/platform/tenants - List all tenants
   GET /v1/platform/stats - System statistics
   POST /v1/platform/tenants - Create tenant
   PUT /v1/platform/tenants/:id - Update tenant
   ```

3. **Authorization Middleware**:
   - Extract role from JWT token
   - Validate route access by role
   - Inject tenantId for TENANT_ADMIN requests

## File Structure

```
client/src/
├── contexts/
│   └── AuthContext.tsx              # Global auth state
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.tsx       # Route protection
│   └── navigation/
│       └── RoleBasedNav.tsx         # Role-based navigation
├── pages/
│   ├── Login.tsx                    # Unified login
│   ├── admin/
│   │   └── PlatformAdminDashboard.tsx
│   └── tenant/
│       └── TenantAdminDashboard.tsx
├── features/
│   ├── admin/
│   │   └── Dashboard.tsx            # Legacy admin dashboard
│   └── tenant-admin/
│       ├── TenantDashboard.tsx      # Tenant dashboard component
│       ├── TenantPackagesManager.tsx
│       ├── TenantBookingList.tsx
│       ├── BlackoutsManager.tsx
│       └── BrandingEditor.tsx
└── router.tsx                       # Route configuration
```

## Testing Checklist

### Authentication

- [ ] Login as PLATFORM_ADMIN redirects to `/admin/dashboard`
- [ ] Login as TENANT_ADMIN redirects to `/tenant/dashboard`
- [ ] Invalid credentials show error
- [ ] Logout clears all tokens

### Route Protection

- [ ] PLATFORM_ADMIN can access `/admin/dashboard`
- [ ] PLATFORM_ADMIN cannot access `/tenant/dashboard`
- [ ] TENANT_ADMIN can access `/tenant/dashboard`
- [ ] TENANT_ADMIN cannot access `/admin/dashboard`
- [ ] Unauthenticated users redirect to `/login`

### Tenant Isolation

- [ ] TENANT_ADMIN only sees their packages
- [ ] TENANT_ADMIN only sees their bookings
- [ ] TENANT_ADMIN cannot access other tenants' data
- [ ] API enforces tenantId filtering

### Navigation

- [ ] PLATFORM_ADMIN sees system-wide navigation
- [ ] TENANT_ADMIN sees tenant-specific navigation
- [ ] Navigation items match role permissions

## Future Enhancements

1. **Multi-Tenant Admin Support**:
   - Allow TENANT_ADMIN to have multiple staff accounts
   - Role hierarchy: Owner > Manager > Staff

2. **Granular Permissions**:
   - Fine-grained permissions within roles
   - Permission groups (can_view_bookings, can_edit_packages, etc.)

3. **Audit Logging**:
   - Track PLATFORM_ADMIN actions
   - Log tenant data access

4. **Session Management**:
   - Token expiration and refresh
   - Multi-device session tracking
   - Force logout capability

## Support

For questions or issues with the role-based architecture:

1. Check this documentation
2. Review the implementation in source files
3. Test with the provided test checklist
4. Verify database migrations are applied
