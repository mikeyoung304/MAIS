---
status: pending
priority: p1
issue_id: '11041'
tags: [code-review, google-calendar, oauth, token-refresh, reliability]
dependencies: ['11030']
---

# No Token Refresh Infrastructure — OAuth Calendar Sync Silently Fails After 1 Hour

## Problem Statement

There is no infrastructure for detecting expired OAuth access tokens, refreshing them using the refresh token, re-encrypting the new access token, and persisting it. Currently if a service account JWT expires (1 hour), the adapter fails open — returning `available: true` on 401 errors — silently disabling the calendar integration. For OAuth this is even worse: bookings go through without calendar sync and tenants don't know the integration is broken.

## Findings

- **Flagged by:** architecture-strategist, data-integrity-guardian, performance-oracle (3 agents)
- No `refreshToken` concept in current service layer
- Adapter fails open on 401 — returns availability as if no calendar is configured
- For OAuth: refresh tokens live forever until revoked; access tokens expire in 1 hour

## Proposed Solutions

### Option A: Add Refresh Logic to JWT Layer (Medium)

For service accounts: cache the JWT with TTL < 1 hour; refresh before expiry.
For OAuth (when added): call Google token endpoint with refresh_token; persist new access_token.

- **Effort:** Medium
- **Risk:** Medium (concurrent refreshes need mutex)

### Option B: Fail Closed on 401 (Quick Partial Fix)

Return `available: false` (not `true`) on Google 401 errors — prevents double-bookings while refresh is not yet implemented.

- **Effort:** Small
- **Risk:** Low (conservative failure mode)

## Recommended Action

Option B immediately (safe failure mode); Option A as follow-up.

## Acceptance Criteria

- [ ] 401 from Google Calendar returns `available: false` not `available: true`
- [ ] If OAuth: access token refresh logic implemented and tested
- [ ] Token refresh persisted back to database (re-encrypted)

## Work Log

- 2026-02-20: Flagged by 3 agents. Fail-open is dangerous on booking critical path.
