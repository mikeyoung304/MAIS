---
status: pending
priority: p1
issue_id: '678'
tags: [code-review, agent-first-architecture, performance, memory-leak]
dependencies: []
---

# P1: Unbounded actionLog Growth (Memory Leak)

## Problem Statement

The `actionLog` array in `agent-ui-store.ts` grows indefinitely with every agent action. There is no cap, rotation, or cleanup mechanism. In long-running sessions with frequent agent interactions, this will cause memory accumulation.

**Why This Matters:**

- Each `AgentAction` object contains timestamp, payload (arbitrary data), and IDs
- Users who keep dashboard open for extended periods will see memory growth
- Could cause browser performance issues in extreme cases
- Particularly problematic for power users who interact frequently with agent

## Findings

**Agent:** Performance Oracle

**Location:** `apps/web/src/stores/agent-ui-store.ts` (lines 252, 273, 291, 341, 367)

**Current State:**

```typescript
state.actionLog.push(action); // Called on every action, no limit
```

**Actions that append to log:**

- `showPreview` (line 252)
- `showDashboard` (line 273)
- `highlightSection` (line 291)
- `setPreviewPage` (line 341)
- `setError` (line 367)

## Proposed Solutions

### Option A: Fixed-size FIFO buffer (Recommended)

```typescript
const MAX_ACTION_LOG_SIZE = 100;

state.actionLog.push(action);
if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
  state.actionLog.shift(); // Remove oldest
}
```

- **Pros:** Simple, predictable memory usage
- **Cons:** Loses old actions after threshold
- **Effort:** Small (add 3 lines to store)
- **Risk:** Low

### Option B: Time-based cleanup

- Keep only actions from last N minutes
- Run cleanup on interval or action threshold
- **Pros:** More intelligent retention
- **Cons:** More complex, potential for stale data
- **Effort:** Medium
- **Risk:** Low

### Option C: Persist to localStorage, clear memory

- Periodically flush old actions to localStorage
- Keep only recent actions in memory
- **Pros:** Full audit trail preserved
- **Cons:** localStorage has size limits, more complex
- **Effort:** Medium
- **Risk:** Medium (localStorage limits vary by browser)

## Recommended Action

**Option A** with MAX_ACTION_LOG_SIZE = 100. This provides sufficient history for debugging and undo while preventing unbounded growth.

## Technical Details

**Affected Files:**

- `apps/web/src/stores/agent-ui-store.ts`

**Implementation:**

1. Add constant at top of file
2. Add shift() call after each push()
3. Update tests to verify FIFO behavior

## Acceptance Criteria

- [ ] Action log has maximum size limit
- [ ] Oldest actions are removed when limit exceeded
- [ ] Undo functionality still works within limit
- [ ] Tests verify FIFO behavior
- [ ] Memory usage stays bounded in long sessions

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
- File: `apps/web/src/stores/agent-ui-store.ts`
