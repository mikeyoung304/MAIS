# feat: Improve Mobile Experience Across All Pages (Quality-First Edition)

## Overview

Enhance the mobile user experience across both customer-facing storefronts (Next.js) and tenant admin dashboard (React/Next.js) to create a **native-quality** experience that meets WCAG 2.2 AAA accessibility requirements.

**Philosophy:** Quality over all else. No shortcuts. Build infrastructure that compounds.

**Scope:** Customer storefronts (`apps/web/`), Admin dashboard (`apps/web/` + `client/`), PWA with offline-first architecture

**Target Devices:** iOS Safari, Android Chrome, tablets (portrait/landscape)

---

## Problem Statement / Motivation

### Current State

The MAIS platform has a solid mobile foundation:

- ✅ 44px minimum touch targets on buttons
- ✅ Mobile hamburger navigation with focus trap
- ✅ Sticky mobile CTA with safe-area support
- ✅ Reduced motion preferences respected
- ✅ Responsive Tailwind breakpoints throughout

### Gaps Identified

1. **Chat widget conflicts with sticky CTA** - Both compete for bottom screen space
2. **Chat widget overflows on small phones** - Fixed 600px height exceeds iPhone SE viewport (568px)
3. **No swipe-to-close on mobile menu** - Expected mobile gesture pattern missing
4. **Gallery images too small on mobile** - 2-column grid with no lightbox
5. **No PWA support** - Missing manifest prevents "Add to Home Screen"
6. **Calendar touch targets undersized** - DayPicker date cells < 44px
7. **Admin sidebar not persisted** - Collapsed state resets on refresh
8. **No `useMediaQuery` hook** - Can't conditionally render mobile-specific components
9. **No bottom navigation option** - High-frequency actions hidden in hamburger
10. **Landscape mode ignored** - No specific handling for rotated devices

### Quality-First Additions (From Review)

11. **No haptic feedback** - Gestures feel dead without tactile confirmation
12. **No pull-to-refresh** - Table stakes for premium mobile apps
13. **No skeleton screens** - Perceived performance matters as much as actual
14. **No offline-first architecture** - Users lose signal; handle it gracefully
15. **No keyboard avoidance** - Mobile keyboards push content around
16. **No bottom sheet component** - THE mobile pattern for contextual actions
17. **No micro-interactions** - The difference between "works" and "delightful"
18. **Stringly-typed breakpoints** - Can drift from Tailwind config
19. **No proper bottom-layer coordination** - Need abstraction for stacking chat/CTA/toasts

### Impact

- **Customer conversion:** Mobile users struggle to complete bookings
- **Admin efficiency:** Tenant admins can't effectively manage on mobile
- **Accessibility:** Some touch targets don't meet WCAG 2.2 AAA (44×44px)
- **Engagement:** No PWA means no home screen presence
- **Delight:** Without haptics and micro-interactions, app feels like a website

---

## Proposed Solution

A phased approach organized by **abstraction layer**, building foundational infrastructure before UI components.

### Phase 1: Foundation Hooks & Critical Fixes

Build the type-safe infrastructure that all subsequent work depends on.

### Phase 2: Gesture System & Native Feel

Physics-aware gestures with haptic feedback for native-quality interactions.

### Phase 3: UI Primitives

Radix-based components with proper accessibility and animation.

### Phase 4: PWA & Offline-First

Security-aware service worker with IndexedDB caching and background sync.

### Phase 5: Admin Excellence & Micro-Interactions

Polish the admin experience and add delightful interactions throughout.

---

## Technical Approach

### Architecture

```
apps/web/src/
├── types/
│   └── responsive.ts              # Branded types, breakpoint constants
├── providers/
│   ├── ViewportProvider.tsx       # Shared breakpoint context
│   └── MobileBottomLayerProvider.tsx  # Bottom stacking coordination
├── hooks/
│   ├── useBreakpoint.ts           # Tailwind-aligned, SSR-safe
│   ├── useMediaQuery.ts           # Low-level media query (useSyncExternalStore)
│   ├── useSwipeGesture.ts         # Physics-aware with velocity detection
│   ├── usePWAInstall.ts           # Install prompt with iOS detection
│   ├── useSafeArea.ts             # Programmatic safe area insets
│   ├── useHapticFeedback.ts       # Vibration patterns
│   ├── usePullToRefresh.ts        # Pull-to-refresh gesture
│   ├── useKeyboardHeight.ts       # Keyboard avoidance
│   ├── useScrollRestoration.ts    # Position memory
│   ├── useNetworkStatus.ts        # Online/offline detection
│   └── __tests__/                 # Comprehensive hook tests
├── components/
│   ├── ui/
│   │   ├── BottomNavigation.tsx   # With variants, badges, active states
│   │   ├── BottomSheet.tsx        # Draggable bottom sheet
│   │   ├── Skeleton.tsx           # Base skeleton with shimmer
│   │   ├── OfflineBanner.tsx      # Network status indicator
│   │   └── MicroInteraction.tsx   # Reusable animation wrapper
│   ├── gallery/
│   │   ├── ImageLightbox.tsx      # Full-featured with pinch-zoom
│   │   └── PinchZoom.tsx          # Gesture-controlled zoom
│   ├── chat/
│   │   └── CustomerChatWidget.tsx # Responsive, layer-aware
│   ├── tenant/
│   │   ├── TenantNav.tsx          # With swipe gestures
│   │   └── StickyMobileCTA.tsx    # Layer-coordinated
│   └── pwa/
│       └── InstallPrompt.tsx      # Smart timing, iOS instructions
├── app/
│   └── manifest.ts                # PWA manifest
└── e2e/
    └── tests/
        └── mobile-experience.spec.ts  # Playwright mobile tests
```

### Key Patterns

**1. Branded Types for Breakpoints (No Stringly-Typed Queries)**

```typescript
// types/responsive.ts
declare const __brand: unique symbol;
type Brand<K, T> = K & { [__brand]: T };

export type MediaQueryString = Brand<string, 'MediaQueryString'>;

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

export function createMediaQuery(
  type: 'min-width' | 'max-width',
  breakpoint: BreakpointKey | number
): MediaQueryString {
  const value = typeof breakpoint === 'string' ? BREAKPOINTS[breakpoint] : breakpoint;
  return `(${type}: ${value}px)` as MediaQueryString;
}

export const MEDIA_QUERIES = {
  isMobile: createMediaQuery('max-width', 'md'),
  isTablet: createMediaQuery('min-width', 'md'),
  isDesktop: createMediaQuery('min-width', 'lg'),
  prefersReducedMotion: '(prefers-reduced-motion: reduce)' as MediaQueryString,
  supportsHover: '(hover: hover)' as MediaQueryString,
  supportsTouch: '(pointer: coarse)' as MediaQueryString,
} as const;
```

**2. SSR-Safe Media Query with useSyncExternalStore**

```typescript
// hooks/useMediaQuery.ts
'use client';

import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import type { MediaQueryString } from '@/types/responsive';

export type MediaQueryState =
  | { status: 'pending'; matches: undefined }
  | { status: 'resolved'; matches: boolean };

export function useMediaQuery(query: MediaQueryString): MediaQueryState {
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);

  const subscribe = useCallback(
    (callback: () => void) => {
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener('change', callback);
      return () => mediaQueryList.removeEventListener('change', callback);
    },
    [query]
  );

  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);

  const matches = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!isHydrated) return { status: 'pending', matches: undefined };
  return { status: 'resolved', matches };
}
```

**3. MobileBottomLayerProvider (Single Source of Truth for Stacking)**

```typescript
// providers/MobileBottomLayerProvider.tsx
interface BottomLayer {
  id: string;
  height: number;
  priority: number; // Lower = closer to bottom
  visible: boolean;
}

interface MobileBottomLayerContext {
  registerLayer: (layer: BottomLayer) => void;
  unregisterLayer: (id: string) => void;
  getOffsetFor: (id: string) => number; // Total height of lower-priority layers
}

// Components register themselves:
// - StickyMobileCTA: priority 1
// - BottomNavigation: priority 2
// - ChatWidget: priority 10
// - CookieBanner: priority 20
```

**4. Physics-Aware Swipe Gesture**

```typescript
// hooks/useSwipeGesture.ts
export interface SwipeEvent {
  readonly direction: 'left' | 'right' | 'up' | 'down';
  readonly deltaX: number;
  readonly deltaY: number;
  readonly velocity: number; // pixels per millisecond
  readonly duration: number;
}

export interface SwipeConfig {
  readonly threshold?: number; // Minimum distance (default: 50px)
  readonly velocityThreshold?: number; // Minimum velocity (default: 0.3 px/ms)
  readonly lockAxis?: boolean; // Prevent diagonal (default: true)
}

// Velocity enables "flick to close" which feels dramatically better
// than distance-only detection
```

**5. Haptic Feedback System**

```typescript
// hooks/useHapticFeedback.ts
export function useHapticFeedback() {
  const light = () => navigator.vibrate?.(10);
  const medium = () => navigator.vibrate?.(20);
  const heavy = () => navigator.vibrate?.([30, 10, 30]);
  const success = () => navigator.vibrate?.([10, 50, 10]);
  const error = () => navigator.vibrate?.([50, 30, 50, 30, 50]);

  return { light, medium, heavy, success, error };
}

// Use on:
// - Swipe gesture completion
// - Button presses (not form submits)
// - Pull-to-refresh trigger
// - Bottom nav selection
```

**6. Full-Featured Lightbox with Radix + Framer Motion**

```typescript
// components/gallery/ImageLightbox.tsx
// Built on Radix Dialog for accessibility + Framer Motion for physics

// Features:
// - Pinch-to-zoom with gesture constraints
// - Double-tap zoom toggle
// - Swipe between images with momentum
// - Keyboard navigation (arrows, escape)
// - Preload adjacent images
// - Image counter (3/12)
// - Share button
// - Blur-hash placeholders
```

**7. Security-Aware Service Worker**

```javascript
// public/sw.js
const NEVER_CACHE = [
  /^\/api\/auth/, // Auth routes - SECURITY CRITICAL
  /^\/api\/v1\/agent/, // Agent sessions - must be fresh
  /^\/api\/v1\/public\/chat/, // Chat - real-time
];

const NETWORK_FIRST = [
  /^\/api\//, // All other API routes
];

// Stale-while-revalidate for pages
// Cache versioning with automatic cleanup
// Offline page fallback
```

---

## Implementation Phases

### Phase 1: Foundation Hooks & Critical Fixes

**Effort:** 24 hours | **Priority:** P0

This phase establishes the type system and infrastructure that all subsequent phases depend on.

#### Type System Foundation

| Task                             | File                                      | Description                                                  |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| Create branded types             | `types/responsive.ts`                     | MediaQueryString, breakpoint constants aligned with Tailwind |
| Create ViewportProvider          | `providers/ViewportProvider.tsx`          | Shared context for all breakpoint queries                    |
| Create MobileBottomLayerProvider | `providers/MobileBottomLayerProvider.tsx` | Coordinate bottom-of-screen stacking                         |

#### Core Hooks

| Task                     | File                         | Description                                                    |
| ------------------------ | ---------------------------- | -------------------------------------------------------------- |
| Create useMediaQuery     | `hooks/useMediaQuery.ts`     | SSR-safe with useSyncExternalStore, discriminated union return |
| Create useBreakpoint     | `hooks/useBreakpoint.ts`     | Tailwind-aligned convenience hooks                             |
| Create useSafeArea       | `hooks/useSafeArea.ts`       | Programmatic access to safe area insets                        |
| Create useKeyboardHeight | `hooks/useKeyboardHeight.ts` | visualViewport API for keyboard avoidance                      |
| Create useNetworkStatus  | `hooks/useNetworkStatus.ts`  | Online/offline detection                                       |

#### Critical Fixes

| Task                            | File                                            | Change                                                |
| ------------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| Fix chat widget max-height      | `CustomerChatWidget.tsx`                        | `max-h-[min(600px,calc(100dvh-120px))]` with fallback |
| Integrate bottom layer provider | `CustomerChatWidget.tsx`, `StickyMobileCTA.tsx` | Use `useMobileBottomLayer()` for coordination         |
| Add inputmode to forms          | `ContactForm.tsx`, `DateBookingWizard.tsx`      | `inputMode="email"`, `inputMode="tel"`                |
| Fix DayPicker touch targets     | `DateBookingWizard.tsx`                         | CSS custom properties for 44px cells                  |
| Add viewport export             | `app/layout.tsx`                                | Next.js viewport configuration                        |

#### Unit Tests

| Task                | File                                    | Description                             |
| ------------------- | --------------------------------------- | --------------------------------------- |
| useMediaQuery tests | `hooks/__tests__/useMediaQuery.test.ts` | SSR behavior, reactive updates, cleanup |
| useBreakpoint tests | `hooks/__tests__/useBreakpoint.test.ts` | Tailwind alignment verification         |
| Provider tests      | `providers/__tests__/`                  | Context behavior validation             |

**Acceptance Criteria:**

- [ ] All breakpoints defined once in `types/responsive.ts`, imported everywhere
- [ ] No hydration mismatches in any hook (verified with SSR test)
- [ ] Chat widget never exceeds viewport on iPhone SE (320px-375px width)
- [ ] Chat and sticky CTA coordinate via provider (no CSS variable hacks)
- [ ] All form inputs show appropriate mobile keyboard
- [ ] Calendar date cells meet 44×44px minimum (verified with axe-core)
- [ ] Unit test coverage ≥ 90% for all new hooks

---

### Phase 2: Gesture System & Native Feel

**Effort:** 32 hours | **Priority:** P0

Build physics-aware gesture detection with haptic feedback for native-quality interactions.

#### Gesture Hooks

| Task                     | File                         | Description                                              |
| ------------------------ | ---------------------------- | -------------------------------------------------------- |
| Create useSwipeGesture   | `hooks/useSwipeGesture.ts`   | Velocity detection, axis locking, reduced motion respect |
| Create usePullToRefresh  | `hooks/usePullToRefresh.ts`  | Pull-to-refresh with loading indicator                   |
| Create usePinchZoom      | `hooks/usePinchZoom.ts`      | Pinch-to-zoom for lightbox                               |
| Create useHapticFeedback | `hooks/useHapticFeedback.ts` | Vibration patterns (light/medium/heavy/success/error)    |

#### Skeleton System

| Task                   | File                                | Description                                   |
| ---------------------- | ----------------------------------- | --------------------------------------------- |
| Create Skeleton base   | `components/ui/Skeleton.tsx`        | Shimmer animation with reduced motion support |
| Create SkeletonCard    | `components/ui/SkeletonCard.tsx`    | Card-shaped skeleton                          |
| Create SkeletonList    | `components/ui/SkeletonList.tsx`    | List skeleton                                 |
| Create SkeletonGallery | `components/ui/SkeletonGallery.tsx` | Gallery grid skeleton                         |

#### Mobile Menu Gestures

| Task                      | File               | Change                                        |
| ------------------------- | ------------------ | --------------------------------------------- |
| Add swipe-to-close        | `TenantNav.tsx`    | Integrate useSwipeGesture, haptic on complete |
| Add swipe-to-close        | `MobileNav.tsx`    | Same pattern for landing page                 |
| Admin sidebar persistence | `AdminSidebar.tsx` | localStorage with useLocalStorage hook        |

#### Unit Tests

| Task               | File                                      | Description                               |
| ------------------ | ----------------------------------------- | ----------------------------------------- |
| Gesture hook tests | `hooks/__tests__/useSwipeGesture.test.ts` | Velocity calculation, direction detection |
| Mock touch events  | Test utilities                            | Reusable touch event simulation           |

**Acceptance Criteria:**

- [ ] Mobile menu closes on swipe-right gesture (threshold: 50px OR velocity: 0.3px/ms)
- [ ] Haptic feedback fires on gesture completion (on supported devices)
- [ ] Pull-to-refresh works on tenant storefronts
- [ ] Skeleton screens show during data loading
- [ ] All gestures respect `prefers-reduced-motion`
- [ ] Admin sidebar remembers collapsed state across sessions
- [ ] Unit test coverage ≥ 90% for gesture hooks

---

### Phase 3: UI Primitives

**Effort:** 36 hours | **Priority:** P1

Build accessible, animated components on Radix primitives with Framer Motion.

#### Navigation Components

| Task                    | File                                 | Description                                               |
| ----------------------- | ------------------------------------ | --------------------------------------------------------- |
| Create BottomNavigation | `components/ui/BottomNavigation.tsx` | Variants, badges, active indicator animation, layer-aware |
| Create BottomSheet      | `components/ui/BottomSheet.tsx`      | Draggable sheet for contextual actions                    |
| Create QuickActionFAB   | `components/ui/QuickActionFAB.tsx`   | Floating action button with expand menu                   |

#### Gallery Components

| Task                  | File                                            | Description                                 |
| --------------------- | ----------------------------------------------- | ------------------------------------------- |
| Create ImageLightbox  | `components/gallery/ImageLightbox.tsx`          | Radix Dialog + Framer Motion, full features |
| Create PinchZoom      | `components/gallery/PinchZoom.tsx`              | Gesture-controlled zoom with constraints    |
| Update GallerySection | `components/tenant/sections/GallerySection.tsx` | Integrate lightbox                          |

#### Feedback Components

| Task                    | File                                 | Description                |
| ----------------------- | ------------------------------------ | -------------------------- |
| Create OfflineBanner    | `components/ui/OfflineBanner.tsx`    | "You're offline" indicator |
| Create MicroInteraction | `components/ui/MicroInteraction.tsx` | Reusable animation wrapper |

#### BottomNavigation Implementation

```typescript
// components/ui/BottomNavigation.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';

const bottomNavVariants = cva(
  'fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur-sm md:hidden',
  {
    variants: {
      variant: {
        default: 'pb-safe',
        floating: 'mx-4 mb-4 rounded-2xl border shadow-lg pb-0',
      },
    },
  }
);

interface NavItem {
  type: 'link' | 'action';
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  label: string;
  badge?: number;
  matchMode?: 'exact' | 'prefix';
}

// Features:
// - Active state with animated sliding indicator (layoutId)
// - Badge support for notifications
// - Haptic feedback on tap
// - Layer-aware positioning via useMobileBottomLayer
// - aria-current for active page
```

#### ImageLightbox Implementation

```typescript
// components/gallery/ImageLightbox.tsx
// Features:
// - Pinch-to-zoom with gesture limits
// - Double-tap to zoom in/out
// - Swipe between images with momentum
// - Swipe up to close
// - Image counter (3/12)
// - Preload adjacent images
// - Keyboard navigation (arrows, escape)
// - Spring-based animations
// - Blur-hash placeholders
```

**Acceptance Criteria:**

- [ ] Bottom navigation shows on tenant storefronts (mobile only)
- [ ] Active nav item has animated sliding indicator
- [ ] Badge counts display correctly
- [ ] Gallery images open in full-featured lightbox
- [ ] Lightbox supports pinch-zoom, swipe-to-navigate, keyboard nav
- [ ] Bottom sheet drags smoothly with snap points
- [ ] All components use semantic HTML with proper ARIA
- [ ] All touch targets ≥ 44×44px (verified with automated testing)

---

### Phase 4: PWA & Offline-First

**Effort:** 28 hours | **Priority:** P1

Enable native-like experience with security-aware caching and background sync.

#### PWA Core

| Task                      | File                               | Description                      |
| ------------------------- | ---------------------------------- | -------------------------------- |
| Create PWA manifest       | `app/manifest.ts`                  | Next.js manifest export          |
| Create app icons          | `public/icons/`                    | 192x192, 512x512, maskable       |
| Add apple-touch-icon      | `app/layout.tsx`                   | iOS bookmark icon                |
| Create usePWAInstall hook | `hooks/usePWAInstall.ts`           | State machine with iOS detection |
| Create InstallPrompt      | `components/pwa/InstallPrompt.tsx` | Smart timing, iOS instructions   |

#### Service Worker (Security-Aware)

| Task                  | File                  | Description                       |
| --------------------- | --------------------- | --------------------------------- |
| Create service worker | `public/sw.js`        | Route-specific caching strategies |
| Create offline page   | `public/offline.html` | Offline fallback                  |
| Register SW           | `app/layout.tsx`      | Registration with update handling |

**Service Worker Implementation:**

```javascript
// public/sw.js
const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// NEVER cache (security critical)
const NEVER_CACHE = [
  /^\/api\/auth/, // Auth routes
  /^\/api\/v1\/agent/, // Agent sessions
  /^\/api\/v1\/public\/chat/, // Real-time chat
];

// Network-first (must be fresh)
const NETWORK_FIRST = [
  /^\/api\//, // All API routes
];

// Strategies:
// - Precache: offline page, icons
// - Network-first: API routes (cache for offline)
// - Stale-while-revalidate: pages, static assets
// - Cache versioning with automatic cleanup
```

#### Offline-First Features

| Task               | File                     | Description                      |
| ------------------ | ------------------------ | -------------------------------- |
| IndexedDB wrapper  | `lib/offline-storage.ts` | Tenant data caching              |
| Background sync    | `public/sw.js`           | Queue pending bookings           |
| Optimistic updates | Service integration      | Update UI before server confirms |

#### usePWAInstall Hook

```typescript
// hooks/usePWAInstall.ts
export type PWAInstallState =
  | { status: 'unsupported'; reason: 'browser' | 'standalone' | 'ios' }
  | { status: 'pending' }
  | { status: 'ready'; platforms: readonly string[] }
  | { status: 'prompting' }
  | { status: 'accepted' }
  | { status: 'dismissed' };

interface IOSDetection {
  isIOS: boolean;
  isIPad: boolean;
  isStandalone: boolean;
  canShowInstructions: boolean;
}

// Full state machine for reliable UI rendering
// iOS detection for manual install instructions
// BeforeInstallPromptEvent type declarations
```

**Acceptance Criteria:**

- [ ] Chrome shows "Add to Home Screen" prompt on Android
- [ ] iOS Safari shows proper icon when bookmarked
- [ ] App opens in standalone mode (no browser chrome)
- [ ] Offline page shown when network unavailable
- [ ] Service worker NEVER caches `/api/auth/*` routes
- [ ] Service worker NEVER caches `/api/v1/agent/*` routes
- [ ] Pending bookings sync when connection restored
- [ ] Install prompt appears at appropriate time (not immediately)
- [ ] iOS shows manual "Add to Home Screen" instructions

---

### Phase 5: Admin Excellence & Micro-Interactions

**Effort:** 28 hours | **Priority:** P2

Polish the admin experience and add delightful interactions throughout.

#### Admin Optimizations

| Task                        | File                                    | Description                            |
| --------------------------- | --------------------------------------- | -------------------------------------- |
| Optimize sidebar for tablet | `AdminSidebar.tsx`                      | Auto-collapse on tablet portrait       |
| Create ResponsiveDataTable  | `components/ui/ResponsiveDataTable.tsx` | Card view on mobile with swipe actions |
| Add landscape layouts       | Various                                 | Tailwind `landscape:` variants         |
| Add container queries       | `tailwind.config.js`                    | Enable @container support              |

#### Micro-Interactions

| Task                    | File                       | Description                  |
| ----------------------- | -------------------------- | ---------------------------- |
| Button press states     | `components/ui/Button.tsx` | Scale down slightly on touch |
| Card lift on long-press | Card components            | Subtle elevation on hold     |
| Success animations      | Form submissions           | Animated checkmarks          |
| Error shake             | Form validation            | Shake animation for errors   |
| Counter animations      | Dashboard metrics          | Animated number changes      |
| Progress animations     | Multi-step forms           | Ring/bar animations          |

#### Form Excellence

| Task                        | File         | Description               |
| --------------------------- | ------------ | ------------------------- |
| Phone number formatting     | Form inputs  | Auto-format as user types |
| Email domain suggestions    | Email inputs | @gma... → @gmail.com      |
| Auto-advance between fields | Date inputs  | Move focus on complete    |
| Smart keyboard dismissal    | Forms        | Tap outside to dismiss    |

#### Scroll & Navigation

| Task                        | File                            | Description                          |
| --------------------------- | ------------------------------- | ------------------------------------ |
| Create useScrollRestoration | `hooks/useScrollRestoration.ts` | Remember position on back navigation |
| Smooth scroll to errors     | Form validation                 | Scroll to first error field          |

#### E2E Testing

| Task                    | File                                  | Description                       |
| ----------------------- | ------------------------------------- | --------------------------------- |
| Mobile experience suite | `e2e/tests/mobile-experience.spec.ts` | Touch targets, gestures, viewport |
| PWA manifest validation | `e2e/tests/pwa.spec.ts`               | Verify manifest and icons         |
| Offline behavior        | `e2e/tests/offline.spec.ts`           | Test service worker               |

**Acceptance Criteria:**

- [ ] Admin tables transform to swipeable cards on mobile
- [ ] Button presses have subtle scale feedback
- [ ] Form errors trigger shake animation
- [ ] Success submissions show animated checkmark
- [ ] Dashboard metrics animate on change
- [ ] Scroll position restored on back navigation
- [ ] Tablet portrait has auto-collapsed sidebar
- [ ] Container queries work for modular components
- [ ] E2E tests pass on iPhone SE, iPhone 14, iPad

---

## Success Metrics

| Metric                       | Current | Target  | How to Measure             |
| ---------------------------- | ------- | ------- | -------------------------- |
| Touch target compliance      | ~90%    | 100%    | Automated axe-core testing |
| Mobile navigation time       | 3+ taps | ≤2 taps | User testing               |
| PWA install rate             | 0%      | 10%+    | Analytics events           |
| Mobile bounce rate           | Unknown | -20%    | Google Analytics           |
| Time to interactive (mobile) | Unknown | < 2.5s  | Lighthouse                 |
| First input delay            | Unknown | < 100ms | Lighthouse                 |
| Cumulative Layout Shift      | Unknown | < 0.1   | Lighthouse                 |
| Offline task completion      | 0%      | > 80%   | Analytics                  |
| Gesture recognition accuracy | N/A     | > 95%   | E2E tests                  |
| Haptic feedback latency      | N/A     | < 50ms  | Manual testing             |

---

## Dependencies & Risks

### Dependencies

| Dependency           | Impact                                           | Mitigation                                        |
| -------------------- | ------------------------------------------------ | ------------------------------------------------- |
| react-day-picker CSS | Calendar styling may resist touch target changes | Use CSS custom properties `--rdp-cell-size: 44px` |
| Framer Motion        | Animation library for physics                    | Already in bundle, tree-shakeable                 |
| useSyncExternalStore | React 18+ required                               | Already on React 18                               |
| Service Worker API   | Browser support                                  | Graceful degradation, feature detection           |
| Vibration API        | Limited support                                  | Optional enhancement, no-op fallback              |

### Risks

| Risk                                 | Likelihood | Impact   | Mitigation                                        |
| ------------------------------------ | ---------- | -------- | ------------------------------------------------- |
| iOS Safari viewport bugs             | High       | Medium   | Test on physical devices; use `dvh` with fallback |
| Service worker caching auth          | Medium     | Critical | Route-based exclusion, thorough testing           |
| Gesture conflicts with scroll        | Medium     | Medium   | Use `touch-action` CSS and passive listeners      |
| Break desktop experience             | Low        | High     | Mobile-first with `md:` overrides; E2E both       |
| Hydration mismatches                 | Medium     | Medium   | useSyncExternalStore, thorough SSR testing        |
| Performance regression from gestures | Medium     | Medium   | Passive listeners, test on low-end devices        |

---

## Testing Plan

### Unit Testing

- [ ] All hooks have ≥90% coverage
- [ ] Mock MediaQueryList for responsive tests
- [ ] Mock touch events for gesture tests
- [ ] SSR behavior verified for all hooks

### E2E Testing (Playwright)

| Viewport | Device           | Focus                               |
| -------- | ---------------- | ----------------------------------- |
| 320×568  | iPhone SE        | Smallest viewport, overflow testing |
| 375×667  | iPhone 8         | Common small phone                  |
| 390×844  | iPhone 14        | Notch + dynamic island              |
| 768×1024 | iPad (portrait)  | Tablet portrait                     |
| 1024×768 | iPad (landscape) | Tablet landscape                    |

### E2E Test Suites

```typescript
// e2e/tests/mobile-experience.spec.ts
describe('Touch Targets (WCAG 2.2 AAA)', () => {
  test('all interactive elements meet 44x44px minimum');
});

describe('Swipe Gestures', () => {
  test('swipe right closes mobile menu');
  test('swipe between gallery images');
});

describe('Chat Widget Responsiveness', () => {
  test('chat widget does not exceed viewport');
  test('chat coordinates with sticky CTA');
});

describe('PWA', () => {
  test('manifest is valid');
  test('icons are accessible');
  test('service worker registers');
});
```

### Accessibility Testing

- [ ] VoiceOver on iOS Safari (physical device)
- [ ] TalkBack on Android Chrome (physical device)
- [ ] Switch Control navigation
- [ ] Reduced motion preference
- [ ] axe-core automated audits

### Performance Testing

- [ ] Lighthouse mobile score ≥ 90
- [ ] LCP < 2.5s on 4G
- [ ] INP < 200ms
- [ ] CLS < 0.1

---

## File Checklist

### New Files: Types & Providers (Phase 1)

- [ ] `apps/web/src/types/responsive.ts`
- [ ] `apps/web/src/providers/ViewportProvider.tsx`
- [ ] `apps/web/src/providers/MobileBottomLayerProvider.tsx`

### New Files: Hooks (Phases 1-2)

- [ ] `apps/web/src/hooks/useMediaQuery.ts`
- [ ] `apps/web/src/hooks/useBreakpoint.ts`
- [ ] `apps/web/src/hooks/useSafeArea.ts`
- [ ] `apps/web/src/hooks/useKeyboardHeight.ts`
- [ ] `apps/web/src/hooks/useNetworkStatus.ts`
- [ ] `apps/web/src/hooks/useSwipeGesture.ts`
- [ ] `apps/web/src/hooks/usePullToRefresh.ts`
- [ ] `apps/web/src/hooks/usePinchZoom.ts`
- [ ] `apps/web/src/hooks/useHapticFeedback.ts`
- [ ] `apps/web/src/hooks/usePWAInstall.ts`
- [ ] `apps/web/src/hooks/useScrollRestoration.ts`
- [ ] `apps/web/src/hooks/__tests__/useMediaQuery.test.ts`
- [ ] `apps/web/src/hooks/__tests__/useSwipeGesture.test.ts`
- [ ] `apps/web/src/hooks/__tests__/usePWAInstall.test.ts`

### New Files: Components (Phases 3-5)

- [ ] `apps/web/src/components/ui/BottomNavigation.tsx`
- [ ] `apps/web/src/components/ui/BottomSheet.tsx`
- [ ] `apps/web/src/components/ui/Skeleton.tsx`
- [ ] `apps/web/src/components/ui/SkeletonCard.tsx`
- [ ] `apps/web/src/components/ui/OfflineBanner.tsx`
- [ ] `apps/web/src/components/ui/MicroInteraction.tsx`
- [ ] `apps/web/src/components/ui/QuickActionFAB.tsx`
- [ ] `apps/web/src/components/ui/ResponsiveDataTable.tsx`
- [ ] `apps/web/src/components/gallery/ImageLightbox.tsx`
- [ ] `apps/web/src/components/gallery/PinchZoom.tsx`
- [ ] `apps/web/src/components/pwa/InstallPrompt.tsx`

### New Files: PWA (Phase 4)

- [ ] `apps/web/src/app/manifest.ts`
- [ ] `apps/web/public/sw.js`
- [ ] `apps/web/public/offline.html`
- [ ] `apps/web/public/icons/icon-192.png`
- [ ] `apps/web/public/icons/icon-512.png`
- [ ] `apps/web/public/icons/icon-maskable.png`
- [ ] `apps/web/src/lib/offline-storage.ts`

### New Files: Testing (Phase 5)

- [ ] `apps/web/e2e/tests/mobile-experience.spec.ts`
- [ ] `apps/web/e2e/tests/pwa.spec.ts`
- [ ] `apps/web/e2e/tests/offline.spec.ts`

### Modified Files

- [ ] `apps/web/src/components/chat/CustomerChatWidget.tsx`
- [ ] `apps/web/src/components/tenant/StickyMobileCTA.tsx`
- [ ] `apps/web/src/components/tenant/TenantNav.tsx`
- [ ] `apps/web/src/components/home/MobileNav.tsx`
- [ ] `apps/web/src/components/tenant/sections/GallerySection.tsx`
- [ ] `apps/web/src/components/tenant/ContactForm.tsx`
- [ ] `apps/web/src/components/booking/DateBookingWizard.tsx`
- [ ] `apps/web/src/components/layouts/AdminSidebar.tsx`
- [ ] `apps/web/src/components/ui/Button.tsx`
- [ ] `apps/web/src/app/layout.tsx`
- [ ] `apps/web/src/app/t/[slug]/layout.tsx`
- [ ] `apps/web/tailwind.config.js`

---

## References & Research

### Internal References

- Touch target implementation: `apps/web/src/components/ui/button.tsx:75-88`
- Existing mobile nav: `apps/web/src/components/tenant/TenantNav.tsx:212-252`
- Sticky CTA pattern: `apps/web/src/components/tenant/StickyMobileCTA.tsx`
- Safe-area handling: `apps/web/src/components/tenant/StickyMobileCTA.tsx:80`
- Focus trap pattern: `apps/web/src/components/tenant/TenantNav.tsx:78-105`

### External References

- [WCAG 2.2 Target Size (AAA)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [React useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [Framer Motion Spring Physics](https://www.framer.com/motion/animation/#spring)
- [Service Worker Cookbook](https://serviceworke.rs/)
- [Radix Dialog Accessibility](https://www.radix-ui.com/primitives/docs/components/dialog)
- [Tailwind Container Queries](https://tailwindcss.com/docs/responsive-design#container-queries)

### Review Feedback Incorporated

- **DHH:** Haptic feedback, pull-to-refresh, skeletons, offline-first, micro-interactions
- **Kieran:** Branded types, useSyncExternalStore, discriminated unions, comprehensive testing
- **Simplicity:** MobileBottomLayerProvider, Tailwind-aligned breakpoints, Radix primitives

---

## Summary

This quality-first plan addresses mobile UX gaps across MAIS/HANDLED through 5 phases organized by abstraction layer:

| Phase       | Focus                                              | Effort | Priority |
| ----------- | -------------------------------------------------- | ------ | -------- |
| **Phase 1** | Foundation hooks, type system, critical fixes      | 24h    | P0       |
| **Phase 2** | Gesture system, haptics, skeletons                 | 32h    | P0       |
| **Phase 3** | UI primitives (bottom nav, lightbox, bottom sheet) | 36h    | P1       |
| **Phase 4** | PWA, offline-first, background sync                | 28h    | P1       |
| **Phase 5** | Admin polish, micro-interactions, E2E testing      | 28h    | P2       |

**Total Estimated Effort:** ~148 hours (~4-5 weeks)

### Quality-First Principles Applied

1. **Build proper abstractions** - MobileBottomLayerProvider, branded types
2. **Physics-based gestures** - Velocity detection, spring animations
3. **Type safety as documentation** - Discriminated unions, exhaustive patterns
4. **Accessibility first** - WCAG 2.2 AAA compliance, screen reader testing
5. **Test infrastructure** - Unit tests for hooks, E2E for user flows
6. **Security-aware PWA** - Route-specific caching, never cache auth

The existing codebase has excellent foundations (touch targets, reduced motion, focus management) that we'll preserve while building infrastructure that compounds future development.
