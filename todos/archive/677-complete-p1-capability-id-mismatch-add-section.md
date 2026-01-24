---
status: complete
priority: p1
issue_id: '677'
tags: [code-review, agent-first-architecture, agent-parity]
dependencies: []
---

# P1: Capability ID Mismatch - `add_section` Has No Matching Tool

## Problem Statement

The capability registry (`agent-capabilities.ts`) lists `add_section` as a capability (lines 181-188), but no tool with this name exists. The actual tool that handles additions is `update_page_section`, which adds sections when `sectionIndex` is `-1` or omitted.

**Why This Matters:**

- Capability discovery or matching logic that uses IDs directly will fail
- Users may discover "Add Section" capability but agent cannot execute it
- Breaks the principle of "capability registry matches backend tools"

## Findings

**Agent:** Agent-Native Reviewer

**Location:** `apps/web/src/lib/agent-capabilities.ts` (lines 181-188)

**Current State:**

```typescript
{
  id: 'add_section',
  name: 'Add Section',
  description: 'Add a new section to your storefront',
  category: 'editing',
  keywords: ['add', 'new', 'create', 'section', 'testimonials', 'faq', 'gallery'],
  trustTier: 'T2',
  example: 'Add a testimonials section to my homepage',
}
```

**Backend Reality:**

- `update_page_section` tool handles both updates AND additions
- No separate `add_section` tool exists in `storefront-tools.ts` or `ui-tools.ts`

## Proposed Solutions

### Option A: Rename capability to match tool (Recommended)

- Rename `add_section` to `update_page_section` in capability registry
- Update description to reflect both add and update functionality
- **Pros:** Simple, maintains single tool
- **Cons:** Loses semantic clarity of "add" vs "update"
- **Effort:** Small (1 file change)
- **Risk:** Low

### Option B: Create alias tool for add

- Create `add_section` tool that wraps `update_page_section` with add-specific semantics
- **Pros:** Clean semantic separation
- **Cons:** Code duplication, two tools doing same thing
- **Effort:** Medium
- **Risk:** Low

### Option C: Update capability to use correct ID

- Change `id: 'add_section'` to `id: 'update_page_section'` but keep user-facing name
- Add `update_page_section` capability separately for updates
- **Pros:** Accurate IDs, good UX
- **Cons:** Two capabilities for one tool
- **Effort:** Small
- **Risk:** Low

## Recommended Action

**Option A** - Rename capability to `update_page_section` with description noting it handles both additions and updates.

## Technical Details

**Affected Files:**

- `apps/web/src/lib/agent-capabilities.ts`

**Verification:**

1. Check that capability ID matches tool name
2. Test capability search with "add section" query
3. Verify agent can execute the capability

## Acceptance Criteria

- [ ] Capability ID matches an existing backend tool name
- [ ] Capability description accurately reflects tool behavior
- [ ] Search for "add section" returns relevant capability
- [ ] Agent can successfully add a section via discovered capability

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
- File: `apps/web/src/lib/agent-capabilities.ts:181-188`
- Related: `server/src/agent/tools/storefront-tools.ts`
