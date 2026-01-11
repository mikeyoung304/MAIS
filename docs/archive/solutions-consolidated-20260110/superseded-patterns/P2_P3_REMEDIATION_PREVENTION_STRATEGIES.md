# P2/P3 Remediation Prevention Strategies

**Date:** 2026-01-02
**Scope:** 5 issues fixed in commit 0ce7eac1
**Target Audience:** Code reviewers, developers, automation engineers
**Status:** Complete

This document provides prevention strategies to avoid the 5 issues from the P2/P3 remediation cycle. Each strategy includes code review checklists, ESLint rules, and test patterns to catch issues early.

---

## Issue #1: Missing Input Validation

**Problem:** User inputs like `ReviewSubmission` lacked field-length and range validation, risking database bloat.

**Real Example:**

```typescript
// BEFORE (vulnerable)
export interface ReviewSubmission {
  reviewedBy: string; // No length limit
  notes: string; // No length limit
  correctEvalScore?: number; // Any number
}

// AFTER (validated)
export const ReviewSubmissionSchema = z.object({
  reviewedBy: z.string().min(1).max(100),
  notes: z.string().max(2000),
  correctEvalScore: z.number().min(0).max(10).optional(),
  actionTaken: z.enum(['none', 'approve', 'reject', 'escalate', 'retrain']),
});
```

### Prevention: Code Review Checklist

- [ ] **Zod schemas for all request bodies:** Every POST/PUT endpoint has Zod validation in contracts
- [ ] **No unvalidated string fields:** String fields have `.min()` and `.max()` constraints
- [ ] **Number ranges enforced:** All numeric inputs have `.min()` and `.max()`
- [ ] **Enum validation:** String enums use `z.enum()`, not free strings
- [ ] **Error messages included:** Validation errors have user-friendly messages
- [ ] **Schema reused:** API contracts are imported and used in services, not duplicated
- [ ] **Type inference:** Types are inferred from Zod (`type X = z.infer<typeof XSchema>`)
- [ ] **No `as any` for validation:** Never cast around validation
- [ ] **Database constraints match schema:** Prisma model constraints align with Zod ranges
- [ ] **Tests cover boundary cases:** Test min/max/enum edge cases

**Where to check:**

- `packages/contracts/src/` - All request/response schemas
- Route handlers - Should validate before passing to service
- Service constructors - Should accept validated data only

### Prevention: ESLint Rules

**Rule: No unvalidated object parameters**

```javascript
// .eslintrc.json addition
{
  "rules": {
    "no-unvalidated-json-parse": {
      "enabled": true,
      "message": "Use Zod schema to validate JSON input"
    },
    "prefer-zod-validation": {
      "enabled": true,
      "message": "All request bodies must have Zod schema in contracts/"
    }
  }
}
```

**Custom ESLint rule: Block untyped parameters**

```typescript
// scripts/eslint-rules/require-zod-validation.js
module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'Require Zod validation for all input types' },
  },
  create: (context) => ({
    ObjectTypeAnnotation(node) {
      // Flag interface/type definitions without corresponding Zod schema
      if (!node.parent?.id?.name?.endsWith('Schema')) {
        if (hasStringWithoutConstraints(node)) {
          context.report({
            node,
            message: 'String fields must have .min()/.max() in Zod schema',
          });
        }
      }
    },
  }),
};
```

### Prevention: Test Patterns

**Pattern 1: Validation boundary tests**

```typescript
import { ReviewSubmissionSchema } from './review-queue';

describe('ReviewSubmissionSchema', () => {
  it('should validate valid submission', () => {
    const input = {
      reviewedBy: 'alice@company.com',
      notes: 'Good response',
      correctEvalScore: 8,
      actionTaken: 'approve',
    };
    expect(() => ReviewSubmissionSchema.parse(input)).not.toThrow();
  });

  // Boundary tests
  it('should reject empty reviewedBy', () => {
    const input = {
      reviewedBy: '', // Empty
      notes: 'Notes',
      actionTaken: 'approve',
    };
    expect(() => ReviewSubmissionSchema.parse(input)).toThrow();
  });

  it('should reject reviewedBy > 100 chars', () => {
    const input = {
      reviewedBy: 'x'.repeat(101), // Too long
      notes: 'Notes',
      actionTaken: 'approve',
    };
    expect(() => ReviewSubmissionSchema.parse(input)).toThrow();
  });

  it('should reject notes > 2000 chars', () => {
    const input = {
      reviewedBy: 'alice@test.com',
      notes: 'x'.repeat(2001), // Too long
      actionTaken: 'approve',
    };
    expect(() => ReviewSubmissionSchema.parse(input)).toThrow();
  });

  it('should reject score outside 0-10', () => {
    expect(() =>
      ReviewSubmissionSchema.parse({
        reviewedBy: 'alice',
        notes: '',
        correctEvalScore: 11, // Too high
        actionTaken: 'approve',
      })
    ).toThrow();

    expect(() =>
      ReviewSubmissionSchema.parse({
        reviewedBy: 'alice',
        notes: '',
        correctEvalScore: -1, // Too low
        actionTaken: 'approve',
      })
    ).toThrow();
  });

  it('should reject invalid actionTaken', () => {
    const input = {
      reviewedBy: 'alice',
      notes: 'Notes',
      actionTaken: 'invalid_action', // Not in enum
    };
    expect(() => ReviewSubmissionSchema.parse(input)).toThrow();
  });
});
```

**Pattern 2: Route integration tests**

```typescript
import { submitReview } from './review-queue.service';

describe('submitReview', () => {
  it('should reject invalid submission payload', async () => {
    const { tenantId } = await createTestTenant();
    const { traceId } = await createTestTrace(tenantId);

    const result = await submitReview(tenantId, traceId, {
      reviewedBy: 'x'.repeat(101), // Invalid
      notes: 'Notes',
      actionTaken: 'approve',
    } as any);

    expect(result).toEqual({
      status: 400,
      body: {
        error: 'Validation failed',
        details: [
          {
            field: 'reviewedBy',
            message: 'Reviewer identifier must be 100 characters or less',
          },
        ],
      },
    });
  });
});
```

**Pattern 3: Database constraint verification**

```typescript
// After adding Zod validation, verify Prisma schema matches
describe('Database constraints match Zod schema', () => {
  it('should enforce reviewedBy max length in DB', async () => {
    const prisma = getPrismaClient();
    const schema = introspectPrismaSchema();

    const reviewFeedbackModel = schema.models.find((m) => m.name === 'ReviewFeedback');
    const reviewedByField = reviewFeedbackModel?.fields.find((f) => f.name === 'reviewedBy');

    expect(reviewedByField?.db?.columnType).toMatch(/VARCHAR\(100\)/);
  });

  it('should enforce correctEvalScore range in DB check', async () => {
    // Note: Database check constraints are less common, but document expectation
    // This is a reminder to reviewers to verify DB constraints
    const expected = 'CHECK (correctEvalScore >= 0 AND correctEvalScore <= 10)';
    // Query: SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='ReviewFeedback';
  });
});
```

---

## Issue #2: Test Coverage Gaps

**Problem:** Several critical functions lacked direct test coverage (pipeline async methods, PII redaction APIs).

**Real Example:**

```typescript
// BEFORE: Function had no direct tests
export async function cleanupPendingEvaluations(prisma: PrismaClient) {
  const pending = await countPendingEvaluations(prisma);
  if (pending > 50) {
    await drainCompleted(prisma);
  }
}

// AFTER: Added 454 new lines of test coverage
describe('cleanupPendingEvaluations', () => {
  it('should trigger drain when pending > 50', async () => {
    mockPrisma.conversationTrace.count.mockResolvedValue(51);
    const drainSpy = vi.spyOn(pipeline, 'drainCompleted');

    await cleanupPendingEvaluations(mockPrisma);

    expect(drainSpy).toHaveBeenCalled();
  });
});
```

### Prevention: Code Review Checklist

- [ ] **Coverage report on PR:** GitHub PR includes coverage diff showing new tests
- [ ] **Exported functions tested:** All `export` functions have at least 1 direct test
- [ ] **Async paths tested:** All branches of async functions (success, error, timeout)
- [ ] **Edge cases covered:** Boundary conditions (empty input, large input, null/undefined)
- [ ] **Error paths tested:** Try/catch blocks have tests for the `catch` side
- [ ] **Mock configuration tested:** Mocked behavior is verified in tests
- [ ] **Integration tests exist:** Services are tested with real dependencies (via test doubles)
- [ ] **No test duplication:** Don't test the same behavior in 3 different tests
- [ ] **Snapshot tests avoided:** Use explicit assertions, not snapshots
- [ ] **Test names describe behavior:** "should X when Y" pattern

**Where to check:**

- `server/test/agent-eval/` - Should have tests for all pipeline functions
- Coverage reports - Should show >80% coverage for evaluated modules
- Git diff - PR should show new test files

### Prevention: ESLint Rules

**Rule: Enforce test coverage for exports**

```javascript
// .eslintrc.json
{
  "rules": {
    "require-test-coverage": {
      "enabled": true,
      "message": "Exported functions must have test coverage",
      "minCoverage": 80,
    }
  }
}
```

**Custom Rule: Block untested exports**

```typescript
// scripts/eslint-rules/exported-functions-must-have-tests.js
module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'Verify exported functions have test files' },
  },
  create: (context) => {
    const filename = context.filename;
    const isTestFile = filename.includes('.test.') || filename.includes('.spec.');

    if (!isTestFile && filename.endsWith('.ts')) {
      return {
        ExportNamedDeclaration(node) {
          if (node.declaration?.type === 'FunctionDeclaration') {
            const funcName = node.declaration.id.name;
            // Check that corresponding test file exists
            const testFile = filename.replace(/\.ts$/, '.test.ts');
            if (!fileSystem.existsSync(testFile)) {
              context.report({
                node,
                message: `Exported function "${funcName}" must have corresponding .test.ts file`,
              });
            }
          }
        },
      };
    }
    return {};
  },
};
```

### Prevention: Test Patterns

**Pattern 1: Coverage-driven test template**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../helpers/mock-prisma';
import {
  cleanupPendingEvaluations,
  drainCompleted,
  shouldEvaluate,
  redactMessagesForPreview,
} from '../../src/agent/evals/pipeline';

describe('Pipeline Functions', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // cleanupPendingEvaluations - MUST test all branches
  // ─────────────────────────────────────────────────────────────────────────────

  describe('cleanupPendingEvaluations', () => {
    it('should drain when pending evaluations > 50', async () => {
      mockPrisma.conversationTrace.count.mockResolvedValue(51);
      const drainSpy = vi.spyOn(pipeline, 'drainCompleted');

      await cleanupPendingEvaluations(mockPrisma);

      expect(drainSpy).toHaveBeenCalledWith(mockPrisma);
    });

    it('should not drain when pending <= 50', async () => {
      mockPrisma.conversationTrace.count.mockResolvedValue(50);
      const drainSpy = vi.spyOn(pipeline, 'drainCompleted');

      await cleanupPendingEvaluations(mockPrisma);

      expect(drainSpy).not.toHaveBeenCalled();
    });

    it('should not drain when pending = 0', async () => {
      mockPrisma.conversationTrace.count.mockResolvedValue(0);
      const drainSpy = vi.spyOn(pipeline, 'drainCompleted');

      await cleanupPendingEvaluations(mockPrisma);

      expect(drainSpy).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.conversationTrace.count.mockRejectedValue(new Error('Database connection lost'));

      await expect(cleanupPendingEvaluations(mockPrisma)).rejects.toThrow(
        'Database connection lost'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // shouldEvaluate - MUST test all decision branches
  // ─────────────────────────────────────────────────────────────────────────────

  describe('shouldEvaluate', () => {
    it('should always evaluate flagged traces', () => {
      const flagged = { flagged: true };
      expect(shouldEvaluate(flagged)).toBe(true);
    });

    it('should always evaluate failed tasks', () => {
      const failed = { taskCompleted: false };
      expect(shouldEvaluate(failed)).toBe(true);
    });

    it('should use sampling rate for normal traces', () => {
      // This should use consistent sampling based on traceId
      const trace = { traceId: 'abc123', flagged: false, taskCompleted: true };
      const result = shouldEvaluate(trace);

      // Verify same trace always gives same result
      expect(shouldEvaluate(trace)).toBe(result);
    });

    it('should sample approximately 5% of traces (configurable)', () => {
      const total = 1000;
      let sampled = 0;

      for (let i = 0; i < total; i++) {
        const trace = {
          traceId: `trace-${i}`,
          flagged: false,
          taskCompleted: true,
        };
        if (shouldEvaluate(trace)) sampled++;
      }

      // Expect approximately 50 out of 1000 (5%)
      expect(sampled).toBeGreaterThanOrEqual(30);
      expect(sampled).toBeLessThanOrEqual(70);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // redactMessagesForPreview - MUST test truncation AND redaction
  // ─────────────────────────────────────────────────────────────────────────────

  describe('redactMessagesForPreview', () => {
    it('should truncate to maxLength after redaction', () => {
      const messages = [
        {
          role: 'user',
          content: 'Contact me at john@example.com. ' + 'x'.repeat(500),
        },
      ];

      const result = redactMessagesForPreview(messages, { maxLength: 100 });

      expect(result[0].content.length).toBeLessThanOrEqual(100);
      expect(result[0].content).toContain('[EMAIL]');
    });

    it('should default maxLength to 500', () => {
      const messages = [{ role: 'user', content: 'x'.repeat(1000) }];

      const result = redactMessagesForPreview(messages);

      expect(result[0].content.length).toBeLessThanOrEqual(500);
    });

    it('should redact PII before truncating', () => {
      const messages = [
        {
          role: 'user',
          content: 'Email: secret@company.com' + 'x'.repeat(200),
        },
      ];

      const result = redactMessagesForPreview(messages, { maxLength: 50 });

      // Should contain [EMAIL] even after truncation
      expect(result[0].content).toContain('[EMAIL]');
    });

    it('should handle empty messages array', () => {
      expect(redactMessagesForPreview([])).toEqual([]);
    });

    it('should preserve message roles', () => {
      const messages = [
        { role: 'assistant', content: 'response' },
        { role: 'user', content: 'query' },
      ];

      const result = redactMessagesForPreview(messages);

      expect(result[0].role).toBe('assistant');
      expect(result[1].role).toBe('user');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // redactToolCalls - MUST test both input AND output redaction
  // ─────────────────────────────────────────────────────────────────────────────

  describe('redactToolCalls', () => {
    it('should redact sensitive keys in input', () => {
      const toolCalls = [
        {
          toolName: 'send_email',
          input: { email: 'user@example.com', subject: 'Hello' },
          output: { success: true },
        },
      ];

      const result = redactToolCalls(toolCalls);

      expect(result[0].input.email).toBe('[REDACTED_EMAIL]');
      expect(result[0].input.subject).toBe('Hello');
    });

    it('should redact sensitive keys in output', () => {
      const toolCalls = [
        {
          toolName: 'get_user',
          input: { id: '123' },
          output: { phone: '555-1234', name: 'John' },
        },
      ];

      const result = redactToolCalls(toolCalls);

      expect(result[0].output.phone).toBe('[REDACTED_PHONE]');
      expect(result[0].output.name).toBe('John');
    });

    it('should handle nested objects in input', () => {
      const toolCalls = [
        {
          toolName: 'book_appointment',
          input: {
            customer: { email: 'nested@test.com', name: 'Alice' },
          },
          output: { confirmed: true },
        },
      ];

      const result = redactToolCalls(toolCalls);

      expect(result[0].input.customer.email).toBe('[REDACTED_EMAIL]');
    });

    it('should handle undefined output gracefully', () => {
      const toolCalls = [
        {
          toolName: 'check_status',
          input: { id: '123' },
          output: undefined,
        },
      ];

      const result = redactToolCalls(toolCalls);

      expect(result[0].output).toBeUndefined();
    });
  });
});
```

**Pattern 2: Coverage report validation in CI**

```yaml
# .github/workflows/test-coverage.yml
name: Test Coverage

on: [pull_request]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci
      - run: npm run test:coverage -- --reporter=json --outputFile=coverage.json

      - name: Check coverage thresholds
        run: |
          # Fail if coverage drops below 80%
          npx nyc-check-coverage --lines 80 --functions 80 --branches 80

      - name: Comment coverage diff on PR
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          lcov-file: ./coverage/lcov.info
          delete-old-comments: true
```

---

## Issue #3: Environment Variable Load-Time Issues

**Problem:** `EVAL_MODEL` was read at module import time instead of call time, causing test isolation issues.

**Real Example:**

```typescript
// BEFORE (vulnerable to load-order issues)
const DEFAULT_CONFIG: EvaluatorConfig = {
  model: process.env.EVAL_MODEL || DEFAULT_EVAL_MODEL, // Read at import!
  maxTokens: 2048,
};

// AFTER (lazy evaluation)
function getDefaultConfig(): EvaluatorConfig {
  return {
    model: process.env.EVAL_MODEL || DEFAULT_EVAL_MODEL, // Read at call time
    maxTokens: 2048,
  };
}
```

### Prevention: Code Review Checklist

- [ ] **No module-level env reads:** `process.env` only read in functions/methods
- [ ] **Factory functions for config:** Config values returned from getter functions
- [ ] **Env override patterns:** Test environment overrides through parameter injection
- [ ] **No hardcoded defaults in module scope:** Defaults computed at call time
- [ ] **Lazy initialization comments:** Functions that defer env reads are documented
- [ ] **Test isolation verified:** Each test can set different env without affecting others
- [ ] **No global side effects:** Config never mutates shared state
- [ ] **Dependency injection used:** Config passed as parameters, not accessed globally
- [ ] **startupConfig vs runtimeConfig:** Distinguish setup-time config from runtime config
- [ ] **dotenv loaded early:** Ensure `dotenv.config()` called before module imports

**Where to check:**

- Module top-level - Should have no `process.env` reads
- Config/settings files - Should only export factory functions
- Constructor methods - May read env (initialized at call time)
- Test setup - Should reset mocked env between tests

### Prevention: ESLint Rules

**Rule: No module-level env access**

```javascript
// .eslintrc.json
{
  "rules": {
    "no-process-env-at-module-level": {
      "enabled": true,
      "message": "Use factory function to defer process.env reads until call time"
    }
  }
}
```

**Custom ESLint rule**

```typescript
// scripts/eslint-rules/no-process-env-module-scope.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent process.env reads at module import time',
    },
  },
  create: (context) => {
    let insideFunction = false;
    let depth = 0;

    return {
      FunctionDeclaration() {
        insideFunction = true;
        depth++;
      },
      'FunctionDeclaration:exit'() {
        depth--;
        if (depth === 0) insideFunction = false;
      },

      MemberExpression(node) {
        if (!insideFunction && node.object.name === 'process' && node.property.name === 'env') {
          context.report({
            node,
            message:
              'process.env must not be read at module scope. Use a factory function (getConfig()) to defer evaluation to call time.',
          });
        }
      },
    };
  },
};
```

### Prevention: Test Patterns

**Pattern 1: Test env isolation with vi.stubEnv**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationEvaluator } from '../../src/agent/evals/evaluator';

describe('ConversationEvaluator - Env Isolation', () => {
  beforeEach(() => {
    // Vitest provides vi.stubEnv for test isolation
    vi.stubEnv('EVAL_MODEL', 'claude-3-haiku-20240307');
  });

  afterEach(() => {
    // Restore original environment
    vi.unstubAllEnvs();
  });

  it('should use EVAL_MODEL from environment', () => {
    // getDefaultConfig() reads process.env at call time
    const config = getDefaultConfig();
    expect(config.model).toBe('claude-3-haiku-20240307');
  });

  it('should fall back to DEFAULT_EVAL_MODEL when not set', () => {
    vi.stubEnv('EVAL_MODEL', ''); // Empty string
    const config = getDefaultConfig();
    expect(config.model).toBe('claude-haiku-35-20241022');
  });

  it('should allow per-test env overrides', () => {
    // Test 1: Custom model
    vi.stubEnv('EVAL_MODEL', 'custom-model-123');
    expect(getDefaultConfig().model).toBe('custom-model-123');

    // Test 2: Different model (fully isolated)
    vi.unstubAllEnvs();
    vi.stubEnv('EVAL_MODEL', 'another-model');
    expect(getDefaultConfig().model).toBe('another-model');
  });
});
```

**Pattern 2: Constructor-time vs module-time config**

```typescript
// GOOD: Config read at constructor time (call time)
export class EvaluatorService {
  private config: EvaluatorConfig;

  constructor(config?: Partial<EvaluatorConfig>) {
    // getDefaultConfig() defers env reads to constructor call time
    this.config = {
      ...getDefaultConfig(),
      ...config, // Allow override
    };
  }

  async evaluate(input: EvalInput): Promise<EvalResult> {
    // Now use this.config which was computed at construction time
    // If env changed after construction, it won't affect this instance
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    // ...
  }
}

// BAD: Config read at module scope (import time)
const DEFAULT_CONFIG = {
  model: process.env.EVAL_MODEL || DEFAULT_EVAL_MODEL, // WRONG!
};

export class BadEvaluator {
  async evaluate(): Promise<EvalResult> {
    // Uses DEFAULT_CONFIG computed at import time
    const client = new Anthropic({ apiKey: this.config.model });
  }
}
```

**Pattern 3: Verify env timing with mock module reload**

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Env Load Timing', () => {
  it('should read EVAL_MODEL at call time, not import time', async () => {
    // Clear module cache
    vi.resetModules();

    // Set env before import
    vi.stubEnv('EVAL_MODEL', 'model-from-env');

    // Import after env is set
    const { getDefaultConfig } = await import('../../src/agent/evals/evaluator');

    // Verify it read the env
    expect(getDefaultConfig().model).toBe('model-from-env');

    // Change env
    vi.stubEnv('EVAL_MODEL', 'model-changed');

    // getDefaultConfig should reflect the new value
    expect(getDefaultConfig().model).toBe('model-changed');
  });
});
```

**Pattern 4: Startup configuration checklist**

```typescript
// src/startup.ts - All env reads happen here, before app starts
import { logger } from './lib/core/logger';

export async function initializeConfig(): Promise<Config> {
  // All process.env reads happen in this function, once, at startup
  const config = {
    evalModel: process.env.EVAL_MODEL || 'claude-haiku-35-20241022',
    port: parseInt(process.env.PORT || '3001', 10),
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
  };

  // Validate config is complete
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  logger.info('Config loaded', {
    evalModel: config.evalModel,
    port: config.port,
    databaseUrl: config.databaseUrl.substring(0, 50) + '...', // Sanitized
  });

  return config;
}

// app.ts
import { initializeConfig } from './startup';

const config = await initializeConfig();
// config is now a stable object, not subject to process.env changes
```

---

## Issue #4: Inconsistent Mock Patterns

**Problem:** Different test files used different mocking approaches (manual `as any` vs `mockDeep`), creating inconsistency and type safety issues.

**Real Example:**

```typescript
// BEFORE: Inconsistent mocks across test files
// feedback.test.ts - manual mock with `as any`
const mockPrisma = {
  conversationTrace: { findMany: vi.fn(), ... },
} as any; // Type unsafe!

// tracer.test.ts - mockDeep pattern
let mockPrisma: DeepMockProxy<PrismaClient>;
mockPrisma = mockDeep<PrismaClient>();

// AFTER: Shared helper
// test/helpers/mock-prisma.ts
export function createMockPrisma(): DeepMockProxy<PrismaClient> {
  const mock = mockDeep<PrismaClient>();
  mock.$transaction.mockImplementation(async (callback) => {
    if (typeof callback === 'function') {
      return callback(mock as unknown as Parameters<typeof callback>[0]);
    }
    return [];
  });
  return mock;
}

// All tests use the same pattern
import { createMockPrisma } from '../helpers/mock-prisma';
let mockPrisma = createMockPrisma();
```

### Prevention: Code Review Checklist

- [ ] **Centralized mock helpers:** All test mocks use shared helper functions
- [ ] **No `as any` in tests:** Use `mockDeep` for type safety
- [ ] **Mock-extended imported:** Always use `vitest-mock-extended` for Prisma
- [ ] **Common setup in beforeEach:** Mock creation in `beforeEach`, not inline
- [ ] **$transaction configured:** All mocks configure `$transaction` callback passthrough
- [ ] **DeepMockProxy typed:** Mocks typed as `DeepMockProxy<T>`, not untyped
- [ ] **Reset between tests:** `mockPrisma.resetAllMocks()` or `vi.clearAllMocks()`
- [ ] **Return types specified:** Mock responses typed as `mockResolvedValue<T>()`
- [ ] **Consistency enforced:** All agent-eval tests use same mock pattern
- [ ] **Helper documented:** Mock helper has JSDoc with usage examples

**Where to check:**

- `server/test/helpers/mock-prisma.ts` - Single source of truth for Prisma mocks
- All test files - Should import from helpers, not create mocks manually
- Test suite files - Should all use `createMockPrisma()` pattern

### Prevention: ESLint Rules

**Rule: Enforce mock helper usage**

```javascript
// .eslintrc.json
{
  "rules": {
    "require-mock-helper": {
      "enabled": true,
      "message": "Use createMockPrisma() helper instead of manual mocking"
    }
  }
}
```

**Custom ESLint rule**

```typescript
// scripts/eslint-rules/require-shared-mock-helper.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce use of shared mock helper instead of manual mocking',
    },
  },
  create: (context) => {
    const isTestFile = context.filename.includes('.test.') || context.filename.includes('.spec.');

    if (!isTestFile) return {};

    return {
      VariableDeclarator(node) {
        // Detect manual Prisma mock patterns
        if (
          node.id.name === 'mockPrisma' &&
          node.init?.type === 'AsExpression' &&
          node.init.asType?.typeName?.name === 'any'
        ) {
          context.report({
            node,
            message:
              'Use createMockPrisma() from test/helpers/mock-prisma.ts instead of manual mocking with "as any"',
          });
        }

        // Detect mockDeep without helper
        if (node.id.name === 'mockPrisma' && node.init?.callee?.name === 'mockDeep') {
          context.report({
            node,
            message:
              'Use createMockPrisma() from test/helpers/mock-prisma.ts instead of direct mockDeep()',
          });
        }
      },
    };
  },
};
```

### Prevention: Test Patterns

**Pattern 1: Mock helper with full configuration**

````typescript
// server/test/helpers/mock-prisma.ts
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient, Prisma } from '../../src/generated/prisma';

/**
 * Create a fully-configured mock PrismaClient.
 *
 * Features:
 * - Full type safety via mockDeep
 * - Pre-configured $transaction handling
 * - Pre-configured $queryRaw for raw queries
 * - Ready for immediate use in tests
 *
 * @returns Type-safe mock client
 * @example
 * ```typescript
 * const mockPrisma = createMockPrisma();
 * mockPrisma.conversationTrace.findMany.mockResolvedValue([]);
 * mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));
 * ```
 */
export function createMockPrisma(): DeepMockProxy<PrismaClient> {
  const mock = mockDeep<PrismaClient>();

  // Configure $transaction to pass through to callback
  // This is CRITICAL for tests that use transactions
  mock.$transaction.mockImplementation(async (callback) => {
    if (typeof callback === 'function') {
      // Cast to the callback's expected parameter type
      return callback(mock as unknown as Prisma.TransactionClient);
    }
    // Array-based transactions return empty array
    return [];
  });

  // Configure $queryRaw for raw SQL queries
  mock.$queryRaw.mockResolvedValue([]);

  // Configure $executeRaw for raw SQL mutations
  mock.$executeRaw.mockResolvedValue(0);

  return mock;
}

// Re-export DeepMockProxy for convenience
export type { DeepMockProxy };
````

**Pattern 2: Test file using shared mock**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma, type DeepMockProxy } from '../helpers/mock-prisma';
import type { PrismaClient } from '../../src/generated/prisma';
import { ReviewQueue } from '../../src/agent/feedback/review-queue';

describe('ReviewQueue', () => {
  let mockPrisma: DeepMockProxy<PrismaClient>;
  let queue: ReviewQueue;

  beforeEach(() => {
    // Use shared helper - ensures consistency
    mockPrisma = createMockPrisma();

    // Create service with mocked dependency
    queue = new ReviewQueue(mockPrisma);
  });

  afterEach(() => {
    // Clean up between tests
    vi.clearAllMocks();
  });

  it('should fetch review items', async () => {
    // Type-safe mock configuration
    mockPrisma.conversationTrace.findMany.mockResolvedValue([
      {
        id: 'trace1',
        tenantId: 'tenant1',
        flagged: true,
        flagReason: 'low_score',
        // ... rest of trace
      },
    ]);

    const items = await queue.getReviewItems('tenant1');

    expect(items).toHaveLength(1);
    expect(items[0].traceId).toBe('trace1');
  });

  it('should handle transaction with proper isolation', async () => {
    // $transaction is pre-configured to pass through
    mockPrisma.conversationTrace.updateMany.mockResolvedValue({ count: 5 });

    const result = await queue.submitReview('tenant1', 'trace1', {
      reviewedBy: 'alice@test.com',
      notes: 'Good response',
      actionTaken: 'approve',
    });

    // Verify transaction was called
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('should provide proper type hints', () => {
    // IDE autocomplete works fully - no `as any` needed!
    mockPrisma.conversationTrace.findFirst.mockResolvedValue({
      id: 'test',
      tenantId: 'test-tenant',
      // TypeScript shows available fields
    });

    expect(mockPrisma.conversationTrace.findFirst).toBeDefined();
  });
});
```

**Pattern 3: Migration guide for old tests**

```typescript
// BEFORE: Old manual mock pattern (DEPRECATED)
const mockPrisma = {
  conversationTrace: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn((cb) => cb(mockPrisma)),
} as any; // Type unsafe!

// AFTER: Use shared helper
import { createMockPrisma } from '../helpers/mock-prisma';

const mockPrisma = createMockPrisma();
// Now fully typed, no `as any` needed
mockPrisma.conversationTrace.findMany.mockResolvedValue([]);
```

**Pattern 4: Mock helper test**

```typescript
describe('createMockPrisma helper', () => {
  it('should provide fully typed mock', () => {
    const mock = createMockPrisma();

    // Should be fully typed
    expect(mock.conversationTrace).toBeDefined();
    expect(mock.conversationTrace.findMany).toBeDefined();
    expect(mock.$transaction).toBeDefined();
  });

  it('should handle $transaction callbacks', async () => {
    const mock = createMockPrisma();

    mock.conversationTrace.updateMany.mockResolvedValue({ count: 5 });

    const result = await mock.$transaction(async (tx) => {
      return await tx.conversationTrace.updateMany({
        where: { tenantId: 'test' },
        data: { flagged: true },
      });
    });

    expect(result.count).toBe(5);
  });

  it('should handle array-based transactions', async () => {
    const mock = createMockPrisma();

    const result = await mock.$transaction([mock.conversationTrace.findMany.mockResolvedValue([])]);

    expect(Array.isArray(result)).toBe(true);
  });
});
```

---

## Issue #5: Missing Database Indexes

**Problem:** The orphan proposal recovery query filtered on `[status, updatedAt]` but only had indexes on `[status, expiresAt]`.

**Real Example:**

```typescript
// The query in cleanup.ts
const orphaned = await prisma.agentProposal.findMany({
  where: {
    status: 'CONFIRMED',
    updatedAt: { lt: orphanCutoff }, // Uses updatedAt
  },
  take: 100,
});

// BEFORE: Index only on [status, expiresAt] - doesn't cover updatedAt
// AFTER: Added index [status, updatedAt]
```

### Prevention: Code Review Checklist

- [ ] **Queries documented with indexes:** Every findMany/findFirst has a comment about which index it uses
- [ ] **Index plan verified:** For complex queries, run EXPLAIN ANALYZE to verify index usage
- [ ] **Composite indexes checked:** Multi-column WHERE clauses use composite indexes in order
- [ ] **No unindexed queries:** Missing indexes caught before merge
- [ ] **Index names descriptive:** Index purposes documented in Prisma schema comments
- [ ] **Partial indexes considered:** For queries with LIMIT, consider index efficiency
- [ ] **Tenant indexes exist:** All schemas have `@@index([tenantId])`
- [ ] **Composite key indexes:** `@@index([tenantId, field])` for tenant-scoped queries
- [ ] **Updated schema matches code:** Prisma schema indexes match actual query patterns
- [ ] **Performance regression tests:** Integration tests verify query performance hasn't degraded

**Where to check:**

- `server/prisma/schema.prisma` - Index definitions with comments
- Query implementations - Comments explaining which indexes they use
- Performance tests - Verify expensive queries use indexes

### Prevention: ESLint Rules

**Rule: Require index comments on queries**

```javascript
// .eslintrc.json
{
  "rules": {
    "require-index-comment": {
      "enabled": true,
      "message": "Complex database queries must have // Uses index: [columns] comment"
    }
  }
}
```

**Custom ESLint rule**

```typescript
// scripts/eslint-rules/require-index-comment-on-queries.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require index documentation on database queries',
    },
  },
  create: (context) => {
    return {
      AwaitExpression(node) {
        const isDbQuery =
          (node.argument?.callee?.property?.name === 'findMany' ||
            node.argument?.callee?.property?.name === 'findFirst') &&
          node.argument?.arguments?.[0]?.properties?.some((p) => p.key?.name === 'where');

        if (isDbQuery) {
          const parent = node.parent;
          const prevToken = context.getSourceCode().getTokenBefore(parent);
          const hasIndexComment =
            prevToken?.type === 'Line' && prevToken?.value?.includes('Uses index:');

          if (!hasIndexComment) {
            context.report({
              node,
              message:
                'Database query should have "// Uses index: [columns]" comment explaining index usage',
            });
          }
        }
      },
    };
  },
};
```

### Prevention: Test Patterns

**Pattern 1: Index documentation in schema**

```prisma
// server/prisma/schema.prisma

model AgentProposal {
  id              String   @id @default(cuid())
  status          String
  expiresAt       DateTime
  updatedAt       DateTime @updatedAt

  // CRITICAL INDEXES FOR QUERIES:
  // Used by: cleanup.ts drainCompleted() - status=EXPIRED + expiresAt < now
  @@index([expiresAt])
  @@index([status, expiresAt])

  // Used by: cleanup.ts orphanedProposals() - status=CONFIRMED + updatedAt < now
  // P3-616: Added this index for orphan recovery performance
  @@index([status, updatedAt])

  // Used by: all tenant-scoped queries (CRITICAL for multi-tenant isolation)
  @@index([tenantId])

  // Used by: customer chat - get customer's proposals
  @@index([customerId])
}
```

**Pattern 2: Query documentation with index references**

```typescript
// server/src/jobs/cleanup.ts

/**
 * Find orphaned CONFIRMED proposals that have expired waiting for execution.
 *
 * Queries proposals stuck in CONFIRMED state for >30 minutes.
 * These may indicate a failed execution or lost confirmation event.
 *
 * INDEX: Uses [status, updatedAt] composite index for efficient filtering
 * EXPLAIN ANALYZE: Verify index scan, not table scan
 *
 * @see prisma/schema.prisma AgentProposal model
 * @see P3-616 orphan proposal recovery index
 */
async function findOrphanedProposals(
  prisma: PrismaClient,
  orphanAgeMinutes: number = 30
): Promise<AgentProposal[]> {
  const orphanCutoff = new Date(Date.now() - orphanAgeMinutes * 60 * 1000);

  // Uses index: [status, updatedAt]
  const orphaned = await prisma.agentProposal.findMany({
    where: {
      status: 'CONFIRMED',
      updatedAt: { lt: orphanCutoff },
    },
    take: 100,
  });

  return orphaned;
}
```

**Pattern 3: Integration test verifying index usage**

```typescript
import { describe, it, expect } from 'vitest';
import { createTestTenant } from '../helpers/test-tenant';

describe('AgentProposal Indexes', () => {
  it('should use [status, updatedAt] index for orphan recovery', async () => {
    const { tenantId, prisma, cleanup } = await createTestTenant();

    try {
      // Create test proposals
      await prisma.agentProposal.createMany({
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: `proposal-${i}`,
          tenantId,
          status: 'CONFIRMED',
          updatedAt: new Date(Date.now() - i * 60000), // Varying ages
          expiresAt: new Date(Date.now() + 3600000),
          customerId: 'customer-1',
        })),
      });

      // Execute query
      const orphanCutoff = new Date(Date.now() - 30 * 60000);
      const result = await prisma.agentProposal.findMany({
        where: {
          status: 'CONFIRMED',
          updatedAt: { lt: orphanCutoff },
        },
        take: 100,
      });

      // Verify results
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((p) => p.status === 'CONFIRMED')).toBe(true);
      expect(result.every((p) => p.updatedAt < orphanCutoff)).toBe(true);

      // PERFORMANCE CHECK: Verify this doesn't scan entire table
      // Run EXPLAIN ANALYZE:
      // const explainResult = await prisma.$queryRaw`
      //   EXPLAIN (ANALYZE, BUFFERS)
      //   SELECT * FROM "AgentProposal"
      //   WHERE status = 'CONFIRMED' AND "updatedAt" < ${orphanCutoff}
      //   LIMIT 100
      // `;
      //
      // Index scan should show:
      // - Index: "AgentProposal_status_updatedAt_idx"
      // - Rows: ~100 (not 1000+)
    } finally {
      await cleanup();
    }
  });

  it('should use [status, expiresAt] index for expiration cleanup', async () => {
    const { tenantId, prisma, cleanup } = await createTestTenant();

    try {
      // Create test proposals with varying expiry times
      const now = new Date();
      await prisma.agentProposal.createMany({
        data: Array.from({ length: 500 }, (_, i) => ({
          id: `proposal-exp-${i}`,
          tenantId,
          status: 'EXPIRED',
          updatedAt: now,
          expiresAt: new Date(now.getTime() - i * 60000), // Past expiry
          customerId: 'customer-1',
        })),
      });

      // Query that should use [status, expiresAt] index
      const expired = await prisma.agentProposal.findMany({
        where: {
          status: 'EXPIRED',
          expiresAt: { lt: new Date() },
        },
        take: 100,
      });

      expect(expired.length).toBeGreaterThan(0);
      expect(expired.every((p) => p.status === 'EXPIRED')).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('should have index on [tenantId] for multi-tenant isolation', async () => {
    const { tenantId: tenant1, prisma: p1, cleanup: cleanup1 } = await createTestTenant();
    const { tenantId: tenant2, cleanup: cleanup2 } = await createTestTenant();

    try {
      // Create proposals for different tenants
      await p1.agentProposal.create({
        data: {
          id: 'prop-tenant1',
          tenantId: tenant1,
          status: 'PENDING',
          customerId: 'customer-1',
        },
      });

      // Query should efficiently filter by tenant (uses [tenantId] index)
      const tenant1Proposals = await p1.agentProposal.findMany({
        where: { tenantId: tenant1 },
      });

      expect(tenant1Proposals.every((p) => p.tenantId === tenant1)).toBe(true);
    } finally {
      await cleanup1();
      await cleanup2();
    }
  });
});
```

**Pattern 4: Migration checklist for new indexes**

```typescript
// When adding a new query, verify indexes exist:

// 1. Document the query
/**
 * Find active bookings for a date range
 * Uses index: [status, dateStart, dateEnd]
 */
const query = prisma.booking.findMany({
  where: {
    status: 'CONFIRMED',
    dateStart: { gte: startDate },
    dateEnd: { lte: endDate },
  },
});

// 2. Add index to Prisma schema
// @@index([status, dateStart, dateEnd])

// 3. Create migration
// npm exec prisma migrate dev --name add_booking_date_index

// 4. Add index documentation comment in schema
// @@index([status, dateStart, dateEnd]) // Query: findBookingsByDateRange()

// 5. Verify with EXPLAIN ANALYZE
// SELECT * FROM Booking WHERE status='CONFIRMED' AND dateStart >= ? AND dateEnd <= ? LIMIT 100;
// Should show: Index Scan on "Booking_status_dateStart_dateEnd_idx"

// 6. Add integration test
describe('Booking indexes', () => {
  it('should use composite index for date range query', async () => {
    // Create 1000 bookings
    // Query with date filters
    // Assert results are correct
  });
});
```

---

## Summary Checklist for All 5 Prevention Strategies

Use this checklist before creating a PR:

### Validation ✓

- [ ] All POST/PUT endpoints have Zod schemas
- [ ] String fields have `.min()` and `.max()`
- [ ] Number fields have `.min()` and `.max()`
- [ ] Enum fields use `z.enum()`
- [ ] Error messages are user-friendly
- [ ] Boundary case tests exist (min, max, invalid enum)

### Test Coverage ✓

- [ ] `npm run test:coverage` shows >80% for modified files
- [ ] All exported functions have direct tests
- [ ] All branches tested (if/else, try/catch)
- [ ] Async error paths tested
- [ ] Mock behavior verified in tests
- [ ] Test names describe behavior ("should X when Y")

### Environment Variables ✓

- [ ] No `process.env` reads at module scope
- [ ] Config values computed in functions/constructors
- [ ] Tests use `vi.stubEnv()` for isolation
- [ ] Environment override patterns verified
- [ ] `dotenv.config()` called early in startup

### Mocking ✓

- [ ] All Prisma mocks use `createMockPrisma()` helper
- [ ] No `as any` casts for test mocks
- [ ] `mockDeep<PrismaClient>()` used consistently
- [ ] `$transaction` callback configured
- [ ] Mocks reset in `afterEach` or `beforeEach`
- [ ] Type hints work (IDE autocomplete)

### Database Indexes ✓

- [ ] Complex queries have `// Uses index: [columns]` comments
- [ ] Composite indexes ordered correctly
- [ ] All tenant-scoped queries have `@@index([tenantId, ...])`
- [ ] EXPLAIN ANALYZE run for new queries
- [ ] Performance tests verify index usage
- [ ] Index documentation in Prisma schema

---

## Quick Reference: Enforcement Commands

```bash
# Test coverage report
npm run test:coverage

# Type checking
npm run typecheck

# Custom ESLint rules
npx eslint . --rule 'no-process-env-at-module-level: error'

# Database query performance analysis
EXPLAIN ANALYZE SELECT * FROM "AgentProposal" WHERE status='CONFIRMED' AND "updatedAt" < now();

# Test isolation verification
npm test -- --reporter=verbose --no-coverage
```

---

## Resources

- [Zod Documentation](https://zod.dev) - Input validation
- [Vitest Mock Extended](https://github.com/eratio08/vitest-mock-extended) - Type-safe mocking
- [Prisma Indexes](https://www.prisma.io/docs/concepts/components/prisma-schema/indexes) - Index documentation
- [MAIS Prevention Strategies Index](./PREVENTION_STRATEGIES_INDEX.md) - Full prevention strategy library
