---
title: 'feat: Dashboard & Onboarding Rebuild — Apple-Style Closed System'
type: feat
date: 2026-02-06
status: reviewed
reviewers: DHH, Kieran (TypeScript), Code Quality
verdict: APPROVE WITH CHANGES (all incorporated below)
---

# Dashboard & Onboarding Rebuild

## Overview

Rebuild the HANDLED tenant dashboard and onboarding into an Apple-style closed system where the user just chats and we handle everything. The current dashboard (stats-first, full toolbar, multi-page tabs) becomes a preview-first, minimal-UI experience driven entirely by the AI agent.

**4-phase onboarding flow:**

1. **Discovery** — Agent-forward chat + "Coming Soon" ambient backdrop
2. **Reveal** — Animated full-site generation ("the wow moment")
3. **Guided Review** — Agent drives preview section-by-section with highlights + progress
4. **Publish** — Full-site publish with celebration + share modal

**Philosophy:** We've got it handled. User just chats.

---

## Problem Statement

Production testing on 2026-02-06 revealed 16 problems (3 fixed in PR #38, 13 remaining) that collectively break the onboarding experience:

**P0 Bugs:**

- PostMessage handshake fails every time → preview shows placeholders instead of real content
- No "Coming Soon" state for pre-build phase
- No animated reveal moment

**Architectural Debt:**

- Dashboard defaults to stats, not the user's website
- Full toolbar with desktop/mobile toggle, page tabs for dead multi-page model
- Agent stores facts generically but doesn't map info → sections
- Agent doesn't consistently drive the preview
- No section-by-section approval workflow
- No full-site publish (current model: per-section isDraft toggling)
- Sidebar designed for a different product

**Net effect:** New tenants land on a stats dashboard with zero data, must manually navigate to build mode, see "Preview Connection Failed", and abandon.

---

## UX Decisions (Confirmed)

| Decision                  | Choice                       | Rationale                                                                                                                          |
| ------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| First load                | **Agent-forward**            | Chat panel is prominent. Canvas shows "Coming Soon" as ambient backdrop. Conversation IS the experience.                           |
| Mobile reveal             | **Auto-dismiss drawer**      | Agent says "Take a look" → drawer auto-minimizes → reveal plays full-screen → user taps to reopen. Blur keyboard first.            |
| Sidebar during onboarding | **Hidden**                   | No sidebar until published. Full-bleed canvas + agent panel. Sidebar appears after publish as "you now have a business to manage." |
| Post-publish default      | **Live site preview**        | Dashboard always shows your live site. Stats accessible via "Insights" sidebar item.                                               |
| Review UI                 | **Highlight + progress bar** | Sage glow on section in preview + "Reviewing: 3 of 7" progress indicator in agent panel                                            |
| Publish celebration       | **Confetti + share modal**   | Confetti animation + modal with live URL, "Copy Link", share to social options                                                     |
| PostMessage strategy      | **API-first**                | Iframe always fetches draft config from API on load. PostMessage ONLY for real-time updates after connection. Single code path.    |
| Chat fix priority         | **Phase 1**                  | Moved from Week 4 to Week 1. Chat appearing to reset kills trust in 30 seconds.                                                    |

---

## State Machine (Source of Truth)

> _"If you can't draw it cleanly, the design isn't clean."_ — DHH review

### Canonical State Transition Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     ONBOARDING STATE MACHINE                    │
│                                                                 │
│  Backend is source of truth. Frontend derives rendering state.  │
│                                                                 │
│  ┌──────────────┐     slot machine says     ┌──────────────┐   │
│  │  DISCOVERING  │ ──── BUILD_FIRST_DRAFT ──→│   BUILDING   │   │
│  │              │                            │              │   │
│  │ Canvas:      │                            │ Canvas:      │   │
│  │ ComingSoon   │                            │ ComingSoon   │   │
│  │              │                            │ (building    │   │
│  │ Sidebar:     │                            │  indicator)  │   │
│  │ HIDDEN       │                            │              │   │
│  └──────────────┘                            └──────┬───────┘   │
│                                                     │           │
│                               first draft complete  │           │
│                               + iframe ready        │           │
│                                                     ▼           │
│                                              ┌──────────────┐   │
│                                              │  REVEALING   │   │
│                                              │              │   │
│                                              │ Canvas:      │   │
│                                              │ RevealTrans. │   │
│                                              │ (2.5s anim)  │   │
│                                              │              │   │
│                                              │ ONE-SHOT:    │   │
│                                              │ stored in DB │   │
│                                              └──────┬───────┘   │
│                                                     │           │
│                                      onComplete     │           │
│                                                     ▼           │
│                                              ┌──────────────┐   │
│                                              │  REVIEWING   │   │
│                                              │              │   │
│                                              │ Canvas:      │   │
│                                              │ PreviewPanel │   │
│                                              │ + highlight  │   │
│                                              │ + progress   │   │
│                                              │              │   │
│                                              │ Sidebar:     │   │
│                                              │ HIDDEN       │   │
│                                              └──────┬───────┘   │
│                                                     │           │
│                              all sections approved  │           │
│                              + user confirms        │           │
│                                                     ▼           │
│                                              ┌──────────────┐   │
│                                              │  PUBLISHED   │   │
│                                              │              │   │
│                                              │ Canvas:      │   │
│                                              │ PreviewPanel │   │
│                                              │ (live site)  │   │
│                                              │              │   │
│                                              │ Sidebar:     │   │
│                                              │ VISIBLE (4)  │   │
│                                              │ Home,Schedule│   │
│                                              │ Insights,    │   │
│                                              │ Settings     │   │
│                                              └──────────────┘   │
│                                                                 │
│  ANY STATE → ERROR (failure) → LAST_GOOD_STATE (recovery)       │
└─────────────────────────────────────────────────────────────────┘
```

### Invalid Transitions (Enforced at Type Level)

- `DISCOVERING` cannot skip to `REVIEWING` (must build first)
- `REVEALING` cannot revert to `DISCOVERING` (one-shot, persisted in DB)
- `PUBLISHED` cannot revert to `BUILDING` (site is live)
- `REVIEWING` can revisit sections (not monotonic per-section), but cannot revert to `DISCOVERING`

### Source of Truth: Backend `OnboardingProgress`

**New field on Tenant model (or dedicated table):**

```typescript
interface OnboardingProgress {
  phase: 'DISCOVERING' | 'BUILDING' | 'REVIEWING' | 'PUBLISHED';
  revealCompletedAt: DateTime | null; // One-shot guard for reveal
  completedSectionIds: string[]; // Sections approved during review
  currentSectionId: string | null; // Where user left off in review
  publishedAt: DateTime | null; // When site went live
}
```

**Rules:**

- Backend writes this record after every phase transition
- `getBootstrapData()` includes it so frontend + agent derive state from same source
- Agent session re-creation uses this to resume mid-review
- Frontend stores (agent-ui-store, refinement-store) are READ projections of this, not independent truth
- `revealCompletedAt` prevents re-reveal on page refresh or cross-device

---

## Store Architecture (Reviewer-Aligned)

### Boundary Contract

```
refinement-store  = BUSINESS STATE (what phase, which sections approved)
                    Derives from: backend OnboardingProgress
                    Updated by: agent dashboardActions + API responses

agent-ui-store    = RENDERING STATE (what component is on screen)
                    Derives from: refinement-store.mode + user navigation
                    Updated by: ContentArea routing logic

INVARIANT: refinement-store.mode and agent-ui-store.view.status MUST be consistent.
           When refinement-store.mode === 'reviewing', view.status MUST be 'preview'.
           Enforced via combined selector + runtime assertion in dev mode.
```

### ViewState Union (Exhaustive — No Default Case)

```typescript
type ViewState =
  | { status: 'coming_soon' }              // Discovery + Building phases
  | { status: 'revealing' }                 // One-shot animation (2.5s)
  | { status: 'preview'; config: PreviewConfig }  // Review + Published phases
  | { status: 'dashboard' }                 // Stats/Insights (post-publish only)
  | { status: 'loading'; target: string }   // Transitional
  | { status: 'error'; error: string; recovery?: () => void };

// ContentArea.tsx — EXHAUSTIVE, NO DEFAULT
switch (view.status) {
  case 'coming_soon':   return <ComingSoonDisplay />;
  case 'revealing':     return <Suspense fallback={<PreviewLoader />}><RevealTransition onComplete={...} /></Suspense>;
  case 'preview':       return <PreviewPanel ... />;
  case 'dashboard':     return <>{children}</>;
  case 'loading':       return <LoadingView />;
  case 'error':         return <ErrorView ... />;
  default: {
    const _exhaustive: never = view;  // Compile error if case missing
    return <>{children}</>;
  }
}
```

### Refinement Store (Simplified — No Tone Variants)

```typescript
interface RefinementState {
  mode: 'idle' | 'discovering' | 'building' | 'reviewing' | 'publish_ready';
  reviewOrder: string[]; // Section IDs in review order (from backend)
  currentReviewIndex: number; // -1 if not reviewing
  completedSections: string[]; // Array, NOT Set (Zustand+immer compat, JSON-serializable)
  publishStatus: 'idle' | 'publishing' | 'published';
}
```

**Migration note:** Existing `RefinementMode` enum values change (`interview`→`discovering`, `draft_build`→`building`, `guided_refine`→`reviewing`). Consumers to update: `AgentPanel.tsx`, `layout.tsx`, `SectionWidget.tsx`. Run: `grep -rn "interview\|draft_build\|guided_refine" apps/web/src/` before renaming.

### Reveal Action Lifecycle (No Timer in Store)

```typescript
// Store action — sets state only, no side effects
revealSite: () => set((state) => {
  state.view = { status: 'revealing' };
  logAction('REVEAL_SITE', state.tenantId);  // Event sourcing
}),

// RevealTransition component — owns the timer
const RevealTransition = ({ onComplete }: { onComplete: () => void }) => {
  // framer-motion orchestrated animation
  // On animation complete: onComplete() → calls agentUIActions.showPreview()
};
```

---

## Technical Approach

### Phase 1: Foundation — Fix What's Broken (Week 1)

The boring but critical work. Fix PostMessage, fix chat persistence, simplify layout, establish new default view.

#### 1.1 Preview: API-First Loading (P0)

**Problem:** PostMessage handshake fails due to timing race. Dual code paths (PostMessage primary + API fallback) create maintenance hazard.

**Decision (Kieran recommendation, confirmed):** Make iframe-fetches-own-config the PRIMARY and ONLY initial load path. Eliminate PostMessage for initial config delivery entirely.

**Files:**

- `apps/web/src/components/preview/PreviewPanel.tsx:198-253`
- `apps/web/src/lib/build-mode/useBuildModeSync.ts`
- `apps/web/src/lib/build-mode/config.ts`
- `apps/web/src/app/t/[slug]/page.tsx` (storefront page — must handle API fetch)

**Changes:**

1. **Iframe loads its own config:** Preview iframe URL includes `?preview=draft&token=JWT`. Storefront page fetches draft config from API on mount using the token. No waiting for PostMessage.
2. **PostMessage for updates only:** After initial load, PostMessage used for: `CONFIG_UPDATE` (real-time edits), `HIGHLIGHT_SECTION_BY_ID`, `CLEAR_HIGHLIGHT`. NOT for initial config.
3. **Remove handshake timeout:** No more `BUILD_MODE_READY` → `BUILD_MODE_INIT` dance for initial load. Iframe is self-sufficient.
4. **Keep retry for PostMessage connection:** After iframe loads, establish PostMessage channel for real-time updates. Retry at T=500ms, T=1500ms, T=4000ms. If fails, real-time updates degrade gracefully (user can manual refresh).

**Test strategy (reviewer-requested):**

- Unit test: Extract retry logic into `createRetrySchedule(maxRetries, backoffMs[])` pure function. Test in isolation with mock timers.
- Integration test: Mock `window.postMessage` to no-op. Verify iframe loads content from API without PostMessage.
- E2E test: Verify preview shows draft content on first navigation.

**Acceptance:**

- [ ] Preview loads via API on first navigation (no PostMessage dependency)
- [ ] PostMessage establishes for real-time updates after load
- [ ] Preview loads successfully after page navigation
- [ ] Preview works in development with React Strict Mode
- [ ] Single code path for initial load (no dual-path divergence)

#### 1.2 Fix Chat Session Persistence (P1 — Moved from Phase 5)

**Problem:** Chat appears to reset on navigation. Session IS persisted but callback dependency cascade causes re-initialization + "Connecting..." flash.

**File:** `apps/web/src/hooks/useTenantAgentChat.ts`

**Root cause (Kieran diagnosis):** `initializeSession` useEffect runs on every callback reference change. The dependency chain: `initializeSession` → `fetchAgentGreeting` → `onDashboardActions` → `handleDashboardActions` → `queryClient`. Even though `queryClient` is stable, the function definitions cascade re-renders.

**Fix (specific pattern, not vague "wrap in useCallback"):**

```typescript
// Guard against re-initialization
const hasInitializedRef = useRef(false);
useEffect(() => {
  if (hasInitializedRef.current) return;
  hasInitializedRef.current = true;
  initializeSession();
}, []); // eslint-disable-line react-hooks/exhaustive-deps — intentional mount-only

// Loading state distinction
type ConnectionStatus = 'connecting' | 'reconnecting' | 'ready' | 'error';
// On reconnect (session exists in localStorage): show "Resuming..." not "Connecting..."
```

**Acceptance:**

- [ ] Navigation between views doesn't show "Connecting..."
- [ ] Chat history persists across navigation
- [ ] Session ID stable across page views
- [ ] `hasInitializedRef` prevents double-init in React Strict Mode

#### 1.3 Strip Build Mode Toolbar

**Problem:** 7 page tabs, viewport toggle, shred/save/close buttons. Architecture is single scrolling page.

**Files:**

- `apps/web/src/components/preview/PreviewPanel.tsx:364-411` (page tabs)
- `apps/web/src/components/preview/PreviewPanel.tsx:386-411` (viewport toggle)

**Changes:**

1. Remove page tabs entirely
2. Remove viewport toggle
3. Remove "Open in new tab" button
4. Remove shred/save/close buttons (publish moved to agent-controlled flow)
5. Keep only: Refresh (icon-only, top-right corner)
6. Result: PreviewPanel becomes a clean, full-bleed iframe wrapper with zero chrome

**Dead code audit (Pitfall #88):** After removal, run PostMessage 3-minute audit:

```bash
grep "z\.literal(" apps/web/src/lib/build-mode/protocol.ts
# For EACH type, verify sender AND handler exist
```

**Acceptance:**

- [ ] No toolbar visible
- [ ] Preview fills full available width/height
- [ ] Refresh still works (PostMessage `CONFIG_UPDATE`)
- [ ] No dead PostMessage handlers remain

#### 1.4 Dashboard Default → Preview + Hidden Sidebar

**Problem:** `/tenant/dashboard` shows stats cards. New tenants see empty stats. Sidebar shows nav for features they haven't unlocked.

**Files:**

- `apps/web/src/app/(protected)/tenant/dashboard/page.tsx`
- `apps/web/src/app/(protected)/tenant/layout.tsx`
- `apps/web/src/stores/agent-ui-store.ts`
- `apps/web/src/components/layouts/AdminSidebar.tsx`

**Changes:**

**Layout:**

1. On mount, fetch `onboardingProgress` from bootstrap data
2. If `phase !== 'PUBLISHED'` → hide sidebar entirely, set view to `coming_soon`
3. If `phase === 'PUBLISHED'` → show sidebar (4 items), set view to `preview` (live site)
4. Agent panel always visible (right-docked desktop, FAB + bottom sheet mobile)

**Sidebar (post-publish only):**

1. Collapsed to icon-only by default (64px), expand on hover (200ms ease)
2. 4 items: Home (House), Schedule (Calendar), Insights (BarChart3), Settings (Cog)
3. Mobile: hamburger + drawer, same 4 items

**Acceptance:**

- [ ] New tenants: NO sidebar visible, full-bleed canvas + agent panel
- [ ] Published tenants: sidebar appears with 4 items
- [ ] Sidebar transition on publish is smooth (fade-in, no jarring layout shift)
- [ ] Mobile: no sidebar during onboarding, hamburger appears after publish

---

### Phase 2: The Experience — Coming Soon + Reveal (Week 2)

The emotional core of the product.

#### 2.1 "Coming Soon" Display Component

**New file:** `apps/web/src/components/preview/ComingSoonDisplay.tsx`

**Purpose:** Ambient backdrop during Discovery and Building phases. Agent-forward layout means this is secondary to the chat panel.

**Design:**

```
┌─────────────────────────────────────┐
│                                     │
│         ✦ (subtle shimmer)          │
│                                     │
│    Your website is being crafted    │
│                                     │
│    ● businessType                   │
│    ● location                       │
│    ○ services...                    │
│                                     │
│    "Keep talking — every detail     │
│     makes it better."              │
│                                     │
└─────────────────────────────────────┘
```

**Data flow (reviewer-requested specification):**

The slot metrics (`filled/total`) and individual fact keys are NOT currently available via `useOnboardingState()`. Two options:

**Chosen: Option B — Pipe through agent tool results.** When `store_discovery_fact` tool completes, the `handleTenantAgentToolComplete` handler already invalidates onboarding state. Extend it to also dispatch fact keys to a lightweight local store:

```typescript
// In AgentPanel.handleTenantAgentToolComplete
const factTool = toolCalls.find((c) => c.name === 'store_discovery_fact');
if (factTool?.result) {
  comingSoonActions.addDiscoveredFact({
    key: factTool.result.key,
    filled: factTool.result.slotMetrics.filled,
    total: factTool.result.slotMetrics.total,
  });
}
```

This gives near-instant updates (no network round-trip) and avoids adding a polling endpoint.

**Also extend `useOnboardingState` response** to include `slotMetrics` for hydration on page load (so ComingSoon shows correct state after refresh). Add `slotMetrics: { filled, total, factKeys[] }` to the onboarding state API response.

**Design tokens:**

- Background: `#18181B` (graphite dark) with radial gradient from center
- Text: `#FAFAFA` with `font-serif` headline
- Progress: sage (`#45B37F`) filled dots, `#3F3F46` unfilled dots
- Animation: shimmer on icon (CSS keyframes), staggered fade-in on fact dots (framer-motion)
- Encouraging copy array: ["Keep talking — every detail makes it better.", "Almost there — a few more details.", "Looking good — your site is taking shape."]
- No technical terms: "businessType" shown as "What you do ✓", "location" as "Where you're based ✓"

**Acceptance:**

- [ ] Displays when `onboardingProgress.phase` is `DISCOVERING` or `BUILDING`
- [ ] Progress dots update within 200ms of agent storing a fact
- [ ] Fact labels are human-readable (not slot keys)
- [ ] Responsive: centered on desktop, stacked on mobile
- [ ] Correct state after page refresh (hydrated from onboarding API)

#### 2.2 Animated Reveal Transition

**New file:** `apps/web/src/components/preview/RevealTransition.tsx` (lazy-loaded in ContentArea)

**Pre-condition (reviewer P0):** Reveal MUST NOT play until iframe is ready. Check for iframe load success before triggering animation.

**Animation sequence — Desktop (2.5s total):**

1. `T=0ms` — ComingSoon fades out (opacity 1→0, 400ms ease-out)
2. `T=300ms` — White flash overlay (opacity 0→0.6→0, 300ms) — "camera flash" effect
3. `T=500ms` — Preview iframe fades in from below (translateY 40px→0, opacity 0→1, 800ms spring)
4. `T=1300ms` — Smooth auto-scroll from top to bottom (2s linear)
5. `T=3300ms` — `onComplete()` fires → agentUIActions.showPreview()

**Animation sequence — Mobile:**

- Auto-dismiss Vaul drawer BEFORE animation starts
- `document.activeElement?.blur()` to dismiss iOS keyboard
- **Fade only, no auto-scroll** (viewport too small for scroll tour — Kieran recommendation)
- Sequence: ComingSoon fades out → preview fades in (1.5s total)

**Animation sequence — `prefers-reduced-motion`:**

- Instant switch: ComingSoon unmounts, preview mounts. No animation.

**Iframe readiness guard (reviewer P0):**

```typescript
const RevealTransition = ({ onComplete }: Props) => {
  const [iframeReady, setIframeReady] = useState(false);

  // Pre-load iframe behind ComingSoon overlay
  // Listen for BUILD_MODE_READY or iframe onLoad event
  // Only start animation sequence when iframeReady === true

  if (!iframeReady) {
    return <ComingSoonDisplay buildingIndicator="Putting finishing touches on..." />;
  }

  return <AnimatedRevealSequence onComplete={onComplete} />;
};
```

**Test strategy (reviewer-requested):**

- Unit test: `RevealTransition` accepts `onComplete` prop + `reducedMotion` prop. Test that `onComplete` is called. Test reduced-motion path skips animation.
- E2E test: `page.emulateMedia({ reducedMotion: 'reduce' })` to test reduced-motion.
- Do NOT test animation timing in unit tests.

**Acceptance:**

- [ ] Iframe confirmed ready before animation starts
- [ ] Smooth 2.5s transition on desktop
- [ ] Auto-dismiss drawer + fade-only on mobile
- [ ] `prefers-reduced-motion`: instant switch
- [ ] Reveal fires exactly once per tenant (guarded by `revealCompletedAt` in DB)
- [ ] Page refresh after reveal shows preview directly

#### 2.3 REVEAL_SITE Dashboard Action

**Type changes (reviewer P0 — add to ALL locations):**

```
packages/contracts/src/types/dashboard-action.ts  (NEW — shared contract)
  → Add 'REVEAL_SITE' to DashboardActionType union

server/src/services/section-content.service.ts
  → Import DashboardActionType from contracts

apps/web/src/hooks/useTenantAgentChat.ts
  → Import DashboardActionType from contracts

apps/web/src/stores/agent-ui-store.ts
  → Add 'REVEAL_SITE' to AgentActionType for event sourcing audit trail
```

**Backend change — first-draft tool:**
After building all sections:

```typescript
return {
  success: true,
  dashboardAction: { type: 'REVEAL_SITE' },
  // ... existing fields
};
```

Also write `revealCompletedAt` to backend:

```typescript
await onboardingProgressRepo.update(tenantId, {
  phase: 'REVIEWING',
  revealCompletedAt: new Date(),
});
```

**Frontend change — AgentPanel:**

```typescript
case 'REVEAL_SITE':
  // On mobile: dismiss drawer first, blur keyboard
  if (isMobile) {
    document.activeElement?.blur();
    setIsMobileOpen(false);
    await new Promise(r => setTimeout(r, 300)); // Wait for drawer dismiss animation
  }
  agentUIActions.revealSite();
  break;
```

**Acceptance:**

- [ ] `REVEAL_SITE` type exists in shared contracts package
- [ ] Agent triggers reveal after first draft completes
- [ ] `revealCompletedAt` persisted to DB (one-shot guard)
- [ ] Event sourcing log records REVEAL_SITE action
- [ ] Mobile: drawer auto-dismisses before reveal

---

### Phase 3: Agent Intelligence — Section-Aware Discovery (Week 2-3)

#### 3.1 Rewrite Tenant Agent System Prompt

**File:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

**Key additions:**

**Section Blueprint (reconciled with slot machine — reviewer P0):**

The slot machine defines 8 section types: hero, about, services, pricing, faq, contact, cta, testimonials. The prompt must match.

```markdown
## Section Blueprint (CRITICAL)

Your site has up to 8 sections. Each needs specific facts.

| #   | Section      | Required Facts                 | Nice-to-Have            | Your Question                                             |
| --- | ------------ | ------------------------------ | ----------------------- | --------------------------------------------------------- |
| 1   | HERO         | businessType, targetMarket     | uniqueValue             | "What do you do, and who do you do it for?"               |
| 2   | ABOUT        | personalStory, yearsInBusiness | approach                | "Give me the short version of your story."                |
| 3   | SERVICES     | servicesOffered                | specialization          | "Walk me through what you offer."                         |
| 4   | PRICING      | servicesOffered, priceRange    | —                       | (Built from services — clarify if detailed tiers needed)  |
| 5   | TESTIMONIALS | testimonial                    | —                       | "Got a favorite client quote? Even a text message works." |
| 6   | FAQ          | businessType, servicesOffered  | —                       | (Auto-generated)                                          |
| 7   | CONTACT      | contactInfo                    | location, businessHours | "Where do people find you?"                               |
| 8   | CTA          | businessType, targetMarket     | —                       | (Mirrors HERO — no extra question)                        |
```

**How You Build Each Section** _(same content as original plan — HERO, ABOUT, SERVICES, etc.)_

**Financial Safety Protocol:**

```markdown
## Financial Safety Protocol

If user mentions dollars, price, cost, or package pricing:

1. Pause before acting
2. Ask ONE clarification: "Checkout price or just the text on your site?"
3. Default to safe: text changes only unless explicitly confirmed
```

**Guided Review Protocol (reviewer-aligned):**

```markdown
## Guided Review Protocol

After the reveal, walk through each section:

1. Call get_next_incomplete_section() to determine the next section (do NOT hardcode order)
2. Call scroll_to_website_section(sectionId) to navigate preview
3. Explain the section: what it does, why you wrote it this way
4. Ask for feedback: "Anything feel off? I can rewrite the parts that don't sound like you."
5. On approval: call mark_section_complete(sectionId), then get_next_incomplete_section()
6. On changes: call update_section, wait for feedback, then mark complete

### Scope Clarification (CRITICAL)

- Lead Partner Rule applies to BUILDING decisions (what to write, which headline to use)
- Guided Review Protocol applies to REVIEWING decisions (present confidently, but WAIT for approval before advancing)
- During review: present your work confidently, but DO NOT skip ahead without user's signal

### Escape Hatches

- "just finish it" / "looks good" / "I trust you" → batch-complete remaining sections with best defaults, move to publish
- "skip" / "next" → advance to next section without explicit approval
- "go back" → revisit previous section
- "go live" / "ship it" → publish immediately, skip remaining review

After all sections reviewed:
"All set. Ready to go live? This publishes your site at gethandled.ai/t/[slug]."
```

**When Tools Fail (reviewer-requested):**

```markdown
## When Tools Fail

- build_first_draft fails: try once more. If still fails: "Hit a snag building your site. I've saved everything you told me — want me to try again?"
- update_section fails: "That edit didn't stick. Trying again." → retry once → if fails: "Something's off. Your previous version is still there."
- publish_draft fails: "Publishing failed. Your draft is safe — want me to try again?"
- NEVER blame the user. NEVER say "server error" or "API failed" or any technical term.
```

**Prompt testing strategy (reviewer-required):**

| Business Type                     | Test Scenario         | Expected Behaviors                                                     |
| --------------------------------- | --------------------- | ---------------------------------------------------------------------- |
| Wedding photographer (Austin)     | Standard flow         | Location-forward hero, services with packages, testimonial if provided |
| Life coach (virtual, no location) | No-location edge case | Hero without location, contact without address                         |
| Therapist (team of 3)             | Team-based business   | About section uses "we" not "I", team mention                          |
| Wedding planner (bilingual EN/ES) | Bilingual edge case   | Agent asks language preference, single-language site                   |
| Dog groomer (mobile service)      | Service-area business | "Serving [area]" hero, no fixed address contact                        |

**Effort note:** Add 5-7 hours for prompt testing across all scenarios. Include in Phase 3 estimate.

**Acceptance:**

- [ ] Prompt references all 8 section types (matching slot machine)
- [ ] Agent follows `get_next_incomplete_section()` tool order (not hardcoded)
- [ ] Lead Partner Rule scoped to building; Guided Review waits for approval
- [ ] Escape hatches work ("just finish it", "skip", "go back", "ship it")
- [ ] Error handling instructions in prompt (retry, human-readable errors)
- [ ] Tested across 5 business types with documented results

#### 3.2 Extend Slot Machine for Section Readiness

**File:** `server/src/lib/slot-machine.ts`

**Changes:**

```typescript
interface SectionReadiness {
  sectionType: string; // 'hero', 'about', 'pricing', etc. (all 8)
  isReady: boolean;
  knownFacts: string[];
  missingFacts: string[];
  quality: 'minimal' | 'good' | 'excellent';
}
```

Slot machine returns `sectionReadiness: SectionReadiness[]` alongside existing `readySections[]`.

**Canonical section list:** Define in `packages/contracts/` and import in both slot machine and prompt. Single source of truth.

**Acceptance:**

- [ ] All 8 section types have readiness data
- [ ] Quality tiers computed correctly
- [ ] Backward compatible (existing `readySections` unchanged)

#### 3.3 Agent Context: Section-Aware Bootstrap

**File:** `server/src/services/context-builder.service.ts`

**Changes to `getBootstrapData()`:**

```typescript
return {
  // ... existing fields (knownFacts, forbiddenSlots, storefrontState)
  sectionBlueprint: SectionReadiness[],                    // From slot machine
  onboardingProgress: OnboardingProgress,                  // Phase, reveal status, review progress
  reviewProgress: {                                        // NEW (reviewer-requested)
    completedSectionIds: string[],
    currentSectionId: string | null,
  },
};
```

**Why `reviewProgress` is critical:** If the agent session is silently re-created mid-review (session expired), the agent MUST know where the user left off. Without this, the agent restarts the review from Hero, which is a terrible UX.

**Acceptance:**

- [ ] Bootstrap includes section readiness per section
- [ ] Bootstrap includes review progress for session resumption
- [ ] Agent can resume guided review mid-way after session re-creation

---

### Phase 4: Guided Review + Publish (Week 3)

#### 4.1 Section Status Tracking

**File:** `apps/web/src/stores/refinement-store.ts`

**Changes:**

1. Rename mode values: `interview`→`discovering`, `draft_build`→`building`, `guided_refine`→`reviewing`
2. Keep `completedSections` as `string[]` (NOT `Set` — Zustand+immer compat)
3. Add `publishStatus: 'idle' | 'publishing' | 'published'`
4. Remove tone variant types (`ToneVariant`, `VariantContent`, `SectionVariants`) — dead code for this release. Mark with `@deprecated` or remove entirely.
5. Add mode transition validation:

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  idle: ['discovering'],
  discovering: ['building'],
  building: ['reviewing'], // After reveal
  reviewing: ['publish_ready'], // All sections approved
  publish_ready: ['reviewing'], // User wants to re-review (exception to monotonicity)
};
```

**Consumer migration:** Update all files importing old mode values:

```bash
grep -rn "interview\|draft_build\|guided_refine" apps/web/src/
```

**Acceptance:**

- [ ] Mode transitions validated (invalid transitions rejected in dev mode)
- [ ] `completedSections` is `string[]` (JSON-serializable)
- [ ] Dead tone variant types removed or deprecated
- [ ] All consumers updated to new mode values
- [ ] Clean typecheck passes

#### 4.2 Guided Review: Agent Drives the Preview

**How it works:**

1. Agent calls `get_next_incomplete_section()` → returns next section
2. Agent calls `scroll_to_website_section(sectionId)` → preview scrolls
3. Agent explains section purpose and writing decisions
4. User approves or requests changes
5. On approve: `mark_section_complete(sectionId)` → store updates → progress bar advances
6. On change: `update_section(sectionId, ...)` → preview updates real-time via PostMessage
7. Repeat

**Section highlight in preview:**

- PostMessage: `BUILD_MODE_HIGHLIGHT_SECTION_BY_ID` (already exists)
- Style: 2px sage border + `box-shadow: 0 0 20px rgba(69, 179, 127, 0.15)`
- Auto-clear after 5s or on next chat interaction

**Progress indicator in AgentPanel:**

- Below chat header: sage progress bar + "Reviewing: 3 of 7 sections"
- Shows during `mode === 'reviewing'` only
- Subtle — doesn't compete with chat

**WCAG (reviewer-requested):** When section changes during review, announce to screen reader:

```typescript
announcer.current!.textContent = `Now reviewing ${sectionName} section. ${index} of ${total}.`;
```

**Acceptance:**

- [ ] Agent auto-scrolls preview to section under review
- [ ] Sage glow highlight on active section
- [ ] Progress bar shows "X of Y sections reviewed"
- [ ] "skip", "go back" escape hatches work
- [ ] Screen reader announces section changes

#### 4.3 Full-Site Publish Flow

**Transaction safety (reviewer P1):** Verify `SectionContentService.publishAll()` runs in a database transaction. If NOT, wrap in `prisma.$transaction()`. Partial publish (some sections live, others draft) is unacceptable.

**Agent flow:**

```
Agent: "All sections reviewed. Ready to go live?
        This publishes at gethandled.ai/t/your-slug."
User: "ship it"
Agent: publish_draft({ confirmationReceived: true })
→ Backend: publishAll() in transaction
→ Backend: set onboardingProgress.phase = 'PUBLISHED', publishedAt = now()
Agent: "Done. Your site is live."
→ Frontend: PublishConfirmation modal
```

**New component:** `apps/web/src/components/preview/PublishConfirmation.tsx`

```
┌────────────────────────────────────┐
│                                    │
│         🎉 (confetti, 2s)         │
│                                    │
│    Your site is live              │
│                                    │
│    gethandled.ai/t/your-slug      │
│                                    │
│    ┌──────────┐ ┌──────────────┐  │
│    │ Copy Link │ │ Share        │  │
│    └──────────┘ └──────────────┘  │
│                                    │
│    ┌──────────────────────────┐   │
│    │ View Your Site →         │   │
│    └──────────────────────────┘   │
│                                    │
└────────────────────────────────────┘
```

**Share options:** Copy link, share to Twitter/X, share to Instagram (copy link for IG stories), share to Facebook.

**Post-publish:** Sidebar fades in (4 items). View transitions to live site preview. Agent says something like: "You've got a website. Now let's get you booked. Need help with scheduling or pricing?"

**Acceptance:**

- [ ] `publishAll()` confirmed to run in DB transaction
- [ ] Confetti + share modal on successful publish
- [ ] Copy link, share to social buttons work
- [ ] Sidebar appears after publish (smooth transition)
- [ ] Agent transitions to post-onboarding mode
- [ ] Preview shows live site (not draft) after publish

---

### Phase 5: Hardening + Telemetry (Week 4)

#### 5.1 Mobile Experience

- Auto-dismiss drawer before reveal (with `blur()` for iOS keyboard)
- No auto-scroll on mobile (fade only, regardless of reduced-motion pref)
- ComingSoon: full-screen, progress at bottom
- Test on real iPhone (iOS Safari) and Android (Chrome) — not just responsive browser

**Acceptance:**

- [ ] Tested on real iOS Safari device
- [ ] Tested on real Android Chrome device
- [ ] Reveal animation correct on both platforms
- [ ] Keyboard dismisses before reveal

#### 5.2 Concurrent Tab Handling

**Problem (DHH):** Tab A stores a fact, Tab B doesn't know. Tab A triggers reveal, Tab B shows ComingSoon.

**Solution:** `BroadcastChannel` for cross-tab sync:

```typescript
const channel = new BroadcastChannel('handled-onboarding');
channel.onmessage = (event) => {
  if (event.data.type === 'FACT_STORED') comingSoonActions.addDiscoveredFact(event.data);
  if (event.data.type === 'PHASE_CHANGED') refinementActions.syncPhase(event.data.phase);
  if (event.data.type === 'REVEALED') agentUIActions.showPreview();
};
```

**Acceptance:**

- [ ] Fact stored in Tab A appears in Tab B within 500ms
- [ ] Reveal in Tab A transitions Tab B to preview
- [ ] No errors if BroadcastChannel unsupported (graceful degradation)

#### 5.3 Structured Telemetry Events

**Required for success metrics (DHH — "you cannot measure without instrumentation"):**

```typescript
// Event types
telemetry.track('onboarding.fact_stored', { key, factNumber, timestamp });
telemetry.track('onboarding.reveal_triggered', { timeSinceFirstMessage, sectionCount });
telemetry.track('onboarding.section_approved', { sectionType, revisionCount, timeInReview });
telemetry.track('onboarding.section_skipped', { sectionType });
telemetry.track('onboarding.published', { timeSinceFirstMessage, sectionCount, reviewDuration });
telemetry.track('onboarding.error', { errorType, phase, recoveryAction });
```

**Effort:** 3-4 hours. Non-negotiable for measuring success.

**Acceptance:**

- [ ] All 6 event types fire correctly
- [ ] Events include timestamps for duration calculation
- [ ] No PII in events (tenantId only, no names/emails)

#### 5.4 Error Recovery (Comprehensive)

| Error                      | Phase     | Recovery                                                                                                                                 |
| -------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Iframe fails to load       | Reveal    | Hold on ComingSoon with "Putting finishing touches on..." until ready. Timeout after 15s → show preview in whatever state + error banner |
| Agent unavailable          | Discovery | ComingSoon shows "Still here — refresh to reconnect" after 2 min of no activity                                                          |
| Agent tool failure         | Any       | Agent retries once, then human-readable error (no technical terms)                                                                       |
| Session expired mid-review | Review    | Silent re-create with `reviewProgress` from bootstrap. User sees no interruption                                                         |
| Partial publish failure    | Publish   | Transaction rollback — nothing publishes. Agent: "Publishing failed. Draft is safe."                                                     |
| Draft save failure         | Review    | Toast + auto-retry with backoff. Agent: "That edit didn't stick. Trying again."                                                          |

**Acceptance:**

- [ ] No error state leaves user stuck
- [ ] All errors have automatic recovery or clear next steps
- [ ] Agent communicates in natural language

---

## Acceptance Criteria

### Functional Requirements

- [ ] New tenant: no sidebar, agent-forward chat + ComingSoon backdrop
- [ ] ComingSoon progress updates in real-time
- [ ] Animated reveal when first draft complete (iframe verified ready)
- [ ] Mobile: drawer auto-dismisses before reveal
- [ ] Guided review with sage highlight + progress bar
- [ ] Escape hatches work (skip, go back, just finish it, ship it)
- [ ] Full-site publish in DB transaction with confetti + share modal
- [ ] Sidebar appears after publish
- [ ] Chat persists across navigation (no "Connecting..." flash)
- [ ] Preview loads via API (no PostMessage dependency for initial load)

### Non-Functional Requirements

- [ ] Reveal: <3s desktop, <2s mobile
- [ ] Preview initial load: <2s
- [ ] First message to first draft: <5 min
- [ ] First draft to publish: <10 min
- [ ] `prefers-reduced-motion` respected
- [ ] WCAG AA: screen reader announces during guided review
- [ ] No console errors in production

### Quality Gates

- [ ] All existing tests pass
- [ ] New tests: ComingSoonDisplay, RevealTransition (callback + reduced-motion), PublishConfirmation, PostMessage retry (pure function)
- [ ] E2E: full onboarding flow (discovery → reveal → review → publish)
- [ ] Prompt regression: tested across 5 business types with documented results
- [ ] Clean typecheck: `rm -rf server/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`
- [ ] Manual test on real iPhone Safari + Android Chrome
- [ ] Brand voice audit: no forbidden phrases
- [ ] Dead PostMessage handler audit (3-minute check)
- [ ] Dead code audit: no orphan tone variant types

---

## Implementation Order & Effort Estimates (Updated)

| Phase   | Task                                      | Effort    | Dependencies                 |
| ------- | ----------------------------------------- | --------- | ---------------------------- |
| **1.1** | API-first preview loading                 | 6-8 hrs   | None                         |
| **1.2** | Chat session persistence fix              | 3-4 hrs   | None                         |
| **1.3** | Strip build mode toolbar                  | 2-3 hrs   | None                         |
| **1.4** | Dashboard default + hidden sidebar        | 4-6 hrs   | 1.1 (preview must work)      |
| **2.1** | "Coming Soon" display + data flow         | 6-8 hrs   | 1.4 (layout ready)           |
| **2.2** | Animated reveal transition                | 8-10 hrs  | 2.1 + iframe readiness guard |
| **2.3** | REVEAL_SITE action (shared contracts)     | 3-4 hrs   | 2.2                          |
| **3.1** | Rewrite agent prompt + testing            | 10-14 hrs | None (parallel with Phase 2) |
| **3.2** | Extend slot machine + shared section list | 4-5 hrs   | None                         |
| **3.3** | Agent context bootstrap + review progress | 3-4 hrs   | 3.2                          |
| **4.1** | Section status tracking + mode migration  | 4-5 hrs   | 3.1                          |
| **4.2** | Guided review flow + a11y                 | 8-10 hrs  | 4.1 + 1.1                    |
| **4.3** | Full-site publish + celebration + share   | 6-8 hrs   | 4.2                          |
| **5.1** | Mobile experience (real device testing)   | 4-6 hrs   | All above                    |
| **5.2** | Concurrent tab handling                   | 2-3 hrs   | 2.1                          |
| **5.3** | Structured telemetry events               | 3-4 hrs   | All above                    |
| **5.4** | Error recovery (comprehensive)            | 4-5 hrs   | All above                    |

**Total estimate:** ~75-100 hours across 4 weeks

**Parallelizable:** Phase 1 tasks (1.1-1.3) in parallel. Phase 3.1 (prompt) parallel with Phase 2. Phase 5.2-5.3 parallel with each other.

---

## Success Metrics

| Metric                       | Current     | Target  | Measurement                                    |
| ---------------------------- | ----------- | ------- | ---------------------------------------------- |
| Time to first draft          | ~5 min      | <3 min  | `onboarding.reveal_triggered` event            |
| Time to publish              | ~20 min     | <10 min | `onboarding.published` event                   |
| Onboarding completion rate   | Unknown     | >80%    | Published / Started ratio                      |
| Preview load time            | N/A (fails) | <2s     | Performance monitoring                         |
| Agent re-ask rate            | High        | <5%     | Session analysis (forbiddenSlots working)      |
| First-pass section approval  | Unknown     | >80%    | `section_approved` events with revisionCount=0 |
| Mobile onboarding completion | Unknown     | >70%    | Device-segmented analytics                     |

---

## Documentation Plan

| Document                                 | Action                                                              | When             |
| ---------------------------------------- | ------------------------------------------------------------------- | ---------------- |
| `CLAUDE.md`                              | Update dashboard default, remove multi-page refs, add state machine | After Phase 1    |
| `docs/architecture/BUILD_MODE_VISION.md` | Rewrite to match new vision                                         | After Phase 2    |
| `ContentArea.tsx`                        | Add onboarding lifecycle comment block (reviewer-requested)         | After Phase 4    |
| `DEVELOPING.md`                          | Update dev workflow for new onboarding flow                         | After Phase 4    |
| `docs/solutions/`                        | Compound learnings from PostMessage + reveal                        | After each phase |

**ContentArea lifecycle comment (reviewer-requested):**

```typescript
/**
 * Onboarding Display Lifecycle:
 *
 * 1. DISCOVERING → ComingSoonDisplay (agent gathering facts)
 * 2. BUILDING → ComingSoonDisplay (agent building first draft)
 * 3. REVEALING → RevealTransition (animated site reveal, ~2.5s, one-shot)
 * 4. REVIEWING → PreviewPanel + sage highlight + progress indicator
 * 5. PUBLISHED → PreviewPanel (live site) + sidebar appears
 *
 * Source of truth: backend OnboardingProgress record
 * Frontend stores are read projections, not independent truth
 * Agent sessions bootstrap from OnboardingProgress for resume capability
 */
```

---

## References & Research

### Internal References

- **Handoff doc:** `docs/plans/2026-02-06-dashboard-rebuild-handoff.md`
- **Agent ecosystem brainstorm:** `docs/brainstorms/2026-02-04-ai-agent-ecosystem-roadmap-brainstorm.md`
- **Realtime preview brainstorm:** `docs/brainstorms/2026-02-01-realtime-storefront-preview-brainstorm.md`
- **Semantic storefront brainstorm:** `docs/brainstorms/2026-01-30-semantic-storefront-architecture-brainstorm.md`
- **PostMessage patterns:** `docs/solutions/patterns/POSTMESSAGE_QUICK_REFERENCE.md`
- **Autonomous first draft:** `docs/solutions/agent-issues/AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md`
- **Slot policy injection:** `docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md`
- **Brand voice:** `docs/design/VOICE_QUICK_REFERENCE.md`

### Reviewer Feedback (Incorporated)

| Reviewer         | Verdict              | Key Contributions                                                                                                                               |
| ---------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **DHH**          | Approve with changes | State machine diagram, backend OnboardingProgress, reveal persistence, telemetry, chat fix to Phase 1                                           |
| **Kieran**       | Approve with changes | Exhaustive ViewState switch, API-first PostMessage, Set→Array, timer anti-pattern, mobile reveal, iframe readiness guard                        |
| **Code Quality** | Approve with changes | Section list reconciliation, store boundary contract, review progress in bootstrap, prompt scope clarification, escape hatches, test strategies |

### Pitfalls to Watch

- **#4** PostMessage → Solved by API-first loading
- **#79** Orphan imports → Clean typecheck before every commit
- **#82** dashboardAction not extracted → Already fixed
- **#83** Agent re-asking → forbiddenSlots + bootstrap
- **#86** First draft placeholders → Prompt rewrite + section blueprint
- **#87** Zustand re-renders → `useShallow` on all object selectors
- **#88** Dead PostMessage handlers → 3-minute audit before shipping

---

_Plan created: 2026-02-06_
_Reviewed: 2026-02-06 (3 reviewers, all approve with changes — changes incorporated)_
_Ready for: `/workflows:work`_
