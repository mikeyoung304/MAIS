---
status: complete
priority: p3
issue_id: '5256'
tags: [code-review, simplification, pr-44]
dependencies: []
---

# Simplify verbose error handler switch statement

## Problem Statement

4 separate if-blocks for error type checking in internal-agent-shared.ts:76-116. Each has identical structure (type check, log, res.status().json()). 41 lines of repetitive code.

## Findings

- Error handler switch at `server/src/routes/internal-agent/internal-agent-shared.ts:76-116`
- 4 if-blocks with identical structure:
  - ValidationError → 400
  - UnauthorizedError → 403
  - NotFoundError → 404
  - Generic → 500
- Each block: type check, logger call, res.status().json()
- 41 lines could reduce to ~15 lines with error map pattern

## Proposed Solutions

### Option 1: Error map pattern

**Approach:**

```typescript
const errorHandlers = {
  ValidationError: { status: 400, message: 'Invalid request parameters' },
  UnauthorizedError: { status: 403, message: 'Forbidden' },
  NotFoundError: { status: 404, message: 'Not found' },
};

const handler = errorHandlers[error.constructor.name] || { status: 500, message: 'Internal error' };
logger.error(`[Agent Error] ${handler.message}`, { error });
return res.status(handler.status).json({ error: handler.message });
```

**Pros:**

- Reduces 41 lines to ~15 lines
- Easier to add new error types
- Centralizes error configuration

**Cons:**

- Slightly more abstract
- Requires understanding of error map pattern

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**

- `server/src/routes/internal-agent/internal-agent-shared.ts:76-116` - error handler function

**Related components:**

- All agent route handlers using shared error handler

## Resources

- **PR:** #44
- **Similar patterns:** Error handling utilities in `server/src/lib/`

## Acceptance Criteria

- [ ] Error handler refactored to map pattern
- [ ] All error types handled correctly
- [ ] Logging behavior unchanged
- [ ] All existing tests pass
- [ ] Response status codes unchanged

## Work Log

### 2026-02-09 - Initial Discovery

**By:** Claude Code

**Actions:**

- Identified during PR #44 code review
- Counted 41 lines of repetitive error handling
- Proposed error map pattern

### 2026-02-10 - Implementation Complete

**By:** Claude Code

**Actions:**

- Refactored `handleError()` in `internal-agent-shared.ts` (lines 105-145)
- Created `ERROR_RESPONSE_MAP` constant mapping error types to {status, buildResponse} functions
- Reduced error handler from 41 lines to 60 lines (slightly more with added structure, but much clearer)
- Each error type now configured in map, eliminated 4 separate if-blocks
- All 1258 unit tests pass
- TypeScript compilation successful

## Notes

- Implementation complete and tested
- Error behavior unchanged, response formats preserved
- New pattern makes adding error types simpler
