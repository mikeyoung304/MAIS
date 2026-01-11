---
module: MAIS
type: eslint_rules
date: 2026-01-02
difficulty: advanced
read_time: 15 minutes
---

# Phase 6-7 ESLint Rules for Automated Detection

**Advanced: Set up automated detection of 4 patterns. Recommended rollout: Start with Rule 4, then add others week by week.**

---

## Overview

Four custom ESLint rules to automatically detect Phase 6-7 patterns in code review and CI:

| Rule                              | Pattern              | Severity | Implementation                | Difficulty |
| --------------------------------- | -------------------- | -------- | ----------------------------- | ---------- |
| `require-tenant-id-in-queries`    | 1: Missing tenantId  | warn     | AST matcher for Prisma calls  | ⭐⭐⭐⭐   |
| `no-duplicated-di-initialization` | 3: DI duplication    | warn     | Similar code block detector   | ⭐⭐⭐⭐   |
| `no-silent-test-skips`            | 4: Silent test skips | error    | Detect early returns in tests | ⭐⭐       |
| `cli-args-with-zod-validation`    | 2: CLI validation    | warn     | Detect hand-rolled parsing    | ⭐⭐⭐     |

**Recommended rollout:**

- **Week 1:** Rule 4 (highest confidence, lowest false positives)
- **Week 2:** Rule 3 (easy to tune)
- **Week 3:** Rules 1 & 2 (may need customization per project)

---

## Rule 4: no-silent-test-skips (Start Here)

**Severity:** error (non-negotiable)
**Implementation:** 20 lines of AST matching
**False positives:** Almost none
**Difficulty:** ⭐⭐

### What It Catches

```typescript
// ❌ ERROR
it('should isolate', async () => {
  if (!condition) return; // ← CAUGHT
});

// ❌ ERROR
describe('Suite', () => {
  beforeEach(() => {
    if (!condition) return; // ← CAUGHT
  });
});

// ✅ OK
it.skipIf(!condition)('should isolate', async () => {
  // Safe - Vitest skipIf()
});
```

### Implementation

Add to `eslint.config.js`:

```javascript
import noSilentTestSkips from './eslint-rules/no-silent-test-skips.js';

export default [
  {
    files: ['**/test/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      'no-silent-test-skips': 'error',
    },
    plugins: {
      custom: {
        rules: {
          'no-silent-test-skips': noSilentTestSkips,
        },
      },
    },
  },
];
```

### Rule Implementation

Create `eslint-rules/no-silent-test-skips.js`:

```javascript
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Detect silent test skips (early returns in test bodies)',
      category: 'Testing',
      recommended: true,
    },
    fixable: null,
    schema: [],
  },

  create(context) {
    let inTestFunction = false;

    return {
      CallExpression(node) {
        // Detect it(...), describe(...), beforeEach(...), etc.
        if (
          (node.callee.name === 'it' ||
            node.callee.name === 'describe' ||
            node.callee.name === 'beforeEach' ||
            node.callee.name === 'beforeAll' ||
            node.callee.name === 'afterEach' ||
            node.callee.name === 'afterAll') &&
          node.arguments.length > 0
        ) {
          // Check if this is NOT a skipIf() call
          const isSkipIf =
            node.callee.property?.name === 'skipIf' || node.callee.computed === false;

          if (!isSkipIf) {
            const callback = node.arguments.find((arg) => arg.type === 'ArrowFunctionExpression');

            if (callback) {
              inTestFunction = true;
              context.sourceCode.traverseNodes(callback.body, (bodyNode) => {
                if (
                  bodyNode.type === 'ReturnStatement' &&
                  bodyNode.parent?.parent?.type !== 'IfStatement'
                ) {
                  // Ignore early returns after if statements
                } else if (
                  bodyNode.type === 'IfStatement' &&
                  bodyNode.consequent?.type === 'ReturnStatement' &&
                  !bodyNode.test?.callee?.property?.name?.includes('skipIf')
                ) {
                  context.report({
                    node: bodyNode,
                    message: 'Avoid silent test skips - use it.skipIf() instead of early returns',
                    suggest: [
                      {
                        desc: 'See: docs/solutions/patterns/PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md#pattern-4',
                      },
                    ],
                  });
                }
              });
              inTestFunction = false;
            }
          }
        }
      },
    };
  },
};
```

### Pre-Commit Hook Integration

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "Checking for silent test skips..."
npx eslint --rule "custom/no-silent-test-skips: error" \
  server/test/**/*.test.ts

if [ $? -ne 0 ]; then
  echo "❌ Silent test skips detected. Use it.skipIf() instead."
  exit 1
fi
```

---

## Rule 3: no-duplicated-di-initialization

**Severity:** warn (educate developers)
**Implementation:** Similar block detector
**False positives:** Medium (requires tuning)
**Difficulty:** ⭐⭐⭐

### What It Catches

```typescript
// ❌ WARNING
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator();
  const pipeline = createEvalPipeline(prisma, evaluator);
  services = { evaluator, pipeline };
}

// ... 100 lines later ...

// ❌ WARNING - Same code with different var names
if (process.env.ANTHROPIC_API_KEY) {
  const evaluator = createEvaluator();
  const evalPipeline = createEvalPipeline(prisma, evaluator);
  servicesReal = { evaluator, pipeline: evalPipeline };
}
```

### Implementation

This is complex. Recommended: Use `jscpd` (CLI tool) in CI instead:

```bash
# In package.json
{
  "scripts": {
    "lint:duplication": "jscpd server/src/di.ts --min-lines 5 --reporters json"
  }
}

# In CI
npx jscpd server/src/di.ts --min-lines 5
```

Or use simpler ESLint rule to detect duplicate patterns:

```javascript
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Detect duplicated initialization code',
    },
  },

  create(context) {
    const seenPatterns = new Map(); // Pattern -> line numbers

    return {
      VariableDeclarator(node) {
        // Look for createX() calls
        if (
          node.init?.callee?.name?.startsWith('create') ||
          node.init?.callee?.name?.startsWith('new')
        ) {
          const patternKey = node.init.callee.name;
          if (!seenPatterns.has(patternKey)) {
            seenPatterns.set(patternKey, []);
          }
          seenPatterns.get(patternKey).push(node.loc.start.line);
        }
      },

      'Program:exit'() {
        // Flag same constructor called 3+ times in same file
        seenPatterns.forEach((lines, pattern) => {
          if (lines.length >= 3) {
            context.report({
              loc: { line: lines[1], column: 0 },
              message: `"${pattern}" called ${lines.length} times in this file. Consider extracting to a helper function.`,
              suggest: [
                {
                  desc: 'See: docs/solutions/patterns/PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md#pattern-3',
                },
              ],
            });
          }
        });
      },
    };
  },
};
```

### CI Integration

Add to `.github/workflows/lint.yml`:

```yaml
- name: Check for code duplication
  run: |
    npx jscpd server/src/ \
      --min-lines 5 \
      --ignore "**/node_modules/**" \
      --ignore "**/dist/**" \
      --reporters json
```

---

## Rule 1: require-tenant-id-in-queries

**Severity:** warn (complex to detect perfectly)
**Implementation:** Prisma query AST matcher
**False positives:** Medium (requires tuning)
**Difficulty:** ⭐⭐⭐⭐

### What It Catches

```typescript
// ❌ WARNING
const count = await prisma.conversationTrace.count({
  where: {
    id: { in: traceIds },
    // ← Missing tenantId
    flagged: true,
  },
});

// ✅ OK
const count = await prisma.conversationTrace.count({
  where: {
    tenantId, // ← Found
    id: { in: traceIds },
    flagged: true,
  },
});
```

### Implementation (Advanced)

```javascript
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require tenantId in all Prisma queries',
      category: 'Security',
      recommended: true,
    },
    fixable: null,
  },

  create(context) {
    return {
      CallExpression(node) {
        // Detect prisma.X.findMany(), prisma.X.count(), etc.
        if (!isPrismaQuery(node)) return;

        // Get the 'where' argument
        const whereArg = node.arguments.find(
          (arg) =>
            arg.type === 'ObjectExpression' &&
            arg.properties.some((prop) => prop.key?.name === 'where')
        );

        if (!whereArg) {
          // No 'where' clause - skip (might be intentional)
          return;
        }

        // Get the where object
        const whereObj = whereArg.properties.find((prop) => prop.key?.name === 'where')?.value;

        if (whereObj?.type === 'ObjectExpression') {
          // Check if tenantId property exists
          const hasTenantId = whereObj.properties.some((prop) => prop.key?.name === 'tenantId');

          if (!hasTenantId) {
            context.report({
              node: whereArg,
              message: 'Missing tenantId in Prisma query WHERE clause (security)',
              suggest: [
                {
                  desc: 'See: docs/solutions/patterns/PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md#pattern-1',
                },
              ],
            });
          }
        }
      },
    };
  },
};

function isPrismaQuery(node) {
  const callee = node.callee;

  // Check for prisma.X.method() pattern
  if (callee?.type === 'MemberExpression') {
    const method = callee.property?.name;
    const objectName = callee.object?.callee?.object?.name;

    return (
      objectName === 'prisma' &&
      ['findMany', 'findFirst', 'findUnique', 'count', 'updateMany', 'deleteMany'].includes(method)
    );
  }

  return false;
}
```

### Known Limitations

This rule has high false positive rate because:

- Hard to detect cross-tenant filtering (implicit in IDs)
- Can't analyze dynamic variable names
- Business logic filtering might be elsewhere

**Better approach:** Code review checklist + occasional `grep` searches

```bash
# Search for potential missing tenantId
grep -A3 "where: {" server/src/**/*.ts | grep -B3 -v tenantId
```

---

## Rule 2: cli-args-with-zod-validation

**Severity:** warn (style rule)
**Implementation:** Detect hand-rolled parsing
**False positives:** Low-medium
**Difficulty:** ⭐⭐⭐

### What It Catches

```typescript
// ❌ WARNING
for (const arg of args) {
  if (arg.startsWith('--tenant-id=')) {
    options.tenantId = arg.split('=')[1]?.trim();
  }
}

// ✅ OK
const { values } = parseArgs({
  options: { 'tenant-id': { type: 'string' } },
});
```

### Implementation

```javascript
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Detect hand-rolled argument parsing (should use parseArgs + Zod)',
      category: 'Best Practice',
    },
  },

  create(context) {
    return {
      ForStatement(node) {
        // Detect: for (const arg of args)
        if (node.left?.declarations?.[0]?.id?.name === 'arg' && node.right?.name === 'args') {
          // Check if body contains string.split or string.startsWith
          const body = node.body;
          const hasParsing = context.sourceCode
            .getTokens(body)
            .some((token) => token.value === 'split' || token.value === 'startsWith');

          if (hasParsing) {
            context.report({
              node,
              message:
                'Hand-rolled argument parsing detected. Use Node parseArgs() + Zod validation.',
              suggest: [
                {
                  desc: 'See: docs/solutions/patterns/PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md#pattern-2',
                },
              ],
            });
          }
        }
      },
    };
  },
};
```

---

## CI Configuration

### GitHub Actions Workflow

Create `.github/workflows/pattern-detection.yml`:

```yaml
name: Pattern Detection

on:
  pull_request:
    paths:
      - 'server/**/*.ts'
      - '.github/workflows/pattern-detection.yml'

jobs:
  patterns:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run pattern detection
        run: |
          echo "Checking for silent test skips..."
          npx eslint --rule "custom/no-silent-test-skips: error" \
            server/test/**/*.test.ts

          echo "Checking for code duplication..."
          npx jscpd server/src/di.ts --min-lines 5

          echo "Checking for hand-rolled arg parsing..."
          grep -r "split.*=.*\[1\]" server/scripts/ || true

      - name: Comment on PR
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: 'Phase 6-7 pattern violations detected. See CI logs for details.'
            })
```

### Pre-Commit Hook

Create `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

set -e

echo "Running pattern detection pre-commit checks..."

# Rule 4: Silent test skips (strict)
if git diff --cached --name-only | grep -E "\.test\.ts$|\.spec\.ts$"; then
  echo "Checking for silent test skips..."
  npx eslint --rule "custom/no-silent-test-skips: error" \
    $(git diff --cached --name-only | grep -E "\.test\.ts$|\.spec\.ts$" || true)
fi

# Rule 3: DI duplication (warning only)
if git diff --cached --name-only | grep "server/src/di.ts"; then
  echo "Checking for duplicated DI code..."
  npx jscpd server/src/di.ts --min-lines 5 || echo "⚠️  Duplication detected (warning)"
fi

# Rule 2: Hand-rolled parsing (warning only)
if git diff --cached --name-only | grep "server/scripts/"; then
  echo "Checking for hand-rolled argument parsing..."
  git diff --cached | grep -E "split\(|startsWith\(" || echo "✓ No parsing issues"
fi

echo "✓ Pattern checks passed"
```

---

## Recommended Rollout Schedule

### Week 1: Rule 4 (no-silent-test-skips)

- **Difficulty:** Low
- **False positives:** Almost none
- **Impact:** High (testing visibility)
- **Action:** Enable in CI + pre-commit

```javascript
{
  files: ['**/test/**/*.ts'],
  rules: { 'custom/no-silent-test-skips': 'error' },
}
```

### Week 2: Rule 3 (no-duplicated-di-initialization)

- **Difficulty:** Low-medium
- **False positives:** Low
- **Impact:** Medium (code quality)
- **Action:** Enable in CI, review warnings

```bash
npx jscpd server/src/di.ts --min-lines 5 --reporters json
```

### Week 3: Rules 1 & 2 (Advanced)

- **Difficulty:** High
- **False positives:** Medium
- **Impact:** High (security)
- **Action:** Enable with careful tuning, regular reviews

```javascript
{
  files: ['server/src/**/*.ts', 'server/scripts/**/*.ts'],
  rules: {
    'custom/require-tenant-id-in-queries': 'warn',
    'custom/cli-args-with-zod-validation': 'warn',
  },
}
```

---

## Testing ESLint Rules

### Unit Test Template

Create `eslint-rules/__tests__/no-silent-test-skips.test.js`:

```javascript
import rule from '../no-silent-test-skips.js';
import { RuleTester } from 'eslint';

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
});

ruleTester.run('no-silent-test-skips', rule, {
  valid: [
    {
      code: `it.skipIf(!condition)('test', async () => {});`,
    },
    {
      code: `it('test', async () => { const x = 1; });`,
    },
  ],
  invalid: [
    {
      code: `it('test', async () => { if (!x) return; });`,
      errors: [{ messageId: 'silentSkip' }],
    },
  ],
});
```

---

## Troubleshooting

### Rule Is Too Strict

```javascript
// Solution: Use warn instead of error
rules: {
  'custom/require-tenant-id-in-queries': 'warn', // Not 'error'
}
```

### Too Many False Positives

```javascript
// Solution: Add exceptions for known patterns
if (shouldExclude(node)) {
  return; // Skip checking this node
}
```

### Rules Conflict with Prettier

```javascript
// Solution: Run ESLint before Prettier
prettier --write file.ts
eslint --fix file.ts
```

---

## References

- **Full patterns:** `PHASE_6_7_PREVENTION_STRATEGIES-MAIS-20260102.md`
- **ESLint documentation:** https://eslint.org/docs/latest/extend/rules
- **AST Explorer:** https://astexplorer.net/

---

## Version History

| Version | Date       | Changes                                                     |
| ------- | ---------- | ----------------------------------------------------------- |
| 1.0     | 2026-01-02 | Initial release - 4 rules, CI integration, pre-commit hooks |

---

## FAQ

**Q: Which rule should I enable first?**
A: Rule 4 (no-silent-test-skips) - lowest complexity, highest confidence

**Q: Can I use these rules in other projects?**
A: Yes, they apply to any TypeScript/Node.js project

**Q: Why are Rules 1 & 2 so complex?**
A: They require AST analysis of database queries and function calls, which is context-dependent

**Q: Should I enable all rules at once?**
A: No. Start with Rule 4, add others week-by-week after your team is comfortable

**Q: What if a rule gives a false positive?**
A: Add a comment to disable it for that line:

```javascript
// eslint-disable-next-line custom/rule-name
const result = someFunction();
```

---

**Start with Rule 4. Add others as needed.**
