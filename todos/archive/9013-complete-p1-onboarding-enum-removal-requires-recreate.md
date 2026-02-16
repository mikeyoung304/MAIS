---
status: pending
priority: p1
issue_id: 9013
tags: [code-review, migration, schema]
dependencies: []
---

# OnboardingPhase Enum Removal Requires CREATE/DROP Dance — Not Simple ALTER

## Problem Statement

The plan simplifies OnboardingPhase from 7 values (NOT_STARTED, DISCOVERY, MARKET_RESEARCH, SERVICES, MARKETING, COMPLETED, SKIPPED) to 4 values (NOT_STARTED, BUILDING, COMPLETED, SKIPPED). PostgreSQL CANNOT remove values from an existing enum — `ALTER TYPE ... DROP VALUE` does not exist.

Phase 3 attempts to change the enum definition, but Phase 7 is where the data migration happens. If Phase 3 removes enum values without first migrating the data, the migration will fail.

Additionally, `packages/contracts/src/schemas/onboarding.schema.ts` has ~550 lines of phase-aware discriminated unions, event type schemas (DISCOVERY_STARTED, DISCOVERY_COMPLETED, etc.), and command schemas that ALL reference the old phases. This file is not listed in any phase.

## Findings

- Data Integrity Guardian P1-6: "PostgreSQL cannot remove values from an enum"
- Architecture Strategist P1-05: "OnboardingPhase enum change is a breaking migration without data-first strategy"
- Pattern Recognition P2-6: "Phase 3 enum change and Phase 7 data migration are out of order"

## Proposed Solutions

### Option A: Two-step approach (Recommended)

1. Phase 3: ADD `BUILDING` to existing enum (safe, additive)
2. Phase 3: Do NOT remove old values yet
3. Phase 7: Migrate data (reset intermediate phases to NOT_STARTED)
4. Phase 7: Recreate enum (CREATE new type, ALTER column, DROP old type)

- **Effort:** Medium (custom SQL migration)

### Option B: Move all enum work to Phase 7

- Phase 3 only adds BUILDING, keeps old values
- Phase 7 does full data migration + enum recreation
- **Effort:** Small but delays schema cleanup

## Acceptance Criteria

- [ ] Explicit Prisma migration SQL for enum value removal (not just schema change)
- [ ] Data migration runs BEFORE enum values are removed
- [ ] `packages/contracts/src/schemas/onboarding.schema.ts` updated in Phase 3

## Work Log

| Date       | Action                  | Learnings                                          |
| ---------- | ----------------------- | -------------------------------------------------- |
| 2026-02-12 | Migration safety review | PostgreSQL enum removal requires CREATE/DROP dance |
