---
status: pending
priority: p1
issue_id: '247'
tags: [code-review, landing-page, state-management, race-condition]
dependencies: ['246']
source: 'plan-review-2025-12-04'
---

# TODO-247: useLandingPageEditor Hook Missing Critical Batching/Rollback Patterns

## Priority: P1 (Critical - Data Loss Risk)

## Status: Pending

## Source: Plan Review - Landing Page Visual Editor (Architecture + Pattern Consistency)

## Problem Statement

The proposed `useLandingPageEditor` hook (plan lines 60-96) is **dangerously oversimplified** compared to the proven `useVisualEditor` hook (354 lines). Missing patterns will cause:

1. **Race conditions** - Concurrent saves overwrite each other
2. **Data loss on network failure** - No rollback to original state
3. **Incomplete publishes** - Pending auto-saves not flushed before publish

**Why It Matters:**

Real-world editing scenario that will fail:
1. User rapidly edits hero headline → about section → FAQ items
2. Network delays cause out-of-order responses
3. One section save fails while another succeeds
4. User clicks publish while auto-save is pending → draft incomplete

## Findings

### Missing Infrastructure (Comparison)

| Pattern | useVisualEditor | Plan's useLandingPageEditor |
|---------|-----------------|----------------------------|
| `saveTimeout` ref | Line 69 | Missing |
| `pendingChanges` Map | Line 71 | Missing |
| `originalStates` Map | Line 73 | Missing |
| `saveInProgress` flag | Line 75 | Missing |
| Batching logic | Lines 112-170 | Not specified |
| Rollback on failure | Lines 144-157 | Not specified |
| Flush before publish | Lines 244-248 | Incomplete |
| Cleanup on unmount | Lines 320-330 | Not specified |

### Plan's Simple State (Insufficient)

```typescript
interface LandingPageEditorState {
  draftConfig: LandingPageConfig | null;
  publishedConfig: LandingPageConfig | null;
  hasChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  error: string | null;
}
```

### Required Infrastructure (from useVisualEditor)

```typescript
// These refs are CRITICAL for race condition prevention
const saveTimeout = useRef<NodeJS.Timeout | null>(null);
const pendingChanges = useRef<Map<string, Partial<SectionConfig>>>(new Map());
const originalStates = useRef<Map<string, LandingPageConfig>>(new Map());
const saveInProgress = useRef<boolean>(false);
```

## Proposed Solutions

### Option A: Copy useVisualEditor Architecture (Recommended)
- **Effort:** 4-6 hours
- **Risk:** Low (proven pattern)
- Use `useVisualEditor.ts` as template
- Adapt for landing page context (sections vs packages)
- Include all batching, rollback, cleanup patterns
- **Pros:** Battle-tested, handles edge cases
- **Cons:** More code than plan estimated

### Option B: Extract Generic useDraftEditor Hook
- **Effort:** 6-8 hours
- **Risk:** Medium
- Create `useDraftEditor<T>` generic hook with all patterns
- Both visual editor and landing page editor use it
- **Pros:** DRY, single source of truth
- **Cons:** Refactoring risk to existing working code

### Option C: Minimal Implementation Without Batching
- **Effort:** 2-3 hours
- **Risk:** HIGH - NOT RECOMMENDED
- Implement simple version as planned
- **Pros:** Faster initial development
- **Cons:** Will cause data loss in production

## Recommended Action

**Execute Option A:** Update plan's hook specification to include:

```typescript
// useLandingPageEditor.ts - Required infrastructure

// 1. Refs for race condition prevention
const saveTimeout = useRef<NodeJS.Timeout | null>(null);
const pendingChanges = useRef<Record<string, Partial<SectionConfig>>>({});
const originalConfig = useRef<LandingPageConfig | null>(null);
const saveInProgress = useRef<boolean>(false);

// 2. Batching function (from useVisualEditor lines 112-170)
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
    const mergedConfig = mergeChanges(draftConfig, changesToSave);
    const { status } = await api.tenantAdminSaveDraft({ body: mergedConfig });
    if (status !== 200) throw new Error('Save failed');
  } catch (err) {
    // Rollback on failure
    if (configToRestore) {
      setDraftConfig(configToRestore);
    }
    toast.error('Failed to save changes');
  } finally {
    saveInProgress.current = false;
    setIsSaving(false);
  }
}, [draftConfig]);

// 3. Flush before publish (CRITICAL)
const publishChanges = useCallback(async () => {
  if (saveTimeout.current) {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = null;
  }
  await flushPendingChanges(); // Ensure all changes saved before publish
  // ... then publish
}, [flushPendingChanges]);

// 4. Cleanup on unmount
useEffect(() => {
  return () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
  };
}, []);
```

## Acceptance Criteria

- [ ] Hook includes `saveTimeout` ref for debounce management
- [ ] Hook includes `pendingChanges` for batching
- [ ] Hook includes `originalConfig` for rollback on failure
- [ ] Hook includes `saveInProgress` flag to prevent overlaps
- [ ] `flushPendingChanges` called before publish
- [ ] Cleanup in useEffect return function
- [ ] E2E test: 50 rapid edits without race conditions

## Work Log

| Date       | Action  | Notes                                              |
|------------|---------|---------------------------------------------------|
| 2025-12-04 | Created | Plan review identified missing state management   |

## Tags

code-review, landing-page, state-management, race-condition
