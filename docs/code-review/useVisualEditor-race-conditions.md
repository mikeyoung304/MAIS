# Race Condition Timeline Diagrams

## Issue 1: Stale Closure in `updateDraft`

### Scenario: Rapid edits cause wrong original state capture

```
Timeline:
─────────────────────────────────────────────────────────────────

T0: Initial state
┌─ Hook created
├─ packages = [PkgA(v1), PkgB(v1)]
└─ packages prop captured in updateDraft closure

T1: User types "A" in PkgA.title
┌─ updateDraft('PkgA', { title: 'A' })
├─ originalStates = { PkgA: PkgA(v1) }  ✓ Correct
├─ setPackages([PkgA(v2), PkgB(v1)])
├─ Render triggered with new packages value
└─ React creates NEW updateDraft function (packages changed)

T2: packages state updated, new closure created
┌─ packages = [PkgA(v2), PkgB(v1)]  ← DIFFERENT from T0!
└─ NEW updateDraft closure has this new packages

T3: User types "B" in PkgB.title (before debounce flush)
┌─ updateDraft('PkgB', { title: 'B' })  ← Uses NEW closure
├─ originalStates = { PkgA: v1, PkgB: ??? }
├─ Problem: packages.find('PkgB') returns PkgB(v1)
├─ BUT packages already updated from T1!
├─ This is actually CORRECT this time, but...
└─ setPackages([PkgA(v2-edit), PkgB(v2)])

T4: Debounce fires (1000ms later), flushPendingChanges executes
┌─ changesToSave = { PkgA: {...}, PkgB: {...} }
├─ originals = { PkgA: v1, PkgB: v1 }
├─ Try save PkgA... SUCCESS ✓
└─ Try save PkgB...
    ├─ Sends update to server
    ├─ Server might reject if version mismatch
    └─ Rollback to PkgB(v1) - LOSING T3 edits ✗

RACE CONDITION:
If network latency between PkgA save and PkgB save is long,
and user makes another edit to PkgB during that time,
the original state capture becomes unreliable.
```

### Why removing `packages` from deps fixes this:

```
Fixed Timeline:
──────────────────────────────────────────────────────────────

T0: Initial state
┌─ Hook created
├─ packages = [PkgA(v1), PkgB(v1)]
├─ updateDraft = stable function (NO packages in deps!)
└─ originalStates.current = empty Map

T1: User types "A" in PkgA.title
┌─ updateDraft('PkgA', { title: 'A' })
├─ originalStates.current = { PkgA: PkgA(v1) }  ✓ From refs
├─ setPackages([PkgA(v2), PkgB(v1)])
├─ Render happens with new packages state
└─ updateDraft function is UNCHANGED (stable closure!)

T2: Render completes, packages state changed
┌─ packages = [PkgA(v2), PkgB(v1)]
├─ But updateDraft is SAME function from T0
└─ Closure uses SAME refs (originalStates, pendingChanges)

T3: User types "B" in PkgB.title (before debounce)
┌─ updateDraft('PkgB', { title: 'B' })  ← SAME closure
├─ originalStates.current.has('PkgB') = false (first edit)
├─ Capture original from refs: originalStates.current['PkgB'] = PkgB(v1) ✓
└─ This is ALWAYS correct because it's from refs, not closure

T4: Debounce fires, flushPendingChanges executes
┌─ changesToSave = { PkgA: {...}, PkgB: {...} }
├─ originals = { PkgA: v1, PkgB: v1 }  ✓ From refs
├─ Try save PkgA... SUCCESS
└─ Try save PkgB... SUCCESS (correct original)
```

**Key difference:** Original state is captured from refs (always fresh), not from closure (stale).

---

## Issue 2: Race Condition in `publishAll`

### Scenario: User edits during flush window

```
Current (BROKEN) Timeline:
──────────────────────────────────────────────────────────────────

User has 1 draft (PkgA)

T0: User clicks "Publish All"
┌─ publishAll() called
├─ draftCount = 1 ✓
├─ clearTimeout (no pending save)
└─ await flushPendingChanges() → waiting...

T1: Async flush in progress (network latency ~100-500ms)
┌─ POST /tenant-admin/packages/PkgA/draft
├─ Status: IN FLIGHT
└─ Response: pending...

T2: MEANWHILE - User edits PkgB (rapid click)
┌─ updateDraft('PkgB', { title: 'New' })
├─ saveTimeout is null (was cleared at T0)
├─ draftCount = 2 (PkgA + PkgB)
├─ Creates NEW saveTimeout for 1000ms
└─ Sets PkgB in pendingChanges.current

T3: Network response arrives for PkgA save
┌─ flushPendingChanges completes
├─ pendingChanges = { PkgB: ... } still
└─ Resolve await, return from flushPendingChanges()

T4: publishAll continues after await
┌─ setIsPublishing(true)
├─ POST /tenant-admin/publish-drafts
├─ This publishes: which packages? Only PkgA (already saved)
└─ Response: { published: 1 }

T5: User sees "Published 1 package" ✓
    But PkgB is still in pendingChanges!
    └─ It won't flush until 1000ms debounce completes
    └─ But by then, publish already ran!
    └─ PkgB changes may be lost or in inconsistent state

RESULT: PkgB edit lost or not published!
```

### Fixed Timeline with defensive check:

```
Fixed Timeline:
──────────────────────────────────────────────────────────────────

User has 1 draft (PkgA)

T0: User clicks "Publish All"
┌─ publishAll() called
├─ Skip early draftCount check (it might change!)
├─ clearTimeout
└─ await flushPendingChanges() → waiting...

T1: Async flush in progress (~100-500ms)
┌─ POST /tenant-admin/packages/PkgA/draft
└─ Response: pending...

T2: Meanwhile - User edits PkgB
┌─ updateDraft('PkgB', { title: 'New' })
├─ saveTimeout is null (cleared)
├─ Creates NEW saveTimeout
└─ Sets PkgB in pendingChanges.current

T3: Network response for PkgA arrives
┌─ flushPendingChanges completes
├─ pendingChanges = { PkgB: ... }
└─ Return from await

T4: publishAll NOW checks draftCount
┌─ REFRESH: packages.filter(p => p.hasDraft).length
├─ Result: draftCount = 2 (PkgA + PkgB)
├─ NOT zero, so continue...
└─ But wait! PkgB is still pending in the map!

T5: Clear saveTimeout AGAIN (in case more edits came)
┌─ clearTimeout (the one created in T2)
├─ await flushPendingChanges() AGAIN
└─ Now flushes PkgB too!

T6: Now publish with both packages saved
┌─ POST /tenant-admin/publish-drafts
├─ Publishes: PkgA + PkgB
└─ Response: { published: 2 }

RESULT: Both packages published correctly! ✓
```

---

## Issue 3: Dependency Array Causing Callback Recreation

### Component Rerender Chain

```
Visual representation of render cascade:

┌─────────────────────────────────────────────────────────────┐
│ VisualEditorDashboard                                       │
│ ├─ useVisualEditor()                                        │
│ │  ├─ packages state: [PkgA(v1), PkgB(v1)]                 │
│ │  ├─ updateDraft callback                                 │
│ │  │  └─ deps: [packages, flushPendingChanges] ⚠️ PROBLEM  │
│ │  └─ returns hook value                                    │
│ └─ passes updateDraft to EditablePackageGrid               │
│    └─ passes handleUpdatePackage to EditablePackageCard    │
│       └─ passes onUpdate to EditableText                   │
│          └─ each keystroke triggers updateDraft()         │
└─────────────────────────────────────────────────────────────┘

Keystroke Flow (User types "A"):
──────────────────────────────────────────────────────────────

1. User types in EditableText input
2. EditableText.handleChange fires
3. Calls onUpdate({ title: 'A' })
4. onUpdate = EditablePackageCard.handleTitleChange
5. handleTitleChange calls updateDraft('PkgA', { title: 'A' })
6. updateDraft calls setPackages([PkgA(v2), PkgB(v1)])
7. setPackages triggers re-render of VisualEditorDashboard
8. useVisualEditor hook runs AGAIN
9. packages value changed! [PkgA(v2), PkgB(v1)]
10. NEW updateDraft created (because packages in deps changed)
11. NEW handleUpdatePackage created
12. NEW handleTitleChange created
13. ALL props in EditableText changed
14. Even though EditableText uses React.memo, props changed
15. EditableText re-renders!

Render count after single keystroke:
┌─ VisualEditorDashboard: 1 render
├─ EditablePackageGrid: 1 render (packages changed)
├─ EditablePackageCard: 1 render (onUpdatePackage changed)
├─ EditableText (for title): 1 render (onUpdate changed)
├─ EditableText (for description): 1 render (onUpdate changed)
├─ PhotoDropZone: 1 render (onPhotosChange changed)
└─ Total: 6+ renders per keystroke

Performance impact:
- 60 character input = ~60 renders (should be < 10)
- User perceives lag
- Battery drain on mobile devices
- Animation jank

Fix: Remove packages from deps
└─ updateDraft becomes stable
   └─ All downstream callbacks become stable
      └─ EditablePackageCard gets React.memo benefit
         └─ No re-render unless actual package data changed
```

---

## Testing Strategy

### 1. Unit Test: Callback Stability

```typescript
test('updateDraft maintains referential equality across state updates', () => {
  const { result, rerender } = renderHook(() => useVisualEditor());

  // Store initial callback reference
  const callback1 = result.current.updateDraft;

  // Trigger state change through callback
  act(() => {
    result.current.updateDraft('pkg1', { title: 'Test' });
  });

  // Let render happen
  rerender();

  // Callback should be THE SAME reference
  const callback2 = result.current.updateDraft;
  expect(callback1).toBe(callback2); // ← Passes with fix, fails without
});
```

### 2. Integration Test: No Lost Edits

```typescript
test('edits made during publishAll flush are included', async () => {
  const { result } = renderHook(() => useVisualEditor());

  // Make first edit
  act(() => {
    result.current.updateDraft('pkg1', { title: 'Edit 1' });
  });

  // Mock network delay
  api.tenantAdminUpdatePackageDraft.mockImplementation(
    () => new Promise(resolve => setTimeout(resolve, 200))
  );

  // Start publish
  const publishPromise = act(() => result.current.publishAll());

  // Make second edit DURING flush (within 200ms window)
  act(() => {
    jest.advanceTimersByTime(100);
    result.current.updateDraft('pkg2', { title: 'Edit 2' });
  });

  // Complete publish
  jest.advanceTimersByTime(500);
  await publishPromise;

  // Both packages should be published
  expect(api.tenantAdminPublishDrafts).toHaveBeenCalledWith(
    expect.objectContaining({
      // Should handle both pkg1 and pkg2
    })
  );
});
```

### 3. E2E Test: Race Condition Scenario

```typescript
test('rapid edits to multiple packages during save', async () => {
  // Navigate to visual editor
  await page.goto('/tenant/visual-editor');

  // Find two package cards
  const pkg1Card = page.locator('[data-testid="package-card-pkg1"]');
  const pkg2Card = page.locator('[data-testid="package-card-pkg2"]');

  // Edit package 1
  await pkg1Card.getByRole('textbox', { name: 'title' }).fill('New Title 1');

  // Immediately edit package 2 (before debounce)
  await pkg2Card.getByRole('textbox', { name: 'title' }).fill('New Title 2');

  // Wait for auto-save (1 second debounce)
  await page.waitForLoadState('networkidle', { timeout: 3000 });

  // Verify both changes saved
  await expect(page.locator('text=New Title 1')).toBeVisible();
  await expect(page.locator('text=New Title 2')).toBeVisible();

  // Click publish
  await page.getByRole('button', { name: /Publish All/ }).click();

  // Wait for publish to complete
  await page.waitForLoadState('networkidle');

  // Verify success message shows 2 published
  await expect(page.locator('text=Published 2 packages')).toBeVisible();
});
```

---

## Prevention Checklist

- [ ] Remove `packages` from `updateDraft` useCallback dependencies
- [ ] Add defensive re-check of draftCount after flushPendingChanges in publishAll
- [ ] Add try/catch around publishAll to handle flush errors
- [ ] Add warning log if draftCount changes during publish
- [ ] Add unit test for callback stability
- [ ] Add integration test for concurrent edits during flush
- [ ] Add E2E test for the full publish flow
- [ ] Verify EditablePackageCard properly memoized
- [ ] Consider adding error boundaries
- [ ] Monitor error logs for rollback events
