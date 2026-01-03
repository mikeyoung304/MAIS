# Landing Page Accessibility & Performance Patterns

**Date:** 2026-01-03
**Category:** UI/UX Patterns
**Component:** Landing Page Components
**Tags:** accessibility, wcag, framer-motion, carousel, keyboard-navigation

---

## Executive Summary

During the landing page conversion overhaul, multi-agent code review identified critical patterns for building accessible, performant React components. This document captures the key learnings for future reference.

---

## Problem Context

Building a conversion-optimized landing page with:

- Animated hero with cycling professions
- Auto-advancing product carousel
- Accordion FAQ with spring animations
- 3-tier psychology-based pricing
- Testimonials section with conditional rendering

---

## Key Patterns Learned

### 1. Keyboard Event Scoping

**Problem:** Global `window.addEventListener('keydown')` captures ALL arrow keys, breaking native scrolling and interfering with other focusable elements.

**Anti-Pattern:**

```typescript
// ❌ BAD: Captures all arrow keys on the page
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goTo(current - 1);
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [current]);
```

**Correct Pattern:**

```typescript
// ✅ GOOD: Only handles keys when carousel is focused
<div
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'ArrowLeft') goTo(current - 1);
    if (e.key === 'ArrowRight') goTo(current + 1);
  }}
  role="region"
  aria-roledescription="carousel"
>
```

**Key Insight:** Scope keyboard handlers to the component container, not the window. Use `tabIndex={0}` to make non-interactive containers focusable.

---

### 2. Reduced Motion Support for Framer Motion

**Problem:** Framer Motion animations run regardless of user's motion preferences, causing accessibility issues for vestibular disorders.

**Anti-Pattern:**

```typescript
// ❌ BAD: Ignores reduced motion preference
<motion.span
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4 }}
/>
```

**Correct Pattern:**

```typescript
import { useReducedMotion } from 'framer-motion';

function AnimatedComponent() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.span
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -20 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4 }}
    />
  );
}
```

**Key Insight:** Always use `useReducedMotion()` hook from Framer Motion. When true, disable animations or set duration to 0.

---

### 3. SSR Hydration Guards

**Problem:** Client-only state (like animation indices) causes hydration mismatch between server and client render.

**Correct Pattern:**

```typescript
function ScrollingIdentity() {
  const [index, setIndex] = useState(0);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % IDENTITIES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Static fallback during SSR
  if (!isClient) {
    return (
      <h1 className="...">
        You're a <span className="text-sage">photographer</span>, so capture moments.
      </h1>
    );
  }

  // Animated version for client
  return (
    <>
      <span className="sr-only">Static message for screen readers</span>
      <h1 aria-hidden="true">
        {/* Animated content */}
      </h1>
    </>
  );
}
```

**Key Insight:** Use `isClient` guard to render static content during SSR, animate only after hydration.

---

### 4. Screen Reader Fallbacks for Animated Content

**Problem:** Screen readers announce every text change in animated cycling content, creating chaos.

**Correct Pattern:**

```typescript
return (
  <>
    {/* Screen reader gets stable message */}
    <span className="sr-only">
      You're a service professional, so focus on what you do best.
    </span>

    {/* Visual animation hidden from screen readers */}
    <h1 aria-hidden="true">
      You're a <AnimatedProfession /> so <AnimatedVerb />.
    </h1>
  </>
);
```

**Key Insight:** Provide static `sr-only` content for screen readers, hide animated content with `aria-hidden="true"`.

---

### 5. WCAG 2.2.2 Pause Control for Auto-Advancing Content

**Problem:** Auto-advancing carousels must be pausable for users who need more time.

**Correct Pattern:**

```typescript
const [isPaused, setIsPaused] = useState(false);

// Pause on hover/focus
<div
  onMouseEnter={() => setIsPaused(true)}
  onMouseLeave={() => setIsPaused(false)}
  onFocus={() => setIsPaused(true)}
  onBlur={(e) => {
    // Only unpause if focus leaves entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsPaused(false);
    }
  }}
>

// Respect pause state in auto-advance
useEffect(() => {
  if (isPaused) return;
  const interval = setInterval(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, 5000);
  return () => clearInterval(interval);
}, [isPaused, slides.length]);
```

**Key Insight:** Always implement pause-on-hover AND pause-on-focus. Include `slides.length` in useEffect deps.

---

### 6. Proper Tab Navigation (ARIA Tabs Pattern)

**Problem:** Using `role="tab"` requires proper `tabindex` management - only selected tab should be in tab order.

**Anti-Pattern:**

```typescript
// ❌ BAD: All tabs in tab order
{slides.map((slide, index) => (
  <button role="tab" aria-selected={index === current}>
    {slide.label}
  </button>
))}
```

**Correct Pattern:**

```typescript
// ✅ GOOD: Only selected tab focusable, others via arrow keys
{slides.map((slide, index) => (
  <button
    role="tab"
    aria-selected={index === current}
    tabIndex={index === current ? 0 : -1}
  >
    {slide.label}
  </button>
))}
```

**Key Insight:** With `role="tablist"`, only the selected tab should have `tabIndex={0}`. Users navigate between tabs with arrow keys, not Tab.

---

### 7. Height Animation Performance

**Problem:** Animating `height: 'auto'` forces layout recalculation every frame.

**Anti-Pattern:**

```typescript
// ❌ BAD: Layout thrashing on every frame
<motion.div
  initial={{ height: 0 }}
  animate={{ height: 'auto' }}
/>
```

**Better Pattern:**

```typescript
// ✅ BETTER: Add will-change hint
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  style={{ willChange: 'height, opacity', overflow: 'hidden' }}
/>
```

**Best Pattern (GPU-composited):**

```typescript
// ✅ BEST: Use transform instead of height
<motion.div
  initial={{ scaleY: 0, opacity: 0 }}
  animate={{ scaleY: 1, opacity: 1 }}
  style={{
    transformOrigin: 'top',
    willChange: 'transform, opacity'
  }}
/>
```

**Key Insight:** Transform-based animations use GPU compositing and avoid layout reflow.

---

### 8. Decorative Icon Accessibility

**Problem:** Decorative icons add noise for screen readers.

**Correct Pattern:**

```typescript
// Decorative icon (meaning conveyed by adjacent text)
<Check className="w-5 h-5 text-sage" aria-hidden="true" />
<span>Feature included</span>

// Meaningful icon (no adjacent text)
<button aria-label="Close menu">
  <X className="w-5 h-5" aria-hidden="true" />
</button>
```

**Key Insight:** Always add `aria-hidden="true"` to decorative icons. If icon is the only content, add `aria-label` to parent.

---

### 9. Mouse Drag State Cleanup

**Problem:** If user starts dragging and releases mouse outside component, drag state persists.

**Correct Pattern:**

```typescript
useEffect(() => {
  if (!isDragging) return;

  const handleGlobalMouseUp = () => {
    setIsDragging(false);
    setTranslateX(0);
  };

  document.addEventListener('mouseup', handleGlobalMouseUp);
  return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
}, [isDragging]);
```

**Key Insight:** Add global `mouseup` listener when drag starts, clean up when drag ends.

---

### 10. Focus Traps for Modals

**Problem:** Modal dialogs allow users to Tab to hidden background elements.

**Correct Pattern:**

```typescript
// Use Radix UI Dialog or implement focus trap
import * as Dialog from '@radix-ui/react-dialog';

<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 bg-black/60" />
    <Dialog.Content className="fixed ...">
      {/* Focus is trapped here */}
      <Dialog.Close asChild>
        <button>Close</button>
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

**Key Insight:** Use Radix UI Dialog or similar for automatic focus trapping, escape key handling, and focus return.

---

## Component Extraction Pattern

**Problem:** Mockup components duplicated across files increase bundle size and maintenance burden.

**Solution:**

```
components/home/
├── mockups/
│   ├── BookingMockup.tsx      # Shared
│   ├── ClientHubMockup.tsx    # Shared
│   ├── BrowserFrame.tsx       # Shared wrapper
│   └── index.ts               # Barrel export
├── ProductCarousel.tsx        # Imports from mockups/
└── JourneyShowcase.tsx        # Imports from mockups/
```

**Key Insight:** Extract shared UI to dedicated modules. Use barrel exports for clean imports.

---

## Quick Checklist

Before merging landing page components:

- [ ] Keyboard handlers scoped to component (not window)
- [ ] `useReducedMotion()` hook for all Framer Motion animations
- [ ] SSR hydration guard (`isClient` state)
- [ ] Screen reader fallbacks for animated content
- [ ] Pause-on-hover/focus for auto-advancing content
- [ ] Proper `tabIndex` management for ARIA tabs
- [ ] `aria-hidden="true"` on decorative icons
- [ ] `will-change` hints for animated elements
- [ ] Global mouseup handler for drag cleanup
- [ ] Focus trap for modal dialogs
- [ ] Shared components extracted to avoid duplication

---

## Related Documentation

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [Framer Motion Reduced Motion](https://www.framer.com/motion/use-reduced-motion/)
- [ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- `docs/design/BRAND_VOICE_GUIDE.md` - HANDLED brand identity
- `docs/solutions/patterns/auth-form-accessibility-checklist-MAIS-20251230.md` - Related a11y patterns
