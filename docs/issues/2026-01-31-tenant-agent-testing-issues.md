# Tenant Agent Testing Issues - January 31, 2026

## Status: ✅ RESOLVED

**Resolution Date:** 2026-01-31
**Resolution:** Redesigned marketing tools to be agent-native, eliminating backend dependency.

## Summary

Playwright testing of the tenant-agent in production revealed several issues. The agent's core functionality (storefront editing) works well, but content generation features were broken and UX improvements were needed.

**Root Cause:** Marketing tools called backend routes that didn't exist. The old architecture had Agent → Backend → Vertex AI, but the tenant-agent IS on Vertex AI with direct Gemini access.

**Fix Applied:** Rewrote tools to return generation instructions, letting the agent generate copy natively. This is faster, simpler, and eliminated the need for backend routes.

---

## Critical Issues

### 1. Marketing Tools Return 404 - Backend Routes Missing

**Severity:** HIGH - Feature completely broken

**Symptoms:**

- "Write me a tagline" → "That didn't work. Want me to try a different approach?"
- "Make my headline more engaging" → Same error

**Root Cause:**
The tenant-agent's marketing tools call backend API routes that don't exist:

```
POST /v1/internal/agent/marketing/generate-copy → 404 NOT_FOUND
POST /v1/internal/agent/marketing/improve-section → 404 NOT_FOUND
```

**Cloud Run Logs:**

```json
{"error":"Route POST /v1/internal/agent/marketing/generate-copy not found","status":404}
{"error":"Route POST /v1/internal/agent/marketing/improve-section not found","status":404}
```

**Fix Required:**

1. Implement `/v1/internal/agent/marketing/generate-copy` route in `server/src/routes/internal/agent.routes.ts`
2. Implement `/v1/internal/agent/marketing/improve-section` route
3. Create `MarketingCopyService` or integrate with existing LLM infrastructure
4. Redeploy Render backend

**Files to Check:**

- `server/src/routes/internal/agent.routes.ts` - Add missing routes
- `server/src/agent-v2/deploy/tenant/src/tools/marketing.ts` - See expected API contract
- `packages/contracts/src/internal/agent.ts` - Add contract definitions

---

## UX Improvements Needed

### 2. Agent Should Auto-Scroll After Section Updates

**Severity:** MEDIUM - UX improvement

**Current Behavior:**
After updating a section (e.g., FAQ headline), the agent says "Done! Updated in your draft." but the preview doesn't scroll to show the updated section.

**Expected Behavior:**
Agent should automatically call `scroll_to_website_section` after any `update_section` call to show the user what changed.

**Fix Options:**

**Option A: Prompt Update**
Add to `TENANT_AGENT_SYSTEM_PROMPT`:

```
After updating any section with update_section, ALWAYS call scroll_to_website_section
to scroll the preview to the updated section so the user can see their changes.
```

**Option B: Tool Chaining**
Modify `update_section` tool to automatically return a `dashboardAction` with scroll behavior.

**Recommendation:** Option A is simpler and follows the existing pattern.

---

## Test Results Summary

| Test                         | Status     | Notes                                              |
| ---------------------------- | ---------- | -------------------------------------------------- |
| Greeting response            | ✅ PASS    | "Living the dream. What's up?" - terse, cheeky     |
| Content update (exact text)  | ✅ PASS    | Used exact text, updated draft, terse confirmation |
| Content generation           | ❌ FAIL    | Backend routes missing (404)                       |
| Content improvement          | ❌ FAIL    | Backend routes missing (404)                       |
| T3 publish confirmation      | ✅ PASS    | "Ready to publish? This goes live immediately."    |
| T3 decline handling          | ✅ PASS    | "Heard." - appropriate confirmation                |
| Scroll to section (explicit) | ✅ PASS    | "FAQ section in view."                             |
| Auto-scroll after update     | ⚠️ MISSING | Agent doesn't scroll after updates                 |
| Voice compliance             | ✅ PASS    | No forbidden phrases observed                      |
| Draft state awareness        | ✅ PASS    | Says "in your draft" appropriately                 |

---

## Prompt Compliance Analysis

### What's Working Well

1. **Terse responses** - Agent uses minimal words ("Done!", "Heard.", "Living the dream.")
2. **Allowed confirmations** - Uses "done", "heard", "got it" vocabulary
3. **No forbidden phrases** - No "Great!", "Perfect!", "I'd be happy to"
4. **T3 confirmation flow** - Properly asks before publishing
5. **Tool-first behavior** - Calls tools before responding with text
6. **Draft awareness** - Correctly references draft state

### Areas for Improvement

1. **Auto-scroll missing** - Should scroll to updated sections
2. **Marketing features broken** - Backend routes need implementation
3. **No research integration** - Earlier test showed research also failed

---

## Next Steps for AI Agent

### Priority 1: Implement Missing Backend Routes

1. Read `server/src/agent-v2/deploy/tenant/src/tools/marketing.ts` to understand expected API
2. Add routes to `server/src/routes/internal/agent.routes.ts`:
   - `POST /v1/internal/agent/marketing/generate-copy`
   - `POST /v1/internal/agent/marketing/improve-section`
3. Implement service layer (likely needs Vertex AI integration for copy generation)
4. Add to contracts in `packages/contracts/src/internal/agent.ts`
5. Test locally with `npm run dev:api`
6. Push to main to trigger Render deploy

### Priority 2: Add Auto-Scroll to Prompt

1. Edit `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`
2. Add instruction to scroll after section updates
3. Redeploy tenant-agent to Cloud Run:
   ```bash
   cd server/src/agent-v2/deploy/tenant && npm run deploy
   ```

### Priority 3: Verify Research Agent Integration

The earlier "research Austin weddings" request also failed - verify research-agent is properly configured and reachable.

---

## Tool Architecture Analysis

### Current Design (Outdated)

The marketing tools use a **backend proxy pattern** inherited from the multi-agent era:

```
User Request → Tenant Agent → callMaisApi('/marketing/generate-copy') → Render Backend → Vertex AI → Response
```

**Problem:** The tenant-agent IS running on Vertex AI with Gemini 2.0 Flash. It's calling out to a backend that would need to call BACK to Vertex AI. This is:

- Slower (extra network hop)
- More complex (two services to maintain)
- More expensive (double API calls)
- Currently broken (routes don't exist)

### Tool Categories

| Tool Type              | Needs Backend? | Reason                           |
| ---------------------- | -------------- | -------------------------------- |
| `get_page_structure`   | ✅ Yes         | Database read                    |
| `update_section`       | ✅ Yes         | Database write                   |
| `publish_draft`        | ✅ Yes         | Database write                   |
| `generate_copy`        | ❌ No          | Pure LLM generation              |
| `improve_section_copy` | ⚠️ Partial     | Needs DB read, LLM gen, DB write |

### Recommended Redesign

#### Option A: Agent-Native Copy Generation (RECOMMENDED)

Remove the backend call entirely. The agent already has LLM access:

```typescript
// NEW marketing.ts - agent-side generation
export const generateCopyTool = new FunctionTool({
  name: 'generate_copy',
  description: `Generate marketing copy directly. Returns structured prompt guidance.`,
  parameters: GenerateCopyParams,
  execute: async (params, context) => {
    // Validate params
    const parseResult = GenerateCopyParams.safeParse(params);
    if (!parseResult.success) return { success: false, error: 'Invalid parameters' };

    // Return generation context - the LLM will generate copy in its next response
    return {
      success: true,
      action: 'GENERATE_COPY',
      copyType: parseResult.data.copyType,
      tone: parseResult.data.tone,
      context: parseResult.data.context,
      instructions: buildCopyPrompt(parseResult.data), // Returns generation guidelines
    };
  },
});

function buildCopyPrompt(params: GenerateCopyInput): string {
  const templates = {
    headline: `Generate a ${params.tone} headline for: ${params.context}. Keep under 10 words.`,
    tagline: `Create a ${params.tone} tagline for: ${params.context}. Keep under 7 words.`,
    description: `Write a ${params.tone} service description for: ${params.context}. 50-150 words.`,
    about: `Write an ${params.tone} about section for: ${params.context}. 100-300 words.`,
  };
  return templates[params.copyType];
}
```

**Benefits:**

- No backend routes to implement
- Faster responses (no network hop)
- Simpler architecture
- Works immediately after deploy

#### Option B: Hybrid for improve_section_copy

Since `improve_section_copy` needs the current content, use a two-step flow:

```typescript
export const improveSectionCopyTool = new FunctionTool({
  name: 'improve_section_copy',
  execute: async (params, context) => {
    // Step 1: Get current content from backend
    const currentContent = await callMaisApi('/storefront/section', tenantId, {
      sectionId: params.sectionId,
    });

    // Step 2: Return context for agent to generate improvement
    return {
      success: true,
      action: 'IMPROVE_COPY',
      currentContent: currentContent.data,
      feedback: params.feedback,
      instructions: `Improve this content based on feedback: "${params.feedback}". Current: "${currentContent.data.headline}"`,
      // Agent generates improvement, then calls update_section
    };
  },
});
```

### Implementation Steps

1. **Rewrite `generate_copy`** to return generation context instead of calling backend
2. **Rewrite `improve_section_copy`** to:
   - Call existing `/storefront/section` endpoint for current content
   - Return improvement context for agent to generate
   - (Agent then calls `update_section` with generated copy)
3. **Update system prompt** to handle the new tool response format
4. **Delete the unimplemented backend routes** from the issues list

### Expected Prompt Update

Add to `TENANT_AGENT_SYSTEM_PROMPT`:

```
## Copy Generation Flow

When generate_copy or improve_section_copy returns successfully:
1. The tool returns generation instructions
2. YOU generate the actual copy based on those instructions
3. Present the generated copy to the user
4. When user approves, call update_section to apply it

Example:
User: "Write me a tagline"
→ Tool returns: { action: 'GENERATE_COPY', copyType: 'tagline', context: '...' }
→ YOU generate: "Capturing moments that last forever."
→ Present to user: "How about: 'Capturing moments that last forever.'?"
→ User: "Perfect, use it"
→ Call update_section with the tagline
```

---

## Related Files

- Agent source: `server/src/agent-v2/deploy/tenant/`
- System prompt: `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`
- Marketing tools: `server/src/agent-v2/deploy/tenant/src/tools/marketing.ts`
- Backend routes: `server/src/routes/internal/agent.routes.ts`
- Service registry: `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`

---

## Test Environment

- Production URL: https://www.gethandled.ai/tenant/dashboard
- Tenant: production-test-jan31-1769871632692
- Agent: tenant-agent on Cloud Run
- Backend: Render (mais-5bwx.onrender.com)
- Date: 2026-01-31

---

## Resolution Details (2026-01-31)

### Round 2: Onboarding Mode (2026-01-31 afternoon)

**Problem:** Agent had no concept of onboarding. When user said "build my site", agent asked "What would you like to do?" and mentioned multi-page setup. Agent was passive and reactive.

**Root Cause:** The archived concierge agent had a complete onboarding system in `server/src/agent-v2/archive/concierge/src/prompts/onboarding.ts` that never got migrated to the tenant-agent.

**Fix Applied:**

1. Added comprehensive "ONBOARDING MODE" section to tenant-agent system prompt
2. Added "Generate, Then Ask" pattern - agent drafts content, asks "what feels off?"
3. Added discovery questions (bar order → brand voice, anti-client, etc.)
4. Clarified MVP = single landing page (no multi-page references)
5. Added "Never Dead-End" rules - every response must have next action
6. Updated decision flow to detect onboarding state from placeholders

**Test Results (Post-Fix):**
| Test | Status | Notes |
|------|--------|-------|
| "Help me build my site" | ✅ PASS | "Let's build this together. First - what do you do?" |
| Section-to-section flow | ✅ PASS | "Done! Now let's tackle your Testimonials section..." |
| No multi-page mention | ✅ PASS | Agent doesn't offer to "enable pages" |
| Generate, Then Ask | ✅ PASS | Generates tagline, asks "How's that sound?" |

---

### Round 1: Marketing Tools & HTML Encoding

### Changes Made

1. **Rewrote `marketing.ts`** - Agent-native copy generation
   - `generate_copy`: Returns generation instructions instead of calling backend
   - `improve_section_copy`: Reads current content via `/storefront/section`, returns improvement instructions
   - Agent generates copy using its native Gemini 2.0 Flash capabilities

2. **Updated `system.ts` prompt**
   - Added explicit auto-scroll instruction after `update_section`
   - Added "Agent-Native Copy Generation" section explaining the new workflow
   - Updated decision flow to clarify tool-returns-instructions pattern

3. **Deployed to Cloud Run**
   - Service: tenant-agent-00006-75v
   - URL: https://tenant-agent-506923455711.us-central1.run.app

### Test Results (Post-Fix)

| Test                     | Status  | Notes                                                           |
| ------------------------ | ------- | --------------------------------------------------------------- |
| Generate tagline         | ✅ PASS | "How about: 'Authentic Moments, Forever Captured'?"             |
| Improve subheadline      | ✅ PASS | Updated to "Turning fleeting moments into timeless memories..." |
| Auto-scroll after update | ✅ PASS | Preview scrolls to show changes                                 |
| Tool indicators          | ✅ PASS | Marketing ✓, Storefront ✓ shown correctly                       |

### Architecture Comparison

**Before (Broken):**

```
User → Agent → callMaisApi('/marketing/generate-copy') → 404 NOT_FOUND
```

**After (Working):**

```
User → Agent → generate_copy() → { instructions: "..." }
              → Agent generates copy natively (Gemini 2.0 Flash)
              → Presents to user
              → update_section() → Applied to draft
              → scroll_to_website_section() → Shows change
```

### Files Modified

- `server/src/agent-v2/deploy/tenant/src/tools/marketing.ts` (complete rewrite)
- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` (added sections)

---

## Round 3: Onboarding Flow End-to-End Testing (2026-01-31)

**Test Date:** 2026-01-31 afternoon
**Tester:** Playwright automation + user observation
**Test Scenario:** New user says "Help me build my site" and provides wedding photography business info

### Critical Issues Found

#### Issue 1: Auto-Scroll Not Working (HIGH PRIORITY)

**Severity:** HIGH - UX breakdown, user can't see what changed

**Symptoms:**

- Agent updates sections (Testimonials, Contact, CTA) but preview stays at current scroll position
- User has no visual feedback about what changed
- Requires manual scrolling to verify updates

**Expected Behavior:**
Agent should call `scroll_to_website_section` immediately after every `update_section` call to show the user what changed.

**Evidence:**

- Contact section updated (heading changed to "Contact Sarah") ✓
- Preview remained scrolled to same position ✓
- No scroll action observed in tool indicators ✗

**Root Cause:**
The system.ts prompt has auto-scroll instructions from Round 1, but they're not being followed consistently. Either:

1. Instructions aren't clear enough
2. Agent is choosing not to scroll
3. Tool execution order issue

**Fix Required:**
Review and strengthen auto-scroll instructions in `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`.

---

#### Issue 2: FAQ Section Updates Failing (HIGH PRIORITY)

**Severity:** HIGH - Feature completely broken

**Symptoms:**
User provided 3 FAQ items with questions and answers:

```
"How long is a typical session?" (2-3 hours for weddings, 1 hour for family)
"What's your editing turnaround?" (2-3 weeks)
"Do you travel?" (Yes, Austin + 50 miles included, beyond that we can talk)
```

Agent response: "That didn't work. Want me to try a different approach?"

- Repeated failure on retry
- Agent entered error loop (failed twice in a row)

**Expected Behavior:**
Agent should parse the FAQ content and update the FAQ section with structured Q&A items.

**Hypothesis:**
FAQ section might use a different data structure (array of objects?) that the agent's tool can't handle properly.

**Investigation Needed:**

1. Check FAQ section schema in `landingPageConfig`
2. Review `update_section` tool handling of FAQ data
3. Check Cloud Run logs for actual error message

---

#### Issue 3: CTA Section Updates Failing (HIGH PRIORITY)

**Severity:** HIGH - Feature completely broken

**Symptoms:**
User approved CTA text "Schedule a Call"
Agent response: "That didn't work. Want me to try a different approach?"
Tool indicator showed: Storefront ✓ (suggesting tool was called)

**Expected Behavior:**
Agent should update CTA section with approved text.

**Investigation Needed:**
Same as FAQ - check CTA section schema and error logs.

---

#### Issue 4: Agent Asks Conversion Philosophy Questions (MEDIUM - DESIGN ISSUE)

**Severity:** MEDIUM - Agent doesn't understand HANDLED's business model

**What Happened:**
Agent asked: "Now, what's the action you want people to take when they land on your site? Book a call? Buy now?"

**Why This Is Wrong:**
HANDLED is a booking/conversion platform. The answer is ALWAYS "book a package" or "book a consultation". The agent shouldn't need to ask - it should already optimize for conversion.

**Expected Behavior:**
Agent should say something like:

- "I've set up your CTA to drive bookings. Want to tweak the wording?"
- "Your site is optimized for package bookings. Ready to preview?"

**Fix Required:**
Update system prompt to include HANDLED's business model context:

```
HANDLED is a booking platform for service professionals (photographers, coaches, therapists, etc.).
EVERY tenant's site should optimize for conversions:
- Hero CTA → View packages or book consultation
- Section CTAs → Drive to booking flow
- Social proof → Build trust before booking
You don't need to ask "what action do you want" - it's always driving bookings.
```

---

#### Issue 5: Agent Uses Technical Jargon (CRITICAL - BRAND VIOLATION)

**Severity:** CRITICAL - Violates core brand promise "we handle it for you"

**What Happened:**
Agent used website builder terminology throughout the conversation:

- "Now let's tackle your **Testimonials section**"
- References to "sections", "hero", "CTA"
- Explaining website structure instead of just building it

**Why This Is Wrong:**
HANDLED customers are **non-technical business owners** (photographers, coaches, therapists) who:

- Don't know what a "hero section" is
- Don't care about website architecture
- Just want a site that converts - **they want it HANDLED**

The brand promise is literally in the name: **HANDLED = we do it for you**.

**Current Experience (Wrong):**

```
Agent: "Now let's tackle your Testimonials section. Got any client quotes?"
User thinks: "What's a section? Is testimonials different from reviews?"
```

**Expected Experience (Right):**

```
Agent: "What have happy clients said about working with you?"
User thinks: "Oh, I have tons of those!"
[Agent quietly builds testimonials section behind the scenes]
```

**Real Examples from Test:**

| Agent Said (Technical)                       | Should Say (Human)                               |
| -------------------------------------------- | ------------------------------------------------ |
| "Now let's tackle your Testimonials section" | "What have clients said about working with you?" |
| "I've updated your draft"                    | "Got it. What else should people know?"          |
| "What action do you want people to take?"    | [Don't ask - just optimize for bookings]         |
| "Let's do the Contact section"               | "How should clients reach you?"                  |

**The Core Problem:**
The agent is positioned as a **co-builder** teaching the user about website structure, when it should be positioned as a **service provider** gathering business info and handling all the technical details.

**Customer Mental Model:**

```
"I'm a wedding photographer, not a web designer.
I don't know what sections are or what a hero is.
I just want a site that books clients.
That's why I'm paying HANDLED."
```

**Fix Required:**

1. **Remove ALL technical terminology from agent responses:**
   - ❌ "section", "hero", "CTA", "draft", "published"
   - ✅ Natural questions about their business

2. **Stop explaining website structure:**
   - ❌ "Now let's tackle X section"
   - ✅ Just ask the next question

3. **Don't announce technical actions:**
   - ❌ "I've updated your draft"
   - ✅ "Got it" (user doesn't need to know HOW it's stored)

4. **Reframe as service, not collaboration:**
   - ❌ "Let's build this together"
   - ✅ "I'll handle this. Tell me about your business"

5. **Update system prompt with customer profile:**

```
## CRITICAL: Customer Profile

Your customers are NON-TECHNICAL business owners:
- Photographers, coaches, therapists, wedding planners
- They have NO IDEA how websites work
- They don't know what "hero sections" or "CTAs" are
- They don't WANT to learn web design
- **They're paying HANDLED to handle it FOR them**

YOUR JOB: Be their concierge, not their teacher.
- Ask human questions about their business
- Build the site behind the scenes
- Never use technical terms
- Never explain website structure
- Never say "let's work on X section"

EXAMPLES:
❌ "Let's tackle your Testimonials section"
✅ "What have clients said about working with you?"

❌ "I've updated your draft"
✅ "Got it"

❌ "What's the action you want people to take?"
✅ [Just optimize for bookings - don't ask]
```

**Impact:**
This is a **fundamental misalignment** between the product promise ("we handle it") and the agent behavior (teaching website architecture). Every time the agent says "section" or "draft", it reminds the user they're dealing with technical complexity - the exact thing HANDLED promises to eliminate.

**Key Insight from Product Owner:**

> "HANDLED has a **fixed, predefined site structure** (Hero → About → Services → Testimonials → FAQ → Contact → CTA). The agent KNOWS this structure. The customer should NEVER know it exists. Just ask questions, fill in the blanks, give them a conversion-optimized site."

**The Concierge Mental Model:**

Think of it like a white-glove personal assistant:

```
USER: "I need a website"

❌ CURRENT (Website Builder):
Agent: "Great! Let's work on your hero section first.
        Then we'll tackle testimonials.
        Then your CTA section..."
User: "What's a hero? What's a CTA? I'm confused."

✅ CORRECT (Concierge Service):
Agent: "I'll handle that. What do you do?"
User: "I'm a wedding photographer"
Agent: "Who's your dream client?"
User: "Couples who want natural, candid moments"
Agent: "What have happy couples said about you?"
User: [gives testimonials]
Agent: "How should people reach you?"
User: [gives contact info]
Agent: "Take a look. Ready to publish?"
User: [sees beautiful conversion-optimized site]
User: "Wow, that was easy!"
```

The customer **never learns** about sections, structure, or web design. They just answer human questions about their business and get a professional site.

**Files to Update:**

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` - Add customer profile, remove technical language
- `server/src/agent-v2/deploy/tenant/src/prompts/onboarding.ts` - Reframe questions in human terms
- Review ALL agent responses for jargon

**Testing Criteria:**
After the fix, run this test: Can a **non-technical user** complete onboarding without ever feeling confused about website terminology? If they ask "what's a section?" or "what's a hero?", we failed.

---

### Test Results Summary

| Section              | Test Input                                             | Status  | Notes                                                            |
| -------------------- | ------------------------------------------------------ | ------- | ---------------------------------------------------------------- |
| **Hero**             | Tagline: "Capturing candid, natural moments in Austin" | ✅ PASS | Generated and applied                                            |
| **Testimonials**     | 2 client testimonials with names                       | ✅ PASS | Updated successfully                                             |
| **FAQ**              | 3 Q&A pairs                                            | ❌ FAIL | "That didn't work" error loop                                    |
| **Contact**          | Austin, email, phone, Instagram                        | ✅ PASS | Heading updated to "Contact Sarah"                               |
| **CTA**              | "Schedule a Call"                                      | ❌ FAIL | "That didn't work" after approval                                |
| **Auto-scroll**      | After each update                                      | ❌ FAIL | Never triggered, user can't see changes                          |
| **Conversion focus** | Agent understanding of platform                        | ❌ FAIL | Asks philosophy questions instead of building conversion content |

**Success Rate:** 2/7 tests passed (29%)

---

### Working Sections

- ✅ Hero (headline, tagline)
- ✅ About (heading updates)
- ✅ Testimonials (full content)
- ✅ Contact (heading, basic info)

### Broken Sections

- ❌ FAQ (complete failure, error loop)
- ❌ CTA (update fails despite tool call)

### Systemic Issues

- ❌ Auto-scroll never works (user can't see updates)
- ❌ Agent lacks HANDLED business model context

---

### Next Steps

**Priority 0: Remove Technical Jargon (BRAND VIOLATION - MOST CRITICAL)**

1. Edit `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`
2. Add "CRITICAL: Customer Profile" section (see Issue 5 for exact text)
3. Add "HANDLED Platform Context" (see Issue 4)
4. Rewrite onboarding questions to remove ALL technical terms:
   - "section", "hero", "CTA", "draft", "published"
5. Test: Non-technical user should complete onboarding without confusion
6. Redeploy tenant-agent

**Priority 1: Fix Auto-Scroll (Blocker for UX)**

1. Check Cloud Run logs for scroll_to_website_section calls
2. Verify the tool is being called after update_section
3. If not called: strengthen prompt instructions
4. If called but failing: debug the tool execution

**Priority 2: Fix FAQ/CTA Updates**

1. Get Cloud Run logs for the failed attempts
2. Check schema of FAQ and CTA sections
3. Compare to working sections (Hero, Testimonials, Contact)
4. Fix schema handling or tool validation

---

### Cloud Run Logs Needed

To diagnose the failures, we need logs from:

- Service: tenant-agent
- Time range: Last 30 minutes
- Search for: "update_section", "FAQ", "CTA", "error"

---

### Files to Check

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` - Auto-scroll and business model context
- `server/src/agent-v2/deploy/tenant/src/tools/storefront.ts` - update_section tool
- Cloud Run logs - Actual error messages
- `apps/web/src/lib/tenant.ts` - landingPageConfig schema (FAQ, CTA structure)

---

## Onboarding Questions Analysis

**Good News:** ✅ The researched discovery questions ARE in the code (lines 97-123 of system.ts)

### The Optimal Questions (All Present)

| Question                                                  | Purpose                            | Maps To                                                          |
| --------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| "If your business walked into a bar, what's it ordering?" | Brand voice discovery              | martini=sophisticated, beer=warm, tequila=punchy, water=clinical |
| "Please do NOT hire me if you..."                         | Anti-client (ideal client inverse) | Differentiation, positioning                                     |
| "Warm Grandma or NASA Engineer?"                          | Technical level                    | approachable vs technical voice                                  |
| "What sound do they make when done?"                      | Outcome emotion                    | relief/excitement/gratitude → messaging focus                    |
| "If the world was ending, why would people need you?"     | Core utility                       | Value proposition clarity                                        |
| "John Wick or Ted Lasso?"                                 | Archetype                          | premium/precise vs supportive/collaborative                      |
| "One thing competitors do that makes you flip a table?"   | Differentiation                    | What NOT to do                                                   |

**These are excellent questions.** They're pattern interrupts that get authentic answers instead of corporate-speak.

### What's Missing from Current Implementation

Compared to the archived concierge's onboarding system, the current tenant-agent has:

**❌ MISSING: Goal-Based Flow**

- **Archived:** Fluid conversation, agent decides when it has enough info
- **Current:** Rigid section-by-section checklist (Hero → About → Services → ...)
- **Impact:** Feels like filling out a form instead of a conversation

**❌ MISSING: Fact-to-Storefront Bridge (Pitfall #88)**

- **Archived:** When user says "my about should mention X" → store_discovery_fact AND delegate_to_storefront (both tools)
- **Current:** Agent stores fact but forgets to apply it to storefront
- **Impact:** User says what they want, nothing happens, they repeat themselves

**❌ MISSING: Research Integration**

```typescript
// Archived concierge had:
"Looking at competitors in Austin, most wedding photographers charge $2500-$4500.
Want me to position you in that range?"

// Current tenant-agent:
"What's your pricing?" (no research, no guidance)
```

**❌ MISSING: Time Box**

- **Archived:** "15-20 minutes to complete storefront"
- **Current:** No target, could go on forever

**❌ MISSING: Memory Management**

- **Archived:** store_discovery_fact with factKey/factValue, resume naturally
- **Current:** Asks same questions if session interrupted

**❌ MISSING: Completion Signal**

- **Archived:** complete_onboarding tool call when user publishes
- **Current:** No formal completion, user just exits

### What's WORSE in Current Implementation

**Technical Jargon Everywhere:**

```
Archived: "Based on what you told me, here are three package options..."
Current:  "Now let's tackle your Testimonials section"
          ^^^^ Using website builder language
```

**Phase-Based Instead of Goal-Based:**

```
Archived: Agent decides when it has enough → generates full draft → iterates
Current:  Walks through 7 sections in order regardless of user needs
```

**Asks Users to Write Copy:**

```
Archived: "Here's your headline - what feels off?"
Current:  "What action do you want people to take?" (makes user think about UX)
```

### The Root Cause

Someone took the **QUESTIONS** from the research (good!) but changed the **EXECUTION STRATEGY** from goal-based to phase-based (bad!). This added structure but lost the conversational flow.

The result:

- ✅ Has the right questions
- ❌ Asks them like a checklist
- ❌ Uses technical terminology
- ❌ Doesn't research pricing
- ❌ Doesn't remember facts across sessions
- ❌ Doesn't apply facts to storefront automatically

### Recommendation

**Don't throw out the current structure** - the section-by-section flow CAN work. But we need to:

1. **Remove all jargon** (Priority 0 - already documented)
2. **Add fact-to-storefront bridge** (when user says "my about should..." → store AND update)
3. **Add research tool** for pricing validation
4. **Add time pressure** ("Let's get you live in 15 minutes")
5. **Make it goal-based within sections** (don't announce "Now testimonials" - just ask "What have clients said?")

The questions are solid. The execution needs refinement.
