# Growth Assistant UI - Comprehensive Test Plan

> **Purpose:** Define all test scenarios for the Growth Assistant default-open + push-content feature
>
> **Scope:** Unit, integration, E2E, manual QA
>
> **Timeline:** 2-3 days of QA work

---

## Test Environment Setup

### Prerequisites

```bash
# Install dependencies
npm install

# Start services
ADAPTERS_PRESET=mock npm run dev:api
cd apps/web && npm run dev

# Start Playwright (if using E2E tests)
npx playwright install
```

### Test Tenants

Create test tenant with known state:

- Tenant ID: `test-tenant-default-open`
- Status: `ACTIVE`
- Growth Assistant: Never used before (no localStorage)

---

## Unit Tests

### Test Suite 1: useGrowthAssistant Hook

**File:** `apps/web/src/hooks/useGrowthAssistant.test.ts`

```typescript
describe('useGrowthAssistant', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Initial State', () => {
    test('should default to isOpen: true on first visit', () => {
      const { result } = renderHook(() => useGrowthAssistant());
      expect(result.current.isOpen).toBe(true);
    });

    test('should initialize isFirstVisit: true if never visited', () => {
      const { result } = renderHook(() => useGrowthAssistant());
      expect(result.current.isFirstVisit).toBe(true);
    });
  });

  describe('localStorage Persistence', () => {
    test('should save isOpen state to localStorage', () => {
      const { result } = renderHook(() => useGrowthAssistant());
      act(() => {
        result.current.setIsOpen(false);
      });
      expect(localStorage.getItem('growth-assistant-open-state')).toBe('false');
    });

    test('should restore isOpen from localStorage on remount', () => {
      localStorage.setItem('growth-assistant-open-state', 'false');
      const { result } = renderHook(() => useGrowthAssistant());
      expect(result.current.isOpen).toBe(false);
    });

    test('should handle corrupted localStorage value gracefully', () => {
      localStorage.setItem('growth-assistant-open-state', 'maybe'); // Invalid
      expect(() => {
        renderHook(() => useGrowthAssistant());
      }).not.toThrow();
      const { result } = renderHook(() => useGrowthAssistant());
      expect(typeof result.current.isOpen).toBe('boolean');
    });
  });

  describe('First Visit Tracking', () => {
    test('should set isFirstVisit to false after markWelcomed() is called', () => {
      const { result } = renderHook(() => useGrowthAssistant());
      expect(result.current.isFirstVisit).toBe(true);
      act(() => {
        result.current.markWelcomed();
      });
      expect(result.current.isFirstVisit).toBe(false);
    });

    test('should restore isFirstVisit from localStorage', () => {
      localStorage.setItem('growth-assistant-welcomed', 'true');
      const { result } = renderHook(() => useGrowthAssistant());
      expect(result.current.isFirstVisit).toBe(false);
    });
  });
});
```

**Expected Results:**

- ✓ All tests pass
- ✓ Coverage ≥ 90% (hook logic)

---

### Test Suite 2: GrowthAssistantPanel Component

**File:** `apps/web/src/components/agent/GrowthAssistantPanel.test.tsx`

```typescript
describe('GrowthAssistantPanel', () => {
  test('should render panel when isOpen: true', () => {
    const { container } = render(<GrowthAssistantPanel />);
    const panel = container.querySelector('[role="complementary"]');
    expect(panel).toBeInTheDocument();
  });

  test('should apply translate-x-0 class when open', () => {
    const { container } = render(<GrowthAssistantPanel />);
    const panel = container.querySelector('aside');
    expect(panel).toHaveClass('translate-x-0');
  });

  test('should apply translate-x-full class when closed', () => {
    const { result: hook } = renderHook(() => useGrowthAssistant());
    act(() => hook.current.setIsOpen(false));
    const { container } = render(<GrowthAssistantPanel />);
    const panel = container.querySelector('aside');
    expect(panel).toHaveClass('translate-x-full');
  });

  test('should display welcome message on first visit', () => {
    localStorage.clear();
    const { getByText } = render(<GrowthAssistantPanel />);
    expect(getByText(/Salutations/i)).toBeInTheDocument();
  });

  test('should display "New" badge on first visit', () => {
    localStorage.clear();
    const { container } = render(<GrowthAssistantPanel />);
    const badge = container.querySelector('.animate-pulse');
    expect(badge?.textContent).toBe('New');
  });

  test('should toggle panel when collapse button clicked', () => {
    const { container } = render(<GrowthAssistantPanel />);
    const closeBtn = container.querySelector('button[aria-label*="Collapse"]');
    fireEvent.click(closeBtn!);
    expect(container.querySelector('aside')).toHaveClass('translate-x-full');
  });

  test('should have proper ARIA attributes', () => {
    const { container } = render(<GrowthAssistantPanel />);
    const panel = container.querySelector('[role="complementary"]');
    expect(panel).toHaveAttribute('aria-label', 'Growth Assistant');
  });

  test('should render header with title and close button', () => {
    const { getByText, container } = render(<GrowthAssistantPanel />);
    expect(getByText('Growth Assistant')).toBeInTheDocument();
    expect(getByText('Powered by AI')).toBeInTheDocument();
    expect(container.querySelector('button[aria-label*="Collapse"]')).toBeInTheDocument();
  });
});
```

**Expected Results:**

- ✓ All tests pass
- ✓ Panel renders correctly in open/closed states
- ✓ ARIA attributes present and correct

---

### Test Suite 3: Layout Structure

**File:** `apps/web/src/app/(protected)/tenant/layout.test.tsx`

```typescript
describe('TenantLayout with Growth Assistant', () => {
  test('should render sidebar, main, and panel in correct order', () => {
    const { container } = render(
      <TenantLayout>
        <div>Test Content</div>
      </TenantLayout>
    );
    const main = container.querySelector('main');
    const sidebar = container.querySelector('[role="navigation"]');
    const panel = container.querySelector('[role="complementary"]');

    expect(sidebar).toBeInTheDocument();
    expect(main).toBeInTheDocument();
    expect(panel).toBeInTheDocument();
  });

  test('should apply flex layout to container', () => {
    const { container } = render(
      <TenantLayout>
        <div>Test Content</div>
      </TenantLayout>
    );
    const layoutDiv = container.querySelector('.min-h-screen');
    expect(layoutDiv).toHaveClass('flex');
  });

  test('should apply correct padding/margin when panel is open', () => {
    const { container } = render(
      <TenantLayout>
        <div>Test Content</div>
      </TenantLayout>
    );
    const main = container.querySelector('main');
    // Check if padding adjusts (depends on implementation)
    expect(main).toBeInTheDocument();
  });
});
```

---

## Integration Tests

### Test Suite 1: Layout Integration

**File:** `apps/web/test/integration/layout-panel-integration.test.ts`

```typescript
describe('Layout Integration with Growth Assistant Panel', () => {
  test('sidebar, main content, and panel all visible on desktop', async () => {
    // Render at desktop width (1440px)
    const { width, height } = window;
    Object.defineProperty(window, 'innerWidth', { value: 1440, writable: true });

    const { container } = render(<TenantLayout>{content}</TenantLayout>);

    const sidebar = container.querySelector('[role="navigation"]');
    const main = container.querySelector('main');
    const panel = container.querySelector('[role="complementary"]');

    expect(sidebar).toBeVisible();
    expect(main).toBeVisible();
    expect(panel).toBeVisible();
  });

  test('main content width reduces when panel opens', async () => {
    const { container, rerender } = render(
      <TenantLayout panelOpen={false}>{content}</TenantLayout>
    );

    const mainBefore = container.querySelector('main');
    const widthBefore = mainBefore?.getBoundingClientRect().width;

    rerender(<TenantLayout panelOpen={true}>{content}</TenantLayout>);

    const mainAfter = container.querySelector('main');
    const widthAfter = mainAfter?.getBoundingClientRect().width;

    expect(widthAfter).toBeLessThan(widthBefore!);
  });

  test('no horizontal scroll when panel is open', () => {
    const { container } = render(
      <TenantLayout>
        <div style={{ width: '100%' }}>Wide content</div>
      </TenantLayout>
    );

    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
```

---

### Test Suite 2: Keyboard Interaction

**File:** `apps/web/test/integration/keyboard-shortcuts.test.ts`

```typescript
describe('Keyboard Shortcuts Integration', () => {
  test('Cmd+K toggles panel open/closed', async () => {
    const { container } = render(<TenantLayout>{content}</TenantLayout>);
    const panel = container.querySelector('[role="complementary"]');

    // Panel should be open by default
    expect(panel).toHaveClass('translate-x-0');

    // Simulate Cmd+K
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true, // Cmd key
      bubbles: true,
    });
    window.dispatchEvent(event);

    await screen.findByRole('complementary', { hidden: true });
    expect(panel).toHaveClass('translate-x-full');
  });

  test('Cmd+K focuses message input', async () => {
    const { container } = render(<TenantLayout>{content}</TenantLayout>);

    const input = container.querySelector('[data-testid="agent-input"]');
    expect(document.activeElement).not.toBe(input);

    // Simulate Cmd+K
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  test('Ctrl+K works on Windows/Linux', () => {
    const { container } = render(<TenantLayout>{content}</TenantLayout>);

    // Simulate Ctrl+K
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true, // Ctrl key
      bubbles: true,
    });
    window.dispatchEvent(event);

    const panel = container.querySelector('[role="complementary"]');
    expect(panel).toHaveClass('translate-x-full');
  });

  test('Escape closes panel and returns focus', async () => {
    const { container } = render(<TenantLayout>{content}</TenantLayout>);
    const toggleBtn = container.querySelector('button[aria-label*="Collapse"]');

    // Open panel
    fireEvent.click(toggleBtn!);
    expect(container.querySelector('[role="complementary"]')).toHaveClass('translate-x-0');

    // Simulate Escape
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    });
    window.dispatchEvent(event);

    // Panel should close
    await waitFor(() => {
      expect(container.querySelector('[role="complementary"]')).toHaveClass('translate-x-full');
    });
  });

  test('Cmd+K does not trigger while typing in input', () => {
    const { container } = render(<TenantLayout>{content}</TenantLayout>);
    const input = container.querySelector('input');

    // Focus input first
    fireEvent.focus(input!);

    // Simulate Cmd+K while focused on input
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
      target: input,
    });

    // Should not toggle panel (implementation should check target)
    const panel = container.querySelector('[role="complementary"]');
    const wasOpen = panel?.classList.contains('translate-x-0');

    window.dispatchEvent(event);

    expect(panel?.classList.contains('translate-x-0')).toBe(wasOpen);
  });
});
```

---

## E2E Tests (Playwright)

### Test Suite 1: Panel Visibility and Interaction

**File:** `apps/web/e2e/tests/growth-assistant-default-open.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Growth Assistant Panel - Default Open State', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to dashboard
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('panel is visible and open on first visit', async ({ page }) => {
    const panel = await page.locator('[role="complementary"]');
    await expect(panel).toBeVisible();

    // Check that it's not translated off-screen
    const transform = await panel.evaluate((el) => window.getComputedStyle(el).transform);
    expect(transform).not.toContain('translate');
  });

  test('panel displays welcome message', async ({ page }) => {
    const welcomeText = await page.getByText(/Salutations/);
    await expect(welcomeText).toBeVisible();
  });

  test('panel shows "New" badge on first visit', async ({ page }) => {
    const badge = await page.locator('.animate-pulse:has-text("New")');
    await expect(badge).toBeVisible();
  });

  test('collapse button closes panel', async ({ page }) => {
    const collapseBtn = page.getByRole('button', { name: /collapse/i });
    await collapseBtn.click();

    const panel = await page.locator('[role="complementary"]');
    const transform = await panel.evaluate((el) => window.getComputedStyle(el).transform);
    expect(transform).toContain('translate');
  });

  test('open button reopens panel', async ({ page }) => {
    const collapseBtn = page.getByRole('button', { name: /collapse/i });
    await collapseBtn.click();

    const openBtn = page.getByRole('button', { name: /open/i });
    await openBtn.click();

    const panel = await page.locator('[role="complementary"]');
    await expect(panel).toBeVisible();
  });

  test('panel state persists across page navigation', async ({ page }) => {
    // Close panel
    const collapseBtn = page.getByRole('button', { name: /collapse/i });
    await collapseBtn.click();

    // Navigate to different page
    await page.goto('/tenant/packages');
    await page.waitForLoadState('networkidle');

    // Panel should still be closed
    const openBtn = page.queryByRole('button', { name: /open/i });
    expect(openBtn).toBeTruthy();
  });

  test('panel state persists across page reload', async ({ page }) => {
    // Close panel
    const collapseBtn = page.getByRole('button', { name: /collapse/i });
    await collapseBtn.click();

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Panel should still be closed
    const panel = page.locator('[role="complementary"]');
    const isOffScreen = await panel.evaluate((el) => {
      const transform = window.getComputedStyle(el).transform;
      return transform.includes('translate');
    });
    expect(isOffScreen).toBe(true);
  });
});
```

---

### Test Suite 2: Content Push and Layout

**File:** `apps/web/e2e/tests/growth-assistant-layout-push.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Growth Assistant Panel - Content Push Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('main content shifts right when panel opens', async ({ page }) => {
    const main = page.locator('main');
    const widthBefore = await main.evaluate((el) => el.getBoundingClientRect().width);

    // Panel is already open, so close and reopen to measure
    const collapseBtn = page.getByRole('button', { name: /collapse/i });
    await collapseBtn.click();
    const widthAfterClose = await main.evaluate((el) => el.getBoundingClientRect().width);

    const openBtn = page.getByRole('button', { name: /open/i });
    await openBtn.click();
    const widthAfterOpen = await main.evaluate((el) => el.getBoundingClientRect().width);

    expect(widthAfterClose).toBeGreaterThan(widthAfterOpen);
  });

  test('no horizontal scroll at any viewport width', async ({ page }) => {
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('sidebar and panel both visible on desktop (≥ 1024px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const sidebar = page.locator('[role="navigation"]');
    const panel = page.locator('[role="complementary"]');

    await expect(sidebar).toBeVisible();
    await expect(panel).toBeVisible();

    // Verify no overlap
    const sidebarBox = await sidebar.boundingBox();
    const panelBox = await panel.boundingBox();

    expect(sidebarBox!.right).toBeLessThanOrEqual(panelBox!.left);
  });

  test('content readable width maintained (> 300px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const main = page.locator('main');
    const width = await main.evaluate((el) => el.getBoundingClientRect().width);

    expect(width).toBeGreaterThan(300);
  });

  test('long page titles reflow without overflow', async ({ page }) => {
    await page.goto('/tenant/packages'); // Or navigate to page with long title

    const title = page.locator('h1');
    const titleText = await title.textContent();

    // Verify title is visible and not overflowed
    await expect(title).toBeVisible();

    const scrollWidth = await title.evaluate((el) => el.scrollWidth);
    const clientWidth = await title.evaluate((el) => el.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1 for rounding
  });
});
```

---

### Test Suite 3: Keyboard Shortcuts

**File:** `apps/web/e2e/tests/growth-assistant-keyboard.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Growth Assistant Panel - Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('Cmd+K opens/closes panel', async ({ page, context }) => {
    // Check if Mac (Cmd) or Windows (Ctrl)
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    // Close panel first
    const collapseBtn = page.getByRole('button', { name: /collapse/i });
    await collapseBtn.click();

    // Press Cmd+K
    await page.keyboard.press(`${modifier}+K`);

    const panel = page.locator('[role="complementary"]');
    await expect(panel).toBeVisible();
  });

  test('Cmd+K focuses message input', async ({ page }) => {
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    const input = page.locator('[data-testid="agent-input"]');

    // Click somewhere else first
    await page.click('body');

    // Press Cmd+K
    await page.keyboard.press(`${modifier}+K`);

    // Verify input is focused
    const focused = await input.evaluate((el: HTMLInputElement) => document.activeElement === el);
    expect(focused).toBe(true);
  });

  test('Escape closes panel', async ({ page }) => {
    // Panel is open by default
    const panel = page.locator('[role="complementary"]');
    await expect(panel).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Panel should be off-screen
    const isVisible = await panel.evaluate((el) => {
      const transform = window.getComputedStyle(el).transform;
      return !transform.includes('translate');
    });
    expect(isVisible).toBe(false);
  });

  test('Cmd+K does not trigger while typing in message input', async ({ page }) => {
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    const input = page.locator('[data-testid="agent-input"]');

    // Focus input
    await input.click();

    // Type something
    await page.keyboard.type('Hello');

    // Close panel
    const collapseBtn = page.getByRole('button', { name: /collapse/i });
    await collapseBtn.click();

    // Focus input again and press Cmd+K
    await input.click();
    await page.keyboard.press(`${modifier}+K`);

    // Panel should still be closed (Cmd+K should be ignored inside input)
    const panel = page.locator('[role="complementary"]');
    const isOffScreen = await panel.evaluate((el) => {
      const transform = window.getComputedStyle(el).transform;
      return transform.includes('translate');
    });
    expect(isOffScreen).toBe(true);
  });
});
```

---

### Test Suite 4: Mobile Responsiveness

**File:** `apps/web/e2e/tests/growth-assistant-mobile.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Growth Assistant Panel - Mobile Responsiveness', () => {
  test('mobile: panel is full-width bottom sheet at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone 12

    // Navigate to dashboard
    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');

    const panel = page.locator('[role="complementary"]');
    const box = await panel.boundingBox();

    // Panel should be full width
    expect(box?.width).toBeCloseTo(375, 10);

    // Panel should be at bottom (top should be > 500px or height near viewport)
    expect(box?.top ?? 0).toBeGreaterThan(200);
  });

  test('tablet: panel is 90vw at 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad

    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');

    const panel = page.locator('[role="complementary"]');
    const box = await panel.boundingBox();

    // Panel width should be ~90% of viewport
    const expectedWidth = 768 * 0.9;
    expect(box?.width ?? 0).toBeCloseTo(expectedWidth, 50);
  });

  test('desktop: panel is 400px at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 }); // Desktop

    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');

    const panel = page.locator('[role="complementary"]');
    const box = await panel.boundingBox();

    // Panel should be fixed 400px
    expect(box?.width).toBeCloseTo(400, 10);
  });

  test('mobile: panel does not reduce content area', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');

    const main = page.locator('main');
    const box = await main.boundingBox();

    // Main content should be full width (not squeezed by panel)
    expect(box?.width).toBeCloseTo(375, 10);
  });

  test('mobile: close button is touch-friendly (44px min)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto('/tenant/dashboard');
    await page.waitForLoadState('networkidle');

    const closeBtn = page.locator('button[aria-label*="Collapse"]');
    const box = await closeBtn.boundingBox();

    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
```

---

## Manual QA Checklist

### Desktop Testing

- [ ] **1920px (standard laptop)**
  - [ ] Panel visible on right
  - [ ] Sidebar visible on left
  - [ ] Main content in middle
  - [ ] No horizontal scroll
  - [ ] Collapse/expand works
  - [ ] Cmd+K opens panel

- [ ] **2560px (16-inch laptop)**
  - [ ] Same as above
  - [ ] Content doesn't stretch excessively
  - [ ] Line length remains readable

- [ ] **3440px (ultrawide monitor)**
  - [ ] Panel and sidebar visible
  - [ ] Content width capped (not too wide)
  - [ ] Readability maintained

### Mobile Testing

- [ ] **320px (iPhone 5)**
  - [ ] Panel is full-width or 90vw
  - [ ] No horizontal scroll
  - [ ] Close button reachable
  - [ ] Text readable

- [ ] **375px (iPhone 12)**
  - [ ] Panel is bottom sheet
  - [ ] Main content NOT squeezed
  - [ ] Messages visible
  - [ ] Send button clickable

- [ ] **414px (iPhone 14 Pro Max)**
  - [ ] Same as above
  - [ ] Extra width handled well

### Tablet Testing

- [ ] **768px (iPad portrait)**
  - [ ] Sidebar hidden
  - [ ] Panel overlays or adapts
  - [ ] Content visible
  - [ ] No horizontal scroll

- [ ] **1024px (iPad landscape)**
  - [ ] Sidebar may be visible
  - [ ] Panel visible
  - [ ] Content in middle

### Browser Compatibility

- [ ] Chrome (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)

### Feature Testing

- [ ] First visit: panel open, "New" badge visible
- [ ] Returning visit: panel respects saved state
- [ ] Cmd+K: toggles panel, focuses input
- [ ] Escape: closes panel
- [ ] Collapse/expand: smooth animation (300ms)
- [ ] Keyboard navigation: Tab through buttons
- [ ] Screen reader: Announces panel, button states

---

## Performance Testing

### Lighthouse Audits

Run before and after implementation:

```bash
# Desktop
lighthouse https://app.gethandled.ai/tenant/dashboard --view

# Mobile
lighthouse https://app.gethandled.ai/tenant/dashboard --view --emulated-form-factor=mobile
```

**Target Scores:**

- Performance: ≥90
- Accessibility: ≥95
- Best Practices: ≥90
- CLS (Cumulative Layout Shift): <0.1

### Network Throttling

Test with throttled network:

- [ ] Slow 3G: Panel should load within 500ms
- [ ] Fast 4G: Panel should be interactive within 300ms
- [ ] No flicker or layout shift during load

---

## Accessibility Testing

### Automated Tools

```bash
# axe DevTools scan
npm run test:a11y

# Lighthouse accessibility score
lighthouse https://app.gethandled.ai/tenant/dashboard --view
```

### Manual Accessibility Testing

- [ ] **Keyboard Navigation**
  - Tab key cycles through all interactive elements
  - Collapse/expand button is focusable
  - Enter/Space opens/closes panel

- [ ] **Screen Reader (VoiceOver on Mac)**

  ```bash
  # Enable VoiceOver: Cmd+F5
  # Navigate with VO+arrow keys
  # Verify announcements: "Growth Assistant, complementary region"
  ```

- [ ] **Color Contrast**
  - Header text vs background: ≥4.5:1
  - Button text vs background: ≥4.5:1

- [ ] **Motion Preferences**
  - Disable animations in System Preferences > Accessibility > Display
  - Panel should appear instantly (no animation)

---

## Regression Testing

### Critical Paths to Test

1. **Tenant Dashboard**
   - [ ] Load page
   - [ ] Panel visible
   - [ ] Content displays correctly
   - [ ] No console errors

2. **Agent Chat**
   - [ ] Send message
   - [ ] Receive response
   - [ ] Message history displays

3. **Page Navigation**
   - [ ] Navigate to /tenant/packages
   - [ ] Navigate to /tenant/bookings
   - [ ] Panel state persists

4. **Sidebar**
   - [ ] Click sidebar items
   - [ ] Active state highlights
   - [ ] Panel doesn't overlap

---

## Sign-Off Criteria

**QA passes when:**

- [ ] All E2E tests pass (0 failures)
- [ ] All manual QA checklist items completed
- [ ] Lighthouse scores ≥90 (performance, best practices)
- [ ] Lighthouse accessibility score ≥95
- [ ] No console errors or warnings
- [ ] No CLS (Cumulative Layout Shift) > 0.1
- [ ] Tested on mobile, tablet, and desktop
- [ ] Tested in Chrome, Safari, Firefox
- [ ] Screen reader friendly (VoiceOver/NVDA)
- [ ] Keyboard shortcut tested (Cmd+K, Ctrl+K)

**Sign-off by:**

- [ ] QA Engineer
- [ ] Product Manager
- [ ] Engineering Lead

---

**Test Plan Version:** 1.0
**Last Updated:** 2025-12-28
**Total Test Cases:** 45+ (unit, integration, E2E, manual)
