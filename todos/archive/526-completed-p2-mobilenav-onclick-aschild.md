---
status: complete
priority: p2
issue_id: '526'
tags:
  - code-review
  - react
  - radix-ui
  - mobile
dependencies: []
completed_date: '2026-01-01'
---

# MobileNav onClick with asChild Issue

## Problem Statement

The MobileNav component has an `onClick` handler on a Button component with `asChild` prop, but the handler won't fire because `asChild` passes all props to the child Link component, and the onClick gets lost in the Radix UI composition.

**Why it matters:** The close menu behavior may not work correctly, leading to menu staying open after navigation clicks.

## Findings

**Source:** Mobile Experience Code Review

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/mobile/MobileNav.tsx`

**Line:** 114

**Evidence:** onClick placed on Button with asChild:

```tsx
<Button
  variant="ghost"
  asChild
  onClick={onClose} // This won't work with asChild!
>
  <Link href={item.href}>{item.label}</Link>
</Button>
```

When using `asChild`, the Button component doesn't render itself - it passes props to the child. However, event handlers don't always transfer correctly in Radix UI's slot pattern.

## Proposed Solutions

### Solution 1: Move onClick to Link (Recommended)

**Description:** Put the onClick handler directly on the Link component

```tsx
<Button variant="ghost" asChild>
  <Link
    href={item.href}
    onClick={onClose} // Handler on the actual rendered element
  >
    {item.label}
  </Link>
</Button>
```

**Pros:**

- Handler on actual DOM element
- Guaranteed to fire
- Simple fix

**Cons:**

- None

**Effort:** Small (15 min)
**Risk:** Low

### Solution 2: Wrap in Click Handler Div

**Description:** Wrap the button in a div with the click handler

```tsx
<div onClick={onClose}>
  <Button variant="ghost" asChild>
    <Link href={item.href}>{item.label}</Link>
  </Button>
</div>
```

**Pros:**

- Works without modifying Link

**Cons:**

- Extra DOM element
- Less semantic

**Effort:** Small (15 min)
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- `apps/web/src/components/mobile/MobileNav.tsx`

**Components:** Mobile navigation, menu close behavior

## Acceptance Criteria

- [x] Menu closes when navigation link is clicked
- [x] Navigation still works correctly
- [x] No accessibility regressions
- [ ] Manual testing on mobile devices

## Work Log

| Date       | Action                             | Learnings                                                       |
| ---------- | ---------------------------------- | --------------------------------------------------------------- |
| 2026-01-01 | Created from mobile UX code review | Radix asChild gotchas                                           |
| 2026-01-01 | Verified already implemented       | onClick correctly placed on Link child, not Button with asChild |

## Resources

- [Radix UI Composition](https://www.radix-ui.com/docs/primitives/guides/composition)
- [Radix Slot Component](https://www.radix-ui.com/docs/primitives/utilities/slot)
