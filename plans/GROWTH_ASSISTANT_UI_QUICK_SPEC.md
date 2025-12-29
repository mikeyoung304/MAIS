# Growth Assistant UI Improvement - Quick Spec

> **TL;DR for Implementation**
>
> Make the Growth Assistant panel default to open (not closed) with main content shifting right (not overlaying). Add Cmd+K keyboard shortcut. Handle mobile as bottom sheet.

---

## The Three Changes

### 1. Default Open State

**Current:** `isOpen: false` on first visit
**New:** `isOpen: true` on first visit

**Files:**

- `apps/web/src/hooks/useGrowthAssistant.ts` - Change default in hook
- `apps/web/src/components/agent/GrowthAssistantPanel.tsx` - No change needed

**Why:** Users forget about features they have to enable. Always-visible features have 2-3x higher adoption.

---

### 2. Content Push (Not Overlay)

**Current:** Panel slides in from right, overlays main content
**New:** Main content shifts left when panel opens, shrinks to make room

**Files:**

- `apps/web/src/app/(protected)/tenant/layout.tsx` - Update layout structure
- Tailwind CSS classes - Add responsive spacing

**Layout Change:**

```tsx
// Before (sidebar + main only)
<div className="min-h-screen bg-surface">
  <AdminSidebar />
  <main className="lg:pl-72">
    {children}
  </main>
  <GrowthAssistantPanel />
</div>

// After (sidebar + main + panel, with push behavior)
<div className="min-h-screen bg-surface flex">
  <AdminSidebar />
  <main className="flex-1 lg:pl-72 transition-all duration-300" style={{
    paddingRight: isPanelOpen ? '400px' : '0'
  }}>
    {children}
  </main>
  <GrowthAssistantPanel />
</div>
```

**Why:** Overlay behavior is confusing (content jumps when panel opens). Push behavior is familiar (Gmail sidebar, Cursor editor).

---

### 3. Keyboard Shortcut (Cmd+K)

**Current:** Only clickable via button
**New:** Cmd+K (Mac) or Ctrl+K (Windows) opens panel + focuses input

**Files:**

- `apps/web/src/app/(protected)/tenant/layout.tsx` - Add keyboard listener
- Or integrate with existing command palette if one exists

**Implementation:**

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+K (Mac) or Ctrl+K (Windows)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleGrowthAssistant();
      // Focus input in panel
      document.querySelector('[data-testid="agent-input"]')?.focus();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

**Why:** Industry standard (VS Code, Figma, Slack, Arc browser). Users expect it.

---

## Mobile Behavior

**Desktop (≥1024px):** All three visible (sidebar + main + panel)
**Tablet (768-1023px):** Sidebar hidden, panel overlays or adapts
**Mobile (<768px):** Panel becomes full-width bottom sheet, doesn't reduce main content

```tsx
// Panel width classes
<aside className={cn(
  'fixed right-0 top-0 h-screen z-40',
  'w-full bottom-0 top-auto',           // Mobile: full-width bottom
  'md:w-[90vw] md:bottom-auto md:top-0', // Tablet: 90vw width on right
  'lg:w-[400px]',                        // Desktop: fixed 400px
)}>
```

---

## Acceptance Criteria (MVP)

- [ ] Panel defaults to open on first visit (`isOpen: true`)
- [ ] Panel state persists in localStorage
- [ ] Main content shifts right (flex-1 + padding) when panel opens
- [ ] No horizontal scroll at any viewport width
- [ ] Cmd+K opens/focuses panel (or focuses input if already open)
- [ ] Mobile: Panel is bottom sheet (<768px), doesn't shrink content
- [ ] Sidebar + main + panel all visible on desktop without conflict
- [ ] Transitions smooth (300ms ease-in-out)
- [ ] Focus management: Cmd+K moves focus to input, Escape moves focus back

---

## Testing Checklist

### Unit Tests

- [ ] useGrowthAssistant returns `isOpen: true` by default
- [ ] localStorage.getItem returns correct state
- [ ] Keyboard handler prevents default for Cmd+K

### Integration Tests

- [ ] Panel open: main content has right padding (400px on desktop)
- [ ] Panel closed: main content has no right padding
- [ ] Content width never less than 300px (readable)

### E2E Tests

- [ ] Page load: panel visible and open
- [ ] Cmd+K: toggles panel, focuses input
- [ ] Mobile: panel is full-width at 375px viewport
- [ ] Sidebar + main + panel visible at 1440px without horizontal scroll

### Manual QA

- [ ] 320px (iPhone 5): bottom sheet, no overflow
- [ ] 768px (iPad): panel overlays or adapts, no overflow
- [ ] 1440px (laptop): three columns visible, clean layout
- [ ] 3440px (ultrawide): content doesn't stretch excessively
- [ ] Keyboard-only: can tab to button, press Enter/Space to toggle
- [ ] Screen reader: panel role="complementary" aria-label announced

---

## Potential Gotchas

### 1. Hydration Mismatch

**Issue:** Server renders closed, client renders open → flicker
**Solution:** Only render on client (use `isMounted` state)

```tsx
const [isMounted, setIsMounted] = useState(false);
useEffect(() => {
  setIsMounted(true);
}, []);
if (!isMounted) return null;
```

### 2. Layout Shift (CLS)

**Issue:** Panel appears after page loads → layout shift → poor Lighthouse score
**Solution:** Reserve space for panel on server render or use skeleton

### 3. localStorage Full

**Issue:** localStorage might be full or unavailable
**Solution:** Wrap in try-catch, fallback to session state

```tsx
try {
  localStorage.setItem('growth-assistant-open-state', isOpen.toString());
} catch (e) {
  // localStorage full or unavailable
  console.warn('localStorage unavailable, state not persisted');
}
```

### 4. Sidebar + Panel Conflict

**Issue:** Both visible on desktop, main content squeezed
**Solution:** Use flex layout: `[sidebar] [main flex-1] [panel fixed]`

**Key:** Panel uses `fixed` positioning, sidebar uses `absolute` or takes space, main uses `flex-1` to fill remaining

### 5. Keyboard Shortcut Conflicts

**Issue:** Cmd+K conflicts with browser shortcuts or input focus
**Solution:** Check if target is input/textarea before handling

```tsx
if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
  const target = e.target as HTMLElement;
  // Only handle if not typing in an input
  if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
    e.preventDefault();
    toggleGrowthAssistant();
  }
}
```

---

## Success Metrics

Track these in analytics after launch:

- **Panel Discovery:** 85%+ of new tenants see the panel on day 1
- **Feature Usage:** 60%+ of active tenants message the agent weekly
- **Engagement:** +15% increase in session duration vs baseline
- **Cmd+K Usage:** 30%+ of panel opens via keyboard shortcut

---

## File Changes Summary

| File                                                     | Change                                               | Lines |
| -------------------------------------------------------- | ---------------------------------------------------- | ----- |
| `apps/web/src/hooks/useGrowthAssistant.ts`               | Change `isOpen` default to `true`                    | ~5    |
| `apps/web/src/app/(protected)/tenant/layout.tsx`         | Add flex layout, panel state listener, Cmd+K handler | ~30   |
| `apps/web/src/components/agent/GrowthAssistantPanel.tsx` | Minor: ensure panel state respects new layout        | ~5    |
| No other files need changes                              | —                                                    | —     |

**Total:** ~40 lines of code changes (minimal, surgical)

---

## Implementation Order

1. **First:** Update layout structure to flex (ensure no layout breaks)
2. **Second:** Change `isOpen` default to true
3. **Third:** Add Cmd+K keyboard handler
4. **Fourth:** Test mobile breakpoints and adjust panel width classes
5. **Fifth:** Run E2E tests and QA

**Estimated time:** 2-3 days (including QA)

---

## Questions Before Starting?

- Should panel default open even for existing users, or only new users?
- Should we add a "hide panel by default" checkbox in settings?
- Should Cmd+K open the command palette (if one exists) with Growth Assistant as a search result, or directly toggle the panel?
- Is the panel 400px correct, or should it be narrower/wider?

---

**Approval:** [Signature line for product/engineering lead]
