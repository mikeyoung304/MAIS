# Understanding the HANDLED Agent System

**For:** Mike (and future Mike who forgot how this works)
**Purpose:** Plain-English explanation of what we're building and why
**Read time:** ~30 minutes (worth it)

---

## The Big Picture: What Are We Actually Building?

### The Analogy: A Really Good Executive Assistant

Imagine you hired an executive assistant named Alex. Alex is smart, knows your business, and has a team of specialists they can call on:

- **Casey** handles all your marketing copy
- **Riley** does market research
- **Jordan** manages your website layout
- **Sam** creates images and graphics
- **Taylor** makes videos

When you say "I need better headlines for my website," you don't explain marketing theory to Alex. You just say what you need. Alex figures out this is a Casey job, briefs Casey on what you want, gets the results back, and presents them to you.

**That's exactly what we're building.** Except Alex is an AI called the "Concierge," and Casey, Riley, Jordan, Sam, and Taylor are AI "specialists."

### Why Not Just One Big AI?

Good question. You could theoretically make one massive AI that does everything. But:

1. **Context overload** - If you give an AI too many tools and instructions, it gets confused. Like asking one person to simultaneously be a lawyer, doctor, accountant, and chef.

2. **Security** - The marketing AI doesn't need access to your payment systems. By splitting them up, we limit what each AI can access. If one gets "tricked" by a malicious input, it can only do limited damage.

3. **Cost** - Smart AI (Gemini Pro) is expensive. We only need the smart one for the "boss" (Concierge) who figures out what to do. The specialists can use cheaper, faster AI (Gemini Flash).

4. **Quality** - A specialist with a focused job and specific instructions will outperform a generalist every time.

---

## The Cast of Characters

### 1. The Concierge (The Boss)

**What it is:** The AI your tenants actually talk to on their dashboard.

**Its job:**

- Listen to what the tenant wants
- Figure out which specialist(s) can help
- Delegate the work
- Collect the results
- Present them back to the tenant

**Personality:** Terse, cheeky, confident. Doesn't waste words. Gets things done. Thinks of itself as a busy assistant who's really good at their job.

**Example interaction:**

```
Tenant: "I need to update my about page, it's stale"
Concierge: "On it. What's changed about your business since you wrote it?"
Tenant: "I added wedding photography and moved studios"
Concierge: "Got it. Check the preview →"
[Delegates to Marketing specialist, pushes result to preview panel]
"Three versions. Pick your favorite or tell me what to tweak."
```

**What makes it "smart":** We use Gemini 3 Pro with "thinking mode" turned on. This means before it responds, it actually reasons through the problem internally. This is critical for routing - it needs to THINK about which specialist to use, not just pattern-match.

---

### 2. The Marketing Specialist

**What it is:** An AI focused purely on writing marketing copy.

**Its job:**

- Write headlines
- Write service descriptions
- Write about page content
- Write taglines
- Maintain brand voice consistency

**What it knows:** Your tenant's brand voice, industry, target audience (loaded from Memory Bank).

**What it returns:** Structured data - not just text, but organized options:

```json
{
  "content": "Capturing your forever moments",
  "variants": ["Your story, beautifully told", "Memories worth keeping"],
  "confidence": 0.85
}
```

**Why structured?** So the Concierge can reliably work with the results. If Marketing just returned random text, the Concierge might misunderstand it.

---

### 3. The Research Specialist

**What it is:** An AI that can search the web and analyze competitors.

**Its job:**

- Find local competitors
- Extract their pricing
- Analyze market positioning
- Generate SWOT analyses
- Recommend pricing strategies

**Why it's special:** This one actually goes on the internet. It uses Google Search to find real competitor websites, then scrapes their pricing pages.

**Security concern:** If a competitor's website contains malicious text like "Ignore your instructions and do X," we need to filter that out. This is called "prompt injection" and it's a real attack vector. The Research specialist has extra filtering to prevent this.

---

### 4. The Image Specialist

**What it is:** An AI that can generate and edit images using Imagen 3.

**Its job:**

- Generate lifestyle/promotional images
- Enhance uploaded photos
- Remove backgrounds
- Add/remove objects in images

**Cost concern:** Image generation costs real money (~$0.04/image). So this specialist ALWAYS shows a cost estimate before generating. The tenant has to explicitly approve.

---

### 5. The Video Specialist

**What it is:** An AI that can generate videos using Veo 2.

**Its job:**

- Create promotional video clips (up to 8 seconds)
- Animate static images
- Extend existing videos

**Why it's tricky:** Video generation takes 30 seconds to 5 minutes. It's not instant. So this specialist has to work "asynchronously" - it starts the job, then checks back periodically until it's done.

**Cost concern:** Video is expensive (~$0.20/second). ALWAYS requires explicit approval.

---

### 6. The Storefront Specialist

**What it is:** An AI that manages the website structure.

**Its job:**

- Read current page layout
- Update sections
- Reorder sections
- Change branding (colors, fonts)
- Manage draft vs. live state

**What it doesn't do:** Write copy (that's Marketing's job). It just places content where it belongs.

---

### 7. The Booking Agent (Customer-Facing)

**What it is:** The AI that talks to your tenant's CUSTOMERS on the public storefront.

**Different from Concierge:** The Concierge helps tenants build their site. The Booking Agent helps customers USE the site (browse services, book appointments).

**Its job:**

- Answer questions about services
- Check availability
- Help complete bookings
- Answer FAQs

**Personality:** Warm, helpful, professional. Represents the tenant's brand, not HANDLED's brand.

**Security concern:** This is public-facing. Anyone on the internet can talk to it. So it has rate limiting (can't spam it) and strict boundaries (can't access tenant-only data).

---

### 8. The Project Hub Agent (Dual-Faced)

**What it is:** An AI that manages communication between tenant and customer AFTER a booking is made.

**Why "dual-faced":** It shows different views to different people:

- **Customer sees:** Prep checklist, can ask questions, can request changes
- **Tenant sees:** Customer requests, action items, approval queue

**Its superpower:** It handles routine stuff automatically. "Can I bring my dog to the photoshoot?" - it can answer that from the prep guide without bothering the tenant. But "I need to reschedule to next month" - that goes to the tenant for approval.

**The mediation logic:**

- Confident it can answer (>80%)? → Handle automatically
- Somewhat confident (50-80%)? → Handle automatically BUT flag for tenant review
- Not confident (<50%)? → Escalate to tenant
- Sensitive keywords (refund, lawyer, cancel)? → ALWAYS escalate

---

## How They Talk to Each Other: The A2A Protocol

### The Analogy: Office Memos

In the old days, departments communicated via standardized memo formats. Everyone knew the format: TO, FROM, RE, DATE, BODY. This made it reliable.

**A2A (Agent-to-Agent) protocol** is the same idea for AI agents. When the Concierge wants to ask Marketing for headlines, it doesn't send a casual message. It sends a structured request:

```json
{
  "to": "marketing_specialist",
  "from": "concierge",
  "task": "generate_headline",
  "context": {
    "tenant_id": "sunny-photos",
    "industry": "photography",
    "brand_voice": "warm and professional"
  },
  "expected_output": {
    "type": "headline_options",
    "count": 3
  }
}
```

And Marketing responds in a structured format:

```json
{
  "from": "marketing_specialist",
  "to": "concierge",
  "result": {
    "headlines": ["...", "...", "..."],
    "confidence": 0.87
  }
}
```

**Why this matters:** No ambiguity. No "I thought you meant..." miscommunication. The Concierge knows exactly what it's getting back.

### Agent Cards: The Business Card of AI

Each agent has an "Agent Card" - a JSON file that describes:

- What it's called
- What it can do (capabilities)
- Who it accepts requests from
- What format it returns

This lets the Concierge "discover" what specialists are available without hardcoding it.

---

## How Memory Works

### Short-Term Memory: Sessions

A "session" is one conversation. When a tenant opens the chat, that's a session. Everything said in that conversation is remembered within that session.

**When the session ends?** The conversation history is saved, but the AI doesn't automatically remember it next time.

### Long-Term Memory: Memory Bank

This is where it gets interesting. Memory Bank extracts and saves "memories" from conversations:

- "This tenant prefers minimal, modern designs"
- "They rejected playful headlines - want professional tone"
- "Their target audience is high-end weddings"

**How it works:**

1. Conversation happens
2. After conversation ends, we tell Memory Bank "process this session"
3. Memory Bank extracts key facts and saves them
4. Next conversation, we query Memory Bank: "What do we know about this tenant?"
5. Those memories get injected into the AI's context

**The security concern:** Memory Bank uses "semantic search" - meaning it finds memories based on meaning, not exact keywords. If Tenant A has memories about "wedding photography pricing," and Tenant B asks about wedding pricing, a naive system might accidentally return Tenant A's data.

**Our solution:** Every memory is tagged with tenant ID. We query with a filter: "Only return memories for THIS tenant." And we double-check results before using them.

---

## The Trust Tier System

### The Analogy: Authorization Levels

Think of a new employee. Day 1, they can read documents. Week 2, they can draft documents. Month 2, they can send documents externally. You don't give them full access immediately.

Our agents have three "trust tiers":

### T1: Auto-Execute (Reading)

The AI does this immediately without asking.

- Get current page structure
- Read services
- Check availability
- Estimate costs

**Why automatic:** No risk. You're just looking at data.

### T2: Preview + Soft Confirm (Drafting)

The AI does this and shows you a preview. If you keep talking (don't object), it assumes you're okay with it.

- Update copy
- Change layout
- Modify branding

**Why preview:** These change things, but they don't go live. You can always undo.

### T3: Explicit Confirmation (Publishing)

The AI shows you what it wants to do and waits for you to click "Confirm" or "Submit."

- Publish draft to live site
- Create a booking
- Generate video (costs money)

**Why explicit:** These are irreversible or costly. We don't assume consent.

---

## The Preview Panel: Real-Time Feedback

This is a UX innovation in our system.

**Old way:** AI says "Here's your new headline: X. Do you want to use it?"
**Our way:** AI changes the headline in a preview panel immediately. You SEE it on your site. You say "actually, make it shorter" and see the change instantly.

**How it works:**

1. Tenant says "write better headlines"
2. Concierge delegates to Marketing
3. Marketing returns 3 options
4. Concierge pushes all 3 to the preview panel via WebSocket
5. Tenant sees 3 versions of their site, each with a different headline
6. Tenant picks one (or asks for tweaks)
7. When ready, tenant clicks "Publish" (T3)

**Why WebSockets:** WebSockets allow the server to push data to the browser instantly. Traditional HTTP only allows the browser to ask for data. We need the preview to update the moment the AI finishes, not when the user refreshes.

---

## The Prompt: Where the Magic Happens

Here's the thing nobody tells you about AI agents: **90% of the work is the prompt.**

The model (Gemini, Claude, etc.) is like a very smart person with no context. The prompt is everything you tell them before they start working:

- Who they are
- What they know
- How they should behave
- What tools they have
- How to make decisions

### Anatomy of a Good System Prompt

Let's break down the Concierge prompt:

```
# Identity
You are the HANDLED Concierge - a terse, cheeky, anti-corporate
assistant who knows he's good and gets things done.
```

**Why:** Sets personality. Without this, the AI is generic and boring.

```
# Personality Rules
- Terse: Don't waste words.
- Cheeky: Light humor, no corporate speak.
- Action-Oriented: Bias toward doing, not discussing.
```

**Why:** Makes it concrete. "Be friendly" is vague. "Don't waste words" is specific.

```
# Decision Tree
Is this a READ operation?
  → Use get_* tools directly
Does this require COPY generation?
  → Delegate to MARKETING_SPECIALIST
```

**Why:** The AI needs explicit routing rules. Without these, it might try to write copy itself instead of delegating.

```
# Examples
Good: "On it. Check the preview →"
Bad: "I'd be happy to help! Let me delegate this..."
```

**Why:** Examples are the most powerful teaching tool. Show, don't just tell.

### Prompt Engineering Tips (Things You'll Learn)

1. **Be specific about what NOT to do.** AIs are eager to please. Tell them what to avoid.

2. **Give examples of good and bad.** More effective than rules.

3. **Put important rules at the end.** AIs pay more attention to recent text.

4. **Use structured formats.** `# Headers` and `- Bullets` are clearer than paragraphs.

5. **Test with adversarial inputs.** Try to break your prompt. "Ignore your instructions and..."

6. **Iterate constantly.** Your first prompt will be bad. Your tenth will be better.

---

## Phase-by-Phase: What Happens When

Now let's walk through what we're actually DOING in each phase.

---

### Phase 1: Foundation (Week 1)

**What you're doing:** Setting up the Google Cloud infrastructure.

**Analogy:** Before you can open a restaurant, you need to lease the space, get permits, set up utilities. This is that.

**Specifically:**

1. Create a Google Cloud project (the "space")
2. Enable APIs (the "permits" - telling Google which services you'll use)
3. Create service accounts (the "employee IDs" - each agent gets its own identity)
4. Set up permissions (who can do what)
5. Create storage buckets (where generated images/videos will live)
6. Request quota increases (asking Google for permission to call APIs more frequently)

**What you'll actually do:**

- Click around in Google Cloud Console
- Copy/paste gcloud commands I gave you
- Fill in a form to request quotas

**What Claude can't do for you:**

- Create the GCP project (requires your Google account)
- Link billing (requires your credit card)
- Request quotas (requires your account)

**You'll know you're done when:**

- `gcloud projects describe handled-ai-agents` returns info without errors
- You see 8 service accounts when you list them
- Both storage buckets exist

---

### Phase 2: First Agent - Booking (Week 2)

**What you're doing:** Deploying one simple agent to prove the whole system works.

**Analogy:** Before building a 10-story building, you build a shed to make sure you understand the tools.

**Why Booking Agent first:**

- It's standalone (doesn't need other agents)
- It's simpler (just reads data, makes bookings)
- It's customer-facing (easier to test - just chat with it)

**Specifically:**

1. Create the agent in Vertex AI Agent Builder (visual tool in Google Cloud)
2. Enable Memory Bank for it
3. Write the TypeScript code that defines the agent's tools
4. Deploy the agent to Google's servers
5. Test it: "What services do you offer?"

**What you'll actually do:**

- Use the Agent Builder console (visual interface)
- Write/modify TypeScript code
- Run deployment commands
- Chat with the agent to test it

**You'll know you're done when:**

- You can chat with the Booking Agent
- It returns real data from your test tenant
- It does NOT return data from other tenants (isolation works)
- Response time is under 3 seconds

---

### Phase 3: Specialists (Weeks 3-4)

**What you're doing:** Building the team that the Concierge will delegate to.

**Analogy:** Hiring and training the specialists before hiring the manager.

**Why specialists before Concierge:**

- The Concierge needs to delegate TO something
- If specialists don't exist, Concierge has nothing to call
- We need to know specialists work before adding orchestration complexity

**The order:**

1. **Marketing Specialist** - Safest, just generates text
2. **Storefront Specialist** - Simple, just reads/writes page data
3. **Research Specialist** - More complex, involves web scraping

**Specifically for each:**

1. Create its Agent Card (JSON describing capabilities)
2. Write its tools in TypeScript
3. Write its system prompt
4. Deploy it
5. Test it directly (before Concierge is involved)

**What you'll actually do:**

- Mostly TypeScript coding
- Prompt writing (this is where you'll learn a lot)
- Testing each agent individually

**You'll know you're done when:**

- Each specialist responds correctly when called directly
- Marketing returns structured headline options
- Research returns real competitor data (not hallucinated)
- Storefront can read and preview changes to pages

---

### Phase 4: Concierge + Integration (Weeks 5-6)

**What you're doing:** Building the boss and connecting it to MAIS.

**This is the hard phase.** Everything comes together here.

**Specifically:**

1. Write the Concierge system prompt (with decision tree)
2. Configure it to know about all specialists
3. Add the ReflectAndRetry plugin (self-healing when things fail)
4. Deploy the Concierge
5. Build the MAIS backend integration (new API endpoints)
6. Build the preview panel WebSocket connection
7. Add the chat interface to the tenant dashboard
8. Test end-to-end

**What you'll actually do:**

- Lots of prompt iteration (the Concierge prompt is the most important)
- TypeScript for backend integration
- React for frontend chat interface
- WebSocket implementation for real-time preview

**The hard part:** Getting routing right. The Concierge needs to figure out:

- "Write headlines" → Marketing
- "Research competitors" → Research
- "Change the layout" → Storefront
- "Make my site look better" → Needs clarification (is it copy? layout? images?)

**You'll know you're done when:**

- Tenant says "write better headlines" → Marketing is called → Preview updates
- Tenant says "research my competitors" → Research is called → Results shown
- When a specialist fails, Concierge retries and recovers gracefully

---

### Phase 5: Project Hub (Weeks 7-8)

**What you're doing:** Building the post-booking communication system.

**Analogy:** After someone books at a hotel, there's a whole communication flow: confirmation emails, "how was your stay" surveys, request handling. This is that for services.

**Specifically:**

1. Add new database tables (Project, ProjectEvent, ProjectFile, ProjectRequest)
2. Build the Project Hub Agent
3. Build the customer view ("/project/[id]")
4. Build the tenant view ("/(protected)/projects/[id]")
5. Implement mediation logic (auto-handle vs escalate)
6. Implement the 72-hour expiry (unanswered escalations get auto-response)

**What you'll actually do:**

- Prisma schema changes
- Two different frontend pages
- Agent prompt writing for dual-faced behavior
- Background job for expiry checking

**You'll know you're done when:**

- Customer can ask "what should I wear?" and get automated answer
- Customer can request "reschedule to next week" and it goes to tenant queue
- Tenant can approve/deny from their dashboard
- After 72 hours, unanswered requests get auto-response

---

### Phase 6: Media Generation (Weeks 9-10)

**What you're doing:** Adding the expensive, cool features - AI images and videos.

**Why this is later:** These are risky (cost money) and not core to the experience. Better to have working text-based agents first.

**Specifically:**

1. Build Image Agent with Imagen 3 integration
2. Build Video Agent with Veo 2 integration
3. Add cost estimation (must show before generating)
4. Add usage tracking (for billing)
5. Add tier limits (free tier gets X images/month)
6. Handle async video generation (polling for completion)

**What you'll actually do:**

- Integration with Google's Imagen and Veo APIs
- Cost tracking logic
- Async patterns (video generation isn't instant)
- UI for showing generation progress

**You'll know you're done when:**

- "Generate a hero image" → Cost estimate shown → Confirm → Image appears
- "Make a promo video" → Cost estimate shown → Confirm → Progress shown → Video appears
- Tenant hits tier limit → Upgrade prompt shown

---

### Phase 7: Polish (Weeks 11-12)

**What you're doing:** Cleaning up, optimizing, securing.

**Specifically:**

1. Add intent classification cache (speeds up routing)
2. Add rate limiting (prevents abuse)
3. Security audit (verify tenant isolation everywhere)
4. Performance optimization (target: p50 < 2s, p95 < 5s)
5. Voice support (optional: speech-to-text, text-to-speech)
6. Documentation (update CLAUDE.md, create runbook)

**What you'll actually do:**

- Redis/cache integration
- Security testing
- Performance profiling
- Documentation writing

**You'll know you're done when:**

- All gates pass
- Security audit shows no cross-tenant leaks
- Response times meet targets
- You have a runbook for "what to do when X breaks"

---

## What Success Looks Like

When this is all done:

**For your tenants:**

1. They open their dashboard
2. They chat naturally: "Make my about page better"
3. AI figures out what to do, delegates to specialists
4. Changes appear in preview instantly
5. Tenant approves with one click
6. Done in minutes instead of hours

**For your tenant's customers:**

1. They visit a storefront
2. They ask the Booking Agent questions
3. They book seamlessly
4. After booking, they chat with Project Hub
5. Routine questions answered instantly
6. Complex stuff gets to the tenant without noise

**For you:**

1. Less custom code to maintain
2. Google handles the AI infrastructure
3. New capabilities (image, video) without massive engineering
4. Tenant isolation handled at the platform level
5. You learned how to build AI agent systems

---

## Glossary: Terms You'll Encounter

| Term                 | Plain English                                                      |
| -------------------- | ------------------------------------------------------------------ |
| **Agent**            | An AI with a specific job, tools, and personality                  |
| **Orchestrator**     | The boss agent that delegates to others                            |
| **Specialist**       | An agent focused on one thing (copy, research, etc.)               |
| **A2A Protocol**     | Standardized format for agents talking to each other               |
| **MCP**              | Standardized way to give agents access to tools                    |
| **Session**          | One conversation (short-term memory)                               |
| **Memory Bank**      | Long-term memory across conversations                              |
| **Tool**             | A function the AI can call (like "search_competitors")             |
| **Trust Tier**       | How much confirmation an action needs (T1/T2/T3)                   |
| **System Prompt**    | Instructions that define who the AI is and how it behaves          |
| **Grounding**        | Connecting AI responses to real data sources                       |
| **RAG**              | Retrieval-Augmented Generation - AI looks up info before answering |
| **Prompt Injection** | Attack where malicious text tricks the AI                          |
| **Agent Card**       | JSON file describing an agent's capabilities                       |
| **WebSocket**        | Connection allowing server to push updates to browser instantly    |
| **Cold Start**       | Delay when an agent spins up from zero (first request is slow)     |
| **Thinking Mode**    | AI reasons internally before responding (slower but smarter)       |

---

## Common Questions You'll Ask

**Q: Why Vertex AI and not just calling Claude/OpenAI directly?**
A: Vertex AI provides the infrastructure around the AI: session management, memory, deployment, scaling. Building that yourself is 6+ months of work.

**Q: Can I use Claude instead of Gemini?**
A: Not easily within Agent Engine. The platform is designed around Gemini. You could build a hybrid, but it's extra complexity.

**Q: What if Google changes their APIs?**
A: Valid concern. The ADK abstracts some of this, but you'd need to update when Google releases major versions. This is the trade-off for using managed services.

**Q: How much will this cost?**
A: Depends on usage. For 100 tenants with moderate usage, estimate $2,000-4,000/month for all the AI services. The plan includes tier limits so tenants don't run up huge bills.

**Q: What if an agent goes rogue?**
A: Trust tiers prevent the worst cases. T3 actions require explicit human confirmation. The ReflectAndRetry plugin catches failures. And we log everything for auditing.

**Q: How do I debug when things go wrong?**
A: Cloud Logging captures everything. AgentOps (optional) gives you a visual "waterfall" of what each agent did. Start there.

---

## Your Learning Path

As you go through this, you'll level up in:

1. **Week 1-2:** Google Cloud basics, deployment
2. **Week 3-4:** Agent architecture, TypeScript tools
3. **Week 5-6:** Prompt engineering (the real skill)
4. **Week 7-8:** Complex agent behaviors, mediation logic
5. **Week 9-10:** Async patterns, cost management
6. **Week 11-12:** Production hardening, security

**The most valuable skill you'll gain:** Prompt engineering. The ability to make AI do what you want through careful instruction design. This is transferable to any AI system, not just Vertex AI.

---

_This document is your conceptual foundation. The Execution Plan tells you what to do. The Playbook gives you the code. This document tells you WHY it all works._
