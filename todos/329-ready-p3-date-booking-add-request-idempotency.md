# P3: Add Request Idempotency for DATE Booking

## Priority: P3 Nice-to-have
## Status: ready
## Feature: DATE Booking Flow
## Category: Security

## Issue

The DATE booking endpoint lacks idempotency key support, which could cause duplicate bookings from retry storms.

**File:** `server/src/routes/public-date-booking.routes.ts:57`

## Recommendation

Add idempotency key support:

```typescript
router.post('/bookings/date', async (req: TenantRequest, res: Response) => {
  const idempotencyKey = req.headers['idempotency-key'] as string;

  // Check cache for existing response
  if (idempotencyKey) {
    const cached = await idempotencyService.get(idempotencyKey);
    if (cached) {
      return res.status(cached.status).json(cached.body);
    }
  }

  // ... existing code ...

  // Cache response for idempotent replay
  if (idempotencyKey) {
    await idempotencyService.set(idempotencyKey, { status: 200, body: checkout });
  }
});
```

## Note

The `BookingService.createCheckout` already has some idempotency via `idempotencyService`. This would add another layer at the route level.



## Work Log

### 2025-12-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference
- Security Review Finding P3-001 (Add Request Idempotency)
