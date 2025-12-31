---
status: complete
priority: p1
issue_id: '102'
tags: [code-review, accessibility, wcag, ui-redesign]
dependencies: []
---

# Missing Skip Link in AdminLayout (WCAG 2.4.1)

## Problem Statement

AdminLayout does not include a skip link while AppShell does. This creates an inconsistent experience for keyboard users and fails WCAG 2.4.1 Bypass Blocks (Level A).

**Why it matters:** Keyboard users must tab through the entire navigation on every page load.

## Findings

### From accessibility specialist agent:

**File:** `client/src/layouts/AdminLayout.tsx`
**WCAG Criterion:** 2.4.1 Bypass Blocks (Level A)

**Issues:**

1. No skip link present in AdminLayout
2. `<main>` element exists but has no `id` for skip link to target
3. Inconsistent with AppShell which does have a skip link

**Current state:**

```tsx
return (
  <div className="min-h-screen bg-gray-50">
    {/* No skip link */}
    <nav>...</nav>
    <main className="p-6">{children}</main>
  </div>
);
```

## Proposed Solutions

### Solution 1: Add Skip Link to AdminLayout (Recommended)

**Pros:** WCAG compliant, consistent with AppShell
**Cons:** Minor CSS needed
**Effort:** Small (30 min)
**Risk:** Low

```tsx
return (
  <div className="min-h-screen bg-gray-50">
    {/* Skip link for keyboard navigation */}
    <a className="skip-link" href="#main-content">
      Skip to main content
    </a>

    <nav>...</nav>

    <main id="main-content" className="p-6" tabIndex={-1}>
      {children}
    </main>
  </div>
);
```

The `skip-link` class is already defined in `a11y.css`.

## Recommended Action

Implement Solution 1 immediately.

## Technical Details

**Affected files:**

- `client/src/layouts/AdminLayout.tsx`

## Acceptance Criteria

- [ ] Skip link added to AdminLayout
- [ ] Main element has id="main-content"
- [ ] Main element has tabIndex={-1} for focus management
- [ ] Skip link visually hidden until focused
- [ ] Manual test with keyboard navigation works

## Work Log

| Date       | Action                   | Learnings              |
| ---------- | ------------------------ | ---------------------- |
| 2025-11-30 | Created from code review | WCAG Level A violation |

## Resources

- WCAG 2.4.1: https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks
- Existing a11y.css has skip-link styles
