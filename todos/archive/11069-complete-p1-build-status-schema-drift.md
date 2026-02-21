---
status: pending
priority: p1
issue_id: '11069'
tags: [code-review, typescript, data-integrity, contracts]
pr: 68
---

# BuildStatusSchema / BUILD_STATUS Drift — SCRAPING (F-005)

## Problem Statement

`BuildStatusSchema` includes `SCRAPING` as valid status but service-level `BUILD_STATUS` constant omits it. Pipeline never emits SCRAPING. buildStatus stored as free TEXT with no CHECK constraint.

## Findings

- **Agents:** kieran-typescript, architecture-strategist, data-integrity-guardian (3 agents)
- **Location:** `packages/contracts/src/schemas/onboarding.schema.ts:49` vs `server/src/services/background-build.service.ts:24-31`
- **Impact:** Contract/service divergence, invalid values produce incorrect UI

## Proposed Solution

1. Remove SCRAPING from BuildStatusSchema
2. Consider PostgreSQL CHECK constraint or Prisma enum for buildStatus

## Effort

Small (< 30 min)

## Acceptance Criteria

- [ ] SCRAPING removed from BuildStatusSchema
- [ ] Contract and service BUILD_STATUS values match exactly
- [ ] Test: verify all emitted statuses are in contract
