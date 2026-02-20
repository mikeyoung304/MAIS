---
status: pending
priority: p1
issue_id: '11032'
tags: [code-review, google-calendar, multi-tenant, data-integrity, security]
---

# GoogleCalendarSyncAdapter Uses Global Credentials for All Tenant Event Writes

## Problem Statement

`GoogleCalendarSyncAdapter.createEvent()` and `deleteEvent()` use the global constructor-injected credentials instead of per-tenant configuration. Any tenant who has configured their own Google Calendar will have their booking events written to the platform's global calendar instead of their own. This is a multi-tenant correctness bug — it violates the core tenant isolation requirement.

## Findings

- **Flagged by:** 5 agents (architecture-strategist, agent-native-reviewer, data-integrity-guardian, pattern-recognition-specialist, security-sentinel)
- `server/src/adapters/google-calendar-sync.adapter.ts` — `createEvent()`/`deleteEvent()` use `this.credentials` (global)
- `server/src/adapters/gcal.adapter.ts` — `getFreeBusy()` and `isDateAvailable()` DO accept per-tenant config (correct pattern exists)
- The fix pattern already exists in `gcal.adapter.ts` — pass `tenantConfig` to the sync adapter methods

## Proposed Solutions

### Option A: Pass tenantId to Sync Adapter Methods

Add `tenantId` parameter to `createEvent()` and `deleteEvent()`, look up tenant secrets inside the method.

- **Effort:** Small
- **Risk:** Low

### Option B: Make Sync Adapter Stateless (No Global Credentials)

Remove global credential injection; all methods take `tenantConfig`. Mirrors gcal.adapter.ts pattern.

- **Effort:** Small
- **Risk:** Low (better architecture)

## Recommended Action

Option B — aligns with the existing `gcal.adapter.ts` pattern and removes the global credential footgun.

## Acceptance Criteria

- [ ] `createEvent()` uses per-tenant calendar credentials
- [ ] `deleteEvent()` uses per-tenant calendar credentials
- [ ] Gracefully skips sync if tenant has no calendar configured
- [ ] Existing test coverage updated

## Work Log

- 2026-02-20: Flagged by 5 separate agents. Confirmed multi-tenant correctness bug.
