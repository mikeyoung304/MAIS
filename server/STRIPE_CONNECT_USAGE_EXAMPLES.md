# Stripe Connect Service - Usage Examples

## Overview

The `StripeConnectService` manages Stripe Connect Express accounts for multi-tenant payment processing. Each tenant gets their own Stripe account to receive payments directly, while the platform deducts commission automatically.

**Location:** `server/src/services/stripe-connect.service.ts`

**Registered in DI Container:** `container.services.stripeConnect`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Platform (Elope)                                            │
│  - Manages Stripe Connect accounts                           │
│  - Deducts commission via application_fee_amount            │
│  - Controls customer checkout experience                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Creates Express Accounts
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Tenant (Wedding Business)                                  │
│  - Has Stripe Express Connected Account                    │
│  - Receives payments directly to bank account              │
│  - Completes onboarding via Stripe-hosted flow             │
│  - Encrypted restricted keys stored in database            │
└─────────────────────────────────────────────────────────────┘
```

---

## Required Environment Variables

```bash
# Platform Stripe Account (required)
STRIPE_SECRET_KEY=sk_test_...

# Webhook signature verification (required)
STRIPE_WEBHOOK_SECRET=whsec_...

# Master encryption key for storing tenant Stripe keys (required)
# Generate with: openssl rand -hex 32
TENANT_SECRETS_ENCRYPTION_KEY=your_64_char_hex_string
```

---

## Example 1: Create Connected Account for New Tenant

```typescript
import { buildContainer } from './di';
import { loadConfig } from './lib/core/config';

const config = loadConfig();
const container = buildContainer(config);
const stripeConnect = container.services.stripeConnect;

async function setupNewTenant() {
  const tenantId = 'cuid_tenant_123';
  const businessEmail = 'owner@bellaweddings.com';
  const businessName = 'Bella Weddings';

  try {
    // Step 1: Create Stripe Express Connected Account
    const stripeAccountId = await stripeConnect.createConnectedAccount(
      tenantId,
      businessEmail,
      businessName,
      'US' // Country code (default: 'US')
    );

    console.log('✅ Stripe account created:', stripeAccountId);
    // Output: acct_1234567890abcdef
  } catch (error) {
    console.error('❌ Failed to create Stripe account:', error);
  }
}
```

**Result:**

- Stripe Express account created
- `tenant.stripeAccountId` set to `acct_...`
- `tenant.stripeOnboarded` set to `false` (pending onboarding)

---

## Example 2: Generate Onboarding Link

After creating the account, tenant must complete Stripe onboarding:

```typescript
async function generateOnboardingForTenant(tenantId: string) {
  try {
    // URLs for tenant to return to after onboarding
    const refreshUrl = 'https://yourdomain.com/onboarding/refresh';
    const returnUrl = 'https://yourdomain.com/onboarding/complete';

    const onboardingUrl = await stripeConnect.createOnboardingLink(tenantId, refreshUrl, returnUrl);

    console.log('✅ Onboarding URL:', onboardingUrl);
    // Tenant completes onboarding at this URL

    // URL expires after 24 hours
    // Redirect tenant to onboardingUrl
  } catch (error) {
    console.error('❌ Failed to create onboarding link:', error);
  }
}
```

**Onboarding Flow:**

1. Platform generates onboarding link
2. Tenant clicks link → redirected to Stripe
3. Tenant fills out business info, bank details, tax info
4. On success → redirected to `returnUrl`
5. On failure → redirected to `refreshUrl` (can regenerate link)

---

## Example 3: Check Onboarding Status

After tenant completes onboarding, verify their status:

```typescript
async function checkTenantOnboardingStatus(tenantId: string) {
  try {
    const isOnboarded = await stripeConnect.checkOnboardingStatus(tenantId);

    if (isOnboarded) {
      console.log('✅ Tenant onboarding complete! Can accept payments.');
      // Update UI to show "Ready to accept payments"
    } else {
      console.log('⏳ Tenant onboarding incomplete');
      // Prompt tenant to complete onboarding
    }

    return isOnboarded;
  } catch (error) {
    console.error('❌ Failed to check onboarding status:', error);
  }
}
```

**Database Update:**

- Sets `tenant.stripeOnboarded = true` if `account.charges_enabled === true`

---

## Example 4: Store Encrypted Stripe Restricted Key

For advanced use cases, store tenant's restricted API key:

```typescript
async function storeRestrictedKeyForTenant(tenantId: string, restrictedKey: string) {
  try {
    // Validate key format
    if (!restrictedKey.startsWith('sk_test_') && !restrictedKey.startsWith('sk_live_')) {
      throw new Error('Invalid Stripe key format');
    }

    // Store encrypted in database
    await stripeConnect.storeRestrictedKey(tenantId, restrictedKey);

    console.log('✅ Encrypted Stripe key stored for tenant');
  } catch (error) {
    console.error('❌ Failed to store restricted key:', error);
  }
}
```

**Security:**

- Key encrypted using AES-256-GCM
- Stored in `tenant.secrets.stripe` JSON field
- Only decryptable with `TENANT_SECRETS_ENCRYPTION_KEY`

---

## Example 5: Retrieve Decrypted Stripe Key

```typescript
async function getDecryptedKeyForTenant(tenantId: string) {
  try {
    const restrictedKey = await stripeConnect.getRestrictedKey(tenantId);

    if (restrictedKey) {
      console.log('✅ Retrieved decrypted Stripe key');
      // Use key to create payment intents on tenant's behalf

      // Example: Create tenant Stripe client
      const tenantStripe = new Stripe(restrictedKey, {
        apiVersion: '2025-09-30.clover',
      });

      return tenantStripe;
    } else {
      console.log('⚠️  No Stripe key found for tenant');
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to retrieve Stripe key:', error);
  }
}
```

---

## Example 6: Create Stripe Dashboard Login Link

Allow tenant to access their Stripe Express dashboard:

```typescript
async function generateDashboardLink(tenantId: string) {
  try {
    const dashboardUrl = await stripeConnect.createLoginLink(tenantId);

    console.log('✅ Dashboard URL:', dashboardUrl);
    // URL expires after 5 minutes

    // Redirect tenant to dashboardUrl
    // They can view payouts, transactions, settings
  } catch (error) {
    console.error('❌ Failed to create dashboard link:', error);
  }
}
```

**Use Case:**

- Tenant wants to view payout schedule
- Tenant wants to update bank account
- Tenant wants to see transaction history

---

## Example 7: Get Account Details

Retrieve full Stripe account object:

```typescript
async function getTenantAccountInfo(tenantId: string) {
  try {
    const account = await stripeConnect.getAccountDetails(tenantId);

    if (account) {
      console.log('Account ID:', account.id);
      console.log('Charges Enabled:', account.charges_enabled);
      console.log('Details Submitted:', account.details_submitted);
      console.log('Payouts Enabled:', account.payouts_enabled);
      console.log('Country:', account.country);
      console.log('Default Currency:', account.default_currency);
      console.log('Business Name:', account.business_profile?.name);

      return account;
    } else {
      console.log('⚠️  Tenant does not have Stripe account');
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to retrieve account details:', error);
  }
}
```

---

## Example 8: Full Tenant Onboarding Flow

Complete end-to-end example:

```typescript
async function completeOnboardingFlow(
  tenantId: string,
  businessEmail: string,
  businessName: string
) {
  console.log('🚀 Starting tenant onboarding...');

  try {
    // Step 1: Create Stripe account
    console.log('📝 Creating Stripe account...');
    const accountId = await stripeConnect.createConnectedAccount(
      tenantId,
      businessEmail,
      businessName
    );
    console.log('✅ Account created:', accountId);

    // Step 2: Generate onboarding link
    console.log('🔗 Generating onboarding link...');
    const onboardingUrl = await stripeConnect.createOnboardingLink(
      tenantId,
      'https://yourdomain.com/onboarding/refresh',
      'https://yourdomain.com/onboarding/complete'
    );
    console.log('✅ Onboarding URL:', onboardingUrl);

    // Step 3: Send onboarding link to tenant
    // (Tenant completes onboarding externally)
    console.log('📧 Send this URL to tenant:', onboardingUrl);

    // Step 4: After tenant returns, check status
    console.log('⏳ Waiting for tenant to complete onboarding...');
    // (In real app, this would be triggered by webhook or return URL)

    // Simulate checking after some time
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const isOnboarded = await stripeConnect.checkOnboardingStatus(tenantId);

    if (isOnboarded) {
      console.log('🎉 Tenant onboarding complete!');
      console.log('✅ Tenant can now accept payments');

      // Optional: Create dashboard link
      const dashboardUrl = await stripeConnect.createLoginLink(tenantId);
      console.log('📊 Dashboard:', dashboardUrl);
    } else {
      console.log('⚠️  Onboarding not yet complete');
      console.log('💡 Tenant needs to complete the onboarding form');
    }
  } catch (error) {
    console.error('❌ Onboarding flow failed:', error);
  }
}
```

---

## Example 9: Delete Connected Account (Danger!)

**WARNING:** This is irreversible!

```typescript
async function deleteTenantsStripeAccount(tenantId: string) {
  try {
    // Confirm with user before calling this!
    const confirmed = true; // Get from user input

    if (!confirmed) {
      console.log('❌ Deletion cancelled');
      return;
    }

    await stripeConnect.deleteConnectedAccount(tenantId);

    console.log('⚠️  Stripe account deleted');
    console.log('Database cleared: stripeAccountId, stripeOnboarded, secrets');
  } catch (error) {
    console.error('❌ Failed to delete account:', error);
  }
}
```

**Use Cases:**

- Tenant closes business
- Tenant requests account deletion
- Testing/development cleanup

---

## Integration with Booking Flow

When creating a booking with commission:

```typescript
import Stripe from 'stripe';

async function createBookingWithCommission(
  tenantId: string,
  bookingTotal: number,
  commissionAmount: number,
  customerEmail: string
) {
  // Get tenant's Stripe account
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeAccountId: true, stripeOnboarded: true },
  });

  if (!tenant?.stripeAccountId || !tenant.stripeOnboarded) {
    throw new Error('Tenant Stripe account not ready');
  }

  // Create payment intent on tenant's connected account
  const platformStripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const paymentIntent = await platformStripe.paymentIntents.create({
    amount: bookingTotal,
    currency: 'usd',
    customer: customerEmail,
    application_fee_amount: commissionAmount, // Platform commission
    transfer_data: {
      destination: tenant.stripeAccountId, // Tenant receives remaining
    },
  });

  console.log('✅ Payment intent created with commission');
  console.log('Total:', bookingTotal / 100);
  console.log('Commission:', commissionAmount / 100);
  console.log('Tenant receives:', (bookingTotal - commissionAmount) / 100);

  return paymentIntent;
}
```

---

## Error Handling

Common errors and how to handle them:

```typescript
async function handleErrors(tenantId: string) {
  try {
    await stripeConnect.createConnectedAccount(tenantId, 'test@example.com', 'Test Business');
  } catch (error) {
    if (error instanceof Error) {
      // Stripe API error
      if (error.message.includes('Stripe')) {
        console.error('Stripe API error:', error.message);
        // Retry with exponential backoff
      }

      // Tenant not found
      if (error.message.includes('Tenant not found')) {
        console.error('Invalid tenant ID:', tenantId);
        // Return 404 to API caller
      }

      // Account already exists
      if (error.message.includes('already has Stripe account')) {
        console.warn('Account already exists, skipping creation');
        // Continue with existing account
      }

      // Encryption error
      if (error.message.includes('encryption')) {
        console.error('Failed to encrypt/decrypt:', error.message);
        // Check TENANT_SECRETS_ENCRYPTION_KEY
      }
    }
  }
}
```

---

## Testing Notes

### Local Development

1. **Use Stripe Test Mode:**

   ```bash
   STRIPE_SECRET_KEY=sk_test_...  # NOT sk_live_
   ```

2. **Test Onboarding:**
   - Stripe provides test accounts that complete onboarding instantly
   - Use pre-filled test data in onboarding forms

3. **Test Webhooks:**
   ```bash
   stripe listen --forward-to localhost:3000/webhooks/stripe
   ```

### Production Checklist

- [ ] `STRIPE_SECRET_KEY` is live key (`sk_live_...`)
- [ ] `STRIPE_WEBHOOK_SECRET` is configured
- [ ] `TENANT_SECRETS_ENCRYPTION_KEY` is set and backed up
- [ ] Onboarding return URLs are HTTPS
- [ ] Dashboard login links expire properly (5 min)
- [ ] Encryption/decryption works for all tenants

---

## Database Schema

Relevant Tenant fields:

```prisma
model Tenant {
  id                String   @id @default(cuid())
  slug              String   @unique
  name              String

  // Stripe Connect
  stripeAccountId   String?  @unique  // acct_...
  stripeOnboarded   Boolean  @default(false)

  // Encrypted secrets
  secrets           Json     @default("{}")  // { stripe: { ciphertext, iv, authTag } }

  // ... other fields
}
```

---

## Additional Resources

- **Stripe Connect Documentation:** https://stripe.com/docs/connect
- **Express Accounts:** https://stripe.com/docs/connect/express-accounts
- **Onboarding Flow:** https://stripe.com/docs/connect/express-dashboard
- **Application Fees:** https://stripe.com/docs/connect/direct-charges#collecting-fees

---

## Support

For issues or questions:

1. Check server logs for detailed error messages
2. Verify environment variables are set correctly
3. Test with Stripe test mode before going live
4. Review EMBEDDABLE_MULTI_TENANT_IMPLEMENTATION_PLAN.md for architecture details
