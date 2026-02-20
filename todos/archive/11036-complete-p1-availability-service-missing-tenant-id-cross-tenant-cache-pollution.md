---
status: pending
priority: p1
issue_id: '11036'
tags: [code-review, google-calendar, multi-tenant, security, caching, data-integrity]
---

# AvailabilityService Missing tenantId — Cross-Tenant Cache Pollution

## Problem Statement

`AvailabilityService.checkAvailability()` calls `this.calendarProvider.isDateAvailable(date)` without passing `tenantId`. All tenants share the same cache entry and query the same global calendar. A date marked busy for one tenant will appear busy for all tenants. This is both a multi-tenant security violation and a correctness bug.

## Findings

- **Flagged by:** performance-oracle
- `server/src/services/availability.service.ts` line ~55: `this.calendarProvider.isDateAvailable(date)` — missing `tenantId`
- Cache keys don't include `tenantId` — violates CLAUDE.md security rule #3
- Fix: pass `tenantId` to the method; include `tenantId` in all cache keys

## Proposed Solutions

### Option A: Pass tenantId Through (15 min)

Update `checkAvailability(date, tenantId)` → `calendarProvider.isDateAvailable(date, tenantId)`. Update cache key to `tenant:${tenantId}:availability:${date}`.

- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] `checkAvailability` passes `tenantId` to calendar provider
- [ ] Cache keys include `tenantId`
- [ ] Multi-tenant test: tenant A's busy date doesn't affect tenant B's availability

## Work Log

- 2026-02-20: Flagged by performance-oracle. Violates CLAUDE.md multi-tenant security rules.
