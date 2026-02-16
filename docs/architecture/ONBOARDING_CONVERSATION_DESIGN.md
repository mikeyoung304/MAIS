# Onboarding Conversation Design: Business Mentor Over Coffee

**Status:** Approved design — pending implementation
**Brainstorm:** `docs/brainstorms/2026-02-11-onboarding-conversation-redesign-brainstorm.md`
**Date:** 2026-02-11

---

## Summary

The onboarding conversation is a two-phase, LLM-driven experience that replaces the deterministic 15-question slot machine. It acts like a business mentor sitting with the tenant over coffee — discovering segments, structuring tiered pricing, and building a storefront.

## Data Model

```
Segment (who you serve)         →  "Weddings", "Portraits", "Individual Therapy"
  └─ Tier (how they buy)        →  3 pricing options per segment (bookable)
      └─ AddOn (extras)         →  "Second Photographer", "Rush Editing"
```

- **Tier replaces Package.** Package model is deleted. Tier becomes the bookable entity.
- **A2A commerce:** The `Segments → Tiers → AddOns` tree is JSON-serializable for agent-to-agent shopping.

### Key Distinction (The Therapist Litmus Test)

- **Segments = who you serve:** Individual therapy, couples therapy, group therapy
- **Tiers = how they buy:** Single session ($150), 4-pack ($500), 12-pack ($1,200)

## Signup Form

Registration collects (login does NOT):

1. **Business name**
2. **City and state**
3. **Freetext brain dump** — "Who are you? What do you do, and who do you do it for?"

The brain dump is the agent's primary context. It sets conversation tone, reveals experience level, and eliminates redundant questions.

## Conversation Engine

**Slot machine is deprecated.** No more `slot-machine.ts` or 15 fixed fact slots.

The agent's system prompt receives:

- Section blueprint (what the website needs)
- Brain dump + known facts (what we already have)
- Current state (what sections are built, what's missing)

The LLM dynamically determines the best next question. No fixed order.

**What remains deterministic:**

- Section blueprint structure
- Reveal trigger (MVP sections complete → show site)
- Phase transitions

## Two Phases

### Phase 1: MVP Sprint → Big Reveal

1. Agent reads brain dump, opens with context-aware greeting
2. Confirm primary segment (or discover it)
3. Set up 3 tiers for primary segment (default 3, explain benefits)
4. Gather unique value + approach (for HERO/ABOUT)
5. Build HERO + ABOUT + SERVICES → **reveal**

**MVP = ONE primary segment.** Other segments are Phase 2.

### Phase 2: Tenant-Led Enhancement

After the reveal, tenant chooses from:

- Add more customer segments
- Set up add-ons for tiers
- Add testimonials / contact / FAQ / gallery sections
- Re-work existing sections

Agent tracks what's done and what's available. Flexible order.

## Research Agent

**On-demand only.** Does NOT auto-fire at signup.

Triggers when:

- Tenant asks: "What should I charge?"
- Tenant is stuck and agent offers: "Want me to look at what others in [city] charge?"

Cost: ~$0.03-0.10/run. City/state from signup form passed to research when triggered.

## Experience Adaptation

| Signal                                                | Mode       | Behavior                  |
| ----------------------------------------------------- | ---------- | ------------------------- |
| Brain dump has pricing, client types, industry jargon | Fast-track | Confirm, structure, build |
| Brain dump is brief, vague, "just starting out"       | Mentoring  | Guide, suggest, educate   |

## Pricing Approach

- Default: 3 pricing options per segment (not always good/better/best)
- Could be duration-based, scope-based, count-based — whatever fits
- Experienced users: "Tell me about your pricing" → agent parses into tiers
- New users stuck on pricing: agent offers on-demand research

## Add-On Discovery

1. Ask what extras they offer
2. Then suggest common industry add-ons: "Other [business type] also offer [X, Y, Z] — worth adding?"
3. Industry knowledge baked into agent prompt, not from research

## Principles

- **No debt.** Delete deprecated code ruthlessly. Don't stack half-built systems.
- **Natural conversation.** No scripted questions, no robotic flows.
- **Brain dump is gold.** The more context the agent has upfront, the fewer questions needed.
- **One segment to wow.** Get to the reveal fast with one segment, expand in Phase 2.

## Decision Reference

| #   | Decision             | Choice                               |
| --- | -------------------- | ------------------------------------ |
| 1   | Signup form          | Name + city/state + brain dump       |
| 2   | Conversation engine  | LLM-driven (slot machine deprecated) |
| 3   | Research trigger     | On-demand only                       |
| 4   | Experience detection | Brain dump analysis                  |
| 5   | Segment discovery    | Services first → group → confirm     |
| 6   | Pricing structure    | 3 options per segment                |
| 7   | MVP scope            | ONE primary segment → reveal         |
| 8   | Data model           | Tier replaces Package (bookable)     |
| 9   | A2A commerce         | Segments → Tiers → AddOns JSON tree  |
