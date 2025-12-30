---
module: MAIS
date: 2025-12-29
problem_type: prevention_strategy
component: code-review-process
severity: P0-P1
tags:
  [
    multi-agent-review,
    code-review-patterns,
    parallel-agents,
    quality-gates,
    agent-chatbot,
    typescript-build,
  ]
related_commits: [e2d6545, df56db1, 136a948, bd1e07c, 2da22fc, 09f12cd, 09cb34c]
status: COMPLETE
discovery_method: multi-agent-analysis
review_agents:
  [
    kieran-typescript-reviewer,
    security-sentinel,
    code-simplicity-reviewer,
    architecture-strategist,
    performance-oracle,
    devops-harmony-analyst,
  ]
---

# Multi-Agent Code Review: Prevention Strategies

## Overview

This document provides prevention strategies based on code review findings from 7 commits analyzing the MAIS codebase. The patterns identify:

1. **How to run effective multi-agent code reviews** - When parallel agents are faster, which agents to assign, how to synthesize findings
2. **Common patterns to watch for** - Sequential execution anti-patterns, database performance issues, security validation gaps
3. **Checklist for future agent/chatbot PRs** - Concrete verification steps for the next iteration

---

## Part 1: Running Effective Multi-Agent Code Reviews

### 1.1 When Parallel Agents Are Effective

**Parallel multi-agent review works best for:**

1. **Large architectural changes** (100+ lines affecting multiple layers)
   - Example: Customer chatbot (8+ files, 3 orchestrators, 50+ agent tools)
   - Review agents: 6-8 specialized reviewers in parallel
   - Time saved: 60-80% vs sequential review

2. **Multi-domain concerns** (spanning security, performance, types, architecture)
   - Example: Executor registry + circular dependencies + type safety
   - Review agents: security-sentinel + architecture-strategist + typescript-reviewer
   - Benefit: Domain experts catch issues faster than generalists

3. **Quality gate violations** (build errors, lint failures, coverage drops)
   - Example: Disabled coverage thresholds, ESLint duplication, runtime bugs
   - Review agents: devops-harmony-analyst + code-simplicity-reviewer
   - Benefit: Detects systemic quality issues missed by manual review

4. **Security-critical features** (authentication, data isolation, payments)
   - Example: Customer booking confirmation, tenant verification, proposal execution
   - Review agents: security-sentinel + performance-oracle
   - Benefit: Multi-layer threat modeling prevents bypass attacks

**When NOT to use parallel review:**

- Single-file changes (<50 lines)
- Documentation-only PRs
- Simple refactoring (no behavior change)
- Emergency hotfixes (time-sensitive)

### 1.2 Which Agents for Which Concerns

#### Agent Assignment Matrix

| Concern                   | Best Agents                                       | Why                               | Example                                |
| ------------------------- | ------------------------------------------------- | --------------------------------- | -------------------------------------- |
| **Circular Dependencies** | architecture-strategist + typescript-reviewer     | Detect import cycles early        | `executor-registry.ts` import analysis |
| **Type Safety**           | typescript-reviewer + code-simplicity-reviewer    | Catch `any` types, missing guards | Express middleware properties          |
| **Security**              | security-sentinel + devops-harmony-analyst        | Threats + infrastructure          | HTML injection in emails               |
| **Performance**           | performance-oracle + architecture-strategist      | Queries + caching                 | Missing database indexes               |
| **React Patterns**        | kieran-typescript-reviewer                        | Component performance, keys       | Array index keys, memoization          |
| **Database**              | performance-oracle + devops-harmony-analyst       | Slow queries, schema drift        | Advisory locks, transaction semantics  |
| **Error Handling**        | code-simplicity-reviewer + security-sentinel      | Clear errors, info leakage        | Error messages with sensitive data     |
| **Test Isolation**        | devops-harmony-analyst + code-simplicity-reviewer | Race conditions, flakiness        | Test pool exhaustion                   |

#### Assignment Rules

```typescript
// Rule 1: Multiple agents for cross-cutting concerns
if (isSecurity && isPerformance) {
  agents = [securitySentinel, performanceOracle];
}

// Rule 2: Specialized agent for domain expertise
if (isTypeScript) {
  agents = [kieranTypescriptReviewer, ...others];
}

// Rule 3: Simplicity reviewer always included for readability
agents.push(codeSimplicityReviewer);

// Rule 4: Architecture strategist for structural changes
if (affectsMultipleLayers && isNewPattern) {
  agents.push(architectureStrategist);
}
```

### 1.3 Synthesizing Multi-Agent Findings

#### Step 1: Categorize Findings by Severity

```
REVIEW OUTPUT:
- security-sentinel: 3 findings (1 P1, 1 P2, 1 P3)
- typescript-reviewer: 2 findings (1 P2, 1 P3)
- performance-oracle: 2 findings (all P2)
- architecture-strategist: 1 finding (P1)
- devops-harmony-analyst: 1 finding (P2)

AGGREGATED:
P1: 2 (1 security + 1 architecture)
P2: 4 (1 security + 1 typescript + 2 performance)
P3: 2 (1 security + 1 typescript)
```

#### Step 2: Identify Cross-Cutting Issues

Look for findings that appear in multiple agent reports - these indicate systemic problems:

```
PATTERN: Express type safety
Found by: typescript-reviewer (type errors)
Found by: code-simplicity-reviewer (workarounds with `as any`)
Found by: devops-harmony-analyst (runtime errors)

DIAGNOSIS: Not a simple type issue - it's an architectural gap
SOLUTION: Global type declaration file for middleware properties
PRIORITY: P1 (blocks type safety across all routes)
```

#### Step 3: Create Issue Dependencies

```
Critical path for execution:
1. [P1] Fix circular dependencies (blocks everything else)
   ↓
2. [P1] Add Express type declarations (enables TypeScript fixes)
   ↓
3. [P2] Fix missing indexes (enables performance fixes)
   ↓
4. [P2] Implement React key patterns (enables component fixes)
   ↓
5. [P3] Clean up unused code (polish)
```

#### Step 4: Validate Fix Completeness

For each P1 finding, verify:

```typescript
// P1 Issue: Circular dependencies in executor registry
const validation = {
  find_with_madge: 'npx madge --circular --extensions ts server/src',
  expected: 'No circular dependencies detected',
  coverage: 'All agent modules', // Not just agent/customer
  tests: 'npm test passes', // No runtime undefined errors
};

// P1 Issue: Express middleware type safety
const validation = {
  find_with_grep: "rg 'req\\.' server/src/routes",
  expected: 'No type errors in routes',
  coverage: 'All Express routes',
  tests: 'npm run typecheck passes',
};
```

---

## Part 2: Common Patterns to Watch For

### 2.1 Sequential Execution Where Parallel Is Possible

#### Anti-Pattern: Waterfall Calls

```typescript
// ❌ ANTI-PATTERN: Sequential calls to independent services
async function createBookingWithNotifications(tenantId: string, bookingData: BookingData) {
  // Step 1: Create booking (serial)
  const booking = await bookingService.create(tenantId, bookingData);

  // Step 2: Send confirmation email (serial)
  await emailService.sendConfirmation(booking);

  // Step 3: Update customer record (serial)
  await customerService.updateLastBooking(tenantId, booking.customerId);

  // Step 4: Log audit event (serial)
  await auditService.log(tenantId, 'booking_created', booking.id);

  return booking;
}
```

**Problem:** Email, customer update, and audit are independent - they take 3x longer sequentially.

#### Solution: Parallel Execution with Promise.all()

```typescript
// ✅ PATTERN: Parallel for independent operations
async function createBookingWithNotifications(tenantId: string, bookingData: BookingData) {
  // Step 1: Create booking (required first)
  const booking = await bookingService.create(tenantId, bookingData);

  // Step 2: Parallel operations (no dependencies on each other)
  const [, ,] = await Promise.all([
    emailService.sendConfirmation(booking),
    customerService.updateLastBooking(tenantId, booking.customerId),
    auditService.log(tenantId, 'booking_created', booking.id),
  ]);

  return booking;
}
```

#### Detection Strategy

Search for sequential awaits that could be parallelized:

```bash
# Find sequential await calls (anti-pattern)
rg "await.*\n.*await" server/src/services --multiline --context=3

# Look for independent operations that could use Promise.all
rg "await.*email.*\n.*await.*customer" server/src --multiline
```

#### Code Review Checklist

When reviewing service methods:

- [ ] Are consecutive `await` calls independent? (no data flow between them)
- [ ] Could they use `Promise.all([...])` instead?
- [ ] Is there a performance reason for sequential execution? (document it)
- [ ] Are errors handled correctly for all parallel operations?

### 2.2 Nested Transactions in PostgreSQL

#### Anti-Pattern: Nested Savepoints

```typescript
// ❌ ANTI-PATTERN: Manually nested transactions
async function complexOperation(tenantId: string, data: any) {
  return await prisma.$transaction(async (tx) => {
    // Step 1: Create something
    const item = await tx.item.create({ data: { tenantId, ...data } });

    // Step 2: Manual nested transaction (WRONG)
    const nestedResult = await prisma.$transaction(async (innerTx) => {
      // This creates a savepoint - complex and error-prone
      return await innerTx.relatedItem.create({ data: { itemId: item.id } });
    });

    return { item, nestedResult };
  });
}
```

**Problem:** Nested transactions create savepoints which complicate error handling and make code harder to reason about.

#### Solution: Single Atomic Transaction

```typescript
// ✅ PATTERN: Single transaction, no nesting
async function complexOperation(tenantId: string, data: any) {
  return await prisma.$transaction(async (tx) => {
    // Step 1: Create something
    const item = await tx.item.create({ data: { tenantId, ...data } });

    // Step 2: Create related item (same transaction)
    const relatedItem = await tx.relatedItem.create({
      data: { itemId: item.id },
    });

    // All commits together - atomicity guaranteed
    return { item, relatedItem };
  });
}
```

#### PostgreSQL Advisory Locks Pattern (for concurrency)

When you need to serialize access (e.g., booking creation), use advisory locks:

```typescript
// ✅ PATTERN: Advisory lock with transaction (for booking double-prevention)
async function createBookingExclusively(tenantId: string, date: string) {
  return await prisma.$transaction(async (tx) => {
    // Step 1: Acquire lock (prevents other transactions from proceeding)
    const lockId = hashTenantDate(tenantId, date);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

    // Step 2: Check if already booked (within same transaction)
    const existing = await tx.booking.findFirst({
      where: { tenantId, date: new Date(date) },
    });
    if (existing) throw new BookingConflictError(date);

    // Step 3: Create booking (lock held until commit)
    const booking = await tx.booking.create({
      data: { tenantId, date, ... },
    });

    // Lock released on commit
    return booking;
  });
}
```

#### Detection Strategy

```bash
# Find nested $transaction calls
rg "\$transaction.*\n.*\$transaction" server/src --multiline

# Check for savepoint creation in complex operations
rg "SAVEPOINT\|savepoint" server/src --ignore-case

# Verify advisory locks are used for concurrency-critical operations
rg "pg_advisory" server/src | grep -v "test"
```

#### Code Review Checklist

When reviewing transaction code:

- [ ] Are there nested `$transaction` calls? (eliminate them)
- [ ] Do all database operations belong in one transaction?
- [ ] Are advisory locks used for concurrency-sensitive operations?
- [ ] Are error messages clear if transaction fails?
- [ ] Is the transaction as small as possible? (minimize lock duration)

### 2.3 Missing Validation in Recovery Paths

#### Anti-Pattern: Trusting Recovered Data

```typescript
// ❌ ANTI-PATTERN: No validation after recovery
async function recoverFailedProposal(proposalId: string) {
  // Get failed proposal from DB
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
  });

  // Trust the payload without re-validating
  const executor = getProposalExecutor(proposal.toolName);
  const result = await executor(proposal.tenantId, proposal.payload);
  // ↑ What if payload changed? What if executor is gone? No checks!
}
```

**Problem:** The payload was validated once (before failure). On recovery, data might be stale, executor might be missing, tenant might be deleted.

#### Solution: Full Re-Validation

```typescript
// ✅ PATTERN: Complete re-validation on recovery
async function recoverFailedProposal(proposalId: string, tenantId: string) {
  // Step 1: Fetch and basic validation
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
  });
  if (!proposal) throw new Error('Proposal not found');

  // Step 2: Verify ownership (tenant isolation)
  if (proposal.tenantId !== tenantId) {
    throw new Error('Unauthorized: proposal does not belong to tenant');
  }

  // Step 3: Verify executor exists
  const executor = getProposalExecutor(proposal.toolName);
  if (!executor) {
    throw new Error(`No executor registered for tool: ${proposal.toolName}. Check proposal type.`);
  }

  // Step 4: Re-validate payload structure
  try {
    const schema = getExecutorPayloadSchema(proposal.toolName);
    const validatedPayload = schema.parse(proposal.payload);
  } catch (error) {
    logger.error(
      { proposalId, error },
      'Payload validation failed on recovery - payload may have drifted'
    );
    throw new Error('Proposal payload is invalid (data drift). Manual review required.');
  }

  // Step 5: Check business logic (e.g., date still available)
  if (proposal.toolName === 'book_service') {
    const available = await availabilityService.checkDate(tenantId, proposal.payload.date);
    if (!available) {
      throw new Error('Recovery failed: booking date is no longer available');
    }
  }

  // Step 6: Execute
  const result = await executor(tenantId, validatedPayload);

  // Step 7: Update state
  await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      status: 'EXECUTED',
      executedAt: new Date(),
      executionResult: result,
    },
  });

  return result;
}
```

#### Critical Validation Checklist for Executors

For each executor, verify these fields on recovery:

```typescript
// In customer-booking-executor.ts
async function bookServiceExecutor(tenantId: string, payload: Record<string, unknown>) {
  // ✅ Verify all required fields exist
  const { packageId, customerId, date, notes } = payload;
  if (!packageId || !customerId || !date) {
    throw new MissingFieldError('packageId, customerId, date required');
  }

  // ✅ Verify tenant ownership of all foreign keys
  const pkg = await verifyOwnership(prisma, 'package', packageId, tenantId);
  const customer = await verifyOwnership(prisma, 'customer', customerId, tenantId);

  // ✅ Validate field types
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
  }

  // ✅ Verify business logic constraints
  const available = await availabilityService.checkDate(tenantId, date);
  if (!available) {
    throw new DateUnavailableError(date);
  }

  // ✅ Execute safely
  return await bookingService.create(tenantId, {
    packageId,
    customerId,
    date,
    notes: notes || '',
  });
}
```

#### Detection Strategy

```bash
# Find recovery or retry paths
rg "retry|recover|failed" server/src/agent --context=3

# Check if validation is done in recovery paths
rg "recoveryPath|retryProposal" server/src -A 20 | grep -E "validate|verify|parse"

# Look for missing ownership checks in executors
rg "getProposalExecutor" server/src -A 10 | grep -v "verifyOwnership"
```

#### Code Review Checklist

For recovery/retry code:

- [ ] Does recovery validate tenant ownership?
- [ ] Does recovery check if executor still exists?
- [ ] Does recovery re-validate payload schema?
- [ ] Does recovery verify business logic constraints (dates, availability)?
- [ ] Are errors logged with context but not sensitive data?
- [ ] Is there a manual review path if validation fails?

### 2.4 Information Leakage in Error Messages

#### Anti-Pattern: Exposing Internal Details

```typescript
// ❌ ANTI-PATTERN: Exposing database queries and system state
async function getBookingDetails(bookingId: string, tenantId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { package: true, customer: true },
    });

    if (!booking) {
      // LEAKAGE: Exposes database schema
      throw new Error(`Booking with ID ${bookingId} not found in Booking table`);
    }

    if (booking.tenantId !== tenantId) {
      // LEAKAGE: Confirms which IDs exist
      throw new Error(
        `Booking ${bookingId} belongs to tenant ${booking.tenantId}, not ${tenantId}`
      );
    }

    return booking;
  } catch (error) {
    // LEAKAGE: Includes full database error
    logger.error(error);
    throw new Error(`Database error: ${error.message}`);
  }
}
```

**Information disclosed:**

- Table names (Booking table)
- Which IDs exist in the database (fingerprinting)
- Tenant IDs in error messages (cross-tenant correlation)
- Full error stack traces (system internals)

#### Solution: Generic Errors with Codes

```typescript
// ✅ PATTERN: Generic user-facing errors with internal codes
async function getBookingDetails(bookingId: string, tenantId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { package: true, customer: true },
    });

    if (!booking) {
      // User: Generic message
      logger.warn({ bookingId, tenantId, code: 'BOOKING_NOT_FOUND' }, 'Booking lookup failed');
      throw new NotFoundError('ERR_BOOKING_NOT_FOUND');
    }

    if (booking.tenantId !== tenantId) {
      // User: Same generic message (prevents fingerprinting)
      logger.warn(
        {
          bookingId,
          actualTenantId: booking.tenantId,
          attemptedTenantId: tenantId,
          code: 'BOOKING_NOT_FOUND',
        },
        'Unauthorized booking access attempt'
      );
      throw new NotFoundError('ERR_BOOKING_NOT_FOUND');
    }

    return booking;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error; // Already safe
    }

    // Server error: Safe generic message
    logger.error({ error, bookingId, code: 'INTERNAL_ERROR' }, 'Database error');
    throw new InternalError('ERR_INTERNAL_SERVER_ERROR');
  }
}
```

#### Safe Error Code System

```typescript
// server/src/agent/errors.ts
export const ErrorMessages = {
  // Resource errors (no leakage of what exists/doesn't exist)
  ERR_BOOKING_NOT_FOUND: 'Booking not found or you do not have permission',
  ERR_PACKAGE_NOT_FOUND: 'Package not found or you do not have permission',
  ERR_CUSTOMER_NOT_FOUND: 'Customer not found or you do not have permission',

  // Validation errors (describe constraint, not state)
  ERR_INVALID_DATE: 'Date is invalid or in the past',
  ERR_DATE_UNAVAILABLE: 'Selected date is not available',
  ERR_INVALID_PAYLOAD: 'Request contains invalid data',

  // Authorization errors (generic)
  ERR_UNAUTHORIZED: 'You do not have permission to perform this action',

  // System errors (no details)
  ERR_INTERNAL_SERVER_ERROR: 'An internal error occurred. Contact support.',
};

// Usage in routes
try {
  const result = await service.create(tenantId, data);
  return { status: 200, body: { success: true, data: result } };
} catch (error) {
  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: { error: ErrorMessages['ERR_INVALID_PAYLOAD'] },
    };
  }
  // Don't leak error.message - use predefined codes
  logger.error({ error, context }, 'Operation failed');
  return {
    status: 500,
    body: { error: ErrorMessages['ERR_INTERNAL_SERVER_ERROR'] },
  };
}
```

#### Detection Strategy

```bash
# Find error messages with potential leakage
rg "throw new.*Error\(" server/src/agent --context=1

# Look for database table names in errors
rg "Booking table|Customer table|Package table" server/src

# Find tenant IDs in error messages
rg "tenantId.*Error|Error.*tenantId" server/src

# Check for error.message propagation
rg "error\.message" server/src | grep -v "logger\|test"
```

#### Code Review Checklist

When reviewing error handling:

- [ ] Are error messages generic (no table names, IDs, internal state)?
- [ ] Do 401/403 errors look the same for "not found" and "not authorized"?
- [ ] Are error codes enumerated in `ErrorMessages` object?
- [ ] Are detailed logs written to server (logger), not response?
- [ ] Are tenant IDs NOT included in error responses?
- [ ] Are null values handled before building error strings?

---

## Part 3: Checklist for Future Agent/Chatbot PRs

Use this checklist before submitting any PR that modifies agent features, customer tools, or orchestrators.

### Pre-Submission Checklist

#### Architecture & Dependencies

```
Circular Dependencies:
  [ ] Run: npx madge --circular --extensions ts server/src
  [ ] Verify: "No circular dependencies" in output
  [ ] Coverage: Includes all agent/*, routes/*, and executors
  [ ] Git: Clean build with npm run typecheck

Module Exports:
  [ ] Registry modules have NO imports from other agent modules
  [ ] Both consumers import from registry (not each other)
  [ ] No circular re-exports in index.ts files
  [ ] Check: npx madge --graph server/src | grep -E "circular|cycle"

TypeScript Build:
  [ ] npm run typecheck passes (all workspaces)
  [ ] No `as any` without justification comment
  [ ] No missing type declarations for middleware properties
  [ ] Express Request extensions declared in types/express.d.ts
```

#### Data Isolation & Security

```
Tenant Scoping:
  [ ] All database queries filter by tenantId
  [ ] Ownership verified: verifyOwnership(prisma, model, id, tenantId)
  [ ] Middleware injects req.tenantId - routes use it
  [ ] Search: rg "findMany|findUnique|update" server/src/agent | grep -v tenantId

Cross-Tenant Access Prevention:
  [ ] Foreign key ownership verified (packageId, customerId, etc.)
  [ ] Executors verify tenant ownership of payloads
  [ ] Recovery paths re-validate payload and ownership
  [ ] Test: Create booking in tenant A, try to access from tenant B (should fail)

Error Message Leakage:
  [ ] No table names in error messages
  [ ] No tenant IDs in error responses
  [ ] No "exists in database" confirmations
  [ ] Identical messages for "not found" and "unauthorized"
  [ ] All errors reference ErrorMessages enum
  [ ] Run: rg "throw new.*Error\(\`" server/src/agent -A 1
```

#### Proposal Execution Flow

```
Proposal Lifecycle:
  [ ] Tool creates proposal (PENDING)
  [ ] Tool returns requiresApproval flag
  [ ] If requiresApproval: proposal object in response (T3)
  [ ] If no approval: executor called immediately or soft-confirm queued (T2)
  [ ] Executor registered in registerAllExecutors()
  [ ] Executor called after CONFIRMED state

Executor Registration:
  [ ] registerProposalExecutor(toolName, executor) called
  [ ] Executor imported in executors/index.ts
  [ ] Check: ls server/src/agent/executors/ | wc -l (verify all added)
  [ ] Test: getProposalExecutor(toolName) returns defined function

Executor Payload Validation:
  [ ] Executor validates all required fields (no .payload! assumptions)
  [ ] Executor validates field types (string vs number, date format)
  [ ] Executor verifies tenant ownership of all foreign keys
  [ ] Executor checks business logic constraints (date availability, etc.)
  [ ] Executor has error handling with safe error messages

Proposal State Transitions:
  [ ] PENDING → CONFIRMED triggers executor
  [ ] CONFIRMED → EXECUTED after successful execution
  [ ] CONFIRMED → FAILED after error (error message stored)
  [ ] Stale proposals cleaned up after 24 hours
  [ ] No proposals stuck in PENDING state
```

#### Database Performance

```
Indexes:
  [ ] Multi-column queries have composite indexes
  [ ] Check: WHERE clauses with 2+ columns should have index
  [ ] Example: WHERE tenantId AND date → @@index([tenantId, date])
  [ ] Run test: npm run test:integration (verifies query performance)

Query Optimization:
  [ ] No N+1 queries (use include/select for related data)
  [ ] Availability checks use indexed queries
  [ ] Booking checks use advisory locks (concurrency safety)
  [ ] Test with explain: EXPLAIN SELECT ... in database logs

Transactions:
  [ ] Single transaction per atomic operation
  [ ] No nested $transaction calls
  [ ] Advisory locks for concurrency-sensitive operations
  [ ] Minimal transaction scope (lock duration)
```

#### React Component Patterns (Customer Chat Widget)

```
Keys:
  [ ] React keys use stable identifiers (UUIDs, IDs)
  [ ] NOT array indices: .map((item, index) => <Item key={index} />)
  [ ] NOT dynamic values: key={Date.now()} (unstable)
  [ ] Verify: rg "key={index}" apps/web/src/components/chat

Performance:
  [ ] Components memoized if rendering expensive operations
  [ ] Message list uses virtualization (not all messages rendered)
  [ ] Chat input debounced (not firing on every keystroke)
  [ ] No inline functions in renders (use useCallback)

Accessibility:
  [ ] Chat messages have semantic HTML (not just divs)
  [ ] Form inputs have labels (screen readers)
  [ ] Error messages visible and announced
  [ ] Test: npm run test:e2e with keyboard navigation
```

#### Testing

```
Unit Tests:
  [ ] Services tested with mock repositories
  [ ] Tools tested with mock tenant data
  [ ] Executors tested with successful and failed cases
  [ ] Coverage: npm run test:coverage | grep "Statements\|Branches"

Integration Tests:
  [ ] Proposal lifecycle tested end-to-end
  [ ] Tenant isolation verified (same operation, different tenants)
  [ ] Error cases tested (missing data, unauthorized access)
  [ ] Recovery paths tested (stale proposals, retries)

E2E Tests:
  [ ] Customer chat widget tested with Playwright
  [ ] Booking flow tested: search → select → confirm → receive email
  [ ] Error states tested (validation errors, server errors)
  [ ] Run: npm run test:e2e -- e2e/tests/customer-chat.spec.ts

Test Isolation:
  [ ] Each test has isolated tenant (createTestTenant)
  [ ] Test cleanup removes all tenant data
  [ ] No tests depend on other tests' data
  [ ] Test pool not exhausted (max connections respected)
```

#### Code Quality

```
ESLint:
  [ ] npm run lint passes (no warnings)
  [ ] No disabled rules (no // eslint-disable-line)
  [ ] Imports organized (absolute paths at top)
  [ ] Complexity: functions <20 lines, max nesting 3 levels

TypeScript:
  [ ] No unused variables (prefix with _ if truly unused)
  [ ] All async functions have error handling
  [ ] All promises awaited (not fire-and-forget)
  [ ] Check: npm run typecheck

Documentation:
  [ ] Functions have JSDoc comments
  [ ] Complex algorithms documented (especially locking)
  [ ] Error cases documented in comments
  [ ] Example: See customer-booking-executor.ts for good examples

Logging:
  [ ] Errors logged with context (not just message)
  [ ] Sensitive data NOT logged (passwords, emails, IDs in error paths)
  [ ] log level appropriate (error vs warn vs info)
  [ ] Example: logger.error({ bookingId, error }, 'Recovery failed')
```

#### Environment & Configuration

```
Build:
  [ ] npm run build succeeds (all workspaces)
  [ ] No TypeScript errors
  [ ] No missing dependencies
  [ ] Check environment: npm run doctor

Deployment:
  [ ] Changes work in mock mode: ADAPTERS_PRESET=mock npm run dev:api
  [ ] Changes work in real mode with test database
  [ ] Database migrations applied (if schema changes)
  [ ] Environment variables documented in .env.example
```

### Testing Verification Script

Run this before submitting PR:

```bash
#!/bin/bash
# run-checks.sh

echo "1. Circular Dependencies..."
npx madge --circular --extensions ts server/src || exit 1

echo "2. TypeScript..."
npm run typecheck || exit 1

echo "3. Lint..."
npm run lint || exit 1

echo "4. Tests..."
npm test || exit 1

echo "5. Build..."
npm run build || exit 1

echo "✅ All checks passed!"
```

### Code Review Comment Template

When reviewing agent/chatbot PRs, use this template:

```markdown
## Architecture Review

### Circular Dependencies

- [ ] No circular imports detected: `npx madge --circular`
- [ ] Registry modules have minimal imports
- [ ] Both consumers import from registry module

### Tenant Isolation

- [ ] All queries filter by tenantId
- [ ] Ownership verified for all foreign keys
- [ ] Error messages don't leak tenant/data information

### Proposal Execution

- [ ] Executor registered in registerAllExecutors()
- [ ] Executor payload fully validated
- [ ] State transitions trigger side effects
- [ ] Recovery paths re-validate everything

### Database

- [ ] Composite indexes for multi-column WHERE
- [ ] No N+1 queries
- [ ] Advisory locks for concurrency-critical ops
- [ ] Single transaction per atomic operation

### Code Quality

- [ ] No TypeScript errors
- [ ] No unused variables (or prefixed with \_)
- [ ] Error messages generic and safe
- [ ] Tests cover happy path + error cases
```

---

## Part 4: Files to Monitor

### Core Agent Files

| File                                                     | Purpose                    | Monitoring Points                   |
| -------------------------------------------------------- | -------------------------- | ----------------------------------- |
| `server/src/agent/proposals/executor-registry.ts`        | Proposal executor registry | Circular deps, no other imports     |
| `server/src/agent/executors/index.ts`                    | Executor registration      | All tools registered, no missing    |
| `server/src/agent/customer/customer-orchestrator.ts`     | Chat orchestrator          | Timeout handling, error propagation |
| `server/src/agent/customer/customer-booking-executor.ts` | Booking executor           | Ownership verification, validation  |
| `server/src/routes/agent.routes.ts`                      | Agent proposal routes      | Executor lookup, error handling     |
| `server/src/routes/public-customer-chat.routes.ts`       | Public chat API            | Tenant isolation, prompt injection  |

### Type Declaration Files

| File                               | Purpose                  | Monitoring Points                  |
| ---------------------------------- | ------------------------ | ---------------------------------- |
| `server/src/types/express.d.ts`    | Express middleware types | Custom properties declared         |
| `server/src/types/agent.ts`        | Agent types              | Tool definitions, payload schemas  |
| `packages/contracts/src/schemas/*` | API contracts            | Response schemas, validation rules |

### Database Schema

| File                          | Purpose           | Monitoring Points                |
| ----------------------------- | ----------------- | -------------------------------- |
| `server/prisma/schema.prisma` | Database schema   | New models, indexes, constraints |
| `server/prisma/migrations/`   | Migration history | Idempotent SQL, no drift         |

### Tests

| File Pattern                      | Purpose     | Monitoring Points            |
| --------------------------------- | ----------- | ---------------------------- |
| `server/src/agent/**/*.test.ts`   | Agent tests | Coverage, tenant isolation   |
| `e2e/tests/customer-chat.spec.ts` | E2E tests   | Chat flow, booking execution |

---

## Summary

This prevention strategy document provides:

1. **Framework for effective multi-agent code reviews** - Parallel agents, agent assignment, synthesis
2. **4 common patterns to watch for** - Sequential execution, nested transactions, missing validation, info leakage
3. **Comprehensive checklist for agent/chatbot PRs** - Architecture, security, database, testing
4. **Files to monitor** - Core agent modules, types, database, tests

Use this guide to prevent common issues in future agent feature development and maintain code quality standards.

**Next Steps:**

1. Add this checklist to PR template
2. Configure madge in pre-commit hook
3. Run `/workflows:review` for complex PRs
4. Add lint rules for circular dependency detection
