# Landing Page Visual Editor: Data Integrity Findings Summary

**Date:** 2025-12-04
**Reviewer:** Data Integrity Guardian
**Status:** 3 CRITICAL issues, 2 IMPORTANT issues, 2 SUGGESTIONS, 2 STRENGTHS

---

## Quick Summary

The landing page editor plan is well-designed overall and borrows proven patterns from the visual editor. However, **3 critical data loss risks** must be fixed before implementation:

1. **Publish is not atomic** – Draft and metadata cleared separately → partial publish state
2. **Auto-save races with publish** – User's recent edits overwritten by stale save
3. **Discard has no server confirmation** – UI shows clean, but database still has draft

Additionally, **2 important validations** should be added before launch for data consistency.

All fixes are straightforward and follow existing patterns in the codebase.

---

## Critical Issues

### Issue 1: Publish Transaction Not Atomic ⚠️

**Problem:** If publish fails mid-operation, draft is live but metadata not cleared.

**Impact:** User sees "Unsaved changes" after publishing. On reload, draft reappears. User publishes again thinking first attempt failed.

**Fix:** Wrap draft-to-published copy in `prisma.$transaction()` to ensure both draft copy AND metadata clearing happen together or not at all.

**Effort:** 30 minutes (add transaction wrapper in `tenant.repository.ts`)

**Code location:** `tenant.repository.ts` - add `publishLandingPageDraft()` method

---

### Issue 2: Auto-Save Race Condition 🔴

**Problem:** If user publishes while auto-save debounce is pending, the auto-save might fire AFTER publish completes, overwriting the published state with stale draft.

**Timeline:**

```
t=0ms   User types "New Headline"
t=500ms Auto-save queued (will fire at t=1000ms)
t=800ms User clicks Publish
t=900ms Publish succeeds with "New Headline"
t=1000ms Auto-save fires, overwrites with old draft from t=500ms
```

**Impact:** User's most recent edits silently disappear.

**Fix:** In `publishChanges()`, cancel debounce timeout and await any pending auto-save BEFORE making publish request.

**Effort:** 20 minutes (modify `useLandingPageEditor.ts`)

**Code reference:** `useVisualEditor.ts` lines 245-251 show correct pattern

---

### Issue 3: Discard Not Server-Backed ❌

**Problem:** Discard clears draft locally but doesn't call server endpoint. If request fails, UI shows clean state but database still has draft.

**Impact:** Confusing user experience. Page reload shows draft is still there.

**Fix:** Make `discardChanges()` call `DELETE /v1/tenant-admin/landing-page/draft` endpoint. Use optimistic UI with rollback on error.

**Effort:** 45 minutes (add endpoint + hook integration)

**Code reference:** `useVisualEditor.ts` lines 280-312 show correct pattern

---

## Important Issues

### Issue 4: No Schema Validation 🟡

**Problem:** Draft and published config are stored in same JSON field with no constraints. No database validation ensures `draft: null ↔ draftUpdatedAt: null`.

**Impact:** If data gets corrupted via raw SQL or code bug, impossible to detect. Silently confuses editor UI.

**Fix:** Add Zod validator in `getLandingPageDraft()` that enforces consistency. Log warnings if violated, gracefully degrade.

**Effort:** 20 minutes

---

### Issue 5: Missing Discard Confirmation 🟡

**Problem:** Plan lists as acceptance criterion but doesn't specify implementation. Users can lose work with accidental click.

**Fix:** Implement `DiscardConfirmationDialog` showing what's being discarded. Default button should be "Keep Editing" not "Discard".

**Effort:** 30 minutes

---

## Strengths of the Plan

✅ **JSON Storage Approach is Safe**

- Single JSON field is better than separate columns (atomic reads)
- Flexible for future enhancements
- Matches existing pattern (branding field)

✅ **Follows Proven Visual Editor Patterns**

- Auto-save with debounce ✓
- Optimistic UI updates ✓
- Batch request coalescing ✓
- Server-backed operations ✓

---

## What's Working Well

| Aspect           | Status        | Evidence                       |
| ---------------- | ------------- | ------------------------------ |
| Architecture     | ✅ Sound      | Mirrors proven visual editor   |
| State management | ✅ Clear      | Separate draft/published shown |
| UI/UX patterns   | ✅ Solid      | Section toggles, click-to-edit |
| Error handling   | ⚠️ Incomplete | Missing transaction guards     |
| Concurrency      | ⚠️ Noted      | Single admin MVP acceptable    |
| Schema design    | ✅ Flexible   | JSON field future-proof        |

---

## Implementation Priority

### Phase 1: Blockers (MUST fix before implementation starts)

1. Add transaction wrapper for publish
2. Flush auto-save before publish
3. Server-backed discard endpoint

**Time:** 1.5-2 hours

### Phase 2: Important (MUST fix before launch)

4. Zod validation schema
5. Confirmation dialog

**Time:** 1 hour

### Phase 3: Nice-to-Have (post-MVP)

6. IndexedDB local backup
7. Publish attempt logging
8. Session tokens for future multi-user

**Time:** 2-3 hours (low priority)

---

## Files to Review

### Documentation

- **Full Analysis:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/LANDING-PAGE-EDITOR-DATA-INTEGRITY-ANALYSIS.md`
- **Implementation Checklist:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/LANDING-PAGE-EDITOR-DATA-INTEGRITY-CHECKLIST.md`
- **Plan:** `/Users/mikeyoung/CODING/MAIS/plans/feat-landing-page-visual-editor.md`

### Reference Code (Proven Patterns)

Package visual editor shows all patterns we need:

- **Auto-save flush:** `useVisualEditor.ts` lines 245-251
- **Discard with rollback:** `useVisualEditor.ts` lines 280-312
- **Transaction publish:** `catalog.repository.ts` lines 177-210
- **Error handling:** `useVisualEditor.ts` lines 149-164

---

## Risk Assessment

| Risk                 | Severity  | Pre-Launch | Post-Launch | Recoverable            |
| -------------------- | --------- | ---------- | ----------- | ---------------------- |
| Partial publish      | CRITICAL  | YES        | YES         | Rollback script exists |
| Silent data loss     | CRITICAL  | YES        | YES         | IndexedDB can recover  |
| Stale draft persists | CRITICAL  | YES        | YES         | Manual cleanup SQL     |
| Data inconsistency   | IMPORTANT | YES        | NO          | Validate on read       |

---

## Recommendations

### ✅ DO

- Start implementation with Finding 1, 2, 3 (blockers)
- Copy transaction patterns from `catalog.repository.ts`
- Copy auto-save patterns from `useVisualEditor.ts`
- Add Zod validation before launch
- Test publish/discard flows extensively

### ❌ DON'T

- Skip the transaction wrapper (most critical fix)
- Remove auto-save debounce cancellation
- Make discard local-only
- Launch without confirmation dialog
- Ignore data consistency warnings in production

---

## Next Steps

1. **Review:** Team lead reviews this analysis
2. **Plan:** Update implementation plan to include Finding fixes
3. **Implement:** Follow the checklist in `LANDING-PAGE-EDITOR-DATA-INTEGRITY-CHECKLIST.md`
4. **Test:** Add E2E tests for critical paths
5. **Review:** Code review explicitly checks for transaction atomicity
6. **Launch:** Monitor for data inconsistencies (see monitoring section)

---

## Questions?

Refer to the full analysis document for detailed explanations, code examples, and database queries:

**File:** `/Users/mikeyoung/CODING/MAIS/docs/solutions/LANDING-PAGE-EDITOR-DATA-INTEGRITY-ANALYSIS.md`

Key sections:

- Finding 1-3: CRITICAL fixes with code examples
- Finding 4-5: IMPORTANT validation improvements
- Finding 6-9: SUGGESTIONS for post-MVP enhancements
- Testing Recommendations: Unit, integration, E2E test cases
- Monitoring: Alerts to set up post-launch
- Rollback Plan: If issues arise

---

**Status:** Ready for implementation planning ✅
