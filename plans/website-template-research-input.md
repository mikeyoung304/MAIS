# Website Template Research Input

## Source
Deep research conversation providing a complete execution plan for implementing "Hosted Website Template + Segment → 3-Tier Storefront → Booking Journey"

---

## Original Research Prompts (8 Total)

### Prompt 0 — Repo Comprehension + Guardrails
**Purpose:** Align agent to repo's real rules before coding.

Key constraints to follow:
- Contracts-first ts-rest + Zod (no ad-hoc types)
- Multi-tenant isolation rules (tenantId scoping, tenant resolution patterns)
- Layered architecture (routes → services → adapters)
- Mock-first development and test expectations
- UI/UX brand/quality guardrails

---

### Prompt 1 — Site Template Data Model

**Goal:** Introduce a tenant-scoped Site Template config without overbuilding ConfigVersion yet.

**Proposed Decision:** Store a `siteConfig` JSON blob on Tenant for v1 (validated with Zod; can be migrated into ConfigVersion later per roadmap).

**Proposed Schema:**
```typescript
siteConfig: {
  schemaVersion: 1,
  brandVoice: { tone, styleHints[] },
  navigation: { items[] },
  pages: {
    home: PageConfig,
    services?: PageConfig,
    about?: PageConfig,
    faq?: PageConfig,
    contact?: PageConfig
  },
  segments: SegmentConfig[] (each segment has 3 tiers),
  booking: { mode: "instant"|"inquiry", ctaLabel, ctaStyle, embedWidgetEnabled },
  modules: ModuleConfig[] (each has { type, enabled, variant?, props }),
  analytics: { enabled, provider: "none"|"cloudflare"|"plausible"|"simple", eventNamespace }
}
```

---

### Prompt 2 — Tenant-Admin API for siteConfig

**Endpoints:**
- `GET /v1/tenant-admin/site-config` - Returns TenantSiteConfig
- `PUT /v1/tenant-admin/site-config` - Full replace (no patch for v1)

**Security:** Must require tenant-admin JWT and enforce tenantId scoping.

---

### Prompt 3 — Public Hosted Site Routing + Tenant Resolution by Slug

**Problem:** Hosted sites can't rely on X-Tenant-Key because it's a public website.

**Proposed Solution:**
- URL shape: `/site/:tenantSlug` (recommended for v1)
- New endpoint: `GET /v1/public/site/:slug`
- Returns: `{ tenant: { name, slug, branding }, siteConfig, packages/segments data }`
- Must NOT leak sensitive tenant secrets

---

### Prompt 4 — Modular Page Renderer

**Core Feature:** Config-driven modules with variants.

**Components:**
- `HostedSiteRenderer` - Takes tenant branding, siteConfig, package/segment/tier data
- Module registry pattern with type enum and variants

**MVP Module Set:**
1. Hero (headline/subhead/primary CTA)
2. TrustBar (logos/review count)
3. SegmentPicker (choose customer segment)
4. TierCards (3-tier storefront per selected segment)
5. SocialProof (testimonials)
6. FAQ
7. FinalCTA
8. Footer

---

### Prompt 5 — Map Segments + Tiers to Existing Package Catalog

**Key Insight:** MAIS already has packages and segment-based discovery. Don't invent a parallel pricing database.

**Existing Fields (CONFIRMED):**
- `Package.segmentId` - Which segment this belongs to (nullable)
- `Package.grouping` - Tier/group label like "Budget", "Premium"
- `Package.groupingOrder` - Order within grouping

**Approach:** Use existing fields, potentially add `Package.tier` enum if needed.

---

### Prompt 6 — Tenant-Admin UI for siteConfig (MVP Editor)

**Not a full page builder.** MVP editor that edits key fields and module order.

**Editable Fields:**
- Hero headline/subhead
- Segments list & labels (and which segment is default)
- Tier labels + short descriptions
- Testimonials list (simple)
- FAQ list
- Booking mode (instant vs inquiry)
- Module order (up/down buttons)

---

### Prompt 7 — Analytics Event Taxonomy

**Privacy-first approach.** No invasive vendors.

**Events:**
- site_view
- segment_selected
- tier_viewed
- tier_cta_clicked
- booking_started
- booking_step_completed
- booking_completed

---

### Prompt 8 — CRO Test Hooks + Future ConfigVersion

**Future-proofing without delaying launch:**
- schemaVersion handling in siteConfig
- Server-side "default config generator"
- Preview config endpoint: `GET /v1/tenant-admin/site-config/default`
- Simple diff helper for comparing site configs

---

## Key Architecture Reminders from Research

1. **Tenant isolation sacred:** tenantId in all queries; slug resolution returns only safe fields
2. **Follow repo workflow:** contracts define everything, routes are thin, services own logic
3. **Don't break mock mode:** mock adapters must handle new fields gracefully
4. **Keep UI consistent and clean:** module approach + strong defaults

---

## MAIS Codebase Current State (From Exploration)

### Already Exists (No Changes Needed)

| Feature | Location | Status |
|---------|----------|--------|
| `Package.segmentId` | Prisma schema | ✅ Exists |
| `Package.grouping` | Prisma schema | ✅ Exists (tier label) |
| `Package.groupingOrder` | Prisma schema | ✅ Exists |
| `Tenant.landingPageConfig` | Prisma schema | ✅ Exists (JSON) |
| `Tenant.tierDisplayNames` | Prisma schema | ✅ Exists (JSON) |
| `Tenant.branding` | Prisma schema | ✅ Exists (JSON) |
| `GET /v1/public/tenants/:slug` | Routes | ✅ Exists (public lookup) |
| Landing page sections | Client features | ✅ Exists (HeroSection, FaqSection, etc.) |
| Segment service | Server | ✅ Exists |
| Catalog service | Server | ✅ Exists |

### Needs Enhancement

| Feature | Current State | Enhancement Needed |
|---------|---------------|-------------------|
| `landingPageConfig` | Basic structure | Expand for modular sections |
| Public site access | Only via X-Tenant-Key | Add `/site/:slug` route with full page data |
| Module renderer | Hardcoded sections | Config-driven with variants |
| Tenant admin editor | Basic branding | Full siteConfig editor |
| Analytics | None | Add event tracking layer |

---

## Critical Decision Points

1. **Do we add a new `siteConfig` field OR expand existing `landingPageConfig`?**
   - Research suggests new `siteConfig` for cleaner separation
   - But `landingPageConfig` already exists with similar purpose

2. **Segment/tier mapping approach:**
   - Use existing `grouping` field (flexible but requires convention)
   - OR add explicit `tier: 1|2|3` field (rigid but clear)

3. **URL structure for hosted sites:**
   - `/site/:slug` (research recommendation)
   - `/s/:slug` (already used for storefront routes)

4. **Module variant system:**
   - Simple variants (hero: centered|split)
   - OR full theme presets (minimalist, bold, playful)
