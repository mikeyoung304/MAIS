---
status: complete
priority: p3
issue_id: '060'
tags: [code-review, scheduling, performance, caching]
dependencies: ['053']
---

# Add Caching for Service and Availability Rules - DEFERRED

## Decision

**DEFERRED: Documented as future optimization with implementation pattern documented.**

While caching would reduce database queries, this P3 optimization is appropriate to defer because:

1. **Cache infrastructure exists** - CacheServicePort is properly wired in DI
2. **Architectural pattern is proven** - CatalogService and PackageDraftService demonstrate cache-aside pattern
3. **Invalidation complexity** - Cache invalidation on rule/service updates requires additional logic that wasn't scoped
4. **Read-heavy but not critical** - Availability slot generation is called per-booking request, not mass queries
5. **Benefit needs validation** - Claimed 90% reduction assumes high request volume per service

## Analysis

### Current State

- SchedulingAvailabilityService queries:
  - Service by ID (via `serviceRepo.getById()`)
  - Availability rules (via `availabilityRuleRepo.getEffectiveRules()`)
- Cache NOT currently injected into service

### Implementation Pattern (For Future)

```typescript
// 1. Add cache to service constructor
constructor(
  private readonly serviceRepo: ServiceRepository,
  private readonly availabilityRuleRepo: AvailabilityRuleRepository,
  private readonly bookingRepo: BookingRepository,
  private readonly cache?: CacheServicePort  // Add optional cache
) {}

// 2. Cache service lookups in getAvailableSlots()
const service = await cachedOperation(
  this.cache,
  {
    prefix: 'scheduling',
    keyParts: [tenantId, 'service', serviceId],
    ttl: 3600  // 1 hour
  },
  () => this.serviceRepo.getById(tenantId, serviceId)
);

// 3. Cache rules lookups
const rules = await cachedOperation(
  this.cache,
  {
    prefix: 'scheduling',
    keyParts: [tenantId, 'rules', serviceId],
    ttl: 3600  // 1 hour
  },
  () => this.availabilityRuleRepo.getEffectiveRules(tenantId, date, serviceId)
);

// 4. Invalidate on updates (in rule/service update routes)
await invalidateCacheKeys(this.cache, [
  buildCacheKey('scheduling', tenantId, 'rules', serviceId)
]);
```

### Files Involved (When Implemented)

- `server/src/services/scheduling-availability.service.ts` - Add cache parameter and cachedOperation calls
- `server/src/di.ts` - Pass cacheAdapter to service constructor
- `server/src/routes/services.routes.ts` - Add cache invalidation on update
- `server/src/routes/availability-rules.routes.ts` - Add cache invalidation on update

### Helper Functions Ready

- `cachedOperation()` - Get-or-fetch with automatic caching
- `buildCacheKey()` - Tenant-scoped key builder
- `invalidateCacheKeys()` - Batch invalidation

All located in `server/src/lib/cache-helpers.ts`

## Work Log

| Date       | Action   | Notes                                                   |
| ---------- | -------- | ------------------------------------------------------- |
| 2025-11-27 | Created  | Found during Performance Oracle review                  |
| 2025-12-03 | Decision | Deferred - documented pattern for future implementation |
