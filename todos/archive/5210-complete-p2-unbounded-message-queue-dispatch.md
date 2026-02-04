---
status: complete
priority: p2
issue_id: '5210'
tags: [code-review, security, performance, guided-refinement]
dependencies: []
---

# P2: Unbounded Message Queue in Dispatch System

## Problem Statement

The `pendingMessages` array in `tenant-agent-dispatch.ts` has no size limit. If `queueAgentMessage()` is called repeatedly before the sender is registered, messages accumulate indefinitely, potentially causing memory exhaustion or UI hangs.

**Why it matters:** A malicious script (via XSS or compromised dependency) could flood this queue with thousands of messages, causing DoS through memory exhaustion or degraded UX from message flood.

## Findings

**Source:** Security Sentinel Agent Review

**Location:** `apps/web/src/lib/tenant-agent-dispatch.ts:24, 67`

**Evidence:**

```typescript
// Line 24
let pendingMessages: string[] = [];

// Line 67
pendingMessages.push(message);
```

**Attack vector:**

1. Attacker gains script execution (XSS elsewhere)
2. Loops calling `queueAgentMessage()` thousands of times
3. When chat initializes, all messages fire with 100ms delays
4. UI becomes unresponsive, memory spikes

## Proposed Solutions

### Option A: Add Maximum Queue Size (Recommended)

**Approach:** Cap the queue at 10-20 messages, dropping oldest on overflow

```typescript
const MAX_PENDING_MESSAGES = 20;

export function queueAgentMessage(message: string): void {
  if (registeredSender) {
    registeredSender(message);
  } else {
    if (pendingMessages.length >= MAX_PENDING_MESSAGES) {
      pendingMessages.shift(); // Drop oldest
      logger.warn('[tenant-agent-dispatch] Message queue full, dropped oldest');
    }
    pendingMessages.push(message);
  }
}
```

**Pros:** Simple, effective, maintains FIFO order
**Cons:** Could drop legitimate messages (unlikely - queue normally 0-1 items)
**Effort:** Small (15 minutes)
**Risk:** Very Low

### Option B: Replace Dispatch with Zustand Subscription

**Approach:** Remove the dispatch module entirely, use Zustand store subscription

**Pros:** Eliminates module-level state, better architecture
**Cons:** More changes, needs to verify edge cases
**Effort:** Medium (1-2 hours)
**Risk:** Low

## Recommended Action

**APPROVED: Option A - Add maximum queue size**

Implement with MAX_PENDING_MESSAGES = 20 and logger.warn on overflow. Quality-first: include the warning log for observability.

**Triaged:** 2026-02-04 | **Decision:** Fix | **Rationale:** Defense-in-depth, prevents potential DoS

## Technical Details

**Affected Files:**

- `apps/web/src/lib/tenant-agent-dispatch.ts`

**Testing:**

- Add test: "should cap queue at MAX_PENDING_MESSAGES"
- Add test: "should drop oldest message when queue is full"

## Acceptance Criteria

- [ ] Queue size is capped at a reasonable maximum (20)
- [ ] Oldest messages are dropped when queue is full
- [ ] Warning is logged when messages are dropped
- [ ] Unit test verifies queue cap behavior

## Work Log

| Date       | Action                   | Learnings                             |
| ---------- | ------------------------ | ------------------------------------- |
| 2026-02-04 | Created from code review | Identified by security-sentinel agent |

## Resources

- PR: Guided Refinement Integration
- Related: Code Simplicity Review recommends removing dispatch module entirely
