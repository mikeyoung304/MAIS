---
status: complete
priority: p1
issue_id: '673'
tags:
  - code-review
  - build-mode
  - highlighting
  - bug
dependencies: []
---

# resolveSectionId Always Returns sectionIndex: 0

## Problem Statement

The `resolveSectionId` function in `BuildModeChat.tsx` parses section IDs (e.g., `home-hero-main`) but always returns `sectionIndex: 0` regardless of the actual section. This breaks the highlight feature - when the agent says `[highlight about-text-2]`, it will always highlight the first section of the page, not the intended section.

**Why it matters:** The highlight feature is non-functional for any section except the first one on each page. Users will see incorrect sections highlighted, breaking the agent's ability to guide them visually.

## Findings

**Location:** `apps/web/src/components/build-mode/BuildModeChat.tsx` (lines 34-47)

```typescript
function resolveSectionId(sectionId: string): { pageId: PageName; sectionIndex: number } | null {
  const parts = sectionId.split('-');
  if (parts.length < 2) return null;

  const pageId = parts[0] as PageName;

  // For now, we pass index 0 and let the parent handle the actual resolution
  // The parent (BuildModePage) knows the actual draft config and can find the section
  // This is a simplified approach - the highlight message goes to the preview iframe
  // which handles section lookup by ID directly
  return { pageId, sectionIndex: 0 }; // <-- ALWAYS RETURNS 0
}
```

**Impact:**

- Agent says `[highlight home-hero-main]` → highlights section 0 ✓ (works by coincidence)
- Agent says `[highlight home-text-2]` → highlights section 0 ✗ (wrong section)
- Agent says `[highlight about-gallery-main]` → highlights section 0 ✗ (wrong section)

**Flagged by:** TypeScript reviewer, Architecture reviewer, Simplicity reviewer, Agent-Native reviewer (4 independent confirmations)

## Proposed Solutions

### Option 1: Pass Section ID Directly to Iframe (Recommended)

Update the PostMessage protocol to accept section IDs instead of indices. The iframe can look up sections by ID since it has access to the rendered DOM.

**Changes:**

1. Add new message type `BUILD_MODE_HIGHLIGHT_SECTION_BY_ID` in `protocol.ts`
2. Update `resolveSectionId` to return `{ pageId, sectionId }` instead of `sectionIndex`
3. Iframe handles ID-to-element lookup via `data-section-id` attributes

**Pros:**

- ID-based lookup is more robust than index-based
- Sections can be reordered without breaking highlights
- Simpler code in BuildModeChat (no index resolution needed)

**Cons:**

- Requires protocol change
- Need to add `data-section-id` attributes to section elements

**Effort:** Medium (2-3 hours)
**Risk:** Low

---

### Option 2: Actually Resolve Section Index

Pass `draftConfig` to `resolveSectionId` and look up the section by ID to find its index.

**Changes:**

1. Update `resolveSectionId(sectionId, draftConfig)` signature
2. Find section index by matching `section.id === sectionId`
3. Return actual index instead of 0

**Pros:**

- Minimal protocol changes
- Works with existing index-based PostMessage

**Cons:**

- Index-based approach is fragile if sections are reordered
- Need to pass draftConfig through component hierarchy

**Effort:** Small (1 hour)
**Risk:** Low

---

### Option 3: Remove Section Index, Highlight by Page Only

Simplify to only page-level highlighting (highlight entire page, not specific section).

**Pros:**

- Simplest implementation
- Avoids index resolution complexity

**Cons:**

- Less precise user experience
- Loses the "point to specific section" capability
- Agent guidance becomes less useful

**Effort:** Small (30 min)
**Risk:** Low, but feature regression

## Recommended Action

**Option 1** is recommended as the long-term solution (ID-based protocol).
**Option 2** is acceptable as a quick fix if time-constrained.

## Technical Details

**Affected Files:**

- `apps/web/src/components/build-mode/BuildModeChat.tsx` (primary fix)
- `apps/web/src/lib/build-mode/protocol.ts` (if Option 1)
- `apps/web/src/app/t/[slug]/preview/page.tsx` (iframe handler, if Option 1)

**Testing:**

1. Agent says `[highlight home-hero-main]` → hero section highlights
2. Agent says `[highlight home-text-2]` → second text section highlights
3. Agent says `[highlight about-gallery-main]` → gallery on about page highlights
4. Invalid section ID → fails silently, no highlight

## Acceptance Criteria

- [ ] `resolveSectionId` returns correct index for any valid section ID
- [ ] Agent can highlight any section on any page
- [ ] Invalid section IDs fail gracefully (no error, no highlight)
- [ ] Existing tests pass

## Work Log

| Date       | Action                   | Learnings                              |
| ---------- | ------------------------ | -------------------------------------- |
| 2026-01-09 | Created from code review | 4 reviewers flagged this independently |

## Resources

- Commit: f1645a82 (feat: add section highlighting)
- Plan: `plans/build-mode-ux-enhancements.md` (lines 167-191 show intended implementation)
- Protocol: `apps/web/src/lib/build-mode/protocol.ts`
