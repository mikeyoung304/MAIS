# Customer-Facing Chatbot Architecture (Simplified)

> **feat:** Implement customer-facing AI chatbot for booking assistance

**Priority:** High
**Estimated Effort:** 2-3 weeks
**Philosophy:** Copy-modify-ship. Extract abstractions in v2 when patterns are proven.

---

## Overview

Build a customer-facing AI chatbot that helps customers:

- Browse available services and packages
- Check availability and book appointments
- Answer questions about the business (FAQ, policies)

**Scope deliberately limited:** Reschedule/cancel deferred to v2. Ship the smallest thing that helps a customer book an appointment.

---

## Problem Statement

**Current:** Customers browse storefronts and book through forms with no conversational interface.

**Desired:** Customers can chat with an AI assistant to ask questions and book appointments naturally.

**Why now:** 82% of customers expect immediate responses. Conversational booking increases conversion (+11% in Sephora case study).

---

## Technical Approach

### The Simpler Path (DHH-Approved)

**Don't:**

- Create `BaseOrchestrator` abstraction before second implementation
- Build tool factory patterns for 2 static tool arrays
- Plan 5 phases for what's essentially 8 tools + 1 widget

**Do:**

- Copy `orchestrator.ts` → `customer-orchestrator.ts`, modify tools/prompt
- Write tools in one file, export as array
- Ship in 2 weeks, extract shared code in v2 if needed

### Files to Create (~12 files)

```
server/src/agent/customer/
├── customer-orchestrator.ts     # Copied from admin, modified
├── customer-tools.ts            # 4 MVP tools
├── customer-routes.ts           # 3 endpoints
└── customer-prompt.ts           # System prompt

server/src/middleware/
└── customer-session.ts          # Session resolution

apps/web/src/components/customer-chat/
├── ChatWidget.tsx               # All-in-one component (~300 lines)
└── useCustomerChat.ts           # TanStack Query hook
```

### MVP Tools (4 tools only)

| Tool                 | Type       | Description                      |
| -------------------- | ---------- | -------------------------------- |
| `get_services`       | Read       | Browse active packages           |
| `check_availability` | Read       | Available dates for package      |
| `book_service`       | Write (T3) | Create booking with confirmation |
| `get_business_info`  | Read       | Hours, policies, FAQ             |

**Deferred to v2:** `get_my_bookings`, `reschedule_booking`, `cancel_booking`, `update_contact`

---

## Implementation Plan

### Week 1: Backend (Make It Work)

**Day 1-2: Customer Orchestrator**

Copy `server/src/agent/orchestrator/orchestrator.ts` to `server/src/agent/customer/customer-orchestrator.ts`. Modify:

- Replace `getAllTools()` with `CUSTOMER_TOOLS` array
- Replace system prompt with customer-focused version
- Replace context builder with inline `buildCustomerContext()` method

```typescript
// server/src/agent/customer/customer-orchestrator.ts
import Anthropic from '@anthropic-ai/sdk';
import { CUSTOMER_TOOLS } from './customer-tools';
import { CUSTOMER_SYSTEM_PROMPT } from './customer-prompt';
import { ProposalService } from '../proposals/proposal.service';
import { AuditService } from '../audit/audit.service';

export class CustomerOrchestrator {
  private anthropic: Anthropic;
  private proposalService: ProposalService;
  private auditService: AuditService;

  constructor(private prisma: PrismaClient) {
    this.anthropic = new Anthropic();
    this.proposalService = new ProposalService(prisma);
    this.auditService = new AuditService(prisma);
  }

  async chat(message: string, context: CustomerContext): Promise<ChatResponse> {
    // Copy message loop logic from admin orchestrator
    // ~100 lines of tool execution + history management
  }

  private async buildCustomerContext(tenantId: string, customerId: string | null): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { packages: { where: { active: true } } },
    });

    return `
## Business: ${tenant.businessName}

### Available Services
${tenant.packages.map((p) => `- ${p.name}: ${formatMoney(p.basePrice)}`).join('\n')}
`;
  }
}
```

**Day 3: Customer Tools**

```typescript
// server/src/agent/customer/customer-tools.ts
import { z } from 'zod';
import type { AgentTool, CustomerToolContext } from './types';

export const CUSTOMER_TOOLS: AgentTool[] = [
  // 1. Get Services (Read)
  {
    name: 'get_services',
    description: 'Browse available services and packages',
    inputSchema: z.object({
      category: z.string().optional(),
    }),
    async execute(context: CustomerToolContext, input) {
      const packages = await context.prisma.package.findMany({
        where: { tenantId: context.tenantId, active: true },
        select: { id: true, name: true, description: true, basePrice: true, duration: true },
        orderBy: { displayOrder: 'asc' },
      });
      return { success: true, data: packages };
    },
  },

  // 2. Check Availability (Read)
  {
    name: 'check_availability',
    description: 'Check available dates for a service',
    inputSchema: z.object({
      packageId: z.string(),
      startDate: z.string().describe('YYYY-MM-DD'),
      endDate: z.string().optional().describe('YYYY-MM-DD, defaults to 2 weeks out'),
    }),
    async execute(context: CustomerToolContext, input) {
      // Reuse existing availability check logic from availabilityService
      const available = await availabilityService.getAvailableDates(
        context.tenantId,
        input.packageId,
        input.startDate,
        input.endDate || addDays(input.startDate, 14)
      );
      return { success: true, data: available };
    },
  },

  // 3. Book Service (Write, T3)
  {
    name: 'book_service',
    description: 'Book an appointment. Requires customer email.',
    inputSchema: z.object({
      packageId: z.string(),
      date: z.string().describe('YYYY-MM-DD'),
      time: z.string().optional().describe('HH:MM for timeslot packages'),
      customerName: z.string(),
      customerEmail: z.string().email(),
      notes: z.string().optional(),
    }),
    async execute(context: CustomerToolContext, input) {
      // Validate package exists and is active
      const pkg = await context.prisma.package.findFirst({
        where: { id: input.packageId, tenantId: context.tenantId, active: true },
      });
      if (!pkg) {
        return { success: false, error: 'Package not found or unavailable' };
      }

      // Check availability
      const isAvailable = await availabilityService.checkDate(
        context.tenantId,
        input.packageId,
        input.date
      );
      if (!isAvailable) {
        return { success: false, error: 'This date is no longer available' };
      }

      // Create or find customer
      const customer = await context.prisma.customer.upsert({
        where: { tenantId_email: { tenantId: context.tenantId, email: input.customerEmail } },
        create: {
          tenantId: context.tenantId,
          email: input.customerEmail,
          name: input.customerName,
        },
        update: { name: input.customerName },
      });

      // Create proposal (T3 - requires explicit confirmation)
      const proposal = await context.proposalService.createProposal({
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        customerId: customer.id, // CRITICAL: For ownership verification
        toolName: 'book_service',
        operation: 'create_booking',
        trustTier: 'T3',
        payload: {
          packageId: input.packageId,
          customerId: customer.id,
          date: input.date,
          time: input.time,
          notes: input.notes,
        },
        preview: {
          service: pkg.name,
          date: formatDate(input.date),
          time: input.time || 'Full day',
          price: formatMoney(pkg.basePrice),
          customerEmail: input.customerEmail,
        },
      });

      return {
        success: true,
        proposalId: proposal.id,
        preview: proposal.preview,
        message: `Ready to book ${pkg.name} on ${formatDate(input.date)} for ${formatMoney(pkg.basePrice)}. Say "confirm" to proceed.`,
      };
    },
  },

  // 4. Get Business Info (Read)
  {
    name: 'get_business_info',
    description: 'Get business hours, policies, and FAQ',
    inputSchema: z.object({
      topic: z.string().optional().describe('Specific topic: hours, cancellation, location, faq'),
    }),
    async execute(context: CustomerToolContext, input) {
      const tenant = await context.prisma.tenant.findUnique({
        where: { id: context.tenantId },
        select: {
          businessName: true,
          businessHours: true,
          cancellationPolicy: true,
          contactEmail: true,
          landingPageConfig: true,
        },
      });

      // Extract FAQ from landing page config if exists
      const faq = tenant.landingPageConfig?.pages?.find((p) => p.type === 'faq')?.sections || [];

      return {
        success: true,
        data: {
          businessName: tenant.businessName,
          hours: tenant.businessHours || 'Contact for availability',
          cancellationPolicy: tenant.cancellationPolicy || 'Contact for details',
          contact: tenant.contactEmail,
          faq: faq.map((s) => ({ question: s.title, answer: s.content })),
        },
      };
    },
  },
];
```

**Day 4: Routes & Middleware**

```typescript
// server/src/agent/customer/customer-routes.ts
import { Router } from 'express';
import { CustomerOrchestrator } from './customer-orchestrator';
import { tenantMiddleware } from '../../middleware/tenant';
import { customerChatLimiter } from '../../middleware/rateLimiter';

const router = Router();

// POST /v1/public/chat - Send message
router.post(
  '/chat',
  tenantMiddleware,
  customerChatLimiter, // 20 msg/min/IP
  async (req, res) => {
    const { message, sessionId } = req.body;
    const tenantId = req.tenantId;

    const orchestrator = new CustomerOrchestrator(req.prisma);
    const response = await orchestrator.chat(message, {
      tenantId,
      sessionId,
      customerId: req.session?.customerId || null,
    });

    return res.json(response);
  }
);

// POST /v1/public/chat/confirm/:proposalId - Confirm booking
router.post('/confirm/:proposalId', tenantMiddleware, async (req, res) => {
  const proposal = await proposalService.get(req.params.proposalId);

  // CRITICAL: Verify ownership
  if (proposal.tenantId !== req.tenantId) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const result = await proposalService.confirmAndExecute(proposal);

  // Notify tenant of new booking
  await emailService.sendTenantBookingNotification(proposal.tenantId, result);

  return res.json(result);
});

// GET /v1/public/chat/session - Initialize session
router.get('/session', tenantMiddleware, async (req, res) => {
  const tenant = await req.prisma.tenant.findUnique({
    where: { id: req.tenantId },
    select: { businessName: true, slug: true },
  });

  return res.json({
    businessName: tenant.businessName,
    greeting: `Hi! I can help you book an appointment with ${tenant.businessName}. What are you looking for?`,
  });
});

export { router as customerChatRoutes };
```

**Day 5: Database Schema Update**

```prisma
// Add to server/prisma/schema.prisma

// Extend AgentSession with sessionType and customerId
model AgentSession {
  id          String      @id @default(cuid())
  tenantId    String
  customerId  String?     // NEW: null for admin sessions
  sessionType SessionType @default(ADMIN)  // NEW
  messages    Json        @default("[]")
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer    Customer?   @relation(fields: [customerId], references: [id])

  @@index([tenantId, updatedAt])
  @@index([customerId, updatedAt])
}

enum SessionType {
  ADMIN
  CUSTOMER
}

// CRITICAL: Add customerId to AgentProposal for ownership verification
model AgentProposal {
  id               String              @id @default(cuid())
  tenantId         String
  sessionId        String
  customerId       String?             // NEW: Required for customer proposals
  toolName         String
  operation        String
  trustTier        AgentTrustTier
  payload          Json
  preview          Json
  status           AgentProposalStatus
  requiresApproval Boolean
  expiresAt        DateTime
  confirmedAt      DateTime?
  executedAt       DateTime?
  result           Json?
  error            String?
  createdAt        DateTime            @default(now())

  customer         Customer?           @relation(fields: [customerId], references: [id])

  @@index([customerId])
}
```

### Week 2: Frontend + Polish (Make It Ship)

**Day 1-2: Chat Widget**

```tsx
// apps/web/src/components/customer-chat/ChatWidget.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, X, Send } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  proposalId?: string;
  proposalPreview?: Record<string, unknown>;
}

interface ChatWidgetProps {
  tenantApiKey: string; // pk_live_...
}

export function ChatWidget({ tenantApiKey }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Initialize session
  const { data: session } = useQuery({
    queryKey: ['chat-session', tenantApiKey],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/public/chat/session`, {
        headers: { 'X-Tenant-Key': tenantApiKey },
      });
      return res.json();
    },
    enabled: isOpen,
    staleTime: Infinity,
  });

  // Send message
  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/public/chat/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Key': tenantApiKey,
        },
        body: JSON.stringify({ message }),
      });
      return res.json();
    },
    onMutate: (message) => {
      setMessages((prev) => [...prev, { role: 'user', content: message }]);
      setInput('');
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message,
          proposalId: data.proposalId,
          proposalPreview: data.preview,
        },
      ]);
    },
  });

  // Confirm booking
  const confirmMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/public/chat/confirm/${proposalId}`,
        {
          method: 'POST',
          headers: { 'X-Tenant-Key': tenantApiKey },
        }
      );
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Booking confirmed! You'll receive a confirmation email shortly.`,
        },
      ]);
    },
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add greeting when session loads
  useEffect(() => {
    if (session?.greeting && messages.length === 0) {
      setMessages([{ role: 'assistant', content: session.greeting }]);
    }
  }, [session]);

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return;
    sendMutation.mutate(input.trim());
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-sage rounded-full
                   shadow-lg hover:shadow-xl transition-all duration-300
                   flex items-center justify-center z-50"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[70vh]
                        bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden
                        border border-neutral-200"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50 shrink-0">
            <h3 className="font-semibold text-text-primary">
              Chat with {session?.businessName || 'us'}
            </h3>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.role === 'user' ? 'bg-sage text-white' : 'bg-neutral-100 text-text-primary'
                  }`}
                >
                  {msg.content}

                  {/* Booking confirmation button */}
                  {msg.proposalId && (
                    <button
                      onClick={() => confirmMutation.mutate(msg.proposalId!)}
                      disabled={confirmMutation.isPending}
                      className="mt-2 w-full bg-sage-dark hover:bg-sage-darker text-white
                                 rounded-lg py-2 px-4 text-sm font-medium transition-colors"
                    >
                      {confirmMutation.isPending ? 'Confirming...' : 'Confirm Booking'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {sendMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-neutral-100 rounded-2xl px-4 py-2 text-text-secondary">
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-neutral-100 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 rounded-full border border-neutral-200 px-4 py-2
                           focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sendMutation.isPending}
                className="w-10 h-10 bg-sage rounded-full flex items-center justify-center
                           hover:bg-sage-dark transition-colors disabled:opacity-50"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Day 3: Add to Storefront Layout**

```tsx
// apps/web/src/app/t/[slug]/layout.tsx
import { ChatWidget } from '@/components/customer-chat/ChatWidget';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const tenant = await getTenantBySlug(params.slug);

  return (
    <>
      {children}
      {tenant.chatEnabled && <ChatWidget tenantApiKey={tenant.publicApiKey} />}
    </>
  );
}
```

**Day 4-5: Security Hardening & Testing**

Tasks:

- [ ] Add rate limiter: 20 msg/min/IP (see existing `agentChatLimiter`)
- [ ] Verify tenant isolation: All queries filter by `tenantId`
- [ ] Verify proposal ownership: `customerId` check in confirm endpoint
- [ ] Test E2E: Browse → Ask questions → Book → Confirm
- [ ] Test mobile viewport
- [ ] Add tenant notification email on booking

### Week 3: Ship & Iterate

**Day 1-2:** Deploy to staging, test with real tenant
**Day 3-5:** Fix issues, deploy to production, monitor

---

## Acceptance Criteria

### MVP (v1)

- [ ] Customer can browse services via chat
- [ ] Customer can check availability
- [ ] Customer can book with email capture and T3 confirmation
- [ ] Customer can ask FAQ questions
- [ ] Chat widget appears on tenant storefronts
- [ ] Tenant receives email notification on booking
- [ ] Rate limited: 20 messages/minute/IP

### Deferred to v2

- [ ] View my bookings
- [ ] Reschedule booking
- [ ] Cancel booking
- [ ] Update contact info
- [ ] Streaming responses
- [ ] BaseOrchestrator abstraction

---

## Database Changes

```sql
-- Migration: add_customer_chat_support

-- Add sessionType enum
CREATE TYPE "SessionType" AS ENUM ('ADMIN', 'CUSTOMER');

-- Add sessionType and customerId to AgentSession
ALTER TABLE "AgentSession"
ADD COLUMN "sessionType" "SessionType" NOT NULL DEFAULT 'ADMIN',
ADD COLUMN "customerId" TEXT;

-- Add foreign key
ALTER TABLE "AgentSession"
ADD CONSTRAINT "AgentSession_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL;

-- Add index for customer session queries
CREATE INDEX "AgentSession_customerId_updatedAt_idx" ON "AgentSession"("customerId", "updatedAt");

-- CRITICAL: Add customerId to AgentProposal
ALTER TABLE "AgentProposal" ADD COLUMN "customerId" TEXT;

ALTER TABLE "AgentProposal"
ADD CONSTRAINT "AgentProposal_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL;

CREATE INDEX "AgentProposal_customerId_idx" ON "AgentProposal"("customerId");
```

---

## API Endpoints

| Method | Path                          | Description                      |
| ------ | ----------------------------- | -------------------------------- |
| GET    | `/v1/public/chat/session`     | Initialize session, get greeting |
| POST   | `/v1/public/chat/chat`        | Send message, get response       |
| POST   | `/v1/public/chat/confirm/:id` | Confirm booking proposal         |

All endpoints use `X-Tenant-Key` header for tenant resolution.

---

## Security Checklist

- [ ] All queries filter by `tenantId` (tenant isolation)
- [ ] Proposal confirmation verifies `customerId` ownership
- [ ] Rate limiting: 20 msg/min/IP
- [ ] Input sanitization via existing `sanitizeForContext()`
- [ ] No PII in logs (reuse existing redaction)
- [ ] T3 trust tier for booking (explicit confirmation required)

---

## References

### Internal

- Admin orchestrator: `server/src/agent/orchestrator/orchestrator.ts`
- Proposal service: `server/src/agent/proposals/proposal.service.ts`
- Rate limiter: `server/src/middleware/rateLimiter.ts`
- Brand guide: `docs/design/BRAND_VOICE_GUIDE.md`

### Review Feedback Applied

- DHH: Eliminated BaseOrchestrator, tool factory, collapsed to 2 weeks
- Architecture: Added customerId to AgentProposal, ownership verification
- Simplicity: Reduced to 4 MVP tools, ~12 files total
