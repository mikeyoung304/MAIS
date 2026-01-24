# Feature: Tenant Dashboard Visual Editor (MVP)

## Overview

Transform the tenant dashboard into an interactive visual editor where tenants see their marketplace **exactly as customers see it** - with click-to-edit photos, text, and prices inline. Changes autosave as drafts, then publish to customer-facing view with one button.

**Core UX Flow:**

1. Tenant opens dashboard → sees their storefront exactly as customers see it
2. Click any element (photo, text, price) → edit inline
3. Changes autosave to draft state automatically
4. Click "Publish Changes" → pushes to live customer view

**Scope:** MVP - ship in 9-10 days with quality, iterate based on feedback.

---

## Key Decisions

| Decision                  | Choice                           | Rationale                                                          |
| ------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| **Photo storage**         | `draftPhotos` JSON array         | Matches existing `photos` structure for consistency                |
| **Draft count**           | Count packages with drafts       | Simpler than counting individual fields; "3 packages with changes" |
| **Save behavior**         | Autosave per field (1s debounce) | Modern UX, reduces lost work                                       |
| **Publish**               | Single button, no confirmation   | Fast workflow; Discard has confirmation instead                    |
| **Discard**               | Button with confirmation dialog  | Prevents accidental data loss                                      |
| **Navigation warning**    | Popup if unpublished drafts      | Browser close + in-app navigation both handled                     |
| **Draft persistence**     | Survives browser close           | Drafts in DB, recovered on next visit                              |
| **Segment rename/delete** | Included in MVP                  | Keep full segment management                                       |
| **Photo crop**            | Deferred to v1.1                 | Simplifies MVP; users can pre-crop                                 |
| **Tab drag-reorder**      | Deferred to v1.1                 | Simplifies MVP; static order sufficient                            |
| **Timeline**              | 9-10 days (conservative)         | Quality over speed                                                 |

---

## Problem Statement

Current tenant dashboard (`TenantPackagesManager.tsx`) uses:

- Modal forms for editing packages (multiple clicks)
- Separate photo upload flow after package creation
- List-style display that doesn't match customer view
- No draft/publish workflow

**Pain Points:**

1. Disconnect between admin view and customer view
2. Multiple steps to edit simple content
3. No way to preview changes before going live

---

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Customer 1] [Customer 2] [+]                  [Publish Changes]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│   │    [photo]      │  │    [photo]      │  │    [photo]      │   │
│   │  click/drag to  │  │  click/drag to  │  │  click/drag to  │   │
│   │     upload      │  │     upload      │  │     upload      │   │
│   ├─────────────────┤  ├─────────────────┤  ├─────────────────┤   │
│   │ Title (click)   │  │ Title (click)   │  │ Title (click)   │   │
│   │ Description     │  │ Description     │  │ Description     │   │
│   │ $Price          │  │ $Price          │  │ $Price          │   │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘   │
│                                                                     │
│   [+ Add Package]                                                   │
│                                                                     │
│   ─────────────────────────────────────────────────────────────    │
│   Draft: 3 unsaved changes                    [Publish Changes]    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Draft/Publish System

**Key Concept:** All edits save to a "draft" state. Customer-facing view only updates when tenant clicks "Publish Changes."

```
Edit Flow:
1. User edits title → autosaves to draft (1s debounce)
2. Draft indicator shows "3 unsaved changes"
3. User clicks "Publish Changes"
4. All drafts pushed to live packages
5. Customer view now shows new content
```

**Database Model:**

- Packages have `draftTitle`, `draftDescription`, `draftPriceCents`, `draftPhotos` fields
- `draftPhotos` is a JSON array matching existing `photos` structure: `[{url, filename, size, order}]`
- `hasDraft` boolean + `draftUpdatedAt` timestamp for tracking
- **Best Practice:** Draft fields on Package model (simple, no joins, atomic publish)

---

## Technical Approach

### File Structure (MVP - 6 files)

```
client/src/features/tenant-admin/visual-editor/
├── VisualEditorDashboard.tsx    # Main container (~200 lines)
├── EditablePackageCard.tsx      # Single package with all editable fields (~150 lines)
├── EditableText.tsx             # Reusable inline text editor (~80 lines)
├── EditablePrice.tsx            # Price input with $ formatting (~60 lines)
├── PhotoDropZone.tsx            # Drag-drop + click upload (~100 lines)
└── useVisualEditor.ts           # All state/mutations in one hook (~150 lines)

server/src/routes/
└── tenant-admin.routes.ts       # Add PATCH endpoints

server/prisma/
└── schema.prisma                # Add draft fields to Package model
```

**Total:** ~740 lines of new frontend code + backend changes

### Backend Changes Required

#### 1. Schema Update (Prisma)

```prisma
model Package {
  // ... existing fields ...

  // Draft fields (null = no pending changes)
  draftTitle        String?
  draftDescription  String?
  draftPriceCents   Int?
  draftPhotos       Json?     // Array matching photos structure: [{url, filename, size, order}]
  hasDraft          Boolean   @default(false)
  draftUpdatedAt    DateTime?
}
```

**Best Practices Applied:**

- `draftPhotos` uses same JSON structure as `photos` for consistency
- `hasDraft` boolean enables efficient queries (find all packages with pending changes)
- Draft count = count of packages where `hasDraft = true` (simpler than counting fields)

#### 2. New API Endpoints

```typescript
// PATCH /v1/tenant-admin/packages/:id/draft
// Save draft changes (autosave target)
{
  method: 'PATCH',
  path: '/v1/tenant-admin/packages/:id/draft',
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    priceCents: z.number().optional(),
    photos: z.array(PackagePhotoDtoSchema).optional(), // Full photos array replacement
  }),
  responses: { 200: PackageWithDraftSchema }
}

// POST /v1/tenant-admin/packages/publish
// Publish all drafts for tenant
{
  method: 'POST',
  path: '/v1/tenant-admin/packages/publish',
  body: z.object({
    packageIds: z.array(z.string()).optional(), // If empty, publish all
  }),
  responses: { 200: z.object({ published: z.number() }) }
}

// GET /v1/tenant-admin/packages (updated)
// Include draft fields in response
{
  responses: {
    200: z.array(PackageWithDraftSchema)
  }
}
```

#### 3. Segment Endpoints (for tabs)

```typescript
// PATCH /v1/tenant-admin/segments/:id
// Rename segment
{
  method: 'PATCH',
  path: '/v1/tenant-admin/segments/:id',
  body: z.object({
    name: z.string().min(1).max(50).optional(),
  }),
  responses: { 200: SegmentSchema }
}
```

---

## Implementation Phases

## Implementation Timeline (9-10 Days)

### Phase 1: Backend + Schema (Days 1-3)

**Tasks:**

- [ ] Add draft fields to Package model in `schema.prisma`
- [ ] Run migration: `prisma migrate dev --name add_package_drafts`
- [ ] Create `PATCH /v1/tenant-admin/packages/:id/draft` endpoint
- [ ] Create `POST /v1/tenant-admin/packages/publish` endpoint
- [ ] Create `DELETE /v1/tenant-admin/packages/drafts` endpoint (discard all)
- [ ] Update `GET /v1/tenant-admin/packages` to include draft fields
- [ ] Add `PATCH /v1/tenant-admin/segments/:id` for rename
- [ ] Add `DELETE /v1/tenant-admin/segments/:id` for delete (with cascade warning)
- [ ] Update contracts in `packages/contracts/src/api.v1.ts`
- [ ] Add tests for new endpoints (unit + integration)

**Files to modify:**

- `server/prisma/schema.prisma`
- `server/src/routes/tenant-admin.routes.ts`
- `server/src/services/package-draft.service.ts` (new)
- `packages/contracts/src/api.v1.ts`
- `packages/contracts/src/dto.ts`

**Migration SQL:**

```sql
ALTER TABLE "Package" ADD COLUMN "draftTitle" TEXT;
ALTER TABLE "Package" ADD COLUMN "draftDescription" TEXT;
ALTER TABLE "Package" ADD COLUMN "draftPriceCents" INTEGER;
ALTER TABLE "Package" ADD COLUMN "draftPhotos" JSONB;
ALTER TABLE "Package" ADD COLUMN "hasDraft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Package" ADD COLUMN "draftUpdatedAt" TIMESTAMP(3);

-- Index for efficient draft queries
CREATE INDEX "Package_tenantId_hasDraft_idx" ON "Package"("tenantId", "hasDraft") WHERE "hasDraft" = true;
```

### Phase 2: Visual Editor Shell (Days 3-4)

**Tasks:**

- [ ] Create `VisualEditorDashboard.tsx` - main container
- [ ] Implement segment tabs (Radix UI Tabs, no drag)
- [ ] Add "+ Add Segment" button with modal (simple name input)
- [ ] Add segment rename (double-click tab name or context menu)
- [ ] Add segment delete with confirmation dialog
- [ ] Create `EditablePackageGrid.tsx` - 3-column responsive grid
- [ ] Wire up to `useVisualEditor()` hook
- [ ] Add "Publish Changes" + "Discard" buttons with draft count

**Files to create:**

- `client/src/features/tenant-admin/visual-editor/VisualEditorDashboard.tsx`
- `client/src/features/tenant-admin/visual-editor/useVisualEditor.ts`

**Key Component:**

```typescript
// VisualEditorDashboard.tsx
export function VisualEditorDashboard() {
  const { packages, segments, draftCount, publishDrafts, discardDrafts } = useVisualEditor();
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Warn on navigation if unpublished drafts exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (draftCount > 0) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [draftCount]);

  // Also use react-router's useBlocker for in-app navigation
  const blocker = useBlocker(draftCount > 0);

  return (
    <div className="container max-w-6xl mx-auto p-6">
      {/* Segment Tabs */}
      <Tabs.Root defaultValue={segments[0]?.id}>
        <div className="flex items-center justify-between mb-6">
          <Tabs.List className="flex gap-1 bg-neutral-100 p-1 rounded-lg">
            {segments.map(seg => (
              <Tabs.Trigger key={seg.id} value={seg.id}>
                {seg.name}
              </Tabs.Trigger>
            ))}
            <AddSegmentButton />
          </Tabs.List>

          {/* Publish/Discard Buttons */}
          <div className="flex items-center gap-3">
            {draftCount > 0 && (
              <>
                <span className="text-sm text-amber-600">
                  {draftCount} unpublished {draftCount === 1 ? 'change' : 'changes'}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setShowDiscardDialog(true)}
                >
                  Discard
                </Button>
              </>
            )}
            <Button
              onClick={publishDrafts}
              disabled={draftCount === 0}
            >
              Publish Changes
            </Button>
          </div>
        </div>

        {/* Discard Confirmation Dialog */}
        <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard all changes?</AlertDialogTitle>
              <AlertDialogDescription>
                This will discard {draftCount} unpublished {draftCount === 1 ? 'change' : 'changes'}.
                Your customers will continue to see the current published content.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Editing</AlertDialogCancel>
              <AlertDialogAction onClick={discardDrafts} className="bg-danger-600">
                Discard Changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Package Grids per Segment */}
        {segments.map(seg => (
          <Tabs.Content key={seg.id} value={seg.id}>
            <EditablePackageGrid
              packages={packages.filter(p => p.segmentId === seg.id)}
            />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </div>
  );
}
```

### Phase 3: Inline Editing Components (Days 5-6)

**Tasks:**

- [ ] Create `EditableText.tsx` - click-to-edit with autosave
- [ ] Create `EditablePrice.tsx` - price input with $ formatting
- [ ] Create `EditablePackageCard.tsx` - composes all fields
- [ ] Implement autosave on blur (1s debounce to draft endpoint)
- [ ] Add visual feedback: "Saving..." → "Saved" → draft indicator
- [ ] Add keyboard shortcuts (Enter to save, Escape to cancel)

**Files to create:**

- `client/src/features/tenant-admin/visual-editor/EditableText.tsx`
- `client/src/features/tenant-admin/visual-editor/EditablePrice.tsx`
- `client/src/features/tenant-admin/visual-editor/EditablePackageCard.tsx`

**Key Pattern - Autosave:**

```typescript
// EditableText.tsx
export function EditableText({
  value,
  draftValue,
  onSaveDraft,
  fieldName,
  maxLength = 200,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(draftValue ?? value);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const debouncedSave = useDebouncedCallback(async (newValue: string) => {
    setSaveStatus('saving');
    await onSaveDraft({ [fieldName]: newValue });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, 1000);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    debouncedSave(newValue);
  };

  // Display draft value if exists, otherwise live value
  const displayValue = draftValue ?? value;
  const hasDraft = draftValue !== null && draftValue !== value;

  return (
    <div className="group relative">
      {isEditing ? (
        <input
          autoFocus
          value={localValue}
          onChange={(e) => handleChange(e.target.value.slice(0, maxLength))}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setLocalValue(displayValue);
              setIsEditing(false);
            }
          }}
          className="w-full px-2 py-1 border-2 border-macon-orange rounded"
        />
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className={cn(
            "px-2 py-1 rounded cursor-pointer transition-all",
            "hover:bg-macon-orange/10 hover:ring-2 hover:ring-macon-orange/30",
            hasDraft && "bg-amber-50 ring-1 ring-amber-300" // Draft indicator
          )}
        >
          {displayValue || <span className="text-neutral-400">Click to edit</span>}
        </div>
      )}

      {/* Save status indicator */}
      {saveStatus === 'saving' && (
        <span className="absolute -top-2 -right-2 text-xs text-neutral-500">Saving...</span>
      )}
      {hasDraft && saveStatus === 'idle' && (
        <span className="absolute -top-2 -right-2 w-2 h-2 bg-amber-500 rounded-full" />
      )}
    </div>
  );
}
```

### Phase 4: Photo Upload (Days 6-7)

**Tasks:**

- [ ] Create `PhotoDropZone.tsx` - drag-drop + click upload
- [ ] Integrate with existing photo upload API
- [ ] Save uploaded photo URL to draft field
- [ ] Show upload progress/loading state
- [ ] Handle upload errors gracefully

**Files to create:**

- `client/src/features/tenant-admin/visual-editor/PhotoDropZone.tsx`

**Key Pattern:**

```typescript
// PhotoDropZone.tsx
export function PhotoDropZone({
  currentUrl,
  draftUrl,
  packageId,
  onUploadComplete,
}: PhotoDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const uploadMutation = usePhotoUpload();

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadMutation.mutateAsync({ packageId, file });
      onUploadComplete(result.url);
    } catch (error) {
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const displayUrl = draftUrl ?? currentUrl;
  const hasDraft = draftUrl !== null && draftUrl !== currentUrl;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer transition-all",
        isDragging && "ring-4 ring-macon-orange bg-macon-orange/10",
        hasDraft && "ring-2 ring-amber-400",
        !displayUrl && "border-2 border-dashed border-neutral-300 bg-neutral-50"
      )}
    >
      <input
        type="file"
        accept="image/*"
        onChange={(e) => handleFiles(Array.from(e.target.files || []))}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />

      {isUploading ? (
        <div className="flex items-center justify-center h-full">
          <Spinner />
          <span className="ml-2">Uploading...</span>
        </div>
      ) : displayUrl ? (
        <img src={displayUrl} alt="Package" className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-neutral-500">
          <Upload className="w-8 h-8 mb-2" />
          <p>Drag photo here or click to upload</p>
        </div>
      )}

      {hasDraft && (
        <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded">
          Draft
        </div>
      )}
    </div>
  );
}
```

### Phase 5: Polish & Testing (Days 7-8)

**Tasks:**

- [ ] Add "Add Package" button with placeholder creation
- [ ] Add delete package confirmation
- [ ] Mobile responsive adjustments (tap-to-edit)
- [ ] Keyboard accessibility (Tab navigation, Enter/Escape)
- [ ] Navigation warning dialog (useBlocker for in-app, beforeunload for browser)
- [ ] Unit tests for EditableText, EditablePrice, PhotoDropZone
- [ ] Integration test for draft → publish → discard flows
- [ ] E2E test for complete workflow

**Test Coverage:**

```typescript
// __tests__/EditableText.test.tsx
describe('EditableText', () => {
  test('shows edit mode on click', async () => {
    render(<EditableText value="Hello" onSaveDraft={vi.fn()} fieldName="title" />);
    await userEvent.click(screen.getByText('Hello'));
    expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
  });

  test('autosaves on change after debounce', async () => {
    vi.useFakeTimers();
    const onSaveDraft = vi.fn();
    render(<EditableText value="Hello" onSaveDraft={onSaveDraft} fieldName="title" />);

    await userEvent.click(screen.getByText('Hello'));
    await userEvent.clear(screen.getByDisplayValue('Hello'));
    await userEvent.type(screen.getByRole('textbox'), 'World');

    expect(onSaveDraft).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onSaveDraft).toHaveBeenCalledWith({ title: 'World' });
  });

  test('shows draft indicator when draft differs from live', () => {
    render(<EditableText value="Live" draftValue="Draft" onSaveDraft={vi.fn()} fieldName="title" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(document.querySelector('.bg-amber-50')).toBeInTheDocument();
  });
});

// __tests__/publish-flow.test.tsx
describe('Publish Flow', () => {
  test('publishes all drafts and updates UI', async () => {
    const { result } = renderHook(() => useVisualEditor());

    // Simulate drafts
    await act(() => result.current.saveDraft('pkg_1', { title: 'New Title' }));
    expect(result.current.draftCount).toBe(1);

    // Publish
    await act(() => result.current.publishDrafts());
    expect(result.current.draftCount).toBe(0);
  });
});
```

### Phase 6: Integration & Deploy (Days 9-10)

**Tasks:**

- [ ] Replace `TenantPackagesManager` with `VisualEditorDashboard` in routes
- [ ] Add feature flag for gradual rollout (optional)
- [ ] Update any navigation/links pointing to old editor
- [ ] Final QA pass (desktop + mobile)
- [ ] Deploy to staging, test with real data
- [ ] Deploy to production
- [ ] Monitor for errors, draft data integrity

---

## Acceptance Criteria

### Functional Requirements

- [ ] Tenant sees packages in 3-column grid matching customer view
- [ ] Segment tabs at top, default named "Customer 1"
- [ ] Clicking "+ Add Segment" shows inline input, creates new segment
- [ ] Clicking package text enables inline editing
- [ ] Changes autosave to draft after 1s idle
- [ ] Draft indicator (amber highlight) shows on fields with pending changes
- [ ] "X unpublished changes" count shown next to Publish/Discard buttons
- [ ] "Publish Changes" button pushes all drafts to live (no confirmation)
- [ ] "Discard Drafts" button clears all pending changes (with confirmation)
- [ ] Customer-facing view unchanged until publish
- [ ] Photo upload via drag-drop or click (no crop)
- [ ] Max 3 packages per segment enforced
- [ ] "Add Package" creates placeholder package in draft state
- [ ] Navigation away triggers warning popup if unpublished drafts exist
- [ ] Drafts persist in database even if browser closes (recovered on next visit)

### Non-Functional Requirements

- [ ] Autosave completes within 500ms
- [ ] Publish completes within 2s for 10 packages
- [ ] Works on mobile (tap to edit)
- [ ] Keyboard accessible (Tab, Enter, Escape)

---

## API Contracts

### Package with Draft Schema

```typescript
// packages/contracts/src/dto.ts
export const PackageWithDraftSchema = PackageDtoSchema.extend({
  draftTitle: z.string().nullable(),
  draftDescription: z.string().nullable(),
  draftPriceCents: z.number().nullable(),
  draftPhotos: z.array(PackagePhotoDtoSchema).nullable(), // Same structure as photos
  hasDraft: z.boolean(),
  draftUpdatedAt: z.string().datetime().nullable(),
});

export type PackageWithDraft = z.infer<typeof PackageWithDraftSchema>;

// Draft count = packages where hasDraft = true (not individual field count)
```

### Draft Endpoints

```typescript
// packages/contracts/src/api.v1.ts
updatePackageDraft: {
  method: 'PATCH',
  path: '/v1/tenant-admin/packages/:id/draft',
  pathParams: z.object({ id: z.string() }),
  body: z.object({
    title: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    priceCents: z.number().min(0).optional(),
    photos: z.array(PackagePhotoDtoSchema).optional(),
  }),
  responses: {
    200: PackageWithDraftSchema,
    404: ErrorResponseSchema,
  },
},

publishPackageDrafts: {
  method: 'POST',
  path: '/v1/tenant-admin/packages/publish',
  body: z.object({
    packageIds: z.array(z.string()).optional(), // Empty = publish all
  }),
  responses: {
    200: z.object({
      published: z.number(),
      packages: z.array(PackageDtoSchema),
    }),
  },
},

discardPackageDrafts: {
  method: 'DELETE',
  path: '/v1/tenant-admin/packages/drafts',
  body: z.object({
    packageIds: z.array(z.string()).optional(), // Empty = discard all
  }),
  responses: {
    200: z.object({
      discarded: z.number(),
    }),
  },
},
```

---

## Database Changes

### Migration: Add Draft Fields

```sql
-- Migration: add_package_draft_fields
ALTER TABLE "Package" ADD COLUMN "draftTitle" TEXT;
ALTER TABLE "Package" ADD COLUMN "draftDescription" TEXT;
ALTER TABLE "Package" ADD COLUMN "draftPriceCents" INTEGER;
ALTER TABLE "Package" ADD COLUMN "draftPhotos" JSONB;
ALTER TABLE "Package" ADD COLUMN "hasDraft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Package" ADD COLUMN "draftUpdatedAt" TIMESTAMP(3);

-- Partial index for efficient draft queries (only indexes rows where hasDraft = true)
CREATE INDEX "Package_tenantId_hasDraft_idx" ON "Package"("tenantId") WHERE "hasDraft" = true;
```

### Prisma Schema Update

```prisma
model Package {
  id            String    @id @default(cuid())
  tenantId      String
  slug          String
  name          String
  description   String?
  basePrice     Int
  active        Boolean   @default(true)
  segmentId     String?
  grouping      String?
  groupingOrder Int?
  photos        Json      @default("[]")

  // Draft fields (null = no pending changes for this field)
  draftTitle        String?
  draftDescription  String?
  draftPriceCents   Int?
  draftPhotos       Json?     // Same structure as photos: [{url, filename, size, order}]
  hasDraft          Boolean   @default(false)
  draftUpdatedAt    DateTime?

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  segment   Segment? @relation(fields: [segmentId], references: [id], onDelete: SetNull)

  @@unique([tenantId, slug])
  @@index([tenantId, hasDraft])
  @@index([segmentId])
}
```

---

## Service Layer

### Draft Service

```typescript
// server/src/services/package-draft.service.ts
export class PackageDraftService {
  constructor(private readonly packageRepo: PackageRepository) {}

  async saveDraft(
    tenantId: string,
    packageId: string,
    draft: Partial<PackageDraft>
  ): Promise<PackageWithDraft> {
    // Verify package belongs to tenant
    const pkg = await this.packageRepo.getById(tenantId, packageId);
    if (!pkg) throw new NotFoundError('Package not found');

    // Update draft fields
    return this.packageRepo.updateDraft(tenantId, packageId, {
      ...draft,
      hasDraft: true,
      draftUpdatedAt: new Date(),
    });
  }

  async publishDrafts(
    tenantId: string,
    packageIds?: string[]
  ): Promise<{ published: number; packages: Package[] }> {
    // Get packages with drafts
    const packages = await this.packageRepo.getWithDrafts(tenantId, packageIds);

    // Apply drafts to live fields
    const published = await Promise.all(
      packages.map((pkg) => this.packageRepo.applyDraft(tenantId, pkg.id))
    );

    return { published: published.length, packages: published };
  }

  async discardDrafts(tenantId: string, packageIds?: string[]): Promise<number> {
    return this.packageRepo.clearDrafts(tenantId, packageIds);
  }
}
```

### Repository Methods

```typescript
// server/src/adapters/prisma/package.repository.ts
export class PrismaPackageRepository {
  async updateDraft(
    tenantId: string,
    packageId: string,
    draft: Partial<PackageDraft>
  ): Promise<PackageWithDraft> {
    return this.prisma.package.update({
      where: { id: packageId, tenantId },
      data: {
        ...(draft.title !== undefined && { draftTitle: draft.title }),
        ...(draft.description !== undefined && { draftDescription: draft.description }),
        ...(draft.priceCents !== undefined && { draftPriceCents: draft.priceCents }),
        ...(draft.photos !== undefined && { draftPhotos: draft.photos }),
        hasDraft: true,
        draftUpdatedAt: new Date(),
      },
    });
  }

  async applyDraft(tenantId: string, packageId: string): Promise<Package> {
    // Use transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      const pkg = await tx.package.findUnique({
        where: { id: packageId, tenantId },
      });

      if (!pkg || !pkg.hasDraft) return pkg;

      return tx.package.update({
        where: { id: packageId },
        data: {
          // Apply draft values (fall back to current if draft is null)
          name: pkg.draftTitle ?? pkg.name,
          description: pkg.draftDescription ?? pkg.description,
          basePrice: pkg.draftPriceCents ?? pkg.basePrice,
          photos: pkg.draftPhotos ?? pkg.photos,
          // Clear all draft fields after applying
          draftTitle: null,
          draftDescription: null,
          draftPriceCents: null,
          draftPhotos: null,
          hasDraft: false,
          draftUpdatedAt: null,
        },
      });
    });
  }

  async getWithDrafts(tenantId: string, packageIds?: string[]): Promise<Package[]> {
    return this.prisma.package.findMany({
      where: {
        tenantId,
        hasDraft: true,
        ...(packageIds && { id: { in: packageIds } }),
      },
    });
  }

  async countDrafts(tenantId: string): Promise<number> {
    return this.prisma.package.count({
      where: { tenantId, hasDraft: true },
    });
  }

  async clearDrafts(tenantId: string, packageIds?: string[]): Promise<number> {
    const result = await this.prisma.package.updateMany({
      where: {
        tenantId,
        hasDraft: true,
        ...(packageIds && { id: { in: packageIds } }),
      },
      data: {
        draftTitle: null,
        draftDescription: null,
        draftPriceCents: null,
        draftPhotos: null,
        hasDraft: false,
        draftUpdatedAt: null,
      },
    });
    return result.count;
  }
}
```

---

## Risk Analysis

| Risk                           | Impact | Mitigation                                                                   |
| ------------------------------ | ------ | ---------------------------------------------------------------------------- |
| Draft data loss on session end | Medium | Drafts persist to DB immediately; add "unsaved drafts" warning on page leave |
| Publish fails mid-batch        | Medium | Wrap in transaction; all-or-nothing publish                                  |
| Photo upload fails             | Low    | Show clear error; retry button                                               |
| Mobile UX issues               | Low    | Test early; tap-to-edit fallback                                             |

---

## Success Metrics

1. **Edit speed**: Edit package (text + photo) in < 30 seconds (vs. 2+ min currently)
2. **Publish adoption**: 70%+ of tenants use visual editor within 2 weeks
3. **Error rate**: < 1% failed saves/publishes
4. **Draft usage**: Average 2-3 drafts before publishing (shows iteration)

---

## Future Enhancements (Post-MVP)

- Image crop dialog (react-easy-crop)
- Drag-to-reorder segment tabs (@dnd-kit)
- Segment cloning
- Undo/redo for edits
- Version history
- Live preview link (shareable before publish)
- Collaborative editing indicators

---

## References

### Internal

- Current package card: `client/src/features/catalog/PackageCard.tsx`
- Current package form: `client/src/features/tenant-admin/packages/PackageForm/`
- Photo uploader: `client/src/features/photos/PhotoUploader.tsx`
- Prisma schema: `server/prisma/schema.prisma`

### External

- [Radix UI Tabs](https://www.radix-ui.com/primitives/docs/components/tabs)
- [useDebouncedCallback](https://github.com/xnimorz/use-debounce)
- [TailwindCSS Group Hover](https://tailwindcss.com/docs/hover-focus-and-other-states)
