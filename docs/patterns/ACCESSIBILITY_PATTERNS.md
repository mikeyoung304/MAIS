# Accessibility Patterns for MAIS Platform

**Version:** 1.0
**Date:** 2026-01-11
**WCAG Standard:** AA (Minimum for Production)

This document codifies accessibility patterns learned from Phase 4 (Mobile Build Mode) and provides reusable templates for future features.

---

## Table of Contents

1. [Modal Dialogs & Drawers](#modal-dialogs--drawers)
2. [Screen Reader Announcements](#screen-reader-announcements)
3. [Focus Management](#focus-management)
4. [Touch Targets](#touch-targets)
5. [Mobile Keyboard Handling](#mobile-keyboard-handling)
6. [Testing Checklist](#testing-checklist)

---

## Modal Dialogs & Drawers

### Pattern: Accessible Modal/Drawer

**Use case:** Any overlay that blocks background content (modals, drawers, sheets, popovers)

**WCAG Criteria:** 2.1.2 (No Keyboard Trap), 2.4.3 (Focus Order), 4.1.2 (Name, Role, Value)

**Implementation:**

```tsx
import { Drawer } from 'vaul'; // Or @radix-ui/react-dialog

function AccessibleDrawer({ isOpen, onOpenChange, children }: Props) {
  const fabRef = useRef<HTMLButtonElement>(null);
  const firstFocusableRef = useRef<HTMLInputElement>(null);
  const announcerRef = useRef<HTMLDivElement>(null);

  // 1. Screen reader announcer (persistent)
  const announce = (message: string) => {
    if (announcerRef.current) {
      announcerRef.current.textContent = message;
    }
  };

  // 2. Background inert management
  useEffect(() => {
    const main = document.getElementById('main-content');
    if (isOpen && main) {
      main.setAttribute('inert', 'true');
    } else if (main) {
      main.removeAttribute('inert');
    }

    return () => {
      if (main) {
        main.removeAttribute('inert');
      }
    };
  }, [isOpen]);

  return (
    <>
      {/* Screen reader announcer */}
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
          onOpenChange(open);
          announce(
            open ? 'Dialog opened. Use Tab to navigate, Escape to close.' : 'Dialog closed.'
          );
        }}
        modal={true} // Focus trap
      >
        <Drawer.Trigger asChild>
          <button ref={fabRef} aria-label="Open dialog">
            Open
          </button>
        </Drawer.Trigger>

        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40" />
          <Drawer.Content
            role="dialog"
            aria-modal="true"
            aria-label="Dialog title"
            className="fixed bottom-0 left-0 right-0 bg-white"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              firstFocusableRef.current?.focus();
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              fabRef.current?.focus();
            }}
          >
            {children}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
```

**Checklist:**

- [ ] `role="dialog"` + `aria-modal="true"`
- [ ] `aria-label` or `aria-labelledby`
- [ ] `modal={true}` for focus trap
- [ ] `onOpenAutoFocus` / `onCloseAutoFocus`
- [ ] Background marked `inert`
- [ ] Screen reader announcements
- [ ] Escape key closes dialog

---

## Screen Reader Announcements

### Pattern: Live Region Announcer

**Use case:** Notify screen reader users of dynamic changes (form errors, loading states, success messages)

**WCAG Criteria:** 4.1.3 (Status Messages)

**Implementation:**

```tsx
// 1. Create persistent announcer element
function useScreenReaderAnnouncer() {
  const announcerRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcerRef.current) {
      announcerRef.current.setAttribute('aria-live', priority);
      announcerRef.current.textContent = message;
    }
  }, []);

  return { announcerRef, announce };
}

// 2. Render announcer in component
function MyComponent() {
  const { announcerRef, announce } = useScreenReaderAnnouncer();

  const handleSubmit = async () => {
    announce('Submitting form...', 'polite');
    // ... submit logic
    announce('Form submitted successfully!', 'polite');
  };

  return (
    <>
      {/* Persistent announcer */}
      <div
        ref={announcerRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <form onSubmit={handleSubmit}>{/* ... form content */}</form>
    </>
  );
}
```

**Guidelines:**

- Use `aria-live="polite"` for non-urgent updates (default)
- Use `aria-live="assertive"` for critical errors/warnings
- Keep messages concise (1-2 sentences)
- Don't announce every keystroke or minor change
- Use `aria-atomic="true"` to announce entire message

**Examples:**

```tsx
// Good announcements
announce('3 new messages received');
announce('Item added to cart');
announce('Form submitted successfully');
announce('Error: Please enter a valid email address', 'assertive');

// Bad announcements
announce('Loading... 45%... 46%... 47%...'); // Too frequent
announce('The form submission was successful and your data has been saved to the database'); // Too verbose
announce(''); // Empty message
```

---

## Focus Management

### Pattern: Focus Trap

**Use case:** Keep keyboard focus within modal/drawer while open

**WCAG Criteria:** 2.1.2 (No Keyboard Trap), 2.4.3 (Focus Order)

**Implementation:**

```tsx
// Radix UI and Vaul provide focus trap automatically via `modal={true}`
// For custom implementations:

import { useFocusTrap } from '@/hooks/useFocusTrap';

function CustomModal({ isOpen, children }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Enable focus trap when modal opens
  useFocusTrap(modalRef, isOpen);

  return isOpen ? (
    <div ref={modalRef} role="dialog" aria-modal="true">
      {children}
    </div>
  ) : null;
}

// hooks/useFocusTrap.ts
export function useFocusTrap(ref: React.RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !ref.current) return;

    const element = ref.current;
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift+Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    element.addEventListener('keydown', handleTab);
    firstFocusable?.focus();

    return () => {
      element.removeEventListener('keydown', handleTab);
    };
  }, [isActive, ref]);
}
```

**Checklist:**

- [ ] Focus moves to first focusable element on open
- [ ] Tab cycles through focusable elements
- [ ] Shift+Tab cycles backward
- [ ] Focus returns to trigger element on close
- [ ] Escape key closes and returns focus

---

## Touch Targets

### Pattern: WCAG 2.5.8 Compliant Touch Targets

**Use case:** All interactive elements on mobile/tablet

**WCAG Criteria:** 2.5.8 (Target Size - Level AA)

**Minimum Size:** 24px × 24px (Level AA) | 44px × 44px (Level AAA)

**Implementation:**

```tsx
// ❌ Bad: Below minimum (12px)
<div className="h-3 w-12 cursor-pointer" onClick={handleClick} />

// ✅ Good: Meets Level AA (24px)
<div className="h-6 w-12 cursor-pointer" onClick={handleClick} />

// ✅ Better: Meets Level AAA (44px)
<button className="h-11 w-11 rounded-full">
  <Icon className="w-5 h-5" />
</button>
```

**Tailwind Class Reference:**

| Size   | Tailwind | Pixels       | WCAG Level |
| ------ | -------- | ------------ | ---------- |
| `h-3`  | 12px     | ❌ Too small | -          |
| `h-4`  | 16px     | ❌ Too small | -          |
| `h-5`  | 20px     | ❌ Too small | -          |
| `h-6`  | 24px     | ✅ Minimum   | AA         |
| `h-8`  | 32px     | ✅ Good      | AA         |
| `h-10` | 40px     | ✅ Better    | AA         |
| `h-11` | 44px     | ✅ Best      | AAA        |

**Testing:**

```typescript
// E2E test for touch target size
test('drag handle meets WCAG 2.5.8 minimum', async ({ page }) => {
  const handle = page.locator('[data-testid="drag-handle"]');
  const box = await handle.boundingBox();

  expect(box?.height).toBeGreaterThanOrEqual(24); // Level AA
  expect(box?.width).toBeGreaterThanOrEqual(24);
});
```

---

## Mobile Keyboard Handling

### Pattern: Platform-Specific Keyboard Behavior

**Use case:** Text inputs in mobile drawers/modals

**Problem:** iOS keyboard doesn't resize viewport, Android does

**Implementation:**

```tsx
function MobileInputHandler({ inputRef }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // Detect platform on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mobile = window.innerWidth < 768;
    const android = /Android/i.test(navigator.userAgent);
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    setIsMobile(mobile);
    setIsAndroid(android);
    setIsIOS(ios);
  }, []);

  // Platform-specific keyboard handling
  useEffect(() => {
    if (!isMobile) return;

    if (isAndroid) {
      // Android: Viewport resizes naturally
      // Add bottom padding to prevent input being obscured
      if (inputRef.current) {
        inputRef.current.style.paddingBottom = '60px';
      }
    } else if (isIOS) {
      // iOS: Monitor visualViewport API
      const handleViewportChange = () => {
        if (!window.visualViewport) return;

        const vh = window.visualViewport.height;
        const keyboardHeight = window.innerHeight - vh;

        if (keyboardHeight > 150) {
          // Keyboard is open (threshold to distinguish from browser chrome)
          requestAnimationFrame(() => {
            inputRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest', // Prevents over-scroll/jump
            });
          });
        }
      };

      window.visualViewport?.addEventListener('resize', handleViewportChange);
      return () => window.visualViewport?.removeEventListener('resize', handleViewportChange);
    }
  }, [isMobile, isAndroid, isIOS, inputRef]);

  return <textarea ref={inputRef} />;
}
```

**Key Points:**

- **iOS**: Use `visualViewport` API (viewport doesn't resize on keyboard open)
- **Android**: Viewport resizes naturally, just add padding
- **Threshold**: 150px keyboard height distinguishes keyboard from browser chrome
- **Scroll behavior**: Use `block: 'nearest'` to prevent over-scroll (fixes iOS jump bug)

**Vaul-Specific:**

```tsx
<Drawer.Root
  repositionInputs={false} // CRITICAL: Prevents iOS scroll-trigger-focus bug
>
```

---

## Testing Checklist

### Manual Testing

**Screen Readers:**

- [ ] VoiceOver (iOS Safari): `Cmd+F5` on Mac
- [ ] TalkBack (Android Chrome): Settings → Accessibility
- [ ] NVDA (Windows Chrome/Firefox): Free download
- [ ] JAWS (Windows): Commercial screen reader

**Keyboard Navigation:**

- [ ] Tab cycles through focusable elements
- [ ] Shift+Tab cycles backward
- [ ] Enter activates buttons/links
- [ ] Escape closes dialogs
- [ ] Arrow keys work in dropdowns/menus

**Mobile Devices:**

- [ ] iOS Safari: Test keyboard behavior
- [ ] Chrome Android: Test keyboard behavior
- [ ] Portrait and landscape orientations
- [ ] Touch targets ≥24px (use dev tools inspector)

### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Accessibility Tests', () => {
  test('focus trap works within dialog', async ({ page }) => {
    await page.click('[aria-label="Open dialog"]');

    // Tab multiple times
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check focused element is still inside dialog
    const focused = page.locator(':focus');
    const isInDialog = await focused.evaluate((el) => el.closest('[role="dialog"]') !== null);
    expect(isInDialog).toBe(true);
  });

  test('screen reader announcements work', async ({ page }) => {
    const announcer = page.locator('[aria-live="polite"]');

    await page.click('[aria-label="Submit form"]');

    await expect(announcer).toContainText(/submitted/i);
  });

  test('touch targets meet WCAG 2.5.8', async ({ page }) => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

    const button = page.locator('[data-testid="action-button"]');
    const box = await button.boundingBox();

    expect(box?.height).toBeGreaterThanOrEqual(24); // Level AA
    expect(box?.width).toBeGreaterThanOrEqual(24);
  });

  test('background content is inert when modal open', async ({ page }) => {
    await page.click('[aria-label="Open dialog"]');

    const main = page.locator('#main-content');
    const isInert = await main.evaluate((el) => el.hasAttribute('inert'));

    expect(isInert).toBe(true);
  });
});
```

---

## Reference Implementations

**Phase 4 Mobile Build Mode** provides production-ready examples:

- **Modal/Drawer**: `apps/web/src/components/agent/AgentPanel.tsx`
- **Screen Reader Announcements**: AgentPanel.tsx:352-359 (announcer setup)
- **Focus Management**: AgentPanel.tsx:404-417 (onOpenAutoFocus/onCloseAutoFocus)
- **Touch Targets**: AgentPanel.tsx:419-422 (24px drag handle)
- **Mobile Keyboard**: `apps/web/src/components/agent/PanelAgentChat.tsx:154-186`
- **E2E Tests**: `e2e/tests/build-mode-mobile.spec.ts`

---

## Resources

**WCAG Guidelines:**

- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

**Testing Tools:**

- [axe DevTools](https://www.deque.com/axe/devtools/) - Chrome extension
- [WAVE](https://wave.webaim.org/) - Web accessibility evaluation tool
- [Pa11y](https://pa11y.org/) - Automated accessibility testing

**Component Libraries:**

- [Radix UI](https://www.radix-ui.com/) - Accessible primitives
- [Vaul](https://github.com/emilkowalski/vaul) - Accessible drawer component

---

**Last Updated:** 2026-01-11 (Phase 4 completion)
