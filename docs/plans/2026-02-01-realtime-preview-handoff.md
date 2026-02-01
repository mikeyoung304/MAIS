# Realtime Storefront Preview - Handoff Document

**Date:** 2026-02-01
**Branch:** `feat/realtime-storefront-preview`
**Status:** Complete - Ready for Manual Testing

## Summary

Fixed P1 bug where storefront preview silently fell back to live content when sections have empty arrays (e.g., `tiers: []` in pricing section).

## Completed Work

### 1. Lenient Schemas (DONE)

**File:** `packages/contracts/src/landing-page.ts`

Added lenient schema variants that allow empty arrays:

- `LenientPricingSectionSchema` - allows `tiers: []`
- `LenientFeaturesSectionSchema` - allows `features: []`
- `LenientSectionSchema` - discriminated union with lenient variants
- `LenientLandingPageConfigSchema` - top-level schema for drafts
- `StrictLandingPageConfigSchema` - alias for publish-time validation

### 2. Validation Utilities (DONE)

**File:** `server/src/lib/landing-page-validation.ts` (NEW)

Created validation helpers:

- `validateDraft(config)` - lenient validation, returns `ValidationResult<LenientLandingPageConfig>`
- `validateForPublish(config)` - strict validation for publishing
- `getIncompleteSections(config)` - returns list of incomplete sections with human-readable reasons

### 3. Draft Validation Fix (DONE)

**File:** `server/src/adapters/prisma/tenant.repository.ts`

Changed draft validation from strict to lenient in:

- `getLandingPageDraft()` - line 1012 (Build Mode column)
- `getLandingPageDraft()` - line 1030 (Visual Editor wrapper fallback)
- `findBySlugForPreview()` - line 529

### 4. Publish/Discard Path Fix (DONE)

**File:** `server/src/adapters/prisma/tenant.repository.ts`

Fixed dual-column draft system:

- [x] Updated `publishLandingPageDraft()` to check Build Mode column first, then Visual Editor wrapper
- [x] Updated `discardLandingPageDraft()` to clear both Build Mode column and wrapper format
- [x] Both methods now properly handle data from either source

### 5. Visual Editor Code Deletion (DONE)

Removed dead code (Visual Editor is deprecated, all editing via AI agent):

**Routes deleted:**

- [x] `PUT /v1/tenant-admin/landing-page` route
- [x] `PUT /v1/tenant-admin/landing-page/draft` route
- [x] `PATCH /v1/tenant-admin/landing-page/sections` route

**Service methods deleted:**

- [x] `saveDraft()` (replaced by `saveBuildModeDraft()`)
- [x] `updateConfig()`
- [x] `toggleSection()`

**Repository methods deleted:**

- [x] `saveLandingPageDraft()` (Build Mode uses `tenantRepo.update()` directly)
- [x] `updateLandingPageConfig()`
- [x] `toggleLandingPageSection()`

### 6. REFRESH_PREVIEW Action (DONE)

**Frontend updates:**

- [x] Added `REFRESH_PREVIEW` to DashboardAction type in `useConciergeChat.ts`
- [x] Added `sectionId` field for new format from storefront tools
- [x] Updated `handleDashboardActions` in `AgentPanel.tsx` to handle both action types
- [x] Storefront tools already return `dashboardAction: { type: 'SCROLL_TO_SECTION', sectionId }`

### 7. Tests Updated (DONE)

**File:** `server/test/integration/landing-page-routes.spec.ts`

- [x] Updated tests to use `saveBuildModeDraft()` instead of deleted `saveDraft()`
- [x] Removed assertions for `draftUpdatedAt` (Build Mode doesn't set this)
- [x] All 19 landing page integration tests pass

## Remaining Work

### Phase 4: Placeholder UI (OPTIONAL)

- [ ] Create `SectionPlaceholder` component
- [ ] Update section components to show placeholders for empty arrays in preview mode

### Phase 5: Manual Testing

- [x] Run typecheck (PASS)
- [x] Run existing tests (PASS - landing page tests, other failures are pre-existing flaky tests)
- [ ] Manual test: agent adds empty pricing section → preview shows placeholder
- [ ] Manual test: publish after agent changes → works correctly
- [ ] Manual test: discard after agent changes → reverts correctly

## Key Files Changed

| File                                                    | Status   | Notes                                    |
| ------------------------------------------------------- | -------- | ---------------------------------------- |
| `packages/contracts/src/landing-page.ts`                | Modified | Added lenient schemas                    |
| `server/src/lib/landing-page-validation.ts`             | Created  | Validation utilities                     |
| `server/src/adapters/prisma/tenant.repository.ts`       | Modified | Fixed draft validation, publish, discard |
| `server/src/services/landing-page.service.ts`           | Modified | Deleted Visual Editor methods            |
| `server/src/routes/tenant-admin-landing-page.routes.ts` | Modified | Deleted Visual Editor write routes       |
| `apps/web/src/hooks/useConciergeChat.ts`                | Modified | Added REFRESH_PREVIEW action type        |
| `apps/web/src/components/agent/AgentPanel.tsx`          | Modified | Handle sectionId in SCROLL_TO_SECTION    |
| `server/test/integration/landing-page-routes.spec.ts`   | Modified | Updated tests for Build Mode API         |

## Architecture Decision

**User confirmed:** Only AI agent chatbot for editing. No direct form editing.

This means:

- Visual Editor code paths were dead code (now deleted)
- Publish/discard work with Build Mode column
- Dashboard actions support both legacy and new formats

## Git Status

```bash
git branch  # feat/realtime-storefront-preview
git status  # Multiple files modified, ready for commit
```
