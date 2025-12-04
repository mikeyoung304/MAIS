---
title: Platform Admin Impersonation Navigation Redirect Bug
category: authentication-issues
component: RoleBasedNav
symptoms:
  - Clicking "Segments" while impersonating tenant redirects to /admin/segments instead of tenant segments
  - Dashboard reloads instead of showing tenant segments management
  - Sidebar shows platform admin navigation during tenant impersonation
  - Navigation state doesn't reflect actual impersonation context
tags:
  - impersonation
  - navigation
  - multi-tenant
  - role-based-access
  - sidebar
severity: medium
date_solved: 2025-11-28
---

## Problem Statement

When a Platform Admin was impersonating a tenant (e.g., Little Bit Farm), clicking "Segments" in the sidebar navigation would redirect to `/admin/segments` (the platform admin segments page) instead of showing the tenant's segments. This caused the page to reload the dashboard instead of showing segments management.

## Root Cause

The `RoleBasedNav` component was checking `user.role === "PLATFORM_ADMIN"` to show platform admin navigation, but it wasn't accounting for the impersonation state. When impersonating a tenant, the sidebar should show tenant-appropriate navigation, not platform admin navigation.

The navigation logic didn't differentiate between:

- Actually being a platform admin (should show admin nav)
- Being a platform admin who is currently impersonating a tenant (should show tenant nav)

## Solution Implemented

### 1. Modified RoleBasedNav.tsx

Updated the navigation logic to check `isImpersonating()` from AuthContext before displaying platform admin navigation:

```typescript
// Check if impersonating - if so, show tenant navigation
if (isImpersonating()) {
  return <TenantNav />;
}

// Otherwise show based on actual role
if (user.role === "PLATFORM_ADMIN") {
  return <PlatformAdminNav />;
}
```

### 2. Enhanced TabNavigation Component

Added a "Segments" tab to the tenant dashboard's TabNavigation component, allowing tenants to manage their segments from the main dashboard.

### 3. Integrated SegmentsManager

Added the existing SegmentsManager component to the tenant dashboard at the appropriate tab, providing full segments management functionality.

## Files Changed

- `client/src/components/navigation/RoleBasedNav.tsx`
- `client/src/features/tenant-admin/TenantDashboard/TabNavigation.tsx`
- `client/src/features/tenant-admin/TenantDashboard/index.tsx`

## Impact

- Fixed navigation state during impersonation
- Users can now access tenant segments while impersonating without admin redirect
- Improved user experience for platform admins managing tenant accounts
- Navigation now correctly reflects impersonation context

## Testing Recommendations

1. Login as platform admin
2. Impersonate a tenant account
3. Click "Segments" in sidebar - should show tenant segments, not admin segments
4. Verify dashboard doesn't reload unexpectedly
5. Confirm "Segments" tab appears in tenant dashboard navigation
6. Verify segment management works correctly in tenant context
