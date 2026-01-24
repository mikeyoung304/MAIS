# World-Class Customer Agent Roadmap

**Date:** December 29, 2025
**Status:** Planning (Reviewed)
**Current Score:** 60% (C+) | **Target Score:** 85%+ (A)
**Branch:** `feat/customer-chatbot`
**Review Status:** ✅ DHH (B+) | ✅ Kieran (B+) | ✅ Simplicity (Approved)

---

## Code Review Summary

This plan was reviewed by three specialized agents. Key findings incorporated below.

### Blocking Issues (Must Fix Before Implementation)

| Issue                                       | Reviewer | Fix                                |
| ------------------------------------------- | -------- | ---------------------------------- |
| Missing `confirmationCode` field on Booking | DHH      | Add migration + backfill           |
| Missing `TokenUsage` table migration        | DHH      | Add migration in Phase 0           |
| SSE code mixes EventSource + fetch          | DHH      | Remove EventSource, use fetch only |
| No Zod validation schemas for new endpoints | Kieran   | Add to packages/contracts          |
| `as any[]` casts in message handling        | Kieran   | Add ChatMessage Zod schema         |
| Email injection risk in escalation          | Kieran   | Add HTML sanitization              |
| Missing escalation rate limiter             | Kieran   | Add 3/hour separate limiter        |
| Booking reference enumeration risk          | Kieran   | Require email verification         |

### Approved Complexity (Keep As-Is)

- CSAT collection (dual thumbs + rating) ✅
- SSE streaming with reconnection ✅
- Cancel/reschedule with T3 confirmation ✅
- Human escalation with email notification ✅
- Token usage tracking ✅
- Returning customer recognition ✅

### Deferred (Require Customer Validation)

- **Phase 4.2 Voice Integration** - Three external dependencies, speculative
- **Phase 4.4 pgvector Semantic Search** - Start with simpler search first

---

## Overview

Transform the MAIS customer chatbot from a solid MVP (60% benchmark score) to a world-class agent (85%+) that competes with top-tier 2025 chatbots. The existing proposal/executor architecture is excellent—this plan focuses on incremental enhancements, not rewrites.

## Problem Statement

The customer chatbot audit revealed critical gaps blocking competitive positioning:

| Gap                    | Impact                            | Industry Standard |
| ---------------------- | --------------------------------- | ----------------- |
| No CSAT measurement    | Cannot measure improvement        | >85% satisfaction |
| No streaming responses | 2-5s perceived latency            | <3s perceived     |
| No human escalation    | Stuck customers abandon           | <20% handoff rate |
| No cancel/reschedule   | Incomplete booking lifecycle      | 40-86% resolution |
| Session-only memory    | No returning customer recognition | +30% engagement   |

## Proposed Solution

**Phase 1 (P0):** Add CSAT collection to enable measurement
**Phase 2 (P1):** Add streaming + complete booking lifecycle + human escalation
**Phase 3 (P2):** Add caching + analytics dashboard + personalization
**Phase 4 (P3):** Multi-channel + voice + industry-specific prompts

---

## Technical Approach

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CUSTOMER CHATBOT ENHANCED                    │
├─────────────────────────────────────────────────────────────────┤
│  FRONTEND (CustomerChatWidget.tsx)                               │
│  ├─ SSE streaming client                                         │
│  ├─ CSAT feedback UI (thumbs up/down + post-session rating)      │
│  ├─ Human escalation button                                      │
│  └─ Returning customer recognition                               │
├─────────────────────────────────────────────────────────────────┤
│  BACKEND (customer-orchestrator.ts)                              │
│  ├─ SSE streaming endpoint                                       │
│  ├─ 6 tools (current 4 + cancel + reschedule)                   │
│  ├─ CSAT collection + analytics                                  │
│  └─ Human escalation trigger                                     │
├─────────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE                                                  │
│  ├─ Redis cache (adapter exists, wire to customer chat)          │
│  ├─ ChatFeedback model (new)                                     │
│  ├─ ChatEscalation model (new)                                   │
│  └─ Analytics dashboard (new)                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Current Architecture (Preserved)

The proposal/executor pattern is industry-leading and will be preserved:

```
User Message → Claude → Tool Call → createProposal() → Preview
                                         ↓
User Confirms → Executor → Prisma (with advisory locks) → Result
```

---

## Implementation Phases

### Phase 0: Core Booking Flow Completion (LAUNCH BLOCKERS)

> **⚠️ CRITICAL:** End-to-end scan on Dec 29, 2025 revealed the booking flow is incomplete.
> Customers can book but receive NO confirmation email and NO payment is collected.
> These items MUST be completed before ANY other work.

#### 0.0 Complete Booking Email Notifications

**File:** `server/src/agent/customer/customer-booking-executor.ts` (lines 115-116 have TODOs)

```typescript
// After successful booking creation (around line 108)
import { mailAdapter } from '@/adapters/postmark.adapter';

// Send customer confirmation email
await mailAdapter.sendBookingConfirm({
  to: booking.customer.email,
  customerName: booking.customer.name,
  bookingDate: booking.date,
  serviceName: booking.package.name,
  confirmationCode: booking.confirmationCode,
  businessName: tenant.businessName,
  businessEmail: tenant.contactEmail,
});

// Notify tenant of new booking
await mailAdapter.sendEmail({
  to: tenant.contactEmail,
  subject: `[HANDLED] New booking from ${booking.customer.name}`,
  html: `
    <h2>New Booking Received</h2>
    <p><strong>Customer:</strong> ${booking.customer.name} (${booking.customer.email})</p>
    <p><strong>Service:</strong> ${booking.package.name}</p>
    <p><strong>Date:</strong> ${booking.date.toLocaleDateString()}</p>
    <p><strong>Confirmation Code:</strong> ${booking.confirmationCode}</p>
    <p><a href="${APP_URL}/bookings/${booking.id}">View in Dashboard</a></p>
  `,
});
```

#### 0.1 Stripe Checkout Integration

**File:** `server/src/agent/customer/customer-booking-executor.ts`

```typescript
import { stripeAdapter } from '@/adapters/stripe.adapter';

// After booking creation, create checkout session
const checkoutSession = await stripeAdapter.createCheckoutSession({
  tenantId,
  bookingId: booking.id,
  customerEmail: booking.customer.email,
  lineItems: [
    {
      name: booking.package.name,
      amount: booking.package.price, // In cents
      quantity: 1,
    },
  ],
  successUrl: `${STOREFRONT_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
  cancelUrl: `${STOREFRONT_URL}/booking/cancelled`,
  metadata: {
    bookingId: booking.id,
    tenantId,
  },
});

// Return checkout URL to customer
return {
  success: true,
  bookingId: booking.id,
  confirmationCode: booking.confirmationCode,
  message: `Booking confirmed! Complete your payment to secure your spot.`,
  checkoutUrl: checkoutSession.url, // Frontend redirects here
};
```

**File:** `server/src/routes/webhooks.routes.ts` (add payment webhook handler)

```typescript
// Handle checkout.session.completed webhook
case 'checkout.session.completed': {
  const session = event.data.object;
  const bookingId = session.metadata?.bookingId;

  if (bookingId) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED', paidAt: new Date() },
    });

    // Send payment confirmation email
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, package: true },
    });

    if (booking) {
      await mailAdapter.sendEmail({
        to: booking.customer.email,
        subject: `Payment Confirmed - ${booking.package.name}`,
        html: `Your payment has been confirmed. See you on ${booking.date.toLocaleDateString()}!`,
      });
    }
  }
  break;
}
```

#### 0.2 Add paidAt Field to Booking Model

**File:** `server/prisma/schema.prisma`

```prisma
model Booking {
  // ... existing fields
  paidAt DateTime?  // When payment was completed
}
```

**File:** `server/prisma/migrations/YYYYMMDD_add_booking_paid_at.sql`

```sql
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
```

#### 0.3 Basic Test Coverage

**File:** `server/test/integration/customer-chat.spec.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestTenant, cleanupTestTenant } from '../helpers/test-tenant';
import { CustomerOrchestrator } from '@/agent/customer';

describe('Customer Chat Integration', () => {
  let tenantId: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const result = await createTestTenant();
    tenantId = result.tenantId;
    cleanup = result.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should create session and respond to greeting', async () => {
    const orchestrator = new CustomerOrchestrator();
    const response = await orchestrator.chat(tenantId, null, 'Hi!');

    expect(response.sessionId).toBeDefined();
    expect(response.message).toBeDefined();
    expect(response.message.length).toBeGreaterThan(0);
  });

  it('should list services when asked', async () => {
    const orchestrator = new CustomerOrchestrator();
    const response = await orchestrator.chat(tenantId, null, 'What services do you offer?');

    expect(response.message).toContain('service');
  });

  it('should create booking proposal', async () => {
    const orchestrator = new CustomerOrchestrator();
    // First message to establish session
    const session = await orchestrator.chat(
      tenantId,
      null,
      'I want to book a haircut for tomorrow'
    );

    // Continue conversation until proposal
    // ... (depends on your test data setup)
  });
});
```

#### 0.4 Session and Proposal Cleanup Jobs

**File:** `server/src/jobs/cleanup.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/core/logger';

/**
 * Clean up expired customer sessions (older than 24 hours)
 * Run daily via cron
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const result = await prisma.agentSession.deleteMany({
    where: {
      sessionType: 'CUSTOMER',
      updatedAt: { lt: cutoff },
    },
  });

  logger.info({ deletedCount: result.count }, 'Cleaned up expired customer sessions');
  return result.count;
}

/**
 * Clean up expired proposals (older than 7 days)
 * Run daily via cron
 */
export async function cleanupExpiredProposals(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  const result = await prisma.agentProposal.deleteMany({
    where: {
      status: { in: ['EXPIRED', 'REJECTED'] },
      expiresAt: { lt: cutoff },
    },
  });

  logger.info({ deletedCount: result.count }, 'Cleaned up expired proposals');
  return result.count;
}
```

**File:** `server/src/index.ts` (add to server startup or use node-cron)

```typescript
import { cleanupExpiredSessions, cleanupExpiredProposals } from '@/jobs/cleanup';

// Run cleanup daily at 3 AM
if (process.env.NODE_ENV === 'production') {
  const cron = require('node-cron');
  cron.schedule('0 3 * * *', async () => {
    await cleanupExpiredSessions();
    await cleanupExpiredProposals();
  });
}
```

#### 0.5 Success Criteria

- [ ] Booking confirmation email sent to customer
- [ ] Booking notification email sent to tenant
- [ ] Stripe checkout session created after booking
- [ ] Payment webhook updates booking status to CONFIRMED
- [ ] `paidAt` field added to Booking model
- [ ] Integration test for basic chat flow
- [ ] Cleanup jobs running in production
- [ ] All tests passing

---

### Phase 0B: Pre-Implementation Blockers (Schema & Validation)

These items MUST be completed before starting Phase 1.

#### 0.1 Add confirmationCode to Booking Model

**File:** `server/prisma/migrations/YYYYMMDD_add_booking_confirmation_code.sql`

```sql
-- Add confirmation code to bookings for customer lookup
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "confirmationCode" TEXT;

-- Create unique index for lookups
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_confirmationCode_idx"
  ON "Booking"("confirmationCode") WHERE "confirmationCode" IS NOT NULL;

-- Backfill existing bookings with generated codes
UPDATE "Booking"
SET "confirmationCode" = 'BK-' || UPPER(SUBSTRING(id, 1, 6))
WHERE "confirmationCode" IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE "Booking" ALTER COLUMN "confirmationCode" SET NOT NULL;
```

**File:** `server/prisma/schema.prisma` (add to Booking model)

```prisma
model Booking {
  // ... existing fields
  confirmationCode String @unique
}
```

#### 0.2 Add TokenUsage Table

**File:** `server/prisma/migrations/YYYYMMDD_add_token_usage.sql`

```sql
CREATE TABLE IF NOT EXISTS "TokenUsage" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id"),
  "sessionId" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL,
  "outputTokens" INTEGER NOT NULL,
  "model" TEXT NOT NULL,
  "estimatedCostCents" INTEGER NOT NULL,  -- Store as cents to avoid float issues
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "TokenUsage_tenantId_createdAt_idx"
  ON "TokenUsage"("tenantId", "createdAt" DESC);
```

#### 0.3 Add Zod Validation Schemas

**File:** `packages/contracts/src/schemas/customer-chat.schema.ts`

```typescript
import { z } from 'zod';

// Chat message schema for type-safe message handling
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  toolUses: z
    .array(
      z.object({
        toolName: z.string(),
        input: z.record(z.unknown()),
        result: z.object({
          success: z.boolean(),
          data: z.unknown().optional(),
          error: z.string().optional(),
        }),
      })
    )
    .optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// Feedback request validation
export const ChatFeedbackRequestSchema = z
  .object({
    sessionId: z.string().uuid(),
    messageId: z.string().uuid().optional(),
    feedbackType: z.enum(['THUMBS_UP', 'THUMBS_DOWN', 'RATING']),
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().max(500).optional(),
  })
  .refine((data) => data.feedbackType !== 'RATING' || data.rating !== undefined, {
    message: 'Rating required for RATING feedback type',
    path: ['rating'],
  });

// Escalation request validation
export const EscalationRequestSchema = z.object({
  sessionId: z.string().uuid(),
  reason: z.string().min(10).max(1000),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
});

// Stream message validation
export const StreamMessageRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

// Cancel booking validation (with ownership proof)
export const CancelBookingRequestSchema = z.object({
  bookingReference: z.string().regex(/^BK-[A-Z0-9]{6}$/),
  customerEmail: z.string().email(), // Required for ownership verification
  reason: z.string().max(500).optional(),
});

// Reschedule booking validation
export const RescheduleBookingRequestSchema = z.object({
  bookingReference: z.string().regex(/^BK-[A-Z0-9]{6}$/),
  customerEmail: z.string().email(), // Required for ownership verification
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  newTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
});
```

#### 0.4 Add Escalation Rate Limiter

**File:** `server/src/middleware/rateLimiter.ts` (add new limiter)

```typescript
/**
 * Escalation-specific rate limiter (stricter than chat)
 * 3 escalations per hour per IP to prevent spam
 */
export const customerEscalationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTestEnvironment ? 500 : 3, // 3 escalations per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => normalizeIp(req.ip),
  validate: false,
  handler: (_req: Request, res: Response) => {
    logger.warn({ ip: normalizeIp(_req.ip) }, 'Customer escalation rate limit exceeded');
    res.status(429).json({
      error: 'escalation_limit_exceeded',
      message: 'Too many escalation requests. Please try again later.',
    });
  },
});
```

#### 0.5 Add HTML Sanitization Utility

**File:** `server/src/lib/sanitize.ts`

```typescript
import { escape as escapeHtml } from 'lodash';

/**
 * Sanitize user content for HTML email inclusion
 * Prevents XSS and email injection attacks
 */
export function sanitizeForEmail(text: string): string {
  return escapeHtml(text);
}

/**
 * Sanitize and truncate conversation for summary
 */
export function sanitizeConversationSummary(
  messages: Array<{ role: string; content?: string }>,
  maxMessages = 5,
  maxContentLength = 200
): string {
  return messages
    .slice(-maxMessages)
    .map((m) => `${m.role}: ${escapeHtml((m.content || '').slice(0, maxContentLength))}`)
    .join('\n');
}
```

#### 0.6 Success Criteria

- [ ] `confirmationCode` field added to Booking model
- [ ] Existing bookings backfilled with confirmation codes
- [ ] `TokenUsage` table created
- [ ] Zod schemas created in `packages/contracts`
- [ ] Escalation rate limiter added (3/hour)
- [ ] HTML sanitization utility created
- [ ] All migrations applied successfully
- [ ] `npm run typecheck` passes

---

### Phase 1: CSAT Collection (P0 - Critical Foundation)

**Why first:** Cannot improve what we cannot measure. All other improvements require CSAT data to validate impact.

#### 1.1 Database Migration

**File:** `server/prisma/migrations/YYYYMMDD_add_chat_feedback.sql`

```sql
-- Idempotent migration for chat feedback
DO $$ BEGIN
  CREATE TYPE "ChatFeedbackType" AS ENUM ('THUMBS_UP', 'THUMBS_DOWN', 'RATING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ChatFeedback" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id"),
  "sessionId" TEXT NOT NULL,
  "messageId" TEXT,
  "feedbackType" "ChatFeedbackType" NOT NULL,
  "rating" INTEGER CHECK (rating >= 1 AND rating <= 5),
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rating_required_for_rating_type"
    CHECK ("feedbackType" != 'RATING' OR "rating" IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS "ChatFeedback_tenantId_idx" ON "ChatFeedback"("tenantId");
CREATE INDEX IF NOT EXISTS "ChatFeedback_sessionId_idx" ON "ChatFeedback"("sessionId");
CREATE INDEX IF NOT EXISTS "ChatFeedback_createdAt_idx" ON "ChatFeedback"("createdAt");

-- Idempotency: prevent duplicate feedback per message (network retries)
CREATE UNIQUE INDEX IF NOT EXISTS "ChatFeedback_sessionId_messageId_feedbackType_idx"
  ON "ChatFeedback"("sessionId", "messageId", "feedbackType")
  WHERE "messageId" IS NOT NULL;
```

#### 1.2 Backend Endpoint

**File:** `server/src/routes/public-customer-chat.routes.ts`

```typescript
// POST /v1/public/chat/feedback
router.post('/feedback', customerChatLimiter, async (req, res) => {
  const { sessionId, messageId, feedbackType, rating, comment } = req.body;

  // Validate session ownership
  const session = await prisma.agentSession.findUnique({
    where: { id: sessionId, tenantId: req.tenantId },
  });
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const feedback = await prisma.chatFeedback.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: req.tenantId,
      sessionId,
      messageId,
      feedbackType,
      rating,
      comment: comment?.slice(0, 500), // Limit comment length
    },
  });

  return res.json({ success: true, feedbackId: feedback.id });
});
```

#### 1.3 Frontend Components

**File:** `apps/web/src/components/chat/FeedbackButtons.tsx`

```tsx
'use client';

import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useState } from 'react';

interface FeedbackButtonsProps {
  messageId: string;
  sessionId: string;
  tenantApiKey: string;
  onFeedback?: (type: 'THUMBS_UP' | 'THUMBS_DOWN') => void;
}

export function FeedbackButtons({
  messageId,
  sessionId,
  tenantApiKey,
  onFeedback,
}: FeedbackButtonsProps) {
  const [submitted, setSubmitted] = useState<'THUMBS_UP' | 'THUMBS_DOWN' | null>(null);

  const submitFeedback = async (type: 'THUMBS_UP' | 'THUMBS_DOWN') => {
    if (submitted) return;

    await fetch(`${API_URL}/v1/public/chat/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Key': tenantApiKey,
      },
      body: JSON.stringify({ sessionId, messageId, feedbackType: type }),
    });

    setSubmitted(type);
    onFeedback?.(type);
  };

  return (
    <div className="flex gap-1 mt-1">
      <button
        onClick={() => submitFeedback('THUMBS_UP')}
        disabled={!!submitted}
        className={cn(
          'p-1 rounded hover:bg-neutral-100 transition-colors',
          submitted === 'THUMBS_UP' && 'text-green-600 bg-green-50'
        )}
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        onClick={() => submitFeedback('THUMBS_DOWN')}
        disabled={!!submitted}
        className={cn(
          'p-1 rounded hover:bg-neutral-100 transition-colors',
          submitted === 'THUMBS_DOWN' && 'text-red-600 bg-red-50'
        )}
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
    </div>
  );
}
```

**File:** `apps/web/src/components/chat/SessionRating.tsx`

```tsx
'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';

interface SessionRatingProps {
  sessionId: string;
  tenantApiKey: string;
  onComplete?: () => void;
}

export function SessionRating({ sessionId, tenantApiKey, onComplete }: SessionRatingProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submitRating = async () => {
    if (rating === 0) return;

    await fetch(`${API_URL}/v1/public/chat/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Key': tenantApiKey,
      },
      body: JSON.stringify({
        sessionId,
        feedbackType: 'RATING',
        rating,
        comment: comment.trim() || undefined,
      }),
    });

    setSubmitted(true);
    onComplete?.();
  };

  if (submitted) {
    return <div className="text-center py-4 text-neutral-600">Thank you for your feedback!</div>;
  }

  return (
    <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100">
      <p className="text-sm font-medium text-neutral-900 mb-3">How was your experience?</p>
      <div className="flex gap-1 justify-center mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            onClick={() => setRating(star)}
          >
            <Star
              className={cn(
                'w-6 h-6 transition-colors',
                (hoveredRating || rating) >= star
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-neutral-300'
              )}
            />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Any additional feedback? (optional)"
            className="w-full p-2 text-sm border border-neutral-200 rounded-lg resize-none"
            rows={2}
          />
          <button
            onClick={submitRating}
            className="w-full mt-2 py-2 bg-sage text-white rounded-full text-sm font-medium"
          >
            Submit
          </button>
        </>
      )}
    </div>
  );
}
```

#### 1.4 Success Metrics

- [ ] CSAT collection endpoint working
- [ ] Thumbs up/down on every assistant message
- [ ] Post-session star rating prompt
- [ ] Feedback data visible in Prisma Studio
- [ ] Baseline CSAT score established

---

### Phase 2: Core Gaps (P1 - 30 Days)

#### 2.1 SSE Streaming Responses

**File:** `server/src/routes/public-customer-chat.routes.ts`

```typescript
import { StreamMessageRequestSchema } from '@macon/contracts';

// POST /v1/public/chat/message/stream
router.post('/message/stream', customerChatLimiter, async (req, res) => {
  // Validate request
  const parseResult = StreamMessageRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.message });
  }
  const { message, sessionId } = parseResult.data;

  // Set SSE headers with nginx buffering disabled
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Track connection state for cleanup
  let isClientConnected = true;
  req.on('close', () => {
    isClientConnected = false;
  });

  // Heartbeat to detect dropped connections (every 15s)
  const heartbeatInterval = setInterval(() => {
    if (!isClientConnected) {
      clearInterval(heartbeatInterval);
      return;
    }
    res.write(': heartbeat\n\n');
  }, 15000);

  const orchestrator = new CustomerOrchestrator();

  // Stream callback with connection check
  const onChunk = (chunk: string) => {
    if (!isClientConnected) return;
    try {
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
    } catch {
      isClientConnected = false;
    }
  };

  try {
    const result = await orchestrator.chatStream(req.tenantId, sessionId, message, onChunk);

    if (isClientConnected) {
      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          message: result.message,
          proposal: result.proposal,
        })}\n\n`
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error, tenantId: req.tenantId, sessionId }, 'Stream error');
    if (isClientConnected) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
    }
  } finally {
    clearInterval(heartbeatInterval);
    res.end();
  }
});
```

**File:** `apps/web/src/hooks/useStreamingChat.ts` (extracted utility)

```typescript
'use client';

import { useState, useCallback, useRef } from 'react';

interface SSEEvent {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  message?: string;
  proposal?: BookingProposal;
  error?: string;
}

interface UseStreamingChatOptions {
  tenantApiKey: string;
  onChunk?: (content: string) => void;
  onDone?: (message: string, proposal?: BookingProposal) => void;
  onError?: (error: string) => void;
}

export function useStreamingChat({
  tenantApiKey,
  onChunk,
  onDone,
  onError,
}: UseStreamingChatOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamMessage = useCallback(
    async (sessionId: string, message: string) => {
      setIsStreaming(true);
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(`${API_URL}/v1/public/chat/message/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Key': tenantApiKey,
          },
          body: JSON.stringify({ message, sessionId }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: SSEEvent = JSON.parse(line.slice(6));
                if (event.type === 'chunk' && event.content) {
                  onChunk?.(event.content);
                } else if (event.type === 'done') {
                  onDone?.(event.message || '', event.proposal);
                } else if (event.type === 'error') {
                  onError?.(event.error || 'Unknown error');
                }
              } catch {
                // Ignore malformed JSON
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          onError?.(error.message);
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [tenantApiKey, onChunk, onDone, onError]
  );

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { streamMessage, isStreaming, abort };
}
```

**File:** `apps/web/src/components/chat/CustomerChatWidget.tsx` (using the hook)

```typescript
// In component, use the extracted hook
const { streamMessage, isStreaming, abort } = useStreamingChat({
  tenantApiKey,
  onChunk: (content) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') {
        return [...prev.slice(0, -1), { ...last, content: last.content + content }];
      }
      return prev;
    });
  },
  onDone: (message, proposal) => {
    if (proposal?.requiresApproval) {
      setPendingProposal(proposal);
    }
  },
  onError: (error) => {
    setError(error);
  },
});

const sendMessageWithStreaming = async () => {
  const message = inputValue.trim();
  if (!message || isStreaming || !sessionId) return;

  setInputValue('');
  setError(null);

  // Add user message
  setMessages((prev) => [
    ...prev,
    {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    },
  ]);

  // Add empty assistant message (will be filled by streaming)
  setMessages((prev) => [
    ...prev,
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    },
  ]);

  await streamMessage(sessionId, message);
};
```

#### 2.2 Cancel Booking Tool

**File:** `server/src/agent/customer/customer-tools.ts`

```typescript
{
  name: 'cancel_booking',
  description: 'Cancel an existing booking. Requires booking reference AND customer email for verification.',
  input_schema: {
    type: 'object',
    properties: {
      bookingReference: {
        type: 'string',
        description: 'The booking confirmation code (e.g., BK-ABC123)',
      },
      customerEmail: {
        type: 'string',
        description: 'Customer email address for ownership verification',
      },
      reason: {
        type: 'string',
        description: 'Optional reason for cancellation',
      },
    },
    required: ['bookingReference', 'customerEmail'],
  },
  handler: async (
    input: { bookingReference: string; customerEmail: string; reason?: string },
    ctx: CustomerToolContext
  ) => {
    const { tenantId, proposalService } = ctx;

    // Find booking by reference WITH email verification (prevents enumeration)
    const booking = await prisma.booking.findFirst({
      where: {
        tenantId,
        confirmationCode: input.bookingReference,
        customer: { email: input.customerEmail.toLowerCase() },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: { package: true, customer: true },
    });

    if (!booking) {
      // Generic message to prevent enumeration attacks
      return {
        success: false,
        message: 'Booking not found. Please check your confirmation code and email address.',
      };
    }

    // Create T3 proposal (requires explicit confirmation)
    if (proposalService) {
      const proposal = await proposalService.createProposal(
        tenantId,
        'cancel_booking',
        {
          bookingId: booking.id,
          bookingReference: input.bookingReference,
          customerId: booking.customerId,
          reason: input.reason,
          service: booking.package.name,
          date: booking.date.toLocaleDateString(),
        },
        'T3' // Hard confirm required for cancellation
      );

      return {
        success: true,
        requiresApproval: true,
        proposalId: proposal.id,
        preview: {
          operation: 'Cancel Booking',
          service: booking.package.name,
          date: booking.date.toLocaleDateString(),
          customerName: booking.customer.name,
          message: `Are you sure you want to cancel your ${booking.package.name} appointment on ${booking.date.toLocaleDateString()}?`,
        },
      };
    }

    return { success: false, message: 'Cancellation service unavailable.' };
  },
}
```

#### 2.3 Reschedule Booking Tool

**File:** `server/src/agent/customer/customer-tools.ts`

```typescript
{
  name: 'reschedule_booking',
  description: 'Reschedule an existing booking to a new date/time. Requires email verification.',
  input_schema: {
    type: 'object',
    properties: {
      bookingReference: {
        type: 'string',
        description: 'The booking confirmation code',
      },
      customerEmail: {
        type: 'string',
        description: 'Customer email address for ownership verification',
      },
      newDate: {
        type: 'string',
        description: 'New date in YYYY-MM-DD format',
      },
      newTime: {
        type: 'string',
        description: 'New time in HH:MM format (24hr)',
      },
    },
    required: ['bookingReference', 'customerEmail', 'newDate'],
  },
  handler: async (
    input: { bookingReference: string; customerEmail: string; newDate: string; newTime?: string },
    ctx: CustomerToolContext
  ) => {
    const { tenantId, proposalService } = ctx;

    // Find existing booking WITH email verification
    const booking = await prisma.booking.findFirst({
      where: {
        tenantId,
        confirmationCode: input.bookingReference,
        customer: { email: input.customerEmail.toLowerCase() },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: { package: true, customer: true },
    });

    if (!booking) {
      return {
        success: false,
        message: 'Booking not found. Please check your confirmation code and email address.',
      };
    }

    // Check new date availability
    const newDate = new Date(input.newDate);
    const isAvailable = await checkDateAvailability(tenantId, newDate, booking.packageId);

    if (!isAvailable) {
      return {
        success: false,
        message: `Sorry, ${input.newDate} is not available. Would you like to check other dates?`
      };
    }

    // Create T3 proposal
    if (proposalService) {
      const proposal = await proposalService.createProposal(
        tenantId,
        'reschedule_booking',
        {
          bookingId: booking.id,
          bookingReference: input.bookingReference,
          customerId: booking.customerId,
          originalDate: booking.date.toISOString(),
          newDate: input.newDate,
          newTime: input.newTime,
          service: booking.package.name,
        },
        'T3'
      );

      return {
        success: true,
        requiresApproval: true,
        proposalId: proposal.id,
        preview: {
          operation: 'Reschedule Booking',
          service: booking.package.name,
          originalDate: booking.date.toLocaleDateString(),
          newDate: newDate.toLocaleDateString(),
          customerName: booking.customer.name,
          message: `Reschedule your ${booking.package.name} from ${booking.date.toLocaleDateString()} to ${newDate.toLocaleDateString()}?`,
        },
      };
    }

    return { success: false, message: 'Reschedule service unavailable.' };
  },
}
```

#### 2.4 Human Escalation

**File:** `server/prisma/migrations/YYYYMMDD_add_chat_escalation.sql`

```sql
CREATE TYPE "EscalationStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESOLVED');
CREATE TYPE "EscalationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE IF NOT EXISTS "ChatEscalation" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id"),
  "sessionId" TEXT NOT NULL,
  "customerId" TEXT,
  "customerEmail" TEXT,
  "customerPhone" TEXT,
  "reason" TEXT NOT NULL,
  "priority" "EscalationPriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "EscalationStatus" NOT NULL DEFAULT 'PENDING',
  "conversationSummary" TEXT,
  "assignedTo" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ChatEscalation_tenantId_status_idx"
  ON "ChatEscalation"("tenantId", "status");

-- Index for dashboard queries by date
CREATE INDEX IF NOT EXISTS "ChatEscalation_tenantId_createdAt_idx"
  ON "ChatEscalation"("tenantId", "createdAt" DESC);
```

**File:** `server/src/routes/public-customer-chat.routes.ts`

```typescript
import { EscalationRequestSchema } from '@macon/contracts';
import { sanitizeForEmail, sanitizeConversationSummary } from '@/lib/sanitize';
import { customerEscalationLimiter } from '@/middleware/rateLimiter';
import { z } from 'zod';

// POST /v1/public/chat/escalate
// Uses stricter rate limiter: 3/hour vs 20/min for chat
router.post('/escalate', customerEscalationLimiter, async (req, res) => {
  // Validate request
  const parseResult = EscalationRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.message });
  }
  const { sessionId, reason, customerEmail, customerPhone } = parseResult.data;

  // Get session for context (must be recent - within 1 hour)
  const session = await prisma.agentSession.findFirst({
    where: {
      id: sessionId,
      tenantId: req.tenantId,
      sessionType: 'CUSTOMER',
      updatedAt: { gt: new Date(Date.now() - 60 * 60 * 1000) }, // Active within 1 hour
    },
    select: { messages: true, customerId: true },
  });

  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  // Parse messages safely with Zod
  const messagesResult = z
    .array(
      z.object({
        role: z.string(),
        content: z.string().optional(),
      })
    )
    .safeParse(session.messages);

  // Generate sanitized conversation summary (prevents XSS in emails)
  const summary = messagesResult.success
    ? sanitizeConversationSummary(messagesResult.data)
    : 'Unable to retrieve conversation';

  // Create escalation
  const escalation = await prisma.chatEscalation.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: req.tenantId,
      sessionId,
      customerId: session.customerId,
      customerEmail,
      customerPhone,
      reason,
      conversationSummary: summary,
      priority: 'MEDIUM',
    },
  });

  // Notify tenant via email (with sanitized content)
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId },
    select: { contactEmail: true, businessName: true },
  });

  if (tenant?.contactEmail) {
    const sanitizedReason = sanitizeForEmail(reason);
    const sanitizedEmail = customerEmail ? sanitizeForEmail(customerEmail) : 'Not provided';

    await mailAdapter.sendEmail({
      to: tenant.contactEmail,
      subject: `[HANDLED] New chat escalation from customer`,
      html: `
        <h2>A customer needs human assistance</h2>
        <p><strong>Reason:</strong> ${sanitizedReason}</p>
        <p><strong>Customer Email:</strong> ${sanitizedEmail}</p>
        <p><strong>Recent Conversation:</strong></p>
        <pre>${summary}</pre>
        <p><a href="${APP_URL}/escalations/${escalation.id}">View in Dashboard</a></p>
      `,
    });
  }

  return res.json({
    success: true,
    message: "Your request has been sent to our team. We'll get back to you soon!",
  });
});
```

**File:** `apps/web/src/components/chat/EscalationButton.tsx`

```tsx
'use client';

import { useState } from 'react';
import { MessageSquareWarning, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EscalationButtonProps {
  sessionId: string;
  tenantApiKey: string;
  onEscalated?: () => void;
}

export function EscalationButton({ sessionId, tenantApiKey, onEscalated }: EscalationButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submitEscalation = async () => {
    if (!reason.trim()) return;

    setIsSubmitting(true);

    await fetch(`${API_URL}/v1/public/chat/escalate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Key': tenantApiKey,
      },
      body: JSON.stringify({ sessionId, reason, customerEmail: email }),
    });

    setSubmitted(true);
    setIsSubmitting(false);
    onEscalated?.();
  };

  if (submitted) {
    return (
      <div className="p-3 bg-green-50 rounded-xl text-green-800 text-sm">
        Your request has been sent. We'll be in touch soon!
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-700"
      >
        <MessageSquareWarning className="w-3 h-3" />
        Need human help?
      </button>
    );
  }

  return (
    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
      <p className="text-sm font-medium text-amber-900">Request human assistance</p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email (optional)"
        className="w-full p-2 text-sm border border-amber-200 rounded-lg"
      />
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="How can we help?"
        className="w-full p-2 text-sm border border-amber-200 rounded-lg resize-none"
        rows={2}
      />
      <div className="flex gap-2">
        <Button
          onClick={submitEscalation}
          disabled={isSubmitting || !reason.trim()}
          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-full text-sm"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
        </Button>
        <Button onClick={() => setIsOpen(false)} variant="outline" className="rounded-full text-sm">
          Cancel
        </Button>
      </div>
    </div>
  );
}
```

#### 2.5 Success Metrics

- [ ] Streaming responses working (<3s perceived latency)
- [ ] Cancel booking tool with T3 confirmation
- [ ] Reschedule booking tool with T3 confirmation
- [ ] Human escalation with email notification
- [ ] Resolution rate improved to 60-70%

---

### Phase 3: Scale & Polish (P2 - 60 Days)

#### 3.1 Redis Caching for Session Context

**File:** `server/src/agent/customer/customer-orchestrator.ts`

```typescript
// Add Redis caching for business context
private async getBusinessContext(tenantId: string): Promise<BusinessContext> {
  const cacheKey = `customer:${tenantId}:business_context`;

  // Try cache first
  const cached = await this.cacheAdapter.get<BusinessContext>(cacheKey);
  if (cached) {
    return cached;
  }

  // Build context
  const context = await this.buildBusinessContext(tenantId);

  // Cache for 15 minutes
  await this.cacheAdapter.set(cacheKey, context, 900);

  return context;
}
```

#### 3.2 Analytics Dashboard

**File:** `server/src/routes/tenant-admin.routes.ts`

```typescript
// GET /v1/tenant/analytics/chat
router.get('/analytics/chat', tenantAuthMiddleware, async (req, res) => {
  const tenantId = res.locals.tenantAuth.tenantId;

  // Get date range (default: last 30 days)
  const startDate = new Date(req.query.startDate || Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = new Date(req.query.endDate || Date.now());

  // Session stats
  const sessions = await prisma.agentSession.count({
    where: {
      tenantId,
      sessionType: 'CUSTOMER',
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  // CSAT stats
  const feedback = await prisma.chatFeedback.groupBy({
    by: ['feedbackType'],
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate },
    },
    _count: true,
    _avg: { rating: true },
  });

  // Booking conversion
  const bookings = await prisma.booking.count({
    where: {
      tenantId,
      source: 'CHATBOT',
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  // Escalation stats
  const escalations = await prisma.chatEscalation.count({
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  return res.json({
    period: { startDate, endDate },
    sessions: {
      total: sessions,
      avgPerDay: sessions / 30,
    },
    satisfaction: {
      thumbsUp: feedback.find((f) => f.feedbackType === 'THUMBS_UP')?._count || 0,
      thumbsDown: feedback.find((f) => f.feedbackType === 'THUMBS_DOWN')?._count || 0,
      avgRating: feedback.find((f) => f.feedbackType === 'RATING')?._avg?.rating || null,
    },
    conversion: {
      bookings,
      conversionRate: sessions > 0 ? ((bookings / sessions) * 100).toFixed(1) : '0',
    },
    escalations: {
      total: escalations,
      rate: sessions > 0 ? ((escalations / sessions) * 100).toFixed(1) : '0',
    },
  });
});
```

#### 3.3 Token Usage Tracking

**File:** `server/src/agent/customer/customer-orchestrator.ts`

```typescript
// After each Claude API call
const usage = response.usage;
await prisma.tokenUsage.create({
  data: {
    id: crypto.randomUUID(),
    tenantId,
    sessionId,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    model: this.config.model,
    estimatedCost: this.calculateCost(usage),
    createdAt: new Date(),
  }
});

private calculateCost(usage: { input_tokens: number; output_tokens: number }): number {
  // Claude Sonnet 4 pricing (per 1M tokens)
  const INPUT_COST_PER_M = 3.00;
  const OUTPUT_COST_PER_M = 15.00;

  return (
    (usage.input_tokens / 1_000_000) * INPUT_COST_PER_M +
    (usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_M
  );
}
```

#### 3.4 Returning Customer Recognition

**File:** `server/src/agent/customer/customer-orchestrator.ts`

```typescript
private async getCustomerContext(customerId?: string): Promise<CustomerContext | null> {
  if (!customerId) return null;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      bookings: {
        orderBy: { date: 'desc' },
        take: 5,
        include: { package: true }
      }
    }
  });

  if (!customer) return null;

  return {
    name: customer.name,
    email: customer.email,
    bookingCount: customer.bookings.length,
    lastBooking: customer.bookings[0] ? {
      service: customer.bookings[0].package.name,
      date: customer.bookings[0].date,
    } : null,
    preferredServices: this.extractPreferences(customer.bookings),
  };
}

// Inject into system prompt
if (customerContext) {
  systemPrompt += `\n\nReturning Customer Context:
- Name: ${customerContext.name}
- Past bookings: ${customerContext.bookingCount}
- Last service: ${customerContext.lastBooking?.service || 'None'}
- Preferred services: ${customerContext.preferredServices.join(', ')}

Greet them warmly by name and reference their history when relevant.`;
}
```

#### 3.5 Success Metrics

- [ ] Redis caching reducing DB queries by 60%+
- [ ] Analytics dashboard with CSAT trends
- [ ] Token usage tracking with cost estimates
- [ ] Returning customer recognition working
- [ ] Overall score improved to 75%+

---

### Phase 4: Competitive Edge (P3 - Future)

> **Note:** Items 4.2 and 4.4 are DEFERRED pending customer validation per Simplicity Review.
> These add significant complexity and should only proceed with proven customer demand.

#### 4.1 Multi-Channel (SMS, Instagram DM)

- Integrate Twilio for SMS conversations
- Use Instagram Graph API for DM handling
- Unified conversation state across channels

#### 4.2 Voice Integration ⚠️ DEFERRED

**Status:** Requires customer demand validation before implementation.

**Concern:** Three external service dependencies (WebRTC, Whisper, Eleven Labs) for speculative value.

**Prerequisites before starting:**

- [ ] Customer survey showing >30% demand for voice
- [ ] Business case with ROI projection
- [ ] Prototype with 5 real customers

**If validated:**

- WebRTC for in-browser voice
- Whisper API for transcription
- Eleven Labs for voice synthesis

#### 4.3 Industry-Specific Prompts

- Photography: portfolio references, editing style preferences
- Coaching: goal tracking, session preparation
- Therapy: intake forms, insurance questions (with compliance)

#### 4.4 pgvector Semantic Search ⚠️ DEFERRED

**Status:** Start with simpler keyword/tool-based search. Add vectors only if quality suffers.

**Rationale:** The existing chatbot already has tools for FAQ and service lookup. Vector search adds infrastructure complexity (pgvector extension, embedding generation, index maintenance) that may not be needed.

**Prerequisites before starting:**

- [ ] Evidence that current search is insufficient
- [ ] Failed conversation analysis showing semantic gaps
- [ ] Cost-benefit analysis for embedding infrastructure

**If validated:**

- Vector embeddings for FAQ and service descriptions
- Semantic similarity for question answering
- Reduced hallucination through grounded responses

---

## Acceptance Criteria

### Functional Requirements

- [ ] CSAT collection (thumbs up/down per message, star rating per session)
- [ ] SSE streaming responses (<3s perceived latency)
- [ ] Cancel booking with T3 confirmation
- [ ] Reschedule booking with T3 confirmation
- [ ] Human escalation with email notification
- [ ] Redis caching for business context
- [ ] Analytics dashboard for tenant admins
- [ ] Token usage tracking
- [ ] Returning customer recognition

### Non-Functional Requirements

- [ ] Response latency <3s (perceived with streaming)
- [ ] 99.9% uptime (graceful degradation if Redis down)
- [ ] CSAT score >85%
- [ ] Resolution rate >70%
- [ ] Escalation rate <15%

### Quality Gates

- [ ] All existing tests passing
- [ ] New unit tests for each tool
- [ ] E2E tests for streaming, cancellation, escalation
- [ ] Security review for escalation endpoint
- [ ] Load testing for SSE connections

---

## Risk Analysis & Mitigation

| Risk                  | Impact | Mitigation                                     |
| --------------------- | ------ | ---------------------------------------------- |
| SSE connection limits | High   | Use connection pooling, implement reconnection |
| Redis unavailability  | Medium | Graceful fallback to direct DB queries         |
| Escalation spam       | Medium | Rate limit + email verification                |
| Token cost explosion  | Medium | Per-session token limits + alerts              |
| Cancellation abuse    | Low    | Cancellation policy in terms, T3 confirmation  |

---

## References

### Internal References

- `docs/audits/CUSTOMER_CHATBOT_2025_AUDIT.md` - Full audit results
- `docs/audits/CUSTOMER_CHATBOT_IMPROVEMENT_ROADMAP.md` - Detailed code implementations
- `server/src/agent/customer/customer-orchestrator.ts:1-611` - Current orchestrator
- `server/src/agent/customer/customer-tools.ts:1-483` - Current tools
- `server/src/adapters/redis/cache.adapter.ts` - Redis adapter (exists)
- `server/src/adapters/postmark.adapter.ts` - Email adapter with retries

### External References

- [2025 AI Chatbot Benchmarks](https://research) - Industry KPIs
- [SSE Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Claude Streaming API](https://docs.anthropic.com/claude/reference/streaming)

### Related Work

- PR #23: Customer chatbot P1/P2 fixes (security)
- Commit 66b512f: Initial customer chatbot implementation

---

## Success Metrics Summary

| Metric          | Current | Phase 1  | Phase 2 | Phase 3 | Target |
| --------------- | ------- | -------- | ------- | ------- | ------ |
| Overall Score   | 60%     | 65%      | 75%     | 80%     | 85%+   |
| CSAT            | Unknown | Measured | >80%    | >85%    | >85%   |
| Response Time   | 2-5s    | 2-5s     | <3s     | <3s     | <3s    |
| Resolution Rate | 45-55%  | 50-60%   | 60-70%  | 70-80%  | >70%   |
| Escalation Rate | N/A     | <25%     | <20%    | <15%    | <15%   |
| Tool Count      | 4       | 4        | 6       | 6+      | 6+     |

---

_Plan generated December 29, 2025_
_Based on comprehensive 5-agent audit_
