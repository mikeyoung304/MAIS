# Implementation Prompt for World-Class Customer Agent

Copy and paste everything below this line into a new Claude Code chat:

---

## Task: Complete Customer Chatbot for Launch

I need you to complete the customer chatbot for launch. An end-to-end scan revealed critical gaps in the booking flow that must be fixed before expanding features.

### Context

- **Branch:** `feat/customer-chatbot`
- **Plan file:** `plans/world-class-customer-agent-roadmap.md` (READ THIS FIRST)
- **Key gap:** Bookings are created but NO confirmation email sent, NO payment collected

### Critical Discovery

The scan found these TODOs in the code:

```typescript
// server/src/agent/customer/customer-booking-executor.ts:115-116
// TODO: Send confirmation email to customer
// TODO: Notify tenant of new booking
```

Customers complete bookings but receive nothing. This is a launch blocker.

### Implementation Order

**Phase 0: Core Booking Flow (LAUNCH BLOCKERS)**

1. **Booking emails** (highest priority)
   - Implement customer confirmation email in `customer-booking-executor.ts`
   - Implement tenant notification email
   - Use existing `mailAdapter` from `@/adapters/postmark.adapter`

2. **Stripe checkout integration**
   - Create checkout session after booking confirmation
   - Return `checkoutUrl` in executor response
   - Add webhook handler for `checkout.session.completed`
   - Add `paidAt` field to Booking model

3. **Basic test coverage**
   - Create `server/test/integration/customer-chat.spec.ts`
   - Test session creation, message handling, booking flow

4. **Cleanup jobs**
   - Create `server/src/jobs/cleanup.ts`
   - Add expired session cleanup (24hr+)
   - Add expired proposal cleanup (7 days+)

**Phase 0B: Schema & Validation**

5. **Add `confirmationCode` to Booking model**
   - Migration + backfill existing bookings

6. **Add Zod validation schemas**
   - Create `packages/contracts/src/schemas/customer-chat.schema.ts`

7. **Add escalation rate limiter**
   - 3/hour (separate from chat's 20/min)

**Then Phase 1-3 as documented in plan.**

### Files to Modify

```
server/src/agent/customer/customer-booking-executor.ts  # Add emails + Stripe
server/src/routes/webhooks.routes.ts                    # Add payment webhook
server/prisma/schema.prisma                             # Add paidAt, confirmationCode
server/src/jobs/cleanup.ts                              # NEW - cleanup jobs
server/test/integration/customer-chat.spec.ts           # NEW - tests
packages/contracts/src/schemas/customer-chat.schema.ts  # NEW - Zod schemas
server/src/middleware/rateLimiter.ts                    # Add escalation limiter
```

### Testing Requirements

After each section, verify:

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (once tests exist)
- [ ] Manual test: book through widget, check email received

### Environment Variables Required

```bash
ANTHROPIC_API_KEY=sk-ant-xxx       # For Claude API
POSTMARK_SERVER_TOKEN=xxx          # For emails
STRIPE_SECRET_KEY=sk_xxx           # For payments
STRIPE_WEBHOOK_SECRET=whsec_xxx    # For webhook validation
```

### DO NOT

- Skip email implementation (launch blocker)
- Skip Stripe integration (revenue blocker)
- Expand to CSAT/streaming before core flow works
- Implement Phase 4.2 (Voice) or 4.4 (pgvector) - deferred

### Start

1. Read `plans/world-class-customer-agent-roadmap.md` - especially Phase 0
2. Read `server/src/agent/customer/customer-booking-executor.ts` to see current state
3. Create a TodoWrite list for Phase 0
4. Begin with booking emails (the TODO at line 115)

Let's fix the core booking flow first.
