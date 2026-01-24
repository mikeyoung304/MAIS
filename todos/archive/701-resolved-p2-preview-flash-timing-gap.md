---
status: complete
priority: p2
issue_id: '701'
tags: [code-review, ux, preview, build-mode]
dependencies: []
---

# Preview Panel: Flash of Published Content Before Draft Appears

## Problem Statement

Due to the PostMessage-based draft injection, users see a "flash" of published content before their draft appears in the preview:

1. Page SSR renders with published config
2. Page hydrates with React
3. PostMessage handshake occurs (BUILD_MODE_READY → BUILD_MODE_INIT)
4. Client-side state updates to draft config
5. Page re-renders with draft config

**UX Impact:** Confusing for users who expect to see their draft immediately.

## Findings

### Current Architecture

- SSR always fetches from public API (published content)
- PostMessage injects draft content client-side after hydration
- No loading state during handshake period

### Evidence

BuildModeWrapper waits for ready signal but doesn't show loading state:

```typescript
// No loading UI while waiting for BUILD_MODE_INIT
if (isEditMode && !buildModeConfig) {
  // Currently renders children with SSR content (published)
  return <>{children}</>;
}
```

## Proposed Solutions

### Option A: Add Loading State During Handshake

**Effort:** Small (1-2 hours)
**Risk:** Low

```typescript
// BuildModeWrapper.tsx
if (isEditMode && !isReady) {
  return <PreviewLoadingState message="Loading draft preview..." />;
}
```

### Option B: Skeleton UI for Hero/Content Areas

**Effort:** Medium
**Risk:** Low

Show skeleton placeholders for content areas during handshake.

## Recommended Action

**Option A** - Simple loading state prevents confusion without major refactor.

Can be superseded by #698 if server-side draft preview is implemented.

## Acceptance Criteria

- [x] No flash of published content in preview
- [x] Loading indicator shown during PostMessage handshake
- [x] Handshake timeout shows error message (not infinite loading)

## Resolution

**Implemented Option A** - Added loading state during PostMessage handshake.

### Changes Made

1. **useBuildModeSync.ts** - Added timeout mechanism:
   - Added `hasTimedOut` state to track handshake failures
   - Added 5-second timeout (`HANDSHAKE_TIMEOUT_MS = 5000`)
   - Timeout effect starts when edit mode is detected, clears on success

2. **BuildModeWrapper.tsx** - Added loading and error states:
   - `PreviewLoadingState` component shown during handshake with spinner
   - `PreviewTimeoutError` component shown if handshake times out
   - Uses existing `isReady` flag from hook to gate content rendering

### How It Works

1. User opens preview in Build Mode (`?edit=true` in iframe)
2. `useBuildModeSync` detects edit mode and sends `BUILD_MODE_READY`
3. `BuildModeWrapper` shows loading spinner (not SSR content)
4. Parent responds with `BUILD_MODE_INIT` containing draft config
5. Hook sets `isReady = true`, loading state clears
6. Draft content renders immediately (no flash)

If step 4 doesn't happen within 5 seconds, timeout error is shown.

## Resources

- Preview system review: agent ac3274b
- Related: BuildModeWrapper.tsx, useBuildModeSync.ts
