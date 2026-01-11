---
module: MAIS
type: tooling
date: 2026-01-02
tags: [eslint, agent-eval, code-quality]
---

# ESLint Rules for P2 Agent Evaluation Prevention

**Purpose:** Catch the 4 P2 patterns automatically instead of in code review.

**Impact:** Early detection of:

- Missing tenantId in queries (Issue 603)
- Silent test skips (Issue 607)
- Duplicated DI code (Issue 605)
- Hand-rolled argument parsing (Issue 606)

---

## Recommended Rules

### 1. Detect Silent Test Skips (Issue 607)

**Goal:** Prevent `if (!x) return;` in test files.

```javascript
// eslint.config.js (ESLint v9+) or eslint-plugin-jest config

{
  files: ['**/test/**/*.{ts,tsx}', '**/*.test.ts', '**/*.spec.ts'],
  rules: {
    // Flag early returns that look like skip guards
    'no-unreachable': 'error',

    // Flag suspicious conditional returns in test blocks
    'jest/no-disabled-tests': 'warn',  // Requires eslint-plugin-jest
    'jest/no-skipped-tests': 'off',    // We use skipIf() instead

    // Custom rule: detect "if (!x) return;" pattern
    // Add to custom plugin (see below)
  },
}
```

**Custom Rule for Silent Skips:**

```typescript
// eslint-rules/no-silent-test-skips.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent silent test skips with early returns',
      category: 'Testing',
    },
  },
  create(context) {
    return {
      IfStatement(node) {
        // Check if inside test function
        const sourceCode = context.sourceCode;
        const parent = sourceCode.getParent(node);

        if (!parent || parent.type !== 'FunctionExpression') return;

        // Check if it's a call to `it()` or `describe()`
        const grandparent = sourceCode.getParent(parent);
        if (
          !grandparent ||
          !['it', 'describe', 'test', 'skip'].some((name) => grandparent.callee?.name === name)
        )
          return;

        // Check if body is a simple return
        if (
          node.consequent.type === 'ReturnStatement' ||
          (node.consequent.type === 'BlockStatement' &&
            node.consequent.body.length === 1 &&
            node.consequent.body[0].type === 'ReturnStatement')
        ) {
          context.report({
            node,
            message: 'Use it.skipIf() instead of early return to make skips visible in CI',
            fix(fixer) {
              return null; // Manual fix suggested
            },
          });
        }
      },
    };
  },
};
```

**Usage in Config:**

```javascript
// eslint.config.js
import noSilentTestSkips from './eslint-rules/no-silent-test-skips.js';

export default [
  {
    files: ['**/test/**/*.ts', '**/*.test.ts'],
    plugins: {
      custom: { rules: { 'no-silent-test-skips': noSilentTestSkips } },
    },
    rules: {
      'custom/no-silent-test-skips': 'error',
    },
  },
];
```

---

### 2. Detect Duplicated DI Code (Issue 605)

**Goal:** Flag identical code blocks in di.ts or initialization files.

```javascript
// eslint.config.js

{
  files: ['**/di.ts', '**/container.ts', '**/bootstrap.ts'],
  rules: {
    // Flag complex duplications
    'no-duplicate-string': ['warn', {
      threshold: 2,  // Flag if 2+ occurrences
      ignoreInifferentContexts: false,
    }],

    // Flag high complexity (sign of duplication)
    'complexity': ['warn', { max: 12 }],

    // Flag functions that are too long
    'max-lines-per-function': ['warn', { max: 50 }],

    // Custom rule: detect repeated "createX()" patterns
  },
}
```

**Custom Rule for DI Duplication:**

```typescript
// eslint-rules/no-duplicated-di-initialization.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent duplicated DI initialization patterns',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const assignmentPatterns = {};

    return {
      VariableDeclarator(node) {
        if (node.init?.type === 'CallExpression') {
          const calleeName = node.init.callee?.name;
          const varName = node.id?.name;

          if (!calleeName || !varName) return;

          // Track patterns like: const evaluator = createEvaluator()
          const key = `${varName}=${calleeName}`;
          if (!assignmentPatterns[key]) {
            assignmentPatterns[key] = [];
          }
          assignmentPatterns[key].push(node);
        }
      },

      'Program:exit'() {
        // Report if same pattern appears 2+ times
        for (const [pattern, occurrences] of Object.entries(assignmentPatterns)) {
          if (occurrences.length > 1) {
            occurrences.slice(1).forEach((node) => {
              context.report({
                node,
                message: `DI pattern '${pattern}' duplicated. Consider extracting to helper function.`,
              });
            });
          }
        }
      },
    };
  },
};
```

---

### 3. Detect Manual Argument Parsing (Issue 606)

**Goal:** Flag hand-rolled CLI parsing in favor of node:util parseArgs.

```javascript
// eslint.config.js

{
  files: ['**/scripts/**/*.ts', '**/*.cli.ts'],
  rules: {
    // Flag manual string splitting on arguments
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.property.name='split'][arguments.0.value='=']",
        message: 'Use node:util parseArgs() instead of manual argument parsing',
      },
    ],

    // Flag direct access to process.argv
    'no-restricted-globals': [
      'error',
      {
        name: 'process.argv',
        message: 'Use node:util parseArgs() for CLI arguments',
      },
    ],
  },
}
```

---

### 4. Detect Tenant Isolation Issues (Issue 603)

**Goal:** Flag database queries without tenantId filter.

**Note:** This requires custom rule or database-aware linting (more complex).

```typescript
// eslint-rules/require-tenant-id-in-queries.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require tenantId in all Prisma queries',
    },
  },
  create(context) {
    return {
      // Detect prisma.model.findMany|findFirst|count calls
      CallExpression(node) {
        const sourceCode = context.sourceCode;

        // Check if this is a prisma query method
        const isPrismaQuery =
          node.callee?.object?.object?.name === 'prisma' &&
          ['findMany', 'findFirst', 'findUnique', 'count'].includes(node.callee?.property?.name);

        if (!isPrismaQuery) return;

        // Check if first argument contains { where: { tenantId } }
        const whereArg = node.arguments?.[0];
        if (!whereArg || whereArg.type !== 'ObjectExpression') return;

        const whereProperty = whereArg.properties?.find((p) => p.key?.name === 'where');

        if (!whereProperty || whereProperty.value?.type !== 'ObjectExpression') {
          context.report({
            node,
            message: 'Prisma query missing WHERE clause with tenantId',
          });
          return;
        }

        const tenantIdExists = whereProperty.value.properties?.some(
          (p) => p.key?.name === 'tenantId'
        );

        if (!tenantIdExists) {
          context.report({
            node,
            message: 'Prisma query WHERE clause missing tenantId (defense-in-depth rule)',
            suggest: [
              {
                desc: 'Add tenantId to WHERE clause',
                output: node.sourceCode, // Would need proper transformation
              },
            ],
          });
        }
      },
    };
  },
};
```

---

## Complete ESLint Configuration

```javascript
// eslint.config.js - Comprehensive setup

import js from '@eslint/js';
import ts from 'typescript-eslint';
import noSilentTestSkips from './eslint-rules/no-silent-test-skips.js';
import noDuplicatedDi from './eslint-rules/no-duplicated-di-initialization.js';
import requireTenantId from './eslint-rules/require-tenant-id-in-queries.js';

export default [
  js.configs.recommended,
  ...ts.configs.recommended,

  // ========================================================================
  // TEST FILES
  // ========================================================================
  {
    files: ['**/test/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      // Prevent silent test skips
      'custom/no-silent-test-skips': 'error',

      // Flag disabled tests
      'no-unreachable': 'error',
    },
  },

  // ========================================================================
  // DEPENDENCY INJECTION FILES
  // ========================================================================
  {
    files: ['**/di.ts', '**/container.ts', '**/bootstrap.ts'],
    rules: {
      // Flag duplicated patterns
      'custom/no-duplicated-di-initialization': 'warn',

      // Flag complexity (sign of duplication)
      complexity: ['warn', { max: 12 }],

      // Flag long functions
      'max-lines-per-function': ['warn', { max: 60 }],

      // No duplicate strings
      'no-duplicate-string': ['warn', { threshold: 2 }],
    },
  },

  // ========================================================================
  // CLI SCRIPTS
  // ========================================================================
  {
    files: ['**/scripts/**/*.ts', '**/*.cli.ts'],
    rules: {
      // Require Zod validation
      // (Would need custom rule to detect)

      // Flag manual argument parsing
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='values'][property.name='tenant-id']",
          message: 'Use Zod for validation: z.string().uuid().safeParse()',
        },
      ],

      // Flag direct process.argv access
      'no-restricted-globals': [
        'error',
        {
          name: 'process.argv',
          message: 'Use node:util parseArgs() instead',
        },
      ],
    },
  },

  // ========================================================================
  // DATABASE/SERVICE FILES
  // ========================================================================
  {
    files: ['**/adapters/prisma/**/*.ts', '**/repositories/**/*.ts', '**/services/**/*.ts'],
    rules: {
      // Require tenantId in queries
      'custom/require-tenant-id-in-queries': 'warn',

      // Avoid unsafe assertions
      'no-non-null-assertion': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // ========================================================================
  // CUSTOM PLUGIN SETUP
  // ========================================================================
  {
    plugins: {
      custom: {
        rules: {
          'no-silent-test-skips': noSilentTestSkips,
          'no-duplicated-di-initialization': noDuplicatedDi,
          'require-tenant-id-in-queries': requireTenantId,
        },
      },
    },
  },
];
```

---

## Installation & Setup

```bash
# 1. Install ESLint v9+ (if not already)
npm install --save-dev eslint@9+ eslint-plugin-jest

# 2. Copy custom rule files
mkdir -p server/eslint-rules
cp eslint-rules/*.js server/eslint-rules/

# 3. Update eslint.config.js (or create if missing)
# See complete configuration above

# 4. Run linter
npm run lint

# 5. Fix auto-fixable issues
npm run lint -- --fix
```

---

## Pre-Commit Hook Integration

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run ESLint on staged files
npx lint-staged
```

Add to `package.json`:

```json
{
  "lint-staged": {
    "server/src/**/*.ts": ["eslint --fix", "prettier --write"],
    "server/src/di.ts": [
      "eslint --fix",
      "eslint --rule 'custom/no-duplicated-di-initialization: error'"
    ],
    "server/test/**/*.ts": ["eslint --fix", "eslint --rule 'custom/no-silent-test-skips: error'"]
  }
}
```

---

## Running Custom Rules

```bash
# Test specific rule
npm run lint -- --rule "custom/no-silent-test-skips: error" server/test/

# Get detailed output
npm run lint -- --format json | jq '.[] | select(.ruleId | contains("custom"))'

# Fix specific rule violations
npm run lint -- --fix --rule "custom/no-duplicated-di-initialization: error"
```

---

## CI Configuration

Add to `.github/workflows/lint.yml`:

```yaml
name: Lint

on: [push, pull_request]

jobs:
  eslint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci
      - run: npm run lint

      # Report violations as comment
      - uses: reviewdog/action-eslint@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          reporter: github-pr-review
```

---

## Summary

| Issue                | Rule                              | Detection | False Positives                                        |
| -------------------- | --------------------------------- | --------- | ------------------------------------------------------ |
| 603 (tenantId)       | `require-tenant-id-in-queries`    | High      | Low (needs tuning)                                     |
| 605 (DI duplication) | `no-duplicated-di-initialization` | High      | Medium (false positives on similar but different code) |
| 606,608 (CLI args)   | `no-restricted-globals`           | High      | Low                                                    |
| 607 (silent skips)   | `no-silent-test-skips`            | Very High | Very Low                                               |

**Recommended Phase-In:**

1. **Week 1:** Enable `no-silent-test-skips` (highest confidence, immediate benefit)
2. **Week 2:** Enable `no-duplicated-di-initialization` (tune thresholds)
3. **Week 3:** Enable `require-tenant-id-in-queries` (may need customization)

---

## References

- **ESLint Docs:** https://eslint.org/docs/latest/
- **Custom Rules:** https://eslint.org/docs/latest/extend/plugins
- **TypeScript ESLint:** https://typescript-eslint.io/
