---
status: pending
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

- [ ] No flash of published content in preview
- [ ] Loading indicator shown during PostMessage handshake
- [ ] Handshake timeout shows error message (not infinite loading)

## Resources

- Preview system review: agent ac3274b
- Related: BuildModeWrapper.tsx, useBuildModeSync.ts
