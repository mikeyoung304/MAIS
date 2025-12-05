# Feature: Landing Page Visual Editor

> **IMPORTANT: Backend is 100% Complete**
> All draft API endpoints, repository methods, and contracts already exist (TODO-202). This plan is **frontend-only implementation**. See "Backend Status" section below.

## Overview

Build a WYSIWYG visual editor for tenant landing pages that mirrors the existing marketplace visual editor experience. Tenants can opt-in to pre-designed section templates (Hero, Testimonials, About, FAQ, Gallery, Accommodation, Final CTA), edit content inline, and publish changes when ready.

**Key Principles:**

- **Apple-style closed system**: Fixed, polished section layouts (no freeform positioning)
- **Marketplace defaults**: Landing page shows only segment selector by default
- **Progressive opt-in**: Tenants add sections from a sidebar gallery
- **Draft workflow**: Auto-save drafts, explicit publish/discard actions
- **WYSIWYG editing**: Click-to-edit inline, see changes in real-time

## Problem Statement

Currently, tenants cannot customize their landing pages without manual database manipulation. The backend CRUD routes exist (TODO-202 complete), but there's no admin UI. Tenants need a simple, visual way to:

1. Enable optional sections (Hero, About, Testimonials, FAQ, Gallery, Accommodation, Final CTA)
2. Edit section content inline (WYSIWYG)
3. Preview changes before publishing
4. Maintain a clean, professional landing page without design skills

---

## Backend Status: COMPLETE ✅

> **Code Review Finding (TODO-246):** The backend draft system is production-ready. Do NOT implement new backend endpoints.

### Existing API Endpoints

All endpoints are implemented at `server/src/routes/tenant-admin-landing-page.routes.ts`:

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/v1/tenant-admin/landing-page` | GET | ✅ Complete | Get published config |
| `/v1/tenant-admin/landing-page` | PUT | ✅ Complete | Update full config |
| `/v1/tenant-admin/landing-page/sections` | PATCH | ✅ Complete | Toggle section visibility |
| `/v1/tenant-admin/landing-page/draft` | GET | ✅ Complete | Get draft + published config |
| `/v1/tenant-admin/landing-page/draft` | PUT | ✅ Complete | Save draft (auto-save target) |
| `/v1/tenant-admin/landing-page/publish` | POST | ✅ Complete | Publish draft to live |
| `/v1/tenant-admin/landing-page/draft` | DELETE | ✅ Complete | Discard draft |

### Existing Repository Methods

All methods are implemented at `server/src/adapters/prisma/tenant.repository.ts`:

- `getLandingPageDraft(tenantId)` - Returns `{ draft, published, draftUpdatedAt, publishedAt }`
- `saveLandingPageDraft(tenantId, config)` - Transactional save with image URL validation
- `publishLandingPageDraft(tenantId)` - Atomic draft→published copy
- `discardLandingPageDraft(tenantId)` - Clears draft, preserves published

### Existing Contracts

All contracts defined at `packages/contracts/src/tenant-admin/landing-page.contract.ts` with complete error codes (400, 401, 404, 500).

### Database Schema

Uses nested JSON wrapper in `Tenant.landingPageConfig`:
```typescript
{
  draft: LandingPageConfig | null,
  published: LandingPageConfig | null,
  draftUpdatedAt: string | null,
  publishedAt: string | null,
}
```

**No migration required** - structure already in production.

---

## Technical Approach

### Architecture

The landing page editor will follow the same patterns as the existing `VisualEditorDashboard`:

```
┌─────────────────────────────────────────────────────────────────┐
│                    LandingPageEditor                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────────────────────────────────┐ │
│  │   Sidebar    │  │           Live Preview Area              │ │
│  │              │  │                                          │ │
│  │ ┌──────────┐ │  │  ┌────────────────────────────────────┐  │ │
│  │ │ Active   │ │  │  │         HeroSection                │  │ │
│  │ │ Sections │ │  │  │  [Click to edit headline]          │  │ │
│  │ │          │ │  │  │  [Click to edit subheadline]       │  │ │
│  │ │ ☑ Hero   │ │  │  └────────────────────────────────────┘  │ │
│  │ │ ☑ About  │ │  │                                          │ │
│  │ │ ☐ FAQ    │ │  │  ┌────────────────────────────────────┐  │ │
│  │ └──────────┘ │  │  │       SegmentSelector              │  │ │
│  │              │  │  │      (Always visible)              │  │ │
│  │ ┌──────────┐ │  │  └────────────────────────────────────┘  │ │
│  │ │Available │ │  │                                          │ │
│  │ │ Sections │ │  │  ┌────────────────────────────────────┐  │ │
│  │ │          │ │  │  │        AboutSection                │  │ │
│  │ │ [+] FAQ  │ │  │  │   [Click to edit content]          │  │ │
│  │ │ [+]Gallery│ │  │  └────────────────────────────────────┘  │ │
│  │ └──────────┘ │  │                                          │ │
│  └──────────────┘  └──────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  [Discard Changes]                              [Publish]       │
└─────────────────────────────────────────────────────────────────┘
```

### State Management (CRITICAL - TODO-247)

> **Code Review Finding:** The hook MUST include batching, rollback, and race condition prevention patterns from `useVisualEditor.ts`. A simple state object is insufficient.

```typescript
// hooks/useLandingPageEditor.ts
// COPY PATTERNS FROM: client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts

// Required refs for race condition prevention
const saveTimeout = useRef<NodeJS.Timeout | null>(null);
const pendingChanges = useRef<Record<string, Partial<SectionConfig>>>({});
const originalConfig = useRef<LandingPageConfig | null>(null);
const saveInProgress = useRef<boolean>(false);

interface LandingPageEditorState {
  draftConfig: LandingPageConfig | null;
  publishedConfig: LandingPageConfig | null;
  hasChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  error: string | null;
}

interface LandingPageEditorActions {
  loadConfig(): Promise<void>;
  toggleSection(section: SectionType, enabled: boolean): void;
  updateSectionContent(section: SectionType, content: Partial<SectionConfig>): void;
  publishChanges(): Promise<void>;
  discardChanges(): void;
}

// CRITICAL: Batching function (from useVisualEditor lines 112-170)
const flushPendingChanges = useCallback(async () => {
  if (saveInProgress.current || Object.keys(pendingChanges.current).length === 0) {
    return;
  }

  const changesToSave = { ...pendingChanges.current };
  const configToRestore = originalConfig.current;
  pendingChanges.current = {};

  saveInProgress.current = true;
  setIsSaving(true);

  try {
    const mergedConfig = mergeChangesIntoConfig(draftConfig, changesToSave);
    const { status } = await api.tenantAdminSaveDraft({ body: mergedConfig });
    if (status !== 200) throw new Error('Save failed');
  } catch (err) {
    // Rollback on failure
    if (configToRestore) {
      setDraftConfig(configToRestore);
    }
    toast.error('Failed to save changes', { description: 'Reverted to last saved state' });
  } finally {
    saveInProgress.current = false;
    setIsSaving(false);
  }
}, [draftConfig]);

// CRITICAL: Flush before publish
const publishChanges = useCallback(async () => {
  if (saveTimeout.current) {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = null;
  }
  await flushPendingChanges();

  setIsPublishing(true);
  try {
    const { status } = await api.tenantAdminPublishDraft({ body: {} });
    if (status !== 200) throw new Error('Publish failed');
    toast.success('Landing page published');
    await loadConfig(); // Reload fresh state
  } catch (err) {
    toast.error('Failed to publish');
  } finally {
    setIsPublishing(false);
  }
}, [flushPendingChanges, loadConfig]);

// CRITICAL: Cleanup on unmount
useEffect(() => {
  return () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
  };
}, []);

// CRITICAL: Flush on tab blur/close (TODO-254)
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden && hasUnsavedChanges) {
      flushPendingChanges();
    }
  };

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges) {
      flushPendingChanges();
      e.preventDefault();
      e.returnValue = '';
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, [hasUnsavedChanges, flushPendingChanges]);
```

### Security & Data Integrity Patterns

> **P1 Findings Implemented:** The following security measures have been implemented based on code review findings (TODOs 227-232).

#### Rate Limiting (TODO-249 - REQUIRED)

All draft endpoints must have rate limiting applied:

```typescript
// server/src/middleware/rate-limiter.ts - ADD THIS
export const draftLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (1 per second max)
  message: { error: 'Too many save requests, please slow down' },
});

// Apply to routes in tenant-admin-landing-page.routes.ts
router.put('/draft', draftLimiter, async (req, res) => { ... });
router.post('/publish', draftLimiter, async (req, res) => { ... });
router.delete('/draft', draftLimiter, async (req, res) => { ... });
```

#### Tenant Isolation (TODO-227)

All draft endpoints verify tenant ownership via `res.locals.tenantAuth`:

```typescript
router.put('/draft', async (req: Request, res: Response, next: NextFunction) => {
  const tenantAuth = res.locals.tenantAuth;
  if (!tenantAuth) {
    res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
    return;
  }
  const { tenantId } = tenantAuth;
  // ... all repository methods require tenantId as first parameter
});
```

#### Input Sanitization (TODO-228)

All text fields are sanitized before storage to prevent XSS:

```typescript
import { sanitizeObject } from '../lib/sanitization';

const data = LandingPageConfigSchema.parse(req.body);
const sanitizedData = sanitizeObject(data, { allowHtml: [] });
await tenantRepo.saveLandingPageDraft(tenantId, sanitizedData);
```

#### Image URL Validation (TODO-229)

Repository layer re-validates all image URLs against `SafeImageUrlSchema`:

```typescript
private validateImageUrls(config: LandingPageConfig): void {
  const urlsToValidate = [
    config.hero?.backgroundImageUrl,
    config.about?.imageUrl,
    config.accommodation?.imageUrl,
    config.gallery?.images?.map(img => img.url),
  ];

  for (const url of urlsToValidate) {
    SafeImageUrlSchema.parse(url); // Blocks data:, javascript: protocols
  }
}
```

#### Publish Atomicity (TODO-230)

Publish operation uses Prisma transaction for atomicity:

```typescript
async publishLandingPageDraft(tenantId: string) {
  return await this.prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!currentWrapper.draft) {
      throw new ValidationError('No draft to publish');
    }
    await tx.tenant.update({
      where: { id: tenantId },
      data: { landingPageConfig: { published: draft, draft: null } },
    });
  });
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (1-2 days)

**Files to Create:**

```
client/src/features/tenant-admin/landing-page-editor/
├── LandingPageEditor.tsx              # Main editor container
├── components/
│   ├── EditorSidebar.tsx              # Section toggles + available sections
│   ├── SectionCard.tsx                # Sidebar section card (toggle/add)
│   └── EditorToolbar.tsx              # Publish/Discard buttons
├── hooks/
│   └── useLandingPageEditor.ts        # State management hook (COPY useVisualEditor patterns!)
└── index.ts                           # Barrel export
```

**Tasks:**

- [ ] Create `LandingPageEditor.tsx` main container with sidebar + preview layout
- [ ] Create `useLandingPageEditor.ts` hook **copying `useVisualEditor.ts` patterns exactly** (batching, rollback, cleanup)
- [ ] Create `EditorSidebar.tsx` with active/available section lists
- [ ] Create `EditorToolbar.tsx` with Publish/Discard buttons (floating bar pattern)
- [ ] Add route `/tenant/landing-page` in `client/src/app/routes.tsx`
- [ ] Add navigation link in tenant admin sidebar/tabs

**Acceptance Criteria:**

- [ ] Editor page loads at `/tenant/landing-page`
- [ ] Sidebar shows section toggles for all 8 sections
- [ ] Publish/Discard buttons visible in floating toolbar
- [ ] Hook includes all refs: `saveTimeout`, `pendingChanges`, `originalConfig`, `saveInProgress`

### Phase 2: Editable Section Components (2-3 days)

**Files to Create:**

```
client/src/features/tenant-admin/landing-page-editor/
├── sections/
│   ├── EditableHeroSection.tsx           # Hero with inline editing
│   ├── EditableSocialProofBar.tsx        # Social proof with inline editing
│   ├── EditableAboutSection.tsx          # About with inline editing
│   ├── EditableTestimonialsSection.tsx   # Testimonials with add/edit/remove
│   ├── EditableAccommodationSection.tsx  # Accommodation with URL + highlights (TODO-248)
│   ├── EditableGallerySection.tsx        # Gallery with photo management
│   ├── EditableFaqSection.tsx            # FAQ with add/edit/remove
│   └── EditableFinalCtaSection.tsx       # Final CTA with inline editing
├── components/
│   ├── EditableText.tsx                  # Import from visual-editor
│   ├── EditableImage.tsx                 # Single image upload (see spec below)
│   └── EditableList.tsx                  # Array editing (see spec below)
└── demo-data/
    └── section-defaults.ts               # Demo content for new sections
```

#### EditableImage Component Specification (TODO-251)

```typescript
interface EditableImageProps {
  currentUrl: string | undefined;
  onUpload: (url: string) => void;
  onRemove: () => void;
  aspectRatio?: 'auto' | '16/9' | '1/1' | '4/3';
  placeholder?: string;
  disabled?: boolean;
}

export function EditableImage({
  currentUrl,
  onUpload,
  onRemove,
  aspectRatio = 'auto',
  placeholder = 'Click or drag to upload image',
  disabled = false,
}: EditableImageProps) {
  // 1. Show current image with hover overlay for Change/Remove
  // 2. Show drop zone when no image
  // 3. Upload to storage API, return https URL
  // 4. Use aspect-ratio CSS to prevent layout shift (TODO-255)
}
```

#### EditableList Component Specification (TODO-251)

```typescript
interface EditableListProps<T> {
  items: T[];
  onUpdate: (items: T[]) => void;
  renderItem: (item: T, index: number, onChange: (updated: T) => void) => React.ReactNode;
  createNewItem: () => T;
  maxItems?: number;
  emptyMessage?: string;
  disabled?: boolean;
}

export function EditableList<T>({
  items,
  onUpdate,
  renderItem,
  createNewItem,
  maxItems = 20,
  emptyMessage = 'No items yet',
  disabled = false,
}: EditableListProps<T>) {
  // 1. Map items with remove button on each
  // 2. Add button at bottom (if under max)
  // 3. Call onUpdate with new array on any change
}
```

#### Demo Data Structure

```typescript
// demo-data/section-defaults.ts
export const SECTION_DEFAULTS = {
  hero: {
    headline: 'Welcome to Your Business',
    subheadline: 'Discover our amazing services and experiences',
    ctaText: 'Explore Our Offerings',
    backgroundImageUrl: undefined,
  },
  about: {
    headline: 'About Us',
    content: 'Tell your story here. What makes your business special?',
    imageUrl: undefined,
    imagePosition: 'right',
  },
  testimonials: {
    headline: 'What Our Customers Say',
    items: [
      {
        quote: 'Amazing experience! Highly recommended.',
        author: 'Happy Customer',
        role: 'Verified Client',
        imageUrl: undefined,
        rating: 5,
      },
    ],
  },
  socialProofBar: {
    items: [
      { icon: 'star', text: '5-Star Rated' },
      { icon: 'users', text: '500+ Happy Clients' },
      { icon: 'calendar', text: 'Easy Booking' },
    ],
  },
  // TODO-248: Accommodation section (was missing from original plan)
  accommodation: {
    headline: 'Local Accommodations',
    description: 'We partner with excellent local accommodations for your stay.',
    imageUrl: undefined,
    ctaText: 'View Accommodations',
    ctaUrl: 'https://airbnb.com',
    highlights: ['Wifi', 'Free Parking', 'Pet Friendly'],
  },
  gallery: {
    headline: 'Our Gallery',
    images: [
      { url: 'https://via.placeholder.com/600x400', alt: 'Sample image' },
    ],
    instagramHandle: undefined,
  },
  faq: {
    headline: 'Frequently Asked Questions',
    items: [
      {
        question: 'How do I book?',
        answer: 'Simply browse our offerings and click "Book Now" on any package.',
      },
      {
        question: 'What is your cancellation policy?',
        answer: 'Contact us at least 48 hours before your appointment for a full refund.',
      },
    ],
  },
  finalCta: {
    headline: 'Ready to Get Started?',
    subheadline: 'Book your experience today',
    ctaText: 'Book Now',
  },
};
```

**Tasks:**

- [ ] Import `EditableText` from visual-editor (do NOT copy)
- [ ] Create `EditableImage.tsx` with aspect-ratio containers (TODO-255)
- [ ] Create `EditableList.tsx` generic component
- [ ] Create `EditableHeroSection.tsx`
- [ ] Create `EditableSocialProofBar.tsx`
- [ ] Create `EditableAboutSection.tsx`
- [ ] Create `EditableTestimonialsSection.tsx`
- [ ] Create `EditableAccommodationSection.tsx` (TODO-248 - includes URL validation for ctaUrl, highlights array)
- [ ] Create `EditableGallerySection.tsx`
- [ ] Create `EditableFaqSection.tsx`
- [ ] Create `EditableFinalCtaSection.tsx`
- [ ] Create `section-defaults.ts` with demo content for all 8 sections

**Acceptance Criteria:**

- [ ] All 8 sections render with demo data when first added
- [ ] Click-to-edit works on all text fields
- [ ] Image upload works on Hero, About, Accommodation, Gallery
- [ ] Add/remove works on Testimonials, FAQ, SocialProofBar, Accommodation highlights
- [ ] Aspect-ratio containers prevent layout shift (CLS < 0.1)

### Phase 3: API Integration (0.5-1 day)

> **Note:** Backend is complete. This phase is frontend integration only.

**Tasks:**

- [ ] Wire `useLandingPageEditor` to existing API endpoints
- [ ] Implement auto-save with 1s debounce using batching pattern
- [ ] Implement optimistic updates with rollback on error
- [ ] Add localStorage backup for browser crash recovery (TODO-253)
- [ ] Add tab blur/close flush behavior (TODO-254)
- [ ] Add concurrent tab warning using localStorage (TODO-242)

**Acceptance Criteria:**

- [ ] Drafts auto-save after 1s of inactivity
- [ ] Publish button copies draft to live
- [ ] Discard button reverts to published state
- [ ] "Unsaved changes" indicator shows when draft differs from published
- [ ] Page reload preserves draft state
- [ ] Browser crash recovers from localStorage backup

### Phase 4: Polish & Testing (1 day)

**Tasks:**

- [ ] Add loading skeletons during initial load
- [ ] Add success/error toast notifications
- [ ] Add confirmation dialog for discard action
- [ ] Add "has changes" indicator in sidebar
- [ ] Write E2E tests for editor workflow
- [ ] Test edge cases (empty config, partial saves, network errors)
- [ ] Test 50+ rapid edits without race conditions

**E2E Test Cases:**

```typescript
// e2e/tests/landing-page-editor.spec.ts
test('should load editor → add hero section → edit headline → publish → verify live');
test('should add testimonials → add 2 items → remove 1 → publish → verify');
test('should edit FAQ → discard changes → verify reverted');
test('should handle network failure gracefully → draft preserved');
test('should handle 50 rapid edits without race conditions');
test('should recover from browser crash via localStorage');
```

**Acceptance Criteria:**

- [ ] All happy paths work smoothly
- [ ] Error states handled gracefully
- [ ] E2E tests pass
- [ ] TypeScript compilation passes
- [ ] No race conditions under rapid editing

---

## Component Specifications

### LandingPageEditor.tsx

```typescript
export function LandingPageEditor() {
  const editor = useLandingPageEditor();

  if (editor.isLoading) {
    return <EditorSkeleton />;
  }

  if (editor.error) {
    return <ErrorState error={editor.error} onRetry={editor.loadConfig} />;
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <EditorSidebar
        activeSections={editor.activeSections}
        availableSections={editor.availableSections}
        onToggleSection={editor.toggleSection}
        hasChanges={editor.hasChanges}
      />

      {/* Preview Area */}
      <div className="flex-1 overflow-y-auto bg-gray-100">
        <div className="max-w-6xl mx-auto">
          {/* Render enabled sections in order */}
          {editor.draftConfig?.sections?.hero && (
            <EditableHeroSection
              config={editor.draftConfig.hero}
              onUpdate={(updates) => editor.updateSectionContent('hero', updates)}
            />
          )}

          {/* Segment Selector - Always visible */}
          <SegmentSelectorSection />

          {/* ... other 7 sections */}
        </div>
      </div>

      {/* Floating Bottom Toolbar */}
      <EditorToolbar
        hasChanges={editor.hasChanges}
        isSaving={editor.isSaving}
        isPublishing={editor.isPublishing}
        onPublish={editor.publishChanges}
        onDiscard={editor.discardChanges}
      />
    </div>
  );
}
```

### EditorToolbar.tsx (Floating Bar Pattern)

```typescript
export function EditorToolbar({
  hasChanges,
  isSaving,
  isPublishing,
  onPublish,
  onDiscard,
}: EditorToolbarProps) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-background/95 backdrop-blur border-t shadow-lg',
        'transform transition-transform duration-300',
        !hasChanges && 'translate-y-full' // Hide when no changes
      )}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          <span className="text-sm text-muted-foreground">
            {isSaving ? 'Saving...' : 'Unsaved changes'}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDiscard} disabled={isPublishing}>
            Discard
          </Button>
          <Button onClick={onPublish} disabled={isPublishing}>
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] Landing page editor accessible at `/tenant/landing-page`
- [ ] Navigation link visible in tenant admin dashboard
- [ ] Sidebar shows active sections with ability to remove
- [ ] Sidebar shows available sections with ability to add
- [ ] Adding a section initializes it with demo data
- [ ] All 8 section types editable (Hero, SocialProof, About, Testimonials, Accommodation, Gallery, FAQ, FinalCTA)
- [ ] Click-to-edit works on all text fields
- [ ] Image upload works on Hero, About, Accommodation, Gallery sections
- [ ] Add/remove items works on Testimonials, FAQ, SocialProofBar, Accommodation highlights
- [ ] Changes auto-save as drafts (1s debounce with batching)
- [ ] Publish button makes draft live
- [ ] Discard button reverts to published state
- [ ] Segment Selector always visible (cannot be removed)

### Non-Functional Requirements

- [ ] Page load under 2 seconds
- [ ] Auto-save completes within 500ms (note: large configs may be slower, see TODO-250)
- [ ] No layout shift during image loading (aspect-ratio containers)
- [ ] TypeScript strict mode compliance
- [ ] All existing tests continue to pass

### Quality Gates

- [ ] E2E tests for complete editor workflow
- [ ] Unit tests for useLandingPageEditor hook
- [ ] 50 rapid edits test passes without race conditions
- [ ] No TypeScript errors
- [ ] Lighthouse CLS score < 0.1

---

## Risk Analysis & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Draft data loss on browser crash | Medium | Low | localStorage backup (TODO-253) |
| Race conditions during rapid editing | High | Medium | Batching + saveInProgress flag (TODO-247) |
| Concurrent editing conflicts | Low | Low | localStorage tab warning (TODO-242) |
| Large image uploads slow editor | Medium | Medium | Aspect-ratio containers, loading states |
| Large config payloads exceed 500ms | Medium | Medium | Accept for MVP, optimize later (TODO-250) |

---

## File Changes Summary

### New Files (16)

```
client/src/features/tenant-admin/landing-page-editor/
├── LandingPageEditor.tsx
├── components/
│   ├── EditorSidebar.tsx
│   ├── SectionCard.tsx
│   ├── EditorToolbar.tsx
│   ├── EditableImage.tsx
│   └── EditableList.tsx
├── sections/
│   ├── EditableHeroSection.tsx
│   ├── EditableSocialProofBar.tsx
│   ├── EditableAboutSection.tsx
│   ├── EditableTestimonialsSection.tsx
│   ├── EditableAccommodationSection.tsx    # TODO-248: Was missing
│   ├── EditableGallerySection.tsx
│   ├── EditableFaqSection.tsx
│   └── EditableFinalCtaSection.tsx
├── hooks/
│   └── useLandingPageEditor.ts
├── demo-data/
│   └── section-defaults.ts
└── index.ts
```

### Modified Files (3)

```
client/src/app/routes.tsx                           # Add editor route
client/src/features/tenant-admin/TenantAdminNav.tsx # Add nav link
server/src/routes/tenant-admin-landing-page.routes.ts # Add rate limiting (TODO-249)
```

---

## Estimated Effort

| Phase | Duration | Notes |
|-------|----------|-------|
| Phase 1: Core Infrastructure | 1-2 days | Route, layout, sidebar, hook with batching |
| Phase 2: Editable Sections | 2-3 days | 8 section components, EditableImage, EditableList |
| Phase 3: API Integration | 0.5-1 day | Wire to existing backend, localStorage backup |
| Phase 4: Polish & Testing | 1 day | E2E tests, edge cases, error handling |
| **Total** | **4.5-7 days** | Reduced from 5-9 days (backend already complete) |

---

## References

### Internal References

- Visual Editor Dashboard: `client/src/features/tenant-admin/visual-editor/VisualEditorDashboard.tsx`
- **useVisualEditor Hook (COPY THIS)**: `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts`
- EditableText Component: `client/src/features/tenant-admin/visual-editor/components/EditableText.tsx`
- Landing Page Schema: `packages/contracts/src/landing-page.ts`
- Landing Page Routes: `server/src/routes/tenant-admin-landing-page.routes.ts`
- Landing Page Repository: `server/src/adapters/prisma/tenant.repository.ts`

### Related TODOs

- TODO-246: Plan backend already exists (this plan updated)
- TODO-247: Hook missing batching/rollback (addressed in State Management section)
- TODO-248: Missing EditableAccommodationSection (added to Phase 2)
- TODO-249: Rate limiting draft endpoints (backend fix required)
- TODO-250: Performance full config saves (documented as known limitation)
- TODO-251: Missing component specs (added EditableImage/EditableList specs)
- TODO-252: Discard missing transaction (backend fix)
- TODO-253: localStorage draft recovery (added to Phase 3)
- TODO-254: Flush on tab blur (added to hook specification)
- TODO-255: Layout shift prevention (added to EditableImage spec)
- TODO-256: Simplify by reusing display components (optional future optimization)

---

_Plan created: 2024-12-04_
_Updated: 2025-12-04 - Major revision after code review_
_Status: Ready for Implementation - Frontend only, backend complete_
