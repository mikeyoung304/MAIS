# Role-Based Dashboard - Quick Reference

## User Roles Summary

| Role               | Dashboard           | Access Level  | Key Features                                      |
| ------------------ | ------------------- | ------------- | ------------------------------------------------- |
| **PLATFORM_ADMIN** | `/admin/dashboard`  | System-wide   | Manage all tenants, system stats, platform config |
| **TENANT_ADMIN**   | `/tenant/dashboard` | Single tenant | Packages, bookings, branding, blackouts           |

## Routes

### Public Routes

- `/` - Home (package catalog)
- `/login` - Unified login for both roles
- `/package/:slug` - Package details
- `/success` - Booking success

### Protected Routes - Platform Admin Only

- `/admin/dashboard` - Platform admin dashboard
- `/admin/tenants` - Tenant management
- `/admin/settings` - System settings

### Protected Routes - Tenant Admin Only

- `/tenant/dashboard` - Tenant dashboard
- `/tenant/packages` - Package management
- `/tenant/bookings` - Booking list
- `/tenant/blackouts` - Blackout dates
- `/tenant/branding` - Branding customization
- `/tenant/settings` - Tenant settings

### Legacy Redirects

- `/admin/login` → `/login`
- `/tenant/login` → `/login`
- `/admin` → `/admin/dashboard`

## Components

### Authentication

```tsx
// AuthContext Hook
import { useAuth } from '@/contexts/AuthContext';

const { user, login, logout, hasRole } = useAuth();

// Check role
if (hasRole('PLATFORM_ADMIN')) {
  // Platform admin features
}

// Logout
<button onClick={logout}>Logout</button>;
```

### Route Protection

```tsx
// In router.tsx
<ProtectedSuspenseWrapper allowedRoles={['PLATFORM_ADMIN']}>
  <PlatformAdminDashboard />
</ProtectedSuspenseWrapper>
```

### Navigation

```tsx
// Role-based navigation
import { RoleBasedNav } from "@/components/navigation/RoleBasedNav";

// Sidebar variant
<RoleBasedNav variant="sidebar" />

// Horizontal variant
<RoleBasedNav variant="horizontal" />
```

## Database Schema

### User Model

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  role         UserRole @default(USER)
  tenantId     String?  // Only for TENANT_ADMIN
  tenant       Tenant?
}

enum UserRole {
  USER
  ADMIN
  PLATFORM_ADMIN
  TENANT_ADMIN
}
```

## API Endpoints (To Implement)

### Authentication

```typescript
POST /v1/auth/login
{
  email: string
  password: string
}
→ {
  token: string
  user: {
    id: string
    email: string
    role: "PLATFORM_ADMIN" | "TENANT_ADMIN"
    tenantId?: string
    tenantName?: string
    tenantSlug?: string
  }
}
```

### Platform Admin Endpoints

```typescript
GET  /v1/platform/tenants      // List all tenants
GET  /v1/platform/stats        // System statistics
POST /v1/platform/tenants      // Create tenant
PUT  /v1/platform/tenants/:id  // Update tenant
```

### Tenant Admin Endpoints

```typescript
GET / v1 / tenant / info; // Current tenant info
GET / v1 / tenant / packages; // Tenant's packages
GET / v1 / tenant / bookings; // Tenant's bookings
GET / v1 / tenant / blackouts; // Tenant's blackouts
GET / v1 / tenant / branding; // Tenant's branding
```

## Access Control Matrix

| Feature            | PLATFORM_ADMIN | TENANT_ADMIN  |
| ------------------ | -------------- | ------------- |
| View all tenants   | ✅             | ❌            |
| Create tenants     | ✅             | ❌            |
| System statistics  | ✅             | ❌            |
| Platform settings  | ✅             | ❌            |
| Manage packages    | ❌             | ✅ (own only) |
| View bookings      | ❌             | ✅ (own only) |
| Manage blackouts   | ❌             | ✅ (own only) |
| Customize branding | ❌             | ✅ (own only) |
| Tenant settings    | ❌             | ✅ (own only) |
| Upload photos      | ❌             | ✅ (own only) |

## File Locations

```
client/src/
├── contexts/
│   └── AuthContext.tsx                    # Auth state & hooks
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.tsx             # Route protection
│   └── navigation/
│       └── RoleBasedNav.tsx               # Role-based nav
├── pages/
│   ├── Login.tsx                          # Unified login
│   ├── admin/
│   │   └── PlatformAdminDashboard.tsx     # Platform admin
│   └── tenant/
│       └── TenantAdminDashboard.tsx       # Tenant admin
└── router.tsx                             # Route config

server/
└── prisma/
    └── schema.prisma                      # Updated with roles
```

## Common Tasks

### Create a Protected Page

```tsx
// 1. Create page component
export function MyProtectedPage() {
  const { user } = useAuth();
  return <div>Hello {user?.email}</div>;
}

// 2. Add to router.tsx
{
  path: "admin/my-page",
  element: (
    <ProtectedSuspenseWrapper allowedRoles={["PLATFORM_ADMIN"]}>
      <MyProtectedPage />
    </ProtectedSuspenseWrapper>
  ),
}
```

### Add Navigation Item

```tsx
// In RoleBasedNav.tsx
const platformAdminNav: NavItem[] = [
  // ... existing items
  {
    label: 'My Page',
    path: '/admin/my-page',
    icon: <Star className="w-5 h-5" />,
    description: 'My custom page',
  },
];
```

### Check User Role in Component

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, hasRole } = useAuth();

  if (!user) return null;

  return (
    <div>
      {hasRole('PLATFORM_ADMIN') && <button>Platform Admin Only</button>}
      {hasRole('TENANT_ADMIN') && <p>Tenant: {user.tenantName}</p>}
    </div>
  );
}
```

## Tenant Isolation

### How It Works

1. **TENANT_ADMIN login** stores `tenantId` in user object
2. **API calls** include tenantId in JWT token
3. **Server middleware** filters all queries by tenantId
4. **Database constraints** enforce tenant boundaries

### Example API Call (Tenant-Scoped)

```typescript
// Client sends request with JWT
const result = await api.tenantGetPackages();

// Server extracts tenantId from JWT
// SELECT * FROM Package WHERE tenantId = '<from-jwt>'

// Client receives only their packages
```

## Migration Notes

### From Old System

- Old `/admin/login` and `/tenant/login` redirect to `/login`
- Old tokens (`adminToken`, `tenantToken`) cleared on new login
- Existing components reused (TenantPackagesManager, etc.)
- Database migration required for new UserRole values

### Next Steps for Server

1. Add unified login endpoint
2. Update JWT to include role and tenantId
3. Create platform admin endpoints
4. Add authorization middleware
5. Test tenant isolation

## Testing Commands

```bash
# Run Prisma migration
cd server
npx prisma migrate dev --name add_user_roles

# Generate Prisma client
npx prisma generate

# Start dev server
npm run dev

# Start client
cd ../client
npm run dev
```

## Troubleshooting

### User redirected to wrong dashboard

- Check JWT token role field
- Verify ProtectedRoute allowedRoles
- Check AuthContext user.role value

### Cannot access protected route

- Verify token is stored in localStorage.authToken
- Check ProtectedRoute wrapping in router
- Ensure AuthProvider wraps app

### Tenant seeing other tenants' data

- Check API middleware tenantId filtering
- Verify JWT includes correct tenantId
- Ensure database queries include WHERE tenantId

## Security Checklist

- [ ] All tenant routes check tenantId
- [ ] Platform admin routes check PLATFORM_ADMIN role
- [ ] JWT tokens include role and tenantId
- [ ] API middleware validates tenant access
- [ ] Database queries filter by tenantId
- [ ] No cross-tenant data leaks in responses
- [ ] ProtectedRoute on all admin routes
- [ ] Token expiration implemented
- [ ] HTTPS enforced in production
