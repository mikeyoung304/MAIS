# Pattern Comparison: Visual Editor vs Landing Page Editor

**Purpose:** Side-by-side comparison of existing `useVisualEditor` patterns with proposed `useLandingPageEditor` to identify alignment opportunities.

---

## Hook Pattern Comparison

### Visual Editor (Existing)

```typescript
// client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts

export function useVisualEditor(): UseVisualEditorReturn {
  // ✅ Single source of truth: packages array
  const [packages, setPackages] = useState<PackageWithDraft[]>([]);

  // ✅ Derived metrics (memoized to prevent recomputation)
  const draftCount = useMemo(() => packages.filter((pkg) => pkg.hasDraft).length, [packages]);

  // ✅ Draft tracking: Ref-based (doesn't trigger re-renders)
  const pendingChanges = useRef<Map<string, DraftUpdate>>(new Map());
  const originalStates = useRef<Map<string, PackageWithDraft>>(new Map());
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // ✅ Batching strategy: Accumulate all changes, send in one request
  const updateDraft = useCallback((packageId, update) => {
    // Merge with pending changes
    const existing = pendingChanges.current.get(packageId) || {};
    pendingChanges.current.set(packageId, { ...existing, ...update });

    // Schedule batched save
    saveTimeout.current = setTimeout(() => flushPendingChanges(), 1000);
  }, []);

  // ✅ Flush all at once (prevents race conditions)
  const flushPendingChanges = useCallback(async () => {
    for (const [packageId, mergedUpdate] of changesToSave) {
      await api.tenantAdminUpdatePackageDraft({ params: { id: packageId }, body: mergedUpdate });
    }
  }, []);

  return {
    packages,
    loading,
    error,
    draftCount,
    isSaving,
    isPublishing,
    loadPackages,
    updateDraft,
    publishAll,
    discardAll,
    updateLocalPackage,
  };
}
```

### Landing Page Editor (Proposed from plan)

```typescript
// Proposed: client/src/features/tenant-admin/landing-page-editor/hooks/useLandingPageEditor.ts

interface LandingPageEditorState {
  // ❌ ISSUE: Separate state objects instead of single source of truth
  draftConfig: LandingPageConfig | null;
  publishedConfig: LandingPageConfig | null;

  // ⚠️ ISSUE: Manual change tracking required
  hasChanges: boolean; // Must be computed manually each render

  isLoading: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  error: string | null;
}

interface LandingPageEditorActions {
  loadConfig(): Promise<void>;
  toggleSection(section: SectionType, enabled: boolean): void;
  updateSectionContent(section, content): void;
  publishChanges(): Promise<void>;
  discardChanges(): void;
}

// Usage would be:
const [draftConfig, setDraftConfig] = useState<LandingPageConfig | null>(null);
const [publishedConfig, setPublishedConfig] = useState<LandingPageConfig | null>(null);

// Manual change detection
const hasChanges = draftConfig !== publishedConfig; // Not memoized, not derived
```

### Recommended Pattern (Align with Visual Editor)

```typescript
// RECOMMENDED: client/src/features/tenant-admin/landing-page-editor/hooks/useLandingPageEditor.ts

export interface LandingPageWithDraft {
  // ✅ Published state
  published: LandingPageConfig | null;
  publishedAt: Date | null;

  // ✅ Draft state
  draft: LandingPageConfig | null;
  draftUpdatedAt: Date | null;

  // ✅ Derived metrics
  hasDraft: boolean;
  hasChanges: boolean;
}

export function useLandingPageEditor(): UseLandingPageEditorReturn {
  // ✅ Single source of truth (mirrors PackageWithDraft pattern)
  const [landingPage, setLandingPage] = useState<LandingPageWithDraft | null>(null);

  // ✅ Derived metrics (memoized)
  const hasChanges = useMemo(
    () => landingPage?.draft !== null && landingPage?.published !== landingPage?.draft,
    [landingPage]
  );

  // ✅ Same ref-based tracking as useVisualEditor
  const pendingChanges = useRef<Map<string, Partial<LandingPageConfig>>>(new Map());
  const originalStates = useRef<Map<string, LandingPageWithDraft>>(new Map());
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // ✅ Identical batching strategy
  const updateSection = useCallback((section: SectionType, updates: any) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);

    const existing = pendingChanges.current.get(section) || {};
    pendingChanges.current.set(section, { ...existing, ...updates });

    // Optimistic update
    setLandingPage((prev) => ({
      ...prev,
      draft: { ...prev?.draft, [section]: updates },
      draftUpdatedAt: new Date(),
      hasDraft: true,
    }));

    // Schedule flush
    saveTimeout.current = setTimeout(() => flushPendingChanges(), 1000);
  }, []);

  return {
    landingPage,
    hasChanges,
    loading,
    error,
    isSaving,
    isPublishing,
    loadConfig,
    updateSection,
    publishChanges,
    discardChanges,
  };
}
```

---

## Component Pattern Comparison

### Visual Editor Components

#### EditableText (Base Pattern)

```typescript
// EXISTING: client/src/features/tenant-admin/visual-editor/components/EditableText.tsx

export function EditableText({
  value: string,
  onChange: (value: string) => void,
  placeholder?: string,
  className?: string,
  multiline?: boolean,
  rows?: number,
  hasDraft?: boolean,
  disabled?: boolean,
  "aria-label"?: string,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  // Click to enter edit mode
  const handleClick = useCallback(() => {
    if (!disabled) setIsEditing(true);
  }, [disabled]);

  // Blur or Enter to save
  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (editValue !== value) onChange(editValue);
  }, [editValue, value, onChange]);

  // Escape to cancel
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
    if (e.key === "Enter" && !multiline) {
      setIsEditing(false);
      if (editValue !== value) onChange(editValue);
    }
  }, [editValue, value, onChange, multiline]);

  return (
    <>
      {isEditing ? (
        <input value={editValue} onChange={...} onBlur={...} onKeyDown={...} />
      ) : (
        <div onClick={handleClick}>{value || placeholder}</div>
      )}
    </>
  );
}
```

#### EditablePrice (Specialized variant)

```typescript
// EXISTING: client/src/features/tenant-admin/visual-editor/components/EditablePrice.tsx

export function EditablePrice({
  value: number,        // In cents
  onChange: (value: number) => void,
  className?: string,
  hasDraft?: boolean,
  disabled?: boolean,
  "aria-label"?: string,
}) {
  // Same pattern as EditableText, but:
  // - Formats value: cents → dollars (9999 → "99.99")
  // - Parses input: dollars → cents ("99.99" → 9999)
  // - Numeric validation only

  return (
    <>
      {isEditing ? (
        <input
          type="text"
          inputMode="decimal"
          value={formatCentsToDollars(editValue)}
          onChange={handleNumberChange}  // Only allows 0-9 and decimal
        />
      ) : (
        <div onClick={handleClick}>${formatCentsToDollars(value)}</div>
      )}
    </>
  );
}
```

#### PhotoDropZone (Complex component)

```typescript
// EXISTING: client/src/features/tenant-admin/visual-editor/components/PhotoDropZone.tsx

export function PhotoDropZone({
  packageId: string,
  photos: PackagePhoto[],
  onPhotosChange: (photos: PackagePhoto[]) => void,
  maxPhotos?: number,
  disabled?: boolean,
}) {
  // Features:
  // - Drag & drop
  // - Click to upload
  // - Reorder via drag
  // - Delete button
  // - Progress state
}
```

### Landing Page Plan Component Specs

#### Proposed EditableHeroSection (CURRENT PLAN)

```typescript
// PROPOSED: client/src/features/tenant-admin/landing-page-editor/sections/EditableHeroSection.tsx

export const EditableHeroSection = memo(function EditableHeroSection({
  config: HeroSectionConfig,
  onUpdate: (updates: Partial<HeroSectionConfig>) => void,
}) {
  return (
    <section className="relative min-h-[600px]...">
      <EditableImage
        currentUrl={config.backgroundImageUrl}
        onUpload={(url) => onUpdate({ backgroundImageUrl: url })}
        className="absolute inset-0"
      />

      <EditableText
        value={config.headline}
        onChange={(headline) => onUpdate({ headline })}
        className="text-5xl font-bold mb-4"
        placeholder="Your Headline Here"
      />

      <EditableText
        value={config.subheadline}
        onChange={(subheadline) => onUpdate({ subheadline })}
        className="text-xl mb-8"
        placeholder="Your subheadline here"
        multiline
      />

      <EditableText
        value={config.ctaText}
        onChange={(ctaText) => onUpdate({ ctaText })}
        className="inline-block bg-white..."
        placeholder="Call to Action"
      />
    </section>
  );
});
```

### Recommended Pattern (Simplify with Wrapper)

#### EditableSection Base Wrapper (NEW)

```typescript
// RECOMMENDED: client/src/features/tenant-admin/landing-page-editor/components/EditableSection.tsx

interface EditableSectionProps {
  title: string;
  isEditing: boolean;
  children: ReactNode;
  onSave?: () => void;
  onDiscard?: () => void;
  className?: string;
}

export function EditableSection({
  title,
  isEditing,
  children,
  onSave,
  onDiscard,
  className = "",
}: EditableSectionProps) {
  return (
    <section className={cn("border rounded-lg p-6", isEditing && "ring-2 ring-primary")}>
      {/* Header with edit mode indicator */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {isEditing && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onDiscard}>Discard</Button>
            <Button size="sm" onClick={onSave}>Save</Button>
          </div>
        )}
      </div>

      {/* Section content */}
      {children}
    </section>
  );
}

// USAGE: Simplified section component
export function EditableHeroSection({ config, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <EditableSection
      title="Hero Section"
      isEditing={isEditing}
      onSave={() => setIsEditing(false)}
      onDiscard={() => setIsEditing(false)}
    >
      <HeroSection {...config}>
        {isEditing && (
          <div className="absolute inset-0 bg-black/20 p-4 flex flex-col gap-4">
            <EditableText
              value={config.headline}
              onChange={(h) => onUpdate({ headline: h })}
              placeholder="Headline"
            />
            {/* ... other editable fields */}
          </div>
        )}
      </HeroSection>
    </EditableSection>
  );
}
```

---

## API Contract Pattern Comparison

### Visual Editor Contracts

```typescript
// packages/contracts/src/tenant-admin/packages.contract.ts

export const packagesAdminContract = c.router({
  // Get packages with draft fields
  tenantAdminGetPackagesWithDrafts: {
    method: 'GET',
    path: '/v1/tenant-admin/packages',
    responses: {
      200: z.array(PackageWithDraftDto),
    },
  },

  // Update single package draft
  tenantAdminUpdatePackageDraft: {
    method: 'PUT',
    path: '/v1/tenant-admin/packages/:id/draft',
    params: z.object({ id: z.string() }),
    body: UpdatePackageDraftDto,
    responses: {
      200: PackageWithDraftDto,
    },
  },

  // Publish all drafts
  tenantAdminPublishDrafts: {
    method: 'POST',
    path: '/v1/tenant-admin/packages/publish',
    body: z.object({}),
    responses: {
      200: z.object({ published: z.number() }),
    },
  },

  // Discard all drafts
  tenantAdminDiscardDrafts: {
    method: 'POST',
    path: '/v1/tenant-admin/packages/discard',
    body: z.object({}),
    responses: {
      200: z.object({ discarded: z.number() }),
    },
  },
});
```

### Landing Page Contract (Current - INCOMPLETE)

```typescript
// packages/contracts/src/tenant-admin/landing-page.contract.ts

export const landingPageAdminContract = c.router({
  // Get current landing page
  getLandingPage: {
    method: 'GET',
    path: '/v1/tenant-admin/landing-page',
    responses: { 200: LandingPageConfigSchema.nullable() },
  },

  // Update entire landing page (no draft support yet!)
  updateLandingPage: {
    method: 'PUT',
    path: '/v1/tenant-admin/landing-page',
    body: LandingPageConfigSchema,
    responses: { 200: LandingPageConfigSchema },
  },

  // Toggle section visibility
  toggleSection: {
    method: 'PATCH',
    path: '/v1/tenant-admin/landing-page/sections',
    body: z.object({ section: z.enum([...]), enabled: z.boolean() }),
    responses: { 200: z.object({ success: z.boolean() }) },
  },

  // ❌ MISSING: Draft management endpoints
});
```

### Landing Page Contract (Recommended - Add Draft Support)

```typescript
// RECOMMENDED ADDITIONS to landing-page.contract.ts

export const landingPageAdminContract = c.router({
  // Existing endpoints
  getLandingPage: {
    /* ... */
  },
  updateLandingPage: {
    /* ... */
  },
  toggleSection: {
    /* ... */
  },

  // NEW: Mirror package pattern exactly
  getDraft: {
    method: 'GET',
    path: '/v1/tenant-admin/landing-page/draft',
    responses: {
      200: z.object({
        landingPage: z.object({
          published: LandingPageConfigSchema.nullable(),
          draft: LandingPageConfigSchema.nullable(),
          hasDraft: z.boolean(),
          draftUpdatedAt: z.string().datetime().nullable(),
          publishedAt: z.string().datetime().nullable(),
        }),
      }),
    },
  },

  saveDraft: {
    method: 'PUT',
    path: '/v1/tenant-admin/landing-page/draft',
    body: z.object({
      sections: z.record(z.string(), z.any()), // Partial updates
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

---

## Error Handling Pattern Comparison

### Visual Editor (Existing)

```typescript
// useVisualEditor.ts
const flushPendingChanges = useCallback(async () => {
  for (const [packageId, mergedUpdate] of changesToSave) {
    try {
      const { status, body } = await api.tenantAdminUpdatePackageDraft({
        params: { id: packageId },
        body: mergedUpdate,
      });

      if (status !== 200 || !body) {
        const errorMessage = (body as { error?: string })?.error || "Failed to save";
        throw new Error(errorMessage);
      }

      // Success: update UI with response
      setPackages((prev) =>
        prev.map((pkg) => (pkg.id === packageId ? body : pkg))
      );
    } catch (err) {
      // Log error with context
      logger.error("Failed to save draft", {
        component: "useVisualEditor",
        packageId,
        error: err,
      });

      // Rollback to original state
      const original = originalsToRestore.get(packageId);
      if (original) {
        setPackages((prev) =>
          prev.map((pkg) => (pkg.id === packageId ? original : pkg))
        );
      }

      failedPackages.push(packageId);
    }
  }

  // Show error toast if any failures
  if (failedPackages.length > 0) {
    toast.error(`Failed to save ${failedPackages.length} package${...}`, {
      description: "Your changes have been reverted. Please try again.",
    });
  }
}, []);
```

### Landing Page (Recommended Pattern)

```typescript
// useLandingPageEditor.ts - MIRROR EXACT PATTERN
const flushPendingChanges = useCallback(async () => {
  const changesToSave = new Map(pendingChanges.current);
  const originalsToRestore = new Map(originalStates.current);

  pendingChanges.current.clear();
  originalStates.current.clear();

  saveInProgress.current = true;
  setIsSaving(true);

  const failedSections: string[] = [];

  for (const [sectionKey, update] of changesToSave) {
    try {
      const { status, body } = await api.tenantAdminSaveLandingPageDraft({
        body: { sections: { [sectionKey]: update } },
      });

      if (status !== 200 || !body) {
        const errorMessage = (body as { error?: string })?.error || 'Failed to save';
        throw new Error(errorMessage);
      }

      // Success: update UI
      setLandingPage((prev) => ({
        ...prev,
        draft: body.draft,
        draftUpdatedAt: new Date(body.draftUpdatedAt),
        hasDraft: body.hasDraft,
      }));
    } catch (err) {
      // ✅ SAME: Log with component context
      logger.error('Failed to save draft', {
        component: 'useLandingPageEditor',
        section: sectionKey,
        error: err,
      });

      // ✅ SAME: Rollback
      const original = originalsToRestore.get(sectionKey);
      if (original) {
        setLandingPage(original);
      }

      failedSections.push(sectionKey);
    }
  }

  saveInProgress.current = false;
  setIsSaving(false);

  // ✅ SAME: Toast on failure
  if (failedSections.length > 0) {
    toast.error(
      `Failed to save ${failedSections.length} section${failedSections.length !== 1 ? 's' : ''}`,
      { description: 'Your changes have been reverted. Please try again.' }
    );
  }
}, []);
```

---

## Summary: Alignment Checklist

| Aspect            | Visual Editor                                    | Landing Page (Current)   | Recommended for LP                     |
| ----------------- | ------------------------------------------------ | ------------------------ | -------------------------------------- |
| State Structure   | Single `packages` array                          | Separate draft/published | `LandingPageWithDraft`                 |
| Derived Metrics   | Memoized `draftCount`                            | Manual `hasChanges`      | Memoized `hasChanges`                  |
| Draft Tracking    | Ref-based `Map<id, update>`                      | Not specified            | Ref-based `Map<section, update>`       |
| Batching          | Single timeout + `flushPendingChanges`           | Not detailed             | Single timeout + `flushPendingChanges` |
| Error Handling    | Logger + toast + rollback                        | Not detailed             | Logger + toast + rollback              |
| Components        | `EditableText`, `EditablePrice`, `PhotoDropZone` | Proposed 7 new sections  | Wrap with `EditableSection`            |
| API Contracts     | 4 draft management endpoints                     | Only 3 endpoints         | Add 4 draft endpoints                  |
| Contract Response | `PackageWithDraftDto`                            | None yet                 | `LandingPageWithDraftDto`              |

---

## Action Items (In Priority Order)

1. **CRITICAL:** Update `landing-page.contract.ts` with draft endpoints
2. **CRITICAL:** Define `LandingPageWithDraftDto` schema matching `PackageWithDraftDto`
3. **HIGH:** Implement `useLandingPageEditor` mirroring `useVisualEditor` exactly
4. **HIGH:** Create `EditableSection` wrapper for reusability
5. **MEDIUM:** Verify all error handling matches visual editor pattern
6. **MEDIUM:** Reuse existing section components (HeroSection, etc.) instead of creating new ones
7. **LOW:** Document auto-save batching strategy in JSDoc

---

_This comparison aims to maximize code reuse and pattern consistency. By following the proven visual editor patterns, the landing page editor should be robust, maintainable, and familiar to future developers._
