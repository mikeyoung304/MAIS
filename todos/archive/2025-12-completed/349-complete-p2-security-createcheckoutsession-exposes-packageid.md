---
status: complete
priority: p2
issue_id: '349'
tags: [code-review, security, information-disclosure]
dependencies: ['345']
---

# Security: createCheckoutSession Still Exposes Package ID

## Problem Statement

The `createCheckoutSession` method throws `NotFoundError` with `Package ${input.packageId} not found`, exposing the package ID in the error message. This is inconsistent with the P2-345 fix applied to `createDateBooking` and `onPaymentCompleted`.

**Why it matters:** Inconsistent error messaging allows attackers to enumerate valid package IDs through one endpoint while another is protected.

## Findings

**File:** `server/src/services/booking.service.ts:265`

```typescript
// INCONSISTENT with P2-345 pattern applied elsewhere
throw new NotFoundError(`Package ${input.packageId} not found`);
```

**Agents:** typescript-reviewer, architecture-strategist

## Proposed Solutions

### Option A: Apply P2-345 pattern (Recommended)

- **Pros:** Consistent with other methods, follows security best practice
- **Cons:** Less client-side debugging info
- **Effort:** Small
- **Risk:** Low

```typescript
logger.warn({ tenantId, packageId: input.packageId }, 'Package not found in checkout session');
throw new NotFoundError('The requested resource was not found');
```

## Recommended Action

Option A - Apply the same pattern used in P2-345 fix.

## Technical Details

- **Affected files:** `server/src/services/booking.service.ts`
- **Components:** Booking service, checkout flow
- **Database changes:** None

## Acceptance Criteria

- [ ] Error message does not expose package ID to client
- [ ] Package ID is logged internally for debugging
- [ ] Consistent with P1-172 and P2-345 fix patterns

## Work Log

| Date       | Action                   | Learnings                                 |
| ---------- | ------------------------ | ----------------------------------------- |
| 2024-12-24 | Created from code review | Inconsistency found during security audit |

## Resources

- Reference pattern: `booking.service.ts:383` (P2-345 FIX)
- Related: P1-172, P2-344, P2-345
