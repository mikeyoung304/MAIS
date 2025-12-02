# Advanced Features: MAIS Implementation Patterns

**Aligning advanced features with existing MAIS architecture**
**Last Updated:** December 2, 2025

## Overview

This guide shows how to implement advanced features (tokens, reminders, deposits, refunds, invoices) using MAIS' existing patterns and conventions.

---

## MAIS Architecture Principles Applied

### 1. Layered Architecture (Routes → Services → Adapters)

All features follow MAIS' three-layer pattern:

```
API Routes (thin HTTP handlers)
    ↓
Services (business logic)
    ↓
Adapters/Repositories (external integration)
```

**Example - Refund Feature:**

```typescript
// routes/bookings-refunds.routes.ts (HTTP interface)
export const refundsRouter = tsRestExpress(contract.refunds, {
  createRefund: async (req) => {
    const { tenantId } = req.locals.tenantAuth;
    const { bookingId } = req.params;
    const { reason } = req.body;

    const refundId = await refundService.createRefund(tenantId, bookingId, reason);
    return { status: 202, body: { refundId } }; // 202 Accepted (async)
  },
});

// services/refund.service.ts (business logic)
export class RefundService {
  async createRefund(tenantId: string, bookingId: string, reason: string): Promise<string> {
    // Validate booking exists and belongs to tenant
    const booking = await bookingRepo.findById(tenantId, bookingId);
    if (!booking) throw new NotFoundError(...);

    // Check for duplicate refund request (idempotency)
    const existing = await refundRepo.findByBookingAndReason(tenantId, bookingId, reason);
    if (existing && existing.status === 'COMPLETED') return existing.id;

    // Create refund request
    const refund = await refundRepo.create(tenantId, { bookingId, reason, ... });

    // Queue async processing
    await refundQueue.add({ refundRequestId: refund.id, tenantId });

    return refund.id;
  }
}

// adapters/prisma/refund.repository.ts (data persistence)
export class PrismaRefundRepository implements RefundRepository {
  async create(tenantId: string, data: CreateRefundInput): Promise<RefundRequest> {
    return prisma.refundRequest.create({
      data: { tenantId, ...data }
    });
  }
}
```

### 2. Dependency Injection Pattern

MAIS uses centralized DI in `di.ts` to configure adapters based on `ADAPTERS_PRESET`.

**Add to di.ts:**

```typescript
// di.ts (existing pattern)
const di = {
  // Booking service (existing)
  bookingService: new BookingService(
    prismaAdapters.bookingRepository,
    prismaAdapters.catalogRepository,
    eventEmitter,
    paymentProvider,
    ...
  ),

  // NEW: Refund service
  refundService: new RefundService(
    prismaAdapters.refundRepository,
    paymentProvider,
    refundQueue,
    eventEmitter,
  ),

  // NEW: Reminder service
  reminderService: new ReminderService(
    reminderQueue,
    emailProvider,
  ),

  // NEW: Invoice service
  invoiceService: new InvoiceService(
    prismaAdapters.bookingRepository,
    prismaAdapters.tenantRepository,
    invoiceGenerator,
  ),
};

// Routes inject services from DI
app.use(bookingsRouter(di.bookingService, di.refundService, di.reminderService, di.invoiceService));
```

### 3. Multi-Tenant Isolation (CRITICAL)

Every query MUST include `tenantId`:

```typescript
// ✅ CORRECT - All tenant-scoped
async getRefunds(tenantId: string) {
  return prisma.refundRequest.findMany({
    where: { tenantId } // ← CRITICAL
  });
}

// ❌ WRONG - Will leak data across tenants
async getRefunds() {
  return prisma.refundRequest.findMany({});
}
```

**Pattern in repository methods:**

```typescript
export interface RefundRepository {
  // First parameter is ALWAYS tenantId
  create(tenantId: string, data: CreateRefundInput): Promise<RefundRequest>;
  findById(tenantId: string, id: string): Promise<RefundRequest | null>;
  findByBookingAndReason(tenantId: string, bookingId: string, reason: string): Promise<RefundRequest | null>;
  findAll(tenantId: string): Promise<RefundRequest[]>;
}
```

### 4. Error Handling Pattern

Domain errors in services, HTTP mapping in routes:

```typescript
// lib/errors/business.ts (ADD THESE)
export class RefundError extends AppError {
  constructor(message: string, code?: string) {
    super(message, code || 'REFUND_ERROR', 402, true);
    this.name = 'RefundError';
  }
}

export class RefundAlreadyRequestedError extends RefundError {
  constructor(bookingId: string) {
    super(`Refund already requested for booking ${bookingId}`, 'REFUND_ALREADY_REQUESTED');
    this.name = 'RefundAlreadyRequestedError';
  }
}

// services/refund.service.ts
if (existingRefund && existingRefund.status === 'COMPLETED') {
  throw new RefundAlreadyRequestedError(bookingId);
}

// routes/bookings-refunds.routes.ts
try {
  await refundService.createRefund(tenantId, bookingId, reason);
} catch (error) {
  if (error instanceof RefundAlreadyRequestedError) {
    return { status: 409, body: { error: error.message } };
  }
  throw error; // Error middleware handles
}
```

### 5. Type-Safe API Contracts

Use Zod + ts-rest like MAIS does:

```typescript
// packages/contracts/bookings-refunds.ts
import { z } from 'zod';

export const RefundReasonSchema = z.enum([
  'customer_request',
  'cancellation',
  'duplicate',
  'fraudulent'
]);

export const createRefund = {
  method: 'POST',
  path: '/bookings/:bookingId/refunds',
  responses: {
    202: z.object({
      refundId: z.string(),
      status: z.literal('PENDING'),
      amount: z.number(),
    }),
    400: z.object({ error: z.string() }),
    409: z.object({ error: z.string() }), // Already refunded
  },
};

export const getRefundStatus = {
  method: 'GET',
  path: '/refunds/:refundId',
  responses: {
    200: z.object({
      id: z.string(),
      status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
      amount: z.number(),
      completedAt: z.date().optional(),
    }),
  },
};
```

### 6. Event Emission Pattern

Emit domain events for async processing (existing in MAIS):

```typescript
// In refund service:
async processRefund(refundRequestId: string, tenantId: string): Promise<void> {
  // ... process refund ...

  // Emit event for notifications
  await eventEmitter.emit('RefundProcessed', {
    refundId: refund.id,
    tenantId,
    bookingId: refund.bookingId,
    amount: refund.amount,
    completedAt: new Date().toISOString(),
  });
}

// Subscribe in separate handler (for email notification)
eventEmitter.on('RefundProcessed', async (event) => {
  const booking = await bookingRepo.findById(event.tenantId, event.bookingId);
  await emailProvider.sendRefundNotification(booking.email, {
    amount: event.amount,
    completedAt: event.completedAt,
  });
});
```

### 7. Webhook Idempotency Pattern

MAIS already has `WebhookEvent` model. Apply same pattern to refunds:

```typescript
// models (Prisma schema)
model RefundWebhookEvent {
  id          String   @id @default(cuid())
  tenantId    String
  refundId    String
  stripeEventId String @unique // Stripe event ID
  eventType   String         // "charge.refunded", "charge.refund.updated"
  payload     String   @db.Text // Raw webhook payload
  status      String   @default("PENDING")
  processedAt DateTime?
  createdAt   DateTime @default(now())

  @@unique([tenantId, stripeEventId])
  @@index([tenantId, status])
}

// Webhook handler
async handleRefundWebhook(tenantId: string, event: Stripe.Event) {
  // Check for duplicate (same as bookings webhooks)
  const existing = await webhookEventRepo.findByEventId(tenantId, event.id);
  if (existing?.status === 'PROCESSED') return;

  try {
    // Process refund status update
    await refundService.handleRefundWebhook(event);

    // Mark as processed
    await webhookEventRepo.updateStatus(existing.id, 'PROCESSED');
  } catch (error) {
    logger.error({ error }, 'Failed to process refund webhook');
    await webhookEventRepo.updateStatus(existing.id, 'FAILED');
    throw error; // Let middleware return 500
  }
}
```

### 8. Mock-First Development

MAIS uses mock adapters for development. Apply to all features:

```typescript
// adapters/mock/refund.adapter.ts
export class MockRefundAdapter implements PaymentProvider {
  async refund(input: RefundInput): Promise<RefundResult> {
    // Simulate Stripe refund
    return {
      refundId: `mock_refund_${Date.now()}`,
      status: 'succeeded',
      amountCents: input.amountCents,
    };
  }
}

// di.ts
const paymentProvider = ENV.ADAPTERS_PRESET === 'mock'
  ? new MockPaymentAdapter()
  : new StripePaymentAdapter(options);
```

---

## Feature-Specific MAIS Patterns

### Secure Tokens

**Follow existing password reset pattern:**

```typescript
// server/src/services/tenant-auth.service.ts (EXISTING)
async forgotPassword(email: string): Promise<void> {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  await prisma.tenant.update({
    where: { email },
    data: {
      passwordResetToken: hash,
      passwordResetExpires: new Date(Date.now() + 3600000),
    },
  });

  await emailProvider.sendPasswordReset(email, token, resetUrl);
}

// NEW: Apply same pattern to booking action tokens
export class BookingActionTokenService {
  async generateRescheduleToken(tenantId: string, bookingId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    await prisma.bookingActionToken.create({
      data: {
        tenantId, // ← ALWAYS include for multi-tenant
        bookingId,
        action: 'reschedule',
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return token;
  }

  async verifyAndConsumeToken(tenantId: string, token: string): Promise<BookingActionToken> {
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    const record = await prisma.bookingActionToken.findUnique({
      where: { tokenHash: hash },
    });

    // Always validate tenantId (prevent token hijacking)
    if (!record || record.tenantId !== tenantId) {
      throw new InvalidTokenError('Invalid or expired token');
    }

    if (record.usedAt) {
      throw new InvalidTokenError('Token already used');
    }

    if (record.expiresAt < new Date()) {
      throw new TokenExpiredError();
    }

    // Consume token (single-use enforcement)
    await prisma.bookingActionToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return record;
  }
}
```

### Reminders

**Use Bull queue like MAIS handles jobs:**

```typescript
// lib/queue/reminder-queue.ts (NEW)
import Queue from 'bull';
import type { ReminderJob } from '../entities';

export const reminderQueue = new Queue<ReminderJob>('bookings:reminders', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

// Subscribe to job processing
reminderQueue.process(async (job) => {
  const { bookingId, tenantId, type } = job.data;

  try {
    const booking = await bookingRepo.findById(tenantId, bookingId);
    if (!booking) return; // Booking deleted

    // Use existing emailProvider
    const htmlBody = this.renderReminderEmail(booking, type);
    await emailProvider.sendEmail({
      to: booking.email,
      subject: `Reminder: ${booking.coupleName}`,
      html: htmlBody,
    });

    // Log successful send
    await reminderLogRepo.create(tenantId, {
      bookingId,
      type,
      status: 'SENT',
      sentAt: new Date(),
    });
  } catch (error) {
    logger.error({ bookingId, error }, 'Reminder send failed');
    throw error; // Bull will retry
  }
});

// services/reminder.service.ts
export class ReminderService {
  async scheduleReminders(tenantId: string, booking: Booking, tenantTimezone: string): Promise<void> {
    const eventDateTime = DateTime.fromISO(booking.eventDate).setZone(tenantTimezone);

    // Pre-event reminder
    const preTime = eventDateTime.minus({ days: 3 }).set({ hour: 10 });
    const delayMs = preTime.toUTC().diffNow().as('milliseconds');

    if (delayMs > 0) {
      await reminderQueue.add(
        { bookingId: booking.id, tenantId, type: 'PRE_BOOKING' },
        {
          delay: Math.floor(delayMs),
          jobId: `pre-${booking.id}`, // Idempotent
        }
      );
    }
  }
}
```

**Integration point in booking service:**

```typescript
// services/booking.service.ts (EXISTING)
async onPaymentCompleted(tenantId: string, input: {...}): Promise<Booking> {
  // ... create booking ...

  // NEW: Schedule reminders
  const tenant = await tenantRepo.findById(tenantId);
  await reminderService.scheduleReminders(
    tenantId,
    created,
    tenant.timezone || 'America/New_York'
  );

  return created;
}
```

### Deposits

**Extend existing payment adapter:**

```typescript
// adapters/stripe.adapter.ts (EXISTING)
// ADD this method alongside createCheckoutSession:

async createPaymentIntent(input: {
  amountCents: number;
  email: string;
  metadata: Record<string, string>;
  stripeAccountId?: string;
  idempotencyKey?: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const options: Stripe.RequestOptions = {};
  if (input.idempotencyKey) {
    options.idempotencyKey = input.idempotencyKey;
  }

  const intent = await this.stripe.paymentIntents.create(
    {
      amount: input.amountCents,
      currency: 'usd',
      customer: input.email,
      metadata: input.metadata,
      statement_descriptor: 'Wedding Deposit',
      ...( input.stripeAccountId && {
        transfer_data: { destination: input.stripeAccountId },
        application_fee_amount: Math.round(input.amountCents * 0.1), // 10% platform fee
      })
    },
    options
  );

  return {
    clientSecret: intent.client_secret!,
    paymentIntentId: intent.id,
  };
}

// NEW SERVICE: services/deposit.service.ts
export class DepositPaymentService {
  constructor(
    private bookingRepo: BookingRepository,
    private paymentProvider: PaymentProvider,
  ) {}

  async createDepositIntent(
    tenantId: string,
    bookingId: string,
    depositPercent: number = 50,
    email: string
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) throw new NotFoundError(...);

    const depositCents = Math.floor(booking.totalPrice * (depositPercent / 100));

    // Generate idempotency key for safety
    const idempotencyKey = `deposit_${tenantId}_${bookingId}_${Date.now()}`;

    const session = await this.paymentProvider.createPaymentIntent({
      amountCents: depositCents,
      email,
      metadata: {
        tenantId,
        bookingId,
        paymentType: 'DEPOSIT',
        depositPercent: String(depositPercent),
      },
      idempotencyKey,
    });

    // Create payment stage record
    await prisma.bookingPaymentStage.create({
      data: {
        tenantId,
        bookingId,
        stageNumber: 1,
        type: 'DEPOSIT',
        amountCents: depositCents,
        percentOfTotal: depositPercent,
        stripePaymentIntentId: session.paymentIntentId,
      },
    });

    return session;
  }
}
```

### Refunds

**Use Bull queue like booking service:**

```typescript
// lib/queue/refund-queue.ts (NEW)
export const refundQueue = new Queue('bookings:refunds', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

refundQueue.process(async (job) => {
  const { refundRequestId, tenantId } = job.data;
  await refundService.processRefund(refundRequestId, tenantId);
});

// services/refund.service.ts (NEW)
export class RefundService {
  constructor(
    private refundRepo: RefundRepository,
    private paymentProvider: PaymentProvider,
    private eventEmitter: EventEmitter,
  ) {}

  async createRefund(
    tenantId: string,
    bookingId: string,
    reason: string,
    notes?: string
  ): Promise<string> {
    // Check for duplicate
    const existing = await this.refundRepo.findByBookingAndReason(tenantId, bookingId, reason);
    if (existing && existing.status === 'COMPLETED') {
      return existing.id;
    }

    // Create refund request
    const refund = await this.refundRepo.create(tenantId, {
      bookingId,
      reason,
      notes,
      idempotencyKey: `refund_${tenantId}_${bookingId}_${reason}_${Date.now()}`,
    });

    // Queue for async processing
    await refundQueue.add({ refundRequestId: refund.id, tenantId });

    return refund.id;
  }

  async processRefund(refundRequestId: string, tenantId: string): Promise<void> {
    const refund = await this.refundRepo.findById(tenantId, refundRequestId);
    if (!refund) throw new NotFoundError(...);

    if (refund.status === 'COMPLETED') return; // Already processed

    try {
      // Call Stripe with idempotency key
      const stripeRefund = await this.paymentProvider.refund({
        paymentIntentId: refund.stripePaymentIntentId,
        reason: refund.reason,
        idempotencyKey: refund.idempotencyKey,
      });

      // Update request
      await this.refundRepo.update(tenantId, refundRequestId, {
        status: 'COMPLETED',
        stripeRefundId: stripeRefund.refundId,
        completedAt: new Date(),
      });

      // Emit event for notifications
      await this.eventEmitter.emit('RefundProcessed', {
        refundId: refund.id,
        tenantId,
        bookingId: refund.bookingId,
      });
    } catch (error) {
      logger.error({ refundRequestId, error }, 'Refund failed');
      throw error; // Bull will retry
    }
  }
}
```

### Invoices

**Follow existing upload adapter pattern:**

```typescript
// lib/ports.ts (ADD to existing interfaces)
export interface InvoiceGenerator {
  generate(html: string): Promise<Buffer>;
}

// adapters/puppeteer.adapter.ts (NEW)
import puppeteer from 'puppeteer';

export class PuppeteerInvoiceGenerator implements InvoiceGenerator {
  async generate(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle2' });
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
    });
    await browser.close();

    return pdf;
  }
}

// services/invoice.service.ts (NEW)
export class InvoiceService {
  constructor(
    private bookingRepo: BookingRepository,
    private tenantRepo: TenantRepository,
    private invoiceGenerator: InvoiceGenerator,
  ) {}

  async generateInvoice(tenantId: string, bookingId: string): Promise<Buffer> {
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) throw new NotFoundError(...);

    const tenant = await this.tenantRepo.findById(tenantId);
    const invoiceNumber = await this.generateInvoiceNumber(tenantId);

    // Render HTML template (use Handlebars)
    const html = this.renderTemplate({ invoiceNumber, booking, tenant });

    // Generate PDF
    const pdf = await this.invoiceGenerator.generate(html);

    // Store record
    await prisma.invoice.create({
      data: {
        tenantId,
        bookingId,
        invoiceNumber,
        fileName: `invoice-${invoiceNumber}.pdf`,
      },
    });

    return pdf;
  }

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const tenant = await this.tenantRepo.findById(tenantId);
    const year = new Date().getFullYear();

    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        tenantId,
        invoiceNumber: { startsWith: `${tenant.slug.toUpperCase()}_${year}` },
      },
      orderBy: { invoiceNumber: 'desc' },
    });

    const sequence = lastInvoice ? parseInt(lastInvoice.invoiceNumber.split('_')[2]) + 1 : 1;
    return `${tenant.slug.toUpperCase()}_${year}_${String(sequence).padStart(3, '0')}`;
  }

  private renderTemplate(data: any): string {
    // Use Handlebars to compile template
    // See ADVANCED-FEATURES-BEST-PRACTICES.md for full template
    return Handlebars.compile(invoiceTemplate)(data);
  }
}

// di.ts - Add invoice service to DI container
const di = {
  // ...existing services...
  invoiceService: new InvoiceService(
    prismaAdapters.bookingRepository,
    prismaAdapters.tenantRepository,
    new PuppeteerInvoiceGenerator(),
  ),
};
```

---

## Testing Pattern

Follow MAIS' test isolation pattern:

```typescript
// test/services/refund.service.test.ts
import { createTestTenant } from '../helpers/test-tenant';

describe('RefundService', () => {
  let refundService: RefundService;
  let refundRepo: RefundRepository;

  beforeEach(async () => {
    refundService = di.refundService;
    refundRepo = di.refundRepository;
  });

  test('should create refund request idempotently', async () => {
    const { tenantId, cleanup } = await createTestTenant();

    try {
      // Create first refund
      const refund1 = await refundService.createRefund(tenantId, bookingId, 'customer_request');

      // Create duplicate
      const refund2 = await refundService.createRefund(tenantId, bookingId, 'customer_request');

      // Should be same refund
      expect(refund1).toBe(refund2);
    } finally {
      await cleanup();
    }
  });

  test('should include tenantId in all queries', async () => {
    const { tenantId, cleanup } = await createTestTenant();
    const otherTenantId = 'fake-tenant-id';

    try {
      const refund = await refundRepo.create(tenantId, { ... });

      // Should not find refund from other tenant
      const notFound = await refundRepo.findById(otherTenantId, refund.id);
      expect(notFound).toBeNull();
    } finally {
      await cleanup();
    }
  });
});
```

---

## Database Schema Pattern

Add all feature models following MAIS' conventions:

```prisma
// Secure Tokens
model BookingActionToken {
  id          String    @id @default(cuid())
  tenantId    String    // Multi-tenant isolation
  bookingId   String    @unique
  action      String    // "reschedule" | "cancel"
  tokenHash   String    @unique
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime  @default(now())
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  booking     Booking   @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  @@index([tenantId])
}

// Reminders
model ReminderLog {
  id        String    @id @default(cuid())
  tenantId  String
  bookingId String
  type      String    // "PRE_BOOKING" | "CONFIRMATION"
  status    String    @default("PENDING")
  sentAt    DateTime?
  error     String?
  createdAt DateTime  @default(now())
  tenant    Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId, status])
}

// Deposits
model BookingPaymentStage {
  id                    String    @id @default(cuid())
  tenantId              String
  bookingId             String
  stageNumber           Int       // 1=deposit, 2=remainder
  type                  String    // "DEPOSIT" | "REMAINDER"
  amountCents           Int
  percentOfTotal        Decimal   @db.Decimal(5, 2)
  status                String    @default("PENDING")
  stripePaymentIntentId String    @unique
  completedAt           DateTime?
  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  booking               Booking   @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  @@unique([bookingId, stageNumber])
  @@index([tenantId, status])
}

// Refunds
model RefundRequest {
  id                    String    @id @default(cuid())
  tenantId              String
  bookingId             String
  stripePaymentIntentId String
  amountCents           Int
  reason                String
  status                String    @default("PENDING")
  stripeRefundId        String?
  idempotencyKey        String    @unique
  completedAt           DateTime?
  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  booking               Booking   @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  @@unique([bookingId, reason])
  @@index([tenantId, status])
}

// Invoices
model Invoice {
  id            String    @id @default(cuid())
  tenantId      String
  bookingId     String    @unique
  invoiceNumber String
  fileName      String
  status        String    @default("GENERATED")
  generatedAt   DateTime  @default(now())
  sentAt        DateTime?
  tenant        Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  booking       Booking   @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  @@unique([tenantId, invoiceNumber])
  @@index([tenantId, createdAt])
}
```

---

## Environment Configuration

Add to existing `.env`:

```bash
# Redis (for Bull queues)
REDIS_HOST=localhost
REDIS_PORT=6379

# Puppeteer (only needed in production)
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
PUPPETEER_SKIP_DOWNLOAD=true

# Feature flags (gradual rollout)
FEATURE_REMINDERS_ENABLED=true
FEATURE_DEPOSITS_ENABLED=false
FEATURE_REFUNDS_ENABLED=true
FEATURE_INVOICES_ENABLED=true
```

---

## Deployment Checklist

- [ ] Add `BookingActionToken` model and migration
- [ ] Add `ReminderLog` model and migration
- [ ] Add `BookingPaymentStage` model and migration
- [ ] Add `RefundRequest` model and migration
- [ ] Add `Invoice` model and migration
- [ ] Install dependencies: `bull`, `luxon`, `puppeteer`, `handlebars`
- [ ] Set up Redis (Docker or managed service)
- [ ] Create queue workers in DI
- [ ] Add error error classes to `lib/errors/business.ts`
- [ ] Test with mock adapters first (`ADAPTERS_PRESET=mock`)
- [ ] Test with real adapters in staging
- [ ] Deploy migrations and services
- [ ] Monitor queue health in production

---

## Common Issues & Solutions

**Issue: Queue jobs not processing**
```bash
# Check Redis connection
redis-cli ping  # Should return PONG

# Verify Bull process is registered
# In logs, should see: "Worker process started for queue:..."
```

**Issue: Timezone mismatch in reminders**
```typescript
// ❌ WRONG
const eventDate = new Date('2025-06-15');

// ✅ CORRECT
const eventDate = DateTime.fromISO('2025-06-15')
  .setZone(tenantTimezone)
  .toUTC();
```

**Issue: Idempotency key generation**
```typescript
// Use stable key (same for retries)
const key = `refund_${tenantId}_${bookingId}_${reason}`;

// NOT time-based (changes on retry)
const key = `refund_${tenantId}_${bookingId}_${Date.now()}`; // ❌
```

---

## References

- **MAIS Architecture**: See `CLAUDE.md`
- **Error Patterns**: `server/src/lib/errors/`
- **Service Examples**: `server/src/services/booking.service.ts`
- **Adapter Examples**: `server/src/adapters/stripe.adapter.ts`
- **Full Best Practices**: `ADVANCED-FEATURES-BEST-PRACTICES.md`

