# Onboarding Ecosystem Review — Full Handoff

**Date:** 2026-02-05
**Status:** Review complete. Vision needs refinement before implementation.
**Context:** Full end-to-end review of tenant onboarding ecosystem via `/workflows:review` with 9 parallel research/review agents. Production tested via Playwright on gethandled.ai.

---

## Overall Goals

HANDLED (gethandled.ai) is a membership platform for service professionals — photographers, coaches, therapists, wedding planners. The tenant agent onboards new users by asking questions, learning about their business, and building their website section by section.

**The vision (from Mike):**

> I want to question this entire ecosystem end to end. Nothing is sacred. We are going to expand this agent to a role where he does onboarding phone calls. He will call the client and ask them all his questions before drafting them a preview. This agent needs to gather all the info and sort it into a JSON. The JSON system is currently set up to be section by section, with the ability to preview and publish sections one at a time.
>
> What I was envisioning: the agent asks a number of questions. After that question is asked, he needs to then take that info, plug it into the system behind the scenes, sort of see what he has. For example, "Okay, I have enough for an about section." "Okay, I know their city and state, let me fire up that research agent." It should be working towards a finished website, and it should have a deep understanding of our platform.

**The north star (from the brainstorm doc):**

> "Feel like you brought on a business partner who's a guru in everything you're not."

**The vision is still being refined.** The next session should help Mike clarify exactly how onboarding should flow — the feel, the pacing, the personality — before jumping into code. The Coding Tutor plugin (below) is the tone reference.

---

## Tone Reference: The Coding Tutor Plugin

Mike identified the Coding Tutor skill plugin as having the exact tone he wants for the tenant agent. The source is at `~/.claude/plugins/every-marketplace/plugins/coding-tutor/skills/coding-tutor/SKILL.md`. Below are the relevant sections **quoted directly** — these should be used as the foundation for rebuilding the tenant agent's voice and onboarding flow.

### The Onboarding Interview (Direct Quote)

```
If no tutorials exist in ~/coding-tutor-tutorials/ AND no learner profile exists at
~/coding-tutor-tutorials/learner_profile.md, this is a brand new learner. Before
teaching anything, you need to understand who you're teaching.

**Onboarding Interview:**

Ask these three questions, one at a time. Wait for each answer before asking the next.

1. **Prior exposure**: What's your background with programming? - Understand if they've
   built anything before, followed tutorials, or if this is completely new territory.

2. **Ambitious goal**: This is your private AI tutor whose goal is to make you a top 1%
   programmer. Where do you want this to take you? - Understand what success looks like
   for them: a million-dollar product, a job at a company they admire, or something
   else entirely.

3. **Who are you**: Tell me a bit about yourself - imagine we just met at a coworking
   space. - Get context that shapes how to teach them.

4. **Optional**: Based on the above answers, you may ask upto one optional 4th question
   if it will make your understanding of the learner richer.
```

### Teaching Philosophy (Direct Quote)

```
Our general goal is to take the user from newbie to a senior engineer in record time.
One at par with engineers at companies like 37 Signals or Vercel.

Before creating a tutorial, make a plan by following these steps:

- **Load learner context**: Read ~/coding-tutor-tutorials/learner_profile.md to
  understand who you're teaching - their background, goals, and personality.
- **Survey existing knowledge**: Run [index script] to understand what concepts have
  been covered, at what depth, and how well they landed (understanding scores).
  Optionally, dive into particular tutorials to read them.
- **Identify the gap**: What's the next concept that would be most valuable? Consider
  both what they've asked for AND what naturally follows from their current knowledge.
  Think of a curriculum that would get them from their current point to Senior Engineer
  - what should be the next 3 topics they need to learn to advance their programming
  knowledge in this direction?
- **Find the anchor**: Locate real examples in the codebase that demonstrate this
  concept. Learning from abstract examples is forgettable; learning from YOUR code
  is sticky.
```

### Tutorial Writing Style (Direct Quote)

```
Write personal tutorials like the best programming educators: Julia Evans, Dan Abramov.
Not like study notes or documentation. There's a difference between a well-structured
tutorial and one that truly teaches.

- Show the struggle - "Here's what you might try... here's why it doesn't work...
  here's the insight that unlocks it."
- Fewer concepts, more depth - A tutorial that teaches 3 things deeply beats one
  that mentions 10 things.
- Tell stories - a great tutorial is one coherent story, dives deep into a single
  concept, using storytelling techniques that engage readers
```

### Tutorial Quality Standards (Direct Quote)

```
Qualities of a great tutorial should:

- **Start with the "why"**: Not "here's how callbacks work" but "here's the problem
  in your code that callbacks solve"
- **Use their code**: Every concept demonstrated with examples pulled from the actual
  codebase. Reference specific files and line numbers.
- **Build mental models**: Diagrams, analogies, the underlying "shape" of the concept
  - not just syntax, ELI5
- **Predict confusion**: Address the questions they're likely to ask before they ask
  them, don't skim over things, don't write in a notes style
- **End with a challenge**: A small exercise they could try in this codebase to cement
  understanding
```

### What Makes Great Teaching (Direct Quote)

```
**DO**: Meet them where they are. Use their vocabulary. Reference their past struggles.
Make connections to concepts they already own. Be encouraging but honest about complexity.

**DON'T**: Assume knowledge not demonstrated in previous tutorials. Use generic
blog-post examples when codebase examples exist. Overwhelm with every edge case upfront.
Be condescending about gaps.

**CALIBRATE**: A learner with 3 tutorials is different from one with 30. Early tutorials
need more scaffolding and encouragement. Later tutorials can move faster and reference
the shared history you've built.

Remember: The goal isn't to teach programming in the abstract. It's to teach THIS person,
using THEIR code, building on THEIR specific journey. Every tutorial should feel like it
was written specifically for them - because it was.
```

### Quiz as Conversation (Direct Quote)

```
A quiz isn't an exam - it's a conversation that reveals understanding. Ask questions
that expose mental models, not just syntax recall. The goal is to find the edges of
their knowledge: where does solid understanding fade into uncertainty?

**Ask only 1 question at a time.** Wait for the learner's answer before asking the
next question.
```

### The Welcome Message (Direct Quote)

```
If ~/coding-tutor-tutorials/ does not exist, this is a new learner. Before running
setup, introduce yourself:

> I'm your personal coding tutor. I create tutorials tailored to you - using real
> code from your projects, building on what you already know, and tracking your
> progress over time.
```

### Calibration Over Time (Direct Quote)

```
**CALIBRATE**: A learner with 3 tutorials is different from one with 30. Early
tutorials need more scaffolding and encouragement. Later tutorials can move faster
and reference the shared history you've built.
```

---

## How the Tutor Patterns Map to Tenant Onboarding

This mapping has NOT been implemented yet. It's a starting point for the next session's design work.

| Tutor Pattern                                              | Tenant Agent Equivalent                                                                                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| "Know your learner" interview with internal commentary     | Opening question gathers facts. Agent should mentally note what each answer reveals about the tenant's sophistication level.                    |
| "Meet them where they are / use their vocabulary"          | If they say "elopements" don't translate to "weddings." Mirror their language.                                                                  |
| "A learner with 3 tutorials is different from one with 30" | A tenant 2 minutes in needs warmth. A tenant 10 minutes in needs speed. Calibrate.                                                              |
| "Show the struggle, tell stories"                          | When explaining pricing: "Most photographers in Austin charge $3-6K. You're at $4.2K — sweet spot. But your hero doesn't signal that tier yet." |
| "Quiz as conversation"                                     | Refinement as conversation: "Here's what I wrote. Tell me what feels off — I'll rewrite the parts that don't sound like you."                   |
| "Start with the why"                                       | Don't say "I updated your hero section." Say "Your hero is the first thing clients see — I gave it a headline that tells them what you do."     |
| "Predict confusion"                                        | "I put packages lowest to highest — clients anchor on the first number, so starting lower gets more clicks."                                    |
| Calibration, not fixed personality                         | Not "be terse" or "be warm." Read the room. Match their energy.                                                                                 |

**The key insight:** The Coding Tutor doesn't define voice through vocabulary lists or banned phrases. It defines voice through **behavioral patterns** — how to respond to different situations, what to do with what the user gives you, and how to calibrate based on what you know about them.

---

## What Was Found: Production Bugs

### Bug 1: Storefront Rendering Crash — Dual-Schema Field Name Mismatch

**Root cause:** `sectionsToLandingConfig()` in `apps/web/src/lib/tenant.client.ts:476` spreads raw SectionContent JSON into Section objects with `as Section` (unsafe type assertion). The two schema systems use different field names:

| SectionContent schema | Section type system          |
| --------------------- | ---------------------------- |
| `items`               | `features` (FeaturesSection) |
| `items`               | `images` (GallerySection)    |
| `title`               | `headline`                   |
| `subtitle`            | `subheadline`                |

**Crash chain:** Agent writes → SectionContent stores as `items` → `sectionsToLandingConfig()` spreads raw → FeaturesSection destructures `features` → gets `undefined` → `.map()` → TypeError

**Fix (two layers):**

1. **Defense layer — add defaults to vulnerable components:**
   - `FeaturesSection.tsx:67` — add `features = []` default + `if (features.length === 0) return null`
   - `PricingSection.tsx:23` — add `tiers = []` default + `if (tiers.length === 0) return null`
   - `PricingSection.tsx:84` — change to `(tier.features ?? []).map()`
   - `TenantLandingPage.tsx:135` — change to `(landingConfig.socialProofBar.items ?? []).map()`

2. **Root cause layer — add `transformContentForSection()` in `tenant.client.ts`:**
   ```typescript
   function transformContentForSection(
     sectionType: string,
     content: Record<string, unknown>
   ): Record<string, unknown> {
     const transformed = { ...content };
     if ('title' in transformed && !('headline' in transformed)) {
       transformed.headline = transformed.title;
       delete transformed.title;
     }
     if ('subtitle' in transformed && !('subheadline' in transformed)) {
       transformed.subheadline = transformed.subtitle;
       delete transformed.subtitle;
     }
     if (sectionType === 'features' && 'items' in transformed && !('features' in transformed)) {
       transformed.features = transformed.items;
       delete transformed.items;
     }
     if (sectionType === 'gallery' && 'items' in transformed && !('images' in transformed)) {
       transformed.images = transformed.items;
       delete transformed.items;
     }
     return transformed;
   }
   ```

**Files:** `apps/web/src/lib/tenant.client.ts`, `apps/web/src/components/tenant/sections/FeaturesSection.tsx`, `PricingSection.tsx`, `TenantLandingPage.tsx`

### Bug 2: SectionRenderer Exhaustive Switch Crash

**Root cause:** `SectionRenderer.tsx` default case uses `const _exhaustive: never = section; return _exhaustive;`. When BlockType `SERVICES` or `CUSTOM` passes through (mapped in `BLOCK_TO_SECTION_MAP` but no component exists), React tries to render a plain object → crash.

**Fix:** Replace `never` assertion with graceful `return null` + dev warning. Filter unknown types in `sectionsToLandingConfig()` using `SECTION_TYPES` set. Remove/comment `SERVICES`/`CUSTOM` from `BLOCK_TO_SECTION_MAP`.

**Files:** `apps/web/src/components/tenant/SectionRenderer.tsx`, `apps/web/src/lib/tenant.client.ts`

### Bug 3: Preview Iframe "Connection Failed"

**Root cause:** Cascading failure from Bugs 1 & 2. Storefront crash kills React tree before `BuildModeWrapper` can send `BUILD_MODE_READY` PostMessage. Parent times out.

**Fix:** Fix Bugs 1 & 2, and add parent-side timeout error state in `PreviewPanel.tsx`.

**Files:** `apps/web/src/components/preview/PreviewPanel.tsx`

### Bug 4: Onboarding Stepper Stuck at 1/4

**Root cause:** NO phase advancement mechanism exists. Only `COMPLETED` and `SKIPPED` are ever written. The `/store-discovery-fact` endpoint stores facts but never touches `onboardingPhase`.

**Fix:** Add auto-advancement in `/store-discovery-fact` route handler:

```typescript
function computeCurrentPhase(knownFactKeys: string[]): OnboardingPhase {
  if (knownFactKeys.includes('uniqueValue') || knownFactKeys.includes('testimonial'))
    return 'MARKETING';
  if (knownFactKeys.includes('servicesOffered') || knownFactKeys.includes('priceRange'))
    return 'SERVICES';
  if (knownFactKeys.includes('location')) return 'MARKET_RESEARCH';
  if (knownFactKeys.includes('businessType')) return 'DISCOVERY';
  return 'NOT_STARTED';
}
```

**Files:** `server/src/routes/internal-agent.routes.ts`, `apps/web/src/hooks/useOnboardingState.ts`, `apps/web/src/components/onboarding/OnboardingProgress.tsx`

### Bug 5: Agent Re-Asks Known Questions (Within Session)

**Root cause:** `forbiddenSlots` only works cross-session. No prompt instruction to parse messages for already-provided facts before asking questions.

**Fix:** Add "Extract-Then-Ask" rule to system prompt. Replace rigid question sequence with slot-based gathering.

**File:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

### Bug 6: Agent Ignores Technical Complaints

**Root cause:** Zero coverage in system prompt for when users report something broken.

**Fix:** Add "Technical Issue Reports" section to system prompt.

**File:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

---

## What Was Found: Structural Gaps

### 7. Slot Machine State Module (Highest-Impact Single Change)

The LLM decides non-deterministically when to store facts, build sections, trigger research, and advance phases. A deterministic state machine in `store_discovery_fact`'s return value would tell the agent what to do next.

**Section readiness thresholds:**

| Section      | Required Facts                                    |
| ------------ | ------------------------------------------------- |
| HERO         | `businessType`                                    |
| ABOUT        | `businessType` + (`uniqueValue` OR `originStory`) |
| SERVICES     | `servicesOffered`                                 |
| PRICING      | `servicesOffered` + `priceRange`                  |
| FAQ          | `businessType` + `servicesOffered`                |
| CONTACT/CTA  | `businessType`                                    |
| TESTIMONIALS | `testimonial`                                     |
| GALLERY      | (not auto-buildable)                              |

**Files:** New `slot-machine.ts`, modify `discovery.ts`, `internal-agent.routes.ts`

### 8. Agent System Prompt Rewrite

Current prompt is 520 lines, feature-organized, one-dimensional personality ("Terse. Cheeky. Confident."). Needs journey-organized structure, emotional range, extract-then-ask, technical issue handling. The Coding Tutor quotes above are the tone foundation.

**File:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

### 9. `build_first_draft` Tool

Single tool to generate all buildable sections in parallel from current known facts. Replaces fragile 4-7 sequential LLM-coordinated tool calls.

**Files:** New tool file + new backend route

### 10-12. Phone-Based Onboarding (P2)

- Telephony adapter (Twilio/Vapi + Deepgram STT + ElevenLabs TTS)
- `channel: 'voice' | 'web'` in ADK session state
- Real-time dashboard push via SSE/WebSocket

### 13-14. Quality of Life (P3)

- Session-scoped working memory (questions asked, sections built, frustration level)
- Prompt structure reorganization

---

## Current Agent System Prompt (For Reference)

The current system prompt is at `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` (520 lines). Key sections:

- **Line 21:** `"Personality: Terse. Cheeky. Confident. You lead, they follow."` — this is the line that needs to change
- **Lines 29-37:** forbiddenSlots / session state (cross-session memory — works well)
- **Lines 39-148:** Onboarding conversation flow (rigid Phase 1/2/3 script — needs slot-based rewrite)
- **Lines 137-148:** First Draft Workflow (triggers after businessType + location + one more — too conservative)
- **Lines 157-162:** Fact-to-Storefront Bridge (prompt-only, not enforced — needs slot machine)
- **Lines 247-277:** Preview vs Live (excellent, keep as-is)
- **Lines 326-354:** Edge Cases (missing technical issue handling)
- **Lines 421-449:** Lead Partner Rule (excellent, keep as-is)
- **Lines 505-520:** Financial Safety (correct, keep as-is)

The agent uses 34 tools across 13 files, Gemini 2.0 Flash at temperature 0.3.

---

## Files Referenced (Complete List)

| File                                                                                    | Role                                                                  |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/web/src/lib/tenant.client.ts`                                                     | `sectionsToLandingConfig()` — the schema bridge (root cause of crash) |
| `apps/web/src/components/tenant/TenantLandingPage.tsx`                                  | Landing page with unguarded socialProofBar                            |
| `apps/web/src/components/tenant/SectionRenderer.tsx`                                    | Exhaustive switch crash on unknown types                              |
| `apps/web/src/components/tenant/sections/FeaturesSection.tsx`                           | Unguarded `features.map()`                                            |
| `apps/web/src/components/tenant/sections/PricingSection.tsx`                            | Unguarded `tiers.map()` and `tier.features.map()`                     |
| `apps/web/src/components/preview/PreviewPanel.tsx`                                      | PostMessage bridge, silent timeout                                    |
| `apps/web/src/components/onboarding/OnboardingProgress.tsx`                             | 4-phase stepper (stuck)                                               |
| `apps/web/src/hooks/useOnboardingState.ts`                                              | Reads onboarding phase from API                                       |
| `apps/web/src/hooks/useComputedPhase.ts`                                                | Exists but never used by AgentPanel                                   |
| `apps/web/src/hooks/useTenantAgentChat.ts`                                              | Core chat logic                                                       |
| `apps/web/src/components/agent/AgentPanel.tsx`                                          | Agent panel with onboarding section                                   |
| `server/src/routes/internal-agent.routes.ts`                                            | `/store-discovery-fact` (needs phase advancement)                     |
| `server/src/routes/tenant-admin-tenant-agent.routes.ts`                                 | Tenant agent routes (session creation)                                |
| `server/src/services/section-content.service.ts`                                        | SectionContent CRUD (shallow merge, advisory validation)              |
| `server/src/services/context-builder.service.ts`                                        | Bootstrap context + forbiddenSlots                                    |
| `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`                               | Agent system prompt (520 lines)                                       |
| `server/src/agent-v2/deploy/tenant/src/agent.ts`                                        | Agent definition (34 tools, Gemini 2.0 Flash)                         |
| `server/src/agent-v2/deploy/tenant/src/tools/discovery.ts`                              | store_discovery_fact, get_known_facts                                 |
| `server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts`                       | update_section (683 lines)                                            |
| `server/src/agent-v2/deploy/tenant/src/tools/research.ts`                               | delegate_to_research (90s timeout)                                    |
| `server/src/agent-v2/deploy/tenant/src/tools/refinement.ts`                             | Guided refinement state machine                                       |
| `packages/contracts/src/schemas/section-content.schema.ts`                              | SectionContent Zod schemas                                            |
| `packages/contracts/src/landing-page.ts`                                                | Section type discriminated union                                      |
| `server/prisma/schema.prisma`                                                           | SectionContent model, OnboardingPhase enum                            |
| `~/.claude/plugins/every-marketplace/plugins/coding-tutor/skills/coding-tutor/SKILL.md` | Tone reference (Coding Tutor)                                         |

---

## To Start Next Session

Paste this:

> Read `docs/plans/2026-02-05-onboarding-ecosystem-review-handoff.md`. This is a handoff from a previous review session. The vision for how onboarding should feel is still being refined — I want to work on that first before we start coding. The Coding Tutor plugin quotes in that document are the tone I want. Also read the current system prompt at `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` so you can see what we're replacing.
