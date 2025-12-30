---
module: MAIS
date: 2025-12-29
problem_type: architecture_issue
component: agent/proposals
symptoms:
  - Circular dependencies between agent.routes.ts and executors/index.ts
  - T2 proposals confirm but executors never called
  - Proposal not passed from orchestrator to frontend
  - Package display shows $NaN and blank names
root_cause: Missing execution bridge, circular imports, field mapping mismatch
resolution_type: prevention_strategy
severity: P1
tags: [circular-dependencies, proposal-execution, field-mapping, agent-architecture]
---

# Chatbot Proposal Execution Prevention Strategies

**Purpose:** Prevent 4 critical issues discovered during chatbot debugging: circular dependencies, missing proposal execution, proposal passthrough failure, and field mapping mismatches.

**Date Solved:** 2025-12-29

**Impact:** These issues caused complete failure of both customer and admin chatbot booking/package workflows.

---

## Issue 1: Circular Dependencies in Executor Registry

### Problem

Circular dependency between:

- `agent.routes.ts` → imports `AgentOrchestrator`
- `orchestrator.ts` → needs `getProposalExecutor()`
- `executors/index.ts` → imports `registerProposalExecutor` from `agent.routes.ts`

This caused runtime errors or undefined exports depending on import order.

### Root Cause

The executor registry was defined in `agent.routes.ts` (a route file) but needed by `orchestrator.ts` (core business logic), creating a dependency cycle.

### Solution Implemented

Extract executor registry to dedicated module:

```typescript
// server/src/agent/proposals/executor-registry.ts
export type ProposalExecutor = (
  tenantId: string,
  payload: Record<string, unknown>
) => Promise<Record<string, unknown>>;

const proposalExecutors = new Map<string, ProposalExecutor>();

export function registerProposalExecutor(toolName: string, executor: ProposalExecutor): void {
  proposalExecutors.set(toolName, executor);
}

export function getProposalExecutor(toolName: string): ProposalExecutor | undefined {
  return proposalExecutors.get(toolName);
}

export function hasProposalExecutor(toolName: string): boolean {
  return proposalExecutors.has(toolName);
}
```

### Prevention Checklist

- [ ] **Registry Pattern:** Shared state used by multiple modules should be in dedicated registry file
- [ ] **Import Direction:** Routes should import from services, never the reverse
- [ ] **Module Placement:** Core business logic goes in `lib/` or `services/`, never in `routes/`
- [ ] **Detection:** Before adding imports, trace the import graph to detect cycles

### Automated Checks

```bash
# ESLint rule to detect circular imports
# Add to .eslintrc.json:
{
  "rules": {
    "import/no-cycle": ["error", { "maxDepth": 5 }]
  }
}

# Manual detection script
npx madge --circular server/src/
```

### Test Pattern

```typescript
describe('Executor Registry', () => {
  it('should allow registration and retrieval without circular deps', async () => {
    // Dynamic import to test module resolution
    const { registerProposalExecutor, getProposalExecutor } = await import(
      '../proposals/executor-registry'
    );

    const mockExecutor = async () => ({ success: true });
    registerProposalExecutor('test_tool', mockExecutor);

    expect(getProposalExecutor('test_tool')).toBe(mockExecutor);
  });
});
```

---

## Issue 2: T2 Proposal Soft-Confirm Without Execution

### Problem

T2 proposals were being confirmed via `softConfirmPendingT2()` when users sent follow-up messages, but:

1. Proposal status updated to CONFIRMED
2. **Executor was never called**
3. Database operation never happened

### Root Cause

The soft-confirm flow updated status but had no bridge to call the registered executor function.

### Solution Implemented

Add executor invocation loop after soft-confirmation:

```typescript
// orchestrator.ts - After softConfirmPendingT2()
if (softConfirmedIds.length > 0) {
  logger.info(
    { tenantId, sessionId, proposalIds: softConfirmedIds },
    'T2 proposals soft-confirmed'
  );

  // Execute each soft-confirmed proposal
  for (const proposalId of softConfirmedIds) {
    try {
      // CRITICAL: Filter by tenantId to prevent cross-tenant execution
      const proposal = await this.prisma.agentProposal.findFirst({
        where: { id: proposalId, tenantId },
      });

      if (!proposal) {
        logger.warn({ proposalId, tenantId }, 'Proposal not found or tenant mismatch');
        continue;
      }

      const executor = getProposalExecutor(proposal.toolName);
      if (!executor) {
        logger.error({ proposalId, toolName: proposal.toolName }, 'No executor registered');
        await this.proposalService.markFailed(proposalId, `No executor for ${proposal.toolName}`);
        continue;
      }

      const payload = (proposal.payload as Record<string, unknown>) || {};
      const result = await executor(tenantId, payload);
      await this.proposalService.markExecuted(proposalId, result);

      logger.info({ proposalId, toolName: proposal.toolName }, 'T2 proposal executed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ proposalId, error: errorMessage }, 'Failed to execute proposal');
      await this.proposalService.markFailed(proposalId, errorMessage);
    }
  }
}
```

### Prevention Checklist

When adding new trust tiers or state transitions:

- [ ] **State Machine Complete:** Every state transition has associated side effects documented
- [ ] **Executor Registration:** Verify executor exists for tool at startup
- [ ] **Status Updates:** After CONFIRMED, must call executor before EXECUTED
- [ ] **Error Handling:** Failed executions must update status with error reason
- [ ] **Multi-Tenant:** Executor receives `tenantId` as first parameter

### Automated Checks

```typescript
// Add to server startup (di.ts or index.ts)
import { getRegisteredExecutors } from './agent/proposals/executor-registry';

const REQUIRED_EXECUTORS = ['upsert_package', 'delete_package', 'book_service'];

function validateExecutorRegistration(): void {
  const registered = getRegisteredExecutors();
  const missing = REQUIRED_EXECUTORS.filter((t) => !registered.includes(t));

  if (missing.length > 0) {
    throw new Error(`Missing proposal executors: ${missing.join(', ')}`);
  }

  logger.info({ executors: registered }, 'All proposal executors registered');
}
```

### Test Pattern

```typescript
describe('T2 Soft-Confirm Flow', () => {
  it('should execute proposal after soft-confirmation', async () => {
    // Setup
    const executorMock = vi.fn().mockResolvedValue({ success: true });
    registerProposalExecutor('upsert_package', executorMock);

    // Create T2 proposal
    const proposal = await proposalService.create({
      tenantId,
      sessionId,
      toolName: 'upsert_package',
      payload: { title: 'Test Package', priceCents: 10000 },
      trustTier: 'T2',
    });

    // Simulate follow-up message (triggers soft-confirm)
    await orchestrator.chat(tenantId, sessionId, 'Yes, please create it');

    // Assert executor was called
    expect(executorMock).toHaveBeenCalledWith(tenantId, expect.objectContaining({
      title: 'Test Package',
    }));

    // Assert status is EXECUTED
    const updated = await proposalService.getById(proposal.id);
    expect(updated.status).toBe('EXECUTED');
  });

  it('should mark proposal as FAILED if executor throws', async () => {
    registerProposalExecutor('upsert_package', async () => {
      throw new Error('Database error');
    });

    const proposal = await proposalService.create({ ... });
    await orchestrator.chat(tenantId, sessionId, 'Continue');

    const updated = await proposalService.getById(proposal.id);
    expect(updated.status).toBe('FAILED');
    expect(updated.errorMessage).toContain('Database error');
  });
});
```

---

## Issue 3: Proposal Not Passed to Frontend (T3 Customer Bookings)

### Problem

Customer chatbot `book_service` tool created T3 proposals correctly, but:

1. Proposal object never appeared in API response
2. Frontend `setPendingProposal()` never called
3. Confirmation UI never rendered

### Root Cause

Tool execution captured proposal, but orchestrator didn't include it in the returned response object.

### Solution Implemented

Add debug logging and ensure proposal passthrough:

```typescript
// customer-orchestrator.ts - In processToolUse()
if (result.proposalId && result.requiresApproval) {
  proposal = {
    proposalId: result.proposalId,
    operation: result.operation,
    preview: result.preview,
    trustTier: result.trustTier,
    requiresApproval: result.requiresApproval,
  };

  // DEBUG: Trace proposal capture
  logger.debug(
    {
      toolName: toolUse.name,
      proposalId: result.proposalId,
      requiresApproval: result.requiresApproval,
    },
    'Proposal captured from tool result'
  );
}
```

### Prevention Checklist

- [ ] **Response Contract:** API response type includes `proposal?: WriteToolProposal`
- [ ] **Tool Result Check:** After tool execution, check for `proposalId` and `requiresApproval`
- [ ] **Debug Logging:** Log proposal at capture point, response construction, and frontend receipt
- [ ] **E2E Test:** Verify proposal appears in network response

### Test Pattern

```typescript
describe('Customer Chat Proposal Response', () => {
  it('should include proposal in response when book_service requires approval', async () => {
    const response = await request(app)
      .post('/v1/public/chat/message')
      .set('X-Tenant-Key', testTenantKey)
      .send({ message: 'Book Photo Session for Jan 15, john@test.com' });

    expect(response.body.proposal).toBeDefined();
    expect(response.body.proposal.requiresApproval).toBe(true);
    expect(response.body.proposal.proposalId).toBeDefined();
    expect(response.body.proposal.trustTier).toBe('T3');
  });
});
```

---

## Issue 4: Field Name Mapping Mismatch (Package Display)

### Problem

Package cards displayed:

- Blank where name should be
- `$NaN` instead of formatted price
- All packages marked "Inactive"

### Root Cause

API returned different field names than frontend expected:

| API Returns  | Frontend Expects |
| ------------ | ---------------- |
| `title`      | `name`           |
| `priceCents` | `basePrice`      |

### Solution Implemented

Update DTO mapping to include both names for backward compatibility:

```typescript
// tenant-admin.routes.ts
const packagesDto = packages.map((pkg) => ({
  id: pkg.id,
  slug: pkg.slug,
  // Map to frontend-expected field names
  name: pkg.title || pkg.name,
  basePrice: pkg.priceCents ?? pkg.basePrice,
  // Also include original names for backward compatibility
  title: pkg.title,
  priceCents: pkg.priceCents,
  description: pkg.description,
  // ... other fields
}));
```

And update executor to accept both field names:

```typescript
// executors/index.ts - upsert_package
const {
  title,
  name,
  priceCents,
  basePrice,
  // ...
} = payload;

// Normalize field names (name takes precedence)
const packageName = name || title;
const packagePrice = basePrice ?? priceCents;

if (!packageName) throw new Error('Package name/title is required');
if (packagePrice === undefined) throw new Error('Package price is required');
```

### Prevention Checklist

- [ ] **DTO Contract:** Define canonical field names in `packages/contracts/src/dto.ts`
- [ ] **Mapper Pattern:** Use explicit mapper functions, not inline transformations
- [ ] **Field Documentation:** Document field name mappings in ADR
- [ ] **TypeScript Types:** Frontend and backend share types from contracts package

### Best Practices

```typescript
// packages/contracts/src/dto.ts - Single source of truth
export interface PackageDto {
  id: string;
  name: string; // Canonical name
  basePrice: number; // Canonical price (in cents)
  // ... other fields
}

// server/src/routes/tenant-admin.routes.ts - Explicit mapper
function toPackageDto(pkg: DbPackage): PackageDto {
  return {
    id: pkg.id,
    name: pkg.name, // Always use canonical name
    basePrice: pkg.basePrice, // Always use canonical price
  };
}

// Frontend uses same interface from contracts
import { PackageDto } from '@macon/contracts';
```

### Automated Checks

```bash
# Grep for field name inconsistencies
rg 'title:.*pkg\.(name|title)' server/src/
rg 'priceCents:.*pkg\.(basePrice|priceCents)' server/src/
```

---

## Prevention Summary

### Circular Dependencies

| What to Check      | How to Check                        | Automated?  |
| ------------------ | ----------------------------------- | ----------- |
| Import cycles      | `npx madge --circular server/src/`  | Yes         |
| Registry placement | Review `routes/` for shared state   | Code review |
| Import direction   | Routes import services, not reverse | ESLint rule |

### Proposal Execution

| What to Check         | How to Check                 | Automated?  |
| --------------------- | ---------------------------- | ----------- |
| Executor registration | Startup validation           | Yes         |
| Status → Side Effect  | State machine review         | Code review |
| Error handling        | Unit tests for failure paths | Yes         |

### Field Mapping

| What to Check          | How to Check                | Automated?  |
| ---------------------- | --------------------------- | ----------- |
| DTO consistency        | TypeScript compilation      | Yes         |
| Canonical names        | Contracts package as source | Code review |
| Backward compatibility | Integration tests           | Yes         |

### Multi-Tenant Security

| What to Check                     | How to Check        | Automated?  |
| --------------------------------- | ------------------- | ----------- |
| Executor receives tenantId        | Type signature      | Yes         |
| Proposal lookup includes tenantId | WHERE clause review | Code review |
| Cross-tenant execution prevention | Integration tests   | Yes         |

---

## Quick Reference Checklist

Before submitting PR involving proposal/executor changes:

- [ ] No circular dependencies (`npx madge --circular`)
- [ ] Executor registered at startup for all tools
- [ ] State transitions trigger side effects
- [ ] Proposal included in API response for T3 tools
- [ ] DTO uses canonical field names from contracts
- [ ] Executor accepts both old and new field names (backward compat)
- [ ] All queries include `tenantId` filter
- [ ] Integration test covers full proposal lifecycle

---

## Related Documents

- [Agent Tool Architecture Prevention Strategies](./AGENT-TOOL-ARCHITECTURE-PREVENTION-STRATEGIES-MAIS-20251228.md)
- [MAIS Critical Patterns](../patterns/mais-critical-patterns.md)
- [Prevention Strategies Index](../PREVENTION-STRATEGIES-INDEX.md)

---

**Last Updated:** 2025-12-29
**Maintainer:** Compound Engineering Workflow
