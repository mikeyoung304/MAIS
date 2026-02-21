# Stripe Checkout Subscription Best Practices (2025-2026)

Research date: 2026-02-20. Sources: Stripe docs, t3dotgg/stripe-recommendations, web search.

## 1. Reverse Trial Pattern

A **reverse trial** gives users full premium access for N days, then downgrades to a free tier (not "pay first"). For HANDLED's "pay first, use later" membership model, use a standard Checkout subscription with `trial_period_days: 0` (no trial). Charge immediately, provision access on `checkout.session.completed`. If you want a money-back guarantee window, track it in your DB and process refunds via `stripe.refunds.create()` within the window.

## 2. Checkout Session vs Embedded Payment Form

| Factor         | Hosted Checkout (`mode: 'subscription'`) | Embedded (`ui_mode: 'embedded'`)                          |
| -------------- | ---------------------------------------- | --------------------------------------------------------- |
| PCI scope      | Stripe-hosted, zero PCI burden           | Stripe iframe, zero PCI burden                            |
| Customization  | Limited (logo, colors, fonts)            | Full layout control, stays on your domain                 |
| 3DS/SCA        | Handled automatically                    | Handled automatically                                     |
| Implementation | ~20 lines server-side                    | Requires `@stripe/react-stripe-js` + `<EmbeddedCheckout>` |
| Conversion     | Higher trust (stripe.com domain)         | Higher for brand-heavy experiences                        |

**Recommendation for HANDLED:** Use hosted Checkout. Simpler, SCA-compliant out of the box, and the redirect UX is fine for membership signups. Switch to embedded only if conversion data demands it.

## 3. Webhook Reliability for `checkout.session.completed`

Stripe retries failed webhooks for **3 days** with exponential backoff (immediate, 5m, 30m, 2h, 5h, 10h, then every 12h). Your existing pattern in `webhooks.routes.ts` is correct:

- Verify signature first (fast path)
- Check event ID for duplicates (idempotency)
- Record with PENDING status, return 200 immediately
- Process async via BullMQ

**Key addition:** Always listen to BOTH `checkout.session.completed` AND `customer.subscription.created`/`updated`. The session event confirms payment; the subscription events confirm provisioning. Use the t3 pattern of syncing to a KV/cache on every relevant event.

## 4. Idempotency Patterns for Subscription Creation

Your `CheckoutSessionFactory` already implements the correct pattern. Key rules:

- **Session creation:** Use `Idempotency-Key` header (Stripe caches for 24h)
- **Webhook processing:** Deduplicate on `event.id` in your `webhookEvent` table (already done)
- **Customer creation:** Always create-or-retrieve before Checkout:

```typescript
let customerId = await kv.get(`stripe:user:${userId}`);
if (!customerId) {
  const customer = await stripe.customers.create({
    email,
    metadata: { userId, tenantId }, // ALWAYS include tenantId
  });
  customerId = customer.id;
  await kv.set(`stripe:user:${userId}`, customerId);
}
const session = await stripe.checkout.sessions.create(
  {
    customer: customerId, // ALWAYS pass existing customer
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${domain}/t/${slug}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${domain}/t/${slug}/membership`,
    subscription_data: { metadata: { tenantId, userId } },
  },
  { idempotencyKey: `checkout_${userId}_${priceId}_${Date.now()}` }
);
```

## 5. Card Decline UX

Stripe Checkout handles all decline UX automatically: inline error messages, retry prompts, card brand detection, real-time validation. No custom code needed. Declines surface as `payment_intent.payment_failed` webhook events for your logging.

## 6. 3DS/SCA Compliance

Stripe Checkout is **fully SCA-ready**. It triggers 3DS2 automatically when required by the issuer or regulation. Benefits:

- Frictionless auth for low-risk transactions (no customer action needed)
- Challenge flow for high-risk (redirect to bank verification)
- Liability shift to issuer on successful 3DS authentication
- **No code changes needed** when using Checkout -- Stripe handles the entire flow

For off-session recurring charges (renewal), Stripe automatically requests SCA exemptions. Monitor `invoice.payment_action_required` for cases where customer re-authentication is needed.

## 7. Multi-Tenant Stripe Patterns

HANDLED already uses Stripe Connect correctly. Key metadata rules:

- **Always include `tenantId`** in `metadata` on Customer, Subscription, and Checkout Session
- **Always include `tenantSlug`** for webhook routing (already done in `CheckoutSessionFactory`)
- **Customer creation:** One Stripe Customer per end-user per tenant (use `metadata.tenantId` + `metadata.userId`)
- **Cache keys:** `stripe:tenant:${tenantId}:customer:${userId}` (tenant-scoped)

## 8. Success/Cancel URL Patterns

Your existing pattern is correct: `/t/{slug}/book/success?session_id={CHECKOUT_SESSION_ID}`. For membership:

```
success: ${domain}/t/${slug}/membership/success?session_id={CHECKOUT_SESSION_ID}
cancel:  ${domain}/t/${slug}/membership
```

On the success page, retrieve the session server-side to confirm payment status. **Never trust the URL alone** -- always verify via `stripe.checkout.sessions.retrieve(sessionId)` or rely on the webhook.

## 9. Preventing Double-Submit on Payment Buttons

- **Client-side:** Disable button on click, show spinner, re-enable only on error
- **Server-side:** Idempotency key on session creation (already implemented)
- **Navigation guard:** Store session ID in sessionStorage; if user navigates back, redirect to existing session URL instead of creating a new one

```typescript
const existingSessionId = sessionStorage.getItem('checkout_session');
if (existingSessionId) return redirectToExistingSession(existingSessionId);
// else create new session, store ID before redirect
```

## 10. Testing Stripe Webhooks in Development

```bash
# Terminal 1: Forward events to local server
stripe listen --forward-to localhost:3001/api/webhooks/stripe --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,invoice.paid,invoice.payment_failed

# Terminal 2: Trigger test events
stripe trigger checkout.session.completed
```

Use the webhook signing secret from `stripe listen` output as `STRIPE_WEBHOOK_SECRET` in `.env`. The secret persists across CLI restarts. For CI, use `stripe-mock` for unit tests and the Stripe test mode API for integration tests.
