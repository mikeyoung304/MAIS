---
status: deferred
priority: p3
issue_id: '597'
tags: [code-review, code-quality, error-handling, debugging]
dependencies: []
created_at: 2026-01-02
---

# P3: Inconsistent Error Messages - Same Message for Different Failures

> **Code Quality Review:** Same error message used for two different failure modes, making debugging harder.

## Problem Statement

The same generic error message is used for both "not found" and "access denied" cases.

**Files:**

- `/server/src/agent/feedback/review-queue.ts` (line 234)
- `/server/src/agent/feedback/review-actions.ts` (line 102)

**Evidence:**

```typescript
throw new Error('Trace not found or access denied');
```

**Impact:** Difficult to distinguish between:

- Trace genuinely doesn't exist
- Trace exists but belongs to different tenant
- Other access control failures

## Findings

| Reviewer            | Finding                                   |
| ------------------- | ----------------------------------------- |
| Code Quality Review | P3: Inconsistent error message formatting |

## Proposed Solution

Use distinct error types:

```typescript
// In server/src/lib/errors.ts (if not exists)
export class TraceNotFoundError extends Error {
  constructor(traceId: string) {
    super(`Trace not found: ${traceId}`);
    this.name = 'TraceNotFoundError';
  }
}

export class AccessDeniedError extends Error {
  constructor(resource: string, tenantId: string) {
    super(`Access denied to ${resource} for tenant ${tenantId}`);
    this.name = 'AccessDeniedError';
  }
}

// Usage
const trace = await this.prisma.conversationTrace.findUnique({
  where: { id: traceId },
});
if (!trace) {
  throw new TraceNotFoundError(traceId);
}
if (trace.tenantId !== tenantId) {
  throw new AccessDeniedError('trace', tenantId);
}
```

## Acceptance Criteria

- [ ] Create distinct error classes
- [ ] Update review-queue.ts to use specific errors
- [ ] Update review-actions.ts to use specific errors
- [ ] HTTP layer can map to appropriate status codes

## Work Log

| Date       | Action                         | Learnings                                        |
| ---------- | ------------------------------ | ------------------------------------------------ |
| 2026-01-02 | Created from /workflows:review | Code Quality reviewer identified debugging issue |
