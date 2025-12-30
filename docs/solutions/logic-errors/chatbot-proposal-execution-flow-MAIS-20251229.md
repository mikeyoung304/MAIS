---
title: Chatbot Proposal Execution Flow - T2 Confirmation, Field Normalization, and Tenant Security
category: logic-errors
severity: critical
component: server/src/agent/orchestrator/orchestrator.ts
date: 2025-12-29
symptoms:
  - T2 proposals show status CONFIRMED but action never happens
  - Package prices display as "$NaN" in chatbot
  - Package names display as blank/undefined
  - Potential cross-tenant proposal execution (security)
root_cause: Multiple issues - executor not invoked after soft-confirm, field name mismatch, missing tenant validation
solution_pattern: Complete T2 execution flow with field normalization and tenant isolation
tags: [chatbot, proposals, multi-tenant, field-normalization, security, t2-tier, executor-pattern]
---

# Chatbot Proposal Execution Flow Fix

This document covers three related issues discovered during customer chatbot debugging, all affecting the proposal confirmation and execution flow.

## Issues Summary

| Issue             | Symptom                           | Severity            |
| ----------------- | --------------------------------- | ------------------- |
| T2 Not Executing  | Proposals confirmed but never run | Critical            |
| Field Mismatch    | $NaN prices, blank names          | High                |
| Tenant Validation | Missing tenantId filter           | Critical (Security) |

## Issue 1: T2 Proposals Confirmed But Never Executed

### Problem

When a customer chatbot user sends any message (not "wait"), T2 proposals should auto-confirm and execute. The `softConfirmPendingT2()` method updated status to CONFIRMED, but no code invoked the actual executor.

### Symptoms

- Database shows proposal with `status: 'CONFIRMED'`
- No "Package created via agent" log message
- Customer told booking is confirmed, but nothing created
- Manual database inspection shows no new Package/Booking records

### Root Cause

The orchestrator's `chat()` method called `softConfirmPendingT2()` but didn't have an execution loop:

```typescript
// BEFORE: Status updated but executor never called
const softConfirmedIds = await this.proposalService.softConfirmPendingT2(...);
// Missing: execution loop!
```

### Solution

Add executor invocation immediately after soft-confirm:

```typescript
// In orchestrator.ts chat() method
const softConfirmedIds = await this.proposalService.softConfirmPendingT2(
  tenantId,
  sessionId,
  userMessage
);

if (softConfirmedIds.length > 0) {
  for (const proposalId of softConfirmedIds) {
    try {
      const proposal = await this.prisma.agentProposal.findFirst({
        where: { id: proposalId, tenantId }, // See Issue 3
      });

      if (!proposal) continue;

      const executor = getProposalExecutor(proposal.toolName);
      if (!executor) {
        await this.proposalService.markFailed(proposalId, `No executor for ${proposal.toolName}`);
        continue;
      }

      const payload = (proposal.payload as Record<string, unknown>) || {};
      const result = await executor(tenantId, payload);
      await this.proposalService.markExecuted(proposalId, result);
    } catch (error) {
      await this.proposalService.markFailed(proposalId, error.message);
    }
  }
}
```

### State Machine

```
PENDING → (user doesn't say "wait") → CONFIRMED → executor() → EXECUTED
                                              ↘ (error) → FAILED
```

---

## Issue 2: Package Display Shows $NaN and Blank Names

### Problem

The chatbot displayed packages with `$NaN` prices and blank names, even though data existed in the database.

### Symptoms

- Package cards show "$NaN" for price
- Package names render as empty string
- Backend returns data but frontend renders incorrectly
- No JavaScript errors in console

### Root Cause

Field name mismatch between layers:

| Layer             | Name Field | Price Field  |
| ----------------- | ---------- | ------------ |
| Prisma Schema     | `title`    | `priceCents` |
| API Response      | `name`     | `basePrice`  |
| AI Tool Payload   | `name`     | `basePrice`  |
| Executor Expected | `title`    | `priceCents` |

The executor received `name` but looked for `title`, resulting in `undefined`.

### Solution

Accept both field names and normalize:

```typescript
// In executors/index.ts
registerProposalExecutor('upsert_package', async (tenantId, payload) => {
  const {
    title,
    name, // Accept both
    priceCents,
    basePrice, // Accept both
    // ... other fields
  } = payload as {
    /* typed */
  };

  // Normalize: new names take precedence, fall back to old
  const packageName = name || title;
  const packagePrice = basePrice ?? priceCents; // Use ?? for numbers (0 is valid)

  if (!packageName) throw new Error('Package name/title is required');
  if (packagePrice === undefined) throw new Error('Package price is required');

  // Use normalized values
  const slug = generateSlug(packageName);
  // ...
});
```

Also fix the API response mapping in `tenant-admin.routes.ts`:

```typescript
const packagesDto = packages.map((pkg) => ({
  id: pkg.id,
  name: pkg.title || pkg.name, // Map to expected field
  basePrice: pkg.priceCents ?? pkg.basePrice, // Map to expected field
  // Include both for backward compatibility
  title: pkg.title,
  priceCents: pkg.priceCents,
}));
```

### Prevention Pattern

When APIs evolve field names:

1. Accept both old and new names at input boundaries
2. Normalize to canonical names internally
3. Use `||` for strings, `??` for numbers (preserves 0)
4. Document canonical names in contracts package

---

## Issue 3: Missing Tenant Validation (P1 Security)

### Problem

Proposal lookup used `findUnique` with only the proposal ID, not filtering by tenant. An attacker could potentially execute proposals belonging to other tenants.

### Symptoms

- No immediate visible symptoms (security vulnerability)
- Proposal executes even if tenant doesn't own it
- Missing warning logs for tenant mismatches

### Root Cause

```typescript
// INSECURE: Only filters by ID
const proposal = await this.prisma.agentProposal.findUnique({
  where: { id: proposalId },
});
```

### Solution

Always include `tenantId` in the where clause:

```typescript
// SECURE: Compound filter includes tenantId
const proposal = await this.prisma.agentProposal.findFirst({
  where: {
    id: proposalId,
    tenantId, // Multi-tenant isolation
  },
});

if (!proposal) {
  logger.warn(
    { proposalId, tenantId },
    'Proposal not found or tenant mismatch - possible security issue'
  );
  continue;
}
```

### Why `findFirst` Instead of `findUnique`?

- `findUnique` only accepts fields with `@unique` constraint
- Our compound query `{ id, tenantId }` isn't a unique index
- `findFirst` supports any where clause combination
- Performance is identical when filtering by primary key + indexed field

### Prevention Pattern

For ALL tenant-scoped entity lookups:

```typescript
// ✅ CORRECT
await prisma.entity.findFirst({
  where: { id, tenantId },
});

// ❌ WRONG - Missing tenant isolation
await prisma.entity.findUnique({
  where: { id },
});
```

---

## Testing Verification

After fixes, verify with Playwright E2E:

1. **T2 Execution**: Send message after proposal created → Check DB for new record
2. **Field Display**: Package shows correct price (not $NaN) and name
3. **Tenant Isolation**: Create proposal as tenant A, attempt execution as tenant B → Should fail

```bash
# Run chatbot E2E tests
npm run test:e2e -- e2e/tests/chatbot-*.spec.ts
```

## Related Documentation

- [Circular Dependency Pattern](../patterns/circular-dependency-executor-registry-MAIS-20251229.md)
- [Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
- [MAIS Critical Patterns](../patterns/mais-critical-patterns.md)
- [Agent Tool Architecture Decision](../agent-design/AGENT-TOOL-ARCHITECTURE-DECISION-MAIS-20251228.md)

## Key Insights

`★ Insight ─────────────────────────────────────`

1. **State machines need complete transitions** - Every status change should trigger its side effects
2. **Field names evolve** - Accept both old and new at boundaries, normalize internally
3. **Multi-tenant is non-negotiable** - Every query, every time, filter by tenantId
   `─────────────────────────────────────────────────`
