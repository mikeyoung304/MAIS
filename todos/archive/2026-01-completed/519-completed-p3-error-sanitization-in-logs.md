---
status: complete
priority: p3
issue_id: '519'
completed_date: '2026-01-01'
tags:
  - code-review
  - security
  - logging
  - phase-5
dependencies: []
---

# Sanitize Error Objects Before Logging

## Problem Statement

The retry utility and orchestrator log full error objects, which could contain sensitive information from Claude API responses (API keys in error context, internal error details, etc.).

**Why it matters:** Logs are often aggregated and may be accessible to broader teams. Sensitive data in logs could be exposed.

## Findings

**Source:** Security Review Agent

**Locations:**

- `/Users/mikeyoung/CODING/MAIS/server/src/agent/utils/retry.ts` (lines 144-165)
- `/Users/mikeyoung/CODING/MAIS/server/src/agent/orchestrator/orchestrator.ts` (lines 740-741)

**Evidence:**

```typescript
// retry.ts:144
logger.warn(
  { error, operationName, attempt }, // Full error object logged
  'Non-retryable error encountered, not retrying'
);

// orchestrator.ts:740
logger.error({ error, tenantId, sessionId }, 'Claude API call failed after retries');
```

**Note:** Error messages returned to clients ARE properly sanitized (generic messages shown). This is only about internal logs.

## Proposed Solutions

### Solution 1: Extract Safe Fields Only (Recommended)

**Description:** Only log error message and status, not full object

```typescript
const safeError = {
  message: error instanceof Error ? error.message : String(error),
  status: (error as any)?.status,
  code: (error as any)?.code,
};
logger.error({ error: safeError, tenantId, sessionId }, 'Claude API call failed');
```

**Pros:**

- Removes potentially sensitive nested data
- Keeps useful debugging info

**Cons:**

- May lose stack traces for debugging

**Effort:** Small (30 min)
**Risk:** Low

### Solution 2: Use Error Serializer in Logger Config

**Description:** Configure pino to sanitize errors globally

```typescript
const logger = pino({
  serializers: {
    error: (err) => ({
      message: err.message,
      name: err.name,
      code: err.code,
    }),
  },
});
```

**Pros:**

- Consistent across all logging
- Single place to maintain

**Cons:**

- Affects all error logging, may hide useful info

**Effort:** Small (1 hour)
**Risk:** Low

## Recommended Action

Implemented Solution 1 with a dedicated `sanitizeError()` helper.

## Technical Details

**Affected files:**

- `server/src/agent/utils/retry.ts`
- `server/src/agent/orchestrator/orchestrator.ts`
- Optionally: `server/src/lib/core/logger.ts`

## Acceptance Criteria

- [x] Error objects logged without full nested content
- [x] Error messages and status codes still visible in logs
- [x] Stack traces available in development mode
- [x] No sensitive data in production logs

## Work Log

| Date       | Action                                                                 | Learnings                                                         |
| ---------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 2025-12-31 | Created from Phase 5 code review                                       | Error leakage in logs                                             |
| 2026-01-01 | Implemented sanitizeError() helper and updated all agent error logging | Existing helper was already in place, extended to all agent files |

## Implementation Summary

Created `sanitizeError()` helper at `server/src/lib/core/error-sanitizer.ts` that extracts only safe fields:

- `message`: Error message string
- `name`: Error class name
- `code`: Error code (if present)
- `status`: HTTP status (if present)
- `type`: Error type (if present)
- `stack`: Only included in development mode (NODE_ENV === 'development')

Updated all error logging in the agent module to use `sanitizeError()`:

- `server/src/agent/utils/retry.ts` - 3 locations
- `server/src/agent/orchestrator/base-orchestrator.ts` - 2 locations
- `server/src/agent/orchestrator/admin-orchestrator.ts` - 1 location
- `server/src/agent/customer/customer-tools.ts` - 5 locations
- `server/src/agent/tools/utils.ts` - 1 location (handleToolError helper)
- `server/src/agent/tools/read-tools.ts` - 14 locations
- `server/src/agent/onboarding/state-machine.ts` - 1 location
- `server/src/agent/onboarding/event-sourcing.ts` - 1 location
- `server/src/agent/onboarding/advisor-memory.service.ts` - 1 location
- `server/src/agent/errors/agent-error.ts` - 1 location
- `server/src/agent/context/context-builder.ts` - 1 location
- `server/src/agent/audit/audit.service.ts` - 1 location (was already using it for batch flush, added for write log)

## Resources

- [Phase 5 Security Review](internal)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
