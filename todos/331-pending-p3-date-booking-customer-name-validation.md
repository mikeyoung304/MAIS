# P3: Add Customer Name Validation

## Priority: P3 Nice-to-have
## Status: pending
## Feature: DATE Booking Flow
## Category: Security

## Issue

Current validation only checks length (max 100) but should prevent:
- SQL fragments in name fields
- Script injection attempts
- Control characters

**File:** `packages/contracts/src/dto.ts`

```typescript
customerName: z.string().min(1, 'Customer name is required').max(100),
```

## Recommendation

Add character validation:

```typescript
customerName: z.string()
  .min(1, 'Customer name is required')
  .max(100)
  .regex(/^[\p{L}\p{M}\p{Zs}'-]+$/u, 'Name contains invalid characters'),
```

This allows:
- Unicode letters (`\p{L}`)
- Combining marks (`\p{M}`)
- Spaces (`\p{Zs}`)
- Hyphens and apostrophes

## Testing

Test with various inputs:
- Valid: "Jane & John Smith", "María García", "O'Brien"
- Invalid: "<script>alert(1)</script>", "DROP TABLE users", control characters

## Review Reference
- Security Review Finding P3-003 (Add Customer Name Validation)
