---
status: complete
priority: p1
issue_id: 647
tags: [code-review, accessibility, wcag, a11y]
dependencies: []
---

# Missing Focus Management After Segment Selection

## Problem Statement

When a user clicks a segment card, the view changes to show the expanded segment view, but focus is not programmatically moved. Screen reader users will be lost - their focus remains on the now-invisible segment card.

**WCAG Criterion:** 2.4.3 Focus Order (Level A)

**Why it matters:** This is a critical accessibility barrier for keyboard and screen reader users. The segment selection UI becomes unusable for assistive technology users.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/SegmentPackagesSection.tsx`

- Lines 283-293 (handleSelectSegment)
- Lines 296-300 (handleBack)

**Current behavior:**

1. User clicks segment card
2. State updates, new content renders
3. Focus remains on now-hidden element
4. Screen reader user has no indication content changed

**Source:** accessibility-reviewer agent

## Proposed Solutions

### Option 1: Move Focus to Expanded Heading (Recommended)

Add a ref to the expanded view heading and focus it after state change:

```typescript
import { useRef } from 'react';

// Add ref for the expanded view heading
const expandedHeadingRef = useRef<HTMLHeadingElement>(null);

const handleSelectSegment = useCallback(
  (segmentId: string) => {
    const segment = segments.find((s) => s.id === segmentId);
    if (segment) {
      window.history.pushState(null, '', `#segment-${segment.slug}`);
      setSelectedSegmentId(segmentId);
      // Move focus after React renders
      requestAnimationFrame(() => {
        expandedHeadingRef.current?.focus();
      });
    }
  },
  [segments]
);

// Add ref and tabIndex to the expanded heading (line 415):
<h2
  ref={expandedHeadingRef}
  tabIndex={-1}
  className="font-serif text-3xl font-bold ..."
>
  {selectedSegment.heroTitle || selectedSegment.name}
</h2>
```

**Pros:**

- Direct focus management
- Clear navigation path
- Standard pattern

**Cons:**

- Requires `tabIndex={-1}` on heading

**Effort:** Small (15 min)
**Risk:** Low

### Option 2: Use React Focus Trap

Wrap the expanded view in a focus trap that captures focus:

```typescript
import { FocusTrap } from '@radix-ui/react-focus-trap';

{selectedSegment && (
  <FocusTrap>
    <div className="animate-in fade-in ...">
      {/* content */}
    </div>
  </FocusTrap>
)}
```

**Pros:**

- Handles edge cases automatically
- Radix UI is already in the project

**Cons:**

- May be overkill for this use case
- Could trap focus unexpectedly

**Effort:** Small (10 min)
**Risk:** Medium (might affect navigation)

## Recommended Action

Option 1 - Direct focus management with ref

## Technical Details

**Affected files:**

- `apps/web/src/components/tenant/SegmentPackagesSection.tsx`

**Also needed:**

- Add aria-live region for screen reader announcements (separate todo #648)

## Acceptance Criteria

- [ ] Focus moves to segment heading when segment is selected
- [ ] Focus moves to "All Services" or segment selection when back is clicked
- [ ] Tab order is logical after navigation
- [ ] Screen reader announces the navigation

## Work Log

| Date       | Action                   | Learnings                                          |
| ---------- | ------------------------ | -------------------------------------------------- |
| 2026-01-08 | Created from code review | Focus management critical for SPA-style navigation |

## Resources

- WCAG 2.4.3: https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html
- Code review: Segment-first browsing implementation
