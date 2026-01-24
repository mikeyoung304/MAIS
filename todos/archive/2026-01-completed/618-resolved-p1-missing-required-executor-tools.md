---
status: complete
priority: p1
issue_id: 618
tags: [code-review, agent, booking-links, startup-validation, must-fix-now]
dependencies: []
created: 2026-01-05
triaged: 2026-01-05
resolved: 2026-01-05
---

# Booking Link Tools Missing from REQUIRED_EXECUTOR_TOOLS

## Problem Statement

The new booking link tools (`manage_bookable_service`, `manage_working_hours`, `manage_date_overrides`) are NOT listed in `REQUIRED_EXECUTOR_TOOLS` in `executor-registry.ts`. This means server startup validation won't catch if these executors fail to register, potentially causing proposals to confirm but never execute.

## Findings

**Source:** security-sentinel, architecture-strategist

**Evidence:**

The `REQUIRED_EXECUTOR_TOOLS` array in `server/src/agent/proposals/executor-registry.ts` (lines 51-83) includes tools like `upsert_package`, `manage_blackout`, etc., but NOT the new booking link tools.

```typescript
const REQUIRED_EXECUTOR_TOOLS = [
  // Onboarding tools
  'update_onboarding_state',
  'upsert_package',
  // ... other existing tools ...

  // MISSING: Booking link tools
  // 'manage_bookable_service',
  // 'manage_working_hours',
  // 'manage_date_overrides',
] as const;
```

**Risk:** If `registerBookingLinkExecutors()` is not called (e.g., import missing, registration error), proposals will be created and confirmed, but execution will silently fail. Users will see proposals approved but no changes made.

## Proposed Solutions

### Option 1: Add tools to REQUIRED_EXECUTOR_TOOLS (Recommended)

**Pros:** Simple fix, enables startup validation
**Cons:** None
**Effort:** Small (5 minutes)
**Risk:** Very low

```typescript
const REQUIRED_EXECUTOR_TOOLS = [
  // ... existing tools ...

  // Booking link management
  'manage_bookable_service',
  'manage_working_hours',
  'manage_date_overrides',
] as const;
```

### Option 2: Add runtime validation in registerBookingLinkExecutors

**Pros:** Self-documenting at registration site
**Cons:** Doesn't integrate with existing validation system
**Effort:** Small
**Risk:** Very low

## Recommended Action

**TRIAGE RESULT: MUST FIX NOW** (Unanimous 3/3 votes)

**Reviewers:** security-sentinel, architecture-strategist, data-integrity-guardian

**Decision:** Add all 3 booking link tools to REQUIRED_EXECUTOR_TOOLS. Without this, proposals may silently fail to execute.

**Implementation:** Option 1 - Add tools to REQUIRED_EXECUTOR_TOOLS (5-minute fix)

## Technical Details

**Affected Files:**

- `server/src/agent/proposals/executor-registry.ts` (lines 51-83)

**Existing Pattern:**
All other T2 tools are listed in REQUIRED_EXECUTOR_TOOLS with comment groupings.

## Acceptance Criteria

- [x] All 3 booking link tools added to REQUIRED_EXECUTOR_TOOLS
- [x] Server startup validates these executors are registered
- [x] `validateExecutorRegistry()` passes with all booking link executors

## Work Log

| Date       | Action                           | Learnings                                                                  |
| ---------- | -------------------------------- | -------------------------------------------------------------------------- |
| 2026-01-05 | Created during /workflows:review | Identified by security-sentinel and architecture-strategist agents         |
| 2026-01-05 | Resolved via parallel agent      | Added manage_bookable_service, manage_working_hours, manage_date_overrides |

## Resources

- `server/src/agent/proposals/executor-registry.ts`
- PR: Booking Links Phase 0 - commit 1bd733c9
