# Role-Based Architecture - Visual Diagrams

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     MAIS PLATFORM                           │
│                                                              │
│  ┌──────────────┐              ┌──────────────┐             │
│  │   Platform   │              │    Tenant    │             │
│  │    Admin     │              │    Admin     │             │
│  │              │              │              │             │
│  │  - Manages   │              │  - Manages   │             │
│  │    ALL       │              │    THEIR     │             │
│  │    Tenants   │              │    Business  │             │
│  │              │              │              │             │
│  │  - System    │              │  - Packages  │             │
│  │    Stats     │              │  - Bookings  │             │
│  │              │              │  - Branding  │             │
│  │  - Config    │              │  - Blackouts │             │
│  └──────────────┘              └──────────────┘             │
│         │                             │                      │
│         └────────┬────────────────────┘                      │
│                  │                                           │
│            ┌─────▼─────┐                                     │
│            │   Unified │                                     │
│            │   Login   │                                     │
│            └───────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

## Authentication Flow

```
┌──────────┐
│  User    │
│  visits  │
│  /login  │
└────┬─────┘
     │
     ▼
┌─────────────────────┐
│  Login Component    │
│  - Email input      │
│  - Password input   │
│  - Submit button    │
└────┬────────────────┘
     │ Submit credentials
     ▼
┌─────────────────────┐
│  Server Auth API    │
│  POST /v1/auth/login│
│  - Verify password  │
│  - Generate JWT     │
│  - Return user data │
└────┬────────────────┘
     │ Response:
     │ { token, user: { role, tenantId?, ... } }
     ▼
┌─────────────────────┐
│  AuthContext        │
│  - Store token      │
│  - Store user data  │
│  - Set auth state   │
└────┬────────────────┘
     │
     ├─── Role: PLATFORM_ADMIN ─────┐
     │                              │
     │                              ▼
     │                    ┌──────────────────┐
     │                    │  Platform Admin  │
     │                    │  Dashboard       │
     │                    │  /admin/dashboard│
     │                    └──────────────────┘
     │
     └─── Role: TENANT_ADMIN ───────┐
                                    │
                                    ▼
                          ┌──────────────────┐
                          │  Tenant Admin    │
                          │  Dashboard       │
                          │  /tenant/dashboard│
                          └──────────────────┘
```

## Route Protection Flow

```
User requests protected route
         │
         ▼
┌────────────────────┐
│  ProtectedRoute    │
│  Component         │
└─────┬──────────────┘
      │
      ├─ Check 1: Is loading?
      │     │
      │     └─ YES ──→ Show Loading Spinner
      │     └─ NO  ──→ Continue
      │
      ├─ Check 2: Is authenticated?
      │     │
      │     └─ NO  ──→ Redirect to /login
      │     └─ YES ──→ Continue
      │
      └─ Check 3: Has required role?
            │
            ├─ YES ──→ Render Protected Component
            │
            └─ NO  ──→ Redirect to appropriate dashboard
                        │
                        ├─ PLATFORM_ADMIN → /admin/dashboard
                        └─ TENANT_ADMIN   → /tenant/dashboard
```

## Data Flow - Platform Admin

```
┌──────────────────────┐
│  Platform Admin User │
└──────────┬───────────┘
           │ Logged in with role: PLATFORM_ADMIN
           ▼
┌──────────────────────┐
│  /admin/dashboard    │
│  PlatformAdminDash   │
└──────────┬───────────┘
           │
           ├──→ GET /v1/platform/tenants
           │    Returns: ALL tenants with stats
           │    [
           │      { id, name, slug, packages: 5, bookings: 12 },
           │      { id, name, slug, packages: 3, bookings: 8 },
           │      ...
           │    ]
           │
           └──→ GET /v1/platform/stats
                Returns: System-wide statistics
                {
                  totalTenants: 10,
                  totalBookings: 143,
                  totalRevenue: 285000,
                  platformCommission: 28500
                }

Can access:
  ✅ All tenant metadata
  ✅ System statistics
  ✅ Platform settings
  ❌ Individual tenant packages
  ❌ Individual tenant bookings
```

## Data Flow - Tenant Admin

```
┌──────────────────────┐
│  Tenant Admin User   │
│  tenantId: "abc123"  │
└──────────┬───────────┘
           │ Logged in with role: TENANT_ADMIN
           ▼
┌──────────────────────┐
│  /tenant/dashboard   │
│  TenantAdminDash     │
└──────────┬───────────┘
           │ JWT contains tenantId: "abc123"
           │
           ├──→ GET /v1/tenant/packages
           │    Server filters: WHERE tenantId = "abc123"
           │    Returns: ONLY their packages
           │
           ├──→ GET /v1/tenant/bookings
           │    Server filters: WHERE tenantId = "abc123"
           │    Returns: ONLY their bookings
           │
           └──→ GET /v1/tenant/blackouts
                Server filters: WHERE tenantId = "abc123"
                Returns: ONLY their blackouts

Can access:
  ✅ Their packages
  ✅ Their bookings
  ✅ Their settings
  ❌ Other tenants' data
  ❌ Platform statistics
  ❌ System settings
```

## Component Hierarchy

```
main.tsx
  └─ QueryClientProvider
      └─ RouterProvider
          └─ AppShell
              └─ AuthProvider ─────────────┐
                  ├─ Header                │
                  │   └─ Navigation        │
                  │                        │
                  └─ Outlet                │
                      │                    │
                      ├─ /login            │
                      │   └─ Login ────────┤ useAuth()
                      │                    │
                      ├─ /admin/dashboard  │
                      │   └─ ProtectedRoute(PLATFORM_ADMIN)
                      │       └─ PlatformAdminDashboard ─┤
                      │           ├─ MetricsCards        │
                      │           ├─ TenantsList         │
                      │           └─ RoleBasedNav ───────┤
                      │                                  │
                      └─ /tenant/dashboard              │
                          └─ ProtectedRoute(TENANT_ADMIN)
                              └─ TenantAdminDashboard ──┤
                                  ├─ MetricsCards        │
                                  ├─ PackagesManager    │
                                  ├─ BookingsList       │
                                  └─ RoleBasedNav ──────┤
                                                        │
All components access auth via useAuth() hook ─────────┘
```

## Database Relationships

```
┌──────────────────┐
│      User        │
│  id              │
│  email           │
│  passwordHash    │
│  role            │ ──┐ USER, ADMIN,
│  tenantId?       │   │ PLATFORM_ADMIN,
└────────┬─────────┘   │ TENANT_ADMIN
         │             │
         │ For TENANT_ADMIN only
         │             │
         ▼             │
┌──────────────────┐   │
│     Tenant       │   │
│  id              │◄──┘
│  slug            │
│  name            │
│  email           │
│  stripeAccountId │
│  branding (JSON) │
└────────┬─────────┘
         │
         │ One-to-Many
         │
         ├───────────────────┐
         │                   │
         ▼                   ▼
┌─────────────┐     ┌─────────────┐
│   Package   │     │   Booking   │
│  id         │     │  id         │
│  tenantId   │     │  tenantId   │
│  name       │     │  date       │
│  basePrice  │     │  totalPrice │
└─────────────┘     └─────────────┘

Tenant Isolation:
  - All tenant data includes tenantId
  - Database enforces @@unique([tenantId, slug])
  - Queries filter by tenantId from JWT
```

## Navigation Structure

```
Platform Admin Nav               Tenant Admin Nav
────────────────────            ────────────────────
🏢 Dashboard                    🏢 Dashboard
   └─ System overview              └─ Tenant overview

👥 Tenants                      📦 Packages
   ├─ List all tenants             └─ Manage packages
   ├─ Create tenant
   └─ Edit tenant               📅 Bookings
                                   └─ View bookings
⚙️  System Settings
   └─ Platform config           ❌ Blackouts
                                   └─ Manage blackouts

                                🎨 Branding
                                   └─ Customize widget

                                ⚙️  Settings
                                   └─ Tenant settings
```

## Security Layers

```
┌─────────────────────────────────────────────┐
│         CLIENT-SIDE PROTECTION              │
│                                             │
│  1. ProtectedRoute                          │
│     - Checks authentication                 │
│     - Validates role                        │
│     - Redirects unauthorized                │
│                                             │
│  2. AuthContext                             │
│     - Manages auth state                    │
│     - Provides hasRole() helper             │
│     - Stores user data                      │
│                                             │
│  3. UI Components                           │
│     - Conditionally render by role          │
│     - Hide unauthorized features            │
│                                             │
└─────────────────────────────────────────────┘
                     ▼
         API Request with JWT
                     ▼
┌─────────────────────────────────────────────┐
│         SERVER-SIDE PROTECTION              │
│                                             │
│  1. JWT Verification                        │
│     - Validate token signature              │
│     - Check expiration                      │
│     - Extract role and tenantId             │
│                                             │
│  2. Authorization Middleware                │
│     - Verify role for route                 │
│     - Inject tenantId filter                │
│     - Reject unauthorized requests          │
│                                             │
│  3. Database Queries                        │
│     - Filter by tenantId (TENANT_ADMIN)     │
│     - Enforce row-level security            │
│     - Prevent cross-tenant access           │
│                                             │
└─────────────────────────────────────────────┘
                     ▼
              Return Data
                     ▼
┌─────────────────────────────────────────────┐
│         DATABASE CONSTRAINTS                │
│                                             │
│  - Tenant isolation via tenantId            │
│  - Unique constraints prevent conflicts     │
│  - Cascade deletes maintain integrity       │
│                                             │
└─────────────────────────────────────────────┘
```

## Request/Response Example

### Platform Admin Request

```
┌──────────────────────────────────────┐
│  CLIENT                              │
│  GET /v1/platform/tenants            │
│  Headers:                            │
│    Authorization: Bearer <JWT>       │
│      {                               │
│        userId: "p1",                 │
│        role: "PLATFORM_ADMIN"        │
│      }                               │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  SERVER                              │
│  1. Verify JWT                       │
│  2. Check role = PLATFORM_ADMIN      │
│  3. Execute query:                   │
│     SELECT * FROM Tenant             │
│     (No tenantId filter)             │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  RESPONSE                            │
│  [                                   │
│    { id: "t1", name: "Bella" },      │
│    { id: "t2", name: "Rose" },       │
│    { id: "t3", name: "Lily" }        │
│  ]                                   │
│  (All tenants)                       │
└──────────────────────────────────────┘
```

### Tenant Admin Request

```
┌──────────────────────────────────────┐
│  CLIENT                              │
│  GET /v1/tenant/packages             │
│  Headers:                            │
│    Authorization: Bearer <JWT>       │
│      {                               │
│        userId: "u1",                 │
│        role: "TENANT_ADMIN",         │
│        tenantId: "t2"                │
│      }                               │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  SERVER                              │
│  1. Verify JWT                       │
│  2. Extract tenantId = "t2"          │
│  3. Execute query:                   │
│     SELECT * FROM Package            │
│     WHERE tenantId = "t2"            │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  RESPONSE                            │
│  [                                   │
│    { id: "p1", name: "Basic" },      │
│    { id: "p2", name: "Premium" }     │
│  ]                                   │
│  (Only Rose's packages)              │
└──────────────────────────────────────┘
```

## File Organization

```
mais/
├── client/
│   ├── src/
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx           ← Auth state
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── ProtectedRoute.tsx    ← Route guard
│   │   │   └── navigation/
│   │   │       └── RoleBasedNav.tsx      ← Dynamic nav
│   │   ├── pages/
│   │   │   ├── Login.tsx                 ← Unified login
│   │   │   ├── admin/
│   │   │   │   └── PlatformAdminDashboard.tsx
│   │   │   └── tenant/
│   │   │       └── TenantAdminDashboard.tsx
│   │   ├── features/
│   │   │   └── tenant-admin/
│   │   │       ├── TenantDashboard.tsx   ← Reused
│   │   │       ├── TenantPackagesManager.tsx
│   │   │       ├── TenantBookingList.tsx
│   │   │       └── BlackoutsManager.tsx
│   │   ├── router.tsx                    ← Protected routes
│   │   └── app/
│   │       └── AppShell.tsx              ← AuthProvider wrap
│   │
│   ├── ROLE_BASED_ARCHITECTURE.md        ← Full docs
│   ├── ROLE_QUICK_REFERENCE.md           ← Quick ref
│   └── ARCHITECTURE_DIAGRAM.md           ← This file
│
└── server/
    ├── prisma/
    │   └── schema.prisma                 ← Updated schema
    └── src/
        ├── routes/
        │   ├── platform-admin.routes.ts  ← To implement
        │   └── tenant-admin.routes.ts    ← To update
        ├── middleware/
        │   └── authorization.ts          ← To implement
        └── services/
            ├── auth.service.ts           ← To update
            └── platform.service.ts       ← To implement
```

## State Management

```
                  ┌─────────────┐
                  │ localStorage│
                  │             │
                  │ authToken   │
                  │ authUser    │
                  └──────┬──────┘
                         │
                    On app load
                         │
                         ▼
                  ┌─────────────┐
                  │AuthProvider │
                  │             │
       ┌──────────┤  Context:   │──────────┐
       │          │  - user     │          │
       │          │  - isLoading│          │
       │          │  - login()  │          │
       │          │  - logout() │          │
       │          │  - hasRole()│          │
       │          └─────────────┘          │
       │                                   │
   useAuth()                          useAuth()
       │                                   │
       ▼                                   ▼
┌──────────────┐                    ┌──────────────┐
│ProtectedRoute│                    │  Dashboard   │
│              │                    │  Component   │
│ Checks role  │                    │              │
│ before render│                    │ Shows data   │
│              │                    │ based on role│
└──────────────┘                    └──────────────┘
```

## Summary

This architecture provides:

✅ **Clear Separation**: Platform and tenant concerns completely separated
✅ **Secure Routes**: Role-based protection at routing level
✅ **Tenant Isolation**: Database-enforced data boundaries
✅ **Scalable**: Easy to add new roles or permissions
✅ **Maintainable**: Well-organized code structure
✅ **Documented**: Comprehensive guides for developers

The system is ready for server-side implementation to complete the full-stack integration.
