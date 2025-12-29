---
module: MAIS
date: 2025-12-28
problem_type: prevention_strategy
component: server/routes, agent
severity: P1
related_commit: e2d6545
tags: [security, ownership-verification, multi-tenant, transactions, authorization]
---

# Quick Reference: Multi-Step Ownership Verification

## The Problem

```typescript
// ❌ BEFORE: Verify only at route level
router.post('/confirm/:proposalId', async (req, res) => {
  const proposal = await prisma.agentProposal.findFirst({
    where: { id: proposalId }, // ← No tenantId check!
  });

  // Time gap here: proposal could be deleted/modified

  // Execute without re-verification
  const result = await executor(tenantId, proposal.customerId, proposal.payload);
});

// Attack: Attacker leaks proposalId → calls /confirm with different tenantId
// Result: Booking created even though attacker doesn't own session
```

## The Solution

### Pattern: Verify at Both Levels

```typescript
// ✅ Level 1: Route (First Defense)
router.post('/confirm/:proposalId', async (req, res) => {
  const tenantId = getTenantId(req);
  const { sessionId } = req.body;

  // Verify ownership BEFORE passing to executor
  const proposal = await prisma.agentProposal.findFirst({
    where: {
      id: proposalId,
      tenantId, // ← VERIFY tenant
      sessionId, // ← VERIFY session (optional)
    },
  });

  if (!proposal) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  // Pass verified proposal to executor
  const result = await executor(tenantId, proposal.customerId, proposal.payload);
});

// ✅ Level 2: Executor (Second Defense)
export function registerCustomerBookingExecutor(prisma: PrismaClient): void {
  registerCustomerProposalExecutor(
    'create_customer_booking',
    async (tenantId, customerId, payload) => {
      return await prisma.$transaction(async (tx) => {
        // RE-VERIFY customer belongs to tenant
        const customer = await tx.customer.findFirst({
          where: { id: customerId, tenantId }, // ← RE-VERIFY
        });

        if (!customer) {
          throw new Error('Customer not found');
        }

        // RE-VERIFY package belongs to tenant
        const pkg = await tx.package.findFirst({
          where: { id: packageId, tenantId, active: true }, // ← RE-VERIFY
        });

        if (!pkg) {
          throw new Error('Service not available');
        }

        // Now execute safely...
      });
    }
  );
}
```

## Two-Phase Execution Pattern

```
Phase 1: Route validates
  ├─ Extract tenantId from header
  ├─ Extract sessionId from body
  └─ Query: WHERE id = ? AND tenantId = ? AND sessionId = ?
       └─ Fail if not found (might not own session)

Phase 2: Executor re-validates
  ├─ Re-verify customer.tenantId = request tenantId
  ├─ Re-verify package.tenantId = request tenantId
  └─ Create booking inside transaction
       └─ Atomic: Either all succeeds or all fails
```

## Route-Level Verification

```typescript
// server/src/routes/public-customer-chat.routes.ts

router.post('/confirm/:proposalId', async (req, res, next) => {
  try {
    // 1. Extract tenant from middleware
    const tenantId = getTenantId(req);
    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenant context' });
      return;
    }

    // 2. Extract user-provided sessionId
    const { sessionId } = req.body as { sessionId?: string };

    // 3. Build strict WHERE clause
    const whereClause: {
      id: string;
      tenantId: string;
      sessionId?: string;
    } = {
      id: proposalId,
      tenantId, // ✅ ALWAYS filter by tenant
    };

    // 4. Add session verification if provided
    if (sessionId) {
      whereClause.sessionId = sessionId; // ✅ Verify session ownership
    }

    // 5. Fetch with strict filtering
    const proposal = await prisma.agentProposal.findFirst({
      where: whereClause,
    });

    // 6. If not found, DON'T EXPOSE WHY
    // (could be: wrong tenant, wrong session, doesn't exist)
    if (!proposal) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    // 7. Verified proposal - pass to executor
    const result = await executor(tenantId, proposal.customerId, proposal.payload);

    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

## Executor-Level Re-verification

```typescript
// server/src/agent/customer/customer-booking-executor.ts

export function registerCustomerBookingExecutor(prisma: PrismaClient): void {
  registerCustomerProposalExecutor(
    'create_customer_booking',
    async (tenantId, customerId, payload) => {
      const { packageId, date, notes, totalPrice, customerName } = payload as any;

      // ✅ ATOMIC: Transaction ensures consistency
      return await prisma.$transaction(async (tx) => {
        // ✅ LOCK: Prevent race conditions
        const lockId = hashTenantDate(tenantId, date);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

        // ✅ RE-VERIFY customer belongs to tenant
        const customer = await tx.customer.findFirst({
          where: { id: customerId, tenantId }, // ← RE-VERIFY tenant
        });

        if (!customer) {
          throw new Error('Customer not found. Please try booking again.');
        }

        // ✅ RE-VERIFY package belongs to tenant and is active
        const pkg = await tx.package.findFirst({
          where: { id: packageId, tenantId, active: true }, // ← RE-VERIFY tenant
        });

        if (!pkg) {
          throw new Error('Service is no longer available.');
        }

        // ✅ RE-VERIFY date is available (prevents double-booking)
        const existingBooking = await tx.booking.findFirst({
          where: {
            tenantId, // ← Filter by tenant
            date: new Date(date),
            status: { notIn: ['CANCELED', 'REFUNDED'] },
          },
        });

        if (existingBooking) {
          throw new Error('This date is no longer available.');
        }

        // ✅ Now safe to create booking
        const booking = await tx.booking.create({
          data: {
            tenantId,
            customerId,
            packageId,
            date: new Date(date),
            totalPrice,
            status: 'PENDING',
            bookingType: 'DATE',
            notes: `[Chatbot booking] ${notes ?? ''}`,
          },
        });

        return {
          action: 'booked',
          bookingId: booking.id,
          message: 'Your booking has been confirmed!',
        };
      });
    }
  );
}
```

## Verification Checklist

For every multi-step operation, verify:

### Route Level

- [ ] Extract tenantId from header/middleware?
- [ ] Query includes WHERE tenantId = ?
- [ ] Query includes optional ownership check (sessionId, userId)?
- [ ] Return 404 if not found (don't expose which check failed)?
- [ ] Only pass verified data to next layer?

### Executor/Service Level

- [ ] Re-verify primary resource (customer, package) has tenantId = request tenantId?
- [ ] Re-verify all related resources (package, booking) have tenantId = request tenantId?
- [ ] Use transaction for atomic operation?
- [ ] Use advisory lock if preventing race condition?

## Security Testing

```typescript
// Test 1: Cross-tenant access
test('should prevent cross-tenant proposal execution', async () => {
  // Tenant A creates proposal
  const proposal = await createProposal({
    tenantId: tenantA.id,
    sessionId: sessionA.id,
    customerId: customerA.id,
  });

  // Attacker tries to execute as Tenant B
  const response = await confirmProposal({
    proposalId: proposal.id,
    tenantId: tenantB.id, // ← Different tenant
    sessionId: sessionA.id,
  });

  // Should fail at route level
  expect(response.status).toBe(404);
  expect(response.body).not.toContain('customerId'); // Don't leak data
});

// Test 2: Session hijacking
test('should prevent session hijacking', async () => {
  const proposal = await createProposal({
    tenantId,
    sessionId: sessionA.id,
    customerId: customerA.id,
  });

  // Different session tries to execute
  const response = await confirmProposal({
    proposalId: proposal.id,
    tenantId,
    sessionId: sessionB.id, // ← Wrong session
  });

  // Should fail
  expect(response.status).toBeGreaterThanOrEqual(400);
});

// Test 3: Data integrity in executor
test('should prevent double-booking via race condition', async () => {
  // Two concurrent requests for same date
  const proposals = await Promise.all([
    createProposal({ date: '2025-01-15' }),
    createProposal({ date: '2025-01-15' }),
  ]);

  const results = await Promise.all([confirmProposal(proposals[0]), confirmProposal(proposals[1])]);

  // One succeeds, one fails (advisory lock prevents both)
  const successes = results.filter((r) => r.status === 200);
  expect(successes.length).toBe(1);
});
```

## Multi-Tenant Verification Order

**CRITICAL:** Always verify tenant FIRST:

```typescript
// ❌ WRONG ORDER: Find first, then check tenant
const proposal = await db.proposal.findUnique({ id });
if (proposal.tenantId !== requestTenantId) {
  throw new Error('Forbidden'); // ← Leaks information
}

// ✅ RIGHT ORDER: Filter by tenant in query
const proposal = await db.proposal.findFirst({
  where: {
    id,
    tenantId: requestTenantId, // ← Filter FIRST
  },
});
if (!proposal) {
  throw new Error('Not found'); // ← No info leak
}
```

## When to Use Transactions

Always use transactions for multi-step operations:

```typescript
// ✅ Correct: Everything succeeds or everything fails
await prisma.$transaction(async (tx) => {
  const booking = await tx.booking.create({...});
  const invoice = await tx.invoice.create({...});
  // Both created atomically
});

// ❌ Wrong: Middle step could fail, leaving inconsistent state
const booking = await prisma.booking.create({...});
const invoice = await prisma.invoice.create({...});  // ← If fails, booking created but no invoice
```

## Advisory Lock Pattern (For Race Conditions)

```typescript
// Prevent concurrent bookings for same date
return await prisma.$transaction(async (tx) => {
  // 1. Acquire lock on tenant+date combination
  const lockId = hashTenantDate(tenantId, date);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  // 2. All other requests wait here (lock released on commit/abort)

  // 3. Check if available (now safe, lock prevents race)
  const existing = await tx.booking.findFirst({
    where: { tenantId, date, status: { notIn: ['CANCELED'] } }
  });

  if (existing) {
    throw new Error('Date taken');
  }

  // 4. Create booking (safe from race)
  const booking = await tx.booking.create({...});

  return booking;
  // Lock automatically released here
});
```

## File Locations in MAIS

- `server/src/routes/public-customer-chat.routes.ts` - Line 264-347 (confirmation route)
- `server/src/agent/customer/customer-booking-executor.ts` - Executor re-verification
- `server/src/agent/customer/customer-orchestrator.ts` - Orchestration logic

## Code Review Checklist

For routes calling executors:

- [ ] Route extracts tenantId from middleware?
- [ ] Route includes tenantId in WHERE clause?
- [ ] Route includes optional ownership verification?
- [ ] Executor re-verifies all tenant filters?
- [ ] Executor uses transaction?
- [ ] Executor uses advisory lock (if preventing race)?
- [ ] Error messages don't leak information?

---

**Use This Document:** When implementing multi-step operations (proposal → confirm → execute)
**Related:** PR-23-PREVENTION-STRATEGIES.md - Issue #5
**Rule:** Verify ownership at BOTH route AND executor levels. Don't trust the first check.
