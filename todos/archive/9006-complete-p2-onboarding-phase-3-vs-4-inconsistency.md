---
status: pending
priority: p2
issue_id: 9006
tags: [code-review, consistency, plan]
dependencies: []
---

# OnboardingPhase Decision Says "3" but Enum Has 4 Values

## Problem Statement

Two inconsistencies in the OnboardingPhase simplification:

1. **Decision #7** (plan line 61) says "Simplify to 3: NOT_STARTED → BUILDING → COMPLETED" but Phase 3's enum (line 349-356) has 4 values including SKIPPED.

2. **Phase 7 migration** resets phases NOT IN (NOT_STARTED, COMPLETED, SKIPPED). This would reset any tenant in BUILDING state back to NOT_STARTED. But BUILDING is a NEW value added by Phase 3 — could a tenant reach BUILDING before Phase 7 runs? Only if Phases 3-6 deploy before Phase 7.

**Why it matters:** Minor doc inconsistency, but the Phase 7 BUILDING reset could lose onboarding progress.

## Findings

- Plan line 61: "Simplify to 3: NOT_STARTED → BUILDING → COMPLETED"
- Plan line 349-356: `NOT_STARTED | BUILDING | COMPLETED | SKIPPED` (4 values)
- Plan line 693: `WHERE "onboardingPhase" NOT IN ('NOT_STARTED', 'COMPLETED', 'SKIPPED')` — resets BUILDING

## Proposed Solutions

### Option A: Fix decision text and add BUILDING to migration whitelist (Recommended)

- Update Decision #7: "Simplify to 4: NOT_STARTED, BUILDING, COMPLETED, SKIPPED"
- Add BUILDING to Phase 7 migration whitelist
- **Effort:** Tiny

### Option B: Remove BUILDING, use only NOT_STARTED/COMPLETED/SKIPPED

- Simplicity agent suggestion: if agent uses facts + section content for state, enum is redundant
- **Effort:** Small

## Acceptance Criteria

- [ ] Decision table and Phase 3 enum match
- [ ] Phase 7 migration doesn't reset BUILDING tenants

## Work Log

| Date       | Action                                       | Learnings                                   |
| ---------- | -------------------------------------------- | ------------------------------------------- |
| 2026-02-12 | Cross-phase consistency check found mismatch | Decision tables should match implementation |
