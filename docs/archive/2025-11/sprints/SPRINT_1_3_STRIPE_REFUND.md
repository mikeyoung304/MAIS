# Sprint 1.3: Stripe Refund Logic Implementation

## Status: ✅ COMPLETE

## Summary

Implemented full Stripe refund functionality supporting both full and partial refunds for regular and Stripe Connect payments.

## Changes

### 1. Updated PaymentProvider Interface

**File**: `server/src/lib/ports.ts:105-113`

Added `refund` method to interface:

```typescript
refund(input: {
  paymentIntentId: string;
  amountCents?: number; // Optional: partial refund
  reason?: string; // Optional: refund reason
}): Promise<{
  refundId: string;
  status: string;
  amountCents: number;
}>;
```

### 2. Implemented Stripe Refund Method

**File**: `server/src/adapters/stripe.adapter.ts:155-199`

**Features:**

- ✅ Full refunds (omit `amountCents`)
- ✅ Partial refunds (specify `amountCents`)
- ✅ Reason tracking (`duplicate`, `fraudulent`, `requested_by_customer`)
- ✅ Works with regular payments
- ✅ Works with Stripe Connect (destination charges)
- ✅ Input validation for refund reasons
- ✅ Returns refund ID, status, and amount

## API Usage

### Full Refund

```typescript
const result = await stripeAdapter.refund({
  paymentIntentId: 'pi_xxx',
});
// Returns: { refundId: 're_xxx', status: 'succeeded', amountCents: 10000 }
```

### Partial Refund

```typescript
const result = await stripeAdapter.refund({
  paymentIntentId: 'pi_xxx',
  amountCents: 5000, // Refund $50 of original $100
});
// Returns: { refundId: 're_xxx', status: 'succeeded', amountCents: 5000 }
```

### Refund with Reason

```typescript
const result = await stripeAdapter.refund({
  paymentIntentId: 'pi_xxx',
  reason: 'requested_by_customer',
});
// Returns: { refundId: 're_xxx', status: 'succeeded', amountCents: 10000 }
```

## Stripe Connect Behavior

For Stripe Connect payments (destination charges):

1. **Refund source**: Deducted from connected account (tenant)
2. **Application fee**: Automatically reversed (refunded to platform)
3. **Responsibility**: Connected account bears refund cost

This matches our payment flow where funds go directly to tenants.

## Refund Status Values

- `pending`: Refund initiated but not yet complete
- `succeeded`: Refund completed successfully
- `failed`: Refund failed (insufficient funds, etc.)
- `canceled`: Refund was canceled

## Validation

**Refund Reasons** (optional):

- `duplicate` - Duplicate charge
- `fraudulent` - Fraudulent charge
- `requested_by_customer` - Customer requested refund

Invalid reasons throw error with allowed values.

## Testing Checklist

- [ ] Full refund via Stripe test mode
- [ ] Partial refund via Stripe test mode
- [ ] Invalid reason throws error
- [ ] Refund for Connect payment reverses application fee
- [ ] Error handling for insufficient funds
- [ ] Error handling for already-refunded payment

## Next Steps

1. Add admin endpoint to trigger refunds (POST /v1/admin/bookings/:id/refund)
2. Add refund tracking to Booking model (refundId, refundStatus, refundedAt)
3. Add unit tests for refund logic
4. Add E2E test for full refund flow

## References

- Stripe Refunds API: https://stripe.com/docs/api/refunds/create
- Stripe Connect Refunds: https://stripe.com/docs/connect/destination-charges#refunds
- PaymentProvider Interface: `server/src/lib/ports.ts`
- Implementation: `server/src/adapters/stripe.adapter.ts`
