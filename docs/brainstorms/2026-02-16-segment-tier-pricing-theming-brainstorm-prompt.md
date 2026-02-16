# Brainstorm Prompt: Segment/Tier Pricing, Per-Tenant Theming, and Data Ingestion

**Copy everything below this line into a fresh context window and prefix with `/workflows:brainstorm`**

---

## Context

We're building features for gethandled.ai — a multi-tenant platform for service professionals (photographers, retreat hosts, coaches, wedding planners). We need to brainstorm three interconnected features:

1. **Per-person scaling pricing on tiers** (build now, enterprise-grade)
2. **Per-tenant visual theming** (colors + fonts — partially built, needs completion)
3. **Website migration crawling** (future — agent crawls an existing site to pre-populate tenant data)

## Feature 1: Per-Person Scaling Pricing

### Problem

Our Tier model currently supports flat pricing only (`priceCents`). Real-world service businesses need per-person scaling:

- "Dinner is $110/person for 2-10 guests"
- "Floral workshop includes 2 people, +$60 per additional"
- "Grazing board includes 2 people, +$25 per additional guest"

We also have a specific tenant case where displayed prices are "all-in" including a venue cost (Airbnb at ~$200/night) but checkout should only charge the "experience portion" (displayed_total - venue_cost). The venue is booked separately.

### Current State

- `Tier` model has: `priceCents` (Int), `features` (Json — display-only feature list), `description` (Text)
- No `maxPeople`, no `scalingRules`, no `metadata` JSON field on Tier
- No guest count capture in booking flow
- Checkout charges flat `tier.priceCents` via Stripe
- `BookingAddOn` has `quantity` field but it's always 1

### What We Need to Brainstorm

- Schema design for `scalingRules` — JSON field? Separate table? What shape?
- How does guest count flow through: booking form → price calculation → Stripe checkout → booking record?
- How do we display per-person pricing on tier cards? (e.g., "From $1,000" vs "$110/person")
- Should venue cost split (Airbnb case) be a general "price composition" feature or a one-off?
- How does the tenant-agent configure scaling rules? What's the tool interface?
- How do add-ons interact with per-person pricing? (e.g., per-person add-on vs flat add-on)

### Sample Data (Real Tenant Input)

Here's the actual data we need to support. This is what a tenant provided:

```
SEGMENT: elopements ("Elopements & Vow Renewals")

Tier 1: "Simple Ceremony" — $1,000, max 6 people
  Includes: Ceremony, officiant, simple floral setup, champagne toast for couple

Tier 2: "Celebration Ceremony" — $1,700, max 10 people
  Includes: Everything in Tier 1 + grazing board + enhanced florals
  Scaling: Grazing includes 2 people, +$25/person up to 10

Tier 3: "Ceremony + Private Chef Dinner" — $2,500, max 10 people
  Includes: Everything in Tier 2 + private chef dinner + BYOB photographer
  Scaling: Dinner defaults to 2 people, $110/person for 2-10

SEGMENT: corporate_retreats ("Corporate Retreats")

Tier 1: "Focused Day" — $600, max 10
  Includes: Day retreat, meeting setup, quiet-use guidelines, light horse experience

Tier 2: "Hosted Day Retreat" — $1,200, max 10
  Includes: Everything in Tier 1 + coffee/pastries/grazing + one guided experience (choose: yoga OR trail walk OR extended horse time)

Tier 3: "Retreat + Meal" — $1,800, max 10
  Includes: Everything in Tier 2 + private chef lunch or dinner
  Scaling: Meal defaults to 2 people, $90/person for 2, $70-120/person for 3-10 (menu dependent)

SEGMENT: weekend_getaway ("Weekend Getaway")

Tier 1: "Hosted Stay" — $500, max 10
  Includes: Welcome experience, horse experience, light hosting

Tier 2: "Guided Getaway" — $1,000, max 10
  Includes: Everything in Tier 1 + two guided experiences (choose any two from: yoga, trail hike, extended horse time, wreath making, bouquet design)
  Scaling: Floral workshop includes 2 people, +$60/person additional

Tier 3: "Curated Weekend" — $1,600, max 10
  Includes: Everything in Tier 2 + curated weekend flow + premium floral workshop + private chef meal
  Scaling: Floral +$60/person, Meal $90/person for 2, $60-150/person for 3-10

Global rules:
- Displayed prices are "all-in" including Airbnb venue ($200/night)
- Checkout charges only the "experience portion" = displayed_total - airbnb_total
- Airbnb booked separately via link after checkout
- No parties, no amplified music, no horse riding
- Max group = 10 everywhere except Elopements Tier 1 = 6
```

### Design Constraints

- Build enterprise-grade — this is not a one-off. Many tenants will need per-person pricing.
- The scaling rules engine should be generic enough for: per-person flat rate, per-person with included count, tiered rates by group size, and potentially per-person add-ons.
- Must work with Stripe checkout (line items or metadata).
- Agent tools must be able to configure all of this conversationally.
- Display must be clear to end customers — no confusing math.

---

## Feature 2: Per-Tenant Visual Theming

### Problem

All tenant storefronts currently look identical — hardcoded Macon brand colors (navy/orange/teal) and fonts (Inter + Playfair Display). Tenants need their own visual identity.

### Current State (Partially Built)

**What EXISTS:**

- Database: `Tenant` has `primaryColor`, `secondaryColor`, `accentColor`, `backgroundColor` columns
- Database: `Tenant.branding` JSON field can store `fontFamily`, `logoUrl`
- Contracts: `ALLOWED_FONT_FAMILIES` allowlist (14 fonts: Inter, Roboto, Montserrat, Poppins, etc.)
- Agent tool: `update_branding` can set colors + font
- Logo: `branding.logoUrl` is displayed in nav/footer

**What DOES NOT exist:**

- No CSS custom properties system (`--primary-color`, etc.)
- No `TenantThemeProvider` component
- No dynamic Google Fonts loading
- Storefront sections (Hero, About, Services, Pricing) use hardcoded Tailwind classes
- Only chat widget + project hub use dynamic `primaryColor` via inline styles
- Data inconsistency: agent updates `branding` JSON but NOT the dedicated color columns

### What We Need to Brainstorm

- Single source of truth: dedicated columns vs branding JSON — which wins?
- CSS custom properties strategy: inject via `<style>` tag in layout? Tailwind CSS-in-JS?
- How do we handle Tailwind static classes + dynamic theming? (Tailwind doesn't natively support runtime CSS vars well)
- Font loading: dynamic `<link>` tags for Google Fonts? next/font dynamic? Performance implications?
- What's the minimal set of themable tokens? (primary, secondary, accent, bg, font-heading, font-body?)
- Should tenants get a "theme preview" in the agent chat?
- How does theming interact with the existing section content system (SectionContent table)?

### Design Constraints

- Must not break existing storefronts (progressive enhancement)
- Must be performant — no layout shift from late-loading fonts
- Must work with both `[slug]` and `_domain` route trees
- Agent must be able to set it conversationally ("make my site feel earthy and warm")
- Should support both explicit hex codes and semantic descriptions

---

## Feature 3: Website Migration Crawling (Future — Not MVP)

### Problem

When service professionals migrate from an existing website to gethandled.ai, they have to manually re-enter all their content, pricing, branding, and service descriptions. We want the agent to crawl their existing site and pre-populate everything.

### What We Need to Brainstorm (High Level Only)

- What data do we extract? (business name, services, pricing, images, brand colors, fonts, testimonials, about text, contact info)
- Crawling approach: single URL vs sitemap vs user-guided ("here's my services page, here's my about page")
- How does crawled data map to our models? (services → segments/tiers, about → SectionContent, colors → branding)
- Where does this run? (agent tool that calls a crawling service? Research-agent?)
- Alternative: instead of crawling, give users a ChatGPT prompt that interviews them and outputs structured JSON they paste into our agent chat
- How do we handle accuracy? (crawled data as "suggestions" the agent confirms with the user?)

### Design Constraints

- This is exploratory — we want to think about architecture, not build it now
- Must work for diverse website formats (Squarespace, Wix, WordPress, custom)
- Privacy: only crawl URLs the user explicitly provides
- Cost: LLM-based extraction is expensive — what's the right caching/batching strategy?

---

## Brainstorm Goals

By the end of this brainstorm, we should have clarity on:

1. **Scaling rules schema** — exact JSON shape for the `Tier` model
2. **Guest count flow** — how it moves through booking → checkout → record
3. **Theming architecture** — CSS custom properties strategy, font loading approach, source of truth
4. **Agent tool interfaces** — how the agent configures pricing and theming conversationally
5. **Website crawling architecture** — high-level approach for future implementation
6. **Implementation order** — what to build first, dependencies between features
7. **The "structured input" option** — can users paste a JSON/text block (like the sample data above) directly into the agent chat as an alternative to conversational setup?
