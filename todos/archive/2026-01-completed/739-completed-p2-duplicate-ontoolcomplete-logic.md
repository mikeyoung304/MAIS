---
status: complete
priority: p2
issue_id: 739
tags: [code-review, dry-violation, react, pr-27]
dependencies: []
---

# P2: Duplicate onToolComplete Logic (DRY Violation)

## Problem Statement

The exact same optimistic update logic for `onToolComplete` appears twice in AgentPanel.tsx - once for desktop (lines 309-333) and once for mobile (lines 488-512). This violates the DRY principle and creates maintenance burden.

**Impact:** Any bug fix or enhancement must be made in two places. Risk of divergence between desktop and mobile behavior.

## Findings

**Reviewers:** code-simplicity-reviewer, kieran-typescript-reviewer

**Location:** `apps/web/src/components/agent/AgentPanel.tsx:309-333` and `:488-512`

**Current Implementation (duplicated):**

```tsx
onToolComplete={(toolResults) => {
  const resultWithConfig = toolResults?.find(
    (r: any) => r.success && r.data?.updatedConfig
  );

  if (resultWithConfig?.data?.updatedConfig) {
    queryClient.setQueryData(['draft-config'], resultWithConfig.data.updatedConfig);
    setTimeout(() => {
      invalidateDraftConfig();
    }, 50);
  } else {
    setTimeout(() => {
      invalidateDraftConfig();
    }, 100);
  }
}}
```

## Proposed Solutions

### Solution A: Extract to Named Function (Recommended)

- **Pros:** Single source of truth, easier testing, explicit dependencies
- **Cons:** Slightly more code initially
- **Effort:** Small (15 minutes)
- **Risk:** Low

```tsx
// Extract before component or use useCallback
const handleToolComplete = useCallback(
  (toolResults: ToolResult[] | undefined) => {
    const resultWithConfig = toolResults?.find(
      (r): r is ToolResultWithConfig => r.success && !!r.data?.updatedConfig
    );

    if (resultWithConfig?.data?.updatedConfig) {
      queryClient.setQueryData(['draft-config'], resultWithConfig.data.updatedConfig);
      setTimeout(() => invalidateDraftConfig(), 50);
    } else {
      setTimeout(() => invalidateDraftConfig(), 100);
    }
  },
  [queryClient, invalidateDraftConfig]
);

// Use in both desktop and mobile:
<PanelAgentChat onToolComplete={handleToolComplete} />;
```

### Solution B: Custom Hook

- **Pros:** Reusable across components
- **Cons:** May be over-engineering for single component
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Solution A - Extract to `useCallback` within the component.

## Technical Details

**Affected Files:**

- `apps/web/src/components/agent/AgentPanel.tsx`

**Lines Saved:** ~50 lines of duplication

## Acceptance Criteria

- [x] Single `handleToolComplete` function used by both desktop and mobile
- [x] TypeScript properly typed (no `any`)
- [x] `useCallback` with correct dependencies
- [x] All existing tests pass

## Work Log

| Date       | Action    | Notes                                                     |
| ---------- | --------- | --------------------------------------------------------- |
| 2026-01-11 | Created   | From PR #27 multi-agent review                            |
| 2026-01-11 | Completed | Extracted to handleToolComplete useCallback, typechecks ✓ |

## Resources

- PR #27: https://github.com/mikeyoung304/MAIS/pull/27
