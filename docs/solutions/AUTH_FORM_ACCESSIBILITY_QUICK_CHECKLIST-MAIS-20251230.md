# Auth Form Accessibility Quick Checklist

**Use this before committing any auth page changes.**

**Time: 20 minutes total**

---

## Pre-Code Checklist (Before Starting)

- [ ] Read `AUTH_FORM_ACCESSIBILITY_PREVENTION-MAIS-20251230.md` (15 min)
- [ ] Copy template from Part 3 (5 min)
- [ ] Review ADR-017 for dark theme decisions (5 min)
- [ ] Plan: Which new pages are you adding? (signup, login, forgot-password, etc.)

---

## Code Review Checklist (While Writing)

### Keyboard Accessibility

- [ ] No `tabIndex={-1}` on interactive buttons
- [ ] Password toggle is a `<button type="button">` with visible focus ring
- [ ] All form inputs have `aria-invalid={!!fieldErrors.fieldName}`
- [ ] All error messages have matching `id` attributes

### ARIA & Labels

- [ ] `<form aria-labelledby="heading-id">`
- [ ] `<h1 id="heading-id">...</h1>` exists
- [ ] All inputs: `aria-describedby={error ? 'error-id' : 'hint-id'}`
- [ ] Error messages: `id="field-error" role="alert"`
- [ ] Global error: `<Alert role="alert" aria-live="polite">`
- [ ] Loading form: `<form aria-busy={isLoading}>`
- [ ] Loading message: `<span className="sr-only" aria-live="polite">`

### Dark Theme (Design Tokens)

- [ ] Background: `bg-surface` (not `#18181B`)
- [ ] Card: `bg-surface-alt` (not `#27272A`)
- [ ] Text: `text-text-primary`, `text-text-muted`, `text-danger-500` (not hex)
- [ ] Sage accent: `text-sage`, `focus:ring-sage/50` (not `#45B37F`)

### Loading & CLS Prevention

- [ ] `loading.tsx` file exists at route level
- [ ] Skeleton includes placeholder for password hint: `{i === 3 && <div...>}`
- [ ] All skeleton colors use Tailwind: `bg-neutral-700` (not hex)
- [ ] Button in skeleton: `bg-sage/30` (not hex)

### Error Handling

- [ ] Error states have `text-danger-500` (contrast > 7:1)
- [ ] Password toggle clear on mobile (use `right-1`, not `right-3 -mr-2`)
- [ ] Input touch target 44px+ (`min-w-[44px] min-h-[44px]`)
- [ ] Chrome autofill handled in `globals.css` (see template)

### Files Created

- [ ] `/app/[route]/page.tsx` (main form)
- [ ] `/app/[route]/loading.tsx` (skeleton)
- [ ] `/app/[route]/error.tsx` (error boundary)
- [ ] Comments explaining dark theme and raw fetch() usage

---

## Pre-Commit Testing (20 minutes)

### Manual Testing (5 min keyboard, 10 min screen reader, 2 min audit, 2 min CLS)

**Keyboard Navigation (5 min)**

```
npm run dev:web  # Start Next.js
# Visit http://localhost:3000/signup

1. Tab through all inputs → verify order
2. Shift+Tab → backwards navigation works
3. Tab to password toggle → press Space/Enter → toggle works
4. Tab to submit → press Enter → form submits
✓ Pass: All interactive elements reachable
✗ Fail: Any button not reachable = missing aria-invalid or has tabIndex={-1}
```

**Screen Reader (10 min)**

```
Mac VoiceOver: Cmd+F5
Windows NVDA: Win+Enter

1. Start reader
2. Tab to email → should announce: "Email, edit text, required, placeholder"
3. Type invalid email → blur → should announce error
4. Tab to password → should announce hint
5. Tab to toggle → should announce "Show/Hide password"
6. Tab to submit → should announce button action
✓ Pass: Full context announced for every field
✗ Fail: Any missing aria attribute will be obvious
```

**Chrome DevTools Audit (2 min)**

```
DevTools → Lighthouse → Accessibility → Analyze

Target: 95+ score
Check for:
  ✓ Forms have labels
  ✓ ARIA attributes valid (no aria-describedby pointing to missing id)
  ✓ Contrast ratios (text-danger-500 on dark surface = 7:1+)
  ✓ Button names (aria-label present)
```

**CLS Check (2 min)**

```
DevTools → Performance → Record

1. Start recording
2. Wait for page load
3. Stop recording
4. Check CLS metric (Cumulative Layout Shift)

✓ Pass: CLS < 0.1 (good)
✗ Fail: CLS > 0.1 = skeleton missing placeholder
  → Add password hint placeholder to skeleton
```

---

## Pre-Commit Code Quality (5 minutes)

```bash
# 1. ESLint (2 min)
npm run lint -- apps/web/src/app/[your-route]/

✓ Pass: No errors
✗ Fail: Fix missing aria attributes or click-without-keyboard issues

# 2. TypeScript (2 min)
npm run typecheck

✓ Pass: No type errors
✗ Fail: Fix type issues

# 3. Manual hex color check (1 min)
grep -r "#[0-9A-Fa-f]\{6\}" apps/web/src/app/[your-route]/
# Should only find in comments, not in className/styles
# Except: globals.css can have CSS variables
```

---

## Commit Checklist

Before `git commit`:

- [ ] Keyboard test passed (Tab, Shift+Tab, Enter all work)
- [ ] Screen reader test passed (all fields announce context)
- [ ] Lighthouse audit: 95+ accessibility score
- [ ] CLS < 0.1 (no layout shift during load)
- [ ] No hardcoded hex colors (only design tokens)
- [ ] ESLint clean: `npm run lint` passes
- [ ] TypeScript clean: `npm run typecheck` passes
- [ ] Commit message follows pattern:

  ```
  feat(web): add /login auth page with dark theme

  - Keyboard accessible password toggle
  - WCAG 2.1 AA contrast ratios
  - Dark theme (bg-surface) consistent with /signup
  - Loading skeleton prevents CLS
  ```

---

## Red Flags (Fix Before Commit)

🚩 **Missing `aria-invalid`** → Screen reader won't announce "invalid"

```tsx
// ✗ Wrong
<Input value={email} />

// ✓ Correct
<Input aria-invalid={!!fieldErrors.email} />
```

🚩 **Missing error message `id`** → `aria-describedby` points to nothing

```tsx
// ✗ Wrong
{
  error && <p className="text-danger-500">{error}</p>;
}

// ✓ Correct
{
  error && <p id="email-error">{error}</p>;
}
```

🚩 **`tabIndex={-1}` on toggle button** → Not keyboard accessible

```tsx
// ✗ Wrong
<button type="button" tabIndex={-1} onClick={...}>

// ✓ Correct
<button type="button" onClick={...}>
```

🚩 **Hardcoded hex in Tailwind class** → Design tokens broken

```tsx
// ✗ Wrong
<div className="bg-[#18181B] text-[#FAFAFA]">

// ✓ Correct
<div className="bg-surface text-text-primary">
```

🚩 **Missing `loading.tsx`** → CLS on page transition

```tsx
// ✗ Wrong
// No loading.tsx file

// ✓ Correct
// apps/web/src/app/signup/loading.tsx exists
export default function SignupLoading() { ... }
```

🚩 **Skeleton missing password hint placeholder** → CLS > 0.1

```tsx
// ✗ Wrong
{
  [1, 2, 3].map((i) => <div className="h-12">input</div>);
}

// ✓ Correct
{
  [1, 2, 3].map((i) => (
    <div>
      <div className="h-12">input</div>
      {i === 3 && <div className="h-4">hint placeholder</div>}
    </div>
  ));
}
```

---

## Common Q&A During Review

**Q: Why does password toggle need keyboard access?**
A: Voice control, switch control, keyboard users all need it. Remove `tabIndex={-1}`.

**Q: Do I need `aria-describedby` if there's no error?**
A: Yes! Point it to the hint instead. Conditional:

```tsx
aria-describedby={fieldErrors.email ? 'email-error' : 'email-hint'}
```

**Q: Can I use inline error styles without `role="alert"`?**
A: No. Screen reader won't announce error. Add `role="alert"` to every error message.

**Q: Why dark theme for auth if marketing is light?**
A: ADR-017. Creates context shift (you're entering app), reduces eye strain on form. Intentional UX.

**Q: How do I test CLS locally?**
A: Chrome DevTools → Performance tab → Record page load → Check "Cumulative Layout Shift" metric.

---

## Next Pages to Create

Using this checklist, create:

- [ ] `/login`
- [ ] `/forgot-password`
- [ ] `/reset-password`

Each should:

- Copy template from `AUTH_FORM_ACCESSIBILITY_PREVENTION-MAIS-20251230.md`
- Use dark theme (bg-surface)
- Have loading.tsx + error.tsx
- Pass all checks above
- Get 95+ Lighthouse accessibility score

---

## Print This & Pin It

This page is short enough to print. Pin above your desk during auth form development.

**Key memory aids:**

- **Keyboard:** No `tabIndex={-1}` on buttons
- **ARIA:** `aria-invalid` + `aria-describedby` on every input
- **IDs:** Error messages need `id` to match `aria-describedby`
- **Theme:** Use `bg-surface`, `text-text-primary`, not hex colors
- **Loading:** Create `loading.tsx` and skeleton with space for hints
- **Test:** Keyboard (5 min) + Screen reader (10 min) + Audit (2 min) + CLS (2 min)
