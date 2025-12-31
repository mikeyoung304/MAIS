# P3: DRY Violation - hashTenantDate Duplicated 3 Times

## Status

**READY** - Approved 2025-12-29 via auto-triage

## Priority

**P3 - Nice to Have (Code Quality)**

## Description

The exact same FNV-1a hash function `hashTenantDate()` is copy-pasted in 3 files. This violates the DRY principle and creates maintenance burden.

## Location

- `server/src/adapters/prisma/booking.repository.ts` (lines 25-35)
- `server/src/agent/executors/index.ts` (lines 37-48)
- `server/src/agent/customer/customer-booking-executor.ts` (lines 55-66)

## Recommendation

Extract to a shared utility:

```typescript
// server/src/lib/advisory-locks.ts
export function hashTenantDate(tenantId: string, date: string): number {
  const str = `${tenantId}:${date}`;
  let hash = 2166136261; // FNV-1a offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  return hash | 0;
}
```

## Impact

- **Maintainability**: One place to update hash algorithm
- **Testing**: One place to test hash function
- **Consistency**: Guaranteed same algorithm everywhere

## Fix Steps

1. Create `server/src/lib/advisory-locks.ts`
2. Move `hashTenantDate()` to shared utility
3. Update all 3 files to import from shared location
4. Add unit tests for hash function

## Tags

dry, code-quality, advisory-locks, refactoring, code-review
