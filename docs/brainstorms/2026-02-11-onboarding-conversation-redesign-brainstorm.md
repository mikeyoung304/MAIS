# Onboarding Conversation Redesign: Business Mentor Over Coffee

**Date:** 2026-02-11
**Status:** Brainstorm Complete — Reviewed & Refined
**Next:** `/workflows:plan` when ready to implement

---

## What We're Building

A redesigned onboarding conversation that acts like a business mentor sitting down with the tenant over coffee — discovering their customer segments, structuring tiered pricing, and building a complete storefront. Replaces the current deterministic slot-machine protocol with an LLM-driven adaptive conversation.

### The Core Shift

| Before                                           | After                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| Research agent fires automatically at signup     | Research fires on-demand when tenant is stuck                     |
| Deterministic slot machine (15 fixed fact slots) | LLM-driven: agent knows section needs, fills gaps dynamically     |
| 15 sequential questions, same order for everyone | Adaptive conversation shaped by the brain dump                    |
| Flat `Package` list created                      | `Segment` + `Tier` (3 options) + `AddOn` per segment              |
| City/state/name asked in chat                    | City/state/name + brain dump captured on signup form              |
| Linear flow to completion                        | Two-phase: MVP sprint (1 segment) → tenant-led enhancement        |
| Agent opens blind, asks everything from scratch  | Agent digests brain dump before first message, arrives pre-loaded |

---

## Why This Approach

1. **Research is often wasted.** Most service businesses don't publish pricing. Scraping competitors yields sparse data. On-demand research only runs when it's actually valuable (~$0.03-0.10/run, now spent only on users who need it).

2. **The tenant knows their business better than a web scraper.** A photographer who's been shooting weddings for 5 years already knows their pricing. We should ask, not research.

3. **New tenants need mentoring, not data.** Someone who just got their first camera doesn't benefit from "competitors charge $1,500." They need: "Let's figure out what your time is worth and what to offer."

4. **The existing data model supports this.** Prisma has `Segment`, `Tier`, and `AddOn` models that are underutilized. The current onboarding only creates flat `Package` records.

5. **A deterministic state machine can't handle a brain dump.** If someone writes 200 words about their business on signup, a 15-slot state machine can't gracefully skip the 8 questions already answered. An LLM can.

---

## Key Decisions

### 1. Signup Form: Name + Location + Brain Dump

**Decision:** The signup form (registration only, not login) collects:

- Business name
- City and state
- Freetext brain dump

**Brain dump prompt:**

> "Who are you? What do you do, and who do you do it for? Feel free to brain dump anything at all here — the onboarding process goes best with a good starting point."

**Why this matters:**

- Eliminates 2-3 onboarding questions (name, location, business type)
- The brain dump sets the tone — agent knows if this is an experienced pro or a beginner
- Agent arrives at the first message pre-loaded with context, leading with confirmation instead of fishing
- An experienced user's dump might be: "I'm a wedding photographer, 8 years experience, I shoot elopements and full weddings, my packages range from $2,500-$8,000, I also do engagement sessions." The agent can skip straight to structuring.
- A new user's dump might be: "I just got my camera and want to start a photography business." The agent knows to shift into mentoring mode.

### 2. No More Slot Machine — LLM-Driven Conversation

**Decision:** The deterministic slot machine protocol (`slot-machine.ts`, 15 fixed fact slots) is replaced by LLM-driven conversation logic.

**How it works:**

- The agent's system prompt describes: what sections the website needs (from the section blueprint), what each section requires, and what's already known (from the brain dump + prior conversation)
- The LLM dynamically determines the best next question based on what gaps remain
- No fixed question order — the conversation flows naturally
- The agent's goals are implicit: fill the website sections, help structure pricing, get to the reveal

**Why this is better:**

- Natural conversation, not scripted or robotic
- Handles brain dumps gracefully (can skip questions already answered)
- Adapts to experience level automatically (experienced users get fast-tracked)
- Simpler architecture (LLM prompt vs. 300-line state machine)

**What remains deterministic:**

- The section blueprint (what sections exist and what they need) — this is still structured data
- The reveal trigger (MVP sections complete → show the site)
- Phase transitions (Phase 1 complete → present Phase 2 menu)

### 3. Research Agent: On-Demand Only

**Decision:** Research does NOT auto-fire at signup. It triggers only when:

- Tenant explicitly asks: "What should I charge?" / "What do competitors charge?"
- Tenant is stuck on pricing and the agent offers: "Want me to look at what others in [city] are charging?"

**Cost:** ~$0.03-0.10 per run (Vertex AI tokens + Cloud Run compute). Now spent only on users who need it.

**Implication:** City/state from signup form is still valuable — it's passed to research when triggered, and used for storefront content (location-aware copy, SEO).

### 4. Experience Detection: Brain Dump + Adapt

**Decision:** The brain dump on the signup form is the primary experience signal. The agent reads it before the first message and adapts its approach.

**Experienced signals:** Specific pricing mentioned, client types named, industry jargon, years of experience, existing tier structure described → fast-track, confirm what they know, structure it.

**New signals:** Brief/vague dump, "just getting started," no pricing mentioned, asking for help → mentoring mode, more guidance per step.

**The opening message adapts:**

- Experienced: "I see you're a wedding photographer in Austin who does elopements and full weddings. Let's get your site set up — should we start with your wedding packages?"
- New: "Welcome! It looks like you're getting started with photography — that's exciting. Let's figure out who you want to work with and get your site set up."

### 5. Segment Discovery: Services First

**Decision:** Ask about services → agent groups into customer segments → confirm with tenant.

**Key distinction (the therapist litmus test):**

- **Segments = who you serve** (different client types / service lines)
  - Photographer: weddings, portraits, newborns
  - Therapist: individual therapy, couples therapy, group therapy
  - Coach: executive coaching, team workshops, 1:1 mentoring
- **Tiers = how they buy** (3 pricing options within each segment)
  - Wedding photography: Essential ($3,500), Signature ($5,000), Premier ($7,500)
  - Individual therapy: single session, 4-pack, 12-pack
  - Executive coaching: monthly retainer, quarterly package, annual partnership

**Example flow:**

1. Agent (from brain dump): "It sounds like you serve wedding couples and families. Should we set up your site with those two categories?"
2. Tenant confirms or adjusts.
3. Agent: "Since weddings are your main thing, let's start there and get your site up. We can add family portraits after."

### 6. Tiered Pricing: Default 3 Options, Explain Why

**Decision:** Agent defaults to recommending 3 pricing options per segment. Explains the conversion benefits. Doesn't force it.

**The framing:** Not always "good/better/best" — 3 pricing options that could be:

- Duration-based (30min / 60min / 90min)
- Scope-based (basic / standard / premium)
- Count-based (single session / 4-pack / 12-pack)
- Whatever fits the business

**The pitch:**

> "Most successful service businesses offer three pricing options. It helps clients self-select — some want the basics, others want the full experience. It also makes your site easy for AI agents to navigate as agent-to-agent commerce grows. How does your pricing work today?"

**For experienced users:** "Tell me about your pricing — what do you offer and what do you charge?" Agent parses the dump into tiers.

**For new users who are stuck:** Agent offers on-demand research: "Want me to look at what photographers in [city] are charging? That might help us set your starting prices."

### 7. Add-Ons: Capture Then Suggest

**Decision:** After tiers are set for the primary segment, ask what extras they offer. Then suggest common industry add-ons they might be missing.

**Flow:**

1. Agent: "Any extras your wedding clients can add on? Things like extra hours, albums, engagement sessions?"
2. Tenant lists what they have
3. Agent: "Got it. Other wedding photographers also commonly offer [X, Y, Z] — worth adding any of those?"

**Industry knowledge source:** Baked into the agent's prompt per business type. Not from the research agent.

### 8. MVP = ONE Primary Segment

**Decision:** The MVP reveal (HERO + ABOUT + SERVICES) is built from ONE primary segment only.

**Rationale:** Gets to the wow moment faster. A 3-segment, fully-tiered conversation before the reveal would take 20-30 turns and cause conversation fatigue. One segment with 3 tiers is 5-8 turns.

**After the reveal:** The agent knows about other segments from the brain dump and conversation. These become Phase 2 work alongside testimonials, gallery, etc.

### 9. Two-Phase Onboarding

#### Phase 1: MVP Sprint → Big Reveal

**Goal:** Discover primary segment, set up 3 tiers, gather enough for HERO + ABOUT + SERVICES.

**Conversation arc:**

1. Agent reads brain dump, opens with context-aware greeting
2. Confirm primary segment (or discover it if brain dump was sparse)
3. Set up 3 tiers for primary segment (pricing, descriptions, what's included)
4. Gather unique value, approach, target market (for HERO/ABOUT copy)
5. Agent builds HERO + ABOUT + SERVICES
6. **Big Reveal** — show them their site

**MVP sections built:** HERO, ABOUT, SERVICES (primary segment + 3 tiers visible)

#### Phase 2: Tenant-Led Enhancement

**Goal:** Flesh out the rest of the site based on tenant's priorities.

After the reveal, the agent presents what's available:

- "Add more customer segments" (e.g., family portraits, headshots)
- "Set up add-ons for your tiers"
- "Add a testimonials section"
- "Add a contact section"
- "Add an FAQ section"
- "Add a gallery section"
- "Go back and re-work any section"

**Key behavior:** Agent always knows what sections are complete, what segments are unfinished, and what the tenant has expressed interest in. Flexible order, tenant drives.

### 10. Tier Replaces Package (Debt-Free)

**Decision:** The `Tier` model becomes the bookable entity. The `Package` model is deleted entirely.

**Rationale:** The app has no production users. No legacy to maintain. The Tier model cleanly represents "3 pricing options per segment" and maps directly to the A2A commerce structure.

**A2A commerce structure (JSON-searchable):**

```json
{
  "segments": [
    {
      "name": "Wedding Photography",
      "tiers": [
        { "name": "Essential", "price": 3500, "features": ["6hr coverage", "200 photos"] },
        { "name": "Signature", "price": 5000, "features": ["8hr coverage", "album", "400 photos"] },
        {
          "name": "Premier",
          "price": 7500,
          "features": ["all-day", "album", "engagement", "prints"]
        }
      ],
      "addOns": [
        { "name": "Second Photographer", "price": 500 },
        { "name": "Rush Editing", "price": 300 }
      ]
    }
  ]
}
```

An AI shopping agent can navigate: `segments → tiers → add-ons` as a structured tree.

---

## Conversation Script Examples

### Experienced User (Fast Track)

**Brain dump at signup:** "I'm a wedding and portrait photographer in Austin, TX. Been at it for 8 years. My weddings start at $3,500 and go up to $7,500. I also do family portraits seasonally."

```
Agent: Hey Sarah — I've read through what you shared and it sounds like
       you've got a solid business going. Weddings and family portraits,
       8 years in Austin. Let's get your site set up.

       Since weddings are your main thing, let's start there. You mentioned
       pricing from $3,500 to $7,500 — do you have that broken into
       specific packages, or is it more custom per client?

Sarah: I have three tiers actually. My basic is 6 hours coverage for $3,500,
       my most popular is 8 hours with an album for $5,000, and my premium
       is all-day coverage, album, engagement session, and prints for $7,500.

Agent: Got those captured:
       • Essential: 6hr coverage — $3,500
       • Signature: 8hr + album — $5,000
       • Premier: All-day + album + engagement + prints — $7,500
       Sound right?

Sarah: Yep, that's it.

Agent: Any extras your wedding clients can add on? Things like extra hours,
       second photographer, drone footage?

Sarah: Second photographer for $500 and extra hours at $400/hr.

Agent: Got it. Other wedding photographers also offer things like photo booth
       rental, rehearsal dinner coverage, and rush editing. Any of those
       worth adding?

Sarah: Oh yeah, I do offer rush editing. $300 for that.

Agent: Heard. Now, before I build your site — what makes you different from
       other wedding photographers in Austin? What do clients say they love
       about working with you?

Sarah: I'm known for being really calm and unobtrusive. Couples say they
       forget I'm even there. I focus on candid moments, not posed shots.

Agent: That's a strong angle — "candid, unobtrusive coverage where you
       forget the camera's there." Let me put your site together...

[Agent builds HERO + ABOUT + SERVICES → reveal]

Agent: Here's your site. Take a look — I've set up your wedding packages
       with all three tiers, plus the add-ons. The hero section leads with
       your candid photography style, and the about section tells your story.

       After you've had a chance to look through it, we can:
       • Add your family portrait segment
       • Set up a testimonials section
       • Add an FAQ, gallery, or contact section
       • Go back and adjust anything that doesn't feel right

       What jumps out at you?
```

### New User (Mentoring Mode)

**Brain dump at signup:** "I just got my first professional camera and want to start a photography business. Not sure where to start."

```
Agent: Hey Marcus, welcome. Sounds like you're at the beginning of something
       exciting. Let's figure out what kind of photography business makes
       sense for you and get your site set up.

       When you think about the kind of photography you enjoy most, what
       draws you in? Portraits, events, products, something else?

Marcus: I really like doing portraits. I've shot some senior portraits for
        friends' kids and some family stuff.

Agent: Nice — senior portraits and family sessions are two solid niches.
       Let's start with senior portraits since that's what you're most
       drawn to, and we can add family sessions after your site is up.

       Most successful photographers offer three pricing options — it helps
       clients self-select and actually increases bookings. Have you thought
       about how you'd price your sessions?

Marcus: Honestly, no idea. I don't even know what to charge.

Agent: No problem. Want me to look at what portrait photographers in Macon
       are charging? I can pull some market data to give you a starting
       point.

Marcus: Yeah, that'd be great.

[Agent triggers on-demand research for "portrait photographers in Macon, GA"]

Agent: Here's what I found — portrait photographers in your area typically
       charge $150-300 for a basic session and $400-800 for premium
       packages. Since you're building your portfolio, starting on the lower
       end makes sense. How about:

       • Mini Session: 30 min, 10 edited photos — $175
       • Standard Session: 1 hr, 25 photos, outfit change — $325
       • Premium Session: 2 hr, 50 photos, 2 locations, prints — $550

       We can always adjust as you book more clients. Sound reasonable?

Marcus: That actually sounds perfect. I was worried I'd underprice myself.

Agent: $175 for a starting mini session is solid — it's not so low that
       people question the quality, and your premium session gives you room
       to grow into. What would you say makes your portraits special?
       Even as someone starting out, what do people comment on?

Marcus: People say I'm really good at making them feel comfortable in front
        of the camera. Especially the seniors — they usually hate photos
        but they end up having fun.

Agent: That's your superpower — making people comfortable. Let me build
       your site around that...

[Agent builds HERO + ABOUT + SERVICES → reveal]
```

---

## Open Questions (For Planning Phase)

1. **Maximum segments?** Should we suggest consolidation after a certain number (e.g., 5+), or let tenants add freely? Likely a UX question, not a hard limit.

2. **Session continuity.** If a tenant leaves mid-onboarding (after setting up tiers but before the reveal), how does the agent pick up? Need a lightweight state tracker (not the full slot machine — just "what do we have, what's missing").

3. **Testimonial intake system.** Phase 2 mentions "add testimonials" — but there's no system for collecting testimonials from clients yet. Is this text input for now, or a future feature (email request → client submits)?

4. **Tier naming.** The tenant provides display names (Essential/Signature/Premier). Internally, do we normalize to an ordinal (tier 1/2/3) or a level (GOOD/BETTER/BEST)? The current schema has `TierLevel` enum. Planning phase needs to decide if we keep/modify this.

5. **Slot machine deprecation path.** Current `slot-machine.ts` is used by the backend to determine next actions. If we remove it, the agent prompt + section blueprint become the source of truth. What minimal deterministic checks remain? (e.g., "are MVP sections built?" → trigger reveal)

---

## What's NOT Changing

- **The reveal moment** — still HERO + ABOUT + SERVICES as the MVP wow moment
- **Section blueprint** — 8 sections remain the same
- **Agent personality** — business mentor tone, forbidden words, confirmation vocab
- **Build mode / visual editor** — post-onboarding editing unchanged
- **Multi-tenant isolation** — all data scoped by tenantId
- **3-agent architecture** — tenant-agent, customer-agent, research-agent

---

## Technical Implications (For Planning Phase)

These are NOT decisions — just flags for `/workflows:plan`:

- **Signup form** needs city, state, business name, and brain dump textarea (frontend)
- **Slot machine protocol** deprecated — replaced by LLM-driven logic in system prompt
- **`Package` model deleted** — `Tier` becomes bookable, all booking references updated
- **Research agent** trigger changes from auto to on-demand (backend + agent tool)
- **Tenant agent prompt** needs significant rewrite for new conversation flow
- **Brain dump processing** — agent receives brain dump in system prompt or context, pre-processes before first message
- **Section blueprint** may need updates to reflect tier/segment structure in SERVICES section
- **New agent tools possible:** `manage_segments`, `manage_tiers`, `manage_addons`
- **Lightweight state tracker** needed for session continuity (what's done, what's next)

---

## Decision Summary

| #   | Decision                   | Choice                                                   |
| --- | -------------------------- | -------------------------------------------------------- |
| 1   | Signup form fields         | Business name + city/state + freetext brain dump         |
| 2   | Conversation engine        | LLM-driven (slot machine deprecated)                     |
| 3   | Research agent trigger     | On-demand only (tenant asks or is stuck)                 |
| 4   | Experience detection       | Brain dump analysis + dynamic adaptation                 |
| 5   | Segment discovery          | Services first → group → confirm                         |
| 6   | Pricing structure          | Default 3 options per segment, explain benefits          |
| 7   | Pricing input style        | Let them dump it all, agent parses                       |
| 8   | Pricing help for new users | On-demand research when stuck                            |
| 9   | Add-on discovery           | Capture theirs, then suggest common industry ones        |
| 10  | MVP scope                  | ONE primary segment + 3 tiers → reveal                   |
| 11  | Post-reveal flow           | Tenant-led menu (more segments, testimonials, FAQ, etc.) |
| 12  | Data model                 | Tier replaces Package (debt-free), Tier becomes bookable |
| 13  | A2A commerce               | Segments → Tiers → AddOns as structured JSON tree        |
