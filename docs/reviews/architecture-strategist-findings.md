# Architecture Strategist -- Code Review: Storefront Nav + Section Rendering Changes (2026-02-18)

**Reviewer:** architecture-strategist
**Date:** 2026-02-18
**Scope:** Nav derivation strategy change (section-scan vs page-enabled), HowItWorksSection deletion, domainParam removal, testimonials field mapping

---

## Summary

3 P2 issues, 2 P3 issues. No P1s. The core direction is correct — section-scan nav is semantically sound for a committed single-page architecture — but three patterns introduce silent failure modes that will surface as tenants diversify their content configurations.

---

## Finding 1 (P2): Duplicate section types silently collapse to one nav item but produce invalid duplicate anchor IDs in the DOM

**File:** `apps/web/src/components/tenant/SectionRenderer.tsx:151-180`

`getNavItemsFromHomeSections()` correctly produces only one nav item per page via `Array.prototype.some()`. However, `SectionRenderer` assigns `id={anchorId}` to the wrapper `<div>` for every section it renders regardless of whether that anchor ID has already been used:

```typescript
// Normal mode - include anchor ID for single-page navigation
return (
  <div key={sectionKey} id={anchorId}>
    ...
  </div>
);
```

If a tenant has two `testimonials` sections on the home page (the schema allows it — no uniqueness constraint on `blockType + pageName` in `SectionContent`), two `<div id="testimonials">` elements are rendered. This violates the HTML spec (`id` must be unique per document). Browsers match only the first occurrence when resolving anchor links — the second testimonials section will be unreachable via `#testimonials`. This is currently a latent bug; no seed tenant has duplicate home-page section types. It becomes a real defect as soon as any AI agent or manual edit adds a second section of the same type.

**Recommendation:** In `SectionRenderer`, track which anchor IDs have been assigned using a `Set<string>` scoped to the render call, and skip the `id` attribute for subsequent sections that would produce a duplicate.

---

## Finding 2 (P2): `domainParam` described as removed but is still functionally active — misleading commit description creates future deletion risk

**Files:**

- `apps/web/src/components/tenant/SegmentTiersSection.tsx:349–358`
- `apps/web/src/components/tenant/ContactForm.tsx:59`
- `apps/web/src/app/t/_domain/page.tsx:107, 133`

Commit `b0c536ce` states "Remove unused domainParam from TenantSiteShell." It does correctly remove `domainParam` from `TenantSiteShell`'s prop interface. However, `domainParam` remains active in two downstream consumers via the `TenantLandingPage` prop chain:

`SegmentTiersSection` (line 352): `getBookHref` uses `domainParam` to select between `/t/${tenant.slug}/book/${tierSlug}` (custom domain path with explicit slug) and `${basePath}/book/${tierSlug}` (slug-routed path). For domain-routed tenants `basePath` is `""`, so omitting this guard would produce broken `/book/${tierSlug}` booking links.

`ContactForm` (line 59): `homeHref` uses `domainParam` to construct `/?domain=example.com` for domain-routed tenants. Without it, "Back to Home" navigates to `/` without the domain query parameter, losing tenant context.

Both retentions are correct. The risk is that the commit description says it was removed, so a future developer reading `TenantSiteShell` (which no longer has the prop) will not expect to find `domainParam` three layers down in `SegmentTiersSection` and `ContactForm`, and may attempt to complete the "cleanup."

**Recommendation:** Add a comment in `TenantLandingPage.tsx` near the `domainParam` prop documenting that it is intentionally retained for domain-routing link construction in `SegmentTiersSection` and `ContactForm`, and is distinct from the `TenantSiteShell` removal.

---

## Finding 3 (P2): Testimonials field name transform is a seed-layer defect masked at the read path — wrong layer for the fix

**File:** `apps/web/src/lib/storefront-utils.ts:102–118`

`transformContentForSection()` maps `name → authorName` and `role → authorRole` for testimonials:

```typescript
case 'testimonials':
  if (Array.isArray(transformed.items)) {
    transformed.items = (transformed.items as Record<string, unknown>[]).map((item) => {
      const out = { ...item };
      if (out.name && !out.authorName) {
        out.authorName = out.name;
        delete out.name;
      }
      ...
    });
  }
```

The contract schema (`TestimonialsSectionSchema` in `landing-page.ts:300–301`) already defines `authorName` and `authorRole` as canonical. The seed (`macon-headshots.ts:490–507`) uses `name` and `role`. The seed is wrong; the transform papers over it.

Consequences:

1. Reading raw `SectionContent.content` JSON and validating against `TestimonialsSectionSchema` will fail — raw data has `name`/`role`.
2. AI agent writes use `authorName`/`authorRole` (schema-compliant). Seed data uses `name`/`role`. Two formats now coexist across tenants, silently unified by the transform. Divergence will grow as more tenants are seeded or as the agent creates new testimonials for existing seed-data tenants (mix within the same tenant's `items` array is possible).
3. The other transform cases in `storefront-utils.ts` are legitimate DB-to-component adapters (`items → features`, `items → images`, `backgroundImage → backgroundImageUrl`) — architectural shape mismatches. The testimonials case is different: it is a seed authoring mistake.

**Recommendation:** Fix the seed files to use `authorName`/`authorRole`. Remove the `testimonials` case from `transformContentForSection`. Add a test to `storefront-utils.test.ts` that validates a testimonials item already in canonical form passes through unmodified (currently no such test exists).

---

## Finding 4 (P3): Ghost `reveal-on-scroll` class in `CTASection.tsx` — sibling cleanup missed one file

**File:** `apps/web/src/components/tenant/sections/CTASection.tsx:31`

```tsx
<section ref={sectionRef} className="reveal-on-scroll bg-accent py-32 md:py-40">
```

`reveal-on-scroll` is not defined in `globals.css` and is not used by `useScrollReveal`. The hook works by setting `opacity: 0` inline and adding `.reveal-visible` via `IntersectionObserver`. The class is dead. Commit `24a37db7` removed this class from `TestimonialsSection.tsx` but missed `CTASection.tsx`.

**Recommendation:** Remove `reveal-on-scroll` from the `CTASection` className.

---

## Finding 5 (P3): `features` exclusion from nav is correct but the dependency between nav exclusion and anchor ID alias is undocumented

**Files:**

- `apps/web/src/components/tenant/navigation.ts:67–84`
- `apps/web/src/components/tenant/SectionRenderer.tsx:33–35`

`SECTION_TYPE_TO_ANCHOR_ID` in `SectionRenderer` maps both `features` and `services` to the anchor ID `"services"`. `SECTION_TYPE_TO_PAGE` in `navigation.ts` excludes `features`. These two maps are mutually dependent: if `features` were added to `SECTION_TYPE_TO_PAGE`, it would produce a nav link to `#services` — an anchor already occupied by `SegmentTiersSection` — causing the nav to point to the wrong element. But the two maps live in separate files with no cross-reference.

A developer adding a new section type must update both maps consistently. If they add it to `SECTION_TYPE_TO_PAGE` and assign it an anchor that conflicts with an existing DOM element, the nav produces a broken scroll target silently.

**Recommendation:** Add a cross-reference comment in each map pointing to the other. Longer term, consolidate `SECTION_TYPE_TO_ANCHOR_ID` (currently in `SectionRenderer`) into `navigation.ts` alongside `SECTION_TYPE_TO_PAGE`, so both mappings are co-located and the relationship is visible.

---

## Architecture Assessment

**Section-scan nav vs page-enabled nav:** The shift from `getNavigationItems()` (filter by `page.enabled` flag) to `getNavItemsFromHomeSections()` (scan section types on home page) is architecturally correct. Truth is now derived from what exists rather than from a flag that can drift. In `sectionsToPages()`, `page.enabled` is already derived from whether sections exist (`sortedPageMap.has(pageName)`), so the flag is vestigial for non-home pages anyway. The nav and the data are now consistent.

**Multi-page route handling:** All sub-page routes (`/t/[slug]/about`, `_domain/about`, etc.) redirect permanently to the single-page anchor via `tenant-redirect.ts`. This is the correct implementation for the committed single-page architecture.

**HowItWorksSection deletion:** Clean. `SectionRenderer.tsx:133–135` correctly maps both `features` and `services` types to `FeaturesSection`, with the `type="features"` override on the services case to satisfy TypeScript. One nuance: a `services` section on the home page has its feature items silently discarded — only `headline`/`subtitle` are extracted and passed to `SegmentTiersSection` as `servicesHeading`. If the AI agent writes features into a `services` section expecting them to render, they will not. No validation or warning exists for this case.

---

## Files Reviewed

- `apps/web/src/components/tenant/navigation.ts`
- `apps/web/src/components/tenant/TenantNav.tsx`
- `apps/web/src/components/tenant/TenantFooter.tsx`
- `apps/web/src/components/tenant/TenantSiteShell.tsx`
- `apps/web/src/components/tenant/TenantLandingPage.tsx`
- `apps/web/src/components/tenant/TenantLandingPageClient.tsx`
- `apps/web/src/components/tenant/SectionRenderer.tsx`
- `apps/web/src/components/tenant/SegmentTiersSection.tsx`
- `apps/web/src/components/tenant/ContactForm.tsx`
- `apps/web/src/components/tenant/sections/TestimonialsSection.tsx`
- `apps/web/src/components/tenant/sections/FeaturesSection.tsx`
- `apps/web/src/components/tenant/sections/CTASection.tsx`
- `apps/web/src/lib/storefront-utils.ts`
- `apps/web/src/lib/tenant-redirect.ts`
- `apps/web/src/app/t/[slug]/(site)/page.tsx`
- `apps/web/src/app/t/_domain/page.tsx`
- `apps/web/src/app/t/_domain/layout.tsx`
- `packages/contracts/src/landing-page.ts`
- `server/prisma/seeds/macon-headshots.ts`

---

---

# Architecture Strategist -- Plan Review Findings (2026-02-18)

Date: 2026-02-18
Plan: `docs/plans/2026-02-18-fix-production-storefront-hardening-plan.md`
Focus: Issue 6 — Nav derivation approach and broader architectural implications

## Summary

1 P1, 5 P2, 1 P3. The plan is sound for its stated goal but the Issue 6 nav fix has a critical factual error (anchor IDs already exist), introduces a fourth section-type mapping table without consolidating the three that exist, and embeds a semantic mismatch (`features → 'Services'` label) that will be wrong for every future "How It Works" section. The biggest architectural risk is treating the nav fix as a one-time patch rather than resolving the fundamental mismatch between the page-enabled-flag navigation design and the single-page scroll reality.

---

## Findings

### P1: Anchor IDs Already Exist — Plan's Phase 2c Premise Is Wrong

**File:** `apps/web/src/components/tenant/SectionRenderer.tsx:24-37, 151-180`

The plan states anchor `id` attributes need to be added for nav to work. They already exist. `SectionRenderer.tsx` defines `SECTION_TYPE_TO_ANCHOR_ID` and applies `id={anchorId}` to every section wrapper `<div>` in both normal and edit mode. The anchors `#about`, `#services`, `#gallery`, `#testimonials`, `#faq`, `#contact` are already rendered in the DOM.

```typescript
// Already in SectionRenderer.tsx:24-37
const SECTION_TYPE_TO_ANCHOR_ID: Record<string, string> = {
  hero: 'hero',
  text: 'about',
  about: 'about',
  features: 'services', // same mapping as the plan proposes
  services: 'services',
  // ... all others
};
```

The fix is purely in `TenantNav.tsx` — switching `getAnchorNavigationItems()` (which filters by page-level `enabled` flags) to a new function that scans `pages.home.sections`. The DOM anchor targets are not missing. Remove the claim about missing anchor IDs from Phase 2c prose before executing, or you risk adding redundant code that conflicts with the existing anchor system.

---

### P2-A: Two Nav Functions With Same Output Format Creates Dead Code Risk

**Files:** `apps/web/src/components/tenant/navigation.ts:135-147`, `apps/web/src/components/tenant/TenantNav.tsx:10, 51`

After the fix, `getAnchorNavigationItems()` will be unreferenced — `TenantNav` will import and call `getNavItemsFromHomeSections()` instead. The function will remain as misleading dead code with an actively wrong file-level docstring ("Derives navigation from PagesConfig — only enabled pages appear in nav"). Future developers will see two anchor-nav derivation functions and reach for the wrong one.

`getNavigationItems()` (the multi-page path function returning `/about`, `/services`) should also be audited — it may be dead code in the current single-page architecture.

**Action:** Delete `getAnchorNavigationItems()` in the same commit as the fix. Add `@deprecated` JSDoc if a grace period is needed. Update the file-level docstring to reflect the single-page scroll architecture.

---

### P2-B: Root Cause Is Architecture Mismatch, Not a Nav Bug — Must Be Documented

**Files:** `apps/web/src/lib/storefront-utils.ts:170-200`, `packages/contracts/src/landing-page.ts:527, 613-647`

`sectionsToPages()` correctly reports `about.enabled = false` because no `about` page entry exists in the DB — all sections have `pageName: 'home'`. The `DEFAULT_PAGES_CONFIG` explicitly documents this as the intended single-page scroll design with other pages `enabled: false`. `getAnchorNavigationItems()` was designed for a multi-page architecture that was never fully implemented.

The fix is permanent architectural alignment, not a temporary workaround: MAIS is a single-page scroll storefront. Nav derives from sections present on home, not from page-level toggles. This should be captured as a compound doc or ADR, otherwise the next developer to touch nav will reintroduce `getAnchorNavigationItems()` because the old function looks more "correct" from the naming.

Fixing seeds (moving sections to `pageName: 'about'` etc.) is not viable — `TenantLandingPage` only renders `pages.home.sections`. Moving sections to other pages would break all rendering without building a full multi-page routing system.

---

### P2-C: SECTION_TYPE_TO_PAGE Creates a Fourth Mapping Table Without Consolidation

**Files:** `apps/web/src/lib/storefront-utils.ts:26-39`, `apps/web/src/components/tenant/SectionRenderer.tsx:24-37`, `apps/web/src/components/tenant/navigation.ts` (proposed)

Three mapping tables already exist:

1. `BLOCK_TO_SECTION_TYPE` (storefront-utils.ts) — DB `UPPER_CASE` blockType → lowercase section type
2. `SECTION_TYPE_TO_ANCHOR_ID` (SectionRenderer.tsx) — section type → DOM anchor `id` value
3. Proposed `SECTION_TYPE_TO_PAGE` (navigation.ts) — section type → `PageName` for nav label lookup

Tables 2 and 3 are semantically identical. `SECTION_TYPE_TO_ANCHOR_ID` already encodes `features → 'services'`. The proposed mapping duplicates this knowledge in a fourth location.

If a new section type is added to `SECTION_TYPES` in `landing-page.ts`, a developer must now update four files with no TypeScript enforcement. `Partial<Record<string, PageName>>` means missing types silently produce no nav item — correct behavior, but invisible to the type system.

**Recommendation:** Extract `SECTION_TYPE_TO_ANCHOR_ID` from `SectionRenderer.tsx` to `navigation.ts`. Use it as the shared source of truth for both anchor ID assignment in the renderer and nav item derivation. This eliminates the duplication and keeps all section-type-to-nav mapping co-located.

---

### P2-D: `features → 'Services'` Nav Label Is Semantically Wrong for Template Redesign

**File:** `apps/web/src/components/tenant/navigation.ts` (proposed `SECTION_TYPE_TO_PAGE`)

The plan maps `features` section type to `'services'` `PageName`, producing the label "Services" in nav. For current seeds this is tolerable (Macon's FEATURES section is titled "How It Works: Schedule, Shoot, Select"). But the brainstorm (`docs/brainstorms/2026-02-18-storefront-full-template-redesign-brainstorm.md`) plans a 7-section template with both a FEATURES section ("How It Works" — process steps) and a Services section (segment tiers, auto-injected by `TenantLandingPage`). In that world, `features → 'services'` produces two items both claiming to be "Services" in the nav.

The label mismatch is also wrong today: a user clicking "Services" in the Macon nav expects pricing/offerings, not "Step 1: Schedule, Step 2: Shoot, Step 3: Select." Process steps and service offerings are different things.

**Options (must choose one before shipping):**

- Exclude `features` from `SECTION_TYPE_TO_PAGE` entirely (process steps are not nav-worthy)
- Map `features` to a new nav concept separate from `'services'` (requires adding a non-`PageName` entry, or a new `PageName`)
- Use the section's actual `headline` field as nav label rather than a static page-name label

The safest option for this fix: exclude `features` from the mapping. Macon nav becomes: Home | About | Testimonials | Contact — still correct, and avoids the semantic mismatch.

---

### P2-E: Proposed Nav Function's Section Inclusion Conflicts With Phase 3 Brainstorm

**File:** `apps/web/src/components/tenant/TenantNav.tsx` (proposed usage), `docs/brainstorms/2026-02-18-storefront-full-template-redesign-brainstorm.md`

The brainstorm specifies a curated nav: `Home | Services | About | FAQ | Book Now`. It does NOT include Testimonials or Contact. The proposed `getNavItemsFromHomeSections()` would include testimonials and contact sections because they exist in the home sections array.

The brainstorm also specifies section order: Hero → How It Works → Services → About → Testimonials → FAQ → CTA. The nav items derived from this order would appear as: About | Services | Testimonials | FAQ | Contact — but the desired nav order is Services | About | FAQ (no Testimonials, no Contact).

The proposed implementation iterates sections in array order and includes all mapped types. This produces a different nav than the Phase 3 template intends. Deciding which sections appear in nav (and in what order) needs to be explicit, not emergent from section order.

**Action before Phase 3:** Add a `NAV_EXCLUDED_SECTION_TYPES` set (containing at minimum `hero`, `cta`) and consider excluding `testimonials` and `contact` as well. Make this an explicit list rather than an emergent property of which sections happen to be present.

---

### P3: `getAnchorNavigationItems()` Must Be Deleted in the Same Commit

**File:** `apps/web/src/components/tenant/navigation.ts:135-147`

Per Pitfall #14 (orphan imports after deletions) and the project's "No Debt" principle: after `TenantNav.tsx` switches to `getNavItemsFromHomeSections()`, `getAnchorNavigationItems()` must be deleted — not left as dead code. It must be removed in the same commit as the fix. If left, future search results will surface it as the "correct" function since its name is more descriptive than the new one.

---

## Architectural Summary

The `getNavItemsFromHomeSections()` approach is architecturally correct for a single-page scroll storefront. The execution needs these adjustments before merging:

1. Remove the false claim about missing anchor IDs from Phase 2c prose
2. Delete `getAnchorNavigationItems()` in the same commit
3. Consolidate `SECTION_TYPE_TO_ANCHOR_ID` (SectionRenderer) into `navigation.ts` to eliminate the fourth mapping table
4. Decide whether `features` maps to "Services" nav item — it does not for the Phase 3 template
5. Add explicit `NAV_EXCLUDED_SECTION_TYPES` rather than relying on emergent section inclusion
6. Compound-doc this as the definitive architectural decision: single-page scroll = nav from home sections, not page-level flags

---

---

# Architecture Strategist -- Plan Review Findings (2026-02-12)

Date: 2026-02-12
Plan: `docs/plans/2026-02-11-feat-onboarding-conversation-redesign-plan.md`
Design Spec: `docs/architecture/ONBOARDING_CONVERSATION_DESIGN.md`

## Summary

- **P1: 6 findings** (data loss risk, migration gaps, breaking-change ordering)
- **P2: 8 findings** (incomplete FK accounting, Stripe metadata gaps, entity cleanup)
- **P3: 4 findings** (minor omissions, test coverage, naming)

Total: **18 findings**

---

## Findings

### P1-01: Webhook Processor Hardcodes `packageId` in Stripe Session Metadata -- No Dual-ID Transition Plan for In-Flight Checkouts

**Phase:** 6c / 7
**Description:** The plan's Risk Analysis (line 981) correctly identifies the Stripe dual-ID problem and proposes a helper `const tierId = metadata.tierId ?? await lookupTierByPackageId(metadata.packageId)`. However, the plan does NOT include `webhook-processor.ts` in any phase's "Files to modify" list. This file (`server/src/jobs/webhook-processor.ts`) is the actual consumer of Stripe session metadata. It has a Zod schema `StripeSessionSchema` that _requires_ `packageId` (line 37: `packageId: z.string()`). Without updating this file, ANY booking completed after Phase 6c (which starts writing `tierId` to metadata) but before Phase 7 will fail Zod validation and silently drop the webhook.

Additionally, `wedding-booking.orchestrator.ts` writes `packageId: pkg.id` to Stripe metadata (line 89). This must be changed to write `tierId` instead, but the plan only lists this file under Phase 6c for "Accept tierId" without specifying the metadata rewrite.

**Evidence:**

- `server/src/jobs/webhook-processor.ts:37` -- `packageId: z.string()` (required, not optional)
- `server/src/services/wedding-booking.orchestrator.ts:89` -- `packageId: pkg.id` in metadata
- `server/src/services/booking.service.ts:607` -- `getPackageByIdWithAddOns(tenantId, input.packageId)` in `onPaymentCompleted`

**Suggested Fix:**

1. Add `webhook-processor.ts` to Phase 6c's file list explicitly.
2. Phase 6c must: (a) Update `StripeSessionSchema` to accept `tierId OR packageId`, (b) Update `MetadataSchema` to accept both, (c) Add `lookupTierByPackageId` helper, (d) Update `processNewBooking` to resolve tierId.
3. Phase 6c must also update `wedding-booking.orchestrator.ts` to write `tierId` (not `packageId`) to Stripe metadata.
4. Phase 6c must update `booking.service.ts:onPaymentCompleted` to accept `tierId` instead of `packageId` and fetch Tier instead of Package.
5. Consider a 48-hour "dual metadata" window where BOTH `packageId` and `tierId` are written.

---

### P1-02: `onPaymentCompleted` and `confirmChatbotBooking` Depend on Package Entity -- Not Listed for Migration

**Phase:** 6c / 7
**Description:** `BookingService.onPaymentCompleted()` (line 607) calls `catalogRepo.getPackageByIdWithAddOns()` and `BookingService.confirmChatbotBooking()` (line 281) calls `catalogRepo.getPackageById()`. These are the core payment completion paths. The plan mentions updating `booking.service.ts` in Phase 6c but only says "Accept tierId, look up Tier for pricing" without addressing:

1. `onPaymentCompleted` creates a `Booking` entity with `packageId: pkg.id` (line 665)
2. `confirmChatbotBooking` uses `catalogRepo.getPackageById` and `catalogRepo.getAddOnsByPackageId`
3. The BookingPaid event payload includes `packageTitle` -- will need `tierTitle`

The `Booking` entity interface itself (`server/src/lib/entities.ts:58`) has `packageId: string | null` with no `tierId` field. The `CreateBookingInput` interface (line 107) has `packageId: string` as required.

**Evidence:**

- `server/src/lib/entities.ts:58` -- `packageId: string | null` (no tierId)
- `server/src/lib/entities.ts:107` -- `CreateBookingInput.packageId: string` (required)
- `server/src/services/booking.service.ts:607-665` -- Full Package dependency chain in onPaymentCompleted
- `server/src/services/booking.service.ts:281-284` -- confirmChatbotBooking Package lookups
- `server/src/lib/core/events.ts` -- `BookingEvents.PAID` payload includes `packageTitle`

**Suggested Fix:**

1. Add `server/src/lib/entities.ts` to Phase 6c's file list -- add `tierId` to Booking and CreateBookingInput entities.
2. Add `server/src/lib/ports.ts` to Phase 6c's file list -- CatalogRepository needs Tier query methods (getTierById, getTierBySlug, etc.) or a new TierRepository port.
3. Add `server/src/lib/core/events.ts` to the file list -- update BookingPaid event payload type.
4. The entire `CatalogRepository` port interface is Package-centric (17+ Package methods). Plan must decide: extend CatalogRepository with Tier methods, or create TierRepository port. This is a significant interface change not accounted for.

---

### P1-03: `CatalogRepository` Port and `PrismaCatalogRepository` Adapter Are Entirely Package-Centric -- Complete Rewrite Needed

**Phase:** 6c / 7
**Description:** `server/src/lib/ports.ts` defines `CatalogRepository` with 17+ Package-specific methods (getAllPackages, getPackageBySlug, getPackageById, createPackage, updatePackage, deletePackage, getPackagesBySegment, getAllPackagesWithDrafts, saveDraft, publishDrafts, discardDrafts). The plan mentions creating `tier.service.ts` (Phase 4) but does not mention:

1. A `TierRepository` port interface in `ports.ts`
2. A `PrismaTierRepository` adapter in `server/src/adapters/prisma/`
3. Updating `CatalogService` (which wraps CatalogRepository) to support Tier operations

The plan lists `catalog.service.ts` only for Phase 7 ("Remove Package methods, keep Tier/Segment") but the Tier methods don't exist yet. They need to be ADDED in Phase 4 (when agent tools start managing tiers) and the repo/adapter layer needs to exist before the service layer.

**Evidence:**

- `server/src/lib/ports.ts` -- 17+ Package methods, 0 Tier methods
- `server/src/adapters/prisma/catalog.repository.ts` -- implements Package queries
- `server/src/services/catalog.service.ts` -- wraps CatalogRepository for Package operations
- Phase 4 creates `tier.service.ts` but has no repo/adapter layer
- Phase 4a backend API endpoints reference Tier CRUD but have no persistence layer

**Suggested Fix:**

1. Add Phase 4 sub-task: Create `ITierRepository` port in `ports.ts` (or extend CatalogRepository).
2. Add Phase 4 sub-task: Create `PrismaTierRepository` adapter implementing the port.
3. `tier.service.ts` should depend on the repository port (not direct Prisma calls) to maintain the layered architecture pattern.
4. Register `PrismaTierRepository` in DI container (`di.ts`).
5. This is a prerequisite for Phase 4a/4b agent tools.

---

### P1-04: Tenant Model Missing `tiers` Relation -- Schema Will Fail Validation

**Phase:** 1
**Description:** The plan's Phase 1 schema adds `tenantId` to Tier with a `tenant Tenant @relation(...)` back-reference. However, the current Tenant model (schema.prisma line 37-155) does NOT have a `tiers Tier[]` relation array. Prisma requires both sides of a relation to be declared. The plan's schema snippet shows the Tier side but does not mention adding `tiers Tier[]` to the Tenant model.

Similarly, the plan adds `TierAddOn` model but doesn't mention adding `tiers TierAddOn[]` to the AddOn model. The current AddOn model (line 411-434) has `packages PackageAddOn[]` but no `tiers TierAddOn[]`.

**Evidence:**

- `server/prisma/schema.prisma:37-155` -- Tenant model has `packages Package[]` (line 128) but no `tiers Tier[]`
- `server/prisma/schema.prisma:411-434` -- AddOn model has `packages PackageAddOn[]` (line 427) but no `tiers TierAddOn[]`
- Plan Phase 1 snippet shows `AddOn { tiers TierAddOn[] }` but doesn't show the Tenant-side change

**Suggested Fix:**

1. Phase 1 must explicitly add `tiers Tier[]` to the Tenant model.
2. Phase 1 must explicitly add `tiers TierAddOn[]` to the AddOn model.
3. Add these to the Phase 1 acceptance criteria: "Tenant model has tiers relation", "AddOn model has tiers relation".

---

### P1-05: OnboardingPhase Enum Change in Phase 3 is a Breaking Migration Without Data-First Strategy

**Phase:** 3
**Description:** Phase 3 simplifies `OnboardingPhase` from 7 values (NOT_STARTED, DISCOVERY, MARKET_RESEARCH, SERVICES, MARKETING, COMPLETED, SKIPPED) to 4 values (NOT_STARTED, BUILDING, COMPLETED, SKIPPED). PostgreSQL cannot simply remove enum values from an existing enum type. The plan's Phase 7 migration script (line 689) has `UPDATE "Tenant" SET "onboardingPhase" = 'NOT_STARTED' WHERE ...` to reset intermediate phases, but this is in Phase 7, not Phase 3.

Phase 3 attempts to change the enum definition BUT Phase 7 is where the data migration happens. If Phase 3 is deployed without first migrating the data, any tenant currently in DISCOVERY/MARKET_RESEARCH/SERVICES/MARKETING state will cause a PostgreSQL constraint violation when the enum is altered.

Furthermore, `packages/contracts/src/schemas/onboarding.schema.ts` has a comprehensive OnboardingPhaseSchema, discriminated unions, event type schemas (DISCOVERY_STARTED, DISCOVERY_COMPLETED, MARKET_RESEARCH_STARTED, etc.), and command schemas that ALL reference the old phases. The plan lists this file nowhere.

**Evidence:**

- `server/prisma/schema.prisma:1024-1032` -- Current enum has DISCOVERY, MARKET_RESEARCH, SERVICES, MARKETING
- `packages/contracts/src/schemas/onboarding.schema.ts:22-30` -- Zod schema mirrors old enum
- `packages/contracts/src/schemas/onboarding.schema.ts:367-374` -- Event types reference old phases
- `packages/contracts/src/schemas/onboarding.schema.ts:539-542` -- Command types reference old phases
- Phase 3 changes enum, Phase 7 migrates data -- wrong order

**Suggested Fix:**

1. Move the `UPDATE "Tenant"` data migration from Phase 7 to Phase 3 (before enum alteration).
2. Phase 3 migration must: (a) Update all rows to valid new values FIRST, (b) Then alter the enum.
3. Add `packages/contracts/src/schemas/onboarding.schema.ts` to Phase 3's file list.
4. The onboarding schema has ~550 lines of phase-aware discriminated unions, event schemas, and command schemas that must be simplified to match the new 4-value enum. This is a significant refactor not accounted for.
5. Check all 46 files that reference OnboardingPhase (per grep results) for compatibility.

---

### P1-06: Phase 3 Deletes Slot Machine Before Phase 4 Creates Replacement Tools -- Broken Intermediate State

**Phase:** 3 / 4
**Description:** Phase 3 deletes `slot-machine.ts` and removes `computeSlotMachine()` from `discovery.service.ts`. It also removes auto-fire research from `storeFact()`. However, Phase 4 is where the NEW agent tools (`manage_segments`, `manage_tiers`, `manage_addons`) are created. Between Phase 3 and Phase 4, the tenant-agent has:

- No slot machine (deleted)
- No segment/tier/addon tools (not yet created)
- The old `manage_packages` tool still exists (deleted in Phase 4)
- The system prompt still references slot machine protocol (rewritten in Phase 5)

This means the system is in a broken state between Phase 3 and Phase 5. The agent cannot onboard tenants because:

1. `store_discovery_fact` returns no nextAction (slot machine removed)
2. No segment/tier tools exist
3. System prompt references tools that don't exist yet

**Evidence:**

- Phase 3: Deletes `slot-machine.ts`, simplifies `storeFact()`
- Phase 4: Creates `manage_segments`, `manage_tiers`, `manage_addons`
- Phase 5: Rewrites system prompt
- Between phases, agent is in inconsistent state

**Suggested Fix:**

1. Merge Phases 3, 4, and 5 into a single atomic phase (or at minimum, deploy them together as one release).
2. Alternatively, keep the slot machine operational until Phase 4+5 are ready, then delete it as part of the same deployment.
3. The "delete old before building new" approach violates the principle of maintaining backward compatibility at each phase boundary.

---

### P2-01: 47 Frontend Files Reference Package/packageId -- Plan Lists Only ~12

**Phase:** 6
**Description:** Grep found 47 files in `apps/web/src/` that reference `Package` or `packageId`. The plan's Phase 6 lists approximately 12 files for modification. Major unlisted files include:

- `apps/web/src/lib/api.ts` -- API client functions for Package CRUD
- `apps/web/src/lib/packages.ts` -- Package utility functions
- `apps/web/src/lib/tenant.ts` -- Tenant data normalization (Package references)
- `apps/web/src/lib/tenant.client.ts` -- Client-side tenant data
- `apps/web/src/components/booking/DateBookingWizard.tsx` -- Booking wizard
- `apps/web/src/hooks/usePhotoUpload.ts` -- Photo upload (Package photos)
- `apps/web/src/components/admin/BookingsList.tsx` -- Admin booking list
- `apps/web/src/app/(protected)/tenant/dashboard/page.tsx` -- Dashboard
- `apps/web/src/app/(protected)/tenant/website/page.tsx` -- Website editor
- `apps/web/src/components/dashboard/DashboardView.tsx` -- Dashboard view
- Multiple home page components with demo content referencing packages

**Evidence:** `grep -r "Package\|packageId" apps/web/src/ --files-with-matches` returns 47 files. Plan Phase 6 covers ~12.

**Suggested Fix:**

1. Run comprehensive grep before starting Phase 6 and create exhaustive file list.
2. Categorize files into: (a) Must change for functionality, (b) Display-only references (rename Package->Tier in UI text), (c) Demo/marketing content (lower priority).
3. Add `apps/web/src/lib/packages.ts` deletion to Phase 7.
4. Add `apps/web/src/lib/api.ts` update to Phase 6 (API client).

---

### P2-02: 18 Backend Service Files Reference Package/packageId -- Several Not Listed

**Phase:** 6c / 7
**Description:** Grep found 18 service files referencing Package/packageId. Several are not in any phase's file list:

- `server/src/services/commission.service.ts` -- Calculates commission, may reference Package
- `server/src/services/tenant-provisioning.service.ts` -- Creates initial packages at signup
- `server/src/services/tenant-onboarding.service.ts` -- Onboarding phase transitions
- `server/src/services/appointment-booking.service.ts` -- Listed in Phase 6c but not detailed
- `server/src/services/reminder.service.ts` -- Sends reminders with Package title
- `server/src/services/idempotency.service.ts` -- Key generation includes packageId
- `server/src/services/upload.service.ts` -- Package photo uploads

Of particular concern: `tenant-provisioning.service.ts` creates seed packages during tenant signup. After Phase 7 deletes the Package model, this will crash at signup. The plan mentions `build_first_draft` updating for "seed tier check" in Phase 4 but does NOT list `tenant-provisioning.service.ts` for modification.

**Evidence:** `grep -r "packageId\|Package" server/src/services/ --files-with-matches` returns 18 files.

**Suggested Fix:**

1. Add `tenant-provisioning.service.ts` to Phase 4 or Phase 6c -- must create seed Tiers instead of seed Packages.
2. Add `reminder.service.ts` to Phase 6c -- update to fetch Tier title for reminder emails.
3. Add `commission.service.ts` review to Phase 6c.
4. Run comprehensive grep as a pre-phase checklist for each phase.

---

### P2-03: `BookingService.getAllPlatformBookings` Includes Package in Query -- Will Break After Package Deletion

**Phase:** 7
**Description:** `BookingService.getAllPlatformBookings()` (line 410-444) does `include: { package: { select: { name: true } } }` in a Prisma query. After Phase 7 deletes the Package model, this query will fail with a Prisma error. The return type also includes `packageName?: string` and `packageId: string | null`.

This method is used by the PlatformAdminController for the admin dashboard.

**Evidence:**

- `server/src/services/booking.service.ts:431-433` -- `package: { select: { name: true } }`
- `server/src/services/booking.service.ts:456` -- `packageId: b.packageId`
- `server/src/services/booking.service.ts:474` -- `packageName: b.package?.name`

**Suggested Fix:**

1. Add `getAllPlatformBookings` update to Phase 6c -- change to include `tier` instead of `package`.
2. Update return type to include `tierName` instead of `packageName`.
3. Update `PlatformAdminController` if it renders package information.

---

### P2-04: 11 Route Files Reference Package -- Several Not in Plan

**Phase:** 6c / 7
**Description:** Grep found 11 route files referencing Package/packageId. Some are missing from the plan:

- `server/src/routes/index.ts` -- Route registration (Package routes)
- `server/src/routes/internal-agent-booking.routes.ts` -- Agent booking routes
- `server/src/routes/tenant-admin.routes.ts` -- Tenant admin panel routes
- `server/src/routes/public-date-booking.routes.ts` -- Public booking routes
- `server/src/routes/segments.routes.ts` -- Segment routes (may reference Package)
- `server/src/routes/public-booking-management.routes.ts` -- Booking management
- `server/src/routes/dev.routes.ts` -- Dev routes (line 60: `onPaymentCompleted` with packageId)

**Evidence:** `grep -r "packageId\|Package" server/src/routes/ --files-with-matches` returns 11 files.

**Suggested Fix:**

1. Add `server/src/routes/index.ts` to Phase 7 -- deregister Package routes.
2. Add `server/src/routes/public-date-booking.routes.ts` to Phase 6c -- accept tierId.
3. Add `server/src/routes/dev.routes.ts` to Phase 6c -- update test helper.
4. Review all 11 route files for Package references.

---

### P2-05: Booking Confirmation Emails Reference `packageTitle` -- Not Addressed

**Phase:** 6c
**Description:** The plan's risk table (line 992) identifies "Booking confirmation emails reference Package name" as P2, but provides no mitigation in any phase. The email system uses `BookingEvents.PAID` event payload which includes `packageTitle`. The `PostmarkMailAdapter.sendBookingConfirm()` renders this in the email template.

The `booking-tokens.ts` file in the server likely also references Package for email token generation.

**Evidence:**

- `server/src/services/booking.service.ts:298` -- emits `packageTitle` in PAID event
- `server/src/services/booking.service.ts:737` -- emits `packageTitle` in PAID event
- `server/src/di.ts:657` -- subscribes to PAID event, calls `mailProvider.sendBookingConfirm` with `packageTitle`
- `server/src/adapters/postmark.adapter.ts` -- references packageTitle/confirmEmail

**Suggested Fix:**

1. Phase 6c must update event payload to emit `tierTitle` (or `serviceName` generically).
2. Update `PostmarkMailAdapter.sendBookingConfirm()` to use new field name.
3. Update email templates if they contain "package" copy.
4. Add to Phase 6c acceptance criteria: "Confirmation emails reference tier name, not package name."

---

### P2-06: DI Container Has `PackageDraftService` and `PackagesController` -- Not Listed for Removal Until Phase 7

**Phase:** 4 / 7
**Description:** The DI container (`server/src/di.ts`) registers `PackageDraftService` (line 24, 99, 269, 615) and `PackagesController` (line 35, 298, 748). The plan lists DI cleanup in Phase 7 but the Container interface type (`services.packageDraft: PackageDraftService`, `controllers.packages: PackagesController`) must be updated too. If Phase 4 deletes `manage_packages` agent tool and Phase 7 deletes the Package model, but the DI container still instantiates `PackageDraftService` with `CatalogRepository` Package methods, there will be orphaned service registrations.

Additionally, the plan should add a new `TierService` to the DI container in Phase 4 when `tier.service.ts` is created.

**Evidence:**

- `server/src/di.ts:24` -- imports PackageDraftService
- `server/src/di.ts:35` -- imports PackagesController
- `server/src/di.ts:99` -- `packageDraft: PackageDraftService` in Container interface
- Container type requires `controllers.packages` and `services.packageDraft`

**Suggested Fix:**

1. Phase 4 should register `TierService` in the DI container.
2. Phase 7 should remove `PackageDraftService` and `PackagesController` from DI.
3. Phase 7 should update the `Container` interface type to remove Package references.
4. Consider adding `TierRepository` to `repositories` in the Container type.

---

### P2-07: Customer Agent `recommend_package` Tool and `get_services` Query Package Table -- Phase 8 May Be Insufficient

**Phase:** 8
**Description:** The customer agent has a `recommend_package` tool (line 221-249 in booking.ts) that explicitly references "Package" in its name and calls `/recommend` endpoint. The `get_services` tool (line 66-91) calls `/services` which may query the Package table depending on the backend route. The plan's Phase 8 says "Update package browsing tools to use Tier" but doesn't detail:

1. Renaming `recommend_package` to `recommend_tier` (or removing it)
2. What the `/services`, `/service-details`, and `/recommend` endpoints actually query
3. Whether the customer agent's `internal-agent-booking.routes.ts` needs updating

The customer agent's system prompt (line 64-65) says "Package Recommendations: Suggest services based on customer needs" -- still uses Package terminology.

**Evidence:**

- `server/src/agent-v2/deploy/customer/src/tools/booking.ts:221` -- `recommend_package` tool
- `server/src/agent-v2/deploy/customer/src/tools/booking.ts:37-38` -- `RecommendPackageParams`
- `server/src/agent-v2/deploy/customer/src/prompts/system.ts:64` -- "Package Recommendations"
- `server/src/routes/internal-agent-booking.routes.ts` -- Backend for customer agent

**Suggested Fix:**

1. Phase 8 must explicitly list ALL customer agent tool files and rename `recommend_package` to `recommend_tier`.
2. Phase 8 must update `internal-agent-booking.routes.ts` to query Tiers instead of Packages.
3. Phase 8 must update customer agent system prompt to use Tier/Segment terminology.
4. Add `server/src/routes/internal-agent-booking.routes.ts` to Phase 8 file list.

---

### P2-08: No `301 Redirect` Implementation Details for `/book/[packageSlug]` URLs

**Phase:** 6a
**Description:** Open Question #1 (line 919) recommends adding 301 redirects from `/book/[packageSlug]` to `/book/[tierSlug]` using a "slug mapping table" with 90-day lifetime. However:

1. No phase includes creating this redirect mechanism.
2. No "slug mapping table" is defined in any schema change.
3. The plan renames the Next.js pages from `[packageSlug]` to `[tierSlug]` (Phase 6a) but doesn't implement the redirect middleware.
4. Any existing bookmarked URLs, shared links, or Google-indexed booking pages will 404.

**Evidence:**

- `apps/web/src/app/t/[slug]/book/[packageSlug]/page.tsx` -- Current page
- `apps/web/src/app/t/_domain/book/[packageSlug]/page.tsx` -- Domain-based route
- Plan Phase 6a renames to `[tierSlug]` but no redirect implementation

**Suggested Fix:**

1. Add a redirect sub-task to Phase 6a: Create Next.js middleware or catch-all route that redirects `/book/[packageSlug]` to `/book/[tierSlug]` using the `sourcePackageId` join (while it exists) or a lightweight slug-mapping cache.
2. Alternatively, keep BOTH route segments (`[packageSlug]` and `[tierSlug]`) active during transition, with the old one doing a 301 redirect.
3. Add TTL-based cleanup (90 days) for the redirect routes.

---

### P3-01: `contracts/src/dto.ts` and `contracts/src/api.v1.ts` Reference Package -- Not Listed in Phases 1-6

**Phase:** 6 / 7
**Description:** The plan mentions deleting PackageDto in Phase 7 but `packages/contracts/src/api.v1.ts` and `packages/contracts/src/dto.ts` likely define Package-related API contract types used by the frontend. These files need TierDto additions in Phase 1 (when schema changes) and Package removals in Phase 7.

The plan lists `dto.ts` in Phase 1 ("Add TierDto with new fields") and Phase 7 ("Delete PackageDto, CreatePackageDto, UpdatePackageDto") but does NOT list `api.v1.ts` which contains the ts-rest contract definitions that both frontend and backend consume.

**Evidence:**

- `packages/contracts/src/dto.ts` -- Referenced but only for Phase 1 and Phase 7
- `packages/contracts/src/api.v1.ts` -- Not listed in any phase but likely has Package routes
- `packages/contracts/src/landing-page.ts` -- References Package per grep

**Suggested Fix:**

1. Phase 1: Add TierDto and Tier-related contract routes to `api.v1.ts`.
2. Phase 6: Update API contract routes to use Tier endpoints.
3. Phase 7: Remove Package contract routes from `api.v1.ts`.
4. Add `packages/contracts/src/landing-page.ts` review to Phase 6.

---

### P3-02: `section-blueprint.schema.ts` Has `SEED_PACKAGE_NAMES` -- Listed for Phase 7 But Needed Earlier

**Phase:** 3 / 4
**Description:** `packages/contracts/src/schemas/section-blueprint.schema.ts` contains `SEED_PACKAGE_NAMES` which are used during tenant provisioning to create initial packages. The plan lists removing this in Phase 7, but if Phase 4's `build_first_draft` tool is updated to use tiers instead of packages, the seed logic needs to change at that point, not in Phase 7.

**Evidence:**

- Plan Phase 7: "Remove `SEED_PACKAGE_NAMES`"
- Plan Phase 4: "`build_first_draft` -- Replace seed package cleanup with seed tier check"

**Suggested Fix:**

1. Move `SEED_PACKAGE_NAMES` removal (or replacement with `SEED_TIER_NAMES`) to Phase 4.
2. Ensure `build_first_draft` has the new seed tier names available when it's updated.

---

### P3-03: Tier `@@unique([tenantId, slug])` May Conflict With Segment-Scoped Slugs

**Phase:** 1
**Description:** The plan defines `@@unique([tenantId, slug])` on Tier (Phase 1, line 153). This means a tenant cannot have two tiers with the same slug across different segments. For example, a photographer with segments "Weddings" and "Portraits" cannot have a tier called "essential" in both segments because the slug "essential" would be unique per tenant.

This may be too restrictive. A per-segment slug uniqueness (`@@unique([segmentId, slug])`) would be more appropriate since tiers are nested under segments.

**Evidence:**

- Plan Phase 1, line 153: `@@unique([tenantId, slug])`
- Plan Phase 1, line 152: `@@unique([segmentId, sortOrder])` -- sortOrder is correctly per-segment

**Suggested Fix:**

1. Change `@@unique([tenantId, slug])` to `@@unique([segmentId, slug])` for tier slugs.
2. Update booking URL pattern to include segment context: `/book/[segmentSlug]/[tierSlug]` instead of just `/book/[tierSlug]`.
3. If flat `/book/[tierSlug]` is desired, keep `@@unique([tenantId, slug])` but document that tier slugs must be globally unique per tenant (e.g., "weddings-essential", "portraits-essential").

---

### P3-04: Missing Test Strategy for Phased Rollout

**Phase:** 9
**Description:** Phase 9 mentions E2E smoke tests and a constants drift test, but does not define unit test expectations for the new services and tools introduced in Phases 2-5. Given that:

1. `tier.service.ts` is a NEW service (Phase 4)
2. Three new agent tools are created (Phase 4b)
3. `discovery.service.ts` is significantly modified (Phase 3)
4. `context-builder.service.ts` is modified (Phase 3)
5. `onboarding.schema.ts` is rewritten (Phase 3)

There is no mention of unit tests for these changes. The existing `discovery.service.test.ts` and `slot-machine.test.ts` will need updates or replacements.

**Evidence:**

- Plan Phase 9 mentions E2E tests but no unit test requirements
- Existing `server/src/services/discovery.service.test.ts` -- will break after Phase 3 changes
- Existing `server/src/lib/slot-machine.test.ts` -- deleted in Phase 3, no replacement

**Suggested Fix:**

1. Each phase should have a "Tests" section alongside "Files to modify".
2. Phase 3: Update `discovery.service.test.ts`, create lightweight state tracker tests.
3. Phase 4: Create `tier.service.test.ts`, agent tool unit tests.
4. Phase 5: Agent prompt regression tests (conversation simulation).
5. Add to acceptance criteria: "Unit tests written for all new services and modified services."

---

## Phase Ordering Assessment

### Current Order

```
Phase 1: Schema changes (additive)
Phase 2: Signup form
Phase 3: Delete slot machine + state tracker
Phase 4: New agent tools
Phase 5: System prompt rewrite
Phase 6: Frontend migration
Phase 7: Package deletion + data migration
Phase 8: Customer agent updates
Phase 9: Deployment
```

### Issues

1. **Phases 3-4-5 must be atomic** (P1-06): Deploying Phase 3 without 4+5 breaks onboarding entirely.
2. **Phase 3 needs Phase 7's data migration** (P1-05): Enum change needs data-first migration.
3. **Phase 6c needs webhook-processor** (P1-01): Not listed but critical for payment flow.
4. **Phase 4 needs repository layer** (P1-03): Agent tools need persistence before they can work.

### Suggested Reordering

```
Phase 1: Schema changes (additive) -- KEEP
Phase 2: Signup form -- KEEP
Phase 3+4+5: MERGE into single phase -- Delete slot machine + Create tools + Rewrite prompt (atomic deploy)
  - Sub-phase 3a: Onboarding data migration (reset intermediate phases BEFORE enum change)
  - Sub-phase 3b: Schema enum change
  - Sub-phase 3c: Create TierRepository port + adapter + service
  - Sub-phase 3d: Delete slot machine, create agent tools, rewrite prompt
Phase 6: Frontend + backend migration (expanded file list per P2-01 through P2-05)
  - Must include webhook-processor.ts, entities.ts, ports.ts, events.ts
Phase 7: Package deletion (expanded file list per P2-02, P2-04, P2-06)
Phase 8: Customer agent updates (expanded per P2-07)
Phase 9: Deployment + testing
```

### Parallelization Opportunities

- Phase 1 and Phase 2 can be parallelized (independent: schema vs frontend form).
- Within Phase 6, frontend and backend changes are somewhat coupled but 6a (booking pages) and 6b (storefront) can be parallelized.
- Phase 8 can start as soon as Phase 4's Tier tools exist (doesn't need Phase 5 or 6).

---

## Schema Gap Analysis: Current vs Plan

| Field/Feature             | Current Schema           | Plan Target             | Gap                         |
| ------------------------- | ------------------------ | ----------------------- | --------------------------- |
| Tier.tenantId             | Missing                  | Required                | Phase 1 adds                |
| Tier.slug                 | Missing                  | Required                | Phase 1 adds                |
| Tier.bookingType          | Missing                  | Required                | Phase 1 adds                |
| Tier.active               | Missing                  | Required                | Phase 1 adds                |
| Tier.priceCents (Int)     | `price Decimal(10,2)`    | `priceCents Int`        | Phase 1 changes type + name |
| Tier.sortOrder            | Missing (uses TierLevel) | Required                | Phase 1 replaces enum       |
| Tier.photos               | Missing                  | Required (from Package) | Phase 1 adds                |
| Tier.depositPercent       | Missing                  | Required                | Phase 1 adds                |
| TierLevel enum            | Exists                   | Deleted                 | Phase 1 removes             |
| TierAddOn join table      | Missing                  | Required                | Phase 1 creates             |
| Booking.tierId            | Missing                  | Required (nullable)     | Phase 1 adds                |
| Tenant.brainDump          | Missing                  | Required                | Phase 1 adds                |
| Tenant.city               | Missing                  | Required                | Phase 1 adds                |
| Tenant.state              | Missing                  | Required                | Phase 1 adds                |
| **Tenant.tiers relation** | **Missing**              | **Required**            | **NOT in plan (P1-04)**     |
| **AddOn.tiers relation**  | **Missing**              | **Required**            | **NOT in plan (P1-04)**     |
| OnboardingPhase enum      | 7 values                 | 4 values                | Phase 3 changes             |
| Booking.packageId         | Required                 | Dropped (Phase 7)       | Phase 7 removes             |
| Package model             | Exists                   | Deleted                 | Phase 7 removes             |
| PackageAddOn              | Exists                   | Deleted                 | Phase 7 removes             |

### Tier Column Migration Map (Current -> Plan)

| Current Column                   | Action  | Plan Column                                |
| -------------------------------- | ------- | ------------------------------------------ |
| `level TierLevel`                | REPLACE | `sortOrder Int` (GOOD=1, BETTER=2, BEST=3) |
| `name String`                    | KEEP    | `name String`                              |
| `description String?`            | KEEP    | `description String?`                      |
| `price Decimal(10,2)`            | REPLACE | `priceCents Int` (multiply by 100)         |
| `currency String`                | KEEP    | `currency String`                          |
| `features Json`                  | KEEP    | `features Json`                            |
| `durationMinutes Int?`           | KEEP    | `durationMinutes Int?`                     |
| `depositPercent Int?`            | KEEP    | `depositPercent Int?`                      |
| (missing)                        | ADD     | `tenantId String`                          |
| (missing)                        | ADD     | `slug String`                              |
| (missing)                        | ADD     | `bookingType BookingType`                  |
| (missing)                        | ADD     | `active Boolean`                           |
| (missing)                        | ADD     | `photos Json`                              |
| `segmentId` + `segment` relation | KEEP    | Same                                       |
| `createdAt` / `updatedAt`        | KEEP    | Same                                       |
| `@@unique([segmentId, level])`   | REPLACE | `@@unique([segmentId, sortOrder])`         |

**Note:** The plan's Phase 1 migration must handle the `price Decimal(10,2) -> priceCents Int` conversion carefully. Existing Tier rows have decimal prices (e.g., 350.00). The migration must multiply by 100 and cast to integer. This conversion is NOT explicitly mentioned in the plan's migration step.

---

## Package Deletion FK Reference Audit

Models with direct FK to Package (must be resolved before Phase 7 DROP):

| Model        | FK Column          | Current onDelete                | Plan Resolution                                        |
| ------------ | ------------------ | ------------------------------- | ------------------------------------------------------ |
| Booking      | packageId          | (implicit)                      | Phase 1: Add tierId. Phase 7: Migrate + drop packageId |
| PackageAddOn | packageId          | Cascade                         | Phase 7: Drop table after migrating to TierAddOn       |
| Segment      | packages Package[] | Cascade (via Package.segmentId) | Phase 7: Remove relation                               |
| Tenant       | packages Package[] | Cascade (via Package.tenantId)  | Phase 7: Remove relation                               |

Code references to Package (files that import/use Package types):

| Layer       | File Count                 | Status in Plan         |
| ----------- | -------------------------- | ---------------------- |
| Entities    | 1 (entities.ts)            | NOT listed             |
| Ports       | 1 (ports.ts)               | NOT listed             |
| Adapters    | 1+ (catalog.repository.ts) | Listed in Phase 7      |
| Services    | 18 files                   | ~5 listed, 13 missing  |
| Routes      | 11 files                   | ~4 listed, 7 missing   |
| Agent tools | 5+ files                   | Listed                 |
| Frontend    | 47 files                   | ~12 listed, 35 missing |
| Contracts   | 6 files                    | ~2 listed, 4 missing   |
| Tests       | Multiple                   | Partially listed       |

**Total Package reference surface area: ~90+ files. Plan explicitly lists ~25.**
