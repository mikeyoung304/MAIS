---
title: Platform Admin Impersonation Sidebar Navigation Bug
category: ui-bugs
component: RoleBasedNav
date_solved: 2025-11-28
severity: medium
symptoms:
  - Clicking "Segments" in sidebar redirects to /admin/segments instead of tenant segments
  - Sidebar shows platform admin navigation when impersonating a tenant
  - Page reloads dashboard instead of showing expected content
  - Navigation state doesn't reflect impersonation context
tags:
  - impersonation
  - navigation
  - multi-tenant
  - role-based-access
  - sidebar
  - tenant-dashboard
related_docs:
  - docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md
  - client/ROLE_BASED_ARCHITECTURE.md
  - DEVELOPING.md (Platform Admin Features section)
---

# Platform Admin Impersonation Sidebar Navigation Bug

## Problem Statement

When a Platform Admin impersonates a tenant (e.g., via "Sign In As" from the admin dashboard), clicking "Segments" in the sidebar navigation redirected to `/admin/segments` (the platform-wide segments page) instead of showing the tenant's segments. The page would reload the tenant dashboard instead of displaying segment management.

## Symptoms

1. Sidebar shows "Dashboard" and "Segments" links (platform admin nav) when impersonating
2. Clicking "Segments" goes to `/admin/segments` which redirects back to dashboard
3. No way to manage tenant segments while impersonating
4. Navigation doesn't reflect the impersonation context

## Root Cause

The `RoleBasedNav` component was checking only `user.role` to determine which navigation to display:

```typescript
// BEFORE (Incorrect)
const navItems = user.role === 'PLATFORM_ADMIN' ? platformAdminNav : tenantAdminNav;
```

This logic failed to account for the **impersonation context**. When a Platform Admin clicked "Sign In As" to impersonate a tenant, the system generated a JWT token with impersonation metadata, but the navigation component didn't check this state. It only saw `user.role === "PLATFORM_ADMIN"` and displayed platform admin navigation even though the user was operating as a tenant.

## Solution

### Step 1: Update RoleBasedNav to Check Impersonation State

**File:** `client/src/components/navigation/RoleBasedNav.tsx`

```typescript
// BEFORE
export function RoleBasedNav({ variant = "sidebar" }: { variant?: "sidebar" | "horizontal" }) {
  const { user } = useAuth();
  // ...
  const navItems = user.role === "PLATFORM_ADMIN" ? platformAdminNav : tenantAdminNav;

// AFTER
export function RoleBasedNav({ variant = "sidebar" }: { variant?: "sidebar" | "horizontal" }) {
  const { user, isImpersonating } = useAuth();
  // ...
  const isCurrentlyImpersonating = isImpersonating();
  const navItems = (user.role === "PLATFORM_ADMIN" && !isCurrentlyImpersonating)
    ? platformAdminNav
    : tenantAdminNav;
```

### Step 2: Add Segments Tab to Tenant Dashboard

**File:** `client/src/features/tenant-admin/TenantDashboard/TabNavigation.tsx`

```typescript
// BEFORE
export type DashboardTab = 'packages' | 'blackouts' | 'bookings' | 'branding' | 'payments';

// AFTER
export type DashboardTab =
  | 'packages'
  | 'segments'
  | 'blackouts'
  | 'bookings'
  | 'branding'
  | 'payments';

const tabs: { id: DashboardTab; label: string }[] = [
  { id: 'packages', label: 'Packages' },
  { id: 'segments', label: 'Segments' }, // NEW
  { id: 'blackouts', label: 'Blackouts' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'branding', label: 'Branding' },
  { id: 'payments', label: 'Payments' },
];
```

### Step 3: Integrate SegmentsManager into Dashboard

**File:** `client/src/features/tenant-admin/TenantDashboard/index.tsx`

```typescript
import { SegmentsManager } from "../../admin/segments/SegmentsManager";

// In render, add:
{activeTab === "segments" && (
  <SegmentsManager />
)}
```

## Files Changed

- `client/src/components/navigation/RoleBasedNav.tsx` - Added impersonation check
- `client/src/features/tenant-admin/TenantDashboard/TabNavigation.tsx` - Added segments tab
- `client/src/features/tenant-admin/TenantDashboard/index.tsx` - Integrated SegmentsManager

## Prevention Strategies

### Code Review Checklist

When reviewing role-based components, verify:

- [ ] Does the component check `isImpersonating()` when using `user.role`?
- [ ] Is the effective role calculated correctly for UI decisions?
- [ ] Does navigation reflect the actual operational context?
- [ ] Are admin-only controls hidden during impersonation?

### Best Practice Pattern

```typescript
// ALWAYS calculate effective role when checking user.role
const { user, isImpersonating } = useAuth();
const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;

// Use effective role for ALL UI/permission decisions
if (effectiveRole === 'PLATFORM_ADMIN') {
  // Show admin features
} else {
  // Show tenant features
}
```

### Test Cases

1. **Unit Test:** Mock `isImpersonating: true`, verify tenant nav is shown
2. **Integration Test:** Full auth context with impersonation data
3. **E2E Test:** Complete flow - login as admin → impersonate tenant → verify sidebar → manage segments

## Related Documentation

- [Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
- [Role-Based Architecture](../../../client/ROLE_BASED_ARCHITECTURE.md)
- [DEVELOPING.md - Platform Admin Features](../../../DEVELOPING.md)

## Commit

- Hash: `dae1027`
- Message: `fix(tenant-dashboard): add Segments tab and fix nav during impersonation`
