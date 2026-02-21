---
status: pending
priority: p2
issue_id: '11075'
tags: [code-review, security, performance]
pr: 68
---

# F-011: Build Retry Has No Rate Limiting or Max Retry Count

## Problem Statement

The build retry endpoint allows unlimited retries with no rate limiting or maximum retry count. A malicious or buggy client can trigger unlimited LLM calls, burning API credits and degrading performance for other tenants.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `server/src/routes/tenant-admin-onboarding.routes.ts:412-437`
- **Impact:** Unlimited retries can exhaust LLM API quotas and credits, cause resource starvation for other tenants, and mask underlying build failures that should be investigated rather than retried indefinitely.

## Proposed Solution

1. Add a rate limiter to the retry endpoint (3 retries per hour per tenant).
2. Track `buildRetryCount` on the onboarding record.
3. Set a maximum retry cap (e.g., 5 total retries). After the cap, return a 429 or 400 with instructions to contact support.

## Effort

Small

## Acceptance Criteria

- [ ] Rate limiter applied to the retry endpoint (3/hour/tenant)
- [ ] `buildRetryCount` tracked on the onboarding record
- [ ] Maximum retry cap enforced (e.g., 5 total); excess retries return an appropriate error
- [ ] Tests verify rate limiting and cap behavior
