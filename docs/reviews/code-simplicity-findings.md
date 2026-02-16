# Code Simplicity -- Plan Review Findings

**Plan:** `docs/plans/2026-02-11-feat-onboarding-conversation-redesign-plan.md`
**Reviewer:** Code Simplicity Reviewer
**Date:** 2026-02-12
**Verdict:** 3 P1 (reduce complexity), 4 P2 (consider simplifying), 2 P3 (minor)

---

## P1 Findings (Reduce Complexity)

### P1-1: Phase Count -- 9 Phases Is Too Many

**Location:** Plan Phases 1-9

The plan proposes 9 implementation phases. Several can merge without losing safety:

| Current                                           | Merge Into                   | Rationale                                                                                                                                                                                                                |
| ------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase 1 (schema) + Phase 2 (signup form)          | **Phase A: Schema + Signup** | Both are additive, non-breaking, and naturally co-committed. The signup form needs the new Tenant fields from Phase 1. Splitting them forces an intermediate state where schema fields exist but nothing writes to them. |
| Phase 5 (system prompt) + Phase 4 (agent tools)   | **Phase C: Agent Overhaul**  | The new tools and the new prompt reference each other. Deploying tools with the old prompt, or the new prompt without tools, creates a broken intermediate state. They must ship atomically to Cloud Run anyway.         |
| Phase 8 (customer agent) + Phase 9 (deploy + E2E) | **Phase F: Deploy + Verify** | Customer agent updates are small (tool renames). Separating them from the deployment phase just adds an extra PR cycle with no safety benefit.                                                                           |

**Recommended phase count: 6** (A: Schema+Signup, B: Delete Slot Machine, C: Agent Tools+Prompt, D: Frontend Migration, E: Package Deletion+Data Migration, F: Deploy+E2E). This eliminates 3 artificial boundaries and reduces PR overhead.

**Verdict:** Reduce. 9 phases is over-segmented. Merge to 6.

---

### P1-2: TierAddOn Join Table -- Not Needed for MVP

**Location:** Plan Phase 1, lines 158-168; Plan Phase 4, lines 428-429

The plan introduces a `TierAddOn` join table to associate add-ons with specific tiers. However:

1. **Current schema:** `AddOn` already has `segmentId` (nullable -- null means global, non-null means segment-scoped). This is the natural scope for add-ons in a service business.
2. **MVP is ONE segment.** All add-ons within that segment are available to all tiers in that segment. A join table adds no value when there's only one segment with 3 tiers.
3. **The design doc itself says:** "Add-ons are segment-scoped" (`docs/architecture/ONBOARDING_CONVERSATION_DESIGN.md` line 100+). Segment-scoped means `AddOn.segmentId`, not a tier-level join.
4. **Data model complexity:** TierAddOn adds a model, a migration, a new agent tool (`manage_addons` tier linking), new API endpoints, and a migration step in Phase 7 (`PackageAddOn -> TierAddOn`). All for a feature that no MVP user needs.

**When is TierAddOn actually needed?** Only if a business says "This add-on is available for Premium tier but not Essential." That's a Phase 2+ enhancement, not MVP.

**Recommendation:** Drop `TierAddOn` entirely from Phase 1. Keep add-ons segment-scoped via `AddOn.segmentId`. If tier-level add-on scoping is requested later, add it then. This eliminates ~40 lines of schema, one migration step, one agent tool's complexity, and one API endpoint.

**Verdict:** Reduce. Defer TierAddOn to post-MVP. Segment scoping is sufficient.

---

### P1-3: Stripe Dual-ID 48-Hour Window -- Unnecessary Complexity

**Location:** Plan Risk Analysis, lines 981-982

The plan proposes that webhook handlers check for BOTH `metadata.tierId` AND `metadata.packageId` during a "48-hour transition window," with a helper `lookupTierByPackageId()`.

This is unnecessary because:

1. **Stripe metadata is set at checkout creation time.** The plan's Phase 6 changes the frontend to create checkout sessions with `tierId`. Old sessions (created before deploy) still have `packageId`.
2. **But the plan's Phase 7 already migrates all `Booking.packageId -> tierId`.** By the time Package is deleted, every booking has a `tierId`. The webhook handler only needs `bookingId` (which is already in metadata at line 451 of `webhook-processor.ts`) -- it looks up the Booking by ID, not by packageId.
3. **Current webhook handlers don't use `metadata.packageId` at all.** Grep confirms: `webhook-processor.ts` uses `metadata.bookingId` and `metadata.tenantId`. The `packageId` reference in the plan's risk analysis is a phantom risk.
4. **The checkout factory (`checkout-session.factory.ts`) receives a generic `metadata: Record<string, string>`.** The caller passes whatever it wants. Simply change the caller to pass `tierId` instead of `packageId`. No dual-ID needed.

**Recommendation:** Remove the dual-ID fallback window entirely. Change checkout session creation to pass `tierId` in metadata. Webhook handlers already use `bookingId` for lookup -- no changes needed there.

**Verdict:** Reduce. The 48-hour dual-ID window is solving a problem that doesn't exist in the current code.

---

## P2 Findings (Consider Simplifying)

### P2-1: OnboardingPhase BUILDING State -- Justified but Watch Scope

**Location:** Plan Phase 3, lines 349-356

The plan simplifies `OnboardingPhase` from 7 values (NOT_STARTED, DISCOVERY, MARKET_RESEARCH, SERVICES, MARKETING, COMPLETED, SKIPPED) to 4 (NOT_STARTED, BUILDING, COMPLETED, SKIPPED).

**Analysis of "Could we drop BUILDING?":** If we used only NOT_STARTED and COMPLETED, we'd lose the ability to distinguish "tenant who signed up but never talked to the agent" from "tenant who is actively mid-conversation." This distinction matters for:

- Dashboard UI: showing "Continue onboarding" vs "Start onboarding"
- Admin queries: filtering tenants by engagement state
- Session bootstrap: agent knows to open with "Welcome back" vs first greeting

**However:** The plan doesn't define when BUILDING is set. Phase 3 says "replaces DISCOVERY/MARKET_RESEARCH/SERVICES/MARKETING" but doesn't specify the trigger. The state tracker (lines 308-325) only checks `hasSegment` and `hasTiers` -- it never sets `onboardingPhase = BUILDING`.

**Recommendation:** BUILDING is justified, but add explicit trigger: set `onboardingPhase = BUILDING` on first agent interaction (first `storeFact()` call or first message). Document this in the plan. Without a trigger, it's dead state.

**Verdict:** Justified, but incomplete. Add the trigger.

---

### P2-2: State Tracker -- 2 Booleans May Be Too Simple

**Location:** Plan Phase 3, lines 306-325

The plan replaces the slot machine's 15-fact tracking with two booleans:

```typescript
readyForReveal: hasSegment && hasTiers,
missingForMVP: [!hasSegment && 'primarySegment', !hasTiers && 'tiersConfigured'].filter(Boolean)
```

**What's missing:**

1. **Section content readiness.** The reveal trigger is defined as "MVP sections (HERO + ABOUT + SERVICES) with non-placeholder content" (Plan line 6, Decision #6). But `computeOnboardingState()` only checks `hasSegment && hasTiers` -- it never checks section content. The plan says "Section content checked separately via SectionContentService" but doesn't show where or how the agent gets this combined signal.
2. **Brain dump processing state.** After signup, the agent needs to know "has the brain dump been analyzed yet?" This is a third boolean that affects conversation flow.
3. **The slot machine returned `missingForNext` with up to 3 items + `sectionReadiness` per-section.** The new tracker returns at most 2 items. The agent prompt (Phase 5) says the agent "checks what's done and what's missing" each turn -- but the lightweight state doesn't give it enough signal to do that.

**Recommendation:** The tracker is too thin. At minimum, add:

- `hasMVPSections: boolean` (HERO + ABOUT + SERVICES have non-placeholder content)
- Return `readyForReveal = hasSegment && hasTiers && hasMVPSections`
- Move section content check INTO `computeOnboardingState()` rather than splitting it

This is still far simpler than the 15-slot machine but gives the agent the composite signal it needs for reveal.

**Verdict:** Too simple. Add section content readiness to the state tracker so the reveal check is in one place.

---

### P2-3: 301 Redirects for `/book/[packageSlug]` -- Likely Unnecessary

**Location:** Plan Open Questions, line 919

The plan proposes 301 redirects from `/book/[packageSlug]` to `/book/[tierSlug]` for 90 days.

**Analysis:**

1. **The current booking URLs are:** `/t/[slug]/book/[packageSlug]` (confirmed via glob). These are dynamically generated links -- they appear in booking confirmation emails and potentially shared by tenants.
2. **The migration preserves slugs.** Plan Phase 7, line 729: `${p.slug}` -- the Tier gets the same slug as the Package it was migrated from.
3. **Since slugs are preserved, the URL path is identical.** `/t/acme/book/essential` works whether "essential" is a Package slug or a Tier slug. The backend just needs to look up by slug in the Tier table instead of the Package table.
4. **The only breaking change is the Next.js route directory name** (`[packageSlug]` -> `[tierSlug]`). But the param name is internal -- the URL pattern `/t/[slug]/book/[anything]` stays the same.

**Recommendation:** No redirects needed. The URL structure is slug-based. Rename the route param from `packageSlug` to `tierSlug`, update the query to fetch from Tier table. Old URLs work identically because slugs are preserved in migration.

**Verdict:** Reduce. Redirects are unnecessary if slugs are preserved (which they are).

---

### P2-4: Migration Script vs. Prisma Migrate + Seed

**Location:** Plan Phase 7, lines 662-786

The plan includes a 120-line TypeScript migration script with 7 steps inside a single `$transaction`. The rationale is valid (CUIDs, not UUIDs), but the script has complexity that could be reduced:

1. **The `sourcePackageId` temporary column** (lines 695-698, 776) adds schema pollution. It's created, used for joins, then dropped. Alternative: use a local `Map<packageId, tierId>` in memory -- the script already fetches all packages into a JS array (line 701). Build the map in JS, then use it for the booking update. No temp column needed.

2. **The auto-publish step** (lines 678-685) could be a separate pre-migration script. Mixing business logic (auto-publish drafts) with schema migration (create tiers) makes the transaction bigger and harder to debug.

3. **Step 0b resets onboarding phases** (lines 689-693). This is a data fix, not a migration. It should run as a separate step with its own logging and rollback.

**Recommendation:** Split into 3 scripts:

1. `pre-migrate.ts` -- Auto-publish Package drafts + reset stuck onboarding phases
2. `migrate-packages-to-tiers.ts` -- Package -> Tier data migration (use in-memory Map instead of temp column)
3. `post-migrate.ts` -- Verify integrity + drop Package tables

This is the same total work but easier to debug, test independently, and retry on failure.

**Verdict:** Consider splitting. Single 120-line transaction is fragile. Three focused scripts are safer.

---

## P3 Findings (Minor)

### P3-1: Tier Model Field Count -- Justified

**Location:** Plan Phase 1, lines 119-156

The plan proposes Tier with these fields: id, tenantId, segmentId, sortOrder, slug, name, description, priceCents, currency, features, bookingType, durationMinutes, depositPercent, active, photos, createdAt, updatedAt. That's 17 data fields + 2 relations (addOns, bookings).

**Comparison with current Package:** Package has 19 data fields (id, tenantId, slug, name, description, basePrice, active, segmentId, grouping, groupingOrder, photos, draftTitle, draftDescription, draftPriceCents, draftPhotos, hasDraft, draftUpdatedAt, bookingType, createdAt, updatedAt).

**Analysis:** Tier is simpler than Package. The 6 draft-related fields (`draftTitle`, `draftDescription`, `draftPriceCents`, `draftPhotos`, `hasDraft`, `draftUpdatedAt`) are eliminated because the draft/publish workflow moves to SectionContent. The `grouping` and `groupingOrder` fields are replaced by a single `sortOrder`. Net reduction: 19 -> 17 fields.

The `tenantId` addition (Package has it, Tier currently doesn't) enables direct tenant-scoped queries without joining through Segment -- this is a justified denormalization for multi-tenant isolation (Pitfall #1).

**Verdict:** Justified. Tier is simpler than Package despite appearances.

---

### P3-2: `onboarding.schema.ts` Becomes Dead Code

**Location:** `packages/contracts/src/schemas/onboarding.schema.ts` (550 lines)

The plan doesn't mention this file, but it contains the entire old onboarding state machine: `OnboardingPhaseSchema` with DISCOVERY/MARKET_RESEARCH/SERVICES/MARKETING, discriminated unions for each phase, XState machine events, advisor memory schema, and event sourcing schemas.

With the slot machine deletion (Phase 3) and OnboardingPhase simplification (NOT_STARTED/BUILDING/COMPLETED/SKIPPED), essentially ALL of this file becomes dead code:

- `UpdateOnboardingStateInputSchema` -- discriminated union keyed on old phases
- `OnboardingMachineEventSchema` -- XState events for old phase machine
- `EventPayloadSchemas` -- DISCOVERY_STARTED, MARKET_RESEARCH_COMPLETED, etc.
- `AdvisorMemorySchema` -- references old phase data types

**Also affected:** `useOnboardingState.ts` hook references `OnboardingPhase` type with old values. The `OnboardingStateResponse.summaries` object has `discovery`, `marketContext`, `preferences`, `decisions` -- these map to old phases.

**Recommendation:** Add to Phase 3 cleanup: delete or rewrite `packages/contracts/src/schemas/onboarding.schema.ts`. Replace with a minimal schema matching the new 4-value enum. Update `useOnboardingState.ts` to remove old phase references. The plan's Phase 3 file list (lines 358-368) doesn't include this file -- it should.

**Verdict:** Minor omission. Add to Phase 3 deletion list.

---

## Summary

| Severity | Count | Key Theme                                                                                         |
| -------- | ----- | ------------------------------------------------------------------------------------------------- |
| P1       | 3     | Phase count (merge 9->6), TierAddOn premature, Stripe dual-ID phantom risk                        |
| P2       | 4     | BUILDING trigger missing, state tracker too thin, redirects unnecessary, migration script fragile |
| P3       | 2     | Tier field count justified, onboarding.schema.ts cleanup omitted                                  |

**Overall assessment:** The plan is well-structured and thorough. The core architectural decisions (Tier replaces Package, slot machine deletion, LLM-driven conversation, on-demand research) are sound and align with the "no debt" principle. The main complexity risks are in the phase count (too granular), the TierAddOn premature optimization, and the Stripe dual-ID window that solves a non-existent problem. Addressing the P1 findings would reduce implementation scope by approximately 15-20% while maintaining all safety guarantees.
