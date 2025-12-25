---
status: complete
priority: p3
issue_id: '386'
tags: [code-review, performance, animation]
dependencies: []
---

# P3: FAQ Accordion max-height Animation Limitation

**Priority:** P3 (Nice-to-Have)
**Category:** Performance / UX
**Source:** Code Review - Performance Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The FAQ accordion uses `max-height: 500px` for open state animations. This works but has limitations:
- Very long answers may be truncated
- Animation timing is based on 500px regardless of actual content height
- Short answers animate slowly relative to their height

## Location

- `apps/web/src/app/t/[slug]/(site)/faq/FAQAccordion.tsx` - accordion animation styles

## Risk

- Minor UX issue for very long FAQ answers
- Animation feels sluggish for short answers
- Not a functional bug, just a polish item

## Solution

Consider using CSS Grid animation trick for smooth height transitions:

```tsx
// CSS Grid approach (no JS needed)
<div
  className="grid transition-all duration-300 motion-reduce:transition-none"
  style={{
    gridTemplateRows: isOpen ? '1fr' : '0fr'
  }}
>
  <div className="overflow-hidden">
    {/* Content */}
  </div>
</div>

// Or use ResizeObserver for dynamic max-height
const [contentHeight, setContentHeight] = useState(0);
const contentRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!contentRef.current) return;
  const observer = new ResizeObserver(([entry]) => {
    setContentHeight(entry.contentRect.height);
  });
  observer.observe(contentRef.current);
  return () => observer.disconnect();
}, []);

<div style={{ maxHeight: isOpen ? contentHeight : 0 }}>
  <div ref={contentRef}>Content</div>
</div>
```

## Acceptance Criteria

- [ ] Evaluate if current animation is acceptable
- [ ] If improving, use CSS Grid or ResizeObserver approach
- [ ] Ensure animation respects prefers-reduced-motion
- [ ] Test with various FAQ answer lengths

## Related Files

- `apps/web/src/app/t/[slug]/(site)/faq/FAQAccordion.tsx`
