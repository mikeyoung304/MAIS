---
status: complete
priority: p1
issue_id: 648
tags: [code-review, accessibility, wcag, a11y, screen-reader]
dependencies: [647]
---

# Missing Live Region for Content Changes

## Problem Statement

When the view switches between segment selection and expanded view, screen reader users receive no announcement. They may not realize the content has changed.

**WCAG Criterion:** 4.1.3 Status Messages (Level AA)

**Why it matters:** Screen reader users rely on announcements to understand when dynamic content changes. Without live regions, the segment-first UX is confusing for these users.

## Findings

**Location:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/SegmentPackagesSection.tsx`

- Lines 359-387 (segment selection view)
- Lines 390-458 (expanded view)

**Current behavior:**

1. View changes from segment cards to tier cards (or vice versa)
2. No announcement is made
3. Screen reader user must explore page to understand change

**Source:** accessibility-reviewer agent

## Proposed Solutions

### Option 1: Add aria-live Region (Recommended)

Add a visually hidden live region that announces navigation changes:

```typescript
// Add state for announcement
const [announcement, setAnnouncement] = useState('');

// In handleSelectSegment:
const handleSelectSegment = useCallback(
  (segmentId: string) => {
    const segment = segments.find((s) => s.id === segmentId);
    if (segment) {
      window.history.pushState(null, '', `#segment-${segment.slug}`);
      setSelectedSegmentId(segmentId);
      setAnnouncement(`Viewing ${segment.name} packages`);
    }
  },
  [segments]
);

// In handleBack:
const handleBack = useCallback(() => {
  window.history.pushState(null, '', '#packages');
  setSelectedSegmentId(null);
  setAnnouncement('Returned to service categories');
}, []);

// Add visually hidden live region in JSX:
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {announcement}
</div>
```

**Pros:**

- Standard WCAG pattern
- Non-intrusive for sighted users
- Clear announcements

**Cons:**

- Additional state management

**Effort:** Small (15 min)
**Risk:** Low

### Option 2: Use aria-describedby on Sections

Add description that updates based on view state:

```typescript
<section
  id="packages"
  aria-describedby="packages-status"
>
  <span id="packages-status" className="sr-only">
    {selectedSegment
      ? `Showing ${selectedSegment.name} packages`
      : 'Choose a service category'}
  </span>
  {/* content */}
</section>
```

**Pros:**

- Associated with section element
- Simpler state

**Cons:**

- May not announce changes as clearly
- Less explicit about navigation

**Effort:** Small (10 min)
**Risk:** Low

## Recommended Action

Option 1 - Add dedicated aria-live region

## Technical Details

**Affected files:**

- `apps/web/src/components/tenant/SegmentPackagesSection.tsx`

**Tailwind sr-only class:**

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

## Acceptance Criteria

- [ ] Live region announces when segment is selected
- [ ] Live region announces when returning to segment selection
- [ ] Announcements are clear and concise
- [ ] Visual users are not affected

## Work Log

| Date       | Action                   | Learnings                                       |
| ---------- | ------------------------ | ----------------------------------------------- |
| 2026-01-08 | Created from code review | aria-live regions essential for dynamic content |

## Resources

- WCAG 4.1.3: https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html
- Code review: Segment-first browsing implementation
