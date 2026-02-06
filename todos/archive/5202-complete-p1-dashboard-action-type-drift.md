---
status: ready
priority: p1
issue_id: 5202
tags: [code-review, contracts, type-safety, dashboard-rebuild]
dependencies: []
---

# DashboardAction Type Drift Between Contracts and Frontend

## Problem Statement

The `DashboardActionSchema` in `packages/contracts/src/schemas/section-content.schema.ts` defines a Zod enum for valid dashboard action types, but it's missing `REFRESH_PREVIEW` and `PUBLISH_SITE` — both of which are handled in the frontend `AgentPanel.tsx` and dispatched by agent tools. This means the contracts (single source of truth) are out of sync with runtime behavior. If validation is ever enforced on the API boundary, these actions will be rejected.

## Findings

- `DashboardActionSchema` Zod enum is missing at least 2 action types
- Frontend `handleDashboardActions` handles `REFRESH_PREVIEW` and `PUBLISH_SITE`
- Agent tools return these action types in their results
- No runtime validation currently catches the mismatch (actions pass through as untyped JSON)

## Proposed Solutions

### Option A: Add missing types to DashboardActionSchema (Recommended)

- Add `REFRESH_PREVIEW` and `PUBLISH_SITE` to the Zod enum
- Audit all action types dispatched by agent tools and handled in frontend
- **Pros:** Contracts become authoritative, enables future validation
- **Cons:** None
- **Effort:** Small
- **Risk:** None

### Option B: Generate action types from usage

- Grep all `dashboardAction: { type: '...' }` in agent tools
- Grep all `case '...'` in handleDashboardActions
- Auto-generate union type
- **Pros:** Always in sync
- **Cons:** Over-engineering for ~10 action types
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

- **Affected files:** `packages/contracts/src/schemas/section-content.schema.ts`, `apps/web/src/components/agent/AgentPanel.tsx`
- **Components:** API contracts, AgentPanel
- **Database changes:** None

## Acceptance Criteria

- [ ] All action types used in agent tools are defined in DashboardActionSchema
- [ ] All action types handled in frontend match the schema
- [ ] TypeScript compilation verifies the match

## Work Log

| Date       | Action  | Notes                                                               |
| ---------- | ------- | ------------------------------------------------------------------- |
| 2026-02-06 | Created | Found during /workflows:review of feat/dashboard-onboarding-rebuild |

## Resources

- PR: feat/dashboard-onboarding-rebuild → main
- File: `packages/contracts/src/schemas/section-content.schema.ts`
