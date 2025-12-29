# P0 Security Fixes - Minimal Plan

**Priority:** BLOCKER - Complete before production launch
**Total Time:** ~1.25 hours
**Status:** Ready to execute

---

## Context

Following the production readiness audit and plan review, we've identified that only **2 issues are true P0 blockers**. The cleanup services (originally Issues 3-4) are P1, and the webhook namespace issue (Issue 5) is P2 (not a bug, just inefficient).

---

## Fix 1: Redact API Keys in Logs

**Time:** 15 minutes
**File:** `server/src/middleware/tenant.ts`

### Problem

Full API keys are logged in plaintext at lines 85 and 112, creating credential exposure risk if logs are compromised.

### Changes Required

**Line 85 - Change:**

```typescript
// FROM:
logger.warn({ apiKey, path: req.path }, 'Invalid API key format');

// TO:
logger.warn(
  {
    apiKeyPeek: apiKey.slice(0, 8) + '...' + apiKey.slice(-4),
    path: req.path,
  },
  'Invalid API key format'
);
```

**Line 112 - Change:**

```typescript
// FROM:
logger.warn({ apiKey, path: req.path }, 'Tenant not found for API key');

// TO:
logger.warn(
  {
    apiKeyPeek: apiKey.slice(0, 8) + '...' + apiKey.slice(-4),
    path: req.path,
  },
  'Tenant not found for API key'
);
```

### Verification

```bash
# After fix, this should return 0 results:
grep -n "apiKey, path" server/src/middleware/tenant.ts

# Run tests:
npm test -- --grep "tenant"
```

---

## Fix 2: Rotate All Credentials

**Time:** 1 hour
**Files:** External systems only (no code changes)

### Problem

Development credentials may have been exposed. All secrets must be rotated before production.

### Step-by-Step

#### 2.1 Generate New Secrets Locally

```bash
# Run these commands and save the output securely:

echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "BOOKING_TOKEN_SECRET=$(openssl rand -hex 32)"
echo "TENANT_SECRETS_ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

#### 2.2 Supabase Console

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Settings → Database → Change password
4. Settings → API → Regenerate anon and service keys
5. Copy new `DATABASE_URL` connection string

#### 2.3 Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Developers → Webhooks
3. Select your endpoint
4. Reveal signing secret → Roll secret
5. Copy new `STRIPE_WEBHOOK_SECRET`

#### 2.4 Update Vercel (Production)

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select MAIS project
3. Settings → Environment Variables
4. Update these values for **Production** environment:
   - `JWT_SECRET`
   - `BOOKING_TOKEN_SECRET`
   - `TENANT_SECRETS_ENCRYPTION_KEY`
   - `DATABASE_URL`
   - `STRIPE_WEBHOOK_SECRET`
5. Trigger redeployment

#### 2.5 Update Render (API Server)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your API service
3. Environment → Environment Variables
4. Update same values as Vercel
5. Manual Deploy

### Verification Checklist

After rotation, verify these work:

- [ ] Login to admin dashboard works
- [ ] Tenant API calls return data
- [ ] Test booking flow (can use mock mode)
- [ ] Stripe webhook test event received (check Render logs)

---

## Summary

| Fix                 | Time        | Risk Mitigated                  |
| ------------------- | ----------- | ------------------------------- |
| API Key Redaction   | 15 min      | Credential exposure in logs     |
| Credential Rotation | 1 hr        | Compromised development secrets |
| **Total**           | **1.25 hr** |                                 |

---

## What We're NOT Doing (Deferred to P1/P2)

These were originally in the P0 plan but were de-prioritized after review:

| Issue                   | Why Deferred                    | New Priority |
| ----------------------- | ------------------------------- | ------------ |
| WebhookDelivery cleanup | Tables won't fill up for months | P1           |
| AgentSession cleanup    | Tables won't fill up for months | P1           |
| Webhook namespace fix   | Not a bug, just inefficient     | P2           |

### P1 Cleanup (Do After Launch)

Add this simple function to `server/src/scheduler.ts`:

```typescript
// Daily cleanup at 3 AM
cron.schedule('0 3 * * *', async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

  await prisma.webhookDelivery.deleteMany({
    where: {
      OR: [
        { status: 'delivered', createdAt: { lt: sevenDaysAgo } },
        { status: 'failed', createdAt: { lt: thirtyDaysAgo } },
      ],
    },
  });

  await prisma.agentSession.deleteMany({
    where: { createdAt: { lt: ninetyDaysAgo } },
  });
});
```

---

## Execution Command

When ready to implement, run:

```bash
/workflows:work plans/p0-security-fixes-minimal.md
```

---

_Plan created: 2025-12-28_
_Based on: Production readiness audit + 3-reviewer plan review_
