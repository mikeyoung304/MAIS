# MVP Gaps Implementation - Handoff Prompt

Copy this entire prompt to start a new Claude Code session:

---

## Context

I'm working on MAIS, a multi-tenant booking/scheduling platform (Express + React + Prisma + PostgreSQL). The platform is production-ready with 771+ tests but missing key features for competitive parity with Acuity/Calendly/HoneyBook.

## Your Task

Implement the MVP gaps following the detailed plan at `plans/mvp-gaps-implementation-plan.md`. Track progress using `plans/mvp-gaps-todos.md`.

## Gap Summary

| Gap                  | Business Impact                      | Effort   |
| -------------------- | ------------------------------------ | -------- |
| Reminder Emails      | No automated reminders               | 2-3 days |
| Per-tenant Calendar  | All tenants share one calendar       | 3-4 days |
| Reschedule/Cancel    | Customers can't self-manage          | 4-5 days |
| Deposits/Partial Pay | Full prepay only                     | 4-5 days |
| Invoicing            | Can't generate professional invoices | 5-7 days |

## Recommended Order

Start with **Phase 1: Foundation** (Secure Token System + Reminder Infrastructure) as these are dependencies for later phases.

1. Read `plans/mvp-gaps-implementation-plan.md` for full technical spec
2. Read `plans/mvp-gaps-todos.md` for the todo checklist
3. Start with Phase 1.1: Secure Token System
4. Run `npm test` after each major change
5. Run `npm run typecheck` to verify no type errors

## Key Files to Reference

- `server/prisma/schema.prisma` - Add new models here
- `server/src/di.ts` - Wire new services here
- `server/src/lib/ports.ts` - Repository interfaces
- `server/src/services/booking.service.ts` - Existing booking patterns
- `server/src/adapters/stripe.adapter.ts:187-225` - Refund implementation
- `server/src/adapters/google-calendar-sync.adapter.ts` - Calendar patterns
- `ARCHITECTURE.md:144-210` - Advisory lock documentation (ADR-006)

## Patterns to Follow

1. **Multi-tenant isolation**: All queries filter by `tenantId`
2. **Repository pattern**: New repos implement ports.ts interfaces
3. **Transaction safety**: Use PostgreSQL advisory locks (ADR-006)
4. **Event-driven**: Use EventEmitter for notifications
5. **Idempotency**: Use IdempotencyService for payment ops

## Commands

```bash
# Development
npm run dev:api                    # Start API (mock mode)
ADAPTERS_PRESET=real npm run dev:api  # Real mode with DB

# Testing
npm test                           # All server tests
npm run typecheck                  # TypeScript validation

# Database
cd server
npm exec prisma migrate dev --name migration_name  # Create migration
npm exec prisma generate           # Regenerate client
```

## First Steps

1. Install dependencies:

   ```bash
   npm install luxon @types/luxon node-cron @types/node-cron pdfkit @types/pdfkit
   ```

2. Create the BookingActionToken migration:

   ```bash
   cd server
   npm exec prisma migrate dev --name add_booking_action_tokens
   ```

3. Implement `BookingTokenService` in `server/src/services/booking-token.service.ts`

4. Wire in DI container and write tests

Let me know when you're ready to start, or ask any questions about the architecture!
