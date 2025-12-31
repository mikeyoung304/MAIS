---
status: resolved
priority: p2
issue_id: '297'
tags: [code-review, accessibility, wcag, frontend, early-access]
dependencies: []
resolved_at: 2025-12-06
resolution: 'Added complete ARIA attributes to WaitlistCTASection.tsx: error (id, aria-live, aria-atomic), success (role=status, aria-live), form (aria-label), input (aria-describedby, aria-invalid)'
---

# Missing Accessibility Attributes on Waitlist Form

## Problem Statement

The WaitlistCTASection component has incomplete accessibility attributes. While `role="alert"` is present on the error message, it lacks `aria-live`, `aria-atomic`, and the success message has no role at all.

**Why it matters:** Screen readers may not announce error/success messages properly without complete ARIA attributes. This affects WCAG 2.1 AA compliance.

## Findings

**File:** `client/src/pages/Home/WaitlistCTASection.tsx`

**Error message (line 109-112):**

```typescript
{error && (
  <p role="alert" className="mt-4 text-white/90 text-sm text-center">
    {error}
  </p>
)}
```

**Missing:**

- `aria-live="polite"` - Ensures screen readers announce updates
- `aria-atomic="true"` - Reads entire message when updated
- `id` for `aria-describedby` linkage to input

**Success message (lines 116-121):**

```typescript
<div className="flex items-center justify-center gap-3 text-white font-medium text-xl">
  <Check className="w-5 h-5" />
  Welcome. We'll be in touch soon.
</div>
```

**Missing:**

- `role="status"` - Announces success to screen readers
- `aria-live="polite"` - Ensures announcement

**Form (lines 71-107):**

- Missing `aria-label="Early access request form"`

## Proposed Solutions

### Option A: Add Complete ARIA Attributes (Recommended)

**Pros:** Full accessibility compliance
**Cons:** Slightly more verbose JSX
**Effort:** Small (15 min)
**Risk:** Low

```typescript
// Error message
{error && (
  <p
    id="email-error"
    role="alert"
    aria-live="polite"
    aria-atomic="true"
    className="mt-4 text-white/90 text-sm text-center"
  >
    {error}
  </p>
)}

// Success message
<div
  role="status"
  aria-live="polite"
  className="flex items-center justify-center gap-3 text-white font-medium text-xl"
>
  <Check className="w-5 h-5" aria-hidden="true" />
  Welcome. We'll be in touch soon.
</div>

// Form
<form
  onSubmit={handleSubmit}
  aria-label="Early access request form"
  className="flex flex-col sm:flex-row gap-4"
>

// Input with error linkage
<input
  type="email"
  aria-label="Email address"
  aria-describedby={error ? "email-error" : undefined}
  aria-invalid={!!error}
  // ...
/>
```

## Recommended Action

Implement Option A - add complete ARIA attributes for WCAG compliance.

## Technical Details

**Affected files:**

- `client/src/pages/Home/WaitlistCTASection.tsx` (lines 71-121)

**WCAG References:**

- 4.1.3 Status Messages (Level AA)
- 1.3.1 Info and Relationships

## Acceptance Criteria

- [x] Error message has role="alert", aria-live="polite", aria-atomic="true"
- [x] Success message has role="status", aria-live="polite"
- [x] Form has aria-label
- [x] Input linked to error via aria-describedby
- [x] Input has aria-invalid when error exists
- [x] Check icon has aria-hidden="true"

## Work Log

| Date       | Action                   | Learnings                                      |
| ---------- | ------------------------ | ---------------------------------------------- |
| 2025-12-06 | Created from code review | Quality-reviewer identified accessibility gaps |

## Resources

- Commit: b787c49
- WCAG 4.1.3: https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html
