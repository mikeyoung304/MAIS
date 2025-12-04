# Landing Page Visual Editor: Data Integrity Analysis

**Reviewer:** Data Integrity Guardian
**Plan:** `feat-landing-page-visual-editor.md`
**Analysis Date:** 2025-12-04
**Status:** CRITICAL ISSUES IDENTIFIED

---

## Executive Summary

The landing page editor plan follows solid patterns from the proven visual editor (packages), but introduces **three critical data integrity gaps** specific to the landing page architecture. The plan's use of JSON storage for drafts is safe, but the publish/discard flow lacks transaction guarantees, and concurrent editing is not safeguarded.

**Key Risks:**

- CRITICAL: Publish fails mid-operation, leaving partial published state
- CRITICAL: No transaction wrapper for draft-to-published copy
- CRITICAL: Auto-save race conditions if user edits faster than 1s debounce
- IMPORTANT: Rollback impossible on publish failure
- IMPORTANT: No database constraint preventing stale draft publication

---

## Finding 1: CRITICAL - Publish Atomicity (Draft-to-Published Copy)

### Description

The plan's `publishDraft` endpoint (line 248-249) states:

```typescript
POST /v1/tenant-admin/landing-page/publish   # Publish draft to live
```

But implementation details are **missing**. Based on the package editor pattern, publish likely does:

```sql
UPDATE tenant SET landingPageConfig = draft_config
```

**Problem:** This is NOT atomic with draft cleanup. If the operation fails mid-process:

- Draft config published (user sees changes live)
- Draft metadata NOT cleared (draftUpdatedAt, hasDraft flag if added)
- On page reload, draft UI shows "Unsaved changes" despite being published
- User publishes again, thinking first attempt failed

### Data Risk

**HIGH** - User confusion, potential duplicate changes, inconsistent state between database and UI.

### Evidence from Plan

- Line 256-260: Schema shows `draftUpdatedAt` and `publishedAt` in same object
- Line 247: No mention of transaction wrapper for publish operation
- Phase 3 description (line 232-279): No error handling for publish failures

### Mitigation Strategy

**REQUIRED: Wrap publish in Prisma transaction**

In `tenant.repository.ts`, add:

```typescript
/**
 * Publish draft to live configuration
 * CRITICAL: Uses transaction to ensure draft copy + metadata clear are atomic
 *
 * Failure scenarios:
 * 1. Draft config invalid → throws validation error BEFORE update
 * 2. Database failure during update → transaction rolls back, draft unchanged
 * 3. Success → draft is live AND metadata cleared atomically
 */
async publishLandingPageDraft(tenantId: string): Promise<LandingPageConfig> {
  return await this.prisma.$transaction(async (tx) => {
    // Get current tenant state
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfig: true },
    });

    if (!tenant?.landingPageConfig?.draft) {
      throw new NoDraftError('No draft to publish');
    }

    // ATOMIC: Publish draft + clear metadata in single update
    const updated = await tx.tenant.update({
      where: { id: tenantId },
      data: {
        landingPageConfig: {
          ...(tenant.landingPageConfig as Record<string, unknown>),
          published: tenant.landingPageConfig.draft,
          publishedAt: new Date().toISOString(),
          draft: null,  // Clear draft
          draftUpdatedAt: null,
        },
      },
      select: { landingPageConfig: true },
    });

    return updated.landingPageConfig as LandingPageConfig;
  });
}
```

**Also required:** Error handling in route:

```typescript
try {
  const updated = await tenantRepo.publishLandingPageDraft(tenantId);
  return {
    status: 200,
    body: {
      success: true,
      publishedAt: updated.publishedAt,
    },
  };
} catch (error) {
  if (error instanceof NoDraftError) {
    return { status: 409, body: { error: error.message } };
  }
  // Let error middleware log and respond with 500
  throw error;
}
```

---

## Finding 2: CRITICAL - Race Condition in Auto-Save vs Publish

### Description

The plan proposes:

- **Auto-save:** Debounced 1s, saves `draftConfig` asynchronously (line 270)
- **Publish:** Copies `draftConfig` to `publishedConfig` (line 248)

**Problem:** If user publishes while auto-save is in-flight:

```
Timeline:
t=0ms   User types in Hero headline
t=500ms Auto-save triggered (pending save)
t=800ms User clicks Publish
t=1000ms Auto-save completes (overwrites published state with stale draft!)
Result: Published config has old data, user's recent edit is lost
```

### Data Risk

**CRITICAL** - Silent data loss. User's most recent edits disappear without warning.

### Evidence from Plan

- Line 88-89: `updateSectionContent` with auto-save comment
- Line 101-108: State shows `isPublishing` flag but no mention of debounce cancellation
- useVisualEditor.ts lines 245-251: Visual editor cancels debounce before publish, but plan doesn't mention this

### Mitigation Strategy

**REQUIRED: Flush pending auto-saves before publish**

In `useLandingPageEditor.ts` hook:

```typescript
interface LandingPageEditorState {
  // ... existing fields
  // Debounce timeout reference (for cancellation)
  saveTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

// In updateSectionContent method:
const updateSectionContent = useCallback(
  (section: SectionType, content: Partial<SectionConfig>) => {
    // Update draft immediately (optimistic)
    setEditorState((prev) => ({
      ...prev,
      draftConfig: { ...prev.draftConfig, [section]: content },
      hasChanges: true,
    }));

    // Reschedule auto-save with debounce
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      flushDraftSave();
    }, 1000);
  },
  []
);

// CRITICAL: In publishChanges method:
const publishChanges = useCallback(async () => {
  // Step 1: Flush any pending auto-saves FIRST
  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;

    // Wait for the pending save to complete
    await flushDraftSave();
  }

  // Step 2: NOW publish (with guaranteed latest draft)
  setEditorState((prev) => ({ ...prev, isPublishing: true }));

  try {
    const { status, body } = await api.publishLandingPageDraft();

    if (status !== 200) throw new Error(body?.error);

    toast.success('Landing page published');

    // Reload state to confirm publish
    await loadConfig();
  } catch (error) {
    toast.error('Publish failed', { description: error.message });
    // Do NOT clear draft on error
  } finally {
    setEditorState((prev) => ({ ...prev, isPublishing: false }));
  }
}, []);
```

**Also update contract:** Add explicit response indicating what was published:

```typescript
// packages/contracts/src/tenant-admin/landing-page.contract.ts
publishDraft: {
  method: 'POST',
  path: '/v1/tenant-admin/landing-page/publish',
  body: z.object({}),
  responses: {
    200: z.object({
      success: z.boolean(),
      publishedAt: z.string().datetime(),
      version: z.string().optional(), // e.g., "sha256:abc123..." for integrity
    }),
  },
},
```

---

## Finding 3: CRITICAL - Discard Without Server Confirmation

### Description

The plan's `discardChanges` action (line 95) states:

```typescript
discardChanges(): void;  // Local only?
```

But should call the backend to clear draft:

```typescript
DELETE /v1/tenant-admin/landing-page/draft   # Discard draft (line 249)
```

**Problem:** If user clicks "Discard Changes" locally but the DELETE request fails:

- UI shows "no changes" (draft state cleared locally)
- Database still has `draft` config
- Page reload brings draft back (confusing)
- Published state shows as stale

### Data Risk

**MEDIUM** - Data consistency issue between client and server. User sees clean state but database doesn't match.

### Evidence from Plan

- Line 95: Type signature shows `void` return, not `Promise<void>`
- Lines 290-295: useVisualEditor shows correct server-backed pattern but plan doesn't copy it
- Line 370: "Unsaved changes" indicator only looks at local state

### Mitigation Strategy

**REQUIRED: Make discard server-backed with optimistic UI**

```typescript
// hooks/useLandingPageEditor.ts
const discardChanges = useCallback(async () => {
  if (!hasChanges) {
    toast.info('No changes to discard');
    return;
  }

  // Optimistic: Clear UI immediately
  const previousState = editorState;
  setEditorState((prev) => ({
    ...prev,
    draftConfig: prev.publishedConfig,
    hasChanges: false,
  }));

  // Cancel any pending auto-saves
  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;
  }

  try {
    // Server-backed discard
    const { status, body } = await api.discardLandingPageDraft();

    if (status !== 200) {
      throw new Error(body?.error || 'Failed to discard');
    }

    toast.success('Changes discarded');
  } catch (error) {
    // Rollback if server discard fails
    setEditorState(previousState);
    toast.error('Failed to discard', {
      description: 'Your changes are still saved. Please try again.',
    });
  }
}, [hasChanges, editorState]);
```

---

## Finding 4: IMPORTANT - No Constraint Preventing Stale Draft Publication

### Description

The plan's schema (Option A, lines 472-479) stores draft and published in same JSON:

```typescript
{
  draft: LandingPageConfig | null,
  published: LandingPageConfig | null,
  draftUpdatedAt: string | null,
  publishedAt: string | null,
}
```

**Problem:** There's no database constraint ensuring consistency:

- What if `draft` is set but `draftUpdatedAt` is null? (indicates corruption)
- What if `publishedAt` is future-dated? (shouldn't happen)
- What if an admin publishes via raw SQL and forgets to clear draft?

### Data Risk

**LOW** - Debugging nightmare if data gets corrupted. No way to detect inconsistent state.

### Evidence from Plan

- Line 481: "Migration: None needed - JSON field is flexible"
- This flexibility is a double-edged sword

### Mitigation Strategy

**RECOMMENDED: Add validation schema with Zod at read time**

```typescript
// server/lib/validators.ts
const LandingPageStateSchema = z.object({
  draft: LandingPageConfigSchema.nullable(),
  published: LandingPageConfigSchema.nullable(),
  draftUpdatedAt: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
}).refine(
  (data) => {
    // If draft exists, draftUpdatedAt must exist
    if (data.draft !== null && data.draftUpdatedAt === null) {
      return false;
    }
    // If no draft, draftUpdatedAt should be null
    if (data.draft === null && data.draftUpdatedAt !== null) {
      return false;
    }
    return true;
  },
  {
    message: 'Draft metadata inconsistent: draft and draftUpdatedAt must match',
  }
);

// In tenant.repository.ts getLandingPageConfig:
async getLandingPageDraftAndPublished(tenantId: string) {
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { landingPageConfig: true },
  });

  const config = tenant?.landingPageConfig;

  // Validate state consistency
  const result = LandingPageStateSchema.safeParse(config);
  if (!result.success) {
    logger.warn(
      { tenantId, issues: result.error.issues },
      'Landing page config has consistency issues'
    );
    // Graceful degradation: return what we have
  }

  return config || { draft: null, published: null };
}
```

---

## Finding 5: IMPORTANT - Missing Confirmation Dialog for Discard

### Description

The plan mentions (line 285):

```
- [ ] Add confirmation dialog for discard action
```

But this is a checklist item, not implemented guidance. Users can accidentally lose work.

### Data Risk

**MEDIUM** - User error. Accidental discard of unpublished edits.

### Evidence from Plan

- Line 285: Listed as acceptance criterion, not part of spec
- No mention of AlertDialog component or confirmation flow
- Lines 334-340: Toolbar shows buttons but no guard

### Mitigation Strategy

**RECOMMENDED: Implement confirmation with preview**

```typescript
// components/DiscardConfirmationDialog.tsx
export function DiscardConfirmationDialog({
  isOpen,
  onConfirm,
  onCancel,
  draftChanges,
  hasDraft,
}: DiscardConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard Unsaved Changes?</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="text-sm text-gray-600 space-y-2">
          <p>You have unsaved changes to:</p>
          <ul className="list-disc list-inside">
            {Object.entries(draftChanges).map(([section, hasChange]) => (
              hasChange && <li key={section}>{section}</li>
            ))}
          </ul>
          <p className="font-semibold text-red-600">
            This action cannot be undone.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Keep Editing</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            Discard Changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## Finding 6: SUGGESTIONS - JSON Storage Safety (Well-Designed)

### Description

**This is a STRENGTH of the plan.** Option A (line 468-479) using JSON in single field is actually safer than Option B (separate columns).

### Why It Works Well

1. **Atomic reads:** Both draft and published fetched in single query (no race condition in data retrieval)
2. **Flexible structure:** Can add metadata (version, timestamps) without migration
3. **Versioning ready:** Easy to add `version` field later for audit trails

### Evidence from Plan

- Line 473: Good instinct to use JSON over separate columns
- Database schema matches existing patterns (branding field is also JSON)

### Suggestion: Enhance with Version Hash

Instead of just timestamps, add a SHA-256 hash for integrity verification:

```typescript
// Enhanced schema structure
{
  draft: {
    sections: {...},
    _hash: "sha256:abc123...", // SHA-256(JSON.stringify(sections))
    _version: 2,
  },
  published: {
    sections: {...},
    _hash: "sha256:def456...",
    _version: 2,
  },
  draftUpdatedAt: "2025-12-04T...",
  publishedAt: "2025-12-04T...",
}
```

This enables:

- Detecting silent corruption: recalculate hash vs stored hash
- Audit logging: track which version user last published
- Rollback safety: know exact published version to restore

---

## Finding 7: SUGGESTIONS - Concurrent Editing (Single Tenant Admin Acceptable)

### Description

The plan notes (line 598):

```
Concurrent editing conflicts | Low | Low | Single admin per tenant (MVP acceptable)
```

This is a valid MVP decision, but has implications.

### Current State

- **Only one tenant admin can edit at a time** (browser session isolation)
- No server-side locks or version tracking
- If two browsers open the editor, last one to publish wins (later edit overwrites earlier)

### Risk Assessment

- **Current:** LOW risk because MAIS is single-provider SaaS (one admin per tenant)
- **Future:** Will become CRITICAL when multi-user admin is added

### Suggestion: Add Session Token for Future Multi-User Support

Prepare for future multi-user scenarios without changing current behavior:

```typescript
// In API contract
getLandingPageDraft: {
  method: 'GET',
  path: '/v1/tenant-admin/landing-page/draft',
  responses: {
    200: z.object({
      draft: LandingPageConfigSchema.nullable(),
      published: LandingPageConfigSchema.nullable(),
      sessionToken: z.string(), // Unique token for this editing session
      editingSessionsActive: z.number(), // Count of concurrent editors
    }),
  },
},

// Route implementation
async getLandingPageDraft(tenantId: string) {
  const sessionToken = generateSessionToken(tenantId, userId);
  const sessionCount = await sessionManager.countActiveSessions(tenantId);

  return {
    draft: ...,
    published: ...,
    sessionToken,
    editingSessionsActive: sessionCount,
  };
}

// In UI: warn if sessionCount > 1
if (editingSessionsActive > 1) {
  toast.warning(
    'Multiple editors active',
    { description: 'Your changes might be overwritten by other admins.' }
  );
}
```

---

## Finding 8: SUGGESTIONS - Browser Crash Recovery

### Description

The plan addresses (line 597):

```
Draft data loss on browser crash | Medium | Low | Auto-save every change with 1s debounce
```

But relies only on server-side auto-save. If:

1. User makes 10 edits in 500ms
2. Browser crashes at 500ms (before debounce fires)
3. Last 10 edits are lost

### Current State

- Auto-save fires only after 1s inactivity
- No local backup before sending to server

### Suggestion: Add IndexedDB Local Backup

```typescript
// hooks/useLandingPageEditor.ts
const localStorageKey = `landing-page-draft:${tenantId}`;

// Save to IndexedDB immediately
const updateSectionContent = useCallback((...) => {
  // ... existing logic ...

  // IMMEDIATE: Back up to local storage
  const localBackup = {
    config: newDraftConfig,
    timestamp: Date.now(),
    checksum: calculateChecksum(newDraftConfig),
  };

  localStorage.setItem(localStorageKey, JSON.stringify(localBackup));
}, []);

// On mount: check for unsynced local backup
useEffect(() => {
  const localBackup = localStorage.getItem(localStorageKey);
  if (localBackup) {
    const parsed = JSON.parse(localBackup);
    const serverTimestamp = editorState.draftUpdatedAt
      ? new Date(editorState.draftUpdatedAt).getTime()
      : 0;

    if (parsed.timestamp > serverTimestamp) {
      toast.info('Recovered unsaved changes from local backup', {
        action: {
          label: 'Undo',
          onClick: () => localStorage.removeItem(localStorageKey),
        },
      });
      setEditorState(prev => ({
        ...prev,
        draftConfig: parsed.config,
      }));
    }
  }
}, []);
```

---

## Finding 9: SUGGESTIONS - Missing Rollback After Failed Publish

### Description

If publish fails (server error, network timeout), the plan has no rollback strategy.

### Current State

- If `POST /publish` fails, draft is NOT published (good)
- But UI doesn't preserve edit history or show what was attempted

### Suggestion: Add Publish Attempt Log

```typescript
// Add to landing page config schema
interface LandingPageState {
  draft: LandingPageConfig | null;
  published: LandingPageConfig | null;

  // NEW: Track publish attempts for debugging
  publishAttempts: Array<{
    timestamp: string;
    draftHash: string;
    result: 'success' | 'failed' | 'partial';
    error?: string;
  }>;

  draftUpdatedAt: string | null;
  publishedAt: string | null;
}
```

This enables:

- User can see "Last failed publish: 2 hours ago"
- Support can help recover from partial failures
- Audit trail of publish attempts

---

## Schema Migration Recommendation

Plan recommends Option A (single JSON field). Here's the implementation:

```typescript
// server/prisma/migrations/NNNN_landing_page_draft_schema.sql (Pattern B - Manual)

BEGIN;

-- Validate existing data structure
-- If landingPageConfig exists and doesn't have draft/published structure,
-- migrate it safely:
UPDATE "Tenant"
SET "landingPageConfig" = jsonb_build_object(
  'published', "landingPageConfig",
  'draft', null,
  'publishedAt', NULL,
  'draftUpdatedAt', NULL
)
WHERE "landingPageConfig" IS NOT NULL
AND "landingPageConfig" ->> 'draft' IS NULL;

-- Verify migration
SELECT COUNT(*) as successfully_migrated
FROM "Tenant"
WHERE "landingPageConfig" IS NOT NULL
AND "landingPageConfig" ->> 'published' IS NOT NULL;

COMMIT;
```

```typescript
// server/prisma/schema.prisma (Pattern A - Prisma)

model Tenant {
  // ... existing fields ...

  // Landing page configuration: {draft, published, draftUpdatedAt, publishedAt}
  // draft: in-progress edits (auto-saved every 1s)
  // published: live configuration shown to customers
  // draftUpdatedAt: timestamp of last draft save
  // publishedAt: timestamp of last successful publish
  landingPageConfig Json?

  // Relations
  users User[]
  // ... etc
}
```

---

## Testing Recommendations

### Unit Tests (Required)

```typescript
// server/src/adapters/prisma/tenant.repository.test.ts

describe('publishLandingPageDraft', () => {
  it('should atomically move draft to published and clear metadata', async () => {
    const tenantId = 'test-tenant';
    const draft = { sections: { hero: true } };

    // Setup: create tenant with draft
    await tenantRepo.update(tenantId, {
      landingPageConfig: {
        draft,
        published: null,
        draftUpdatedAt: new Date().toISOString(),
      },
    });

    // Publish
    await tenantRepo.publishLandingPageDraft(tenantId);

    // Verify atomic update
    const result = await tenantRepo.getLandingPageDraft(tenantId);
    expect(result.published).toEqual(draft);
    expect(result.draft).toBeNull();
    expect(result.draftUpdatedAt).toBeNull();
  });

  it('should rollback if transaction fails', async () => {
    // Simulate network/server error during update
    jest.spyOn(prisma.tenant, 'update').mockRejectedValueOnce(new Error('Network timeout'));

    const tenantId = 'test-tenant';
    const originalDraft = { sections: {} };

    await expect(tenantRepo.publishLandingPageDraft(tenantId)).rejects.toThrow('Network timeout');

    // Verify draft unchanged
    const result = await tenantRepo.getLandingPageDraft(tenantId);
    expect(result.draft).toEqual(originalDraft);
  });
});
```

### E2E Tests (Required)

```typescript
// e2e/tests/landing-page-editor.spec.ts

test('should not lose draft edits if browser crashes before auto-save', async () => {
  // This requires: localStorage recovery + local backup feature
  // See Finding 8 above
});

test('should flush pending auto-save before publishing', async () => {
  // 1. User edits section content
  // 2. Immediately click Publish (before 1s debounce)
  // 3. Auto-save should flush
  // 4. Publish should include latest edits
  // 5. Verify server has latest config
});

test('should show confirmation dialog before discard', async () => {
  // 1. User makes changes
  // 2. User clicks Discard
  // 3. Dialog appears
  // 4. User confirms
  // 5. Server discards, UI clears, page reloads shows clean state
});
```

---

## Summary Table

| Finding                           | Severity      | Category           | Status               | Mitigation                  |
| --------------------------------- | ------------- | ------------------ | -------------------- | --------------------------- |
| 1. Publish atomicity              | CRITICAL      | Transaction Safety | Not addressed        | Wrap in transaction         |
| 2. Auto-save race                 | CRITICAL      | Concurrency        | Not addressed        | Flush before publish        |
| 3. Discard no server confirmation | CRITICAL      | Data Consistency   | Not addressed        | Server-backed delete        |
| 4. No draft/published constraint  | IMPORTANT     | Schema Validation  | Not addressed        | Zod validation + refine     |
| 5. Missing discard confirmation   | IMPORTANT     | UX Safety          | Acceptance criterion | Implement AlertDialog       |
| 6. JSON storage                   | ✅ STRENGTH   | Design             | Well-designed        | Add version hashes          |
| 7. Concurrent editing (MVP)       | ✅ ACCEPTABLE | Scope              | Noted as MVP         | Prepare with session tokens |
| 8. Browser crash recovery         | SUGGESTION    | Resilience         | Debounce only        | Add IndexedDB backup        |
| 9. Publish failure rollback       | SUGGESTION    | Debugging          | Not addressed        | Log publish attempts        |

---

## Blockers for Implementation

**MUST FIX before coding:**

1. ✅ Finding 1: Publish transaction wrapper
2. ✅ Finding 2: Auto-save flush before publish
3. ✅ Finding 3: Server-backed discard endpoint

**SHOULD FIX before launch:** 4. ✅ Finding 4: Data validation schema 5. ✅ Finding 5: Confirmation dialog with preview

**NICE TO HAVE (post-MVP):** 6. Finding 8: IndexedDB local backup 7. Finding 9: Publish attempt logging

---

## References

- **Existing Visual Editor:** `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts`
  - Lines 245-251: Good pattern for flushing debounce before publish
  - Lines 226-229: Batching strategy with request coalescing

- **Existing Package Repository:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/catalog.repository.ts`
  - `publishDrafts` method: Transaction wrapper for atomic publish (follow this pattern for landing pages)
  - `discardDrafts` method: Note the explicit null checks for draft fields

- **Schema Documentation:** `/Users/mikeyoung/CODING/MAIS/server/prisma/schema.prisma`
  - Package model (lines 190-237): Draft fields pattern to replicate for landing pages
  - WebhookEvent model (lines 515-535): Example of composite unique constraint for idempotency

---

**Next Steps:** Before implementation, create a detailed API contract and route implementation guide that addresses findings 1-3. This analysis should be attached to the PR as data integrity verification.
