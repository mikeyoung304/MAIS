---
status: complete
priority: p2
issue_id: '7010'
tags: [code-review, agent, pr-45]
dependencies: []
---

# 7010: dashboardCapabilities Lists 16/34 Tools — Fix or Remove

## Problem Statement

The `dashboardCapabilities` list in `context-builder.ts` (lines 251-275) is injected into the agent's context but only lists ~16 of the 34 registered tools. This creates a contradictory signal: the LLM sees tool declarations for 34 tools but a capabilities list showing only 16. Missing tools include all discovery, research, first-draft, guided refinement, marketing, and per-section lifecycle tools.

## Recommended Action

**Option A (Preferred): Remove the capabilities list entirely.** ADK already provides tool declarations to the LLM. A partial list is worse than no list — it implies missing tools don't exist.

**Option B: Make it exhaustive.** Update to list all 34 tools grouped by category. Must be maintained whenever tools are added/removed.

Go with Option A unless the capabilities list serves a specific purpose beyond tool discovery (e.g., if it's displayed in a UI or used for access control). Check if any frontend code reads this field.

## Technical Details

- **Affected files:** `server/src/agent-v2/deploy/tenant/src/context-builder.ts`
- **Components:** Context builder, agent prompt context
- **Database:** No changes

## Acceptance Criteria

- [x] Either: capabilities list removed entirely, OR updated to all 34 tools
- [x] If removed: verify no frontend/UI code depends on this field
- [ ] ~~If kept: add a comment noting it must be updated when tools change~~ (N/A - removed)
- [x] Typecheck passes (no new errors)

## Work Log

| Date       | Action                                | Learnings                                             |
| ---------- | ------------------------------------- | ----------------------------------------------------- |
| 2026-02-11 | Created from PR #45 review            | Found by Agent-Native Reviewer agent                  |
| 2026-02-11 | Resolved: Option A — removed entirely | No frontend deps found; ADK tool declarations suffice |

## Resources

- PR #45: refactor/agent-debt-cleanup
- File: `server/src/agent-v2/deploy/tenant/src/context-builder.ts:251-275`
