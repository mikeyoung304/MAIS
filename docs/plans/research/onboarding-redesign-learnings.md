# Institutional Learnings Applicable to Onboarding Redesign

> Consolidated from 22 solution docs in `docs/solutions/`. Each finding references the source document and surfaces a concrete pattern, anti-pattern, or constraint that the onboarding redesign plan should account for.

---

## Phase 1: Schema + State Machine

- **Explicit state guards are non-negotiable.** The `coming_soon` state leaked into `preview` because three Zustand actions (`showPreview`, `showDashboard`, `highlightSection`) could bypass it. Only `revealSite()` was intended to transition away. Every state in the new onboarding state machine must have documented transition guards; no action should change status without checking the current state first. _(Source: ONBOARDING_PREVIEW_STATE_GUARDS_AND_STALE_IFRAME_FIX)_

- **Dual-mode methods must be consistent.** When an orchestrator switches between onboarding mode and admin mode, ALL methods (`buildSystemPrompt`, `getGreeting`, `getTools`) must check the mode. The prior bug had `getTools()` switching correctly while `buildSystemPrompt()` always returned the admin template, causing the agent to have onboarding tools but admin instructions. Extract mode detection to a single `isOnboardingActive()` method that all methods call. _(Source: onboarding-mode-orchestrator-system-prompt)_

- **Constants must have a single canonical source.** Seven independent definitions of section types drifted apart, causing silent runtime failures where the agent created sections that the frontend silently skipped. The new state machine's phases, statuses, and allowed transitions must be defined once in `@macon/contracts` with all consumers importing from that source. _(Source: CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES)_

- **Avoid two-phase initialization.** A session-then-chat flow lost the brain dump context because phase 2 always had a sessionId from phase 1, so context injection was never triggered. Prefer single API calls that combine setup + first action atomically. _(Source: TWO_PHASE_INIT_ANTIPATTERN)_

## Phase 2: Signup + Payment

- **Stripe checkout URLs must be generated dynamically per tenant.** Static environment variables for success/cancel URLs caused all tenants to redirect to the same global `/success` page. Build tenant-scoped URLs at request time: `${frontendBaseUrl}/t/${encodedSlug}/...`. Include tenant slug in Stripe metadata for webhook routing. _(Source: multi-tenant-stripe-checkout-url-routing)_

- **Webhook idempotency requires atomic record-and-check.** Concurrent Stripe webhooks can both pass `isDuplicate()` before either records. Use database unique constraints as the source of truth; `recordWebhook()` must return a boolean (true=new, false=duplicate) so the controller knows whether to proceed. Never separate "check if exists" from "create if not exists". _(Source: webhook-idempotency-race-condition)_

- **Auth form accessibility is a conversion lever.** Missing ARIA attributes (`aria-invalid`, `aria-describedby`, `role="alert"`), keyboard-inaccessible password toggles (`tabIndex={-1}`), and CLS from loading skeletons that don't match final layout all hurt signup conversion. Apply the full auth form accessibility checklist: skeleton dimensions must match final content, use `bg-surface` for dark theme, ensure `focus:ring-2` on all interactive elements. _(Source: signup-page-accessibility-conversion-fixes, auth-form-accessibility-checklist)_

- **Tenant provisioning must be atomic.** Creating a tenant without segments and packages leaves the storefront unusable. Wrap all entity creation (tenant + default sections + default packages) in a single `$transaction`. Every code path that creates a tenant must use the same provisioning service via DI. _(Source: atomic-tenant-provisioning-defense-in-depth)_

## Phase 3: Intake Form

- **Zod validation is mandatory at every trust boundary.** Agent tool parameters, HTTP request bodies, webhook payloads, and Prisma JSON fields all cross trust boundaries. Use `safeParse()` as the FIRST LINE of every handler, never `params as Type`. Return human-readable error messages. Use `.min(1)` for CUID IDs, not `.uuid()`. _(Source: ZOD_PARAMETER_VALIDATION_PREVENTION)_

- **LLM context must be in the message text, not session state.** ADK session state is backend metadata; the LLM only sees `parts[].text`. Storing intake answers in session state without injecting them into the message content means the agent won't know about them. Any data the agent needs must appear in the conversation. _(Source: TWO_PHASE_INIT_ANTIPATTERN)_

- **Transition triggers must be explicit.** The agent gathered discovery information but never transitioned to action because the system prompt described tools without WHEN-to-use-them rules. Add explicit `WHEN X --> DO Y` triggers: "After 2-3 key facts, IMMEDIATELY call build*first_draft. No approval needed." *(Source: AGENT*PROMPT_TRANSITION_TRIGGERS_PREVENTION)*

- **Questionnaire answers map to brand archetypes.** Q10 ("how would a friend describe your business") is the Rosetta Stone for brand voice. Map each paragraph of generated copy to specific intake answers. This prevents the agent from drifting into generic marketing speak and keeps copy grounded in the owner's actual words. _(Source: tenant-storefront-content-authoring-workflow)_

## Phase 4: Background Build

- **First-draft workflow must be autonomous.** The agent had tools to update sections but no instruction to use them without approval. Users expect "magic" during onboarding: they talk about their business, then see a personalized site. Requiring approval for each piece of copy during initial generation kills the experience. Explicitly instruct the agent to generate and apply copy WITHOUT user confirmation for the first draft. _(Source: AUTONOMOUS_FIRST_DRAFT_WORKFLOW)_

- **Defense-in-depth for LLM mutations.** Never rely solely on prompt instructions for mutations that affect money, user-visible data, or trust. Use belt-and-suspenders: programmatic guards in tool `execute()` (suspenders) + prompt-level instructions (belt). The $0 default package duplication bug occurred because the agent was told to delete defaults but sometimes skipped the step; a programmatic fallback in `first-draft.ts` now deletes them automatically. _(Source: ONBOARDING_REVEAL_SCOPE_PREVENTION)_

- **File upload security is multi-layered.** During background build, any user-uploaded images (logos, portfolio) need: (1) magic byte validation, not just MIME type checking, (2) signed URLs with private buckets to prevent cross-tenant enumeration, (3) tenant-scoped storage paths, and (4) orphaned file cleanup on record deletion. _(Source: file-upload-security-hardening)_

- **Auto-save race conditions lose data.** Debounced auto-save without version tracking allows stale writes to overwrite recent changes. Use optimistic concurrency: `expectedVersion` parameter on saves, server validates inside transaction, client handles `VERSION_CONFLICT` with refs to avoid stale closures. _(Source: auto-save-race-condition)_

## Phase 5: Video + Reveal

- **Reveal scope must be explicitly defined.** The system had 8 section types but no concept of "show these 3 during the wow moment." Default `visible: true` on CONTACT and PRICING caused placeholder content to appear during reveal. Define `isRevealMVP: boolean` on each section in a single canonical blueprint. Derive `MVP_REVEAL_SECTION_COUNT` and `MVP_REVEAL_SECTION_TYPES` from that blueprint. All consumers import, never redefine. _(Source: ONBOARDING_REVEAL_SCOPE_PREVENTION)_

- **Count-based reveal triggers must match the blueprint.** Auto-reveal previously fired on the FIRST `update_section` tool completion, showing partial content. Use a module-scoped counter that accumulates across tool-complete batches, firing `revealSite()` only when `firstDraftWriteCount >= MVP_REVEAL_SECTION_COUNT`. The count must be derived, never a magic number. _(Source: ONBOARDING_REVEAL_SCOPE_PREVENTION)_

- **Cache invalidation before iframe refresh must be three-step.** After a mutation that changes draft content: (1) 100ms delay for DB transaction to commit, (2) `await queryClient.invalidateQueries(...)`, (3) `agentUIActions.refreshPreview()`. Fire-and-forget invalidation without await leaves the iframe showing stale content. _(Source: ONBOARDING_PREVIEW_STATE_GUARDS_AND_STALE_IFRAME_FIX, CACHE_INVALIDATION_RACE_CONDITION_PREVENTION)_

- **PostMessage requires sender/handler pairs and origin validation.** Every message type needs a definition, a sender, and a handler -- all in the same commit. Dead PostMessage handlers (handler exists but no sender) are "zombie code" that looks functional but never executes. All listeners must call `isSameOrigin(event.origin)` FIRST, then parse with Zod SECOND. _(Source: POSTMESSAGE_QUICK_REFERENCE)_

## Phase 6: Checklist + Prompt

- **Prompt simplification yields better agent behavior.** A 668-line system prompt with 30+ "NEVER"/"DON'T" rules was counterproductive; 82 occurrences of "section" leaked into agent speech despite being "forbidden" (attention priming). The redesigned 193-line prompt uses positive framing only, judgment criteria instead of decision trees, and features as self-contained sections. Hard cap: under 200 lines. _(Source: PROMPT_SIMPLIFICATION_AGENT_NATIVE)_

- **Agent-UI parity is critical.** Every action a user can perform through the checklist UI needs a corresponding agent tool. The original build mode had publish/discard buttons in the UI but no agent tools for those actions, creating a dead-end for users who asked the agent to publish. _(Source: build-mode-storefront-editor-patterns)_

- **TanStack Query deduplicates shared data fetches.** The onboarding state hook used `useState + useEffect`, causing duplicate API calls when multiple components mounted. Convert to `useQuery` with a registered query key for automatic deduplication. Any onboarding-state or checklist-progress hooks must use TanStack Query, not manual fetch patterns. _(Source: tanstack-query-api-deduplication-useOnboardingState)_

## Phase 7: Hybrid Editing

- **Draft system must have clear boundaries.** Content changes go to draft; branding changes go live immediately. This split is intentional (branding is atomic and easily reversible; content is complex and benefits from staging). Document the split in tool descriptions so the agent knows which changes are immediate vs. staged. _(Source: build-mode-storefront-editor-patterns)_

- **DRY shared schemas between tools and executors.** Zod schemas duplicated between tool definitions and execution handlers diverge over time. Extract to a shared module (`schemas/storefront-schemas.ts`) that both import from. _(Source: build-mode-storefront-editor-patterns)_

- **PostMessage protocol uses discriminated unions with Zod.** Parent-to-iframe and iframe-to-parent messages are typed as discriminated unions validated at runtime. Never type-cast `event.data as SomeType` without parsing. Use a central message type registry. _(Source: build-mode-storefront-editor-patterns, POSTMESSAGE_QUICK_REFERENCE)_

- **N+1 query patterns in editors.** Each storefront executor made 2-4 separate DB calls (get draft, save draft, get slug). Combine into a single query with all needed fields via `select`. _(Source: build-mode-storefront-editor-patterns)_

## Cross-Cutting Concerns

- **100ms delay before all cache invalidations.** HTTP 200 can be sent before the database transaction commits. Frontend refetch outpaces the DB on fast networks. Every `invalidateQueries()` call must be preceded by `await new Promise(resolve => setTimeout(resolve, 100))`, must use `refetchType: 'active'`, and must be awaited. _(Source: CACHE_INVALIDATION_RACE_CONDITION_PREVENTION)_

- **Zustand selectors that return objects cause re-renders.** A selector like `(state) => ({ completed: state.x, total: state.y })` creates a new object reference on every call. Use `useShallow()`, split into primitive selectors, or use `createSelector` from reselect. _(Source: ZUSTAND_SELECTOR_NEW_OBJECT_PREVENTION)_

- **Multi-tenant isolation in every query.** All database queries MUST filter by `tenantId`. Cache keys MUST include `tenantId`. Storage paths MUST be prefixed with `tenantId/`. Signed URLs instead of public URLs. This applies to every phase of onboarding. _(Source: file-upload-security-hardening, atomic-tenant-provisioning-defense-in-depth, multi-tenant-stripe-checkout-url-routing)_

- **DI container for all services.** Services must be created once in `di.ts` and injected everywhere. Direct `new Service()` in route files creates multiple instances, prevents test mocking, and leads to inconsistent behavior. Every new service introduced in the redesign must be added to the DI container. _(Source: atomic-tenant-provisioning-defense-in-depth)_

- **Brand voice constraints apply to all agent-generated copy.** No filler ("Welcome to..."), no hype words (revolutionary, game-changing), no forbidden greetings (Great!, Absolutely!, Perfect!). Confirmations use: `got it | done | on it | heard` (tenant) / `all set | confirmed | noted` (customer). Read `VOICE_QUICK_REFERENCE.md` before any copy generation work. _(Source: tenant-storefront-content-authoring-workflow, PROMPT_SIMPLIFICATION_AGENT_NATIVE)_

- **Run full-flow tests, not just unit tests.** The two-phase init bug only appeared when Phase 1 ran before Phase 2 in sequence; unit testing each phase independently would never have caught it. Onboarding E2E tests must cover the complete signup-to-reveal journey. _(Source: TWO_PHASE_INIT_ANTIPATTERN)_

- **Seed data can create false negatives.** Published sections have a 5-minute LRU cache. After seeding or provisioning, content won't appear immediately. Don't re-run the pipeline thinking it failed. Document the cache TTL in test setup instructions. _(Source: tenant-storefront-content-authoring-workflow)_
