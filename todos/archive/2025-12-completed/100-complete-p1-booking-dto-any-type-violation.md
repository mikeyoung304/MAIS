---
status: complete
priority: p1
issue_id: '100'
tags: [code-review, typescript, contracts, ui-redesign]
dependencies: []
---

# BookingDto Uses `any` Type Assertion for Status Field

## Problem Statement

The TenantBookingList component uses `(booking as any).status` in 3 places, violating TypeScript strict mode and the project's "No `any`" rule from CLAUDE.md.

**Why it matters:** Type safety violation that could lead to runtime errors and makes refactoring dangerous.

## Findings

### From code-quality agent:

**File:** `client/src/features/tenant-admin/TenantBookingList.tsx`
**Lines:** 41, 58, 253

```typescript
// Line 41
if (statusFilter !== "all" && (booking as any).status !== statusFilter) {

// Line 58
(b as any).status || "confirmed",

// Line 253
const status = (booking as any).status || "confirmed";
```

The BookingDto contract likely doesn't include a `status` field, but the UI needs it.

## Proposed Solutions

### Solution 1: Add Status to BookingDto Contract (Recommended)

**Pros:** Proper type safety, single source of truth
**Cons:** Requires contract change
**Effort:** Small (1 hour)
**Risk:** Low

```typescript
// packages/contracts/src/schemas/booking.ts
export const BookingSchema = z.object({
  id: z.string(),
  coupleName: z.string(),
  email: z.string().email(),
  eventDate: z.string(),
  packageId: z.string(),
  totalCents: z.number(),
  status: z.enum(['confirmed', 'pending', 'cancelled']).default('confirmed'),
  // ... other fields
});
```

### Solution 2: Create Extended Type in Component

**Pros:** No contract change needed
**Cons:** Type lives in wrong place
**Effort:** Small
**Risk:** Low

```typescript
type BookingWithStatus = BookingDto & {
  status?: 'confirmed' | 'pending' | 'cancelled';
};
```

## Recommended Action

Implement Solution 1 - Add status to the BookingDto contract.

## Technical Details

**Affected files:**

- `packages/contracts/src/schemas/booking.ts`
- `client/src/features/tenant-admin/TenantBookingList.tsx`

## Acceptance Criteria

- [ ] BookingDto includes optional status field
- [ ] Status is typed as enum, not string
- [ ] All `as any` casts removed from TenantBookingList
- [ ] TypeScript compiles without errors
- [ ] Prisma schema updated if needed

## Work Log

| Date       | Action                   | Learnings                   |
| ---------- | ------------------------ | --------------------------- |
| 2025-11-30 | Created from code review | Type safety violation found |

## Resources

- CLAUDE.md: "No `any`, no type assertions without reason"
