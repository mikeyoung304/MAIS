# Agent Evaluation Remediation - Continuation Decision

**Date:** 2026-01-02
**Status:** 60% Complete
**Remaining Effort:** ~5 hours

---

## Current State Summary

### What's Actually Done

| Phase | Description                 | Status      | Evidence                                          |
| ----- | --------------------------- | ----------- | ------------------------------------------------- |
| **1** | DI & Testability            | ✅ Complete | Evaluator accepts DI, factory pattern, 11 tests   |
| **2** | Security & Tenant Isolation | ✅ Complete | Tenant scoping in pipeline, isolation tests       |
| **3** | Memory & Performance        | ✅ Complete | Promise cleanup, indexes added                    |
| **4** | Integration & Wiring        | 🟡 90%      | Routes wired, CLI working, missing orphan cleanup |
| **5** | Data Integrity              | ✅ Complete | Transactions in review routes                     |
| **6** | Code Quality (P2)           | 🟡 30%      | 4/10 items done (603, 605, 607, 608)              |
| **7** | Minor Issues (P3)           | ⬜ 0%       | Not started                                       |

### Recent Commits (Today)

- `fcf6004c`: P2 remediation - tenantId defense, UUID validation, test visibility, DI cleanup
- `a93a2a9e`: P1 route ordering and auth fallback
- `b2cab182`: Phase 4-5 remediation

### Todo File Cleanup Needed

**4 todos marked "open" but actually done:**

- `603-open` → should be `603-done` (tenantId defense)
- `605-open` → should be `605-done` (DI extraction)
- `607-open` → should be `607-done` (test visibility)
- `608-open` → should be `608-done` (UUID validation)

**2 P2 todos intentionally deferred:**

- `604-open`: Sequential tenant processing (no proven perf issue)
- `606-open`: Manual arg parsing (readable enough)

---

## Remaining Work

### Option A: Complete the Full Remediation (~5 hours)

**Phase 4 Completion (15 min):**

- Add `cleanupOrphanedFeedback()` to `server/src/jobs/cleanup.ts`

**Phase 6 - Code Quality (2.5 hours):**
| Item | Description | Est. |
|------|-------------|------|
| P2-587 | Extract PII redactor to `lib/pii-redactor.ts` | 30 min |
| P2-589 | Fix N+1 queries in review-queue.ts | 30 min |
| P2-593 | Replace 35 console.log with logger | 30 min |
| P2-594 | Sanitize error messages in pipeline | 15 min |
| P2-595 | Replace test mocks with mockDeep | 30 min |
| P2-591 | Verify Zod type inference complete | 15 min |

**Phase 7 - Minor Issues (2 hours):**
| Item | Description | Est. |
|------|-------------|------|
| P3-596 | Extract magic numbers to config | 15 min |
| P3-598 | Make EVAL_MODEL configurable | 15 min |
| P3-599 | Add adversarial test scenarios | 1 hour |
| P3-600 | Add readonly arrays with `as const` | 15 min |

**Housekeeping (15 min):**

- Rename 4 todo files
- Apply database migration

### Option B: Ship What We Have (15 min)

The evaluation system is **production-functional** now:

- ✅ Evaluation pipeline works
- ✅ Admin routes are wired
- ✅ CLI batch command works
- ✅ Tenant isolation enforced
- ✅ Security fixes applied

**Remaining items are polish:**

- PII redactor is duplicated but works
- N+1 queries affect dashboard perf, not core eval
- Console.logs are in tests only
- P3 items are minor quality improvements

**Quick cleanup only:**

1. Rename 4 todo files to "done"
2. Mark plan as "Phase 1-5 Complete, Phase 6-7 Deferred"
3. Move on to next priority

### Option C: Cherry-Pick High-Value Items (1.5 hours)

Extract the most impactful remaining work:

1. **PII Redactor Extraction** (30 min) - DRY violation is technical debt
2. **Apply Database Migration** (5 min) - Enables faster queries
3. **Rename Todo Files** (10 min) - Accurate tracking

Skip the rest for now - all P2/P3 items that don't affect core functionality.

---

## Decision Factors

| Factor              | Complete All | Ship Now            | Cherry-Pick |
| ------------------- | ------------ | ------------------- | ----------- |
| **Time**            | 5 hours      | 15 min              | 1.5 hours   |
| **Technical debt**  | None         | Some DRY violations | Minimal     |
| **Production risk** | Lowest       | Low                 | Low         |
| **Closure**         | Full ✓       | Partial             | Partial     |

---

## Recommendation

**If you want closure:** Option A - Complete everything today

**If you want to ship and iterate:** Option C - Cherry-pick PII redactor + migration + todo cleanup

**If evaluation system isn't urgent:** Option B - Ship and move on

---

## What's Actually Blocking Production?

**Nothing critical.** The system works. The remaining items are:

- Code quality improvements (DRY, type safety)
- Performance optimizations (N+1, indexes)
- Test improvements (adversarial scenarios)

These can be done incrementally or deferred until there's a specific need.

---

## Next Actions by Option

### Option A: Continue

```
1. Rename 4 todo files (603, 605, 607, 608) from -open to -done
2. Add cleanupOrphanedFeedback() function
3. Create lib/pii-redactor.ts
4. Fix review-queue N+1 with updateMany
5. Replace console.log in tests
6. Sanitize error messages
7. Fix test mocks
8. Extract magic numbers
9. Make EVAL_MODEL configurable
10. Add adversarial tests
11. Apply database migration
12. Run full test suite
13. Commit with conventional message
```

### Option B: Ship

```
1. Rename 4 todo files
2. Update plan status to "Phase 1-5 Complete"
3. Commit documentation updates
4. Move on
```

### Option C: Cherry-Pick

```
1. Rename 4 todo files
2. Create lib/pii-redactor.ts (extract from pipeline + review-queue)
3. Apply database migration
4. Update tests to use new PII module
5. Commit
6. Mark remaining as future work
```
