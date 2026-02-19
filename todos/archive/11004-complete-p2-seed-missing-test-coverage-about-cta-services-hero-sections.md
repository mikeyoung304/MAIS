# 11004 — Add Test Coverage for ABOUT, CTA, SERVICES, HERO Section Content

**Status:** pending
**Priority:** P2
**Created:** 2026-02-17
**Source:** code-review (kieran-typescript-reviewer P2-4)

## Problem

`server/test/seeds/little-bit-horse-farm-seed.test.ts` tests FEATURES and FAQ section content in detail, but has no assertions on:

- **ABOUT section:** Multi-paragraph `body` (5 paragraphs of business copy), `image` URL, `imagePosition: 'right'`
- **CTA section:** `headline`, `subheadline`, `buttonText`, `style`
- **SERVICES section:** `showPricing: true`, `layout: 'cards'`
- **HERO section:** `backgroundImage` URL, `alignment: 'center'`

The ABOUT section contains substantial business content that Adele provided — if accidentally deleted in a future refactor, no test would catch it.

## Proposed Solution

Add 4 targeted test assertions in the existing `Section Content` describe block:

```typescript
it('should create ABOUT section with story content and image', async () => {
  const aboutCall = mockPrisma.sectionContent.create.mock.calls.find(
    (c) => c[0].data.blockType === 'ABOUT'
  );
  expect(aboutCall).toBeDefined();
  const content = aboutCall![0].data.content as Record<string, unknown>;
  expect(content.title).toBe('The Story');
  expect(content.body).toContain('Little Bit Farm started');
  expect(content.imagePosition).toBe('right');
});

it('should create CTA section with booking prompt', async () => { ... });
it('should create SERVICES section with pricing cards', async () => { ... });
it('should create HERO section with background image', async () => { ... });
```

**Effort:** Small

## Acceptance Criteria

- [ ] All 6 section types have at least one content assertion
- [ ] ABOUT body text spot-checked (first paragraph)
- [ ] CTA buttonText and style validated
- [ ] All tests pass

## Work Log

- 2026-02-17: Created from code review.
