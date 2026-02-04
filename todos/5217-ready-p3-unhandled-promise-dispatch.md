---
status: ready
priority: p3
issue_id: '5217'
tags: [code-review, quality, error-handling, guided-refinement]
dependencies: [5210]
---

# P3: Unhandled Promise in queueAgentMessage

## Problem Statement

In `tenant-agent-dispatch.ts`, when `registeredSender` is available, the returned Promise is not awaited or caught. Errors will be unhandled promise rejections.

**Why it matters:** Unhandled rejections can crash the app or cause silent failures.

## Findings

**Source:** Code Quality Reviewer

**Location:** `apps/web/src/lib/tenant-agent-dispatch.ts:62-68`

**Evidence:**

```typescript
export function queueAgentMessage(message: string): void {
  if (registeredSender) {
    // Promise not handled - errors will be unhandled rejections
    registeredSender(message); // ← Returns Promise<void>, not awaited
  } else {
    pendingMessages.push(message);
  }
}
```

## Proposed Solutions

### Option A: Add Error Logging (Recommended)

**Approach:** Catch and log errors silently

```typescript
export function queueAgentMessage(message: string): void {
  if (registeredSender) {
    registeredSender(message).catch((err) => {
      logger.error('[tenant-agent-dispatch] Failed to send message:', err);
    });
  } else {
    pendingMessages.push(message);
  }
}
```

**Pros:** Simple, non-breaking, errors are logged
**Cons:** Errors are swallowed (but logged)
**Effort:** Trivial (5 minutes)
**Risk:** Very Low

### Option B: Make Function Async

**Approach:** Return the promise to callers

```typescript
export async function queueAgentMessage(message: string): Promise<void> {
  if (registeredSender) {
    return registeredSender(message);
  } else {
    pendingMessages.push(message);
  }
}
```

**Pros:** Proper error propagation
**Cons:** All callers need to handle the promise
**Effort:** Small (15 minutes to update callers)
**Risk:** Low

## Recommended Action

**APPROVED: Option A - Add error logging with .catch()**

Add `.catch()` handler that logs to `logger.error()` with context. Maintains fire-and-forget semantics.

**Triaged:** 2026-02-04 | **Decision:** Fix | **Rationale:** Proper error observability

## Acceptance Criteria

- [ ] Errors from registeredSender are caught
- [ ] Errors are logged with context
- [ ] No unhandled promise rejections

## Work Log

| Date       | Action                   | Learnings                           |
| ---------- | ------------------------ | ----------------------------------- |
| 2026-02-04 | Created from code review | Identified by code-quality reviewer |

## Resources

- PR: Guided Refinement Integration
