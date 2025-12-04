# Architecture Review: Landing Page Visual Editor Plan

**Review Date:** 2025-12-04
**Reviewer:** Architecture Strategist
**Status:** FINDINGS DOCUMENTED

---

## Executive Summary

The landing page visual editor plan demonstrates **good foundational architecture** that follows established MAIS patterns from the visual editor. However, it has **3 CRITICAL issues** blocking implementation, **5 IMPORTANT issues** requiring design changes, and **6 SUGGESTIONS** for optimization.

The plan's hook structure is appropriate but oversimplified for the complexity involved. The separation of concerns is adequate but mixing of responsibilities in `useLandingPageEditor` should be addressed. Component reusability is good, but the proposal lacks clarity on editable component patterns and API integration complexity.

---

## CRITICAL ISSUES (Blocking)

### 1. CRITICAL: Oversimplified Hook State Management

**Location:** Plan Section "State Management" (lines 60-96)
**Issue:** The proposed `useLandingPageEditor` hook lacks crucial complexity compared to proven `useVisualEditor` patterns.

**Evidence:**

- Plan hook has: `loadConfig()`, `toggleSection()`, `updateSectionContent()`, `publishChanges()`, `discardChanges()`
- Actual `useVisualEditor` hook (347 lines) implements:
  - Batching strategy for requests (prevents race conditions)
  - Rollback on failure (original state preservation)
  - Debounce with pending changes accumulation
  - Separate save/publish state machines
  - Optimistic UI updates with rollback
  - Request deduplication

**Why This Matters:**
Landing page editor will fail under realistic editing scenarios:

1. User rapidly edits hero headline → about section → FAQ → publishes
2. Network delays cause out-of-order updates
3. One request fails while another succeeds → data inconsistency

**Suggested Fix:**

```typescript
// DO THIS - Comprehensive state management like useVisualEditor
interface UseVisualEditorReturn {
  // State
  draftConfig: LandingPageConfig | null;
  publishedConfig: LandingPageConfig | null;
  hasChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  error: string | null;

  // Actions
  loadConfig(): Promise<void>;
  toggleSection(section: SectionType, enabled: boolean): void;
  updateSectionContent(section: SectionType, content: Partial<SectionConfig>): void;
  publishChanges(): Promise<void>;
  discardChanges(): void;
  updateLocalSectionContent(section: SectionType, content: Partial<SectionConfig>): void;
}

// Implementation requires:
// - Batching with 1s debounce (proven pattern)
// - Accumulated pending changes per section
// - Original state preservation for rollback
// - saveInProgress flag to prevent overlapping requests
// - flushPendingChanges() before publish
```

**Risk Level:** HIGH - Data loss on failures, inconsistent state on network issues

---

### 2. CRITICAL: API Contract Mismatch with Existing Backend Routes

**Location:** Plan Section "API Contract Updates" (lines 497-546)
**Issue:** Proposes 4 new endpoints (getDraft, saveDraft, publishDraft, discardDraft) but backend likely already implements full CRUD.

**Evidence from existing contract:**

```typescript
// packages/contracts/src/tenant-admin/landing-page.contract.ts
export const landingPageAdminContract = c.router({
  getLandingPage: {
    method: 'GET',
    path: '/v1/tenant-admin/landing-page',
    responses: { 200: LandingPageConfigSchema.nullable() },
  },
  updateLandingPage: {
    method: 'PUT',
    path: '/v1/tenant-admin/landing-page',
    body: LandingPageConfigSchema,
    responses: { 200: LandingPageConfigSchema },
  },
  toggleSection: {
    method: 'PATCH',
    path: '/v1/tenant-admin/landing-page/sections',
    body: z.object({ section: z.enum([...]), enabled: z.boolean() }),
    responses: { 200: z.object({ success: z.boolean() }) },
  },
});
```

The plan proposes:

- `GET /v1/tenant-admin/landing-page/draft` (redundant - GET already exists)
- `PUT /v1/tenant-admin/landing-page/draft` (conflicts with existing PUT)
- `POST /v1/tenant-admin/landing-page/publish` (not in contract)
- `DELETE /v1/tenant-admin/landing-page/draft` (not in contract)

**Why This Matters:**

- Plan assumes separate draft/published storage model
- Backend likely implements all-at-once updates via existing PUT
- Will create dual API implementations causing maintenance burden
- Type safety breaks when contracts diverge from backend

**Suggested Fix:**
Verify backend implementation first:

```bash
# Check backend routes
grep -r "landing-page" server/src/routes/*.ts

# Check schema for draft fields
grep -A10 "landingPageConfig\|landingPageDraft" server/prisma/schema.prisma
```

Then align frontend to actual backend. Options:

1. **If backend uses draft fields:** Use existing GET/PUT endpoints, hook manages draft/published locally
2. **If backend stores single config:** Implement auto-save via debounced PUT requests (simpler)

**Risk Level:** HIGH - Type mismatches, failed requests, API contract violations

---

### 3. CRITICAL: Missing Accommodation Section in Plan

**Location:** Plan Section "Phase 2" (lines 131-224)
**Issue:** Editable sections list omits `EditableAccommodationSection` despite schema including it.

**Evidence:**
Plan lists 6 sections to implement:

1. EditableHeroSection
2. EditableSocialProofBar
3. EditableAboutSection
4. EditableTestimonialsSection
5. EditableGallerySection
6. EditableFaqSection
7. EditableFinalCtaSection

But landing page schema (lines 148-157 of contracts) includes:

```typescript
export const AccommodationSectionConfigSchema = z.object({
  headline: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  imageUrl: SafeImageUrlOptionalSchema,
  ctaText: z.string().min(1).max(50),
  ctaUrl: SafeUrlSchema, // Requires full URL validation!
  highlights: z.array(z.string().max(100)).max(8),
});
```

Section exists in LandingPage.tsx:

```typescript
{
  /* Missing from plan */
}
import { AccommodationSection } from './sections/AccommodationSection';
```

**Why This Matters:**

- Incomplete implementation doesn't match schema
- Accommodation has unique requirements (URL CTA, highlights array)
- Missing from sidebar UI means section can't be toggled
- Will cause schema validation failures on publish

**Suggested Fix:**
Add to Phase 2 tasks:

```
- [ ] Create `EditableAccommodationSection.tsx` with:
  - EditableText for headline, description
  - EditableImage for background image upload
  - EditableText for CTA text
  - EditableText for CTA URL (with URL validation feedback)
  - EditableList for highlights (add/remove/edit)
```

**Risk Level:** MEDIUM - Incomplete feature, schema mismatch

---

## IMPORTANT ISSUES (Should Fix)

### 4. IMPORTANT: Typo in LandingPageEditor.tsx Component Spec

**Location:** Plan Section "Component Specifications" (line 310)
**Issue:** Property name typo will cause TypeScript errors.

**Code (line 310):**

```typescript
activesSections={editor.activeSections}  // ❌ activesSections (extra 's')
```

Should be:

```typescript
activeSections={editor.activeSections}  // ✅ activeSections
```

**Impact:** Component won't compile, type checking fails
**Fix:** Single character fix

---

### 5. IMPORTANT: Editable Components Missing Image Upload Validation

**Location:** Plan "Component Specifications" for EditableHeroSection (lines 405-463)
**Issue:** `EditableImage` component referenced but not defined. Pattern for image validation unclear.

**Evidence:**

```typescript
<EditableImage
  currentUrl={config.backgroundImageUrl}
  onUpload={(url) => onUpdate({ backgroundImageUrl: url })}
  className="absolute inset-0"
/>
```

But visual editor uses `PhotoDropZone` for package photos with:

- File type validation (JPEG, PNG, WebP)
- Size limits (5MB)
- Upload progress
- Error handling
- Reordering support

**Why This Matters:**
Landing page image uploads need different behavior:

- Single image selection (not multi-photo grid)
- URL-based (not file upload to storage)
- SafeImageUrlSchema validation (XSS prevention)
- Possibly different sizing/compression

**Suggested Fix:**
Define concrete `EditableImage` component first:

```typescript
// client/src/features/tenant-admin/landing-page-editor/components/EditableImage.tsx
interface EditableImageProps {
  currentUrl: string | undefined;
  onUpload: (url: string) => void;
  onRemove: () => void;
  placeholder?: string;
  aspectRatio?: 'square' | '16/9' | 'auto';
  disabled?: boolean;
}

export function EditableImage({
  currentUrl,
  onUpload,
  onRemove,
  // ... implement with PhotoDropZone patterns
}: EditableImageProps) {
  // ...
}
```

**Risk Level:** MEDIUM - Component gaps block implementation

---

### 6. IMPORTANT: Missing EditableList Component for Array Fields

**Location:** Plan lists "EditableList" as to-be-created (line 148) but never specifies it.
**Issue:** Testimonials, FAQ, and Accommodation sections require add/edit/remove for array items.

**Evidence:**

```typescript
// Testimonials need this:
const testimonials = [
  { quote: '...', author: '...', role: '...', rating: 5 },
  { quote: '...', author: '...', role: '...', rating: 5 },
];

// FAQ needs this:
const faqItems = [
  { question: '...', answer: '...' },
  { question: '...', answer: '...' },
];

// Accommodation needs this:
const highlights = ['...', '...', '...'];
```

But plan only says "Add/edit/remove works on Testimonials, FAQ items" without defining component.

**Suggested Fix:**
Specify `EditableList` implementation strategy:

```typescript
// Generic pattern for list editing
interface EditableListProps<T> {
  items: T[];
  onUpdate: (items: T[]) => void;
  renderItem: (
    item: T,
    index: number,
    onEdit: (updated: T) => void,
    onRemove: () => void
  ) => React.ReactNode;
  onAddNew: () => void;
  disabled?: boolean;
}

// Or separate implementations per type
interface EditableTestimonialsList {
  items: TestimonialItem[];
  onUpdate: (items: TestimonialItem[]) => void;
  disabled?: boolean;
}
```

**Risk Level:** MEDIUM - Blocks Phase 2 implementation

---

### 7. IMPORTANT: Demo Data Structure Mismatch with Schema

**Location:** Plan Section "Demo Data Structure" (lines 154-211)
**Issue:** Demo data doesn't fully match schema requirements.

**Example - Testimonials:**

```typescript
// Plan (line 172-178) - INCOMPLETE
testimonials: {
  headline: 'What Our Customers Say',
  items: [
    {
      quote: 'Amazing experience! Highly recommended.',
      author: 'Happy Customer',
      role: 'Verified Client',
      rating: 5,
    },
  ],
},

// Schema requires (landing-page.ts line 127-135)
export const TestimonialItemSchema = z.object({
  quote: z.string().min(1).max(1000),
  author: z.string().min(1).max(100),
  role: z.string().max(100).optional(),
  imageUrl: SafeImageUrlOptionalSchema,  // ❌ Missing in demo
  rating: z.number().int().min(1).max(5),
});
```

Similar issues with:

- **Gallery**: Demo has empty `images: []`, but schema requires `min(1)`
- **SocialProofBar**: Icon enum not validated
- **Accommodation**: No highlights in demo, but schema shows it's important

**Why This Matters:**

- Demo data that doesn't validate will fail on first add
- Users see confusing validation errors
- Schema and demo diverge, making maintenance harder

**Suggested Fix:**
Align demo data exactly with schema:

```typescript
gallery: {
  headline: 'Our Gallery',
  images: [
    {
      url: 'https://via.placeholder.com/600x400',
      alt: 'Sample gallery image',
    },
  ],
  instagramHandle: undefined,
},

accommodation: {
  headline: 'Local Accommodations',
  description: 'We partner with these excellent local accommodations...',
  imageUrl: undefined,
  ctaText: 'View Accommodations',
  ctaUrl: 'https://airbnb.com',
  highlights: ['Wifi', 'Parking', 'Breakfast'],
},
```

**Risk Level:** MEDIUM - Validation errors on new sections

---

### 8. IMPORTANT: Database Schema Ambiguity (Option A vs B)

**Location:** Plan Section "Database Changes" (lines 465-495)
**Issue:** Recommends Option A (nested draft/published) but doesn't verify existing schema.

**Current Tenant model likely has:**

```prisma
model Tenant {
  id String @id
  name String
  landingPageConfig Json?  // Existing field
  // ... other fields
}
```

Plan suggests wrapping in structure:

```typescript
{
  draft: LandingPageConfig | null,
  published: LandingPageConfig | null,
  draftUpdatedAt: string | null,
  publishedAt: string | null,
}
```

**Why This Matters:**

1. If `landingPageConfig` is already in use by storefront, migration is needed
2. Changing structure breaks existing storefront display logic
3. No migration cost analysis provided
4. Need to verify LandingPage.tsx actually reads from `tenant.branding?.landingPage`

**Suggested Fix:**
Before implementation, verify:

```bash
# Check current schema
grep -A5 "landingPageConfig" server/prisma/schema.prisma

# Check storefront usage
grep -r "landingPageConfig\|branding?.landingPage" client/src/features/storefront/
```

Then commit to one approach:

- **Approach 1 (Recommended):** Nested object with versions (as planned)
- **Approach 2 (Simpler):** Single config field + debounced saves (no draft/publish)
- **Approach 3 (Current):** Just read from existing field, no migration needed

**Risk Level:** MEDIUM - Database migration complexity

---

## SUGGESTIONS (Nice to Have)

### 9. SUGGESTION: Reuse PhotoDropZone Instead of Custom EditableImage

**Location:** Plan "EditableImage" component specification
**Finding:** PhotoDropZone already exists (PhotoDropZone.tsx, 200+ lines) with proven patterns.

**Current Implementation:**

- Drag & drop support
- File validation (type, size)
- Preview with delete button
- Reorder support (grip handles)
- Upload progress tracking
- Error handling with toast

**Suggestion:**
Extract single-image variant of PhotoDropZone:

```typescript
// client/src/features/tenant-admin/landing-page-editor/components/EditableImage.tsx
export function EditableImage({ currentUrl, onUpload, disabled }: EditableImageProps) {
  return (
    <PhotoDropZone
      packageId="landing-page"  // Use consistent ID
      photos={currentUrl ? [{ url: currentUrl }] : []}
      onPhotosChange={(photos) => onUpload(photos[0]?.url || '')}
      maxPhotos={1}
      disabled={disabled}
    />
  );
}
```

**Benefits:**

- Reduces code duplication
- Consistent upload behavior across features
- Inherits PhotoDropZone improvements automatically
- Saves ~100 lines of code

**Effort:** Low - ~30 minutes

---

### 10. SUGGESTION: Consider Segment Selector Immutability

**Location:** Plan Section "Architecture" (line 44)
**Comment:** "SegmentSelector (Always visible)" - but no way to toggle it off.

**Current LandingPageSectionsSchema:**

```typescript
segmentSelector: z.boolean().default(true),
```

And sidebar says:

```typescript
{/* Segment Selector - Always visible */}
<SegmentSelectorSection />
```

**Question:** Should segmentSelector be:

1. **Immutable by design** (always true, not in sidebar)?
   - Simpler logic
   - Clear intent (segment selector is core)
   - Matches "Apple-style closed system" principle
2. **Toggleable** (editable in sidebar)?
   - More flexibility
   - Added complexity
   - Plan doesn't handle UI for disabled selector

**Recommendation:** Make immutable in code:

```typescript
// Instead of toggleable section
export const LandingPageSectionsSchema = z.object({
  hero: z.boolean().default(false),
  // ... other optional sections
  // Removed: segmentSelector (always included)
});

// In sidebar, never show option to toggle
{activeSections.filter(s => s !== 'segmentSelector').map(...)}
```

**Impact:** Simplifies state, matches design intent

---

### 11. SUGGESTION: Add E2E Test Strategy Clarity

**Location:** Plan Section "Phase 4" (lines 281-296)
**Finding:** Lists "E2E tests for editor workflow" but no specifics.

**Recommend adding to Phase 4:**

```
- [ ] E2E test: Load editor → add hero section → edit headline → publish → verify live
- [ ] E2E test: Load editor → add testimonials → add 2 testimonials → remove 1 → publish
- [ ] E2E test: Load editor → edit FAQ → discard changes → verify reverted
- [ ] E2E test: Network failure → discard draft → reload → verify recovery
- [ ] E2E test: Concurrent edits → multiple sections → publish → verify all applied

Test file structure:
client/src/features/tenant-admin/landing-page-editor/__tests__/landing-page-editor.spec.ts
```

**Benefits:**

- Matches existing test patterns
- Prevents regressions
- Documents expected behavior
- Supports Playwright E2E approach

---

### 12. SUGGESTION: Error Recovery Strategy for Failed Publishes

**Location:** Plan "Risk Analysis" (lines 593-600)
**Finding:** No explicit error recovery in `publishChanges()`.

**Risks not addressed:**

1. User clicks publish → network fails → state inconsistency
2. Partial publish succeeds (some sections sent, others fail)
3. Draft cleared before publish completes

**Suggest adding to Phase 3:**

```typescript
// In useLandingPageEditor hook
const publishChanges = useCallback(async () => {
  if (!hasChanges) {
    toast.info('No changes to publish');
    return;
  }

  // Lock UI EARLY (prevent new edits during publish)
  setIsPublishing(true);

  try {
    // Flush pending saves first (like useVisualEditor does)
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    await flushPendingChanges();

    // Then publish
    const { status, body } = await api.tenantAdminPublishLandingPage({
      body: { config: draftConfig },
    });

    if (status !== 200) {
      throw new Error('Publish failed');
    }

    // Only clear draft AFTER successful publish
    setDraftConfig(null);
    toast.success('Landing page published');
  } catch (err) {
    toast.error('Failed to publish', {
      description: 'Your changes are saved as draft. Please try again.',
    });
    // Draft is preserved for retry
  } finally {
    setIsPublishing(false);
  }
}, [hasChanges, draftConfig, flushPendingChanges]);
```

**Benefits:**

- Prevents data loss on failure
- Clear error messaging
- Automatic draft preservation

---

## File Organization Assessment

### Strengths

✅ **Correct directory structure** follows visual-editor patterns:

```
client/src/features/tenant-admin/landing-page-editor/
├── LandingPageEditor.tsx              # Main container ✓
├── components/
│   ├── EditorSidebar.tsx              # Section toggles ✓
│   ├── SectionCard.tsx                # Individual section card ✓
│   ├── EditorToolbar.tsx              # Publish/Discard ✓
│   ├── EditableImage.tsx              # Image upload (needs definition)
│   └── EditableList.tsx               # Array item editing (needs definition)
├── sections/
│   ├── EditableHeroSection.tsx        # ✓
│   ├── EditableSocialProofBar.tsx      # ✓
│   ├── EditableAboutSection.tsx       # ✓
│   ├── EditableTestimonialsSection.tsx # ✓
│   ├── EditableGallerySection.tsx     # ✓
│   ├── EditableFaqSection.tsx         # ✓
│   ├── EditableAccommodationSection.tsx # ❌ Missing from plan
│   └── EditableFinalCtaSection.tsx    # ✓
├── hooks/
│   └── useLandingPageEditor.ts        # State management
├── demo-data/
│   └── section-defaults.ts            # Default values
└── index.ts                           # Barrel export
```

✅ **Naming conventions** follow codebase patterns (EditableText, useVisualEditor, etc.)
✅ **Barrel exports** via index.ts matches visual-editor pattern
✅ **Separation into hooks/components/sections** mirrors existing architecture

### Weaknesses

⚠️ **Missing component definitions:**

- `EditableImage` referenced but not specified
- `EditableList` listed but undefined
- No pattern for inline list editing specified

⚠️ **Index.ts exports** not shown:

- Should follow visual-editor pattern of exporting all editable sections
- Make sure to include: `EditableAccommodationSection` (when added)

⚠️ **Test structure** not defined:

- Where should `useLandingPageEditor.test.ts` go?
- Where should E2E tests go?
- Should follow `//__tests__` pattern like visual-editor

---

## State Management Assessment

### Hook Complexity Analysis

**useVisualEditor (Proven):**

- 354 lines of code
- 7 state variables (packages, loading, error, isSaving, isPublishing, saveTimeout, pendingChanges)
- 6 methods + 2 internal utilities
- Handles: batching, debouncing, rollback, optimistic updates, race condition prevention
- Timeout management on cleanup
- Error recovery with toast notifications

**Proposed useLandingPageEditor (Simplified):**

- Estimated 200-250 lines
- 7 state variables (draftConfig, publishedConfig, hasChanges, isLoading, isSaving, isPublishing, error)
- 5 methods
- Missing: batching, rollback, optimistic updates, race condition prevention

**Assessment:** ⚠️ UNDERSIZED for expected complexity

The hook needs to handle:

- Multiple section types (7 different schemas)
- Nested content (testimonial arrays, FAQ items)
- Concurrent edits to different sections
- Network failures with rollback
- Auto-save with debounce

**Recommendation:** Start with useVisualEditor as template, adapt for landing page context.

---

## Integration Patterns Assessment

### Positive Patterns

✅ **Follows ts-rest contract pattern:**

- API client calls are type-safe
- Matches existing landingPageAdminContract
- Enables compiler-time validation

✅ **Uses existing infrastructure:**

- Reuses EditableText component patterns
- Leverages PhotoDropZone for images
- Uses existing toast/dialog components
- Follows tenant middleware for auth

✅ **Mirrors visual-editor UX patterns:**

- Floating action bar for publish/discard
- Draft count indicators
- Confirmation dialogs
- Optimistic UI updates

### Gaps

⚠️ **API contract verification needed** - Proposed endpoints don't match existing contract
⚠️ **Image upload pattern unclear** - PhotoDropZone vs custom EditableImage decision needed
⚠️ **Array item editing pattern missing** - How do users add/edit/remove testimonials?

---

## Reusability Assessment

### High Reusability

- **EditableText** - Already exists, can be reused as-is
- **EditableImage** - Once defined, can be used for Hero, About, Gallery background
- **EditableList** - Once defined, can be used for Testimonials, FAQ, Highlights
- **useVisualEditor patterns** - Can be adapted for landing page context

### Medium Reusability

- **Section components** - Currently immutable, editable versions needed
  - Can reuse layout structure from HeroSection, AboutSection, etc.
  - Add editing overlays/controls on top
- **Demo data** - Can be extracted to shared constants

### Low Reusability

- **useLandingPageEditor** - Highly specific to landing page state model
- **EditorSidebar** - Different from visual editor sidebar (sections vs packages)
- **SectionCard** - Specific to landing page sections

---

## TypeScript Compliance Assessment

**Plan adherence to strict mode:** ✅ GOOD

Positive:

- No `any` types mentioned
- Props interfaces explicitly defined
- Schema imports from contracts
- Zod validation suggested for demo data

Concerns:

- "req: any" pattern noted in CLAUDE.md for ts-rest (acknowledged as library limitation)
- Component ref handling needs careful typing (see EditableText for pattern)
- Generic `EditableList<T>` will need proper generic constraints

---

## Testing Approach Assessment

**Current Plan (Phase 4):** Minimal specificity

- "E2E tests for editor workflow"
- "Unit tests for useLandingPageEditor hook"
- "Edge cases (empty config, partial saves, network errors)"

**Recommended Structure:**

```typescript
// __tests__/useLandingPageEditor.test.ts
describe('useLandingPageEditor', () => {
  it('should load initial config with sections', async () => {});
  it('should toggle sections on/off', () => {});
  it('should debounce updates with 1s window', async () => {});
  it('should batch updates to same section', () => {});
  it('should publish and clear draft', async () => {});
  it('should discard and revert to published', async () => {});
  it('should rollback on failed save', async () => {});
  it('should handle network errors gracefully', async () => {});
});

// landing-page-editor.spec.ts (E2E)
describe('Landing Page Editor', () => {
  it('should load editor page at /tenant/landing-page', async () => {});
  it('should add hero section with demo data', async () => {});
  it('should edit hero headline inline', async () => {});
  it('should publish changes and verify live', async () => {});
  it('should discard changes with confirmation', async () => {});
  it('should handle network failure gracefully', async () => {});
});
```

---

## Summary Table

| Category                   | Rating | Status     | Notes                                                                |
| -------------------------- | ------ | ---------- | -------------------------------------------------------------------- |
| **Component Architecture** | 7/10   | GOOD       | Follows patterns but missing EditableImage/EditableList specs        |
| **State Management**       | 6/10   | NEEDS WORK | Hook is oversimplified; needs batching/rollback like useVisualEditor |
| **Separation of Concerns** | 8/10   | GOOD       | Clear layer separation (hooks/components/sections)                   |
| **API Integration**        | 5/10   | CRITICAL   | Contract mismatch with existing backend endpoints                    |
| **Database Design**        | 6/10   | IMPORTANT  | Option A assumes draft/published split - needs verification          |
| **Reusability**            | 7/10   | GOOD       | Reuses EditableText, PhotoDropZone; creates new composable pieces    |
| **File Organization**      | 8/10   | GOOD       | Clear structure matching visual-editor pattern                       |
| **TypeScript Compliance**  | 8/10   | GOOD       | Strict types, interfaces defined, schema validation planned          |
| **Testing Strategy**       | 5/10   | IMPORTANT  | High-level plan but lacks specifics                                  |
| **Accessibility**          | 7/10   | GOOD       | Inherits from base components, needs verification                    |

---

## Blocking Order for Implementation

**Do This First (Resolve Critical Issues):**

1. ✅ Verify backend contract and schema (`server/src/routes/tenant-admin-landing-page.routes.ts`)
2. ✅ Decide on draft/published storage model (Option A vs B vs simplified)
3. ✅ Define `EditableImage` component spec (single vs multi-image, URL vs file upload)
4. ✅ Define `EditableList` component spec (generic vs per-type, add/edit/remove UX)
5. ✅ Add `EditableAccommodationSection` to plan

**Then Proceed (Phase 1-4):**

1. Phase 1: Core infrastructure (route, layout, toolbar, sidebar)
2. Phase 2: Editable section components (with proper EditableImage/EditableList)
3. Phase 3: Draft system and API integration (with batching/rollback like useVisualEditor)
4. Phase 4: Polish and testing (with specific E2E test cases)

---

## Recommendations for Better Foundation

### Immediate Actions (Before Coding)

1. **Read useVisualEditor completely** - copy batching strategy wholesale
2. **Verify backend schema** - grep for landingPageConfig, draftConfig
3. **Create Figma spec** - EditorSidebar, EditableImage inline editing, EditableList UI
4. **Write API integration test first** - ensure contract matches reality

### Code-First Actions

1. **Start with hook** - implement useLandingPageEditor from useVisualEditor template
2. **Create reusable primitives** - EditableImage, EditableList (generic components)
3. **Build sections second** - EditableHeroSection, EditableAboutSection, etc.
4. **Wire UI last** - LandingPageEditor, EditorSidebar, EditorToolbar

### Quality Gates

- [ ] useLandingPageEditor handles 50+ rapid edits without race conditions
- [ ] Failed publishes preserve draft for retry
- [ ] E2E test: add 3 sections → publish → reload → all still visible
- [ ] Type checking passes (`npm run typecheck`)
- [ ] All tests pass (`npm test`)

---

## References

**Existing Code Patterns:**

- `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts` (354 lines - use as template)
- `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/visual-editor/VisualEditorDashboard.tsx` (305 lines - UI pattern)
- `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/visual-editor/components/EditableText.tsx` (173 lines - inline editing)
- `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/visual-editor/components/PhotoDropZone.tsx` (image handling)

**Contracts:**

- `/Users/mikeyoung/CODING/MAIS/packages/contracts/src/landing-page.ts` (schema definitions)
- `/Users/mikeyoung/CODING/MAIS/packages/contracts/src/tenant-admin/landing-page.contract.ts` (API contract)

**Components:**

- `/Users/mikeyoung/CODING/MAIS/client/src/features/storefront/landing/sections/HeroSection.tsx` (read-only pattern)

---

**Report Created:** 2025-12-04
**Next Review:** After critical issues resolved (post-backend verification)
