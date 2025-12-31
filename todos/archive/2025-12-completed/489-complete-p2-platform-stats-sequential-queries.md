# P2: Platform Stats Makes 10 Sequential Database Queries

## Status

**READY** - Approved 2025-12-29 via auto-triage

## Priority

**P2 - Important Performance Issue**

## Description

The `getStats()` method in platform admin controller makes 10 separate database calls sequentially. Each query adds 5-20ms latency. Total: 50-200ms for admin dashboard load.

## Location

- `server/src/controllers/platform-admin.controller.ts` (lines 109-165)

## Current Code

```typescript
const totalTenants = await this.prisma.tenant.count({...});       // Query 1
const activeTenants = await this.prisma.tenant.count({...});      // Query 2
const totalSegments = await this.prisma.segment.count({...});     // Query 3
const activeSegments = await this.prisma.segment.count({...});    // Query 4
const totalBookings = await this.prisma.booking.count({...});     // Query 5
const confirmedBookings = await this.prisma.booking.count({...}); // Query 6
const pendingBookings = await this.prisma.booking.count({...});   // Query 7
const revenueStats = await this.prisma.booking.aggregate({...});  // Query 8
const monthStats = await this.prisma.booking.aggregate({...});    // Query 9
// ... etc
```

## Expected Code

```typescript
const [totalTenants, activeTenants, totalSegments, activeSegments,
       totalBookings, confirmedBookings, pendingBookings,
       revenueStats, monthStats] = await Promise.all([
  this.prisma.tenant.count({...}),
  this.prisma.tenant.count({...}),
  this.prisma.segment.count({...}),
  this.prisma.segment.count({...}),
  this.prisma.booking.count({...}),
  this.prisma.booking.count({...}),
  this.prisma.booking.count({...}),
  this.prisma.booking.aggregate({...}),
  this.prisma.booking.aggregate({...}),
]);
```

## Impact

- **Performance**: Dashboard loads 5-10x slower than necessary
- **UX**: Platform admins wait longer for stats
- **Database**: More connection time consumed per request

## Fix Steps

1. Wrap independent queries in `Promise.all()`
2. Consider caching stats (1-5 min TTL)
3. Add dashboard load time metrics
4. Document which queries can run in parallel

## Related Files

- `server/src/routes/platform-admin.routes.ts` - Dashboard endpoint

## Testing

- Measure dashboard load time before and after
- Load test with multiple concurrent admins

## Tags

performance, platform-admin, database, parallelization, code-review
