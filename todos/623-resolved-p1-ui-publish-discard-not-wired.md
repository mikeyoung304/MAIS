---
status: resolved
priority: p1
issue_id: '623'
tags: [code-review, bug, build-mode, ui]
dependencies: []
---

# UI Publish/Discard Buttons Not Wired to API

## Problem Statement

The Publish and Discard buttons in the Build Mode UI only log to console and don't actually call the backend API. Users clicking these buttons see dialogs but nothing happens.

**What's broken:** Core functionality non-functional
**Why it matters:** Users cannot publish or discard their draft changes

## Findings

### Source: Architecture Strategist + TypeScript Reviewer + Agent-Native Reviewer

**File:** `/apps/web/src/app/(protected)/tenant/build/page.tsx`

**Current Code:**

```typescript
// Line 119-120 - Handler stubs
const handlePublishClick = () => console.log('publish');
const handleDiscardClick = () => console.log('discard');

// Line 179-181 - Dialog confirm does nothing
onConfirm={() => {
  console.log('Publishing...');
  setShowPublishDialog(false);
}}

// Line 192-194 - Dialog confirm does nothing
onConfirm={() => {
  console.log('Discarding...');
  setShowDiscardDialog(false);
}}
```

**Impact:**

- Publish button appears to work (shows dialog) but changes never go live
- Discard button appears to work but draft is never cleared
- Agent can publish/discard via tools, but UI cannot = broken agent parity

## Proposed Solutions

### Option A: Wire to API endpoints (Recommended)

**Description:** Connect confirm handlers to actual API calls using the ts-rest client

```typescript
const handlePublishConfirm = async () => {
  setIsSaving(true);
  try {
    const response = await fetch('/api/tenant-admin/landing-page/publish', {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to publish');
    setIsDirty(false);
    await fetchDraftConfig();
    setShowSuccessToast(true);
  } catch (err) {
    logger.error('Failed to publish draft', err);
    setError('Failed to publish changes');
  } finally {
    setIsSaving(false);
    setShowPublishDialog(false);
  }
};
```

- **Pros:** Enables core functionality, matches agent capabilities
- **Cons:** None
- **Effort:** Medium (30-60 minutes)
- **Risk:** Low

### Option B: Use useDraftAutosave hook methods

**Description:** The `useDraftAutosave` hook already has `publishDraft()` and `discardDraft()` methods - just wire them up

```typescript
const { publishDraft, discardDraft } = useDraftAutosave({ ... });

// In dialog
onConfirm={async () => {
  await publishDraft();
  setShowPublishDialog(false);
}}
```

- **Pros:** Reuses existing code, consistent state management
- **Cons:** Need to integrate useDraftAutosave into page
- **Effort:** Medium
- **Risk:** Low

## Technical Details

**Affected Files:**

- `apps/web/src/app/(protected)/tenant/build/page.tsx`

**API Endpoints:**

- `POST /api/tenant-admin/landing-page/publish` - Publish draft
- `DELETE /api/tenant-admin/landing-page/draft` - Discard draft

## Acceptance Criteria

- [ ] Publish button calls publish API and shows success/error
- [ ] Discard button calls discard API and refreshes config
- [ ] Loading state shown during API calls
- [ ] Error handling displays user-friendly message
- [ ] isDirty state cleared after successful publish/discard

## Work Log

| Date       | Action                               | Learnings                                     |
| ---------- | ------------------------------------ | --------------------------------------------- |
| 2026-01-05 | Created from multi-agent code review | Console.log stubs = incomplete implementation |

## Resources

- useDraftAutosave hook: `apps/web/src/hooks/useDraftAutosave.ts`
- API routes: `server/src/routes/tenant-admin-landing-page.routes.ts`
