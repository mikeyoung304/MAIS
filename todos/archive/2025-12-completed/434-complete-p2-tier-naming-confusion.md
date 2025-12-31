# Tier Naming Creates Confusion

## Metadata

- **ID:** 434
- **Status:** pending
- **Priority:** P2
- **Tags:** brand, pricing, copy
- **Source:** Brand Review - Architecture Strategist

## Problem Statement

The current tier names "Handled / Fully Handled / Completely Handled" create confusion about whether the base tier is complete. The naming implies deficiency rather than value at each level.

- "Handled" alone suggests it's not "fully" handled
- "Fully Handled" implies "Handled" was incomplete
- "Completely Handled" is redundant after "Fully"

This naming may hurt conversion by making customers question the base tier's value.

## Findings

1. Current tiers in `apps/web/src/app/page.tsx` lines 67-112:
   - Handled ($49/mo) — "The essentials"
   - Fully Handled ($149/mo) — "The full membership"
   - Completely Handled (Custom) — "White glove"

2. The wordplay is clever but creates decision friction
3. "Essentials" and "full membership" descriptions try to fix the naming issue but don't fully succeed

## Proposed Solutions

### Option A: Professional Services Naming

- **Essentials** ($49) — "Get running"
- **Professional** ($149) — "Stay ahead"
- **Concierge** (Custom) — "White glove"

**Pros:** Each tier sounds complete, clear progression
**Cons:** Loses "handled" wordplay
**Effort:** Small
**Risk:** Low

### Option B: Action-Oriented Naming

- **Get Running** ($49)
- **Stay Ahead** ($149) — Most Popular
- **White Glove** (Custom)

**Pros:** Aligns with brand voice, action-oriented
**Cons:** Breaks "Handled" brand consistency
**Effort:** Small
**Risk:** Low

### Option C: Keep Wordplay, Fix Descriptions

- **Handled** ($49) — "Everything you need to launch"
- **Fully Handled** ($149) — "Launch + grow with AI & community"
- **Completely Handled** (Custom) — "Your dedicated team"

**Pros:** Keeps brand wordplay
**Cons:** Still has implicit hierarchy problem
**Effort:** Small
**Risk:** Medium — may not fully solve issue

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected Files:**

- `apps/web/src/app/page.tsx` — tiers array (lines 67-112)
- Any pricing page components
- Marketing materials referencing tier names

## Acceptance Criteria

- [ ] Each tier name conveys complete value at its level
- [ ] No tier name implies another tier is "more complete"
- [ ] Descriptions reinforce tier value without apologizing
- [ ] "Most Popular" badge on mid-tier maintained

## Work Log

| Date       | Action  | Notes                                   |
| ---------- | ------- | --------------------------------------- |
| 2025-12-27 | Created | From brand review multi-agent synthesis |

## Resources

- Stripe pricing page — good example of tier naming
- Linear pricing — "Free / Plus / Business / Enterprise"
