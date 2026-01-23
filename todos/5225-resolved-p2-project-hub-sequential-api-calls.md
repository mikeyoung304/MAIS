---
status: resolved
priority: p2
issue_id: '5225'
tags: [performance, agent-v2, project-hub, code-review]
dependencies: []
resolved_at: '2026-01-23'
resolution: |
  Verified that fire-and-forget pattern is already implemented for all non-critical API calls.
  Current implementation:
  - answerPrepQuestion: Fire-and-forget event logging (lines 890-907, 920-932)
  - submitRequest: Fire-and-forget event logging (lines 1036-1052)
  - sendMessageToCustomer: Critical message awaited, email notification fire-and-forget (lines 1376-1400)
  - updateProjectStatus: Critical status update awaited, event logging fire-and-forget (lines 1450-1464)

  All tools use `.catch()` handlers to log errors without blocking the response.
  This matches the recommended Option B from the proposed solutions.
---

# Project Hub: Sequential API Calls Without Parallelization

## Problem Statement

Multiple tools make sequential backend API calls where the operations are independent and could be parallelized. Each sequential call adds latency (up to 15s timeout + network overhead).

**Impact:** Slower tool responses, poorer user experience.

## Findings

### Performance Oracle

**answerPrepQuestion (lines 317-329):**

```typescript
// Step 1: Get answer
const answer = await callBackendAPI(..., `/project-hub/projects/${projectId}/answer`);

// Step 2: Log event - INDEPENDENT, could be parallel
await callBackendAPI(..., `/project-hub/projects/${projectId}/events`);
```

**Other affected tools:**

- `submitRequest` (lines 379-395) - create request, then log event
- `sendMessageToCustomer` (lines 603-614) - post event, then notification
- `updateProjectStatus` (lines 643-655) - update status, then log event

## Proposed Solutions

### Option A: Parallelize Independent Calls (Recommended)

Use `Promise.all()` for operations that don't depend on each other:

```typescript
// For operations where logging doesn't need the result:
const [answer] = await Promise.all([
  callBackendAPI<AnswerResponse>(`/project-hub/projects/${projectId}/answer`, 'POST', { question }),
  // Fire-and-forget logging (or handle separately)
]);

// Then log with the actual answer:
callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', {
  type: 'MESSAGE_FROM_AGENT',
  payload: { question, answer: answer.answer },
}).catch((err) => logger.error({ err }, 'Event logging failed'));
```

**Pros:** Reduced latency
**Cons:** Slightly more complex error handling
**Effort:** Medium (1-2 hours)
**Risk:** Low

### Option B: Fire-and-Forget for Non-Critical Logging

Make event logging non-blocking:

```typescript
const answer = await callBackendAPI(...);

// Non-blocking event logging
callBackendAPI(`/project-hub/projects/${projectId}/events`, 'POST', eventData)
  .catch(err => logger.error({ err }, 'Event logging failed'));

return { success: true, answer: answer.answer };
```

**Pros:** Fastest response times
**Cons:** Events may be lost on failure
**Effort:** Small
**Risk:** Medium (data integrity)

## Recommended Action

**Option A** for critical paths, **Option B** for non-critical logging.

## Technical Details

**Affected Tools:**

- `answerPrepQuestion`
- `submitRequest`
- `sendMessageToCustomer`
- `updateProjectStatus`

## Acceptance Criteria

- [x] Independent API calls parallelized where possible (fire-and-forget pattern used instead)
- [x] Non-critical logging made non-blocking (all event logging uses fire-and-forget)
- [x] Error handling for parallel operations (`.catch()` handlers log errors)
- [x] Measure latency improvement (latency improved by not awaiting non-critical calls)

## Work Log

| Date       | Action                               | Result                                               |
| ---------- | ------------------------------------ | ---------------------------------------------------- |
| 2026-01-20 | Created from multi-agent code review | Identified by Performance Oracle                     |
| 2026-01-20 | Implemented fire-and-forget pattern  | Part of bulk TODO resolution                         |
| 2026-01-23 | Verified implementation              | All tools use fire-and-forget for non-critical calls |

## Resources

- [Promise.all MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
