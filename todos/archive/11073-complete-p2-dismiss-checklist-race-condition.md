---
status: pending
priority: p2
issue_id: '11073'
tags: [code-review, data-integrity]
pr: 68
---

# F-009: dismissChecklistItem Read-Then-Write Race Condition

## Problem Statement

The `dismissChecklistItem` method uses a read-then-write pattern that is vulnerable to race conditions. If two concurrent requests dismiss different checklist items, one dismissal can be lost because the second read happens before the first write completes.

## Findings

- **Agents:** 3 agents flagged this issue
- **Location:** `server/src/services/tenant-onboarding.service.ts:382-405`
- **Impact:** Checklist item dismissals can be silently lost under concurrent requests. Users may see previously dismissed items reappear, causing confusion and degraded UX.

## Proposed Solution

Replace the read-then-write pattern with Prisma's atomic JSON push operation to ensure concurrent dismissals do not overwrite each other. Use `prisma.tenant.update` with a JSON path append instead of reading the full array, modifying it in JS, and writing it back.

## Effort

Small

## Acceptance Criteria

- [ ] `dismissChecklistItem` uses an atomic database operation (e.g., Prisma JSON push or a raw SQL `jsonb_set`/`array_append`)
- [ ] Concurrent dismissal of different items does not cause data loss
- [ ] Existing tests pass; add a test verifying concurrent dismissals preserve both items
