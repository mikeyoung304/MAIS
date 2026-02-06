---
status: ready
priority: p1
issue_id: 5203
tags: [code-review, agent, dashboard-rebuild]
dependencies: []
---

# HIGHLIGHT_NEXT_SECTION No-Op Due to Missing sectionId

## Problem Statement

The `mark_section_complete` agent tool returns `dashboardAction: { type: 'HIGHLIGHT_NEXT_SECTION' }` but does NOT include `sectionId` in the action payload. The frontend handler in `AgentPanel.tsx` guards on `action.sectionId` before calling `refinementActions.setCurrentSection()`. Since `sectionId` is always undefined, the highlight action silently does nothing — the user never sees the next section highlighted during guided review.

## Findings

- `mark_section_complete` tool result: `{ dashboardAction: { type: 'HIGHLIGHT_NEXT_SECTION' } }` — no sectionId
- Frontend guard: `if (action.sectionId) { refinementActions.setCurrentSection(action.sectionId, action.sectionType); }`
- Guard always fails → no-op
- The tool knows the CURRENT section but not the NEXT one

## Proposed Solutions

### Option A: Tool computes and returns next section ID (Recommended)

- `mark_section_complete` looks up SECTION_BLUEPRINT order
- Finds next incomplete section after the one being completed
- Returns `{ type: 'HIGHLIGHT_NEXT_SECTION', sectionId: nextId, sectionType: nextType }`
- **Pros:** Frontend stays dumb, agent tool has full context
- **Cons:** Tool needs SECTION_BLUEPRINT import
- **Effort:** Small
- **Risk:** Low

### Option B: Frontend computes next section

- On receiving HIGHLIGHT_NEXT_SECTION (without sectionId), frontend reads refinement store
- Finds first incomplete section from SECTION_BLUEPRINT order
- **Pros:** No agent tool change needed
- **Cons:** Frontend needs SECTION_BLUEPRINT, logic duplication
- **Effort:** Small
- **Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

- **Affected files:** Agent tool `mark_section_complete`, `apps/web/src/components/agent/AgentPanel.tsx`
- **Components:** Agent tool, AgentPanel, refinement-store
- **Database changes:** None

## Acceptance Criteria

- [ ] HIGHLIGHT_NEXT_SECTION action includes valid sectionId
- [ ] Frontend highlights the next incomplete section after marking one complete
- [ ] When last section is completed, no highlight (or transitions to publish_ready)

## Work Log

| Date       | Action  | Notes                                                               |
| ---------- | ------- | ------------------------------------------------------------------- |
| 2026-02-06 | Created | Found during /workflows:review of feat/dashboard-onboarding-rebuild |

## Resources

- PR: feat/dashboard-onboarding-rebuild → main
- Related: SECTION_BLUEPRINT in `packages/contracts/src/schemas/section-blueprint.schema.ts`
