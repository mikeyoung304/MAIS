# Brainstorm: Per-Person Scaling Pricing, Per-Tenant Theming, and Data Ingestion

**Date:** 2026-02-16
**Status:** Decisions captured, ready for planning
**Prompt:** `docs/brainstorms/2026-02-16-segment-tier-pricing-theming-brainstorm-prompt.md`

---

## What We're Building

Three features in priority order:

### 1. Per-Person Scaling Pricing (MVP — Build Now)

Add guest count and per-person pricing to the Tier model, booking flow, and Stripe checkout. Tenants like retreat hosts, private chefs, and workshop leaders need pricing that scales with group size.

### 2. Per-Tenant Visual Theming (MVP — Build After Pricing)

Complete the partially-built theming system. Inject CSS custom properties for tenant brand colors and fonts into storefronts. Ship with a classy default theme; tenants opt in to customize.

### 3. Website Migration Crawling (Future — Architecture Only)

Agent crawls a tenant's existing website to pre-populate content, pricing, colors, and fonts. Not building now — just architecting the approach.

---

## Key Decisions

### Decision 1: Scaling Rules Schema — JSON Field on Tier

Add `scalingRules` (Json, nullable) and `maxGuests` (Int, nullable) to the Tier model.

**Schema shape:**

```typescript
interface ScalingRules {
  components: ScalingComponent[];
}

interface ScalingComponent {
  name: string; // "Private Chef Dinner", "Floral Workshop"
  includedGuests: number; // Guests included in base price (e.g., 2)
  perPersonCents: number; // Cost per additional guest (e.g., 11000 = $110)
  maxGuests?: number; // Component-level max (overrides tier maxGuests if lower)
}
```

**Why JSON, not a separate table:**

- Scaling rules are read with the tier 99% of the time (no independent queries)
- Schema changes don't require migrations
- Components array handles multi-component tiers (e.g., Curated Weekend: floral $60/person + meal $90/person)
- Prisma Json fields are easy to validate at the application layer via Zod

**Why `maxGuests` as a dedicated column:**

- Used in availability checks, display, and validation
- Needs to be queryable (e.g., "show tiers that support 8 guests")
- Avoids parsing JSON for a simple integer check

**Example — Curated Weekend tier:**

```json
{
  "maxGuests": 10,
  "scalingRules": {
    "components": [
      {
        "name": "Floral Workshop",
        "includedGuests": 2,
        "perPersonCents": 6000
      },
      {
        "name": "Private Chef Meal",
        "includedGuests": 2,
        "perPersonCents": 9000
      }
    ]
  }
}
```

**Price calculation for 6 guests:**

- Base price: $1,600
- Floral: (6 - 2) \* $60 = $240
- Meal: (6 - 2) \* $90 = $360
- Total: $2,200

### Decision 2: Venue Cost Split — Display vs Charge Pricing

Add `displayPriceCents` (Int, nullable) to the Tier model.

- **`priceCents`** = what gets charged via Stripe (experience portion only)
- **`displayPriceCents`** = what the tier card shows (all-in, including venue)
- If `displayPriceCents` is null, use `priceCents` for display (the common case)

**Checkout UX:** When `displayPriceCents` differs from `priceCents`, show a price breakdown at checkout:

```
Experience package:     $2,100  ← charged now
Venue (book separately): $400  ← Airbnb link provided
────────────────────────────────
Displayed price:        $2,500
```

Post-checkout success page includes an Airbnb booking link (stored as `externalVenueUrl` in segment or tier metadata).

**Why two price fields instead of a deduction:**

- Explicit is better than calculated
- No risk of deduction math being wrong
- Agent sets both values directly
- Works for any "display vs charge" scenario, not just Airbnb

### Decision 3: Guest Count Flow — New Booking Step

Insert a **Guests** step into the booking wizard after the Confirm step:

**New flow:** Confirm → **Guests** → Date → Details → Review/Pay

**Guests step shows:**

- Stepper control (+/-) for guest count
- Live price calculation as guest count changes
- Per-component breakdown (if tier has scaling components)
- Min/max guest constraints from `maxGuests`

**Data flow:**

1. Customer selects guest count on Guests step
2. Frontend calculates total using scaling rules (read-only, for display)
3. Backend recalculates total authoritatively on booking creation
4. `guestCount` stored on Booking model
5. Stripe metadata includes `guestCount` for records
6. Webhook handler passes `guestCount` through to booking creation

**Schema addition:**

```prisma
model Booking {
  // ... existing fields ...
  guestCount  Int?  // Number of guests for this booking
}
```

### Decision 4: Theming Source of Truth — Dedicated Columns

**Colors:** Keep the 4 existing dedicated columns as the single source of truth:

- `primaryColor` (String, default "#1a365d")
- `secondaryColor` (String, default "#fb923c")
- `accentColor` (String, default "#38b2ac")
- `backgroundColor` (String, default "#ffffff")

**Fonts:** Add `fontPreset` column to Tenant (replaces fontFamily in branding JSON):

- `fontPreset` (String, default "classic")
- Resolves to heading + body font via `FONT_PRESETS` constant
- Presets: "modern", "warm", "bold", "classic", "minimal", etc. (8-10 options)

**Branding JSON:** Retained for `logoUrl` only. All color and font data moves to dedicated columns.

**Agent tool `update_branding`:** Updated to write to columns directly, not to branding JSON.

### Decision 5: CSS Custom Properties + Tailwind Theme Mapping

**The industry-standard approach for runtime theming with Tailwind:**

1. **Inject CSS vars** in tenant layout via `<style>` tag:

   ```html
   <style>
     :root {
       --color-primary: #1a365d;
       --color-secondary: #fb923c;
       --color-accent: #38b2ac;
       --color-background: #ffffff;
       --font-heading: 'Playfair Display', serif;
       --font-body: 'Inter', sans-serif;
     }
   </style>
   ```

2. **Map in tailwind.config:**

   ```js
   theme: {
     extend: {
       colors: {
         primary: 'var(--color-primary)',
         secondary: 'var(--color-secondary)',
         accent: 'var(--color-accent)',
       },
       fontFamily: {
         heading: 'var(--font-heading)',
         body: 'var(--font-body)',
       },
     },
   }
   ```

3. **Use clean Tailwind classes:**
   ```html
   <h1 class="font-heading text-primary">Welcome</h1>
   <p class="font-body text-gray-700">Description</p>
   <button class="bg-primary hover:bg-primary/80">Book Now</button>
   ```

**Why this approach:**

- Runtime theming (no build step per tenant)
- Full Tailwind utility support (hover, focus, responsive, opacity)
- SSR compatible (injected in layout, available on first render)
- Agent-friendly (update DB → next page load picks up new vars)
- Same pattern used by Shadcn/ui, Radix Themes, Material UI v5+

### Decision 6: Font Loading — Google Fonts CSS Link with Paired Presets

Dynamically inject a Google Fonts `<link>` tag in the tenant layout based on the selected font preset:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link
  href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Inter:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

- `font-display: swap` prevents layout shift (text renders in fallback font, swaps when loaded)
- Font URL constructed from the preset's heading + body font names
- Presets are hardcoded (no arbitrary font names = no CSS injection risk)
- CDN-cacheable (Google Fonts is globally distributed)

**Font preset system:**

- Schema: `fontPreset` String column on Tenant (default: "classic" or similar)
- Presets defined as a constant map: `FONT_PRESETS: Record<string, {heading: string, body: string, googleFontsUrl: string}>`
- Agent maps descriptive language to presets: "warm and elegant" → "warm" preset
- Each preset resolves to specific `--font-heading` and `--font-body` CSS var values

### Decision 7: Default Theme — Classy, Opt-In Customization

Ship with a polished default theme that most tenants will use. Customization is opt-in.

**Default palette:**

- Primary: refined navy or deep sage (TBD during implementation)
- Secondary: warm neutral
- Accent: subtle gold or sage
- Background: clean white
- Heading font: elegant serif (Playfair Display or Lora)
- Body font: clean sans-serif (Inter)

**Opt-in flow:**

- Tenants start with the default theme
- Agent can offer: "Would you like to customize your site's colors and fonts?"
- If yes, agent guides them through choices (or detects from pasted website URL in future)
- If no, they keep the classy default

### Decision 8: Structured Input — Agent Handles Both Modes Natively

The agent supports two input modes for setting up segments, tiers, and pricing:

1. **Conversational mode** (default): Agent interviews tenant one question at a time
2. **Paste mode** (auto-detected): When tenant pastes a large text block with pricing/service info, agent parses it via LLM, confirms the parsed data, and creates everything in one shot

**No external ChatGPT dependency.** The agent handles freeform text parsing natively. No JSON schema to maintain, no version drift, no context switching for the user.

**Detection heuristic:** If user message is >200 chars and contains pricing/tier-like patterns (dollar amounts, bullet points, tier names), switch to parse mode.

### Decision 9: Build Order — Pricing First, Then Theming

**Phase 1: Per-Person Scaling Pricing**

1. Schema: Add `maxGuests`, `scalingRules`, `displayPriceCents` to Tier, `guestCount` to Booking
2. Backend: Pricing engine (calculate total from scaling rules + guest count)
3. Agent tool: Update `manage_tiers` to accept scaling rules and maxGuests
4. Frontend: Guest count step in booking wizard, dynamic price display
5. Stripe: Include guest count in metadata, line item description
6. Contracts: Update Tier and Booking DTOs

**Phase 2: Per-Tenant Visual Theming**

1. Schema: Add `headingFont`, `bodyFont` columns to Tenant, migrate from branding JSON
2. Tailwind: Configure CSS var theme mapping
3. Layout: Inject CSS vars + Google Fonts link in tenant layout
4. Components: Migrate hardcoded Tailwind classes to theme-aware classes
5. Agent tool: Update `update_branding` to write columns
6. Font validation: Add `ALLOWED_FONT_FAMILIES` allowlist

**Phase 3: Website Crawling (Future)**

- Architecture only, no implementation

---

## Why This Approach

### Scaling Rules as JSON

The alternative was a separate `ScalingRule` table, but scaling rules are always read with their tier. A JSON field avoids join complexity, supports multi-component pricing naturally (array of components), and doesn't require migrations when the schema evolves. Zod validation at the application layer gives us type safety.

### Two Price Fields (display vs charge)

The venue cost split is a real business requirement. Rather than a complex deduction engine, two explicit price fields (`displayPriceCents` for cards, `priceCents` for checkout) make the intent clear. The common case (no split) just leaves `displayPriceCents` null.

### CSS Custom Properties + Tailwind

This is the industry standard used by every major design system. It gives us runtime theming without build-time compilation, full Tailwind utility support, and a clean migration path — we can convert components incrementally from hardcoded classes to theme-aware classes.

### Classy Defaults with Opt-In

Most service professionals don't want to be graphic designers. A beautiful default theme reduces decision fatigue and ensures every storefront looks professional out of the box. Power users can customize via the agent.

---

## Resolved Questions

1. **Tiered per-person rates:** Flat rate only for MVP. One `perPersonCents` value per component. Variable rates by group size (e.g., "$70-120 depending on menu") use a single average rate. Can add rate brackets later if tenants request it.

2. **Per-person add-ons:** Deferred. Add-ons stay flat price only. Per-person scaling lives on Tier's scalingRules components. If a tenant needs "per-person photography," model it as a scaling component on the tier.

3. **Default theme palette:** New neutral-elegant default — NOT the Macon platform brand colors. Design a palette that works universally for service professionals: deep charcoal primary, warm cream/white background, subtle sage or gold accent. Exact hex codes chosen during implementation.

4. **Font system:** Paired presets, not individual font selection. Offer 8-10 named presets that pair a heading font with a body font:
   - "Modern" — Inter + Playfair Display
   - "Warm" — DM Sans + Lora
   - "Bold" — Montserrat + Cormorant Garamond
   - "Classic" — Source Serif Pro + Source Sans Pro
   - etc.
     Prevents bad pairings, simpler UX, and the agent can map descriptions ("warm and elegant") to preset names. Schema stores preset name (e.g., `fontPreset: "warm"`) which resolves to heading + body font at render time.

## Open Questions

None — all questions resolved during brainstorm.

---

## Future Considerations (Not MVP)

### Website Migration Crawling

**High-level approach:** Agent tool that accepts a URL, calls a crawling service (or research-agent), extracts structured data via LLM, and maps it to our models:

- Business name, about text → SectionContent
- Services/pricing → Segments + Tiers + ScalingRules
- Brand colors, fonts → Tenant branding columns
- Testimonials → SectionContent (testimonials section)
- Images → Download + store in tenant media

**Key decisions deferred:**

- Crawling backend: Puppeteer service vs research-agent vs external API
- Privacy: Only crawl URLs the user explicitly provides
- Cost: Cache crawl results, batch LLM extraction calls
- Accuracy: All crawled data presented as suggestions, confirmed by user before saving
