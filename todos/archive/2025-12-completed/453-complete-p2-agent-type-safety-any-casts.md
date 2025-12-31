---
status: complete
priority: p2
issue_id: '453'
tags: [typescript, agent, code-review, type-safety]
dependencies: []
---

# Agent Tools Use `as any` Type Casts

## Problem Statement

Several agent tools and executors use `as any` type casts that bypass TypeScript's safety checks. This can lead to runtime errors if data shapes change.

## Severity: P2 - IMPORTANT

Type safety violations can cause runtime errors that are hard to debug.

## Findings

- **Location**: Multiple files

### read-tools.ts

1. **Line 300**: `status: status as any` - BookingStatus enum bypassed
2. **Line 869**: `where: customerSearchFilter as any` - Prisma filter typed incorrectly
3. **Lines 712, 1032, 1046**: Helper functions take `any` parameter

```typescript
// Line 300 - Status cast bypasses enum validation
...(status ? { status: status as any } : {}),

// Line 869 - customerSearchFilter cast
const customers = await prisma.customer.findMany({
  where: customerSearchFilter as any,
});

// Line 712 - formatAddOn takes any
function formatAddOn(addOn: any) {
```

### executors/index.ts

1. **Line 52**: `prisma[model] as any` - Dynamic model access
2. **Line 916**: `updates.status = status as BookingStatus` - No validation

## Problem Scenario

1. Prisma schema changes (e.g., BookingStatus enum values)
2. Code compiles successfully (types bypassed)
3. Runtime error when invalid status is used
4. Error message doesn't indicate the type mismatch

## Proposed Solutions

### Option 1: Add Type Guards (Recommended)

- **Pros**: Runtime validation, type-safe
- **Cons**: Slightly more verbose
- **Effort**: Medium (2-3 hours)
- **Risk**: Low

```typescript
import { BookingStatus } from '../../generated/prisma';

const isValidStatus = (s: string): s is BookingStatus =>
  Object.values(BookingStatus).includes(s as BookingStatus);

if (status && isValidStatus(status)) {
  // ... use status safely
}
```

### Option 2: Use Zod Schemas

- **Pros**: Comprehensive validation, great error messages
- **Cons**: More code, new dependency usage
- **Effort**: Large
- **Risk**: Low

## Recommended Action

[To be filled during triage]

## Technical Details

- **Affected Files**:
  - `server/src/agent/tools/read-tools.ts` - 5+ `as any` usages
  - `server/src/agent/executors/index.ts` - 2+ `as any` usages
- **Related Components**: Prisma generated types
- **Database Changes**: No

## Acceptance Criteria

- [ ] BookingStatus validated with type guard
- [ ] Helper functions typed with Prisma types (Package, AddOn, etc.)
- [ ] No `as any` casts in critical paths
- [ ] Remove unused `PrismaTenantRepository` import (line 15)

## Resources

- Source: Code Review - TypeScript Review Agent (2025-12-28)
- Pattern: Use `Object.values(Enum).includes()` for enum validation

## Notes

Source: Code Review on 2025-12-28
Estimated Effort: Medium (2-3 hours)
