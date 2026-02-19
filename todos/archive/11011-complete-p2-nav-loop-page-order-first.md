---
status: pending
priority: p2
issue_id: '11011'
tags: [code-review, navigation, ordering]
---

# P2: Nav loop must iterate `PAGE_ORDER`, not `pages.home.sections`

## Problem Statement

The plan's proposed `getNavItemsFromHomeSections()` iterates `pages.home.sections` to derive nav items. Section order in `pages.home.sections` is determined by DB insertion order — non-deterministic across seed runs. If a testimonials section was inserted before an about section, testimonials appears before about in the nav. This ordering inconsistency won't be caught by tests.

## Fix

Use a `PAGE_ORDER`-first loop that checks section membership. This guarantees canonical nav order, eliminates the `seen` Set, and makes the unreachable `hero` skip disappear:

```typescript
export function getNavItemsFromHomeSections(pages?: PagesConfig | null): NavItem[] {
  if (!pages?.home?.sections?.length) {
    return [{ label: 'Home', path: '' }];
  }

  const items: NavItem[] = [{ label: 'Home', path: '' }];
  for (const page of PAGE_ORDER) {
    if (page === 'home') continue;
    const hasSection = pages.home.sections.some((s) => SECTION_TYPE_TO_PAGE[s.type] === page);
    if (hasSection) {
      items.push({ label: PAGE_LABELS[page], path: PAGE_ANCHORS[page] });
    }
  }
  return items;
}
```

7 lines of loop logic vs 12. Ordering is provably correct and deterministic.

## Acceptance Criteria

- [ ] Function uses `PAGE_ORDER` iteration, not `pages.home.sections` iteration
- [ ] No `seen` Set needed (deduplication is implicit — each `page` in `PAGE_ORDER` appears once)
- [ ] Nav items appear in canonical order: Home | About | Services | Gallery | Testimonials | FAQ | Contact (subset based on what's present)
- [ ] Works correctly for both Macon Headshots and Little Bit Farm expected navs
