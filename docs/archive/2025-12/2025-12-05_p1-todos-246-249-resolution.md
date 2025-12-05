# P1 Todos 246-249: Resolution & Verification Plan

## Overview

This plan addresses 4 P1 pending todos (246-249) discovered during a plan review of the landing page visual editor feature. **Critical finding:** All 4 issues have already been resolved in the codebase—the todos are stale and need closure.

**Core Action:** Verify implementations and close todos with evidence.

**Scope:** 1-2 hours verification + documentation

---

## Executive Summary

| Todo | Issue | Status | Evidence |
|------|-------|--------|----------|
| **246** | Plan specifies redundant backend work | ✅ RESOLVED | Backend complete at `tenant-admin-landing-page.routes.ts:168-304` |
| **247** | Hook missing batching/rollback | ✅ RESOLVED | Full implementation at `useLandingPageEditor.ts:147-557` |
| **248** | Missing EditableAccommodationSection | ✅ RESOLVED | Component at `EditableAccommodationSection.tsx:1-182` |
| **249** | No rate limiting on draft endpoints | ✅ RESOLVED | `draftAutosaveLimiter` at `rateLimiter.ts:133-147` |

---

## Problem Statement

The todos were created on 2025-12-04 during a plan review of `plans/feat-landing-page-visual-editor.md`. However, since that review:

1. The landing page editor feature was **fully implemented** (commit `1647a40`)
2. The `useLandingPageEditor` hook was **enhanced with localStorage recovery** (commit `b4598f8`)
3. Rate limiting was **added to all draft endpoints**

The plan vs codebase is now **out of sync in the opposite direction**—the code is ahead of what todos expected.

---

## Detailed Findings

### TODO-246: Backend Already Exists

**Todo Claims:** Plan proposes creating 4 draft endpoints that don't exist
**Reality:** All 4 endpoints are production-ready

| Endpoint | Location | Lines |
|----------|----------|-------|
| `GET /draft` | `server/src/routes/tenant-admin-landing-page.routes.ts` | 168-186 |
| `PUT /draft` | Same file | 201-234 |
| `POST /publish` | Same file | 249-272 |
| `DELETE /draft` | Same file | 286-304 |

**Contracts:** Defined at `packages/contracts/src/tenant-admin/landing-page.contract.ts:146-227`

**Repository Methods:** `server/src/adapters/prisma/tenant.repository.ts:505-677`

---

### TODO-247: Hook Has Full Batching/Rollback

**Todo Claims:** Hook is "dangerously oversimplified" without race condition prevention
**Reality:** Hook explicitly copies `useVisualEditor` patterns (line 11-12 comment)

**Critical Infrastructure Present:**

```typescript
// useLandingPageEditor.ts lines 147-153
const saveTimeout = useRef<NodeJS.Timeout | null>(null);
const pendingChanges = useRef<Partial<LandingPageConfig>>({});
const originalConfig = useRef<LandingPageConfig | null>(null);
const saveInProgress = useRef<boolean>(false);
```

**Additional Features Beyond Todo Requirements:**
- localStorage recovery (lines 76-111)
- Tab blur/close flush (lines 513-536)
- Performance monitoring (lines 277-285)
- Proper cleanup on unmount (lines 502-511)

---

### TODO-248: Accommodation Section Exists

**Todo Claims:** Plan lists 7 sections but omits `EditableAccommodationSection`
**Reality:** Component exists with all required features

**Location:** `client/src/features/tenant-admin/landing-page-editor/sections/EditableAccommodationSection.tsx` (182 lines)

**Features Implemented:**
- Headline & description editing (lines 80-99)
- Highlights array with add/remove (lines 101-140, max 8)
- CTA URL input with validation (lines 142-156)
- CTA button text editing (lines 165-173)
- Image placeholder (lines 56-76)

**Exported in Index:** `sections/index.ts:10`

**Used in Main Component:** `LandingPageEditor.tsx:186`

---

### TODO-249: Rate Limiting Applied

**Todo Claims:** Draft endpoints have no rate limiting (DoS vulnerability)
**Reality:** `draftAutosaveLimiter` exists and is applied

**Rate Limiter Definition:** `server/src/middleware/rateLimiter.ts:133-147`

```typescript
export const draftAutosaveLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'test' ? 500 : 120, // 2/sec
  keyGenerator: (_req, res) => res.locals.tenantAuth?.tenantId || normalizeIp(_req.ip),
  skip: (_req, res) => !res.locals.tenantAuth,
});
```

**Applied to Routes:**
- `PUT /draft` - line 201
- `POST /publish` - line 249
- `DELETE /draft` - line 286

---

## Proposed Solution

### Phase 1: Verification (30 min)

Run verification commands to confirm implementations:

```bash
# 1. Verify rate limiter exists
grep -n "draftAutosaveLimiter" server/src/middleware/rateLimiter.ts

# 2. Verify rate limiter applied to routes
grep -n "draftAutosaveLimiter" server/src/routes/tenant-admin-landing-page.routes.ts

# 3. Verify accommodation component exists
ls -la client/src/features/tenant-admin/landing-page-editor/sections/EditableAccommodationSection.tsx

# 4. Verify hook has refs
grep -n "saveTimeout\|pendingChanges\|originalConfig\|saveInProgress" \
  client/src/features/tenant-admin/landing-page-editor/hooks/useLandingPageEditor.ts

# 5. Run tests to ensure nothing broken
npm test -- --grep "landing-page"
npm run test:e2e -- e2e/tests/landing-page-editor.spec.ts
```

### Phase 2: Close Todos (30 min)

Update each todo file with resolution evidence:

#### todos/246-pending-p1-plan-backend-already-exists.md
- Change `status: pending` → `status: complete`
- Add work log entry with evidence paths
- Note: "Backend was already complete at time of todo creation"

#### todos/247-pending-p1-hook-missing-batching-rollback.md
- Change `status: pending` → `status: complete`
- Add work log entry citing `useLandingPageEditor.ts:147-557`
- Note: "Hook implements full patterns from useVisualEditor"

#### todos/248-pending-p1-missing-accommodation-section.md
- Change `status: pending` → `status: complete`
- Add work log entry citing component path
- Note: "Component exists at EditableAccommodationSection.tsx"

#### todos/249-pending-p1-rate-limiting-draft-endpoints.md
- Change `status: pending` → `status: complete`
- Add work log entry citing rateLimiter.ts
- Note: "draftAutosaveLimiter applied to all 3 endpoints"

### Phase 3: Update Plan File (30 min)

Update `plans/feat-landing-page-visual-editor.md` to reflect reality:

1. Add header note: "✅ IMPLEMENTATION COMPLETE - All phases delivered"
2. Mark all phases as complete with dates
3. Remove outdated backend tasks from Phase 3
4. Add "Lessons Learned" section about plan vs implementation drift

---

## Acceptance Criteria

- [ ] All 4 verification commands pass
- [ ] Landing page E2E tests pass
- [ ] Todo 246 status changed to `complete`
- [ ] Todo 247 status changed to `complete`
- [ ] Todo 248 status changed to `complete`
- [ ] Todo 249 status changed to `complete`
- [ ] Plan file updated with completion status

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tests fail during verification | Low | Medium | Run full test suite first |
| Rate limiter not actually applied | Low | High | grep routes file to confirm |
| Accommodation section incomplete | Low | Medium | Manual UI verification |

---

## Decision: Why Close Instead of Implement?

**Option A: Implement What Todos Describe** (NOT recommended)
- Todos describe work that already exists
- Would create duplicate/conflicting code
- Waste of 6-10 hours

**Option B: Close Todos With Evidence** (RECOMMENDED)
- Work is already done
- Just needs verification and documentation
- 1-2 hours total

**Decision:** Option B - The codebase is ahead of the todos.

---

## References

### Internal Files
- `server/src/routes/tenant-admin-landing-page.routes.ts:168-304` - Draft endpoints
- `server/src/middleware/rateLimiter.ts:133-147` - draftAutosaveLimiter
- `client/src/features/tenant-admin/landing-page-editor/hooks/useLandingPageEditor.ts:147-557` - Hook with batching
- `client/src/features/tenant-admin/landing-page-editor/sections/EditableAccommodationSection.tsx:1-182` - Accommodation component
- `packages/contracts/src/tenant-admin/landing-page.contract.ts:146-227` - API contracts

### Related Commits
- `1647a40` - feat(landing-page): add visual editor with 8 editable sections
- `b4598f8` - feat(landing-page-editor): add localStorage recovery, layout shift prevention

### Original Todos
- `todos/246-pending-p1-plan-backend-already-exists.md`
- `todos/247-pending-p1-hook-missing-batching-rollback.md`
- `todos/248-pending-p1-missing-accommodation-section.md`
- `todos/249-pending-p1-rate-limiting-draft-endpoints.md`
