---
status: pending
priority: p2
issue_id: '253'
tags: [code-review, landing-page, data-integrity, ux]
dependencies: ['247']
source: 'plan-review-2025-12-04'
---

# TODO-253: Add localStorage Draft Recovery for Browser Crash Protection

## Priority: P2 (Important - Data Loss Prevention)

## Status: Pending

## Source: Plan Review - Data Integrity Guardian

## Problem Statement

The plan shows auto-save going directly to server with 1-2s debounce, but provides **no localStorage/IndexedDB backup** for unsaved edits. If the browser crashes or network fails between edits and the next auto-save, all work in that window is lost.

**Why It Matters:**

- 1-2s debounce + network latency = 2-4s of potential data loss
- User types 500-word About section over 60 seconds
- Browser crashes at t=59s (1 second before next auto-save completes)
- Last completed save was at t=55s (4 seconds of typing lost)

## Findings

### Data Loss Window

```
Timeline:
t=0s    User starts typing
t=2s    First debounce fires, save starts (takes 200ms)
t=2.2s  Save completes
t=4s    Next debounce fires
...
t=58s   Save completes
t=59s   BROWSER CRASHES
t=60s   Next save would have fired
Result: 1 second of typing lost (acceptable)

BUT with slow network (3s round-trip):
t=55s   Save sent
t=58s   Save completes
t=59s   BROWSER CRASHES
Result: 4 seconds of typing lost (unacceptable for 500-word content)
```

### No Current Recovery Mechanism

Plan mentions auto-save but no mention of:
- localStorage backup on every edit
- IndexedDB for larger content
- Recovery flow on page load
- Warning when recovering stale local data

## Proposed Solutions

### Option A: localStorage Backup on Every Edit (Recommended)
- **Effort:** 2-3 hours
- **Risk:** Low
- Save to localStorage immediately on every edit (no debounce)
- Compare with server on load, recover if fresher
- **Pros:** Simple, handles 99% of cases
- **Cons:** localStorage size limits (5MB)

### Option B: IndexedDB for Large Content
- **Effort:** 4-6 hours
- **Risk:** Medium
- Use IndexedDB for unlimited storage
- More robust for large gallery/FAQ sections
- **Pros:** No size limits
- **Cons:** More complex API

## Recommended Action

**Execute Option A:** Add localStorage backup to hook:

```typescript
// In useLandingPageEditor.ts

// Save to localStorage on every edit (immediate, no debounce)
useEffect(() => {
  if (!draftConfig || !tenantId) return;

  const DRAFT_KEY = `mais:landingPage:draft:${tenantId}`;
  const localData = {
    config: draftConfig,
    savedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(localData));
  } catch (e) {
    // localStorage full - fail silently, server save will work
    logger.warn('localStorage save failed', { error: e });
  }
}, [draftConfig, tenantId]);

// On mount: Check for local recovery
useEffect(() => {
  const DRAFT_KEY = `mais:landingPage:draft:${tenantId}`;

  const checkLocalRecovery = async () => {
    const localData = localStorage.getItem(DRAFT_KEY);
    if (!localData) return;

    try {
      const { config: localConfig, savedAt: localSavedAt } = JSON.parse(localData);
      const serverDraft = await api.tenantAdminGetDraft();

      const localTime = new Date(localSavedAt).getTime();
      const serverTime = serverDraft.draftUpdatedAt
        ? new Date(serverDraft.draftUpdatedAt).getTime()
        : 0;

      if (localTime > serverTime) {
        toast.warning(
          'Found unsaved local changes from previous session.',
          {
            action: {
              label: 'Recover',
              onClick: () => setDraftConfig(localConfig),
            },
            duration: 10000,
          }
        );
      } else {
        // Server is fresher, clear local backup
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch (e) {
      localStorage.removeItem(DRAFT_KEY);
    }
  };

  checkLocalRecovery();
}, [tenantId]);

// Clear localStorage when draft successfully saved to server
const onServerSaveSuccess = () => {
  localStorage.removeItem(`mais:landingPage:draft:${tenantId}`);
};
```

## Acceptance Criteria

- [ ] localStorage backup on every draftConfig change
- [ ] Recovery check on component mount
- [ ] Toast with "Recover" action if local is fresher than server
- [ ] Clear localStorage after successful server save
- [ ] Handle localStorage full gracefully (warn, continue)

## Work Log

| Date       | Action  | Notes                                                 |
|------------|---------|------------------------------------------------------|
| 2025-12-04 | Created | Data integrity review identified browser crash risk  |

## Tags

code-review, landing-page, data-integrity, ux
