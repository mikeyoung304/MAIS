---
module: MAIS
type: prevention_strategies
date: 2026-01-02
tags: [prevention, compound-engineering, code-quality, security, testing, cli, di]
related_issues: [603, 604, 605, 606, 607, 608]
phases: [6, 7]
---

# Phase 6-7 Agent Evaluation Prevention Strategies

**Scope:** Comprehensive prevention guide for P2 agent-eval issues + learnings from Phase 1-5
**Date:** 2026-01-02
**Impact:** Security, data integrity, code quality, testing visibility, performance
**Read Time:** 25 minutes (full) or 5 minutes (quick reference)
**Target Audience:** All engineers; especially those working on agent systems, CLI tools, and shared infrastructure

---

## Executive Summary

The Phase 6-7 Agent Evaluation remediation identified **6 concrete issues** stemming from **4 recurring patterns**. These patterns exist throughout the codebase and will repeat unless prevented at the architecture and code review level.

### The 4 Core Patterns

| Pattern                            | Issues   | Risk Level     | Effort to Fix | Prevention Mechanism   |
| ---------------------------------- | -------- | -------------- | ------------- | ---------------------- |
| **1. Missing tenantId in queries** | 603      | P0 Security    | 15 min        | Code review checklist  |
| **2. Invalid CLI input**           | 606, 608 | P1 Security    | 20 min        | Zod schema + parseArgs |
| **3. Duplicated DI code**          | 605      | P2 Quality     | 30 min        | Extract helpers        |
| **4. Silent test skips**           | 607      | P2 Reliability | 5 min         | Use skipIf()           |

**Status:** All 6 issues fixed (commit fcf6004c). This documentation prevents recurrence.

---

## Pattern 1: Missing tenantId in Queries (Issue 603)

### The Problem

**Violation:** Tenant ID filter missing from database query

```typescript
// ❌ WRONG - Missing tenantId filter
const flaggedCount = await prisma.conversationTrace.count({
  where: {
    id: { in: traceIds }, // Already filtered to tenant's IDs
    flagged: true,
  },
});
```

**Why It's Wrong:**

- Violates "always include tenantId" rule from `mais-critical-patterns.md`
- Even though `traceIds` are pre-filtered to tenant scope, the query itself ignores tenant context
- If a bug accidentally includes traces from another tenant, this query exposes them
- Creates a hidden security surface: what if `traceIds` somehow includes cross-tenant data?
- Defense-in-depth principle: every boundary should be independently verified

**Real Risk:**

```typescript
// Scenario: Bug in calling code
const traceIds = await getTraceIds(); // Bug: includes all traces
const flaggedCount = await countFlaggedTraces(traceIds); // Query doesn't check tenant
// Result: Leaks count of traces from other tenants
```

### Prevention Strategy

**Rule:** Every database query MUST include `tenantId` in WHERE clause, regardless of whether data is already filtered.

```typescript
// ✅ CORRECT - Defense-in-depth
const flaggedCount = await prisma.conversationTrace.count({
  where: {
    tenantId: tenant.id, // Always include (even with filtered IDs)
    id: { in: traceIds }, // Secondary filter
    flagged: true, // Business logic filter
  },
});
```

### Code Review Checklist

**DATABASE QUERIES - MANDATORY CHECK**

When reviewing ANY Prisma operation (findMany, findFirst, count, update, delete):

```
QUERY SECURITY REVIEW

For each database query:
□ tenantId APPEARS in WHERE clause
□ tenantId is FIRST condition (best practices)
□ Even if IDs are "already filtered", tenantId still included
□ Compound queries verify ownership:
  - Check resource exists AND tenant owns it
  - Throw TenantAccessDeniedError if not
□ No queries like findUnique({ where: { id } })
  - Must include tenantId check, even for unique IDs
□ Comment added if tenantId NOT in query (explain why exception is safe)

Pattern to match:
  where: {
    tenantId,              ← Always here, always first
    id: { in: [...] },     ← Then secondary filters
    fieldName: value,      ← Then business logic
  }
```

### File Locations with Examples

- **Script:** `/Users/mikeyoung/CODING/MAIS/server/scripts/run-eval-batch.ts:214`
- **Service:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/evals/pipeline.ts` (all count/find methods)
- **Repositories:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/*` (all methods)
- **Tests:** `/Users/mikeyoung/CODING/MAIS/server/test/agent-eval/tenant-isolation.test.ts`

### Compound Query Pattern

**When verifying both existence AND ownership:**

```typescript
// ❌ WRONG - Two separate queries (race condition)
const trace = await prisma.conversationTrace.findFirst({
  where: { id: traceId },
});
if (!trace) throw new TraceNotFoundError(traceId);
// Doesn't verify tenant ownership - race condition possible

// ✅ CORRECT - Single query with ownership
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

### ESLint Rule

Consider adding to `eslint.config.js`:

```javascript
{
  files: ['server/src/**/*.ts'],
  rules: {
    'no-unreachable-queries': 'error',  // Catch missing tenantId (custom rule)
  }
}
```

**Simple detection:** Search codebase for `where: {` and verify each has `tenantId` check.

---

## Pattern 2: Invalid CLI Input Without Validation (Issues 606, 608)

### The Problem

**Violation 1:** Manual argument parsing without validation

```typescript
// ❌ WRONG - Hand-rolled arg parsing
function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { maxPerTenant: 50, dryRun: false };

  for (const arg of args) {
    if (arg.startsWith('--tenant-id=')) {
      options.tenantId = arg.split('=')[1]?.trim(); // No validation!
    }
    if (arg.startsWith('--max-per-tenant=')) {
      options.maxPerTenant = parseInt(arg.split('=')[1] || '50'); // No bounds check
    }
  }
  return options;
}
```

**Real Issues:**

1. `--tenant-id=` (empty value) silently passes through as empty string
2. `--tenant-id=not-a-uuid` causes confusing "no tenants found" error at runtime
3. `--max-per-tenant=999` silently accepted despite being too high
4. Hand-rolled parsing is 40+ lines for 4 flags (unmaintainable)
5. Invalid values not caught until runtime

**Violation 2:** Missing UUID validation

```typescript
// ❌ WRONG - No format validation
if (options.tenantId) {
  // Directly used without checking if it's valid UUID
  const tenants = await findTenantsById(options.tenantId);
}
```

### Prevention Strategy

**Use Node.js built-in `parseArgs()` + Zod validation**

```typescript
import { parseArgs } from 'node:util';
import { z } from 'zod';

// Step 1: Define Zod schema (single source of truth)
const CliSchema = z.object({
  tenantId: z.string().uuid().optional().describe('Specific tenant to process'),
  maxPerTenant: z.coerce
    .number()
    .int()
    .positive()
    .max(1000)
    .default(50)
    .describe('Max traces per tenant'),
  dryRun: z.boolean().default(false).describe('Show what would run'),
  concurrency: z.coerce.number().int().min(1).max(20).default(5).describe('Parallel batch size'),
  help: z.boolean().default(false),
});

type CliOptions = z.infer<typeof CliSchema>;

// Step 2: Parse with Node's built-in
function parseCliArgs(args: string[]): CliOptions {
  const { values } = parseArgs({
    args,
    options: {
      'tenant-id': { type: 'string' },
      'max-per-tenant': { type: 'string', default: '50' },
      'dry-run': { type: 'boolean', default: false },
      concurrency: { type: 'string', default: '5' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  // Step 3: Validate with Zod (catches all errors upfront)
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
      const path = e.path.join('.');
      const field = e.path[0] || 'unknown';
      console.error(`  --${field}: ${e.message}`);
    });
    printHelp();
    process.exit(1);
  }

  return result.data;
}

// Step 4: Help text
function printHelp(): void {
  console.log(`
Usage: eval-batch [options]

Options:
  --tenant-id=UUID      Only evaluate specific tenant
  --max-per-tenant=N    Max traces per tenant (default: 50, max: 1000)
  --concurrency=N       Parallel batches (default: 5, min: 1, max: 20)
  --dry-run             Show what would run without executing
  -h, --help            Show this help

Examples:
  eval-batch
  eval-batch --tenant-id=550e8400-e29b-41d4-a716-446655440000
  eval-batch --max-per-tenant=100 --concurrency=10
  eval-batch --dry-run
  `);
}
```

### CLI Validation Checklist

**When creating a new CLI script:**

```
CLI ARGUMENT VALIDATION

Design Phase:
□ List all options (flags, values, defaults)
□ Identify constraints (required, UUID format, ranges)
□ Plan help text with examples

Implementation:
□ Use Node's parseArgs() from 'node:util' (NOT hand-rolled loop)
□ Define Zod schema for all options (type-safe defaults)
□ All required options from args OR environment variables
□ Options with constraints use Zod validators:
  - UUID: z.string().uuid()
  - Positive integer: z.coerce.number().int().positive()
  - Range: z.number().min(1).max(20)
  - Enum: z.enum(['mock', 'real'])
□ Validation errors:
  - Print detailed message (not just "invalid input")
  - Exit with code 1 (not 0)
  - Include usage example
□ Help text:
  - All options with descriptions
  - Default values shown
  - Usage examples with realistic values

Testing:
□ Test valid UUID: 550e8400-e29b-41d4-a716-446655440000 ✓
□ Test invalid UUID: not-a-uuid ✗
□ Test empty value: --tenant-id= ✗
□ Test out of range: --concurrency=50 ✗
□ Test missing required: omit --tenant-id (if required) ✗
□ Test help: --help ✓
```

### Error Messages

**Good error messages catch issues upfront:**

```
GOOD: ✗ --tenant-id: Invalid UUID format
BAD:  ✗ invalid arguments

GOOD: ✗ --max-per-tenant: Must be between 1 and 1000
BAD:  ✗ invalid option

GOOD: ✗ --concurrency: Must be a positive integer
BAD:  ✗ type error
```

### File Locations with Examples

- **Script:** `/Users/mikeyoung/CODING/MAIS/server/scripts/run-eval-batch.ts:56-100`
- **Zod Schema:** Lines 56-61 (CliOptions definition)
- **parseArgs():** Lines 67-100 (parsing and validation)
- **Help text:** Part of script

---

## Pattern 3: Duplicated Initialization Code (Issue 605)

### The Problem

**Violation:** Same DI initialization code in mock and real mode

```typescript
// ❌ WRONG - Lines 304-310 in mock mode
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator();
  const pipeline = createEvalPipeline(mockPrisma, evaluator);
  const reviewQueue = createReviewQueue(mockPrisma);
  const reviewActions = createReviewActionService(mockPrisma);
  evaluation = { evaluator, pipeline, reviewQueue, reviewActions };
}

// ❌ WRONG - Lines 735-746 in real mode (IDENTICAL except prisma instance)
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator(); // Duplicate
  const pipeline = createEvalPipeline(prisma, evaluator); // Only param differs
  const reviewQueue = createReviewQueue(prisma);
  const reviewActions = createReviewActionService(prisma);
  evaluation = { evaluator, pipeline, reviewQueue, reviewActions };
}
```

**Why It's a Problem:**

- 15+ lines duplicated between two locations
- If bug found in one, it's likely in the other (and easy to miss)
- Makes code harder to understand (what's the difference?)
- SOLID principle violation (DRY - Don't Repeat Yourself)
- Future changes require edits in multiple places (error-prone)
- Testing finds bug in mock mode, but real mode is still broken

### Prevention Strategy

**Extract duplicated logic into helper function:**

```typescript
// ✅ CORRECT - Single implementation
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

  const icon = mode === 'mock' ? '🧪' : '🤖';
  logger.info(`${icon} Agent evaluation services initialized (${mode} mode)`);
  return { evaluator, pipeline, reviewQueue, reviewActions };
}

// Usage - consistent across all modes
const evaluation = buildEvaluationServices(mockPrisma, 'mock');
const evaluationServices = buildEvaluationServices(prisma, 'real');
```

### Duplication Detection Patterns

**Pattern 1: Identical blocks between modes**

```typescript
// ❌ WRONG - Copy-paste between conditional branches
if (adapterMode === 'mock') {
  const service = createMockService(...);
  const result = service.configure(...);
  container.services.push(result);
}

if (adapterMode === 'real') {
  const service = createRealService(...);  // Next 2 lines identical
  const result = service.configure(...);
  container.services.push(result);
}

// ✅ CORRECT - Extract common logic
function configureService(service: Service): void {
  const result = service.configure(...);
  container.services.push(result);
}

const service = adapterMode === 'mock'
  ? createMockService(...)
  : createRealService(...);
configureService(service);
```

**Pattern 2: Same configuration in multiple functions**

```typescript
// ❌ WRONG - Same block in setupA(), setupB(), setupC()
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

// ✅ CORRECT - Extract to function
function initializeClient(): Client | undefined {
  if (!process.env.API_KEY) return undefined;

  const client = new Client({ apiKey: process.env.API_KEY });
  client.authenticate();
  return client;
}

state.client = initializeClient();
// (reuse in setupA, setupB, setupC)
```

**Pattern 3: Conditional block same everywhere**

```typescript
// ❌ WRONG - Environment check scattered everywhere
if (process.env.DEBUG_MODE) {
  logger.setLevel('debug');
  tracing.enable();
  metrics.debug = true;
}
// (repeated 5+ times in code)

// ✅ CORRECT - Extract once
function configureDebugMode(): void {
  if (!process.env.DEBUG_MODE) return;
  logger.setLevel('debug');
  tracing.enable();
  metrics.debug = true;
}

// Call once during startup
configureDebugMode();
```

### Code Duplication Checklist

**When writing DI or initialization code:**

````
DUPLICATION PREVENTION

Design Phase:
□ Look for similar patterns elsewhere in codebase
□ Identify the "different" vs "same" parts
□ Plan extraction strategy before coding

Implementation:
□ Scan di.ts for identical blocks (especially mock vs real)
□ Ctrl+F for repeated function names (createEvaluator appears 1x)
□ Extract to helper function:
  - Name: buildX, createX, initializeX, setupX, configureX
  - Parameterize differences (prisma instance, mode string, etc.)
  - Return type explicit (Service | undefined, not any)
□ Update all callers to use helper
□ Delete old code blocks

Verification:
□ No duplicate code blocks remain
□ Helper function tested in isolation
□ All callers produce same behavior as before
□ DI container still initializes correctly

Detection Tools:
```bash
# Find similar code
npx jscpd server/src/di.ts --min-lines 5

# Count occurrences of pattern
grep -n "const evaluator = createEvaluator" server/src/di.ts
# Should appear 1x (in helper) after refactor
````

### ESLint Rule to Help

Add to `eslint.config.js`:

```javascript
{
  rules: {
    // Detect duplicate strings (threshold can be tuned)
    'no-duplicate-strings': ['warn', { threshold: 3 }],

    // Flag overly complex functions (likely candidates for extraction)
    'complexity': ['warn', { max: 12 }],

    // Flag functions doing too much (likely candidates for refactoring)
    'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true }],
  }
}
```

---

## Pattern 4: Silent Test Skips (Issue 607)

### The Problem

**Violation:** Tests pass when they should skip, hiding real failures

```typescript
// ❌ WRONG - Silent early return
it('should NOT return traces from other tenants', async () => {
  if (!tableExists) return; // Silent skip - test passes!

  // ... actual test assertions ...
});

// CI reports: ✓ All 10 tests passed
// Reality:    7 tests ran, 3 were skipped silently
```

**Why It's Wrong:**

- CI shows 100% pass rate even when tests didn't execute
- No visibility into which tests were skipped
- If migration is missing, you don't know (false confidence)
- Flaky tests can hide behind skip logic
- Next developer sees "passing" and assumes feature works

**Real Impact:**

```
BEFORE (Silent):
  ✓ should isolate tenants (1 passed)
  ✓ should deny access (1 passed)
  ✓ should verify ownership (1 passed)
  Total: 3 passed ← Looks great, but...

  Actually: Table doesn't exist, 0 real tests ran ❌

AFTER (Visible):
  ✓ should isolate tenants
  ✓ should deny access
  ↓ should verify ownership [SKIPPED - table missing]
  ↓ should handle edge case [SKIPPED - table missing]
  ↓ should cleanup [SKIPPED - table missing]
  Total: 2 passed, 3 skipped ← Clear visibility ✓
```

### Prevention Strategy

**Use Vitest's `skipIf()` for VISIBLE conditional skips**

```typescript
// ✅ CORRECT - Visible skips
const tableExists = /* check if ConversationTrace table exists */;
const itIfTableExists = it.skipIf(() => !tableExists);

describe('Tenant Isolation', () => {
  itIfTableExists('should NOT return traces from other tenants', async () => {
    // No guard needed - test skipped VISIBLY if table missing
    const traces = await service.getTraces(tenant2.id);
    expect(traces).toHaveLength(0);
  });
});

// CI output shows:
// ✓ should NOT return traces from other tenants
// ↓ should handle empty results [skipped: ConversationTrace table not found]
// ^ Clear visibility - test was skipped, not silently passed
```

### Vitest Conditional Test Patterns

**Pattern 1: Test-level skipIf()**

```typescript
describe('Feature Tests', () => {
  const hasDatabase = process.env.DATABASE_URL !== undefined;

  // Skip test if condition false
  it.skipIf(!hasDatabase)('should connect to database', async () => {
    await db.query('SELECT 1');
  });
});
```

**Pattern 2: Suite-level skipIf()**

```typescript
// Skip entire describe block if condition false
describe.skipIf(!tableExists)('Tenant Isolation', () => {
  it('should NOT return traces from other tenants', async () => {
    // ... no guards needed
  });

  it('should deny access to other tenant data', async () => {
    // ... no guards needed
  });
});
```

**Pattern 3: Custom wrapper (reusable)**

```typescript
// Create wrapper for complex conditions
const itIfDatabaseReady = it.skipIf(() => !(tableExists && hasConnection));

describe('Integration Tests', () => {
  itIfDatabaseReady('should perform database operations', async () => {
    // Test runs only if both conditions true
  });
});
```

**Pattern 4: Function-level check with logging**

```typescript
// Log skip reason to console for visibility
async function checkTestEnvironment() {
  const tableExists = await tableExistsInDb();
  const hasConnection = await hasDbConnection();

  if (!tableExists) {
    console.log('⚠️  Skipping database tests (ConversationTrace table not found)');
  }
  if (!hasConnection) {
    console.log('⚠️  Skipping integration tests (database unavailable)');
  }

  return tableExists && hasConnection;
}

const dbReady = await checkTestEnvironment();
const itIfDbReady = it.skipIf(() => !dbReady);
```

### Avoiding Silent Failures Checklist

**When writing conditional tests:**

```
VISIBLE TEST SKIPS

Testing Code Review:
□ NO early returns in test body (if (!condition) return;)
□ NO early assertions (if (!condition) return in beforeEach)
□ Use it.skipIf() or describe.skipIf() or custom wrapper
□ Skip condition is simple boolean (not nested if-else)
□ Skip reason logged to console if not obvious from code

Migration & Setup:
□ Check migrations applied before tests run
□ Environment variables logged at suite startup
□ Feature flags logged at test startup

CI/CD:
□ Test runner shows skipped count (not just pass count)
□ Skipped tests marked clearly in output
□ Tests never "pass" when they didn't actually run
□ Build passes even with skipped tests

Git Before/After:
BEFORE (Silent):
  ✓ should isolate tenants (1 passed)
  ✓ should deny access (1 passed)
  ✓ should verify ownership (1 passed)
  Total: 3 passed

AFTER (Visible):
  ✓ should isolate tenants
  ✓ should deny access
  ↓ should verify ownership [skipped: table missing]
  ↓ should handle edge case [skipped: table missing]
  ↓ should cleanup data [skipped: table missing]
  Total: 2 passed, 3 skipped ← Success!
```

### File Locations with Examples

- **Pattern:** `/Users/mikeyoung/CODING/MAIS/server/test/agent-eval/tenant-isolation.test.ts:36-50`
- **Example wrapper:** Lines 36-40 (`itIfTableExists` definition)
- **Usage in tests:** Lines 41+

---

## Cross-Pattern: Reading Environment Variables at Module Import Time

### The Problem

**Violation:** Reading env vars during module load (before test setup)

```typescript
// ❌ WRONG - Read at import time
const isProduction = process.env.NODE_ENV === 'production';

// ❌ WRONG - Read when class loads
class Config {
  static readonly ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
}

// ❌ WRONG - Read at top level
export const config = {
  apiKey: process.env.STRIPE_API_KEY,
  timeout: parseInt(process.env.TIMEOUT || '30000'),
};
```

**Why It's Wrong:**

- Env vars not available when module loads (test setup hasn't run)
- Can't mock env vars in tests (already read)
- Tests must set env vars BEFORE importing module
- Makes it impossible to test different env configurations

### Prevention Strategy

**Read env vars lazily at function call time:**

```typescript
// ✅ CORRECT - Lazy evaluation
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

// ✅ CORRECT - Factory function
function getConfig() {
  return {
    apiKey: process.env.STRIPE_API_KEY,
    timeout: parseInt(process.env.TIMEOUT || '30000'),
  };
}

// ✅ CORRECT - In functions, not at class load
class Config {
  static getApiKey(): string {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY required');
    return key;
  }
}
```

**In tests:**

```typescript
import { beforeEach, it, expect } from 'vitest';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
  });

  it('should use STRIPE_API_KEY', () => {
    process.env.STRIPE_API_KEY = 'sk_test_123';
    const config = getConfig(); // Read happens HERE, after test setup
    expect(config.apiKey).toBe('sk_test_123');
  });
});
```

---

## Summary: Implementation Checklist

### For Code Authors

**Before committing code with any of these patterns:**

```
PHASE 6-7 PREVENTION CHECKLIST

PATTERN 1: TENANT ISOLATION
□ Every database query includes tenantId in WHERE
□ No queries like count({ where: { id: {...} } })
□ Even pre-filtered IDs have tenantId checked (defense-in-depth)
□ Ownership verification before operations (throw TenantAccessDeniedError)

PATTERN 2: CLI VALIDATION
□ Arguments parsed with Node's parseArgs() (not hand-rolled)
□ All options validated with Zod schema
□ Invalid input exits with error message (not silent failure)
□ UUIDs validated with z.string().uuid()
□ Numeric options have range constraints (.positive(), .max())
□ Help text includes all options with examples

PATTERN 3: DI INITIALIZATION
□ No duplicated initialization blocks between modes
□ If code repeats 2+ times, extract to helper function
□ Helper parameterized (prisma instance, mode string, etc.)
□ Helper tested in isolation

PATTERN 4: TEST VISIBILITY
□ No early returns in test bodies (if (!x) return;)
□ Use it.skipIf() or describe.skipIf() for conditionals
□ Skip reason logged to console
□ Tests never silently pass when they should skip

ENVIRONMENT VARIABLES
□ No reading env vars at module import time
□ Read env vars lazily in functions
□ Tests can set env vars before calling functions

FINAL VERIFICATION
□ npm run typecheck (catch type errors)
□ npm test -- --reporter=verbose (see all outcomes)
□ npm run lint (check style)
```

### For Code Reviewers

**When reviewing PRs (especially agent-eval, CLI, DI):**

```
CODE REVIEW CHECKLIST - 5 MINUTE REVIEW

PATTERN 1: DATABASE QUERIES (P0)
□ Grep: "where: {" for tenantId
□ Every query has tenantId filter
□ No exceptions without explanation
□ Comment added if exception allowed

PATTERN 2: CLI INPUT (P1)
□ Check: parseArgs() from 'node:util'?
□ Check: Zod validation present?
□ Check: Error messages clear?
□ Check: Exit code 1 on error?

PATTERN 3: DI DUPLICATION (P2)
□ Search di.ts for identical blocks
□ No logic duplicated between mock/real
□ Helper functions used for common patterns
□ Grep: "const evaluator = createEvaluator"
  - Should appear 1x (in helper) not multiple times

PATTERN 4: TEST SKIPS (P2)
□ Grep: "if (!.*) return;" in test files
□ All skips use skipIf() not silent returns
□ Skip reason visible in test output
□ Test count matches executed count

RED FLAGS (Ask for changes):
- tenantId missing from WHERE clause → P0 security
- Manual arg parsing without Zod → P1 security
- Identical code blocks in 2+ places → P2 quality
- "if (condition) return;" in test → P2 reliability
```

### Tools to Help

```bash
# Find missing tenantId in queries
grep -n "where: {" server/src/**/*.ts | grep -v tenantId

# Find duplicate code patterns
npx jscpd server/src/di.ts --min-lines 5

# Find silent test returns
grep -rn "if (.*) return;" server/test/ | grep "^[^:]*test\.ts"

# Check for module-level env var reads
grep -rn "process\.env\." server/src/ | grep -v "function\|=>" | head -20
```

---

## Testing Patterns

### Unit Test: CLI Validation

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const CliSchema = z.object({
  tenantId: z.string().uuid().optional(),
  maxPerTenant: z.coerce.number().int().positive().max(1000).default(50),
  concurrency: z.coerce.number().int().min(1).max(20).default(5),
});

describe('CLI Arguments', () => {
  it('should reject empty tenant-id', () => {
    const result = CliSchema.safeParse({ tenantId: '' });
    expect(result.success).toBe(false);
    expect(result.error?.errors[0]?.message).toContain('UUID');
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
    expect(result.error?.errors[0]?.message).toContain('50');
  });

  it('should enforce max per tenant', () => {
    const result = CliSchema.safeParse({ maxPerTenant: 2000 });
    expect(result.success).toBe(false);
  });
});
```

### Integration Test: Tenant Isolation

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

const tableExists = /* check */;

describe.skipIf(!tableExists)('Tenant Isolation', () => {
  let tenant1: any, tenant2: any;

  beforeEach(async () => {
    tenant1 = await createTestTenant();
    tenant2 = await createTestTenant();
  });

  it('should NOT return traces from other tenants', async () => {
    const trace1 = await createTestTrace(tenant1.id);
    const traces = await service.getUnevaluatedTraces(tenant2.id);
    expect(traces).toHaveLength(0);
    expect(traces).not.toContainEqual(expect.objectContaining({ id: trace1.id }));
  });

  it('should verify ownership before operations', async () => {
    const trace1 = await createTestTrace(tenant1.id);

    await expect(
      service.flagTrace(tenant2.id, trace1.id)
    ).rejects.toThrow('TenantAccessDeniedError');
  });
});
```

### Test: DI Initialization

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildEvaluationServices } from '../di';

describe('buildEvaluationServices', () => {
  it('should return undefined when ANTHROPIC_API_KEY not set', () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const result = buildEvaluationServices(mockPrisma, 'mock');
      expect(result).toBeUndefined();
    } finally {
      if (original) process.env.ANTHROPIC_API_KEY = original;
    }
  });

  it('should return services when ANTHROPIC_API_KEY set', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    try {
      const result = buildEvaluationServices(mockPrisma, 'mock');
      expect(result).toBeDefined();
      expect(result?.evaluator).toBeDefined();
      expect(result?.pipeline).toBeDefined();
      expect(result?.reviewQueue).toBeDefined();
      expect(result?.reviewActions).toBeDefined();
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('should use provided prisma instance', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    try {
      const result = buildEvaluationServices(mockPrisma, 'mock');
      const pipeline = result?.pipeline;
      // Verify pipeline uses mockPrisma (depends on implementation)
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });
});
```

---

## Quick Reference Table

| Pattern           | Issue    | Detection                | Fix                 | Complexity | P-Level |
| ----------------- | -------- | ------------------------ | ------------------- | ---------- | ------- |
| Missing tenantId  | 603      | `grep "where: {"`        | Add to all queries  | 15min      | P0      |
| Invalid CLI input | 606, 608 | Manual parsing           | Use Zod + parseArgs | 20min      | P1      |
| DI duplication    | 605      | Find identical blocks    | Extract helper      | 30min      | P2      |
| Silent test skips | 607      | `grep "if (.*) return;"` | Use skipIf()        | 5min       | P2      |

---

## References

### Related Documentation

- `docs/solutions/patterns/mais-critical-patterns.md` - Required reading (Pattern 1: Multi-Tenant Query Isolation)
- `docs/solutions/patterns/agent-evaluation-remediation-prevention-MAIS-20260102.md` - Phase 1-4 patterns
- `docs/solutions/patterns/P2_AGENT_EVAL_PREVENTION_STRATEGIES-MAIS-20260102.md` - P2 issues only
- `/CLAUDE.md` - Pattern 2: DI Constructor Ordering (Kieran's rule), Pattern 6: Infrastructure Setup
- `ARCHITECTURE.md` - Multi-tenant patterns section

### Code Examples

- **Pattern 1:** `/Users/mikeyoung/CODING/MAIS/server/scripts/run-eval-batch.ts:214`
- **Pattern 2:** `/Users/mikeyoung/CODING/MAIS/server/scripts/run-eval-batch.ts:90-96`
- **Pattern 3:** `/Users/mikeyoung/CODING/MAIS/server/src/di.ts:92-112`
- **Pattern 4:** `/Users/mikeyoung/CODING/MAIS/server/test/agent-eval/tenant-isolation.test.ts:36-50`

### Issues Addressed

- 603: Missing tenantId in flagged count query
- 604: Sequential tenant processing (see concurrency pattern)
- 605: Duplicated DI initialization code
- 606: Manual argument parsing
- 607: Silent test skips
- 608: Missing UUID validation in CLI

### Commits

- fcf6004c: P2 remediation - all 6 issues fixed
- a93a2a9e: P1 route ordering and auth fallback
- 39d9695f: Documentation and compound engineering

---

## Compound Engineering Note

This documentation represents the **Compound** phase of compound engineering:

1. **Fix:** All 6 issues resolved (commit fcf6004c)
2. **Learn:** Prevention strategies documented (this document)
3. **Compound:** Future work builds on this foundation
4. **Repeat:** Prevents issues from recurring indefinitely

### How to Use This Document

**Quick reference (5 minutes):**

1. Save link to quick reference section
2. Add to PR template
3. Reference during code reviews

**Deep understanding (25 minutes):**

1. Read this entire document
2. Study code examples in repository
3. Run detection tools to find similar patterns elsewhere

**Automation (optional):**

1. Add ESLint rules from each pattern section
2. Set up pre-commit hooks
3. Integrate into CI pipeline

---

## Version History

| Version | Date       | Changes                                                        |
| ------- | ---------- | -------------------------------------------------------------- |
| 1.0     | 2026-01-02 | Initial release - 4 patterns, 6 issues, comprehensive examples |

**Last Updated:** 2026-01-02
**Maintained By:** Prevention Strategist
**Audience:** All engineers, especially those working on agent systems, CLI tools, and DI

---

## FAQ

**Q: Do I need to read this entire document?**
A: No. Bookmark the quick reference section and read full document when implementing similar patterns.

**Q: Are all 6 issues already fixed?**
A: Yes. This documentation prevents recurrence.

**Q: Which pattern is most important?**
A: Pattern 1 (missing tenantId) is P0 security. Others are P1-P2 quality/reliability.

**Q: Can I use these patterns in other projects?**
A: Yes. All 4 apply to multi-tenant systems, CLI tools, and DI containers.

**Q: How long does this take to learn?**
A: 5 minutes for quick reference, 25 minutes for deep understanding.

**Q: Where are working examples?**
A: Four files in repository:

- `server/scripts/run-eval-batch.ts` (Patterns 1, 2)
- `server/src/di.ts` (Pattern 3)
- `server/test/agent-eval/tenant-isolation.test.ts` (Pattern 4)

---

**End of Document**

Start here: Skip to Pattern 1 for security, Pattern 4 for reliability, or read top to bottom.
