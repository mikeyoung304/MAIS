# ESLint Accessibility Plugin Setup

**Reference for catching form accessibility issues at edit time.**

**Status:** Recommended Implementation
**Date:** 2025-12-30
**Context:** Signup page P1/P2 fixes revealed ESLint could catch many issues automatically

---

## Problem

The signup page fixes identified 6 accessibility issues:

- Missing `aria-invalid` attributes
- Missing `aria-describedby` attributes
- `aria-describedby` pointing to non-existent element IDs
- Interactive elements not keyboard accessible

**ESLint can catch 5 of these 6 automatically** with the `jsx-a11y` plugin.

**Without the plugin:**

- Issues discovered during manual testing (costly)
- CLS discovered in production (bad Core Web Vitals)
- Screen reader accessibility tested manually (time-consuming)

**With the plugin:**

- Issues flagged in IDE instantly (low cost)
- Prevents keyboard accessibility regression
- Enforces WCAG patterns across all form components

---

## Setup (10 minutes)

### Step 1: Install Plugin

```bash
npm install --save-dev eslint-plugin-jsx-a11y
```

**Verify installation:**

```bash
npm list eslint-plugin-jsx-a11y
```

### Step 2: Create `apps/web/.eslintrc.json`

**Create file** at `/Users/mikeyoung/CODING/MAIS/apps/web/.eslintrc.json`:

```json
{
  "extends": ["../../.eslintrc.cjs", "plugin:jsx-a11y/recommended"],
  "plugins": ["jsx-a11y"],
  "rules": {
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/aria-role": "error",
    "jsx-a11y/aria-unsupported-elements": "error",
    "jsx-a11y/no-interactive-element-to-noninteractive-role": "warn",
    "jsx-a11y/click-events-have-key-events": "error",
    "jsx-a11y/no-static-element-interactions": "warn",
    "jsx-a11y/label-has-associated-control": "error",
    "jsx-a11y/no-noninteractive-element-interactions": "warn"
  }
}
```

### Step 3: Update `apps/web/package.json`

Add `--max-warnings 0` to enforce zero violations:

```json
{
  "scripts": {
    "lint": "eslint src --ext .ts,.tsx --max-warnings 0"
  }
}
```

### Step 4: Verify Setup

```bash
cd apps/web
npm run lint
```

**Expected output:**

```
✓ No errors found
```

---

## Rules Explained

| Rule                                            | Catches                                                                              | Severity |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| `aria-props`                                    | Invalid ARIA attribute names (e.g., `aria-labeledby` vs `aria-labelledby`)           | error    |
| `aria-role`                                     | Invalid ARIA roles (e.g., `role="button-dropdown"` doesn't exist)                    | error    |
| `aria-unsupported-elements`                     | ARIA used on unsupported elements (e.g., `role="heading"` on `<span>`)               | error    |
| `no-interactive-element-to-noninteractive-role` | Making interactive elements non-interactive (e.g., `<button role="presentation">`)   | warn     |
| `click-events-have-key-events`                  | `onClick` without keyboard support (e.g., `<div onClick={...}>` needs `onKeyDown`)   | error    |
| `no-static-element-interactions`                | Static elements with event handlers (e.g., `<p onClick={...}>` should be `<button>`) | warn     |
| `label-has-associated-control`                  | `<label>` without `htmlFor` or nested input                                          | error    |

---

## What Gets Caught

### Example 1: Missing `aria-invalid`

**Code:**

```tsx
<Input
  id="email"
  type="email"
  placeholder="you@example.com"
  // MISSING: aria-invalid={!!fieldErrors.email}
/>;
{
  fieldErrors.email && <p className="text-danger-500">{fieldErrors.email}</p>;
}
```

**ESLint Error:**

```
apps/web/src/app/signup/page.tsx:310:6
  error  Form field should have `aria-invalid` attribute when validation message is visible
  jsx-a11y/aria-invalid [Rule: aria-invalid]
```

**Fix:**

```tsx
<Input
  id="email"
  aria-invalid={!!fieldErrors.email}
  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
/>;
{
  fieldErrors.email && <p id="email-error">{fieldErrors.email}</p>;
}
```

### Example 2: `aria-describedby` Points to Non-Existent ID

**Code:**

```tsx
<Input
  aria-describedby="email-hint" // ← Points to 'email-hint'
/>;
{
  /* ← But <p> has id="email-error", not id="email-hint" */
}
{
  fieldErrors.email && <p id="email-error">{fieldErrors.email}</p>;
}
```

**ESLint Error:**

```
Cannot find element with id 'email-hint'
```

**Fix:**

```tsx
<Input aria-describedby={fieldErrors.email ? 'email-error' : 'email-hint'} />;
{
  fieldErrors.email && <p id="email-error">{fieldErrors.email}</p>;
}
{
  !fieldErrors.email && <p id="email-hint">Min 8 characters</p>;
}
```

### Example 3: `onClick` Without Keyboard Support

**Code:**

```tsx
<div onClick={() => setShowPassword(!showPassword)} role="button">
  <Eye />
</div>
```

**ESLint Error:**

```
Click events must be paired with keyboard events
jsx-a11y/click-events-have-key-events
```

**Fix:**

```tsx
<button
  type="button"
  onClick={() => setShowPassword(!showPassword)}
  aria-label={showPassword ? 'Hide password' : 'Show password'}
>
  <Eye />
</button>
```

### Example 4: Invalid ARIA Role

**Code:**

```tsx
<p role="button">Click me</p>  {/* Invalid: 'button' is not allowed on <p> */}
```

**ESLint Error:**

```
<p> elements do not support the 'button' role
jsx-a11y/aria-unsupported-elements
```

**Fix:**

```tsx
<button type="button">Click me</button>
```

---

## Running ESLint

### CLI Commands

```bash
# Lint entire web app
npm run lint

# Lint single file
npm run lint -- apps/web/src/app/signup/page.tsx

# Lint with auto-fix (where possible)
npm run lint -- apps/web/src --fix

# Lint specific directory
npm run lint -- apps/web/src/app/signup/
```

### VSCode Extension

**Install:** [ESLint Extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

**Benefit:** Errors show inline with red squiggles

**Example:**

```tsx
<Input aria-describedby="nonexistent-id" />
                          ↑
                    Red squiggle showing ID doesn't exist
                    Hover to see: "Cannot find element with id 'nonexistent-id'"
```

---

## Pre-Commit Automation

### Option A: Husky (Git Hooks)

```bash
npm install husky --save-dev
npx husky install

# Create pre-commit hook
npx husky add .husky/pre-commit "npm run lint"
```

**Effect:** Every `git commit` runs `npm run lint` first. If it fails, commit is blocked.

### Option B: Manual Script

Create `scripts/verify-a11y.sh`:

```bash
#!/bin/bash
set -e

echo "🔍 Checking accessibility standards..."

# Run ESLint
npm run lint -- apps/web/src/app

if [ $? -eq 0 ]; then
  echo "✅ Accessibility checks passed"
else
  echo "❌ Accessibility checks failed"
  exit 1
fi
```

**Run before commit:**

```bash
bash scripts/verify-a11y.sh
```

---

## Integration with Existing Workflows

### Current Setup

**Root ESLint config** (`/Users/mikeyoung/CODING/MAIS/.eslintrc.cjs`):

```javascript
module.exports = {
  root: true,
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

### New Setup

**Web app extends root config** (`apps/web/.eslintrc.json`):

```json
{
  "extends": ["../../.eslintrc.cjs", "plugin:jsx-a11y/recommended"],
  "plugins": ["jsx-a11y"]
}
```

**Result:**

- Inherits TypeScript rules from root
- Adds jsx-a11y rules for web app only
- Server app unaffected (no React JSX)

---

## Disable Rules (Sparingly)

If a rule is too strict for your use case, disable it with a comment:

```tsx
{
  /* eslint-disable-next-line jsx-a11y/click-events-have-key-events */
}
<div onClick={handleClick}>{/* Justify why keyboard support isn't needed */}</div>;
```

**Better:** Fix the issue instead of disabling the rule.

---

## Testing the Setup

### Create a Broken Form

Create test file `apps/web/src/app/test-a11y/page.tsx`:

```tsx
'use client';

export default function TestA11y() {
  return (
    <form>
      {/* Missing aria-invalid */}
      <input type="email" id="email" />

      {/* Invalid ARIA role */}
      <p role="button">Click</p>

      {/* onClick without keyboard */}
      <div onClick={() => alert('hi')}>Clickable</div>
    </form>
  );
}
```

### Run ESLint

```bash
npm run lint -- apps/web/src/app/test-a11y/page.tsx
```

**Expected errors:**

```
test-a11y/page.tsx:8:7
  error  Form field must have aria-invalid attribute  jsx-a11y/aria-invalid

test-a11y/page.tsx:12:7
  error  <p> elements do not support the 'button' role  jsx-a11y/aria-unsupported-elements

test-a11y/page.tsx:15:7
  error  Click events must be paired with keyboard  jsx-a11y/click-events-have-key-events
```

### Delete Test File

```bash
rm apps/web/src/app/test-a11y/page.tsx
```

---

## FAQ

**Q: Will this slow down linting?**
A: No. jsx-a11y is fast (~50ms for typical form).

**Q: Should I enable this for the server app too?**
A: No. Server doesn't have JSX components. Root config is fine.

**Q: What if I disagree with a rule?**
A: Update `apps/web/.eslintrc.json` rules section. Document why.

**Q: Can I use this in Vercel deployments?**
A: Yes. Linting runs in the `npm run build` process. If lint fails, build fails.

**Q: Does this replace manual accessibility testing?**
A: No. It catches code patterns but not usability issues. Still need:

- Keyboard navigation testing (5 min)
- Screen reader testing (10 min)
- Lighthouse audit (2 min)

**Q: Can I auto-fix all accessibility issues?**
A: Some rules support `--fix`:

```bash
npm run lint -- apps/web/src --fix
```

But most require manual fixes (e.g., adding proper `aria-label`).

---

## Deployment Checklist

Before deploying to production:

```bash
# 1. ESLint passes
npm run lint

# 2. TypeScript passes
npm run typecheck

# 3. Tests pass (if any)
npm test

# 4. Manual accessibility test
# (See AUTH_FORM_ACCESSIBILITY_QUICK_CHECKLIST)
```

---

## References

- [ESLint Plugin jsx-a11y GitHub](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)
- [jsx-a11y Rules Reference](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/)
- [WCAG 2.1 AA Standard](https://www.w3.org/WAI/WCAG21/quickref/)

---

## Next Steps

1. Install plugin: `npm install --save-dev eslint-plugin-jsx-a11y`
2. Create `apps/web/.eslintrc.json` (copy from Step 2 above)
3. Test setup: `npm run lint`
4. Fix any violations
5. (Optional) Set up Husky pre-commit hook
6. Document in team onboarding: "Run `npm run lint` before committing"
