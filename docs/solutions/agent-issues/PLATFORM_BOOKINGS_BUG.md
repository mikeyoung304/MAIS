# Platform Bookings Dashboard Bug

**Date:** 2026-01-28

**Status:** Active Bug - Not an agent failure

**Severity:** HIGH - Platform admin cannot view bookings

---

## Issue Description

Platform admin dashboard shows a badge with booking count (e.g., "2") next to the Bookings menu item, but when clicking to view the bookings list, the page displays "Bookings will appear here when tenants receive them" and "Showing 0 of 0 bookings".

## Root Cause

**File:** `server/src/routes/admin.routes.ts` (Lines 22-35)

```typescript
async getBookings(): Promise<BookingDto[]> {
  const bookings = await this.bookingService.getAllBookings(DEFAULT_TENANT);
  return bookings.map((booking) => ({
    id: booking.id,
    packageId: booking.packageId,
    coupleName: booking.coupleName,
    email: booking.email,
    phone: booking.phone,
    eventDate: booking.eventDate,
    addOnIds: booking.addOnIds,
    totalCents: booking.totalCents,
    status: booking.status,
    createdAt: booking.createdAt,
  }));
}
```

**Problem:**

- Line 23: `getAllBookings(DEFAULT_TENANT)` fetches bookings for only ONE legacy tenant
- Line 10: `DEFAULT_TENANT = 'tenant_default_legacy'` - hardcoded legacy single-tenant value
- This tenant likely doesn't exist or has no bookings
- The endpoint should fetch ALL bookings across ALL tenants for platform admin view

## Expected vs Actual Behavior

### Expected:

1. Platform admin sees booking count badge (e.g., "Bookings (2)")
2. Clicks "Bookings" in sidebar
3. Page displays list of all 2 bookings from all tenants
4. Can see tenant name, customer info, status, dates

### Actual:

1. Platform admin sees booking count badge "2" (correct - from platform stats)
2. Clicks "Bookings" in sidebar
3. Page displays empty state: "Bookings will appear here when tenants receive them"
4. Counter shows "Showing 0 of 0 bookings"
5. No bookings visible

## Why Badge Shows Correct Count

**File:** `server/src/controllers/platform-admin.controller.ts` (Lines 142-144)

```typescript
// Booking metrics (from real tenants only)
this.prisma.booking.count({
  where: relatedTenantFilter,
}),
```

The platform stats endpoint CORRECTLY counts all bookings across all real (non-test) tenants. This is why the badge shows "2" - there ARE 2 real bookings in the system.

## Contrast: Platform Stats vs Bookings List

| Endpoint             | Scope                | Implementation                  | Result                 |
| -------------------- | -------------------- | ------------------------------- | ---------------------- |
| `/v1/admin/stats`    | All tenants          | Counts from all `realTenantIds` | ✅ Correct (shows "2") |
| `/v1/admin/bookings` | Legacy single tenant | Hardcoded `DEFAULT_TENANT`      | ❌ Wrong (shows "0")   |

## Impact

**Platform Admin Impact:**

- ❌ Cannot view booking details for any tenant
- ❌ Cannot export bookings to CSV (Export CSV button exists but would export 0 rows)
- ❌ Cannot search/filter bookings
- ❌ No visibility into customer bookings across platform
- ❌ Makes platform admin dashboard nearly useless for monitoring

**Data Integrity:**

- ✅ Data exists and is correct (2 real bookings)
- ✅ Platform stats correctly count bookings
- ✅ Individual tenant booking views likely work fine
- ❌ Only the cross-tenant admin view is broken

## API Call Chain

**Frontend:**

```
apps/web/src/app/(protected)/admin/bookings/page.tsx:44
→ fetch('/api/admin/bookings')
```

**Next.js API Proxy:**

```
apps/web/src/app/api/admin/[...path]/route.ts:47
→ ${API_BASE_URL}/v1/admin/bookings
```

**Backend Route:**

```
server/src/routes/index.ts:354
→ controllers.admin.getBookings()
```

**Controller (BUG HERE):**

```
server/src/routes/admin.routes.ts:23
→ bookingService.getAllBookings(DEFAULT_TENANT) ❌
```

## Fix Required

Replace hardcoded `DEFAULT_TENANT` with cross-tenant query:

```typescript
async getBookings(): Promise<BookingDto[]> {
  // Fetch bookings from ALL tenants, excluding test tenants
  const bookings = await this.prisma.booking.findMany({
    where: {
      tenant: { isTestTenant: false }
    },
    include: {
      tenant: { select: { slug: true, name: true } },
      customer: { select: { email: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  return bookings.map((booking) => ({
    id: booking.id,
    packageId: booking.packageId,
    coupleName: booking.coupleName,
    email: booking.customer.email,
    phone: booking.phone,
    eventDate: booking.eventDate,
    addOnIds: booking.addOnIds,
    totalCents: booking.totalCents,
    status: booking.status,
    createdAt: booking.createdAt,
    tenantName: booking.tenant.name,
    tenantSlug: booking.tenant.slug
  }));
}
```

OR use the pattern from PlatformAdminController:

1. Pre-fetch real tenant IDs (excluding test tenants)
2. Use `tenantId: { in: realTenantIds }` filter
3. Reuse the same pattern used by platform stats

## Additional Notes

### Legacy Code Smell

The `DEFAULT_TENANT = 'tenant_default_legacy'` constant suggests this is leftover from when HANDLED was a single-tenant system. It's been migrated to multi-tenant but this admin endpoint wasn't updated.

### Frontend Expectations

The frontend TypeScript interface expects tenant info:

```typescript
interface BookingWithTenant {
  id: string;
  coupleName: string;
  email: string;
  eventDate: string;
  status: 'PENDING' | 'DEPOSIT_PAID' | 'PAID' | 'CONFIRMED' | 'CANCELED' | 'REFUNDED' | 'FULFILLED';
  totalCents: number;
  createdAt: string;
  packageId: string;
  tenantName?: string; // ← Expected but not provided by backend
  tenantSlug?: string; // ← Expected but not provided by backend
}
```

The frontend EXPECTS `tenantName` and `tenantSlug` but the backend doesn't return them. The fix should include these fields.

### Screenshot Evidence

![Platform Bookings Empty State](screenshot shows "Showing 0 of 0 bookings" despite badge showing count)

**Visible in screenshot:**

- Left sidebar: "Bookings" menu item with "All platform bookings" subtitle
- Top-left: Badge shows booking count (indicates bookings exist)
- Main content: Empty state message
- Bottom: "Showing 0 of 0 bookings" counter
- User: mike@gethandled.ai (PLATFORM_ADMIN role)

---

## Unable to Test Project Hub

**Original Request:** Test project hub agent (both tenant-facing and customer-facing) with a real booking.

**Blocker:** Cannot identify a real booking due to:

1. Platform bookings endpoint returning empty array
2. Database query attempts failed to return usable data
3. No direct access to booking IDs or confirmation codes

**To test project hub later:**

1. Fix platform bookings endpoint
2. Use UI to find a real booking
3. Extract booking ID and confirmation code
4. Open both URLs:
   - Tenant view: `/t/{tenantSlug}/admin/bookings/{bookingId}`
   - Customer view: `/booking/{confirmationCode}`
5. Test agent interactions on both sides

---
