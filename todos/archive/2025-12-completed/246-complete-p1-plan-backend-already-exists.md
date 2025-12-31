---
status: complete
priority: p1
issue_id: '246'
tags: [code-review, landing-page, plan, architecture]
dependencies: []
source: 'plan-review-2025-12-04'
---

# TODO-246: Plan Creates Redundant Backend Work - Draft Endpoints Already Exist

## Priority: P1 (Critical - Blocks Implementation)

## Status: Pending

## Source: Plan Review - Landing Page Visual Editor

## Problem Statement

The feature plan (`plans/feat-landing-page-visual-editor.md`) proposes creating 4 new draft endpoints in Phase 3, but these endpoints **already exist and are production-ready** in the backend.

**Why It Matters:**

- Team will waste 1-2 days implementing endpoints that already exist
- Risk of creating divergent API contracts
- Plan is fundamentally out of sync with codebase reality

## Findings

### Evidence of Existing Backend Implementation

**1. Routes exist at `server/src/routes/tenant-admin-landing-page.routes.ts`:**

- `GET /v1/tenant-admin/landing-page/draft` (line 167)
- `PUT /v1/tenant-admin/landing-page/draft` (line 197)
- `POST /v1/tenant-admin/landing-page/publish` (line 242)
- `DELETE /v1/tenant-admin/landing-page/draft` (line 276)

**2. Repository methods exist at `server/src/adapters/prisma/tenant.repository.ts`:**

- `getLandingPageDraft()` (lines 505-540)
- `saveLandingPageDraft()` (lines 544-601)
- `publishLandingPageDraft()` (lines 605-640)
- `discardLandingPageDraft()` (lines 649-677)

**3. Contracts defined at `packages/contracts/src/tenant-admin/landing-page.contract.ts`:**

- Lines 146-227 define all 4 draft endpoints with complete error codes (400, 401, 404, 500)

### Plan vs Reality Mismatch

| Plan Says                                            | Reality                   |
| ---------------------------------------------------- | ------------------------- |
| "Phase 3: Draft System & API Integration (1-2 days)" | Backend already complete  |
| "Add draft endpoints to landing-page.contract.ts"    | Contracts already defined |
| "Implement draft save/load in tenant.repository.ts"  | Repository methods exist  |

## Proposed Solutions

### Option A: Remove Backend Work from Plan (Recommended)

- **Effort:** 1 hour
- **Risk:** Low
- Update plan to state "Backend draft system is production-ready (TODO-202 complete)"
- Change Phase 3 to "Frontend API Integration" only
- **Pros:** Accurate, saves 1-2 days
- **Cons:** None

### Option B: Mark Plan as Outdated, Create New Plan

- **Effort:** 2-3 hours
- **Risk:** Low
- Archive current plan to `plans/archive/`
- Create new plan focused on frontend-only implementation
- **Pros:** Clean slate
- **Cons:** Extra work to recreate good parts of existing plan

## Recommended Action

**Execute Option A:** Edit `plans/feat-landing-page-visual-editor.md` to:

1. Add note at top: "Backend draft system complete - frontend implementation only"
2. Remove Phase 3 backend tasks
3. Update Phase 3 to focus on `useLandingPageEditor` hook integration with existing API

## Acceptance Criteria

- [ ] Plan updated to reflect existing backend implementation
- [ ] Phase 3 revised to frontend-only scope
- [ ] Time estimate reduced by 1-2 days

## Work Log

| Date       | Action  | Notes                                                                                   |
| ---------- | ------- | --------------------------------------------------------------------------------------- |
| 2025-12-04 | Created | Plan review identified backend already exists                                           |
| 2025-12-05 | Closed  | Verified: endpoints at routes.ts:168-304, implementation predates todo (commit 1647a40) |

## Tags

code-review, landing-page, plan, architecture
