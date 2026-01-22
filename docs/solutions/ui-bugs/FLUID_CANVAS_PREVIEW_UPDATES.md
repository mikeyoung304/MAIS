# Fluid Canvas Preview Updates

---

title: "Fluid Canvas Preview Updates - Real-time Storefront Editor"
slug: fluid-canvas-preview-updates
category: ui-bugs
severity: P2
component: apps/web/preview, apps/web/hooks
symptoms:

- "Preview Connection Failed" after AI agent updates
- Jarring page reloads when editing storefront
- PostMessage handshake timeouts
- Iframe loses connection during config updates
  root_cause: Full iframe reloads breaking PostMessage connection + race conditions in handshake
  solution_verified: true
  created: 2026-01-22
  pitfall_id: 71
  related_issues:
- PREVIEW_CONNECTION_FAILED_ROOT_CAUSE.md
  tags:
- preview
- iframe
- postMessage
- build-mode
- real-time
- canvas
- UX

---

## Problem Statement

When the AI agent makes storefront updates, the preview iframe:

1. Shows "Preview Connection Failed" after config updates
2. Full page reloads cause jarring visual experience
3. PostMessage handshake times out intermittently
4. Not a "real-time canvas" feel - more like editing a Word doc that needs manual refresh

## Root Cause Analysis

### Issue 1: Unnecessary Iframe Reloads

Three locations in `PreviewPanel.tsx` were doing full iframe reloads:

```typescript
// After publish (line ~290)
iframeRef.current.contentWindow.location.reload();

// After discard (line ~306)
iframeRef.current.contentWindow.location.reload();

// On package refresh key change (line ~162)
iframeRef.current.src = iframeUrl;
```

These reloads **destroyed the established PostMessage connection**, causing the iframe to need a fresh handshake. If the parent wasn't ready, the 5-second timeout would fire.

### Issue 2: Handshake Race Condition

The iframe sends `BUILD_MODE_READY` once on load. If the parent's message listener wasn't set up yet (React effect timing), or `draftConfig` wasn't loaded, the parent would never respond with `BUILD_MODE_INIT`.

### Issue 3: No Visual Feedback During Updates

Config updates happened instantly with no CSS transitions, causing a "hard cutoff" feel instead of smooth canvas-like updates.

### Issue 4: Unstable React Keys

`SectionRenderer.tsx` used `${section.type}-${absoluteIndex}` as keys, causing React to unmount/remount components when sections were reordered.

## Solution

### 1. CSS Transitions for Smooth Updates (`globals.css`)

Added fluid canvas update styles:

```css
/* Smooth transitions on all section properties */
.build-mode-active [data-section-index] {
  transition:
    box-shadow 0.2s ease,
    outline 0.2s ease,
    opacity 0.25s ease-out,
    transform 0.25s ease-out,
    filter 0.25s ease-out;
}

/* Updating state - subtle fade when config is being applied */
.build-mode-active [data-section-index].section-updating {
  opacity: 0.7;
  transform: scale(0.998);
  filter: brightness(1.02);
}

/* Updated state - brief highlight to show what changed */
.build-mode-active [data-section-index].section-updated {
  animation: section-update-pulse 0.6s ease-out;
}
```

### 2. Handshake Retry Logic (`useBuildModeSync.ts`)

Implemented retry mechanism for robust connection:

```typescript
const HANDSHAKE_RETRY_MS = 1000;
const HANDSHAKE_MAX_RETRIES = 4;

// Retry periodically until we get BUILD_MODE_INIT or max retries
const retryInterval = setInterval(() => {
  if (isReady || retryCount >= HANDSHAKE_MAX_RETRIES) {
    clearInterval(retryInterval);
    return;
  }
  sendToParent({ type: 'BUILD_MODE_READY' });
  retryCount++;
}, HANDSHAKE_RETRY_MS);
```

### 3. Visual Update Feedback (`useBuildModeSync.ts`)

Added visual feedback functions for canvas feel:

```typescript
case 'BUILD_MODE_CONFIG_UPDATE':
  addUpdateFeedback();  // Adds .section-updating class
  setDraftConfig(message.data.config);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      removeUpdateFeedback();  // Adds .section-updated, removes after animation
    });
  });
  break;
```

### 4. Stable Section Keys (`SectionRenderer.tsx`)

Use section ID when available to prevent React remounts:

```typescript
const sectionKey = 'id' in section && section.id ? section.id : `${section.type}-${absoluteIndex}`;
```

### 5. Removed Iframe Reloads (`PreviewPanel.tsx`)

Replaced full reloads with soft PostMessage updates:

```typescript
// Before (broke connection):
iframeRef.current.contentWindow.location.reload();

// After (preserves connection):
// Config update flows through PostMessage automatically via useEffect
```

## Files Changed

| File                                                 | Change                                            |
| ---------------------------------------------------- | ------------------------------------------------- |
| `apps/web/src/styles/globals.css`                    | Added fluid canvas CSS transitions and animations |
| `apps/web/src/hooks/useBuildModeSync.ts`             | Added retry logic, visual feedback functions      |
| `apps/web/src/components/tenant/SectionRenderer.tsx` | Use stable section IDs as React keys              |
| `apps/web/src/components/preview/PreviewPanel.tsx`   | Removed iframe reloads, use soft refresh          |

## Before/After

| Aspect          | Before                      | After                               |
| --------------- | --------------------------- | ----------------------------------- |
| Config updates  | Hard instant cutoff         | Smooth 250ms fade + pulse highlight |
| Handshake       | Single attempt, 5s timeout  | 4 retries at 1s intervals           |
| Publish/Discard | Full iframe reload          | Soft PostMessage update             |
| Section reorder | Components remount          | Components stay mounted             |
| AI agent edits  | "Preview Connection Failed" | Smooth real-time updates            |

## Prevention Strategies

### Pitfall #71: Iframe reload breaks PostMessage connection

**Pattern:** Never use `location.reload()` or reassign `iframe.src` after establishing PostMessage connection.

**Instead:** Send config updates via PostMessage:

```typescript
// Bad - breaks connection
iframeRef.current.contentWindow.location.reload();

// Good - preserves connection
iframeRef.current.contentWindow.postMessage(
  {
    type: 'BUILD_MODE_CONFIG_UPDATE',
    data: { config: newConfig },
  },
  window.location.origin
);
```

### Testing Checklist

- [ ] AI agent makes storefront change → preview updates smoothly without reload
- [ ] Sections show brief pulse animation when updated
- [ ] Preview doesn't show "Connection Failed" after agent updates
- [ ] Publish/Discard doesn't cause full page reload
- [ ] Section reorder doesn't cause visual flicker

## Related Documentation

- [PREVIEW_CONNECTION_FAILED_ROOT_CAUSE.md](./PREVIEW_CONNECTION_FAILED_ROOT_CAUSE.md) - Original diagnosis
- [BUILD_MODE_VISION.md](../../architecture/BUILD_MODE_VISION.md) - Agent-first storefront editor vision

## Keywords

fluid canvas, real-time preview, PostMessage, iframe, build mode, AI agent, storefront editor, smooth updates, CSS transitions, handshake retry
