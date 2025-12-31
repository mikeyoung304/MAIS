---
title: Auth Form Accessibility Checklist
slug: auth-form-accessibility-checklist
category: patterns
severity: P1
components: [forms, auth, accessibility]
tags: [wcag, aria, checklist, quick-reference]
date_created: 2025-12-30
---

# Auth Form Accessibility Checklist

**Use before shipping any auth page** (signup, login, password reset)

## Pre-Commit Checklist (5 min)

### ARIA Attributes (Required)

- [ ] Every input has `aria-invalid={!!fieldErrors.field}`
- [ ] Every input has `aria-describedby` pointing to error or hint ID
- [ ] Error messages have unique IDs (`fieldName-error`)
- [ ] Error messages have `role="alert"`
- [ ] Hints have unique IDs (`fieldName-hint`)

### Keyboard Accessibility

- [ ] No `tabIndex={-1}` on interactive elements
- [ ] All buttons have visible focus ring (`focus:ring-2`)
- [ ] Tab order follows visual order
- [ ] Form can be submitted with Enter key

### Loading States

- [ ] Route has `loading.tsx` file
- [ ] Skeleton dimensions match final content
- [ ] Password hint placeholder included (prevents CLS)
- [ ] Uses `bg-surface` (dark theme)

### Theme Consistency

- [ ] Background uses `bg-surface` (not hardcoded colors)
- [ ] Card uses `bg-surface-alt`
- [ ] CTA button uses `variant="sage"`
- [ ] Error page matches main page theme

### CSS

- [ ] No hardcoded hex colors (use CSS variables)
- [ ] Chrome autofill uses `var(--autofill-bg)` and `var(--autofill-text)`
- [ ] No negative margins that clip on mobile

## Quick Copy: Input Pattern

```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    aria-invalid={!!fieldErrors.email}
    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
  />
  {fieldErrors.email && (
    <p id="email-error" className="text-sm text-danger-500" role="alert">
      {fieldErrors.email}
    </p>
  )}
</div>
```

## Quick Copy: Password Toggle

```tsx
<button
  type="button"
  onClick={() => setShowPassword(!showPassword)}
  className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-text-muted hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-sage/50 rounded"
  aria-label={showPassword ? 'Hide password' : 'Show password'}
>
  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
</button>
```

## Quick Copy: Loading Skeleton Field

```tsx
<div className="space-y-2">
  <div className="h-4 w-24 animate-pulse rounded bg-neutral-700" />
  <div className="h-12 animate-pulse rounded-lg bg-neutral-700" />
  {/* Add for password field only */}
  {isPasswordField && <div className="h-4 w-28 animate-pulse rounded bg-neutral-700" />}
</div>
```

## Testing (20 min total)

| Test           | Time   | Pass Criteria                        |
| -------------- | ------ | ------------------------------------ |
| Keyboard nav   | 5 min  | Tab reaches all interactive elements |
| Screen reader  | 10 min | Errors announced with field context  |
| Lighthouse     | 2 min  | Accessibility ≥ 95                   |
| CLS            | 2 min  | No visible layout shift on load      |
| Mobile (320px) | 1 min  | Nothing clipped or overflowing       |

## Red Flags

🚩 `tabIndex={-1}` on any button
🚩 Hardcoded `#XXXXXX` colors in CSS
🚩 Missing `aria-invalid` on inputs
🚩 Error messages without `role="alert"`
🚩 `bg-neutral-50` on dark-themed page
🚩 Skeleton without hint placeholder

## Reference Implementation

See `apps/web/src/app/signup/page.tsx` for complete example.

## Related

- [Full solution doc](./ui-bugs/signup-page-accessibility-conversion-fixes-MAIS-20251230.md)
- [ADR-017: Dark Theme Auth Pages](../adrs/ADR-017-dark-theme-auth-pages.md)
- [ContactForm.tsx](../../apps/web/src/components/tenant/ContactForm.tsx) - Another ARIA reference
