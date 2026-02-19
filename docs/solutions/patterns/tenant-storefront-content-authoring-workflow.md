---
title: Tenant Storefront Content Authoring Workflow
category: patterns
subcategory: content-personalization
severity: informational
component: storefront-seed-pipeline
symptoms:
  - New tenant needs personalized storefront copy
  - Discovery questionnaire answers need translation to brand-aligned prose
  - Seed file content updates don't appear immediately on production
tags:
  - questionnaire-driven-personalization
  - seed-authoring
  - storefront-content
  - brand-voice
  - content-pipeline
  - tenant-onboarding
created: 2026-02-17
resolved: 2026-02-17
resolution_time: ~45 minutes
---

# Tenant Storefront Content Authoring Workflow

## Problem

A new tenant (Little Bit Farm) needed personalized storefront content derived from their discovery questionnaire answers. The raw answers were short, informal phrases — not publishable prose. The challenge: transform 10 brief questionnaire answers into a cohesive brand story that matches HANDLED's luxury-yet-approachable voice, then deploy it to production through the correct data pipeline.

## Context

### The Questionnaire-to-Copy Pipeline

Tenant onboarding collects 10 discovery questions:

| #   | Question Intent        | Raw Answer (Little Bit Farm)                               |
| --- | ---------------------- | ---------------------------------------------------------- |
| Q1  | Origin story           | "Share the horses and property with like-minded folks"     |
| Q2  | Desired client feeling | "Relaxed and rejuvenated"                                  |
| Q3  | Differentiator         | "You can touch a horse"                                    |
| Q4  | Owner backstory        | "Long term sales account manager with creative ideas"      |
| Q5  | Favorite part of work  | "Meeting people from all walks of life"                    |
| Q6  | 3 brand words          | "Quiet calming serene"                                     |
| Q7  | First impression       | "Unique space with a window to the world of horses"        |
| Q8  | Ideal client trait     | "A love for nature and animals"                            |
| Q9  | Proudest moment        | "Developing new and innovative outdoor ideas"              |
| Q10 | Friend description     | "Simplistic small farm very natural with a touch of class" |

### Archetype Identification

Q10 is the most revealing answer — it maps directly to a brand archetype:

> "Simplistic small farm, very natural with a touch of class"

This maps to the **"Craft Beer / Ted Lasso" archetype**: warm, friendly, grounded, with warm-sophisticated undertones. Not pretentious, not rustic — elevated simplicity.

## Solution

### Step 1: Consult Voice Guides

Before writing any copy, read both voice references:

- `docs/design/VOICE_QUICK_REFERENCE.md` — Quick rules (assume competence, be specific, sound expensive, no hype)
- `docs/design/BRAND_VOICE_GUIDE.md` — Extended patterns, forbidden words, archetype mapping

Key voice constraints applied:

- **No filler**: No "Welcome to..." or "We are proud to..."
- **Assume competence**: Don't explain what a farm visit is
- **Sound expensive through restraint**: Short sentences, confident tone
- **80/20 rule**: 80% neutral warmth, 20% character

### Step 2: Map Questionnaire to Paragraphs

Each paragraph of the About section draws from specific questionnaire answers:

| Paragraph          | Source Questions                                                | Technique                                                                        |
| ------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| P1: Origin         | Q1 (share horses)                                               | Direct paraphrase, lower the register                                            |
| P2: Backstory      | Q4 (sales career)                                               | Imply, don't explain. "dreaming up creative ideas for other people's businesses" |
| P3: Differentiator | Q3 (touch a horse), Q7 (unique space), Q6 (quiet)               | Lead with sensory detail, end with the hook                                      |
| P4: Clients        | Q5 (all walks of life), Q8 (nature lovers)                      | Connect the community without being sappy                                        |
| P5: Closing        | Q2 (relaxed), Q6 (quiet, calming, serene), Q10 (touch of class) | Bookend with brand words. Last line = tagline candidate.                         |

### Step 3: Write the Hero

The hero needs a headline that stops scrolling. From Q6 ("quiet calming serene"):

```typescript
content: {
  visible: true,
  headline: 'Where the noise stops.',
  subheadline: 'A quiet horse farm for ceremonies, retreats, and weekends away.',
  ctaText: 'Explore Experiences',
  backgroundImage: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=1920&h=1080&fit=crop&q=80',
},
```

**Why this works:** Five syllables. Period for finality. Matches the brand words without repeating them.

### Step 4: Write the About

```typescript
content: {
  visible: true,
  title: 'The Story',
  body: [
    'Little Bit Farm started with a simple idea — share the horses and the property with people who\'d appreciate it.',
    'The owner spent years in sales, dreaming up creative ideas for other people\'s businesses. Eventually she asked the obvious question: why not build something of her own?',
    'The farm is small by design. Natural. A little bit different. First-timers always say the same thing — it\'s the quiet that gets you. Then the horses walk over, and you realize you can actually touch them.',
    'Today the farm hosts ceremonies, retreats, and weekend getaways for people from all walks of life. The one thing they tend to have in common: a love for nature and animals, and a need to slow down.',
    'No parties. No amplified music. Just quiet land, good company, and a touch of class.',
  ].join('\\n\\n'),
  image: 'https://images.unsplash.com/photo-1598974357801-cbca100e65d3?w=800&h=600&fit=crop&q=80',
  imagePosition: 'right',
},
```

**P3 is the key paragraph** — it weaves Q3 (touch a horse), Q6 (quiet), and Q7 (unique space) into a single sensory arc. The sentence "Then the horses walk over, and you realize you can actually touch them" is the differentiator disguised as a moment.

### Step 5: Update Seed & Deploy

The seed file is the source of truth for production tenant data:

```bash
# Update server/prisma/seeds/little-bit-horse-farm.ts
# Then deploy:
SEED_MODE=little-bit-farm npx prisma db seed
```

**Critical cache note:** Published sections have a **5-minute LRU cache** (tenant-scoped). After re-seeding, the site won't show new content immediately. Hard-refresh after ~5 minutes, or wait for TTL expiry.

## Field Mapping Reference

The database-to-component field mapping catches people every time:

| Database Field (SectionContent.content) | Component Prop (HeroSection / TextSection) | Transform Function                                      |
| --------------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| `headline` / `title`                    | `headline`                                 | `transformContentForSection()` in `storefront-utils.ts` |
| `body` / `content`                      | `content`                                  | Same transform                                          |
| `image`                                 | `imageUrl`                                 | Same transform                                          |
| `backgroundImage`                       | `backgroundImageUrl`                       | Same transform                                          |
| `ctaText`                               | `ctaText`                                  | Direct passthrough                                      |
| `imagePosition`                         | `imagePosition`                            | Direct passthrough                                      |

The transform is in `apps/web/src/lib/storefront-utils.ts` → `transformContentForSection()`.

## Stock Image Selection

For tenant storefronts, Unsplash images work well with specific parameters:

```
Hero: ?w=1920&h=1080&fit=crop&q=80  (full-bleed, high-res)
About: ?w=800&h=600&fit=crop&q=80   (sidebar image, moderate)
```

Check `apps/web/src/lib/constants/stock-photos.ts` for existing curated images before searching externally. The `horse` key was already available.

## Prevention Strategies

### 1. Questionnaire Pipeline Checklist

Before writing tenant copy:

- [ ] Read both voice guides (`VOICE_QUICK_REFERENCE.md` + `BRAND_VOICE_GUIDE.md`)
- [ ] Identify brand archetype from Q10 (friend description)
- [ ] Map each paragraph to specific questionnaire answers
- [ ] Check: no forbidden words (revolutionary, game-changing, leverage, etc.)
- [ ] Check: no filler openings ("Welcome to...", "We are proud...")
- [ ] Check: headline is < 6 words, ends with period

### 2. Seed Deployment Checklist

- [ ] Update `server/prisma/seeds/{tenant-slug}.ts`
- [ ] Update tenant name in ALL locations (name field, log messages, meta titles)
- [ ] Run `SEED_MODE={slug} npx prisma db seed`
- [ ] Wait 5 minutes for cache TTL, then hard-refresh to verify
- [ ] Verify hero image loads (check Unsplash URL format)
- [ ] Verify about section paragraphs render (double-newline splitting)

### 3. Token Boundary Awareness

Tenant storefront components use semantic tokens (`text-primary`, `bg-background`, `text-accent`). These resolve via CSS custom properties injected by `TenantSiteShell`. Never use HANDLED marketing colors (e.g., `bg-surface`, `text-sage`) in tenant components.

See todo #11001 for ongoing debt around global-level color leaks (autofill, PWA manifest, body background).

### 4. Image Field Naming

The seed file uses `image` and `backgroundImage` (camelCase) in the JSON content. The component props use `imageUrl` and `backgroundImageUrl`. The `transformContentForSection()` function handles the mapping. Don't try to use prop names directly in the seed.

### 5. Cache Delay Awareness

The 5-minute LRU cache is tenant-scoped (`tenant:{tenantId}:sections:published`). After any seed update:

1. Content won't appear immediately — this is expected
2. Hard-refresh after TTL expiry
3. Don't re-run the seed thinking it failed

## Related Documentation

- `docs/design/VOICE_QUICK_REFERENCE.md` — Brand voice rules
- `docs/design/BRAND_VOICE_GUIDE.md` — Extended voice guide with archetypes
- `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md` — Section type drift
- `docs/solutions/patterns/TWO_PHASE_INIT_ANTIPATTERN.md` — Session init patterns
- `docs/solutions/runtime-errors/PRODUCTION_SMOKE_TEST_6_BUGS_STOREFRONT_CHAT_SLUG.md` — Storefront runtime bugs
- `apps/web/src/lib/storefront-utils.ts` — Field transform functions
- `apps/web/src/lib/constants/stock-photos.ts` — Curated stock images
- `server/prisma/seeds/little-bit-horse-farm.ts` — Reference seed implementation

## Key Learnings

1. **Q10 is the Rosetta Stone.** The "how would a friend describe your business" answer reveals the brand archetype faster than any other question. Start there.

2. **Paragraph mapping prevents drift.** Explicitly mapping each paragraph to source questions ensures the copy stays grounded in the owner's actual words, not the writer's assumptions.

3. **Restraint sounds expensive.** The best tenant copy uses short sentences, no superlatives, and ends paragraphs on concrete sensory details rather than abstractions.

4. **Seed files are source of truth.** For production tenant data, the seed file is authoritative. Don't edit the database directly — it will be overwritten on next seed run.

5. **Cache creates a false negative.** The 5-minute TTL means you'll always think your seed didn't work. It did. Wait and hard-refresh.
