---
status: pending
priority: p2
issue_id: '685'
tags: [code-review, agent-first-architecture, typescript, type-safety]
dependencies: []
---

# P2: AgentAction.payload Typed as `unknown`

## Problem Statement

The `payload` field in `AgentAction` interface uses `unknown` type, providing minimal type safety for event sourcing. This prevents type-safe event replay and debugging.

**Why This Matters:**

- Cannot verify payload shape at compile time
- Event replay/undo logic can't leverage TypeScript narrowing
- Debugging requires runtime inspection instead of IDE support

## Findings

**Agent:** TypeScript/React Reviewer

**Location:** `apps/web/src/stores/agent-ui-store.ts` (line 87)

**Current State:**

```typescript
export interface AgentAction {
  id: string;
  type: AgentActionType;
  payload: unknown; // ← Untyped
  timestamp: number;
  agentSessionId: string | null;
  tenantId: string;
}
```

## Proposed Solutions

### Option A: Discriminated union for payloads (Recommended)

```typescript
export type AgentAction =
  | {
      id: string;
      type: 'SHOW_PREVIEW';
      payload: { page: PageName };
      timestamp: number;
      agentSessionId: string | null;
      tenantId: string;
    }
  | {
      id: string;
      type: 'HIDE_PREVIEW';
      payload: Record<string, never>;
      timestamp: number;
      agentSessionId: string | null;
      tenantId: string;
    }
  | {
      id: string;
      type: 'HIGHLIGHT_SECTION';
      payload: { sectionId: string };
      timestamp: number;
      agentSessionId: string | null;
      tenantId: string;
    }
  | {
      id: string;
      type: 'SET_PAGE';
      payload: { page: PageName };
      timestamp: number;
      agentSessionId: string | null;
      tenantId: string;
    }
  | {
      id: string;
      type: 'SET_ERROR';
      payload: { error: string };
      timestamp: number;
      agentSessionId: string | null;
      tenantId: string;
    };
```

- **Pros:** Full type safety, IDE support for event replay
- **Cons:** More verbose, requires updating when adding action types
- **Effort:** Medium
- **Risk:** Low

### Option B: Generic payload type

```typescript
interface AgentAction<T = unknown> {
  type: AgentActionType;
  payload: T;
  // ...
}
```

- **Pros:** More flexible
- **Cons:** Doesn't enforce specific payload shapes
- **Effort:** Small
- **Risk:** Low

## Recommended Action

**Option A** - Full discriminated union. This aligns with the excellent discriminated union pattern already used for ViewState.

## Technical Details

**Affected Files:**

- `apps/web/src/stores/agent-ui-store.ts`

## Acceptance Criteria

- [ ] Payload types are specific to action type
- [ ] TypeScript narrows payload based on action type
- [ ] Tests verify payload type safety

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
