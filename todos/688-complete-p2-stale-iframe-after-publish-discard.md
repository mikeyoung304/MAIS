---
status: resolved
priority: p2
issue_id: '688'
tags: [code-review, agent-first-architecture, data-integrity, iframe]
dependencies: []
---

# P2: Stale Iframe After Publish/Discard

## Problem Statement

After publish or discard, `onConfigUpdate()` invalidates the cache, but the iframe may still show old draft content. There's no forced iframe refresh after these critical operations.

**Why This Matters:**

- User publishes, but preview still shows draft (confusing)
- User may think publish failed when it succeeded
- Only resolved by manual refresh

## Findings

**Agent:** Data Integrity Guardian

**Location:** `apps/web/src/components/preview/PreviewPanel.tsx` (lines 243-262)

**The Flow:**

1. User publishes → `onConfigUpdate()` invalidates cache
2. TanStack Query refetches in background
3. `draftConfig` prop eventually updates
4. Effect on line 181-183 sends new config to iframe
5. But iframe might be showing cached content from before publish

## Proposed Solutions

### Option A: Force iframe reload after publish/discard (Recommended)

```typescript
const handlePublish = async () => {
  try {
    await publishDraft();
    onConfigUpdate();
    setShowPublishDialog(false);
    // Force iframe reload
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  } catch (err) {
    setError('Failed to publish changes');
  }
};
```

- **Pros:** Guaranteed fresh content
- **Cons:** Full reload, slight flash
- **Effort:** Small
- **Risk:** Low

### Option B: Send explicit refresh message to iframe

- Use PostMessage to tell iframe to refetch
- **Pros:** Smoother UX
- **Cons:** Requires iframe-side implementation
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

**Option A** - Force iframe reload. Simple and guarantees consistency.

## Technical Details

**Affected Files:**

- `apps/web/src/components/preview/PreviewPanel.tsx`

## Acceptance Criteria

- [ ] Preview shows fresh content immediately after publish
- [ ] Preview shows fresh content immediately after discard
- [ ] No stale cache issues

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
