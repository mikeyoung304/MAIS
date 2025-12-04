# Stripe Connect Service - Quick Start

## Setup (5 minutes)

### 1. Environment Variables

Add to your `.env` file:

```bash
# Platform Stripe Account
STRIPE_SECRET_KEY=sk_test_51...

# Webhook Verification
STRIPE_WEBHOOK_SECRET=whsec_...

# Encryption Key (generate with: openssl rand -hex 32)
TENANT_SECRETS_ENCRYPTION_KEY=your_64_character_hex_string_here
```

### 2. Verify Service is Registered

The service is automatically available in the DI container:

```typescript
import { buildContainer } from './di';
import { loadConfig } from './lib/core/config';

const container = buildContainer(loadConfig());
const stripeConnect = container.services.stripeConnect;
```

---

## Common Tasks

### Create Stripe Account for Tenant

```typescript
const accountId = await stripeConnect.createConnectedAccount(
  'tenant_123',
  'owner@business.com',
  'Business Name'
);
```

### Generate Onboarding Link

```typescript
const url = await stripeConnect.createOnboardingLink(
  'tenant_123',
  'https://yourapp.com/onboarding/refresh',
  'https://yourapp.com/onboarding/complete'
);
// Send this URL to tenant
```

### Check if Onboarding Complete

```typescript
const isReady = await stripeConnect.checkOnboardingStatus('tenant_123');
if (isReady) {
  console.log('Tenant can accept payments!');
}
```

### Create Dashboard Link

```typescript
const dashboardUrl = await stripeConnect.createLoginLink('tenant_123');
// Redirect tenant to manage their Stripe account
```

---

## API Methods Reference

| Method                                                            | Purpose                        | Returns                           |
| ----------------------------------------------------------------- | ------------------------------ | --------------------------------- |
| `createConnectedAccount(tenantId, email, businessName, country?)` | Create Stripe Express account  | `Promise<string>` (account ID)    |
| `createOnboardingLink(tenantId, refreshUrl, returnUrl)`           | Generate onboarding URL        | `Promise<string>` (URL)           |
| `checkOnboardingStatus(tenantId)`                                 | Check if onboarding complete   | `Promise<boolean>`                |
| `storeRestrictedKey(tenantId, restrictedKey)`                     | Encrypt & store Stripe key     | `Promise<void>`                   |
| `getRestrictedKey(tenantId)`                                      | Decrypt & retrieve Stripe key  | `Promise<string \| null>`         |
| `getAccountDetails(tenantId)`                                     | Get full Stripe account object | `Promise<Stripe.Account \| null>` |
| `createLoginLink(tenantId)`                                       | Create Express dashboard link  | `Promise<string>` (URL)           |
| `deleteConnectedAccount(tenantId)`                                | Delete account (irreversible!) | `Promise<void>`                   |

---

## Complete Onboarding Flow

```typescript
// 1. Create account
const accountId = await stripeConnect.createConnectedAccount(
  tenantId,
  'owner@business.com',
  'Business Name'
);

// 2. Generate onboarding link
const onboardingUrl = await stripeConnect.createOnboardingLink(
  tenantId,
  'https://yourapp.com/onboarding/refresh',
  'https://yourapp.com/onboarding/complete'
);

// 3. Redirect tenant to onboardingUrl
// ... tenant completes Stripe onboarding ...

// 4. Check status when they return
const isOnboarded = await stripeConnect.checkOnboardingStatus(tenantId);

if (isOnboarded) {
  // Tenant ready to accept payments!
}
```

---

## Integration with Booking Payment

```typescript
import Stripe from 'stripe';

// Get tenant's Stripe account
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { stripeAccountId: true, stripeOnboarded: true },
});

if (!tenant?.stripeOnboarded) {
  throw new Error('Tenant not ready to accept payments');
}

// Create payment with commission
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const paymentIntent = await stripe.paymentIntents.create({
  amount: 50000, // $500.00
  currency: 'usd',
  application_fee_amount: 6000, // $60.00 commission (12%)
  transfer_data: {
    destination: tenant.stripeAccountId!, // Tenant receives $440.00
  },
});
```

---

## Troubleshooting

### "STRIPE_SECRET_KEY environment variable is required"

- Set `STRIPE_SECRET_KEY` in your `.env` file
- Use test key: `sk_test_...` for development

### "TENANT_SECRETS_ENCRYPTION_KEY environment variable is required"

- Generate key: `openssl rand -hex 32`
- Add to `.env` file (64 hex characters)

### "Tenant does not have a Stripe account"

- Call `createConnectedAccount()` first
- Check `tenant.stripeAccountId` is set in database

### Onboarding link doesn't work

- Links expire after 24 hours
- Generate new link with `createOnboardingLink()`
- Ensure refresh/return URLs are HTTPS in production

---

## Testing

### Test Mode

Always use test keys during development:

```bash
STRIPE_SECRET_KEY=sk_test_...  # NOT sk_live_
```

### Test Onboarding

1. Create test account
2. Generate onboarding link
3. Use Stripe's test data to complete form
4. Check status returns `true`

### Test Webhooks

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```

---

## Security Notes

- ✅ Stripe keys are encrypted using AES-256-GCM
- ✅ Master encryption key stored in environment variable
- ✅ Each tenant has isolated Stripe account
- ✅ Platform cannot access tenant bank accounts
- ❌ Never log decrypted Stripe keys
- ❌ Never expose encryption key in client code

---

## Next Steps

1. ✅ Service is ready to use
2. Create API routes for tenant onboarding
3. Add webhook handler for account updates
4. Implement dashboard link in tenant UI
5. Test with real Stripe onboarding flow

For detailed examples, see: `STRIPE_CONNECT_USAGE_EXAMPLES.md`
