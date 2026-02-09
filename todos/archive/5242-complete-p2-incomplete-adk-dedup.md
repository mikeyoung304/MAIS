---
status: pending
priority: p2
issue_id: 5242
tags: [code-review, architecture, adk]
dependencies: []
---

# Incomplete ADK Client Deduplication

## Problem Statement

`server/src/routes/tenant-admin-tenant-agent.routes.ts` still has local `extractToolCalls`, `extractAgentResponse`, and `extractDashboardActions` functions (~90 LOC) that duplicate the shared `adk-client.ts`. The local schema is stricter in some areas (e.g., explicit `functionCall.id` field). This partial dedup means bug fixes to the shared module won't propagate to tenant-agent routes.

## Findings

- **Source:** Architecture strategist, code-simplicity-reviewer, agent-native-reviewer
- **Location:** `server/src/routes/tenant-admin-tenant-agent.routes.ts`
- **Evidence:** Local `extractToolCalls` uses different matching logic than shared version; `extractDashboardActions` is unique to this route and may need to remain, but the others should use shared code.

## Proposed Solutions

### Option A: Migrate to shared adk-client.ts (Recommended)

- Replace local `extractToolCalls` and `extractAgentResponse` with imports from `adk-client.ts`
- Keep `extractDashboardActions` as route-specific (it processes tool results differently)
- Merge any stricter schema fields (like `functionCall.id`) into the shared schema
- **Effort:** Small | **Risk:** Low

### Option B: Full extraction including dashboard actions

- Move all extraction functions to shared module, parameterize dashboard action logic
- **Effort:** Medium | **Risk:** Medium (may over-abstract)

## Acceptance Criteria

- [ ] No local `extractToolCalls` or `extractAgentResponse` in tenant-agent routes
- [ ] Shared `adk-client.ts` schema handles all formats used by tenant-agent routes
- [ ] Typecheck passes

## Work Log

- 2026-02-08: Created from PR #43 review (6-agent parallel review)
