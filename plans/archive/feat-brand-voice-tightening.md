# feat: Brand Voice Tightening & Copy Architecture

> Transform HANDLED's homepage copy from "functional but safe" to distinctively on-brand, while establishing a content architecture that makes future copy changes easy.

---

## Overview

HANDLED has strong brand voice documentation but a gap between stated principles and implementation. The homepage succeeds in structure (hero pattern, problem/solution flow) and in key moments (ScrollingIdentity easter eggs, final CTA) but falls flat in supporting copy that reads generic rather than distinctive.

This plan addresses two problems:

1. **Voice gap** - Copy doesn't consistently embody the "cheeky but professional, anti-hype" brand
2. **Architecture gap** - Copy is embedded in React components, making updates risky for non-developers

---

## Problem Statement

### The Voice Gap

| Element               | Brand Principle      | Current State                                          | Gap    |
| --------------------- | -------------------- | ------------------------------------------------------ | ------ |
| Subheadline           | Punchy, specific     | "For people with better things to do" (passive, vague) | High   |
| .ai self-awareness    | "Yes, it's .ai" joke | Completely missing                                     | High   |
| Done-for-you/with-you | Core differentiator  | Buried, not prominent                                  | High   |
| Pricing headline      | Playful              | "Skip the tech anxiety" (punches down)                 | Medium |
| FAQ answers           | Cheeky, competent    | Functional but flat                                    | Medium |
| Tier descriptions     | Playful              | Generic ("the essentials")                             | Medium |

### What's Working (Don't Break)

- **ScrollingIdentity pattern** - Identity-first headlines perfectly on-brand
- **Easter egg escalation** - "chaos gremlin" → "future skeleton" → "FREE ME" is brilliant
- **Problem section** - "Calendar Tetris" and specific pain points land
- **Final CTA** - "configure a payment processor" is viscerally relatable
- **"give a shit"** - Authentic without being crude

### The Architecture Gap

Copy is currently embedded in `page.tsx`:

- `features` array (lines 28-65)
- `tiers` array (lines 67-112)
- `faqs` array (lines 114-145)
- Inline JSX copy throughout

A copywriter would need to edit TypeScript/React files, risking build breaks.

---

## Research Findings

### From Tech Marketing Leaders

**Apple:** Identity marketing, confidence without arrogance, periods not exclamation marks
**Stripe:** Deep knowledge accessible delivery, writing as culture
**Basecamp/37signals:** Lead with ideas, anti-conformity, built audience before product
**Linear:** Speed as brand value, professional aesthetic for professionals

### Frameworks That Apply

**StoryBrand:**

- Hero: The service professional (photographer, coach, therapist)
- Enemy: The tech treadmill / constant change
- Guide: HANDLED
- Plan: Done-for-you tech + monthly filter
- Success: Focus on clients, not IT

**JTBD Template:**

> "When I'm [running my photography/coaching/therapy business], help me [handle the tech], so I can [focus on what I'm actually good at]."

### Anti-Patterns to Avoid

- "Beige branding" - Generic descriptors (friendly, professional, authentic) that don't differentiate
- Jargon that tells people they don't belong
- Features instead of outcomes
- Unsubstantiated superlatives (revolutionary, game-changing)

---

## Proposed Solution

### Phase 1: Content Architecture (Day 1)

Extract all copy into dedicated content files:

```
apps/web/
├── content/
│   ├── index.ts              # Re-export all
│   ├── types.ts              # TypeScript interfaces
│   └── home/
│       ├── hero.ts           # Tagline, subheadline, CTAs
│       ├── problem.ts        # Problem section copy
│       ├── features.ts       # Features array
│       ├── pricing.ts        # Tiers + headline
│       ├── faq.ts            # FAQ items
│       └── cta.ts            # Final CTA section
```

**Benefits:**

- Type-safe (prevents build breaks)
- Git-versioned (review changes in PRs)
- Single source of truth for all copy
- Copywriters edit data files, not components

### Phase 2: Voice Audit & Rewrites (Day 2-3)

Systematic review of every copy element against brand voice checklist.

#### Priority Rewrites

**1. Subheadline (HIGH)**

Current:

```
Websites. Booking. Payments. AI. Plus a monthly filter for what's
actually worth knowing. For people with better things to do.
```

Options:

```
A) Done-for-you websites, booking, and AI — plus monthly updates
   on what's actually worth knowing.

B) We handle the tech. You stay focused on what you're actually
   good at.

C) The tech stack you need. The monthly filter you want.
   Zero tutorials required.
```

**2. Add .ai Acknowledgment (HIGH)**

Insert somewhere prominent (nav area or hero):

```
"Yes, it's .ai. The robots do the boring parts."
```

**3. Done-for-you / Done-with-you Section (HIGH)**

New section or prominent callout:

```
Two things. That's it.

Done-for-you tech
Website, booking, payments, AI chatbot — we set it up, we maintain it.

Done-with-you education
Monthly newsletter + Zoom calls on what's actually worth knowing. No pitch.
```

**4. Pricing Headline (MEDIUM)**

Current: "Pick a plan. Skip the tech anxiety."
Better: "Pick your level of handled."

**5. Tier Descriptions (MEDIUM)**

Current:

- Handled: "The essentials"
- Fully Handled: "The full membership"
- Completely Handled: "White glove"

Better:

- Handled: "Get started"
- Fully Handled: "The sweet spot"
- Completely Handled: "We do everything"

**6. FAQ Voice Sharpening (MEDIUM)**

Current:

```
Q: Do I need to know anything about tech?
A: Nope. That's the point. We handle the tech so you don't have
   to become a tech person.
```

Better:

```
Q: Do I need to know anything about tech?
A: Nope. That's literally why we exist. You focus on clients.
   We focus on not breaking your website.
```

### Phase 3: Documentation Consolidation (Day 4)

Resolve the conflict between brand documents:

| Document                     | Says                                | Resolution                   |
| ---------------------------- | ----------------------------------- | ---------------------------- |
| BRAND_VOICE_GUIDE.md         | "The rest is handled."              | ✅ Keep as primary tagline   |
| HANDLED_BRAND_POSITIONING.md | "Stay ahead without the overwhelm." | Archive or mark as secondary |

Update `BRAND_VOICE_GUIDE.md` with:

- JTBD statement template
- StoryBrand positioning clarity
- Content file architecture reference
- Copy review checklist

---

## Technical Approach

### Content File Structure

```typescript
// content/home/hero.ts
export const hero = {
  tagline: 'The rest is handled.',
  aiJoke: "Yes, it's .ai. The robots do the boring parts.",
  subheadline:
    "Done-for-you websites, booking, and AI — plus monthly updates on what's actually worth knowing.",
  primaryCta: { text: 'Get Handled', href: '/signup' },
  secondaryCta: { text: "See What's Included", href: '#features' },
} as const;

export type Hero = typeof hero;
```

```typescript
// content/home/pricing.ts
export const pricing = {
  headline: "Pick your level of handled.",
  subheadline: "No contracts. No hidden fees. Cancel anytime.",
  tiers: [
    {
      name: "Handled",
      price: "$49",
      description: "Get started",
      features: [...],
      cta: { text: "Get Started", href: "/signup?tier=handled" },
    },
    // ...
  ],
} as const;
```

### Page Component Usage

```tsx
// apps/web/src/app/page.tsx
import { hero, problem, features, pricing, faq, cta } from '@/content';

export default function HomePage() {
  return (
    <div>
      <HeroSection {...hero} />
      <ProblemSection {...problem} />
      <FeaturesSection {...features} />
      <PricingSection {...pricing} />
      <FAQSection {...faq} />
      <CTASection {...cta} />
    </div>
  );
}
```

---

## Acceptance Criteria

### Content Architecture

- [ ] All homepage copy extracted to `/content` directory
- [ ] TypeScript interfaces define content structure
- [ ] Components import from content files, not inline strings
- [ ] Content files can be edited without React knowledge
- [ ] Build passes after extraction (no regressions)

### Voice Consistency

- [ ] Subheadline rewritten to be specific and action-oriented
- [ ] .ai self-awareness joke added somewhere prominent
- [ ] Done-for-you/done-with-you framing is prominently featured
- [ ] Pricing headline changed from "tech anxiety" to "level of handled"
- [ ] Tier descriptions updated to be more playful
- [ ] At least 3 FAQ answers sharpened with cheeky voice
- [ ] No copy uses forbidden words (revolutionary, game-changing, simple, easy, overwhelmed)

### Documentation

- [ ] BRAND_VOICE_GUIDE.md updated with content architecture reference
- [ ] Brand document conflict resolved (single source of truth for tagline)
- [ ] Copy review checklist added to brand guide

### Quality Gates

- [ ] `npm run typecheck` passes
- [ ] Visual review confirms no layout regressions
- [ ] Copy review against brand voice checklist (all items pass)

---

## Files to Modify

### New Files

- `apps/web/content/index.ts`
- `apps/web/content/types.ts`
- `apps/web/content/home/hero.ts`
- `apps/web/content/home/problem.ts`
- `apps/web/content/home/features.ts`
- `apps/web/content/home/pricing.ts`
- `apps/web/content/home/faq.ts`
- `apps/web/content/home/cta.ts`

### Modified Files

- `apps/web/src/app/page.tsx` - Import from content files
- `docs/design/BRAND_VOICE_GUIDE.md` - Add content architecture section
- `docs/design/HANDLED_BRAND_POSITIONING.md` - Mark as secondary/archive

---

## Success Metrics

1. **Voice consistency** - 100% of copy passes brand voice checklist
2. **Differentiation** - Homepage sounds distinctly HANDLED, not generic SaaS
3. **Maintainability** - Non-React developers can update copy safely
4. **No regressions** - All existing functionality preserved

---

## Risk Analysis

| Risk                            | Likelihood | Impact | Mitigation                                 |
| ------------------------------- | ---------- | ------ | ------------------------------------------ |
| Copy changes break layout       | Low        | Medium | TypeScript interfaces enforce structure    |
| Voice changes feel forced       | Medium     | High   | A/B test major changes if traffic warrants |
| ScrollingIdentity disrupted     | Low        | High   | Don't touch — it's already perfect         |
| Over-engineering content system | Medium     | Low    | Start simple, add CMS only if needed       |

---

## Future Considerations

### When to Add A/B Testing

If conversion matters and traffic warrants:

- Use Vercel Edge Middleware for zero-CLS experiments
- Create variant content files (`hero-a.ts`, `hero-b.ts`)
- Test subheadline variants first (highest impact)

### When to Add CMS

Only if non-technical editors need visual preview:

- Evaluate Sanity or Storyblok
- Migrate content files to CMS
- Keep TypeScript interfaces as schema

### When to Add Localization

If expanding internationally:

- Install `next-intl`
- Move content to JSON in `/messages/en/`
- Add `[locale]` routing segment

---

## References

### Internal

- `docs/design/BRAND_VOICE_GUIDE.md` - Brand voice principles
- `docs/design/HANDLED_BRAND_POSITIONING.md` - Strategic positioning
- `apps/web/src/app/page.tsx:28-145` - Current copy location
- `apps/web/src/components/home/ScrollingIdentity.tsx:15-38` - Easter eggs

### External

- [Apple Copywriting Techniques](https://miamiadschool.com/how-apple-uses-copywriting-to-woo-you/)
- [Stripe Writing Culture](https://slab.com/blog/stripe-writing-culture/)
- [StoryBrand Framework](https://www.creativeo.co/post/jobs-to-be-done-storybrand-framework)
- [JTBD for SaaS](https://www.tripledart.com/saas-marketing/building-a-jtbd-framework)
- [Vercel A/B Testing](https://vercel.com/blog/ab-testing-with-nextjs-and-vercel)
- [next-intl Docs](https://next-intl.dev/docs/getting-started/app-router)

---

_Plan created December 2025 for HANDLED (gethandled.ai)_
