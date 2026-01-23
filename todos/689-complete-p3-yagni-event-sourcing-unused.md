---
status: complete
priority: p3
issue_id: '689'
tags: [code-review, agent-first-architecture, yagni, simplicity]
dependencies: []
---

# P3: YAGNI - Event Sourcing / Undo Feature Built But Unused

## Problem Statement

The event sourcing pattern with `actionLog` and `undoLastAction()` is built but never used in production code. The entire feature (50+ lines) exists for hypothetical future needs.

**Current Usage:**

- `undoLastAction()` - Only called in tests, never in any component or handler
- `getActionLog()` - Only called in tests
- `actionLog` array - Maintained but never displayed or consumed by UI

## Findings

**Agent:** Code Simplicity Reviewer (DHH-style)

**Location:** `apps/web/src/stores/agent-ui-store.ts`

**Unused Code:**

- Action logging in every action handler (~20 lines)
- `undoLastAction()` implementation (~30 lines)
- `getActionLog()` method
- `AgentAction` interface and `AgentActionType` type

## Proposed Solutions

### Option A: Remove unused code

- Strip out event sourcing until actually needed
- **Pros:** Simpler code, less maintenance
- **Cons:** Re-implementation cost if needed later
- **Effort:** Medium
- **Risk:** Low

### Option B: Mark as "Phase X" scaffolding (Recommended)

- Keep code but document it's for future features
- Add TODO comments linking to future feature plans
- **Pros:** Clear intent, ready for future work
- **Cons:** Still carrying unused code
- **Effort:** Small
- **Risk:** None

### Option C: Implement UI for event sourcing

- Add Undo button to toolbar
- Add Action Log debugging panel
- **Pros:** Makes use of existing code
- **Cons:** Scope creep
- **Effort:** Medium-Large
- **Risk:** Low

## Recommended Action

**Option B** for this PR. The architecture plan mentions undo/redo as a future feature. Add comments to clarify this is intentional scaffolding.

## Technical Details

**Affected Files:**

- `apps/web/src/stores/agent-ui-store.ts`

## Acceptance Criteria

- [ ] Event sourcing code is clearly documented as future scaffolding
- [ ] OR code is removed if determined unnecessary

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
- Related: `plans/agent-first-dashboard-architecture.md` (Future Considerations section)
