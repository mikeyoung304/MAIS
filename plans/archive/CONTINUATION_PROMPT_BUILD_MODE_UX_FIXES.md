# Continuation Prompt: Build Mode UX Fixes

**Date:** 2026-01-09
**Context:** Found during testing of preview update fix
**Goal:** Fix two UX issues in Build Mode layout

---

## Issues Found

During Playwright testing of Build Mode, two UX issues were discovered:

### Issue 1: Growth Assistant Sidebar Visible During Build Mode

**Problem:** When entering Build Mode (`/tenant/build`), the Growth Assistant sidebar on the right remains visible, creating confusion with TWO chat panels:

- Build Mode Chat (left panel) - for editing storefront
- Growth Assistant (right sidebar) - for onboarding/general help

**Screenshot Evidence:** The Growth Assistant shows onboarding progress and chat, competing with Build Mode's own chat panel.

**Expected:** Growth Assistant sidebar should be hidden or collapsed when Build Mode is active. Build Mode has its own dedicated chat.

**Files to Investigate:**

- `apps/web/src/app/(protected)/tenant/build/page.tsx` - Build Mode page
- `apps/web/src/components/layout/DashboardLayout.tsx` (or similar) - Layout with sidebar
- `apps/web/src/components/growth-assistant/` - Growth Assistant components

### Issue 2: Build Mode Chat Panel Too Narrow

**Problem:** The Build Mode split-panel layout shows the chat panel extremely narrow (collapsed), with the preview iframe taking most of the space. Users can barely see the chat content.

**Screenshot Evidence:** "Assistant Unavailable" text is partially hidden, quick action buttons truncated.

**Expected:** Build Mode chat panel should have a reasonable default width (35% as specified in the code) and be fully visible on load.

**Files to Investigate:**

- `apps/web/src/app/(protected)/tenant/build/page.tsx` - Lines 199-222 show PanelGroup setup
- The panel has `defaultSize={35}` which should work, but something is overriding it

**Current Code (page.tsx lines 196-222):**

```tsx
<PanelGroup orientation="horizontal" className="h-full">
  {/* Left Panel - Chat */}
  <Panel defaultSize={35} minSize={25} maxSize={50}>
    <div className="h-full overflow-hidden bg-white border-r border-neutral-200">
      <BuildModeChat ... />
    </div>
  </Panel>

  <PanelResizeHandle className="w-1 bg-neutral-200 hover:bg-sage transition-colors cursor-col-resize" />

  {/* Right Panel - Preview */}
  <Panel defaultSize={65} minSize={50}>
    <div className="h-full overflow-hidden">
      <BuildModePreview ... />
    </div>
  </Panel>
</PanelGroup>
```

---

## Proposed Solutions

### Fix 1: Hide Growth Assistant in Build Mode

**Option A (Recommended):** Add layout prop to hide sidebar

```tsx
// In Build Mode page or layout
<DashboardLayout hideGrowthAssistant={true}>{/* Build Mode content */}</DashboardLayout>
```

**Option B:** Use route-based detection in layout

```tsx
// In DashboardLayout
const pathname = usePathname();
const isBuilderMode = pathname?.includes('/tenant/build');
// Conditionally render Growth Assistant
```

### Fix 2: Ensure Panel Default Width

**Possible Causes:**

1. CSS conflict overriding panel width
2. `react-resizable-panels` state persistence (localStorage)
3. Parent container not providing full width
4. Race condition during hydration

**Debug Steps:**

1. Check if `react-resizable-panels` persists state to localStorage
2. Verify parent container has `h-full w-full`
3. Check for CSS that might collapse the panel
4. Try adding `autoSaveId` to reset persisted state

---

## Success Criteria

1. Growth Assistant sidebar is NOT visible when on `/tenant/build`
2. Build Mode chat panel loads at ~35% width (not collapsed)
3. Panel resize handle is visible and functional
4. No layout shift or flicker on page load

---

## Files to Read First

```bash
# Layout and sidebar
apps/web/src/app/(protected)/layout.tsx
apps/web/src/components/layout/DashboardLayout.tsx

# Build Mode page
apps/web/src/app/(protected)/tenant/build/page.tsx

# Growth Assistant
apps/web/src/components/growth-assistant/GrowthAssistantPanel.tsx
```

---

## Related Documentation

- `react-resizable-panels` docs: https://github.com/bvaughn/react-resizable-panels
- Previous fix: Preview update callback (same session)
- Test report: `docs/test-reports/ONBOARDING_FLOW_TEST_REPORT_20260109.md`

---

## Prompt for New Session

Copy below this line:

---

I need to fix two UX issues in Build Mode that were discovered during testing:

**Issue 1: Growth Assistant Sidebar Visible During Build Mode**

- The right sidebar (Growth Assistant) stays visible when entering Build Mode
- This creates TWO competing chat panels - confusing for users
- Build Mode has its own chat panel, so Growth Assistant should be hidden

**Issue 2: Build Mode Chat Panel Too Narrow**

- The left panel (Build Mode Chat) loads extremely narrow/collapsed
- The `defaultSize={35}` in the code isn't being applied
- Users can barely see the chat content

**Context file:** Read `plans/CONTINUATION_PROMPT_BUILD_MODE_UX_FIXES.md` for full details, screenshots evidence description, and proposed solutions.

**Tasks:**

1. Investigate why Growth Assistant shows in Build Mode
2. Add logic to hide it when on `/tenant/build` route
3. Investigate why the panel width is collapsed
4. Fix the default panel size to show at 35%

Start by reading the layout files to understand the sidebar structure.
