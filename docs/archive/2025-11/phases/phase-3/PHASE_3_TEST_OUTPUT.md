# Phase 3 - Example Test Output

This document shows expected output from the Phase 3 testing scripts.

## Commission Calculation Test

**Command:**

```bash
npm run test:commission
```

**Expected Output:**

```
🧪 Testing Commission Calculation Service

✓ Found Tenant A: Tenant A (10% commission)

Test 1: Tenant A - $500.00 booking
  Expected: $50.00 commission (5000 cents)
  Actual:   $50.00 commission (5000 cents)
  Rate:     10%
  ✅ PASS

✓ Found Tenant B: Tenant B (12.5% commission)

Test 2: Tenant B - $500.00 booking
  Expected: $62.50 commission (6250 cents)
  Actual:   $62.50 commission (6250 cents)
  Rate:     12.5%
  ✅ PASS

✓ Found Tenant C: Tenant C (15% commission)

Test 3: Tenant C - $500.00 booking
  Expected: $75.00 commission (7500 cents)
  Actual:   $75.00 commission (7500 cents)
  Rate:     15%
  ✅ PASS

Test 4: Full booking calculation (Tenant B)
  Package:       $500.00
  Add-ons:       $0.00
  Subtotal:      $500.00
  Commission:    $62.50 (12.5%)
  Tenant Gets:   $437.50
  ✅ PASS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ALL COMMISSION CALCULATIONS CORRECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Interpretation:**

- ✅ All commission rates calculate correctly
- ✅ Rounding strategy works (ceiling for platform)
- ✅ Booking breakdown accurate
- ✅ Tenant receives correct net amount

---

## Stripe Connect Integration Test

**Command:**

```bash
npm run test:stripe-connect
```

**Expected Output:**

```
🧪 Testing Stripe Connect Integration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 STEP 1: Create Test Tenant

✓ Created new test tenant: Stripe Test Tenant
  Tenant ID: clx1a2b3c4d5e6f7g8h9i0j1
  Commission: 12%


💳 STEP 2: Create Stripe Connected Account

Creating new Stripe Express account...
✓ Created Stripe account: acct_1ABC2DEF3GHI4JKL
  Email: test-1699123456@stripetestaccount.com
  Type: express
  Charges enabled: false
  Payouts enabled: false
✓ Updated tenant with Stripe account ID

⚠️  NOTE: Account not fully onboarded
In production, redirect tenant to onboarding:
  const accountLink = await stripe.accountLinks.create({
    account: 'acct_1ABC2DEF3GHI4JKL',
    refresh_url: "http://localhost:3000/stripe/reauth",
    return_url: "http://localhost:3000/stripe/complete",
    type: "account_onboarding",
  });
  // Redirect to: accountLink.url


🧮 STEP 3: Test Commission Calculation

Booking Amount: $500.00
Commission Rate: 12%
Commission Amount: $60.00 (6000 cents)
Tenant Receives: $440.00
✅ Commission calculation correct!


📦 STEP 4: Test Full Booking Calculation

Booking Breakdown:
  Package Price:     $500.00
  Add-ons Total:     $0.00
  ─────────────────────────────────────
  Subtotal:          $500.00
  Platform Fee:      $60.00 (12%)
  ─────────────────────────────────────
  Tenant Receives:   $440.00
✅ Full calculation correct!


💸 STEP 5: Verify Stripe Connect Payment Flow

Testing PaymentIntent with application fee...
✓ Created PaymentIntent: pi_3ABC123DEF456GHI789
  Status: requires_payment_method
  Amount: $500.00
  App Fee: $60.00
  Destination: acct_1ABC2DEF3GHI4JKL

📝 Next steps to complete payment:
  1. Use Stripe test card: 4242 4242 4242 4242
  2. Any future expiry (e.g., 12/34)
  3. Any 3-digit CVC
  4. Confirm PaymentIntent: pi_3ABC123DEF456GHI789
✓ Cancelled test PaymentIntent (cleanup)


↩️  STEP 6: Test Refund Commission Calculation

Full refund ($500.00):
  Commission returned: $60.00

Partial refund ($250.00):
  Commission returned: $30.00
✅ Refund calculations correct!


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ALL TESTS PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary:
  Tenant: Stripe Test Tenant (stripe-test-tenant)
  Tenant ID: clx1a2b3c4d5e6f7g8h9i0j1
  Stripe Account: acct_1ABC2DEF3GHI4JKL
  Commission Rate: 12%
  Test Amount: $500.00
  Platform Fee: $60.00
  Tenant Gets: $440.00

✨ Stripe Connect is working correctly!

Next steps:
  1. Review STRIPE_CONNECT_TESTING_GUIDE.md for detailed testing
  2. Test webhook integration with `stripe listen`
  3. Test complete payment flow with test cards
  4. Verify commission split in Stripe Dashboard
  5. Test refund scenarios
```

**Interpretation:**

- ✅ Tenant created successfully
- ✅ Stripe Connected Account created
- ✅ Commission calculated correctly
- ✅ PaymentIntent created with application fee
- ✅ Refund calculations accurate
- ⚠️ Account onboarding needed for production (expected)

---

## Webhook Testing

**Command:**

```bash
# Terminal 1
npm run dev

# Terminal 2
stripe listen --forward-to localhost:3001/api/webhooks/stripe
stripe trigger payment_intent.succeeded
```

**Expected Output (Terminal 2):**

```
> Ready! Your webhook signing secret is whsec_ABC123DEF456GHI789 (^C to quit)
2024-11-06 12:34:56   --> payment_intent.succeeded [evt_ABC123]
2024-11-06 12:34:56   <--  [200] POST http://localhost:3001/api/webhooks/stripe [evt_ABC123]
```

**Expected Output (Server logs):**

```json
{
  "level": "info",
  "time": 1699123456789,
  "msg": "Webhook event received",
  "eventId": "evt_ABC123",
  "eventType": "payment_intent.succeeded",
  "tenantId": "clx1a2b3c4d5e6f7g8h9i0j1"
}
{
  "level": "info",
  "time": 1699123456790,
  "msg": "Webhook processed successfully",
  "eventId": "evt_ABC123",
  "status": "PROCESSED"
}
```

**Database Verification:**

```sql
SELECT * FROM "WebhookEvent"
WHERE "eventId" = 'evt_ABC123';
```

**Expected Result:**

```
id    | eventId   | eventType                    | status    | attempts | processedAt
------+-----------+------------------------------+-----------+----------+-------------
uuid  | evt_ABC123| payment_intent.succeeded     | PROCESSED | 1        | 2024-11-06...
```

---

## Error Scenarios

### Missing Stripe Key

**Command:**

```bash
# Remove STRIPE_SECRET_KEY from .env
npm run test:stripe-connect
```

**Expected Output:**

```
❌ STRIPE_SECRET_KEY not found in environment variables
Please add your Stripe test key to .env:
STRIPE_SECRET_KEY=sk_test_...
```

### Invalid Webhook Signature

**Server logs:**

```json
{
  "level": "error",
  "time": 1699123456789,
  "msg": "Webhook signature verification failed",
  "error": "No signatures found matching the expected signature for payload"
}
```

**Response:**

```
HTTP 400 Bad Request
{
  "error": "Webhook signature verification failed"
}
```

### Commission Rate Too High

**Command:**

```sql
-- Set commission to 60% (above Stripe limit)
UPDATE "Tenant"
SET "commissionPercent" = 60.0
WHERE slug = 'test-tenant';
```

**Expected Behavior:**
Service logs warning and adjusts to maximum (50%):

```json
{
  "level": "warn",
  "msg": "Commission above Stripe maximum (50%), adjusting to maximum",
  "tenantId": "clx1a2b3c4d5e6f7g8h9i0j1",
  "commissionPercent": 60,
  "calculatedCommission": 30000,
  "maxCommission": 25000
}
```

---

## Performance Benchmarks

### Commission Calculation

```
Operation: calculateCommission()
Iterations: 1,000
Average time: 2.3ms
P95: 4.1ms
P99: 6.8ms
```

### Database Queries

```
Query: Get tenant commission rate
Average: 1.2ms

Query: Create booking with commission
Average: 8.5ms

Query: Process webhook event
Average: 12.3ms
```

### Stripe API Calls

```
Operation: Create Connected Account
Average: 450ms

Operation: Create PaymentIntent
Average: 320ms

Operation: Verify Webhook
Average: 5ms (local)
```

---

## Test Coverage

### Commission Service

```
File                          | % Stmts | % Branch | % Funcs | % Lines
------------------------------|---------|----------|---------|--------
commission.service.ts         |   100   |   100    |   100   |   100
```

**Covered scenarios:**

- ✅ Standard commission rates (10%, 12.5%, 15%)
- ✅ Edge case: 0.5% (minimum)
- ✅ Edge case: 50% (maximum)
- ✅ Edge case: Rounding up (ceiling)
- ✅ Error: Tenant not found
- ✅ Error: Invalid commission percent
- ✅ Booking with add-ons
- ✅ Full refund calculation
- ✅ Partial refund calculation

### Webhook Processing

```
File                          | % Stmts | % Branch | % Funcs | % Lines
------------------------------|---------|----------|---------|--------
webhooks.routes.ts            |   95    |   90     |   100   |   95
```

**Covered scenarios:**

- ✅ Valid webhook signature
- ✅ Invalid webhook signature
- ✅ Duplicate event (idempotency)
- ✅ payment_intent.succeeded
- ✅ payment_intent.payment_failed
- ✅ charge.refunded
- ✅ Unknown event type
- ✅ Database error handling

---

## Manual Testing Checklist

Use this checklist when performing manual QA:

### Payment Flow

- [ ] Create booking with test card `4242 4242 4242 4242`
  - [ ] Payment succeeds
  - [ ] Booking status updated to CONFIRMED
  - [ ] Commission recorded correctly
  - [ ] Webhook event logged

- [ ] Create booking with declined card `4000 0000 0000 0002`
  - [ ] Payment fails
  - [ ] Booking status remains PENDING
  - [ ] Error message shown to user
  - [ ] Webhook event logged

- [ ] Create booking with 3D Secure card `4000 0025 0000 3155`
  - [ ] 3D Secure challenge shown
  - [ ] After authentication, payment succeeds
  - [ ] Booking confirmed

### Commission Verification

- [ ] Open Stripe Dashboard → Balance
  - [ ] Platform balance shows commission amount
  - [ ] Connected account balance shows net amount

- [ ] Query database
  ```sql
  SELECT
    "totalPrice" / 100.0 as total,
    "commissionAmount" / 100.0 as commission,
    ("totalPrice" - "commissionAmount") / 100.0 as tenant_receives
  FROM "Booking"
  WHERE id = 'booking_id';
  ```

  - [ ] Values match expected amounts

### Refund Testing

- [ ] Full refund via Stripe Dashboard
  - [ ] Booking status updated
  - [ ] Full amount returned to customer
  - [ ] Commission fully reversed

- [ ] Partial refund (50%)
  - [ ] Half amount returned to customer
  - [ ] 50% of commission reversed
  - [ ] Database updated correctly

---

## Troubleshooting Common Issues

### Issue: "Account charges_enabled must be true"

**Cause:** Connected account not fully onboarded

**Solution:**

```typescript
// Create account link for onboarding
const accountLink = await stripe.accountLinks.create({
  account: 'acct_...',
  refresh_url: 'http://localhost:3000/stripe/reauth',
  return_url: 'http://localhost:3000/stripe/complete',
  type: 'account_onboarding',
});
// Redirect tenant to: accountLink.url
```

### Issue: "Application fee amount too large"

**Cause:** Commission exceeds 50% of booking total

**Solution:**

```sql
-- Check commission rate
SELECT "commissionPercent" FROM "Tenant" WHERE id = '...';

-- Adjust if needed (must be <= 50%)
UPDATE "Tenant"
SET "commissionPercent" = 15.0
WHERE id = '...';
```

### Issue: Webhook not processing

**Checklist:**

- [ ] `stripe listen` running?
- [ ] Correct webhook URL?
- [ ] `STRIPE_WEBHOOK_SECRET` in `.env`?
- [ ] Raw body preserved in Express?
- [ ] Server logs show signature error?

**Debug:**

```bash
# Check webhook secret
echo $STRIPE_WEBHOOK_SECRET

# Test webhook manually
curl -X POST http://localhost:3001/api/webhooks/stripe \
  -H "stripe-signature: test" \
  -d '{}'
```

---

## Next Steps

After verifying all tests pass:

1. **Review Documentation**
   - `/Users/mikeyoung/CODING/Elope/server/STRIPE_CONNECT_TESTING_GUIDE.md`
   - `/Users/mikeyoung/CODING/Elope/server/ENV_VARIABLES.md`
   - `/Users/mikeyoung/CODING/Elope/server/PHASE_3_COMPLETION_CHECKLIST.md`

2. **Complete Manual Testing**
   - Test all scenarios in checklist above
   - Verify in Stripe Dashboard
   - Check database records

3. **Security Review**
   - Verify no secrets in code
   - Webhook verification enabled
   - Tenant isolation enforced

4. **Production Preparation**
   - Switch to production Stripe keys
   - Configure production webhooks
   - Set up monitoring/alerts

5. **Proceed to Phase 4**
   - Widget embedding
   - Public API
   - Tenant branding
