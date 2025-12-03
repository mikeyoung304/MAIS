---
status: pending
priority: p2
issue_id: "185"
tags: [code-review, type-safety, DRY]
dependencies: []
---

# Type Unions Duplicated from Contracts

## Problem Statement

`BookingStatus` and `RefundStatus` type unions in `client/src/lib/utils.ts` are **manually duplicated** from the contract Zod schemas. If contract enums change, frontend types become stale, causing:
1. Type mismatches between client and server
2. Silent failures if status values don't match
3. Maintenance burden to keep in sync

## Findings

**Location:** `client/src/lib/utils.ts:40-45`

**Current (duplicated):**
```typescript
// client/src/lib/utils.ts
export type BookingStatus = 'PENDING' | 'DEPOSIT_PAID' | 'PAID' | 'CONFIRMED' | 'CANCELED' | 'REFUNDED' | 'FULFILLED';
export type RefundStatus = 'NONE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

// packages/contracts/src/dto.ts (source of truth)
status: z.enum(['PENDING', 'DEPOSIT_PAID', 'PAID', 'CONFIRMED', 'CANCELED', 'REFUNDED', 'FULFILLED'])
refundStatus: z.enum(['NONE', 'PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED'])
```

**Risk Assessment:**
- Impact: Medium (type drift between client and server)
- Likelihood: Medium (types will drift if contracts change)

## Proposed Solutions

### Solution 1: Extract types from Zod schemas (Recommended)
- Use `z.infer<typeof Schema>` to derive types
- Single source of truth in contracts
- **Pros:** Auto-sync with contract changes
- **Cons:** Requires importing contracts in client
- **Effort:** Small (15 minutes)
- **Risk:** Low

### Solution 2: Export types from contracts package
- Add explicit type exports to `@macon/contracts`
- Import in client utils
- **Pros:** Cleaner separation
- **Cons:** Requires contracts package changes
- **Effort:** Medium (30 minutes)
- **Risk:** Low

## Recommended Action

Implement **Solution 1** for quick fix, consider **Solution 2** for cleaner architecture.

## Technical Details

**Affected Files:**
- `client/src/lib/utils.ts`
- Potentially `packages/contracts/src/index.ts` (for Solution 2)

**Proposed Change (Solution 1):**
```typescript
import { BookingDtoSchema, BookingManagementDtoSchema } from '@macon/contracts';
import { z } from 'zod';

// Derive types from Zod schemas
export type BookingStatus = z.infer<typeof BookingDtoSchema>['status'];
export type RefundStatus = NonNullable<z.infer<typeof BookingManagementDtoSchema>['refundStatus']>;
```

## Acceptance Criteria

- [ ] Types derived from contracts (not duplicated)
- [ ] No TypeScript errors
- [ ] Function signatures unchanged
- [ ] Contract changes automatically propagate

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-03 | Created | Found during code review of commit 45024e6 |

## Resources

- Commit: 45024e6 (introduced BookingStatus/RefundStatus types)
- Related: TODO-180 (completed - added typed unions)
