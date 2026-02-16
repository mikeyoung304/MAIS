---
status: pending
priority: p2
issue_id: 9016
tags: [code-review, migration, data-loss]
dependencies: [9013]
---

# Phase 7 Migration Resets BUILDING Tenants to NOT_STARTED

## Problem Statement

Phase 7 migration step 0b runs:

```sql
UPDATE "Tenant" SET "onboardingPhase" = 'NOT_STARTED'
WHERE "onboardingPhase" NOT IN ('NOT_STARTED', 'COMPLETED', 'SKIPPED')
```

This does NOT exclude `BUILDING` (added in Phase 3). Any tenant actively in BUILDING phase when Phase 7 deploys will be reset to NOT_STARTED, losing their onboarding progress.

## Findings

- Pattern Recognition P1-2: SQL written against OLD enum, doesn't account for Phase 3's new BUILDING value
- Data migration was designed before Phase 3 added BUILDING

## Proposed Solutions

### Option A: Add BUILDING to exclusion list (Recommended)

```sql
WHERE "onboardingPhase" NOT IN ('NOT_STARTED', 'BUILDING', 'COMPLETED', 'SKIPPED')
```

- **Effort:** Tiny — one word change

## Acceptance Criteria

- [ ] Phase 7 migration SQL excludes BUILDING from reset
- [ ] Active onboarding tenants retain their progress

## Work Log

| Date       | Action                        | Learnings                                                           |
| ---------- | ----------------------------- | ------------------------------------------------------------------- |
| 2026-02-12 | Cross-phase consistency check | Migration SQL must account for ALL enum values at time of execution |
