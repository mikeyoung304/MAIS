# Advanced Features: Research Summary

**Comprehensive analysis of 5 critical features for Node.js/Express/Prisma booking platforms**

## Quick Reference Table

| Feature           | Recommended Approach               | Key Libraries                        | Complexity | Timeline |
| ----------------- | ---------------------------------- | ------------------------------------ | ---------- | -------- |
| **Secure Tokens** | JWT + Single-use HMAC hashes       | `crypto`, `jsonwebtoken`, `bcryptjs` | Low        | Phase 1  |
| **Reminders**     | Bull queue + Luxon timezone        | `bull`, `ioredis`, `luxon`           | Medium     | Phase 2  |
| **Deposits**      | Stripe Payment Intent API          | `stripe`                             | Medium     | Phase 2  |
| **Refunds**       | Async processing + Stripe webhooks | `stripe`, `bull`                     | High       | Phase 3  |
| **Invoices**      | Puppeteer + Handlebars             | `puppeteer`, `handlebars`            | Medium     | Phase 1  |

---

## Feature Breakdown

### 1. Secure Token Systems

**Current State in MAIS:** Partially implemented

- ✅ JWT for tenant authentication (7-day expiration)
- ✅ Password reset tokens with SHA-256 hashing
- ✅ Rate limiting on auth endpoints
- ❌ Booking action tokens (reschedule, cancel)
- ❌ One-time setup links

**Recommended Approach:**

- **Stateless**: JWT for session authentication
- **Stateful**: Single-use HMAC tokens for sensitive actions
  - Password reset: Store SHA-256 hash in DB
  - Booking actions: Store token hash with expiration
  - One-time use: Mark `usedAt` on verification

**Key Implementation Patterns:**

```
Token Generation:
  1. Generate: crypto.randomBytes(32).toString('hex')
  2. Hash: SHA-256(token)
  3. Store: Hash in DB (not raw token)
  4. Send: Raw token in email/link (one-way function)

Token Verification:
  1. Receive: Raw token from request
  2. Hash: SHA-256(token)
  3. Lookup: Find hash in DB
  4. Validate: Check tenant, expiration, usage
  5. Consume: Mark usedAt to prevent reuse
```

**Best Practices:**

- Never log tokens in error messages
- Always include `tenantId` in validation (multi-tenant isolation)
- Enforce single-use for sensitive operations
- Hash all tokens before storage
- Set reasonable expiration times (1 hour for password, 7 days for bookings)

**Libraries:**

- `crypto` (Node.js builtin) - HMAC & random generation
- `jsonwebtoken` - JWT signing (already used in MAIS)
- `bcryptjs` - Password hashing (already used in MAIS)

---

### 2. Reminder Systems

**Current State in MAIS:** Not implemented

**The Challenge:**

- Reminders must run at specific times (timezone-aware)
- Must survive server restarts
- Must retry on failure
- Must not send duplicates

**Recommended Approach: Bull Queue + Redis**

Why Bull over alternatives:

- **vs node-cron**: Node-cron loses jobs on restart (not production-ready)
- **vs Agenda**: Heavier, designed for MongoDB (MAIS uses PostgreSQL)
- **vs AWS EventBridge**: Vendor lock-in, higher cost
- **✅ Bull**: Redis-backed, distributed, fault-tolerant, built for Node.js

**Key Implementation Patterns:**

```
Scheduling Flow:
  1. User books appointment → onPaymentCompleted()
  2. Calculate reminder times in tenant's timezone
  3. Convert to UTC for consistent job scheduling
  4. Queue jobs with delay (e.g., 3 days before event)
  5. Bull processes jobs at scheduled time
  6. Retry on failure (exponential backoff)
  7. Log reminder in ReminderLog table

Timezone Handling with Luxon:
  1. Parse event date: DateTime.fromISO(date)
  2. Set tenant timezone: .setZone(tenantTimezone)
  3. Calculate reminder time: .minus({ days: 3 }).set({ hour: 10 })
  4. Convert to UTC: .toUTC()
  5. Calculate delay: diffNow().as('milliseconds')
  6. Queue job with delay
```

**Infrastructure Required:**

- Redis (7 recommended): `docker run -d redis:7-alpine`
- Connection pooling for production (ioredis handles this)

**Key Libraries:**

- `bull` (4.13+) - Job queue
- `ioredis` (5.3+) - Redis client (dependency of Bull)
- `luxon` (3.4+) - Timezone handling

**Failure Recovery:**

- Run nightly cleanup job: Delete expired reminders
- Bull automatically retries with exponential backoff
- Monitor queue health: `queue.on('failed', ...)` listener
- Store ReminderLog for audit trail

---

### 3. Deposit/Partial Payment Systems

**Current State in MAIS:** Not implemented (uses full-payment Checkout Sessions)

**The Challenge:**

- Customers pay 50% upfront, 50% before event
- Must support flexible payment scheduling
- Must track payment stages and balances
- Must handle refunds per stage

**Recommended Approach: Stripe Payment Intent API**

Why Payment Intent vs Checkout Session:

- **Checkout Session**: Full payment only, redirect-based
- **Payment Intent**: Flexible amounts, split payments, more control

**Key Implementation Patterns:**

```
Deposit Flow:
  1. User initiates booking
  2. Display deposit amount: 50% of total
  3. Create Payment Intent: Stripe receives amount
  4. Client confirms payment: JavaScript library
  5. On success: Create BookingPaymentStage (1/2)
  6. Generate link/email: "Pay remainder before event"

Later - Final Payment:
  1. 7 days before event, send reminder
  2. Create second Payment Intent: 50% remaining
  3. Client confirms payment
  4. On success: Create BookingPaymentStage (2/2)
  5. Mark booking as FULLY_PAID
  6. Send final confirmation

Refunds:
  - Deposit refund: Refund stage 1 only
  - Full refund: Refund both stages
  - Track per-stage refund status
```

**Schema Additions:**

- `BookingPaymentStage`: Track each payment phase
- `Payment` model: Enhanced with `paymentType` (DEPOSIT, REMAINDER, FULL)

**Key Libraries:**

- `stripe` (15.0+) - Payment processing (already used in MAIS)
- `stripe-js` - Browser-side Stripe.js for client

---

### 4. Refund Handling

**Current State in MAIS:** Basic refund endpoint exists, needs async processing

**The Challenge:**

- Refunds are async (Stripe processes them)
- Network failures must be retried
- Stripe webhooks are source of truth
- Must prevent duplicate refunds (idempotency)
- Must audit all refund requests

**Recommended Approach: Database-First, Async Processing**

**Critical Pattern:**

```
Never do this:
  1. Call Stripe immediately
  2. Update DB if successful
  3. Hope nothing fails

Always do this:
  1. Create RefundRequest in DB with idempotencyKey
  2. Queue async processing
  3. Bull worker calls Stripe
  4. Stripe webhook updates status (source of truth)
  5. Database records final state
```

**Key Implementation Patterns:**

```
Create Refund Flow:
  1. Check for existing refund (idempotency)
  2. Validate booking exists and belongs to tenant
  3. Create RefundRequest record with idempotencyKey
  4. Queue async processing: refundQueue.add(...)
  5. Return 202 Accepted (async operation)

Processing Flow (Bull worker):
  1. Fetch RefundRequest from DB
  2. Call Stripe.refunds.create() with idempotencyKey
  3. Update RefundRequest with stripeRefundId
  4. Emit RefundProcessed event
  5. On error: Throw to trigger retry

Webhook Handler:
  1. Receive charge.refunded event from Stripe
  2. Verify tenantId + refundRequestId
  3. Update RefundRequest status to COMPLETED
  4. Send customer notification
```

**Idempotency Key Pattern:**

```
Generate: hash(tenantId + bookingId + reason)
Store: In RefundRequest table
Use: Pass to Stripe API on retry
Result: Stripe returns same refund if called twice
```

**Key Libraries:**

- `stripe` (15.0+) - Refund API
- `bull` (4.13+) - Async processing

**Failure Recovery:**

- Bull retries 5 times with exponential backoff
- Monitor failed refunds: `queue.on('failed', ...)`
- Webhook handler is idempotent (safe to retry)
- Stripe is source of truth for refund status

---

### 5. Invoice Generation

**Current State in MAIS:** Not implemented

**The Challenge:**

- Must generate professional PDFs with custom branding
- Must support complex layouts (tables, images, calculations)
- Must regenerate on demand (not cached)
- Must store copies for audit trail
- Must handle multi-tenant invoice numbering

**Recommended Approach: Puppeteer + Handlebars**

Why Puppeteer over alternatives:

- **vs pdfkit**: Low-level, tedious layouts, limited CSS support
- **vs html-pdf**: Outdated, no longer maintained
- **vs wkhtmltopdf**: System binary, deployment issues
- **✅ Puppeteer**: Renders HTML→PDF, excellent CSS support, headless Chrome

**Key Implementation Patterns:**

```
Generation Flow:
  1. Fetch booking, tenant, package data
  2. Generate invoice number: TENANT_YEAR_SEQUENCE
  3. Compile Handlebars template with data
  4. Launch Puppeteer browser
  5. Render HTML in page
  6. Export as PDF
  7. Close browser
  8. Store Invoice record in DB
  9. Return PDF buffer (for download/email)

Invoice Number Pattern:
  Format: TENANT_YEAR_SEQUENCE
  Example: BELLAWEDS_2025_001
  Strategy:
    1. Look up last invoice for tenant in current year
    2. Extract sequence number
    3. Increment and pad with zeros
    4. Concat with tenant slug + year
  Result: Unique, human-readable, per-tenant numbers
```

**Template Pattern (Handlebars):**

- Uses HTML/CSS (familiar to developers)
- Supports Handlebars helpers for formatting (currency, dates)
- Responsive design automatically adapts
- Can include images, company logos, tenant branding

**Deployment Considerations:**

- Puppeteer needs headless Chrome/Chromium
- Docker: Install `chromium-browser` package
- Use `--no-sandbox` flag in container environments
- Timeout control: Set page load timeout to prevent hangs

**Key Libraries:**

- `puppeteer` (21.0+) - HTML→PDF conversion
- `handlebars` (4.7+) - Template rendering

**Storage Options:**

- In-memory (for download): Not persisted
- File system: Store in `uploads/invoices/`
- S3/Cloud storage: For production (future)

---

## Technology Stack

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

| Component      | Purpose       | Setup                   |
| -------------- | ------------- | ----------------------- |
| **Redis**      | Queue backend | `docker run -d redis:7` |
| **PostgreSQL** | Primary DB    | Already in MAIS ✅      |
| **Stripe**     | Payments      | Already configured ✅   |
| **Postmark**   | Email         | Already configured ✅   |

---

## MAIS-Specific Integration

All features must follow MAIS patterns:

### 1. Multi-Tenant Isolation (CRITICAL)

```typescript
// Every query must include tenantId
const refund = await refundRepo.findById(tenantId, refundId);

// All repository methods have tenantId as first parameter
interface RefundRepository {
  create(tenantId: string, data: CreateRefundInput): Promise<RefundRequest>;
  findById(tenantId: string, id: string): Promise<RefundRequest | null>;
}
```

### 2. Layered Architecture

```
Routes (HTTP)
  ↓
Services (Business Logic)
  ↓
Adapters/Repositories (Data/External)
```

### 3. Dependency Injection

```typescript
// di.ts
const di = {
  refundService: new RefundService(
    prismaAdapters.refundRepository,
    paymentProvider,
    refundQueue,
    eventEmitter
  ),
};
```

### 4. Error Handling

```typescript
// Domain errors in services
throw new RefundError('Refund amount exceeds payment amount');

// HTTP mapping in routes
catch (error) {
  if (error instanceof RefundError) {
    return { status: 402, body: { error: error.message } };
  }
}
```

### 5. Event Emission

```typescript
// Services emit domain events
await eventEmitter.emit('RefundProcessed', {
  refundId, tenantId, bookingId, ...
});

// Subscribers handle side effects
eventEmitter.on('RefundProcessed', async (event) => {
  await emailProvider.sendRefundNotification(...);
});
```

---

## Implementation Timeline

### Phase 1 - MVP (Weeks 1-2)

- Implement booking action tokens (reschedule, cancel)
- Add invoice generation (Puppeteer + Handlebars)
- Add invoice API routes and email sending

### Phase 2 - Core Features (Weeks 3-4)

- Set up Redis locally
- Implement reminder system (Bull + Luxon)
- Add booking action token usage in UI
- Implement deposit payments (Payment Intent API)

### Phase 3 - Advanced Features (Weeks 5-6)

- Implement refund system with async processing
- Add Stripe webhook handlers for refunds
- Implement refund recovery jobs
- Optimize invoice storage (S3 integration)

---

## Risk Assessment

| Feature       | Risk Level | Mitigation                                                         |
| ------------- | ---------- | ------------------------------------------------------------------ |
| Secure Tokens | Low        | Use established crypto libraries, follow password reset pattern    |
| Reminders     | Medium     | Test timezone handling thoroughly, monitor queue health            |
| Deposits      | Medium     | Use Stripe's API docs, test payment flows, handle race conditions  |
| Refunds       | High       | Use idempotency keys, test webhook handling, implement retry logic |
| Invoices      | Low        | Use Puppeteer's headless mode, cache templates, test layouts       |

---

## Testing Strategy

Each feature requires:

- **Unit tests**: Service methods with mock repositories (no HTTP/network)
- **Integration tests**: Database-backed with test tenant isolation
- **E2E tests**: Full workflow tests (Playwright)

```typescript
// Test isolation pattern (existing in MAIS)
import { createTestTenant } from '../helpers/test-tenant';

test('refund is idempotent', async () => {
  const { tenantId, cleanup } = await createTestTenant();
  try {
    const r1 = await service.createRefund(tenantId, bookingId, reason);
    const r2 = await service.createRefund(tenantId, bookingId, reason);
    expect(r1.id).toEqual(r2.id);
  } finally {
    await cleanup();
  }
});
```

---

## Key Takeaways

1. **Secure Tokens**: Copy existing password reset pattern (single-use HMAC)
2. **Reminders**: Use Bull queue for fault-tolerance and timezone support
3. **Deposits**: Use Stripe Payment Intent API (more flexible than Checkout Session)
4. **Refunds**: Database-first approach with idempotency keys and async processing
5. **Invoices**: Puppeteer + Handlebars for professional PDF generation
6. **Multi-tenant**: ALWAYS include tenantId in queries (non-negotiable)
7. **Error Handling**: Domain errors in services, HTTP mapping in routes
8. **Testing**: Isolate tenants in tests to prevent cross-tenant leakage

---

## Documentation Organization

- **`ADVANCED-FEATURES-BEST-PRACTICES.md`** - Comprehensive technical guide
- **`ADVANCED-FEATURES-QUICK-START.md`** - Developer quick reference
- **`ADVANCED-FEATURES-MAIS-PATTERNS.md`** - MAIS-specific implementation patterns
- **`ADVANCED-FEATURES-SUMMARY.md`** - This document

---

## Additional Resources

- **MAIS Architecture**: See project `CLAUDE.md`
- **Stripe API**: https://stripe.com/docs
- **Bull Queue**: https://github.com/OptimalBits/bull
- **Luxon Timezones**: https://moment.github.io/luxon/
- **Puppeteer**: https://pptr.dev/
- **Handlebars**: https://handlebarsjs.com/

---

**Status:** Research complete, ready for implementation
**Last Updated:** December 2, 2025
**Scope:** Node.js/Express/Prisma multi-tenant booking platforms
**Audience:** MAIS development team
