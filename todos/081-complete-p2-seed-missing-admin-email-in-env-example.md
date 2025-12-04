---
status: complete
priority: p2
issue_id: '081'
tags: [dx, code-review, documentation, environment]
dependencies: []
---

# P2: ADMIN_EMAIL Missing from .env.example

## Problem Statement

The `.env.example` documents `ADMIN_DEFAULT_PASSWORD` but is **missing `ADMIN_EMAIL`**, which is required by the platform seed. Developers copying `.env.example` get a runtime error.

**Why it matters:**

- Poor developer experience (undocumented required variable)
- Runtime error when running `db:seed:production` or `db:seed:dev`
- Violates "documentation as code" principle

## Findings

**Location:** `server/.env.example`

Documents `ADMIN_DEFAULT_PASSWORD` but missing `ADMIN_EMAIL`.

**Error when missing:**

```
Error: ADMIN_EMAIL environment variable is required for platform seed.
Set it to the platform admin email address.
```

## Proposed Solutions

### Solution A: Add ADMIN_EMAIL to .env.example (Recommended)

**Pros:** Simple, fixes the issue
**Cons:** None
**Effort:** Small (5 min)
**Risk:** None

Add to `.env.example`:

```bash
# Platform Admin (required for db:seed:production and db:seed:dev)
ADMIN_EMAIL=admin@example.com
ADMIN_DEFAULT_PASSWORD=ChangeThisToAStrongPassword123!
ADMIN_NAME=Platform Admin
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `server/.env.example`

## Acceptance Criteria

- [ ] `ADMIN_EMAIL` documented in `.env.example`
- [ ] `ADMIN_NAME` documented (optional but helpful)
- [ ] Clear comments explaining usage
- [ ] New developers can run seed without confusion

## Work Log

| Date       | Action                   | Learnings                      |
| ---------- | ------------------------ | ------------------------------ |
| 2025-11-29 | Created from code review | Document all required env vars |

## Resources

- **Code Review:** Seed system refactoring review
- **File:** `server/.env.example`
