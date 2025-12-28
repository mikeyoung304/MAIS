# Add More Professions to ScrollingIdentity

## Metadata

- **ID:** 440
- **Status:** pending
- **Priority:** P3
- **Tags:** copy, brand, marketing
- **Source:** Brand Review - Pattern Recognition Specialist

## Problem Statement

The ScrollingIdentity component currently has 8 professions. Adding 2-3 more would:

1. Broaden appeal to additional verticals
2. Lengthen the animation loop for variety
3. Show more range in target audience

## Findings

Current professions (8):

- photographer, therapist, coach, wedding planner, consultant, trainer, designer, doula

Missing professions mentioned by marketing agencies:

- esthetician, nutritionist, stylist, massage therapist, tutor, real estate agent, DJ, caterer

## Proposed Solutions

### Recommended Additions

```typescript
{ profession: 'esthetician', verb: 'reveal radiance' },
{ profession: 'nutritionist', verb: 'fuel performance' },
{ profession: 'stylist', verb: 'shape confidence' },
```

These add:

- Service industry breadth (wellness, appearance, lifestyle)
- Strong, specific verbs
- Underrepresented but sizable markets

## Technical Details

**Affected Files:**

- `apps/web/src/components/home/ScrollingIdentity.tsx` — identities array

**Change:**

```diff
const identities = [
  { profession: 'photographer', verb: 'capture moments' },
  { profession: 'therapist', verb: 'hold space' },
  { profession: 'coach', verb: 'unlock potential' },
  { profession: 'wedding planner', verb: 'orchestrate magic' },
  { profession: 'consultant', verb: 'solve problems' },
  { profession: 'trainer', verb: 'transform lives' },
  { profession: 'designer', verb: 'create beauty' },
  { profession: 'doula', verb: 'guide journeys' },
+ { profession: 'esthetician', verb: 'reveal radiance' },
+ { profession: 'nutritionist', verb: 'fuel performance' },
+ { profession: 'stylist', verb: 'shape confidence' },
];
```

## Acceptance Criteria

- [ ] 10-12 total professions in rotation
- [ ] Each new verb is strong and specific
- [ ] Animation timing still feels natural (~25-30 second full loop)

## Work Log

| Date       | Action  | Notes                                              |
| ---------- | ------- | -------------------------------------------------- |
| 2025-12-27 | Created | From brand review - Pattern Recognition Specialist |
