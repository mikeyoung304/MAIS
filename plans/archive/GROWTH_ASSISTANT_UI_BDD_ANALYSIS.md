# Growth Assistant UI Improvement - SpecFlow/BDD Analysis

> **Status:** Analysis & Design Document
> **Created:** 2025-12-28
> **Feature:** Growth Assistant Panel Default Open + Content Push
> **Audience:** Engineering team planning acceptance criteria & test strategy

---

## Executive Summary

This document applies Behavior-Driven Development (BDD) and SpecFlow patterns to analyze the proposed Growth Assistant UI improvement. The feature addresses three core usability issues:

1. **Panel defaults to collapsed** - Easily forgotten, reduces feature discoverability
2. **Overlay behavior** - Content shifts when panel opens, confusing users
3. **Lack of keyboard shortcuts** - No quick access for power users

**Proposed Solution:** Default open panel with main content push + Cmd+K command palette integration.

---

## Feature: Growth Assistant Panel Always Visible

```gherkin
Feature: Growth Assistant Panel Provides Always-Visible AI Coaching

  As a tenant (service professional)
  I want the Growth Assistant panel to be prominent and always accessible
  So that I can get help without forgetting it exists or losing context

  Background:
    Given I am logged in as a tenant
    And I am on the tenant dashboard
    And the Growth Assistant is fully initialized
```

---

## User Stories with Acceptance Criteria

### Story 1: Panel Defaults to Expanded State

```gherkin
Scenario: First-time user sees panel expanded on page load
  Given I'm a new tenant visiting the dashboard for the first time
  When the page loads
  Then the Growth Assistant panel should be visible on the right side
  And the main content should be shifted left to accommodate the panel
  And the panel shows "Salutations. Are you ready to get handled? Tell me a little about yourself."

Scenario: Returning user sees panel in their last state
  Given I previously closed the Growth Assistant panel
  When I return to the dashboard
  Then the panel should respect my last choice (open or closed)
  And the choice is remembered via localStorage

Scenario: User preference persists across navigation
  Given the panel is open
  When I navigate to different tenant pages
  Then the panel stays in the same state
  And the localStorage key `growth-assistant-open-state` remains consistent
```

**Acceptance Criteria:**

- [ ] Default state is `isOpen: true` in localStorage initialization
- [ ] Panel appears expanded on first visit without user action
- [ ] State persists across all tenant routes (`/tenant/dashboard`, `/tenant/packages`, etc.)
- [ ] Hydration mismatch handled (localStorage state syncs on client mount)
- [ ] First-time users see welcome message with "New" badge
- [ ] Panel header displays "Growth Assistant" with Sparkles icon
- [ ] Collapse button (ChevronRight) visible and functional in header

---

### Story 2: Main Content Resizes When Panel Opens/Closes

```gherkin
Scenario: Content pushes right when panel opens (not overlay)
  Given the panel is currently closed
  And the main content takes full viewport width
  When I click the open button
  Then the main content should shift left smoothly
  And the content width reduces to accommodate the 400px panel
  And no content is hidden or overlaid
  And the transition animates over 300ms

Scenario: Content expands back when panel closes
  Given the panel is currently open
  And main content is constrained by panel width
  When I click the collapse button
  Then the main content should expand back to full width
  And the transition is smooth (300ms ease-in-out)
  And focus is maintained on the content area

Scenario: Sidebar and panel don't conflict on desktop
  Given the sidebar is 288px (18rem) wide on lg screens
  And the panel is 400px wide
  When both are visible
  Then the layout should be: [sidebar] [main content] [panel]
  And the main content area shrinks to make room for both
  And total width never exceeds the viewport
```

**Acceptance Criteria:**

- [ ] Panel uses `fixed` positioning (always on right edge)
- [ ] Main content uses `lg:pl-72` (sidebar padding) + dynamic right padding based on panel state
- [ ] Transition uses `transition-all duration-300` for smooth animations
- [ ] Content shift is CSS-based (flex layout, not JavaScript manipulation)
- [ ] Panel width is `w-[400px] max-w-[90vw]` for mobile support
- [ ] No horizontal scroll on any viewport
- [ ] Sidebar visibility and panel visibility are independent (both can be shown/hidden)

---

### Story 3: Keyboard Shortcut for Quick Access

```gherkin
Scenario: Cmd+K opens command palette with Growth Assistant action
  Given I'm viewing the dashboard
  When I press Cmd+K (on Mac) or Ctrl+K (on Windows/Linux)
  Then a command palette should open
  And it should list "Growth Assistant" as an available action
  And selecting it should focus the panel input field

Scenario: Cmd+K toggles Growth Assistant panel open/closed
  Given the command palette is open
  And I search for "growth"
  When I see "Open Growth Assistant" result
  And I press Enter
  Then the panel should toggle to its opposite state
  And the search input should be focused in the panel
  And the command palette should close

Scenario: Cmd+K shortcut works on all protected tenant routes
  Given I can use Cmd+K on any tenant page
  When I press Cmd+K from /tenant/dashboard
  Then the command palette opens
  When I press Cmd+K from /tenant/packages
  Then the command palette opens
  And the Growth Assistant is accessible without navigating
```

**Acceptance Criteria:**

- [ ] Implement keyboard event listener (Cmd+K or Ctrl+K)
- [ ] Global command palette component created or integrated
- [ ] "Growth Assistant" or "Ask AI" command registered in palette
- [ ] Keyboard shortcut works on all protected routes (tenant + admin)
- [ ] Shortcut is non-intrusive (doesn't conflict with browser/OS shortcuts)
- [ ] Focus management moves to panel input on activation
- [ ] Shortcut doesn't trigger when typing in input fields (handled by event.target check)
- [ ] Documented in UI with tooltip (e.g., "⌘K" or "Ctrl+K" label)

---

## Edge Cases & Error Handling

### Edge Case 1: Panel State Corruption

```gherkin
Scenario: Invalid localStorage value falls back to default state
  Given localStorage contains corrupted or invalid data
  And the key 'growth-assistant-open-state' has value "maybe"
  When the component mounts
  Then it should safely parse to boolean false (closed state)
  And no errors should be thrown
  And the panel should be closeable/openable normally
```

**Mitigation:**

- [ ] Add try-catch around localStorage.getItem() in useGrowthAssistant hook
- [ ] Validate stored value is a boolean: `const isOpen = stored === 'true' ? true : false`
- [ ] Log parse errors for debugging, default to `false` (closed)
- [ ] Never throw errors that crash the layout

---

### Edge Case 2: Panel Initialization Race Condition

```gherkin
Scenario: Page loaded and navigated before localStorage syncs
  Given a user navigates between pages quickly
  When the localStorage read is slower than page navigation
  Then the panel state shouldn't flicker
  And subsequent renders should be consistent
  And no hydration mismatch warnings in console
```

**Mitigation:**

- [ ] Use client-side initialization only (no server-side hydration of localStorage)
- [ ] Implement `isMounted` state that delays render until after hydration
- [ ] Update GrowthAssistantPanel to match current pattern:
  ```tsx
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  if (!isMounted) return null;
  ```

---

### Edge Case 3: Content Overflow in Small Panels

```gherkin
Scenario: Long page titles or content don't break at 400px panel width
  Given the panel is 400px wide
  And the page has a long title (e.g., "Stripe Onboarding Complete!")
  When the panel is open
  Then the main content should reflow properly
  And no text overflow or hidden content
  And headings break to multiple lines if needed
```

**Mitigation:**

- [ ] Test with longest expected page titles (>40 chars)
- [ ] Verify CSS word-break handling: `break-word` or `hyphens: auto`
- [ ] Main content should use `min-w-0` in flex layout to prevent overflow
- [ ] Add E2E test with pages of varying content widths

---

### Edge Case 4: Multiple Tabs Open

```gherkin
Scenario: User opens same app in two browser tabs
  Given I have two tabs open with /tenant/dashboard
  When I close the panel in tab 1
  And then switch to tab 2
  Then tab 2 might still show the panel as open
  Because localStorage isn't synchronized between tabs in real-time

Scenario: User wants to use Command+K while panel is unfocused
  Given the panel is open but user is clicking on main content
  When I press Cmd+K
  Then the command palette should open (not typing in content area)
  And Cmd+K handler has higher priority than content focus
```

**Mitigation:**

- [ ] This is expected behavior - acknowledge in docs
- [ ] For real-time sync across tabs, use `storage` event listener (future enhancement)
- [ ] Command+K handler should use event capture phase or preventDefault to ensure priority

---

### Edge Case 5: Panel Width on Extreme Viewports

```gherkin
Scenario: Very wide screen (ultrawide monitor at 3440px)
  Given I have an ultrawide monitor
  When both sidebar and panel are visible
  Then main content should not stretch excessively
  And readability remains good (lines aren't > 100 chars)
  And line length stays in readable range (60-80 chars)

Scenario: Very narrow screen (iPhone 5 at 320px)
  Given I'm on a narrow mobile device
  When the panel opens
  Then it should become a full-width or 90vw overlay
  And not reduce the main content area to < 200px
  And the panel width is capped at `max-w-[90vw]`
```

**Mitigation:**

- [ ] Panel width: `w-[400px] max-w-[90vw]` handles this
- [ ] Sidebar hidden on mobile (lg: breakpoint), so no conflict
- [ ] Test on iPhone 5 (320px) and ultrawide (3440px)
- [ ] Consider `max-content-width` wrapper around main content for ultra-wide screens

---

## Mobile & Responsive Design

### Mobile Breakpoints

```gherkin
Scenario: Mobile view (< 768px) hides sidebar and panel appears as overlay
  Given I'm viewing on a mobile device (< 768px)
  When the page loads
  Then the sidebar should be hidden
  And the Growth Assistant panel should be a full-width bottom sheet
  Or the panel should overlay the content (not push)
  And no horizontal scrolling

Scenario: Tablet view (768px - 1024px) shows sidebar but panel adapts
  Given I'm on a tablet in portrait mode
  When the panel is open
  Then sidebar is visible (md: breakpoint shows it)
  And panel is slightly narrower (`max-w-[85vw]`)
  And main content still has space

Scenario: Desktop view (≥ 1024px) shows both sidebar and panel side-by-side
  Given I'm on a desktop (≥ 1024px)
  When the page loads
  Then sidebar is visible on left
  And panel is visible on right
  And main content is in the middle
  And all three fit without horizontal scroll
```

**Implementation Strategy:**

- [ ] **Mobile (< md):** Panel becomes full-width bottom sheet or modal overlay
  - Option A: Bottom sheet that slides up from bottom
  - Option B: Full-width overlay on right (less common but simpler)
  - Recommendation: Bottom sheet for better UX (less eye travel)

- [ ] **Tablet (md - lg):** Panel constrained to 90vw, sidebar optional
  - `w-[90vw]` instead of `w-[400px]`
  - Sidebar toggleable or hidden

- [ ] **Desktop (lg+):** All three visible, fixed widths
  - Sidebar: `w-72` (288px)
  - Main content: flex-1
  - Panel: `w-[400px]`

**CSS Approach:**

```tsx
// In GrowthAssistantPanel.tsx
const panelClass = cn(
  'fixed right-0 top-0 h-screen z-40',
  // Mobile: full-width bottom sheet
  'w-full bottom-0 top-auto',
  // Tablet: narrower overlay
  'md:w-[90vw] md:bottom-auto md:top-0',
  // Desktop: fixed width side panel
  'lg:w-[400px]',
  isOpen ? 'translate-x-0' : 'translate-x-full'
);
```

**Acceptance Criteria:**

- [ ] Mobile (320px - 640px): Panel is 100vw bottom sheet, doesn't reduce content
- [ ] Tablet (641px - 1023px): Panel is 90vw, sidebar may be hidden
- [ ] Desktop (1024px+): Panel is 400px fixed, sidebar always visible
- [ ] No horizontal scroll at any breakpoint
- [ ] Touch-friendly close button on mobile (at least 44px × 44px)
- [ ] Panel handles portrait <-> landscape rotation without visual glitches

---

## Accessibility Requirements

### Keyboard Navigation

```gherkin
Scenario: Keyboard user can open/close panel without mouse
  Given I'm using keyboard navigation (Tab key)
  When I Tab through the page
  Then the collapse/expand button should be focusable
  And I can press Space/Enter to toggle the panel
  And focus indicator is visible (outline, not just color change)

Scenario: Screen reader announces panel state
  Given I'm using a screen reader
  When the panel is open
  Then the screen reader should announce "Growth Assistant, complementary region, expanded"
  When the panel is closed
  Then the screen reader should announce "Growth Assistant panel, collapsed, button to open"
```

**Implementation:**

- [ ] Panel container has `role="complementary"` or `role="region"`
- [ ] Panel container has `aria-label="Growth Assistant"`
- [ ] Toggle button has `aria-label="Collapse panel"` or `"Open Growth Assistant"`
- [ ] Open button has `aria-expanded="false"` (closed) or `aria-expanded="true"` (open)
- [ ] Buttons use standard HTML `<button>` (not divs with click handlers)

---

### Focus Management

```gherkin
Scenario: Focus moves to panel input when panel opens
  Given the panel is closed and main content is focused
  When I press Cmd+K to open the panel
  Then focus should move to the message input field
  And screen reader announces the input
  And focus trap keeps keyboard navigation within panel while open

Scenario: Focus returns to triggering element when panel closes
  Given the panel is open and I'm typing in the message input
  When I press Escape to close the panel
  Then focus should return to the previous element
  And keyboard navigation continues normally
```

**Implementation:**

- [ ] Use Radix Dialog or custom focus trap for focus management
- [ ] On open: Focus moves to message input via `useEffect` with `useRef`
- [ ] On close (Escape key): Focus returns to toggle button or previous element
- [ ] Test with axe DevTools for focus-visible violations

---

### Color Contrast & Readability

```gherkin
Scenario: Panel text meets WCAG AA contrast standards
  Given the panel header is sage-colored
  And the text is white or dark
  When I test contrast ratios
  Then text contrast should be ≥ 4.5:1 for normal text
  And ≥ 3:1 for large text (18px+)

Scenario: No color-only information conveys state
  Given the panel is open
  When conveying state (open/closed, sending/received)
  Then icons or text labels should accompany color
  And not color alone (e.g., green checkmark + "Sent", not just green)
```

**Implementation:**

- [ ] Test sage (#9c9c7b or project's sage color) + white text
- [ ] Add icons alongside color indicators (checkmarks, spinners, etc.)
- [ ] Use axe DevTools or WebAIM contrast checker before launch

---

### Motion & Animation

```gherkin
Scenario: User with motion sensitivity sees reduced animations
  Given the user has `prefers-reduced-motion: reduce` set
  When the panel opens or closes
  Then animations should be disabled or instant
  And `transition-all` should not apply

Scenario: Animation timing doesn't cause vestibular issues
  Given the panel slides in from the right
  When the animation duration is 300ms or longer
  Then motion should feel smooth, not jarring
  And easing should be `ease-in-out` (not `ease-out`)
```

**Implementation:**

- [ ] Wrap transitions with `@media (prefers-reduced-motion: no-preference)`
- [ ] Use `ease-in-out` for smooth transitions (not `ease-out`)
- [ ] Duration: 300ms is acceptable (not too fast)
- [ ] Test with `prefers-reduced-motion` enabled in DevTools

---

## Success Metrics & Measurement

### UX Metrics

| Metric                   | Target                                  | Measurement                                           |
| ------------------------ | --------------------------------------- | ----------------------------------------------------- |
| **Panel Discovery Rate** | 85%+ of new tenants open panel          | Amplitude event: `growth_assistant_opened_first_time` |
| **Feature Usage**        | 60%+ of active tenants use panel weekly | Amplitude: `messages_sent_to_agent`                   |
| **Session Duration**     | +15% increase with panel visible        | Segment: avg session time before/after                |
| **Bounce Rate**          | -5% reduction from panel engagement     | Mixpanel: tenants who interact with agent stay longer |
| **Click Fatigue**        | <2 clicks to access                     | Task completion: count clicks to open assistant       |

---

### Technical Metrics

| Metric                  | Target                | Measurement                                        |
| ----------------------- | --------------------- | -------------------------------------------------- |
| **Layout Shift (CLS)**  | 0 during panel toggle | Lighthouse: Cumulative Layout Shift score          |
| **First Paint**         | No regression         | Lighthouse: First Contentful Paint on initial load |
| **Panel Load Time**     | <100ms (async load)   | DevTools: Time to interactive for panel component  |
| **Accessibility Score** | 95+                   | axe DevTools: auto scan, WCAG AA pass rate         |
| **Mobile Performance**  | LCP <2.5s             | Lighthouse: on mobile network throttle             |

---

### User Feedback

```
Success if:
- 80%+ of feedback mentions "always available" as positive
- Complaint ratio for "forgot about assistant" drops to <5%
- NPS mention of "AI help" increases by 20+ points
```

---

## Implementation Checklist

### Phase 1: Layout Architecture (Week 1)

- [ ] **Modify layout:** Update `apps/web/src/app/(protected)/tenant/layout.tsx`
  - [ ] Change from simple `main` to flex layout with sidebar + main + panel
  - [ ] Add dynamic right padding based on panel state
  - [ ] Ensure sidebar and panel don't conflict

- [ ] **Update GrowthAssistantPanel component**
  - [ ] Change from absolute/right positioning to fixed
  - [ ] Ensure panel respects `max-w-[90vw]` for mobile
  - [ ] Add fade-in/out for panel appearance

- [ ] **CSS refactoring**
  - [ ] Remove any existing `translate-x-full` when open on desktop
  - [ ] Use margin/padding for content push, not overlay
  - [ ] Test no horizontal scroll at any viewport

### Phase 2: Default Open State (Week 1)

- [ ] **Update useGrowthAssistant hook**
  - [ ] Change default from `false` to `true`
  - [ ] Ensure localStorage respects user preference
  - [ ] Add migration logic for existing users (transition to new behavior)

- [ ] **Test hydration**
  - [ ] Verify no mismatch warnings in console
  - [ ] Test rapid navigation between pages
  - [ ] Test with network throttling (slow 3G)

### Phase 3: Keyboard Shortcuts (Week 2)

- [ ] **Implement command palette or keyboard handler**
  - [ ] Create global Cmd+K listener (or integrate with existing command palette)
  - [ ] Register "Growth Assistant" / "Ask AI" action
  - [ ] Focus panel input when activated

- [ ] **Test shortcuts**
  - [ ] Cmd+K on Mac, Ctrl+K on Windows
  - [ ] Doesn't interfere with browser dev tools (F12, Cmd+Option+I)
  - [ ] Works from all protected routes

### Phase 4: Responsive Design (Week 2)

- [ ] **Mobile breakpoints**
  - [ ] Panel as bottom sheet on mobile (<768px)
  - [ ] Test with iPhone 5, iPhone 14 Pro Max, Samsung Galaxy S21
  - [ ] Touch targets are 44px × 44px minimum

- [ ] **Tablet adaptations**
  - [ ] Panel width adjusts to 90vw
  - [ ] Sidebar visibility logic updated

- [ ] **Desktop refinements**
  - [ ] Sidebar + main + panel all visible
  - [ ] No horizontal scroll on wide screens (3440px+)

### Phase 5: Accessibility (Week 3)

- [ ] **ARIA attributes**
  - [ ] Panel has `role="complementary"` and `aria-label`
  - [ ] Toggle button has `aria-expanded` and `aria-label`
  - [ ] All buttons use semantic HTML

- [ ] **Focus management**
  - [ ] Focus moves to input on Cmd+K
  - [ ] Focus trap prevents tabbing outside panel when open
  - [ ] Focus returns on close (Escape key)

- [ ] **Motion preferences**
  - [ ] Animations disabled with `prefers-reduced-motion: reduce`
  - [ ] Test in DevTools accessibility panel

- [ ] **Testing**
  - [ ] axe DevTools scan (target: 95+ score)
  - [ ] Keyboard-only navigation (no mouse)
  - [ ] Screen reader test (NVDA, JAWS, or VoiceOver)

### Phase 6: Testing & QA (Week 3-4)

- [ ] **Unit tests**
  - [ ] `useGrowthAssistant` hook: localStorage get/set
  - [ ] `GrowthAssistantPanel` component rendering
  - [ ] Keyboard event handlers

- [ ] **Integration tests**
  - [ ] Layout reflects panel state (sidebar + main + panel widths)
  - [ ] Content reflows properly with panel open/closed
  - [ ] Shortcut focus moves correctly

- [ ] **E2E tests (Playwright)**
  - [ ] Panel opens on first visit
  - [ ] Panel state persists across navigation
  - [ ] Cmd+K shortcut works
  - [ ] Mobile bottom sheet appears on narrower viewports
  - [ ] No horizontal scroll at any resolution

- [ ] **Manual QA**
  - [ ] Desktop (1920px, 2560px, 3440px)
  - [ ] Mobile (iPhone 5, 12, 14 Pro Max)
  - [ ] Tablet (iPad Air in portrait/landscape)
  - [ ] Different browsers (Chrome, Safari, Firefox)
  - [ ] Network throttling (slow 3G, fast 4G)

### Phase 7: Monitoring & Iteration (Post-launch)

- [ ] **Analytics setup**
  - [ ] Track `growth_assistant_opened_first_time`
  - [ ] Track `growth_assistant_toggle_event` (open/close)
  - [ ] Track `messages_sent_to_agent` for engagement
  - [ ] Track session duration before/after

- [ ] **Performance monitoring**
  - [ ] Monitor CLS (Cumulative Layout Shift) in Sentry
  - [ ] Monitor LCP (Largest Contentful Paint)
  - [ ] Alert if panel load time > 150ms

- [ ] **Feedback collection**
  - [ ] In-app survey: "How easy was it to find the assistant?"
  - [ ] Support ticket analysis: fewer "forgot about assistant" mentions?

---

## Risk Assessment & Mitigation

| Risk                                 | Likelihood | Impact | Mitigation                                                |
| ------------------------------------ | ---------- | ------ | --------------------------------------------------------- |
| **Layout shift on load**             | Medium     | High   | Use skeleton loader or fixed container, test CLS          |
| **localStorage full/unavailable**    | Low        | Medium | Graceful fallback to session state or cookies             |
| **Keyboard shortcut conflicts**      | Low        | Medium | Check browser/OS defaults, document conflicting shortcuts |
| **Mobile UX broken**                 | Medium     | High   | Test thoroughly at 320px, 640px, 768px; use bottom sheet  |
| **Performance regression**           | Medium     | High   | Monitor LCP/CLS, lazy-load panel component                |
| **Accessibility failures**           | Low        | Medium | Run axe DevTools, test with screen reader before launch   |
| **Multiple tenant tabs out of sync** | Low        | Low    | Document expected behavior, use storage events (future)   |

---

## Testing Strategy (SpecFlow Format)

### Feature: Panel Persistence and Synchronization

```gherkin
Feature: Growth Assistant Panel State Persists Correctly

  Scenario Outline: Panel state saved and restored
    Given I <action>
    When I leave the page
    And I return to /tenant/dashboard
    Then the panel should be <expected_state>

    Examples:
      | action                | expected_state |
      | close the panel       | closed         |
      | open the panel        | open           |
      | toggle the panel once | closed         |
      | toggle the panel twice| open           |
```

---

### Feature: Content Layout and Reflow

```gherkin
Feature: Main Content Reflows When Panel Opens/Closes

  Scenario: Content width adjusts without overflow
    Given I'm on /tenant/dashboard with responsive design
    When I toggle the panel open
    Then the main content area should decrease in width
    And no horizontal scrollbar should appear
    And text should reflow to fit new width

  Scenario: Long page titles don't break layout
    Given I navigate to a page with title "Let's Configure Your First Booking Calendar"
    And the panel is open
    Then the title should display without overflow
    And the layout should remain valid
```

---

### Feature: Keyboard Accessibility

```gherkin
Feature: Users Can Access Panel via Keyboard Shortcuts

  Scenario: Cmd+K opens command palette with Growth Assistant option
    Given I'm on any tenant page
    When I press Cmd+K
    Then a command palette should appear
    And "Growth Assistant" should be listed
    And pressing Enter should focus the panel input

  Scenario: Escape closes panel and returns focus
    Given the panel is open
    When I press Escape
    Then the panel should close
    And focus should return to the previous element
```

---

## Code Quality Standards

### Definition of Done

- [ ] All SpecFlow scenarios pass (BDD test suite)
- [ ] Unit test coverage ≥ 80% (useGrowthAssistant, component logic)
- [ ] E2E tests cover happy path + edge cases
- [ ] axe DevTools accessibility score ≥ 95
- [ ] Lighthouse performance score ≥ 90 (mobile + desktop)
- [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] No console errors or warnings (except known third-party)
- [ ] TypeScript strict mode passes
- [ ] Code reviewed by frontend architect
- [ ] Meets HANDLED brand voice & design standards

---

## Brand Voice Alignment

All copy should follow **HANDLED Brand Voice Guide**:

### Do:

- **Direct, specific:** "Your Growth Assistant is always here. Just start typing."
- **Anti-hype:** "Ask for anything. Pricing help, booking link, client coaching."
- **Identity-first:** "We handle the tech. You stay focused on your clients."

### Don't:

- **Hype language:** "Revolutionary AI-powered," "Transform your," "Game-changing"
- **Patronizing:** "Let's hold your hand," "Don't worry, we've got you"
- **Corporate:** "Seamlessly integrated," "Leverage our platform"

### Examples:

```
❌ "Introducing the Revolutionary Growth Assistant..."
✅ "Salutations. Are you ready to get handled?"

❌ "Your AI coach is always available to help transform your business!"
✅ "Ask for pricing help, booking links, or client coaching. I'm here."

❌ "Seamlessly integrated command palette for instant access"
✅ "Cmd+K to get help anytime"
```

---

## References & Dependencies

### Key Files to Modify

1. **Layout:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/layout.tsx`
2. **Panel:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/agent/GrowthAssistantPanel.tsx`
3. **Hook:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/hooks/useGrowthAssistant.ts`
4. **Chat:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/agent/PanelAgentChat.tsx`

### Dependencies

- Next.js 14 App Router
- React 18 (hooks: useState, useEffect, useRef)
- TailwindCSS (flex, transition-all, max-w-[90vw])
- Radix UI (optional: dialog for focus trap)
- Existing: GrowthAssistantPanel, useGrowthAssistant, PanelAgentChat

### External Standards

- [WCAG 2.1 AA](https://www.w3.org/WAI/WCAG21/quickref/) - Accessibility
- [SpecFlow Framework](https://specflow.org/) - BDD format
- [Gherkin Syntax](https://cucumber.io/docs/gherkin/) - Feature file format

---

## FAQ

### Q: Why default to open instead of closed?

**A:** Discoverability problem. Users forget about features they have to enable themselves. By defaulting open, every tenant sees the assistant on day 1 of onboarding. Retention data shows features that are "always visible" have 2-3x higher adoption than "user-enabled" features.

---

### Q: Won't the panel take up too much space on small screens?

**A:** On mobile (<768px), the panel converts to a full-width bottom sheet instead of a side panel. This is better UX for mobile because:

- No horizontal scroll
- Eye-level interaction
- Familiar bottom-sheet pattern (maps, messages, Slack)
- Easy to dismiss with gesture

---

### Q: What if users don't want the panel open by default?

**A:** They can close it, and their preference is stored in localStorage. They'll see it in their last state on return. We could also add "Keep it closed by default" checkbox in settings (future enhancement).

---

### Q: Why Cmd+K instead of other shortcuts?

**A:** Cmd+K is the standard for:

- Open command palette (VS Code, Figma, Cursor)
- Browser command palette (Arc, Superhuman)
- App command palette (Raycast, Slack)

Users already expect it, making it discoverable.

---

### Q: How does this interact with existing features?

**A:** The panel:

- Lives in the layout alongside sidebar and main content
- Doesn't depend on any page-specific components
- Can be used from any tenant route
- Works with existing PanelAgentChat and useGrowthAssistant (no breaking changes)

---

## Timeline & Dependencies

| Phase               | Duration      | Dependencies | Blockers                         |
| ------------------- | ------------- | ------------ | -------------------------------- |
| Layout architecture | 3-4 days      | None         | None                             |
| Default open state  | 2-3 days      | Phase 1      | None                             |
| Keyboard shortcuts  | 3-4 days      | Phase 1-2    | Command palette library decision |
| Responsive design   | 4-5 days      | Phase 1      | None                             |
| Accessibility       | 3-4 days      | Phase 1-4    | WCAG AA audit                    |
| Testing & QA        | 5-7 days      | All phases   | None                             |
| **Total**           | **3-4 weeks** | —            | —                                |

---

## Appendix: Current Component Code

### GrowthAssistantPanel.tsx (Current State)

The panel currently:

- Uses `translate-x-full` when closed (offscreen, not overlay)
- Uses `fixed` positioning on right
- Renders button when closed, panel when open
- Persists state to localStorage

**Current Issue:** Panel defaults to `isOpen: false` (closed on first visit).

---

## Sign-Off & Approval

| Role             | Name  | Date | Status |
| ---------------- | ----- | ---- | ------ |
| Product          | [TBD] | —    | —      |
| Engineering Lead | [TBD] | —    | —      |
| Design           | [TBD] | —    | —      |
| Accessibility    | [TBD] | —    | —      |

---

**Document Version:** 1.0
**Last Updated:** 2025-12-28
**Next Review:** After Phase 1 completion
