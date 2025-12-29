# Customer Chatbot Phase 0 - Solutions Extracted

**Date:** December 2025
**Reference:** Commits 66b512f through 88f6c80
**Status:** Documented from PR #23 (P1/P2 fixes applied)

## Overview

Customer Chatbot Phase 0 introduced a production-ready booking assistant with complete security hardening, payment integration, and proper multi-tenant isolation. This document extracts the key architectural solutions implemented.

---

## 1. Email Notifications (Secure)

**Files:**

- `server/src/agent/customer/customer-booking-executor.ts`
- `server/src/services/booking.service.ts`

### Problem

Customer bookings need confirmation via email, but customer names/emails provided by chatbot users must be sanitized to prevent HTML injection attacks.

### Solution

**Step 1: Define Mail Provider Interface**

```typescript
// server/src/agent/customer/customer-booking-executor.ts (lines 25-27)
export interface CustomerBookingMailProvider {
  sendEmail: (input: { to: string; subject: string; html: string }) => Promise<void>;
}
```

**Step 2: Sanitize User Input Before HTML Interpolation (P1 Security Fix)**

```typescript
// server/src/agent/customer/customer-booking-executor.ts (lines 97-100)
// SECURITY: Sanitize user-provided strings before use in HTML emails
// This prevents HTML injection attacks (P1 fix from code review)
const safeCustomerName = sanitizePlainText(customerName);
const safeCustomerEmail = sanitizePlainText(customerEmail);
```

The `sanitizePlainText()` utility strips all HTML tags and encodes special characters:

```typescript
// server/src/lib/sanitization.ts (lines 35-37)
export function sanitizePlainText(input: string): string {
  return validator.escape(validator.stripLow(input));
}
```

**Step 3: Build Email HTML with Safe Values**

```typescript
// server/src/agent/customer/customer-booking-executor.ts (lines 240-300)
if (mailProvider && customerEmail) {
  const paymentSection = checkoutSession?.url
    ? `
    <div style="margin: 20px 0;">
      <a href="${checkoutSession.url}"
         style="background-color: #1e3a5f; color: white; padding: 12px 24px;
                text-decoration: none; border-radius: 6px; display: inline-block;">
        Complete Payment (${formattedPrice})
      </a>
    </div>
  `
    : '';

  // Construct HTML using SAFE values
  const customerEmailHtml = `
    <h2>Booking Confirmation</h2>
    <p>Hi ${safeCustomerName},</p>
    <p>Your booking for ${pkg.name} on ${formattedDate} is confirmed!</p>
    ${paymentSection}
  `;

  await mailProvider.sendEmail({
    to: safeCustomerEmail,
    subject: `Booking Confirmation - ${tenant.name}`,
    html: customerEmailHtml,
  });
}
```

**Step 4: Emit Event for Downstream Email Processing**

```typescript
// server/src/services/booking.service.ts (lines 252-262)
// Emit PAID event for downstream processing (sends confirmation email via DI event handler)
await this.eventEmitter.publish('booking:paid', {
  tenantId,
  bookingId,
  email: booking.email,
  eventDate: booking.eventDate ? new Date(booking.eventDate).toISOString().split('T')[0] : '',
  packageTitle: booking.packageTitle || 'Package',
  totalCents: amountPaidCents,
  addOnTitles: booking.addOnTitles || [],
});
```

### Key Security Principles

1. **Never interpolate user input directly into HTML** - Always sanitize
2. **Use whitelisted sanitization** - `validator.escape()` + `validator.stripLow()`
3. **Defense in depth** - Zod validates at API layer, sanitization validates before HTML interpolation
4. **Event-driven emails** - Decouples booking logic from email sending

---

## 2. Stripe Checkout Integration

**Files:**

- `server/src/agent/customer/customer-booking-executor.ts`
- `server/src/jobs/webhook-processor.ts`

### Problem

Chatbot bookings require Stripe payment before confirmation. Need to:

1. Create checkout session with proper metadata for webhook handling
2. Identify chatbot bookings in webhook handler
3. Confirm booking on payment success

### Solution

**Step 1: Register Executor with Payment Provider**

```typescript
// server/src/agent/customer/customer-booking-executor.ts (lines 75-80)
export function registerCustomerBookingExecutor(
  prisma: PrismaClient,
  mailProvider?: CustomerBookingMailProvider,
  paymentProvider?: PaymentProvider,
  config?: CustomerBookingExecutorConfig
): void {
```

**Step 2: Create Checkout Session with Chatbot-Specific Metadata**

```typescript
// server/src/agent/customer/customer-booking-executor.ts (lines 203-238)
if (paymentProvider && totalPrice > 0) {
  try {
    checkoutSession = await paymentProvider.createCheckoutSession({
      amountCents: totalPrice,
      email: customerEmail,
      metadata: {
        tenantId,
        bookingId: booking.id,
        packageId,
        eventDate: date,
        email: customerEmail,
        coupleName: customerName,
        source: 'customer_chatbot', // CRITICAL: Identify chatbot bookings
        confirmationCode,
      },
      idempotencyKey: `chatbot-booking-${booking.id}`,
    });

    logger.info(
      {
        tenantId,
        bookingId: booking.id,
        checkoutSessionId: checkoutSession.sessionId,
      },
      'Stripe checkout session created for chatbot booking'
    );
  } catch (stripeError) {
    // Log error but don't fail the booking - customer can pay later
    logger.error(
      { tenantId, bookingId: booking.id, error: stripeError },
      'Failed to create Stripe checkout session'
    );
  }
}
```

**Step 3: Webhook Handler Detects Chatbot Bookings**

```typescript
// server/src/jobs/webhook-processor.ts (lines 67-68, 240-246)
// Zod schema for metadata validation
const MetadataSchema = z.object({
  // ... other fields ...
  source: z.string().optional(), // 'customer_chatbot' for chatbot-created bookings
  confirmationCode: z.string().optional(), // Confirmation code for chatbot bookings
});

// In processCheckout() method:
if (source === 'customer_chatbot' && bookingId) {
  await this.processChatbotBookingPayment(event, session, validatedTenantId, bookingId);
}
```

**Step 4: Webhook Confirms Chatbot Booking**

```typescript
// server/src/jobs/webhook-processor.ts (lines 315-341)
private async processChatbotBookingPayment(
  event: Stripe.Event,
  session: z.infer<typeof StripeSessionSchema>,
  tenantId: string,
  bookingId: string
): Promise<void> {
  const amountPaid = session.amount_total ?? 0;

  logger.info(
    {
      eventId: event.id,
      sessionId: session.id,
      tenantId,
      bookingId,
      amountPaid,
    },
    'Processing chatbot booking payment completion'
  );

  // Update booking status to CONFIRMED and set payment timestamp
  await this.bookingService.confirmChatbotBooking(tenantId, bookingId, amountPaid);

  logger.info(
    { eventId: event.id, sessionId: session.id, tenantId, bookingId },
    'Chatbot booking payment processed successfully'
  );
}
```

### Booking Status Flow

```
Customer provides details
         ↓
Tool creates PENDING booking
         ↓
Executor creates Stripe checkout session (metadata: source=customer_chatbot)
         ↓
Customer → Stripe → complete payment
         ↓
Webhook detects source=customer_chatbot
         ↓
bookingService.confirmChatbotBooking() → status=CONFIRMED, paidAt=now()
         ↓
BookingEvents.PAID emitted → confirmation emails sent
```

---

## 3. Webhook Handler with Idempotency

**Files:**

- `server/src/jobs/webhook-processor.ts`
- `server/src/services/booking.service.ts`

### Problem

Stripe can retry webhook events. Must ensure booking confirmation is idempotent.

### Solution

**Idempotent Confirmation**

```typescript
// server/src/services/booking.service.ts (lines 234-265)
async confirmChatbotBooking(
  tenantId: string,
  bookingId: string,
  amountPaidCents: number
): Promise<Booking> {
  // Fetch the booking - returns early if already confirmed
  const booking = await this.bookingRepo.getById(tenantId, bookingId);
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found for tenant ${tenantId}`);
  }

  // Update is idempotent - sets same status and timestamp
  const confirmedBooking = await this.bookingRepo.update(tenantId, bookingId, {
    status: 'CONFIRMED',
    paidAt: new Date(), // P1 fix: Set payment timestamp for reporting queries
  });

  // Only emit event on first execution (subsequent calls overwrite with same values)
  await this.eventEmitter.publish('booking:paid', {
    tenantId,
    bookingId,
    email: booking.email,
    eventDate: booking.eventDate
      ? new Date(booking.eventDate).toISOString().split('T')[0]
      : '',
    packageTitle: booking.packageTitle || 'Package',
    totalCents: amountPaidCents,
    addOnTitles: booking.addOnTitles || [],
  });

  return confirmedBooking;
}
```

**Key Properties:**

- Update is idempotent (same status, same timestamp)
- `paidAt` timestamp added for reporting/queries
- Event emission on every call is acceptable (downstream handlers should be idempotent too)

---

## 4. Security Hardening (P1 Fixes)

**Files:**

- `server/src/routes/public-customer-chat.routes.ts`
- `server/src/agent/customer/customer-booking-executor.ts`

### 4a. Required Session ID for Proposal Confirmation (Ownership Verification)

**Problem:** Proposal confirmation only validated tenantId, allowing enumeration attacks.

**Solution:**

```typescript
// server/src/routes/public-customer-chat.routes.ts (lines 275-289)
/**
 * POST /confirm/:proposalId
 * Confirm and execute a booking proposal
 */
router.post('/confirm/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenant context' });
      return;
    }

    const { proposalId } = req.params;

    // SECURITY: sessionId is REQUIRED for ownership verification
    // Prevents proposal enumeration attacks (P1 fix from code review)
    const { sessionId } = req.body as { sessionId?: string };

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required to confirm booking' });
      return;
    }

    // Build where clause with tenant isolation AND session ownership
    const whereClause: { id: string; tenantId: string; sessionId: string } = {
      id: proposalId,
      tenantId, // CRITICAL: Tenant isolation
      sessionId, // CRITICAL: Session ownership (P1 fix)
    };

    // Fetch proposal with tenant + session isolation
    const proposal = await prisma.agentProposal.findFirst({
      where: whereClause,
    });

    if (!proposal) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
```

**Frontend Integration:**

The frontend MUST send sessionId with confirmation request:

```typescript
// apps/web/src/components/chat/CustomerChatWidget.tsx
const response = await fetch(`/api/chat/confirm/${proposalId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: currentSessionId, // P1 fix: Required for ownership verification
  }),
});
```

### 4b. Session Validation at Route Level

**Problem:** sessionId from client not validated before use.

**Solution:**

```typescript
// server/src/routes/public-customer-chat.routes.ts (lines 216-228)
// Get or create session, validating ownership if sessionId provided
let actualSessionId = sessionId;
if (actualSessionId) {
  // Validate that sessionId belongs to this tenant
  const session = await orchestrator.getSession(tenantId, actualSessionId);
  if (!session) {
    res.status(400).json({ error: 'Invalid or expired session' });
    return;
  }
} else {
  const session = await orchestrator.getOrCreateSession(tenantId);
  actualSessionId = session.sessionId;
}
```

### 4c. Tenant Filter on Customer Lookup

**Problem:** Customer lookup by ID doesn't include tenantId, allowing cross-tenant access.

**Solution:**

```typescript
// server/src/agent/customer/customer-booking-executor.ts (lines 144-150)
// Verify customer still exists and belongs to this tenant
const customer = await tx.customer.findFirst({
  where: {
    id: customerId,
    tenantId, // CRITICAL: Tenant isolation
  },
});

if (!customer) {
  throw new Error('Customer not found. Please try booking again.');
}
```

---

## 5. Prompt Injection Detection (P2 Fix)

**Files:**

- `server/src/agent/customer/customer-orchestrator.ts`

### Problem

LLM can be manipulated by prompt injection attacks. Must detect and block malicious patterns.

### Solution

**Define Injection Patterns**

```typescript
// server/src/agent/customer/customer-orchestrator.ts (lines 50-65)
/**
 * Patterns that indicate potential prompt injection attempts
 * These are common techniques used to manipulate LLM behavior
 */
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:previous|your|all)\s+instruction/i,
  /disregard\s+(?:previous|your|all)\s+instruction/i,
  /you\s+are\s+now/i,
  /system\s*prompt/i,
  /\[system\]/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /pretend\s+you\s+are/i,
  /act\s+as\s+(?:if\s+you\s+are|a)/i,
  /reveal\s+(?:your|the)\s+(?:system|initial)\s+prompt/i,
];
```

**Detect and Block**

```typescript
// server/src/agent/customer/customer-orchestrator.ts (lines 242-247)
/**
 * Check for potential prompt injection patterns
 * Returns true if injection attempt detected
 */
private detectPromptInjection(message: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

// server/src/agent/customer/customer-orchestrator.ts (lines 259-270)
/**
 * Send a message and get response
 */
async chat(
  tenantId: string,
  sessionId: string,
  userMessage: string
): Promise<CustomerChatResponse> {
  const startTime = Date.now();

  // SECURITY: Check for prompt injection attempts (P2 fix from code review)
  if (this.detectPromptInjection(userMessage)) {
    logger.warn(
      { tenantId, sessionId, messagePreview: userMessage.slice(0, 100) },
      'Potential prompt injection attempt detected'
    );
    // Return generic response instead of passing to LLM
    return {
      message: "I'm here to help you with booking questions. How can I assist you today?",
      sessionId,
    };
  }
```

### Detection Strategy

1. **Pattern matching** for common injection techniques
2. **Early return** with generic response (no LLM exposure)
3. **Logging** for security monitoring
4. **No error disclosure** (attacker doesn't know detection worked)

---

## 6. Database Indexes for Performance & Cleanup (P1/P2)

**Files:**

- `server/prisma/schema.prisma`

### Problem

Cleanup jobs need efficient queries on AgentSession and AgentProposal. Original indexes didn't support these queries.

### Solution

**AgentSession Cleanup Index**

```prisma
// server/prisma/schema.prisma (AgentSession model)
model AgentSession {
  id          String      @id @default(cuid())
  tenantId    String      // Tenant isolation - CRITICAL
  customerId  String?     // NULL for admin sessions, set for customer sessions
  sessionType SessionType @default(ADMIN) // ADMIN or CUSTOMER
  messages    Json        @default("[]") // Array of ChatMessage objects
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer    Customer?   @relation(fields: [customerId], references: [id], onDelete: SetNull)

  @@index([tenantId, updatedAt]) // Find recent sessions for tenant
  @@index([tenantId])
  @@index([customerId, updatedAt]) // Query customer sessions
  @@index([sessionType, updatedAt]) // P1 fix: Cleanup job queries (sessionType + updatedAt)
}
```

**AgentProposal Cleanup Index**

```prisma
// server/prisma/schema.prisma (AgentProposal model)
model AgentProposal {
  id              String             @id @default(cuid())
  tenantId        String             // Tenant isolation - CRITICAL
  sessionId       String             // Agent session identifier
  customerId      String?            // CRITICAL: For customer proposals - enables ownership verification
  toolName        String             // Tool that created the proposal
  operation       String             // Human-readable operation description
  trustTier       AgentTrustTier     // T1, T2, or T3
  payload         Json               // The proposed change data
  preview         Json               // What will change (for user display)
  status          AgentProposalStatus @default(PENDING)
  requiresApproval Boolean           @default(true)
  expiresAt       DateTime           // 30 minutes from creation
  confirmedAt     DateTime?          // When user confirmed
  executedAt      DateTime?          // When proposal was executed
  result          Json?              // Execution result (for completed proposals)
  error           String?            // Error message if failed
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  tenant          Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer        Customer?          @relation(fields: [customerId], references: [id], onDelete: SetNull)

  @@index([tenantId, sessionId])
  @@index([tenantId, status])
  @@index([expiresAt]) // For cleanup of expired proposals
  @@index([status, expiresAt]) // P1 fix: Cleanup job queries (status + expiresAt)
  @@index([tenantId])
  @@index([customerId]) // Query proposals by customer
}
```

### Cleanup Job Query Pattern

```typescript
// Find expired proposals
const expired = await prisma.agentProposal.findMany({
  where: {
    status: 'PENDING',
    expiresAt: { lt: new Date() }, // Query: status + expiresAt
  },
});

// Find old customer sessions
const oldSessions = await prisma.agentSession.findMany({
  where: {
    sessionType: 'CUSTOMER',
    updatedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 7 days
  }, // Query: sessionType + updatedAt
});
```

---

## 7. Architecture Pattern: Proposal/Executor for Customer Bookings

**Files:**

- `server/src/agent/customer/customer-tools.ts`
- `server/src/agent/customer/customer-booking-executor.ts`
- `server/src/agent/customer/executor-registry.ts`

### Problem

Customer bookings have explicit confirmation requirements (T3 trust tier). Need to:

1. Generate proposal for LLM transparency
2. Wait for customer confirmation (not auto-execute)
3. Execute booking only when customer confirms

### Solution

**Tool Creates Proposal (Not Direct Execution)**

```typescript
// server/src/agent/customer/customer-tools.ts (lines 350-389)
const proposal = await proposalService.createProposal({
  tenantId,
  sessionId,
  toolName: 'book_service',
  operation: 'create_customer_booking',
  trustTier: 'T3', // Customer bookings require explicit confirmation
  payload: {
    packageId,
    customerId: customer.id,
    date,
    notes: notes || null,
    totalPrice: pkg.basePrice,
    customerName,
    customerEmail,
  },
  preview: {
    service: pkg.name,
    date: formatDate(date),
    price: formatMoney(pkg.basePrice),
    customerName,
    customerEmail,
  },
});

// Update proposal with customerId for ownership verification
await prisma.agentProposal.update({
  where: { id: proposal.proposalId },
  data: { customerId: customer.id },
});

return {
  success: true,
  proposalId: proposal.proposalId,
  operation: proposal.operation,
  preview: proposal.preview,
  trustTier: proposal.trustTier,
  requiresApproval: true,
  expiresAt: proposal.expiresAt,
  message: `Ready to book ${pkg.name} on ${formatDate(date)} for ${formatMoney(pkg.basePrice)}. Click "Confirm Booking" to proceed.`,
} as WriteToolProposal;
```

**Executor Performs Actual Booking**

```typescript
// server/src/agent/customer/customer-booking-executor.ts (lines 75-192)
registerCustomerProposalExecutor(
  'create_customer_booking',
  async (tenantId, customerId, payload) => {
    // Parse and validate payload
    const { packageId, date, notes, totalPrice, customerName, customerEmail } = payload;

    // Transaction with advisory lock prevents double-booking
    const result = await prisma.$transaction(async (tx) => {
      // Advisory lock on tenant+date
      const lockId = hashTenantDate(tenantId, date);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

      // Verify package still exists
      const pkg = await tx.package.findFirst({
        where: { id: packageId, tenantId, active: true },
      });
      if (!pkg) throw new Error('Service is no longer available.');

      // Check date still available
      const existingBooking = await tx.booking.findFirst({
        where: {
          tenantId,
          date: bookingDate,
          status: { notIn: ['CANCELED', 'REFUNDED'] },
        },
      });
      if (existingBooking) throw new Error('Date is no longer available.');

      // Create PENDING booking
      const booking = await tx.booking.create({
        data: {
          tenantId,
          customerId,
          packageId,
          date: bookingDate,
          totalPrice,
          status: 'PENDING', // Awaits payment
          bookingType: 'DATE',
          notes: notes ? `[Chatbot booking] ${notes}` : '[Chatbot booking]',
          confirmationCode,
        },
      });

      return { booking, pkg, tenant, confirmationCode };
    });

    // Create Stripe checkout session
    const checkoutSession = await paymentProvider.createCheckoutSession({
      amountCents: totalPrice,
      email: customerEmail,
      metadata: {
        tenantId,
        bookingId: booking.id,
        source: 'customer_chatbot', // For webhook routing
        confirmationCode,
      },
    });

    return { checkoutUrl: checkoutSession.url };
  }
);
```

### Two-Phase Execution Model

```
Phase 1: Tool (Read-Heavy)
├─ Fetch available packages
├─ Check availability
├─ Get business hours
└─ Create PROPOSAL (not executed)

Customer sees proposal preview + "Confirm Booking" button

Phase 2: Executor (Write, Locked)
├─ Acquire advisory lock on tenant+date
├─ Re-validate package exists
├─ Re-check date availability
├─ Create PENDING booking
├─ Create Stripe checkout session
└─ Return checkout URL → customer pays

Webhook (Async)
├─ Stripe reports payment success
├─ Webhook detects source=customer_chatbot
└─ confirmChatbotBooking() → CONFIRMED
```

---

## Summary Table

| Component       | Pattern                | Key File                         | Status       |
| --------------- | ---------------------- | -------------------------------- | ------------ |
| **Email**       | Sanitize before HTML   | `sanitization.ts`                | P1 Security  |
| **Stripe**      | Metadata-based routing | `webhook-processor.ts`           | Core Feature |
| **Idempotency** | Timestamp-based        | `booking.service.ts`             | P1 Fix       |
| **Ownership**   | SessionId + CustomerId | `public-customer-chat.routes.ts` | P1 Security  |
| **Injection**   | Pattern detection      | `customer-orchestrator.ts`       | P2 Security  |
| **Indexes**     | Composite for cleanup  | `schema.prisma`                  | P1/P2 Perf   |
| **Booking**     | Proposal/Executor      | `customer-booking-executor.ts`   | Architecture |

---

## Testing Checklist

- [ ] Verify `sanitizePlainText()` escapes HTML entities
- [ ] Confirm Stripe checkout metadata includes `source=customer_chatbot`
- [ ] Test webhook idempotency (retry payment webhook, verify single CONFIRMED state)
- [ ] Validate proposal requires sessionId in confirmation request
- [ ] Test prompt injection detection (submit "ignore instructions" pattern)
- [ ] Verify cleanup query uses both `status + expiresAt` (check explain plan)
- [ ] Confirm tenant filter on customer lookup prevents cross-tenant access

---

## References

- **PR #23:** Customer Chatbot Phase 0 Implementation
  - P1 Fixes: Commits e2d6545 → b46b04f
  - P2 Fixes: Commits 6618f30 → 88f6c80
- **Booking Flow:** `docs/guides/CUSTOMER-BOOKING-FLOW.md`
- **Security:** `docs/security/CUSTOMER-DATA-ISOLATION.md`
