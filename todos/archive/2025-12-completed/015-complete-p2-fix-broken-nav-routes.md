---
status: complete
priority: p2
issue_id: '015'
tags: [code-review, routing, navigation, ui]
dependencies: []
---

# Fix Broken Navigation Routes

## Problem Statement

Several navigation links in the admin sidebar point to routes that don't exist in the router configuration. This causes 404 errors when clicking certain navigation items.

**Why this matters:** Admin users see broken navigation when trying to access certain sections, creating a poor user experience.

## Findings

### Broken Platform Admin Routes

**RoleBasedNav.tsx defines these links:**

- `/admin/tenants` - No route defined (tenants shown in dashboard)
- `/admin/settings` - No route defined (not implemented)

**Router.tsx only has:**

- `/admin/dashboard` - PlatformAdminDashboard
- `/admin/segments` - SegmentsManager
- `/admin/tenants/new` - TenantForm
- `/admin/tenants/:id` - TenantForm

### Broken Tenant Admin Routes

**RoleBasedNav.tsx defines these links:**

- `/tenant/packages` - No route (component exists: TenantPackagesManager)
- `/tenant/bookings` - No route (component exists: TenantBookingList)
- `/tenant/blackouts` - No route (component exists: BlackoutsManager)
- `/tenant/branding` - No route (component exists: BrandingEditor)
- `/tenant/settings` - No route (not implemented)

**Router.tsx only has:**

- `/tenant/dashboard` - TenantAdminDashboard

## Proposed Solutions

### Option A: Fix Navigation Links to Point to Dashboard (Quick Fix)

**Effort:** Small | **Risk:** Low

Change `/admin/tenants` link to point to `/admin/dashboard` since tenants are displayed there.

**Pros:**

- Quick fix
- No new routes needed

**Cons:**

- Doesn't add missing functionality
- Still have dead settings link

### Option B: Add Missing Routes (Complete Fix)

**Effort:** Medium | **Risk:** Low

Add routes for all navigation items:

1. `/admin/tenants` → redirect to `/admin/dashboard` (or dedicated tenant list)
2. `/admin/settings` → AdminSettings component (stub or full)
3. `/tenant/packages`, `/tenant/bookings`, etc. → respective components

**Pros:**

- Complete fix
- All navigation works
- Better UX

**Cons:**

- More work
- Some components may need to be created

### Option C: Remove Non-Working Nav Items (Minimal)

**Effort:** Small | **Risk:** Low

Hide navigation items that don't have routes yet.

**Pros:**

- Quick
- No broken links

**Cons:**

- Reduced navigation
- Feature discoverability lost

## Recommended Action

Start with **Option A** for immediate fix, then implement **Option B** as follow-up.

## Technical Details

**Files to Modify:**

- `client/src/components/navigation/RoleBasedNav.tsx`
- `client/src/router.tsx`

**Components That Exist (need routes):**

- `client/src/features/admin/dashboard/tabs/TenantsTab.tsx`
- `client/src/features/admin/segments/SegmentsManager.tsx`
- Various tenant admin components

## Acceptance Criteria

- [ ] Clicking "Tenants" in admin nav navigates to valid page
- [ ] Clicking "System Settings" either works or is hidden
- [ ] No 404 errors from navigation links
- [ ] Tenant admin navigation either works or items are hidden

## Work Log

| Date       | Action  | Notes                    |
| ---------- | ------- | ------------------------ |
| 2025-11-24 | Created | Found during code review |

## Resources

- Navigation: `client/src/components/navigation/RoleBasedNav.tsx`
- Router: `client/src/router.tsx`
- Tenant components: `client/src/features/admin/`
