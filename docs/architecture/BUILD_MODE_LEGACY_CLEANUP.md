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

### Phase 1: Fix Real-Time Updates ✅ COMPLETE

- [x] Add `onToolComplete` to AgentPanel
- [x] Test: Agent updates → preview refreshes

### Phase 2: Delete Dead Code ✅ COMPLETE (2026-01-10)

- [x] Delete `BuildModeChat.tsx`
- [x] Delete `BuildModePreview.tsx`
- [x] Delete `PageSelector.tsx`
- [x] Delete `BuildModeHeader.tsx`
- [x] Delete `EditableText.tsx`
- [x] Delete `RichTextEditor.tsx`
- [x] Delete `AgentChat.tsx`
- [x] Delete `ChatbotUnavailable.tsx` (bonus - was orphaned)
- [x] Delete `useDraftAutosave.ts` (bonus - agent handles saves now)
- [x] Delete `useUnsavedChangesWarning.ts` (bonus - never used)
- [x] Delete `/tenant/assistant` page (bonus - orphaned route)
- [x] Update `build-mode/index.ts` exports
- [x] Update `agent/index.ts` exports
- [x] Clean up orphaned types in `build-mode/types.ts`

### Phase 3: Update Barrel Exports ✅ COMPLETE

`components/build-mode/index.ts` now only exports:

```typescript
export { ConfirmDialog } from './ConfirmDialog';
```

`components/agent/index.ts` now only exports:

```typescript
export { AgentPanel } from './AgentPanel';
export { PanelAgentChat } from './PanelAgentChat';
export { QuickReplyChips } from './QuickReplyChips';
```

### Phase 4: Verify ✅ COMPLETE

- [x] `npm run typecheck` passes
- [x] `npm run build` passes
- [x] Preview works in dashboard
- [x] Agent updates storefront in real-time

---

## Files After Cleanup

```
components/
├── agent/
│   ├── AgentPanel.tsx         ✅ Active
│   ├── PanelAgentChat.tsx     ✅ Active
│   └── QuickReplyChips.tsx    ✅ Active
│
├── build-mode/
│   ├── ConfirmDialog.tsx      ✅ Active
│   └── index.ts               ✅ Updated
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
