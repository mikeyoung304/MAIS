# Scheduling Backend: Acuity Parity Execution Plan

## Overview

This plan organizes 28 ready todos into 6 phases, with 5 parallel agents per batch to manage RAM usage. Each phase builds on the previous, with dependencies carefully ordered.

**Goals:**

- Production-ready code quality
- Acuity Scheduling feature parity
- 5 parallel agents per batch (RAM-safe)

**Total Todos:** 28 (8 P1, 12 P2, 8 P3)

---

## Phase 1: Critical Security & Stability (BLOCKS PRODUCTION)

**Objective:** Fix security vulnerabilities and stability issues before any feature work.

**Duration:** ~2-3 hours total
**Parallel Agents:** 5

### Batch 1.1 (5 agents in parallel)

| Agent   | Todo ID | Description                      | Effort  | Dependencies |
| ------- | ------- | -------------------------------- | ------- | ------------ |
| Agent 1 | 273     | Webhook rate limiting missing    | 30 min  | None         |
| Agent 2 | 274     | JWT secret reuse vulnerability   | 15 min  | None         |
| Agent 3 | 275     | Missing database indexes         | 1 hour  | None         |
| Agent 4 | 276     | Appointments endpoint unbounded  | 30 min  | None         |
| Agent 5 | 284     | Booking token revocation missing | 2 hours | None         |

**Why these together:** All independent, all security/stability focused, no shared files.

### Batch 1.2 (3 agents - remaining P1 security)

| Agent   | Todo ID | Description                     | Effort    | Dependencies        |
| ------- | ------- | ------------------------------- | --------- | ------------------- |
| Agent 1 | 266     | Missing payment_failed webhook  | 2-3 hours | None                |
| Agent 2 | 267     | Missing Stripe Connect webhooks | 3-4 hours | None                |
| Agent 3 | 279     | Async webhook processing        | 4-6 hours | 273 (rate limiting) |

**Why these together:** All webhook-related, Agent 3 waits for 273 completion.

### Phase 1 Verification

```bash
npm run typecheck
npm test
# Verify: All security fixes in place, tests pass
```

---

## Phase 2: Performance & API Quality

**Objective:** Optimize performance and fix API design issues.

**Duration:** ~1 day
**Parallel Agents:** 5

### Batch 2.1 (5 agents in parallel)

| Agent   | Todo ID | Description                                | Effort    | Dependencies  |
| ------- | ------- | ------------------------------------------ | --------- | ------------- |
| Agent 1 | 280     | Slot generation algorithm optimization     | 4-8 hours | 275 (indexes) |
| Agent 2 | 268     | Booking cancellation calendar sync         | 2-3 hours | None          |
| Agent 3 | 269     | Verify reminder cron job                   | 1-2 hours | None          |
| Agent 4 | 270     | Google Calendar timezone handling          | 2-3 hours | None          |
| Agent 5 | 287     | BookingService refactor (split large file) | 4-6 hours | None          |

**Why these together:**

- 280 depends on indexes (275) from Phase 1
- 268, 269, 270 are all calendar/reminder related but different files
- 287 is isolated refactoring work

### Phase 2 Verification

```bash
npm run typecheck
npm test
npm run test:e2e
# Benchmark: Slot generation should be 5-10x faster
```

---

## Phase 3: Acuity Core Features (Calendar Sync + Webhooks)

**Objective:** Implement the two CRITICAL Acuity parity features.

**Duration:** ~1 week
**Parallel Agents:** 5

### Batch 3.1 (2 major features + 3 supporting)

| Agent   | Todo ID | Description                          | Effort    | Dependencies           |
| ------- | ------- | ------------------------------------ | --------- | ---------------------- |
| Agent 1 | 277     | Two-way calendar sync (FreeBusy API) | 3-5 days  | 270 (timezone)         |
| Agent 2 | 278     | Tenant webhook subscriptions         | 3-5 days  | 279 (async processing) |
| Agent 3 | 234     | Editable image optimization          | 2-3 hours | None                   |
| Agent 4 | 235     | Image upload endpoints               | 2-3 hours | None                   |
| Agent 5 | 260     | Missing React Query                  | 2-3 hours | None                   |

**Why these together:**

- 277 and 278 are the BIG features, can work in parallel (different domains)
- 234, 235, 260 are quick wins that don't conflict

### Batch 3.2 (Continue major features + cleanup)

| Agent   | Todo ID | Description                    | Effort    | Dependencies |
| ------- | ------- | ------------------------------ | --------- | ------------ |
| Agent 1 | 277     | (Continued if not complete)    | -         | -            |
| Agent 2 | 278     | (Continued if not complete)    | -         | -            |
| Agent 3 | 251     | Missing component specs        | 2-3 hours | None         |
| Agent 4 | 271     | External service health checks | 2-3 hours | None         |
| Agent 5 | 272     | Postmark retry logic           | 2-3 hours | None         |

### Phase 3 Verification

```bash
npm run typecheck
npm test
npm run test:e2e
# Manual test: Google Calendar blocking shows in MAIS availability
# Manual test: Tenant can register webhook URL and receive events
```

---

## Phase 4: Acuity Advanced Features

**Objective:** Implement recurring appointments and group classes.

**Duration:** ~2 weeks
**Parallel Agents:** 5

### Batch 4.1 (Recurring + Group + UI cleanup)

| Agent   | Todo ID | Description                       | Effort    | Dependencies    |
| ------- | ------- | --------------------------------- | --------- | --------------- |
| Agent 1 | 281     | Recurring appointments (RRULE)    | 1-2 weeks | 280 (algorithm) |
| Agent 2 | 282     | Group classes/capacity            | 3-5 days  | None            |
| Agent 3 | 236     | Simplify section components       | 2-3 hours | None            |
| Agent 4 | 256     | Simplify reuse display components | 2-3 hours | None            |
| Agent 5 | 285     | SMS reminders (Twilio)            | 2-3 days  | None            |

**Why these together:**

- 281 is the biggest feature, needs dedicated agent
- 282 is independent (different booking type)
- 236, 256 are quick UI cleanup
- 285 is independent notification channel

### Batch 4.2 (Continue + Package system)

| Agent                                      | Todo ID | Description                 | Effort    | Dependencies |
| ------------------------------------------ | ------- | --------------------------- | --------- | ------------ |
| Agent 1                                    | 281     | (Continued if not complete) | -         | -            |
| Agent 2                                    | 283     | Packages/prepaid bundles    | 1-2 weeks | None         |
| Agent 3                                    | 286     | Intake forms (JSON schema)  | 3-5 days  | None         |
| (Agents 4-5 available for support/testing) | -       | -                           | -         | -            |

### Phase 4 Verification

```bash
npm run typecheck
npm test
npm run test:e2e
# Manual test: Book recurring weekly appointment
# Manual test: Book group class with capacity
# Manual test: Purchase 5-session package
```

---

## Phase 5: Production Hardening

**Objective:** Final quality assurance and documentation.

**Duration:** 2-3 days
**Parallel Agents:** 3

### Batch 5.1 (Final items)

| Agent   | Todo ID | Description                             | Effort | Dependencies |
| ------- | ------- | --------------------------------------- | ------ | ------------ |
| Agent 1 | 283     | (Continued if not complete)             | -      | -            |
| Agent 2 | 286     | (Continued if not complete)             | -      | -            |
| Agent 3 | -       | Integration testing across all features | 1 day  | All above    |

### Phase 5 Verification

```bash
npm run typecheck
npm test
npm run test:coverage  # Target: 80%+
npm run test:e2e
npm run build
# Load test: 100 concurrent availability requests
# Security audit: Run npm audit, check for vulnerabilities
```

---

## Execution Commands

### To Run Phase 1, Batch 1.1:

```bash
# Use /resolve_todo_parallel with specific todo IDs
/resolve_todo_parallel 273 274 275 276 284
```

### Alternative: Manual Parallel Agent Launch

```
Launch 5 Task agents in parallel:

Agent 1: "Resolve todo 273 (webhook rate limiting) - read the todo file, implement the solution, run tests"
Agent 2: "Resolve todo 274 (JWT secret reuse) - read the todo file, implement the solution, run tests"
Agent 3: "Resolve todo 275 (database indexes) - read the todo file, implement the solution, run tests"
Agent 4: "Resolve todo 276 (pagination limits) - read the todo file, implement the solution, run tests"
Agent 5: "Resolve todo 284 (token revocation) - read the todo file, implement the solution, run tests"
```

---

## Dependency Graph

```
Phase 1 (Security)
├── 273 Webhook rate limiting ──┐
├── 274 JWT secret ─────────────┼── Independent, run in parallel
├── 275 Database indexes ───────┤
├── 276 Pagination ─────────────┤
└── 284 Token revocation ───────┘
         │
         ▼
├── 266 Payment failed webhook ─┐
├── 267 Stripe Connect webhooks ┼── Webhook cluster
└── 279 Async processing ◄──────┘ (depends on 273)

Phase 2 (Performance)
├── 280 Slot algorithm ◄──────── (depends on 275 indexes)
├── 268 Cancel calendar sync
├── 269 Reminder cron
├── 270 Timezone handling ───────┐
└── 287 BookingService refactor  │
                                 │
Phase 3 (Acuity Core)            │
├── 277 Two-way calendar ◄───────┘ (depends on 270)
├── 278 Tenant webhooks ◄──────── (depends on 279)
└── 234, 235, 251, 260, 271, 272  (independent UI/infra)

Phase 4 (Acuity Advanced)
├── 281 Recurring ◄────────────── (depends on 280)
├── 282 Group classes
├── 283 Packages
├── 285 SMS reminders
├── 286 Intake forms
└── 236, 256 (UI cleanup)

Phase 5 (Hardening)
└── Integration testing, documentation
```

---

## Success Criteria

### Production Ready Checklist

- [ ] All P1 security issues resolved
- [ ] All tests passing (unit, integration, E2E)
- [ ] Type checking passes with no errors
- [ ] No console.log statements in production code
- [ ] All API endpoints have rate limiting
- [ ] Pagination enforced on all list endpoints
- [ ] Database indexes verified with EXPLAIN ANALYZE

### Acuity Parity Checklist

- [ ] Two-way Google Calendar sync working
- [ ] Tenant can register custom webhooks
- [ ] Recurring appointments (weekly, bi-weekly, monthly)
- [ ] Group classes with capacity limits
- [ ] Prepaid packages with credit tracking
- [ ] SMS reminders via Twilio
- [ ] Custom intake forms

---

## Files Summary

**Phase 1 Todos:** 273, 274, 275, 276, 284, 266, 267, 279
**Phase 2 Todos:** 280, 268, 269, 270, 287
**Phase 3 Todos:** 277, 278, 234, 235, 260, 251, 271, 272
**Phase 4 Todos:** 281, 282, 283, 285, 286, 236, 256
**Phase 5:** Integration testing and documentation

**Total: 28 todos across 5 phases**

---

## How to Proceed

1. **Review this plan** - Any changes needed?
2. **Start Phase 1, Batch 1.1** - Run 5 parallel agents on todos 273, 274, 275, 276, 284
3. **Verify after each batch** - Run tests, commit if passing
4. **Continue to next batch** - Each batch is independent

Ready to begin Phase 1?
