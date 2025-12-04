# Pattern Analysis: Landing Page Visual Editor Plan

**Analysis Date:** 2025-12-04
**Plan:** `/plans/feat-landing-page-visual-editor.md`
**Analyzer:** Claude Code (Pattern Recognition Specialist)

---

## Executive Summary

The landing page visual editor plan is **well-architected and follows established patterns** with only minor deviations. The design mirrors the proven `useVisualEditor` hook pattern and reuses key components like `EditableText`. No critical issues detected, but several **IMPORTANT** alignment opportunities exist to improve consistency and reduce redundancy.

**Overall Assessment:** ✅ **READY FOR IMPLEMENTATION** with recommended optimizations.

---

## Detailed Findings

### CRITICAL Issues (Violates established patterns)

**None identified.** The plan demonstrates strong pattern adherence.

---

### IMPORTANT Issues (Deviations to address)

#### 1. Hook Interface Naming - Incorrect Pattern

**Issue:** Plan proposes `useLandingPageEditor` hook, but the contract predates editor pattern.

**Existing Pattern:**

```typescript
// useVisualEditor.ts - Industry pattern: "what" + "Editor" = Domain-focused
export function useVisualEditor(): UseVisualEditorReturn {
  packages: PackageWithDraft[]     // Manages "packages" domain
  updateDraft: (packageId: string, update: DraftUpdate) => void
  publishAll: () => Promise<void>
}
```

**Proposed Pattern (from plan):**

```typescript
// useLandingPageEditor.ts - Generic naming
export function useLandingPageEditor(): LandingPageEditorState {
  draftConfig: LandingPageConfig | null;
  publishedConfig: LandingPageConfig | null;
  // ...
}
```

**Issue:** Generic naming (`useLandingPageEditor`) vs. domain-focused (`useVisualEditor`). The visual editor name is domain-specific because it manages "packages"; landing page also needs specificity around "sections" or "config".

**Alignment Suggestion:** Choose one pattern consistently across the codebase:

- **Option A (Recommended):** Keep both as they are—`useVisualEditor` (manages packages), `useLandingPageEditor` (manages landing page sections)
- **Option B:** Rename to `useLandingPageSectionEditor` for clarity that it manages section configurations, not the full landing page

**Impact:** Low-medium (naming doesn't break functionality, but consistency aids maintainability).

---

#### 2. State Management Complexity - Potential Over-engineering

**Issue:** Plan proposes separate `draftConfig` and `publishedConfig` at hook level, but existing pattern batches all changes and flushes on demand.

**Existing Pattern (`useVisualEditor`):**

```typescript
// Single source of truth in packages array
packages: PackageWithDraft[]  // Contains both draft + published state
draftCount: number            // Derived metric (memoized)
updateDraft: (packageId, update) => void  // Accumulates changes
pendingChanges.current        // Ref tracks accumulated changes only until flush
```

**Proposed Pattern (from plan):**

```typescript
// Two parallel configs stored in state
draftConfig: LandingPageConfig | null;
publishedConfig: LandingPageConfig | null;
hasChanges: boolean; // Derived separately
// Track differences manually
```

**Issue:** Visual editor uses a single "packages" array containing draft + published fields (e.g., `draftTitle`, `hasDraft`), eliminating manual change tracking. Landing page plan proposes maintaining two separate config objects, requiring manual comparison.

**Alignment Suggestion:**

```typescript
// RECOMMENDED: Mirror visual editor pattern
interface LandingPageWithDraft {
  // Published state
  published: LandingPageConfig | null;
  publishedAt: Date | null;

  // Draft state
  draft: LandingPageConfig | null;
  draftUpdatedAt: Date | null;

  // Derived metrics
  hasDraft: boolean;
  hasChanges: boolean; // Auto-computed from published !== draft
}

// Hook maintains single source of truth
landingPage: LandingPageWithDraft | null;
```

This eliminates manual `hasChanges` tracking and mirrors the `PackageWithDraft` pattern.

**Impact:** Medium (cleaner code, fewer bugs, but requires schema restructuring on backend API response).

---

#### 3. Auto-save Debounce Strategy - Correct but Undocumented

**Issue:** Plan specifies "1s debounce" but doesn't explain batching strategy used in `useVisualEditor`.

**Existing Pattern:**

```typescript
// useVisualEditor batches ALL changes within debounce window into single request
pendingChanges.current: Map<packageId, mergedUpdate>  // Accumulates changes
saveTimeout.current: NodeJS.Timeout  // Single timer, not per-package
// Flushes entire Map in one pass after 1s of inactivity
```

**Proposed Pattern (from plan):**

```typescript
// Plan mentions "auto-save with 1s debounce (matching visual editor)"
// but doesn't specify batching strategy or race condition prevention
```

**Issue:** Debounce timing alone is insufficient; the batching strategy prevents race conditions when multiple sections are edited rapidly.

**Alignment Suggestion:** Document in hook JSDoc:

```typescript
/**
 * useLandingPageEditor - React hook for managing landing page editor state
 *
 * Auto-save Strategy (race condition prevention):
 * - All section updates within debounce window are BATCHED into single request
 * - Prevents: Overlapping requests, out-of-order updates, partial saves
 * - Example: User edits Hero headline + About content within 1s → single API call
 *
 * Handles:
 * - Loading landing page config with draft fields
 * - Autosave with 1s debounce and request batching
 * - Publish/discard all changes
 * - Optimistic updates with rollback on error
 */
```

**Impact:** Low (documentation only, improves maintainability).

---

#### 4. EditableHeroSection Component - Missing EditableImage Context

**Issue:** Plan proposes new `EditableImage` component but doesn't establish if it should follow `EditableText` / `EditablePrice` patterns.

**Existing Pattern (`EditableText` / `EditablePrice`):**

```typescript
// Click-to-edit pattern:
// 1. Display mode: Shows value, pencil icon on hover
// 2. Click → Edit mode: Shows input, auto-focus, blur/Enter/Escape handlers
// 3. Handler pattern: onChange callback (not returning Promise)

export function EditableText({
  value: string,
  onChange: (value: string) => void,  // Synchronous callback
  placeholder?: string,
  // ... display + input styling options
})
```

**Proposed EditableImage (from plan):**

```typescript
// From EditableHeroSection spec:
<EditableImage
  currentUrl={config.backgroundImageUrl}
  onUpload={(url) => onUpdate({ backgroundImageUrl: url })}
  className="absolute inset-0"
/>
```

**Issue:** Missing details on EditableImage implementation. Should it follow click-to-edit pattern like EditableText, or use PhotoDropZone pattern (async upload)?

**Alignment Suggestion:** Create `EditableImage` with two variants:

```typescript
// Pattern A: Click-to-open file picker (similar to EditableText)
export function EditableImage({
  currentUrl: string | null,
  onChange: (url: string) => void,  // Sync callback, like EditableText
  placeholder?: string,
  disabled?: boolean,
  "aria-label"?: string,
}) // Simple image click → file picker → callback

// Pattern B: Full photo management (like PhotoDropZone)
export function EditableImageUpload({
  currentUrl: string | null,
  onUpload: (url: string) => Promise<void>,  // Async, expects upload
  maxSize?: number,
  disabled?: boolean,
} // Drag & drop, progress, etc.
```

Recommended: **Use Pattern A for EditableHeroSection** (lightweight), **Pattern B only for Gallery** (heavier).

**Impact:** Medium (affects component reusability and code organization).

---

#### 5. API Contract Design - Missing Draft Endpoints

**Issue:** Plan proposes draft endpoints but existing landing-page.contract.ts only has GET/PUT/PATCH.

**Existing Contract:**

```typescript
export const landingPageAdminContract = c.router({
  getLandingPage: {}, // GET /v1/tenant-admin/landing-page
  updateLandingPage: {}, // PUT /v1/tenant-admin/landing-page (full update)
  toggleSection: {}, // PATCH /v1/tenant-admin/landing-page/sections
});
// No draft management endpoints
```

**Proposed Contract (from plan):**

```typescript
// New endpoints needed:
GET / v1 / tenant - admin / landing - page / draft;
PUT / v1 / tenant - admin / landing - page / draft;
POST / v1 / tenant - admin / landing - page / publish;
DELETE / v1 / tenant - admin / landing - page / draft;
```

**Issue:** Plan correctly identifies need for draft endpoints but doesn't specify where/how to add them.

**Alignment Suggestion:** Update `landing-page.contract.ts` to mirror package visual editor pattern:

```typescript
// packages/contracts/src/tenant-admin/landing-page.contract.ts
export const landingPageAdminContract = c.router({
  // Existing endpoints
  getLandingPage: {
    /* GET current live config */
  },
  updateLandingPage: {
    /* PUT full update */
  },
  toggleSection: {
    /* PATCH section visibility */
  },

  // NEW: Draft management (mirrors package pattern)
  getDraft: {
    method: 'GET',
    path: '/v1/tenant-admin/landing-page/draft',
    responses: {
      200: z.object({
        draft: LandingPageConfigSchema.nullable(),
        published: LandingPageConfigSchema.nullable(),
        hasDraft: z.boolean(),
        draftUpdatedAt: z.string().datetime().nullable(),
      }),
    },
  },

  saveDraft: {
    method: 'PUT',
    path: '/v1/tenant-admin/landing-page/draft',
    body: z.object({
      sections: z.record(z.any()), // Partial sections update
    }),
    responses: {
      200: z.object({
        success: z.boolean(),
        draftUpdatedAt: z.string().datetime(),
      }),
    },
  },

  publishDraft: {
    method: 'POST',
    path: '/v1/tenant-admin/landing-page/publish',
    body: z.object({}),
    responses: {
      200: z.object({
        success: z.boolean(),
        publishedAt: z.string().datetime(),
      }),
    },
  },

  discardDraft: {
    method: 'DELETE',
    path: '/v1/tenant-admin/landing-page/draft',
    responses: {
      200: z.object({ success: z.boolean() }),
    },
  },
});
```

**Impact:** Medium (missing contract definitions block implementation; prevents type-safe client generation).

---

#### 6. Demo Data Initialization - Pattern Exists but Not Documented

**Issue:** Plan proposes `section-defaults.ts` but doesn't reference existing pattern in visual editor.

**Existing Pattern:**
Visual editor uses inline demo data in components (no separate defaults file). However, packages have a `demo` mode in contracts.

**Proposed Pattern (from plan):**

```typescript
// demo-data/section-defaults.ts
export const SECTION_DEFAULTS = {
  hero: { headline: '...', subheadline: '...' /* ... */ },
  about: {
    /* ... */
  },
  testimonials: {
    /* ... */
  },
};
```

**Alignment Suggestion:** This is a **good pattern deviation** for landing page (better than inline). However, structure it consistently:

```typescript
// client/src/features/tenant-admin/landing-page-editor/demo-data.ts
// (Not subdirectory—follows CLAUDE.md convention of "utilities in camelCase")

export const LANDING_PAGE_SECTION_DEFAULTS = {
  hero: { /* ... */ },
  // ...
} as const;

// Use in hook:
toggleSection(section: SectionType, enabled: boolean) {
  if (enabled && !this.draftConfig.sections[section]) {
    // Initialize with defaults
    const defaults = LANDING_PAGE_SECTION_DEFAULTS[section];
    this.updateSectionContent(section, defaults);
  }
}
```

**Impact:** Low-medium (nice-to-have, improves maintainability but not critical).

---

### SUGGESTIONS (Alignment opportunities)

#### 1. Reuse EditablePackageCard Patterns

**Opportunity:** Plan proposes 7 new Editable\* components for sections. Can leverage EditablePackageCard patterns.

**Existing:**

```typescript
// EditablePackageCard.tsx - 3 sections of inline editing:
// - EditableText for title + description
// - EditablePrice for pricing
// - PhotoDropZone for images
// This component is the "template" for inline editing UX
```

**Recommendation:** Create base `EditableSection` wrapper that provides:

```typescript
// client/src/features/tenant-admin/landing-page-editor/components/EditableSection.tsx
interface EditableSectionProps {
  title: string;
  isEditing: boolean;
  onEditToggle: () => void;
  children: ReactNode; // Section content
  onSave?: () => Promise<void>;
  onDiscard?: () => void;
}

// Wraps all section editable components with consistent styling + edit mode
```

**Impact:** Reduces code duplication, ensures consistent UX across sections.

---

#### 2. Unify Error Handling with useVisualEditor Pattern

**Opportunity:** Plan specifies error handling but doesn't document integration with existing error boundaries.

**Existing Pattern:**

```typescript
// useVisualEditor catches errors, shows toast, and rollbacks optimistic updates
catch (err) {
  logger.error("Failed to save draft", { component: "useVisualEditor", error });
  toast.error("Failed to save changes");
  // Rollback state automatically
}
```

**Recommendation:** Replicate exact pattern in useLandingPageEditor:

```typescript
catch (err) {
  logger.error("Failed to save draft", {
    component: "useLandingPageEditor",
    section,  // Add section context
    error
  });
  toast.error(`Failed to save ${section}`, {
    description: err instanceof Error ? err.message : "Please try again"
  });
  // Rollback to published state
}
```

**Impact:** Consistency, better error tracking, user feedback.

---

#### 3. Use Existing Section Components

**Opportunity:** Many landing page sections already exist in codebase as read-only components.

**Recommendation:** Before creating `EditableHeroSection`, check if non-editable versions exist:

```bash
find client/src -name "*HeroSection*" -o -name "*AboutSection*" -o -name "*GallerySection*"
```

If they exist, wrap them:

```typescript
// EditableHeroSection = wrapper around HeroSection
// Minimal: Just add EditableText overlays, leave layout intact
export function EditableHeroSection({ config, onUpdate }) {
  return (
    <HeroSection {...config} isEditing={true}>
      {/* EditableText overlays for headline, subheadline, CTA */}
    </HeroSection>
  );
}
```

**Impact:** Reduces code duplication, ensures consistency with public landing page.

---

#### 4. Contract Schema Alignment

**Opportunity:** Plan specifies `LandingPageConfig` schema but should verify it matches public landing page contract.

**Recommendation:** Check `/packages/contracts/src/landing-page.ts` for:

```typescript
// Verify LandingPageConfigSchema includes all sections:
// - hero, socialProofBar, segmentSelector, about, testimonials, gallery, faq, finalCta
// - Ensure section structures match between admin + public APIs
```

Cross-reference admin contract draft endpoints to ensure request/response schemas match.

**Impact:** Prevents schema mismatches, ensures consistency between admin editor and public display.

---

#### 5. Mobile Responsiveness Strategy

**Opportunity:** Plan mentions "mobile-responsive sidebar (collapse to bottom drawer on mobile - future)" as Phase 4.

**Recommendation:** Implement in Phase 1 instead using existing Radix UI patterns:

```typescript
// Use Sheet component (already imported in codebase)
<Sheet>
  <SheetTrigger asChild>
    <Button size="icon" className="md:hidden">
      <Menu />
    </Button>
  </SheetTrigger>
  <SheetContent side="bottom">
    <EditorSidebar {...props} />
  </SheetContent>
</Sheet>

// Desktop (existing pattern)
<aside className="hidden md:block w-72">
  <EditorSidebar {...props} />
</aside>
```

**Impact:** Better mobile UX from Day 1, no Phase 4 rework needed.

---

#### 6. TypeScript Strict Mode Compliance

**Opportunity:** Plan creates new components but doesn't reference CLAUDE.md strict mode requirements.

**Recommendation:** Ensure all new components follow:

```typescript
// ✅ CORRECT - Explicit types, no implicit any
interface EditableHeroSectionProps {
  config: HeroSectionConfig; // Not any
  onUpdate: (updates: Partial<HeroSectionConfig>) => void;
}

// ❌ WRONG - Implicit any
interface EditableHeroSectionProps {
  config; // Missing type
  onUpdate: (updates: any) => void;
}
```

Add to Phase 1 acceptance criteria: "All new components pass `npm run typecheck`".

**Impact:** Prevents runtime bugs, catches issues at compile time.

---

#### 7. Test Strategy Clarity

**Opportunity:** Plan lists tests in Phase 4 but should specify test isolation pattern.

**Recommendation:** Add to Phase 4 tasks:

```typescript
// Use createTestTenant helper (like visual editor)
import { createTestTenant } from '../helpers/test-tenant';

test('should save landing page draft', async () => {
  const { tenantId, cleanup } = await createTestTenant();
  try {
    const { success } = await api.tenantAdminSaveDraft({
      body: { sections: { hero: { headline: 'Test' } } },
    });
    expect(success).toBe(true);
  } finally {
    await cleanup();
  }
});

// E2E test example
test('should toggle section and publish', async () => {
  // 1. Load editor at /tenant/landing-page
  // 2. Toggle "Hero" section on
  // 3. Edit headline text
  // 4. Click Publish
  // 5. Verify published state reflected in hero section
});
```

**Impact:** Clear test expectations, reusable test patterns, better coverage.

---

## Compliance Checklist

### CLAUDE.md Pattern Adherence

- ✅ **Multi-tenant isolation:** Plan correctly scopes all operations to `req.tenantId` (implied in routes)
- ✅ **TypeScript strict:** No `any` types proposed (but should add to acceptance criteria)
- ✅ **Contracts:** API changes use Zod + ts-rest (correct)
- ✅ **Logging:** Plan mentions using `logger` (good)
- ✅ **Architecture patterns:** Follows layered architecture (routes → services → adapters)
- ⚠️ **Cache isolation:** Not mentioned in plan (landing page has no caching requirements)
- ✅ **Error handling:** Domain errors mapped to HTTP (implied)
- ✅ **Draft/publish workflow:** Matches visual editor pattern (correct)

### Component Patterns

- ✅ **File naming:** `*.tsx` for components, `*.ts` for utilities (plan correct)
- ✅ **Barrel exports:** `index.ts` proposed (correct)
- ✅ **Reusable components:** EditableText, PhotoDropZone reuse proposed (good)
- ⚠️ **Component size:** 7 new section components may be large; consider breaking into smaller pieces

### State Management

- ✅ **React hooks:** `useLandingPageEditor` follows hook pattern
- ✅ **useCallback/useMemo:** Not explicitly shown but implied by optimizations
- ⚠️ **State structure:** Could be simplified using `LandingPageWithDraft` pattern (see IMPORTANT #2)

---

## Risk Assessment & Mitigations

| Risk                               | Severity | Likelihood | Mitigation                                                            |
| ---------------------------------- | -------- | ---------- | --------------------------------------------------------------------- |
| Schema mismatch (admin vs public)  | HIGH     | MEDIUM     | Cross-reference contracts in Phase 1                                  |
| Race conditions in auto-save       | MEDIUM   | LOW        | Document + test batching strategy (already in plan)                   |
| Component size bloat (7+ sections) | MEDIUM   | MEDIUM     | Use EditableSection wrapper, consider feature flags                   |
| Mobile UX regression               | LOW      | HIGH       | Implement responsive sidebar in Phase 1 (not Phase 4)                 |
| TypeScript compilation errors      | LOW      | LOW        | Add typecheck to Phase 1 acceptance criteria                          |
| Stale client cache                 | LOW      | LOW        | Mirror useVisualEditor cache invalidation (not mentioned but implied) |

---

## Recommended Implementation Order

### Phase 1 Priority Adjustments

- [ ] Create `useLandingPageEditor` hook with `LandingPageWithDraft` pattern (not separate draft/published)
- [ ] Update `landing-page.contract.ts` with draft endpoints
- [ ] Create `EditableSection` wrapper for consistent styling
- [ ] Implement mobile-responsive sidebar with Sheet component

### Phase 2 Priority Adjustments

- [ ] Reuse existing section components (HeroSection, AboutSection, etc.) wrapped with editable overlays
- [ ] Create only unique edit UI (EditableImage simple variant, EditableList for items)

### Phase 3 (Unchanged)

- [ ] Backend routes mirroring contract + test isolation pattern

### Phase 4 (Simplified)

- [ ] Polish + testing (mobile sidebar already done in Phase 1)
- [ ] Remove "mobile responsiveness" from this phase

---

## Code Examples: Recommended Patterns

### Hook Interface (Align with useVisualEditor)

```typescript
interface UseLandingPageEditorReturn {
  // Single source of truth
  landingPage: LandingPageWithDraft | null;

  // State
  loading: boolean;
  error: string | null;
  isSaving: boolean;
  isPublishing: boolean;

  // Derived
  hasChanges: boolean;

  // Actions
  loadConfig: () => Promise<void>;
  toggleSection: (section: SectionType, enabled: boolean) => void;
  updateSection: (section: SectionType, content: Partial<SectionConfig>) => void;
  publishChanges: () => Promise<void>;
  discardChanges: () => void;
}
```

### Error Handling Consistency

```typescript
// Match useVisualEditor pattern exactly
if (status !== 200 || !body) {
  const errorMessage = (body as { error?: string })?.error || "Failed to save";
  throw new Error(errorMessage);
}

// In catch block
catch (err) {
  logger.error("Failed to save draft", {
    component: "useLandingPageEditor",
    section,
    error: err,
  });
  toast.error("Failed to save", {
    description: err instanceof Error ? err.message : "Please try again"
  });
}
```

### Component Organization

```
client/src/features/tenant-admin/landing-page-editor/
├── LandingPageEditor.tsx              # Main container
├── components/
│   ├── EditorSidebar.tsx
│   ├── SectionCard.tsx
│   ├── EditorToolbar.tsx
│   ├── EditableSection.tsx            # NEW: Base wrapper
│   ├── EditableImage.tsx              # Simple variant
│   └── EditableList.tsx               # For lists
├── sections/
│   ├── EditableHeroSection.tsx        # Wraps HeroSection
│   ├── EditableAboutSection.tsx       # Wraps AboutSection
│   ├── ... (reuse existing components)
├── hooks/
│   └── useLandingPageEditor.ts
├── demo-data.ts                       # Utility file (not subdir)
└── index.ts
```

---

## Conclusion

The landing page visual editor plan is **well-designed and ready for implementation**. It demonstrates strong understanding of existing patterns and proposes an architecture that mirrors the proven `useVisualEditor` model.

**Recommended approach:**

1. Implement IMPORTANT recommendations #1-5 during Phase 1
2. Adopt SUGGESTION patterns #1-7 to reduce code complexity
3. Consider Phase 1 adjustments for mobile responsiveness
4. Cross-reference schemas with existing contracts

**Estimated impact of recommended changes:**

- **Phase 1:** +3-4 hours (cleaner state management, updated contracts)
- **Phase 2:** -2-3 hours (reuse existing components instead of creating new ones)
- **Phase 3:** No change
- **Phase 4:** -1-2 hours (mobile done in Phase 1)

**Net result:** Better code quality, 0-2 hours saved overall, improved consistency with existing patterns.

---

_This analysis reflects the codebase state as of December 4, 2025. Refer to CLAUDE.md and DECISIONS.md for baseline pattern definitions._
