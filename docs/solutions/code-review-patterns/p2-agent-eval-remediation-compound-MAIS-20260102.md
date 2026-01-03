---
title: 'P2 Agent Evaluation Remediation - Compound Engineering Documentation'
date: '2026-01-02'
category: 'code-review-patterns'
tags:
  - multi-tenant-isolation
  - defense-in-depth
  - input-validation
  - test-visibility
  - dependency-injection
  - agent-evaluation
  - vitest-patterns
  - zod-validation
severity: p2
components:
  - server/scripts/run-eval-batch.ts
  - server/src/di.ts
  - server/test/agent-eval/tenant-isolation.test.ts
problem_type:
  - tenant-isolation-gaps
  - input-validation-missing
  - test-observability
  - code-duplication
commit: fcf6004c
---

# P2 Agent Evaluation Remediation

## Summary

Four P2 issues fixed in commit `fcf6004c` establishing defensive patterns for the agent evaluation system:

| Issue | Problem                                | Solution                     | Pattern          |
| ----- | -------------------------------------- | ---------------------------- | ---------------- |
| 603   | Flagged count query missing tenantId   | Add tenantId to WHERE clause | Defense-in-depth |
| 608   | CLI --tenant-id accepts invalid UUIDs  | Zod UUID validation          | Input validation |
| 607   | Tests silently pass when table missing | `it.skipIf()` pattern        | Test visibility  |
| 605   | DI evaluation code duplicated          | Extract helper function      | DRY principle    |

---

## Issue 603: Missing tenantId in Query (Defense-in-Depth)

### Root Cause

The flagged count query filtered by `id: { in: traceIds }` but omitted `tenantId`. While `traceIds` were already tenant-scoped from a previous query, this violates defense-in-depth principles.

### Risk

If the `traceIds` filtering logic ever changes or has a bug, cross-tenant data could leak.

### Solution

Always include `tenantId` in queries, even when other filters seem sufficient:

```typescript
// BEFORE - Missing tenantId
const flaggedCount = await prisma.conversationTrace.count({
  where: {
    id: { in: traceIds },
    flagged: true,
  },
});

// AFTER - Defense-in-depth
const flaggedCount = await prisma.conversationTrace.count({
  where: {
    tenantId: tenant.id, // Always include
    id: { in: traceIds },
    flagged: true,
  },
});
```

### Why This Matters

This follows the MAIS critical pattern: **ALL database queries MUST be scoped by tenantId**. Even redundant scoping prevents catastrophic data leaks if upstream logic changes.

**File:** `server/scripts/run-eval-batch.ts:212-218`

---

## Issue 608: Invalid CLI Input (Zod Validation)

### Root Cause

The `--tenant-id` CLI argument was parsed without validation:

```typescript
// BEFORE - No validation
options.tenantId = arg.split('=')[1];
```

Malformed UUIDs silently passed through, causing confusing "no tenants found" errors deep in execution.

### Solution

Use Zod for runtime UUID validation at the entry point:

```typescript
import { z } from 'zod';

// In parseArgs function
} else if (arg.startsWith('--tenant-id=')) {
  const tenantId = arg.split('=')[1]?.trim();
  if (!tenantId) {
    console.error('Error: --tenant-id requires a value');
    process.exit(1);
  }
  const result = z.string().uuid().safeParse(tenantId);
  if (!result.success) {
    console.error('Error: --tenant-id must be a valid UUID');
    process.exit(1);
  }
  options.tenantId = result.data;
}
```

### Why This Matters

- **Fail fast**: Invalid input caught at entry, not deep in execution
- **Clear errors**: User sees "must be valid UUID" not cryptic DB errors
- **Type safety**: `result.data` is guaranteed to be valid UUID

**File:** `server/scripts/run-eval-batch.ts:84-96`

---

## Issue 607: Silent Test Skips (Vitest skipIf Pattern)

### Root Cause

Tests used early return guards that silently passed:

```typescript
// BEFORE - Silent pass (7 occurrences)
it('should NOT return traces from other tenants', async () => {
  if (!tableExists) return; // Silently passes!
  // ... test code
});
```

CI showed "7 passed" even when no tests actually executed - false confidence about coverage.

### Solution

Use Vitest's `it.skipIf()` for visible conditional skipping:

```typescript
/**
 * Helper to conditionally run tests based on table existence.
 * Issue 607: Replaces silent guards with visible skipIf pattern.
 *
 * Test output:
 * - Table exists: "✓ should NOT return traces from other tenants"
 * - Table missing: "↓ should NOT return traces from other tenants [skipped]"
 */
const itIfTableExists = it.skipIf(() => !tableExists);

// Usage - no guard needed inside test
itIfTableExists('should NOT return traces from other tenants', async () => {
  // ... test code runs only if table exists
});
```

### Why This Matters

- **Visibility**: Skipped tests appear as skipped, not passed
- **CI clarity**: See exactly what ran vs. what was skipped
- **No false confidence**: Can't mistake skipped tests for coverage

**File:** `server/test/agent-eval/tenant-isolation.test.ts:28-36`

---

## Issue 605: Duplicated DI Code (Extract Helper)

### Root Cause

Evaluation services initialization was duplicated between mock and real mode (~40 lines identical):

```typescript
// Mock mode (lines ~293-313)
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator();
  const pipeline = createEvalPipeline(mockPrisma, evaluator);
  // ... identical setup
}

// Real mode (lines ~724-749)
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator();
  const evalPipeline = createEvalPipeline(prisma, evaluator);
  // ... identical setup
}
```

### Solution

Extract a shared helper function:

```typescript
// Evaluation Services DI Helper (Issue 605)
interface EvaluationServices {
  evaluator: ConversationEvaluator;
  pipeline: EvalPipeline;
  reviewQueue: ReviewQueue;
  reviewActions: ReviewActionService;
}

function buildEvaluationServices(
  prisma: PrismaClient,
  mode: 'mock' | 'real'
): EvaluationServices | undefined {
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.info('⚠️  Agent evaluation services skipped (ANTHROPIC_API_KEY not set)');
    return undefined;
  }

  const evaluator = createEvaluator();
  const pipeline = createEvalPipeline(prisma, evaluator);
  const reviewQueue = createReviewQueue(prisma);
  const reviewActions = createReviewActionService(prisma);

  logger.info(`${mode === 'mock' ? '🧪' : '🤖'} Agent evaluation services initialized`);
  return { evaluator, pipeline, reviewQueue, reviewActions };
}

// Usage
const evaluation = buildEvaluationServices(mockPrisma, 'mock'); // Mock mode
const evaluationServices = buildEvaluationServices(prisma, 'real'); // Real mode
```

### Why This Matters

- **Single source of truth**: Bug fixes apply once
- **Consistent logging**: Both modes log identically
- **Easier testing**: Can mock the helper function
- **Clear intent**: Function name documents purpose

**File:** `server/src/di.ts:76-108`

---

## Prevention Checklist

### For Every Database Query

- [ ] `tenantId` in WHERE clause (even if other filters exist)
- [ ] Using repository interface (requires tenantId as first param)
- [ ] No raw Prisma without tenant scoping

### For CLI Scripts

- [ ] All string inputs validated with Zod schemas
- [ ] UUIDs use `z.string().uuid()`
- [ ] Clear error messages on validation failure
- [ ] `process.exit(1)` on invalid input

### For Test Files

- [ ] No `if (condition) return;` inside test bodies
- [ ] Use `it.skipIf()` or `describe.skipIf()` for conditionals
- [ ] Skipped tests visible in CI output
- [ ] Helper like `itIfCondition` for reusable patterns

### For DI Container

- [ ] No duplicate initialization blocks between modes
- [ ] Shared logic extracted to helper functions
- [ ] Helper functions take `mode` parameter if behavior differs
- [ ] Single logging statement per service initialization

---

## Code Review Questions

When reviewing agent-eval code, ask:

1. **Queries**: "Does every WHERE clause include tenantId?"
2. **CLI**: "Are all string inputs validated with Zod?"
3. **Tests**: "Would I see this test as skipped if the condition fails?"
4. **DI**: "Is this initialization logic duplicated elsewhere?"

---

## Verification Commands

```bash
# Typecheck passes
npm run typecheck

# All tests pass (2126 passed, 14 skipped)
cd server && npm test

# Verify commit
git log -1 --oneline
# fcf6004c fix(agent-eval): P2 remediation...
```

---

## Cross-References

### Core Patterns

- [mais-critical-patterns.md](../patterns/mais-critical-patterns.md) - Pattern 1: Multi-Tenant Query Isolation
- [agent-evaluation-remediation-prevention-MAIS-20260102.md](../patterns/agent-evaluation-remediation-prevention-MAIS-20260102.md) - P1 remediation patterns
- [express-route-ordering-auth-fallback-security-MAIS-20260102.md](./express-route-ordering-auth-fallback-security-MAIS-20260102.md) - Defense-in-depth patterns

### Testing Patterns

- [phase-5-testing-and-caching-prevention-MAIS-20251231.md](../patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md) - Test visibility patterns

### CLAUDE.md Sections

- "Multi-Tenant Data Isolation" - tenantId requirements
- "Common Pitfalls" #20 - Retryable keywords in tests
- "Prevention Strategies" - Agent-eval patterns

---

## Key Insight

> **Defense-in-depth isn't paranoia - it's engineering discipline.**
>
> The tenantId was "redundant" because traceIds were already scoped. But code changes. People forget context. A redundant check today prevents a P0 security incident tomorrow.

---

_Documented via /workflows:compound on 2026-01-02_
