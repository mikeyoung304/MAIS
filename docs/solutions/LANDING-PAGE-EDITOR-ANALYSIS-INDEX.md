# Landing Page Editor - Pattern Analysis Index

**Analysis Date:** December 4, 2025
**Plan Analyzed:** `/plans/feat-landing-page-visual-editor.md`
**Analyzer:** Claude Code (Pattern Recognition Specialist)

---

## Quick Navigation

### For Quick Answers (5 minutes)

- **Summary Report:** `PATTERN-ANALYSIS-SUMMARY.md` - Key findings and recommendations
- **Visual Comparison Table:** See "Quick Findings" section below

### For Deep Dives (30+ minutes)

- **Full Analysis:** `PATTERN-ANALYSIS-LANDING-PAGE-EDITOR.md` - Comprehensive findings with code examples
- **Pattern Comparison:** `PATTERN-COMPARISON-VISUAL-EDITOR-vs-LANDING-PAGE.md` - Side-by-side code examples

### For Implementation (During Development)

- **Implementation Checklist:** `LANDING-PAGE-EDITOR-IMPLEMENTATION-CHECKLIST.md` - Phase-by-phase tasks and acceptance criteria
- **Code Examples:** See pattern comparison document for exact code to reference

---

## Key Findings at a Glance

### Status: ✅ READY FOR IMPLEMENTATION

The plan is well-architected and follows established patterns with only **5 important recommendations** and **7 optimization suggestions**.

### Critical Issues: NONE

No violations of established patterns detected.

### Important Issues: 5

All fixable with minor adjustments (see below).

### Optimization Opportunities: 7

Reduce complexity, improve code reuse, and enhance consistency.

---

## The 5 Important Issues

| #   | Issue                               | Severity | Solution                           | Time to Fix |
| --- | ----------------------------------- | -------- | ---------------------------------- | ----------- |
| 1   | Hook naming inconsistency           | Low-Med  | Clarify naming pattern             | 15 min      |
| 2   | Duplicate state management          | Medium   | Use `LandingPageWithDraft` pattern | 2-3 hours   |
| 3   | Auto-save strategy undocumented     | Low      | Add JSDoc comments                 | 30 min      |
| 4   | EditableImage spec missing          | Medium   | Define two component variants      | 1-2 hours   |
| 5   | Draft API endpoints not in contract | Medium   | Add to landing-page.contract.ts    | 1-2 hours   |

**Total implementation impact:** +3-6 hours during Phase 1 (but saves 2-3 hours in Phase 2)

---

## The 7 Optimization Suggestions

| #   | Suggestion                           | Complexity | Benefit                               | Priority |
| --- | ------------------------------------ | ---------- | ------------------------------------- | -------- |
| 1   | Create `EditableSection` wrapper     | Medium     | Reduces duplication across 7 sections | Phase 1  |
| 2   | Replicate error handling pattern     | Low        | Consistency with visual editor        | Phase 1  |
| 3   | Reuse existing section components    | High       | Eliminates 7 new components           | Phase 2  |
| 4   | Verify schema alignment              | Low        | Prevents data mismatches              | Phase 1  |
| 5   | Implement mobile sidebar in Phase 1  | Low        | Avoids Phase 4 rework                 | Phase 1  |
| 6   | Add typecheck to acceptance criteria | Low        | Catches errors early                  | Phase 1  |
| 7   | Document test isolation pattern      | Low        | Enables team consistency              | Phase 4  |

**Net time savings:** 2-4 hours overall (Phase 2 is significantly faster)

---

## Compliance with CLAUDE.md

### Patterns Being Followed ✅

- Multi-tenant isolation (implicit in routes)
- TypeScript strict mode (no `any` types)
- API contracts with Zod + ts-rest
- Layered architecture (routes → services → adapters)
- Draft/publish workflow (mirrors visual editor)
- Error handling with domain errors

### Patterns Being Reused ✅

- `EditableText` component pattern
- `PhotoDropZone` component pattern
- `useVisualEditor` hook architecture
- Batching + debounce strategy for auto-save
- Error handling + rollback pattern

### Patterns Being Extended ✅

- Separate demo-data.ts file (better than inline)
- Multiple section types (necessary domain separation)

---

## How the Plan Compares to Visual Editor

### State Management: GOOD (with minor improvements)

- **Current plan:** Separate `draftConfig` and `publishedConfig`
- **Recommendation:** Use single `LandingPageWithDraft` object (mirrors `PackageWithDraft`)
- **Impact:** Simpler code, automatic change tracking, fewer bugs

### Hook Interface: GOOD

- **Current plan:** `useLandingPageEditor()` hook
- **Recommendation:** Keep name, but align state structure
- **Impact:** Familiar API for developers who know `useVisualEditor`

### Auto-save Strategy: GOOD

- **Current plan:** 1s debounce with batching
- **Recommendation:** Document batching strategy in JSDoc
- **Impact:** Developer awareness of race condition prevention

### Error Handling: NEEDS DOCUMENTATION

- **Current plan:** Not detailed
- **Recommendation:** Match visual editor pattern exactly (logger + toast + rollback)
- **Impact:** Consistent error UX, better debugging

### Components: GOOD (with optimization)

- **Current plan:** Create 7 new section components from scratch
- **Recommendation:** Wrap existing section components with edit overlays
- **Impact:** Code reuse, consistency with public landing page, faster implementation

### API Contracts: INCOMPLETE

- **Current plan:** Missing draft endpoints in contract
- **Recommendation:** Add 4 draft management endpoints
- **Impact:** Type-safe client code, proper API versioning

---

## Implementation Path Recommendation

### Phase 1: Prepare (Current)

```
Duration: 1-2 days
Focus: Contracts + state management + base UI

Key Tasks:
✅ Update landing-page.contract.ts with draft endpoints
✅ Create useLandingPageEditor hook with LandingPageWithDraft pattern
✅ Create LandingPageEditor main container
✅ Create EditableSection wrapper (reusable for all sections)
✅ Add routing + navigation

Deliverable: Minimal editor UI with working state management
```

### Phase 2: Components (Optimized)

```
Duration: 1.5-2 days (reduced from 2-3 days)
Focus: Section editing with reuse strategy

Key Tasks:
✅ Wrap existing section components (HeroSection, AboutSection, etc.)
✅ Create only new edit UI (EditableImage, EditableList)
✅ Add demo data for new sections
✅ Test each section's editing flow

Deliverable: All 7 sections editable with consistent UX
```

### Phase 3: Integration (Standard)

```
Duration: 1-2 days
Focus: Backend routes + database

Key Tasks:
✅ Implement draft endpoints in Express
✅ Update Tenant repository
✅ Database schema (if needed)
✅ Integration tests

Deliverable: Auto-save + publish/discard flows work end-to-end
```

### Phase 4: Polish (Simplified)

```
Duration: 1-2 days (reduced from 1-2 days, mobile done in Phase 1)
Focus: Error handling + testing

Key Tasks:
✅ Error toasts + loading states
✅ E2E tests
✅ Accessibility audit
✅ Performance verification

Deliverable: Production-ready with full test coverage
```

---

## Files to Create/Modify

### Priority 1 (Phase 1 - BLOCKING)

- ✅ `packages/contracts/src/tenant-admin/landing-page.contract.ts` - Add draft endpoints
- ✅ `client/src/features/tenant-admin/landing-page-editor/hooks/useLandingPageEditor.ts` - Core hook
- ✅ `client/src/features/tenant-admin/landing-page-editor/LandingPageEditor.tsx` - Main container

### Priority 2 (Phase 1 - UNBLOCKING)

- ✅ `client/src/features/tenant-admin/landing-page-editor/components/EditorSidebar.tsx`
- ✅ `client/src/features/tenant-admin/landing-page-editor/components/EditableSection.tsx` (NEW wrapper)
- ✅ `client/src/app/routes.tsx` - Add editor route

### Priority 3 (Phase 2 - COMPONENTS)

- ✅ `client/src/features/tenant-admin/landing-page-editor/sections/EditableHeroSection.tsx`
- ✅ `client/src/features/tenant-admin/landing-page-editor/sections/Editable*.tsx` (6 more)
- ✅ `client/src/features/tenant-admin/landing-page-editor/components/EditableImage.tsx`
- ✅ `client/src/features/tenant-admin/landing-page-editor/components/EditableList.tsx`
- ✅ `client/src/features/tenant-admin/landing-page-editor/demo-data.ts`

### Priority 4 (Phase 3 - BACKEND)

- ✅ `server/src/routes/tenant-admin-landing-page.routes.ts` - Implement draft routes
- ✅ `server/src/adapters/prisma/tenant.repository.ts` - Add draft methods

### Priority 5 (Phase 4 - TESTING)

- ✅ `server/test/routes/tenant-admin-landing-page.routes.test.ts`
- ✅ `e2e/tests/landing-page-editor.spec.ts`

---

## Code Review Checklist

### When reviewing Phase 1 PRs:

- [ ] Contract endpoints match proposed API (4 draft endpoints)
- [ ] Hook state uses `LandingPageWithDraft` (not separate config objects)
- [ ] Error handling mirrors `useVisualEditor` pattern exactly
- [ ] Auto-save uses ref-based batching (not state-based)
- [ ] Mobile sidebar uses Sheet component (responsive)
- [ ] No `any` types (strict mode compliant)
- [ ] All JSDoc comments include batching strategy explanation

### When reviewing Phase 2 PRs:

- [ ] Existing section components are wrapped (not recreated)
- [ ] EditableSection wrapper is reused across all sections
- [ ] EditableImage/EditableList follow EditableText pattern
- [ ] Demo data follows brand voice (read BRAND_VOICE_GUIDE.md)
- [ ] All sections initialize with demo data when added

### When reviewing Phase 3 PRs:

- [ ] Draft endpoints implement all 4 contract methods
- [ ] All queries scoped by `tenantId` (tenant isolation)
- [ ] Integration tests use `createTestTenant()` helper
- [ ] Error responses match API contract schema

### When reviewing Phase 4 PRs:

- [ ] E2E tests cover: load → edit → save → publish
- [ ] E2E tests cover: edit → discard → revert
- [ ] E2E tests cover: mobile responsive layout
- [ ] Lighthouse accessibility > 90
- [ ] All tests passing (unit + integration + E2E)

---

## Key Code Patterns to Follow

### State Management (useLandingPageEditor)

```typescript
// ✅ DO THIS - Single source of truth
interface LandingPageWithDraft {
  published: LandingPageConfig | null;
  draft: LandingPageConfig | null;
  hasDraft: boolean;
  hasChanges: boolean; // Auto-computed
}

// ❌ DON'T DO THIS - Separate state objects
draftConfig: LandingPageConfig | null;
publishedConfig: LandingPageConfig | null;
hasChanges: boolean; // Manual computation
```

### Auto-save Batching (Always)

```typescript
// ✅ DO THIS - Batch all changes, single flush
const pendingChanges = useRef<Map<sectionKey, updates>>();
setTimeout(() => flushPendingChanges(), 1000);

// ❌ DON'T DO THIS - Save immediately or multiple times
onChange={() => api.updateSectionDraft(...)}
```

### Component Wrapping (Phase 2)

```typescript
// ✅ DO THIS - Reuse existing + wrap with edit overlays
<EditableSection>
  <HeroSection {...config}>
    {/* EditableText overlays */}
  </HeroSection>
</EditableSection>

// ❌ DON'T DO THIS - Build from scratch
<EditableHeroSectionFromScratch {...config} />
```

### Error Handling (Always)

```typescript
// ✅ DO THIS - Logger + toast + rollback
logger.error('Failed to save', { component, section, error });
toast.error('Save failed', { description: error.message });
setLandingPage(originalStates.current.get(section));

// ❌ DON'T DO THIS - Only console.log
console.log('Error saving');
```

---

## Testing Strategy

### Unit Tests

- State management (load, update, batch, publish, discard)
- Component rendering (display vs. edit mode)
- Change detection (hasChanges metric)
- Error scenarios (API failures, validation)

### Integration Tests

- Save + load draft cycle
- Publish moves draft to live
- Discard reverts to published
- Tenant data isolation
- All using `createTestTenant()` helper

### E2E Tests

- Full editor workflow (load → edit → save → publish)
- Persistence (edit → reload → verify saved)
- Mobile responsive (sidebar collapse)
- Error recovery (network failure → retry)

**Target Coverage:** >70% (follow CLAUDE.md standards)

---

## Timeline & Effort Estimate

| Phase             | Original     | Recommended    | Notes                         |
| ----------------- | ------------ | -------------- | ----------------------------- |
| 1: Infrastructure | 1-2 days     | 1-2 days       | +1-2 hours for improved state |
| 2: Components     | 2-3 days     | 1.5-2 days     | -1 hour from reuse strategy   |
| 3: Integration    | 1-2 days     | 1-2 days       | No change                     |
| 4: Polish         | 1-2 days     | 1-2 days       | -1 hour (mobile done Phase 1) |
| **TOTAL**         | **5-9 days** | **5-8.5 days** | **Net -0.5 to +1 hour**       |

---

## Success Metrics

### Phase 1 Success

- [ ] Contract compiles without errors
- [ ] Editor page loads without errors
- [ ] Sidebar sections toggle correctly
- [ ] State management works (no race conditions)
- [ ] TypeScript strict mode passes

### Phase 2 Success

- [ ] All 7 sections render with demo data
- [ ] Click-to-edit works on all text fields
- [ ] Image upload works
- [ ] Add/remove items works
- [ ] Changes reflect in preview immediately

### Phase 3 Success

- [ ] Auto-save completes within 500ms
- [ ] Publish endpoint copies draft to live
- [ ] Discard endpoint clears draft
- [ ] "Unsaved changes" indicator works
- [ ] All integration tests pass

### Phase 4 Success

- [ ] E2E tests pass (all scenarios)
- [ ] Lighthouse accessibility > 90
- [ ] Load time < 2 seconds
- [ ] Zero TypeScript errors
- [ ] Code review approved

---

## Decision Log

### State Management: LandingPageWithDraft Pattern

**Decision:** Adopt single `LandingPageWithDraft` object instead of separate `draftConfig`/`publishedConfig`.

**Rationale:**

- Mirrors proven `PackageWithDraft` pattern from visual editor
- Automatic `hasChanges` tracking (no manual computation)
- Easier to understand and debug
- Fewer bugs from state synchronization issues

**Alternative Considered:** Keep separate objects

- **Rejected:** More complex, manual change tracking, inconsistent with existing patterns

**Impact:** +2-3 hours Phase 1, enables -1 hour Phase 2

---

### Component Architecture: Wrap vs. Create

**Decision:** Wrap existing section components instead of creating from scratch.

**Rationale:**

- Eliminates code duplication (reuse HeroSection, AboutSection, etc.)
- Ensures consistency with public landing page
- Simpler to maintain (single source of truth)
- Faster implementation (Phase 2 shortened)

**Alternative Considered:** Build all 7 sections from scratch

- **Rejected:** Duplicates existing components, harder to maintain

**Impact:** -1 to -2 hours Phase 2 (overall time savings)

---

### Mobile UI: Phase 1 vs Phase 4

**Decision:** Implement mobile-responsive sidebar in Phase 1 using Sheet component.

**Rationale:**

- Already have Sheet component (Radix UI)
- Mobile should be first-class, not afterthought
- Avoids Phase 4 rework

**Alternative Considered:** Defer to Phase 4

- **Rejected:** Mobile is important, shouldn't be last priority

**Impact:** No time impact (same effort, better priority)

---

## Next Steps

1. **Immediate (This week):**
   - [ ] Review this analysis with team
   - [ ] Confirm alignment on recommendations
   - [ ] Create implementation task board

2. **Phase 1 Prep:**
   - [ ] Update `landing-page.contract.ts`
   - [ ] Create `useLandingPageEditor` hook
   - [ ] Reference implementation checklist for detailed tasks

3. **During Implementation:**
   - [ ] Follow implementation checklist
   - [ ] Reference pattern comparison for code examples
   - [ ] Use code review checklist for PRs

4. **Post-Implementation:**
   - [ ] Measure time vs. estimate
   - [ ] Document lessons learned
   - [ ] Update team patterns if needed

---

## Questions to Answer Before Starting

- [ ] Are existing section components (HeroSection, etc.) available for wrapping?
- [ ] Should draft storage use Option A (nested JSON) or Option B (separate columns)?
- [ ] Any timeline constraints that affect Phase ordering?
- [ ] Should mobile sidebar be Sheet component or custom drawer?
- [ ] Any existing demo data patterns to follow?

---

## Related Documentation

### In This Analysis

- `PATTERN-ANALYSIS-LANDING-PAGE-EDITOR.md` - Full detailed analysis
- `PATTERN-COMPARISON-VISUAL-EDITOR-vs-LANDING-PAGE.md` - Side-by-side code examples
- `LANDING-PAGE-EDITOR-IMPLEMENTATION-CHECKLIST.md` - Phase-by-phase tasks

### In Codebase

- `/CLAUDE.md` - Baseline patterns and conventions
- `/docs/design/BRAND_VOICE_GUIDE.md` - Brand voice and UI standards
- `/docs/solutions/PREVENTION-STRATEGIES-INDEX.md` - Common pitfall prevention
- `/client/src/features/tenant-admin/visual-editor/` - Reference implementation

---

## Document Info

**Created:** December 4, 2025
**Last Updated:** December 4, 2025
**Status:** Ready for Implementation
**Version:** 1.0

**Analyzer:** Claude Code (Pattern Recognition Specialist)
**Review Status:** Pending team review

---

## How to Use This Index

1. **Quick overview?** → Read "Key Findings at a Glance" section (5 min)
2. **Need implementation guide?** → Go to "Implementation Path Recommendation" (10 min)
3. **Starting Phase 1?** → Open `LANDING-PAGE-EDITOR-IMPLEMENTATION-CHECKLIST.md`
4. **Deep understanding needed?** → Read `PATTERN-COMPARISON-VISUAL-EDITOR-vs-LANDING-PAGE.md` (30 min)
5. **Code review?** → Use "Code Review Checklist" above

---

**Questions?** Reference the full analysis documents or consult the team.
