# 🚧 DEFERRED: Build Mode Upgrade Plan

**Status:** DEFERRED - Focus on perfecting existing build mode
**Decision Date:** 2026-01-11
**Reason:** System needs to focus on perfecting what's already built before adding new features

---

## Original Plan Details

# MAIS Dashboard Upgrade: Complete Implementation Plan

**Date:** 2026-01-10 (Updated: 2026-01-11 with formalized conflict handling)
**Project:** Tenant Dashboard UI/UX & AI Agent Functionality Upgrade
**Architecture:** Iframe-Native Direct Editing with Co-Editing UX
**Timeline:** 11-13 days (4 phases)
**Impact:** ~2,060 new lines across 9 new files + 9 modified files

---

## Executive Summary

### Current State

MAIS has an **agent-first dashboard** where users build their storefronts primarily through AI chat. The preview lives in a same-origin iframe, but **users cannot edit content directly** - they must describe changes to the AI, which then updates the draft.

**Key Limitations:**

- ❌ No inline editing (tap text → type)
- ❌ No direct image replacement
- ❌ Mobile AI interface blocks canvas view
- ⚠️ Performance issues (100ms delay workaround, N+1 queries)
- ⚠️ Only nuclear "discard all" undo option

### Goals

**Primary:** Enable direct editing in preview (inline text, image picker) without going through AI
**Secondary #1:** Performance optimization (eliminate delays, reduce queries)
**Secondary #2:** Mobile UX upgrades (bottom sheet with split view)
**Differentiator:** Granular undo for every change (user + AI)

### Core Innovation: Co-Editing with Formalized Conflict Handling

Most builders are either AI-only (generate→view) or manual-only (drag-and-drop). **MAIS will enable co-editing:**

- User taps headline → AI sees "Editing: Hero headline" in real-time
- AI suggests change to same field → **Staged** (not overwritten)
- User commits → Staged AI patch **auto-applies** (seamless)
- Every change (user OR AI) is **undoable**
- The feeling: _"The agent is painting while I still own the brush"_

**Conflict Resolution:**

- Client-side field locks prevent mid-edit overwrites (UX layer)
- Database advisory locks ensure transactional safety (DB layer)
- Staged patches create seamless collaboration (no user micro-management)
- 5-minute TTL prevents stale locks from blocking AI indefinitely

---

## Critical Architectural Decision

### ❌ REJECTED: Parent Overlays

**Why this fails:**

```
✗ Overlay positioning + scroll + responsive + font loading = permanent debugging
✗ Mobile keyboard + iOS Safari viewport changes = positioning nightmares
✗ "Why is overlay 12px off?" becomes never-ending maintenance
✗ Rebuilding editor outside the real DOM you're editing
```

### ✅ CHOSEN: Iframe-Native Editing

**Why this wins:**

```
✓ Edit real DOM (native inputs/contentEditable inside iframe)
✓ Most natural "tap → type" feeling
✓ Less fragility (no cross-frame geometry hacks)
✓ Same-origin iframe = full DOM access (no CORS)
✓ Parent stays source of truth (draft config + autosave intact)
```

**Data Flow:**

```
User taps text in iframe → Native input activates →
User types → Optimistic iframe update →
User blurs/Enter → PostMessage BUILD_MODE_FIELD_COMMIT →
Parent updates draft config → Debounced autosave (1000ms) →
Parent sends BUILD_MODE_CONFIG_UPDATE back → Iframe re-renders confirmed
```

---

## Implementation Phases

### Phase 0: Foundation (2 days)

**Goal:** Fix performance, no UI changes

**Problems to Solve:**

1. **100ms delay workaround** (`AgentPanel.tsx:320-322`)

   ```typescript
   setTimeout(() => invalidateDraftConfig(), 100); // ← Remove this
   ```

   **Root cause:** READ COMMITTED isolation + connection pooling means refetch may not see committed data
   **Solution:** Executors return updated config in response → parent updates cache directly

2. **N+1 query pattern** (`storefront-tools.ts:1102`)

   ```typescript
   // Called 15+ times per execution
   const { pages } = await getDraftConfigWithSlug(prisma, tenantId);
   ```

   **Solution:** Pre-fetch config once in `di.ts`, pass via context to all tools

3. **Overlapping hooks** (useDraftConfig + useBuildModeSync)
   **Solution:** New `usePreviewConfig` hook with TanStack Query as single source

**Files:**

- `server/src/agent/executors/storefront-executors.ts` (+20 lines)
- `server/src/di.ts` (+5 lines - add draftConfig to context)
- `apps/web/src/hooks/usePreviewConfig.ts` (NEW, 200 lines)
- `apps/web/src/components/agent/AgentPanel.tsx` (-10 lines)

**Success Metrics:**

- Query count drops from ~15 to ~3 per execution
- Cache invalidation < 50ms (no 100ms delay)
- Zero regressions in AI editing

---

### Phase 1: Iframe-Native Text Editing (4 days)

**Goal:** Ship core direct editing + field locks

**Policy Decisions (Document These):**

| Decision Point           | Default Behavior           | Rationale                                               |
| ------------------------ | -------------------------- | ------------------------------------------------------- |
| Staged patch application | **Auto-apply on unlock**   | Seamless co-editing (user doesn't need to think)        |
| Field lock TTL           | **5 minutes**              | Prevents stale locks from blocking AI indefinitely      |
| User edit trust tier     | **Bypass (no proposal)**   | User is explicitly acting, not delegating to AI         |
| Publish/Discard trust    | **T3 (high-trust)**        | Nuclear operations affecting live site require approval |
| Undo scope               | **Committed changes only** | Staged patches aren't "real" until applied              |
| Lock expiry behavior     | **Auto-save + unlock**     | Preserve user's work, don't lose edits                  |

These defaults create the **co-editing feel** without requiring user to micro-manage conflicts.

---

**Conflict Handling Strategy (Formalized):**

**A) Database Safety + Client UX Prevention**

- Keep `pg_advisory_xact_lock` for DB-level transactional safety
- Add client-side field locks for UX conflict prevention (no overwrites mid-edit)

**B) PostMessage Protocol**

```typescript
// Iframe → Parent: Edit state changes
BUILD_MODE_EDITING_STATE {
  sectionId: string,
  fieldPath: string,
  isEditing: boolean,
  timestamp: number
}

// Iframe → Parent: Committed change
BUILD_MODE_FIELD_COMMIT {
  sectionId: string,
  fieldPath: string,
  value: string | string[],
  previousValue: string | string[],
  timestamp: number
}
```

**C) Parent State Management**

```typescript
// Parent maintains two critical Maps:
lockedFields: Map<
  fieldPath,
  {
    since: number; // Timestamp when lock acquired
    ttlMs: number; // Time-to-live (default: 5 minutes)
  }
>;

stagedAiPatches: Map<
  fieldPath,
  {
    opSummary: string; // "Update hero headline"
    prev: any;
    next: any;
    toolName: string; // For audit trail
    timestamp: number;
  }
>;
```

**D) AI Write Rule (CRITICAL)**

```
When AI tool attempts to update a field:
1. Check if fieldPath exists in lockedFields
2. If LOCKED:
   - DO NOT apply to live draft state
   - Store in stagedAiPatches Map
   - Show "⏸️ AI update staged" indicator in UI
3. If NOT LOCKED:
   - Apply to draft config immediately
   - Trigger debounced autosave

When lock clears (user commits or cancels):
1. Auto-apply staged patch (default behavior)
2. OR prompt "Apply staged change?" (document chosen approach)
3. Clear from stagedAiPatches Map
```

**Field-Level Edit Lock Flow:**

```
1. User clicks headline in iframe
2. Iframe sends BUILD_MODE_EDITING_STATE { isEditing: true }
3. Parent adds to lockedFields Map: "home-hero-main.headline" → { since: Date.now(), ttlMs: 300000 }
4. Parent shows "Editing: Hero headline" in AgentPanel
5. AI tries to update headline
6. Parent checks lockedFields → FOUND
7. Parent stores in stagedAiPatches → shows "⏸️ AI update staged"
8. User commits/cancels edit
9. Iframe sends BUILD_MODE_EDITING_STATE { isEditing: false }
10. Parent removes from lockedFields
11. Parent auto-applies staged patch (if exists)
```

This creates **co-editing** - user and AI don't fight, they collaborate.

**Components to Build:**

**Iframe-side:**

1. **EditModeController** (~200 lines)
   - Detects `?edit=true` query param
   - Adds click handlers to `[data-editable]` elements
   - Sends PostMessage on focus/blur/commit
   - Receives config updates from parent

2. **InlineTextEditor** (~150 lines)
   - Replaces `<h1>` with `<input>` on click
   - For paragraphs: Auto-resize `<textarea>`
   - Keyboard shortcuts: Esc (cancel), Enter (commit)
   - Optimistic update in iframe only

3. **Edit Utils** (~200 lines)
   - Field path parsing helpers
   - Validation utilities
   - PostMessage helpers

**Parent-side:**

1. **usePreviewConfig** (Phase 0 + ~100 lines for locks)
   - `lockedFields: Map<fieldPath, { since: number, ttlMs: number }>`
   - `stagedAiPatches: Map<fieldPath, { opSummary, prev, next, toolName, timestamp }>`
   - Lock/unlock methods with TTL cleanup
   - Field commit handler with staged patch auto-apply
   - Apply field commits with debounced autosave (1000ms)

2. **EditLockIndicator** (~100 lines)
   - Shows in AgentPanel: "Editing: Hero headline"
   - Displays staged AI updates: "⏸️ AI update staged: [opSummary]"
   - Click to view staged patch details (prev/next diff)
   - User can click to cancel edit (unlock)
   - Auto-applies staged patches on unlock (default behavior)

3. **PostMessage Protocol** (+40 lines)
   - New schemas: EDITING_STATE, FIELD_COMMIT, IMAGE_REPLACE_REQUEST

**Section Updates (~9 files, ~10-15 lines each):**

```tsx
// Add data attributes
<h1 data-editable="true" data-section-id={sectionId} data-field="headline" data-field-type="text">
  {editMode && isEditingThis ? (
    <InlineTextEditor value={headline} onCommit={handleCommit} />
  ) : (
    headline
  )}
</h1>
```

**Start with these sections:**

- Hero (headline, subheadline) - ~5 occurrences
- Text sections - ~3 occurrences
- FAQ items - ~1 occurrence

**Testing:**

- E2E: Tap → Type → Blur → Verify saved
- E2E: Edit → AI updates same field → Verify staged
- E2E: Commit → AI's staged update applies
- Manual: Edit 5 fields rapidly → All save correctly

**Rollout:** Behind feature flag → Beta 5-10 tenants → Full after 1 week

---

### Phase 2: Iframe-Native Image Editing (3 days)

**Goal:** Visual editing capability

**Components:**

**Iframe-side:**

- **InlineImageEditor** (~100 lines)
  - Click image → "Replace" button overlay
  - Sends BUILD_MODE_IMAGE_REPLACE_REQUEST to parent

**Parent-side:**

- **ImagePickerModal** (~250 lines)
  - Radix Dialog with tabs: Upload / URL / Library
  - Drag-and-drop via react-dropzone
  - Integrates with `/v1/tenant-admin/landing-page/images` API
  - On save: commits new URL back via BUILD_MODE_FIELD_COMMIT

**Flow:**

```
User clicks image → Iframe sends IMAGE_REPLACE_REQUEST →
Parent opens ImagePickerModal → User uploads/selects →
Parent sends FIELD_COMMIT with new URL → Iframe updates src
```

**Testing:**

- E2E: Upload drag-and-drop → Iframe updates
- Manual: 5MB file → Rejects (API limit)
- Manual: Invalid type → Rejects

---

### Phase 3: Mobile Bottom Sheet (2 days)

**Goal:** Improve mobile UX with split view

**Problem:** Current mobile AI interface is full-screen modal that blocks canvas entirely

**Solution:**

```
┌─────────────────────────┐
│   Preview (Canvas)      │  ← 55% visible
│                         │
├─────────────────────────┤
│  🎨 Agent Panel         │  ← 45% (swipe to 20% or 85%)
│  [Drag handle]          │
│  [Chat interface]       │
└─────────────────────────┘
```

**Library:** Vaul (2.8KB gzipped)

- Purpose-built for bottom sheets
- Snap points: [20%, 45%, 85%]
- Smooth spring animations
- Used by Vercel, Cal.com

**Components:**

- **MobileBottomSheet** (~80 lines) - Vaul wrapper
- **DashboardPage** (+40 lines) - Mobile layout integration

**Testing:**

- Mobile E2E: Swipe up → 85%, down → 20%
- Mobile E2E: Edit text while sheet at 45%
- Manual: iOS Safari + Android Chrome

---

### Phase 4: Granular Undo (2 days)

**Goal:** Premium feel - every change undoable

**Why This Matters:**

- Current: Only "discard all drafts" (nuclear option)
- Premium tools (Figma, Notion): Undo any operation
- **This is the differentiator** - Apple-grade UX

**Scope (CRITICAL):**

- Undo/redo applies to **committed changes only** (both user and AI-applied)
- Staged patches (in `stagedAiPatches` Map) are NOT in undo stack
- Once staged patch auto-applies, it becomes undoable

**Operation Schema:**

```typescript
interface EditOperation {
  id: string;
  timestamp: number;
  type: 'user_edit' | 'ai_edit' | 'user_upload' | 'ai_upload';
  sectionId: string;
  fieldPath: string;
  previousValue: string | string[];
  newValue: string | string[];
  source: 'user' | 'ai';
  applied: boolean; // True when committed to draft config
}
```

**Components:**

- **useEditHistory** (~250 lines)
  - Operation log (localStorage + memory)
  - Undo/redo stacks (limit 50 operations)
  - Keyboard shortcuts: Cmd+Z (undo), Cmd+Shift+Z (redo)
  - Applies `previousValue` to draft config on undo
  - Triggers debounced autosave after undo/redo
  - Cross-tab sync for history consistency
  - Only tracks committed operations (excludes staged patches)

**UX:**

- Undo/Redo buttons in PreviewPanel toolbar
- Tooltips: "Undo: Edit Hero headline (user)" or "Undo: AI updated CTA button"
- Toast: "Undid: Hero headline edit"
- Disabled state when stack empty
- Shows operation source (user vs AI) in tooltip

**Testing:**

- E2E: User edit → Undo → Verify reverts to previous value
- E2E: AI edit → Undo → Verify reverts to previous value
- E2E: Edit 5 times → Undo 5 times → Correct LIFO order
- E2E: Undo → Redo → Verify forward operation
- E2E: Staged patch auto-applies → Becomes undoable
- Manual: Keyboard shortcuts (Cmd+Z, Cmd+Shift+Z) work
- Manual: Cross-tab undo history consistency

---

## PostMessage Protocol

### New Messages (Iframe → Parent)

**BUILD_MODE_EDITING_STATE**

```typescript
{
  type: 'BUILD_MODE_EDITING_STATE',
  data: {
    sectionId: string,           // e.g., 'home-hero-main'
    fieldPath: string,           // e.g., 'headline'
    isEditing: boolean,          // true on focus, false on blur/commit
    timestamp: number,           // Date.now() for lock tracking
    fieldType?: 'text' | 'image' | 'array'
  }
}

// When isEditing=true:  Add to parent's lockedFields Map
// When isEditing=false: Remove from lockedFields, auto-apply staged patches
```

**BUILD_MODE_FIELD_COMMIT**

```typescript
{
  type: 'BUILD_MODE_FIELD_COMMIT',
  data: {
    sectionId: string,              // e.g., 'home-hero-main'
    fieldPath: string,              // e.g., 'headline'
    value: string | string[],       // New value
    previousValue: string | string[], // For undo stack
    timestamp: number               // Date.now() for operation ordering
  }
}

// Parent behavior:
// 1. Remove from lockedFields (if present)
// 2. Apply value to draft config
// 3. Add to undo stack (useEditHistory)
// 4. Trigger debounced autosave (1000ms)
// 5. Auto-apply any staged patches for this fieldPath
```

**BUILD_MODE_IMAGE_REPLACE_REQUEST**

```typescript
{
  type: 'BUILD_MODE_IMAGE_REPLACE_REQUEST',
  data: {
    sectionId: string,
    fieldPath: string,
    currentUrl: string
  }
}

// Parent opens ImagePickerModal
// User selects/uploads → Parent sends FIELD_COMMIT with new URL
```

### Existing Messages (Parent → Iframe)

**BUILD_MODE_CONFIG_UPDATE** - Send updated config after autosave
**BUILD_MODE_HIGHLIGHT_SECTION_BY_ID** - Highlight section (AI discussing it)
**BUILD_MODE_CLEAR_HIGHLIGHT** - Clear highlights

### Security

**Always validate:**

```typescript
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    // Origin check
    if (event.origin !== window.location.origin) return;

    // Schema validation
    const parseResult = BuildModeMessageSchema.safeParse(event.data);
    if (!parseResult.success) return;

    handleBuildModeMessage(parseResult.data);
  };
  // ...
}, []);
```

---

## File Change Summary

### New Files (9 total, ~1,630 lines)

**Iframe Components:**

1. `apps/web/src/components/tenant/EditModeController.tsx` - 200 lines
2. `apps/web/src/components/tenant/InlineTextEditor.tsx` - 150 lines
3. `apps/web/src/components/tenant/InlineImageEditor.tsx` - 100 lines
4. `apps/web/src/lib/tenant/edit-utils.ts` - 200 lines

**Parent Components:** 5. `apps/web/src/components/preview/ImagePickerModal.tsx` - 250 lines 6. `apps/web/src/components/agent/EditLockIndicator.tsx` - 100 lines (+20 for staged patch UI) 7. `apps/web/src/components/ui/MobileBottomSheet.tsx` - 80 lines 8. `apps/web/src/hooks/usePreviewConfig.ts` - 300 lines (+100 for Maps + staging logic) 9. `apps/web/src/hooks/useEditHistory.ts` - 250 lines (+50 for committed-only tracking)

### Modified Files (9 files, ~200 net lines)

1. `apps/web/src/components/preview/PreviewPanel.tsx` (+80)
2. `apps/web/src/components/agent/AgentPanel.tsx` (-10)
3. `apps/web/src/hooks/useDraftConfig.ts` (refactor)
4. `apps/web/src/hooks/useBuildModeSync.ts` (-30)
5. `apps/web/src/app/(protected)/dashboard/page.tsx` (+40)
6. `apps/web/src/lib/build-mode/protocol.ts` (+40)
7. `server/src/agent/tools/storefront-tools.ts` (-5)
8. `server/src/agent/executors/storefront-executors.ts` (+20)
9. `server/src/di.ts` (+5)

### Section Components (~9 files, ~10-15 lines each)

Add data attributes + wire InlineTextEditor/InlineImageEditor:

- HeroSection.tsx, TextSection.tsx, GallerySection.tsx
- FAQSection.tsx, CTASection.tsx, TestimonialsSection.tsx
- ContactSection.tsx, PricingSection.tsx, FeaturesSection.tsx

---

## Testing Strategy

### Phase 0: Performance

**Benchmark:**

```typescript
it('reduces query count from 15 to 3', async () => {
  let queryCount = 0;
  prisma.$use((params, next) => {
    if (params.model === 'Tenant') queryCount++;
    return next(params);
  });

  await listSectionIdsTool.execute(context, {});
  await getSectionByIdTool.execute(context, { sectionId: 'home-hero-main' });

  expect(queryCount).toBe(1); // Single shared config
});
```

### Phase 1: Direct Editing

**E2E (Playwright):**

```typescript
test('direct text editing flow', async ({ page }) => {
  await page.goto('/dashboard?showPreview=true');
  const iframe = page.frameLocator('[data-testid="preview-iframe"]');

  await iframe.locator('[data-field="headline"]').click();
  await iframe.locator('input[data-field="headline"]').fill('New Headline');
  await iframe.locator('input[data-field="headline"]').blur();

  await expect(page.locator('[data-testid="save-indicator"]')).toContainText('Saved');
  await expect(iframe.locator('[data-field="headline"]')).toContainText('New Headline');
});

test('field lock prevents AI overwrite', async ({ page }) => {
  // Start editing
  await iframe.locator('[data-field="headline"]').click();

  // AI tries to update
  await page.evaluate(() => {
    window.simulateAIUpdate('home-hero-main', 'headline', 'AI Value');
  });

  // Verify staged (not applied)
  await expect(page.locator('[data-testid="edit-lock-indicator"]')).toContainText(
    '⏸️ AI update staged'
  );

  // Commit user edit
  await iframe.locator('input[data-field="headline"]').blur();

  // Verify AI's staged update applies
  await expect(iframe.locator('[data-field="headline"]')).toContainText('AI Value');
});
```

### Phase 2-4: Similar E2E patterns

---

## Critical Patterns to Follow

### 1. Multi-Tenant Isolation

**CRITICAL:** All queries MUST filter by tenantId

```typescript
// ✓ Correct
const draft = await prisma.tenant.findUnique({
  where: { id: tenantId },
});

// ✗ WRONG - Security vulnerability
const draft = await prisma.tenant.findUnique({
  where: { id: someId },
});
```

### 2. Advisory Locks

Use existing pattern for transactional safety:

```typescript
await prisma.$transaction(async (tx) => {
  const lockId = hashTenantStorefront(tenantId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
  // Read → Validate → Write
  // Lock auto-releases on commit
}, STOREFRONT_TRANSACTION_CONFIG);
```

### 3. Trust Tiers & Direct Editing

**User Direct Edits (NEW):**

- **Bypass trust system entirely** - no AgentProposal created
- User clicks → edits → commits = immediate draft config update
- Rationale: User is explicitly making the change, not delegating to AI

**AI Tool Edits (UNCHANGED):**

- Create AgentProposal, check trust tier, execute via executors
- AI suggestions go through trust system as before
- When field locked: Stage in `stagedAiPatches` instead of applying

**High-Trust Operations (UNCHANGED):**

- **Publish** (T3): Copy draft → live (requires explicit user approval)
- **Discard** (T3): Discard all drafts (requires explicit user approval)
- Both remain high-trust operations regardless of direct editing

**Conflict Resolution (NEW):**

```typescript
// When AI executor attempts field update:
if (isFieldLocked(fieldPath, lockedFields)) {
  // Stage the AI's update (don't apply yet)
  stagedAiPatches.set(fieldPath, {
    opSummary: `Update ${fieldPath}`,
    prev: currentValue,
    next: proposedValue,
    toolName: tool.name,
    timestamp: Date.now(),
  });
  return { staged: true, fieldPath };
}

// Apply immediately (field not locked)
applyToConfig(fieldPath, proposedValue);
recordInUndoStack(operation);
```

### 4. UI/UX Standards

Follow `docs/design/BRAND_VOICE_GUIDE.md`:

- Generous whitespace (`py-32`)
- 80% neutral / 20% sage accent
- Serif headlines, rounded corners (`rounded-3xl`)
- Always include hover states

---

## Risk Mitigation

### High Risk: Iframe-Native Editing Challenges

| Risk                           | Mitigation                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Focus/Blur Race Conditions** | Debounce blur events (300ms), cancel on re-focus, explicit commit on Enter key                                       |
| **Typography Parity**          | Load exact same fonts in iframe, match parent CSS variables, visual regression tests                                 |
| **Mobile Keyboard Behavior**   | Detect viewport height change, scroll input into view, adjust bottom sheet snap points, iOS Safari-specific handling |
| **PostMessage Message Loss**   | Add acknowledgment pattern, retry on timeout, sequence numbers for ordering                                          |
| **Autosave Fails Silently**    | Error toast, revert optimistic updates, retry with exponential backoff, show save indicator                          |
| **Field Lock TTL Expiry**      | Auto-cleanup stale locks (5min default), warn before expiry, save on expire                                          |
| **Staged Patch Conflicts**     | Show diff UI before auto-apply, allow user to review/reject, track patch timestamp                                   |

**Focus/Blur Handling:**

```typescript
// Iframe-side: Prevent blur from cancelling legitimate edits
let blurTimeout: NodeJS.Timeout;
const handleBlur = () => {
  blurTimeout = setTimeout(() => {
    sendFieldCommit(); // Only commit if user didn't re-focus
  }, 300);
};
const handleFocus = () => {
  clearTimeout(blurTimeout); // Cancel blur if re-focused
};
```

**Mobile Keyboard Handling:**

```typescript
// Iframe-side: iOS Safari viewport adjustments
useEffect(() => {
  const handleResize = () => {
    const vh = window.visualViewport?.height || window.innerHeight;
    if (vh < initialHeight * 0.7) {
      // Keyboard opened
      activeInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Notify parent to adjust bottom sheet
      sendPostMessage({ type: 'KEYBOARD_VISIBLE', vh });
    }
  };
  window.visualViewport?.addEventListener('resize', handleResize);
}, []);
```

**Typography Parity:**

```typescript
// Ensure iframe matches parent typography exactly
// apps/web/src/components/tenant/layout.tsx
<html>
  <head>
    <link href="https://fonts.googleapis.com/.../inter.css" />
    <style>{`:root { --font-sans: ${parentFontVars} }`}</style>
  </head>
</html>
```

### Medium Risk

- **Vaul bottom sheet incompatibility:** Test iOS Safari early, CSS-only fallback ready
- **Field path parsing errors:** Extensive Zod validation, helper utilities, unit tests
- **Cross-tab sync conflicts:** Use BroadcastChannel API, last-write-wins with timestamp
- **Undo stack memory bloat:** Limit to 50 operations, prune on threshold, compress old entries

---

## Success Criteria

### Phase 1: Direct Text Editing

- [ ] 50%+ of edits use direct editing within 1 month
- [ ] Autosave success rate > 99%
- [ ] Field lock conflict rate < 1%
- [ ] Zero data loss incidents

### Phase 4: Granular Undo

- [ ] Undo used in 40%+ of edit sessions
- [ ] Users describe editing as "forgiving"
- [ ] "Feels like a professional tool" feedback

### Overall

- [ ] 7-day retention increases 15%
- [ ] Net Promoter Score increases 10 points
- [ ] Users cite "co-editing" as differentiation

---

## The Co-Editing Differentiator

### What Makes This Special

Most builders are **either/or:**

- **AI-only:** Wix ADI (generate once, you're done)
- **Manual-only:** Framer, Webflow (no AI co-editing)

**MAIS is co-editing:**

- User taps → AI sees what's being edited
- AI suggests changes → Staged (not overwritten)
- Every change undoable (user + AI unified)

**Competitive Table:**

| Feature           | Framer | Webflow | Wix ADI   | **MAIS**           |
| ----------------- | ------ | ------- | --------- | ------------------ |
| Direct editing    | ✅     | ✅      | ❌        | ✅ (iframe-native) |
| AI assistance     | ❌     | ❌      | ✅ (once) | ✅ (continuous)    |
| Field locks       | ❌     | ❌      | N/A       | ✅                 |
| Granular undo     | ✅     | ✅      | ❌        | ✅ (user + AI)     |
| Mobile split view | ❌     | ❌      | ❌        | ✅                 |

**Why This Wins:**

- Framer/Webflow: Professional tools, no AI
- Wix ADI: AI generates once
- **MAIS: AI and user work together, every step**

---

## For the Next Agent

### Getting Started

1. **Read this entire document** - understand current state + goals
2. **Start with Phase 0** - performance foundation
3. **Don't skip phases** - each builds on previous
4. **Test extensively** - iframe communication is tricky
5. **Monitor metrics** - autosave success, query count

### Key Files to Start

**Phase 0:**

- `server/src/agent/executors/storefront-executors.ts`
- `server/src/di.ts`
- `apps/web/src/hooks/usePreviewConfig.ts` (new)

**Phase 1:**

- `apps/web/src/components/tenant/EditModeController.tsx` (new)
- `apps/web/src/lib/build-mode/protocol.ts`
- `apps/web/src/components/tenant/sections/HeroSection.tsx` (first to wire)

### Improving This Plan

**Areas to enhance:**

1. **Mobile keyboard handling** - iOS Safari quirks need real device testing
2. **Conflict resolution UI** - Current staging approach is simple, could be richer
3. **Undo visualization** - Could show diff preview before applying undo
4. **AI context awareness** - Could pass more edit context to AI (what user is focusing on)

**Questions to explore:**

- Should we add "rich text" formatting (bold/italic) in Phase 5?
- Should undo stack show visual timeline (like Git history)?
- Should AI proactively suggest edits for locked fields after unlock?

---

**Ready to build the future of co-editing** 🚀
