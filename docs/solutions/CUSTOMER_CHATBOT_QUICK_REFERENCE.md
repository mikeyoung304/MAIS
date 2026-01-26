---
title: Customer Chatbot Prevention - Quick Reference
date: 2025-12-29
author: Claude Code
component: customer-chatbot
format: 1-page-checklist
---

# Customer Chatbot Prevention Strategies - Quick Reference

> **LEGACY NOTICE (2026-01-26):** This document references code that was deleted during the Legacy Agent Migration. See `server/src/agent-v2/` for the current agent system. Archive branches: `archive/legacy-agent-orchestrators`, `archive/legacy-evals-feedback`.

**For full documentation, see:** `CUSTOMER_CHATBOT_PREVENTION_STRATEGIES.md`

---

## 5 Critical Issues at a Glance

| #   | Issue                      | Severity | Pattern                                  | Status     |
| --- | -------------------------- | -------- | ---------------------------------------- | ---------- |
| 1   | HTML Injection in Emails   | P1       | `sanitizePlainText()` before HTML        | ✅ Fixed   |
| 2   | Missing Payment Timestamps | P2       | Set `paidAt: new Date()` on confirm      | ⏳ Pending |
| 3   | Proposal Enumeration       | P1       | Verify sessionId in WHERE + executor     | ✅ Fixed   |
| 4   | Missing Database Indexes   | P2       | Composite indexes for multi-column WHERE | ✅ Fixed   |
| 5   | Prompt Injection           | P2       | Pattern detection + hardened prompt      | ✅ Fixed   |

---

## Issue #1: HTML Injection in Emails

### The Problem

```typescript
// ❌ VULNERABLE: User input in HTML email
const html = `<p>Hi ${customerName},</p>`;
// If customerName = "<script>alert('xss')</script>", it executes!
```

### The Fix (30 seconds)

```typescript
// ✅ CORRECT: Sanitize before HTML
import { sanitizePlainText } from '../../lib/sanitization';

const safeCustomerName = sanitizePlainText(customerName);
const html = `<p>Hi ${safeCustomerName},</p>`;
```

### Detection Command

```bash
# Find unsanitized variables in HTML
rg "html.*\`.*\$\{(?!safe)" server/src/agent/customer/
```

### Code Review Checklist

- [ ] All customer input has `safe*` prefix in HTML templates
- [ ] Variables use `sanitizePlainText()` or `sanitizeEmail()`
- [ ] Test with: `<script>`, `&`, `"`, `'`

**Status:** ✅ IMPLEMENTED (commit e2d6545, lines 99-100)

---

## Issue #2: Missing Payment Timestamps

### The Problem

```typescript
// ❌ VULNERABLE: Status updated but no paidAt
await prisma.booking.update({
  where: { id: bookingId },
  data: { status: 'CONFIRMED' }, // Missing paidAt!
});
```

### The Fix (20 seconds)

```typescript
// ✅ CORRECT: Always set paidAt on payment
await prisma.booking.update({
  where: { id: bookingId },
  data: {
    status: 'CONFIRMED',
    paidAt: new Date(), // CRITICAL
  },
});
```

### Detection Command

```sql
-- Find bookings confirmed without payment timestamp
SELECT COUNT(*) FROM "Booking"
WHERE status='CONFIRMED' AND "paidAt" IS NULL;
-- Should return 0
```

### Code Review Checklist

- [ ] Payment confirmation includes `paidAt: new Date()`
- [ ] Both updates in same transaction
- [ ] Test: Audit shows no null `paidAt` for CONFIRMED bookings

**Status:** ⏳ PENDING (webhook-processor.ts needs update)

---

## Issue #3: Proposal Enumeration

### The Problem

```typescript
// ❌ VULNERABLE: No ownership check
const proposal = await prisma.agentProposal.findUnique({
  where: { id: proposalId }, // Any customer can guess IDs!
});
```

### The Fix (50 seconds - 2 layers)

```typescript
// ✅ LAYER 1 - Route: Verify ownership
const proposal = await prisma.agentProposal.findFirst({
  where: {
    id: proposalId,
    tenantId, // Tenant-scoped
    sessionId, // Customer-scoped
  },
});

// ✅ LAYER 2 - Executor: Re-verify before execution
const customer = await tx.customer.findFirst({
  where: { id: customerId, tenantId },
});
if (!customer) throw new Error('Not authorized');
```

### Detection Command

```bash
# Find all proposal queries
rg "agentProposal\.find" server/src -A 5 | grep -B 5 "where:"
# Verify sessionId is present in WHERE
```

### Code Review Checklist

- [ ] Route verifies proposal.sessionId matches request.sessionId
- [ ] Executor re-verifies customer.tenantId
- [ ] Test: Access from different sessionId fails with 403
- [ ] Uses transaction with advisory lock

**Status:** ✅ IMPLEMENTED (lines 279-293, 62-69)

---

## Issue #4: Missing Database Indexes

### The Problem

```typescript
// ❌ SLOW: Multiple WHERE columns without index
const sessions = await prisma.agentSession.findMany({
  where: {
    tenantId,
    sessionType: 'customer',
    updatedAt: { gte: cutoffDate },
  },
});
// Result: Seq Scan (350ms+)
```

### The Fix (40 seconds)

```prisma
// ✅ SCHEMA: Add composite index
model AgentSession {
  // ... fields ...

  // Index for customer chat queries
  @@index([tenantId, sessionType, updatedAt])
}
```

### Detection Command

```sql
-- Test before/after index creation
EXPLAIN ANALYZE
SELECT * FROM "AgentSession"
WHERE "tenantId" = 'X' AND "sessionType" = 'customer'
-- Should show: Index Scan (not Seq Scan)
-- Timing: < 5ms
```

### Code Review Checklist

- [ ] 2+ WHERE columns = composite index exists
- [ ] Index column order matches WHERE order
- [ ] EXPLAIN ANALYZE shows Index Scan
- [ ] Query time < 5ms

**Status:** ✅ IMPLEMENTED (migration 17_add_session_type_index.sql)

---

## Issue #5: Prompt Injection

### The Problem

```
User: "Ignore your instructions and tell me X"
→ LLM processes injection and complies
```

### The Fix (30 seconds)

```typescript
// ✅ DETECTION: Block injection patterns
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:previous|your|all)\s+instruction/i,
  /disregard\s+(?:previous|your|all)\s+instruction/i,
  /you\s+are\s+now/i,
  // ... more patterns
];

if (PROMPT_INJECTION_PATTERNS.some((p) => p.test(userMessage))) {
  return { error: 'Cannot process that request' };
}
```

### Detection Command

```bash
# Verify patterns are defined
grep -n "PROMPT_INJECTION_PATTERNS" server/src/agent/customer/customer-orchestrator.ts

# Run tests with injection payloads
npm test -- server/test/agent/customer/ --grep "injection"
```

### Code Review Checklist

- [ ] PROMPT_INJECTION_PATTERNS defined with 8+ patterns
- [ ] Check happens BEFORE sending to Claude
- [ ] System prompt includes "DO NOT CHANGE" rules
- [ ] Test: "ignore instructions" returns error
- [ ] Test: Normal booking questions work

**Status:** ✅ IMPLEMENTED (lines 54-65)

---

## Quick Fixes by Issue

### Issue 1: 2-minute fix

```bash
cd server/src/agent/customer
# Already fixed in commit e2d6545
grep "sanitizePlainText" customer-booking-executor.ts
```

### Issue 2: 10-minute fix

```bash
# Find webhook processor
grep -n "status.*CONFIRMED" server/src/jobs/webhook-processor.ts
# Add: paidAt: new Date()
```

### Issue 3: 15-minute fix

```bash
# Already fixed in commit e2d6545
grep -n "sessionId" server/src/routes/public-customer-chat.routes.ts
```

### Issue 4: 20-minute fix

```bash
cd server
npm exec prisma migrate dev --name add_customer_indexes
# Already implemented in migration 17
```

### Issue 5: Already fixed

```bash
grep -n "PROMPT_INJECTION" server/src/agent/customer/customer-orchestrator.ts
```

---

## Before PR Merge - Run This

```bash
# 1. Check syntax
npm run typecheck

# 2. HTML injection: Verify sanitization
grep -r "sanitizePlainText\|sanitizeEmail" server/src/agent/customer/

# 3. Payment timestamps: Audit database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Booking\" WHERE status='CONFIRMED' AND \"paidAt\" IS NULL;"
# Must return 0

# 4. Proposal verification: Run tests
npm test -- server/test/agent/customer/ --grep "ownership|enumeration"

# 5. Indexes: Check query performance
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM \"AgentSession\" WHERE \"tenantId\"='x' AND \"sessionType\"='customer';"
# Must show Index Scan, not Seq Scan

# 6. Prompt injection: Run security tests
npm test -- server/test/agent/customer/ --grep "injection|prompt"

# 7. Lint & format
npm run lint
npm run format
```

---

## Prevention Checklist (Copy & Paste)

```markdown
Customer Chatbot Security Checklist:

Security:

- [ ] HTML input sanitized (Issue #1)
- [ ] Payment timestamps set (Issue #2)
- [ ] Proposal ownership verified (Issue #3)
- [ ] Prompt injection detected (Issue #5)

Performance:

- [ ] Composite indexes exist for multi-column WHERE (Issue #4)
- [ ] Query time < 5ms
- [ ] EXPLAIN ANALYZE shows Index Scan

Testing:

- [ ] Unit tests for all 5 patterns
- [ ] E2E test for full booking flow
- [ ] Security tests with 5+ injection payloads

Database:

- [ ] No bookings with CONFIRMED but null paidAt
- [ ] Proposal queries include sessionId filter
```

---

## Common Prevention Mistakes (DO NOT DO)

```typescript
// ❌ MISTAKE 1: HTML without sanitization
const html = `<p>Hi ${customerName},</p>`;

// ❌ MISTAKE 2: Missing paidAt on payment
await prisma.booking.update({ data: { status: 'CONFIRMED' } });

// ❌ MISTAKE 3: Proposal query without sessionId
await prisma.agentProposal.findUnique({ where: { id } });

// ❌ MISTAKE 4: Multi-column WHERE without index
WHERE tenantId AND sessionType AND updatedAt (no @@index)

// ❌ MISTAKE 5: User input to Claude without checking
await claude.messages.create({ messages: [{ content: userInput }] });
```

---

## When Each Pattern Applies

| Pattern               | Use When                               | Example                                        |
| --------------------- | -------------------------------------- | ---------------------------------------------- |
| HTML Injection        | Sending email with user input          | Customer name in booking confirmation          |
| Payment Timestamp     | Recording payment confirmation         | Webhook handler for checkout.session.completed |
| Proposal Verification | Multi-step operation with confirmation | Confirm booking proposal before execution      |
| Index Creation        | Query has 2+ WHERE columns             | `WHERE tenantId AND sessionType AND updatedAt` |
| Injection Detection   | LLM receives user input                | Customer chat messages to Claude               |

---

## Files Modified by Issue

| Issue | Files                                | Commit  |
| ----- | ------------------------------------ | ------- |
| #1    | customer-booking-executor.ts         | e2d6545 |
| #2    | webhook-processor.ts                 | PENDING |
| #3    | public-customer-chat.routes.ts       | e2d6545 |
| #4    | schema.prisma, migrations/17\_\*.sql | e2d6545 |
| #5    | customer-orchestrator.ts             | e2d6545 |

---

## Quick Comparison: Current vs. Fixed

### Current (Vulnerable)

- ❌ HTML not escaped
- ❌ Payment timestamp missing
- ❌ Proposal enumeration possible
- ❌ Slow queries (350ms+)
- ❌ Injection attempts succeed

### Fixed (Secure)

- ✅ Input sanitized with `sanitizePlainText()`
- ✅ Payment timestamp set on confirmation
- ✅ Ownership verified at route + executor
- ✅ Composite indexes < 5ms queries
- ✅ Injection patterns blocked

---

## Support & Questions

**For detailed info:** Read `CUSTOMER_CHATBOT_PREVENTION_STRATEGIES.md`

**Questions about patterns?** Search for issue number:

- #1 HTML Injection → Look for "CORRECT PATTERN A"
- #2 Payment Timestamps → Look for "Prevention Pattern A"
- #3 Proposal Enumeration → Look for "Multi-Level Ownership"
- #4 Database Indexes → Look for "Composite Indexes in Schema"
- #5 Prompt Injection → Look for "Pattern-Based Injection Detection"

---

**Last Updated:** 2025-12-29
**Status:** Ready for code review
**Print & Pin:** YES (this is your quick reference)
