---
issue_id: 11042
status: pending
priority: p2
tags: [performance, google-calendar, caching]
effort: Small
---

# P2: OAuth Access Token Fetched on Every Call

## Problem Statement

OAuth access tokens are fetched fresh on every operation at 4 call sites in the Google Calendar adapters. Each token fetch adds a full network RTT to every calendar interaction, degrading booking and availability response times unnecessarily.

## Findings

- `gcal.adapter.ts` and `gcal.jwt.ts` each contain call sites that request a new access token per operation.
- There are 4 total call sites performing fresh token fetches.
- Google OAuth access tokens are valid for 1 hour; re-fetching on every call wastes that validity window entirely.
- Affected files: `server/src/adapters/gcal.adapter.ts`, `server/src/adapters/gcal.jwt.ts`

## Proposed Solutions

Cache access tokens in Redis with a TTL slightly less than 1 hour (e.g., 55 minutes) to account for clock skew and network latency. Key should include `tenantId` for isolation. On cache miss, fetch a new token and store it. On cache hit, return the cached token directly.

Suggested cache key format: `tenant:{tenantId}:gcal:access_token`

## Acceptance Criteria

- [ ] Access token is fetched from Google at most once per hour per tenant.
- [ ] Token is stored in Redis with a TTL of 55 minutes (or configurable value < 3600s).
- [ ] Cache key includes `tenantId` to maintain multi-tenant isolation.
- [ ] All 4 call sites use the cached token path.
- [ ] On token expiry or cache miss, a fresh token is fetched and re-cached.
- [ ] Tests verify cache hit and cache miss paths.

## Work Log

_(empty)_
