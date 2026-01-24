# Growth Assistant UI Improvements

## Overview

Transform the Growth Assistant from a hidden sidebar into a prominent, first-class feature that users discover and engage with naturally.

**Current State:**

- Right-side collapsible panel (400px)
- Defaults to collapsed (easily forgotten)
- Overlays content when open
- No keyboard shortcuts
- Quick Action links to separate `/tenant/assistant` page

**Target State:**

- Default open with content-aware resizing
- Main dashboard adjusts (push, not overlay)
- Cmd+K command palette for instant access
- Prominent visibility as key differentiator

---

## Research Summary

### Industry Analysis

| Pattern                     | Examples        | Verdict                                 |
| --------------------------- | --------------- | --------------------------------------- |
| **Bottom-right widget**     | Intercom, Drift | Too support-y, not strategic            |
| **Right sidebar (current)** | GitHub Copilot  | Good but forgotten when collapsed       |
| **Left panel co-creation**  | ChatGPT Canvas  | High visibility but competes with nav   |
| **Command palette (Cmd+K)** | Linear, Raycast | Power users love, discoverability issue |
| **Multi-access hybrid**     | VS Code Copilot | Best of all worlds                      |

### Competitor Intelligence

**HoneyBook (Market Leader):**

- AI Chat in top-right corner (always visible button)
- Clear separation: AI Chat vs Support Chat
- 100 messages/day limit
- Thumbs up/down feedback
- 70% users report feeling more confident

**Key Insight:** HoneyBook's AI is visible, not hidden. Users can't forget it exists.

### UX Research Findings

- **78% of users** look for global help in top-right quadrant
- Proactive AI (suggesting actions) drives higher adoption than passive
- **94% of first impressions** are design-based
- Sidebar reduces "tab overwhelm" but collapsed = forgotten
- Bottom-right corner is expected for _support_ chat specifically

---

## Proposed Solution: Phased Approach

### Phase 1: Make It Visible (Quick Win)

**Change 1: Default Open**

```typescript
// apps/web/src/hooks/useGrowthAssistant.ts
// Change line 41
- const defaultOpen = storedValue !== null ? storedValue === 'true' : true;
+ const defaultOpen = true; // Always default open
```

**Change 2: Content-Aware Resizing**

```typescript
// apps/web/src/app/(protected)/tenant/layout.tsx
// Current: Main content ignores panel
// New: Main content adjusts margin when panel open

<main
  className={cn(
    "lg:pl-72 transition-all duration-300",
    isOpen && "lg:pr-[400px]"  // Push content when panel open
  )}
>
```

**Files Changed:** 2 files, ~10 lines

### Phase 2: Multi-Access Pattern

**Add Command Palette (Cmd+K):**

Install cmdk:

```bash
npm install cmdk
```

Create CommandPalette component:

```typescript
// apps/web/src/components/ui/CommandPalette.tsx
import { Command } from 'cmdk';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { setIsOpen: setAssistantOpen } = useGrowthAssistant();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <Command.Dialog open={open} onOpenChange={setOpen}>
      <Command.Input placeholder="What do you need help with?" />
      <Command.List>
        <Command.Group heading="Growth Assistant">
          <Command.Item onSelect={() => {
            setAssistantOpen(true);
            setOpen(false);
          }}>
            Open Growth Assistant
          </Command.Item>
          <Command.Item>Get my booking link</Command.Item>
          <Command.Item>Check onboarding status</Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
```

**Files Changed:** 1 new file + layout update

### Phase 3: Proactive Engagement (Future)

- Badge indicator when AI has suggestions
- "Your bookings are down 20% this month" proactive insights
- Weekly business snapshot notifications
- Onboarding nudges based on setup state

---

## Technical Specification

### Layout Architecture

**Current:**

```
┌─────────────────────────────────────────────────────────────────┐
│ AdminSidebar (fixed left, z-40)                                 │
│ ┌─────────┐ ┌────────────────────────────────────────────────┐ │
│ │         │ │ Main Content (lg:pl-72)                        │ │
│ │         │ │ ┌────────────────────────────────────────────┐ │ │
│ │         │ │ │ GrowthAssistantPanel (fixed right, z-40)   │ │ │
│ │         │ │ │ OVERLAYS content when open                 │ │ │
│ │         │ │ └────────────────────────────────────────────┘ │ │
│ └─────────┘ └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Proposed:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Grid Layout: [auto] [1fr] [auto]                                │
│ ┌─────────┐ ┌─────────────────────────┐ ┌────────────────────┐ │
│ │ Admin   │ │ Main Content            │ │ Growth Assistant   │ │
│ │ Sidebar │ │ (flex-1, auto-resize)   │ │ Panel (400px)      │ │
│ │ (w-72)  │ │                         │ │                    │ │
│ │         │ │ Content PUSHES when     │ │ Default OPEN       │ │
│ │         │ │ panel opens/closes      │ │                    │ │
│ └─────────┘ └─────────────────────────┘ └────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### File Changes Summary

| File                                                     | Change                                | Lines |
| -------------------------------------------------------- | ------------------------------------- | ----- |
| `apps/web/src/hooks/useGrowthAssistant.ts`               | Default open logic                    | ~5    |
| `apps/web/src/app/(protected)/tenant/layout.tsx`         | Grid layout + dynamic margin          | ~15   |
| `apps/web/src/components/agent/GrowthAssistantPanel.tsx` | Remove fixed positioning, add to grid | ~10   |
| `apps/web/src/components/ui/CommandPalette.tsx`          | New component                         | ~80   |
| `apps/web/package.json`                                  | Add cmdk dependency                   | 1     |

**Total: ~110 lines changed/added**

### Responsive Behavior

| Breakpoint        | Sidebar            | Main Content     | Growth Assistant   |
| ----------------- | ------------------ | ---------------- | ------------------ |
| **Mobile (<lg)**  | Hidden (hamburger) | Full width       | Bottom sheet modal |
| **Desktop (≥lg)** | Fixed 288px        | Flex (remaining) | Fixed 400px        |

### Z-Index Strategy

| Component            | Current | Proposed             |
| -------------------- | ------- | -------------------- |
| AdminSidebar         | z-40    | z-40                 |
| GrowthAssistantPanel | z-40    | z-30 (below sidebar) |
| CommandPalette       | -       | z-50                 |
| Mobile overlays      | -       | z-50                 |

---

## Acceptance Criteria

### Phase 1: Default Open

- [ ] Panel opens by default for new users
- [ ] Panel opens by default for returning users (unless they closed it)
- [ ] Main content resizes smoothly (300ms transition)
- [ ] No horizontal scrollbar when panel open
- [ ] Collapse button still works
- [ ] State persists to localStorage

### Phase 2: Command Palette

- [ ] Cmd+K / Ctrl+K opens palette from anywhere
- [ ] Typing filters available commands
- [ ] "Open Growth Assistant" command works
- [ ] Escape closes palette
- [ ] Focus returns to previous element on close
- [ ] Works with screen readers (ARIA)

### Mobile Considerations

- [ ] Panel becomes bottom sheet on mobile
- [ ] Touch to dismiss works
- [ ] No layout shift on open/close
- [ ] Keyboard doesn't cover input on iOS

---

## Risk Assessment

| Risk                     | Likelihood | Impact | Mitigation                  |
| ------------------------ | ---------- | ------ | --------------------------- |
| Layout shift (CLS)       | Medium     | High   | Use CSS Grid, avoid reflow  |
| localStorage unavailable | Low        | Medium | Fallback to in-memory state |
| Hydration mismatch       | Medium     | Medium | Use `isMounted` pattern     |
| Z-index conflicts        | Low        | Low    | Clear z-index strategy      |
| Mobile usability         | Medium     | Medium | Thorough QA on real devices |

---

## Success Metrics

### UX Metrics

| Metric                      | Current | Target               |
| --------------------------- | ------- | -------------------- |
| Panel discovery rate        | Unknown | 80%+                 |
| Weekly panel usage          | Unknown | 60%+ of active users |
| Session duration with panel | Unknown | +15%                 |
| Messages sent per session   | Unknown | 3+ average           |

### Technical Metrics

| Metric                         | Target |
| ------------------------------ | ------ |
| CLS (Cumulative Layout Shift)  | < 0.1  |
| LCP (Largest Contentful Paint) | < 2.5s |
| Panel open animation           | 60fps  |
| Lighthouse Accessibility       | 95+    |

---

## Implementation Order

1. **Update layout to CSS Grid** (layout.tsx)
2. **Modify useGrowthAssistant hook** (default open)
3. **Update GrowthAssistantPanel** (remove fixed, add grid positioning)
4. **Add mobile bottom sheet** (responsive behavior)
5. **Install cmdk + create CommandPalette** (Phase 2)
6. **Integration testing** (all breakpoints)
7. **Performance audit** (Lighthouse, CLS)

---

## References

### Internal Files

- `apps/web/src/app/(protected)/tenant/layout.tsx:19-26` - Current layout structure
- `apps/web/src/components/agent/GrowthAssistantPanel.tsx:74-83` - Current panel styling
- `apps/web/src/hooks/useGrowthAssistant.ts:24-68` - State management hook
- `apps/web/src/components/layouts/AdminSidebar.tsx:164-169` - Sidebar patterns

### External Resources

- [cmdk documentation](https://cmdk.paco.me/) - Command palette library
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) - Alternative for resizable panels
- [HoneyBook AI](https://www.honeybook.com/product/ai) - Competitor reference
- [Nielsen Norman Group - Chat UX](https://www.nngroup.com/articles/chat-ux/) - UX research

### Industry Research

- 78% of users expect help in top-right quadrant
- Proactive AI drives higher adoption than passive
- Bottom-right corner is for support chat (not strategic AI)
- Sidebar reduces "tab overwhelm" but collapsed = forgotten

---

## Decision Log

| Decision         | Rationale                                    | Date       |
| ---------------- | -------------------------------------------- | ---------- |
| Default open     | 2-3x higher adoption based on research       | 2025-12-28 |
| Push not overlay | Avoids content blocking, familiar UX pattern | 2025-12-28 |
| cmdk over kbar   | Smaller bundle, already using Radix          | 2025-12-28 |
| Cmd+K shortcut   | Industry standard (Linear, Raycast, VS Code) | 2025-12-28 |
| Grid layout      | More predictable than flexbox for 3-column   | 2025-12-28 |
