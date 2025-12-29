# Customer Chatbot Improvement Roadmap with Code

**Date:** December 28, 2025
**Target:** Transform MVP to 2026-ready competitive chatbot

---

## Phase 1: P0 - CSAT Collection (This Week)

### 1.1 Add Post-Session Feedback UI

**File:** `apps/web/src/components/chat/CustomerChatWidget.tsx`

```tsx
// Add after booking confirmation or when user closes widget
const [showFeedback, setShowFeedback] = useState(false);
const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

const submitFeedback = async (rating: number, comment?: string) => {
  await fetch(`${API_URL}/v1/public/chat/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Key': tenantApiKey,
    },
    body: JSON.stringify({ sessionId, rating, comment }),
  });
  setFeedbackSubmitted(true);
};

// Feedback UI Component
{
  showFeedback && !feedbackSubmitted && (
    <div className="px-5 py-4 bg-neutral-50 border-t border-neutral-100">
      <p className="text-sm font-medium text-neutral-700 mb-3">How was your experience?</p>
      <div className="flex gap-2 mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => submitFeedback(star)}
            className="p-2 hover:bg-sage/10 rounded-full transition-colors"
          >
            <Star
              className={`w-6 h-6 ${star <= (hoverRating || selectedRating) ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
```

### 1.2 Backend Feedback Endpoint

**File:** `server/src/routes/public-customer-chat.routes.ts`

```typescript
/**
 * POST /feedback
 * Submit session feedback
 */
router.post('/feedback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenant context' });
      return;
    }

    const { sessionId, rating, comment } = req.body;

    if (!sessionId || typeof rating !== 'number' || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Invalid feedback data' });
      return;
    }

    // Store feedback
    await prisma.chatFeedback.create({
      data: {
        tenantId,
        sessionId,
        rating,
        comment: comment?.slice(0, 500) || null,
      },
    });

    logger.info({ tenantId, sessionId, rating }, 'Customer chat feedback received');

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Customer chat feedback error');
    next(error);
  }
});
```

### 1.3 Database Schema

**File:** `server/prisma/schema.prisma`

```prisma
model ChatFeedback {
  id        String   @id @default(cuid())
  tenantId  String
  sessionId String
  rating    Int      // 1-5 stars
  comment   String?  @db.VarChar(500)
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, createdAt])
  @@index([sessionId])
}
```

---

## Phase 2: P1 - Core Gaps (Next 30 Days)

### 2.1 SSE Streaming Responses

**File:** `server/src/routes/public-customer-chat.routes.ts`

```typescript
/**
 * POST /message/stream
 * Send message with streaming response
 */
router.post('/message/stream', async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant context' });
    return;
  }

  const { message, sessionId } = req.body;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  try {
    const stream = await orchestrator.chatStream(tenantId, sessionId, message);

    for await (const chunk of stream) {
      if (chunk.type === 'text') {
        res.write(`data: ${JSON.stringify({ type: 'text', content: chunk.text })}\n\n`);
      } else if (chunk.type === 'tool_use') {
        res.write(`data: ${JSON.stringify({ type: 'tool', name: chunk.name })}\n\n`);
      } else if (chunk.type === 'proposal') {
        res.write(`data: ${JSON.stringify({ type: 'proposal', ...chunk })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'An error occurred' })}\n\n`);
    res.end();
  }
});
```

**File:** `server/src/agent/customer/customer-orchestrator.ts`

```typescript
/**
 * Stream chat response with Server-Sent Events
 */
async *chatStream(
  tenantId: string,
  sessionId: string,
  userMessage: string
): AsyncGenerator<StreamChunk> {
  // Validate session...

  const stream = await this.anthropic.messages.create({
    model: this.config.model,
    max_tokens: this.config.maxTokens,
    system: systemPrompt,
    messages,
    tools: this.buildToolsForAPI(),
    stream: true, // Enable streaming
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        yield { type: 'text', text: event.delta.text };
      }
    } else if (event.type === 'content_block_start') {
      if (event.content_block.type === 'tool_use') {
        yield { type: 'tool_use', name: event.content_block.name };
      }
    }
  }
}
```

### 2.2 Cancel/Reschedule Tools

**File:** `server/src/agent/customer/customer-tools.ts`

```typescript
// Add to CUSTOMER_TOOLS array

// ============================================================================
// 5. GET MY BOOKINGS - View customer's bookings
// ============================================================================
{
  name: 'get_my_bookings',
  description: 'View customer bookings. Requires email verification.',
  inputSchema: {
    type: 'object',
    properties: {
      customerEmail: {
        type: 'string',
        description: 'Customer email address to look up bookings',
      },
    },
    required: ['customerEmail'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const { customerEmail } = params as { customerEmail: string };

    const customer = await prisma.customer.findFirst({
      where: { tenantId, email: customerEmail },
    });

    if (!customer) {
      return { success: true, data: { bookings: [], message: 'No bookings found for this email.' } };
    }

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId,
        customerId: customer.id,
        status: { notIn: ['CANCELED', 'REFUNDED'] },
        date: { gte: new Date() }, // Only future bookings
      },
      include: { package: { select: { name: true, basePrice: true } } },
      orderBy: { date: 'asc' },
      take: 10,
    });

    return {
      success: true,
      data: {
        bookings: bookings.map((b) => ({
          id: b.id,
          service: b.package.name,
          date: formatDate(b.date.toISOString().split('T')[0]),
          status: b.status,
          price: formatMoney(b.totalPrice),
        })),
      },
    };
  },
},

// ============================================================================
// 6. CANCEL BOOKING - Cancel a customer booking
// ============================================================================
{
  name: 'cancel_booking',
  description: 'Cancel a future booking. Requires booking ID and email verification.',
  inputSchema: {
    type: 'object',
    properties: {
      bookingId: { type: 'string', description: 'ID of the booking to cancel' },
      customerEmail: { type: 'string', description: 'Customer email for verification' },
      reason: { type: 'string', description: 'Optional cancellation reason' },
    },
    required: ['bookingId', 'customerEmail'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const customerContext = context as CustomerToolContext;
    const { tenantId, prisma, sessionId } = customerContext;
    const { bookingId, customerEmail, reason } = params as {
      bookingId: string;
      customerEmail: string;
      reason?: string;
    };

    // Verify booking exists and belongs to customer
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId },
      include: {
        customer: { select: { email: true } },
        package: { select: { name: true } },
      },
    });

    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    // Verify email matches
    if (booking.customer.email.toLowerCase() !== customerEmail.toLowerCase()) {
      return { success: false, error: 'Email does not match booking' };
    }

    // Check if booking can be cancelled (future date, not already cancelled)
    if (booking.status === 'CANCELED') {
      return { success: false, error: 'Booking is already cancelled' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (booking.date < today) {
      return { success: false, error: 'Cannot cancel past bookings' };
    }

    // Create T3 proposal for cancellation
    const proposalService = customerContext.proposalService;
    const proposal = await proposalService.createProposal({
      tenantId,
      sessionId,
      toolName: 'cancel_booking',
      operation: 'cancel_customer_booking',
      trustTier: 'T3',
      payload: {
        bookingId,
        customerId: booking.customerId,
        reason: reason || 'Customer requested cancellation',
      },
      preview: {
        action: 'Cancel Booking',
        service: booking.package.name,
        date: formatDate(booking.date.toISOString().split('T')[0]),
        status: 'Will be cancelled',
      },
    });

    return {
      success: true,
      proposalId: proposal.proposalId,
      operation: proposal.operation,
      preview: proposal.preview,
      trustTier: proposal.trustTier,
      requiresApproval: true,
      message: `Ready to cancel your ${booking.package.name} booking on ${formatDate(booking.date.toISOString().split('T')[0])}. Click "Confirm" to proceed.`,
    } as WriteToolProposal;
  },
},
```

### 2.3 Human Escalation

**File:** `server/src/agent/customer/customer-tools.ts`

```typescript
// ============================================================================
// 7. REQUEST HUMAN HELP - Escalate to tenant
// ============================================================================
{
  name: 'request_human_help',
  description: 'Request to speak with a human. Use when customer is frustrated or needs help beyond bot capabilities.',
  inputSchema: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'Brief description of why human help is needed' },
      customerEmail: { type: 'string', description: 'Customer email for follow-up' },
    },
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, sessionId, prisma } = context;
    const { reason, customerEmail } = params as { reason?: string; customerEmail?: string };

    // Get tenant contact info
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, email: true },
    });

    if (!tenant) {
      return { success: false, error: 'Business not found' };
    }

    // Log escalation request
    await prisma.chatEscalation.create({
      data: {
        tenantId,
        sessionId,
        reason: reason?.slice(0, 500) || 'Customer requested human assistance',
        customerEmail: customerEmail || null,
        status: 'PENDING',
      },
    });

    // TODO: Send notification email to tenant
    // await emailService.sendEscalationNotification(tenant.email, { sessionId, reason });

    logger.info({ tenantId, sessionId, reason }, 'Customer requested human escalation');

    return {
      success: true,
      data: {
        message: `I've notified ${tenant.name} that you'd like to speak with someone. They'll reach out to you shortly at ${customerEmail || 'your email address'}.`,
        contactEmail: tenant.email,
      },
    };
  },
},
```

### 2.4 Proactive Chat Triggers

**File:** `apps/web/src/components/chat/CustomerChatWidget.tsx`

```tsx
// Add proactive trigger logic
const [hasShownProactive, setHasShownProactive] = useState(false);

// Time-based trigger (30 seconds on page)
useEffect(() => {
  if (hasShownProactive || isOpen) return;

  const timer = setTimeout(() => {
    // Check if user has interacted with page
    const scrolled = window.scrollY > 300;
    const timeOnPage = Date.now() - pageLoadTime > 30000;

    if (scrolled && timeOnPage) {
      setHasShownProactive(true);
      // Show proactive message bubble
      setProactiveMessage('Have questions about booking? I can help!');
    }
  }, 30000);

  return () => clearTimeout(timer);
}, [hasShownProactive, isOpen]);

// Proactive message bubble (shows above chat button when closed)
{
  proactiveMessage && !isOpen && (
    <div className="fixed bottom-24 right-6 z-50 animate-in slide-in-from-bottom-2">
      <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 p-4 max-w-xs">
        <button
          onClick={() => setProactiveMessage(null)}
          className="absolute -top-2 -right-2 bg-neutral-100 rounded-full p-1"
        >
          <X className="w-3 h-3" />
        </button>
        <p className="text-sm text-neutral-700">{proactiveMessage}</p>
        <button
          onClick={() => {
            openWidget();
            setProactiveMessage(null);
          }}
          className="mt-2 text-sm font-medium"
          style={{ color: primaryColor }}
        >
          Start chatting
        </button>
      </div>
    </div>
  );
}
```

---

## Phase 3: P2 - Scale & Polish (Next Quarter)

### 3.1 Redis Caching for Business Context

**File:** `server/src/agent/customer/customer-orchestrator.ts`

```typescript
import { cacheService } from '../../lib/services';

/**
 * Build business context with caching
 */
private async buildBusinessContext(tenantId: string): Promise<string> {
  const cacheKey = `chat-context:${tenantId}`;

  // Try cache first
  const cached = await cacheService.get<string>(cacheKey);
  if (cached) {
    return cached;
  }

  // Build fresh context
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      packages: {
        where: { active: true },
        select: { name: true, basePrice: true, description: true },
        orderBy: { name: 'asc' },
        take: 10,
      },
    },
  });

  if (!tenant) {
    return 'Business information unavailable.';
  }

  const context = `
## Business: ${tenant.name}

### Available Services
${tenant.packages.map(p => `- ${p.name}: $${(p.basePrice / 100).toFixed(2)}`).join('\n')}

### Contact
${tenant.email || 'Contact information not available.'}
`;

  // Cache for 5 minutes
  await cacheService.set(cacheKey, context, 300);

  return context;
}
```

### 3.2 Analytics Dashboard Endpoint

**File:** `server/src/routes/tenant-admin-analytics.routes.ts`

```typescript
/**
 * GET /v1/tenant-admin/chat-analytics
 * Chat analytics dashboard data
 */
router.get('/chat-analytics', tenantAuthMiddleware, async (req, res) => {
  const tenantId = res.locals.tenantAuth.tenantId;
  const days = parseInt(req.query.days as string) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get session metrics
  const sessions = await prisma.agentSession.count({
    where: {
      tenantId,
      sessionType: 'CUSTOMER',
      createdAt: { gte: since },
    },
  });

  // Get message metrics from audit log
  const messages = await prisma.agentAuditLog.aggregate({
    where: {
      tenantId,
      toolName: 'customer_chat',
      createdAt: { gte: since },
    },
    _count: true,
    _avg: { durationMs: true },
  });

  // Get feedback metrics
  const feedback = await prisma.chatFeedback.aggregate({
    where: {
      tenantId,
      createdAt: { gte: since },
    },
    _count: true,
    _avg: { rating: true },
  });

  // Get booking conversions
  const bookings = await prisma.booking.count({
    where: {
      tenantId,
      notes: { contains: '[Chatbot booking]' },
      createdAt: { gte: since },
    },
  });

  res.json({
    period: { days, since: since.toISOString() },
    sessions: {
      total: sessions,
      avgPerDay: Math.round((sessions / days) * 10) / 10,
    },
    messages: {
      total: messages._count,
      avgResponseTime: Math.round(messages._avg?.durationMs || 0),
    },
    feedback: {
      total: feedback._count,
      avgRating: Math.round((feedback._avg?.rating || 0) * 10) / 10,
    },
    conversions: {
      bookings,
      rate: sessions > 0 ? Math.round((bookings / sessions) * 1000) / 10 : 0,
    },
  });
});
```

### 3.3 Token Usage Tracking

**File:** `server/src/agent/audit/audit.service.ts`

```typescript
// Extend AuditLogInput interface
export interface AuditLogInput {
  // ... existing fields
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostCents?: number;
}

// Add to schema
// model AgentAuditLog {
//   ...existing fields
//   inputTokens       Int?
//   outputTokens      Int?
//   estimatedCostCents Int?
// }

/**
 * Calculate cost from token usage
 */
function calculateCostCents(usage: { input_tokens: number; output_tokens: number }): number {
  // Claude Sonnet 4 pricing: $3/1M input, $15/1M output
  const inputCost = (usage.input_tokens / 1_000_000) * 3 * 100;
  const outputCost = (usage.output_tokens / 1_000_000) * 15 * 100;
  return Math.round(inputCost + outputCost);
}
```

### 3.4 Tenant-Level Rate Limiting

**File:** `server/src/middleware/rateLimiter.ts`

```typescript
/**
 * Secondary rate limiter for customer chat by tenant
 * Prevents distributed attacks from exhausting Claude API budget
 */
export const customerChatTenantLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTestEnvironment ? 5000 : 500, // 500 messages per hour per tenant
  standardHeaders: true,
  legacyHeaders: false,
  // Key by tenantId (set by tenant middleware)
  keyGenerator: (req) => {
    const tenantReq = req as Request & { tenantId?: string };
    return `tenant:${tenantReq.tenantId || 'unknown'}`;
  },
  skip: (req) => {
    const tenantReq = req as Request & { tenantId?: string };
    return !tenantReq.tenantId;
  },
  validate: false,
  handler: (_req: Request, res: Response) => {
    logger.warn({ tenantId: (_req as any).tenantId }, 'Customer chat tenant rate limit exceeded');
    res.status(429).json({
      error: 'too_many_requests',
      message: 'This business has reached its chat limit. Please try again later.',
    });
  },
});
```

---

## Database Migrations

### Migration 1: Chat Feedback

```sql
-- CreateTable
CREATE TABLE "ChatFeedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatFeedback_tenantId_createdAt_idx" ON "ChatFeedback"("tenantId", "createdAt");
CREATE INDEX "ChatFeedback_sessionId_idx" ON "ChatFeedback"("sessionId");

-- AddForeignKey
ALTER TABLE "ChatFeedback" ADD CONSTRAINT "ChatFeedback_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
```

### Migration 2: Chat Escalations

```sql
-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "ChatEscalation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "reason" VARCHAR(500),
    "customerEmail" TEXT,
    "status" "EscalationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ChatEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatEscalation_tenantId_status_idx" ON "ChatEscalation"("tenantId", "status");
```

### Migration 3: Token Tracking

```sql
-- AlterTable
ALTER TABLE "AgentAuditLog"
ADD COLUMN "inputTokens" INTEGER,
ADD COLUMN "outputTokens" INTEGER,
ADD COLUMN "estimatedCostCents" INTEGER;
```

---

## Testing Checklist

### P0 Tests

- [ ] CSAT widget renders after booking confirmation
- [ ] Feedback persists to database
- [ ] Rating validation (1-5 only)

### P1 Tests

- [ ] SSE streaming delivers chunks correctly
- [ ] Client reconnects on connection drop
- [ ] Cancel booking creates T3 proposal
- [ ] Escalation logs to database
- [ ] Proactive trigger fires after 30s + scroll

### P2 Tests

- [ ] Cache hit reduces response time
- [ ] Cache invalidates after 5 minutes
- [ ] Analytics endpoint returns correct counts
- [ ] Tenant rate limiter kicks in at threshold

---

## Success Metrics

After implementation, track:

| Metric              | Current | Target (30 days) | Target (90 days) |
| ------------------- | ------- | ---------------- | ---------------- |
| CSAT Rating         | Unknown | 4.0+             | 4.5+             |
| Response Time (P50) | 3-5s    | <2s              | <1.5s            |
| Booking Conversion  | Unknown | 15%              | 25%              |
| Escalation Rate     | N/A     | <10%             | <5%              |
| Sessions/Day        | Unknown | Baseline         | +20%             |

---

_Implementation roadmap generated by Claude Opus 4.5_
