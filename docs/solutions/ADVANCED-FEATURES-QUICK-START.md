# Advanced Features: Quick Start Guide

**For developers implementing advanced booking features**
**Last Updated:** December 2, 2025

## TL;DR - Feature Recommendations

| Feature       | Approach               | Library                   | Status            |
| ------------- | ---------------------- | ------------------------- | ----------------- |
| Secure tokens | JWT + single-use HMAC  | `crypto`, `jsonwebtoken`  | Implement Phase 1 |
| Reminders     | Bull queue (Redis)     | `bull`, `luxon`           | Implement Phase 2 |
| Deposits      | Payment Intent API     | `stripe`                  | Implement Phase 2 |
| Refunds       | Async with idempotency | `stripe`, `bull`          | Implement Phase 3 |
| Invoices      | Puppeteer + Handlebars | `puppeteer`, `handlebars` | Implement Phase 1 |

---

## 1. Secure Tokens (Status: PARTIALLY IMPLEMENTED)

### What's Already Done ✅

- JWT tenant authentication (`tenantAuthService.ts`)
- Password reset tokens with hashing (`tenant-auth.service.ts`)
- Rate limiting on auth endpoints

### What's Missing

- Booking action tokens (reschedule, cancel)
- One-time admin setup links
- Payment dispute tokens

### Quick Implementation

**Add to Prisma schema:**

```prisma
model BookingActionToken {
  id                String    @id @default(cuid())
  bookingId         String    @unique
  tenantId          String
  action            String    // "reschedule" | "cancel"
  tokenHash         String    @unique
  expiresAt         DateTime
  usedAt            DateTime?
  createdAt         DateTime  @default(now())
  booking           Booking   @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId])
}
```

**Create service:**

```typescript
// Use crypto.randomBytes(32) + SHA-256 hash pattern
// Follow same pattern as tenant-auth.service.ts forgotPassword()
```

---

## 2. Reminders (Implement First for Revenue Impact)

### Why Bull + Redis?

- No external service dependency (unlike SendGrid scheduling)
- Distributed job queue (scales to multiple servers)
- Automatic retries on failure
- Perfect for timezone-aware scheduling

### Quick Setup

**1. Install:**

```bash
npm install bull redis ioredis luxon
```

**2. Create queue:**

```typescript
// lib/queue/reminder-queue.ts
import Queue from 'bull';

export const reminderQueue = new Queue('bookings:reminders', {
  redis: { host: 'localhost', port: 6379 },
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
});

reminderQueue.process(async (job) => {
  // Send email using existing PostmarkMailAdapter
});
```

**3. Schedule from booking service:**

```typescript
// On booking.onPaymentCompleted():
const eventDate = DateTime.fromISO(booking.eventDate).setZone(tenantTimezone);
const preEventTime = eventDate.minus({ days: 3 }).set({ hour: 10 });
const delayMs = preEventTime.toUTC().diffNow().as('milliseconds');

await reminderQueue.add(
  { bookingId, type: 'PRE_BOOKING' },
  { delay: Math.floor(delayMs), jobId: `pre-${bookingId}` }
);
```

**Benefits:**

- Timezone-aware scheduling with Luxon
- Automatic retries on network failures
- Persistent (survives server restarts)
- Easy to monitor and debug

---

## 3. Deposits/Partial Payments

### When to Use Payment Intent vs Checkout Session

Use **Payment Intent** when:

- Customers pay deposit (50%) + remainder (50%)
- Multi-stage payment workflows
- Flexible payment scheduling
- Refund tracking per stage

Use **Checkout Session** when:

- Simple one-time payment
- Redirect-based flow (current MAIS pattern)

### Quick Implementation

**1. Add Payment Intent support to adapter:**

```typescript
// In stripe.adapter.ts:
async createPaymentIntent(input: {
  amountCents: number;
  email: string;
  metadata: Record<string, string>;
  stripeAccountId?: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  // Similar to createConnectCheckoutSession() but returns Payment Intent
}
```

**2. Add schema:**

```prisma
model BookingPaymentStage {
  id                    String  @id @default(cuid())
  tenantId              String
  bookingId             String
  stageNumber           Int     // 1 = deposit, 2 = remainder
  type                  String  // "DEPOSIT" | "REMAINDER"
  amountCents           Int
  percentOfTotal        Decimal @db.Decimal(5, 2)
  status                String  @default("PENDING")
  stripePaymentIntentId String  @unique
  completedAt           DateTime?
  @@unique([bookingId, stageNumber])
}
```

**3. Create deposit service:**

```typescript
// services/deposit.service.ts follows same pattern as booking.service.ts
```

**Key diff from full payment:**

- Create Payment Intent (not Checkout Session)
- Track multiple stages (deposit + remainder)
- Calculate remainder on second payment

---

## 4. Refunds (Most Complex - Phase 3)

### Pattern: Database-First, Then Stripe

```typescript
// ALWAYS do this:
1. Create RefundRequest in DB with idempotency key
2. Queue async processing via Bull
3. Stripe refund is source of truth

// NEVER do this:
1. Call Stripe immediately
2. Hope the request succeeds
3. Then update DB
```

### Minimal Implementation

**1. Schema:**

```prisma
model RefundRequest {
  id                    String    @id @default(cuid())
  tenantId              String
  bookingId             String
  stripePaymentIntentId String
  amountCents           Int
  reason                String    // "customer_request" | "cancellation"
  status                String    @default("PENDING")
  stripeRefundId        String?
  idempotencyKey        String    @unique
  completedAt           DateTime?
  @@unique([bookingId, reason])
}
```

**2. Service (simplified):**

```typescript
async createRefund(tenantId, bookingId, reason) {
  // Check for existing refund (idempotency)
  const existing = await prisma.refundRequest.findFirst({
    where: { tenantId, bookingId, reason }
  });
  if (existing && existing.status === 'COMPLETED') return existing.id;

  // Create request
  const refund = await prisma.refundRequest.create({
    data: { tenantId, bookingId, reason, idempotencyKey: generateKey() }
  });

  // Queue processing
  await refundQueue.add({ refundRequestId: refund.id, tenantId });
  return refund.id;
}

// Process in queue worker
async processRefund(refundRequestId, tenantId) {
  const request = await prisma.refundRequest.findUnique({ where: { id: refundRequestId } });

  const stripeRefund = await stripe.refunds.create(
    { payment_intent: request.stripePaymentIntentId, amount: request.amountCents },
    { idempotencyKey: request.idempotencyKey } // Critical!
  );

  await prisma.refundRequest.update({
    where: { id: refundRequestId },
    data: { status: 'COMPLETED', stripeRefundId: stripeRefund.id }
  });
}
```

---

## 5. Invoice Generation (Puppeeter + Handlebars)

### Why Puppeteer?

- Renders HTML → PDF with perfect layout
- Reusable HTML templates (Handlebars)
- Handles complex designs (images, tables, CSS Grid)
- Enterprise-ready quality

### Quick Setup

**1. Install:**

```bash
npm install puppeteer handlebars
```

**2. Create service:**

```typescript
// lib/invoice-template.ts
const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial; margin: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .total { font-size: 24px; font-weight: bold; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f0f0f0; padding: 10px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="header">
    <h1>INVOICE #{{invoiceNumber}}</h1>
    <div>{{invoiceDate}}</div>
  </div>

  <h3>Bill To: {{customerName}}</h3>
  <p>{{customerEmail}}</p>

  <h3>Booking Details</h3>
  <p>Event Date: {{eventDate}}</p>
  <p>Package: {{packageName}}</p>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#each lineItems}}
      <tr>
        <td>{{this.description}}</td>
        <td style="text-align: right;">{{this.amount}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="total">
    Total: {{total}}
  </div>
</body>
</html>
`;

export class InvoiceService {
  async generate(tenantId: string, bookingId: string): Promise<Buffer> {
    // 1. Fetch data
    const booking = await bookingRepo.findById(tenantId, bookingId);
    const tenant = await tenantRepo.findById(tenantId);

    // 2. Generate invoice number (unique per tenant)
    const invoiceNumber = `${tenant.slug}_${new Date().getFullYear()}_001`;

    // 3. Compile template
    const template = Handlebars.compile(invoiceHTML);
    const html = template({
      invoiceNumber,
      invoiceDate: new Date().toLocaleDateString(),
      customerName: booking.coupleName,
      customerEmail: booking.email,
      eventDate: booking.eventDate,
      packageName: booking.package.title,
      lineItems: [
        { description: booking.package.title, amount: `$${(booking.totalPrice / 100).toFixed(2)}` },
      ],
      total: `$${(booking.totalPrice / 100).toFixed(2)}`,
    });

    // 4. Convert to PDF with Puppeteer
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle2' });
    const pdf = await page.pdf({ format: 'A4', margin: '1cm' });
    await browser.close();

    // 5. Store invoice record
    await prisma.invoice.create({
      data: { tenantId, bookingId, invoiceNumber, fileName: `invoice-${invoiceNumber}.pdf` },
    });

    return pdf;
  }
}
```

**3. Send via email:**

```typescript
// In PostmarkMailAdapter, add method:
async sendInvoice(to: string, invoiceBuffer: Buffer, fileName: string) {
  const base64 = invoiceBuffer.toString('base64');

  // Postmark email with attachment
  const resp = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: { 'X-Postmark-Server-Token': this.cfg.serverToken },
    body: JSON.stringify({
      From: this.cfg.fromEmail,
      To: to,
      Subject: 'Your invoice',
      HtmlBody: '<p>See attached invoice</p>',
      Attachments: [{
        Name: fileName,
        Content: base64,
        ContentType: 'application/pdf',
      }],
    }),
  });
}
```

---

## Implementation Checklist

### Phase 1 (MVP - This Sprint)

- [ ] Add `BookingActionToken` model to schema
- [ ] Create `BookingActionTokenService` (copy password reset pattern)
- [ ] Add invoice generation service (Puppeteer)
- [ ] Add invoice model and API routes

### Phase 2 (Post-MVP)

- [ ] Set up Redis locally (`docker run -d redis:7`)
- [ ] Create reminder queue (`bull`, `luxon`)
- [ ] Schedule reminders on booking completion
- [ ] Add `BookingPaymentStage` model for deposits
- [ ] Create deposit payment service

### Phase 3 (Advanced)

- [ ] Create `RefundRequest` model
- [ ] Create refund service with Bull queue
- [ ] Implement Stripe webhook handlers for refund status
- [ ] Add recovery job for failed refunds

---

## Local Development Setup

### Redis (for reminders & refunds)

```bash
# Install Docker, then:
docker run -d \
  --name mais-redis \
  -p 6379:6379 \
  redis:7-alpine

# Test connection:
redis-cli ping  # Should return PONG
```

### Environment Variables

```bash
# .env
REDIS_HOST=localhost
REDIS_PORT=6379

# Puppeteer (production only)
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### Dependencies Installation

```bash
# All at once:
npm install bull redis ioredis luxon puppeteer handlebars

# Or per feature:
npm install bull redis ioredis luxon  # Reminders
npm install puppeteer handlebars      # Invoices
```

---

## Testing Patterns

### Secure Tokens

```typescript
test('token is single-use', async () => {
  const token = await service.generateToken(...);
  const verified1 = await service.verifyToken(token);
  expect(verified1).toBeDefined();

  const verified2 = await service.verifyToken(token);
  expect(verified2).toThrow('Token already used');
});
```

### Reminders

```typescript
test('reminder scheduled at correct time', async () => {
  await service.scheduleReminder(tenantId, bookingId, 'America/New_York');

  const jobs = await reminderQueue.getDelayed();
  expect(jobs.length).toBe(1);
  expect(jobs[0].data.bookingId).toBe(bookingId);
});
```

### Refunds

```typescript
test('refund is idempotent', async () => {
  const refund1 = await service.createRefund(tenantId, bookingId, 'customer_request');
  const refund2 = await service.createRefund(tenantId, bookingId, 'customer_request');

  expect(refund1.id).toBe(refund2.id);
});
```

---

## Debugging Tips

### Check Redis queue

```bash
redis-cli
> KEYS *  # See all keys
> LLEN bull:bookings:reminders:jobs  # Job count
> GET "bull:bookings:reminders:1"  # View specific job
```

### Monitor Bull queue

```typescript
// In di.ts or startup:
import Queue from 'bull';
const queue = new Queue('bookings:reminders');

queue.on('active', (job) => console.log('Processing:', job.id));
queue.on('completed', (job) => console.log('Completed:', job.id));
queue.on('failed', (job, error) => console.log('Failed:', job.id, error.message));
```

### Test Stripe refund locally

```typescript
// In test file:
const refund = await stripe.refunds.create(
  {
    payment_intent: 'pi_test123', // Use test PI
    amount: 5000,
  },
  { idempotencyKey: 'test-key-1' }
);

console.log('Refund ID:', refund.id); // Should succeed
console.log('Status:', refund.status); // "succeeded"
```

---

## Common Gotchas

### Timezone Handling

```typescript
// ❌ WRONG - Treats date as UTC
const dt = DateTime.fromISO('2025-06-15');

// ✅ CORRECT - Sets tenant's timezone
const dt = DateTime.fromISO('2025-06-15').setZone('America/New_York');

// ✅ CORRECT - Convert back to UTC for job scheduling
const utcTime = dt.toUTC();
const delay = utcTime.diffNow().as('milliseconds');
```

### Multi-Tenant Isolation

```typescript
// ❌ WRONG - Missing tenantId
const reminders = await prisma.reminderLog.findMany({ where: { status: 'FAILED' } });

// ✅ CORRECT - Always include tenantId
const reminders = await prisma.reminderLog.findMany({
  where: { tenantId, status: 'FAILED' },
});
```

### Idempotency Keys

```typescript
// ❌ WRONG - Changes on every call
const key = `refund_${Date.now()}`;

// ✅ CORRECT - Deterministic and unique
const key = `refund_${tenantId}_${bookingId}_${reason}`;

// ✅ ALSO CORRECT - UUID (never changes)
const key = await generateStableKey(tenantId, bookingId, reason);
```

### Error Logging

```typescript
// ❌ WRONG - Logs sensitive data
logger.error({ token, bookingId }, 'Verification failed');

// ✅ CORRECT - Only logs safe info
logger.error({ bookingId }, 'Verification failed');
```

---

## Further Reading

- Full guide: `ADVANCED-FEATURES-BEST-PRACTICES.md`
- MAIS patterns: `CLAUDE.md`
- Stripe API: https://stripe.com/docs
- Bull Queue: https://github.com/OptimalBits/bull
- Puppeteer: https://pptr.dev/
- Luxon: https://moment.github.io/luxon/

---

**Questions?** Check the full best practices guide or ask in code review.
