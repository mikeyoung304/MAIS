---
status: active
priority: p1
issue_id: '620'
tags: [code-review, architecture, build-mode, concurrency, data-integrity]
dependencies: []
triage_date: '2026-01-21'
triage_notes: 'UPGRADED P2→P1 by enterprise triage. All 3 reviewers agree this is the ONLY true P1 - user data loss risk.'
---

# No Optimistic Locking for Concurrent Draft Edits

## Problem Statement

Multiple browser tabs or concurrent API calls could overwrite each other's draft changes without detection. Unlike the booking system (which uses advisory locks), draft editing has no concurrency control.

**What's broken:** Lost updates when editing from multiple tabs
**Why it matters:** User work can be silently overwritten

## Findings

### Source: Architecture Review Agent + Performance Review Agent

**Files:**

- `server/src/agent/executors/storefront-executors.ts`
- `apps/web/src/hooks/useDraftAutosave.ts`

**Evidence:**

- No version field on draft config
- Read-modify-write without locks
- Multiple tabs can save simultaneously

**Risk:**

1. User opens Build Mode in two tabs
2. Tab A makes changes
3. Tab B makes different changes
4. Tab B saves, overwriting Tab A's changes without warning

## Proposed Solutions

### Option A: Optimistic locking with version field (Recommended)

**Description:** Add a version field that increments on each save

**Schema change:**

```prisma
model Tenant {
  landingPageConfigDraftVersion Int @default(0)
}
```

**Save logic:**

```typescript
const result = await prisma.tenant.updateMany({
  where: {
    id: tenantId,
    landingPageConfigDraftVersion: expectedVersion,
  },
  data: {
    landingPageConfigDraft: newDraft,
    landingPageConfigDraftVersion: { increment: 1 },
  },
});

if (result.count === 0) {
  throw new ConcurrencyError('Draft was modified by another session');
}
```

- **Pros:** Standard pattern, clear error handling
- **Cons:** Requires schema migration, UI conflict resolution
- **Effort:** Medium (3-4 hours)
- **Risk:** Low

### Option B: Last-write-wins with warning

**Description:** Track `draftUpdatedAt` and warn if changed since load

- **Pros:** Simpler, no blocking
- **Cons:** Still loses data, just warns after
- **Effort:** Small (1-2 hours)
- **Risk:** Medium (data loss possible)

### Option C: Real-time sync (future)

**Description:** Use WebSocket to sync draft across tabs

- **Pros:** Best UX, collaborative
- **Cons:** Complex, infrastructure needs
- **Effort:** Large
- **Risk:** Medium

## Recommended Action

Option A - Add optimistic locking. It's a proven pattern and matches the existing advisory lock pattern used for bookings.

## Technical Details

**Affected Files:**

- `server/prisma/schema.prisma`
- `server/src/agent/executors/storefront-executors.ts`
- `server/src/agent/tools/utils.ts` (getDraftConfig)
- `apps/web/src/hooks/useDraftAutosave.ts`
- `apps/web/src/app/(protected)/tenant/build/page.tsx`

**Database Impact:** New Int column on Tenant

## Acceptance Criteria

- [ ] Version field added to Tenant model
- [ ] Executors check version before update
- [ ] ConcurrencyError thrown on version mismatch
- [ ] Frontend receives error and shows conflict dialog
- [ ] Test case for concurrent edit detection

## Work Log

| Date       | Action                           | Learnings                                                 |
| ---------- | -------------------------------- | --------------------------------------------------------- |
| 2026-01-05 | Created from code review         | Pattern: Use optimistic locking for collaborative editing |
| 2026-01-05 | **DEFERRED** - Analysis complete | See deferral rationale below                              |

## Deferral Rationale (2026-01-05)

### Assessment Findings

1. **No version field exists**: Tenant model has `landingPageConfigDraft` but no version counter. Grep for `draftVersion|configVersion` returned no matches.

2. **Working pattern exists in codebase**: `onboardingVersion Int @default(0)` (schema line 117) provides a template for implementation.

3. **Implementation scope**:
   - Schema migration: Add `landingPageConfigDraftVersion Int @default(0)`
   - Backend: Modify all 8 storefront executors with version checks
   - Frontend: Add version to API calls + conflict resolution UI
   - Tests: Concurrent edit detection scenarios

### Why Defer

| Factor                  | Assessment                                      |
| ----------------------- | ----------------------------------------------- |
| **Blocking?**           | No - Build Mode works without this              |
| **Migration required?** | Yes - new column on Tenant                      |
| **Frontend work?**      | Yes - conflict dialogs not built                |
| **User impact**         | Low - multi-tab editing is edge case for MVP    |
| **Risk**                | Medium-low - data loss possible but recoverable |

### When to Implement

Implement after build mode branch merges to main:

1. Create migration: `landingPageConfigDraftVersion Int @default(0)`
2. Add ConcurrencyError class if not exists
3. Modify `saveDraftConfig()` to use `updateMany` with version check
4. Frontend: Pass `expectedVersion` in autosave payload
5. Handle 409 Conflict with user-friendly dialog

### Quick Implementation Reference

```prisma
model Tenant {
  landingPageConfigDraftVersion Int @default(0)
}
```

```typescript
const result = await prisma.tenant.updateMany({
  where: {
    id: tenantId,
    landingPageConfigDraftVersion: expectedVersion,
  },
  data: {
    landingPageConfigDraft: newDraft,
    landingPageConfigDraftVersion: { increment: 1 },
  },
});

if (result.count === 0) {
  throw new ConcurrencyError('Draft was modified by another session');
}
```

## Resources

- Similar pattern: `server/src/services/booking.service.ts` (advisory locks)
- ADR-013: Advisory locks for booking system
- Working example: `onboardingVersion` field on Tenant model (schema line 117)
