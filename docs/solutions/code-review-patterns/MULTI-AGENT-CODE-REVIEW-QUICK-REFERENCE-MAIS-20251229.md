---
module: MAIS
date: 2025-12-29
component: code-review-process
type: quick-reference
related_doc: MULTI-AGENT-CODE-REVIEW-PREVENTION-STRATEGIES-MAIS-20251229.md
tags: [multi-agent-review, code-review, quick-reference, checklist]
---

# Multi-Agent Code Review: Quick Reference

**Print this page and pin to your desk.** Use this as a daily reminder before submitting PRs.

---

## Agent Assignment Quick Guide

| Concern          | Primary Agent           | Secondary               | Time   |
| ---------------- | ----------------------- | ----------------------- | ------ |
| Circular imports | architecture-strategist | typescript-reviewer     | 10 min |
| Type safety      | typescript-reviewer     | code-simplicity         | 15 min |
| Security         | security-sentinel       | devops-harmony          | 20 min |
| Performance      | performance-oracle      | architecture-strategist | 15 min |
| React patterns   | kieran-typescript       | code-simplicity         | 10 min |
| Error handling   | code-simplicity         | security-sentinel       | 10 min |

**Rule:** Always include `code-simplicity-reviewer`. For large changes, use 3+ agents in parallel.

---

## 3-Minute Pre-Commit Checks

```bash
# Check 1: No circular dependencies (30 seconds)
npx madge --circular --extensions ts server/src

# Check 2: TypeScript clean (1 minute)
npm run typecheck

# Check 3: Tests pass (2 minutes)
npm test -- --run

# Check 4: Lint clean (30 seconds)
npm run lint
```

If ANY check fails, fix before pushing. These are blocker issues.

---

## Common Anti-Patterns (Red Flags)

### 🚩 Sequential Awaits That Should Be Parallel

```typescript
// ❌ WRONG: 3x slower
await email.send();
await db.update();
await log.record();

// ✅ RIGHT: 1x speed
await Promise.all([email.send(), db.update(), log.record()]);
```

### 🚩 Nested Transactions

```typescript
// ❌ WRONG: Complexity, savepoints
await prisma.$transaction(async (tx1) => {
  await prisma.$transaction(async (tx2) => {
    /* ... */
  });
});

// ✅ RIGHT: Single transaction
await prisma.$transaction(async (tx) => {
  // All operations in ONE transaction
});
```

### 🚩 No Validation in Recovery

```typescript
// ❌ WRONG: Trusts stale data
const proposal = await db.getProposal(id);
await executor(proposal.tenantId, proposal.payload);

// ✅ RIGHT: Re-validates everything
await verifyOwnership(proposal);
await validatePayloadSchema(proposal.payload);
await executor(proposal.tenantId, proposal.payload);
```

### 🚩 Leaky Error Messages

```typescript
// ❌ WRONG: Exposes internals
throw new Error(`Booking not found in table: ${id}`);

// ✅ RIGHT: Generic message
logger.warn({ bookingId: id }, 'Booking lookup failed');
throw new NotFoundError('ERR_BOOKING_NOT_FOUND');
```

---

## Tenant Isolation Verification

For each query, ask:

```
❓ Does this query filter by tenantId?
  ✅ YES → Continue
  ❌ NO → Add where: { tenantId }

❓ Are all foreign keys verified?
  ✅ YES → Continue
  ❌ NO → Add verifyOwnership(prisma, model, id, tenantId)

❓ Are errors generic (no IDs leaked)?
  ✅ YES → Continue
  ❌ NO → Use ErrorMessages enum
```

---

## Proposal Execution Checklist

Before shipping agent features:

```
Lifecycle:
  [ ] Tool creates proposal (PENDING)
  [ ] Tool returns requiresApproval boolean
  [ ] Executor registered: registerProposalExecutor(toolName, executor)
  [ ] After CONFIRMED: executor called automatically
  [ ] After execution: proposal state updated (EXECUTED/FAILED)

Validation:
  [ ] Executor validates required fields
  [ ] Executor validates field types
  [ ] Executor verifies tenant ownership
  [ ] Executor checks business logic (date availability, etc.)
  [ ] Errors don't leak information

Recovery:
  [ ] Recovery path re-validates ownership
  [ ] Recovery re-validates payload schema
  [ ] Recovery re-validates business logic
  [ ] Stale proposals don't execute
```

---

## Database Quick Checks

**Before submitting:**

```bash
# Find N+1 queries
rg "findMany.*include" server/src/agent

# Check for missing indexes
rg "where.*tenantId.*AND" server/src | head -5
# → Add @@index([tenantId, otherField]) to schema

# Verify advisory locks for concurrency
rg "pg_advisory" server/src

# Spot nested transactions
rg "\$transaction.*\n.*\$transaction" server/src
```

---

## React Component Review

For chat widget components:

```
Keys:
  [ ] key={id} not key={index}
  [ ] key={uuid} not key={Date.now()}

Performance:
  [ ] useMemo/useCallback for expensive renders
  [ ] Virtualization for long lists
  [ ] Input debounced (not every keystroke)

Accessibility:
  [ ] Semantic HTML
  [ ] ARIA labels
  [ ] Keyboard navigation
```

---

## Error Handling Pattern

```typescript
// Template for safe error handling
try {
  // Your operation here
} catch (error) {
  // Log with context (server-side only)
  logger.error({ error, context }, 'Operation failed');

  // Return generic error to client
  if (error instanceof ValidationError) {
    return { status: 400, body: { error: ErrorMessages['ERR_INVALID_PAYLOAD'] } };
  }
  return { status: 500, body: { error: ErrorMessages['ERR_INTERNAL_SERVER_ERROR'] } };
}
```

---

## Circular Dependency Prevention

**Golden Rule:** Registry modules should have NO imports.

```typescript
// ✅ CORRECT: Minimal imports
// server/src/agent/proposals/executor-registry.ts
export type ProposalExecutor = (...) => Promise<...>;
const executors = new Map<string, ProposalExecutor>();

// ❌ WRONG: Imports from other agent modules
import { CustomerBookingExecutor } from './customer-booking-executor';
//      ↑ This creates circular dependency
```

**Detection:**

```bash
npx madge --circular --extensions ts server/src
```

---

## Test Isolation Quick Check

```typescript
// ✅ CORRECT: Isolated tenant per test
test('should create booking', async () => {
  const { tenantId, cleanup } = await createTestTenant();
  try {
    // Test here
  } finally {
    await cleanup();
  }
});
```

---

## Code Review Synthesis Checklist

When reviewing multi-agent feedback:

```
P1 Issues (Blockers):
  [ ] Circular dependencies resolved
  [ ] Tenant isolation verified
  [ ] Security validations complete

P2 Issues (Should Fix):
  [ ] Database indexes added
  [ ] React key patterns fixed
  [ ] Error messages generic

P3 Issues (Nice to Have):
  [ ] Unused code cleaned
  [ ] Comments improved
  [ ] Code style consistent
```

---

## Before You Hit "Submit PR"

```
Architecture:
  [ ] npx madge --circular passes
  [ ] npm run typecheck passes

Security:
  [ ] All queries filter by tenantId
  [ ] Error messages don't leak data
  [ ] Ownership verified for mutations

Database:
  [ ] No N+1 queries
  [ ] Indexes for multi-column WHERE
  [ ] Single transaction per operation

Testing:
  [ ] npm test passes
  [ ] Coverage doesn't decrease
  [ ] Tenant isolation tested

Quality:
  [ ] npm run lint passes
  [ ] No unused variables
  [ ] JSDoc comments added
```

---

## Multi-Agent Review Request Template

When requesting `/workflows:review`:

```markdown
## What Changed

- [x] Agent tool (customer-booking-executor)
- [x] Database schema (added index)
- [x] Error handling
- [x] React component

## Areas of Concern

1. Circular dependencies in executor registry
2. Tenant isolation in recovery path
3. Performance: large message history

## Pre-review Checks Passed

- [x] npx madge --circular passes
- [x] npm run typecheck passes
- [x] npm test passes
- [x] npm run lint passes

## Reviewers Requested

- architecture-strategist
- security-sentinel
- performance-oracle
```

---

## Quick Command Reference

```bash
# Check everything
npm run build && npm test && npm run typecheck && npm run lint

# Circular dependencies
npx madge --circular --extensions ts server/src

# Find N+1 queries
rg "findMany.*include" server/src

# Find sequential awaits
rg "await.*\n.*await" server/src/services

# Find tenant isolation issues
rg "where.*[^tenantId]" server/src | grep -v "//"

# Find leaky errors
rg "throw new.*Error\(\`" server/src

# Find React key issues
rg "key={index}" apps/web/src

# Run specific test
npm test -- test/path/to/test.ts

# Watch mode
npm test -- --watch
```

---

## When in Doubt

1. **Circular imports?** → Extract to registry module
2. **Type errors?** → Add global type declaration (declare global)
3. **Concurrent access?** → Use pg_advisory_xact_lock
4. **Leaky errors?** → Use ErrorMessages enum
5. **Slow query?** → Add composite index
6. **Can't decide?** → Ask `/workflows:review`

---

**Last Updated:** 2025-12-29
**Related:** [Full Prevention Strategies Guide](./MULTI-AGENT-CODE-REVIEW-PREVENTION-STRATEGIES-MAIS-20251229.md)
