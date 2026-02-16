# Agent-Native Reviewer -- Plan Review Findings

**Plan:** `docs/plans/2026-02-11-feat-onboarding-conversation-redesign-plan.md`
**Reviewer:** Agent-Native Architecture Reviewer
**Date:** 2026-02-12
**Verdict:** Generally strong plan with 5 P1 issues, 9 P2 issues, and 4 P3 issues that should be addressed before implementation begins.

---

## P1 -- Must Fix Before Implementation

### P1-1: Price Conversion Happens in Agent Tool (Dollars to Cents) but Plan Creates a NEW Price Path Without Documenting the Conversion Layer

**Location:** Plan Phase 4b, `manage_tiers` tool description (line 422)
**Cross-ref:** Current `packages.ts:251` -- `const priceCents = Math.round(params.priceInDollars * 100)`

The plan says: "agent prompt should tell LLM to ask in dollars and convert: `priceCents: dollars * 100`". This implies the LLM itself does the conversion before calling the tool. This is dangerous -- LLMs are unreliable at math.

**Current pattern (correct):** `manage_packages` accepts `priceInDollars` as a tool param and the tool's `handleCreatePackage()` converts to cents in TypeScript: `const priceCents = Math.round(params.priceInDollars * 100)`. The LLM never sees cents.

**Risk:** If `manage_tiers` accepts `priceCents` directly (as the Prisma schema shows `priceCents Int`), the LLM must multiply by 100 before calling the tool. LLMs frequently get this wrong -- they might pass `2500` (meaning $2,500) as `priceCents`, creating a $25 tier.

**Fix:** `manage_tiers` tool parameter schema MUST accept `priceInDollars` (like `manage_packages` does today), and the tool handler MUST convert to cents in TypeScript code. Never delegate arithmetic to the LLM. Add explicit validation: `if (priceCents < 100) return { error: 'Price seems too low...' }`.

---

### P1-2: Reveal Trigger Has No Deterministic Section Content Validation

**Location:** Plan Phase 3, `computeOnboardingState()` (lines 308-325)
**Cross-ref:** Design spec line 51 -- "Reveal trigger (MVP sections complete -> show site)"

The plan's `computeOnboardingState()` checks only two booleans: `hasSegment` and `hasTiers`. It explicitly says "Section content checked separately via SectionContentService" but never specifies WHERE or WHEN that check happens, or what tool/endpoint triggers it.

**Current system:** The slot machine returns `BUILD_FIRST_DRAFT` as a nextAction, and the frontend triggers the reveal animation when all MVP sections are updated. The plan removes the slot machine but doesn't replace this deterministic gate.

**Gap:** With the slot machine removed, what prevents the agent from saying "here's your site" when:

- Tiers are configured but section content is still placeholder?
- `build_first_draft` was called but `update_section` failed silently?
- HERO is updated but ABOUT/SERVICES still have "[Your Business]" placeholders?

**Fix:** The `build_first_draft` tool (or a new `check_reveal_readiness` tool) MUST call `SectionContentService.isPlaceholderContent()` for all 3 MVP sections and return a boolean `readyForReveal`. The system prompt must instruct the agent to check this BEFORE announcing the reveal. Make it a deterministic backend check, not an LLM judgment call.

---

### P1-3: `store_discovery_fact` Currently Returns Slot Machine Fields That Are Removed -- No Replacement State Contract

**Location:** Plan Phase 3 (lines 276-368) + Phase 4 tool updates (line 435)
**Cross-ref:** Current `discovery.ts:105-119` returns `nextAction`, `readySections`, `missingForNext`, `slotMetrics`

The plan says to remove the slot machine, but the entire tenant agent prompt (system.ts lines 182-197) is built around following `nextAction` deterministically: `ASK`, `BUILD_FIRST_DRAFT`, `TRIGGER_RESEARCH`, etc. The plan's Phase 4 says "Remove slot machine nextAction. Return simple state object." but never defines what that state object looks like.

**Impact:** Without a defined response contract for `store_discovery_fact`, the agent has no signal for when to:

- Stop asking questions and start building
- Check if MVP is complete
- Transition from Phase 1 to Phase 2

The plan says the LLM decides, but there's no structured data for it to decide WITH. The current agent is trained on specific response fields (`nextAction`, `missingForNext`). Removing these without a replacement contract means the agent will hallucinate next steps.

**Fix:** Define an explicit `StoreFactResponse` contract:

```typescript
{
  stored: true,
  key: string,
  totalFactsKnown: number,
  knownFactKeys: string[],
  currentPhase: 'NOT_STARTED' | 'BUILDING' | 'COMPLETED',
  mvpReadiness: {
    hasSegment: boolean,
    hasTiers: boolean,
    mvpSectionsReady: boolean, // from SectionContentService
    missingItems: string[], // human-readable
  }
}
```

---

### P1-4: Customer Agent Tool Inventory Incomplete -- 7 Tools Need Package-to-Tier Migration

**Location:** Plan Phase 8 (lines 825-858)
**Cross-ref:** `server/src/agent-v2/deploy/customer/src/tools/booking.ts` (7 tools), `agent.ts` (13 total tools)

The plan says "Update package browsing tools to use Tier" but only mentions files generically. The actual customer agent has these Package-dependent tools that each need specific changes:

| Tool                  | Current Behavior                          | Required Change                            |
| --------------------- | ----------------------------------------- | ------------------------------------------ |
| `get_services`        | Calls `/services` -- returns Package list | Must return Segment->Tier hierarchy        |
| `get_service_details` | Calls `/service-details` with `serviceId` | Must accept `tierId`, return Tier+AddOns   |
| `recommend_package`   | Accepts `budget: low/medium/high`         | Must recommend Tiers within a Segment      |
| `create_booking`      | Accepts `serviceId`                       | Must accept `tierId` + optional `addOnIds` |
| `check_availability`  | Accepts `serviceId`                       | Must accept `tierId` (duration from Tier)  |
| `answer_faq`          | Unchanged                                 | Unchanged                                  |
| `get_business_info`   | Unchanged                                 | Should include Segment list                |

**Critical:** The `recommend_package` tool name itself must change (per ADK, tool names are part of the LLM's function calling interface). The customer-agent system prompt also references packages extensively.

**Fix:** Plan Phase 8 needs a tool-by-tool migration table like the one above, plus explicit note that `recommend_package` -> `recommend_tier` is a breaking name change requiring customer-agent prompt update.

---

### P1-5: A2A Commerce JSON Uses `price` (Dollars) but Tier Stores `priceCents` (Cents) -- No Conversion Specified

**Location:** Plan Phase 8, A2A Commerce Structure (lines 837-852)
**Cross-ref:** Plan Phase 1 schema (line 132) -- `priceCents Int`

The A2A commerce JSON example shows:

```json
{ "name": "Essential", "price": 3500, "features": [...] }
```

Is `price: 3500` dollars or cents? The Tier model stores `priceCents` (cents). If this is dollars, where does the conversion happen? If it's cents, the customer-agent LLM might tell a customer "The Essential tier is 3500" without knowing the unit.

**Fix:** The A2A serialization endpoint MUST convert `priceCents` to `priceInDollars` (or `priceCents` with explicit unit) before returning to the customer-agent. The JSON contract must document the unit. Recommend: `{ "name": "Essential", "priceCents": 350000, "priceFormatted": "$3,500" }` -- give the LLM a human-readable string.

---

## P2 -- Should Fix Before Implementation

### P2-1: System Prompt Brain Dump Parsing Has No Structured Fallback for Empty Brain Dump

**Location:** Plan Phase 5, System Prompt (lines 496-508)
**Cross-ref:** Current system.ts lines 131-149 (scripted Q1/Q2)

The plan's experience adaptation table (lines 500-502) assumes a brain dump exists. What happens when `tenant.brainDump` is null or empty string?

- New tenants with empty brain dump get no context-aware greeting
- The agent has nothing to adapt to -- but the plan removes Q1 ("what city and state") and Q2 ("what do you do") because the signup form collects those
- If city/state/brainDump are all optional (Plan Phase 2, line 245-246), a tenant could register with ONLY email+password+businessName

**Fix:** Add explicit fallback path in system prompt: "If brain dump is empty AND city/state are missing, fall back to Q1 (location) and Q2 (what do you do). If brain dump is empty but city/state exist, skip to segment discovery." The plan mentions this in Open Question #6 but doesn't codify it into the Phase 5 prompt spec.

---

### P2-2: State Management -- 2 Discovery Fact Keys (`primarySegment`, `tiersConfigured`) Are Insufficient for Session Recovery

**Location:** Plan Phase 3, `computeOnboardingState()` (lines 308-325)
**Cross-ref:** Current `discovery-facts.ts` has 15 keys

The plan reduces state tracking to 2 fact keys: `primarySegment` and `tiersConfigured`. But session recovery needs more:

- Has the brain dump been processed? (Prevents re-processing on session restart)
- Has the agent already greeted? (Prevents re-greeting on page refresh)
- Which MVP sections have been built? (Prevents rebuilding HERO when only ABOUT is missing)
- Has research been offered/completed? (Prevents re-offering)
- Is the tenant in Phase 1 or Phase 2? (Post-reveal state)

The current system tracks 15 facts which is too many, but 2 is too few. The plan says "Agent maintains this mentally via `get_known_facts` + `get_page_structure`" but this creates a cold-start problem: a new agent session must make 2 tool calls before it can say anything.

**Fix:** Track at least 5 state signals in `discoveryFacts`: `primarySegment`, `tiersConfigured`, `mvpSectionsBuilt`, `revealShown`, `currentPhase`. These are the minimum for deterministic session recovery without requiring tool calls.

---

### P2-3: Research On-Demand Detection -- "Stuck" Is Undefined

**Location:** Plan Phase 5, Research section (lines 519-524)
**Cross-ref:** Current `research.ts` description (line 131): "WHEN TO CALL: As soon as you have businessType + location"

The plan says the agent should offer research when "Tenant is stuck on pricing." But "stuck" is a subjective LLM judgment. What counts as stuck?

- Tenant says "I don't know what to charge" -- clearly stuck
- Tenant says "hmm, let me think" -- maybe thinking, not stuck
- Tenant gives no response for 30 seconds -- browser doesn't detect silence
- Tenant says "that seems expensive" -- stuck on THEIR pricing, not needing research

The current system auto-fires research deterministically (after businessType + location). The new system relies entirely on LLM judgment for a $0.03-0.10 API call.

**Fix:** Add specific trigger phrases to the system prompt: "Offer research when tenant says any of: 'don't know what to charge', 'no idea about pricing', 'what should I charge', 'what do others charge'. Do NOT offer research for: 'let me think', 'I'll figure it out', general hesitation."

---

### P2-4: `manage_tiers` Tool Missing `segmentId` Flow -- How Does the Agent Know Which Segment to Create Tiers For?

**Location:** Plan Phase 4b, `manage_tiers` tool (lines 418-428)
**Cross-ref:** Current schema `Tier.segmentId` is required (line 266)

The plan shows `manage_tiers` accepts `segmentId` as a parameter. But during the MVP flow (1 segment), the agent must:

1. Create a segment first via `manage_segments`
2. Get back the `segmentId`
3. Pass it to `manage_tiers` for each of the 3 tiers

The plan doesn't specify whether `segmentId` is required or optional on `manage_tiers`. If optional, how does the tool know which segment? If the tenant has only 1 segment, should the tool auto-detect it?

**Fix:** Document the tool interaction flow explicitly:

- If `segmentId` is omitted AND tenant has exactly 1 segment, auto-resolve to that segment
- If `segmentId` is omitted AND tenant has multiple segments, return error with segment list
- This prevents the agent from needing to call `manage_segments(action: 'list')` before every `manage_tiers` call

---

### P2-5: Stripe Transition Window Risk Underspecified -- "48 Hours" Is Arbitrary

**Location:** Plan Risk Analysis (line 981)
**Cross-ref:** `server/src/services/checkout-session.factory.ts`, `server/test/fixtures/stripe-events.ts`

The plan says keep both `metadata.tierId` AND `metadata.packageId` for "48 hours." But:

- Stripe checkout sessions can remain open for up to 24 hours (configurable)
- Customers can receive booking confirmation emails with packageId references long after
- The `checkout-session.factory.ts` uses a generic `metadata: Record<string, string>` -- the actual metadata is constructed by callers (`booking.service.ts`, `appointment-booking.service.ts`, `wedding-booking.orchestrator.ts`)

**Fix:** The plan should:

1. Identify all callers that pass metadata to `CheckoutSessionFactory` (there are at least 3 services)
2. Specify the exact dual-read pattern: `const tierId = metadata.tierId ?? tierLookupCache.get(metadata.packageId)`
3. Set the transition window to 7 days (not 48h) since customers may revisit stale confirmation pages

---

### P2-6: Constants Drift Risk -- Plan Adds New Constants But Only Has ONE Drift Test

**Location:** Plan Phase 9 (lines 890-898)
**Cross-ref:** Current `shared.ts` syncs `MVP_SECTION_TYPES`, `SEED_PACKAGE_NAMES`, `TOTAL_SECTIONS`

The plan proposes a constants drift test for `MVP_SECTION_TYPES`. But the redesign introduces NEW constants that also need sync:

- Max segments per tenant (5) -- where is the canonical source?
- Max tiers per segment (plan says 5 but design says 3 default) -- which is it?
- Tier features JSON schema -- who validates it?
- Phase names (NOT_STARTED, BUILDING, COMPLETED, SKIPPED)

These are all values that exist in both the backend (Prisma/services) and the Cloud Run agent (constants/shared.ts).

**Fix:** Create a comprehensive constants sync test that covers ALL synced values, not just MVP section types. Include: max segments, default tier count, phase names, and the features JSON schema.

---

### P2-7: `wrapToolExecute` Used in Tenant Agent but Not in Customer Agent -- Inconsistent Error Handling

**Location:** Plan Phase 8 (customer agent updates)
**Cross-ref:** Tenant tools use `wrapToolExecute` (e.g., `packages.ts:129`), Customer tools use raw `safeParse` (e.g., `booking.ts:73`)

The tenant-agent tools use `wrapToolExecute()` which provides structured error handling, logging, and the `requireTenantId()` guard. The customer-agent tools (`booking.ts`) use manual `safeParse` + `getTenantId` (nullable return, no throw).

When migrating customer-agent tools for Phase 8, the plan doesn't specify whether to also upgrade to `wrapToolExecute`. This means the new tier-based customer tools will inherit the old inconsistent pattern.

**Fix:** Phase 8 should explicitly include: "Upgrade customer-agent tools to use `wrapToolExecute` pattern from tenant-agent (includes structured error handling, `requireTenantId` guard, and `validateParams`)."

---

### P2-8: `build_first_draft` Currently Cleans Up Seed Packages -- Tier Equivalent Not Specified

**Location:** Plan Phase 4 (line 437): "Replace seed package cleanup with seed tier check"
**Cross-ref:** Current `first-draft.ts:203-233` deletes `$0 packages named Basic/Standard/Premium`

The plan says to update `build_first_draft` to "replace seed package cleanup with seed tier check" but doesn't specify:

- Are seed tiers created during tenant provisioning? (Current: 3 seed packages are created)
- If yes, what are their names? (Need equivalent of `SEED_PACKAGE_NAMES` for tiers)
- What's the cleanup criteria? (`priceCents === 0`? Name match? Both?)

**Fix:** Define: Will tenant provisioning create 3 seed tiers per default segment? If so, define `SEED_TIER_NAMES` constant and the cleanup logic in `build_first_draft`. If NOT creating seed tiers (because the agent builds them via conversation), update the provisioning service to NOT create any tiers -- and document this change.

---

### P2-9: `manage_segments` Missing `tenantId` in Schema -- Segment Model Requires It

**Location:** Plan Phase 4b, `manage_segments` tool (lines 412-417)
**Cross-ref:** Schema `Segment.tenantId` (line 221) + `@@unique([tenantId, slug])` (line 254)

The plan's `manage_segments` tool description says "Actions: list, create, update, delete" but doesn't show the parameter schema. The `Segment` model requires `tenantId`, and slug must be unique per tenant.

The plan says the tool "Returns full state: `{ segment, totalSegments, maxSegments: 5 }`" but doesn't specify:

- Does the tool auto-generate slug from name? (Like `packages.ts:77-83` does with `slugify`)
- Is `tenantId` injected from context? (Must be -- never accept from LLM params, per multi-tenant isolation rules)
- Are `heroTitle`, `heroSubtitle` required? (Current Segment schema has non-nullable `heroTitle`)

**Fix:** Specify that `manage_segments` follows the same pattern as `manage_packages`: `tenantId` injected via `requireTenantId(context)`, slug auto-generated via `slugify(name)`, and `heroTitle` defaulted to segment name if not provided.

---

## P3 -- Nice to Fix

### P3-1: Non-English Brain Dump -- Plan Acknowledges but Doesn't Address MVP Behavior

**Location:** Plan Future Considerations (line 1008)
**Cross-ref:** System prompt is entirely in English

The plan defers "multi-language brain dump" to future work, but doesn't specify MVP behavior. If a tenant writes their brain dump in Spanish, the English-prompted agent will attempt to parse it (Gemini 2.0 Flash supports multilingual). The agent might:

- Respond in English (confusing)
- Respond in Spanish (great, but system prompt says "got it | done | on it")
- Mix languages (worst case)

**Fix:** Add one line to the system prompt: "If the brain dump is in a non-English language, respond in that language but use English for tool calls. If you can't parse the brain dump, acknowledge it and ask in English."

---

### P3-2: Brain Dump Max Length (2000 chars) Isn't Validated on Frontend

**Location:** Plan Phase 2 acceptance criteria (line 268): "Brain dump max length: 2000 characters"
**Cross-ref:** Backend validation at line 245-246 uses `z.string().optional()` -- no `.max(2000)`

The plan adds a max length to acceptance criteria but the Zod schema shown on line 243 doesn't include it:

```typescript
brainDump: z.string().optional(), // Missing .max(2000)
```

**Fix:** Update both: backend Zod schema to `z.string().max(2000).optional()` AND frontend textarea to include `maxLength={2000}` with a character counter.

---

### P3-3: Plan Phase 1 Schema Shows `photos Json` on Tier but No Migration for Existing Package Photos

**Location:** Plan Phase 1, Tier model (line 143): `photos Json @default("[]")`
**Cross-ref:** Plan Phase 7 migration script (lines 666-786) -- no photo migration step

The Tier model in Phase 1 includes a `photos` field to replace Package photos. But the Phase 7 migration script that converts Package->Tier doesn't copy `Package.photos` to `Tier.photos`. This means existing Package photos would be lost.

**Fix:** Add a step to the Phase 7 migration: copy `Package.photos` (if the field exists) to the corresponding `Tier.photos` during the Package->Tier data migration.

---

### P3-4: Slug Collision Detection Mentioned in Risk Table but Not in Tool Design

**Location:** Plan Risk Analysis (line 996): "LLM generates duplicate tier/segment slugs"
**Cross-ref:** Current `packages.ts:77-83` has `slugify()` but no collision detection

The plan's risk table says "Add slug collision detection in agent tool. Auto-append number: 'weddings-2'." But this isn't reflected in the Phase 4 tool design or acceptance criteria.

**Fix:** Add to Phase 4 acceptance criteria: "Segment and Tier tools must detect slug collisions and auto-suffix with incrementing number (e.g., `weddings-2`, `weddings-3`). Collision check uses `@@unique([tenantId, slug])` constraint -- catch Prisma unique violation and retry with suffix."

---

## Summary

| Severity  | Count  | Key Themes                                                                                                                                                                                                |
| --------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1        | 5      | Price conversion safety, reveal trigger validation, state contract, customer-agent tool inventory, A2A unit ambiguity                                                                                     |
| P2        | 9      | Empty brain dump fallback, session recovery state, research trigger definition, segmentId flow, Stripe window, constants drift, error handling consistency, seed tier cleanup, segment tenantId injection |
| P3        | 4      | Non-English brain dump, max length validation, photo migration, slug collision                                                                                                                            |
| **Total** | **18** |                                                                                                                                                                                                           |

### Highest-Impact Recommendations

1. **P1-1 + P1-5:** Establish a firm rule: LLMs NEVER do arithmetic. All tools accept human units (dollars, not cents) and convert in TypeScript. A2A JSON should include both `priceCents` and `priceFormatted`.

2. **P1-2 + P1-3:** Define the complete `StoreFactResponse` contract and the reveal readiness check BEFORE starting implementation. These are the backbone of the new system -- getting them wrong means the agent can't make progress decisions.

3. **P1-4:** Create the customer-agent tool migration table now. Phase 8 is listed last but has the most cross-cutting impact -- knowing the tool changes early will influence Phase 4 API design.
