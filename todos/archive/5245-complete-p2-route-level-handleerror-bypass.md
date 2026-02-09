---
status: pending
priority: p2
issue_id: 5245
tags: [code-review, architecture, error-handling]
dependencies: [5242]
---

# Route-Level handleError Bypasses Centralized Error Handler

## Problem Statement

`server/src/routes/tenant-admin-tenant-agent.routes.ts` has a local `handleError` function that catches errors and returns responses directly, bypassing the centralized `error-handler.ts` middleware. This means these routes:

- Don't include `requestId` in error responses
- Don't report to Sentry
- Don't use consistent error response format
- Don't benefit from future improvements to the centralized handler

## Findings

- **Source:** Architecture strategist, security sentinel
- **Location:** `server/src/routes/tenant-admin-tenant-agent.routes.ts`
- **Evidence:** Local `handleError` function catches errors and calls `res.status().json()` directly instead of `next(error)`

## Proposed Solutions

### Option A: Replace local handleError with next(error) (Recommended)

- Remove local `handleError` function
- Replace all `handleError(error, res)` calls with `next(error)`
- Centralized handler takes over all error formatting
- Should be done alongside todo #5242 (ADK dedup) since both modify the same file
- **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] No local `handleError` in tenant-agent routes
- [ ] All errors go through centralized error handler
- [ ] Error responses include `requestId`
- [ ] Non-operational errors reported to Sentry

## Work Log

- 2026-02-08: Created from PR #43 review (6-agent parallel review)
