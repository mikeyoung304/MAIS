---
status: completed
priority: p2
issue_id: '618'
tags: [code-review, architecture, build-mode]
dependencies: []
completed_date: '2026-01-05'
---

# Branding Updates Bypass Draft System

## Problem Statement

The `update_storefront_branding` executor directly updates the Tenant model fields (primaryColor, secondaryColor, etc.) instead of the draft config. This is inconsistent with other Build Mode operations that save to draft first.

**What's broken:** Branding changes are immediately live
**Why it matters:** Inconsistent mental model - users expect Publish/Discard to work for all changes

## Findings

### Source: Architecture Review Agent + Agent-Native Review Agent

**File:** `server/src/agent/executors/storefront-executors.ts` (lines 410-468)

**Current Code:**

```typescript
// Lines 445-451 - Direct update, no draft
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    ...tenantUpdates, // primaryColor, secondaryColor, etc.
    ...(brandingUpdates && { branding: brandingUpdates }),
  },
});
```

**Evidence:** Section updates use `landingPageConfigDraft`, but branding updates write directly to Tenant table.

**Impact:**

1. Branding changes take effect immediately (cannot Discard)
2. Users cannot preview branding changes before publishing
3. Tool description says "saved to draft" but that's inaccurate

## Proposed Solutions

### Option A: Add branding to draft config (Recommended)

**Description:** Store branding changes in a `brandingDraft` field or extend `landingPageConfigDraft` to include branding.

**Schema change:**

```prisma
model Tenant {
  brandingDraft Json? // { primaryColor, secondaryColor, fontFamily, logoUrl }
}
```

- **Pros:** Consistent with draft/publish pattern
- **Cons:** Requires schema migration, more complex publish logic
- **Effort:** Medium (2-4 hours)
- **Risk:** Low

### Option B: Document as intentional immediate-apply

**Description:** Update tool description to clarify branding is immediately applied and cannot be discarded.

```typescript
description: `Update storefront branding (colors, fonts, logo).
NOTE: Branding changes take effect immediately and are NOT part of the draft system.`;
```

- **Pros:** No code changes, honest documentation
- **Cons:** Inconsistent UX remains, confusing for users
- **Effort:** Small (15 minutes)
- **Risk:** Medium (user confusion)

### Option C: Hybrid approach

**Description:** Colors remain immediate (preview in browser), but significant changes (logo, font) go to draft.

- **Pros:** Balance between UX and safety
- **Cons:** Partial inconsistency
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Option B short-term, Option A for v2. Document the current behavior accurately first, then evaluate if users need draft support for branding.

## Technical Details

**Affected Files:**

- `server/src/agent/executors/storefront-executors.ts`
- `server/src/agent/tools/storefront-tools.ts` (description)
- `server/prisma/schema.prisma` (if Option A)

**Database Impact:** Option A requires new column

## Acceptance Criteria

For Option B (immediate):

- [ ] Tool description updated to clarify immediate behavior
- [ ] Prevention doc updated to note this design decision

For Option A (future):

- [ ] Schema migration for `brandingDraft`
- [ ] Executor saves to draft
- [ ] Publish includes branding merge
- [ ] Discard clears branding draft

## Work Log

| Date       | Action                          | Learnings                                                                       |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------- |
| 2026-01-05 | Created from code review        | Design decision: Draft system consistency                                       |
| 2026-01-05 | RESOLVED - Option B implemented | Tool description updated, prevention doc updated with design decision rationale |

## Resources

- PR: N/A (current branch)
