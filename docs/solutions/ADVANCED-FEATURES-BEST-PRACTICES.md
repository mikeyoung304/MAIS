# Advanced Features: Best Practices & Implementation Patterns

**Author:** Research-based recommendations for MAIS platform
**Date:** December 2025
**Scope:** Node.js/Express/Prisma multi-tenant booking platform
**Last Updated:** 2025-12-02

## Overview

This document synthesizes Node.js ecosystem best practices for 5 critical booking platform features. Each section provides library recommendations, architectural patterns, and MAIS-specific implementation guidance.

---

## 1. Secure Token Systems

### Context in MAIS

MAIS already implements JWT for tenant authentication. Action tokens (reschedule, cancel, reset password) are needed for:
- Password reset flows (already implemented)
- Booking reschedule/cancel actions
- One-time admin setup links
- Payment dispute tokens

### Architecture Decision: Hybrid Approach

Use **JWT + single-use tokens** depending on context:

| Token Type | Mechanism | Use Case | Expiration |
|-----------|-----------|----------|-----------|
| **JWT** | Stateless, signed | Authentication, tenant sessions | 7 days |
| **Single-use HMAC** | DB-backed, token hashes | Sensitive actions (password reset, refunds) | 1 hour |
| **Opaque random** | DB-backed, database lookup | One-time actions requiring audit trail | Configurable |

### Recommended Implementation Pattern

#### 1.1 Password Reset (Status: IMPLEMENTED)

**Current Pattern in MAIS:**
```typescript
// server/src/services/tenant-auth.service.ts
async forgotPassword(email: string): Promise<void> {
  // Generate SHA-256 token hash
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  // Store hash + expiration in DB (not the token itself)
  await prisma.tenant.update({
    where: { email },
    data: {
      passwordResetToken: hash,
      passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour
    },
  });

  // Send unhashed token in email (one-way hash)
  await emailProvider.sendPasswordReset(email, token, resetUrl);
}
```

**Why this works:**
- Hash stored in DB, token sent in email (one-way function)
- If DB is compromised, tokens are still unusable
- Tokens are single-use by design (verified then deleted)

**Best practices already in MAIS:**
- ✅ Tokens expire (1 hour)
- ✅ Hashed in database
- ✅ Single-use enforcement
- ✅ Rate limiting on forgot-password endpoint

---

#### 1.2 Booking Action Tokens (Reschedule/Cancel)

**Recommended Approach:**

```typescript
// Add to Prisma schema:
// model BookingActionToken {
//   id        String   @id @default(cuid())
//   bookingId String   @unique
//   tenantId  String   // Multi-tenant isolation
//   action    String   // "reschedule" | "cancel"
//   tokenHash String   @unique // SHA-256(token)
//   expiresAt DateTime
//   usedAt    DateTime?
//   createdAt DateTime @default(now())
//   booking   Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
//   tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
//   @@index([tenantId])
//   @@index([expiresAt]) // Cleanup expired tokens
// }

// Service pattern:
export class BookingActionTokenService {
  async generateRescheduleToken(tenantId: string, bookingId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    await prisma.bookingActionToken.create({
      data: {
        bookingId,
        tenantId,
        action: 'reschedule',
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return token;
  }

  async verifyAndConsumeToken(tenantId: string, token: string): Promise<BookingActionToken> {
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    const record = await prisma.bookingActionToken.findUnique({
      where: { tokenHash: hash },
    });

    if (!record || record.tenantId !== tenantId) {
      throw new InvalidTokenError('Invalid or expired token');
    }

    if (record.usedAt) {
      throw new InvalidTokenError('Token already used');
    }

    if (record.expiresAt < new Date()) {
      throw new TokenExpiredError();
    }

    // Consume token (prevent reuse)
    await prisma.bookingActionToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return record;
  }
}
```

### 1.3 Library Recommendations

| Library | Purpose | Notes |
|---------|---------|-------|
| `jsonwebtoken` | JWT signing/verification | Already used in MAIS ✅ |
| `crypto` (Node.js builtin) | HMAC & random token generation | No external dependency needed |
| `bcryptjs` | Password hashing | Already used in MAIS ✅ |
| `jose` (optional) | Modern JWT alternative | More secure than jsonwebtoken, consider for future |

### 1.4 MAIS-Specific Implementation Checklist

- [x] Password reset tokens (implemented)
- [ ] Booking reschedule tokens (implement BookingActionToken model)
- [ ] Booking cancellation tokens
- [ ] Invitation tokens for tenant admins (future)
- [ ] API key rotation tokens (future)

### 1.5 Security Rules

```typescript
// CRITICAL RULES for all action tokens:

// 1. Always hash tokens before storing in DB
const token = crypto.randomBytes(32).toString('hex');
const hash = crypto.createHash('sha256').update(token).digest('hex');

// 2. Include tenantId in token validation (multi-tenant isolation)
const verified = await tokenService.verify(tenantId, token);

// 3. Enforce single-use by setting usedAt on verification
await prisma.bookingActionToken.update({
  where: { tokenHash: hash },
  data: { usedAt: new Date() },
});

// 4. Implement cleanup job for expired tokens (run nightly)
// DELETE FROM booking_action_tokens WHERE expiresAt < NOW()

// 5. Never log tokens in error messages
logger.error({ bookingId }, 'Token verification failed');  // ✅
logger.error({ bookingId, token }, 'Token verification failed');  // ❌
```

---

## 2. Reminder Systems

### Context in MAIS

Booking reminders are essential for:
- Pre-booking reminders (3 days before)
- Day-of confirmation reminders
- Post-booking follow-up reminders
- Tenant availability reminders

### Architectural Comparison

| Approach | Pros | Cons | MAIS Fit |
|----------|------|------|----------|
| **node-cron** | Simple, no external service | Not distributed, loses jobs on restart | ❌ Not production-ready |
| **Bull/BullMQ** | Redis-backed, distributed, retries | Requires Redis | ✅ Production-ready |
| **Agenda** | MongoDB-backed, distributed | Heavier than Bull | ❌ MAIS uses PostgreSQL |
| **Node Scheduler** | Lightweight, memory-based | Not fault-tolerant | ❌ Not production |
| **AWS EventBridge** | Serverless, managed | Vendor lock-in, cost | ⚠️ Possible for SaaS |

### Recommended: Bull + PostgreSQL Adapter

**Why Bull is better than alternatives for MAIS:**

1. **Redis backend** - Fast, perfect for job queue
2. **Fault tolerance** - Jobs persisted in Redis, retry on failure
3. **Distributed** - Can scale horizontally
4. **Built for Node.js** - Excellent TypeScript support
5. **Mature ecosystem** - 10K+ GitHub stars

**Installation:**
```bash
npm install bull redis ioredis
npm install --save-dev @types/bull
```

### 2.1 Implementation Pattern

```typescript
// lib/queue/reminder-queue.ts
import Queue from 'bull';
import type { ReminderJob } from '../entities';

// Create queue with connection pooling
export const reminderQueue = new Queue<ReminderJob>('bookings:reminders', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null, // Required for blocking pops
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start 2s, exponential backoff
    },
    removeOnComplete: true,
    removeOnFail: false, // Keep failed jobs for debugging
  },
});

// Process reminder jobs
reminderQueue.process(async (job) => {
  const { bookingId, tenantId, type } = job.data;

  try {
    const booking = await bookingRepo.findById(tenantId, bookingId);
    if (!booking) return; // Booking deleted

    switch (type) {
      case 'BOOKING_CONFIRMATION':
        await emailProvider.sendBookingReminder(booking, 'confirmation');
        break;
      case 'PRE_BOOKING':
        await emailProvider.sendBookingReminder(booking, 'pre-event');
        break;
      case 'POST_BOOKING':
        await emailProvider.sendBookingReminder(booking, 'post-event');
        break;
    }

    logger.info({ bookingId, type }, 'Reminder sent successfully');
  } catch (error) {
    logger.error({ bookingId, error }, 'Failed to send reminder');
    throw error; // Bull will retry
  }
});

// Event listeners for monitoring
reminderQueue.on('failed', (job, error) => {
  logger.error({ jobId: job.id, attempts: job.attemptsMade, error }, 'Reminder job failed permanently');
});

reminderQueue.on('error', (error) => {
  logger.error({ error }, 'Queue error');
});
```

### 2.2 Timezone-Aware Scheduling

**Use Luxon for timezone handling:**

```bash
npm install luxon
npm install --save-dev @types/luxon
```

```typescript
import { DateTime } from 'luxon';

export class BookingReminderService {
  async scheduleReminders(tenantId: string, booking: Booking, tenantTimezone: string): Promise<void> {
    // Parse booking date in tenant's timezone
    const eventDateTime = DateTime
      .fromISO(booking.eventDate)
      .setZone(tenantTimezone)
      .startOf('day');

    // Pre-event reminder: 3 days before at 10:00 AM
    const preReminderTime = eventDateTime
      .minus({ days: 3 })
      .set({ hour: 10, minute: 0, second: 0 });

    // Convert to UTC for job scheduling
    const preReminderUTC = preReminderTime.toUTC();
    const delayMs = preReminderUTC.diffNow().as('milliseconds');

    if (delayMs > 0) {
      await reminderQueue.add(
        { bookingId: booking.id, tenantId, type: 'PRE_BOOKING' },
        {
          delay: Math.floor(delayMs),
          jobId: `pre-${booking.id}`, // Idempotent
        }
      );
    }

    // Day-of reminder: 24 hours before at 2:00 PM
    const dayOfReminderTime = eventDateTime
      .minus({ hours: 24 })
      .set({ hour: 14, minute: 0, second: 0 });

    const dayOfReminderUTC = dayOfReminderTime.toUTC();
    const dayOfDelayMs = dayOfReminderUTC.diffNow().as('milliseconds');

    if (dayOfDelayMs > 0) {
      await reminderQueue.add(
        { bookingId: booking.id, tenantId, type: 'BOOKING_CONFIRMATION' },
        {
          delay: Math.floor(dayOfDelayMs),
          jobId: `day-of-${booking.id}`,
        }
      );
    }
  }
}
```

### 2.3 Schema Addition

```prisma
// Add to schema.prisma:
model ReminderLog {
  id        String   @id @default(cuid())
  tenantId  String
  bookingId String
  type      String   // "PRE_BOOKING", "BOOKING_CONFIRMATION", "POST_BOOKING"
  status    String   @default("PENDING") // "PENDING", "SENT", "FAILED"
  sentAt    DateTime?
  error     String?  @db.Text
  createdAt DateTime @default(now())
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, type])
  @@index([tenantId, status])
  @@index([createdAt])
}
```

### 2.4 Failure Recovery

```typescript
// Run as cron job (nightly at 2 AM)
export async function recoveryJob() {
  const failedReminders = await prisma.reminderLog.findMany({
    where: {
      status: 'FAILED',
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    },
  });

  for (const reminder of failedReminders) {
    try {
      await reminderQueue.add(
        {
          bookingId: reminder.bookingId,
          tenantId: reminder.tenantId,
          type: reminder.type,
        },
        {
          jobId: `retry-${reminder.id}`,
          priority: 1, // Higher priority for retries
        }
      );
    } catch (error) {
      logger.error({ reminderId: reminder.id, error }, 'Failed to queue retry');
    }
  }
}
```

### 2.5 Library Recommendations

| Library | Purpose | Installation |
|---------|---------|--------------|
| `bull` | Job queue | `npm install bull` |
| `ioredis` | Redis client | `npm install ioredis` (dependency) |
| `luxon` | Timezone handling | `npm install luxon` |
| `redis` | Redis server | External (Docker: `docker run -d redis:7`) |

---

## 3. Deposit/Partial Payment Systems

### Context in MAIS

MAIS currently uses full-payment Checkout Sessions. For deposits:
- Customers pay 50% upfront, 50% before event
- Flexible payment scheduling
- Refund tracking for partial payments

### Architecture Decision: Stripe Payment Intents

Use **Payment Intent API** (not Checkout Sessions) for split payments:

| Approach | Split Payment Support | Refund Handling | Complexity |
|----------|------------------------|-----------------|-----------|
| **Checkout Session** | ❌ No | Basic | Low |
| **Payment Intent** | ✅ Yes | Granular | Medium |
| **Subscription API** | ✅ Yes | Automatic | High |
| **Custom** | ✅ Yes | Manual | Very High |

### 3.1 Deposit Payment Flow

```typescript
// contracts/booking-deposits.ts
import { z } from 'zod';

export const DepositPaymentSchema = z.object({
  bookingId: z.string(),
  depositPercent: z.number().min(0).max(100), // e.g., 50 for 50%
  email: z.string().email(),
});

export const createDepositPaymentIntent = {
  method: 'POST',
  path: '/bookings/:bookingId/deposit',
  responses: {
    200: z.object({
      clientSecret: z.string(),
      paymentIntentId: z.string(),
      amount: z.number(), // Amount in cents
      depositPercent: z.number(),
    }),
  },
};
```

```typescript
// services/deposit.service.ts
export class DepositPaymentService {
  constructor(
    private readonly stripe: Stripe,
    private readonly bookingRepo: BookingRepository,
    private readonly paymentRepo: PaymentRepository,
  ) {}

  /**
   * Create deposit payment intent (e.g., 50% of total)
   * Customer can pay deposit now, remainder due later
   */
  async createDepositIntent(
    tenantId: string,
    bookingId: string,
    depositPercent: number,
    email: string
  ): Promise<{ clientSecret: string; paymentIntentId: string; amount: number }> {
    // Fetch booking and validate
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }

    // Calculate deposit amount
    const depositCents = Math.floor(booking.totalPrice * (depositPercent / 100));
    const remainderCents = booking.totalPrice - depositCents;

    // Create Payment Intent with metadata
    const intent = await this.stripe.paymentIntents.create({
      amount: depositCents,
      currency: 'usd',
      customer: email, // Email-based customer (can link later)
      metadata: {
        tenantId,
        bookingId,
        paymentType: 'DEPOSIT',
        depositPercent: String(depositPercent),
        remainderAmount: String(remainderCents),
      },
      statement_descriptor: `Deposit - ${booking.coupleName}`,
    });

    // Record payment intent in database
    await prisma.bookingPaymentStage.create({
      data: {
        bookingId,
        tenantId,
        stageNumber: 1,
        type: 'DEPOSIT',
        amountCents: depositCents,
        percentOfTotal: depositPercent,
        status: 'PENDING',
        stripePaymentIntentId: intent.id,
      },
    });

    return {
      clientSecret: intent.client_secret!,
      paymentIntentId: intent.id,
      amount: depositCents,
      depositPercent,
    };
  }

  /**
   * Confirm deposit payment and create payment record
   */
  async confirmDepositPayment(
    tenantId: string,
    bookingId: string,
    paymentIntentId: string
  ): Promise<void> {
    // Verify payment intent succeeded
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.status !== 'succeeded') {
      throw new PaymentFailedError(
        `Payment Intent ${paymentIntentId} status is ${intent.status}`,
        intent.last_payment_error?.message
      );
    }

    // Record successful deposit payment
    await prisma.payment.create({
      data: {
        tenantId,
        bookingId,
        amount: intent.amount,
        processor: 'stripe',
        processorId: paymentIntentId,
        status: 'CAPTURED',
        paymentType: 'DEPOSIT', // Add column: enum PaymentType { DEPOSIT, REMAINDER, FULL }
      },
    });

    // Update booking payment stage
    await prisma.bookingPaymentStage.update({
      where: { stripePaymentIntentId: paymentIntentId },
      data: { status: 'COMPLETED' },
    });
  }

  /**
   * Create final payment intent for remainder
   * Called when customer is ready to pay balance
   */
  async createRemainderIntent(
    tenantId: string,
    bookingId: string,
    email: string
  ): Promise<{ clientSecret: string; paymentIntentId: string; amount: number }> {
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }

    // Get deposit payment to calculate remainder
    const depositPayment = await prisma.payment.findFirst({
      where: {
        tenantId,
        bookingId,
        status: 'CAPTURED',
        paymentType: 'DEPOSIT',
      },
    });

    const remainderCents = booking.totalPrice - (depositPayment?.amount || 0);

    const intent = await this.stripe.paymentIntents.create({
      amount: remainderCents,
      currency: 'usd',
      customer: email,
      metadata: {
        tenantId,
        bookingId,
        paymentType: 'REMAINDER',
        depositPaid: String(depositPayment?.amount || 0),
      },
      statement_descriptor: `Final Payment - ${booking.coupleName}`,
    });

    // Record payment stage
    await prisma.bookingPaymentStage.create({
      data: {
        bookingId,
        tenantId,
        stageNumber: 2,
        type: 'REMAINDER',
        amountCents: remainderCents,
        percentOfTotal: 100 - (depositPayment ? 50 : 0),
        status: 'PENDING',
        stripePaymentIntentId: intent.id,
      },
    });

    return {
      clientSecret: intent.client_secret!,
      paymentIntentId: intent.id,
      amount: remainderCents,
    };
  }
}
```

### 3.2 Schema Additions

```prisma
// Add to schema.prisma:

// Track multi-stage payments (deposit + remainder)
model BookingPaymentStage {
  id                      String   @id @default(cuid())
  tenantId                String
  bookingId               String
  stageNumber             Int      // 1 = deposit, 2 = remainder, etc.
  type                    String   // "DEPOSIT", "REMAINDER", "INSTALLMENT"
  amountCents             Int
  percentOfTotal          Decimal  @db.Decimal(5, 2)
  status                  String   @default("PENDING") // "PENDING", "COMPLETED", "FAILED", "REFUNDED"
  stripePaymentIntentId   String   @unique
  completedAt             DateTime?
  refundedAt              DateTime?
  createdAt               DateTime @default(now())

  tenant                  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  booking                 Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@unique([bookingId, stageNumber]) // One stage per booking
  @@index([tenantId, status])
  @@index([bookingId])
}

// Modify Payment model to add paymentType:
// enum PaymentType { FULL, DEPOSIT, REMAINDER }
// paymentType  PaymentType @default(FULL)
```

### 3.3 Library Recommendations

| Library | Purpose | Notes |
|---------|---------|-------|
| `stripe` | Payment processing | Already used in MAIS ✅ |
| `stripe-js` | Browser-side Stripe | For frontend payment elements |

---

## 4. Refund Handling

### Context in MAIS

Refunds are needed for:
- Cancellations (full refund)
- Partial refunds (customer requests)
- Failed bookings
- Dispute resolution

### Pattern: Async Refund Processing with Idempotency

**Key principle:** Refunds are async operations that can fail and need retry logic.

### 4.1 Implementation Pattern

```typescript
// models/refund.ts
export interface RefundRequest {
  bookingId: string;
  tenantId: string;
  amountCents?: number; // Omit for full refund
  reason: string; // "customer_request", "cancellation", "duplicate", "fraudulent"
  notes?: string;
}

// services/refund.service.ts
export class RefundService {
  constructor(
    private readonly stripe: Stripe,
    private readonly bookingRepo: BookingRepository,
    private readonly paymentRepo: PaymentRepository,
  ) {}

  /**
   * Create refund request (idempotent)
   * Returns existing refund if already processed
   */
  async createRefund(input: RefundRequest): Promise<string> {
    const { tenantId, bookingId, amountCents, reason } = input;

    // Check for existing refund request (idempotency)
    const existing = await prisma.refundRequest.findFirst({
      where: {
        tenantId,
        bookingId,
        status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] },
      },
    });

    if (existing) {
      return existing.id;
    }

    // Fetch booking and validate
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }

    // Fetch payment
    const payment = await this.paymentRepo.findByBookingId(tenantId, bookingId);
    if (!payment) {
      throw new PaymentError('No payment found for this booking');
    }

    // Create refund request
    const refundRequest = await prisma.refundRequest.create({
      data: {
        tenantId,
        bookingId,
        paymentId: payment.id,
        stripePaymentIntentId: payment.processorId,
        amountCents: amountCents || payment.amount,
        reason,
        notes: input.notes,
        status: 'PENDING',
        idempotencyKey: this.generateIdempotencyKey(tenantId, bookingId, reason),
      },
    });

    // Queue for async processing
    await refundQueue.add(
      { refundRequestId: refundRequest.id, tenantId },
      { jobId: `refund-${refundRequest.id}` }
    );

    return refundRequest.id;
  }

  /**
   * Process refund (called by Bull queue)
   * Handles retries and failure recovery
   */
  async processRefund(refundRequestId: string, tenantId: string): Promise<void> {
    const refundRequest = await prisma.refundRequest.findUnique({
      where: { id: refundRequestId },
    });

    if (!refundRequest) {
      throw new NotFoundError(`Refund request ${refundRequestId} not found`);
    }

    if (refundRequest.status === 'COMPLETED') {
      return; // Already processed
    }

    try {
      // Update status to PROCESSING
      await prisma.refundRequest.update({
        where: { id: refundRequestId },
        data: { status: 'PROCESSING' },
      });

      // Call Stripe with idempotency key
      const stripeRefund = await this.stripe.refunds.create(
        {
          payment_intent: refundRequest.stripePaymentIntentId,
          amount: refundRequest.amountCents,
          reason: refundRequest.reason as 'duplicate' | 'fraudulent' | 'requested_by_customer',
          metadata: {
            refundRequestId,
            tenantId,
          },
        },
        {
          idempotencyKey: refundRequest.idempotencyKey,
        }
      );

      // Update refund request with Stripe refund ID
      await prisma.refundRequest.update({
        where: { id: refundRequestId },
        data: {
          stripeRefundId: stripeRefund.id,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Emit event for notifications
      await eventEmitter.emit('RefundProcessed', {
        refundRequestId,
        tenantId,
        amount: refundRequest.amountCents,
      });

      logger.info({ refundRequestId, stripeRefundId: stripeRefund.id }, 'Refund completed');
    } catch (error) {
      // Log error but don't throw (let Bull handle retries)
      logger.error(
        { refundRequestId, error, attempt: (error as any).attempt || 1 },
        'Refund processing failed'
      );

      // Update request with error
      await prisma.refundRequest.update({
        where: { id: refundRequestId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
          lastAttemptAt: new Date(),
        },
      });

      throw error; // Bull will retry
    }
  }

  /**
   * Webhook handler for Stripe refund events
   * Updates refund status based on Stripe events
   */
  async handleRefundWebhook(event: Stripe.Event): Promise<void> {
    const refund = event.data.object as Stripe.Refund;

    if (!refund.metadata?.refundRequestId) {
      logger.warn({ stripeRefundId: refund.id }, 'Refund webhook missing refundRequestId');
      return;
    }

    const refundRequest = await prisma.refundRequest.findUnique({
      where: { id: refund.metadata.refundRequestId },
    });

    if (!refundRequest) {
      logger.warn(
        { refundRequestId: refund.metadata.refundRequestId },
        'Refund request not found for webhook'
      );
      return;
    }

    // Update based on event type
    switch (event.type) {
      case 'charge.refunded':
        await prisma.refundRequest.update({
          where: { id: refundRequest.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
        break;

      case 'charge.refund.updated':
        if (refund.status === 'failed') {
          await prisma.refundRequest.update({
            where: { id: refundRequest.id },
            data: {
              status: 'FAILED',
              error: refund.failure_reason || 'Refund failed at Stripe',
            },
          });
        }
        break;
    }
  }

  private generateIdempotencyKey(tenantId: string, bookingId: string, reason: string): string {
    return `refund_${tenantId}_${bookingId}_${reason}_${Date.now()}`;
  }
}
```

### 4.2 Schema Additions

```prisma
model RefundRequest {
  id                      String   @id @default(cuid())
  tenantId                String
  bookingId               String
  paymentId               String
  stripePaymentIntentId   String   // Payment Intent being refunded
  stripeRefundId          String?  // Stripe Refund ID (populated after processing)

  // Refund details
  amountCents             Int
  reason                  String   // "customer_request", "cancellation", "duplicate", "fraudulent"
  notes                   String?  @db.Text
  idempotencyKey          String   @unique

  // Processing
  status                  String   @default("PENDING") // "PENDING", "PROCESSING", "COMPLETED", "FAILED"
  error                   String?  @db.Text
  lastAttemptAt           DateTime?
  completedAt             DateTime?

  // Audit
  requestedBy             String? // User email who requested refund
  requestedAt             DateTime @default(now())
  createdAt               DateTime @default(now())

  tenant                  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  booking                 Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@unique([bookingId, reason]) // One refund per reason per booking
  @@index([tenantId, status])
  @@index([tenantId, createdAt])
  @@index([bookingId])
}
```

### 4.3 Queue Setup

```typescript
// lib/queue/refund-queue.ts
import Queue from 'bull';

export const refundQueue = new Queue('bookings:refunds', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    attempts: 5, // Retry up to 5 times
    backoff: {
      type: 'exponential',
      delay: 5000, // Start 5s, exponential backoff
    },
  },
});

refundQueue.process(async (job) => {
  const { refundRequestId, tenantId } = job.data;
  await refundService.processRefund(refundRequestId, tenantId);
});

refundQueue.on('failed', (job, error) => {
  logger.error(
    { jobId: job.id, refundRequestId: job.data.refundRequestId, attempts: job.attemptsMade, error },
    'Refund processing failed permanently after all retries'
  );
  // Send alert to support team
});
```

### 4.4 Error Classes

```typescript
// Add to lib/errors/business.ts:

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

export class RefundFailedError extends RefundError {
  constructor(message: string, public readonly stripeError?: string) {
    super(message, 'REFUND_FAILED');
    this.name = 'RefundFailedError';
  }
}
```

### 4.5 Best Practices

```typescript
// CRITICAL RULES for refunds:

// 1. Always use idempotency keys
const refundRequest = await stripe.refunds.create(
  { payment_intent, amount },
  { idempotencyKey: refundRequest.idempotencyKey } // ✅
);

// 2. Store refund requests before processing (audit trail)
const refund = await prisma.refundRequest.create({ ... }); // FIRST
await refundQueue.add(refund); // THEN queue

// 3. Update refund status from Stripe webhooks (source of truth)
switch (event.type) {
  case 'charge.refunded':
    await prisma.refundRequest.update({ status: 'COMPLETED' });
    break;
}

// 4. Never refund more than the original payment
if (amountCents > payment.amount) {
  throw new RefundError('Refund amount exceeds payment amount');
}

// 5. Log all refund requests for audit
logger.info(
  { bookingId, amount, reason, requestedBy },
  'Refund requested'
);
```

---

## 5. Invoice Generation

### Context in MAIS

Invoices are needed for:
- Payment confirmations (send to customer)
- Receipts (customer records)
- Tax documentation
- Refund records

### Architecture Decision: Puppeteer + Handlebars

| Approach | Output Quality | Speed | Setup | MAIS Fit |
|----------|---|---|---|---|
| **pdfkit** | Medium (low-level) | Fast | Simple | ❌ Tedious layout |
| **puppeteer** | High (HTML→PDF) | Slower | Docker | ✅ Best quality |
| **pdfrw** | Low (manipulation) | Fast | Simple | ❌ No generation |
| **wkhtmltopdf** | High (HTML→PDF) | Medium | System binary | ❌ Deployment issues |
| **html-pdf** | Medium | Medium | npm | ⚠️ Outdated |

**Recommendation:** Puppeteer for production, pdfkit for simple receipts.

### 5.1 Puppeteer Invoice Generation

**Installation:**
```bash
npm install puppeteer handlebars
npm install --save-dev @types/node
```

```typescript
// services/invoice.service.ts
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';

export class InvoiceService {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly tenantRepo: TenantRepository,
  ) {}

  /**
   * Generate PDF invoice for booking
   * Returns PDF buffer for streaming/download
   */
  async generateInvoice(tenantId: string, bookingId: string): Promise<Buffer> {
    // Fetch booking and tenant data
    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking ${bookingId} not found`);
    }

    const tenant = await this.tenantRepo.findById(tenantId);
    const pkg = await this.packageRepo.getById(tenantId, booking.packageId);

    // Generate invoice number (unique per tenant)
    const invoiceNumber = await this.generateInvoiceNumber(tenantId);

    // Prepare template data
    const templateData = {
      tenantName: tenant.name,
      tenantLogo: tenant.branding?.logo || '',
      tenantAddress: tenant.branding?.address || '',
      invoiceNumber,
      invoiceDate: new Date().toLocaleDateString('en-US'),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US'),

      // Customer details
      customerName: booking.coupleName,
      customerEmail: booking.email,

      // Booking details
      eventDate: booking.eventDate,
      packageName: pkg.title,
      packageDescription: pkg.description,

      // Line items
      lineItems: [
        {
          description: `${pkg.title} - Wedding Package`,
          quantity: 1,
          unitPrice: `$${(pkg.priceCents / 100).toFixed(2)}`,
          amount: `$${(pkg.priceCents / 100).toFixed(2)}`,
        },
        ...booking.addOnIds.map(addOnId => {
          const addOn = pkg.addOns.find(a => a.id === addOnId);
          return {
            description: addOn?.title || 'Add-on',
            quantity: 1,
            unitPrice: `$${(addOn?.priceCents / 100 || 0).toFixed(2)}`,
            amount: `$${(addOn?.priceCents / 100 || 0).toFixed(2)}`,
          };
        }),
      ],

      // Totals
      subtotal: `$${(booking.totalPrice / 100).toFixed(2)}`,
      tax: '$0.00', // TODO: Add tax calculation
      total: `$${(booking.totalPrice / 100).toFixed(2)}`,

      // Payment info
      paid: booking.status === 'PAID' || booking.status === 'CONFIRMED',
      paymentMethod: 'Credit Card via Stripe',
      transactionId: booking.stripePaymentIntentId,

      // Terms
      terms: 'Payment due upon receipt. Late payment may incur additional fees.',
      notes: `Thank you for booking with ${tenant.name}!`,
    };

    // Render HTML
    const html = await this.renderInvoiceTemplate(templateData);

    // Convert to PDF
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle2' });

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      printBackground: true,
    });

    await browser.close();

    // Store invoice in database
    await prisma.invoice.create({
      data: {
        tenantId,
        bookingId,
        invoiceNumber,
        fileName: `invoice-${invoiceNumber}.pdf`,
        status: 'GENERATED',
      },
    });

    return pdf;
  }

  /**
   * Generate unique invoice number per tenant
   * Format: TENANT_YEAR_SEQUENCE (e.g., ABC_2025_001)
   */
  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const tenant = await this.tenantRepo.findById(tenantId);
    const year = new Date().getFullYear();

    // Get next sequence number
    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        tenantId,
        invoiceNumber: { startsWith: `${tenant.slug}_${year}` },
      },
      orderBy: { invoiceNumber: 'desc' },
    });

    let sequence = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split('_');
      sequence = parseInt(parts[2], 10) + 1;
    }

    return `${tenant.slug.toUpperCase()}_${year}_${String(sequence).padStart(3, '0')}`;
  }

  /**
   * Render invoice HTML template
   */
  private async renderInvoiceTemplate(data: any): Promise<string> {
    const template = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { margin: 0; }
    .invoice-title p { margin: 5px 0; }

    .details { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .details-section { }
    .details-section h3 { margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; }
    .details-section p { margin: 5px 0; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
    th { background-color: #f5f5f5; text-align: left; padding: 10px; border-bottom: 2px solid #ddd; }
    td { padding: 10px; border-bottom: 1px solid #eee; }

    .totals { text-align: right; margin-bottom: 40px; }
    .total-row { display: flex; justify-content: flex-end; gap: 100px; margin: 10px 0; }
    .total-label { font-weight: bold; }
    .total-amount { min-width: 100px; text-align: right; }
    .final-total { font-size: 18px; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }

    .terms { background-color: #f9f9f9; padding: 15px; margin-top: 40px; font-size: 12px; }
  </style>
</head>
<body>
  <header>
    <div class="logo">{{tenantName}}</div>
    <div class="invoice-title">
      <h1>INVOICE</h1>
      <p><strong>#{{invoiceNumber}}</strong></p>
      <p>{{invoiceDate}}</p>
    </div>
  </header>

  <div class="details">
    <div class="details-section">
      <h3>From</h3>
      <p><strong>{{tenantName}}</strong></p>
      <p>{{tenantAddress}}</p>
    </div>
    <div class="details-section">
      <h3>Bill To</h3>
      <p><strong>{{customerName}}</strong></p>
      <p>{{customerEmail}}</p>
    </div>
    <div class="details-section">
      <h3>Booking Details</h3>
      <p><strong>Event Date:</strong> {{eventDate}}</p>
      <p><strong>Package:</strong> {{packageName}}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: right;">Quantity</th>
        <th style="text-align: right;">Unit Price</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#each lineItems}}
      <tr>
        <td>{{this.description}}</td>
        <td style="text-align: right;">{{this.quantity}}</td>
        <td style="text-align: right;">{{this.unitPrice}}</td>
        <td style="text-align: right;">{{this.amount}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span class="total-label">Subtotal:</span>
      <span class="total-amount">{{subtotal}}</span>
    </div>
    <div class="total-row">
      <span class="total-label">Tax:</span>
      <span class="total-amount">{{tax}}</span>
    </div>
    <div class="total-row final-total">
      <span class="total-label">TOTAL:</span>
      <span class="total-amount">{{total}}</span>
    </div>
    {{#if paid}}
    <div class="total-row" style="margin-top: 20px; color: green;">
      <span class="total-label">PAID</span>
      <span class="total-amount">{{paymentMethod}}</span>
    </div>
    {{/if}}
  </div>

  <div class="terms">
    <strong>Notes:</strong> {{notes}}
    <br/><br/>
    <strong>Terms:</strong> {{terms}}
    {{#if transactionId}}
    <br/><br/>
    <strong>Transaction ID:</strong> {{transactionId}}
    {{/if}}
  </div>
</body>
</html>
    `;

    return Handlebars.compile(template)(data);
  }

  /**
   * Send invoice to customer via email
   */
  async sendInvoice(tenantId: string, bookingId: string, email: string): Promise<void> {
    const pdf = await this.generateInvoice(tenantId, bookingId);

    const booking = await this.bookingRepo.findById(tenantId, bookingId);
    const tenant = await this.tenantRepo.findById(tenantId);

    await emailProvider.sendInvoice({
      to: email,
      subject: `Invoice for your ${tenant.name} booking`,
      tenantName: tenant.name,
      bookingDetails: `Wedding for ${booking.coupleName} on ${booking.eventDate}`,
      pdf,
      fileName: `invoice-${booking.id}.pdf`,
    });
  }
}
```

### 5.2 Schema Additions

```prisma
model Invoice {
  id            String   @id @default(cuid())
  tenantId      String
  bookingId     String
  invoiceNumber String
  fileName      String   // e.g., "invoice-ABC_2025_001.pdf"
  status        String   @default("GENERATED") // "GENERATED", "SENT", "VIEWED", "PAID"

  // S3 storage details (optional)
  s3Key         String?  // "invoices/tenantId/fileName"
  s3Url         String?  // Signed download URL

  // Audit
  generatedAt   DateTime @default(now())
  sentAt        DateTime?
  viewedAt      DateTime?
  createdAt     DateTime @default(now())

  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  booking       Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@unique([tenantId, invoiceNumber]) // Invoice numbers unique per tenant
  @@index([tenantId, createdAt])
  @@index([bookingId])
}
```

### 5.3 API Routes

```typescript
// routes/invoices.routes.ts
export const invoicesRouter = tsRestExpress(contract.invoices, {
  downloadInvoice: async (req) => {
    const { tenantId } = req.locals.tenantAuth;
    const { bookingId } = req.params;

    const pdf = await invoiceService.generateInvoice(tenantId, bookingId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${bookingId}.pdf"`);
    return { status: 200, body: pdf };
  },

  sendInvoice: async (req) => {
    const { tenantId } = req.locals.tenantAuth;
    const { bookingId } = req.params;
    const { email } = req.body;

    await invoiceService.sendInvoice(tenantId, bookingId, email);

    return { status: 200, body: { message: 'Invoice sent successfully' } };
  },
});
```

### 5.4 Best Practices

```typescript
// CRITICAL RULES for invoices:

// 1. Invoice numbers must be unique and sequential per tenant
const invoiceNumber = `${tenant.slug}_${year}_${sequence}`;

// 2. Never expose raw email or sensitive data in PDF
// ✅ Use masked payment method (****-1234)
// ❌ Never include full card numbers

// 3. Store invoice PDF for audit trail
await prisma.invoice.create({ fileName, s3Key, ... });

// 4. Regenerate PDFs on request (not cached)
// Prevents stale data if booking details change

// 5. Use Puppeteer with --no-sandbox for production containers
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
```

---

## 6. Implementation Priority & Roadmap

### Phase 1 (MVP)
- [x] Secure token systems (password reset)
- [x] Stripe payments (full payment)
- [ ] Invoice generation (basic PDF)

### Phase 2 (Post-MVP)
- [ ] Booking action tokens (reschedule/cancel)
- [ ] Reminder system (Bull queue)
- [ ] Deposit/partial payments

### Phase 3 (Advanced)
- [ ] Refund handling (async processing)
- [ ] Advanced invoice features (tax calculation, branding)
- [ ] Subscription/recurring payments

---

## 7. Technology Stack Summary

### Required Dependencies

```json
{
  "dependencies": {
    "stripe": "^15.0.0",
    "bull": "^4.13.0",
    "redis": "^5.0.0",
    "ioredis": "^5.3.0",
    "luxon": "^3.4.0",
    "puppeteer": "^21.0.0",
    "handlebars": "^4.7.7",
    "jsonwebtoken": "^9.1.0",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "@types/bull": "^3.15.0",
    "@types/luxon": "^3.4.0",
    "@types/node": "^20.0.0"
  }
}
```

### Infrastructure

- **Redis**: Queue backend (Docker: `docker run -d redis:7`)
- **PostgreSQL**: Primary database (existing ✅)
- **Stripe**: Payment processor (existing ✅)
- **Postmark**: Email provider (existing ✅)

---

## 8. Multi-Tenant Considerations (CRITICAL)

All features must enforce tenant isolation:

```typescript
// ✅ CORRECT - All queries include tenantId
const booking = await bookingRepo.findById(tenantId, bookingId);
const refunds = await prisma.refundRequest.findMany({ where: { tenantId } });

// ❌ WRONG - Missing tenantId filter (SECURITY VULNERABILITY)
const booking = await bookingRepo.findById(bookingId);
const refunds = await prisma.refundRequest.findMany();

// ✅ CORRECT - All events include tenantId metadata
await eventEmitter.emit('RefundProcessed', { refundRequestId, tenantId, ... });

// ❌ WRONG - Missing tenantId in event
await eventEmitter.emit('RefundProcessed', { refundRequestId, ... });
```

---

## 9. Error Handling Pattern

All services follow MAIS error handling conventions:

```typescript
// Domain errors (service layer)
throw new RefundError('Refund amount exceeds payment amount');
throw new BookingConflictError('Date is already booked');

// HTTP mapping (route layer)
try {
  await refundService.createRefund(input);
} catch (error) {
  if (error instanceof RefundError) {
    return { status: 402, body: { error: error.message } };
  }
  throw error; // Error middleware handles unknown errors
}
```

---

## 10. Testing Strategy

Each feature requires:
- **Unit tests**: Service methods with mock repositories
- **Integration tests**: Database-backed tests with test tenant isolation
- **E2E tests**: Full workflow tests (payment → refund → invoice)

Example test structure:

```typescript
describe('RefundService', () => {
  let service: RefundService;
  let { tenantId, cleanup } = await createTestTenant();

  afterEach(() => cleanup());

  test('should process refund idempotently', async () => {
    const refund1 = await service.createRefund({ tenantId, bookingId, ... });
    const refund2 = await service.createRefund({ tenantId, bookingId, ... });
    expect(refund1.id).toEqual(refund2.id); // Same refund returned
  });
});
```

---

## Appendix: Quick Reference

### Secure Token Generation

```typescript
// Generate token
const token = crypto.randomBytes(32).toString('hex');
const hash = crypto.createHash('sha256').update(token).digest('hex');

// Store hash in DB (not token)
await db.tokenTable.create({ tokenHash: hash, expiresAt: ... });

// Verify on request
const hash = crypto.createHash('sha256').update(requestToken).digest('hex');
const record = await db.tokenTable.findUnique({ tokenHash: hash });
```

### Bull Queue Pattern

```typescript
// Add job
await queue.add(data, { delay: 5000, attempts: 3 });

// Process
queue.process(async (job) => { /* process job */ });

// Monitor
queue.on('failed', (job, error) => { /* handle failure */ });
```

### Stripe Idempotency

```typescript
// Idempotency key prevents duplicate charges/refunds
const refund = await stripe.refunds.create(
  { payment_intent, amount },
  { idempotencyKey: 'unique-key-per-operation' }
);
```

### Timezone Handling with Luxon

```typescript
// Convert to tenant timezone
const dt = DateTime.fromISO(date).setZone(tenantTimezone);

// Calculate UTC offset
const utcTime = dt.toUTC();
const delay = utcTime.diffNow().as('milliseconds');
```

---

## References

- **Stripe Docs**: https://stripe.com/docs
- **Bull Queue**: https://github.com/OptimalBits/bull
- **Luxon**: https://moment.github.io/luxon/
- **Puppeteer**: https://pptr.dev/
- **MAIS CLAUDE.md**: Architecture and security patterns

---

**Last Updated:** December 2, 2025
**Status:** Ready for implementation
**Maintainer:** Research-based best practices
