# Landing Page Editor: Data Integrity Implementation Checklist

**Print this and pin it to your workspace during implementation.**

---

## Critical (Must Have Before Code Review)

### ✅ Finding 1: Publish Transaction Wrapper

- [ ] `tenant.repository.ts`: Add `publishLandingPageDraft()` method with `prisma.$transaction()`
- [ ] Verify: Draft copy, `publishedAt` set, `draftUpdatedAt` cleared **in single atomic update**
- [ ] Error handling: Throw `NoDraftError` if no draft exists
- [ ] Route handler catches transaction errors and returns 500
- [ ] Test: Verify rollback if transaction fails midway

**Code reference:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/catalog.repository.ts` lines 177-210

### ✅ Finding 2: Auto-Save Flush Before Publish

- [ ] `useLandingPageEditor.ts`: Store `saveTimeoutRef` using `useRef`
- [ ] `publishChanges()` method: Cancel timeout BEFORE making publish API call
- [ ] Ensure `flushDraftSave()` completes before publish request (await it)
- [ ] Lock UI with `isPublishing = true` to prevent edits during publish
- [ ] On error, do NOT clear draft (user can retry)
- [ ] Test: User edits, immediately publishes → latest edits included

**Code reference:** `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts` lines 245-251

### ✅ Finding 3: Server-Backed Discard Endpoint

- [ ] `DELETE /v1/tenant-admin/landing-page/draft` endpoint in route handler
- [ ] `tenant.repository.ts`: Add `discardLandingPageDraft()` method
  - Clear draft
  - Clear `draftUpdatedAt`
  - Return success/error
- [ ] `useLandingPageEditor.ts`: `discardChanges()` calls server endpoint
- [ ] Optimistic UI: Show clean state immediately, rollback on error
- [ ] Confirmation dialog required (see Important section)
- [ ] Test: Discard fails → UI rolls back to previous state

---

## Important (Should Have Before Launch)

### ✅ Finding 4: Data Validation Schema

- [ ] Create `LandingPageStateValidator` in `server/lib/validators.ts`
- [ ] Add Zod refine to ensure: `draft === null ↔ draftUpdatedAt === null`
- [ ] Use validator in `getLandingPageDraft()` method
- [ ] Log warnings if consistency broken
- [ ] Return gracefully even if corrupted (don't crash)

**Test:** Manually corrupt database JSON, verify graceful degradation

### ✅ Finding 5: Discard Confirmation Dialog

- [ ] Create `DiscardConfirmationDialog.tsx` component
- [ ] Show: "You have unsaved changes to: [Hero, About, ...]"
- [ ] Warning: "This action cannot be undone" (in red)
- [ ] Buttons: "Keep Editing" (default) | "Discard Changes" (destructive)
- [ ] Only open dialog if `hasChanges === true`
- [ ] Test: Click Discard → dialog appears → confirm → server discards

**Reference:** Similar pattern in `AlertDialog` from visual editor

---

## Suggestions (Post-MVP, Can Add Later)

### Finding 6: Version Hashes

- [ ] Add `_version` and `_hash` fields to draft/published config
- [ ] Hash = `sha256(JSON.stringify(config))`
- [ ] Verify hash on read: detect silent corruption
- [ ] Use for audit trail in future

### Finding 7: Session Tokens (Multi-User Prep)

- [ ] API response includes `sessionToken` and `editingSessionsActive` count
- [ ] UI warns if `editingSessionsActive > 1`
- [ ] Toast: "Multiple editors active. Your changes might be overwritten."
- [ ] Ready for future concurrent editing features

### Finding 8: IndexedDB Local Backup

- [ ] On every `updateSectionContent()`, save to localStorage immediately
- [ ] On mount, check if local backup is newer than server
- [ ] If yes, show toast: "Recovered unsaved changes" with Undo option
- [ ] Requires: `calculateChecksum()` utility function
- [ ] Test: Browser crash → reload → changes recovered

### Finding 9: Publish Attempt Log

- [ ] Add `publishAttempts` array to landing page config
- [ ] Record: timestamp, draftHash, result (success/failed/partial), error
- [ ] Keep last 10 attempts (trim older ones)
- [ ] Show in admin UI: "Last failed publish: X hours ago"

---

## API Contract Updates

### Required (CRITICAL)

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
    }),
    409: z.object({
      error: z.string(), // "No draft to publish"
    }),
  },
},

discardDraft: {
  method: 'DELETE',
  path: '/v1/tenant-admin/landing-page/draft',
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
    409: z.object({
      error: z.string(), // "No draft to discard"
    }),
  },
},
```

### Optional (SUGGESTIONS)

```typescript
// Add session tracking
getDraft: {
  responses: {
    200: z.object({
      draft: LandingPageConfigSchema.nullable(),
      published: LandingPageConfigSchema.nullable(),
      sessionToken: z.string(), // For future multi-user support
      editingSessionsActive: z.number(), // Warn if > 1
    }),
  },
},

// Add version tracking
publishDraft: {
  responses: {
    200: z.object({
      success: z.boolean(),
      publishedAt: z.string().datetime(),
      configVersion: z.string().optional(), // e.g., "sha256:abc123"
    }),
  },
},
```

---

## Testing Checklist

### Unit Tests (server)

- [ ] `publishLandingPageDraft()` - atomic transaction
- [ ] `publishLandingPageDraft()` - rolls back on error
- [ ] `publishLandingPageDraft()` - throws if no draft
- [ ] `discardLandingPageDraft()` - clears draft metadata
- [ ] Zod validator detects corrupt data
- [ ] Validator gracefully handles missing fields

### Integration Tests

- [ ] Publish endpoint returns 200 with publishedAt
- [ ] Discard endpoint returns 200
- [ ] Discard with no draft returns 409
- [ ] Multiple rapid saves are batched

### E2E Tests (Playwright)

- [ ] User makes changes → debounce timer shown → changes auto-saved
- [ ] User edits → immediately clicks Publish → auto-save flushes → publish succeeds
- [ ] User makes changes → clicks Discard → confirmation dialog → confirms → state cleared
- [ ] Page reload after discard shows published state (clean)
- [ ] Network error during publish → draft preserved → can retry
- [ ] Publish fails → discard confirmation dialog still works

---

## Database Validation

### Before Implementation

Run this query to verify existing landing page configs are valid:

```sql
-- Check for any configs with missing/inconsistent draft metadata
SELECT id, slug,
  CASE
    WHEN landingPageConfig ->> 'draft' IS NOT NULL
      AND landingPageConfig ->> 'draftUpdatedAt' IS NULL
    THEN 'INVALID: draft without timestamp'
    WHEN landingPageConfig ->> 'draft' IS NULL
      AND landingPageConfig ->> 'draftUpdatedAt' IS NOT NULL
    THEN 'INVALID: timestamp without draft'
    ELSE 'VALID'
  END as validation_status
FROM "Tenant"
WHERE landingPageConfig IS NOT NULL;
```

### After Publish Endpoint Goes Live

Monitor for corruption:

```sql
-- Alert if inconsistency detected
SELECT COUNT(*) as invalid_count
FROM "Tenant"
WHERE (
  (landingPageConfig ->> 'draft' IS NOT NULL
    AND landingPageConfig ->> 'draftUpdatedAt' IS NULL)
  OR
  (landingPageConfig ->> 'draft' IS NULL
    AND landingPageConfig ->> 'draftUpdatedAt' IS NOT NULL)
)
AND landingPageConfig IS NOT NULL;
```

---

## Code Review Checklist

### Reviewer: Verify These Points

- [ ] Publish uses `prisma.$transaction()` - NOT separate queries
- [ ] `discardChanges()` awaits server response - NOT local-only
- [ ] Auto-save timeout cleared before publish
- [ ] Discard confirmation dialog has "Keep Editing" as default button
- [ ] Error messages don't expose internal details (no stack traces)
- [ ] All routes check `tenantId` for isolation
- [ ] Response DTOs match contract (run `npm run typecheck`)
- [ ] No `any` types in critical paths
- [ ] Test coverage >80% for publish/discard flows

---

## Monitoring

### Alerts to Set Up (Post-Launch)

```
# Alert if publish fails frequently
SELECT COUNT(*) as failed_publishes
FROM ConfigChangeLog
WHERE changeType = 'landing_page_publish'
  AND operation = 'reject'
  AND createdAt > now() - interval '1 hour'
HAVING COUNT(*) > 10;

# Alert if data inconsistency detected
SELECT COUNT(*) as inconsistencies
FROM Tenant
WHERE (landingPageConfig ->> 'draft' IS NOT NULL
  AND landingPageConfig ->> 'draftUpdatedAt' IS NULL)
HAVING COUNT(*) > 0;
```

---

## Rollback Plan

If issues discovered post-launch:

1. **Minor UX issues (e.g., button text):** Deploy fix
2. **Discard not working:** Disable editor, show "Maintenance mode"
3. **Publish broken:** Disable Publish button, clear all drafts with script
4. **Data corruption:** Run cleanup script (see "Database Validation" section above)

**Cleanup script if all drafts corrupted:**

```typescript
// Run in Node REPL with direct DB access
const tenants = await prisma.tenant.findMany({
  where: { landingPageConfig: { not: null } },
});

for (const tenant of tenants) {
  const config = tenant.landingPageConfig as any;
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      landingPageConfig: {
        draft: null,
        published: config.published || config,
        draftUpdatedAt: null,
        publishedAt: new Date().toISOString(),
      },
    },
  });
}
```

---

## Sign-Off

- [ ] All 3 CRITICAL findings addressed
- [ ] All 2 IMPORTANT findings addressed
- [ ] Tests passing: `npm test` + `npm run test:e2e`
- [ ] TypeScript: `npm run typecheck` with 0 errors
- [ ] Reviewed against this checklist by team lead
- [ ] Ready for code review

---

**Print Date:** ****\_\_\_****
**Developer:** ********\_********
**Reviewer:** ********\_********
**Approval Date:** ****\_\_\_****
