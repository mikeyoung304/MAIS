---
status: complete
priority: p2
issue_id: '5209'
tags: [code-review, security, t3-pattern, section-content-migration]
dependencies: []
---

# P2: Confirmation Defaults to True in Publish/Discard Routes

## Problem Statement

The publish and discard routes default `confirmationReceived` to `true`, which bypasses the T3 confirmation pattern intended to prevent accidental destructive operations.

**Why it matters:** The T3 pattern (CLAUDE.md Pitfall #49) requires explicit confirmation for destructive operations. Defaulting to true means the safety check is effectively disabled.

## Findings

**Source:** Security Sentinel Agent Review

**Location:** `server/src/routes/internal-agent.routes.ts`

**Evidence:**

```typescript
// Current - defaults bypass safety
const { confirmationReceived = true } = req.body;

// Should be - requires explicit confirmation
const { confirmationReceived } = req.body;
if (!confirmationReceived) {
  return { requiresConfirmation: true, message: 'This will publish all sections...' };
}
```

**Impact:**

- Agent could accidentally publish/discard without user confirmation
- Bypasses the "T3 with confirmation param" pattern from CLAUDE.md

## Proposed Solutions

### Option A: Remove default, require explicit confirmation (Recommended)

**Approach:** Follow T3 pattern - first call returns preview, second call with confirmation executes

```typescript
// Route handler
const { confirmationReceived } = req.body;
if (!confirmationReceived) {
  const draftSections = await sectionContentService.getDraftSections(tenantId);
  return {
    requiresConfirmation: true,
    message: `This will publish ${draftSections.length} draft sections.`,
    sections: draftSections.map((s) => s.sectionType),
  };
}
// Proceed with publish
```

**Pros:** Proper T3 pattern, prevents accidents
**Cons:** Agent tools need to handle two-step flow
**Effort:** Small (1 hour)
**Risk:** Low

### Option B: Add confirmation parameter to Zod schema

**Approach:** Make confirmationReceived required in schema

```typescript
const PublishSchema = z.object({
  confirmationReceived: z.boolean(), // Required, no default
});
```

**Pros:** Schema-level enforcement
**Cons:** Still needs preview message for false case
**Effort:** Small
**Risk:** Low

## Recommended Action

**Option A: Remove default, require explicit confirmation** - Remove `= true` default from route handlers. Agent tools already send explicit `confirmationReceived` values.

**Triaged:** 2026-02-02 | **Decision:** Fix before merge | **Rationale:** Safety quality improvement, proper T3 pattern

## Technical Details

**Affected Files:**

- `server/src/routes/internal-agent.routes.ts`

**Database Changes:** None

## Acceptance Criteria

- [x] No default value for `confirmationReceived`
- [x] First call without confirmation returns preview
- [x] Second call with confirmation=true executes
- [x] Agent tools already handle two-step flow (confirmed via comments in storefront-write.ts and draft.ts)

## Work Log

| Date       | Action                   | Learnings                                                                                                           |
| ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 2026-02-02 | Created from code review | Identified by security-sentinel agent                                                                               |
| 2026-02-02 | Fixed                    | Removed `= true` defaults from publish/discard routes, updated service method signatures to accept optional boolean |

## Resources

- PR: `feat/section-content-migration`
- CLAUDE.md Pitfall #49: T3 without confirmation param
