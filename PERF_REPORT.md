# Performance & Runtime Efficiency Audit Report

**Generated:** December 26, 2025
**Auditor:** Claude Opus 4.5 (Agent C3)
**Repository:** MAIS (Macon AI Solutions)
**Branch:** main (production-ready)

---

## Executive Summary

This performance audit analyzed the MAIS multi-tenant platform across database queries, memory management, API efficiency, frontend performance, caching strategy, and async patterns. The codebase demonstrates **generally good performance practices** with notable strengths in:

- Well-designed Prisma schema with comprehensive indexing
- Application-level caching with tenant-scoped keys
- React.memo usage in critical wizard components
- Promise.all usage in several hot paths

**Critical Findings:** 3 issues requiring immediate attention (P0)
**High Priority Issues:** 5 issues for next sprint (P1)
**Optimization Opportunities:** 7 items for backlog (P2)

---

## TOP 10 Performance Hotspots

| Rank | File:Line | Issue | Impact | Priority |
|------|-----------|-------|--------|----------|
| 1 | `server/src/services/catalog.service.ts:106-111` | N+1 query in getPackageBySlug | High | P0 |
| 2 | `server/src/services/availability.service.ts:43-62` | Sequential async calls in checkAvailability | High | P1 |
| 3 | `server/src/services/commission.service.ts:161-209` | Separate tenant query + add-ons query | Medium | P1 |
| 4 | `apps/web/src/lib/tenant.ts:427-439` | Sequential fetch in getTenantStorefrontData | Medium | P1 |
| 5 | `server/src/adapters/prisma/booking.repository.ts:365-370` | Unbounded findAll query | High | P0 |
| 6 | `server/src/adapters/prisma/catalog.repository.ts:142-175` | Double query for add-on ownership verification | Low | P2 |
| 7 | `apps/web/src/components/tenant/sections/*` | Missing React.memo on section components | Medium | P1 |
| 8 | `client/src/features/*` | Limited useMemo/useCallback usage | Low | P2 |
| 9 | `server/prisma/schema.prisma` | Missing partial index for balance due bookings | Medium | P2 |
| 10 | `server/src/services/segment.service.ts:94-160` | Cache bypass on fallback paths | Low | P2 |

---

## 1. Database Query Efficiency

### N+1 Query Patterns

#### P0 - CRITICAL: CatalogService.getPackageBySlug Sequential Queries

**File:** `server/src/services/catalog.service.ts:106-111`
**Impact:** High - Every package detail page makes 2 queries

```typescript
// Current implementation (lines 106-111)
async () => {
  const pkg = await this.repository.getPackageBySlug(tenantId, slug);
  if (!pkg) throw new NotFoundError(...);
  const addOns = await this.repository.getAddOnsByPackageId(tenantId, pkg.id);
  return { ...pkg, addOns };
}
```

**Fix:** Use `getPackageBySlugWithAddOns()` which already exists in the repository (lines 77-108 of catalog.repository.ts)

```typescript
async () => {
  const pkg = await this.repository.getPackageBySlugWithAddOns(tenantId, slug);
  if (!pkg) throw new NotFoundError(...);
  return pkg;
}
```

**Estimated Savings:** 50% reduction in DB round-trips for package detail pages

---

#### P1 - AvailabilityService.checkAvailability Sequential Queries

**File:** `server/src/services/availability.service.ts:43-62`
**Impact:** High - Booking flow critical path

```typescript
// Current: 3 sequential async calls
const isBlackout = await this.blackoutRepo.isBlackoutDate(tenantId, date);
if (isBlackout) return { available: false, reason: 'blackout' };

const isBooked = await this.bookingRepo.isDateBooked(tenantId, date);
if (isBooked) return { available: false, reason: 'booked' };

const isCalendarAvailable = await this.calendarProvider.isDateAvailable(date);
```

**Fix:** Use Promise.all for independent checks:

```typescript
const [isBlackout, isBooked, isCalendarAvailable] = await Promise.all([
  this.blackoutRepo.isBlackoutDate(tenantId, date),
  this.bookingRepo.isDateBooked(tenantId, date),
  this.calendarProvider.isDateAvailable(date),
]);
// Then evaluate in priority order
```

**Estimated Savings:** 60-70% latency reduction for availability checks

---

### Unbounded Queries

#### P0 - CRITICAL: BookingRepository.findAll Missing Pagination

**File:** `server/src/adapters/prisma/booking.repository.ts:365-370`

```typescript
async findAll(tenantId: string): Promise<Booking[]> {
  const bookings = await this.prisma.booking.findMany({
    where: { tenantId },
    // NO LIMIT - returns ALL bookings!
  });
```

**Risk:** Memory exhaustion for tenants with high booking volume
**Fix:** Add mandatory pagination or default limit

```typescript
async findAll(tenantId: string, options?: { limit?: number; offset?: number }) {
  const bookings = await this.prisma.booking.findMany({
    where: { tenantId },
    take: options?.limit ?? 100,  // Default safe limit
    skip: options?.offset ?? 0,
    orderBy: { createdAt: 'desc' },
  });
```

---

### Missing Index Recommendations

The Prisma schema has comprehensive indexing. Identified gaps:

#### P2 - Missing Partial Index for Balance Due Bookings

**File:** `server/prisma/schema.prisma`
**Use Case:** Balance payment reminder queries

```sql
-- Recommended partial index
CREATE INDEX idx_booking_balance_due ON "Booking" (tenantId, balanceDueDate)
WHERE status = 'DEPOSIT_PAID' AND balancePaidAt IS NULL;
```

**Note:** This is similar to the reminder_due partial index at line 396.

---

## 2. Memory & Resource Issues

### Event Listener Cleanup - WELL IMPLEMENTED

**File:** `server/src/lib/core/events.ts:234-242`

The InProcessEventEmitter correctly implements:
- Unsubscribe functions returned from subscribe()
- clearAll() method for shutdown cleanup
- Exported via di.ts for graceful shutdown

**Status:** No action needed - good implementation

### Cache Without Size Limits

**File:** `server/src/adapters/gcal.adapter.ts:109-196`

The Google Calendar adapter uses a Map-based cache without size limits:

```typescript
private cache = new Map<string, { result: boolean; timestamp: number }>();
```

**Risk:** Unbounded memory growth for long-running instances
**Priority:** P2 - Low risk in practice (cache entries TTL after 5 minutes)

**Fix:** Add LRU eviction:

```typescript
// Consider using lru-cache package or implement max size
const MAX_CACHE_ENTRIES = 1000;
if (this.cache.size >= MAX_CACHE_ENTRIES) {
  const oldestKey = this.cache.keys().next().value;
  this.cache.delete(oldestKey);
}
```

---

## 3. API Response Efficiency

### P1 - Excessive Data in getTenantStorefrontData

**File:** `apps/web/src/lib/tenant.ts:427-439`

```typescript
// Current: Fetches tenant THEN packages+segments sequentially
const tenant = await getTenantBySlug(slug);
const [packages, segments] = await Promise.all([
  getTenantPackages(tenant.apiKeyPublic),
  getTenantSegments(tenant.apiKeyPublic),
]);
```

**Issue:** First fetch is sequential (could be cached/memoized differently)

**Mitigation Already Applied:** Function is wrapped with `cache()` at line 427, deduplicating within request lifecycle. This is good.

**Additional Optimization:** Consider a unified `/v1/public/tenants/:slug/storefront` endpoint that returns tenant + packages + segments in one round-trip from Next.js to Express.

---

### Missing Response Field Selection

**File:** `server/src/services/commission.service.ts:58-66`

```typescript
const tenant = await this.prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { commissionPercent: true, slug: true },  // GOOD - uses select
});
```

**Status:** Already optimized with select clauses. No action needed.

---

## 4. Frontend Performance

### P1 - Missing React.memo on Section Components

**File:** `apps/web/src/components/tenant/sections/*.tsx`

Section components like TextSection, ContactSection, GallerySection are NOT memoized.

```typescript
// apps/web/src/components/tenant/sections/TextSection.tsx
export function TextSection({ section, tenant }: TextSectionProps) {
  // Re-renders on every parent re-render
}
```

**Fix:** Wrap with React.memo:

```typescript
export const TextSection = React.memo(function TextSection({ ... }) {
  // ...
});
```

**Affected Files:**
- `apps/web/src/components/tenant/sections/TextSection.tsx`
- `apps/web/src/components/tenant/sections/GallerySection.tsx`
- `apps/web/src/components/tenant/sections/HeroSection.tsx`
- `apps/web/src/components/tenant/sections/ContactSection.tsx`

---

### Good Practice: DateBookingWizard Memoization

**File:** `apps/web/src/components/booking/DateBookingWizard.tsx`

This component correctly implements:
- React.memo on step sub-components (lines 72, 125, 170, 247)
- useMemo for derived state (unavailableDates, steps, formValidation)
- useCallback for handlers (handleDateSelect, updateCustomerDetails)

**Status:** Well-optimized, serves as a reference implementation

---

### P2 - Legacy Client Limited Memoization

**Path:** `client/src/features/*`

The legacy Vite client uses TanStack Query (good!) but has limited React.memo usage.

**Files needing review:**
- `client/src/features/admin/dashboard/components/*`
- `client/src/features/storefront/*`

---

## 5. Caching Strategy

### Current Implementation - GOOD

**File:** `server/src/lib/cache-helpers.ts`

The caching infrastructure is well-designed:
- `cachedOperation()` wrapper for get-or-fetch pattern
- `buildCacheKey()` enforces tenant isolation
- TTL of 15 minutes (900s) for catalog data
- Targeted invalidation with `getCatalogInvalidationKeys()`

### P2 - Cache Bypass on Error Paths

**File:** `server/src/services/segment.service.ts:94-129`

```typescript
// Line 94 - Cache set after fetch
await this.cache?.set(cacheKey, segment, 900);

// But if repository throws, cache is never populated
// Consider caching negative results for 30s to prevent repeated failures
```

**Low priority - only affects error scenarios**

---

### P2 - Inconsistent Cache TTL

| Location | TTL | Data Type |
|----------|-----|-----------|
| CatalogService | 900s (15m) | Packages, Add-ons |
| SegmentService | 900s (15m) | Segments |
| SegmentService stats | 300s (5m) | Segment stats |
| GCalAdapter | 300s (5m) | Calendar availability |

**Recommendation:** Document TTL strategy. Current values seem reasonable for the data volatility.

---

## 6. Async/Await Optimization Opportunities

### Good Implementations Found

**File:** `server/src/services/scheduling-availability.service.ts:586`
```typescript
const [allBookings, allAvailabilityRules] = await Promise.all([
  this.bookingRepo.getTimeslotBookingsInRange(tenantId, startDate, endDate, serviceId),
  this.availabilityRuleRepo.getRulesForDateRange(tenantId, serviceId, startDate, endDate),
]);
```

**File:** `server/src/routes/health.routes.ts:150`
```typescript
const [stripeCheck, postmarkCheck, calendarCheck] = await Promise.all([
  healthService.checkStripe(),
  healthService.checkPostmark(),
  healthService.checkGoogleCalendar(),
]);
```

### P1 - CommissionService Sequential Tenant + Add-on Queries

**File:** `server/src/services/commission.service.ts:161-199`

```typescript
// Sequential queries when add-ons exist
const addOns = await this.prisma.addOn.findMany({...});
// Then
const commission = await this.calculateCommission(tenantId, subtotal);
```

**Fix:** These could be parallelized if tenant is already known:

```typescript
const [addOns, tenant] = await Promise.all([
  this.prisma.addOn.findMany({...}),
  this.prisma.tenant.findUnique({...}),
]);
```

---

## Priority Summary

### P0 - Critical (Fix This Sprint)
1. **CatalogService N+1 query** - Use existing `getPackageBySlugWithAddOns()` method
2. **BookingRepository unbounded findAll** - Add pagination/limit
3. (Already addressed) Prisma schema indexing - Comprehensive, no issues

### P1 - High (Next Sprint)
1. **AvailabilityService sequential checks** - Use Promise.all
2. **Commission service sequential queries** - Parallelize
3. **Next.js section components** - Add React.memo
4. **Unified storefront endpoint** - Reduce SSR round-trips
5. **getTenantStorefrontData** - Consider pre-fetching

### P2 - Optimization Backlog
1. GCalAdapter LRU cache size limit
2. Missing partial index for balance due bookings
3. Legacy client memoization audit
4. Cache bypass on error paths
5. Document cache TTL strategy
6. Catalog repository double-query for add-on ownership
7. Segment service cache fallback paths

---

## Appendix: Files Analyzed

### Server
- `server/prisma/schema.prisma` - 707 lines, comprehensive indexes
- `server/src/services/catalog.service.ts` - N+1 pattern identified
- `server/src/services/availability.service.ts` - Sequential async
- `server/src/services/commission.service.ts` - Sequential queries
- `server/src/services/booking.service.ts` - Generally well-optimized
- `server/src/adapters/prisma/catalog.repository.ts` - Good optimizations with select
- `server/src/adapters/prisma/booking.repository.ts` - Unbounded query
- `server/src/lib/cache-helpers.ts` - Well-designed caching utilities
- `server/src/lib/core/events.ts` - Proper cleanup implementation

### Frontend (Next.js)
- `apps/web/src/lib/tenant.ts` - Good cache() usage
- `apps/web/src/components/booking/DateBookingWizard.tsx` - Well-memoized
- `apps/web/src/components/tenant/sections/*` - Missing React.memo

### Frontend (Legacy Vite)
- `client/src/features/*` - Limited memoization, uses TanStack Query

---

**Report Generated by Claude Opus 4.5**
**MAIS Performance Audit - December 2025**
