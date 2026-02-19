# 11003 — Seed Test Mock Returns Same Segment ID for All Segments

**Status:** pending
**Priority:** P2
**Created:** 2026-02-17
**Source:** code-review (kieran-typescript-reviewer P2-2, data-integrity-guardian P2-3)

## Problem

`server/test/seeds/little-bit-horse-farm-seed.test.ts` — the `createMockPrisma` function returns the same `mockSegment` object (`{ id: 'segment-elopements-123' }`) for all three `segment.upsert` calls. This means all 8 tiers receive the same `segmentId` in the mock.

The real schema has `@@unique([segmentId, sortOrder])` on Tier, so tiers from different segments that share the same sortOrder (e.g., "Simple Ceremony" sortOrder=1 and "Focused Day" sortOrder=1) would collide in production if they were accidentally assigned the same segment. The test would not catch this bug.

## Proposed Solution

Return distinct segment objects per call using `mockImplementation` that reads the slug from the input args:

```typescript
segment: {
  upsert: vi.fn().mockImplementation((args) => {
    const slug = args.where.tenantId_slug.slug;
    return Promise.resolve({
      id: `segment-${slug}`,
      slug,
      name: `Segment ${slug}`,
      tenantId: mockTenant.id,
    });
  }),
  deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
},
```

Then add a test verifying tier-to-segment assignment:

```typescript
it('should assign tiers to their correct segments', async () => {
  const simpleTier = mockPrisma.tier.upsert.mock.calls.find(
    (c) => c[0].where.tenantId_slug.slug === 'simple-ceremony'
  );
  expect(simpleTier![0].create.segmentId).toBe('segment-elopements');
});
```

**Effort:** Small

## Acceptance Criteria

- [ ] Each segment.upsert call returns a unique segment ID
- [ ] Test verifies at least one tier per segment is linked to the correct segment ID
- [ ] All existing tests still pass

## Work Log

- 2026-02-17: Created from code review. Both reviewers flagged this independently.
