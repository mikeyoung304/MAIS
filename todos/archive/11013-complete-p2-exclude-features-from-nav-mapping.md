---
status: pending
priority: p2
issue_id: '11013'
tags: [code-review, navigation, semantic]
---

# P2: Exclude `features` from `SECTION_TYPE_TO_PAGE` nav mapping

## Problem Statement

The plan maps `features` section type → `'services'` PageName, producing a "Services" nav item. For Macon Headshots, the FEATURES section is titled "How It Works: Schedule, Shoot, Select" — process steps, not service offerings. A user clicking "Services" in the nav expects pricing/tier listings, not steps.

Additionally, the brainstorm (`docs/brainstorms/2026-02-18-storefront-full-template-redesign-brainstorm.md`) plans both a FEATURES section ("How It Works") AND a services/tiers area. With the current mapping, both would produce "Services" nav items.

The `SegmentTiersSection` already renders at anchor `#services` — the tiers ARE the services nav item, rendered correctly without a FEATURES section producing that nav item.

## Fix

Exclude `features` from `SECTION_TYPE_TO_PAGE`:

```typescript
const SECTION_TYPE_TO_PAGE: Partial<Record<SectionTypeName, PageName>> = {
  // hero intentionally excluded — always at top, no anchor nav needed
  // cta intentionally excluded — closing section, not a nav destination
  // features intentionally excluded — process steps, not service offerings
  //   (SegmentTiersSection renders at #services anchor without this)
  about: 'about',
  text: 'about',
  services: 'services',
  gallery: 'gallery',
  testimonials: 'testimonials',
  faq: 'faq',
  contact: 'contact',
};
```

## Expected Nav Results

- **Macon Headshots** (sections: hero, about, features, testimonials, contact): Home | About | Testimonials | Contact
- **Little Bit Farm** (sections: hero, features, about, services, faq, cta): Home | About | Services | FAQ

## Acceptance Criteria

- [ ] `features` not in `SECTION_TYPE_TO_PAGE`
- [ ] Macon nav does NOT show "Services" for the "How It Works" section
- [ ] Little Bit Farm nav shows "Services" only for the `services` section type
- [ ] No nav item duplicates across both tenants
