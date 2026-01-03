---
status: open
priority: p2
issue_id: '590'
tags: [code-review, security, routing, integration]
dependencies: []
created_at: 2026-01-02
---

# P2: Platform Admin Traces Routes Not Wired - Authentication Risk

> **Security Review:** The createPlatformAdminTracesRouter is defined but NOT mounted in routes/index.ts.

## Problem Statement

The `createPlatformAdminTracesRouter` is defined but NOT mounted anywhere.

**File:** `/server/src/routes/platform-admin-traces.routes.ts`

**Evidence:** Searched `platform-admin-traces|PlatformAdminTracesRouter` in routes/index.ts - no matches found.

**Risk:**

1. If routes are inaccessible - wasted code
2. If mounted incorrectly later - could expose ALL tenant traces without authentication

## Findings

| Reviewer        | Finding                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| Security Review | P1: Platform admin traces routes not wired - authentication bypass risk |

## Proposed Solution

Either:

**Option A: Mount with proper auth:**

```typescript
// In routes/index.ts
import { createPlatformAdminTracesRouter } from './platform-admin-traces.routes';

// With platform admin auth middleware
app.use(
  '/v1/platform/admin/traces',
  platformAdminAuthMiddleware,
  createPlatformAdminTracesRouter(prisma)
);
```

**Option B: Delete if not needed:**

```bash
rm server/src/routes/platform-admin-traces.routes.ts
```

**Note:** The routes intentionally allow cross-tenant access for platform-wide visibility. This is by design for platform admins but must be protected with proper authentication.

## Acceptance Criteria

Either:

- [ ] Routes mounted with PLATFORM_ADMIN authentication (Option A)
- [ ] Audit logging added for cross-tenant access

Or:

- [ ] Routes file deleted (Option B)
- [ ] Associated tests removed

## Work Log

| Date       | Action                         | Learnings                                     |
| ---------- | ------------------------------ | --------------------------------------------- |
| 2026-01-02 | Created from /workflows:review | Security reviewer identified unmounted routes |
