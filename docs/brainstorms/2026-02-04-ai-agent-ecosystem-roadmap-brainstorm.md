# AI Agent Ecosystem Roadmap Brainstorm

**Date:** 2026-02-04
**Status:** Approved for Planning
**Participants:** Mike Young, Claude (synthesis of ChatGPT, Gemini, and Grok inputs)

---

## What We're Building

A prioritized roadmap to evolve HANDLED's AI agent ecosystem from "good autonomous first draft" to "world-class business partner experience."

### North Star

> "Feel like you brought on a business partner who's a guru in everything you're not."

### Strategic Wedges (Prioritized)

1. **Primary:** Post-booking moat (Project Hub) — become indispensable after the booking
2. **Secondary:** Speed to live site (<15 min) — beat Wix on time-to-value, not features

### Timeline

**This month** — full Guided Refinement + Project Hub enhancement + agent hardening

---

## Why This Approach

### The Problem

The current agent has a working autonomous first draft (fixed 2026-02-03), but:

- No section-by-section refinement workflow
- No user control over individual sections
- All-or-nothing publish (no progressive option)
- Agent doesn't adapt tone to user sentiment
- No preference memory across sessions

### The Opportunity

Multiple external AI evaluations (ChatGPT, Gemini, Grok) converged on the same recommendations:

- **Guided Refinement Mode** is the #1 gap
- **3-variant widget** provides choice without overwhelm
- **Lead Partner behavior** differentiates from "helpful assistant" competitors
- **Post-booking depth** is a moat competitors can't easily copy

### Evidence

From ChatGPT synthesis:

> "The agent is very good — but it doesn't lead enough yet. If a decision affects conversion, clarity, trust, or first impression — the agent leads. The user reacts."

From Gemini red-team:

> "Your 'autonomous first draft' is correct. But without a state machine, the agent can thrash: rewrite the same sections, forget what's approved, or push forward too fast."

---

## Key Decisions

### Decision 1: Full Stack Implementation

**Chosen:** Build prompt + UI together as a unified feature

**Why:** The widget contract defines what the agent returns. Building them together ensures:

- Agent returns `variants[]` that the UI can display
- Widget state (`selectedVariant`, `isComplete`) flows back to agent
- Single source of truth for section completion

### Decision 2: Variant Labels

**Chosen:** Professional / Premium / Friendly

**Why:** Maps to target verticals:

- Coaches → Professional
- Photographers → Premium
- Therapists → Friendly

**Not dynamic per section** — keeps UI simple, avoids cognitive overload.

### Decision 3: Phase Order

**Chosen:** Guided Refinement → Project Hub → Agent Hardening → A2A Readiness

**Why:**

- Guided Refinement directly enables speed-to-live-site (secondary wedge)
- Project Hub is primary wedge, benefits from guided refinement learnings
- Hardening makes both more trustworthy
- A2A is future-facing, less urgent

---

## The Roadmap

### Phase 1: Guided Refinement (Week 1-2) — PRIMARY FOCUS

Build the complete section-by-section editing experience.

#### 1.1 Tenant Prompt vNext (4-6 hours)

Add to `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`:

**Lead Partner Rule:**

```markdown
## Lead Partner Rule (CRITICAL)

You are not a passive assistant.

When a decision materially affects:

- Conversion
- Clarity
- Trust
- First impression

You MUST lead with a recommendation before offering alternatives.

Pattern:

1. State your recommendation confidently
2. Give one-sentence rationale
3. Offer at most ONE alternative
4. Move forward unless user objects

Example:
"I'd go with option 2. It's clearer and converts better for your kind of client.
Want to ship that, or tweak the wording?"
```

**Guided Refinement Mode:**

```markdown
## Guided Refinement Mode (Post First Draft)

After first draft, offer a fork:
"Want to refine section-by-section, or publish as-is?"

In guided mode:

1. Work one section at a time
2. Generate 3 variants: Professional / Premium / Friendly
3. Present default (variant 1) with brief rationale
4. Wait for user to select, approve, or request changes
5. On checkmark: mark section complete, move to next
6. When all sections complete: "All set. Ready to publish?"

Escape hatches:

- "Just finish it" → batch-complete remaining sections with best defaults
- "Skip this" → move to next section
- "Go back" → revisit previous section
```

**Financial Safety Protocol:**

```markdown
## Financial Safety Protocol

If user mentions dollars, price, cost, or package pricing:

1. Pause before acting
2. Ask ONE clarification: "Checkout price or just the text on your site?"
3. Default to safe: text changes only unless explicitly confirmed

manage_packages = real money
update_section(pricing) = display text only
```

**Preference Memory:**

```markdown
## Preference Memory

Store HOW the user makes decisions, not just WHAT their business is.

When user says... | Store as brandPreference
"I trust you" → decisive
"Let me think" → cautious
"No fluff" → plainspoken
"Make it feel expensive" → premium

Use stored preferences to adapt:

- decisive → fewer options, faster pace
- cautious → more explanation, confirm before acting
- plainspoken → shorter copy, no marketing speak
- premium → luxury tone, sophisticated vocabulary
```

#### 1.2 Section State Machine (4-6 hours)

Add to agent session state:

```typescript
interface GuidedRefinementState {
  mode: 'interview' | 'draft_build' | 'guided_refine' | 'publish_ready';
  currentSectionId: string | null;
  completedSections: string[];
  sectionVariants: Record<
    string,
    {
      variants: [string, string, string]; // Professional, Premium, Friendly
      selectedIndex: 0 | 1 | 2;
      isComplete: boolean;
    }
  >;
  pendingUserDecision: 'none' | 'choose_variant' | 'approve_publish' | 'clarify_pricing';
}
```

Backend changes:

- Extend `ContextBuilder.getBootstrapData()` to include `guidedRefinementState`
- Add state persistence to session store
- Update agent tools to read/write state

#### 1.3 Floating Widget UI (8-12 hours)

Location: `apps/web/src/components/build-mode/SectionWidget.tsx`

```typescript
interface SectionWidgetProps {
  sectionId: string;
  variants: [string, string, string]; // Professional, Premium, Friendly
  selectedIndex: 0 | 1 | 2;
  isComplete: boolean;
  onSelectVariant: (index: 0 | 1 | 2) => void;
  onMarkComplete: () => void;
  onRefresh: () => void;
}

// Floating above each section in preview
// Pills: ● ○ ○ (Professional selected)
// Checkmark button: ✓
// Refresh button: ↻
// When all complete: transforms to "Publish Site" button
```

CSS requirements:

- Position: sticky to section, follows scroll
- z-index above preview content
- Subtle animation on variant switch
- Green checkmark when complete
- Pulse animation on "Publish Site" when ready

#### 1.4 Widget ↔ Agent Contract (4-6 hours)

Tools return structured variant data:

```typescript
// generate_section_variants tool
{
  sectionId: string;
  variants: {
    professional: { headline: string; body: string; ... };
    premium: { headline: string; body: string; ... };
    friendly: { headline: string; body: string; ... };
  };
  recommendation: 'professional' | 'premium' | 'friendly';
  rationale: string; // One sentence
}
```

New tools:

- `generate_section_variants(sectionId)` → returns 3 variants
- `apply_section_variant(sectionId, variantIndex)` → applies selected variant
- `mark_section_complete(sectionId)` → marks complete in state
- `get_next_incomplete_section()` → returns next section to refine

---

### Phase 2: Project Hub Enhancement (Week 2-3) — MOAT BUILDING

#### 2.1 AI Catch-Up Dashboard (8-12 hours)

**Vision:** Tenant logs in, sees "What do I need to do this week?" not a CRUD table.

Features:

- Chat-first interface: "Anything urgent?" → agent summarizes
- Smart prioritization: overdue > today > this week
- Action buttons inline: "Approve" / "Deny" / "Message"
- Zero-click insights: "3 pending requests, 2 sessions this week"

#### 2.2 Per-Job Deep View (4-8 hours)

**Vision:** Click a booking → see everything about that project in one place.

Features:

- Timeline visualization (milestones, messages, payments)
- Chat thread with customer
- Shared assets (contracts, invoices, images)
- Pending changes awaiting approval
- Quick actions: "Reschedule" / "Send reminder" / "Add note"

#### 2.3 Customer Agent Memory (4-6 hours)

Store customer preferences across sessions:

- Preferred communication style
- Previous questions asked (don't repeat)
- Known concerns or requests

---

### Phase 3: Agent Hardening (Week 3-4) — TRUST

#### 3.1 Voice Sentinel (2-4 hours)

Auto-scan agent responses before sending:

```typescript
// In security.ts
function scanForForbiddenPhrases(response: string): string[] {
  const violations = [];
  const forbidden = [/Great!/i, /Absolutely!/i, /Perfect!/i, /I'd be happy to/i, /Let me explain/i];
  // ... check and log violations
  return violations;
}
```

Log violations for tuning. Optionally block egregious phrases.

#### 3.2 Dynamic Tone Modulation (2-4 hours)

Detect user sentiment and adjust:

```markdown
## Tone Modulation

If user message contains frustration signals (caps, "??", "doesn't work", expletives):
→ Switch to calm, precise, supportive mode
→ Drop cheeky/terse voice temporarily
→ Acknowledge frustration before solving

If user message is positive/neutral:
→ Use normal terse/cheeky voice

If user message involves money/legal:
→ Use clinical, explicit mode
→ No shortcuts or assumptions
```

#### 3.3 Check-Then-Speak Enforcement (2-4 hours)

After write tools, verify before announcing:

```markdown
## Check-Then-Speak Rule

After any write tool (update_section, add_section, etc.):

1. Read the visibility field from tool result
2. If visibility = 'draft': "Updated in draft. Publish when ready."
3. If visibility = 'live': "Done. It's live."
4. If tool failed or preview didn't refresh: "Let me try that again."

NEVER say "Done!" when changes are draft-only.
```

---

### Phase 4: A2A Readiness (Ongoing) — FUTURE

#### 4.1 JSON-LD Structured Data (4-8 hours)

Add to every storefront:

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Sarah's Wedding Photography",
    "serviceType": "Wedding Photography",
    "areaServed": "Austin, TX",
    "priceRange": "$2,500 - $5,000",
    "availableAtOrFrom": {
      "@type": "Place",
      "address": "Austin, TX"
    }
  }
</script>
```

#### 4.2 Public Availability API (4-8 hours)

Expose availability endpoint:

```
GET /api/v1/public/tenants/{slug}/availability
  ?service=wedding-photography
  &date=2026-06-15
  &duration=8h
```

Rate-limited, no auth required.

#### 4.3 Style/Tag Taxonomy (4-8 hours)

Add to Package model:

```prisma
model Package {
  // ... existing fields
  styleTags  String[]  // ["candid", "romantic", "editorial"]
  keywords   String[]  // ["austin", "wedding", "elopement"]
  targetDemo String?   // "couples-25-35"
}
```

---

## Open Questions

1. **Variant generation strategy:** Pre-generate all 3 at section entry, or lazy-generate on pill click?
   - _Recommendation:_ Pre-generate for instant switching, better UX

2. **Section completion criteria:** User checkmark only, or auto-complete when no placeholders?
   - _Recommendation:_ User checkmark only — explicit approval builds trust

3. **Publish confirmation:** Final modal with summary, or just the widget button?
   - _Recommendation:_ Final modal with quick summary: "Publishing 6 sections. This goes live."

4. **Progressive publish:** Per-section publish, or all-or-nothing?
   - _Decision:_ All-or-nothing for now. Progressive adds complexity without proven value.

---

## Success Metrics

| Metric                       | Current | Target      | Measurement  |
| ---------------------------- | ------- | ----------- | ------------ |
| Time to first draft          | ~5 min  | <3 min      | Session logs |
| Time to publish              | ~20 min | <10 min     | Session logs |
| Onboarding completion rate   | Unknown | >80%        | Analytics    |
| Sessions reaching publish    | Unknown | >60%        | Analytics    |
| Post-publish return rate     | Unknown | >70% 30-day | Analytics    |
| NPS: "Business partner feel" | Unknown | >50         | Survey       |

---

## Appendix: Input Sources Synthesized

1. **ChatGPT Red-Team Analysis** — Lead Partner Rule, Preference Memory, Financial Safety
2. **Gemini Evaluation** — Check-Then-Speak, State Machine, Fork Decision
3. **Grok/Perplexity Inputs** — Competitive analysis, A2A readiness
4. **Internal Docs:**
   - `docs/plans/2026-02-03-AI-AGENT-ECOSYSTEM-COMPREHENSIVE-ANALYSIS.md`
   - `docs/reports/2026-02-03-AGENT-SECTION-BEHAVIOR-ANALYSIS.md`
   - `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

---

## Next Steps

1. Run `/workflows:plan` to create implementation plan for Phase 1 (Guided Refinement)
2. Create technical spec for widget ↔ agent contract
3. Design Figma mockups for floating widget
4. Estimate effort with engineering team

---

## Handoff Context for Fresh Session

Use the following prompt to continue in a new context window:

### Fresh Context Prompt

```
/workflows:plan

# Phase 1: Guided Refinement Implementation

## Context

Read these files for full context:

1. **Brainstorm (approved):** `docs/brainstorms/2026-02-04-ai-agent-ecosystem-roadmap-brainstorm.md`
2. **Ecosystem analysis:** `docs/plans/2026-02-03-AI-AGENT-ECOSYSTEM-COMPREHENSIVE-ANALYSIS.md` (Sections 1-12, 18)
3. **Section behavior gaps:** `docs/reports/2026-02-03-AGENT-SECTION-BEHAVIOR-ANALYSIS.md`
4. **Current tenant prompt:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

## What We're Building

**Phase 1: Guided Refinement** — the complete section-by-section editing experience.

### Components to Plan

1. **Tenant Prompt vNext** (~4-6 hours)
   - Lead Partner Rule
   - Guided Refinement Mode
   - Financial Safety Protocol
   - Preference Memory
   - Dynamic Tone Modulation
   - Check-Then-Speak enforcement

2. **Section State Machine** (~4-6 hours)
   - `mode: interview | draft_build | guided_refine | publish_ready`
   - `currentSectionId`, `completedSections[]`, `sectionVariants`
   - Backend state persistence
   - ContextBuilder integration

3. **Floating Widget UI** (~8-12 hours)
   - `apps/web/src/components/build-mode/SectionWidget.tsx`
   - Pills for 3 variants: Professional / Premium / Friendly
   - Checkmark to mark complete
   - Refresh to regenerate
   - Transforms to "Publish Site" when all complete

4. **Widget ↔ Agent Contract** (~4-6 hours)
   - New tools: `generate_section_variants`, `apply_section_variant`, `mark_section_complete`, `get_next_incomplete_section`
   - Tool return schema with `variants[]`, `recommendation`, `rationale`

## Key Decisions (Already Made)

- **Variant labels:** Professional / Premium / Friendly
- **Implementation style:** Full stack (prompt + UI together)
- **Timeline:** This month
- **Publish model:** All-or-nothing (not progressive per-section)
- **Variant generation:** Pre-generate all 3 for instant switching

## Constraints

- Must work with existing `SectionContent` table and `SectionContentService`
- Must integrate with existing trust tier system (T1/T2/T3)
- Must preserve current autonomous first draft workflow
- Must follow HANDLED brand voice rules in `voice.ts`

## Success Criteria

- Time to publish: <10 minutes (down from ~20)
- Onboarding completion rate: >80%
- User can refine any section independently
- User can escape guided mode anytime ("just finish it")

Please create a detailed implementation plan following the `/workflows:plan` conventions.
```

---

### Key Files for Context

| File                                                                   | Purpose                          | Lines |
| ---------------------------------------------------------------------- | -------------------------------- | ----- |
| `docs/brainstorms/2026-02-04-ai-agent-ecosystem-roadmap-brainstorm.md` | This document — approved roadmap | ~350  |
| `docs/plans/2026-02-03-AI-AGENT-ECOSYSTEM-COMPREHENSIVE-ANALYSIS.md`   | Full ecosystem analysis          | 2,051 |
| `docs/reports/2026-02-03-AGENT-SECTION-BEHAVIOR-ANALYSIS.md`           | Gap analysis                     | 333   |
| `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`              | Current tenant prompt            | 277   |
| `server/src/agent-v2/shared/voice.ts`                                  | Brand voice rules                | ~100  |
| `apps/web/src/components/agent/AgentPanel.tsx`                         | Current agent UI                 | ~400  |
| `server/src/services/section-content.service.ts`                       | Section CRUD service             | ~300  |

### External Input (Already Synthesized)

The brainstorm document synthesizes inputs from:

- **ChatGPT:** Red-team critique, Lead Partner Rule, Preference Memory, doctrine
- **Gemini:** Check-Then-Speak, State Machine, Fork Decision, dynamic tone
- **Grok/Perplexity:** Competitive analysis, A2A readiness

All external recommendations are captured in the brainstorm. No need to re-read external inputs.

---

_Document prepared: 2026-02-04_
_Ready for: `/workflows:plan` in fresh context window_
