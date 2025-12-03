---
title: ESLint Rules for TODO Categories 182-191
category: prevention
tags: [eslint, automation, 182-191]
priority: P1
last_updated: 2025-12-03
---

# ESLint Rules for TODO Categories 182-191

Custom ESLint rules to automatically catch violations from all 10 TODO categories.

---

## Overview

These rules provide automated enforcement of prevention strategies. **Phase 2** of implementation (Week 1, Days 3-5).

### Implementation Status

- [ ] Rule 182: Information Disclosure - ⏳ Ready to implement
- [ ] Rule 183: Transaction Atomicity - ⏳ Ready to implement
- [ ] Rule 184: Memory Leak - ⏳ Ready to implement
- [ ] Rule 185: Type DRY - ⏳ Ready to implement
- [ ] Rule 186: Exhaustiveness - ⏳ Ready to implement
- [ ] Rule 187: Documentation - ⏳ Ready to implement (manual registry check)
- [ ] Rule 188: React Cleanup - ⏳ Ready to implement
- [ ] Rule 189: Test Coverage - ⏳ Ready to implement (file existence check)
- [ ] Rule 190: Observability - ⏳ Ready to implement
- [ ] Rule 191: File Organization - ⏳ Ready to implement

---

## Rule 182: no-public-version-exposure

**Purpose:** Prevent exposing version/environment in public endpoints

```javascript
// .eslintrc.json
{
  "rules": {
    "custom/no-public-version-exposure": ["error", {
      "allowedRoutes": ["admin/*", "internal/*"],
      "bannedInPublicRoutes": [
        "process.env.npm_package_version",
        "process.env.NODE_ENV",
        "process.version",
        "process.arch",
        "process.pid"
      ]
    }]
  }
}
```

### Implementation

```javascript
// .eslintrc.js custom rule
module.exports = {
  rules: {
    'custom/no-public-version-exposure': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Prevent exposing version/environment in public endpoints',
          category: 'Security'
        },
        messages: {
          publicExposure: 'Version/environment exposure in public endpoint. Use authenticated endpoint instead.',
          recommendedFix: 'Remove from response or move to admin endpoint'
        }
      },
      create(context) {
        const bannedPatterns = [
          'npm_package_version',
          'NODE_ENV',
          'process.version',
          'process.arch',
          'process.pid'
        ];

        return {
          MemberExpression(node) {
            const text = context.getSourceCode().getText(node);
            const isPublicRoute = !context.filename.includes('admin');

            if (isPublicRoute && bannedPatterns.some(p => text.includes(p))) {
              context.report({
                node,
                messageId: 'publicExposure',
                fix(fixer) {
                  return fixer.remove(node);
                }
              });
            }
          }
        };
      }
    }
  }
};
```

---

## Rule 183: require-atomicity-in-transactions

**Purpose:** Ensure resource generation happens inside transactions

```javascript
// .eslintrc.json
{
  "rules": {
    "custom/require-atomicity-in-transactions": ["error", {
      "bannedBeforeTransaction": [
        "crypto.randomBytes",
        "generateToken",
        "generateKey"
      ]
    }]
  }
}
```

### Implementation

```javascript
module.exports = {
  rules: {
    'custom/require-atomicity-in-transactions': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Ensure resource generation happens inside transactions',
          category: 'Data Integrity'
        }
      },
      create(context) {
        const functionCalls = {};
        let inTransaction = false;

        return {
          CallExpression(node) {
            const name = node.callee.property?.name || node.callee.name;

            if (name === '$transaction') {
              inTransaction = true;
            }

            if (['randomBytes', 'generateToken', 'generateKey'].includes(name)) {
              if (!inTransaction) {
                context.report({
                  node,
                  message: `Resource generation (${name}) should happen inside transaction, not before`
                });
              }
            }
          }
        };
      }
    }
  }
};
```

---

## Rule 184: require-event-unsubscribe

**Purpose:** Ensure subscribe() returns unsubscribe function

```javascript
// .eslintrc.json
{
  "rules": {
    "custom/require-event-unsubscribe": ["error", {
      "exemptions": ["di.ts", "config.ts"]
    }]
  }
}
```

### Implementation

```javascript
module.exports = {
  rules: {
    'custom/require-event-unsubscribe': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Event subscriptions must be able to unsubscribe',
          category: 'Memory Management'
        }
      },
      create(context) {
        return {
          CallExpression(node) {
            const callee = node.callee.property?.name;

            if (callee === 'subscribe') {
              const parent = node.parent;

              // Check if return value is used
              if (!parent.id && parent.type !== 'VariableDeclarator') {
                context.report({
                  node,
                  message: 'Subscribe return value should be stored for later unsubscribe'
                });
              }
            }
          }
        };
      }
    }
  }
};
```

---

## Rule 185: require-type-inference-from-schema

**Purpose:** Derive types from Zod schemas, not manual unions

```javascript
// .eslintrc.json
{
  "rules": {
    "custom/require-type-inference-from-schema": ["error", {
      "sourcePackage": "@macon/contracts"
    }]
  }
}
```

### Implementation

```javascript
module.exports = {
  rules: {
    'custom/require-type-inference-from-schema': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Derive types from Zod schemas using z.infer',
          category: 'Type Safety'
        }
      },
      create(context) {
        return {
          TSTypeAliasDeclaration(node) {
            const name = node.id.name;
            const typeString = context.getSourceCode().getText(node.typeAnnotation);

            // Check if looks like manual union: 'STATUS' | 'OTHER' | 'VALUES'
            if (typeString.match(/['"][A-Z_]+['"]\s*\|\s*['"][A-Z_]+['"]/)) {
              context.report({
                node,
                message: `Type "${name}" looks like it should be derived from Zod schema with z.infer<typeof Schema>`,
                fix(fixer) {
                  return fixer.replaceText(node,
                    `type ${name} = z.infer<typeof ${name}Schema>;`
                  );
                }
              });
            }
          }
        };
      }
    }
  }
};
```

---

## Rule 186: require-exhaustive-switch

**Purpose:** Ensure all switch statements on unions are exhaustive

```javascript
// .eslintrc.json
{
  "rules": {
    "custom/require-exhaustive-switch": ["error", {
      "requireNeverType": true
    }]
  }
}
```

### Implementation

```javascript
module.exports = {
  rules: {
    'custom/require-exhaustive-switch': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Switch on union types must have exhaustiveness check',
          category: 'Type Safety'
        }
      },
      create(context) {
        return {
          SwitchStatement(node) {
            const discriminant = node.discriminant;

            // Check if discriminant is a union type (variable)
            if (discriminant.type === 'Identifier') {
              const hasDefault = node.cases.some(c => c.test === null);

              if (!hasDefault) {
                context.report({
                  node,
                  message: 'Switch on union type must have default case with exhaustiveness check: const _: never = value;'
                });
              }

              // Check if default case has never type assignment
              const defaultCase = node.cases.find(c => c.test === null);
              if (defaultCase) {
                const caseText = context.getSourceCode().getText(defaultCase);
                if (!caseText.includes(': never')) {
                  context.report({
                    node: defaultCase,
                    message: 'Default case must assign to never type for exhaustiveness check'
                  });
                }
              }
            }
          }
        };
      }
    }
  }
};
```

---

## Rule 187: require-advisory-lock-documentation

**Purpose:** Document all advisory lock IDs

```javascript
// .eslintrc.json
{
  "rules": {
    "custom/require-advisory-lock-documentation": ["warn"]
  }
}
```

### Implementation

```javascript
module.exports = {
  rules: {
    'custom/require-advisory-lock-documentation': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'All advisory lock IDs must be documented in ADVISORY_LOCKS.md',
          category: 'Documentation'
        }
      },
      create(context) {
        const fs = require('fs');
        const path = require('path');

        return {
          AssignmentExpression(node) {
            const text = context.getSourceCode().getText(node);

            if (text.includes('advisoryLock') && /=\s*\d+/.test(text)) {
              const lockIdMatch = text.match(/=\s*(\d+)/);
              if (lockIdMatch) {
                const lockId = lockIdMatch[1];

                // Check if documented
                const registryPath = path.join(process.cwd(), 'docs/reference/ADVISORY_LOCKS.md');
                if (fs.existsSync(registryPath)) {
                  const registry = fs.readFileSync(registryPath, 'utf8');
                  if (!registry.includes(lockId)) {
                    context.report({
                      node,
                      message: `Advisory lock ID ${lockId} must be documented in docs/reference/ADVISORY_LOCKS.md`
                    });
                  }
                }
              }
            }
          }
        };
      }
    }
  }
};
```

---

## Rule 188: require-useref-cleanup

**Purpose:** useRef with Promise/function needs cleanup effect

```javascript
// .eslintrc.json (for React)
{
  "rules": {
    "custom/require-useref-cleanup": ["error", {
      "refTypes": ["Promise", "function"]
    }]
  }
}
```

### Implementation

```javascript
module.exports = {
  rules: {
    'custom/require-useref-cleanup': {
      meta: {
        type: 'problem',
        docs: {
          description: 'useRef with Promise/function must have cleanup effect',
          category: 'React'
        }
      },
      create(context) {
        const refVariables = new Set();
        let hasCleanupEffect = false;

        return {
          CallExpression(node) {
            // Track useRef calls
            if (node.callee.name === 'useRef') {
              const parent = node.parent;
              if (parent.id) {
                refVariables.add(parent.id.name);
              }
            }

            // Track useEffect
            if (node.callee.name === 'useEffect') {
              hasCleanupEffect = true;
            }
          },

          FunctionDeclaration(node) {
            // Reset for each component
            refVariables.clear();
            hasCleanupEffect = false;
          },

          'FunctionDeclaration:exit'(node) {
            // Check if function uses Promise/function ref without cleanup
            if (refVariables.size > 0 && !hasCleanupEffect) {
              context.report({
                node,
                message: 'useRef with Promise/function must have useEffect cleanup'
              });
            }
          }
        };
      }
    }
  }
};
```

---

## Rule 189: require-infrastructure-tests

**Purpose:** Infrastructure code must have dedicated unit tests

```javascript
// .eslintrc.json
{
  "rules": {
    "custom/require-infrastructure-tests": ["warn", {
      "infrastructurePatterns": ["*/core/*", "*/lib/*", "*adapter.ts"]
    }]
  }
}
```

### Implementation

```javascript
module.exports = {
  rules: {
    'custom/require-infrastructure-tests': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Infrastructure code should have unit tests',
          category: 'Testing'
        }
      },
      create(context) {
        const fs = require('fs');
        const path = require('path');

        return {
          Program(node) {
            const filename = context.filename;

            // Check if this is infrastructure code
            if (filename.includes('/src/lib/core/') || filename.includes('/src/lib/') || filename.includes('adapter.ts')) {
              const baseDir = process.cwd();
              const relativePath = path.relative(baseDir, filename);
              const testPath = relativePath.replace('/src/', '/test/').replace('.ts', '.test.ts');

              if (!fs.existsSync(path.join(baseDir, testPath))) {
                context.report({
                  node,
                  message: `Infrastructure code should have dedicated unit tests. Expected: ${testPath}`
                });
              }
            }
          }
        };
      }
    }
  }
};
```

---

## Rule 190: require-transaction-logging

**Purpose:** Transactions must log start and completion

```javascript
// .eslintrc.json
{
  "rules": {
    "custom/require-transaction-logging": ["warn", {
      "requireStartLog": true,
      "requireEndLog": true
    }]
  }
}
```

### Implementation

```javascript
module.exports = {
  rules: {
    'custom/require-transaction-logging': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Database transactions should log start and end',
          category: 'Observability'
        }
      },
      create(context) {
        let inTransaction = false;
        let hasStartLog = false;
        let hasEndLog = false;

        return {
          CallExpression(node) {
            const callee = node.callee.property?.name;

            if (callee === '$transaction') {
              inTransaction = true;
              hasStartLog = false;
              hasEndLog = false;
            }

            if (callee === 'info' || callee === 'warn') {
              const args = node.arguments[0]?.properties?.map(p => p.key?.name).join(',');
              if (args?.includes('durationMs') || args?.includes('operations')) {
                if (inTransaction) hasStartLog = true;
              }
            }
          },

          'CallExpression:exit'(node) {
            if (node.callee.property?.name === '$transaction') {
              inTransaction = false;

              if (!hasStartLog || !hasEndLog) {
                context.report({
                  node,
                  message: 'Transactions should log start (operations count) and end (durationMs)'
                });
              }
            }
          }
        };
      }
    }
  }
};
```

---

## Rule 191: require-correct-file-location

**Purpose:** Files in correct directory based on purpose

```javascript
// .eslintrc.json
{
  "rules": {
    "custom/require-correct-file-location": ["warn", {
      "testDirectory": "test/",
      "docsDirectory": "docs/",
      "examplesDirectory": "docs/examples/"
    }]
  }
}
```

### Implementation

```javascript
module.exports = {
  rules: {
    'custom/require-correct-file-location': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Files should be in correct directory based on purpose',
          category: 'Organization'
        }
      },
      create(context) {
        const filename = context.filename;
        const sourceCode = context.getSourceCode();
        const text = sourceCode.getText();

        const isTest = text.includes('describe(') && text.includes('it(');
        const isExample = text.includes('// Example:') || text.includes('// Usage:');
        const isDoc = filename.endsWith('.md');

        if (isTest && !filename.includes('/test/')) {
          context.report({
            node: sourceCode.ast,
            message: 'Test files should be in test/ directory'
          });
        }

        if (isExample && !filename.includes('/examples/')) {
          context.report({
            node: sourceCode.ast,
            message: 'Example code should be in docs/examples/ directory'
          });
        }

        if (isDoc && filename.includes('/test/')) {
          context.report({
            node: sourceCode.ast,
            message: 'Documentation should be in docs/ directory, not test/'
          });
        }
      }
    }
  }
};
```

---

## Linting Configuration

Add to `.eslintrc.json`:

```json
{
  "overrides": [
    {
      "files": ["server/**/*.ts", "client/**/*.tsx"],
      "rules": {
        "custom/no-public-version-exposure": "error",
        "custom/require-atomicity-in-transactions": "error",
        "custom/require-event-unsubscribe": "error",
        "custom/require-type-inference-from-schema": "warn",
        "custom/require-exhaustive-switch": "error",
        "custom/require-advisory-lock-documentation": "warn",
        "custom/require-useref-cleanup": "error",
        "custom/require-infrastructure-tests": "warn",
        "custom/require-transaction-logging": "warn",
        "custom/require-correct-file-location": "warn"
      }
    }
  ]
}
```

---

## Installation Steps

1. Create `.eslintrc.rules.js` with custom rules above
2. Import in main `.eslintrc.json`: `"extends": ["./.eslintrc.rules.js"]`
3. Run linter: `npm run lint`
4. Fix violations automatically: `npm run lint -- --fix`

---

## CI Integration

Add to GitHub Actions workflow:

```yaml
- name: Lint Prevention Rules
  run: npm run lint -- --rule 'custom/*'

- name: Report Violations
  if: failure()
  run: |
    echo "## ESLint Prevention Rule Violations"
    npm run lint -- --format json | jq '.[] | select(.ruleId | startswith("custom/"))'
```

---

## Disabling Rules

If a rule causes false positives:

```typescript
// Disable for specific line
// eslint-disable-next-line custom/rule-name
const result = someFunction();

// Disable for block
/* eslint-disable custom/rule-name */
const result = someFunction();
/* eslint-enable custom/rule-name */
```

---

## Rule Maintenance

Each rule should be reviewed quarterly:

- [ ] False positive rate < 5%
- [ ] Catches > 80% of violations in manual review
- [ ] Fixes don't introduce other violations
- [ ] Update rule if patterns change

---

**Status:** Ready for implementation
**Estimated Effort:** 2-3 days to implement all 10 rules
**First Priority:** Rules 182, 186 (security + type safety)
**Last Updated:** 2025-12-03
