---
status: pending
priority: p2
issue_id: "156"
tags: [code-review, quality, mvp-gaps, duplication]
dependencies: ["155"]
---

# Checkout Session Logic Duplicated 3 Times

## Problem Statement

Identical checkout session creation logic is repeated 3 times with minor variations: wedding checkout, balance checkout, and appointment checkout.

**Why This Matters:**
- 120+ lines of duplicated code
- Bug fixes must be applied 3 times
- Already caused inconsistency in balance payment

## Findings

### Agent: code-simplicity-reviewer

**Location:** `server/src/services/booking.service.ts`
- Lines 133-223 (wedding checkout)
- Lines 292-363 (balance checkout)
- Lines 716-789 (appointment checkout)

**Duplicated patterns:**
1. Idempotency key generation (8 lines)
2. Cached response check (5 lines)
3. Race condition handling (9 lines)
4. Stripe Connect vs Standard logic (15 lines)
5. Response caching (4 lines)

## Proposed Solutions

### Option A: Extract Shared Method (Recommended)
**Pros:** Single source of truth
**Cons:** Requires refactoring
**Effort:** Medium (4-6 hours)
**Risk:** Low

```typescript
private async createCheckoutSession(params: {
  tenantId: string;
  amountCents: number;
  email: string;
  metadata: Record<string, string>;
  applicationFeeAmount: number;
  idempotencyKeyParts: string[];
}): Promise<{ checkoutUrl: string }> {
  // Unified idempotency + race condition + Stripe logic
}
```

## Technical Details

**Affected Files:**
- `server/src/services/booking.service.ts`

## Acceptance Criteria

- [ ] Common checkout logic extracted to shared method
- [ ] All 3 checkout methods use shared implementation
- [ ] 120 lines of duplication removed
- [ ] All tests pass
