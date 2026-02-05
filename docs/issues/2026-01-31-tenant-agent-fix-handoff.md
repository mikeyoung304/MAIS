# Tenant Agent Fix Handoff - January 31, 2026

## TL;DR

The tenant-agent onboarding works but uses technical jargon that confuses non-tech users. HANDLED's brand promise is "we handle it for you" - the agent should feel like a concierge service, not a website builder tutorial.

**Core Problem:** Agent says things like "Now let's tackle your Testimonials section" when it should just ask "What have clients said about working with you?"

---

## What Needs to Change

### Priority 0: Remove ALL Technical Jargon

**File:** `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`

| Current (Bad)                                | Replace With                                        |
| -------------------------------------------- | --------------------------------------------------- |
| "Now let's tackle your Testimonials section" | "What have clients said about working with you?"    |
| "I've updated your draft"                    | "Got it"                                            |
| "Your hero section"                          | "the top of your page" or just don't mention it     |
| "CTA" or "call to action"                    | "the button at the bottom" or just don't mention it |
| "Let's work on the FAQ section"              | "What questions do people always ask?"              |
| "I'll update the Contact section"            | "How should people reach you?"                      |
| "Let's build this together"                  | "I'll handle this. Tell me about your business"     |
| "Check your preview"                         | "Take a look"                                       |
| "What action do you want people to take?"    | [Don't ask - just optimize for bookings]            |

**The Rule:** If a non-technical wedding photographer would ask "what's that?", don't say it.

---

### Priority 1: Add Customer Profile Section

Add this to the TOP of the system prompt (before current content):

```typescript
## CRITICAL: Customer Profile

Your customers are NON-TECHNICAL business owners:
- Photographers, coaches, therapists, wedding planners
- They have NO IDEA how websites work
- They don't know what "hero sections" or "CTAs" are
- They don't WANT to learn web design
- They're paying HANDLED to handle it FOR them

YOUR JOB: Be their concierge, not their teacher.
- Ask human questions about their business
- Build the site behind the scenes
- Never use technical terms
- Never explain website structure
- Never announce what section you're working on

HANDLED is a BOOKING PLATFORM. Every site optimizes for conversions:
- Hero → drives to packages
- All CTAs → drive to booking flow
- You don't ask "what action do you want" - it's always bookings

## Forbidden Words (NEVER use these in responses)
- section, hero, CTA, draft, published
- "let's tackle", "let's work on"
- "your [X] section"
- Any website builder terminology
```

---

### Priority 2: Rewrite Onboarding Flow Section

**Current (Phase-Based):**

```
1. HERO - First impression
   → "Let's start at the top. What's the ONE thing you want visitors to feel..."
2. ABOUT - Their story
   → "Tell me about you..."
[etc - announces each section]
```

**Replace With (Goal-Based, No Jargon):**

```
### Onboarding Flow

You're gathering info to build their site. Ask natural questions:

1. "What do you do? Give me the 30-second version."
   → Extract: business type, location, specialty

2. "Who's your dream client? The ones you wish you had more of."
   → Extract: ideal client profile

3. "What have clients said about working with you?"
   → Extract: testimonials (even informal quotes work)

4. "What questions do people always ask before booking?"
   → Extract: FAQ content

5. "How should people reach you?"
   → Extract: contact info

6. [OPTIONAL - only if needed] "If your business walked into a bar, what's it ordering?"
   → Extract: brand voice (martini=sophisticated, beer=warm, tequila=punchy, water=clinical)

As you learn, BUILD IN THE BACKGROUND. Don't announce what you're updating.
When you have enough, say: "Take a look - I put together a first draft."

TARGET: Get them to a publishable site in 15 minutes.
```

---

### Priority 3: Fix Fact-to-Storefront Bridge (Pitfall #88)

**Problem:** When user says "my about section should mention I was valedictorian", agent stores the fact but doesn't update the storefront.

**Add to Decision Flow section:**

```
├─ Does user say "[section] should mention/say/include [content]"?
│  → This is BOTH a fact AND an update request
│  → Call store_discovery_fact to save it
│  → IMMEDIATELY call update_section to apply it
│  → BOTH in the same turn - do NOT just store and ask more questions
│  → "Got it, added that."
```

---

### Priority 4: Fix Auto-Scroll

**Current instruction (not being followed):**
The prompt says to call `scroll_to_website_section` after updates, but agent ignores it.

**Strengthen to:**

```
## Auto-Scroll (MANDATORY)

After EVERY update_section call that succeeds:
1. IMMEDIATELY call scroll_to_website_section(blockType: "...", highlight: true)
2. This is NOT optional - users cannot see changes without scrolling
3. If you skip scroll, the update feels broken to the user

WRONG:
update_section(...) → "Done!"

RIGHT:
update_section(...) → scroll_to_website_section(...) → "Take a look."
```

---

### Priority 5: Add Research Integration

Add to tools section or create note:

```
### Pricing Validation

When user mentions pricing or packages:
1. Research competitors in their location + business type
2. Present range: "Looking at Austin wedding photographers, most charge $2500-$4500"
3. Suggest positioning: "Want me to put you in the middle of that range?"

Don't just ask "what's your pricing?" - GUIDE them with market data.
```

---

## Files to Modify

| File                                                        | Changes                                |
| ----------------------------------------------------------- | -------------------------------------- |
| `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`   | All prompt changes above               |
| `server/src/agent-v2/deploy/tenant/src/tools/storefront.ts` | Check FAQ/CTA handling if bugs persist |

---

## Testing Criteria

After deploying, run this Playwright test:

```
1. Navigate to https://www.gethandled.ai/tenant/dashboard (new tenant)
2. Say: "Hey! I just signed up. Help me build my site."
3. Agent should ask human questions, NOT mention sections
4. Provide: "I'm a wedding photographer in Austin, 8 years, candid natural moments"
5. Provide: Testimonials when asked
6. Provide: Contact info when asked
7. Agent should show "Take a look" and preview should scroll to show changes
```

**Pass Criteria:**

- [ ] Agent never says "section", "hero", "CTA", "draft"
- [ ] Agent never announces "Now let's work on X"
- [ ] Agent asks human questions about business
- [ ] Preview auto-scrolls after updates
- [ ] FAQ section updates work (currently broken)
- [ ] CTA section updates work (currently broken)
- [ ] Feels like concierge service, not website builder tutorial

---

## Reference: The Archived Concierge

The original research-based onboarding was formerly at `server/src/agent-v2/archive/concierge/src/prompts/onboarding.ts` (archive directory deleted; available in git history).

Key patterns to restore:

- Goal-based (not phase-based)
- "Generate, Then Ask" pattern
- 15-20 minute target
- Research integration for pricing
- Memory management with stored facts
- No technical terminology

---

## Current Bugs (May Fix Themselves After Prompt Update)

1. **FAQ section updates fail** - "That didn't work" error loop
2. **CTA section updates fail** - Same error
3. **Auto-scroll never triggers** - Prompt not being followed

Check Cloud Run logs for actual error messages if bugs persist after prompt update.

---

## Deploy Command

```bash
cd server/src/agent-v2/deploy/tenant && npm run deploy
```

---

## Full Issues Documentation

See: `docs/issues/2026-01-31-tenant-agent-testing-issues.md`

Contains:

- Complete test results
- All 5 issues with severity
- Before/after examples
- Discovery questions analysis
- Priority order
- Root cause analysis
