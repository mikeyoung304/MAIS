# Realtime Storefront Preview - Handoff Document

**Date:** 2026-02-01
**Branch:** `feat/realtime-storefront-preview`
**Status:** In Progress - Critical Blocker Found

## Summary

Fixing P1 bug where storefront preview silently falls back to live content when sections have empty arrays (e.g., `tiers: []` in pricing section).

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

## Critical Blocker Found

### The Publish Path Mismatch

**Problem:** When user clicks "Publish" in PreviewPanel after agent makes changes, it will fail!

**Data Flow Analysis:**

```
AI Agent writes → landingPageConfigDraft column (correct)
User clicks Publish → POST /publish → publish() → publishLandingPageDraft()
                    → reads landingPageConfig.draft (WRONG COLUMN!)
                    → "No draft to publish" error
```

**Root Cause:** Two parallel draft systems never unified:

1. **Visual Editor** (deprecated): Uses wrapper format in `landingPageConfig` column
2. **Build Mode (AI)**: Uses separate `landingPageConfigDraft` column

The `publishLandingPageDraft()` repository method only reads from the wrapper format.

### The Fix Required

Update `publishLandingPageDraft()` to:

1. First check `landingPageConfigDraft` column (Build Mode)
2. Fall back to `landingPageConfig.draft` (Visual Editor legacy)
3. Publish whichever has data

**Or simpler:** Have `publish()` service method call `publishBuildModeDraft()` instead.

## Remaining Work

### Phase 1: Fix Publish Path (BLOCKER)

- [ ] Update `publishLandingPageDraft()` OR `publish()` to handle Build Mode column
- [ ] Update `discardLandingPageDraft()` similarly
- [ ] Test publish flow after agent changes

### Phase 2: Delete Visual Editor Write Code

Since UI is agent-only, these are dead code:

- [ ] Delete `PUT /v1/tenant-admin/landing-page/draft` route
- [ ] Delete `PUT /v1/tenant-admin/landing-page` route
- [ ] Delete `PATCH /v1/tenant-admin/landing-page/sections` route
- [ ] Delete service methods: `saveDraft()`, `updateConfig()`, `toggleSection()`
- [ ] Delete repository methods: `saveLandingPageDraft()`, `updateLandingPageConfig()`, `toggleLandingPageSection()`
- [ ] Update API contracts to remove deleted endpoints

### Phase 3: Add REFRESH_PREVIEW Action

- [ ] Add `REFRESH_PREVIEW` to DashboardAction type in agent tools
- [ ] Update storefront tools to return `{ type: 'REFRESH_PREVIEW', sectionId }`
- [ ] Wire up frontend handler to invalidate + scroll

### Phase 4: Placeholder UI

- [ ] Create `SectionPlaceholder` component
- [ ] Update section components to show placeholders for empty arrays in preview mode

### Phase 5: Testing

- [ ] Run typecheck
- [ ] Run existing tests
- [ ] Add unit tests for validation utilities
- [ ] Manual test: agent adds empty pricing section → preview shows placeholder

## Key Files

| File                                                    | Status     | Notes                  |
| ------------------------------------------------------- | ---------- | ---------------------- |
| `packages/contracts/src/landing-page.ts`                | Modified   | Added lenient schemas  |
| `server/src/lib/landing-page-validation.ts`             | Created    | Validation utilities   |
| `server/src/adapters/prisma/tenant.repository.ts`       | Modified   | Fixed draft validation |
| `server/src/services/landing-page.service.ts`           | Needs work | Simplify, fix publish  |
| `server/src/routes/tenant-admin-landing-page.routes.ts` | Needs work | Delete write routes    |

## Architecture Decision

**User confirmed:** Only AI agent chatbot for editing. No direct form editing.

This means:

- Visual Editor code paths are dead code
- Can safely delete write endpoints
- Must ensure publish/discard work with Build Mode column

## How to Resume

1. Fix the publish path mismatch (critical blocker)
2. Delete Visual Editor write code
3. Add REFRESH_PREVIEW action
4. Add placeholder UI
5. Test everything

## Git Status

```bash
git branch  # feat/realtime-storefront-preview
git status  # Modified: contracts, repository, new validation file
```
