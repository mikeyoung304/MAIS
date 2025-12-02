---
status: complete
priority: p1
issue_id: "148"
tags: [code-review, financial, mvp-gaps, deposits]
dependencies: []
---

# Commission Calculation Error for Deposits

## Problem Statement

Commission is only charged on the balance payment, not proportionally across deposit and balance. This causes the platform to lose 50% of expected revenue on deposit-enabled bookings.

**Why This Matters:**
- Platform loses 50% of commission revenue
- Financial model broken for deposit bookings
- Business impact is significant

## Findings

### Agent: architecture-strategist

**Location:** `server/src/services/booking.service.ts:201-203`

**Evidence:**
```typescript
applicationFeeAmount: isDeposit ? 0 : calculation.commissionAmount
```

**Calculation Error:**
- Booking: $1000
- Deposit (50%): $500
- Commission (10%): Should be $100 total
- **Actual:** $0 on deposit + $50 on balance = **$50 total** (lost 50% commission!)

## Proposed Solutions

### Option A: Proportional Commission Split (Recommended)
**Pros:** Fair commission split, matches expected revenue
**Cons:** Requires calculation change
**Effort:** Small (2-3 hours)
**Risk:** Low

```typescript
// Commission should be (fullTotal * commissionPercent), split proportionally
const depositCommission = Math.round((calculation.commissionAmount * depositPercent) / 100);
const balanceCommission = calculation.commissionAmount - depositCommission;

// In createCheckout:
applicationFeeAmount: isDeposit ? depositCommission : 0

// In createBalancePaymentCheckout:
applicationFeeAmount: balanceCommission
```

### Option B: Full Commission on Deposit
**Pros:** Simpler
**Cons:** May cause cash flow issues for tenants
**Effort:** Minimal
**Risk:** Medium (tenant pushback)

### Option C: Full Commission on Balance
**Pros:** Current behavior
**Cons:** Revenue loss on cancelled bookings (no balance paid)
**Effort:** None
**Risk:** High (revenue loss)

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `server/src/services/booking.service.ts`

**Components:** Checkout creation, commission calculation

## Acceptance Criteria

- [ ] Commission split proportionally between deposit and balance
- [ ] Total commission equals expected amount (fullTotal * commissionPercent)
- [ ] Unit test verifies commission calculation for deposit bookings
- [ ] Financial reconciliation matches expected revenue

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-02 | Created | From MVP gaps code review |

## Resources

- PR: MVP gaps implementation (uncommitted)
- Business: Commission model documentation
