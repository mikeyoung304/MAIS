---
status: ready
priority: p2
issue_id: 5208
tags: [code-review, dead-code, zustand, dashboard-rebuild]
dependencies: []
---

# hydrateComingSoon Never Called

## Problem Statement

`hydrateComingSoon` action is defined in `apps/web/src/stores/agent-ui-store.ts` but is never called from any component or hook. This means the comingSoon state is never initialized from server data on page load — it only populates reactively as the agent sends tool results. On page refresh during onboarding, the comingSoon display will be empty until the agent sends new data.

## Findings

- `hydrateComingSoon` defined in agent-ui-store
- No callers found via grep across entire codebase
- comingSoon data only populated via `addDiscoveredFact` from agent tool results
- Page refresh loses all comingSoon state

## Proposed Solutions

### Option A: Call hydrateComingSoon from bootstrap data (Recommended)

- In the tenant layout or agent initialization, call `hydrateComingSoon(bootstrapData.discoveryFacts)`
- **Effort:** Small | **Risk:** Low

### Option B: Remove if intentionally reactive-only

- If comingSoon is designed to only show live agent activity, remove the dead function
- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] Either hydrateComingSoon is wired up OR removed as dead code
- [ ] Page refresh during onboarding shows previously discovered facts

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-02-06 | Created | Found during /workflows:review |
