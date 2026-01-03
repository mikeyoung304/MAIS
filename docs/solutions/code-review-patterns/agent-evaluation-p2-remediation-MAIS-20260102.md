# Agent Evaluation P2 Remediation - 4 Critical Fixes

**Date:** 2026-01-02
**Issues:** 603, 605, 607, 608
**Status:** RESOLVED
**Commit:** fcf6004c

Four P2 (Important) security and quality issues were found in agent evaluation code and resolved. This guide documents the root causes and working solutions.

---

## Issue 603: Missing tenantId in Defense-in-Depth Query

**Severity:** P2 (Data Integrity)
**File:** `server/scripts/run-eval-batch.ts`
**Lines:** 212-218

### Root Cause

The flagged count query in the batch evaluation script did not include `tenantId` in the WHERE clause:

```typescript
// BEFORE: Missing tenantId
const flaggedCount = await prisma.conversationTrace.count({
  where: {
    id: { in: traceIds },
    flagged: true,
  },
});
```

While `traceIds` was already tenant-scoped (retrieved via `pipeline.getUnevaluatedTraces(tenant.id, ...)`), omitting `tenantId` violates the critical "defense-in-depth" pattern documented in MAIS architecture. This pattern requires that **all queries include tenantId explicitly**, even when relying on secondary filtering.

**Risk:** If traceIds array logic ever changes in the future, this query could accidentally leak cross-tenant data.

### Working Solution

Add `tenantId` explicitly to all database queries:

```typescript
// AFTER: Defense-in-depth with explicit tenantId
const flaggedCount = await prisma.conversationTrace.count({
  where: {
    tenantId: tenant.id, // Always include tenantId
    id: { in: traceIds }, // AND narrow by trace IDs
    flagged: true,
  },
});
```

**Key Pattern:**

```typescript
// ✅ CORRECT - Multi-layer filtering
const data = await prisma.model.findMany({
  where: {
    tenantId, // Primary filter (explicit)
    id: { in: filtered }, // Secondary filter (narrowing)
    status: 'active', // Business logic filter
  },
});

// ❌ WRONG - Relies only on secondary filter
const data = await prisma.model.findMany({
  where: {
    id: { in: filtered }, // Assumes IDs are pre-filtered
    status: 'active',
  },
});
```

### Why This Matters

1. **Assumptions can break:** Code that filters IDs at the application level may be refactored later
2. **Defense-in-depth:** Database layer should never trust application layer filtering alone
3. **Audit trail:** Explicit tenantId in all queries makes data isolation auditable

**Reference:** See `/docs/solutions/patterns/MAIS_CRITICAL_PATTERNS.md` - Pattern 2: "Always Include tenantId"

---

## Issue 608: CLI UUID Validation Missing

**Severity:** P2 (Security)
**File:** `server/scripts/run-eval-batch.ts`
**Lines:** 84-95

### Root Cause

The `--tenant-id` CLI argument accepted any string without validation:

```typescript
// BEFORE: No validation
} else if (arg.startsWith('--tenant-id=')) {
  const tenantId = arg.split('=')[1]?.trim();
  if (!tenantId) {
    console.error('Error: --tenant-id requires a value');
    process.exit(1);
  }
  options.tenantId = tenantId;  // No UUID check
}
```

**Problems:**

1. Malformed UUIDs silently accepted → confusing "no tenants found" message
2. Invalid input doesn't fail fast
3. No format validation at entry point

### Working Solution

Use Zod for runtime UUID validation:

```typescript
// AFTER: Zod validates UUID format
import { z } from 'zod';

} else if (arg.startsWith('--tenant-id=')) {
  const tenantId = arg.split('=')[1]?.trim();
  if (!tenantId) {
    console.error('Error: --tenant-id requires a value');
    process.exit(1);
  }

  // Validate UUID format using Zod
  const result = z.string().uuid().safeParse(tenantId);
  if (!result.success) {
    console.error('Error: --tenant-id must be a valid UUID');
    process.exit(1);
  }

  options.tenantId = result.data;  // Safe: guaranteed valid UUID
}
```

**Key Pattern - Zod for CLI Validation:**

```typescript
import { z } from 'zod';

// Define validation schema
const CliArgsSchema = z.object({
  tenantId: z.string().uuid().optional(),
  maxPerTenant: z.number().int().positive().default(50),
});

// Validate at entry point
const result = CliArgsSchema.safeParse({
  tenantId: userInput,
  maxPerTenant: 50,
});

if (!result.success) {
  console.error('Invalid CLI arguments:', result.error.flatten());
  process.exit(1);
}

const validated = result.data;
```

### Why This Matters

1. **Fail fast:** Invalid input caught immediately at entry point
2. **Clear error messages:** UUID validation error tells user exact format needed
3. **Type safety:** After validation, TypeScript knows tenantId is valid UUID
4. **Single source of truth:** Zod schema documents expected format

**Reference:** MAIS uses Zod extensively for API contract validation; apply same pattern to CLI

---

## Issue 607: Silent Test Skips Hide CI Failures

**Severity:** P2 (Quality/Testing)
**File:** `server/test/agent-eval/tenant-isolation.test.ts`
**Lines:** 36-50

### Root Cause

Tests used early returns that silently passed when the ConversationTrace table didn't exist:

```typescript
// BEFORE: Silent skip via early return
beforeEach(async () => {
  if (!tableExists) return; // Test silently passes
  // ... setup code
});

it('should NOT return traces from other tenants', async () => {
  if (!tableExists) return; // Test silently passes
  // ... actual test
});
```

**Impact:**

- CI shows "7 tests passed" even when no tests actually ran
- No visibility into test coverage gaps
- Developers may not realize tests are disabled

### Working Solution

Use Vitest's built-in `skipIf()` pattern for visible test skipping:

```typescript
// AFTER: Visible skip with skipIf()
const itIfTableExists = it.skipIf(() => !tableExists);

describe('Tenant Isolation - EvalPipeline', () => {
  beforeEach(async () => {
    if (!tableExists) return; // Guard for setup
    // ... setup code
  });

  itIfTableExists('should NOT return traces from other tenants', async () => {
    // No guard needed - skipIf handles it
    const traces = await pipeline.getUnevaluatedTraces(tenantA.id, 100);
    expect(traces).toContain(trace1.id);
    expect(traces).not.toContain(trace2.id);
  });

  itIfTableExists('should reject cross-tenant submission', async () => {
    // Test skipped if table doesn't exist
    await expect(pipeline.submit(tenantB.id, trace.id)).rejects.toThrow();
  });
});
```

**Test Output Comparison:**

```
BEFORE (Silent Pass):
 ✓ Tenant Isolation - EvalPipeline (7 tests)
 ✓ should NOT return traces from other tenants
 ✓ should return empty array when no traces exist
 ✓ should reject submission of trace from another tenant
 └─ Tests: 7 passed (7ms)

AFTER (Visible Skip):
 ↓ Tenant Isolation - EvalPipeline (7 tests)
 ↓ should NOT return traces from other tenants [skipped: ConversationTrace table not found]
 ↓ should return empty array when no traces exist [skipped: ConversationTrace table not found]
 ↓ should reject submission of trace from another tenant [skipped: ConversationTrace table not found]
 └─ Tests: 7 skipped (2ms)
```

### Key Pattern - Conditional Test Execution

```typescript
import { describe, it, beforeAll } from 'vitest';

describe('Feature Tests', () => {
  let isAvailable = false;

  beforeAll(async () => {
    // Check if feature is available
    isAvailable = await checkFeatureAvailable();
  });

  // ✅ CORRECT: Visible skip in CI output
  const itIfAvailable = it.skipIf(() => !isAvailable);

  itIfAvailable('should work with feature enabled', async () => {
    // No guard needed
    const result = await feature.execute();
    expect(result).toBeDefined();
  });

  // ❌ WRONG: Silent return hides test gap
  it('should work with feature enabled', async () => {
    if (!isAvailable) return;
    // ...
  });
});
```

### Why This Matters

1. **CI visibility:** CI output shows which tests are actually running
2. **Prevents false confidence:** "7 passed" means 7 ran, not 7 tests exist
3. **Debugging:** Easy to see "7 skipped" and know why tests didn't run
4. **Documentation:** Skip reason tells developers what's missing (migrations, config, etc.)

**Reference:** Phase 2 Testing & Caching Prevention Guide - "Retryable Keywords" section

---

## Issue 605: DI Evaluation Services Duplicated

**Severity:** P2 (Code Simplicity)
**File:** `server/src/di.ts`
**Lines:** 77-108 (helper), 329, 742 (usage)

### Root Cause

The evaluation services wiring was duplicated identically in both mock and real mode:

```typescript
// BEFORE: Mock mode (lines ~304-310)
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator();
  const pipeline = createEvalPipeline(mockPrisma, evaluator);
  const reviewQueue = createReviewQueue(mockPrisma);
  const reviewActions = createReviewActionService(mockPrisma);
  evaluation = { evaluator, pipeline, reviewQueue, reviewActions };
}

// BEFORE: Real mode (lines ~735-746) - IDENTICAL
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator();
  const pipeline = createEvalPipeline(prisma, evaluator);
  const reviewQueue = createReviewQueue(prisma);
  const reviewActions = createReviewActionService(prisma);
  evaluation = { evaluator, pipeline, reviewQueue, reviewActions };
}
```

**Problems:**

1. ~15 lines duplicated verbatim (DRY violation)
2. Hard to maintain - bug fixes must be applied twice
3. Obscures that both modes use identical logic

### Working Solution

Extract a helper function that works with any Prisma instance:

```typescript
// AFTER: Extracted helper (lines 77-108)
interface EvaluationServices {
  evaluator: ConversationEvaluator;
  pipeline: EvalPipeline;
  reviewQueue: ReviewQueue;
  reviewActions: ReviewActionService;
}

/**
 * Build evaluation services for agent quality monitoring.
 * Requires ANTHROPIC_API_KEY to be set; returns undefined if not configured.
 */
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

// USAGE - Mock mode (line 329)
const evaluation = buildEvaluationServices(mockPrisma, 'mock');

// USAGE - Real mode (line 742)
const evaluationServices = buildEvaluationServices(prisma, 'real');
```

**Key Pattern - DI Helpers**

```typescript
// ✅ CORRECT: Extract common wiring to helper function
function buildAuthServices(prisma: PrismaClient, config: Config): AuthServices | undefined {
  if (!config.JWT_SECRET) {
    logger.warn('Auth services skipped');
    return undefined;
  }

  const userRepo = new PrismaUserRepository(prisma);
  const identityService = new IdentityService(userRepo, config.JWT_SECRET);

  return { userRepo, identityService };
}

// Use in both mock and real mode
const authServices = buildAuthServices(prisma, config);

// ❌ WRONG: Duplicate wiring in multiple places
// Mock mode
if (config.JWT_SECRET) {
  const userRepo = new PrismaUserRepository(mockPrisma);
  const identityService = new IdentityService(userRepo, config.JWT_SECRET);
}

// Real mode
if (config.JWT_SECRET) {
  const userRepo = new PrismaUserRepository(prisma);
  const identityService = new IdentityService(userRepo, config.JWT_SECRET);
}
```

### Why This Matters

1. **Maintainability:** One place to fix bug affects both modes
2. **Clarity:** Helper name documents what services are being built
3. **Testability:** Helper can be tested independently
4. **Parameter consistency:** Uses dependency injection (prisma passed in), not hardcoded

**Reference:** Dependency Injection pattern in MAIS - helper functions should be parameterized

---

## Summary: 4 Fixes Applied

| Issue   | Category       | Fix                                        | Impact                              |
| ------- | -------------- | ------------------------------------------ | ----------------------------------- |
| **603** | Data Integrity | Add tenantId to query WHERE clause         | Defense-in-depth on all queries     |
| **608** | Security       | Zod UUID validation for CLI args           | Fail-fast validation at entry point |
| **607** | Testing        | Replace silent returns with `it.skipIf()`  | CI output shows which tests ran     |
| **605** | Code Quality   | Extract `buildEvaluationServices()` helper | DRY principle, easier maintenance   |

---

## How to Prevent These Issues

### 1. Defense-in-Depth Queries (Issue 603)

**Checklist:**

- [ ] Every database query includes `tenantId` in WHERE clause
- [ ] Never assume application-level filtering is sufficient
- [ ] Run lint rule: grep for queries missing tenantId

**Command:**

```bash
# Find queries that might be missing tenantId
grep -r "where: {" server/src --include="*.ts" | grep -v tenantId
```

### 2. Input Validation (Issue 608)

**Checklist:**

- [ ] All CLI arguments validated at entry point
- [ ] Use Zod schemas for format validation
- [ ] Fail fast with clear error messages
- [ ] Run tests with invalid inputs: `--tenant-id=invalid`

**Template:**

```typescript
const result = z.string().uuid().safeParse(userInput);
if (!result.success) {
  console.error(`Validation failed: ${result.error.message}`);
  process.exit(1);
}
```

### 3. Test Visibility (Issue 607)

**Checklist:**

- [ ] Use `it.skipIf()` instead of early returns
- [ ] Reason for skip is documented
- [ ] CI output shows "skipped" not "passed"
- [ ] Search for `if (!...condition) return;` in test files

**Pattern:**

```typescript
const itIfCondition = it.skipIf(() => !condition);
itIfCondition('test description', async () => {
  // No guard needed
});
```

### 4. DI Helper Functions (Issue 605)

**Checklist:**

- [ ] Identify duplicated wiring patterns
- [ ] Extract to function with signature `build*Services(prisma, mode)`
- [ ] Verify usage in both mock and real mode
- [ ] Add logging for debugging

**Pattern:**

```typescript
// Extract if used 2+ times in same file
function buildXServices(prisma: Prisma): Services | undefined {
  if (!isConfigured()) return undefined;
  // ... wiring
  return {
    /* services */
  };
}
```

---

## References

- **Commit:** `fcf6004c` - P2 remediation
- **Phase Plan:** `/plans/agent-evaluation-framework.md` Phase 4.2
- **Critical Patterns:** `/docs/solutions/patterns/MAIS_CRITICAL_PATTERNS.md`
- **Test Prevention:** `/docs/solutions/patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md`
- **Database Patterns:** `/docs/solutions/database-issues/schema-drift-prevention-MAIS-20251204.md`

---

## Verification Checklist

After applying these fixes:

```bash
# Run all tests
npm test

# Check no silent test passes
npm test 2>&1 | grep -i "silent\|return;"

# Verify CLI validates UUID
pnpm eval-batch --tenant-id=invalid 2>&1

# Type check
npm run typecheck

# Run evaluation batch in dry-run mode
ANTHROPIC_API_KEY=test pnpm eval-batch --dry-run --tenant-id=550e8400-e29b-41d4-a716-446655440000
```
