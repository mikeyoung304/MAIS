# Consultant Verb "solve problems" is Weak

## Metadata
- **ID:** 439
- **Status:** pending
- **Priority:** P3
- **Tags:** copy, brand
- **Source:** Brand Review - Pattern Recognition Specialist

## Problem Statement

In the ScrollingIdentity component, the consultant profession uses "solve problems" as its verb. This is generic compared to the other identity statements:

| Profession | Verb | Strength |
|------------|------|----------|
| photographer | capture moments | Strong |
| therapist | hold space | Strong (industry term) |
| coach | unlock potential | Strong |
| wedding planner | orchestrate magic | Good |
| **consultant** | **solve problems** | **Weak** |
| trainer | transform lives | Strong |
| designer | create beauty | Good |
| doula | guide journeys | Good |

"Solve problems" is what every consultant claims. It doesn't differentiate or resonate.

## Findings

Location: `apps/web/src/components/home/ScrollingIdentity.tsx` line 19

```typescript
{ profession: 'consultant', verb: 'solve problems' },
```

## Proposed Solutions

### Option A: "cut through noise"
Implies clarity, directness — aligns with brand voice

### Option B: "see what others miss"
Implies insight, expertise — differentiated

### Option C: "find the real issue"
Implies depth, diagnostic ability

### Option D: "make complexity simple"
Implies translation, clarity

## Recommended Action
Choose one of the above based on brand voice preference

## Technical Details

**Affected Files:**
- `apps/web/src/components/home/ScrollingIdentity.tsx` — line 19

**Change:**
```diff
- { profession: 'consultant', verb: 'solve problems' },
+ { profession: 'consultant', verb: 'cut through noise' },
```

## Acceptance Criteria

- [ ] Consultant verb is specific and evocative
- [ ] Matches strength of other identity statements
- [ ] Aligns with brand voice (anti-hype, confident)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-27 | Created | From brand review - Pattern Recognition Specialist |
