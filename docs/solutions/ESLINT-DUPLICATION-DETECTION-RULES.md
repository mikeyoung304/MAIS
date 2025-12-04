---
title: ESLint Rules for Component Duplication Detection
category: prevention
tags: [eslint, automation, duplication-detection, react, code-quality]
priority: P3
---

# ESLint Rules for Component Duplication Detection

Automated detection of component duplication patterns using ESLint.

---

## Overview

ESLint can catch duplication patterns that humans miss in code review:

1. **Function duplication** - Same function defined in multiple files
2. **Magic constants** - Hardcoded values scattered across files
3. **JSX structure duplication** - Identical component markup patterns
4. **Missing memo()** - Wrapper components without memoization

---

## Rule 1: Detect Duplicate Function Definitions

### Problem Statement

Same function (e.g., `getTierDisplayName`) defined in multiple files:

- TierCard.tsx: Line 42
- TierSelector.tsx: Line 35
- TierDetail.tsx: Line 28

### Solution: Custom ESLint Rule

**File:** `.eslint/rules/no-duplicate-function-definitions.js`

```javascript
/**
 * ESLint Rule: no-duplicate-function-definitions
 *
 * Detects when the same function is defined in multiple files.
 * Suggests extracting to shared utils module.
 */

const path = require('path');
const fs = require('fs');

// Store function signatures across files
const functionRegistry = new Map();
const processedFiles = new Set();

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Detect identical function definitions across files',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
  },

  create(context) {
    return {
      FunctionDeclaration(node) {
        const functionName = node.id?.name;
        const fileName = context.getFilename();
        const fileKey = path.relative(process.cwd(), fileName);

        if (!functionName) return;

        // Skip build/test files
        if (fileName.includes('node_modules') || fileName.includes('dist')) return;

        // Only process feature files
        if (!fileName.includes('src/features/')) return;

        const signature = createFunctionSignature(node);
        const key = `${functionName}:${signature}`;

        if (functionRegistry.has(key)) {
          const existing = functionRegistry.get(key);
          if (existing.file !== fileKey) {
            context.report({
              node,
              message:
                `Function "${functionName}" is already defined in ${existing.file}:${existing.line}. ` +
                `Extract to shared utils module to avoid duplication.`,
              suggest: [
                {
                  desc: `Create utils/${functionName}.ts and export from index`,
                  fix(fixer) {
                    return fixer.insertTextBefore(
                      node,
                      `// TODO: Extract to utils.ts\n` + `// See also: ${existing.file}\n`
                    );
                  },
                },
              ],
            });
          }
        } else {
          functionRegistry.set(key, {
            file: fileKey,
            line: node.loc.start.line,
            signature: signature,
          });
        }
      },

      // Also check for exported functions
      ExportNamedDeclaration(node) {
        if (node.declaration?.type === 'FunctionDeclaration') {
          const functionName = node.declaration.id?.name;
          if (functionName) {
            // Same logic as above
          }
        }
      },
    };
  },
};

/**
 * Create a structural signature for the function
 * Ignores implementation details, focuses on signature
 */
function createFunctionSignature(node) {
  const params = node.params.map((p) => `${p.name}:${getTypeString(p)}`).join(',');

  return `(${params})`;
}

function getTypeString(param) {
  if (param.typeAnnotation?.typeAnnotation) {
    return param.typeAnnotation.typeAnnotation.name || 'unknown';
  }
  return 'any';
}
```

### Configuration

**File:** `.eslintrc.js` or `.eslintrc.json`

```javascript
module.exports = {
  plugins: ['@typescript-eslint'],
  overrides: [
    {
      files: ['client/src/**/*.{ts,tsx}'],
      rules: {
        // Enable the duplicate detection rule
        'no-duplicate-function-definitions': 'warn',
      },
    },
  ],
};
```

### Usage

```bash
npm run lint -- client/src/features/

# Output:
# client/src/features/storefront/TierCard.tsx:42:10
#   warning  Function "getTierDisplayName" is already defined in
#   client/src/features/storefront/TierSelector.tsx:35
#   Extract to shared utils module
```

---

## Rule 2: Detect Magic Constants

### Problem Statement

Same hardcoded value appears in multiple files:

- TierCard.tsx: `'150'` (truncation length)
- TierDetail.tsx: `'150'` (truncation length)
- TierSelector.tsx: `'140'` (inconsistent truncation)

### Solution: Custom ESLint Rule

**File:** `.eslint/rules/no-magic-constants.js`

```javascript
/**
 * ESLint Rule: no-magic-constants
 *
 * Detects hardcoded numeric/string values that should be constants.
 * Especially useful for business logic values (e.g., 150 char limit).
 */

const KNOWN_CONSTANTS = {
  // Tier display names - should use getTierDisplayName()
  Essential: { severity: 'warning', suggestion: 'getTierDisplayName("budget")' },
  Popular: { severity: 'warning', suggestion: 'getTierDisplayName("middle")' },
  Premium: { severity: 'warning', suggestion: 'getTierDisplayName("luxury")' },

  // Card description max length - should use CARD_DESCRIPTION_MAX_LENGTH
  150: {
    severity: 'warning',
    suggestion: 'CARD_DESCRIPTION_MAX_LENGTH',
    context: 'description|text',
  },
  140: {
    severity: 'error',
    suggestion: 'CARD_DESCRIPTION_MAX_LENGTH',
    context: 'description|text',
  },
  160: {
    severity: 'error',
    suggestion: 'CARD_DESCRIPTION_MAX_LENGTH',
    context: 'description|text',
  },

  // CTA button text - should be configurable props
  'See Packages': { severity: 'info', suggestion: 'Move to prop "cta"' },
  'View Details': { severity: 'info', suggestion: 'Move to prop "cta"' },
};

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Detect hardcoded constants that should be extracted',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: false,
    schema: [],
  },

  create(context) {
    return {
      Literal(node) {
        const value = String(node.value);
        const config = KNOWN_CONSTANTS[value];

        if (!config) return;

        const sourceCode = context.sourceCode;
        const parent = node.parent;

        // Skip if already in utils.ts or constants
        if (context.getFilename().includes('utils.ts')) return;

        // Skip if in comment
        if (sourceCode.getCommentsBefore(node).length > 0) return;

        context.report({
          node,
          message: `Magic constant "${value}" detected. ` + `${config.suggestion}`,
          severity: config.severity === 'error' ? 2 : config.severity === 'warning' ? 1 : 0,
          suggest: [
            {
              desc: `Extract to constant and import from utils`,
              fix(fixer) {
                return fixer.replaceText(node, formatConstantReference(value));
              },
            },
          ],
        });
      },
    };
  },
};

function formatConstantReference(value) {
  const mapping = {
    Essential: 'getTierDisplayName("budget")',
    Popular: 'getTierDisplayName("middle")',
    Premium: 'getTierDisplayName("luxury")',
    150: 'CARD_DESCRIPTION_MAX_LENGTH',
    140: 'CARD_DESCRIPTION_MAX_LENGTH',
    160: 'CARD_DESCRIPTION_MAX_LENGTH',
  };
  return mapping[value] || value;
}
```

### Usage

```bash
npm run lint -- --rule 'no-magic-constants: warn'

# Output:
# client/src/features/storefront/TierCard.tsx:42:15
#   warning  Magic constant "150" detected. CARD_DESCRIPTION_MAX_LENGTH
#
# client/src/features/storefront/TierDetail.tsx:58:15
#   warning  Magic constant "150" detected. CARD_DESCRIPTION_MAX_LENGTH
```

---

## Rule 3: Require memo() on Wrapper Components

### Problem Statement

Wrapper components receive object props but aren't memoized, causing unnecessary re-renders.

### Solution: Custom ESLint Rule

**File:** `.eslint/rules/require-memo-on-wrapper-components.js`

```javascript
/**
 * ESLint Rule: require-memo-on-wrapper-components
 *
 * Detects wrapper components (thin prop mapping layers) that should be memoized.
 * Wrapper components are identified by:
 * - <30 lines of code
 * - Single JSX return statement
 * - Receives object/array props
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require React.memo on wrapper components',
      category: 'Performance',
      recommended: true,
    },
    fixable: true,
    schema: [],
  },

  create(context) {
    return {
      ExportNamedDeclaration(node) {
        // Check for: export const ComponentName = function(...) { ... }
        if (node.declaration?.type !== 'VariableDeclaration') return;

        const decl = node.declaration.declarations[0];
        const componentName = decl?.id?.name;
        const init = decl?.init;

        // Check if it's likely a wrapper component
        if (!isLikelyWrapperComponent(init, context)) return;

        // Check if it's already wrapped with memo
        if (init?.callee?.name === 'memo') return;

        // Check if it receives object/array props
        if (!receivesObjectProps(init)) return;

        context.report({
          node,
          message:
            `Wrapper component "${componentName}" receives object props ` +
            `and should be wrapped with React.memo() to prevent unnecessary re-renders.`,
          fix(fixer) {
            const startText = `export const ${componentName} = `;
            const endText = init.type === 'FunctionExpression' ? ';' : '';

            return fixer.replaceText(init, `memo(${context.sourceCode.getText(init)})`);
          },
        });
      },
    };
  },
};

/**
 * Heuristics to identify wrapper components:
 * - Small component (<30 lines)
 * - Returns single JSX element
 * - Minimal logic (mostly prop mapping)
 */
function isLikelyWrapperComponent(node, context) {
  if (!node || (node.type !== 'FunctionExpression' && node.type !== 'ArrowFunctionExpression')) {
    return false;
  }

  const sourceCode = context.sourceCode;
  const text = sourceCode.getText(node);
  const lines = text.split('\n').length;

  // Wrapper components are typically <30 lines
  if (lines > 30) return false;

  // Should have exactly one return statement
  let returnCount = 0;
  if (node.body?.type === 'BlockStatement') {
    returnCount = node.body.body.filter((stmt) => stmt.type === 'ReturnStatement').length;
  } else if (node.body?.type === 'JSXElement') {
    returnCount = 1;
  }

  return returnCount === 1;
}

/**
 * Check if component receives object/array props
 */
function receivesObjectProps(node) {
  if (!node) return false;

  // Check function parameters
  const params = node.params || [];
  for (const param of params) {
    // Look for destructured object props
    if (param.type === 'ObjectPattern') {
      return true;
    }
    // Look for type annotations on props
    if (param.typeAnnotation?.typeAnnotation?.type === 'TSTypeReference') {
      const typeName = param.typeAnnotation.typeAnnotation.typeName?.name;
      // Common prop interface names
      if (typeName && typeName.includes('Props')) {
        return true;
      }
    }
  }

  return false;
}
```

### Usage

```bash
npm run lint -- client/src/features/storefront/SegmentCard.tsx

# Output:
# client/src/features/storefront/SegmentCard.tsx:23:0
#   error    Wrapper component "SegmentCard" receives object props
#   and should be wrapped with React.memo()
#
# Suggested fix:
#   export const SegmentCard = memo(function SegmentCard({ segment }) {
```

---

## Rule 4: Detect Duplicate JSX Patterns

### Problem Statement

Identical JSX structure in multiple components (hard to catch manually).

### Solution: Custom ESLint Rule (Advanced)

**File:** `.eslint/rules/no-duplicate-jsx-patterns.js`

```javascript
/**
 * ESLint Rule: no-duplicate-jsx-patterns
 *
 * Detects when multiple components have identical JSX structure.
 * Creates a structural hash and warns on duplicates.
 *
 * ADVANCED: Requires AST analysis
 */

const crypto = require('crypto');

const jsxRegistry = new Map();

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Detect duplicate JSX patterns across components',
      category: 'Code Quality',
      recommended: false, // Advanced rule, might have false positives
    },
    fixable: false,
    schema: [],
  },

  create(context) {
    return {
      JSXElement(node) {
        // Skip small JSX fragments (might be legitimate duplicates)
        if (getChildCount(node) < 5) return;

        const hash = createJSXHash(node);
        const fileName = context.getFilename();

        if (jsxRegistry.has(hash)) {
          const existing = jsxRegistry.get(hash);
          if (existing.file !== fileName) {
            context.report({
              node,
              message:
                `Duplicate JSX structure detected. ` +
                `Similar component found in ${existing.file}:${existing.line}. ` +
                `Consider extracting to a shared base component.`,
              suggest: [
                {
                  desc: 'Extract JSX to BaseComponent and reuse',
                  fix(fixer) {
                    return fixer.insertTextBefore(
                      node,
                      '// TODO: Extract JSX to base component\n' + `// See also: ${existing.file}\n`
                    );
                  },
                },
              ],
            });
          }
        } else {
          jsxRegistry.set(hash, {
            file: fileName,
            line: node.loc.start.line,
            structure: describeJSXStructure(node),
          });
        }
      },
    };
  },
};

/**
 * Create hash of JSX structure
 * Ignores specific prop values, focuses on structure
 */
function createJSXHash(node) {
  const structure = describeJSXStructure(node);
  return crypto.createHash('sha256').update(structure).digest('hex').slice(0, 8);
}

/**
 * Describe JSX structure (ignoring values)
 * <Link><img /><h3>{...}</h3><p>{...}</p><div /><Link>
 * becomes: Link>img+h3+p+div<
 */
function describeJSXStructure(node) {
  if (!node) return '';

  const tag = node.openingElement?.name?.name || '?';
  const childrenDesc = (node.children || [])
    .filter((child) => child.type === 'JSXElement')
    .map((child) => describeJSXStructure(child))
    .join('+');

  return `${tag}>${childrenDesc}<${tag}`;
}

function getChildCount(node) {
  return (node.children || []).filter((c) => c.type === 'JSXElement').length;
}
```

### Configuration

Add to `.eslintrc.js`:

```javascript
module.exports = {
  rules: {
    // Detect duplicate JSX structures
    'no-duplicate-jsx-patterns': 'warn',
  },
};
```

---

## Complete ESLint Configuration

### File: `.eslintrc.js`

```javascript
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['react', '@typescript-eslint', 'custom-rules'],
  rules: {
    // ─────────────────────────────────────
    // Duplication Detection Rules
    // ─────────────────────────────────────

    // Detect duplicate function definitions
    'custom-rules/no-duplicate-function-definitions': [
      'warn',
      {
        ignore: ['test', 'spec'],
      },
    ],

    // Detect magic constants
    'custom-rules/no-magic-constants': [
      'warn',
      {
        allowedContexts: ['comment', 'log'],
      },
    ],

    // Require memo on wrapper components
    'custom-rules/require-memo-on-wrapper-components': 'warn',

    // Detect duplicate JSX patterns (disable by default, enable selectively)
    'custom-rules/no-duplicate-jsx-patterns': 'off',

    // ─────────────────────────────────────
    // React Best Practices
    // ─────────────────────────────────────
    'react/prop-types': 'off', // Using TypeScript
    'react/react-in-jsx-scope': 'off', // Modern React doesn't need React import
    'react/display-name': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',

    // ─────────────────────────────────────
    // Code Quality
    // ─────────────────────────────────────
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': 'off', // Use TypeScript's checking
    '@typescript-eslint/no-unused-vars': 'warn',
    'prefer-const': 'warn',
    'no-var': 'error',
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      rules: {
        // Relax some rules in tests
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
};
```

### Register Custom Rules

**File:** `.eslint/index.js`

```javascript
module.exports = {
  rules: {
    'no-duplicate-function-definitions': require('./rules/no-duplicate-function-definitions'),
    'no-magic-constants': require('./rules/no-magic-constants'),
    'require-memo-on-wrapper-components': require('./rules/require-memo-on-wrapper-components'),
    'no-duplicate-jsx-patterns': require('./rules/no-duplicate-jsx-patterns'),
  },
};
```

### NPM Scripts

**File:** `package.json`

```json
{
  "scripts": {
    "lint": "eslint --ext .ts,.tsx client/src/",
    "lint:fix": "eslint --ext .ts,.tsx --fix client/src/",
    "lint:duplication": "eslint --ext .ts,.tsx --rule 'custom-rules/no-duplicate-function-definitions: error' --rule 'custom-rules/require-memo-on-wrapper-components: error' client/src/features/",
    "lint:watch": "eslint --ext .ts,.tsx --watch client/src/"
  }
}
```

---

## Running the Rules

### Check for All Issues

```bash
npm run lint
```

### Check Only Duplication Rules

```bash
npm run lint:duplication

# Output:
# client/src/features/storefront/TierCard.tsx:42:10
#   error  Function "getTierDisplayName" duplicated in TierSelector.tsx
#
# client/src/features/storefront/SegmentCard.tsx:23:0
#   error  Wrapper component "SegmentCard" should be wrapped with memo()
```

### Auto-Fix Where Possible

```bash
npm run lint:fix
```

### Watch Mode (During Development)

```bash
npm run lint:watch
```

---

## Integration with CI/CD

### GitHub Actions Example

**File:** `.github/workflows/lint.yml`

```yaml
name: Lint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm ci

      # Run duplication detection
      - name: Check for component duplication
        run: npm run lint:duplication
        continue-on-error: true # Warning, not error

      # Run full lint
      - name: Run ESLint
        run: npm run lint

      # Upload results
      - name: Upload lint results
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: lint-results
          path: lint-results.json
```

---

## Limitations & Caveats

### False Positives

These rules might warn on legitimate patterns:

1. **Utility function with same signature:** Multiple `format()` functions might be intentional
2. **Common JSX patterns:** Two cards with identical structure might not need extraction
3. **Wrapper component size:** Some wrappers legitimately exceed 30 lines (with calculation logic)

### Recommended Approach

Use ESLint rules as **warnings** in development, not errors:

```javascript
// In .eslintrc.js
rules: {
  'custom-rules/no-duplicate-function-definitions': 'warn',  // Not 'error'
  'custom-rules/require-memo-on-wrapper-components': 'warn',
}
```

Then **manually verify** during code review before treating as errors.

---

## Summary

ESLint rules can detect:

| Issue                | Rule                                 | Detection                          |
| -------------------- | ------------------------------------ | ---------------------------------- |
| Function duplication | `no-duplicate-function-definitions`  | Exact match in 2+ files            |
| Magic constants      | `no-magic-constants`                 | Hardcoded values in config list    |
| Missing memo         | `require-memo-on-wrapper-components` | <30 line components + object props |
| JSX duplication      | `no-duplicate-jsx-patterns`          | Structural hash matching           |

**Best Practice:** Use these as warnings to guide code review, not strict enforcement.

---

## References

- ESLint Custom Rules Guide: https://eslint.org/docs/developer-guide/working-with-rules
- React ESLint Plugin: https://github.com/facebook/react/tree/main/packages/eslint-plugin-react
- TypeScript ESLint: https://typescript-eslint.io/

---

## Next Steps

1. Copy custom rules from `.eslint/rules/` directory
2. Register rules in `.eslint/index.js`
3. Add to `.eslintrc.js` with 'warn' severity
4. Run `npm run lint:duplication` to find existing issues
5. Fix critical issues (duplicate functions, missing memo)
6. Gradually enforce remaining rules
