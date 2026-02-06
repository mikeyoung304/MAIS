---
status: ready
priority: p1
issue_id: 5201
tags: [code-review, react-hooks, stale-closure, dashboard-rebuild]
dependencies: []
---

# isMobile Stale Closure in AgentPanel handleDashboardActions

## Problem Statement

In `apps/web/src/components/agent/AgentPanel.tsx`, the `handleDashboardActions` callback (around line 316) has `[queryClient]` in its dependency array but references `isMobile` (from `useIsMobile()` hook) inside the callback body (lines ~285, ~296). Since `isMobile` is not in the deps array, the callback captures the initial value and never updates when viewport changes. Mobile users who rotate or resize will get wrong behavior.

Found independently by 3 agents: kieran-typescript-reviewer, performance-oracle, agent-native-reviewer.

## Findings

- `useCallback(..., [queryClient])` missing `isMobile` dependency
- `isMobile` used for conditional logic (mobile drawer vs desktop panel)
- React ESLint rule likely suppressed or not catching this
- Violates Rules of Hooks dependency exhaustiveness (Pitfall #15 adjacent)

## Proposed Solutions

### Option A: Add isMobile to dependency array (Recommended)

- Change `[queryClient]` → `[queryClient, isMobile]`
- **Pros:** Simple, correct, follows React rules
- **Cons:** Callback recreated on viewport change (negligible cost)
- **Effort:** Small (1 line)
- **Risk:** None

### Option B: Use ref for isMobile

- `const isMobileRef = useRef(isMobile); isMobileRef.current = isMobile;`
- Read `isMobileRef.current` inside callback
- **Pros:** Callback identity stable
- **Cons:** More code, ref pattern harder to read
- **Effort:** Small
- **Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

- **Affected files:** `apps/web/src/components/agent/AgentPanel.tsx`
- **Components:** AgentPanel
- **Database changes:** None

## Acceptance Criteria

- [ ] `isMobile` included in callback dependency array (or ref pattern used)
- [ ] Mobile users see correct drawer behavior after viewport changes
- [ ] No ESLint exhaustive-deps warnings

## Work Log

| Date       | Action  | Notes                                                               |
| ---------- | ------- | ------------------------------------------------------------------- |
| 2026-02-06 | Created | Found during /workflows:review of feat/dashboard-onboarding-rebuild |

## Resources

- PR: feat/dashboard-onboarding-rebuild → main
- File: `apps/web/src/components/agent/AgentPanel.tsx:~316`
- Pitfall #15: Early return before hooks / dependency exhaustiveness
