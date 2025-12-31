---
status: complete
priority: p1
issue_id: '273'
tags: [code-review, security, webhooks, rate-limiting, dos-prevention]
dependencies: []
---

# Missing Rate Limiting on Stripe Webhook Endpoint

## Problem Statement

The Stripe webhook endpoint `/v1/webhooks/stripe` has NO rate limiting applied. An attacker can spam the endpoint with invalid signatures, causing database exhaustion, advisory lock DoS, and CPU exhaustion from signature verification.

**Why it matters:**

- Database exhaustion via `WebhookEvent` record creation attempts
- Advisory lock DoS (each webhook acquires locks during processing)
- CPU exhaustion from cryptographic signature verification
- Stripe marks webhooks as "failed" if response times exceed 5 seconds

## Findings

### Agent: security-sentinel

- **Location:** `server/src/routes/index.ts:203-213`, `server/src/app.ts`
- **Evidence:** No rate limiting middleware applied to webhook route
- **Severity:** HIGH - Denial of Service, database/lock exhaustion

### Attack Scenario:

```bash
# 10,000 requests/second with invalid signature
for i in {1..10000}; do
  curl -X POST https://api.mais.com/v1/webhooks/stripe \
    -H "stripe-signature: fake" \
    -d '{"id":"evt_fake"}' &
done
```

## Proposed Solutions

### Option A: Add Webhook-Specific Rate Limiter (Recommended)

**Description:** Add dedicated rate limiter for webhook endpoint with proper response codes

```typescript
// middleware/rateLimiter.ts
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Stripe typically sends < 10/min per tenant
  standardHeaders: false, // Don't leak rate limit info
  handler: (_req, res) => res.status(200).send('OK'), // Return 200 to prevent Stripe retries
});

// routes/index.ts
app.use('/v1/webhooks/stripe', webhookLimiter, express.raw({ type: 'application/json' }));
```

**Important:** Return HTTP 200 even on rate limit to prevent Stripe retry storms.

**Pros:**

- Quick implementation (30 minutes)
- Prevents DoS without affecting legitimate webhooks
- Returns 200 to Stripe to prevent retry accumulation

**Cons:**

- Rate limit may occasionally drop legitimate webhook during spike

**Effort:** Small (30 minutes)
**Risk:** Low

### Option B: IP-Based Whitelist + Rate Limit

**Description:** Only allow Stripe IP ranges, rate limit everything else

**Effort:** Medium (2 hours)
**Risk:** Medium (Stripe IPs may change)

## Recommended Action

Implement Option A immediately before production deployment.

## Technical Details

**Affected Files:**

- `server/src/middleware/rateLimiter.ts` (add webhookLimiter)
- `server/src/routes/index.ts` (apply middleware)
- `server/src/app.ts` (wire up middleware order)

**Testing:**

```bash
# Load test with 200 requests in 10 seconds
for i in {1..200}; do
  curl -X POST http://localhost:3001/v1/webhooks/stripe \
    -H "stripe-signature: fake" \
    -d '{}' &
done
# Verify: requests after 100 return 200 without processing
```

## Acceptance Criteria

- [x] `webhookLimiter` middleware created with 100 req/min limit
- [x] Middleware applied to `/v1/webhooks/stripe` endpoint
- [x] Rate-limited requests return HTTP 200 (not 429)
- [x] HTTP tests verify rate limiter behavior
- [x] Tests pass (5 new passing tests added)

## Work Log

| Date       | Action                                | Learnings                                                                                                      |
| ---------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 2025-12-05 | Created from security review          | Critical pre-production fix                                                                                    |
| 2025-12-05 | Implemented Option A (webhookLimiter) | Returns 200 to prevent Stripe retry storms, excludes webhooks from publicLimiter to avoid double rate limiting |

## Resources

- [Stripe Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)
- Related: `server/src/routes/webhooks.routes.ts`
- Related: `server/src/middleware/rateLimiter.ts`
