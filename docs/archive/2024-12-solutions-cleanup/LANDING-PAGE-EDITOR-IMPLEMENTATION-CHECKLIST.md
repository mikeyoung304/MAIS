# Landing Page Editor Implementation Checklist

**Based on:** Pattern Analysis (PATTERN-ANALYSIS-LANDING-PAGE-EDITOR.md)
**Plan:** feat-landing-page-visual-editor.md
**Status:** Ready for development

---

## Pre-Implementation: Preparation (½ day)

### Code Review & Planning

- [ ] Read full pattern analysis: `docs/solutions/PATTERN-ANALYSIS-LANDING-PAGE-EDITOR.md`
- [ ] Read pattern comparison: `docs/solutions/PATTERN-COMPARISON-VISUAL-EDITOR-vs-LANDING-PAGE.md`
- [ ] Review existing `useVisualEditor` implementation (reference for all patterns)
- [ ] Review `EditableText` and `EditablePrice` components (base patterns)
- [ ] Verify all acceptance criteria align with CLAUDE.md strict mode

### Schema Verification

- [ ] Check existing landing page schema: `packages/contracts/src/landing-page.ts`
- [ ] Verify `LandingPageConfigSchema` includes all sections
- [ ] Cross-reference admin contract: `packages/contracts/src/tenant-admin/landing-page.contract.ts`
- [ ] Identify any schema mismatches between public + admin APIs

### Team Communication

- [ ] Share pattern analysis with team
- [ ] Confirm alignment on state management approach (`LandingPageWithDraft` vs. separate)
- [ ] Discuss component reuse strategy (wrapping vs. creating new)
- [ ] Review estimated effort with team

---

## Phase 1: Core Infrastructure (1-2 days)

### Contract Updates (CRITICAL)

- [ ] **Add draft management endpoints to landing-page.contract.ts:**
  ```typescript
  // New endpoints:
  -getDraft(GET / v1 / tenant - admin / landing - page / draft) -
    saveDraft(PUT / v1 / tenant - admin / landing - page / draft) -
    publishDraft(POST / v1 / tenant - admin / landing - page / publish) -
    discardDraft(DELETE / v1 / tenant - admin / landing - page / draft);
  ```
- [ ] Define `LandingPageWithDraftDto` response schema
- [ ] Update request/response bodies with Zod validation
- [ ] Run `npm run typecheck` - no errors
- [ ] Verify contract compiles: `npm run --workspace=server build`

### State Management Hook

- [ ] **Create `useLandingPageEditor.ts`:**
  - [ ] Define `LandingPageWithDraft` interface (single source of truth)
  - [ ] Implement `loadConfig()` to fetch from API
  - [ ] Implement `updateSection()` with:
    - [ ] Ref-based `pendingChanges` Map (batching)
    - [ ] Ref-based `originalStates` Map (rollback)
    - [ ] 1s debounce timeout
    - [ ] Optimistic UI updates
  - [ ] Implement `flushPendingChanges()` with:
    - [ ] Sequential request sending
    - [ ] Error handling + logger
    - [ ] Rollback on failure
    - [ ] Toast notifications
  - [ ] Implement `publishChanges()` / `discardChanges()`
  - [ ] Add memoized `hasChanges` derived metric
  - [ ] Add JSDoc explaining batching strategy
  - [ ] TypeScript strict mode: no `any` types
- [ ] Write unit tests for state management
- [ ] Run `npm run typecheck` - no errors
- [ ] Test hook manually: `npm run dev:api` + browser console

### UI Components (Base Infrastructure)

- [ ] **Create `LandingPageEditor.tsx` main container:**
  - [ ] Two-column layout: sidebar + preview area
  - [ ] Integrate `useLandingPageEditor` hook
  - [ ] Add error boundary for safety
  - [ ] Loading state with skeleton
  - [ ] TypeScript strict: no `any` types
  - [ ] Test responsive layout (desktop + tablet + mobile)

- [ ] **Create `EditorSidebar.tsx`:**
  - [ ] Section lists: Active + Available
  - [ ] Toggle buttons for each section
  - [ ] "Unsaved changes" indicator
  - [ ] Mobile: Use Sheet component (collapse to drawer)
  - [ ] TypeScript strict mode compliance

- [ ] **Create `EditorToolbar.tsx`:**
  - [ ] Publish button (disabled if no changes)
  - [ ] Discard button with confirmation dialog
  - [ ] Status indicator (saving/saved/error)
  - [ ] Floating position at bottom
  - [ ] TypeScript strict mode compliance

- [ ] **Create `EditableSection.tsx` base wrapper:**
  - [ ] Wraps all section editable content
  - [ ] Edit mode indicator
  - [ ] Save/Discard buttons in edit mode
  - [ ] Consistent styling across sections
  - [ ] Reusable for all section types

### Routing & Navigation

- [ ] Add route to `/tenant/landing-page` in `client/src/app/routes.tsx`
- [ ] Add navigation link in `TenantAdminNav.tsx`
- [ ] Test navigation from dashboard
- [ ] Verify breadcrumbs/back button work

### Acceptance Criteria (Phase 1)

- [ ] Editor loads at `/tenant/landing-page` without errors
- [ ] Sidebar displays active sections with toggle buttons
- [ ] Sidebar displays available sections (can be added)
- [ ] Publish/Discard buttons visible in toolbar
- [ ] Layout responds correctly on desktop (min 1200px)
- [ ] No TypeScript errors: `npm run typecheck`
- [ ] Sidebar collapses on mobile (drawer pattern)
- [ ] Contract endpoints are defined + type-safe

---

## Phase 2: Editable Section Components (1.5-2 days)

### Component Architecture Decision

- [ ] **Choose reuse strategy:**
  - [ ] Identify existing section components: HeroSection, AboutSection, etc.
  - [ ] Decide: Wrap existing vs. create new?
  - [ ] Recommended: Wrap existing + add EditableText overlays
  - [ ] Verify components accept props for editing mode

### Create Base EditableImage Component

- [ ] **Create `EditableImage.tsx`:**
  - [ ] Simple variant: Click → file picker → callback
  - [ ] Follow `EditableText` pattern (not PhotoDropZone)
  - [ ] Accept current URL + onChange callback
  - [ ] Show preview thumbnail + edit button
  - [ ] Validate file type/size
  - [ ] Show error toast on failure
  - [ ] TypeScript strict mode

### Create EditableList Component

- [ ] **Create `EditableList.tsx` for repeating items:**
  - [ ] Used by TestimonialsSection, FaqSection, SocialProofBar
  - [ ] Add/remove items
  - [ ] Edit each item inline
  - [ ] Drag to reorder (optional, defer if needed)
  - [ ] TypeScript strict mode

### Section Components (7 total)

For each section, decide: **WRAP existing** or **CREATE new**?

#### Hero Section

- [ ] **Option A (Wrap):** Use existing `HeroSection.tsx`
  ```typescript
  <EditableSection title="Hero">
    <HeroSection {...config}>
      {/* EditableText overlays in edit mode */}
    </HeroSection>
  </EditableSection>
  ```
- [ ] **Option B (Create):** Build from scratch
- [ ] Decision: **\_**
- [ ] Implement chosen option
- [ ] Initialize with `LANDING_PAGE_SECTION_DEFAULTS.hero` when added
- [ ] Test: Can edit headline, subheadline, CTA text
- [ ] Test: Image upload works

#### Social Proof Bar

- [ ] Follow same pattern as Hero (wrap or create)
- [ ] EditableList for items
- [ ] Each item has icon + text
- [ ] Initialize with defaults

#### About Section

- [ ] Wrap or create
- [ ] EditableText for headline + content
- [ ] EditableImage for section image
- [ ] Position toggle (left/right)

#### Testimonials Section

- [ ] Wrap or create
- [ ] EditableText for headline
- [ ] EditableList for testimonial items
- [ ] Each item: quote, author, role, rating

#### Gallery Section

- [ ] Wrap or create
- [ ] PhotoDropZone (reuse from visual editor)
- [ ] Drag to reorder photos
- [ ] Max 5-10 photos limit

#### FAQ Section

- [ ] Wrap or create
- [ ] EditableText for headline
- [ ] EditableList for FAQ items
- [ ] Each item: question + answer (multiline)
- [ ] Add/remove items

#### Final CTA Section

- [ ] Wrap or create
- [ ] EditableText for headline, subheadline, CTA text
- [ ] Similar to Hero but simpler

### Demo Data

- [ ] Create `demo-data.ts` utility file (not subdirectory)
- [ ] Export `LANDING_PAGE_SECTION_DEFAULTS` constant
- [ ] Initialize sections with demo data when added via toggle
- [ ] All demo text follows brand voice (read BRAND_VOICE_GUIDE.md)

### Acceptance Criteria (Phase 2)

- [ ] All 7 sections render with demo data when enabled
- [ ] Click-to-edit works on all text fields
- [ ] Image upload works (Hero, About, Gallery)
- [ ] Add/remove works (Testimonials, FAQ, SocialProof)
- [ ] PhotoDropZone works correctly (Gallery)
- [ ] Changes reflect immediately in preview
- [ ] No TypeScript errors
- [ ] Visual consistency across all sections
- [ ] Section defaults match brand voice

---

## Phase 3: Draft System & API Integration (1-2 days)

### Backend Routes (Express)

- [ ] **Implement draft endpoints in `tenant-admin-landing-page.routes.ts`:**
  - [ ] `GET /v1/tenant-admin/landing-page/draft` → Fetch draft config
  - [ ] `PUT /v1/tenant-admin/landing-page/draft` → Save draft (auto-save)
  - [ ] `POST /v1/tenant-admin/landing-page/publish` → Publish to live
  - [ ] `DELETE /v1/tenant-admin/landing-page/draft` → Discard draft

- [ ] **Update Tenant repository:**
  - [ ] `getLandingPageDraft(tenantId)` method
  - [ ] `saveLandingPageDraft(tenantId, config)` method
  - [ ] `publishLandingPageDraft(tenantId)` method
  - [ ] `discardLandingPageDraft(tenantId)` method
  - [ ] All methods tenant-scoped

### Database (Prisma)

- [ ] **Choose storage pattern:**
  - [ ] Option A: Single JSON field with nested draft/published
  - [ ] Option B: Separate columns for draft vs. published
  - [ ] Recommended: Option A (no migration needed, flexible)

- [ ] **Update Tenant model (if using Option B):**

  ```prisma
  model Tenant {
    // ... existing fields
    landingPageConfig     Json?
    landingPageDraftConfig Json?
    landingPageDraftAt    DateTime?
    landingPagePublishedAt DateTime?
  }
  ```

  - [ ] Run: `npm exec prisma migrate dev --name add_landing_page_draft`
  - [ ] Verify migration applies cleanly
  - [ ] Update `tenant.repository.ts` methods

- [ ] **Or keep existing structure (Option A):**
  - [ ] No schema changes needed
  - [ ] Update repository to read/write nested structure

### Frontend API Integration

- [ ] **Update `useLandingPageEditor.ts`:**
  - [ ] Call `loadConfig()` on mount → fetch draft + published
  - [ ] Call API on each `updateSection()` → debounced save
  - [ ] Call `publishChanges()` → POST publish endpoint
  - [ ] Call `discardChanges()` → DELETE draft endpoint
  - [ ] Implement error handling + rollback (from Phase 1)

- [ ] **Test API integration:**
  - [ ] Mock mode: `ADAPTERS_PRESET=mock npm run dev:api`
  - [ ] Real mode: `ADAPTERS_PRESET=real npm run dev:api` (if DB available)
  - [ ] Browser: Edit section → verify auto-save after 1s
  - [ ] Browser: Publish → verify changes go live
  - [ ] Browser: Discard → verify draft clears

### Integration Tests

- [ ] **Create test file: `server/test/routes/tenant-admin-landing-page.routes.test.ts`**
  - [ ] Test draft save + load cycle
  - [ ] Test publish moves draft to published
  - [ ] Test discard clears draft
  - [ ] Test tenant isolation (one tenant can't see another's draft)
  - [ ] Use `createTestTenant()` helper for isolation

### Acceptance Criteria (Phase 3)

- [ ] Drafts auto-save after 1s of inactivity
- [ ] Publish button copies draft to live config
- [ ] Discard button reverts to published state
- [ ] "Unsaved changes" indicator shows when draft differs
- [ ] Page reload preserves draft state
- [ ] Multi-section edits batch into single request
- [ ] All tests pass: `npm test`
- [ ] No TypeScript errors
- [ ] Tenant isolation verified in tests

---

## Phase 4: Polish & Testing (1-2 days)

### Error Handling & UX

- [ ] Add loading skeletons during initial load
- [ ] Add success toast after publish
- [ ] Add error toasts with actionable messages
- [ ] Add confirmation dialog for discard
- [ ] Test all error paths (network failures, validation errors, etc.)

### Accessibility

- [ ] Lighthouse accessibility score > 90
- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels on all buttons/inputs
- [ ] Test with screen reader (VoiceOver/NVDA)

### E2E Tests (Playwright)

- [ ] **Create `e2e/tests/landing-page-editor.spec.ts`**
  - [ ] Test workflow: Load → Toggle section → Edit → Publish
  - [ ] Test persistence: Edit → reload → verify saved
  - [ ] Test discard: Edit → Discard → verify reverted
  - [ ] Test error states: Network failure handling
  - [ ] Test mobile: Sidebar collapse on small screen

### Performance

- [ ] Initial load under 2 seconds
- [ ] Auto-save completes within 500ms
- [ ] No layout shift during editing
- [ ] No console warnings/errors

### Documentation

- [ ] Add JSDoc comments to all hooks/components
- [ ] Document auto-save batching strategy
- [ ] Document state management approach
- [ ] Update team wiki/docs as needed

### Final Checks

- [ ] Run full test suite: `npm test`
- [ ] Run type check: `npm run typecheck`
- [ ] Run linter: `npm run lint`
- [ ] Run E2E: `npm run test:e2e`
- [ ] Manual testing: All user flows work end-to-end
- [ ] Code review: Peer review all changes
- [ ] No remaining TypeScript errors
- [ ] No console errors in development

### Acceptance Criteria (Phase 4)

- [ ] All happy paths work smoothly
- [ ] Error states handled gracefully with helpful messages
- [ ] E2E tests pass (all scenarios)
- [ ] Unit tests pass (> 70% coverage target)
- [ ] TypeScript strict mode compliance (no errors)
- [ ] Lighthouse accessibility > 90
- [ ] Performance metrics met (< 2s load, < 500ms autosave)
- [ ] Code reviewed and approved
- [ ] Ready for production deployment

---

## Testing Matrix

### Unit Tests

| Component            | Coverage                    | Status |
| -------------------- | --------------------------- | ------ |
| useLandingPageEditor | State, actions, batching    | - [ ]  |
| EditableText         | Display, edit, save, cancel | - [ ]  |
| EditableImage        | Click, upload, validation   | - [ ]  |
| EditableList         | Add, remove, reorder        | - [ ]  |
| EditableSection      | Display, edit mode toggle   | - [ ]  |

### Integration Tests

| Scenario         | Coverage                         | Status |
| ---------------- | -------------------------------- | ------ |
| Draft save cycle | Save → load → verify             | - [ ]  |
| Publish flow     | Edit → publish → verify live     | - [ ]  |
| Discard flow     | Edit → discard → verify reverted | - [ ]  |
| Tenant isolation | Verify data separation           | - [ ]  |
| Error handling   | Network failures, validation     | - [ ]  |

### E2E Tests

| Flow                 | Steps                             | Status |
| -------------------- | --------------------------------- | ------ |
| Full editor workflow | Load → Edit → Save → Publish      | - [ ]  |
| Persistence          | Edit → Reload → Verify saved      | - [ ]  |
| Mobile responsive    | Sidebar collapse on small screen  | - [ ]  |
| Error recovery       | Network failure → retry → success | - [ ]  |

---

## Code Quality Checkpoints

### Before Each Commit

- [ ] `npm run typecheck` passes (zero errors)
- [ ] `npm run lint` passes (zero errors)
- [ ] `npm test` passes (all tests)
- [ ] Console has no warnings/errors in development

### Before Phase Completion

- [ ] All acceptance criteria met
- [ ] PR created with clear description
- [ ] Peer review approved
- [ ] No outstanding TODOs or FIXMEs
- [ ] Commits are clean and descriptive

### Before Production

- [ ] All phases complete
- [ ] Full regression testing done
- [ ] Performance metrics verified
- [ ] Accessibility audit passed
- [ ] Deployment plan documented

---

## Troubleshooting Guide

### TypeScript Errors

| Error                                | Solution                                    |
| ------------------------------------ | ------------------------------------------- |
| `Type X is not assignable to type Y` | Check schema definitions in contracts       |
| `Property undefined in strict mode`  | Add optional chaining (`?.`) or type guards |
| `Cannot find module`                 | Verify barrel export in `index.ts`          |

### Auto-save Not Working

- [ ] Check network tab in DevTools (API call made?)
- [ ] Verify 1s timeout is working (add console.log)
- [ ] Check API response status code
- [ ] Check backend logs for errors

### Batch Updates Not Grouping

- [ ] Verify `pendingChanges` Map is accumulating
- [ ] Check timeout is being cleared + reset
- [ ] Verify `flushPendingChanges` is called after timeout

### Mobile Sidebar Not Collapsing

- [ ] Verify Tailwind breakpoints: `hidden md:block` for desktop
- [ ] Check Sheet component is wrapping sidebar
- [ ] Verify mobile viewport in DevTools

### Tests Failing

- [ ] Check test isolation with `createTestTenant()`
- [ ] Verify database is running (if integration tests)
- [ ] Check for stale data from previous tests
- [ ] Run single test: `npm test -- path/to/test.test.ts`

---

## Team Hand-off Template

**When completing a phase, document:**

```markdown
## Phase [N] Completion Report

**Completed By:** [Name]
**Date Completed:** [Date]
**Hours Spent:** [Hours]

### What Was Done

- [Bullet list of completed items]

### Key Decisions Made

- [Any important architectural decisions]

### Known Issues/Limitations

- [Any known issues or deferred items]

### Testing Status

- Unit tests: [Pass/Fail]
- Integration tests: [Pass/Fail]
- E2E tests: [Pass/Fail]
- Manual testing: [Complete/Incomplete]

### Blockers/Dependencies

- [Any blockers for next phase]

### Hand-off Notes for Next Developer

- [Any important context]
```

---

## Quick Reference

### Key Files to Create/Modify

**New Files (14):**

- `client/src/features/tenant-admin/landing-page-editor/LandingPageEditor.tsx`
- `client/src/features/tenant-admin/landing-page-editor/hooks/useLandingPageEditor.ts`
- `client/src/features/tenant-admin/landing-page-editor/components/EditorSidebar.tsx`
- `client/src/features/tenant-admin/landing-page-editor/components/SectionCard.tsx`
- `client/src/features/tenant-admin/landing-page-editor/components/EditorToolbar.tsx`
- `client/src/features/tenant-admin/landing-page-editor/components/EditableSection.tsx`
- `client/src/features/tenant-admin/landing-page-editor/components/EditableImage.tsx`
- `client/src/features/tenant-admin/landing-page-editor/components/EditableList.tsx`
- `client/src/features/tenant-admin/landing-page-editor/sections/EditableHeroSection.tsx`
- `client/src/features/tenant-admin/landing-page-editor/sections/Editable*.tsx` (6 more)
- `client/src/features/tenant-admin/landing-page-editor/demo-data.ts`
- `client/src/features/tenant-admin/landing-page-editor/index.ts`
- `server/test/routes/tenant-admin-landing-page.routes.test.ts`
- `e2e/tests/landing-page-editor.spec.ts`

**Files to Modify (5):**

- `packages/contracts/src/tenant-admin/landing-page.contract.ts` (add draft endpoints)
- `server/src/routes/tenant-admin-landing-page.routes.ts` (implement draft routes)
- `server/src/adapters/prisma/tenant.repository.ts` (add draft methods)
- `client/src/app/routes.tsx` (add editor route)
- `client/src/features/tenant-admin/TenantAdminNav.tsx` (add nav link)

### Commands to Run

```bash
# Development
npm run dev:api
npm run dev:client

# Testing
npm test
npm run test:integration
npm run test:e2e

# Type checking
npm run typecheck

# Linting
npm run lint
npm run format
```

### Pattern References

- Visual Editor: `client/src/features/tenant-admin/visual-editor/`
- UseVisualEditor Hook: `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts`
- EditableText: `client/src/features/tenant-admin/visual-editor/components/EditableText.tsx`
- PhotoDropZone: `client/src/features/tenant-admin/visual-editor/components/PhotoDropZone.tsx`

---

**Status:** Ready for implementation
**Last Updated:** 2025-12-04
**Version:** 1.0
