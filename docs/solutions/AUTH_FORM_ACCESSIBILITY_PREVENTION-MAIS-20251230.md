# Auth Form Accessibility Prevention Strategies

**Status:** Prevention Document
**Date:** 2025-12-30
**Context:** Signup/Login accessibility fixes (P1 + P2 issues identified in commits 0d3824e & d6cef91)
**Author:** Claude Code with Mike Young

---

## Executive Summary

Two commits addressed 6 accessibility issues on the signup page:

**P1 Issues (User-Facing):**

1. Password toggle button not keyboard accessible (`tabIndex={-1}` prevented tabbing)
2. Loading state skeleton missing password hint placeholder (caused Cumulative Layout Shift)
3. Error page dark theme inconsistency

**P2 Issues (Maintainability/Standards):**

1. Missing `aria-invalid` and `aria-describedby` attributes on form inputs
2. Hardcoded hex colors in Chrome autofill CSS (no design tokens)
3. Password toggle button clipping on narrow viewports
4. Lack of documentation for dark theme decision

**Prevention Goal:** Prevent these issues from reoccurring in future auth pages (`/login`, `/forgot-password`, `/reset-password`).

---

## Part 1: Code Review Checklist for Form Components

### A. Keyboard Accessibility (P1 Priority)

**Checkbox: Every form control can be tabbed and operated via keyboard**

- [ ] No `tabIndex={-1}` on interactive buttons (e.g., password toggle, submit CTA)
  - **Exception:** Only use `tabIndex={-1}` for decorative elements (icons with `aria-hidden`)
  - **Test:** Tab through form with keyboard; all buttons should receive focus

- [ ] Tab order is logical: left-to-right, top-to-bottom
  - **Test:** `Tab` key navigates in expected order
  - **Fix:** If custom tab order needed, use explicit `tabIndex={1}, {2}, {3}...` (avoid negative)

- [ ] All buttons have descriptive `aria-label` if not using visible text
  - **Pattern:** `aria-label="Show password"` and `aria-label="Hide password"` (toggle state)
  - **Test:** Screen reader announces action clearly

- [ ] Focus ring visible and sufficient contrast (WCAG 2.1 AA minimum)
  - **Pattern:** `focus:ring-2 focus:ring-sage/50 focus:outline-none`
  - **Test:** Focus with 100% zoom; ring should be clearly visible
  - **Contrast:** Sage ring on dark surface meets >4.5:1 ratio

### B. ARIA Attributes (P2 Priority)

**Checkbox: All form inputs have proper ARIA attributes**

- [ ] `aria-invalid={!!fieldErrors.fieldName}` set on every input
  - **Pattern:**
    ```tsx
    <Input
      aria-invalid={!!fieldErrors.email}
      aria-describedby={fieldErrors.email ? 'email-error' : undefined}
    />
    ```
  - **Test:** Screen reader announces "invalid" when error present
  - **Non-negotiable:** This is WCAG 2.1 requirement

- [ ] `aria-describedby` links to error message ID or hint ID (conditional)
  - **When error exists:** Point to error message ID
    ```tsx
    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
    ```
  - **When no error:** Point to hint/helper text ID (optional)
    ```tsx
    aria-describedby="password-hint" // For validation hints
    ```
  - **Test:** Screen reader announces error/hint when field receives focus

- [ ] Error message has matching `id` attribute
  - **Pattern:**
    ```tsx
    {
      fieldErrors.email && (
        <p id="email-error" role="alert">
          {fieldErrors.email}
        </p>
      );
    }
    ```
  - **Important:** `id` must match exactly what's in `aria-describedby`

- [ ] Form has `aria-labelledby` pointing to primary heading
  - **Pattern:**
    ```tsx
    <h1 id="signup-heading">Let's build your storefront.</h1>
    <form aria-labelledby="signup-heading">
    ```
  - **Test:** Screen reader announces form purpose when entering form

### C. Loading & Placeholders (P1 Priority)

**Checkbox: Loading states prevent Cumulative Layout Shift (CLS)**

- [ ] Loading skeleton includes placeholder for password hint
  - **Pattern:** In `SignupFormSkeleton()`:
    ```tsx
    {
      i === 3 && <div className="h-4 w-28 animate-pulse rounded bg-neutral-700" />;
    }
    ```
  - **Why:** Password field has validation hint below it; skeleton must reserve that space
  - **Test:** Reload signup page in Chrome DevTools → Performance → check CLS < 0.1

- [ ] Route-level `loading.tsx` file exists for App Router pages
  - **Affected routes:** `/signup`, `/login`, `/forgot-password`, `/reset-password`
  - **Pattern:**
    ```tsx
    // apps/web/src/app/signup/loading.tsx
    export default function SignupLoading() {
      return <SignupFormSkeleton />;
    }
    ```
  - **Why:** Prevents flash of blank content during route transitions
  - **Test:** Route transition should show skeleton, then full form

- [ ] Skeleton uses same color tokens as actual page
  - **Pattern:** Use `bg-surface`, `bg-surface-alt`, `bg-neutral-700` (not hardcoded hex)
  - **Test:** Skeleton and loaded page should have consistent theme

### D. Error Presentation (P1 + P2 Priority)

**Checkbox: Error states are clear and accessible**

- [ ] Error message has `role="alert"` for live announcement
  - **Pattern:**
    ```tsx
    <p id="email-error" role="alert" className="text-sm text-danger-500">
      {fieldErrors.email}
    </p>
    ```
  - **Test:** Screen reader immediately announces error when field loses focus

- [ ] Error styling visible with sufficient contrast
  - **Pattern:** `text-danger-500` on `bg-surface` achieves >7:1 contrast
  - **Test:** Use axe DevTools or WAVE to verify WCAG AA compliance

- [ ] Global error alert (form-level) has `aria-live="polite"`
  - **Pattern:**
    ```tsx
    {
      error && (
        <Alert variant="destructive" role="alert" aria-live="polite">
          {error}
        </Alert>
      );
    }
    ```
  - **Test:** Screen reader announces error; `polite` means it doesn't interrupt current speech

- [ ] Form provides `aria-busy="true"` during loading
  - **Pattern:**
    ```tsx
    <form aria-labelledby="signup-heading" aria-busy={isLoading}>
    ```
  - **Test:** Screen reader announces "form busy" while submitting

### E. Theme Consistency (P2 Priority)

**Checkbox: All pages follow dark theme for auth pages**

- [ ] Background uses `bg-surface` (dark graphite) not hardcoded hex
  - **Pattern:** `bg-surface` = `#18181B` (from Tailwind config)
  - **Non-negotiable:** Use design tokens, not hex colors
  - **Exception:** Chrome autofill CSS can use CSS variables (see section F)

- [ ] Card backgrounds use `bg-surface-alt` (slightly lighter)
  - **Pattern:** Cards use `bg-surface-alt` = `#27272A`
  - **Contrast:** Provides visual hierarchy without being harsh

- [ ] Text colors use semantic tokens: `text-primary`, `text-muted`, `text-danger-500`
  - **Never hardcode:** `#FAFAFA`, `#A1A1AA`, `#EF4444`
  - **Test:** If design system colors change, one edit updates all pages

### F. Browser Compatibility (P2 Priority)

**Checkbox: Chrome autofill styling handled correctly**

- [ ] Chrome autofill CSS uses CSS variables, not hardcoded colors
  - **Pattern:**
    ```css
    :root {
      --autofill-bg: #18181b;
      --autofill-text: #fafafa;
    }
    input:-webkit-autofill {
      -webkit-box-shadow: 0 0 0 1000px var(--autofill-bg) inset !important;
      -webkit-text-fill-color: var(--autofill-text) !important;
    }
    ```
  - **Location:** `apps/web/src/styles/globals.css`
  - **Why:** If dark theme changes, update one CSS variable (not hardcoded hex)

- [ ] Autofill transition smooth: `transition: background-color 5000s ease-in-out 0s;`
  - **Purpose:** Prevents yellow flash when browser autofills
  - **Do not remove:** This is critical for dark theme UX

### G. Button Sizing & Positioning (P2 Priority)

**Checkbox: Interactive buttons meet 44px touch target and don't clip**

- [ ] Password toggle button has `min-w-[44px] min-h-[44px]` touch target
  - **Pattern:**
    ```tsx
    <button
      type="button"
      className="min-w-[44px] min-h-[44px] flex items-center justify-center"
    >
    ```
  - **Why:** WCAG 2.1 minimum for touch-friendly interfaces

- [ ] Button positioning doesn't cause overflow or clipping
  - **Wrong:** `right-3 -mr-2` (causes clipping on narrow viewports)
  - **Correct:** `right-1` (keeps button inside input bounds)
  - **Pattern:** Use `pr-1` on input to reserve space for button
    ```tsx
    <Input className="pr-12" /> {/* 12 = 3rem, enough for 44px button + padding */}
    <button className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px]">
    ```

- [ ] Submit button has clear loading state with spinner
  - **Pattern:**
    ```tsx
    {
      isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="animate-spin" aria-hidden="true" />
          {content.loadingCta}
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          {content.cta}
          <ArrowRight aria-hidden="true" />
        </span>
      );
    }
    ```
  - **Test:** Button should be disabled while loading; content should change

---

## Part 2: Testing Strategy

### A. Manual Accessibility Testing (Required Before Commit)

**Keyboard Navigation (5 min)**

```
1. Open signup page
2. Press Tab 5+ times → verify focus moves to: Business Name → Email → Password → Toggle → Submit → Sign in link
3. Press Shift+Tab → focus should move backward
4. Tab to Password Toggle → Press Enter → field type should toggle text/password
5. Tab to Submit → Press Enter → form should submit
✓ All interactive elements should be reachable via Tab only
```

**Screen Reader Testing (10 min)**

```
Tool: NVDA (Windows) or VoiceOver (Mac)

1. Open signup page
2. Screen reader should announce:
   - "HANDLED" (logo)
   - "14 days free — no credit card" (badge)
   - "Let's build your storefront" (form heading)
   - Form purpose announcement
3. Tab to email input → should announce:
   - "Email, edit text, required, you@example.com"
4. Type invalid email → blur field → should announce:
   - "Email, edit text, invalid, required, Please enter a valid email address"
5. Tab to password input → should announce hint:
   - "Min 8 characters"
6. Type password (8+ chars) → should update to:
   - "8+ characters, text color changed to green"
✓ Screen reader provides full context for all interactions
```

**Chrome DevTools - Accessibility Audit (2 min)**

```
1. Open Chrome DevTools → Lighthouse → Accessibility
2. Run audit
3. Should achieve 95+ score
4. Check for:
   - Form labels properly associated with inputs ✓
   - ARIA attributes valid ✓
   - Color contrast meets WCAG AA ✓
5. Common failures to watch for:
   ✗ Missing aria-invalid on inputs (will be caught)
   ✗ aria-describedby points to non-existent ID (will be caught)
   ✗ Contrast ratio below 4.5:1 (will be caught)
```

**Layout Shift Testing (2 min)**

```
1. Open Chrome DevTools → Performance tab
2. Record page load + wait 5 sec
3. Check CLS (Cumulative Layout Shift)
   ✓ Should be < 0.1 (good)
   ✗ If > 0.1, skeleton missing placeholder space
4. Inspect: Is password hint placeholder reserved in skeleton? Yes ✓
```

### B. Automated Testing

**ESLint Rules (Catch Issues in IDE)**

Current config at `/Users/mikeyoung/CODING/MAIS/.eslintrc.cjs`:

```javascript
rules: {
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/no-explicit-any': 'warn',
}
```

**Recommended additions** (for accessibility):

Create `apps/web/.eslintrc.json` with:

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
    "jsx-a11y/no-static-element-interactions": "warn"
  }
}
```

**Installation:**

```bash
npm install --save-dev eslint-plugin-jsx-a11y
```

**Benefits:**

- Catches missing `aria-invalid`, `aria-describedby` at edit time
- Prevents `onClick` on `<div>` without keyboard support
- Flags interactive elements that can't be tabbed

**Run:**

```bash
npm run lint -- apps/web/src/app/signup/page.tsx
```

### C. Pre-Commit Verification Steps

**Create** `scripts/verify-form-accessibility.sh`:

```bash
#!/bin/bash
set -e

echo "🔍 Checking form accessibility standards..."

# Check for missing aria-invalid patterns
if grep -r "type=\"password\"" apps/web/src/app/*/page.tsx \
   | grep -v "aria-invalid" > /dev/null 2>&1; then
  echo "❌ Missing aria-invalid on password input"
  exit 1
fi

# Check for missing aria-describedby on error messages
if grep -r "role=\"alert\"" apps/web/src/app/*/page.tsx \
   | grep -v "id=" > /dev/null 2>&1; then
  echo "❌ Missing id on error message (for aria-describedby)"
  exit 1
fi

# Check for hardcoded colors in auth pages
if grep -r "#[0-9A-Fa-f]\{6\}" apps/web/src/app/signup \
   | grep -v "autofill" | grep -v "node_modules" > /dev/null 2>&1; then
  echo "❌ Hardcoded hex colors detected (use design tokens instead)"
  exit 1
fi

# Run ESLint accessibility checks
npm run lint -- apps/web/src/app/signup/page.tsx

echo "✅ Form accessibility standards verified"
```

**Add to** `package.json`:

```json
{
  "scripts": {
    "verify:a11y": "bash scripts/verify-form-accessibility.sh"
  },
  "husky": {
    "hooks": {
      "pre-commit": "npm run verify:a11y && npm run lint && npm run typecheck"
    }
  }
}
```

**Install Husky:**

```bash
npm install husky --save-dev
npx husky install
```

---

## Part 3: Pattern for All Future Auth Pages

### Template: Auth Page Structure

**File:** `apps/web/src/app/[auth-route]/page.tsx`

```tsx
'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Auth Form Component
 *
 * ACCESSIBILITY REQUIREMENTS (P1 + P2):
 * - All inputs have aria-invalid={!!errors.field} and aria-describedby
 * - Error messages have id and role="alert"
 * - Interactive buttons are keyboard accessible (no tabIndex={-1})
 * - Form has aria-labelledby pointing to page heading
 * - Focus ring visible on all interactive elements
 * - Dark theme uses bg-surface, bg-surface-alt, not hardcoded hex
 */
function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement auth logic
  };

  const inputStyles =
    'bg-surface border-neutral-700 text-text-primary placeholder:text-text-muted/60 focus:border-sage focus:ring-2 focus:ring-sage/20 focus:outline-none';

  return (
    <div className="w-full max-w-md mx-auto">
      <h1
        id="auth-heading"
        className="font-serif text-3xl font-bold text-text-primary text-center mb-8"
      >
        Sign In
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        aria-labelledby="auth-heading"
        aria-busy={isLoading}
      >
        {isLoading && (
          <span className="sr-only" aria-live="polite">
            Processing your request, please wait.
          </span>
        )}

        {error && (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Email Field - PATTERN: aria-invalid + aria-describedby */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) {
                setFieldErrors((prev) => ({ ...prev, email: '' }));
              }
            }}
            className={inputStyles}
            required
            disabled={isLoading}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email && (
            <p id="email-error" role="alert" className="text-sm text-danger-500">
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Password Field - PATTERN: toggle button is keyboard accessible */}
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: '' }));
                }
              }}
              className={`${inputStyles} pr-12`}
              required
              disabled={isLoading}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
            {/* Toggle button - NO tabIndex={-1}, HAS focus ring */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-sage/50 rounded"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {/* Icon here */}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="password-error" role="alert" className="text-sm text-danger-500">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <Button type="submit" variant="sage" disabled={isLoading} className="w-full">
          {isLoading ? 'Processing...' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
}

/**
 * Loading Skeleton
 *
 * ACCESSIBILITY: Reserves space for all content to prevent CLS
 */
function AuthFormSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="h-9 w-32 mx-auto animate-pulse rounded bg-neutral-700 mb-8" />
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-neutral-700" />
            <div className="h-12 animate-pulse rounded-lg bg-neutral-700" />
          </div>
        ))}
        <div className="h-12 animate-pulse rounded-full bg-sage/30 mt-6" />
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Suspense fallback={<AuthFormSkeleton />}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
```

**File:** `apps/web/src/app/[auth-route]/loading.tsx`

```tsx
/**
 * Loading State - Next.js App Router
 *
 * Route-level loading fallback.
 * Prevents flash of blank content during route transitions.
 */

function AuthFormSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="h-9 w-32 mx-auto animate-pulse rounded bg-neutral-700 mb-8" />
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-neutral-700" />
            <div className="h-12 animate-pulse rounded-lg bg-neutral-700" />
          </div>
        ))}
        <div className="h-12 animate-pulse rounded-full bg-sage/30 mt-6" />
      </div>
    </div>
  );
}

export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <AuthFormSkeleton />
    </div>
  );
}
```

**File:** `apps/web/src/app/[auth-route]/error.tsx`

```tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Auth error boundary caught error', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="text-center space-y-4 p-8 max-w-md">
        <h2 className="text-2xl font-bold text-text-primary">Something went wrong</h2>
        <p className="text-text-muted">We encountered an error. Please try again.</p>
        <Button onClick={reset} variant="sage">
          Try Again
        </Button>
      </div>
    </div>
  );
}
```

---

## Part 4: ESLint & Configuration Recommendations

### A. Existing ESLint Setup

**Location:** `/Users/mikeyoung/CODING/MAIS/.eslintrc.cjs`

Current rules are good for general TypeScript. **Need to add accessibility plugin for Next.js.**

### B. Recommended: Add jsx-a11y Plugin

**Step 1:** Install plugin

```bash
npm install --save-dev eslint-plugin-jsx-a11y
```

**Step 2:** Create `apps/web/.eslintrc.json`

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
    "jsx-a11y/label-has-associated-control": "error"
  }
}
```

**Step 3:** Update `apps/web/package.json`

```json
{
  "scripts": {
    "lint": "eslint src --ext .ts,.tsx --max-warnings 0"
  }
}
```

**Step 4:** Run linter

```bash
npm run lint
```

### C. What jsx-a11y Catches

| Rule                                            | Catches                                     | Example                                        |
| ----------------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| `aria-props`                                    | Invalid ARIA attribute names                | `aria-labeledby` (should be `aria-labelledby`) |
| `aria-role`                                     | Invalid ARIA roles                          | `role="button-dropdown"` (not a real role)     |
| `no-interactive-element-to-noninteractive-role` | Making `<button>` non-interactive           | `<button role="presentation">`                 |
| `click-events-have-key-events`                  | `onClick` without keyboard support          | `<div onClick={...}>` without `onKeyDown`      |
| `label-has-associated-control`                  | `<label>` without `htmlFor` or nested input | `<label>Email</label>` (no association)        |

### D. Test Command

```bash
# Lint just signup page
npm run lint -- apps/web/src/app/signup/page.tsx

# Lint all web app
npm run lint -- apps/web/src

# Fix automatically (some rules)
npm run lint -- apps/web/src --fix
```

---

## Part 5: Summary Checklist for Implementation

### For Each New Auth Page (`/login`, `/forgot-password`, etc.)

**Before starting code:**

- [ ] Read this prevention document (15 min)
- [ ] Copy template from Part 3
- [ ] Review ADR-017 (dark theme decision) from commit d6cef91

**During development:**

- [ ] Use `aria-invalid` + `aria-describedby` on all inputs
- [ ] Add `id` to all error/hint messages
- [ ] No `tabIndex={-1}` on interactive elements
- [ ] Use design tokens: `bg-surface`, `text-text-primary`, not hex colors
- [ ] Create `loading.tsx` file
- [ ] Create `error.tsx` file with `role="alert"` on form

**Before commit:**

- [ ] Run manual keyboard navigation test (5 min)
- [ ] Run screen reader test with NVDA/VoiceOver (10 min)
- [ ] Chrome DevTools → Lighthouse Accessibility audit (2 min)
- [ ] Run `npm run lint`
- [ ] Run `npm run typecheck`
- [ ] No hardcoded hex colors (except in CSS variables for autofill)

**Post-commit:**

- [ ] ADR created for any new design decisions
- [ ] Documentation added for unusual patterns
- [ ] Team review of accessibility checklist

---

## Reference Files

**Key files from recent fixes:**

- Signup page: `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/signup/page.tsx`
- Loading state: `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/signup/loading.tsx`
- Error boundary: `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/signup/error.tsx`
- Global CSS: `/Users/mikeyoung/CODING/MAIS/apps/web/src/styles/globals.css`
- ADR-017: `/Users/mikeyoung/CODING/MAIS/docs/adrs/ADR-017-dark-theme-auth-pages.md`

**Related commits:**

- P1 fixes: `0d3824e`
- P2 fixes: `d6cef91`

**ESLint config:**

- Root: `/Users/mikeyoung/CODING/MAIS/.eslintrc.cjs`
- To be created: `apps/web/.eslintrc.json`

---

## FAQ

**Q: Why use `aria-describedby` for BOTH errors AND hints?**
A: Conditional logic:

- If error exists: `aria-describedby="email-error"` (announces error)
- If no error: `aria-describedby="email-hint"` (announces hint)
- Screen reader provides complete context for field

**Q: Can I use `tabIndex={-1}` on the password toggle?**
A: NO. Remove it. The toggle is an interactive button; users need to tab to it.

**Q: Why does password skeleton need a placeholder?**
A: The password field has a validation hint below it (`"Min 8 characters"`). If the skeleton doesn't reserve that space, the form jumps down when the page loads. This is Cumulative Layout Shift (CLS) > 0.1 = bad Core Web Vitals.

**Q: Should auth pages be dark theme forever?**
A: See ADR-017. Dark theme is intentional for UX (context shift, focus reduction). If marketing site becomes dark, we'd need to reconsider.

**Q: How do I test with a real screen reader?**
A:

- **Mac:** System Preferences → Accessibility → VoiceOver (Cmd+F5)
- **Windows:** Settings → Ease of Access → Narrator (Win+Enter)
- **Web:** Use NVDA (free, Windows) or JAWS (paid, all platforms)

**Q: What's the difference between `role="alert"` and `aria-live="polite"`?**
A: `role="alert"` = `aria-live="assertive"` (immediate announcement). Use for form-level errors.
`aria-live="polite"` = waits for screen reader to finish current speech. Use for loading states.

---

## Maintenance

**When updating design tokens:**

1. Edit `tailwind.config.js` (dark theme colors)
2. Update CSS variables in `globals.css` (autofill)
3. Re-run all auth pages through manual accessibility test
4. Update ADR-017 with new color values

**When ESLint rules change:**

1. Update `apps/web/.eslintrc.json`
2. Run `npm run lint`
3. Fix violations or update exemptions with explanation

**When Next.js versions update:**

1. Check if `loading.tsx` / `error.tsx` behavior changed
2. Verify `Suspense` patterns still work
3. Test route transitions for CLS
