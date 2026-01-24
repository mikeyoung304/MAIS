---
title: Booking Flow 404 Error from Invalid Stripe Key and Stale Next.js Cache
category: integration-issues
component: booking, stripe, frontend
severity: high
tags: [stripe, booking, 404, build-cache, environment-variables, multi-tenant, next.js]
created: 2026-01-24
resolved: true
resolution_date: 2026-01-24
root_cause: Invalid Stripe API key returning 401, compounded by stale Next.js build cache serving old JavaScript
solution: Update Stripe test key in server/.env and clear Next.js build cache
---

# Booking Flow 404 Error from Invalid Stripe Key and Stale Next.js Cache

## Problem Symptom

When clicking "Proceed to Payment" in the booking flow, the request fails with:

- **Client-side:** POST /v1/bookings/date returns 404 NOT_FOUND
- **User goal blocked:** Testing post-booking project hub after Stripe upgrade

Initial suspicion pointed to missing routes or incorrect route mounting, but the actual issue was far more subtle.

## Investigation Timeline

### 1. Route Mounting Investigation

Multi-agent review confirmed routes WERE mounted correctly:

- Expected: `/v1/public/bookings/date`
- Actual mount point: `/v1/public/bookings/date` ✅

### 2. Server Logs Analysis

Server logs revealed the real error chain:

```
Package not found
  packageId: "test"
```

The booking flow was attempting to use packageId "test" from old test data.

### 3. API Testing

Direct curl test with correct package ID succeeded:

```bash
curl -X POST https://api.example.com/v1/public/bookings/date \
  -H "Content-Type: application/json" \
  -d '{"packageId": "real-package-id", ...}'
# SUCCESS ✅
```

### 4. Frontend Code Inspection

Browser console showed:

```
POST /v1/bookings/date 404
```

But client code showed:

```typescript
// apps/web/src/lib/api/bookings.ts
const response = await fetch('/v1/public/bookings/date', {
  /* ... */
});
```

Client code WAS correct (`/v1/public/bookings/date`), so why was browser calling `/v1/bookings/date`?

### 5. Deep Dive: Two Compounding Issues

**Issue 1: Invalid Stripe API Key**

```bash
# server/.env had wrong key
STRIPE_SECRET_KEY=sk_test_51QOWnp...Z5Z5Z5  # Unknown Stripe account

# Stripe API rejected with:
401 Unauthorized: Invalid API Key provided
```

**Issue 2: Stale Next.js Build Cache**

Even after fixing the Stripe key, the browser continued to serve cached JavaScript from `.next/` directory containing the old API endpoint path.

## Root Cause

**TWO compounding issues:**

1. **Invalid Stripe API key in server/.env**
   - Key `sk_test_51QOWnp...Z5Z5Z5` belonged to unknown/deleted account
   - Stripe API returned 401 Unauthorized on all requests
   - Needed Maconheadshots test key: `sk_test_51KtZcXAwg3ZS5g4H...`

2. **Stale Next.js build cache**
   - `.next/` directory served old compiled JavaScript
   - Even after env var changes, browser served cached bundles
   - Old code had incorrect API paths or logic

The combination made debugging extremely difficult:

- Network requests showed 404 (not 401, masking the Stripe issue)
- Code inspection showed correct paths (but cache served old code)
- Server logs showed the truth (Package not found → Stripe 401)

## Solution

```bash
# 1. Update Stripe API key in server/.env
STRIPE_SECRET_KEY=sk_test_51KtZcXAwg3ZS5g4HyennrHN6eGyHjS6qayBPXIf0OHjBPU9pGSSGrV4tBkEnTPyejoYW3ZjRZRumQW4Gqtj82l7C00akAa3htN

# 2. Clear Next.js build cache
rm -rf apps/web/.next

# 3. Restart dev server
npm run dev
```

After these steps, the booking flow worked correctly.

## Prevention Strategies

### 1. Validate Stripe Keys on Server Startup

Add to `server/src/index.ts`:

```typescript
import Stripe from 'stripe';

async function validateStripeKey() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    logger.warn('STRIPE_SECRET_KEY not set, Stripe features disabled');
    return;
  }

  // Validate key format
  const testKeyPattern = /^sk_test_[a-zA-Z0-9]{24,}/;
  const liveKeyPattern = /^sk_live_[a-zA-Z0-9]{24,}/;

  if (!testKeyPattern.test(key) && !liveKeyPattern.test(key)) {
    throw new Error('STRIPE_SECRET_KEY has invalid format');
  }

  // Test connectivity
  try {
    const stripe = new Stripe(key, { apiVersion: '2023-10-16' });
    await stripe.customers.list({ limit: 1 });
    logger.info('Stripe API key validated successfully');
  } catch (error) {
    throw new Error(`Stripe API key validation failed: ${error.message}`);
  }
}

// Call in server startup
await validateStripeKey();
```

### 2. Add Health Check Endpoint

```typescript
// server/src/routes/health.ts
router.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    stripe: await checkStripe(),
    cache: await checkCache(),
  };

  const healthy = Object.values(checks).every((c) => c.status === 'ok');

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

async function checkStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { status: 'disabled', message: 'No API key configured' };
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
    await stripe.customers.list({ limit: 1 });
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}
```

### 3. Document Environment Variables

Create `.env.example`:

```bash
# Stripe API Keys
# Test keys for development (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_51KtZcXAwg3ZS5g4HyennrHN6eGyHjS6qayBPXIf0OHjBPU9pGSSGrV4tBkEnTPyejoYW3ZjRZRumQW4Gqtj82l7C00akAa3htN

# NEVER commit live keys to git
# Production keys go in environment variables via Render dashboard
```

Update `DEVELOPING.md`:

```markdown
## Stripe Test Keys

Use Maconheadshots test account keys for local development:

**Secret Key:** `sk_test_51KtZcXAwg3ZS5g4H...` (from dashboard → Developers → API Keys)
**Publishable Key:** `pk_test_51KtZcXAwg3ZS5g4H...`

⚠️ NEVER use production keys in local development
⚠️ Test keys start with `sk_test_` or `pk_test_`
⚠️ Live keys start with `sk_live_` or `pk_live_`
```

### 4. Clear Build Cache When Env Changes

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "npm run dev:clean",
    "dev:clean": "rm -rf apps/web/.next && concurrently \"npm run dev:api\" \"npm run dev:web\"",
    "dev:cached": "concurrently \"npm run dev:api\" \"npm run dev:web\""
  }
}
```

Or add pre-dev hook:

```json
{
  "scripts": {
    "predev:web": "node scripts/check-env-changes.js"
  }
}
```

```javascript
// scripts/check-env-changes.js
const fs = require('fs');
const crypto = require('crypto');

const envPath = 'server/.env';
const checksumPath = '.next/.env.checksum';

const currentEnv = fs.readFileSync(envPath, 'utf8');
const currentChecksum = crypto.createHash('md5').update(currentEnv).digest('hex');

if (fs.existsSync(checksumPath)) {
  const lastChecksum = fs.readFileSync(checksumPath, 'utf8').trim();

  if (currentChecksum !== lastChecksum) {
    console.log('⚠️  Environment variables changed, clearing Next.js cache...');
    fs.rmSync('apps/web/.next', { recursive: true, force: true });
  }
}

fs.writeFileSync(checksumPath, currentChecksum);
```

### 5. Add Deployment Verification

```bash
# After deploying to production
curl https://api.gethandled.ai/health

# Should return:
{
  "status": "healthy",
  "checks": {
    "stripe": { "status": "ok" },
    "database": { "status": "ok" }
  }
}
```

## Key Learnings

1. **Network 404s can mask deeper issues** - The real error was Stripe 401, but it manifested as 404
2. **Build caches persist across code changes** - Always clear `.next/` when debugging mysterious behavior
3. **Multiple small issues compound** - Invalid key + stale cache = very confusing debugging
4. **Server logs tell the truth** - Browser/network tab showed 404, server logs showed the real chain (Package not found → Stripe 401)
5. **Environment variables need validation** - Don't wait for runtime errors, validate on startup

## Testing Checklist

After implementing prevention strategies:

```bash
# 1. Test invalid Stripe key (should fail fast on startup)
STRIPE_SECRET_KEY=invalid npm run dev:api
# Expected: Error on startup, clear message

# 2. Test missing Stripe key (should warn but continue)
unset STRIPE_SECRET_KEY
npm run dev:api
# Expected: Warning logged, server starts

# 3. Test valid Stripe key (should validate on startup)
STRIPE_SECRET_KEY=sk_test_51KtZcX... npm run dev:api
# Expected: "Stripe API key validated successfully"

# 4. Test health check
curl http://localhost:3001/health
# Expected: 200 OK with all checks passing

# 5. Test cache clearing
echo "# comment" >> server/.env
npm run dev
# Expected: .next/ directory cleared automatically
```

## Files Involved

- `server/.env` - Environment variables (Stripe keys)
- `apps/web/.next/` - Next.js build cache
- `server/src/adapters/stripe/stripe.adapter.ts` - Stripe integration
- `apps/web/src/lib/api/bookings.ts` - Client-side booking API calls
- `server/src/routes/v1/public/bookings.ts` - Server-side booking routes

## Related Documentation

- `DEVELOPING.md` - Development workflow and setup
- `docs/solutions/patterns/STATIC_CONFIG_MULTI_TENANT_PREVENTION.md` - URL configuration patterns
- Stripe API Documentation: https://stripe.com/docs/api

## Additional Context

This issue occurred while testing the post-booking project hub feature after upgrading Stripe integration. The combination of:

1. Old test data with packageId "test"
2. Invalid Stripe API key from wrong account
3. Stale Next.js build cache

Created a perfect storm where:

- Code looked correct ✅
- Routes were mounted correctly ✅
- But runtime behavior was completely wrong ❌

The multi-agent review process helped narrow down the issue by eliminating route configuration as the problem, forcing deeper investigation into runtime behavior and environment configuration.

## Status

**RESOLVED** - Booking flow now works correctly with proper Stripe test key and fresh Next.js build.

Next steps:

1. Implement startup validation for Stripe keys
2. Add health check endpoint
3. Document environment setup in DEVELOPING.md
4. Add .env.example with correct key format
5. Consider auto-clearing .next/ on env changes
