---
title: PR #12 Prevention - ESLint Rules & Configuration
category: prevention
tags: [eslint, react-hooks, accessibility, configuration]
priority: P1
---

# PR #12 Prevention - ESLint Rules & Configuration

ESLint rules that can automatically catch and prevent the 5 issues from PR #12.

---

## Quick Start

### 1. Install Required Plugins

```bash
npm install --save-dev eslint-plugin-react-hooks eslint-plugin-jsx-a11y
```

### 2. Update `.eslintrc.cjs` (Server)

```javascript
module.exports = {
  // ... existing config
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'prettier',
    // ADD THESE:
    'plugin:react-hooks/recommended',  // For React projects with hooks
    'plugin:jsx-a11y/recommended'       // For accessibility
  ],
  plugins: [
    // ... existing plugins
    'react-hooks',
    'jsx-a11y'
  ],
  rules: {
    // ... existing rules
    // REACT HOOKS RULES
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',

    // ACCESSIBILITY RULES
    'jsx-a11y/interactive-supports-focus': 'warn',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-static-element-interactions': 'warn',
    'jsx-a11y/no-interactive-element-to-static-element': 'warn',
  }
};
```

### 3. Create/Update `client/.eslintrc.json` (Client)

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "prettier"
  ],
  "plugins": [
    "react-hooks",
    "jsx-a11y"
  ],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error",
    "jsx-a11y/interactive-supports-focus": "warn",
    "jsx-a11y/click-events-have-key-events": "warn",
    "jsx-a11y/no-static-element-interactions": "warn",
    "jsx-a11y/no-interactive-element-to-static-element": "warn"
  }
}
```

### 4. Run ESLint

```bash
npm run lint -- --fix
```

---

## Individual Rules Explained

### Issue #1 & #2: React Hooks Rules

These rules prevent missing `useCallback` and incomplete `useEffect` dependencies.

#### Rule: `react-hooks/rules-of-hooks`

**What it does:** Enforces that hooks are only called at top level and in correct order.

**Prevents:**
- Calling hooks inside conditionals
- Calling hooks inside loops
- Calling hooks inside try/catch blocks

**Example:**
```typescript
// ❌ ESLint ERROR
if (condition) {
  const [state, setState] = useState();  // Error: hooks must be at top level
}

// ✅ CORRECT
const [state, setState] = useState();
if (condition) {
  // use state
}
```

**Configuration:**
```json
{
  "rules": {
    "react-hooks/rules-of-hooks": "error"
  }
}
```

---

#### Rule: `react-hooks/exhaustive-deps`

**What it does:** Ensures all dependencies used in hooks are included in dependency arrays.

**Prevents:**
- Missing `useCallback` dependencies
- Missing `useEffect` dependencies
- Stale closures
- Race conditions

**Example - Issue #1 (Missing useCallback):**
```typescript
// ❌ ESLint WARNING (with useCallback enabled)
const handleEdit = (pkg) => {
  // ... function body
};
// No useCallback wrapper!

// ✅ CORRECT
const handleEdit = useCallback((pkg) => {
  // ... function body
}, []);  // useCallback wrapper
```

**Example - Issue #2 (Missing useEffect Dependencies):**
```typescript
// ❌ ESLint ERROR
useEffect(() => {
  loadData();  // This function is used
}, []);  // But not in dependencies!

// ✅ CORRECT
useEffect(() => {
  loadData();
}, [loadData]);  // Function included in dependencies
```

**Configuration:**
```json
{
  "rules": {
    "react-hooks/exhaustive-deps": "error"
  }
}
```

**When ESLint suggests to disable this rule, DO NOT listen:**
```typescript
// ❌ DON'T DO THIS
useEffect(() => {
  loadData();
}, []); // eslint-disable-line react-hooks/exhaustive-deps
// This defeats the safety mechanism!

// ✅ DO THIS INSTEAD
// 1. Wrap function in useCallback
const loadData = useCallback(async () => { ... }, []);
// 2. Add it to dependencies
useEffect(() => {
  loadData();
}, [loadData]);  // Complete and safe
```

---

### Issue #3: Focus Indicator Rules

These rules detect missing keyboard focus indicators.

#### Rule: `jsx-a11y/interactive-supports-focus`

**What it does:** Ensures interactive elements have focus support attributes.

**Prevents:**
- Interactive elements without focusability
- `<div onClick>` without tabindex
- Elements that can't be reached with keyboard

**Example:**
```typescript
// ⚠️ ESLint WARNING
<button className="custom-btn">Click me</button>  // Fine, <button> is native interactive

// ⚠️ ESLint WARNING
<div onClick={handleClick}>Click me</div>  // Not interactive, not focusable

// ✅ CORRECT
<button onClick={handleClick} className="focus-visible:ring-2">
  Click me
</button>
```

**Configuration:**
```json
{
  "rules": {
    "jsx-a11y/interactive-supports-focus": "warn"
  }
}
```

**Related:** Should go with `jsx-a11y/click-events-have-key-events` below.

---

#### Rule: `jsx-a11y/click-events-have-key-events`

**What it does:** Ensures elements with click handlers also handle keyboard events.

**Prevents:**
- Click-only handlers on non-interactive elements
- Keyboard users being unable to use functionality
- Violates WCAG 2.1.1 (Keyboard)

**Example:**
```typescript
// ❌ ESLint WARNING
<div onClick={handleDelete}>Delete</div>  // Only mouse can use this

// ✅ CORRECT - Option 1: Use interactive element
<button onClick={handleDelete}>Delete</button>

// ✅ CORRECT - Option 2: Add keyboard handler to div
<div
  onClick={handleDelete}
  onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
  role="button"
  tabIndex={0}
>
  Delete
</div>
```

**Configuration:**
```json
{
  "rules": {
    "jsx-a11y/click-events-have-key-events": "warn"
  }
}
```

---

#### Rule: `jsx-a11y/no-static-element-interactions`

**What it does:** Prevents static elements from handling interactive events.

**Prevents:**
- `<div>` or `<span>` with onClick
- Missing keyboard support
- Violates WAI-ARIA best practices

**Example:**
```typescript
// ❌ ESLint WARNING
<span onClick={handleClick}>Link</span>  // Static element, not interactive

// ✅ CORRECT - Option 1: Use interactive element
<button onClick={handleClick}>Click</button>

// ✅ CORRECT - Option 2: Use semantic link
<a href="#" onClick={(e) => { e.preventDefault(); handleClick(); }}>
  Click
</a>

// ✅ CORRECT - Option 3: Make div interactive
<div
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
  role="button"
  tabIndex={0}
  aria-label="Click to action"
>
  Click
</div>
```

**Configuration:**
```json
{
  "rules": {
    "jsx-a11y/no-static-element-interactions": "warn"
  }
}
```

---

### Issue #4 & #5: Related Accessibility Rules

#### Rule: `jsx-a11y/no-interactive-element-to-static-element`

**What it does:** Prevents nesting interactive elements inside static elements.

**Prevents:**
- Button inside button
- Link inside button
- Multiple interactive elements nested
- Confusing focus and keyboard behavior

**Example - Issue #5 (Event Propagation):**
```typescript
// ❌ ESLint WARNING
<summary>
  <Button onClick={handleDelete}>Delete</Button>  // Button in summary!
</summary>

// ✅ CORRECT
<summary>
  <div onClick={(e) => e.stopPropagation()}>
    <Button onClick={handleDelete}>Delete</Button>
  </div>
</summary>
```

**Configuration:**
```json
{
  "rules": {
    "jsx-a11y/no-interactive-element-to-static-element": "warn"
  }
}
```

---

## Complete Configuration File

### `.eslintrc.cjs` (Server & General)

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true  // Important for React rules
    }
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:react-hooks/recommended',  // NEW: React hooks
    'plugin:jsx-a11y/recommended',      // NEW: Accessibility
    'prettier',
  ],
  plugins: [
    '@typescript-eslint',
    'react-hooks',  // NEW
    'jsx-a11y'      // NEW
  ],
  env: {
    node: true,
    es2022: true,
    browser: true  // Add browser env for React/JSX
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // ========== REACT HOOKS RULES ==========
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',

    // ========== ACCESSIBILITY RULES ==========
    'jsx-a11y/interactive-supports-focus': 'warn',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-static-element-interactions': 'warn',
    'jsx-a11y/no-interactive-element-to-static-element': 'warn',
  },
  ignorePatterns: ['dist', 'node_modules', 'coverage', '*.cjs'],
};
```

### `client/.eslintrc.json` (Client/React)

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "prettier"
  ],
  "plugins": [
    "@typescript-eslint",
    "react-hooks",
    "jsx-a11y"
  ],
  "env": {
    "browser": true,
    "es2022": true,
    "node": true
  },
  "rules": {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_"
      }
    ],
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    "no-console": [
      "warn",
      {
        "allow": ["warn", "error"]
      }
    ],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error",
    "jsx-a11y/interactive-supports-focus": "warn",
    "jsx-a11y/click-events-have-key-events": "warn",
    "jsx-a11y/no-static-element-interactions": "warn",
    "jsx-a11y/no-interactive-element-to-static-element": "warn"
  }
}
```

---

## Running ESLint

### Manual Check

```bash
# Check all files
npm run lint

# Check specific directory
npm run lint client/src

# Check specific file
npm run lint client/src/components/MyComponent.tsx

# Show only errors (not warnings)
npm run lint --no-warnings

# Check before specific file changes
npm run lint client/src/features/tenant-admin
```

### Auto-fix

```bash
# Auto-fix all fixable issues
npm run lint -- --fix

# Auto-fix specific directory
npm run lint client/src -- --fix
```

### In CI/CD

```bash
# Fail on any errors (strict mode)
npm run lint -- --max-warnings 0

# Fail if > 5 warnings
npm run lint -- --max-warnings 5

# Generate report
npm run lint -- --format json > eslint-report.json
```

---

## Fixing Common ESLint Errors

### Error: `react-hooks/rules-of-hooks`

**Problem:** Hook called outside top level.

```typescript
// ❌ ERROR
function MyComponent() {
  if (condition) {
    const [state, setState] = useState();  // ❌ Inside if
  }
}

// ✅ FIX
function MyComponent() {
  const [state, setState] = useState();  // ✅ Top level
  if (condition) {
    // Use state here
  }
}
```

---

### Error: `react-hooks/exhaustive-deps`

**Problem:** Missing dependency in array.

```typescript
// ❌ ERROR
useEffect(() => {
  loadData();
}, []);  // loadData missing!

// ✅ FIX - Step 1: Wrap in useCallback
const loadData = useCallback(async () => {
  const result = await api.fetch();
  setData(result);
}, []);

// ✅ FIX - Step 2: Add to dependencies
useEffect(() => {
  loadData();
}, [loadData]);
```

---

### Warning: `jsx-a11y/interactive-supports-focus`

**Problem:** Interactive element not focusable.

```typescript
// ⚠️ WARNING
<div onClick={handleClick}>Button</div>

// ✅ FIX - Use interactive element
<button onClick={handleClick}>Button</button>
```

---

### Warning: `jsx-a11y/click-events-have-key-events`

**Problem:** Click handler but no keyboard handler.

```typescript
// ⚠️ WARNING
<div onClick={handleClick}>Delete</div>

// ✅ FIX - Option 1: Use button
<button onClick={handleClick}>Delete</button>

// ✅ FIX - Option 2: Add keyboard handler
<div
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  Delete
</div>
```

---

### Warning: `jsx-a11y/no-static-element-interactions`

**Problem:** Static element has event handler.

```typescript
// ⚠️ WARNING
<span onClick={handleClick}>Link</span>

// ✅ FIX
<a href="#" onClick={(e) => { e.preventDefault(); handleClick(); }}>
  Link
</a>

// OR
<button onClick={handleClick}>Action</button>
```

---

### Warning: `jsx-a11y/no-interactive-element-to-static-element`

**Problem:** Interactive element inside summary/details.

```typescript
// ⚠️ WARNING (Issue #5)
<summary>
  <Button onClick={handleDelete}>Delete</Button>
</summary>

// ✅ FIX
<summary>
  <div onClick={(e) => e.stopPropagation()}>
    <Button onClick={handleDelete}>Delete</Button>
  </div>
</summary>
```

---

## Suppressing Rules (When Absolutely Necessary)

**Only suppress if you have a VERY GOOD REASON.**

### Suppress Single Line

```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => { ... }, []);
```

### Suppress Block

```typescript
/* eslint-disable react-hooks/exhaustive-deps */
useEffect(() => { ... }, []);
/* eslint-enable react-hooks/exhaustive-deps */
```

### Suppress File

```typescript
/* eslint-disable react-hooks/exhaustive-deps */
// rest of file
```

**⚠️ AVOID SUPPRESSING:**
- `react-hooks/exhaustive-deps` - This is a safety mechanism
- `react-hooks/rules-of-hooks` - This prevents bugs
- `jsx-a11y/*` - These ensure accessibility

---

## Verification Checklist

After updating ESLint config:

```bash
# 1. Install plugins
npm install --save-dev eslint-plugin-react-hooks eslint-plugin-jsx-a11y

# 2. Update config files
#    - .eslintrc.cjs
#    - client/.eslintrc.json

# 3. Run linter
npm run lint

# 4. Fix issues
npm run lint -- --fix

# 5. Verify no errors remain
npm run lint 2>&1 | grep "error:" || echo "All errors fixed!"

# 6. Update CI/CD to use new rules
git add .eslintrc.cjs client/.eslintrc.json
git commit -m "chore: add react-hooks and jsx-a11y ESLint rules"

# 7. Verify in CI
#    Submit PR, CI should pass with new rules
```

---

## PR Template Update

Add to `.github/pull_request_template.md`:

```markdown
## ESLint & Hooks

- [ ] `npm run lint` passes (no errors)
- [ ] `npm run lint 2>&1 | grep react-hooks` (no warnings)
- [ ] `npm run lint 2>&1 | grep jsx-a11y` (no warnings)

## Testing

- [ ] Tested with keyboard (Tab key)
- [ ] No console errors when testing
```

---

## Troubleshooting

### Plugin Not Found Error

```
Error: Failed to load plugin 'react-hooks'
```

**Fix:**
```bash
npm install --save-dev eslint-plugin-react-hooks
npm install --save-dev eslint-plugin-jsx-a11y
```

---

### Rule Doesn't Work

**Check 1:** Is plugin installed?
```bash
npm list eslint-plugin-react-hooks
```

**Check 2:** Is plugin in extends?
```json
{
  "extends": ["plugin:react-hooks/recommended"]
}
```

**Check 3:** Is rule enabled?
```json
{
  "rules": {
    "react-hooks/exhaustive-deps": "error"
  }
}
```

---

### Too Many Warnings

### Gradual Rollout

Start with `warn`, then move to `error`:

```json
{
  "rules": {
    "react-hooks/exhaustive-deps": "warn",  // Start here
    "jsx-a11y/interactive-supports-focus": "warn"
  }
}
```

After team fixes warnings:

```json
{
  "rules": {
    "react-hooks/exhaustive-deps": "error",  // Now strict
    "jsx-a11y/interactive-supports-focus": "error"
  }
}
```

---

## Resources

### Official Documentation
- [eslint-plugin-react-hooks](https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks)
- [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)
- [ESLint Configuration](https://eslint.org/docs/latest/use/configure/)

### WCAG Standards
- [WCAG 2.4.7: Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)
- [WCAG 2.1.1: Keyboard](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html)
- [WCAG 1.3.1: Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)

---

**Last Updated:** 2025-12-01

**Related:**
- [Full Prevention Guide](./PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md)
- [Quick Reference](./PR-12-QUICK-REFERENCE.md)
- [Code Review Checklists](./PR-12-CHECKLISTS.md)
