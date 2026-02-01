# Brainstorm: Dual-Schema Agent Architecture

> **Date:** 2026-01-31
> **Status:** Ready for planning
> **Next:** `/workflows:plan` to implement

---

## What We're Building

A **dual-schema system** where the tenant agent operates with deep knowledge of:

1. **Website Schema** - Rigid, completion-driven tracker for storefront sections
2. **Tenant Profile** - Flexible, insight-driven personality bank

The agent's job during onboarding is to **keep the conversation flowing naturally** while silently organizing information into the right buckets. User brain-dumps, agent sorts.

---

## Why This Approach

**Current Problem:**

- Agent asks same questions repeatedly (loop issue)
- Agent doesn't "know" what it knows
- No structured way to track completion
- Discovery facts scattered, not actionable

**Solution:**

- Inject BOTH schemas at session start (solves loop issue)
- Agent sees completion score and knows what's missing
- Clear separation: website state vs personality insights
- Write tools keep schemas updated in real-time

---

## Key Decisions

### 1. Two Separate Schemas

| Schema             | Purpose                    | Structure                         | Mutability                         |
| ------------------ | -------------------------- | --------------------------------- | ---------------------------------- |
| **Website Schema** | Track section completion   | Rigid (5 sections, known fields)  | Agent updates via `update_section` |
| **Tenant Profile** | Store personality/insights | Flexible (append-only categories) | Agent updates via `add_insight`    |

### 2. Section Model

| Section      | Requirement          | Weight | States                             |
| ------------ | -------------------- | ------ | ---------------------------------- |
| **Services** | Required             | 40%    | empty → draft → accepted           |
| **Hero**     | Strongly recommended | 25%    | empty → draft → accepted           |
| **About**    | Strongly recommended | 20%    | empty → draft → accepted           |
| **FAQ**      | Optional/Suggested   | 10%    | empty → draft → accepted → skipped |
| **Reviews**  | Optional/Suggested   | 5%     | empty → draft → accepted → skipped |

**Note:** No Contact section—the platform IS the contact method (Customer Agent).

### 3. Section States

```
empty → draft → accepted
          ↘      ↗
           skipped (optional sections only)
```

- **empty**: No content yet
- **draft**: Agent generated, awaiting confirmation
- **accepted**: User confirmed ("looks good")
- **skipped**: User explicitly declined (FAQ, Reviews only)

### 4. Agent Access Pattern

**Read:** Both schemas injected into system prompt at session start

```markdown
## Website Completion: 45%

- Hero: accepted ✓
- About: draft (awaiting confirmation)
- Services: empty ← PRIORITY
- FAQ: empty
- Reviews: empty

## Tenant Profile

- Voice: casual, avoids corporate speak
- Style: candid over posed
- Ideal client: couples wanting real moments
```

**Write:** Two focused tools

- `update_section(section, content)` → updates website schema, sets state to draft
- `add_insight(category, insight)` → appends to tenant profile

### 5. Confirmation Flow

**Real-time collaboration:**

1. Agent generates content → updates section (draft)
2. Agent scrolls preview → "Did I get that right?"
3. User confirms in chat ("looks good") OR clicks checkmark in UI
4. Section moves to "accepted"

**Publish gate:**

- All accepted sections go live
- Warns if recommended sections missing: "Publish without About?"
- Blocks if required section (Services) missing

### 6. Conversational Sorting

Agent's superpower: **extract insights from rants**

User answers About question but drops FAQ gold:

```
User: "I'm a photographer who... oh and everyone always asks if I travel—
      yes I do, within 100 miles!"

Agent: "Great FAQ material there—noted. Keep going about your story..."
       [Silently adds to FAQ schema AND continues About conversation]
```

**Light acknowledgment** of routing, never interrupts flow.

### 7. Weighted Completion Score

Agent sees progress weighted by importance:

```
Completion: 45%
- Services (40%): empty → 0/40
- Hero (25%): accepted → 25/25 ✓
- About (20%): draft → 10/20 (half credit for draft)
- FAQ (10%): empty → 0/10
- Reviews (5%): empty → 0/5

Priority: Services (required, 0% complete)
```

---

## Schema Structures

### Website Schema (JSON)

```json
{
  "completion": {
    "score": 45,
    "priority": "services"
  },
  "sections": {
    "hero": {
      "state": "accepted",
      "headline": "Love in Every Frame",
      "subheadline": "Austin wedding photography for real moments"
    },
    "about": {
      "state": "draft",
      "headline": "Your Story, Candidly Captured",
      "copy": "I'm Sarah—a photographer who believes the best moments..."
    },
    "services": {
      "state": "empty",
      "headline": null,
      "packages": []
    },
    "faq": {
      "state": "empty",
      "items": []
    },
    "reviews": {
      "state": "empty",
      "items": []
    }
  }
}
```

### Tenant Profile (JSON)

```json
{
  "voice": {
    "tone": "casual",
    "avoids": ["corporate speak", "salesy language"],
    "preferences": ["conversational", "warm"]
  },
  "story": {
    "origin": "left corporate marketing job",
    "why": "wanted authentic human connection",
    "journey": "started shooting friends' weddings, word spread"
  },
  "style": {
    "approach": "candid over posed",
    "signature": "catching the in-between moments",
    "dislikes": ["stiff family portraits", "forced smiles"]
  },
  "clients": {
    "ideal": "couples who want their real day captured",
    "demographics": "younger, outdoor-focused",
    "redFlags": ["want 500 posed shots", "bridezillas"]
  },
  "business": {
    "location": "Austin, TX",
    "travelRadius": "100 miles",
    "pricing": "mid-range, value-focused"
  },
  "quirks": [
    "always wears converse to shoots",
    "brings dog Biscuit to consultations",
    "hates the word 'capture'"
  ],
  "rawInsights": [
    {
      "source": "onboarding",
      "timestamp": "2026-01-31T14:30:00Z",
      "quote": "I just want people to forget I'm there and be themselves"
    },
    {
      "source": "onboarding",
      "timestamp": "2026-01-31T14:32:00Z",
      "quote": "Everyone asks if I travel—yes, within 100 miles!"
    }
  ]
}
```

---

## Agent Behavior Changes

### During Onboarding (Proactive)

1. **Injected context** shows what's empty/draft/accepted
2. **Weighted score** guides priorities (Services first)
3. **Conversational sorting** extracts insights from any answer
4. **Light acknowledgment** when routing info ("Good FAQ—noted")
5. **Real-time updates** with confirmation prompts
6. **Progressive completion** toward 100%

### Post-Onboarding (Reactive)

1. Agent responds to refinement requests
2. Can suggest improvements based on profile insights
3. Tracks changes through same state machine
4. Profile continues to grow with new insights

---

## Implementation Scope

### Must Build

- [ ] Website Schema structure + storage
- [ ] Tenant Profile structure + storage
- [ ] `update_section(section, content)` tool
- [ ] `add_insight(category, insight)` tool
- [ ] Context builder: inject both schemas at session start
- [ ] Completion score calculation (weighted)
- [ ] State transitions (empty → draft → accepted/skipped)

### Must Update

- [ ] System prompt: reference schemas, guide behavior
- [ ] Frontend: confirmation flow (chat + click)
- [ ] Publish gate: warn on missing recommended, block on missing required

### Nice to Have (Later)

- [ ] Profile-informed copy generation ("based on your style...")
- [ ] Pattern learning from profile over time
- [ ] Cross-session insight aggregation

---

## Open Questions

1. **Storage location:** Separate DB columns? Nested in existing `branding` JSON?
2. **Versioning:** Track history of schema changes for undo?
3. **Migration:** How to backfill existing tenants into new schema?
4. **Conflict resolution:** What if UI and agent update simultaneously?

---

## Success Criteria

- [ ] Agent never asks a question it already has the answer to
- [ ] Onboarding completes with ≤5 focused questions
- [ ] Completion score reaches 100% for fully-built storefronts
- [ ] Profile captures rich personality data from natural conversation
- [ ] Users feel like they're having a conversation, not filling forms

---

## Appendix: Conversation Flow Example

```
Agent: "What do you do? Give me the 30-second version. Feel free to rant—
       I'll organize it."

User: "I'm a wedding photographer in Austin. Candid stuff, not those stiff
      posed shots everyone hates. I left my corporate job because I wanted
      real human connection. Oh and everyone always asks if I travel—yes,
      within 100 miles!"

Agent: [Silently updates:]
       - Website: hero.state = draft, hero.headline = "Candid Wedding Photography"
       - Profile: story.origin = "left corporate", style.approach = "candid over posed"
       - Profile: business.travelRadius = "100 miles"
       - Website: faq.items.push({ q: "Do you travel?", a: "Yes, within 100 miles" })

Agent: "Got it—candid wedding photography, Austin-based, travels within 100 miles.
       That travel note is great FAQ material—added it. Take a look at your hero."

       [Scrolls preview to hero section]

       "How's 'Candid Wedding Photography in Austin'? Want something punchier?"

User: "Make it warmer, more personal"

Agent: [Generates options using profile.voice.tone = casual]

       "How about: 'Love in Every Frame' or 'Your Story, Candidly Captured'?"

User: "First one"

Agent: [Updates hero.headline, hero.state = accepted]

       "Done. Who's your dream client? The couples you wish you had more of."
```

---

_This brainstorm captures the WHAT. Ready for `/workflows:plan` to define HOW._
