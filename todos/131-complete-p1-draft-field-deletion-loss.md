---
status: complete
priority: p1
issue_id: "131"
tags: [code-review, visual-editor, data-integrity, critical]
dependencies: []
---

# Draft Field Deletion Loss - Users Cannot Clear Fields

## Problem Statement

The visual editor's publish operation uses null-coalescing (`??`) which prevents users from intentionally clearing field values. When a user sets a draft field to an empty string, the fallback preserves the old live value instead of publishing the user's deletion.

**Why it matters**: Users editing packages cannot delete/clear content - the system silently ignores their changes, leading to frustration and data integrity issues.

## Findings

### Discovery Source
Data Integrity Review Agent - Code Review

### Evidence
Location: `server/src/adapters/prisma/catalog.repository.ts` lines 502-506

```typescript
// Publish operation fallback logic
name: pkg.draftTitle ?? pkg.name,
description: pkg.draftDescription ?? pkg.description,
basePrice: pkg.draftPriceCents ?? pkg.basePrice,
photos: pkg.draftPhotos ?? pkg.photos,
```

### Scenario
1. Live data: `name = "Original Package"`, `description = "Some text"`
2. User clears description in visual editor: `draftDescription = ""`
3. On publish: `description: "" ?? "Some text"` → Result: `"Some text"` (fallback applies)
4. User's intentional deletion is lost

## Proposed Solutions

### Option 1: Use Explicit "Edited" Tracking (Recommended)
Add boolean flags to track which fields were explicitly edited.

```typescript
// In schema.prisma
draftTitleEdited       Boolean @default(false)
draftDescriptionEdited Boolean @default(false)
// etc.

// In publish logic
name: pkg.draftTitleEdited ? pkg.draftTitle : pkg.name,
description: pkg.draftDescriptionEdited ? pkg.draftDescription : pkg.description,
```

**Pros**: Precise tracking, handles all edge cases
**Cons**: Schema changes required, more complexity
**Effort**: Medium
**Risk**: Low

### Option 2: Check for Undefined vs Null/Empty
Distinguish between undefined (not provided) and null/empty (explicitly cleared).

```typescript
// Use undefined to mean "not edited", null/empty to mean "explicitly cleared"
name: pkg.draftTitle !== undefined ? (pkg.draftTitle || null) : pkg.name,
```

**Pros**: No schema changes
**Cons**: Requires careful handling throughout codebase
**Effort**: Small
**Risk**: Medium (subtle bugs possible)

### Option 3: Store Complete Draft Snapshot
Store the entire package state as a single JSON draft blob.

```typescript
draftSnapshot: Json?  // Complete package state when editing
```

**Pros**: Simpler logic, no field-by-field tracking
**Cons**: Larger storage, harder to query individual fields
**Effort**: Large
**Risk**: Medium

## Recommended Action
<!-- Filled during triage -->

## Technical Details

### Affected Files
- `server/src/adapters/prisma/catalog.repository.ts` (publishDrafts method)
- `server/prisma/schema.prisma` (if adding tracking fields)
- `packages/contracts/src/dto.ts` (update DTOs if schema changes)

### Affected Components
- Package draft publishing
- Visual editor save/publish flow

### Database Changes Required
Option 1: Add 4 boolean tracking fields to Package model

## Acceptance Criteria
- [ ] User can clear a package title and have it publish as empty/null
- [ ] User can clear a description and have it remain cleared after publish
- [ ] User can remove all photos and have empty array after publish
- [ ] Existing behavior preserved for fields user didn't edit
- [ ] Unit tests cover intentional deletion scenarios

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | Identified during visual editor code review |

## Resources
- PR: feat(visual-editor) commit 0327dee
- Related: Visual Editor implementation
