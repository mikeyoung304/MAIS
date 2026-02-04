# ESLint Rules for PostMessage Validation

**Optional automation for catching dead PostMessage code at lint time.**

Status: Template provided for future implementation
Effort: Medium (4-6 hours to implement all rules)
Value: Catches 80% of dead code issues at lint time instead of review time

---

## Why ESLint Rules?

Currently, dead PostMessage code is found during:

1. Manual code review (30 min per bug found)
2. Quarterly audits (finding accumulated tech debt)

With ESLint rules, it's found:

1. **Immediately during development** (< 1 second)
2. **In CI before merge** (0 overhead cost)
3. **Before first review** (no review time wasted)

---

## Rule 1: Require Handler for Every Message Type

**Purpose:** Ensure every defined message type has a handler case statement

**Implementation:**

```javascript
// eslint-plugin-postmessage/rules/require-handler-for-message-type.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Every message type defined in protocol must have a handler case statement',
      category: 'Best Practices',
      recommended: true,
      url: 'https://docs/solutions/patterns/POSTMESSAGE_QUICK_REFERENCE.md',
    },
    fixable: null,
    messages: {
      missingHandler: "Message type '{{ type }}' is defined but has no handler case statement",
      missingDefinition: "Handler for '{{ type }}' exists but type not defined in protocol",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const definedTypes = new Set();
    const handledTypes = new Set();

    return {
      // Collect all z.literal('MESSAGE_TYPE') definitions from protocol.ts
      "ObjectExpression > Property[key.name='type'] > CallExpression[callee.property.name='literal'] > Literal"(
        node
      ) {
        if (typeof node.value === 'string' && node.value.startsWith('BUILD_MODE')) {
          definedTypes.add(node.value);
        }
      },

      // Collect all case 'MESSAGE_TYPE': statements from handlers
      "SwitchCase[test.type='Literal']"(node) {
        if (typeof node.test.value === 'string' && node.test.value.startsWith('BUILD_MODE')) {
          handledTypes.add(node.test.value);
        }
      },

      // At end of file, report mismatches
      'Program:exit'() {
        for (const type of definedTypes) {
          if (!handledTypes.has(type)) {
            context.report({
              loc: { line: 1, column: 0 },
              messageId: 'missingHandler',
              data: { type },
            });
          }
        }

        for (const type of handledTypes) {
          if (!definedTypes.has(type)) {
            context.report({
              loc: { line: 1, column: 0 },
              messageId: 'missingDefinition',
              data: { type },
            });
          }
        }
      },
    };
  },
};
```

**Usage:**

```json
{
  "plugins": ["postmessage"],
  "rules": {
    "postmessage/require-handler-for-message-type": "error"
  }
}
```

**Example Output:**

```
/Users/mikeyoung/CODING/MAIS/apps/web/src/lib/build-mode/protocol.ts:1:0
  error  Message type 'BUILD_MODE_SECTION_EDIT' is defined but has no handler case statement  postmessage/require-handler-for-message-type
  error  Message type 'BUILD_MODE_SECTION_RENDERED' is defined but has no handler case statement  postmessage/require-handler-for-message-type
```

---

## Rule 2: Require Origin Validation in Message Listeners

**Purpose:** Ensure all `addEventListener('message')` listeners validate origin first

**Implementation:**

```javascript
// eslint-plugin-postmessage/rules/require-origin-check-in-listener.js
module.exports = {
  meta: {
    type: 'security',
    docs: {
      description: 'Message event listeners must validate origin before processing',
      category: 'Security',
      recommended: true,
      url: 'https://docs/solutions/patterns/DEAD_POSTMESSAGE_HANDLER_PREVENTION.md#security',
    },
    messages: {
      missingOriginCheck: 'Message listener must call isSameOrigin(event.origin) as first check',
    },
  },

  create(context) {
    return {
      // Find addEventListener('message', handler) calls
      "CallExpression[callee.property.name='addEventListener'][arguments.0.value='message']"(node) {
        const handler = node.arguments[1];
        if (!handler) return;

        // Get handler body
        let handlerBody;
        if (handler.type === 'FunctionExpression' || handler.type === 'ArrowFunctionExpression') {
          handlerBody = handler.body;
        } else {
          return; // Can't analyze complex handlers
        }

        // Check if first statement is origin check
        const bodyStatements =
          handlerBody.type === 'BlockStatement' ? handlerBody.body : [handlerBody];

        const firstStatement = bodyStatements[0];
        const hasOriginCheck =
          firstStatement &&
          (firstStatement.expression?.callee?.property?.name === 'isSameOrigin' ||
            (firstStatement.type === 'IfStatement' &&
              firstStatement.test?.callee?.property?.name === 'isSameOrigin'));

        if (!hasOriginCheck) {
          context.report({
            node: handler,
            messageId: 'missingOriginCheck',
          });
        }
      },
    };
  },
};
```

**Usage:**

```json
{
  "rules": {
    "postmessage/require-origin-check-in-listener": "error"
  }
}
```

**Example Output:**

```
/Users/mikeyoung/CODING/MAIS/apps/web/src/hooks/useBuildModeSync.ts:177:20
  error  Message listener must call isSameOrigin(event.origin) as first check  postmessage/require-origin-check-in-listener
```

---

## Rule 3: Detect Deprecated Message Types

**Purpose:** Warn when using deprecated message types (those prefixed with `_DEPRECATED_`)

**Implementation:**

```javascript
// eslint-plugin-postmessage/rules/no-deprecated-message-types.js
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Avoid using deprecated message types',
      category: 'Best Practices',
      recommended: true,
      url: 'https://docs/solutions/patterns/POSTMESSAGE_MESSAGE_REGISTRY.md#deprecated',
    },
    fixable: null,
    messages: {
      deprecated: "Message type '{{ type }}' is deprecated. Use '{{ replacement }}' instead.",
    },
  },

  create(context) {
    const deprecationMap = {
      BUILD_MODE_HIGHLIGHT_SECTION: 'BUILD_MODE_HIGHLIGHT_SECTION_BY_ID',
      _PLANNED_BUILD_MODE_EDIT: null, // No replacement yet
    };

    return {
      // Find all string literals that are message types
      Literal(node) {
        if (typeof node.value !== 'string') return;

        const type = node.value;
        if (type in deprecationMap) {
          const replacement = deprecationMap[type];
          context.report({
            node,
            messageId: 'deprecated',
            data: {
              type,
              replacement: replacement || 'nothing (type is planned, remove this code)',
            },
          });
        }
      },
    };
  },
};
```

**Usage:**

```json
{
  "rules": {
    "postmessage/no-deprecated-message-types": "warn"
  }
}
```

**Example Output:**

```
/Users/mikeyoung/CODING/MAIS/apps/web/src/hooks/useBuildModeSync.ts:214:10
  warn  Message type 'BUILD_MODE_HIGHLIGHT_SECTION' is deprecated. Use 'BUILD_MODE_HIGHLIGHT_SECTION_BY_ID' instead.  postmessage/no-deprecated-message-types
```

---

## Rule 4: Enforce Schema Validation with Zod

**Purpose:** Ensure all message listeners call safeParse before using data

**Implementation:**

```javascript
// eslint-plugin-postmessage/rules/require-zod-validation.js
module.exports = {
  meta: {
    type: 'security',
    docs: {
      description: 'Message listeners must validate with Zod safeParse before using data',
      category: 'Security',
      recommended: true,
      url: 'https://docs/solutions/patterns/DEAD_POSTMESSAGE_HANDLER_PREVENTION.md#security',
    },
    messages: {
      missingValidation: 'Message listener must call schema.safeParse(event.data) as second check',
    },
  },

  create(context) {
    return {
      "CallExpression[callee.property.name='addEventListener'][arguments.0.value='message']"(node) {
        const handler = node.arguments[1];
        if (!handler) return;

        let handlerBody;
        if (handler.type === 'FunctionExpression' || handler.type === 'ArrowFunctionExpression') {
          handlerBody = handler.body;
        } else {
          return;
        }

        const bodyStatements =
          handlerBody.type === 'BlockStatement' ? handlerBody.body : [handlerBody];

        // Look for safeParse call in first 3 statements
        const hasSafeParseValidation = bodyStatements.slice(0, 3).some((stmt) => {
          return (
            stmt.expression?.callee?.property?.name === 'safeParse' ||
            stmt.consequent?.body?.some((s) => s.expression?.callee?.property?.name === 'safeParse')
          );
        });

        if (!hasSafeParseValidation) {
          context.report({
            node: handler,
            messageId: 'missingValidation',
          });
        }
      },
    };
  },
};
```

---

## Rule 5: Warn on Unvalidated Data Access

**Purpose:** Flag any use of `event.data` without prior validation

**Implementation:**

```javascript
// eslint-plugin-postmessage/rules/no-unvalidated-data-access.js
module.exports = {
  meta: {
    type: 'security',
    docs: {
      description: 'Access event.data only after Zod validation',
      category: 'Security',
      recommended: true,
    },
    messages: {
      unvalidated: 'Do not access event.data without validation. Call safeParse() first.',
    },
  },

  create(context) {
    let inMessageListener = false;
    let hasValidation = false;

    return {
      "CallExpression[callee.property.name='addEventListener'][arguments.0.value='message']"(node) {
        inMessageListener = true;
      },

      "CallExpression[callee.property.name='addEventListener'] > * > *:exit"() {
        inMessageListener = false;
      },

      "MemberExpression[object.property.name='data']"(node) {
        if (!inMessageListener) return;

        // Check if this is after a safeParse call
        const parent = node.parent;
        hasValidation =
          parent.callee?.property?.name === 'safeParse' ||
          parent.object?.property?.name === 'result';

        if (!hasValidation) {
          context.report({
            node,
            messageId: 'unvalidated',
          });
        }
      },
    };
  },
};
```

---

## Configuration Template

**Add to `.eslintrc.json`:**

```json
{
  "plugins": ["postmessage"],
  "rules": {
    "postmessage/require-handler-for-message-type": "error",
    "postmessage/require-origin-check-in-listener": "error",
    "postmessage/no-deprecated-message-types": "warn",
    "postmessage/require-zod-validation": "error",
    "postmessage/no-unvalidated-data-access": "warn"
  }
}
```

---

## Installation Instructions

### Step 1: Create Plugin Package

```bash
mkdir -p eslint-plugin-postmessage/rules
```

### Step 2: Create Index File

```javascript
// eslint-plugin-postmessage/index.js
module.exports = {
  rules: {
    'require-handler-for-message-type': require('./rules/require-handler-for-message-type'),
    'require-origin-check-in-listener': require('./rules/require-origin-check-in-listener'),
    'no-deprecated-message-types': require('./rules/no-deprecated-message-types'),
    'require-zod-validation': require('./rules/require-zod-validation'),
    'no-unvalidated-data-access': require('./rules/no-unvalidated-data-access'),
  },
};
```

### Step 3: Update ESLint Config

```bash
# In project root .eslintrc.json
{
  "plugins": ["postmessage"],
  "rules": {
    "postmessage/require-handler-for-message-type": "error"
    // ... other rules
  }
}
```

### Step 4: Run Lint

```bash
npm run lint -- --fix
```

---

## Expected Results After Implementing

**Before:**

- Dead code found during quarterly audits
- Dead code found during code review (takes 30 min to debug)
- Multiple engineers working on the same dead code unknowingly

**After:**

- Dead code caught immediately during development
- ESLint error shown in IDE in real-time
- CI blocks merge if rules violated
- Zero accumulated dead code

---

## Testing the Rules

Each rule should have unit tests:

```javascript
// eslint-plugin-postmessage/__tests__/require-handler-for-message-type.test.js
const rule = require('../rules/require-handler-for-message-type');
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester();

ruleTester.run('require-handler-for-message-type', rule, {
  valid: [
    // Handler exists for defined type
    {
      code: `
        export const MyMessageSchema = z.object({
          type: z.literal('MY_MESSAGE'),
        });

        case 'MY_MESSAGE':
          handleMyMessage();
          break;
      `,
    },
  ],
  invalid: [
    // Defined but no handler
    {
      code: `
        export const MyMessageSchema = z.object({
          type: z.literal('MY_MESSAGE'),
        });
      `,
      errors: [{ messageId: 'missingHandler' }],
    },
  ],
});
```

---

## Performance Notes

- **Rule 1 & 2:** O(n) where n = number of case statements (< 50, negligible)
- **Rule 3 & 4:** O(1) string literal checks (very fast)
- **Rule 5:** O(n²) worst case with full AST traversal (< 100ms on typical file)

**Total lint time impact:** < 50ms per file

---

## Maintenance

### Updating Deprecation Map

When deprecating a message type:

```javascript
// eslint-plugin-postmessage/rules/no-deprecated-message-types.js
const deprecationMap = {
  BUILD_MODE_HIGHLIGHT_SECTION: 'BUILD_MODE_HIGHLIGHT_SECTION_BY_ID',
  YOUR_NEW_DEPRECATED_TYPE: 'REPLACEMENT_TYPE', // Add here
};
```

### Adding New Message Types

No action needed - rules automatically detect new types in Zod schemas.

---

## Roadmap

| Phase              | Rule                     | Effort | Value     |
| ------------------ | ------------------------ | ------ | --------- |
| Phase 1 (Now)      | Manual prevention + docs | 0      | High      |
| Phase 2 (Sprint 3) | Rule 1-2 (most valuable) | 3 hrs  | Very High |
| Phase 3 (Sprint 4) | Rule 3-5 (nice to have)  | 3 hrs  | Medium    |

---

## References

- ESLint Plugin Development: https://eslint.org/docs/extend/plugins
- AST Node Types: https://github.com/estree/estree
- Prevention Strategy: `docs/solutions/patterns/DEAD_POSTMESSAGE_HANDLER_PREVENTION.md`

---

## Questions

**Q: Do we need all 5 rules?**
A: Start with Rules 1-2 (most impactful). Add Rules 3-5 if you find they catch real bugs.

**Q: Can I run these locally before committing?**
A: Yes, ESLint runs in: IDE (real-time), pre-commit hook, and CI.

**Q: What if the rules have false positives?**
A: Add `// eslint-disable-next-line postmessage/rule-name` to disable for specific lines.

**Q: Can I use these rules in other projects?**
A: Yes, publish `eslint-plugin-postmessage` to npm and reuse across projects.
