---
status: complete
priority: p2
issue_id: '5214'
tags: [code-review, architecture, race-condition, guided-refinement]
dependencies: [5210]
---

# P2: Dispatch Timeouts Not Cleared on Cleanup

## Problem Statement

In `tenant-agent-dispatch.ts`, when the sender is registered and pending messages are dispatched with `setTimeout`, these timeouts are never cleared if the cleanup function is called. This can cause messages to be sent to a stale sender reference.

**Why it matters:** During HMR or fast unmount/remount, messages could be sent to the wrong handler.

## Findings

**Source:** Architecture Strategist Review

**Location:** `apps/web/src/lib/tenant-agent-dispatch.ts:39-48`

**Evidence:**

```typescript
// Current implementation - timeouts not tracked
messages.forEach((msg, i) => {
  setTimeout(() => sender(msg), i * 100); // These timeouts are never cleared
});

// Return cleanup function
return () => {
  registeredSender = null; // Doesn't clear pending timeouts
};
```

**Risk scenario:**

1. Chat initializes, registers sender, has 3 pending messages
2. Timeouts scheduled: 0ms, 100ms, 200ms
3. Chat unmounts at 50ms, cleanup runs, `registeredSender = null`
4. At 100ms, timeout fires, calls stale `sender` closure
5. Either error or message sent to wrong component

## Proposed Solutions

### Option A: Track and Clear Timeouts (Recommended)

**Approach:** Store timeout IDs and clear them on cleanup

```typescript
export function registerAgentSender(sender: MessageSender): () => void {
  registeredSender = sender;
  const timeoutIds: number[] = [];

  if (pendingMessages.length > 0) {
    const messages = [...pendingMessages];
    pendingMessages = [];
    messages.forEach((msg, i) => {
      const id = window.setTimeout(() => sender(msg), i * 100);
      timeoutIds.push(id);
    });
  }

  return () => {
    registeredSender = null;
    timeoutIds.forEach(clearTimeout); // Clear pending sends
  };
}
```

**Pros:** Fixes the race condition correctly
**Cons:** Slightly more complex
**Effort:** Small (15 minutes)
**Risk:** Very Low

### Option B: Use AbortController Pattern

**Approach:** Check if still registered before sending

```typescript
let isActive = true;
messages.forEach((msg, i) => {
  setTimeout(() => {
    if (isActive) sender(msg);
  }, i * 100);
});

return () => {
  registeredSender = null;
  isActive = false; // Pending timeouts become no-ops
};
```

**Pros:** Simple guard, timeouts become no-ops
**Cons:** Timeouts still fire (minor memory/CPU)
**Effort:** Small (10 minutes)
**Risk:** Very Low

## Recommended Action

**APPROVED: Option A - Track and clear timeouts**

Store timeout IDs in array within `registerAgentSender`, clear all on cleanup function.

**Triaged:** 2026-02-04 | **Decision:** Fix | **Rationale:** Correct resource cleanup, prevents stale callbacks

## Technical Details

**Affected Files:**

- `apps/web/src/lib/tenant-agent-dispatch.ts`

**Testing:**

- Add test: "should clear pending timeouts on cleanup"
- Add test: "should not send messages after unregistration"

## Acceptance Criteria

- [ ] Timeout IDs are tracked when scheduling
- [ ] Cleanup function clears all pending timeouts
- [ ] No messages sent after unregistration
- [ ] Unit tests verify cleanup behavior

## Work Log

| Date       | Action                   | Learnings                                   |
| ---------- | ------------------------ | ------------------------------------------- |
| 2026-02-04 | Created from code review | Identified by architecture-strategist agent |

## Resources

- PR: Guided Refinement Integration
