# Missing Social Proof on Homepage

## Metadata
- **ID:** 435
- **Status:** pending
- **Priority:** P2
- **Tags:** brand, marketing, conversion
- **Source:** Brand Review - Architecture Strategist

## Problem Statement

The HANDLED homepage has zero testimonials, case studies, member counts, or credibility signals. For a membership product, this is a significant conversion gap. Visitors have no proof that the service works or that others trust it.

## Findings

1. No testimonials anywhere on homepage
2. No "Join X professionals" or member count
3. No case studies or before/after examples
4. No "Featured in" or press logos
5. No specific results ("saved 10 hours/week", "booked 30% more clients")

**Trust signals that ARE present:**
- "No contracts. No hidden fees. Cancel anytime." (trust badges)
- "Humans who answer" (differentiator)
- FAQ with honest answers

But these describe the product, not validate it with social proof.

## Proposed Solutions

### Option A: Add Testimonial Section
- New section between Features and Pricing
- 3 testimonials: photographer, therapist, coach
- Photo, name, profession, quote
- Focus on transformation, not features

**Pros:** High credibility impact
**Cons:** Need to collect testimonials (may not have yet)
**Effort:** Medium (if testimonials exist) / Large (if need to collect)
**Risk:** Low

### Option B: Add Inline Social Proof
- Hero: "Join 47 service professionals who got handled"
- Features: Small testimonial quotes next to relevant features
- Pricing: "Most popular with photographers"

**Pros:** Integrated, doesn't add new section
**Cons:** Less visual impact than dedicated section
**Effort:** Small
**Risk:** Low

### Option C: Results-Focused Proof
- "Members book 30% more clients" (if data exists)
- "Average member saves 10 hours/week on admin"
- Case study: before/after with one member

**Pros:** Specific, compelling
**Cons:** Need real data
**Effort:** Medium
**Risk:** Medium — must be accurate

## Recommended Action
_To be filled during triage_

## Technical Details

**Affected Files:**
- `apps/web/src/app/page.tsx` — add testimonials array and section

**Data Needed:**
- 3+ member testimonials with permission to use
- Member count or waitlist size
- Any results data (time saved, bookings increased)

## Acceptance Criteria

- [ ] At least one form of social proof visible on homepage
- [ ] Proof is specific (names, professions, results) not generic
- [ ] Represents multiple verticals (photographer + therapist + coach)
- [ ] Feels authentic to brand voice (not corporate testimonials)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-27 | Created | From brand review multi-agent synthesis |

## Resources

- Basecamp homepage — excellent testimonial integration
- ConvertKit — member count as social proof
