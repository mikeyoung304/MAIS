---
module: MAIS
date: 2026-01-02
problem_type: prevention_strategies
component: agent-evaluation
severity: P2
tags: [prevention, agent-eval, code-quality, security, testing, cli]
related_issues: [603, 604, 605, 606, 607, 608]
---

# P2 Agent Evaluation Prevention Strategies

**Scope:** 6 P2 issues from agent-eval code review (commits: fcf6004c)
**Impact:** Data integrity, security, code quality, and testing visibility
**Read Time:** 15 minutes
**Target Audience:** Engineers writing agent evaluation features and CLI scripts

---

## Overview

The P2 agent evaluation issues reveal four **recurring patterns** that compound:

1. **Missing tenantId in queries** (Issue 603) - Data integrity + security
2. **Invalid CLI input without validation** (Issue 608, 606) - Security + UX
3. **Duplicated initialization code** (Issue 605) - Code simplicity + maintainability
4. **Silent test skips** (Issue 607) - Testing visibility + reliability

These are **not one-off bugs**—they're patterns that will repeat unless prevented at the code review level.

---

## Pattern 1: Missing tenantId in Queries

### Issue 603: Flagged Count Query

**Problem:**

```typescript
// ❌ WRONG - Missing tenantId despite defense-in-depth rule
const flaggedCount = await prisma.conversationTrace.count({
  where: {
    id: { in: traceIds }, // Already filtered by tenant
    flagged: true,
  },
});
```

**Why It's Wrong:**

- Violates "always include tenantId" rule from `mais-critical-patterns.md`
- Even though `traceIds` are tenant-scoped, the query itself ignores tenant context
- If a bug accidentally includes traces from another tenant, this query exposes them
- Creates a hidden security surface area

**The Fix:**

```typescript
// ✅ CORRECT - Defense-in-depth: include tenantId even with filtered IDs
const flaggedCount = await prisma.conversationTrace.count({
  where: {
    tenantId: tenant.id, // Always include
    id: { in: traceIds }, // Then add secondary filters
    flagged: true,
  },
});
```

### Code Review Checklist

When reviewing any database query, add to pull request checklist:

```
DATABASE QUERIES - MANDATORY CHECKS

For all Prisma queries (findMany, findFirst, findUnique, count, etc.):

□ tenantId APPEARS as first WHERE condition (even if already filtered elsewhere)
□ No queries like findUnique({ where: { id } }) - must include tenantId check
□ Compound queries verify ownership:
  - Check trace exists AND tenant owns it
  - Throw TenantAccessDeniedError if not
□ Git diff shows WHERE clause order: tenantId first
□ Comment added if tenantId is NOT in query (and why exception is safe)

Pattern check:
  where: {
    tenantId,              ← Always here, always first
    id: { in: [...] },     ← Then secondary filters
    fieldName: value,      ← Then specific conditions
  }
```

### File Locations to Check

- **Scripts:** `server/scripts/run-eval-batch.ts` (lines 200-220)
- **Services:** `server/src/agent/evals/pipeline.ts` (all count/find methods)
- **Repositories:** `server/src/adapters/prisma/*` (all methods)
- **Tests:** `server/test/agent-eval/tenant-isolation.test.ts`

### Pattern for Compound Queries

```typescript
// When checking if a trace exists AND belongs to tenant:

// ❌ WRONG - Two separate queries
const trace = await prisma.conversationTrace.findFirst({
  where: { id: traceId },
});
if (!trace) throw new TraceNotFoundError(traceId);
// Doesn't verify tenant ownership

// ✅ CORRECT - Single query with ownership verification
const trace = await prisma.conversationTrace.findFirst({
  where: {
    id: traceId,
    tenantId, // Verify ownership in WHERE clause
  },
});
if (!trace) {
  throw new TenantAccessDeniedError(tenantId, traceId);
}
```

---

## Pattern 2: Invalid CLI Input Without Validation

### Issue 608: tenantId Validation + Issue 606: Manual Arg Parsing

**Problem:**

```typescript
// ❌ WRONG - Multiple issues combined
function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { maxPerTenant: 50, dryRun: false };

  for (const arg of args) {
    if (arg.startsWith('--tenant-id=')) {
      options.tenantId = arg.split('=')[1]?.trim(); // No validation!
      // Empty string passes through
      // Invalid UUIDs silently fail later with confusing error
    }
  }
  return options;
}
```

**Real Issues:**

1. `--tenant-id=` (no value) results in empty string stored silently
2. `--tenant-id=not-a-uuid` causes confusing "no tenants found" message
3. Hand-rolled arg parsing (40+ lines) for 4 flags is unmaintainable
4. Invalid values not caught until runtime

**Current Fix (Already Applied):**

```typescript
// ✅ CORRECT - Using Node's built-in parseArgs + Zod validation
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    'tenant-id': { type: 'string' },
    'max-per-tenant': { type: 'string', default: '50' },
    'dry-run': { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '5' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

// Validation with Zod
const tenantId = values['tenant-id'];
if (tenantId) {
  const result = z.string().uuid().safeParse(tenantId);
  if (!result.success) {
    console.error('Error: --tenant-id must be a valid UUID');
    process.exit(1);
  }
  options.tenantId = result.data;
}
```

### CLI Validation Pattern for New Scripts

When creating a CLI script, follow this pattern:

```typescript
import { parseArgs } from 'node:util';
import { z } from 'zod';

// 1. Define schema (type-safe, reusable)
const CliSchema = z.object({
  tenantId: z.string().uuid().optional(),
  maxPerTenant: z.coerce.number().int().positive().default(50),
  dryRun: z.boolean().default(false),
  concurrency: z.coerce.number().int().min(1).max(20).default(5),
  help: z.boolean().default(false),
});

type CliOptions = z.infer<typeof CliSchema>;

// 2. Parse with Node's built-in
function parseArgs(args: string[]): CliOptions {
  const { values } = parseArgs({
    options: {
      'tenant-id': { type: 'string' },
      'max-per-tenant': { type: 'string', default: '50' },
      'dry-run': { type: 'boolean' },
      concurrency: { type: 'string', default: '5' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  // 3. Validate with Zod (catches all errors upfront)
  const result = CliSchema.safeParse({
    tenantId: values['tenant-id'],
    maxPerTenant: values['max-per-tenant'],
    dryRun: values['dry-run'],
    concurrency: values['concurrency'],
    help: values.help,
  });

  if (!result.success) {
    console.error('Invalid arguments:');
    result.error.errors.forEach((e) => {
      console.error(`  ${e.path.join('.')}: ${e.message}`);
    });
    process.exit(1);
  }

  return result.data;
}
```

### CLI Argument Validation Checklist

When adding CLI options:

```
CLI ARGUMENT VALIDATION

□ Use Node's built-in parseArgs (not hand-rolled loop)
□ Define Zod schema for all options (type-safe defaults)
□ All required options parsed from environment or CLI
□ Options with constraints use Zod (.uuid(), .positive(), .max(), etc.)
□ Validation errors print detailed message + exit code 1
□ Help text includes all options with examples
□ Environment variables checked as fallback for sensitive args

Example:
  --tenant-id      UUID validation
  --max-per-tenant Integer > 0
  --concurrency    Integer 1-20
  --dry-run        Boolean flag

Errors caught before execution:
  ✅ Empty value: --tenant-id=
  ✅ Wrong format: --tenant-id=not-a-uuid
  ✅ Out of range: --concurrency=50 (max 20)
  ✅ Type mismatch: --max-per-tenant=abc (expects number)
```

### File Locations

- **Template:** `server/scripts/run-eval-batch.ts` (already fixed)
- **Pattern:** Lines 67-100 (parseArgs function)
- **Schema:** Lines 56-61 (CliOptions interface)

---

## Pattern 3: Duplicated Initialization Code

### Issue 605: DI Evaluation Services Duplication

**Problem:**

```typescript
// Mock mode (lines 304-310)
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator();
  const pipeline = createEvalPipeline(mockPrisma, evaluator);
  const reviewQueue = createReviewQueue(mockPrisma);
  const reviewActions = createReviewActionService(mockPrisma);
  evaluation = { evaluator, pipeline, reviewQueue, reviewActions };
}

// Real mode (lines 735-746) - IDENTICAL CODE
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator(); // Duplicated
  const pipeline = createEvalPipeline(prisma, evaluator); // Only prisma param changes
  const reviewQueue = createReviewQueue(prisma);
  const reviewActions = createReviewActionService(prisma);
  evaluation = { evaluator, pipeline, reviewQueue, reviewActions };
}
```

**Why It's a Problem:**

- 15+ lines duplicated between two locations
- Bug in one copy doesn't get fixed in the other
- Makes code harder to understand (what's the difference?)
- SOLID principle violation (DRY - Don't Repeat Yourself)
- Future changes need double edits

**The Fix (Already Applied):**

```typescript
// ✅ CORRECT - Extract helper function
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

  return { evaluator, pipeline, reviewQueue, reviewActions };
}

// Usage
const evaluation = buildEvaluationServices(mockPrisma, 'mock');
const evaluation = buildEvaluationServices(prisma, 'real');
```

### Duplication Detection Patterns

**Pattern 1: Identical blocks in mock vs real mode**

```typescript
// ❌ WRONG
if (adapterMode === 'mock') {
  service = createMockService(...);
  const result = service.configure(...);
  container.services.push(result);
}

if (adapterMode === 'real') {
  service = createRealService(...);  // SAME NEXT 2 LINES
  const result = service.configure(...);
  container.services.push(result);
}

// ✅ CORRECT
function configureService(service: Service): void {
  const result = service.configure(...);
  container.services.push(result);
}

const service = adapterMode === 'mock' ? createMockService(...) : createRealService(...);
configureService(service);
```

**Pattern 2: Conditional block same in multiple places**

```typescript
// ❌ WRONG - Same config block in 3 places
function setupA() {
  if (process.env.API_KEY) {
    client = new Client({ apiKey: process.env.API_KEY });
    client.authenticate();
    state.client = client;
  }
}

function setupB() {
  if (process.env.API_KEY) {
    client = new Client({ apiKey: process.env.API_KEY });
    client.authenticate();
    state.client = client;
  }
}

// ✅ CORRECT
function initializeClient(): Client | undefined {
  if (!process.env.API_KEY) return undefined;

  const client = new Client({ apiKey: process.env.API_KEY });
  client.authenticate();
  return client;
}

state.client = initializeClient();
// (use in setupA and setupB)
```

### Code Duplication Checklist

When writing DI or initialization code:

```
DUPLICATION PREVENTION

□ Scan entire di.ts file for similar blocks
□ Check both mock and real mode sections
□ If same logic appears 2+ times, extract function
□ Function naming: buildX, createX, initializeX, setupX
□ Parameterize differences (prisma instance, mode string, etc.)
□ Test extracted function in isolation
□ Use shell command to find patterns:
  grep -n "const evaluator = createEvaluator" server/src/di.ts
  (should appear 1 time after refactor)

Extracted function checklist:
□ Captured all configuration logic
□ Environment checks still perform early returns
□ Return type is clear (e.g., EvaluationServices | undefined)
□ All callers updated to use helper
□ Old code blocks deleted
```

### ESLint Rule to Detect Duplication

Consider adding to ESLint config:

```javascript
// eslint.config.js
{
  rules: {
    // Detect similar code blocks in same file
    'no-duplicate-string': ['warn', { threshold: 3 }],

    // Flag repeated identical if blocks
    'complexity': ['warn', { max: 10 }],
  }
}
```

### Tools to Help

```bash
# Find duplicate code in TypeScript files
npm install --save-dev jscpd
npx jscpd server/src/di.ts --min-lines 5

# Output shows lines that are duplicated
```

---

## Pattern 4: Silent Test Skips

### Issue 607: Test Skip May Hide CI Failures

**Problem:**

```typescript
// ❌ WRONG - Silent early return, test passes when table doesn't exist
it('should NOT return traces from other tenants', async () => {
  if (!tableExists) return; // Test silently passes!

  // ... actual test ...
});

// CI reports: ✓ 10/10 tests pass
// But actually: 7 tests ran, 3 were skipped silently
```

**Why It's Wrong:**

- CI shows 100% pass rate even when tests didn't run
- No visibility into which tests were actually executed
- If migration is missing, you don't know
- False confidence in code quality
- Flaky tests hide behind skip logic

**The Fix (Already Applied):**

```typescript
// ✅ CORRECT - Use Vitest's skipIf() for VISIBLE skips
const itIfTableExists = it.skipIf(() => !tableExists);

describe('getUnevaluatedTraces', () => {
  itIfTableExists('should NOT return traces from other tenants', async () => {
    // No guard needed - test skipped VISIBLY if table missing
  });
});

// CI output shows:
// ✓ should NOT return traces from other tenants
// ↓ should handle empty results [skipped: ConversationTrace table not found]
// ^ Clear visibility that test was skipped
```

### Vitest Conditional Test Patterns

**Pattern 1: skipIf() - Test-level conditional**

```typescript
describe('Feature Tests', () => {
  const hasDatabase = process.env.DATABASE_URL !== undefined;

  // Skip entire test if condition false
  it.skipIf(!hasDatabase)('should connect to database', async () => {
    await db.query('SELECT 1');
  });
});
```

**Pattern 2: describe.skipIf() - Suite-level conditional**

```typescript
// Skip entire describe block if table doesn't exist
describe.skipIf(!tableExists)('Tenant Isolation', () => {
  it('should NOT return traces from other tenants', async () => {
    // ... no guards needed
  });

  it('should deny access to other tenant data', async () => {
    // ... no guards needed
  });
});
```

**Pattern 3: Custom wrapper for complex conditions**

```typescript
// For multiple conditions or reusability
const itIfDatabaseReady = tableExists && hasConnection ? it : it.skip;

describe('Integration Tests', () => {
  itIfDatabaseReady('should perform database operations', async () => {
    // Test runs only if both conditions true
  });
});
```

**Pattern 4: Dynamic skip reason**

```typescript
describe('Feature Tests', () => {
  it.skipIf(!hasFeature)('advanced feature works', async () => {
    // Vitest shows test was skipped
  });
});

// Better: Add reason message
beforeAll(() => {
  if (!hasFeature) {
    console.log('⚠️  Skipping advanced feature tests (FEATURE_FLAG not set)');
  }
});
```

### Avoiding Silent Failures Checklist

```
VISIBLE TEST SKIPS

□ No early returns in test body (if (!condition) return;)
□ Use it.skipIf(), describe.skipIf(), or custom wrappers
□ Skip reason logged to console if not obvious
□ CI output shows skipped count alongside pass count
□ Tests never pass when they didn't actually run
□ Migration status checked before suite runs
□ Environment variables for feature flags logged

Before vs After:

BEFORE (Silent):
  ✓ should isolate tenants (1 passed)
  ✓ should deny access (1 passed)
  ✓ should verify ownership (1 passed)
  Total: 3 passed, 3 hidden skips ❌

AFTER (Visible):
  ✓ should isolate tenants
  ✓ should deny access
  ↓ should verify ownership [skipped: table missing]
  ↓ should handle edge case [skipped: table missing]
  ↓ should cleanup data [skipped: table missing]
  Total: 2 passed, 3 skipped ✅
```

### File Locations

- **Example:** `server/test/agent-eval/tenant-isolation.test.ts` (lines 36, 75, 105)
- **Pattern applied:** Lines 36-50 (itIfTableExists wrapper)
- **Test output:** Shows skipped tests with reason

---

## Summary: Prevention Checklists

### For Code Authors

**Before submitting PR:**

```
AGENT EVALUATION FEATURES CHECKLIST

DATA INTEGRITY
□ Every database query includes tenantId in WHERE clause
□ Compound queries verify ownership (findFirst with tenantId)
□ No queries like count({ where: { id: { in: [...] } } })

CLI SCRIPTS
□ Arguments parsed with Node's parseArgs()
□ All options validated with Zod schema
□ Invalid input exits with error message (not silent failure)
□ tenantId checked for UUID format
□ Help text includes all options + examples

DI CONTAINER
□ No duplicated initialization blocks between modes
□ Extract helper function if code repeats 2+ times
□ Helper parameterized (prisma instance, mode string)

TESTING
□ No early returns in test bodies
□ Use it.skipIf() or describe.skipIf() for conditionals
□ Skip reason logged to console
□ Tests never silently pass when skipped

RUN BEFORE COMMIT
□ npm run typecheck (catch type errors)
□ npm test -- --reporter=verbose (see all test outcomes)
□ npm run lint (catch style issues)
□ npx jscpd server/src/di.ts (find duplicates)
```

### For Code Reviewers

**When reviewing agent-eval PRs:**

```
CODE REVIEW FOCUS AREAS

1. DATABASE QUERIES (P0 SECURITY)
   □ Every query has tenantId filter (even if already filtered)
   □ Comment added if exception to rule
   □ Ownership verified before operations

2. CLI INPUT VALIDATION (P1 SECURITY)
   □ parseArgs() from node:util, not custom loop
   □ All options validated with Zod
   □ Error messages clear + specific
   □ Exit code 1 on validation failure

3. DI DUPLICATION (P2 QUALITY)
   □ Check di.ts for identical blocks
   □ No logic repeated between mock/real modes
   □ Helper functions used for common patterns

4. TEST VISIBILITY (P2 RELIABILITY)
   □ Grep for early returns: grep "if (!.*) return;"
   □ All skips use skipIf() not silent returns
   □ Test count matches executed count in CI

Questions to Ask:
- "Does every query filter by tenantId?"
- "Are CLI arguments validated upfront?"
- "Is this same code elsewhere that could be extracted?"
- "Could this test fail silently?"
```

### ESLint Rules to Help

Add to your `eslint.config.js`:

```typescript
export default [
  {
    rules: {
      // Prevent common mistakes
      'no-unreachable': 'error', // Catch early returns
      'no-unused-vars': 'error',

      // Database safety
      'prefer-const': 'warn',

      // Suggest improvements
      'no-duplicate-string': ['warn', { threshold: 3 }],
      complexity: ['warn', { max: 12 }],
      'max-lines-per-function': ['warn', { max: 50 }],
    },
  },
];
```

---

## Testing Patterns

### Unit Test: CLI Validation

```typescript
import { describe, it, expect } from 'vitest';

describe('CLI Arguments', () => {
  it('should reject empty tenant-id', () => {
    const result = CliSchema.safeParse({ tenantId: '' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid UUID', () => {
    const result = CliSchema.safeParse({ tenantId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('should accept valid UUID', () => {
    const uuid = crypto.randomUUID();
    const result = CliSchema.safeParse({ tenantId: uuid });
    expect(result.success).toBe(true);
    expect(result.data?.tenantId).toBe(uuid);
  });

  it('should enforce max concurrency', () => {
    const result = CliSchema.safeParse({ concurrency: 50 });
    expect(result.success).toBe(false);
  });
});
```

### Integration Test: Tenant Isolation

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe.skipIf(!tableExists)('Tenant Isolation', () => {
  let tenant1: any, tenant2: any;

  beforeEach(async () => {
    tenant1 = await createTestTenant();
    tenant2 = await createTestTenant();
  });

  it('should NOT return traces from other tenants', async () => {
    // Tenant1 creates trace
    await createTestTrace(tenant1.id, { content: 'hello' });

    // Tenant2 queries
    const traces = await pipeline.getUnevaluatedTraces(tenant2.id);
    expect(traces).toHaveLength(0);
  });

  it('should verify ownership before accessing trace', async () => {
    const trace = await createTestTrace(tenant1.id, {});

    // Tenant2 cannot access it
    expect(() => service.getTraceDetails(tenant2.id, trace.id)).rejects.toThrow(
      'TenantAccessDeniedError'
    );
  });
});
```

---

## Quick Reference Table

| Issue   | Pattern           | Detection                     | Fix                | Complexity |
| ------- | ----------------- | ----------------------------- | ------------------ | ---------- |
| **603** | Missing tenantId  | Grep: `where: {` for tenantId | Add to all queries | 15min      |
| **608** | UUID validation   | Manual arg parsing            | Use Zod schema     | 10min      |
| **606** | Hand-rolled args  | 40+ line parseArgs()          | Node.parseArgs()   | 15min      |
| **605** | DI duplication    | Compare di.ts sections        | Extract helper     | 20min      |
| **607** | Silent test skips | Grep: `if (!x) return;`       | Use skipIf()       | 5min       |

---

## References

- **Issues:** 603-608 (P2 agent-eval)
- **Source Commit:** fcf6004c
- **Related Docs:**
  - `docs/solutions/patterns/mais-critical-patterns.md` (Pattern 1: Multi-Tenant Query Isolation)
  - `docs/solutions/patterns/agent-evaluation-remediation-prevention-MAIS-20260102.md` (DI patterns)
  - `server/scripts/run-eval-batch.ts` (working examples)
  - `server/src/di.ts` (DI extraction pattern applied)

---

## Version History

| Date       | Changes                                                             |
| ---------- | ------------------------------------------------------------------- |
| 2026-01-02 | Initial release - 4 prevention strategies from P2 agent-eval issues |
