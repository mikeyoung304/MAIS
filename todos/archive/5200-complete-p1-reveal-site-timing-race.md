---
status: ready
priority: p1
issue_id: 5200
tags: [code-review, agent, timing, dashboard-rebuild]
dependencies: []
---

# REVEAL_SITE Timing Race in first-draft.ts

## Problem Statement

`build_first_draft` tool in `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts:177` returns `dashboardAction: { type: 'REVEAL_SITE' }` immediately in its result, BEFORE the agent calls `update_section` for each section. The LLM receives the tool result with the reveal action, the frontend triggers the reveal animation, but section content hasn't been written yet — users see placeholder content during the grand reveal.

Found independently by 3 agents: architecture-strategist, agent-native-reviewer, performance-oracle.

## Findings

- Line 177: `dashboardAction: { type: 'REVEAL_SITE' }` returned in `build_first_draft` result
- The tool's `instruction` field (line 173) tells the LLM to call `update_section` for each section AFTER this tool returns
- Frontend extracts `dashboardAction` from tool results in `AgentPanel.tsx` and fires immediately
- No mechanism to delay REVEAL_SITE until all sections are actually written

## Proposed Solutions

### Option A: Move REVEAL_SITE to last update_section call (Recommended)

- Remove `dashboardAction` from `build_first_draft` return
- Add `dashboardAction: { type: 'REVEAL_SITE' }` to the LAST `update_section` call (or a new `finalize_first_draft` tool)
- **Pros:** Simple, guarantees content exists before reveal
- **Cons:** Requires knowing which section is last (use SECTION_BLUEPRINT order)
- **Effort:** Small
- **Risk:** Low

### Option B: Frontend waits for N sections before revealing

- RevealTransition polls section content API until all sections have content
- Only starts animation when threshold met
- **Pros:** Decoupled from agent tool ordering
- **Cons:** Adds polling complexity, latency
- **Effort:** Medium
- **Risk:** Medium

### Option C: Add finalize_first_draft tool

- New tool called after all update_section calls
- Only this tool returns REVEAL_SITE action
- **Pros:** Explicit sequencing, clean separation
- **Cons:** Another tool to maintain
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

- **Affected files:** `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts`, `apps/web/src/components/agent/AgentPanel.tsx`
- **Components:** Agent tool pipeline, RevealTransition
- **Database changes:** None

## Acceptance Criteria

- [ ] REVEAL_SITE action only fires after all sections have been written
- [ ] RevealTransition shows real content, not placeholders
- [ ] E2E: Send onboarding messages → verify reveal shows actual content

## Work Log

| Date       | Action  | Notes                                                               |
| ---------- | ------- | ------------------------------------------------------------------- |
| 2026-02-06 | Created | Found during /workflows:review of feat/dashboard-onboarding-rebuild |

## Resources

- PR: feat/dashboard-onboarding-rebuild → main
- File: `server/src/agent-v2/deploy/tenant/src/tools/first-draft.ts:177`
- Related: Pitfall #43 (tools return instructions)
