# Handoff: Onboarding Conversation Redesign — Phases 1-4 Complete, Phase 5 In Progress

## Context

You are continuing work on the MAIS project (gethandled.ai). A 9-phase implementation plan is being executed to replace the slot machine onboarding with an LLM-driven adaptive conversation.

## What Was Done

1. **Brainstorm** (2026-02-11): Full design exploration → `docs/brainstorms/2026-02-11-onboarding-conversation-redesign-brainstorm.md`
2. **Design spec**: `docs/architecture/ONBOARDING_CONVERSATION_DESIGN.md`
3. **Implementation plan**: `docs/plans/2026-02-11-feat-onboarding-conversation-redesign-plan.md` (9 phases, ~1100 lines)
4. **Plan review** (2026-02-12): 7-agent review → 118 findings → 23 deduplicated todos → 12 patched into plan + 11 covered by Implementation Checklist
5. **Review files**: `docs/reviews/*.md` (7 files with full findings)
6. **Phase 1 COMPLETE** (commit `afc833dc`): Schema changes, migration, contracts, tests
7. **Phase 2 COMPLETE** (commit `310968c9`): Signup form + auth backend (city, state, brainDump)
8. **Phase 3 COMPLETE** (commit `2467440f`): Slot machine deleted, lightweight state tracker added
9. **Phase 4 COMPLETE** (commit `b219a953`): Segment/Tier/AddOn tools replace manage_packages

## Phase 1 Summary (commit `afc833dc`)

- Tier model rewritten: sortOrder, priceCents(Int), slug, tenantId, bookingType, etc.
- TierLevel enum deleted → replaced by `sortOrder Int`
- TierAddOn join table created
- Booking: nullable `tierId` field added
- Tenant: `brainDump` (Text), `city`, `state` fields added
- Manual migration with nullable→backfill→set-not-null pattern

## Phase 2 Summary (commit `310968c9`)

- `TenantSignupDtoSchema`: Added city, state, brainDump fields (all optional)
- `SignupCreateTenantInput`: Extended with city?, state?, brainDump?
- `auth.routes.ts`: Extracts and validates new fields (brainDump max 2000 chars)
- `signup/page.tsx`: City input with MapPin icon, State Radix Select (50 states + DC + Other), brain dump textarea with character counter

## Phase 3 Summary (commit `2467440f`)

**Massive deletion: -1620 lines, +75 lines**

- **Deleted**: `slot-machine.ts` (340 lines), `slot-machine.test.ts` (805 lines), `test/lib/slot-machine.test.ts` (338 lines)
- **Rewritten `discovery.service.ts`**: Replaced `computeSlotMachine()` with `computeOnboardingState()` (15 lines). Simplified `StoreFactResult` — removed `phaseAdvanced`, `nextAction`, `slotMetrics`; added `readyForReveal` (boolean) and `missingForMVP` (string[])
- **Removed auto-fire research**: `storeFact()` no longer triggers research. Agent calls it on-demand.
- **Updated `context-builder.service.ts`**: Removed `computeSectionReadiness` import and `sectionReadiness` field from bootstrap data
- **BUILDING enum added**: `ALTER TYPE "OnboardingPhase" ADD VALUE 'BUILDING'` (step 1 of 2; old values removed in Phase 7)

## Phase 4 Summary (commit `b219a953`)

**Replace manage_packages with Segment → Tier → AddOn hierarchy**

### Backend Routes (server/src/routes/internal-agent-content-generation.routes.ts)

- **Deleted**: `/manage-packages` route (~180 lines)
- **Added**: `/manage-segments` (uses SegmentService), `/manage-tiers` (uses Prisma directly), `/manage-addons` (uses Prisma directly)
- Wired `segmentService` + `prisma` into `MarketingRoutesDeps` in `internal-agent-shared.ts` and `routes/index.ts`

### Agent Tools (server/src/agent-v2/deploy/tenant/src/tools/)

- **NEW**: `segments.ts` — manage_segments (list/create/update/delete, max 5 per tenant)
- **NEW**: `tiers.ts` — manage_tiers (list/create/update/delete, max 5 per segment, $1-$50K, DATE/TIMESLOT booking)
- **NEW**: `addons.ts` — manage_addons (list/create/update/delete, optional segment scoping, $1-$10K)
- **DELETED**: `packages.ts` — replaced by manage_tiers
- **UPDATED**: `first-draft.ts` — removed seed package cleanup, removed PackageListResponse/SEED_PACKAGE_NAMES imports, updated pricing hints for tiers
- **UPDATED**: `discovery.ts` — readyForReveal description replaces slot machine nextAction
- **UPDATED**: `research.ts` — on-demand only (not auto-triggered at Q2)
- **UPDATED**: `index.ts` — replaced managePackagesTool export with manageSegmentsTool/manageTiersTool/manageAddOnsTool
- **UPDATED**: `agent.ts` — tool count 34→36, tool registration updated, Phase 9 label
- **UPDATED**: `storefront-write.ts` — manage_packages → manage_tiers in description

### Constants & Tests

- Added `primarySegment`, `tiersConfigured` to both canonical (`server/src/shared/constants/discovery-facts.ts`) and agent copy (`constants/discovery-facts.ts`)
- Removed `SEED_PACKAGE_NAMES` from agent `constants/shared.ts` and `constants/index.ts`
- Added `MAX_SEGMENTS_PER_TENANT` (5) and `MAX_TIERS_PER_SEGMENT` (5)
- Updated `constants-sync.test.ts` — removed SEED_PACKAGE_NAMES sync test

### API Response Schemas (types/api-responses.ts)

- Replaced Package schemas with: SegmentSchema, SegmentListResponse, SegmentMutationResponse, SegmentDeleteResponse, TierSchema, TierListResponse, TierMutationResponse, TierDeleteResponse, AddOnSchema, AddOnListResponse, AddOnMutationResponse, AddOnDeleteResponse

### Typecheck & Tests

- `npm run --workspace=server typecheck` ✅
- `npm run --workspace=apps/web typecheck` ✅
- `constants-sync.test.ts` ✅ (both MVP_SECTION_TYPES and DISCOVERY_FACT_KEYS sync)

## Phase 5 — IN PROGRESS (System Prompt Rewrite)

> ⚠️ **ATOMIC: Phases 3, 4, and 5 must deploy together.** Phase 3 deleted the slot machine, Phase 4 created replacement tools, Phase 5 rewrites the prompt.

### What's DONE (saved to disk, NOT committed yet)

**System prompt rewrite is COMPLETE:**

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` — fully rewritten (466 → 412 lines)
- All slot machine references deleted
- All manage_packages references deleted
- Brain dump processing section added
- Experience adaptation table (fast-track vs mentoring) added
- Phase 1 (MVP sprint) and Phase 2 (tenant-led enhancement) clearly defined
- Research rewritten as on-demand only
- Financial safety protocol updated (manage_tiers replaces manage_packages)
- T3 confirmation updated (manage_tiers delete, manage_segments delete)
- New Forbidden Words entry: "segment / tier / add-on" → use business terms
- State tracking section replaces slot machine protocol
- Conversation rules consolidated
- All preserved sections kept intact (Who You Are, Personality, Forbidden Words, Build With Narrative, Refine Through Conversation, When Tools Fail, Technical Issue Reports, Trust Tiers, Lead Partner Rule, Edge Cases, Environment)

### What REMAINS (3 small tasks)

#### Task A: Update BootstrapData in context-builder.service.ts

**File:** `server/src/services/context-builder.service.ts`

**What to do:**

1. Add `brainDump?: string | null`, `city?: string | null`, `state?: string | null` to the `BootstrapData` interface (around line 155)
2. In `getBootstrapData()` (around line 333), add `brainDump`, `city`, `state` to the `select` clause of the Prisma query
3. Include them in the returned BootstrapData object (around line 390)

**Why:** The brain dump, city, and state are stored on the `Tenant` model (added in Phase 1/2) but aren't currently selected or returned by BootstrapData. The agent needs these at session start.

#### Task B: Update buildContextPrefix in tenant-admin-tenant-agent.routes.ts

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts`

**What to do:**

1. In `buildContextPrefix()` (around line 860), add brain dump injection:
   ```typescript
   // Brain dump (primary context for onboarding)
   if (bootstrap.brainDump) {
     parts.push(`brainDump: ${JSON.stringify(bootstrap.brainDump)}`);
   }
   // Location from signup
   if (bootstrap.city || bootstrap.state) {
     parts.push(`location: ${[bootstrap.city, bootstrap.state].filter(Boolean).join(', ')}`);
   }
   ```
2. The system prompt's "Brain Dump Processing" section tells the agent to look for brainDump in `[SESSION CONTEXT]`

**Why:** This is HOW the brain dump gets to the agent. The `buildContextPrefix()` function creates a `[SESSION CONTEXT]...[END CONTEXT]` block that's prepended to the first user message. Currently it only injects knownFacts, forbiddenSlots, onboardingComplete, and businessName.

#### Task C: Typecheck + Commit

```bash
rm -rf server/dist packages/contracts/dist packages/shared/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck
```

Then commit all Phase 5 changes in a single commit:

```
feat(agent): Phase 5 — rewrite system prompt for LLM-driven onboarding
```

### Acceptance Criteria (from plan)

- [x] System prompt references new tools (manage_segments, manage_tiers, manage_addons)
- [x] No references to slot machine, manage_packages, or 15 fixed fact keys
- [x] Brain dump processing instructions included
- [x] Experience adaptation table (fast-track vs mentoring)
- [x] Phase 1 (MVP sprint) and Phase 2 (enhancement) clearly defined
- [x] Research is on-demand only (explicit instruction)
- [x] Forbidden vocabulary maintained (no "Great!", "Perfect!", etc.)
- [x] Financial safety protocol maintained (T3 for destructive operations)
- [x] BootstrapData includes brainDump, city, state (Task A)
- [x] buildContextPrefix injects brainDump into [SESSION CONTEXT] (Task B)
- [x] Typecheck passes (Task C)
- [x] Committed (Task C)

## Important Principles

- **Multi-tenant isolation**: ALL queries filter by tenantId
- **LLMs never do arithmetic**: Tools accept dollars, convert to cents in TypeScript
- **No debt**: Delete deprecated code completely, don't leave stubs
- **Atomic deployment**: Phases 3-4-5 must deploy together
- **Voice rules**: got it | done | on it | heard (NEVER "Great!" "Perfect!" "Absolutely!")
