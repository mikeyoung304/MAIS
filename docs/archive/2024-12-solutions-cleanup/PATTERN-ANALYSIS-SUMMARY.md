# Landing Page Editor Pattern Analysis - Executive Summary

**Plan:** `/plans/feat-landing-page-visual-editor.md`
**Status:** ✅ READY FOR IMPLEMENTATION (with optimizations)

---

## Quick Findings

### Critical Issues: NONE ✅

No violations of established patterns detected.

### Important Issues: 5

| #   | Issue                                | Impact  | Fix                                                          |
| --- | ------------------------------------ | ------- | ------------------------------------------------------------ |
| 1   | Hook naming consistency              | Low-Med | Rename to `useLandingPageSectionEditor` for clarity          |
| 2   | Duplicate state management           | Med     | Use `LandingPageWithDraft` pattern like `PackageWithDraft`   |
| 3   | Auto-save strategy undocumented      | Low     | Add JSDoc explaining batching for race condition prevention  |
| 4   | EditableImage component missing spec | Med     | Define two variants: simple (picker) vs. advanced (upload)   |
| 5   | Draft API endpoints not in contract  | Med     | Add draft management endpoints to `landing-page.contract.ts` |

### Suggestions: 7

| #   | Suggestion                              | Impact | Priority |
| --- | --------------------------------------- | ------ | -------- |
| 1   | Create `EditableSection` base wrapper   | High   | Phase 1  |
| 2   | Replicate error handling pattern        | High   | Phase 1  |
| 3   | Reuse existing section components       | High   | Phase 2  |
| 4   | Verify schema alignment with public API | Med    | Phase 1  |
| 5   | Implement mobile sidebar in Phase 1     | Med    | Phase 1  |
| 6   | Add typecheck to acceptance criteria    | Low    | Phase 1  |
| 7   | Document test isolation pattern         | Low    | Phase 4  |

---

## Key Alignments

### Following CLAUDE.md Patterns ✅

- Multi-tenant isolation (implicit in routes)
- TypeScript strict mode (no `any` types proposed)
- API contracts with Zod + ts-rest
- Layered architecture (routes → services → adapters)
- Draft/publish workflow matches visual editor

### Reusing Existing Components ✅

- EditableText: Perfect for all text fields
- PhotoDropZone: Reuse for gallery
- VisualEditorDashboard structure: Good template

### Deviations (Good Reasons) ✅

- Separate demo-data.ts file (better than inline)
- 7 section components (necessary for domain separation)

---

## Recommended Changes

### Phase 1 (Efficiency improvements)

```
Current: 1-2 days
Recommended: 1-2 days (same)
Changes:
- Update landing-page.contract.ts with draft endpoints
- Create EditableSection wrapper for reusability
- Use LandingPageWithDraft state pattern
- Add mobile sidebar (Sheet component)
```

### Phase 2 (Code reduction)

```
Current: 2-3 days (create 7 new sections from scratch)
Recommended: 1.5-2 days (wrap existing components)
Changes:
- Wrap existing HeroSection, AboutSection, etc.
- Only create unique edit UI (EditableImage, EditableList)
```

### Overall Impact

- **Net time:** -1 to +0.5 hours
- **Code quality:** Significantly improved
- **Consistency:** Better alignment with visual editor

---

## Files Affected

### Need Review/Update

- `/packages/contracts/src/tenant-admin/landing-page.contract.ts` - Add draft endpoints
- `/client/src/features/tenant-admin/landing-page-editor/hooks/useLandingPageEditor.ts` - Use `LandingPageWithDraft`

### Good As-Is

- Phase 2+ component specs (EditableHeroSection, etc.)
- Auto-save strategy (1s debounce + batching)
- API integration approach

### Cross-Reference

- `/client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts` - Mirror patterns
- `/packages/contracts/src/landing-page.ts` - Verify schema alignment

---

## Test Strategy

**Recommended additions to Phase 4:**

```typescript
// Integration test (test isolation)
import { createTestTenant } from '../helpers/test-tenant';

test('should auto-save draft after 1s', async () => {
  const { tenantId } = await createTestTenant();
  // Edit → wait 1s → verify backend received update
});

// E2E test
test('landing page editor flow', async () => {
  // 1. Navigate to /tenant/landing-page
  // 2. Toggle section on (initialize with demo data)
  // 3. Edit content
  // 4. Publish
  // 5. Verify published on public landing page
});
```

---

## Next Steps

1. **Review IMPORTANT recommendations** in full analysis
2. **Implement in order:**
   - Phase 1: Contract updates + state pattern
   - Phase 2: Component wrapping strategy
   - Phase 3: Backend routes (unchanged)
   - Phase 4: Polish + tests (mobile already done)
3. **Reference files:**
   - `/docs/solutions/PATTERN-ANALYSIS-LANDING-PAGE-EDITOR.md` - Full analysis
   - `/CLAUDE.md` - Baseline patterns
   - `/client/src/features/tenant-admin/visual-editor/` - Template to follow

---

**Analysis Date:** 2025-12-04
**Analyzer:** Claude Code (Pattern Recognition Specialist)
**Full Report:** See `PATTERN-ANALYSIS-LANDING-PAGE-EDITOR.md`
