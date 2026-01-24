---
status: complete
priority: p1
issue_id: 738
tags: [code-review, accessibility, wcag-aa, pr-27]
dependencies: []
---

# P1: Desktop/Mobile Close Button Below WCAG AA Touch Target Minimum

## Problem Statement

The desktop and mobile close buttons in AgentPanel.tsx use `h-8 w-8` (32px) which is below the WCAG 2.5.8 Level AA minimum of 44px for touch targets. While 24px is technically the absolute minimum, 44px is the recommended size for interactive elements.

**Impact:** Users with motor impairments may have difficulty clicking the small close button. Screen reader users relying on touch exploration may struggle to activate the control.

## Findings

**Reviewer:** accessibility-expert

**Location:** `apps/web/src/components/agent/AgentPanel.tsx:265` and `:443`

**Current Implementation:**

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => setIsOpen(false)}
  className="h-8 w-8 rounded-lg hover:bg-neutral-700" // 32px override
  aria-label="Collapse panel"
/>
```

**WCAG Criterion:** 2.5.8 Target Size (Level AA)

## Proposed Solutions

### Solution A: Remove Size Override (Recommended)

- **Pros:** Simple fix, uses existing `size="icon"` which provides 44px
- **Cons:** None
- **Effort:** Small (5 minutes)
- **Risk:** Low

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => setIsOpen(false)}
  className="rounded-lg hover:bg-neutral-700" // Let size="icon" control dimensions
  aria-label="Collapse panel"
/>
```

### Solution B: Explicit 44px Size

- **Pros:** Makes intent clear
- **Cons:** Overrides component defaults
- **Effort:** Small
- **Risk:** Low

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => setIsOpen(false)}
  className="h-11 w-11 rounded-lg hover:bg-neutral-700" // Explicit 44px
  aria-label="Collapse panel"
/>
```

## Recommended Action

Solution A - Remove the className size override at both locations.

## Technical Details

**Affected Files:**

- `apps/web/src/components/agent/AgentPanel.tsx` (lines 265, 443)

## Acceptance Criteria

- [x] Desktop close button is at least 44px x 44px
- [x] Mobile drawer close button is at least 44px x 44px
- [x] Visual appearance remains consistent with design
- [x] TypeScript compilation passes

## Work Log

| Date       | Action    | Notes                                                                                                                               |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-11 | Created   | From PR #27 multi-agent review                                                                                                      |
| 2026-01-11 | Completed | Removed `h-8 w-8` override from both desktop (line 265) and mobile (line 443) close buttons. Now uses `size="icon"` default (44px). |

## Resources

- PR #27: https://github.com/mikeyoung304/MAIS/pull/27
- WCAG 2.5.8: https://www.w3.org/WAI/WCAG21/Understanding/target-size.html
