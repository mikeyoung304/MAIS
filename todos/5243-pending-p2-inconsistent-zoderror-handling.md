---
status: pending
priority: p2
issue_id: 5243
tags: [code-review, architecture, error-handling]
dependencies: []
---

# Inconsistent ZodError Handling Across Routes

## Problem Statement

Some routes manually catch `ZodError` and wrap it as `BadRequestError` before calling `next(error)`, while the centralized `error-handler.ts` already handles `ZodError` natively. This creates two different error response formats for the same error type:

- Manual: `{ error: "Validation failed", details: issues }` or `BadRequestError(issues.join(', '))`
- Centralized: `{ status: "error", error: "VALIDATION_ERROR", message: issues.join(', ') }`

## Findings

- **Source:** TypeScript reviewer, code-simplicity-reviewer
- **Location:** `server/src/routes/tenant-admin.routes.ts` (lines 548, 595, 839, 916, 1003, 1130, 1172)
- **Evidence:** 7 manual ZodError catch blocks that could be removed now that the centralized handler exists

## Proposed Solutions

### Option A: Remove manual catches, rely on centralized handler (Recommended)

- Remove all `if (error instanceof ZodError)` catch blocks in routes
- Let ZodErrors propagate to the centralized handler
- Response format becomes consistent: `{ status, statusCode, error, message, requestId }`
- **Effort:** Small | **Risk:** Low (API response format changes slightly for these endpoints)

### Option B: Keep manual catches for backward compatibility

- Frontend may depend on the current format (e.g., `details` field)
- Add a format flag to centralized handler to match legacy format
- **Effort:** Medium | **Risk:** Low

## Acceptance Criteria

- [ ] All ZodError responses use consistent format
- [ ] Frontend handles the (possibly changed) error format
- [ ] No regressions in validation error display

## Work Log

- 2026-02-08: Created from PR #43 review (6-agent parallel review)
