---
module: MAIS
date: 2025-12-28
problem_type: prevention_strategy
component: typescript, eslint, react
severity: P3
related_commit: e2d6545
tags: [code-quality, unused-code, maintenance, typescript-strict, eslint]
---

# Quick Reference: Preventing Unused Code Accumulation

## The Problem

```typescript
// ❌ Unused imports (5KB in bundle)
import { XCircle, AlertCircle } from 'lucide-react'; // XCircle never used

// ❌ Unused variables (confusing, unclear purpose)
const [greeting, setGreeting] = useState<string | null>(null); // Set but never read

// ❌ Unused props (API confusion)
interface Props {
  tenantSlug: string; // Never used in component
}

// ❌ Unused functions (maintenance burden)
function addDays(date: Date, days: number) {
  // Copy-pasted but never called
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Cumulative cost:
// - 30 min finding unused code
// - 20 min fixing
// - Ongoing confusion
```

## The Solution (5 minutes setup)

### Step 1: Enable TypeScript Strict Mode

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

Now you get errors:

```typescript
const [greeting, setGreeting] = useState(null);
//    ^^^^^^^^ ERROR: 'greeting' is declared but its value is never read

function addDays(date, days) {
//       ^^^^^^ ERROR: 'addDays' is declared but never used
```

### Step 2: Configure ESLint

```javascript
// .eslintrc.js
module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_', // Allow: function foo(_unused: string)
        destructureIgnorePattern: '^_',
      },
    ],
    'no-unused-expressions': 'error',
    'react/no-unused-prop-types': 'error',
  },
};
```

### Step 3: Add Pre-Commit Hook

```bash
#!/bin/sh
# .husky/pre-commit

npm run typecheck || exit 1
npm run lint -- --max-warnings 0 || exit 1
```

In `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "prepare": "husky install"
  }
}
```

## Handling Intentional Unused Variables

### Pattern: Prefix with Underscore

```typescript
// ✅ OKAY: Truly unused, intentional
const { tenantId, _tenantSlug, apiKey } = props;
//                  ^^^^^^^^^^^^ Underscore = intentionally unused
```

**Rule:** Only prefix with `_` if TRULY not used. Examples:

```typescript
// ✅ CORRECT USAGE:
// Case 1: Destructuring, explicitly keeping prop in object
const { userId, _tenantSlug, ...rest } = request;
// Use rest for all other props, tenantSlug ignored for readability

// ✅ CORRECT USAGE:
// Case 2: Function parameter required by interface but not used
class Service implements IService {
  doSomething(_tenantId: string) {
    // ← Required by interface, not used here
    return 'result';
  }
}

// ✅ CORRECT USAGE:
// Case 3: Placeholder for future use
const _futureApiKey = config.apiKey; // ← Will use in v2.0

// ❌ WRONG: Variable is actually used
const _greeting = getGreeting();
console.log(_greeting); // ← WRONG: Used, don't prefix
```

## Common Unused Code Patterns

### Pattern 1: Unused Imports

```typescript
// ❌ Before
import { XCircle, AlertCircle, CheckCircle } from 'lucide-react';
import { useState } from 'react';

export function MyComponent() {
  return <AlertCircle />;  // Only AlertCircle used
}

// ✅ After
import { AlertCircle } from 'lucide-react';

export function MyComponent() {
  return <AlertCircle />;
}
```

### Pattern 2: Unused State

```typescript
// ❌ Before
const [greeting, setGreeting] = useState<string | null>(null);
const [messages, setMessages] = useState<Message[]>([]);

useEffect(() => {
  setGreeting('Hello');  // Set but never read
}, []);

return <div>{messages.map(...)}</div>;  // Only messages used

// ✅ After
const [messages, setMessages] = useState<Message[]>([]);

return <div>{messages.map(...)}</div>;
```

### Pattern 3: Unused Props

```typescript
// ❌ Before
interface CustomerChatWidgetProps {
  tenantSlug: string;        // Never used
  tenantApiKey: string;      // Used ✓
  businessName: string;      // Used ✓
}

export function CustomerChatWidget({
  tenantSlug,  // ← Unused
  tenantApiKey,
  businessName
}: CustomerChatWidgetProps) {
  return (
    <div>
      <h1>{businessName}</h1>
      <Chat apiKey={tenantApiKey} />
    </div>
  );
}

// ✅ After
interface CustomerChatWidgetProps {
  tenantApiKey: string;
  businessName: string;
}

export function CustomerChatWidget({
  tenantApiKey,
  businessName
}: CustomerChatWidgetProps) {
  return (
    <div>
      <h1>{businessName}</h1>
      <Chat apiKey={tenantApiKey} />
    </div>
  );
}
```

### Pattern 4: Unused Functions

```typescript
// ❌ Before
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

export function Component() {
  const today = new Date();
  return <div>{formatDate(today)}</div>;  // Only formatDate used
}

// ✅ After
function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

export function Component() {
  const today = new Date();
  return <div>{formatDate(today)}</div>;
}
```

### Pattern 5: Unused Type Fields

```typescript
// ❌ Before
interface BookingContext {
  businessSlug: string; // Never used
  customerId: string; // Used ✓
  packageId: string; // Used ✓
  date: Date; // Used ✓
}

function createBooking(ctx: BookingContext) {
  return prisma.booking.create({
    data: {
      customerId: ctx.customerId,
      packageId: ctx.packageId,
      date: ctx.date,
      // businessSlug never referenced
    },
  });
}

// ✅ After
interface BookingContext {
  customerId: string;
  packageId: string;
  date: Date;
}

function createBooking(ctx: BookingContext) {
  return prisma.booking.create({
    data: {
      customerId: ctx.customerId,
      packageId: ctx.packageId,
      date: ctx.date,
    },
  });
}
```

## IDE Integration (Auto-Detection)

### VS Code

VS Code automatically grays out unused code:

```typescript
import { XCircle } from 'lucide-react'; // ← Grayed out = unused

const [greeting] = useState(null); // ← Grayed out = unused read only

function addDays() {} // ← Grayed out = unused
```

Enable auto-fix:

```json
// .vscode/settings.json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  }
}
```

Then:

1. Open file with unused code
2. Save file
3. ESLint automatically fixes it

## Regular Cleanup Pass

Schedule monthly cleanup:

```bash
# Run linter, generate JSON report
npm run lint -- --format json > lint-report.json

# Count issues
cat lint-report.json | jq '[.[] | .messages[] | .ruleId] | group_by(.) | map({rule: .[0], count: length})'

# Example output:
# [
#   { "rule": "@typescript-eslint/no-unused-vars", "count": 12 },
#   { "rule": "react/no-unused-prop-types", "count": 3 }
# ]
```

Then create cleanup PR:

```bash
git checkout -b cleanup/remove-unused-code
npm run lint -- --fix
npm run typecheck
git commit -m "cleanup: remove unused code and imports"
```

## Performance Impact

```
Unused code per feature:
- Unused imports:     5KB per 30 imports
- Unused variables:   2KB per 10 variables
- Unused functions:   10KB per 5 functions
- Total per feature:  ~17KB extra

Annual cost:
- Build time: +10% slower (1 sec per feature)
- Bundle size: +200KB over 100 features
- Maintenance: 60+ hours searching confusing code
```

## Code Review Checklist

Before approving PR, verify:

```typescript
// 1. All imports used?
import { A, B, C } from 'lib';  // A, B, C all referenced below?

// 2. All variables used?
const x = getValue();  // Referenced below?

// 3. All parameters used?
function foo(a, b, c) {  // All a, b, c used in body?
  return a + b;         // c not used!
}

// 4. All state variables used?
const [x, setX] = useState();  // Both setX and reading x?

// 5. All type fields used?
interface Props {
  a: string;      // Referenced in component?
  b: string;      // Referenced in component?
}

// 6. TypeScript and ESLint pass?
npm run typecheck    # ✓
npm run lint         # ✓
```

## Pre-Commit Checklist

Before pushing any commit:

```bash
# 1. Type check
npm run typecheck

# 2. Lint check
npm run lint -- --max-warnings 0

# 3. If either fails, fix before committing
```

## Common Questions

**Q: Should I commit code I'm not using yet?**

A: No. Add it when you use it (or add TODO with date).

**Q: Can I commit with `// TODO` unused code?**

A: Yes, but:

```typescript
/**
 * TODO #123: Use this when we implement feature X
 * Current state: Not yet implemented
 * Target date: 2025-02-01
 */
function futureFeature() {
  return 'not implemented';
}
```

**Q: What if I can't fix all unused code?**

A: Use `eslint-disable` with reason:

```typescript
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _tempVar = getTemporaryValue(); // Keeping for debugging

// Later, remove the comment when fixed
```

**Q: Should I prefix unused params with `_`?**

A: Only if TRULY not used. Check:

- Is it passed to another function?
- Is it logged?
- Is it checked in an if statement?
- Is it referenced in JSX?

If any of the above: DON'T prefix with `_`.

## Files to Monitor in MAIS

- `apps/web/src/components/chat/CustomerChatWidget.tsx` - ✅ Fixed in PR #23
- `server/src/agent/customer/` - Executor files
- Any file with `.map()`, destructuring, or exports

## Configuration in MAIS

Current `tsconfig.json` should have:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

Current `.eslintrc.js` should have:

```javascript
{
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', destructureIgnorePattern: '^_' }
    ],
    'react/no-unused-prop-types': 'error'
  }
}
```

---

**Use This Document:** Before writing any code, ensure checks are enabled
**Related:** PR-23-PREVENTION-STRATEGIES.md - Issue #6
**Rule:** If TypeScript/ESLint warns about unused code, fix it. Don't ignore.
