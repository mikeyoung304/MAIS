# Page Transitions

**Implementation:** Phase 4 Visual Polish - UI/UX Audit
**Status:** ✅ Complete (November 24, 2025)

## Overview

Smooth page transitions using Framer Motion for enhanced user experience during route navigation.

## Features

- **Subtle Animation**: Fade-in with slight vertical movement (8px translateY)
- **Fast Performance**: 250ms duration, GPU-accelerated (transform + opacity only)
- **Accessibility**: Automatically respects `prefers-reduced-motion: reduce`
- **Test Friendly**: Disabled in E2E mode for deterministic tests
- **Professional Easing**: Custom cubic-bezier curve for smooth feel

## Implementation Details

### Components

#### `PageTransition.tsx`

Wrapper component that applies fade-in animation to page content.

**Animation Behavior:**

- **Initial state**: opacity: 0, translateY: 8px
- **Animate state**: opacity: 1, translateY: 0
- **Exit state**: opacity: 0, translateY: -8px
- **Duration**: 250ms
- **Easing**: `[0.22, 1, 0.36, 1]` (ease-out-expo-like)

### Integration

The transition is integrated at the layout level in `AppShell.tsx`:

```tsx
<main id="main" tabIndex={-1} className="flex-1">
  <AnimatePresence mode="wait">
    <PageTransition key={location.pathname}>
      <Outlet />
    </PageTransition>
  </AnimatePresence>
</main>
```

**Key Points:**

- `AnimatePresence` enables exit animations
- `mode="wait"` ensures old page exits before new page enters
- `key={location.pathname}` triggers animation on route change
- `useLocation()` hook tracks current route

## Accessibility

### Reduced Motion Support

Framer Motion **automatically** respects the `prefers-reduced-motion` media query:

- **Normal motion**: Full 250ms animation
- **Reduced motion**: Instant transition (0ms duration)

No additional configuration needed - this works out of the box.

### Screen Reader Friendly

- Animations use `transform` and `opacity` (no layout shifts)
- Content remains accessible during animation
- Focus management handled by React Router

## E2E Testing

Animations are automatically disabled in E2E mode:

```tsx
if (isE2EMode) {
  return <>{children}</>;
}
```

This ensures:

- Deterministic test behavior
- Faster test execution
- No animation-related flakiness

## Performance

The animation is highly performant because it only uses:

1. **`opacity`** - Composited property (GPU)
2. **`transform: translateY()`** - Composited property (GPU)

These properties don't trigger layout recalculation or repaint, ensuring 60fps animation.

## Browser Support

Framer Motion supports:

- Chrome/Edge 80+
- Firefox 75+
- Safari 13.1+
- All modern mobile browsers

Falls back gracefully on older browsers (instant transitions).

## Customization

To adjust animation timing or behavior, edit `PageTransition.tsx`:

```tsx
// Make it faster
const pageTransition = {
  duration: 0.15,
  ease: [0.22, 1, 0.36, 1],
};

// Change vertical distance
const pageVariants = {
  initial: { opacity: 0, y: 16 }, // More movement
  animate: { opacity: 1, y: 0 },
};
```

## Testing the Animation

### Manual Testing

1. Start dev server: `npm run dev:client`
2. Navigate between routes (Home → Packages → Login)
3. Observe subtle fade-in effect

### Reduced Motion Testing

**Chrome DevTools:**

1. Open DevTools (F12)
2. CMD+SHIFT+P → "Emulate CSS prefers-reduced-motion"
3. Select "prefers-reduced-motion: reduce"
4. Navigate routes - animations should be instant

**macOS System Settings:**

1. System Settings → Accessibility → Display
2. Enable "Reduce motion"
3. Refresh app and navigate - animations should be instant

### E2E Mode

```bash
VITE_E2E=1 npm run dev:client
```

Navigate routes - animations should be completely disabled.

## Files Modified

1. **Created:**
   - `/client/src/components/transitions/PageTransition.tsx` - Animation wrapper

2. **Modified:**
   - `/client/src/app/AppShell.tsx` - Added AnimatePresence + PageTransition

## Dependencies

- `framer-motion` (v12.23.24) - Already installed ✅

## Future Enhancements

Possible improvements:

- Directional transitions (slide left/right based on navigation direction)
- Different animations for different route types (admin vs public)
- Stagger children animations for content reveal
- Page-specific transition variants

## References

- [Framer Motion Docs](https://www.framer.com/motion/)
- [AnimatePresence Guide](https://www.framer.com/motion/animate-presence/)
- [Reduced Motion Best Practices](https://web.dev/prefers-reduced-motion/)
