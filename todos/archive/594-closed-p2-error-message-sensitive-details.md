---
status: closed
priority: p2
issue_id: '594'
tags: [code-review, security, error-handling, logging]
dependencies: []
created_at: 2026-01-02
triage_notes: 'FIXED: flagReason now uses generic message "Evaluation failed - see logs for details". Sensitive error details logged separately.'
closed_at: '2026-01-26'
---

# P2: Error Message in flagReason May Leak Sensitive Details

> **Security Review:** The caught error's message is stored directly in flagReason, potentially exposing internal details.

## Problem Statement

Error messages are stored directly in the database `flagReason` field without sanitization.

**File:** `/server/src/agent/evals/pipeline.ts` (line 356)

**Evidence:**

```typescript
flagReason: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
```

**Risk:** Error messages from Anthropic SDK, database, or other services may contain:

- API endpoint URLs
- Partial request data
- Internal system paths
- Rate limit details revealing usage patterns

## Findings

| Reviewer        | Finding                                                    |
| --------------- | ---------------------------------------------------------- |
| Security Review | P1: Error message in flagReason may leak sensitive details |
| Security Review | P2: ANTHROPIC_API_KEY exposure risk in error stack         |

## Proposed Solution

Use generic flag reason and log details separately:

```typescript
try {
  await this.evaluateTrace(traceId);
} catch (error) {
  // Log full error internally (already sanitized via sanitizeError)
  logger.error({ error: sanitizeError(error), traceId }, 'Evaluation failed');

  // Store generic reason in database
  await this.prisma.conversationTrace.update({
    where: { id: traceId },
    data: {
      flagged: true,
      flagReason: 'Evaluation failed - see logs for details',
    },
  });
}
```

Also add API key scrubbing to error sanitizer:

```typescript
// In error-sanitizer.ts
function sanitizeError(error: unknown): SanitizedError {
  // ... existing logic ...
  if (result.message) {
    result.message = result.message
      .replace(/sk-[a-zA-Z0-9-]+/g, '[API_KEY]')
      .replace(/pk_[a-zA-Z0-9_]+/g, '[API_KEY]');
  }
}
```

## Acceptance Criteria

- [ ] flagReason uses generic message
- [ ] Error details logged separately (sanitized)
- [ ] API key pattern added to error sanitizer
- [ ] Test verifies no sensitive data in flagReason

## Work Log

| Date       | Action                         | Learnings                                       |
| ---------- | ------------------------------ | ----------------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Security reviewer identified error message leak |
