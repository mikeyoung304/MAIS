# P1: Route Order Bug - `/stats` Endpoint Unreachable

**Status:** done ✅
**Priority:** P1 (Critical)
**Fixed in:** commit a93a2a9e
**Category:** Architecture
**File:** `server/src/routes/platform-admin-traces.routes.ts`
**Lines:** 193, 360

## Problem

The `/stats` route is defined AFTER the `/:traceId` route. Express matches routes in order, so `/stats` gets captured by `/:traceId` as if `traceId='stats'`.

**Current order (broken):**

```typescript
router.get('/', ...)              // Line 90 - OK
router.get('/:traceId', ...)      // Line 193 - Catches /stats
router.patch('/:traceId/review', ...)
router.post('/:traceId/actions', ...)
router.get('/stats', ...)         // Line 360 - UNREACHABLE
```

**Result:** Platform admin stats endpoint returns 404 "Trace not found" instead of aggregate statistics.

## Fix

Move `/stats` route BEFORE `/:traceId`:

```typescript
router.get('/', ...)
router.get('/stats', ...)         // Move before parameterized route
router.get('/:traceId', ...)
router.patch('/:traceId/review', ...)
router.post('/:traceId/actions', ...)
```

## Test

```bash
# After fix, this should return stats, not 404
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/v1/platform/admin/traces/stats
```

## Source

Code review of commit b2cab182 - Architecture reviewer finding
