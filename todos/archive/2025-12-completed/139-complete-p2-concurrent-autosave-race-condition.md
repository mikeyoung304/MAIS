---
status: completed
priority: p2
issue_id: '139'
tags: [code-review, visual-editor, data-integrity, concurrency]
dependencies: []
completed_date: 2025-12-01
---

# Concurrent Autosave Requests Can Cause Race Conditions

## Problem Statement

When multiple autosave requests arrive simultaneously (within 1s from client debounce), each issues separate UPDATE statements. If one fails while another succeeds, the data state becomes inconsistent without proper error handling.

**Why it matters**: Users could lose edits or end up with partial saves without knowing it.

## Findings

### Discovery Source

Data Integrity Review Agent - Code Review

### Evidence

**Client-side debounce (useVisualEditor.ts line 194):**

```typescript
}, 1000);  // 1 second debounce - CLIENT side only
```

**Server has no debouncing (catalog.repository.ts lines 464-476):**

```typescript
async updateDraft(tenantId: string, packageId: string, draft: UpdatePackageDraftInput): Promise<PackageWithDraft> {
  const pkg = await this.prisma.package.update({
    where: { id: packageId, tenantId },
    data: {
      ...(draft.title !== undefined && { draftTitle: draft.title }),
      ...(draft.description !== undefined && { draftDescription: draft.description }),
      // No locking, no version checking
```

**Scenario:**

1. User types title "ABC" → Request A sent with `{ title: "ABC" }`
2. User immediately types description "XYZ" → Request B sent with `{ description: "XYZ" }`
3. Request A completes, saves title
4. Request B fails (network error)
5. Result: Title saved, description lost, user doesn't know

**Worse scenario with photo uploads:**

1. User uploads photo → Request A
2. User edits title → Request B (includes photo references)
3. If Request B completes before A, photo state is inconsistent

## Proposed Solutions

### Option 1: Optimistic Locking with Version Field (Recommended)

Add version tracking to detect conflicts.

```prisma
model Package {
  // Add version field
  draftVersion Int @default(0)
}
```

```typescript
async updateDraft(tenantId, packageId, draft, expectedVersion) {
  try {
    return await this.prisma.package.update({
      where: { id: packageId, tenantId, draftVersion: expectedVersion },
      data: {
        ...draft,
        draftVersion: { increment: 1 }
      }
    });
  } catch (e) {
    if (e.code === 'P2025') {
      throw new ConflictError('Draft was modified by another request');
    }
    throw e;
  }
}
```

**Pros**: Detects conflicts, standard pattern
**Cons**: Schema change required, frontend needs version tracking
**Effort**: Medium
**Risk**: Low

### Option 2: Server-Side Request Deduplication

Use a short-lived cache to prevent rapid duplicate saves.

```typescript
const recentSaves = new Map<string, Promise<PackageWithDraft>>();

async updateDraft(tenantId, packageId, draft) {
  const key = `${tenantId}:${packageId}`;

  // If there's a pending save for this package, wait for it
  if (recentSaves.has(key)) {
    await recentSaves.get(key);
  }

  const savePromise = this.doSave(tenantId, packageId, draft);
  recentSaves.set(key, savePromise);

  try {
    return await savePromise;
  } finally {
    setTimeout(() => recentSaves.delete(key), 500);
  }
}
```

**Pros**: No schema changes, handles rapid saves
**Cons**: More complex logic, potential for stale data
**Effort**: Medium
**Risk**: Medium

### Option 3: Batch Updates on Client

Collect all changes and send as single request after debounce.

```typescript
// Client accumulates changes
const pendingChanges = useRef<Map<string, DraftUpdate>>(new Map());

const updateDraft = (packageId, update) => {
  const existing = pendingChanges.current.get(packageId) || {};
  pendingChanges.current.set(packageId, { ...existing, ...update });

  // Single debounced save for all changes
  debouncedSaveAll();
};
```

**Pros**: Single request, no race conditions
**Cons**: More complex frontend logic
**Effort**: Medium
**Risk**: Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

### Affected Files

- `server/src/adapters/prisma/catalog.repository.ts`
- `server/prisma/schema.prisma` (if adding version field)
- `client/src/features/tenant-admin/visual-editor/hooks/useVisualEditor.ts`

### Affected Components

- Draft autosave flow
- Concurrent editing detection

### Database Changes Required

Option 1: Add `draftVersion Int @default(0)` to Package model

## Acceptance Criteria

- [ ] Concurrent saves don't cause data loss
- [ ] Conflicts are detected and reported to user
- [ ] User can recover from conflict state
- [ ] Photo upload + edit don't conflict
- [ ] Tests verify concurrent save scenarios

## Work Log

| Date       | Action  | Notes                                       |
| ---------- | ------- | ------------------------------------------- |
| 2025-12-01 | Created | Identified during visual editor code review |

## Resources

- PR: feat(visual-editor) commit 0327dee
- Prisma optimistic locking: https://www.prisma.io/docs/concepts/components/prisma-client/optimistic-locking
