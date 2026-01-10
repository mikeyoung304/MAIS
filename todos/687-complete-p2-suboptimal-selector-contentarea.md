---
status: resolved
priority: p2
issue_id: '687'
tags: [code-review, agent-first-architecture, performance, zustand]
dependencies: []
---

# P2: Suboptimal Selector in ContentArea Causes Extra Re-renders

## Problem Statement

`ContentArea.tsx` uses `const view = useAgentUIStore((state) => state.view)` which selects the entire `view` object. When nested properties change (e.g., `highlightedSectionId`), Zustand performs object comparison and triggers re-render of the entire ContentArea.

**Why This Matters:**

- ContentArea re-renders for highlight changes that only PreviewPanel needs
- Unnecessary work, especially with complex child components
- Easy fix with existing selectors

## Findings

**Agent:** Performance Oracle

**Location:** `apps/web/src/components/dashboard/ContentArea.tsx` (line 123)

**Current State:**

```typescript
const view = useAgentUIStore((state) => state.view);
```

**Available Selectors (already defined in store):**

- `selectViewStatus` - just the status string
- `selectPreviewConfig` - config or null

## Proposed Solutions

### Option A: Use granular selectors (Recommended)

```typescript
const viewStatus = useAgentUIStore(selectViewStatus);
const previewConfig = useAgentUIStore(selectPreviewConfig);
```

- **Pros:** Only re-renders when status changes, not nested properties
- **Cons:** Two subscriptions instead of one (negligible)
- **Effort:** Small
- **Risk:** None

## Recommended Action

**Option A** - Use the existing granular selectors.

## Technical Details

**Affected Files:**

- `apps/web/src/components/dashboard/ContentArea.tsx`

## Acceptance Criteria

- [ ] ContentArea uses granular selectors
- [ ] No re-render when only `highlightedSectionId` changes

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
