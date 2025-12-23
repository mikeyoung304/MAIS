# P2: Unbounded Add-On IDs Array in DTO

## Priority: P2 Important
## Status: ready
## Feature: DATE Booking Flow
## Category: Security

## Issue

No maximum length constraint on the add-ons array in the DTO.

**File:** `packages/contracts/src/dto.ts:174`

```typescript
addOnIds: z.array(z.string()).optional(),
```

## Attack Vectors

```json
{
  "packageId": "wedding-basic",
  "date": "2025-06-15",
  "addOnIds": ["addon1", "addon2", ... "addon999999"]  // 1M add-ons
}
```

An attacker could send thousands of add-on IDs to:
1. Cause excessive database queries in `catalogRepo.getAddOnsByPackageId()`
2. Inflate Stripe metadata beyond limits (500 chars per value)
3. Exhaust server memory with large request bodies

## Recommended Fix

```typescript
addOnIds: z.array(z.string())
  .max(50, 'Maximum 50 add-ons allowed')
  .optional(),
```

## Testing

- Send request with 100+ add-on IDs, verify rejection
- Verify error message is user-friendly



## Work Log

### 2025-12-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference
- Security Review Finding P2-002 (Unbounded Add-On IDs Array)
