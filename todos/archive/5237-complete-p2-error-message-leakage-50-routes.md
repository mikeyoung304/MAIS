---
status: complete
priority: p2
issue_id: '5237'
tags: [code-review, security, error-handling, enterprise-review]
dependencies: []
---

# Error Message Leakage in ~50 Route Handlers

## Problem Statement

Approximately 50 route handlers return `error.message` directly to clients via `res.json({ error: error.message })`. Internal error messages from Prisma, Stripe, Node.js can leak database schema details, service URLs, and file paths.

**Why it matters:** Information disclosure aids targeted attacks. Prisma errors reveal table/column names. Stripe errors reveal API configuration. Node.js errors reveal dependency versions and file paths.

## Findings

**Source:** Security Sentinel review (PR #42, 2026-02-08)

**Affected files (highest count):**

- `tenant-admin.routes.ts` — 16 instances
- `tenant-admin-scheduling.routes.ts` — 9 instances
- `tenant-admin-segments.routes.ts` — 6 instances
- `tenant-admin-projects.routes.ts` — 6 instances
- `tenant-admin-domains.routes.ts` — 5 instances
- `tenant-admin-webhooks.routes.ts` — 3 instances
- Plus 5 more route files

**Pattern:** Most are 400/404/409 responses from known error types (ValidationError, NotFoundError). The risk is highest in catch-all `catch (error)` blocks where unknown errors leak internal messages.

**Note:** PR #42 already fixed the 3 worst cases (500 responses in agent routes). This todo covers the remaining ~50 instances.

## Proposed Solutions

### Option A: Centralized error handler (Recommended)

- Ensure ALL routes use `next(error)` instead of inline `res.status().json()`
- The existing error-handler middleware already sanitizes errors by type
- **Pros:** Single fix point, consistent behavior
- **Cons:** Need to audit all ~50 catch blocks
- **Effort:** Medium (mechanical but wide-reaching)
- **Risk:** Low (error handler already exists)

### Option B: Error message allowlist

- Create a `SafeError` base class; only safe errors expose their message
- Wrap all business errors (ValidationError, NotFoundError) as SafeError
- Unknown errors get generic message + correlationId
- **Pros:** Granular control, works with both patterns
- **Cons:** More code, need to classify all error types
- **Effort:** Medium-Large
- **Risk:** Low

## Acceptance Criteria

- [ ] Zero instances of raw `error.message` in JSON responses for unknown error types
- [ ] Known error types (ValidationError, NotFoundError) may expose safe messages
- [ ] All 500 responses use generic message + correlationId
- [ ] grep `json.*error\.message` returns only safe patterns

## Work Log

| Date       | Action  | Notes                                 |
| ---------- | ------- | ------------------------------------- |
| 2026-02-08 | Created | Found during enterprise review PR #42 |
