---
title: Brand System 2026 Integration
type: feat
date: 2026-01-28
---

# Brand System 2026 Integration

## Overview

Integrate the new HANDLED Brand System 2026 across all documentation, agent prompts, and identify UI/copy changes needed in the codebase. This consolidates scattered brand guidance into a single source of truth with the new positioning: **"Calm infrastructure for service pros"** with the Project Hub as the moat.

## Problem Statement / Motivation

The current brand documentation is:

1. **Scattered** — 6+ files with overlapping, sometimes conflicting guidance
2. **Outdated** — Taglines and positioning don't match the evolved product vision
3. **Inconsistent** — Agent voice says "hip millennial" but we want "calm ops lead"
4. **Missing the moat** — Project Hub is barely mentioned; booking is treated as the whole product

The new 2026 brand system fixes this by:

- Clarifying the category wedge (booking = entry, Hub = moat)
- Separating brand voice (marketing) from agent voice (product)
- Making design rules enforceable (tokens + allowed patterns)
- Aligning with product reality: multi-tenant, AI concierge, ops-grade reliability

## Proposed Solution

### High-Level Approach

1. **Create new canonical brand doc** — `docs/design/BRAND_SYSTEM_2026.md`
2. **Create developer quick reference** — `docs/design/VOICE_QUICK_REFERENCE.md`
3. **Update agent prompts** — Shift from "hip millennial" to "calm ops lead"
4. **Audit codebase** — Identify UI/copy that needs updating
5. **Archive old docs** — Move superseded files to `docs/archive/`

### What Changes

| Current File                                                     | Action                              | Reason                                  |
| ---------------------------------------------------------------- | ----------------------------------- | --------------------------------------- |
| `docs/design/BRAND_VOICE_GUIDE.md`                               | Replace with `BRAND_SYSTEM_2026.md` | Superseded by new consolidated doc      |
| `docs/design/HANDLED_BRAND_POSITIONING.md`                       | Archive                             | Content merged into new doc             |
| `docs/marketing/BRANDSCRIPT.md`                                  | Archive                             | Messaging pillars absorbed into new doc |
| `docs/design-system/BRAND_COLORS.md`                             | Keep, update references             | Still valid, add cross-reference        |
| `server/src/agent-v2/deploy/concierge/src/prompts/onboarding.ts` | Update                              | New agent voice                         |
| `CLAUDE.md`                                                      | Update                              | Reference new canonical doc             |

## Technical Approach

### Phase 1: Create Canonical Brand Documentation (Day 1)

**Deliverables:**

- `docs/design/BRAND_SYSTEM_2026.md` — The single source of truth
- `docs/design/VOICE_QUICK_REFERENCE.md` — One-page cheat sheet for devs

**Content for BRAND_SYSTEM_2026.md:**

```markdown
# HANDLED Brand System 2026

Version: 2026.01
One-line: Calm infrastructure for service pros.

## Table of Contents

1. Brand Positioning (who, what, category wedge)
2. The Promise (what users feel, brand values)
3. Brand Voice (5 rules, Handled English, words we like/ban)
4. Messaging Pillars (4 pillars with proof points)
5. Signature Lines (tagline, secondary, brand claim)
6. Copy Patterns (hero, subhead, CTA, microcopy)
7. Agent Voice (personality, operating mode, guardrails)
8. Discovery Questions (7 Pattern Interrupts + translation logic)
9. Project Hub Brand Rules (the moat)
10. Brand QA Checklist (ship gate)
11. Competitive Positioning (what we do differently)
12. Appendix A: Concierge Script Kit (confirmations, flows, nudges)
13. Appendix B: Answer-to-Copy Translation Table
```

**Content for VOICE_QUICK_REFERENCE.md:**

```markdown
# HANDLED Voice Quick Reference

Print this. Pin it.

## Tagline

The rest is Handled.

## Voice in 5 Rules

1. Assume competence
2. Be specific
3. Sound expensive (fewer words)
4. Humor is seasoning
5. No AI sermons

## Words We Like

handled, calm, contained, confirmation, project room, next step, on track, nothing slips

## Words We Ban

revolutionary, game-changing, cutting-edge, leverage, optimize, synergy, seamless
Also: overwhelmed, struggling, stressed (don't punch down)

## Agent Voice (not brand voice)

- Fast. Minimal words.
- Decisive. Defaults to best practice.
- Not precious. "Cool. Next."

## Allowed Confirmations

got it | done | on it | heard | queued it | cool | next

## Forbidden

"Great!" | "Absolutely!" | "I'd be happy to..." | "Let me explain..."

## Copy Checklist

- [ ] No hype words
- [ ] No qualifiers (just, really, very)
- [ ] Ends in customer's world
- [ ] Concrete nouns (Stripe, calendar, deposit)
```

### Phase 2: Update Agent Prompts (Day 1-2)

**File:** `server/src/agent-v2/deploy/concierge/src/prompts/onboarding.ts`

**Key Changes:**

| Current                         | New                                         |
| ------------------------------- | ------------------------------------------- |
| "Friendly expert"               | "Calm ops lead"                             |
| "Cheeky and efficient"          | "Fast. Minimal words."                      |
| "Funny but concise"             | "Humor is seasoning, not the meal"          |
| Confirmation: "bet", "say less" | Confirmation: "got it", "done", "queued it" |

**Updated personality section:**

```typescript
### Your Personality
- Calm ops lead who texts fast
- Decisive — defaults to best practice
- Context-keeping — remembers what matters inside the project
- Not precious — if user overrides: "Cool. Next."

### Operating Mode
Do → report → offer next step. No preambles.

Good:
- "Got it. Writing."
- "Done. Pick A or B."
- "That change needs approval. I queued it."

Never:
- "Great!" "Absolutely!" "I'd be happy to…"
- "Let me explain…"
- Anything that sounds like customer support theater
```

**All 6 Deployed Agents (from SERVICE_REGISTRY.md):**

| Agent         | Service Name        | Voice Role               | Update Priority     |
| ------------- | ------------------- | ------------------------ | ------------------- |
| `concierge`   | `concierge-agent`   | Primary onboarding voice | P0 - Critical       |
| `storefront`  | `storefront-agent`  | Copy generation          | P0 - Critical       |
| `booking`     | `booking-agent`     | Customer-facing bookings | P1 - High           |
| `project-hub` | `project-hub-agent` | Project coordination     | P1 - High           |
| `marketing`   | `marketing-agent`   | Content generation       | P2 - Medium         |
| `research`    | `research-agent`    | Market analysis          | P3 - Low (internal) |

**Agent file paths:**

- `server/src/agent-v2/deploy/concierge/src/agent.ts` + `prompts/onboarding.ts`
- `server/src/agent-v2/deploy/storefront/src/agent.ts`
- `server/src/agent-v2/deploy/booking/src/agent.ts`
- `server/src/agent-v2/deploy/project-hub/src/agent.ts`
- `server/src/agent-v2/deploy/marketing/src/agent.ts`
- `server/src/agent-v2/deploy/research/src/agent.ts`

**Skills to Load During Implementation:**

- `agent-native-architecture` — For agent prompt patterns
- `frontend-design` — For any UI copy changes
- `compound-docs` — To document the voice migration

### Phase 3: Codebase Audit (Day 2-3)

**Goal:** Identify UI/copy that doesn't match new brand voice.

**Audit Checklist:**

1. **Landing page copy** (`apps/web/src/app/page.tsx` and related)
   - [ ] Hero matches new pattern ("You're a [profession]. So your business should run like one.")
   - [ ] No banned words (revolutionary, seamless, etc.)
   - [ ] CTAs use approved language ("Get Handled", "See how it works")

2. **Marketing pages** (`apps/web/src/app/(marketing)/`)
   - [ ] Taglines consistent ("The rest is Handled")
   - [ ] Positioning emphasizes Project Hub, not just booking
   - [ ] No "overwhelmed/struggling/stressed" language

3. **Onboarding UI** (`apps/web/src/components/onboarding/`)
   - [ ] Microcopy matches brand voice
   - [ ] No generic "Great!" or "Awesome!" confirmations
   - [ ] Progress messages are neutral and short

4. **Agent chat UI** (`apps/web/src/components/agent/`)
   - [ ] System messages match agent voice
   - [ ] Error messages are "neutral and short"
   - [ ] Loading states are visual-only (no "Please wait...")

5. **Email templates** (if applicable)
   - [ ] Subject lines match brand voice
   - [ ] Body copy follows Handled English rules

**Output:** Create `docs/audit/BRAND_AUDIT_2026-01-28.md` with findings.

### Phase 4: Archive Old Documentation (Day 3)

**Move to `docs/archive/2026-01/brand-consolidation/`:**

- `docs/design/BRAND_VOICE_GUIDE.md` → archive with note pointing to new doc
- `docs/design/HANDLED_BRAND_POSITIONING.md` → archive
- `docs/marketing/BRANDSCRIPT.md` → archive (StoryBrand framework still useful for reference)

**Update cross-references:**

- `CLAUDE.md` — Point to `BRAND_SYSTEM_2026.md`
- `docs/design-system/BRAND_COLORS.md` — Add note about two-surface strategy
- `docs/plans/CHATBOT_ONBOARDING_PROMPT.md` — Update brand guide reference

### Phase 5: Update CLAUDE.md (Day 3)

**Changes to CLAUDE.md:**

```markdown
## UI/UX Standards

**Before any UI work:** Load `frontend-design` skill + read `docs/design/BRAND_SYSTEM_2026.md`

Quick reference: See `docs/design/VOICE_QUICK_REFERENCE.md`

Brand voice: Warm, precise, lightly cheeky. Zero hype.
Agent voice: Calm ops lead. Fast. Minimal words. Do → report → offer next step.
```

## Acceptance Criteria

### Documentation

- [ ] `docs/design/BRAND_SYSTEM_2026.md` exists with all 13 sections (including Discovery Questions + Competitive)
- [ ] `docs/design/VOICE_QUICK_REFERENCE.md` is printable one-pager
- [ ] Old brand docs archived with pointer to new doc
- [ ] `CLAUDE.md` references new canonical doc
- [ ] `docs/design-system/BRAND_COLORS.md` has cross-reference

### Agent Prompts (6 agents)

- [ ] `concierge/prompts/onboarding.ts` uses "calm ops lead" personality
- [ ] `concierge/agent.ts` system prompt aligned
- [ ] `storefront/agent.ts` copy generation uses answer-to-tone translation
- [ ] `booking/agent.ts` customer-facing voice aligned
- [ ] `project-hub/agent.ts` coordination voice aligned
- [ ] `marketing/agent.ts` content generation voice aligned
- [ ] `research/agent.ts` internal voice aligned (lower priority)
- [ ] Confirmation vocabulary updated (remove "bet", "say less")
- [ ] No "Great!" or "Absolutely!" in any prompt
- [ ] 7 Pattern Interrupt questions added to concierge onboarding
- [ ] Answer-to-copy translation logic documented in storefront prompt
- [ ] Trust tier messages use new voice (T1/T2/T3)

### Codebase Audit

- [ ] `docs/audit/BRAND_AUDIT_2026-01-28.md` created
- [ ] Landing page copy issues identified
- [ ] Marketing pages issues identified
- [ ] Agent UI messages identified
- [ ] Prioritized list of UI/copy changes

## Success Metrics

| Metric                      | Target                        |
| --------------------------- | ----------------------------- |
| Single source of truth      | 1 canonical doc (not 6)       |
| Agent voice consistency     | 100% of prompts use new voice |
| Codebase audit coverage     | All customer-facing surfaces  |
| Time to find brand guidance | < 30 seconds                  |

## Dependencies & Prerequisites

- None — this is documentation and audit work
- Agent prompt changes can be deployed independently

## Implementation Workflow (Using Plugins)

**Before starting, load these skills:**

```
"Load the agent-native-architecture skill for agent prompt updates"
"Load the frontend-design skill for UI copy changes"
```

**Workflow sequence:**

1. **Plan Review** (this step)
   - `/plan_review` — Get feedback from DHH, Kieran, Simplicity reviewers

2. **Execute Work**
   - `/workflows:work docs/plans/2026-01-28-feat-brand-system-2026-integration-plan.md`
   - Uses `compound-docs` skill to document changes

3. **Review Changes**
   - `/workflows:review` — Multi-agent review of prompt changes
   - `kieran-typescript-reviewer` — TypeScript validation
   - `security-sentinel` — Check for prompt injection risks

4. **Document Learnings**
   - `/workflows:compound` — If we learn something new during implementation

**Agent Deployment After Prompt Changes:**

```bash
# Deploy updated agents (P0 first, then P1)
cd server/src/agent-v2/deploy/concierge && npm run deploy
cd server/src/agent-v2/deploy/storefront && npm run deploy
cd server/src/agent-v2/deploy/booking && npm run deploy
cd server/src/agent-v2/deploy/project-hub && npm run deploy
```

**Verification:**

```bash
# Verify all 6 agents responding
gcloud run services list --region=us-central1 --project=handled-484216
```

## Risk Analysis & Mitigation

| Risk                              | Likelihood | Impact | Mitigation                        |
| --------------------------------- | ---------- | ------ | --------------------------------- |
| Agent voice change confuses users | Low        | Medium | Gradual rollout, monitor feedback |
| Old docs still referenced         | Medium     | Low    | Add redirects/deprecation notices |
| Audit finds too many issues       | Medium     | Low    | Prioritize by customer impact     |

## Files to Create

### docs/design/BRAND_SYSTEM_2026.md

Complete brand system document with:

- Positioning (who, what, category wedge)
- Promise (what users feel, brand values: containment, respect for time, competence, human override)
- Brand Voice (5 rules, Handled English, words)
- Messaging Pillars (4 pillars: calm infrastructure, project hub, AI concierge, respect for time)
- Signature Lines (tagline, secondary, brand claim)
- Copy Patterns (hero, subhead, CTA, microcopy)
- Agent Voice (personality, operating mode, question style, guardrails)
- Project Hub Brand Rules (three jobs: reassure, coordinate, converse)
- Brand QA Checklist
- Appendix: Concierge Script Kit

### docs/design/VOICE_QUICK_REFERENCE.md

One-page printable cheat sheet with:

- Tagline
- Voice rules (condensed)
- Words we like/ban
- Agent voice summary
- Allowed/forbidden confirmations
- Copy checklist

### docs/audit/BRAND_AUDIT_2026-01-28.md

Codebase audit findings with:

- Files audited
- Issues found (categorized by severity)
- Recommended changes
- Estimated effort per change

## Files to Modify

### Agent Prompts (6 agents)

| File                                                             | Change                                                       | Priority |
| ---------------------------------------------------------------- | ------------------------------------------------------------ | -------- |
| `server/src/agent-v2/deploy/concierge/src/prompts/onboarding.ts` | New personality, Pattern Interrupt questions, confirmations  | P0       |
| `server/src/agent-v2/deploy/concierge/src/agent.ts`              | System prompt voice alignment                                | P0       |
| `server/src/agent-v2/deploy/storefront/src/agent.ts`             | Copy generation voice (punchy vs warm based on user answers) | P0       |
| `server/src/agent-v2/deploy/booking/src/agent.ts`                | Customer-facing voice alignment                              | P1       |
| `server/src/agent-v2/deploy/project-hub/src/agent.ts`            | Project coordination voice                                   | P1       |
| `server/src/agent-v2/deploy/marketing/src/agent.ts`              | Content generation voice                                     | P2       |
| `server/src/agent-v2/deploy/research/src/agent.ts`               | Internal voice (lower priority)                              | P3       |

### Documentation

| File                                                          | Change                                               |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `CLAUDE.md`                                                   | Update brand doc references, add agent voice section |
| `docs/design-system/BRAND_COLORS.md`                          | Add two-surface note                                 |
| `docs/plans/CHATBOT_ONBOARDING_PROMPT.md`                     | Update brand guide path                              |
| `docs/solutions/agent-design/AGENT_DESIGN_QUICK_REFERENCE.md` | Add voice alignment section                          |

### Agent Voice + Trust Tiers

The agent voice must be consistent across trust tier interactions:

| Trust Tier        | Current Voice                    | New Voice                          |
| ----------------- | -------------------------------- | ---------------------------------- |
| **T1 (Execute)**  | "Here are your bookings!"        | "Your bookings." (minimal)         |
| **T2 (Soft Ask)** | "I'll book that for you, okay?"  | "Booking 2 PM. Good?"              |
| **T3 (Hard Ask)** | "Please type CONFIRM to proceed" | "Type CONFIRM REFUND to continue." |

Voice applies to:

- Agent responses
- Approval request messages
- Confirmation prompts
- Error messages

## Files to Archive

| File                                       | Destination                                 |
| ------------------------------------------ | ------------------------------------------- |
| `docs/design/BRAND_VOICE_GUIDE.md`         | `docs/archive/2026-01/brand-consolidation/` |
| `docs/design/HANDLED_BRAND_POSITIONING.md` | `docs/archive/2026-01/brand-consolidation/` |
| `docs/marketing/BRANDSCRIPT.md`            | `docs/archive/2026-01/brand-consolidation/` |

## Implementation Timeline

| Phase   | Tasks                                         | Effort    |
| ------- | --------------------------------------------- | --------- |
| Phase 1 | Create BRAND_SYSTEM_2026.md + quick reference | 3-4 hours |
| Phase 2 | Update agent prompts                          | 2-3 hours |
| Phase 3 | Codebase audit                                | 3-4 hours |
| Phase 4 | Archive old docs, update references           | 1 hour    |
| Phase 5 | Update CLAUDE.md                              | 30 min    |

**Total estimated effort:** 10-12 hours

## Future Considerations

### Not in Scope (for later)

- UI theme migration (two-surface strategy) — documented but not implemented
- Landing page rewrite — audit identifies issues, separate project to fix
- Email template updates — audit only

### Product Alignment

- As Project Hub features expand, docs will need updates
- Consider quarterly brand review (per governance section)

## References & Research

### Internal References

- Current brand docs: `docs/design/BRAND_VOICE_GUIDE.md`
- Agent prompts: `server/src/agent-v2/deploy/concierge/src/prompts/onboarding.ts`
- Color system: `docs/design-system/BRAND_COLORS.md`

### Source Material

- New brand system provided by user (2026-01-28)
- Landing page advice from AI agents (A2A commerce positioning)

### Related Work

- `plans/archive/feat-brand-voice-tightening.md`
- `plans/archive/feat-handled-rebrand-ui-ux.md`

---

## Appendix A: Content to Preserve from Old Docs

### From BRAND_VOICE_GUIDE.md (keep in new doc)

- Confirmation vocabulary table (update vocabulary)
- Flow examples (user stuck / user pushes back / user gives content)
- Priority order (Website → Services → Stripe)
- Best practice nudges
- Product Experience Patterns (demo storefront, pricing psychology, session workspace)
- Review checklist structure

### From BRANDSCRIPT.md (merge into new doc)

- Before/After transformation table
- FAQ answers
- Personas (solopreneur, scaling startup, pivot artist) — evaluate if still relevant

### From HANDLED_BRAND_POSITIONING.md (merge into new doc)

- Target audience details
- Competitive positioning
- What we don't say list

---

## Appendix B: The 7 Pattern Interrupt Questions (Secret Sauce)

**Why this matters:** Most website builders ask boring questions ("What is your mission statement?"). Users respond with corporate autopilot ("To provide high quality solutions..."). Boring input = boring copy.

These questions **break the pattern** and extract emotional, authentic answers that lead to copy that converts.

### The Questions

#### 1. The "Table Flip" Question

**Extracts:** Core Values & Differentiation

> "Okay, real talk for a second. What is the one thing your competitors do—or a myth in your industry—that makes you want to flip a table? What drives you crazy?"

**Why it works:** Anger is honest. If a plumber says "I hate when guys track mud in the house," we write: _"We treat your home like a museum. White-glove service, zero mess."_

#### 2. The "Anti-Client" Question

**Extracts:** Ideal Customer Profile

> "Let's filter out the headaches. Complete this sentence for me: 'Please do NOT hire us if you...'"

**Why it works:** This defines who they _do_ want. "Don't hire me if you want a yes-man" → _"Strategic partners who challenge you to grow."_

#### 3. The "Bar Test"

**Extracts:** Brand Voice/Vibe

> "Weird question, but stick with me. If your business walked into a bar, what is it ordering? A craft beer? A martini? A shot of tequila? Or just water?"

**Translation logic:**
| Answer | Copy Style |
|--------|------------|
| **Martini** | High-end, sophisticated, expensive (Tier 3 focus) |
| **Craft Beer** | Local, friendly, hipster, detail-oriented |
| **Tequila** | Fast, energetic, "get it done" (Party/Events) |
| **Water** | Clinical, reliable, no-nonsense (Medical/Legal) |

#### 4. The "Grandma vs. NASA"

**Extracts:** Methodology / Technical Level

> "How do you explain what you do? Do you explain it like a warm Grandmother ('I take care of you') or like a NASA Engineer ('I optimize systems for 99% efficiency')?"

**Why it works:** Tells the Copywriting Agent exactly how technical to make "Services" descriptions.

#### 5. The "Magic Wand"

**Extracts:** The Outcome / Hero Section

> "Your customer is stressed out. They hire you. You finish the job. What is the _exact_ sound they make? Is it a sigh of relief? A scream of excitement? Or just a quiet 'Thank God'?"

**Translation logic:**

- **Sigh of relief** → Copy focuses on _peace of mind_
- **Scream of excitement** → Copy focuses on _results/profit_
- **Quiet "Thank God"** → Copy focuses on _reliability_

#### 6. The "Apocalypse" Scenario

**Extracts:** Reliability / Core Utility

> "If the world was ending, why would people still need you on their team?"

**Why it works:** Great for "About Us." Cuts to absolute core utility. "Because I can fix anything with duct tape" → _"Resourceful problem solvers."_

#### 7. The "Movie Character"

**Extracts:** Archetype / Tonal Alignment

> "Last one. Is your business more like John Wick (precise, expensive, deadly effective) or Ted Lasso (optimistic, coaching, friendly)?"

**Translation logic:**

- **John Wick** → "The Executive Package" — precise, premium, no-nonsense
- **Ted Lasso** → "The Partner Package" — supportive, encouraging, collaborative

### Implementation: Answer-to-Copy Translation

The agent doesn't just dump answers on the site. It translates them.

**Example flow:**

```
User Answer: "I'd order a shot of tequila. We are loud."

System Processing:
→ Tone Temperature: 0.9 (punchy)
→ Sentence style: Short. Active voice.
→ Avoid: Passive voice, corporate speak

Generated Headline: "Wake Up Your Wardrobe."
(Instead of generic: "We sell clothes")
```

### Competitive Advantage

| Competitor          | Approach                                | Flaw                                                              |
| ------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| **Wix/Squarespace** | Functional keywords ("Modern, Bold")    | Generic copy: "We are a modern business providing bold solutions" |
| **Framer AI**       | Open text box ("Describe your site...") | Relies on user being a good prompter                              |
| **Durable/10Web**   | Location + SEO                          | Gets keywords right, gets _soul_ wrong                            |
| **ZipWP**           | Business description text box           | User writes the description; we write it FOR them                 |

**HANDLED difference:** We ask questions that extract the emotional truth, then generate copy that actually sounds like the business owner — not a template.

---

## Appendix C: Agent Prompt Updates (Detailed)

### New Section for onboarding.ts: Discovery Questions

Add after the `### Key Behaviors` section:

```typescript
### Discovery Questions (Pattern Interrupts)

When gathering business information, use these questions to extract authentic answers.
Don't ask all of them — pick 2-3 based on what you need to know.

**For differentiation:**
"What's one thing competitors do that makes you want to flip a table?"

**For ideal client:**
"Complete this: 'Please do NOT hire us if you...'"

**For brand voice:**
"If your business walked into a bar, what's it ordering? Martini, craft beer, tequila, or water?"

**For technical level:**
"Do you explain what you do like a warm Grandma or a NASA Engineer?"

**For outcome/hero:**
"When a customer finishes working with you, what sound do they make? Sigh of relief, scream of excitement, or quiet 'Thank God'?"

**For core utility:**
"If the world was ending, why would people still need you?"

**For archetype:**
"Is your business more John Wick or Ted Lasso?"

### How to Use Answers

Map answers to copy style:

| Answer Type | Copy Approach |
|-------------|---------------|
| Tequila / John Wick | Punchy, premium, active voice |
| Craft Beer / Ted Lasso | Warm, friendly, conversational |
| Water / NASA | Clinical, precise, trust-focused |
| Martini | Sophisticated, exclusive, aspirational |

When generating homepage copy, apply the detected style.
Example: Tequila answer → "Wake Up Your Wardrobe." not "We sell quality clothing."
```

### Confirmation Vocabulary Update

Replace current informal confirmations with brand-aligned ones:

| Remove     | Replace With   |
| ---------- | -------------- |
| "bet"      | "got it"       |
| "say less" | "on it"        |
| "heard"    | "heard" (keep) |
| "aight"    | "cool"         |

### Flow Examples to Add

**User gives a Pattern Interrupt answer:**

```
User: "I'd order tequila. We're loud and fast."
Agent: "Got it. Punchy and energetic. Writing your hero now — check the preview."
[Generates: "Loud. Fast. Done." instead of "We provide efficient services."]
```

**User is stuck on brand voice:**

```
User: "I don't know how to describe my vibe."
Agent: "Quick one: If your business walked into a bar, what's it ordering?"
User: "Craft beer, I guess. We're local and chill."
Agent: "Perfect. Friendly and local it is. Check the preview — I went warm and approachable."
```
