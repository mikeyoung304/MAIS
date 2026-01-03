# P2/P3 Prevention - ESLint Rules

Custom ESLint rules to prevent the 5 P2/P3 issues from recurring.

---

## Setup

1. Add rules to your ESLint configuration
2. Enable rules in `.eslintrc.json`
3. Run `npm run lint` to check for violations

---

## Rule 1: No Module-Level Environment Variable Access

**Purpose:** Prevent reading `process.env` at module import time (Issue #3)

**File:** `scripts/eslint-rules/no-module-scope-env.js`

```javascript
/**
 * ESLint rule: no-module-scope-env
 *
 * Prevents process.env reads at module scope, which can cause test
 * isolation issues. Environment variables should be read inside
 * functions/constructors (at call time), not at module scope.
 *
 * WRONG:
 *   const API_KEY = process.env.API_KEY;
 *   const { model } = process.env.EVAL_MODEL || 'default';
 *
 * RIGHT:
 *   function getApiKey() { return process.env.API_KEY; }
 *   const getConfig = () => ({ model: process.env.EVAL_MODEL || 'default' });
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent process.env reads at module scope to ensure test isolation',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
  },

  create(context) {
    let currentFunction = null;
    let functionDepth = 0;

    return {
      // Track when we're inside a function
      FunctionDeclaration(node) {
        functionDepth++;
        currentFunction = node;
      },
      'FunctionDeclaration:exit'() {
        functionDepth--;
        if (functionDepth === 0) currentFunction = null;
      },
      FunctionExpression(node) {
        functionDepth++;
        currentFunction = node;
      },
      'FunctionExpression:exit'() {
        functionDepth--;
        if (functionDepth === 0) currentFunction = null;
      },
      ArrowFunctionExpression(node) {
        functionDepth++;
        currentFunction = node;
      },
      'ArrowFunctionExpression:exit'() {
        functionDepth--;
        if (functionDepth === 0) currentFunction = null;
      },

      // Check for process.env access
      MemberExpression(node) {
        // Skip if we're inside a function
        if (functionDepth > 0) return;

        // Check for process.env pattern
        if (node.object?.name === 'process' && node.property?.name === 'env') {
          context.report({
            node,
            message:
              'process.env must not be read at module scope. ' +
              'Use a factory function (e.g., getConfig()) to defer evaluation to call time. ' +
              'See todos/614-done-p2-env-var-load-time.md',
          });
        }
      },
    };
  },
};
```

**Usage in `.eslintrc.json`:**

```json
{
  "rules": {
    "no-module-scope-env": "error"
  }
}
```

---

## Rule 2: Require Zod Validation for Input Interfaces

**Purpose:** Ensure all request input types have corresponding Zod schemas (Issue #1)

**File:** `scripts/eslint-rules/require-zod-validation.js`

```javascript
/**
 * ESLint rule: require-zod-validation
 *
 * Ensures that interface/type definitions for request inputs have
 * corresponding Zod schemas for validation.
 *
 * WRONG:
 *   export interface ReviewSubmission {
 *     reviewedBy: string;
 *     notes: string;
 *   }
 *
 * RIGHT:
 *   export const ReviewSubmissionSchema = z.object({
 *     reviewedBy: z.string().min(1).max(100),
 *     notes: z.string().max(2000),
 *   });
 *   export type ReviewSubmission = z.infer<typeof ReviewSubmissionSchema>;
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require Zod schema validation for input interfaces',
      category: 'Security',
      recommended: true,
    },
    fixable: null,
  },

  create(context) {
    const filename = context.filename;

    // Only check interfaces/types in contracts or service files
    if (
      !filename.includes('contracts') &&
      !filename.includes('routes') &&
      !filename.includes('services')
    ) {
      return {};
    }

    return {
      TSTypeAliasDeclaration(node) {
        // Skip test files
        if (filename.includes('.test.') || filename.includes('.spec.')) {
          return;
        }

        const interfaceName = node.id.name;

        // Only flag input-like names (Request, Submission, Input, Params, Payload)
        const isInputType = /Request|Submission|Input|Params|Payload|Command|Mutation|Body/i.test(
          interfaceName
        );

        if (!isInputType) return;

        // Check if corresponding schema exists
        const expectedSchemaName = interfaceName.replace(/Type|Interface/, '') + 'Schema';
        const sourceCode = context.getSourceCode();
        const allNodes = sourceCode.ast.body;

        const schemaExists = allNodes.some(
          (n) =>
            n.type === 'VariableDeclaration' &&
            n.declarations.some((d) => d.id.name === expectedSchemaName)
        );

        if (!schemaExists) {
          context.report({
            node,
            message:
              `Input type "${interfaceName}" should have a corresponding Zod schema ` +
              `named "${expectedSchemaName}". ` +
              'See todos/612-done-p2-review-submission-input-validation.md',
          });
        }
      },

      TSInterfaceDeclaration(node) {
        // Skip test files
        if (filename.includes('.test.') || filename.includes('.spec.')) {
          return;
        }

        const interfaceName = node.id.name;

        // Only flag input-like names
        const isInputType = /Request|Submission|Input|Params|Payload|Command|Mutation|Body/i.test(
          interfaceName
        );

        if (!isInputType) return;

        // Check if corresponding schema exists
        const expectedSchemaName = interfaceName.replace(/Interface/, '') + 'Schema';
        const sourceCode = context.getSourceCode();
        const allNodes = sourceCode.ast.body;

        const schemaExists = allNodes.some(
          (n) =>
            n.type === 'VariableDeclaration' &&
            n.declarations.some((d) => d.id.name === expectedSchemaName)
        );

        if (!schemaExists) {
          context.report({
            node,
            message:
              `Input interface "${interfaceName}" should have a corresponding Zod schema ` +
              `named "${expectedSchemaName}". ` +
              'See todos/612-done-p2-review-submission-input-validation.md',
          });
        }
      },
    };
  },
};
```

**Usage in `.eslintrc.json`:**

```json
{
  "rules": {
    "require-zod-validation": "warn"
  }
}
```

---

## Rule 3: Enforce Shared Mock Helper Usage

**Purpose:** Ensure all tests use `createMockPrisma()` instead of manual mocks (Issue #4)

**File:** `scripts/eslint-rules/require-mock-helper.js`

```javascript
/**
 * ESLint rule: require-mock-helper
 *
 * Enforces use of createMockPrisma() helper instead of manual mocking,
 * ensuring consistency and type safety across test files.
 *
 * WRONG:
 *   const mockPrisma = { user: { findMany: vi.fn() } } as any;
 *   let mockPrisma = mockDeep<PrismaClient>();
 *
 * RIGHT:
 *   import { createMockPrisma } from '../helpers/mock-prisma';
 *   const mockPrisma = createMockPrisma();
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require use of createMockPrisma() helper in tests',
      category: 'Testing',
      recommended: true,
    },
    fixable: null,
  },

  create(context) {
    const filename = context.filename;

    // Only check test files
    if (!filename.includes('.test.') && !filename.includes('.spec.')) {
      return {};
    }

    return {
      VariableDeclarator(node) {
        // Check for manual Prisma mocks
        const isMockPrismaVar =
          node.id.name === 'mockPrisma' || node.id.name?.includes('PrismaMock');

        if (!isMockPrismaVar) return;

        // Flag manual object with as any
        if (
          node.init?.type === 'TSAsExpression' &&
          node.init.typeAnnotation?.type?.name === 'any'
        ) {
          context.report({
            node,
            message:
              'Use createMockPrisma() from test/helpers/mock-prisma.ts ' +
              'instead of manual mocking with "as any". ' +
              'See todos/615-done-p3-mock-pattern-inconsistency.md',
          });
        }

        // Flag direct mockDeep usage
        if (
          node.init?.callee?.name === 'mockDeep' ||
          (node.init?.type === 'CallExpression' && node.init?.callee?.property?.name === 'mockDeep')
        ) {
          context.report({
            node,
            message:
              'Use createMockPrisma() from test/helpers/mock-prisma.ts ' +
              'instead of direct mockDeep() calls. ' +
              'See todos/615-done-p3-mock-pattern-inconsistency.md',
          });
        }
      },
    };
  },
};
```

**Usage in `.eslintrc.json`:**

```json
{
  "rules": {
    "require-mock-helper": "error"
  }
}
```

---

## Rule 4: Require Index Comments on Complex Queries

**Purpose:** Ensure database queries document their index usage (Issue #5)

**File:** `scripts/eslint-rules/require-index-comment.js`

```javascript
/**
 * ESLint rule: require-index-comment
 *
 * Requires database queries with multiple WHERE conditions to have
 * a comment explaining which indexes they use.
 *
 * WRONG:
 *   const results = await prisma.table.findMany({
 *     where: { status: 'PENDING', updatedAt: { lt: date } },
 *   });
 *
 * RIGHT:
 *   // Uses index: [status, updatedAt]
 *   const results = await prisma.table.findMany({
 *     where: { status: 'PENDING', updatedAt: { lt: date } },
 *   });
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require index documentation comments on complex database queries',
      category: 'Performance',
      recommended: true,
    },
    fixable: null,
  },

  create(context) {
    const filename = context.filename;

    // Skip test files
    if (filename.includes('.test.') || filename.includes('.spec.')) {
      return {};
    }

    return {
      AwaitExpression(node) {
        const call = node.argument;

        // Check for findMany or findFirst calls
        if (
          call?.type !== 'CallExpression' ||
          !call?.callee?.property ||
          !['findMany', 'findFirst', 'findUnique', 'count'].includes(call.callee.property.name)
        ) {
          return;
        }

        // Check if query has multiple WHERE conditions
        const whereArg = call.arguments[0];
        if (!whereArg?.properties) return;

        const whereProperty = whereArg.properties.find((p) => p.key?.name === 'where');
        if (!whereProperty) return;

        // Count conditions in WHERE clause
        const conditionCount = whereProperty.value?.properties?.length || 0;

        // Only flag queries with 2+ conditions (complex queries)
        if (conditionCount < 2) return;

        // Check for index comment
        const sourceCode = context.getSourceCode();
        const prevToken = sourceCode.getTokenBefore(node);
        const hasIndexComment =
          prevToken?.type === 'Line' && prevToken?.value?.includes('Uses index:');

        if (!hasIndexComment) {
          context.report({
            node,
            message:
              'Complex database query (2+ WHERE conditions) should have ' +
              '"// Uses index: [column1, column2]" comment explaining index usage. ' +
              'See todos/616-done-p3-orphan-proposal-recovery-index.md',
          });
        }
      },
    };
  },
};
```

**Usage in `.eslintrc.json`:**

```json
{
  "rules": {
    "require-index-comment": "warn"
  }
}
```

---

## Rule 5: Enforce Test Coverage for Exports

**Purpose:** Ensure exported functions have test files (Issue #2)

**File:** `scripts/eslint-rules/require-test-file.js`

```javascript
/**
 * ESLint rule: require-test-file
 *
 * Ensures that all modules with exports have a corresponding .test.ts
 * or .spec.ts file.
 *
 * WRONG:
 *   // src/services/booking.service.ts
 *   export async function createBooking() { ... }
 *   // No booking.service.test.ts exists!
 *
 * RIGHT:
 *   // src/services/booking.service.ts
 *   export async function createBooking() { ... }
 *   // test/services/booking.service.test.ts exists
 *   describe('createBooking', () => { ... })
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require test files for all exported functions',
      category: 'Testing',
      recommended: true,
    },
    fixable: null,
  },

  create(context) {
    const filename = context.filename;

    // Skip test files themselves
    if (filename.includes('.test.') || filename.includes('.spec.')) {
      return {};
    }

    // Skip files that don't export anything
    return {
      ExportNamedDeclaration(node) {
        // Only check if something is actually exported
        if (!node.declaration) return;

        // Determine expected test file path
        const testFileOptions = [
          filename.replace(/\.ts$/, '.test.ts'),
          filename.replace(/\.ts$/, '.spec.ts'),
          filename.replace(/src\//, 'test/').replace(/\.ts$/, '.test.ts'),
        ];

        const testFileExists = testFileOptions.some((testFile) => {
          return fs.existsSync(path.join(__dirname, '..', '..', testFile));
        });

        if (!testFileExists) {
          const relativeFile = filename.split('src/')[1] || filename;
          context.report({
            node,
            message:
              `File "${relativeFile}" exports functions but has no corresponding .test.ts or .spec.ts file. ` +
              'See todos/613-done-p2-test-coverage-gaps.md',
          });
        }
      },
    };
  },
};
```

**Usage in `.eslintrc.json`:**

```json
{
  "rules": {
    "require-test-file": "warn"
  }
}
```

---

## Complete ESLint Configuration

**File:** `.eslintrc.json`

```json
{
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "rules": {
    // P2/P3 prevention rules
    "no-module-scope-env": "error",
    "require-zod-validation": "warn",
    "require-mock-helper": "error",
    "require-index-comment": "warn",
    "require-test-file": "warn",

    // Standard ESLint rules
    "no-console": "warn",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    "@typescript-eslint/explicit-function-return-types": "warn",
    "@typescript-eslint/no-explicit-any": "warn"
  },
  "overrides": [
    {
      "files": ["*.test.ts", "*.spec.ts"],
      "rules": {
        "require-zod-validation": "off",
        "require-index-comment": "off"
      }
    }
  ]
}
```

---

## Integration with GitHub Actions

**File:** `.github/workflows/lint-p2-p3.yml`

```yaml
name: P2/P3 Prevention Lint

on: [pull_request, push]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Run P2/P3 prevention lints
        run: |
          npx eslint . \
            --rule 'no-module-scope-env: error' \
            --rule 'require-zod-validation: warn' \
            --rule 'require-mock-helper: error' \
            --rule 'require-index-comment: warn' \
            --rule 'require-test-file: warn'

      - name: Comment on PR
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ P2/P3 prevention lint failures detected. See [prevention guide](docs/solutions/patterns/P2_P3_REMEDIATION_PREVENTION_STRATEGIES.md)'
            })
```

---

## Running the Rules

```bash
# Check all rules
npm run lint

# Check specific rule
npx eslint . --rule 'no-module-scope-env: error'

# Fix automatically (where applicable)
npx eslint . --fix

# Show only P2/P3 violations
npx eslint . --plugin 'scripts/eslint-rules/*'

# In CI/CD
npm run lint -- --max-warnings 0
```

---

## Summary

These 5 ESLint rules catch the P2/P3 issues before code review:

1. **no-module-scope-env** - Prevents env read timing issues
2. **require-zod-validation** - Ensures input validation schemas exist
3. **require-mock-helper** - Enforces consistent mocking patterns
4. **require-index-comment** - Documents database query indexes
5. **require-test-file** - Ensures exported functions are tested

Use as part of your CI/CD to maintain code quality!
