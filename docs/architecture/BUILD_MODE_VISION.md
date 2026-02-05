# Build Mode Architecture Vision

> **SUPERSEDED (February 2, 2026):** This document describes a draft/publish system using `landingPageConfigDraft`, `storefrontDraft`, and `storefrontPublished` columns. These were replaced by the `SectionContent` table in the Phase 5 Section Content Migration. The UX concepts (real-time preview, publish/discard flow) remain valid, but the storage implementation changed. See CLAUDE.md "Storefront Storage (Phase 5)" section for current architecture.

**Created:** 2026-01-10
**Status:** SUPERSEDED - Storage implementation replaced by SectionContent table

---

## Core Principle: One Display, Real-Time Updates

The tenant dashboard has **one primary display** in Build Mode that shows storefront changes as they happen during conversation with the AI agent.

---

## Target UX Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Tenant Dashboard                             │
├──────────────────────┬──────────────────────────────────────────┤
│                      │                                           │
│   Persistent Agent   │         Build Mode Display                │
│   (Same as           │                                           │
│    onboarding)       │   ┌─────────────────────────────────┐    │
│                      │   │                                 │    │
│   "Tell me about     │   │   Live Storefront Preview       │    │
│    your business..." │   │   (Updates in real-time as      │    │
│                      │   │    agent makes changes)         │    │
│   [Agent responds    │   │                                 │    │
│    and updates       │   │   ┌─────────┐  ┌─────────┐     │    │
│    display live]     │   │   │ Scrap   │  │ Publish │     │    │
│                      │   │   │ (revert)│  │ (go live│     │    │
│                      │   │   └─────────┘  └─────────┘     │    │
│                      │   └─────────────────────────────────┘    │
│                      │                                           │
│   [Visit Storefront] │   Future: Undo/Redo capability           │
│   (as customer)      │                                           │
└──────────────────────┴──────────────────────────────────────────┘
```

---

## Key Behaviors

### 1. Real-Time Updates

- Agent mentions "updating your headline" → display shows new headline immediately
- No manual refresh needed
- Changes accumulate in draft until user decides

### 2. Persistent Agent

- Same AI agent from onboarding follows user throughout tenant dashboard
- Maintains context and relationship
- Available on every page (packages, scheduling, payments, etc.)

### 3. Save/Discard Flow

| Action      | Result                                          |
| ----------- | ----------------------------------------------- |
| **Publish** | Draft → Live storefront (customers see it)      |
| **Scrap**   | Draft discarded, revert to current live version |

### 4. Customer Preview

- Separate button: "Visit Storefront as Customer"
- Opens live storefront (not draft)
- User can test customer chatbot experience
- Full booking flow accessible

### 5. Optimistic Locking ✅ (Implemented 2026-01-21)

- Version field tracks draft modifications
- `ConflictDialog` shows when another tab modified draft
- Users can "Refresh & Continue" or "Discard My Changes"
- See: #620, commit 51bb2323

### 6. Future: Undo/Redo

- Track change history during session
- Allow stepping back through changes
- Could leverage version history for rollback
- Implementation TBD

---

## Technical Requirements

### For Real-Time Updates

1. Agent tools write to `landingPageConfigDraft`
2. After tool completion, invalidate frontend cache
3. Preview panel refetches and renders updated draft
4. PostMessage protocol for iframe updates (already exists)

### For Persistent Agent

1. Single `AgentPanel` component across all dashboard routes
2. Session continuity (already implemented via session history)
3. Same system prompt whether onboarding or post-onboarding

### For Save/Discard

1. **Publish**: Copy `landingPageConfigDraft` → `landingPageConfig` (wrapper format)
2. **Discard**: Set `landingPageConfigDraft` to null
3. Both already implemented in `landing-page.service.ts`

---

## Current Issues (To Fix)

### P0: Cache Invalidation Missing

- **File**: `apps/web/src/components/agent/AgentPanel.tsx`
- **Issue**: `onToolComplete` not passed to `PanelAgentChat`
- **Fix**: Add `onToolComplete={() => invalidateDraftConfig()}`

### P1: Legacy Systems to Remove

See: [BUILD_MODE_LEGACY_CLEANUP.md](./BUILD_MODE_LEGACY_CLEANUP.md)

---

## Components Involved

| Component            | Role                           | Status                               |
| -------------------- | ------------------------------ | ------------------------------------ |
| `AgentPanel`         | Persistent chat sidebar        | ✅ Active (cache invalidation fixed) |
| `ContentArea`        | Switches between views         | ✅ Active                            |
| `PreviewPanel`       | Renders storefront preview     | ✅ Active                            |
| `useDraftConfig`     | Fetches draft, publish/discard | ✅ Active                            |
| `CustomerChatWidget` | Customer-facing chatbot        | ✅ Active (separate from agent)      |
| `PanelAgentChat`     | Compact chat UI for agent      | ✅ Active                            |
| `BuildModeWrapper`   | iframe PostMessage handler     | ✅ Active                            |

---

## Related Docs

- `docs/solutions/agent-issues/dual-draft-field-session-history-recovery-MAIS-20260110.md`
- `docs/solutions/patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md`
- `CLAUDE.md` - Segments and Tiers section

---

## Future Work / Potential Enhancements

| Enhancement             | Description                                 | Priority |
| ----------------------- | ------------------------------------------- | -------- |
| Undo/Redo               | Track change history, allow stepping back   | P3       |
| Real-time Collaboration | Show other users' cursors/changes           | P4       |
| Conflict Auto-Merge     | Intelligently merge non-conflicting changes | P4       |
| Version History         | View/restore previous draft versions        | P3       |

---

## Change Log

| Date       | Change                                                         |
| ---------- | -------------------------------------------------------------- |
| 2026-01-21 | Added optimistic locking (#620) - prevents multi-tab data loss |
| 2026-01-10 | Initial vision document created                                |
