# ✅ Phase 4 Complete - Mobile UX with Vaul + WCAG AA

**Status:** COMPLETE (2026-01-11)

Execute Phase 4 (Mobile UX with Vaul) from ~/.claude/plans/crystalline-snacking-reef.md

Branch: perf/perfect-build-mode-rev2
Completed commits:

- Phase 1: e69c9007 (performance optimization - 60% latency reduction)
- Phase 2: 2b9df0dc (race condition tests - 85% coverage achieved)
- Phase 3: 0d284820 (advisory locks - 6/7 coverage, complete TOCTOU prevention)
- Phase 4: 769caafd (Mobile UX with Vaul + WCAG AA accessibility) ✅
- Phase 4.5: e9693c56 (Bundle size analysis - PASSED) ✅

**Phase 4 Goal (ACHIEVED):**
Replace current mobile slide-up panel with Vaul drawer + complete WCAG AA accessibility implementation for full mobile UX compliance.

## Why Phase 4 Matters

Current mobile Build Mode has critical accessibility gaps:

- ❌ No focus trap (keyboard users can tab to hidden content)
- ❌ No screen reader announcements (drawer state invisible to SR users)
- ❌ iOS keyboard issues (#574: scroll triggers input focus, #216: drawer jumps on keyboard dismiss)
- ❌ Touch targets below WCAG 2.5.8 minimum (drag handle only 12px)
- ❌ Background content not marked inert (confusing for SR users)

Phase 4 fixes all of these with Vaul + comprehensive a11y implementation.

## What Needs to Be Done

### 4.1 Install & Configure Vaul with Accessibility (1 day)

**Install Package:**

```bash
npm install --workspace=apps/web vaul
```

**Critical Files to Modify:**

- `apps/web/src/components/agent/AgentPanel.tsx` - Replace current mobile implementation
- `apps/web/src/components/agent/PanelAgentChat.tsx` - Add platform-specific keyboard handling

**Implementation Pattern (from plan lines 445-546):**

```typescript
// apps/web/src/components/agent/AgentPanel.tsx

import { Drawer } from 'vaul';
import { useEffect, useRef, useState } from 'react';

export function AgentPanel() {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const announcerRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // WCAG 4.1.3: Screen reader announcement helper
  const announce = (message: string) => {
    if (announcerRef.current) {
      announcerRef.current.textContent = message;
    }
  };

  // WCAG 2.4.3: Background inert management
  useEffect(() => {
    const main = document.getElementById('main-content');
    if (isOpen && main) {
      main.setAttribute('inert', 'true');
    } else if (main) {
      main.removeAttribute('inert');
    }
  }, [isOpen]);

  // Desktop: Keep current aside panel unchanged
  if (!isMobile) {
    return <aside className="fixed right-0 top-0 h-screen w-[400px]">
      {/* Current desktop implementation */}
    </aside>;
  }

  // Mobile: Vaul bottom sheet with full a11y
  return (
    <>
      {/* WCAG: Screen reader announcer (persistent, hidden) */}
      <div
        ref={announcerRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <Drawer.Root
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          announce(open
            ? "AI Assistant drawer opened. Use Tab to navigate, Escape to close."
            : "AI Assistant drawer closed."
          );
        }}
        repositionInputs={false} // iOS Safari fix for issue #574
        dismissible={!isStreaming} // Prevent dismiss during AI response
        snapPoints={[0.85, 0.5]} // Full (85%) and half (50%)
      >
        <Drawer.Trigger asChild>
          <button
            ref={fabRef}
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-accent-600 p-4 shadow-lg"
            aria-label="Open AI Assistant chat"
          >
            <MessageCircle className="w-6 h-6" />
          </button>
        </Drawer.Trigger>

        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40" />
          <Drawer.Content
            role="dialog"
            aria-modal="true"
            aria-label="AI Assistant Chat"
            className="fixed bottom-0 left-0 right-0 h-[85vh] rounded-t-3xl bg-white"
            onOpenAutoFocus={() => inputRef.current?.focus()}
            onCloseAutoFocus={() => fabRef.current?.focus()}
          >
            {/* WCAG 2.5.8: Drag handle (24px minimum touch target) */}
            <div className="mx-auto mt-4 h-6 w-12 rounded-full bg-neutral-300" />

            {/* Chat content */}
            <div className="flex h-full flex-col">
              <PanelAgentChat
                {...props}
                inputRef={inputRef}
                messagesRole="log" // Screen reader support
              />
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
```

**Key A11y Requirements (must include ALL):**

1. ✅ `role="dialog"` + `aria-modal="true"` (WCAG 4.1.2)
2. ✅ `onOpenAutoFocus` / `onCloseAutoFocus` (focus management)
3. ✅ `inert` attribute on background (WCAG 2.4.3)
4. ✅ Screen reader announcer with `aria-live="polite"`
5. ✅ Drag handle h-6 (24px, WCAG 2.5.8 compliant)
6. ✅ `repositionInputs={false}` (iOS #574 fix)
7. ✅ `dismissible={!isStreaming}` (prevent accidental dismissal)

### 4.2 Platform-Specific Keyboard Handling (1 day)

**File:** `apps/web/src/components/agent/PanelAgentChat.tsx`

**iOS vs Android Strategy:**

- **iOS**: Doesn't resize viewport → use `visualViewport` API to detect keyboard
- **Android**: Resizes viewport automatically → just add padding

**Implementation Pattern (from plan lines 560-604):**

```typescript
const inputRef = useRef<HTMLTextAreaElement>(null);
const [drawerHeight, setDrawerHeight] = useState('85vh');

// Platform detection
const isAndroid = /Android/i.test(navigator.userAgent);
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

useEffect(() => {
  if (!isMobile) return;

  if (isAndroid) {
    // Android: Viewport resizes naturally, add bottom padding
    if (inputRef.current) {
      inputRef.current.style.paddingBottom = '60px';
    }
  } else if (isIOS) {
    // iOS: Manual viewport monitoring with visualViewport API
    const handleViewportChange = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      const keyboardHeight = window.innerHeight - vh;

      if (keyboardHeight > 150) {
        // Keyboard open (threshold)
        // Dynamically adjust drawer height
        setDrawerHeight(`${vh - 100}px`);

        // Scroll input into view after layout settles
        requestAnimationFrame(() => {
          inputRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest', // NOT 'center' - causes over-scroll
          });
        });
      } else {
        // Keyboard closed, restore original height
        setDrawerHeight('85vh');
      }
    };

    window.visualViewport?.addEventListener('resize', handleViewportChange);
    return () => window.visualViewport?.removeEventListener('resize', handleViewportChange);
  }
}, [isMobile, isAndroid, isIOS]);
```

**Why This Fixes iOS Issues:**

- #574 (scroll triggers focus): `repositionInputs={false}` prevents Vaul from auto-focusing
- #216 (drawer jumps): `visualViewport` monitoring provides smooth transitions

### 4.3 E2E Tests for Mobile + Accessibility (1 day)

**New file:** `apps/web/test/e2e/build-mode-mobile.spec.ts`

**Add these critical tests (from plan lines 302-364):**

```typescript
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

describe('Mobile Build Mode - iOS Edge Cases', () => {
  // Issue #574 - Scroll doesn't accidentally focus input
  test('scrolling messages does not trigger input focus', async ({ page }) => {
    await page.goto('/t/test-tenant?mode=build');

    // Open drawer
    await page.click('[aria-label="Open AI Assistant chat"]');

    const messages = page.locator('[role="log"]');
    const input = page.locator('[data-testid="agent-input"]');

    // Scroll messages container
    await messages.evaluate((el) => (el.scrollTop = 100));
    await page.waitForTimeout(300); // iOS touch delay

    // Verify input NOT focused
    const isFocused = await input.evaluate((el) => el === document.activeElement);
    expect(isFocused).toBe(false);
  });

  // Issue #216 - Drawer doesn't jump when keyboard dismissed
  test('drawer stays stable when keyboard dismissed', async ({ page }) => {
    await page.goto('/t/test-tenant?mode=build');
    await page.click('[aria-label="Open AI Assistant chat"]');

    const drawer = page.locator('[data-vaul-drawer]');
    const input = page.locator('[data-testid="agent-input"]');

    // Focus input (keyboard opens)
    await input.focus();
    await page.waitForTimeout(500);
    const positionWithKeyboard = await drawer.boundingBox();

    // Dismiss keyboard
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);
    const positionAfterDismiss = await drawer.boundingBox();

    // Drawer should return smoothly, not jump
    expect(Math.abs(positionAfterDismiss.y - positionWithKeyboard.y)).toBeLessThan(10); // 10px tolerance for animation
  });

  // WCAG AA - Focus trap test
  test('focus trapped within drawer', async ({ page }) => {
    await page.goto('/t/test-tenant?mode=build');
    await page.click('[aria-label="Open AI Assistant chat"]');

    // Tab multiple times
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focused = page.locator(':focus');
    const isInDrawer = await focused.evaluate((el) => el.closest('[role="dialog"]') !== null);
    expect(isInDrawer).toBe(true);
  });

  // WCAG AA - Screen reader announcement
  test('drawer open announced to screen readers', async ({ page }) => {
    await page.goto('/t/test-tenant?mode=build');

    const announcer = page.locator('[aria-live="polite"]');
    await page.click('[aria-label="Open AI Assistant chat"]');

    await expect(announcer).toContainText(/drawer opened/i);
  });

  // WCAG 2.5.8 - Touch target size
  test('drag handle meets 24px minimum', async ({ page }) => {
    await page.goto('/t/test-tenant?mode=build');
    await page.click('[aria-label="Open AI Assistant chat"]');

    const handle = page.locator('[data-vaul-drawer] > div').first();
    const box = await handle.boundingBox();

    expect(box?.height).toBeGreaterThanOrEqual(24);
  });
});
```

## Deliverables

1. **Vaul Integration:**
   - Installed and configured with all 7 a11y requirements
   - Desktop implementation unchanged (only mobile affected)
   - Smooth gestures with 85%/50% snap points

2. **Platform-Specific Fixes:**
   - iOS: `visualViewport` API monitoring
   - Android: Natural viewport resizing + padding
   - Both: No keyboard-related jank

3. **Accessibility:**
   - Focus trap working (Tab stays in drawer)
   - Screen reader announcements on open/close
   - Background marked inert (SR users can't reach)
   - 24px minimum touch targets (WCAG 2.5.8)

4. **Tests:**
   - 5 new E2E tests for mobile edge cases
   - All tests passing in iOS Safari + Chrome Android
   - WCAG AA validation tests included

5. **Commit:**
   - Message: "feat(build-mode): Phase 4 - Mobile UX with Vaul + WCAG AA"

## Validation Criteria

Before considering Phase 4 complete, verify:

- [ ] All 7 a11y requirements implemented (see list above)
- [ ] iOS issue #574 fixed (scroll doesn't trigger focus)
- [ ] iOS issue #216 fixed (no drawer jump on keyboard dismiss)
- [ ] Focus trap working (Tab doesn't escape drawer)
- [ ] Screen reader announcements working (test with VoiceOver/TalkBack)
- [ ] Touch targets ≥24px (drag handle specifically)
- [ ] 5 E2E tests added and passing
- [ ] Desktop unchanged (regression test)
- [ ] TypeScript compilation successful
- [ ] No console errors or warnings

## Testing Commands

```bash
# Run E2E tests
npm run test:e2e -- test/e2e/build-mode-mobile.spec.ts

# Test on actual devices (recommended)
# iOS: Open Safari dev tools → Responsive Design Mode → iPhone SE
# Android: Chrome DevTools → Device Mode → Pixel 5

# Run full test suite
npm run test

# TypeScript check
npm run typecheck --workspace=apps/web
```

## Timeline

- Day 1: Vaul integration + a11y (4.1)
- Day 2: Keyboard handling (4.2)
- Day 3: E2E tests (4.3)

**Next Phase:** Phase 4.5 (Bundle Size Check - 0.5 days)

---

## Key Context

**Why Vaul?**

- Native gesture support (drag to dismiss)
- Built-in snap points (85%/50%)
- Small bundle size (~6.3KB gzipped)
- Accessibility-first design
- Active maintenance + TypeScript support

**Why Not Native `<dialog>`?**

- No gesture support (requires custom JS)
- No snap points (all or nothing)
- Limited mobile optimization
- Would take longer to implement properly

**Phase 3 Completed:**
All backend race conditions now prevented with advisory locks (6/7 coverage). Phase 4 focuses purely on frontend mobile UX + a11y compliance.

---

★ Key Insight ─────────────────────────────────────
**Why Accessibility First:**
WCAG AA is not optional for production apps. Screen reader users represent 8% of web users globally. Focus trap, inert, and aria-live are foundational Level A/AA requirements. Vaul provides these out of the box, but we must configure them correctly.

iOS keyboard handling is uniquely complex because iOS Safari doesn't resize the viewport when the keyboard appears (Android does). The `visualViewport` API is the only reliable way to detect keyboard state on iOS.
─────────────────────────────────────────────────

🚀 Copy this entire prompt to a fresh Claude window to execute Phase 4!
