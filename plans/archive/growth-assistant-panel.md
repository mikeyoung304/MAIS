# Growth Assistant Side Panel Implementation

## Summary

Add a Cursor-style Growth Assistant chat panel to the tenant dashboard - always visible on the right side, welcoming new tenants and providing ongoing guidance.

**User Request:** "The chatbot should be a side panel on the right side, similar to cursor... always prominent as a panel. It should feel welcoming and helpful."

**Welcome Message:** "Salutations. Are you ready to get handled? Tell me a little about yourself."

---

## Architecture

### New Components

| Component                  | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `GrowthAssistantPanel.tsx` | Right-side panel container with Radix Sheet |
| `PanelAgentChat.tsx`       | Adapted chat UI for panel form factor       |
| `useGrowthAssistant.ts`    | React hook for panel state + localStorage   |

### Layout Changes

| File                                             | Change                              |
| ------------------------------------------------ | ----------------------------------- |
| `apps/web/src/app/(protected)/tenant/layout.tsx` | Add panel to layout, flex container |

---

## Implementation Plan

### Phase 1: Radix Sheet Component

Add Radix Sheet primitive if not present:

```bash
cd apps/web && npm install @radix-ui/react-dialog
```

Create `apps/web/src/components/ui/sheet.tsx` following shadcn pattern.

### Phase 2: Growth Assistant Panel Component

**File:** `apps/web/src/components/agent/GrowthAssistantPanel.tsx`

```typescript
// Right-side panel using Radix Sheet
// - Always visible by default (isOpen: true in localStorage)
// - Collapse button in header
// - Panel width: 400px
// - Dark header matching dashboard theme
```

Key features:

- Panel header with "Growth Assistant" title + collapse button
- Welcome message displayed on first load
- Integrates existing AgentChat.tsx logic for messages
- LocalStorage persistence for open/closed state

### Phase 3: Panel Chat Adapter

**File:** `apps/web/src/components/agent/PanelAgentChat.tsx`

Adapt existing AgentChat.tsx for panel form factor:

- Compact message styling
- Scroll container fits panel height
- Input fixed at bottom of panel
- Same API integration (uses existing chat endpoints)

### Phase 4: Layout Integration

**File:** `apps/web/src/app/(protected)/tenant/layout.tsx`

```tsx
<div className="flex min-h-screen">
  <Sidebar />
  <main className="flex-1">{children}</main>
  <GrowthAssistantPanel /> {/* New */}
</div>
```

### Phase 5: First-Time Welcome

**Logic:**

1. Check localStorage for `growth-assistant-welcomed` key
2. If not set, auto-open panel with welcome message
3. Set flag after first interaction
4. Backend context-builder already has `isFirstSession` detection

---

## Files to Create/Modify

| File                                                     | Action                         |
| -------------------------------------------------------- | ------------------------------ |
| `apps/web/src/components/ui/sheet.tsx`                   | CREATE - Radix Sheet component |
| `apps/web/src/components/agent/GrowthAssistantPanel.tsx` | CREATE - Panel container       |
| `apps/web/src/components/agent/PanelAgentChat.tsx`       | CREATE - Adapted chat UI       |
| `apps/web/src/hooks/useGrowthAssistant.ts`               | CREATE - State management hook |
| `apps/web/src/app/(protected)/tenant/layout.tsx`         | MODIFY - Add panel to layout   |

---

## Existing Code Reference

### AgentChat.tsx (610 lines)

Located at `apps/web/src/components/agent/AgentChat.tsx`

- Full chat implementation with message history
- Uses `/api/agent/chat` endpoint
- Handles streaming responses
- Message types: user, assistant, system

### Tenant Layout

Located at `apps/web/src/app/(protected)/tenant/layout.tsx`

- Currently has sidebar + main content
- Uses NextAuth session
- Apply panel integration here

### Backend Context Builder

Located at `server/src/agent/context/context-builder.ts`

- Has `isFirstSession` detection
- Builds tenant context for agent responses

---

## Design Specifications

- **Panel width:** 400px (matches Cursor)
- **Background:** White with subtle border
- **Header:** Dark (matches sidebar theme) with "Growth Assistant" title
- **Collapse:** Chevron icon button, persists state to localStorage
- **Messages:** Compact styling, max-width within panel
- **Input:** Sticky bottom, full panel width
- **Animation:** Slide in/out from right (300ms ease)

---

## Acceptance Criteria

- [ ] Panel visible on right side of all tenant pages
- [ ] Welcome message displays: "Salutations. Are you ready to get handled? Tell me a little about yourself."
- [ ] Panel state (open/closed) persists across page loads
- [ ] Chat functionality works (uses existing agent API)
- [ ] First-time users see panel auto-opened with welcome
- [ ] Collapse/expand button works smoothly
- [ ] Mobile: Panel becomes full-screen overlay or bottom sheet
- [ ] Matches brand design (sage accents, serif headlines per BRAND_VOICE_GUIDE.md)
