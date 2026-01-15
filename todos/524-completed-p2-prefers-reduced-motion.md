---
status: completed
priority: p2
issue_id: '524'
tags:
  - code-review
  - accessibility
  - a11y
  - mobile
dependencies: []
completed_date: 2026-01-01
---

# Missing prefers-reduced-motion in Multiple Components

## Problem Statement

Several components have animations that do not respect the user's `prefers-reduced-motion` preference. This is an accessibility issue for users with vestibular disorders.

**Why it matters:** Animations can trigger motion sickness, vertigo, or seizures in some users. WCAG 2.1 requires respecting motion preferences (Success Criterion 2.3.3).

## Findings

**Source:** Mobile Experience Code Review

**Locations:**

1. `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/mobile/BottomSheet.tsx`
2. `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/mobile/BottomNavigation.tsx`
3. `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/mobile/OfflineBanner.tsx`

**Evidence:** Components use CSS transitions/animations without motion checks:

```tsx
// BottomSheet.tsx - slide animation
<div className="transition-transform duration-300 ease-out">

// BottomNavigation.tsx - scale/opacity transitions
<span className="transition-all duration-200">

// OfflineBanner.tsx - slide-in animation
<div className="animate-slide-in">
```

## Proposed Solutions

### Solution 1: useReducedMotion Hook (Recommended)

**Description:** Create and apply a shared hook for motion preferences

```typescript
// hooks/useReducedMotion.ts
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

// Usage in components
const prefersReducedMotion = useReducedMotion();
const animationClass = prefersReducedMotion ? '' : 'transition-transform duration-300';
```

**Pros:**

- Reusable across all components
- Respects system preference
- Updates if preference changes

**Cons:**

- Requires updating each component

**Effort:** Medium (2-3 hours)
**Risk:** Low

### Solution 2: CSS-Only Motion Query

**Description:** Use CSS media queries in Tailwind config

```css
@media (prefers-reduced-motion: reduce) {
  .motion-safe\:transition-transform {
    transition: none;
  }
}
```

```tsx
<div className="motion-safe:transition-transform motion-safe:duration-300">
```

**Pros:**

- No JavaScript needed
- Tailwind has built-in `motion-safe:` and `motion-reduce:` variants

**Cons:**

- Need to update all animation classes

**Effort:** Small (1-2 hours)
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- `apps/web/src/components/mobile/BottomSheet.tsx`
- `apps/web/src/components/mobile/BottomNavigation.tsx`
- `apps/web/src/components/mobile/OfflineBanner.tsx`

**Components:** Mobile UI, animations, accessibility

## Acceptance Criteria

- [x] All three components respect prefers-reduced-motion
- [x] Animations disabled/reduced when preference is set
- [x] Core functionality still works without animations
- [ ] Manual testing with system preference enabled

## Work Log

| Date       | Action                             | Learnings                                                                    |
| ---------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| 2026-01-01 | Created from mobile UX code review | WCAG motion requirements                                                     |
| 2026-01-01 | Implemented reduced motion support | Used existing usePrefersReducedMotion hook and motion-safe: Tailwind classes |

## Implementation Notes

Used a hybrid approach combining both recommended solutions:

1. **Hook-based approach** (`usePrefersReducedMotion` from `useBreakpoint.ts`):
   - Applied to Framer Motion animations in BottomSheet and OfflineBanner
   - When reduced motion is preferred, animations use opacity fade instead of slide/spring
   - Reduced duration to 0.15s for minimal visual feedback

2. **CSS-based approach** (Tailwind `motion-safe:` prefix):
   - Applied to CSS transitions in BottomNavigation
   - `motion-safe:transition-colors`, `motion-safe:transition-transform`, `motion-safe:active:scale-95`
   - Active indicator uses static div instead of animated motion.div

### Files Modified

- `/apps/web/src/components/ui/BottomSheet.tsx` - Added usePrefersReducedMotion, conditional animation props
- `/apps/web/src/components/ui/BottomNavigation.tsx` - Added usePrefersReducedMotion, motion-safe: classes, static fallback for indicator
- `/apps/web/src/components/ui/OfflineBanner.tsx` - Added usePrefersReducedMotion, conditional animation props

## Resources

- [WCAG 2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
- [Tailwind Motion Variants](https://tailwindcss.com/docs/hover-focus-and-other-states#prefers-reduced-motion)
- [A11y: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
