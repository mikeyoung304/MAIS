---
status: complete
priority: p1
issue_id: "278"
tags: [code-review, feature-gap, webhooks, api, acuity-parity]
dependencies: []
---

# No Custom Webhook Subscriptions for Tenants (Acuity Parity)

## Problem Statement

Only Stripe webhooks are supported. Tenants cannot register their own webhook URLs to receive appointment lifecycle events. This prevents third-party integrations and is a critical gap vs. Acuity.

**Why it matters:**
- Tenants cannot integrate MAIS with their CRM, email tools, or custom apps
- No way to react to appointment.created, appointment.canceled events
- Acuity has this as a core feature
- Limits platform adoption for businesses with existing workflows

## Findings

### Agent: api-design-reviewer
- **Location:** `server/src/routes/webhooks.routes.ts`
- **Evidence:** Only Stripe webhook handling exists; no tenant webhook registration or delivery
- **Missing Events:**
  - `appointment.scheduled`
  - `appointment.rescheduled`
  - `appointment.canceled`
  - `appointment.changed`
  - `payment.completed`
  - `payment.failed`

### Acuity Webhook Capabilities:
```bash
# Tenant registers webhook URL
POST /api/v1/webhooks
{
  "url": "https://mycorp.com/webhooks",
  "events": ["appointment.created", "appointment.canceled"]
}

# Tenant receives events
POST https://mycorp.com/webhooks
{
  "event": "appointment.created",
  "appointmentId": "abc123",
  "tenantId": "xyz",
  "timestamp": "2025-12-05T10:00:00Z"
}
```

## Proposed Solutions

### Option A: Basic Webhook Subscription System (Recommended for MVP)
**Description:** Allow tenants to register webhook URLs and receive appointment events

**Schema:**
```prisma
model WebhookSubscription {
  id        String   @id @default(cuid())
  tenantId  String
  url       String
  events    String[] // ['appointment.created', 'appointment.canceled']
  secret    String   // For HMAC signature
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  @@index([tenantId])
  @@unique([tenantId, url])
}

model WebhookDelivery {
  id             String   @id @default(cuid())
  subscriptionId String
  event          String
  payload        Json
  status         String   // 'pending', 'delivered', 'failed'
  attempts       Int      @default(0)
  lastAttemptAt  DateTime?
  deliveredAt    DateTime?
  createdAt      DateTime @default(now())

  @@index([subscriptionId, status])
}
```

**API Endpoints:**
```typescript
// Register webhook
POST /v1/tenant-admin/webhooks
{ url: "https://...", events: ["appointment.created"] }

// List webhooks
GET /v1/tenant-admin/webhooks

// Delete webhook
DELETE /v1/tenant-admin/webhooks/:id

// Test webhook
POST /v1/tenant-admin/webhooks/:id/test
```

**Event Emission:**
```typescript
// In booking.service.ts
async onAppointmentPaymentCompleted(...) {
  const booking = await this.createBooking(...);

  // Emit internal event
  await this._eventEmitter.emit(AppointmentEvents.BOOKED, {...});

  // NEW: Queue webhook delivery
  await this.webhookDeliveryService.queueDelivery(tenantId, 'appointment.created', {
    appointmentId: booking.id,
    serviceId: booking.serviceId,
    customerId: booking.customerId,
    startTime: booking.startTime,
    // ...
  });
}
```

**Delivery with Retry:**
```typescript
class WebhookDeliveryService {
  async deliverWithRetry(delivery: WebhookDelivery) {
    const subscription = await this.getSubscription(delivery.subscriptionId);

    const signature = crypto
      .createHmac('sha256', subscription.secret)
      .update(JSON.stringify(delivery.payload))
      .digest('hex');

    const response = await fetch(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MAIS-Signature': signature,
        'X-MAIS-Event': delivery.event,
      },
      body: JSON.stringify(delivery.payload),
      timeout: 10000,
    });

    if (!response.ok) throw new Error(`Webhook failed: ${response.status}`);
  }
}
```

**Pros:**
- Achieves Acuity parity for webhook functionality
- Enables third-party integrations
- HMAC signature prevents tampering

**Cons:**
- Requires background job system for reliable delivery
- Adds operational complexity (retries, dead letter queue)

**Effort:** Large (3-5 days)
**Risk:** Medium

### Option B: Simple Fire-and-Forget Webhooks
**Description:** Send webhooks synchronously without retry (MVP-lite)

**Effort:** Medium (1-2 days)
**Risk:** High (unreliable delivery)

## Recommended Action

Implement Option A with a simple job queue (BullMQ or database-backed). This is a platform differentiator.

## Technical Details

**Affected Files:**
- NEW: `server/src/services/webhook-delivery.service.ts`
- NEW: `server/src/routes/tenant-admin-webhooks.routes.ts`
- NEW: `server/src/adapters/prisma/webhook-subscription.repository.ts`
- `server/prisma/schema.prisma`
- `server/src/services/booking.service.ts`
- `server/src/di.ts`

**Events to Support (Phase 1):**
- `appointment.created`
- `appointment.rescheduled`
- `appointment.canceled`

**Events to Support (Phase 2):**
- `payment.completed`
- `payment.failed`
- `service.created`
- `service.updated`

## Acceptance Criteria

- [ ] WebhookSubscription and WebhookDelivery models created
- [ ] CRUD endpoints for webhook management
- [ ] HMAC signature on outbound webhooks
- [ ] Retry logic with exponential backoff (5 retries over 24 hours)
- [ ] Event emission on appointment lifecycle
- [ ] Test endpoint for webhook verification
- [ ] Admin UI for webhook management

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-05 | Created from API review | Critical integration gap |

## Resources

- [Acuity Webhooks Documentation](https://developers.acuityscheduling.com/docs/webhooks)
- [Stripe Webhook Patterns](https://stripe.com/docs/webhooks/best-practices)
- Related: `server/src/routes/webhooks.routes.ts`
