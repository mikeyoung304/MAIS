---
status: pending
priority: p2
issue_id: '672'
tags:
  - code-review
  - quality
  - dry
  - frontend
dependencies: []
---

# AgentChat and PanelAgentChat Have Significant Code Duplication

## Problem Statement

`AgentChat.tsx` (634 lines) and `PanelAgentChat.tsx` (549 lines) share approximately 150+ lines of identical or near-identical logic including:

- Session initialization
- Message sending
- Proposal handling (confirm/reject)
- Quick Reply parsing and rendering
- Message bubble components

**Why it matters:** DRY violation means bug fixes must be applied in two places. The hardcoded greeting bug (#668) only exists in PanelAgentChat because they diverged.

## Findings

**Duplicated Patterns:**

1. **Session initialization logic (~40 lines each)**
   - Health check → session fetch → error handling
   - Identical in both components

2. **sendMessage function (~30 lines each)**
   - Input validation → API call → message state update
   - Minor differences in styling only

3. **Proposal handling (~40 lines each)**
   - confirmProposal and rejectProposal functions
   - Identical logic, different response messages

4. **Message components (~50 lines each)**
   - MessageBubble vs CompactMessage
   - Same structure, different sizing classes

5. **Quick Reply integration (~20 lines each)**
   - parseQuickReplies → QuickReplyChips
   - Identical integration pattern

## Proposed Solutions

### Option A: Extract Shared Hook (Recommended)

**Pros:** Reusable, testable, maintains component simplicity
**Cons:** Initial refactoring effort
**Effort:** Medium (2 hours)
**Risk:** Low

```typescript
// hooks/useAgentChat.ts
export function useAgentChat(options: AgentChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // ... shared state

  const initializeChat = useCallback(async () => { ... }, []);
  const sendMessage = useCallback(async (message: string) => { ... }, []);
  const confirmProposal = useCallback(async (id: string) => { ... }, []);
  const rejectProposal = useCallback(async (id: string) => { ... }, []);

  return {
    messages, isLoading, sessionId, error,
    initializeChat, sendMessage, confirmProposal, rejectProposal,
  };
}
```

### Option B: Create Shared BaseChat Component

**Pros:** Even more code sharing
**Cons:** Render props or composition complexity
**Effort:** Medium-Large (3 hours)
**Risk:** Medium (composition patterns can be tricky)

### Option C: Keep Separate, Document Divergence

**Pros:** No refactoring needed
**Cons:** Ongoing maintenance burden
**Effort:** None
**Risk:** High (more divergence bugs)

## Recommended Action

**Option A** - Extract shared hook. This provides maximum code reuse while keeping components simple and styling concerns separate.

## Technical Details

**Affected Files:**

- Create: `apps/web/src/hooks/useAgentChat.ts`
- Refactor: `apps/web/src/components/agent/AgentChat.tsx`
- Refactor: `apps/web/src/components/agent/PanelAgentChat.tsx`

**Shared Logic to Extract:**

- State management (messages, loading, session, error)
- initializeChat() with health check and session fetch
- sendMessage() with optimistic UI update
- confirmProposal() and rejectProposal()
- Types (ChatMessage, Proposal, ToolResult)

## Acceptance Criteria

- [ ] Shared hook handles all API communication
- [ ] Both components use shared hook
- [ ] Styling remains component-specific
- [ ] No regression in existing functionality
- [ ] Greeting bug fix from #668 applies to both via shared hook

## Work Log

| Date       | Action                   | Learnings                                        |
| ---------- | ------------------------ | ------------------------------------------------ |
| 2026-01-08 | Created from code review | Identified by code-simplicity-reviewer as P2 DRY |

## Resources

- React custom hooks pattern: https://react.dev/learn/reusing-logic-with-custom-hooks
- Related: #668 (greeting bug only in PanelAgentChat due to divergence)
