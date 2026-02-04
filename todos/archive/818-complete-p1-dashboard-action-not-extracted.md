---
status: pending
priority: p1
issue_id: 818
tags: [code-review, agent, integration, pitfall-90]
dependencies: []
---

# P1 Bug: dashboardAction Not Extracted from Tool Results

## Problem Statement

When the tenant-agent updates a section, the tool returns a `dashboardAction` object (e.g., `{ type: 'SCROLL_TO_SECTION', sectionId: 'home-hero-abc123' }`), but the frontend never extracts or processes it. The agent says "Take a look at your preview" but nothing happens in the UI.

**Why it matters:**

- User completes onboarding, agent says changes are ready
- Nothing visible happens in UI
- User thinks system is broken when backend worked correctly
- This is Pitfall #90 in CLAUDE.md (known issue)

## Findings

**From agent-integration-reviewer:**

**Location:** `apps/web/src/components/agent/AgentPanel.tsx:296-343`

**Current Behavior:**

```typescript
const handleConciergeToolComplete = useCallback(
  async (toolCalls: Array<{ name: string; args: Record<string, unknown>; result?: unknown }>) => {
    // Only checks tool NAMES for heuristics
    const modifiedStorefront = toolCalls.some(
      (call) =>
        call.name.includes('storefront') ||
        call.name.includes('section') ||
        // ... more name checks
    );

    // MISSING: No extraction of call.result.dashboardAction
  },
  [queryClient]
);
```

**Evidence:** Comment at line 90 in AgentPanel.tsx explicitly states:

> "dashboardAction not extracted from tool results - must extract call.result?.dashboardAction"

**Expected Behavior:**

```typescript
// Extract dashboardAction from tool results
const dashboardActions = toolCalls.map((call) => call.result?.dashboardAction).filter(Boolean);

if (dashboardActions.length > 0) {
  await handleDashboardActions(dashboardActions);
}
```

## Proposed Solutions

### Option A: Extract and Process dashboardAction (Recommended)

**Pros:** Fixes root cause, enables all dashboard actions
**Cons:** Need to handle multiple action types
**Effort:** Medium (1-2 hours)
**Risk:** Low

```typescript
const handleConciergeToolComplete = useCallback(
  async (toolCalls) => {
    // FIRST: Extract dashboard actions from tool results
    const dashboardActions = toolCalls
      .map((call) => call.result?.dashboardAction)
      .filter((action): action is DashboardAction => Boolean(action));

    // Process dashboard actions BEFORE cache invalidation
    for (const action of dashboardActions) {
      switch (action.type) {
        case 'NAVIGATE':
          agentUIActions.showDashboardSection(action.section);
          break;
        case 'SCROLL_TO_SECTION':
          agentUIActions.highlightSection(action.sectionId);
          agentUIActions.showPreview();
          break;
        case 'SHOW_PREVIEW':
          agentUIActions.showPreview(action.page);
          break;
        case 'REFRESH':
          queryClient.invalidateQueries({ queryKey: getDraftConfigQueryKey() });
          break;
      }
    }

    // THEN: Existing cache invalidation logic
  },
  [queryClient]
);
```

### Option B: Fallback Navigation After Storefront Tools

**Pros:** Simple, doesn't require parsing actions
**Cons:** Less flexible, doesn't support all action types
**Effort:** Small (30 minutes)
**Risk:** Low

```typescript
// After detecting storefront modification
if (modifiedStorefront) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  queryClient.invalidateQueries({ queryKey: getDraftConfigQueryKey() });

  // Fallback: show preview automatically
  agentUIActions.showPreview('home');
}
```

## Recommended Action

Implement Option A (full dashboardAction extraction).

## Technical Details

**Affected files:**

- `apps/web/src/components/agent/AgentPanel.tsx` (lines 296-343)
- `apps/web/src/stores/agent-ui-store.ts` (action handlers)

**Dashboard Action Types (from tool results):**

- `NAVIGATE` - Navigate to dashboard section
- `SCROLL_TO_SECTION` - Highlight and scroll to section in preview
- `SHOW_PREVIEW` - Switch to preview panel
- `REFRESH` - Invalidate and refetch data

## Acceptance Criteria

- [ ] When agent updates a section, preview automatically shows
- [ ] Section highlighting works when agent edits specific section
- [ ] Agent saying "Take a look" results in visible UI change
- [ ] All dashboardAction types are handled

## Work Log

| Date       | Action                           | Learnings                                             |
| ---------- | -------------------------------- | ----------------------------------------------------- |
| 2026-02-04 | Code review identified known gap | Pitfall #90 documents this but fix wasn't implemented |

## Resources

- CLAUDE.md Pitfall #90 - dashboardAction not extracted from tool results
- `server/src/agent-v2/deploy/tenant/src/tools/` - Tool result formats
