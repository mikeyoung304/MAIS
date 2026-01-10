# Build Mode Legacy Cleanup Plan

**Created:** 2026-01-10
**Status:** Ready for Implementation
**Related:** [BUILD_MODE_VISION.md](./BUILD_MODE_VISION.md)

---

## Executive Summary

The codebase successfully transitioned to an **agent-first architecture** but retains ~900 lines of dead code from the previous build mode implementation. This document tracks what to remove and what to keep.

---

## Components to DELETE (Safe - No External Imports)

| Component            | Path                                         | Why Remove                                                        |
| -------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| **BuildModeChat**    | `components/build-mode/BuildModeChat.tsx`    | Marked `@deprecated`, zero usage, replaced by AgentPanel          |
| **BuildModePreview** | `components/build-mode/BuildModePreview.tsx` | Superseded by PreviewPanel (which has page tabs, publish/discard) |
| **PageSelector**     | `components/build-mode/PageSelector.tsx`     | PreviewPanel has its own page tabs                                |
| **BuildModeHeader**  | `components/build-mode/BuildModeHeader.tsx`  | Toolbar integrated into PreviewPanel                              |
| **EditableText**     | `components/build-mode/EditableText.tsx`     | Inline editing replaced by agent chat                             |
| **RichTextEditor**   | `components/build-mode/RichTextEditor.tsx`   | Rich text editing replaced by agent chat                          |
| **AgentChat**        | `components/agent/AgentChat.tsx`             | Full-page variant unused; PanelAgentChat is active                |

**Total:** ~900 lines of dead code

---

## Components to KEEP

| Component                | Path                                      | Why Keep                                       |
| ------------------------ | ----------------------------------------- | ---------------------------------------------- |
| **PreviewPanel**         | `components/preview/PreviewPanel.tsx`     | Active preview with page tabs, publish/discard |
| **BuildModeWrapper**     | `components/tenant/BuildModeWrapper.tsx`  | Essential - handles iframe PostMessage sync    |
| **ConfirmDialog**        | `components/build-mode/ConfirmDialog.tsx` | Used by PreviewPanel for T3 confirmations      |
| **AgentPanel**           | `components/agent/AgentPanel.tsx`         | Persistent chat sidebar (needs cache fix)      |
| **PanelAgentChat**       | `components/agent/PanelAgentChat.tsx`     | Compact chat UI used by AgentPanel             |
| **CustomerChatWidget**   | `components/chat/CustomerChatWidget.tsx`  | Customer-facing chatbot (separate from agent)  |
| **TenantChatWidget**     | `components/chat/TenantChatWidget.tsx`    | Wrapper for CustomerChatWidget                 |
| **useBuildModeSync**     | `hooks/useBuildModeSync.ts`               | PostMessage handshake for preview              |
| **useBuildModeRedirect** | `hooks/useBuildModeRedirect.ts`           | Handles legacy `/tenant/build` URLs            |

---

## Current Architecture (After Cleanup)

```
Tenant Dashboard
├── AgentPanel (persistent sidebar)
│   └── PanelAgentChat
│       └── useAgentChat hook
│
├── ContentArea (main content)
│   ├── Dashboard view (default)
│   └── Preview view (when showPreview=true)
│       └── PreviewPanel
│           ├── Page tabs (home, about, services...)
│           ├── Publish/Discard buttons
│           └── iframe → /t/[slug]?preview=draft&edit=true
│               └── BuildModeWrapper (receives PostMessage updates)
│
└── Storefront (customer-facing)
    └── CustomerChatWidget (separate from admin agent)
```

---

## Fix Required Before Cleanup

### AgentPanel Cache Invalidation (P0)

**File:** `apps/web/src/components/agent/AgentPanel.tsx`

**Current (broken):**

```tsx
<PanelAgentChat
  welcomeMessage={getWelcomeMessage()}
  onFirstMessage={handleFirstMessage}
  onUIAction={handleUIAction}
  className="h-full"
/>
```

**Fixed (add onToolComplete):**

```tsx
import { invalidateDraftConfig } from '@/hooks/useDraftConfig';

<PanelAgentChat
  welcomeMessage={getWelcomeMessage()}
  onFirstMessage={handleFirstMessage}
  onUIAction={handleUIAction}
  onToolComplete={() => invalidateDraftConfig()}
  className="h-full"
/>;
```

---

## Cleanup Execution Steps

### Phase 1: Fix Real-Time Updates

- [ ] Add `onToolComplete` to AgentPanel
- [ ] Test: Agent updates → preview refreshes

### Phase 2: Delete Dead Code

- [ ] Delete `BuildModeChat.tsx`
- [ ] Delete `BuildModePreview.tsx`
- [ ] Delete `PageSelector.tsx`
- [ ] Delete `BuildModeHeader.tsx`
- [ ] Delete `EditableText.tsx`
- [ ] Delete `RichTextEditor.tsx`
- [ ] Delete `AgentChat.tsx`
- [ ] Update `build-mode/index.ts` exports
- [ ] Update `agent/index.ts` exports

### Phase 3: Update Barrel Exports

After deletions, `components/build-mode/index.ts` should only export:

```typescript
export { ConfirmDialog } from './ConfirmDialog';
// Everything else deleted
```

### Phase 4: Verify

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Preview still works in dashboard
- [ ] Agent can update storefront in real-time

---

## Files After Cleanup

```
components/
├── agent/
│   ├── AgentPanel.tsx         ✅ Keep (fix cache)
│   ├── PanelAgentChat.tsx     ✅ Keep
│   ├── QuickReplyChips.tsx    ✅ Keep
│   └── ChatbotUnavailable.tsx ✅ Keep
│
├── build-mode/
│   ├── ConfirmDialog.tsx      ✅ Keep
│   └── index.ts               📝 Update exports
│
├── chat/
│   ├── ChatMessage.tsx        ✅ Keep
│   ├── CustomerChatWidget.tsx ✅ Keep
│   ├── TenantChatWidget.tsx   ✅ Keep
│   └── ProposalCard.tsx       ✅ Keep
│
├── preview/
│   └── PreviewPanel.tsx       ✅ Keep
│
└── tenant/
    └── BuildModeWrapper.tsx   ✅ Keep
```

---

## Related Documentation

- [BUILD_MODE_VISION.md](./BUILD_MODE_VISION.md) - Target architecture
- `docs/solutions/agent-issues/dual-draft-field-session-history-recovery-MAIS-20260110.md`
- `CLAUDE.md` - Page-Based Landing Page Configuration section

---

## Change Log

| Date       | Change                                                 |
| ---------- | ------------------------------------------------------ |
| 2026-01-10 | Initial cleanup plan created from codebase exploration |
