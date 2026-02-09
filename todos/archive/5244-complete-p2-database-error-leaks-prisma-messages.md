---
status: pending
priority: p2
issue_id: 5244
tags: [code-review, security, error-handling]
dependencies: []
---

# DatabaseError Leaks Prisma Messages to Client

## Problem Statement

`DatabaseError` is defined with `isOperational: true`, which means the centralized error handler returns its message directly to the client. Prisma error messages can contain internal details like table names, column names, and constraint names that shouldn't be exposed.

## Findings

- **Source:** Security sentinel, TypeScript reviewer
- **Location:** `server/src/lib/errors/base.ts:57-68`
- **Evidence:** `DatabaseError` constructor passes `isOperational: true` to `AppError`. The error handler returns `err.message` for operational errors without sanitization.

## Proposed Solutions

### Option A: Change DatabaseError to non-operational (Recommended)

- Set `isOperational: false` so the centralized handler returns generic "An unexpected error occurred"
- Log full details server-side for debugging
- Sentry captures the full error for investigation
- **Effort:** Small (1-line change) | **Risk:** Low

### Option B: Sanitize message in DatabaseError constructor

- Override constructor to replace Prisma-specific patterns
- Keep `isOperational: true` but with safe message
- **Effort:** Medium | **Risk:** Medium (regex may miss patterns)

## Acceptance Criteria

- [ ] Prisma table/column names not visible in API responses
- [ ] Full error details logged server-side
- [ ] Sentry captures original error

## Work Log

- 2026-02-08: Created from PR #43 review (6-agent parallel review)
