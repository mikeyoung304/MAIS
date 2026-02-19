---
status: pending
priority: p1
issue_id: '11009'
tags: [code-review, typescript, navigation]
---

# P1: Fix `SECTION_TYPE_TO_PAGE` key type — use `SectionTypeName` not `string`

## Problem Statement

The plan for Issue 6 (nav fix) proposes declaring `SECTION_TYPE_TO_PAGE` with `string` as key type. `string` is a supertype of `SectionTypeName`, so TypeScript accepts it — but silently:

- Typos in the map compile with no error (`{ abuot: 'about' }` is valid with `string` key)
- New section types added to contracts never surface as "unhandled" at compile time

## Proposed Fix

When implementing `navigation.ts` Phase 2c, declare with `SectionTypeName` as key:

```typescript
import type { SectionTypeName } from '@macon/contracts';

const SECTION_TYPE_TO_PAGE: Partial<Record<SectionTypeName, PageName>> = {
  // hero intentionally excluded — always at top, no anchor nav needed
  // cta intentionally excluded — closing section, not a nav destination
  about: 'about',
  text: 'about',
  services: 'services',
  gallery: 'gallery',
  testimonials: 'testimonials',
  faq: 'faq',
  contact: 'contact',
  // features intentionally excluded — see todo 11013
};
```

Runtime impact: none. TypeScript impact: compile-time errors on typos.

## Acceptance Criteria

- [ ] `SECTION_TYPE_TO_PAGE` is typed `Partial<Record<SectionTypeName, PageName>>`
- [ ] `SectionTypeName` is imported from `@macon/contracts`
- [ ] TypeScript passes with no errors after change
