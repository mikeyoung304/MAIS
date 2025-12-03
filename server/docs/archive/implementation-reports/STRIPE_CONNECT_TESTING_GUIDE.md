# Stripe Connect Testing Guide

## Overview

This guide covers testing the Stripe Connect integration for Phase 3 of the multi-tenant architecture. Stripe Connect allows each tenant (wedding business) to receive payments directly to their own Stripe account, while the platform automatically collects a commission.

## Prerequisites

### 1. Stripe Test Account
- Sign up at https://dashboard.stripe.com
- Use **Test Mode** (toggle in top-right corner)
- Never use production keys during testing

### 2. Environment Variables
Ensure your `/Users/mikeyoung/CODING/Elope/server/.env` contains:

```bash
# Stripe Test Mode Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Checkout URLs
STRIPE_SUCCESS_URL=http://localhost:3000/success
STRIPE_CANCEL_URL=http://localhost:3000
```

**Get Your Keys:**
1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy **Publishable key** (starts with `pk_test_`)
3. Reveal and copy **Secret key** (starts with `sk_test_`)

### 3. Stripe CLI (for webhook testing)
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to your Stripe account
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

This will output a webhook signing secret like `whsec_...` - add it to your `.env`

---

## Testing Scenarios

### Scenario 1: Create Test Connected Account

Stripe Connect requires each tenant to have a connected Stripe account. In test mode, you can create test accounts instantly.

**Option A: Use Stripe Dashboard**
1. Go to https://dashboard.stripe.com/test/connect/accounts/overview
2. Click "Add account"
3. Fill in test business details:
   - Business name: "Bella Weddings Test"
   - Country: United States
   - Email: test@bellaweddings.com
4. Copy the Account ID (starts with `acct_...`)

**Option B: Use Stripe API (Programmatic)**
```typescript
// See scripts/test-stripe-connect.ts for automated approach
const account = await stripe.accounts.create({
  type: 'express', // or 'standard'
  country: 'US',
  email: 'tenant@example.com',
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
});
console.log('Account ID:', account.id);
```

**Update Tenant:**
```sql
UPDATE "Tenant"
SET "stripeAccountId" = 'acct_...',
    "stripeOnboarded" = true
WHERE slug = 'tenant-a';
```

---

### Scenario 2: Simulate Onboarding Flow

In production, tenants complete Stripe onboarding via an **Account Link**:

```typescript
const accountLink = await stripe.accountLinks.create({
  account: 'acct_...', // Tenant's connected account
  refresh_url: 'http://localhost:3000/stripe/reauth',
  return_url: 'http://localhost:3000/stripe/complete',
  type: 'account_onboarding',
});

// Redirect tenant to: accountLink.url
```

**Test Mode Shortcut:**
- Stripe provides a test onboarding URL
- All test accounts can be instantly activated
- No need to fill out KYC/bank details

**Verification:**
```typescript
const account = await stripe.accounts.retrieve('acct_...');
console.log('Charges enabled:', account.charges_enabled);
console.log('Payouts enabled:', account.payouts_enabled);
```

---

### Scenario 3: Create Test Booking with Commission

**Step 1: Calculate Commission**

Our commission service automatically calculates the platform fee:

```bash
cd /Users/mikeyoung/CODING/Elope/server
npm run test:commission
```

Expected output:
```
Test 1: Tenant A - $500.00 booking
  Expected: $50.00 commission (5000 cents)
  Actual:   $50.00 commission (5000 cents)
  Rate:     10%
  ✅ PASS
```

**Step 2: Create Payment Intent with Commission**

```typescript
// Application fee amount is calculated server-side
const paymentIntent = await stripe.paymentIntents.create({
  amount: 50000, // $500.00
  currency: 'usd',
  application_fee_amount: 5000, // $50.00 commission (10%)
  transfer_data: {
    destination: 'acct_...', // Tenant's connected account
  },
  metadata: {
    tenantId: 'tenant_abc',
    bookingId: 'booking_xyz',
  },
});
```

**Step 3: Complete Test Payment**

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`
- Any future expiration date (e.g., 12/34)
- Any 3-digit CVC

---

### Scenario 4: Verify Commission Split

After a successful payment, verify the funds distribution:

**Check Platform Balance:**
```bash
stripe balance
```

**Check Connected Account Balance:**
```bash
stripe balance --stripe-account acct_...
```

**Expected Results:**
- Platform receives: $50.00 (commission)
- Tenant receives: $450.00 (net after commission)

**Query Booking Record:**
```sql
SELECT
  id,
  "totalPrice" / 100.0 as total_dollars,
  "commissionAmount" / 100.0 as commission_dollars,
  "commissionPercent" as commission_rate,
  ("totalPrice" - "commissionAmount") / 100.0 as tenant_receives
FROM "Booking"
WHERE id = 'booking_xyz';
```

---

### Scenario 5: Test Webhooks

Stripe sends webhook events for payment lifecycle:

**Important Events:**
- `payment_intent.succeeded` - Payment completed
- `payment_intent.payment_failed` - Payment failed
- `charge.refunded` - Refund processed
- `account.updated` - Connected account changed

**Start Webhook Listener:**
```bash
# Terminal 1: Run server
cd /Users/mikeyoung/CODING/Elope/server
npm run dev

# Terminal 2: Forward webhooks
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

**Trigger Test Event:**
```bash
stripe trigger payment_intent.succeeded
```

**Verify Event Processing:**
```sql
SELECT * FROM "WebhookEvent"
ORDER BY "createdAt" DESC
LIMIT 10;
```

Expected status: `PROCESSED`

---

### Scenario 6: Test Refunds

Refunds automatically reverse the commission proportionally:

**Full Refund:**
```typescript
const refund = await stripe.refunds.create({
  payment_intent: 'pi_...',
  reverse_transfer: true, // Reverses transfer to connected account
  refund_application_fee: true, // Reverses platform commission
});
```

Result:
- Customer receives: $500.00
- Platform returns: $50.00 (commission reversed)
- Tenant returns: $450.00 (net reversed)

**Partial Refund ($250):**
```typescript
const refund = await stripe.refunds.create({
  payment_intent: 'pi_...',
  amount: 25000, // $250.00
  reverse_transfer: true,
  refund_application_fee: true,
});
```

Result:
- Customer receives: $250.00
- Platform returns: $25.00 (50% of commission)
- Tenant returns: $225.00 (50% of net)

---

## Automated Testing Script

Run the complete integration test:

```bash
cd /Users/mikeyoung/CODING/Elope/server
npm run test:stripe-connect
```

This script will:
1. Create a test tenant with 12% commission
2. Create a Stripe Connected Account
3. Create a test booking ($500.00)
4. Calculate commission ($60.00)
5. Verify commission calculation
6. Print detailed results

---

## Test Checklist

### Basic Integration
- [ ] Stripe test keys configured in `.env`
- [ ] Stripe CLI installed and authenticated
- [ ] Webhook listener running locally

### Connected Accounts
- [ ] Can create test connected account
- [ ] Can retrieve account details
- [ ] Account has charges enabled
- [ ] Tenant record updated with `stripeAccountId`

### Payment Flow
- [ ] Can create checkout session with commission
- [ ] Commission calculated correctly (matches tenant rate)
- [ ] Test card payment succeeds
- [ ] Funds split correctly (platform + tenant)
- [ ] Booking record created with commission details

### Webhooks
- [ ] `payment_intent.succeeded` webhook received
- [ ] Webhook signature verified
- [ ] Webhook event stored in database
- [ ] Booking status updated to CONFIRMED

### Commission Calculation
- [ ] 10% commission calculates correctly
- [ ] 12.5% commission calculates correctly
- [ ] 15% commission calculates correctly
- [ ] Rounding always favors platform (ceiling)
- [ ] Commission within Stripe limits (0.5% - 50%)

### Edge Cases
- [ ] Handles missing connected account gracefully
- [ ] Handles non-onboarded account gracefully
- [ ] Handles invalid commission percent
- [ ] Handles webhook signature verification failure
- [ ] Handles duplicate webhook events (idempotency)

### Security
- [ ] API keys never exposed to client
- [ ] Webhook secret verified on all events
- [ ] Tenant isolation enforced (no cross-tenant payments)
- [ ] Commission amount validated server-side
- [ ] Connected account validated before payment

---

## Common Issues & Solutions

### Issue: "No such account: acct_..."
**Cause:** Connected account doesn't exist or was deleted.
**Solution:** Create a new test account via Stripe Dashboard or API.

### Issue: "The account must have at least one of the following capabilities enabled: transfers"
**Cause:** Connected account not fully set up.
**Solution:** Enable capabilities:
```typescript
await stripe.accounts.update('acct_...', {
  capabilities: {
    transfers: { requested: true },
  },
});
```

### Issue: "Webhook signature verification failed"
**Cause:** Wrong `STRIPE_WEBHOOK_SECRET` in `.env`.
**Solution:** Copy secret from `stripe listen` output.

### Issue: "Application fee amount too large"
**Cause:** Commission exceeds 50% of total.
**Solution:** Verify tenant `commissionPercent` is reasonable (10-15%).

### Issue: Commission calculation incorrect
**Cause:** Rounding error or incorrect formula.
**Solution:** Review `CommissionService.calculateCommission()` - should use `Math.ceil()`.

---

## Production Checklist

Before deploying to production:

### Stripe Configuration
- [ ] Switch to production Stripe keys
- [ ] Configure production webhook endpoint
- [ ] Set up webhook URL in Stripe Dashboard
- [ ] Enable webhook events: `payment_intent.*`, `charge.refunded`, `account.updated`
- [ ] Test webhook delivery in production

### Connected Accounts
- [ ] Production onboarding flow implemented
- [ ] Account Links configured correctly
- [ ] Return/refresh URLs point to production domain
- [ ] Error handling for failed onboarding

### Security
- [ ] All Stripe keys stored in secure environment variables
- [ ] Never log sensitive data (keys, account IDs)
- [ ] Webhook signature verification mandatory
- [ ] Rate limiting on payment endpoints
- [ ] HTTPS enforced on all endpoints

### Monitoring
- [ ] Log all payment attempts (success/failure)
- [ ] Alert on webhook processing failures
- [ ] Monitor commission calculation accuracy
- [ ] Track connected account status changes
- [ ] Set up Stripe Dashboard alerts

### Compliance
- [ ] Commission rates documented in tenant agreements
- [ ] Platform fee disclosure shown to customers
- [ ] Refund policy documented
- [ ] PCI compliance verified (Stripe handles card data)

---

## Resources

### Documentation
- [Stripe Connect Overview](https://stripe.com/docs/connect)
- [Application Fees](https://stripe.com/docs/connect/direct-charges#collecting-fees)
- [Testing Connect](https://stripe.com/docs/connect/testing)
- [Webhook Reference](https://stripe.com/docs/webhooks)

### Test Cards
- https://stripe.com/docs/testing#cards

### Stripe CLI
- https://stripe.com/docs/stripe-cli

### Support
- Stripe Discord: https://discord.gg/stripe
- Stripe Support: support@stripe.com

---

## Next Steps

After testing is complete:
1. Review security configuration
2. Implement production webhook handler
3. Add monitoring and alerting
4. Document tenant onboarding process
5. Proceed to Phase 4: Widget embedding
