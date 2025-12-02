---
status: pending
priority: p3
issue_id: "143"
tags: [code-review, visual-editor, security, audit]
dependencies: []
---

# Missing Audit Logging for Draft Operations

## Problem Statement

The PackageDraftService has no audit trail logging for draft saves, publishes, and discards. This makes it difficult to debug issues or track who changed what.

**Why it matters**: Without audit logs, troubleshooting user issues and tracking changes is impossible.

## Findings

### Discovery Source
Security Review Agent - Code Review

### Evidence
Location: `server/src/services/package-draft.service.ts`

```typescript
async saveDraft(tenantId: string, packageId: string, draft: UpdatePackageDraftInput): Promise<PackageWithDraft> {
  const existing = await this.repository.getPackageById(tenantId, packageId);
  if (!existing) {
    throw new NotFoundError(...);
  }
  return this.repository.updateDraft(tenantId, packageId, draft);  // No audit log
}

async publishDrafts(tenantId: string, packageIds?: string[]): Promise<{ published: number; packages: PackageWithDraft[] }> {
  const packages = await this.repository.publishDrafts(...);
  await this.invalidateCatalogCache(tenantId);
  return { published: packages.length, packages };  // No audit log
}

async discardDrafts(tenantId: string, packageIds?: string[]): Promise<{ discarded: number }> {
  const count = await this.repository.discardDrafts(tenantId, packageIds);
  return { discarded: count };  // No audit log - no record of what was discarded!
}
```

## Proposed Solutions

### Option 1: Add Logger Calls (Recommended)
Add structured logging similar to other admin operations.

```typescript
import { logger } from '../lib/core/logger';

async saveDraft(tenantId: string, packageId: string, draft: UpdatePackageDraftInput) {
  // ...
  const result = await this.repository.updateDraft(tenantId, packageId, draft);

  logger.info({
    tenantId,
    packageId,
    changedFields: Object.keys(draft),
    action: 'package_draft_saved'
  }, 'Package draft saved');

  return result;
}

async discardDrafts(tenantId: string, packageIds?: string[]) {
  // Log BEFORE discard to capture what will be lost
  const draftCount = await this.repository.countDrafts(tenantId);

  logger.info({
    tenantId,
    packageIds,
    draftCount,
    action: 'package_drafts_discarded'
  }, 'Package drafts discarded');

  return this.repository.discardDrafts(tenantId, packageIds);
}
```

**Pros**: Simple to implement, uses existing logger
**Cons**: Logs aren't queryable like a database table
**Effort**: Small
**Risk**: Low

### Option 2: Use ConfigChangeLog Table
Store audit records in the existing ConfigChangeLog table.

**Pros**: Queryable, persistent, matches existing pattern
**Cons**: More code, database writes
**Effort**: Medium
**Risk**: Low

## Recommended Action
<!-- Filled during triage -->

## Technical Details

### Affected Files
- `server/src/services/package-draft.service.ts`

### Database Changes Required
None for Option 1

## Acceptance Criteria
- [ ] Draft saves are logged with tenantId, packageId, and changed fields
- [ ] Publish operations are logged with count of affected packages
- [ ] Discard operations log what was discarded before deletion
- [ ] Logs include timestamp and can be correlated

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | Identified during visual editor code review |

## Resources
- PR: feat(visual-editor) commit 0327dee
