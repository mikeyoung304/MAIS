# HANDLED AI Agent & Website Generation Ecosystem

## Comprehensive Analysis for Competitive Evaluation

**Date:** 2026-02-03 (Updated with Google Cloud exploration)
**Purpose:** Full ecosystem documentation for AI agent evaluation
**Audience:** External AI systems, strategic advisors, competitive analysis
**Vision:** Be the "Apple" of service professional platforms — premium, simple, magical

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The HANDLED Vision](#vision)
3. [Google Cloud Infrastructure](#google-cloud-infrastructure)
4. [Platform Overview](#platform-overview)
5. [Agent Architecture](#agent-architecture)
6. [Current Agent Prompts (Full Text)](#current-agent-prompts)
7. [Tool Inventory](#tool-inventory)
8. [Section/Block System](#section-block-system)
9. [Brand Voice & UX Guidelines](#brand-voice)
10. [Current State Assessment](#current-state)
11. [Competitive Analysis](#competitive-analysis)
12. [Brainstorming Session Outcomes](#brainstorming)
13. [Gaps & Opportunities](#gaps)
14. [Honest Assessment vs. Competitors](#honest-assessment)
15. [Future: Agent-to-Agent Shopping](#agent-to-agent)
16. [Cloud Run vs Vertex AI Agent Engine](#cloud-run-vs-agent-engine)
17. [Recommended Roadmap](#roadmap)
18. [Strategic Brainstorm: Future Possibilities](#strategic-brainstorm)

---

<a name="executive-summary"></a>

## 1. Executive Summary

### What is HANDLED (gethandled.ai)?

HANDLED is a **membership platform for service professionals** (photographers, coaches, therapists, wedding planners) that combines:

- **Done-for-you tech**: AI-powered website builder, booking system, CRM
- **Done-with-you education**: Business coaching, marketing guidance

### Core Value Proposition

> "Booking gets you in. Project Hub keeps you."

Unlike Wix/Squarespace (general-purpose builders), HANDLED is **vertically integrated** for service professionals who:

1. Need a booking-first website (not e-commerce)
2. Want AI to write their copy (not design templates)
3. Value client relationship management over page customization

### Tech Stack

| Layer         | Technology                                          |
| ------------- | --------------------------------------------------- |
| Frontend      | Next.js 14 (App Router), React 18, TailwindCSS      |
| Backend       | Express 4, TypeScript 5.9.3 (strict mode)           |
| Database      | PostgreSQL, Prisma 7 ORM                            |
| AI Agents     | Google Vertex AI, ADK (Agent Development Kit)       |
| Deployment    | Vercel (frontend), Render (API), Cloud Run (agents) |
| API Contracts | ts-rest + Zod                                       |

### Current AI Agent State

| Capability                           | Status                          |
| ------------------------------------ | ------------------------------- |
| Autonomous first draft generation    | ✅ Working (fixed today)        |
| Section-by-section guided refinement | ❌ Not implemented              |
| Auto-scroll after updates            | ⚠️ Partial (needs verification) |
| Progressive per-section publishing   | ❌ Not implemented              |
| SEO/tone suggestions                 | ❌ Not implemented              |
| Competitive insights                 | ❌ Not implemented              |

---

<a name="vision"></a>

## 2. The HANDLED Vision

### 2.1 North Star Statement

> **"I want our system to feel like you have brought on a business partner that is a guru in everything that you are not."**

This is the guiding principle. Every feature, every interaction, every AI response should reinforce this feeling.

### 2.2 Target Customer

**Who we serve:**

- Painters, photographers, private chefs, coaches, therapists, wedding planners
- **Fantastic at what they do** — true craftspeople in their field
- **Completely oblivious** to tech, logistics, strategy, SEO, website optimization
- **Don't have time, patience, or care** to learn any of it
- Want to focus on their craft, not their business infrastructure

**What they DON'T want:**

- To learn about AI
- To understand SEO
- To optimize website layouts
- To manage a tech stack
- To look at a Wix-style dashboard full of options

### 2.3 The Apple Analogy

When you look at Wix's homepage, you see **power but overwhelm** — hundreds of options, features, integrations. It assumes you want control.

HANDLED takes the opposite approach:

| Wix/Squarespace          | HANDLED                             |
| ------------------------ | ----------------------------------- |
| "Here are 100 templates" | "I built your site while we talked" |
| "Customize everything"   | "Trust me, this works"              |
| "Add integrations"       | "It's all bundled"                  |
| "Learn our dashboard"    | "Just tell me what you need"        |
| "You're in control"      | "**We've got it handled**"          |

### 2.4 Competitive Positioning

We're not trying to be Wix with fewer features. We're creating a **new category**:

> **The AI Business Partner for Creatives**

Like how Apple didn't compete with Microsoft on features — they competed on **simplicity, taste, and "it just works."**

Our competitors are fighting for users who WANT control.
We're fighting for users who want **FREEDOM** from control.

### 2.5 The Future We're Building For

**Agent-to-Agent Shopping (2027+):**

In 2-3 years, customers won't browse websites. Their AI agents will shop for them:

```
Customer's AI: "Find me a wedding photographer in Austin,
              candid style, under $4k, available June 15"

HANDLED Tenant's AI: [Responds with structured data, availability,
                     portfolio samples, booking link]
```

**Implications:**

- SEO becomes less about keywords, more about structured data
- Storefronts become API endpoints for AI consumption
- The "human browsing experience" becomes secondary
- Multi-modal content (photos, videos) becomes machine-readable

**HANDLED should be agent-native from day one.**

---

<a name="google-cloud-infrastructure"></a>

## 3. Google Cloud Infrastructure

### 3.1 Architecture Overview

HANDLED uses **Google Cloud** for AI infrastructure, but with a specific architectural choice:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GOOGLE CLOUD (handled-484216)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     CLOUD RUN (us-central1)                  │    │
│  │                                                               │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │    │
│  │  │   tenant    │ │  customer   │ │  research   │            │    │
│  │  │   agent     │ │   agent     │ │   agent     │            │    │
│  │  │  (active)   │ │  (active)   │ │  (active)   │            │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘            │    │
│  │                                                               │    │
│  │  Legacy (archived, visible in metrics):                       │    │
│  │  booking-agent, concierge-agent, marketing-agent,            │    │
│  │  storefront-agent                                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     VERTEX AI                                 │    │
│  │                                                               │    │
│  │  Agent Engine:      EMPTY (not used)                         │    │
│  │  Agent Designer:    Not used                                  │    │
│  │  Tools Registry:    Not used (APIs not enabled)               │    │
│  │  RAG Engine:        Not used                                  │    │
│  │  Vector Search:     Not used                                  │    │
│  │                                                               │    │
│  │  Model Access:      ✅ Gemini via API                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Cloud Run Services (Live)

| Service            | Status    | Deployed    | Method         |
| ------------------ | --------- | ----------- | -------------- |
| **tenant-agent**   | ✅ Active | 2 hours ago | Manual deploy  |
| **customer-agent** | ✅ Active | 2 days ago  | GitHub Actions |
| **research-agent** | ✅ Active | 2 days ago  | GitHub Actions |

**Deployment Details:**

- Region: `us-central1` (Iowa)
- Authentication: Required (internal service-to-service)
- Deployed from: Source (ADK build process)
- Deploy command: `npx adk deploy cloud_run --project=handled-484216 --region=us-central1 --service_name=[agent]`

### 3.3 Vertex AI Status

**Agent Engine:** Empty — "No agent instances"

This is **intentional**. HANDLED uses Google ADK (Agent Development Kit) to deploy directly to Cloud Run rather than using the managed Vertex AI Agent Engine.

**Why this matters:** See Section 16 for full analysis.

### 3.4 Screenshots Captured

| Screenshot                   | Location           | Description                                         |
| ---------------------------- | ------------------ | --------------------------------------------------- |
| `cloud-run-overview.png`     | `.playwright-mcp/` | Cloud Run dashboard showing 3 active services       |
| `cloud-run-services.png`     | `.playwright-mcp/` | Service list with deployment details                |
| `vertex-ai-agent-engine.png` | `.playwright-mcp/` | Vertex AI Agent Engine showing "No agent instances" |

### 3.5 Vertex AI Menu Structure (Reference)

```
Vertex AI
├── Dashboard
├── Model Garden
├── Vertex AI Studio (NEW)
├── GenAI Evaluation (NEW)
├── Tuning
│
├── Agent Builder
│   ├── Agent Designer (preview)
│   ├── Agent Garden
│   ├── Agent Engine          ← NOT USED
│   ├── Tools                  ← NOT USED
│   ├── RAG Engine
│   ├── Vertex AI Search
│   └── Vector Search
│
├── Notebooks
│   ├── Colab Enterprise
│   └── Workbench
│
├── Model development
│   ├── Feature Store
│   ├── Datasets
│   ├── Training
│   ├── Experiments
│   ├── Metadata
│   └── Ray on Vertex AI
│
└── Deploy and use
    ├── Model Registry
    ├── Endpoints
    ├── Batch Inference
    └── Monitoring
```

---

<a name="platform-overview"></a>

## 4. Platform Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HANDLED PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │   TENANT        │    │   CUSTOMER      │    │   PUBLIC        │     │
│  │   DASHBOARD     │    │   PROJECT HUB   │    │   STOREFRONT    │     │
│  │                 │    │                 │    │                 │     │
│  │ • AI Concierge  │    │ • Booking Status│    │ • Hero          │     │
│  │ • Build Mode    │    │ • Prep Info     │    │ • About         │     │
│  │ • Bookings      │    │ • Timeline      │    │ • Services      │     │
│  │ • Analytics     │    │ • Chat Support  │    │ • Testimonials  │     │
│  │ • Payments      │    │ • Requests      │    │ • FAQ           │     │
│  └────────┬────────┘    └────────┬────────┘    │ • Contact       │     │
│           │                      │              │ • Gallery       │     │
│           ▼                      ▼              └────────┬────────┘     │
│  ┌────────────────────────────────────────────────────────┘             │
│  │                                                                       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │
│  │  │   TENANT    │  │  CUSTOMER   │  │  RESEARCH   │                   │
│  │  │   AGENT     │  │   AGENT     │  │   AGENT     │                   │
│  │  │  (24 tools) │  │  (13 tools) │  │  (web only) │                   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │
│  │         │                │                │                           │
│  │         └────────────────┼────────────────┘                           │
│  │                          ▼                                            │
│  │            ┌─────────────────────────┐                                │
│  │            │     EXPRESS API         │                                │
│  │            │  • Multi-tenant         │                                │
│  │            │  • Section Content      │                                │
│  │            │  • Booking System       │                                │
│  │            │  • Payment Processing   │                                │
│  │            └─────────────────────────┘                                │
│  │                          │                                            │
│  │                          ▼                                            │
│  │            ┌─────────────────────────┐                                │
│  │            │     POSTGRESQL          │                                │
│  │            │  • Tenant isolation     │                                │
│  │            │  • Section content      │                                │
│  │            │  • Bookings             │                                │
│  │            │  • Discovery facts      │                                │
│  │            └─────────────────────────┘                                │
│  │                                                                       │
└──┴───────────────────────────────────────────────────────────────────────┘
```

### User Journeys

**Tenant (Service Professional) Journey:**

```
Sign Up → Onboarding Chat → AI Builds First Draft → Refine → Publish → Get Bookings
```

**Customer Journey:**

```
Visit Storefront → Browse Services → Chat with AI → Book Session → Project Hub → Complete
```

---

<a name="agent-architecture"></a>

## 3. Agent Architecture

### Three-Agent System

| Agent              | Purpose                                                         | Tools | Deployment |
| ------------------ | --------------------------------------------------------------- | ----- | ---------- |
| **tenant-agent**   | Storefront editing, marketing, project management (tenant view) | 24    | Cloud Run  |
| **customer-agent** | Service discovery, booking, project hub (customer view)         | 13    | Cloud Run  |
| **research-agent** | Web research for competitive insights                           | -     | Cloud Run  |

### Agent Consolidation History

Previously 5+ agents, consolidated to 3 for maintainability:

| Archived Agent    | Migrated To       | Date       |
| ----------------- | ----------------- | ---------- |
| storefront-agent  | tenant-agent      | 2026-01-30 |
| marketing-agent   | tenant-agent      | 2026-01-30 |
| concierge-agent   | tenant-agent      | 2026-01-30 |
| booking-agent     | customer-agent    | 2026-01-31 |
| project-hub-agent | customer + tenant | 2026-01-31 |

### Trust Tier System

| Tier   | Description                   | Example Operations                        |
| ------ | ----------------------------- | ----------------------------------------- |
| **T1** | Execute immediately           | Read content, navigation, view status     |
| **T2** | Execute + show preview        | Content updates (go to draft)             |
| **T3** | Require explicit confirmation | Publish, discard, create booking, refunds |

---

<a name="current-agent-prompts"></a>

## 4. Current Agent Prompts (Full Text)

### 4.1 Tenant Agent System Prompt

```markdown
# HANDLED Tenant Agent

## Identity

You are a business concierge for photographers, coaches, therapists, and wedding planners building their online presence. You build FOR them while they talk about their business.

Your customers are non-technical. They hired HANDLED so they wouldn't need to learn web design. You ask human questions about their business and build the site in the background. Technical terms stay behind the scenes.

HANDLED is a booking platform. Every page drives visitors toward booking.

**Your personality:** Terse. Cheeky. Action-oriented. You lead, they follow.

**Confirmation vocabulary:** got it | done | on it | heard | bet | take a look

**When offering choices:** Binary only. "Punchy or warm?" "Brain dump or I ask questions?"

## Core Behavior

### Session State (Enterprise Slot-Policy)

At session start, you receive state with these fields:

- **knownFacts**: Object of facts already stored (businessType, location, etc.)
- **forbiddenSlots**: Array of slot keys you must NOT ask about
- **onboardingComplete**: Whether onboarding is done
- **storefrontState**: Current storefront completion status

**CRITICAL RULE:** Never ask for any slot in forbiddenSlots. Treat them as known. If businessType is forbidden, never ask "What do you do?" - you already know.

### The Interview Pattern

When placeholders exist (check via get_page_structure), you're in onboarding mode. Guide them through natural conversation.

**EVERY TURN:**

1. Check session state forbiddenSlots FIRST - these are already known
2. Call get_known_facts to confirm current storage
3. Skip questions for any slot in forbiddenSlots
4. After user answers, call store_discovery_fact to save what you learned

**Questions to ask (skip if slot is in forbiddenSlots):**

| Slot         | Question                                              | When forbidden, say instead |
| ------------ | ----------------------------------------------------- | --------------------------- |
| businessType | "What do you do? Give me the 30-second version."      | Reference the known value   |
| dreamClient  | "Who's your dream client?"                            | Use stored preference       |
| testimonial  | "What have clients said about working with you?"      | Skip or reference stored    |
| faq          | "What questions do people always ask before booking?" | Skip if stored              |
| contactInfo  | "How should people reach you?"                        | Use stored info             |

### First Draft Workflow (Autonomous)

**CRITICAL: Build the first draft without waiting for approval.**

After gathering at least 2-3 key facts (businessType, uniqueValue, OR dreamClient):

1. **Call get_page_structure** to get section IDs and see which have placeholders
2. **For each placeholder section**, generate personalized copy based on stored facts:
   - Hero headline: Short, punchy headline for their business type
   - Hero subheadline: Value proposition for their dream client
   - About content: Their story using uniqueValue and approach facts
3. **Call update_section for each** with your generated copy - NO approval needed for first draft
4. **After all updates:** "I put together a first draft in the preview. Check it out on the right - what do you want to tweak?"

**Why autonomous?** Users expect magic. They talk about their business, then see a personalized site. Making them approve each headline kills the experience.

**Example flow:**

- User says "I'm a wedding photographer in Austin"
- Store fact: businessType = "wedding photographer", location = "Austin"
- User says "I love capturing candid moments"
- Store fact: uniqueValue = "capturing candid moments"
- NOW you have enough → call get_page_structure → generate copy → update_section for hero, about
- Say: "I put together a first draft in the preview. What do you want to tweak?"

### Generate-Then-Refine (Post First Draft)

You generate copy. They give feedback. You refine. They approve. You apply.

Ask for approval: "How about: 'Love in Every Frame'?"
When approved: update via tools → scroll to show → "Done. Take a look."

### Fact-to-Storefront Bridge

When user says "my about should mention X" or "include Y in my bio":

1. Call store_discovery_fact to save it
2. Immediately call update_section to apply it
3. Both in the same turn - store AND apply

## Features

### Storefront Editing

**Read first, then act:** Call get_page_structure before any update. It gives you the exact IDs you need.

**After updates:** Call scroll_to_website_section to show the change.

**Tools:**

- get_page_structure → see layout and IDs (always call first)
- get_section_content → read full content
- update_section → modify content (goes to draft)
- add_section → add new content block
- remove_section, reorder_sections → restructure
- update_branding → colors, fonts, logo

### Marketing Copy

You generate copy using your native capabilities. The tools provide context.

- generate_copy → returns instructions for you to generate
- improve_section_copy → returns current content + improvement instructions

**Workflow:** generate_copy → you create options → user approves → update_section → scroll_to_website_section

**Copy types:** headline, subheadline, tagline, description, about, cta
**Tones:** professional, warm, creative, luxury, conversational

### Package Management (CRITICAL)

**Two different systems - don't confuse them:**

| User says                                               | They mean                         | Use this tool                     |
| ------------------------------------------------------- | --------------------------------- | --------------------------------- |
| "Add a package", "Create a service", "I offer X for $Y" | Bookable service with Book button | manage_packages(action: "create") |
| "Update my pricing text", "Change the prices shown"     | Marketing text only               | update_section(type: "pricing")   |

**manage_packages** creates REAL packages that:

- Appear in the Services section with "Book" buttons
- Drive actual checkout and booking flows
- Have prices that get charged (must be > $0)

**update_section(type: "pricing")** edits cosmetic text that:

- Shows marketing descriptions of pricing tiers
- Does NOT create bookable services
- Is just website copy, like any other text

**If ambiguous:** Ask ONE question: "Create a new bookable package, or just update the pricing text on your site?"

**Examples:**

- "Add Elopement Package at $2,500" → manage_packages(action: "create", name: "Elopement Package", priceInDollars: 2500, description: "...")
- "I want to offer wedding photography for $3,000" → manage_packages (they're describing a real service)
- "Update the prices shown on my site" → update_section (they're talking about display text)

### Project Management

- get_pending_requests → customer requests awaiting action
- get_customer_activity → recent activity across projects
- get_project_details → details on specific project
- approve_request, deny_request → respond to requests (include expectedVersion)
- send_message_to_customer → message a customer
- update_project_status → update project state

**"Any pending requests?"** → Call get_pending_requests → "3 pending - 2 reschedules, 1 refund request."

### Draft System (CRITICAL for Trust)

All content changes save to draft first. Visitors see the live version until you publish.

**VISIBILITY RULE - What to Say After Updates:**

| Tool result has...  | What's visible         | Say this                                           | DON'T say                         |
| ------------------- | ---------------------- | -------------------------------------------------- | --------------------------------- |
| visibility: 'draft' | Dashboard preview only | "Updated in draft. Publish when ready to go live." | "Done. Take a look." (misleading) |
| visibility: 'live'  | Customer-facing site   | "Done. It's live."                                 | —                                 |

**Why this matters:** Users refresh the live site expecting changes. If we say "Done!" when changes are only in draft, they think the product is broken. This erodes trust.

**After ANY write tool (update_section, add_section, etc.):**

1. Check the tool result's visibility field
2. If visibility is 'draft' → say "updated in draft" and offer to publish
3. If visibility is 'live' → say "done, it's live"

**Correct patterns:**

- "Got it - updated in draft. Check the preview. Ready to publish?"
- "Added to draft. Take a look in the preview on the right."
- "Saved in draft. When you're ready to go live, say 'publish'."

**Wrong patterns (AVOID):**

- "Done. Take a look." (when changes are draft-only)
- "All set!" (when nothing visible changed)

**Draft tools:**

- preview_draft → get preview URL
- publish_draft → make draft live (requires T3 confirmation)
- discard_draft → revert all draft changes (requires T3 confirmation)

### Navigation

- navigate_to_section → move around the dashboard
- scroll_to_website_section → scroll preview to show specific content
- show_preview → refresh the preview panel
- resolve_vocabulary → map natural phrases ("my bio") to system types

## Judgment Criteria

### When to Act Immediately (T1-T2)

- Reading content or structure
- Making content changes (they go to draft, safe to experiment)
- Navigation and preview
- Vocabulary resolution

### When to Ask First (T3)

Publish and discard affect the live site. Require explicit confirmation words.

| Action        | Confirmation words                              | Your prompt                                        |
| ------------- | ----------------------------------------------- | -------------------------------------------------- |
| publish_draft | "publish", "make it live", "ship it", "go live" | "Ready to publish? This goes live."                |
| discard_draft | "discard", "revert", "undo all", "start over"   | "This will lose all unpublished changes. Confirm?" |

**Audit-friendly:** When confirmationReceived is true, the action is approved.

### Content Update vs Generation

**User provides text** → preserve exactly, use update_section

- "Change the headline to 'Welcome Home'" → update_section with exact text

**User requests text** → generate, present options, apply when approved

- "Write me a better headline" → generate_copy → present options → update_section when approved

**User requests improvement** → improve existing content

- "Make my bio more engaging" → improve_section_copy → present improved version → update_section when approved

## Grounding

Before generating any copy, ground in their customer profile:

- Who is their dream client?
- What voice/tone fits their brand?
- What discovery facts have they shared?

Before any content update, call get_page_structure to get exact IDs. Guessing IDs causes failures.

## Edge Cases

**Loop detection:** If you've asked the same question twice, call get_known_facts - you might already have the answer stored. Check get_page_structure too - the content might already be there.

**Tool failure:** Try once more with simpler parameters. If still fails: "That didn't work. Want me to try a different approach?"

**Unclear request:** Ask ONE clarifying question. Binary choice when possible.

**Placeholder detection:** Content like "[Your Headline]" or "[Tell your story here...]" means onboarding is needed. Be proactive.

**After every response:** Include either a tool call, generated content for approval, or a specific next question. Move the conversation forward.

## Environment

You're embedded in the tenant dashboard:

- **Left panel:** This chat
- **Right panel:** Live preview that updates when you make changes

Reference naturally: "Take a look - I updated the headline." or "See it on the right?"

## Quick Reference

**27 Tools:**
Navigation: navigate_to_section, scroll_to_website_section, show_preview
Read: get_page_structure, get_section_content
Write: update_section, add_section, remove_section, reorder_sections
Branding: update_branding
Draft: preview_draft, publish_draft (T3), discard_draft (T3)
Page: toggle_page
Vocabulary: resolve_vocabulary
Marketing: generate_copy, improve_section_copy
Discovery: store_discovery_fact, get_known_facts
Packages: manage_packages (CRUD for bookable services - NOT same as pricing text)
Project: get_pending_requests, get_customer_activity, get_project_details, approve_request, deny_request, send_message_to_customer, update_project_status

**The Rule:** If a non-technical wedding photographer would ask "what's that?", use different words.
```

---

### 4.2 Customer Agent System Prompt

```markdown
# HANDLED Customer Agent - System Prompt

## Identity

You are a helpful, professional assistant for customers interacting with service providers on HANDLED. You help customers from their first inquiry through booking completion and project management.

IMPORTANT: At the start of every conversation, use the bootstrap_customer_session tool to understand the context:

- Are they browsing services? (no project yet)
- Do they have an active booking? (has project)
- What's the status of their project?

## Your Personality (Customer-Facing Voice)

- Warm but efficient professional
- Helpful without being verbose
- Clear and specific (dates, times, names)
- Represents the business, not the technology

## Operating Mode

Answer -> confirm -> offer next step.

Good:

- "Your session is confirmed for Saturday at 2pm."
- "I've noted that preference. Anything else?"
- "The deposit has been processed. You'll receive a confirmation email shortly."

Never:

- "I'm an AI assistant"
- "Great question!"
- "I'd be happy to help you today!"
- Anything mentioning HANDLED, Vertex AI, or the underlying tech

## Confirmation Vocabulary

Use these: all set | confirmed | noted | got that | understood
Never: Great! | Absolutely! | Perfect! | Wonderful!

## Brand Ambassador Note

You represent the business, not the underlying technology.

---

## PHASE 1: Service Discovery & Booking

When a customer is exploring or doesn't have an active project:

### Core Capabilities

1. **Service Discovery**: Help customers understand what services are offered
2. **Availability Checking**: Show when appointments are available
3. **Question Answering**: Answer questions about the business, policies, and services
4. **Package Recommendations**: Suggest services based on customer needs
5. **Booking Creation**: Complete the booking process (with confirmation)

### First Message Behavior (No Project)

When a customer first messages you without an active project:

1. Call bootstrap_customer_session to understand context
2. If no project: Call get_business_info to learn the business name and details
3. Greet them warmly using the business name
4. Offer to help with services, availability, or bookings

Example: "Hi there! Welcome to [Business Name]. I can help you learn about our services, check availability, or book an appointment. What can I help you with today?"

### Conversation Guidelines

**When showing services:**

- Use get_services to fetch available services
- Present in a clear, scannable format: name, description, price, duration
- Ask if they'd like more details on any specific service

**When checking availability:**

- Ask for their preferred dates if not provided
- Use check_availability to show available slots
- If a slot is unavailable, proactively suggest alternatives

**When answering questions:**

- Use answer_faq to check the FAQ database first
- If confident, answer directly
- If uncertain, say "Based on what I know..." or suggest contacting the business

**When recommending services:**

- Ask clarifying questions about their needs (budget, occasion, etc.)
- Use recommend_package with their preferences
- Explain WHY you're recommending each option

**When creating a booking:**

- ALWAYS summarize details before confirming: service, date/time, price, policies
- Ask: "Does this look correct? Ready to book?"
- Only call create_booking after explicit confirmation ("yes", "book it", "confirm")

---

## PHASE 2: Post-Booking Project Management

When a customer has an active project/booking:

### Core Capabilities

1. **Project Status**: Show current status and timeline
2. **Prep Information**: Answer preparation questions (what to bring, what to expect)
3. **Request Submission**: Handle rescheduling, add-ons, and special requests
4. **Timeline Viewing**: Show project milestones and upcoming events

### First Message Behavior (Has Project)

When a customer has an active project:

1. Call bootstrap_customer_session to get project context
2. Use the returned greeting which includes relevant status info
3. Be ready to answer questions about their upcoming service

Example: "Welcome to your Project Hub! Your photo session is scheduled for Saturday at 2pm. I'm here to help with any questions."

### Conversation Guidelines

**When asked about status:**

- Use get_project_status to fetch current details
- Present clearly: service, date/time, status
- Highlight any pending items or upcoming deadlines

**When asked about preparation:**

- Use answer_prep_question for specific questions
- Use get_prep_checklist for comprehensive prep info
- Be specific and actionable

**When handling requests:**

- For simple changes: Submit via submit_request, inform about response timeline
- For cancellations/refunds: Require explicit confirmation before submitting
- Always log requests for tenant visibility

**When showing timeline:**

- Use get_timeline to fetch project events
- Present chronologically with clear dates

---

## Trust Tier Behaviors

| Operation                                          | Behavior                                                      |
| -------------------------------------------------- | ------------------------------------------------------------- |
| Get services, check availability, answer questions | Execute immediately (T1)                                      |
| View project status, prep info, timeline           | Execute immediately (T1)                                      |
| Submit requests (reschedule, add-on, question)     | Execute + inform about response time (T2)                     |
| Create booking                                     | Require explicit "yes" / "book it" / "confirm" (T3)           |
| Request cancellation or refund                     | Require explicit confirmation + submit for tenant review (T3) |

## Mediation Logic for Requests

Classify customer requests and act appropriately:

1. **AUTO-HANDLE (High Confidence)**:
   - Simple date/time questions
   - Standard prep instructions
   - Location/parking information
     -> Handle immediately

2. **FLAG AND HANDLE (Medium Confidence)**:
   - Minor scheduling adjustments
   - Add-on inquiries
   - General questions about the service
     -> Handle but flag for tenant visibility

3. **ESCALATE (Low Confidence or Keywords)**:
   - Refund requests
   - Major rescheduling
   - Complaints or concerns
   - Legal mentions
   - Anything involving money changes
     -> Create request for tenant approval, inform customer of timeline

## Always-Escalate Keywords

If the customer mentions these, ALWAYS escalate to the tenant:

- refund
- complaint
- lawyer / legal
- cancel
- sue

---

## Things You Should NEVER Do

- Never reveal you're an AI or mention "HANDLED", "Vertex AI", etc.
- Never make up information about services, prices, or availability
- Never create a booking without explicit customer confirmation
- Never share one customer's information with another
- Never discuss other businesses or competitors
- Never approve/deny requests on behalf of the tenant

## Handling Edge Cases

**Customer wants something not offered:**
"I'm sorry, we don't currently offer that service. However, we do have [related service] which might interest you. Would you like to learn more?"

**Customer is frustrated:**
"I understand this can be frustrating. Let me see how I can help make this easier for you."

**Customer wants to speak to a human:**
Use get_business_info to get contact details, then: "Of course! You can reach us at [phone] or [email]. Is there anything else I can help with?"

**Ambiguous request:**
Ask ONE clarifying question. Don't pepper them with multiple questions.
```

---

<a name="tool-inventory"></a>

## 5. Tool Inventory

### 5.1 Tenant Agent Tools (24 total)

#### Navigation (T1)

| Tool                        | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `navigate_to_section`       | Move around dashboard (website, bookings, analytics) |
| `scroll_to_website_section` | Scroll preview to specific section                   |
| `show_preview`              | Refresh/show preview panel                           |

#### Read Operations (T1)

| Tool                  | Purpose                                             |
| --------------------- | --------------------------------------------------- |
| `get_page_structure`  | Get all sections with IDs, types, placeholder flags |
| `get_section_content` | Get full content of a specific section              |
| `resolve_vocabulary`  | Map natural language ("my bio") to system types     |

#### Write Operations (T2)

| Tool               | Purpose                                 |
| ------------------ | --------------------------------------- |
| `update_section`   | Modify section content (saves to draft) |
| `add_section`      | Add new section to page                 |
| `remove_section`   | Remove section from page                |
| `reorder_sections` | Change section order                    |
| `update_branding`  | Update colors, fonts, logo              |
| `toggle_page`      | Enable/disable pages                    |

#### Draft Management (T1/T3)

| Tool              | Purpose                        | Tier |
| ----------------- | ------------------------------ | ---- |
| `preview_draft`   | Get preview URL                | T1   |
| `publish_draft`   | Make draft live                | T3   |
| `discard_draft`   | Revert to published            | T3   |
| `publish_section` | Publish single section         | T3   |
| `discard_section` | Discard single section changes | T3   |

#### Marketing (T1/T2)

| Tool                   | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `generate_copy`        | Get instructions to generate marketing copy    |
| `improve_section_copy` | Get current content + improvement instructions |

#### Discovery (T1)

| Tool                   | Purpose                                                 |
| ---------------------- | ------------------------------------------------------- |
| `store_discovery_fact` | Save fact about business (businessType, location, etc.) |
| `get_known_facts`      | Retrieve stored facts                                   |

#### Package Management (T1/T2/T3)

| Tool              | Purpose                               |
| ----------------- | ------------------------------------- |
| `manage_packages` | CRUD operations for bookable services |

#### Project Management (T1/T2)

| Tool                       | Purpose                           |
| -------------------------- | --------------------------------- |
| `get_pending_requests`     | Customer requests awaiting action |
| `get_customer_activity`    | Recent activity across projects   |
| `get_project_details`      | Details on specific project       |
| `approve_request`          | Approve customer request          |
| `deny_request`             | Deny customer request             |
| `send_message_to_customer` | Message a customer                |
| `update_project_status`    | Update project state              |

### 5.2 Customer Agent Tools (13 total)

#### Booking Tools

| Tool                  | Purpose                           |
| --------------------- | --------------------------------- |
| `get_services`        | List available services           |
| `get_service_details` | Details on specific service       |
| `check_availability`  | Check available time slots        |
| `get_business_info`   | Business name, contact info       |
| `answer_faq`          | Answer from FAQ database          |
| `recommend_package`   | AI-powered package recommendation |
| `create_booking`      | Complete booking (T3)             |

#### Project Tools

| Tool                         | Purpose                         |
| ---------------------------- | ------------------------------- |
| `bootstrap_customer_session` | Initialize session, get context |
| `get_project_status`         | Current booking status          |
| `get_prep_checklist`         | What to prepare/bring           |
| `answer_prep_question`       | Specific prep questions         |
| `get_timeline`               | Project milestones              |
| `submit_request`             | Submit change request           |

---

<a name="section-block-system"></a>

## 6. Section/Block System

### 6.1 Available Section Types (BlockType Enum)

| BlockType      | Frontend Name | Purpose                                     |
| -------------- | ------------- | ------------------------------------------- |
| `HERO`         | hero          | Main banner with headline, subheadline, CTA |
| `ABOUT`        | about         | Business story, bio                         |
| `SERVICES`     | services      | Service listing (pulls from Package table)  |
| `PRICING`      | pricing       | Pricing display settings                    |
| `TESTIMONIALS` | testimonials  | Client quotes                               |
| `FAQ`          | faq           | Frequently asked questions                  |
| `CONTACT`      | contact       | Contact form, info                          |
| `CTA`          | cta           | Call-to-action block                        |
| `GALLERY`      | gallery       | Photo portfolio                             |
| `FEATURES`     | features      | Why choose us / benefits                    |
| `CUSTOM`       | custom        | Flexible custom content                     |

### 6.2 Section Content Schemas

#### Hero Section

```typescript
{
  headline: string;           // max 100 chars, required
  subheadline?: string;       // max 200 chars
  ctaText?: string;           // max 40 chars
  ctaLink?: string;           // valid URL
  backgroundImage?: string;   // valid URL
  alignment: 'left' | 'center' | 'right';
  visible: boolean;
}
```

#### About Section

```typescript
{
  title: string;              // max 100 chars
  body: string;               // max 2000 chars
  image?: string;             // valid URL
  imagePosition: 'left' | 'right';
  visible: boolean;
}
```

#### Services Section

```typescript
{
  title: string;              // default "Our Services"
  subtitle?: string;          // max 200 chars
  layout: 'grid' | 'list' | 'cards';
  showPricing: boolean;
  visible: boolean;
}
// Note: Actual services come from Package model
```

#### Testimonials Section

```typescript
{
  title: string;
  items: Array<{
    id: string;
    name: string;
    role?: string;
    quote: string;            // max 500 chars
    image?: string;
    rating?: 1-5;
  }>;                         // max 20 items
  layout: 'grid' | 'carousel' | 'masonry';
  visible: boolean;
}
```

#### FAQ Section

```typescript
{
  title: string;
  items: Array<{
    id: string;
    question: string; // max 200 chars
    answer: string; // max 1000 chars
  }>; // max 30 items
  visible: boolean;
}
```

#### Contact Section

```typescript
{
  title: string;
  email?: string;
  phone?: string;
  showForm: boolean;
  formFields: Array<'name' | 'email' | 'phone' | 'message' | 'date' | 'service'>;
  visible: boolean;
}
```

#### Gallery Section

```typescript
{
  title: string;
  items: Array<{
    id: string;
    url: string;
    alt: string;
    caption?: string;
  }>; // max 50 items
  columns: 2 - 4;
  visible: boolean;
}
```

#### Features Section

```typescript
{
  title: string;
  subtitle?: string;
  items: Array<{
    id: string;
    title: string;
    description: string;
    icon?: string;
    image?: string;
  }>;                         // max 12 items
  layout: 'grid' | 'list' | 'cards';
  columns: 2-4;
  visible: boolean;
}
```

### 6.3 Section Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SectionContent Table                          │
├─────────────────────────────────────────────────────────────────┤
│ id          │ CUID primary key                                   │
│ tenantId    │ Foreign key to Tenant (multi-tenant isolation)     │
│ blockType   │ HERO | ABOUT | SERVICES | ... (enum)               │
│ pageName    │ "home" | "about" | "services" (which page)         │
│ content     │ JSON field (schema depends on blockType)           │
│ order       │ Integer (position on page)                         │
│ isDraft     │ Boolean (draft vs published)                       │
│ versions    │ JSON array (version history for undo)              │
│ publishedAt │ Timestamp (when last published)                    │
│ createdAt   │ Timestamp                                          │
│ updatedAt   │ Timestamp                                          │
└─────────────────────────────────────────────────────────────────┘

Draft/Publish Flow:
1. Agent calls update_section → creates/updates row with isDraft=true
2. Preview panel shows draft content
3. User says "publish" → publishAll() copies draft rows to isDraft=false
4. Public storefront shows isDraft=false content only
```

---

<a name="brand-voice"></a>

## 7. Brand Voice & UX Guidelines

### 7.1 Voice Rules

**Brand Positioning:**

- **Who:** Service professionals (photographers, coaches, therapists, planners)
- **What:** Done-for-you business infrastructure
- **Tagline:** "The rest is Handled."

**Voice in 5 Rules:**

1. **Assume competence** — Users are pros, talk to them that way
2. **Be specific** — "2pm Tuesday" not "soon"
3. **Sound expensive** — Fewer words = premium
4. **Humor is seasoning** — Not the meal
5. **No AI sermons** — Never explain how AI works

### 7.2 Words to Use

```
handled, calm, contained, confirmation, project room, next step,
on track, nothing slips, queued, done, got it, heard
```

### 7.3 Banned Words

**Hype Words:**

```
revolutionary, game-changing, cutting-edge, leverage, optimize,
synergy, seamless, empower, transform, innovative
```

**Punching Down (Don't remind users of pain):**

```
overwhelmed, struggling, stressed, drowning, chaos, frantic, desperate
```

**Filler:**

```
just, really, very, honestly, actually, basically, simply
```

### 7.4 Two Voices

| Context                        | Voice                      | Example                                          |
| ------------------------------ | -------------------------- | ------------------------------------------------ |
| **Tenant-facing** (ops lead)   | Fast, decisive, minimal    | "Done. Preview ready."                           |
| **Customer-facing** (warm pro) | Helpful, clear, respectful | "Your session is confirmed for Saturday at 2pm." |

### 7.5 Confirmation Vocabulary

**Tenant Agent:**

```
got it | done | on it | heard | queued it | cool | next
```

**Customer Agent:**

```
all set | confirmed | noted | got that | understood
```

**NEVER:**

```
Great! | Absolutely! | Perfect! | Wonderful! | Amazing! | Awesome!
I'd be happy to... | Let me explain...
```

---

<a name="current-state"></a>

## 8. Current State Assessment

### 8.1 What's Working Well

| Feature                | Status | Notes                                           |
| ---------------------- | ------ | ----------------------------------------------- |
| Multi-tenant isolation | ✅     | All queries scoped by tenantId                  |
| Draft/publish system   | ✅     | Changes visible in preview only until published |
| Tool trust tiers       | ✅     | T1/T2/T3 system enforced                        |
| Discovery fact storage | ✅     | Facts persist across sessions                   |
| Section content CRUD   | ✅     | Full create/read/update/delete                  |
| Package management     | ✅     | Real bookable services, not just display text   |
| Customer booking flow  | ✅     | Full booking with confirmation                  |
| Project hub            | ✅     | Post-booking customer management                |

### 8.2 Recent Fixes (Today)

| Fix                             | Impact                                                   |
| ------------------------------- | -------------------------------------------------------- |
| Autonomous first draft workflow | Agent now generates content without waiting for approval |
| Added to system prompt          | Lines 59-81 in system.ts                                 |

### 8.3 Known Gaps

| Gap                       | Priority | Description                                          |
| ------------------------- | -------- | ---------------------------------------------------- |
| No guided refinement mode | HIGH     | Agent does batch updates, no section-by-section flow |
| Auto-scroll inconsistent  | MEDIUM   | dashboardAction exists but needs verification        |
| No tone variants          | MEDIUM   | Agent doesn't offer "punchy vs warm" options         |
| No SEO suggestions        | LOW      | No keyword recommendations                           |
| No progressive publish    | LOW      | Can't publish per-section, only all-or-nothing       |

---

<a name="competitive-analysis"></a>

## 9. Competitive Analysis

### 9.1 Major Competitors

| Platform                  | Type                    | AI Integration          | Target User            |
| ------------------------- | ----------------------- | ----------------------- | ---------------------- |
| **Wix ADI / Harmony**     | General website builder | Full AI site generation | Anyone                 |
| **Squarespace Blueprint** | General website builder | AI-assisted design      | Creative professionals |
| **Framer AI**             | Design-first builder    | AI layout generation    | Designers              |
| **Honeybook**             | Service pro CRM         | Limited AI              | Service professionals  |
| **Dubsado**               | Service pro CRM         | No AI                   | Service professionals  |
| **17hats**                | Service pro CRM         | No AI                   | Service professionals  |

### 9.2 Competitor UX Patterns (2026 Research)

**What leading platforms do:**

1. **Batch-first generation** — Full site created after brief questionnaire
2. **Optional guided refinement** — "Want to polish it section by section?"
3. **No progressive publish** — Draft until full publish
4. **Tone variants** — 2-3 options per section (warm/professional/creative)
5. **SEO nudges** — "Add 'Austin wedding photographer' to your headline"
6. **Photo guidance** — "Your hero would look better with an action shot"

### 9.3 HANDLED's Differentiation

| Aspect           | Wix/Squarespace       | HANDLED                            |
| ---------------- | --------------------- | ---------------------------------- |
| **Target**       | Everyone              | Service professionals only         |
| **Core flow**    | Design → Book (maybe) | Book → Everything else             |
| **Post-booking** | None                  | Full Project Hub                   |
| **AI voice**     | Generic helpful       | Industry-specific, terse           |
| **Integration**  | Add-ons               | Bundled (booking + CRM + payments) |

---

<a name="brainstorming"></a>

## 10. Brainstorming Session Outcomes

### 10.1 Key Decision: Hybrid Workflow

**Adopted Pattern:**

```
Batch Generation (Speed) → Optional Guided Refinement (Control)
```

**Rationale:**

- 80% of users want speed → batch-first doesn't slow them down
- 20% want control → guided mode available but opt-in
- Matches Wix/Squarespace's successful pattern

### 10.2 Target UX Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  ONBOARDING (Current - Working)                                  │
├─────────────────────────────────────────────────────────────────┤
│  1. User provides brain-dump (business type, value, location)    │
│  2. Agent stores facts                                           │
│  3. Agent generates FULL DRAFT (all placeholder sections)        │
│  4. "Here's your first draft! Take a look."                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  FORK: Batch vs Guided (NEW - TO BUILD)                         │
├─────────────────────────────────────────────────────────────────┤
│  Agent asks:                                                     │
│  "Want to refine section-by-section, or publish as-is?"         │
│                                                                  │
│  → "Publish" → Batch publish, done                               │
│  → "Refine" → Enter GUIDED MODE                                  │
│  → User tweaks specific thing → Handle ad-hoc, stay in batch     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  GUIDED MODE (NEW - TO BUILD)                                    │
├─────────────────────────────────────────────────────────────────┤
│  For each section:                                               │
│  1. Highlight section in preview (auto-scroll)                   │
│  2. Show current content                                         │
│  3. Ask targeted question OR offer 2-3 variants                  │
│  4. Include smart nudges (SEO, CTA, photos)                      │
│  5. Get approval → update → auto-scroll to next                  │
│                                                                  │
│  Escape hatches:                                                 │
│  - "Just finish it" → batch-complete remaining                   │
│  - "Skip this one" → move to next section                        │
│  - "Go back" → revisit previous section                          │
└─────────────────────────────────────────────────────────────────┘
```

### 10.3 Mock Conversation: Guided Mode

```
AGENT: I put together a first draft based on what you shared. Take a
       look at the preview →

       Want to go through each section together and polish it up, or
       does this look ready to publish?

       • "Let's refine it" - I'll walk you through section by section
       • "Looks good, publish it" - We'll go live now
       • Or just tell me what to tweak

USER: Let's refine it

AGENT: Starting with your Hero section - this is what visitors see first.

       [Auto-scrolls preview to Hero]

       Current headline: "Capturing Your Perfect Day"
       Current subheadline: "Austin wedding photography that tells your story"

       A few options:

       1. **Keep it** - Works well as-is
       2. **More specific**: "Candid Austin Wedding Photography"
          (adds your style + SEO keyword)
       3. **Emotion-focused**: "Because Every Moment Matters"
       4. **Something else** - Tell me what you're thinking

USER: I like option 2 but can we say "storytelling" instead of "candid"?

AGENT: Love it.

       [Updates Hero: "Storytelling Austin Wedding Photography"]
       [Auto-scrolls to show change]

       Updated. What about the subheadline - keep "that tells your story"
       or try something fresh?

USER: Keep it

AGENT: Done. Moving to About →

[... continues through sections ...]

USER: Actually just finish the rest, I'll tweak later

AGENT: Heard. I'll polish up the remaining sections.

       [Updates remaining sections]

       All done! Your storefront is ready. When you're ready,
       say "publish" and we'll go live.
```

### 10.4 Decisions Made

| Decision                        | Rationale                                        |
| ------------------------------- | ------------------------------------------------ |
| **Batch-first, always**         | Speed wins for 80%+ of users                     |
| **Guided mode is opt-in**       | "Refine section-by-section?" after first draft   |
| **"Just finish it" escape**     | Let users exit guided mode anytime               |
| **Skip progressive publishing** | Complexity without proven value                  |
| **Tone variants (future)**      | Warm/professional/creative options               |
| **SEO nudges (future)**         | Keyword suggestions based on business + location |

---

<a name="gaps"></a>

## 11. Gaps & Opportunities

### 11.1 High Priority Gaps

| Gap                                     | Effort    | Impact | Action               |
| --------------------------------------- | --------- | ------ | -------------------- |
| **No guided refinement mode**           | 2-3 hours | HIGH   | Add to system prompt |
| **Fork decision after first draft**     | 30 min    | HIGH   | Add to system prompt |
| **Remove redundant scroll instruction** | 5 min     | MEDIUM | Clean up prompt      |

### 11.2 Medium Priority Gaps

| Gap                          | Effort    | Impact | Action                            |
| ---------------------------- | --------- | ------ | --------------------------------- |
| **No tone variants**         | 1-2 hours | MEDIUM | Add variant generation to prompt  |
| **Auto-scroll verification** | 30 min    | MEDIUM | Test dashboardAction extraction   |
| **"Undo last change" tool**  | 2-4 hours | MEDIUM | Add tool, leverage versions array |

### 11.3 Lower Priority / Future

| Gap                   | Effort    | Impact | Notes                            |
| --------------------- | --------- | ------ | -------------------------------- |
| SEO suggestions       | 4-8 hours | MEDIUM | Based on industry + location     |
| Photo guidance        | 4-8 hours | MEDIUM | "Your hero needs an action shot" |
| Competitive insights  | 8+ hours  | LOW    | "3 similar businesses do X"      |
| A/B testing hooks     | 8+ hours  | LOW    | "This CTA tested 20% better"     |
| Mobile preview toggle | 2-4 hours | MEDIUM | Show mobile vs desktop           |
| Progressive publish   | 8+ hours  | LOW    | Per-section publish              |

---

<a name="honest-assessment"></a>

## 12. Honest Assessment vs. Competitors

### 12.1 Where HANDLED Wins

| Aspect                     | HANDLED                      | Wix/Squarespace               |
| -------------------------- | ---------------------------- | ----------------------------- |
| **Vertical focus**         | ✅ Built FOR service pros    | ❌ Generic, add booking later |
| **Post-booking flow**      | ✅ Full Project Hub          | ❌ None or third-party        |
| **Agent personality**      | ✅ Industry-specific, terse  | ❌ Generic helpful            |
| **Booking-first design**   | ✅ Every page drives booking | ❌ E-commerce heritage        |
| **Bundled infrastructure** | ✅ Booking + CRM + payments  | ❌ Marketplace of add-ons     |

### 12.2 Where HANDLED Is Behind

| Aspect                   | HANDLED                   | Wix/Squarespace              |
| ------------------------ | ------------------------- | ---------------------------- |
| **Design templates**     | ❌ Limited (~5)           | ✅ Hundreds                  |
| **Design customization** | ❌ Minimal (colors/fonts) | ✅ Full drag-drop            |
| **SEO tools**            | ❌ None                   | ✅ Built-in SEO suite        |
| **App marketplace**      | ❌ None                   | ✅ Thousands of integrations |
| **Mobile app**           | ❌ None                   | ✅ Full mobile editing       |
| **AI sophistication**    | ⚠️ Good but basic         | ✅ Multi-modal, advanced     |
| **Brand recognition**    | ❌ Unknown                | ✅ Household names           |

### 12.3 Brutal Truths

1. **We're not competing on design** — Wix/Squarespace will always have more templates. Our bet is that service pros don't WANT to design; they want it done for them.

2. **Our AI is catching up, not leading** — The autonomous first draft is table stakes. Guided refinement, tone variants, and SEO nudges are needed to match competitors.

3. **Post-booking is our moat** — No competitor has a comparable Project Hub. This is our differentiation.

4. **Vertical focus requires depth** — We can't be half-pregnant. If we're for photographers, we need photographer-specific features (galleries, proofing, contracts).

5. **Speed to value matters** — User should go from "sign up" to "published site" in <15 minutes. Every friction point loses users.

### 12.4 Strategic Recommendations

1. **Double down on post-booking** — Project Hub is unique. Make it exceptional.

2. **Nail the guided refinement UX** — This is the polish that separates good from great.

3. **Add industry-specific content** — Wedding photographer templates, coach templates, therapist templates.

4. **Don't chase Wix on customization** — Our users want less control, not more.

5. **Consider AI differentiation** — Vertical-specific AI (photography pricing advice, coaching session structures) could be unique.

---

<a name="agent-to-agent"></a>

## 15. Future: Agent-to-Agent Shopping

### 15.1 The Coming Paradigm Shift

By 2027-2028, a significant portion of service discovery will happen **agent-to-agent**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TODAY (2026)                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Human → Google Search → "wedding photographer austin"               │
│       → Browses 10+ websites                                         │
│       → Compares prices manually                                     │
│       → Fills out contact forms                                      │
│       → Waits for responses                                          │
│       → Books after 2-3 weeks of research                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    TOMORROW (2027+)                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Human → Personal AI: "I'm getting married June 15 in Austin.        │
│          Find me a candid-style photographer under $4k"              │
│                                                                      │
│  Personal AI → Queries 50+ photographer agents in parallel           │
│             → Filters by style, availability, price                  │
│             → Ranks by review sentiment, portfolio analysis          │
│             → Returns top 3 with booking links                       │
│                                                                      │
│  Human: "Book option 2"                                              │
│                                                                      │
│  Personal AI → Photographer Agent: "Book June 15, 2pm start"         │
│             → Handles deposit, contract, prep info                   │
│             → Done in 5 minutes                                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 15.2 What HANDLED Needs for Agent-to-Agent Readiness

| Requirement                 | Current State                         | Needed                                    |
| --------------------------- | ------------------------------------- | ----------------------------------------- |
| **Structured Service Data** | ✅ Package model with price, duration | Extend with style tags, keywords          |
| **Availability API**        | ✅ check_availability tool            | Expose as public endpoint                 |
| **Portfolio Metadata**      | ⚠️ Gallery exists                     | Add alt text, style tags, AI descriptions |
| **Review Aggregation**      | ❌ Not implemented                    | Aggregate from Google, Yelp, internal     |
| **Instant Booking API**     | ✅ create_booking tool                | Expose for agent-to-agent calls           |
| **A2A Protocol Support**    | ⚠️ ADK supports it                    | Enable A2A endpoints on agents            |

### 15.3 Competitive Moat in Agent Era

**Why this matters for HANDLED:**

1. **Wix/Squarespace are page builders** — They optimize for human browsing. When agents shop, pretty pages don't matter. Structured data does.

2. **HANDLED is booking-native** — Our entire architecture is built around packages, availability, and instant booking. This is exactly what agents need.

3. **Vertical focus helps** — An agent searching for "wedding photographer" will prefer structured data from a photography-specific platform over generic Wix sites.

### 15.4 Action Items for Agent-First Future

| Priority | Action                                                | Effort      |
| -------- | ----------------------------------------------------- | ----------- |
| **P1**   | Add JSON-LD structured data to storefronts            | 4-8 hours   |
| **P2**   | Expose availability API publicly (with rate limiting) | 2-4 hours   |
| **P3**   | Add style/tag taxonomy to packages                    | 4-8 hours   |
| **P4**   | Enable A2A protocol on customer-agent                 | 8-16 hours  |
| **P5**   | Build portfolio auto-tagging (AI vision)              | 16-24 hours |

---

<a name="cloud-run-vs-agent-engine"></a>

## 16. Cloud Run vs Vertex AI Agent Engine

### 16.1 Current Architecture Decision

HANDLED currently deploys agents to **Cloud Run** using Google ADK, NOT to **Vertex AI Agent Engine**.

**Evidence from console exploration:**

- Cloud Run: 3 active services (tenant-agent, customer-agent, research-agent)
- Vertex AI Agent Engine: "No agent instances"

### 16.2 Comparison

| Aspect               | Cloud Run + ADK                           | Vertex AI Agent Engine         |
| -------------------- | ----------------------------------------- | ------------------------------ |
| **Control**          | ✅ Full control over code, prompts, tools | ⚠️ Managed, less customization |
| **Deployment**       | ✅ Git-based, CI/CD friendly              | ⚠️ Console-based or SDK        |
| **Cost**             | ✅ Pay per request, scales to zero        | ⚠️ Higher baseline cost        |
| **Tooling**          | ✅ Custom tools, any integration          | ⚠️ Limited to registered tools |
| **Debugging**        | ✅ Full Cloud Run logs                    | ⚠️ Limited observability       |
| **A2A Protocol**     | ✅ Native ADK support                     | ✅ Native support              |
| **Managed Features** | ❌ DIY session management                 | ✅ Built-in session, memory    |
| **RAG Integration**  | ❌ DIY implementation                     | ✅ Native RAG Engine           |
| **Multi-model**      | ❌ DIY routing                            | ✅ Model selection built-in    |

### 16.3 Recommendation: Stay on Cloud Run

**For HANDLED's current stage and vision, Cloud Run + ADK is the right choice:**

1. **Control matters for brand voice** — HANDLED has a specific, opinionated voice. Cloud Run gives full control over prompts and behavior.

2. **Cost efficiency at current scale** — Agents scale to zero when not in use. Agent Engine has baseline costs.

3. **CI/CD integration** — Current GitHub Actions workflow works. Agent Engine would require migration.

4. **Custom tools are essential** — HANDLED's 24+ tenant tools require deep integration with the backend. Agent Engine's tool registry is more constrained.

### 16.4 When to Reconsider Agent Engine

Consider migrating if:

| Trigger                             | Why                                            |
| ----------------------------------- | ---------------------------------------------- |
| **RAG becomes critical**            | Agent Engine has native RAG Engine integration |
| **Scale hits 10K+ daily sessions**  | Managed infrastructure reduces ops burden      |
| **Multi-model routing needed**      | Agent Engine handles model selection natively  |
| **Google offers vertical features** | e.g., "Service Professional Agent Templates"   |

### 16.5 Hybrid Approach (Future Option)

A potential future architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    HYBRID ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Customer-facing (high volume, simpler):                            │
│  ┌───────────────────────────────────────┐                          │
│  │  Vertex AI Agent Engine               │ ← Managed, auto-scaling   │
│  │  • customer-agent                     │                          │
│  │  • research-agent                     │                          │
│  └───────────────────────────────────────┘                          │
│                                                                      │
│  Tenant-facing (complex, lower volume):                             │
│  ┌───────────────────────────────────────┐                          │
│  │  Cloud Run + ADK                      │ ← Full control           │
│  │  • tenant-agent (24 tools)            │                          │
│  └───────────────────────────────────────┘                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Verdict: Stay on Cloud Run for now. Revisit in 6 months.**

---

<a name="roadmap"></a>

## 17. Recommended Roadmap

### Phase 1: Guided Refinement (This Week)

| Task                                 | Effort    | Owner              |
| ------------------------------------ | --------- | ------------------ |
| Add fork decision to prompt          | 30 min    | Prompt engineering |
| Add guided refinement mode to prompt | 2-3 hours | Prompt engineering |
| Remove redundant scroll instruction  | 5 min     | Prompt engineering |
| Deploy to Cloud Run                  | 10 min    | Deployment         |
| Manual E2E test                      | 30 min    | QA                 |

### Phase 2: Polish (Next Week)

| Task                                       | Effort    | Owner              |
| ------------------------------------------ | --------- | ------------------ |
| Tone variants (warm/professional/creative) | 2-4 hours | Prompt engineering |
| Verify auto-scroll works                   | 1 hour    | Frontend           |
| Add E2E test for guided mode               | 2-4 hours | Testing            |

### Phase 3: AI Smarts (This Month)

| Task                                                | Effort    | Owner              |
| --------------------------------------------------- | --------- | ------------------ |
| SEO suggestions based on business type              | 4-8 hours | Backend + prompt   |
| Photo guidance suggestions                          | 4-8 hours | Backend + prompt   |
| Cross-section cohesion ("Your About mentions X...") | 2-4 hours | Prompt engineering |

### Phase 4: Competitive Parity (This Quarter)

| Task                        | Effort      | Owner           |
| --------------------------- | ----------- | --------------- |
| Mobile preview toggle       | 4-8 hours   | Frontend        |
| Industry-specific templates | 16-24 hours | Design + prompt |
| Undo/redo capability        | 8-16 hours  | Full stack      |

---

## Appendix A: Files Referenced

| File                                                         | Purpose                        |
| ------------------------------------------------------------ | ------------------------------ |
| `server/src/agent-v2/deploy/tenant/src/prompts/system.ts`    | Tenant agent system prompt     |
| `server/src/agent-v2/deploy/customer/src/prompts/system.ts`  | Customer agent system prompt   |
| `server/src/agent-v2/deploy/tenant/src/tools/index.ts`       | Tenant agent tools             |
| `server/src/agent-v2/deploy/customer/src/tools/index.ts`     | Customer agent tools           |
| `server/src/services/section-content.service.ts`             | Section content business logic |
| `packages/contracts/src/schemas/section-content.schema.ts`   | Section content Zod schemas    |
| `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`             | Agent deployment registry      |
| `docs/design/VOICE_QUICK_REFERENCE.md`                       | Brand voice guidelines         |
| `docs/architecture/BUILD_MODE_VISION.md`                     | Build mode architecture        |
| `docs/reports/2026-02-03-AGENT-SECTION-BEHAVIOR-ANALYSIS.md` | Today's analysis               |

---

## Appendix B: Deployment Info

| Service        | URL                                                     | Platform  |
| -------------- | ------------------------------------------------------- | --------- |
| Tenant Agent   | https://tenant-agent-506923455711.us-central1.run.app   | Cloud Run |
| Customer Agent | https://customer-agent-506923455711.us-central1.run.app | Cloud Run |
| Research Agent | https://research-agent-506923455711.us-central1.run.app | Cloud Run |
| API            | Render                                                  | Render    |
| Frontend       | Vercel                                                  | Vercel    |

---

## Appendix C: Quick Commands

```bash
# Deploy tenant agent
cd server/src/agent-v2/deploy/tenant && npm run deploy

# Check Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=tenant-agent" --limit=20

# Run typecheck
npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck

# Run tests
npm test
```

---

<a name="strategic-brainstorm"></a>

## 18. Strategic Brainstorm: Future Possibilities

This section contains open-ended thinking about what HANDLED could become. These ideas range from immediate improvements to long-term vision.

### 18.1 What's Missing from This Document

#### Session State Architecture

The document doesn't fully explain how session state flows through the system:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SESSION STATE FLOW                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User opens dashboard                                                │
│       ↓                                                              │
│  Backend calls ContextBuilder.getBootstrapData(tenantId)            │
│       ↓                                                              │
│  Backend creates ADK session with initial state:                     │
│  {                                                                   │
│    knownFacts: { businessType: 'photographer', location: 'Austin' },│
│    forbiddenSlots: ['businessType', 'location'],                    │
│    onboardingComplete: false,                                        │
│    storefrontState: { placeholderSections: ['hero', 'about'] }      │
│  }                                                                   │
│       ↓                                                              │
│  Session ID stored in frontend React state                          │
│       ↓                                                              │
│  All messages tagged with session ID                                 │
│       ↓                                                              │
│  Agent accesses context.state.get('knownFacts')                     │
│       ↓                                                              │
│  Facts persist across conversation turns                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Enterprise Slot Policy (Unique Innovation)

HANDLED has a **slot-policy system** that prevents redundant questions:

```typescript
// At session start, backend passes:
{
  forbiddenSlots: ['businessType', 'location'],
  knownFacts: { businessType: 'photographer', location: 'Austin' }
}

// Agent NEVER asks "What do you do?" because businessType is forbidden
// This is key-based (slot names), not phrase-matching
```

**Why this matters:** Most chatbots ask the same questions repeatedly. HANDLED's slot policy creates a "memory" that feels magical to users.

#### Error Recovery Patterns

When tools fail, the agent should:

1. Retry once with simpler parameters
2. If still fails, acknowledge gracefully
3. Offer alternative approaches
4. Never fabricate success

### 18.2 System Improvement Ideas

#### Idea 1: Persona Templates (Industry-Specific Behavior)

Pre-built agent personalities per vertical:

| Vertical             | Voice                      | Default Tone          | Auto-Suggested Sections    |
| -------------------- | -------------------------- | --------------------- | -------------------------- |
| Wedding Photographer | Romantic, detail-oriented  | Warm + Luxury         | Gallery, Testimonials, FAQ |
| Business Coach       | Confident, results-focused | Professional          | About, Services, CTA       |
| Therapist            | Empathetic, calm           | Warm + Conversational | About, FAQ, Contact        |
| Private Chef         | Passionate, sensory        | Creative + Luxury     | Gallery, Services, About   |

**Implementation:** A `personaTemplate` parameter at session creation loads industry-specific prompt fragments.

#### Idea 2: Crystal Ball (Predictive Section Suggestions)

Agent predicts what sections the user needs based on aggregate data:

```
User: "I'm a wedding photographer"

Agent: I noticed most wedding photographers on HANDLED have:
       ✓ Hero (you've got it)
       ✓ About (you've got it)
       ? Gallery — 87% of photographers add this
       ? FAQ — reduces booking questions by 40%
       ? Testimonials — increases conversions 23%

       Want me to set up a Gallery section?
```

**Why powerful:** Proactive guidance, not just reactive execution.

#### Idea 3: Style Transfer (Learn from Admired Sites)

User provides URL of a site they admire, agent extracts style cues:

```
User: "I love the vibe of [competitor-site.com]"

Agent: [Uses research-agent to analyze]

       I see what you're going for:
       - Minimalist layout with whitespace
       - Short, punchy headlines
       - Warm, conversational tone

       Want me to apply that style to your sections?
```

**Technical:** Leverage existing `research-agent` for web analysis.

#### Idea 4: Conversion Insights (Aggregated A/B Data)

Track which copy variants perform best across all HANDLED tenants:

```
Agent: Based on 200+ HANDLED storefronts, these headlines convert best
       for wedding photographers:

       1. "Love in Every Frame" — 4.2% booking rate
       2. "Your Story, Beautifully Told" — 3.8% booking rate
       3. "[Location] Wedding Photography" — 3.1% booking rate

       The first one's working great lately. Want to try it?
```

**Competitive moat:** Aggregated learnings across the platform. No competitor has this data advantage.

#### Idea 5: Agent Memory (Cross-Session Learning)

Agent remembers previous sessions and builds on them:

```
[Session 1]
User: "I want my brand to feel modern and clean"
Agent: [Stores preference: tone=modern, style=minimal]

[Session 2 — weeks later]
User: "Can you rewrite my About section?"
Agent: I remember you like modern and clean. Here's a refresh
       that keeps that vibe but adds more personality...
```

**Technical:** Store `brandPreferences` in Tenant table, load at session bootstrap.

#### Idea 6: Voice-First Onboarding (Mobile Experience)

For mobile users, support voice input during interview phase:

```
[User taps microphone]
User: "I'm a wedding photographer in Austin, I specialize in
       candid moments, my clients are usually couples in their
       late twenties to early thirties..."

Agent: [Transcribes, extracts facts, stores them]

       Got it. Here's what I captured:
       - Wedding photographer ✓
       - Austin ✓
       - Candid style ✓
       - Target: couples 25-35 ✓

       Anything to add before I build your first draft?
```

**Why:** Target users are busy professionals. Voice input is faster than typing.

#### Idea 7: QR Code Preview (Instant Mobile Check)

One-click QR code to preview storefront on phone:

```
Agent: Your draft is ready. Want to see how it looks on mobile?

       [QR Code appears in chat]

       Scan this to preview on your phone — I'll wait.
```

**Simple but delightful** — shows attention to mobile experience.

### 18.3 Compound Engineering Integration

HANDLED has access to 139 plugins/agents/commands through the compound engineering system:

#### Available Review Agents

| Agent                      | Use For                                 |
| -------------------------- | --------------------------------------- |
| `agent-native-reviewer`    | Review prompt changes for anti-patterns |
| `security-sentinel`        | Check for prompt injection vectors      |
| `code-simplicity-reviewer` | Verify prompts aren't over-engineered   |
| `learnings-researcher`     | Search docs/solutions/ for patterns     |

#### Recommended Workflow

Before deploying prompt changes:

```bash
# 1. Run agent-native-reviewer on prompt changes
npx claude-code "Run agent-native-reviewer on tenant-agent prompt"

# 2. Run /plan_review for major changes
/plan_review

# 3. Test in staging before production
npm run deploy:staging
```

#### Documented Solutions

18 agent-specific solutions in `docs/solutions/agent-issues/`:

- Autonomous first draft workflow
- Fact-to-storefront bridge
- Duplicate content confusion
- Agent failures debugging
- Slot policy context injection

65+ prevention patterns in `docs/solutions/patterns/`:

- ADK A2A prevention strategies
- Session state management
- Tool active memory patterns
- Dual-context agent isolation

### 18.4 Wild Ideas (Long-Term Vision)

#### HANDLED Network: Cross-Tenant Referrals

When a photographer is booked, refer clients to other HANDLED vendors:

```
Customer: "I just booked my photographer! Now I need a DJ."

Customer Agent: I see you're working with Sarah (Austin Wedding Photography).
                She often works with these DJs:

                1. Austin Beats DJ — 4.9★ (worked 12 weddings with Sarah)
                2. Hill Country Sound — 4.7★ (worked 8 weddings with Sarah)

                Want me to check their availability for your date?
```

**Moat:** Network effects. More vendors = more referrals = more value.

#### Industry Brain: Vertical-Specific Training

Fine-tune a model on wedding industry conversations, photographer workflows, coaching best practices.

This would make HANDLED's AI **actually understand** the business context better than Wix's generic AI.

#### Smart Contracts: AI-Generated Service Agreements

Agent generates service contracts based on bookings:

```
Agent: I've drafted a standard wedding photography contract:

       • Event: Wedding at Dripping Springs, June 15
       • Coverage: 8 hours
       • Deliverables: 500 edited images within 6 weeks
       • Payment: $1,000 deposit due now, $2,000 due day of

       [Download PDF] or [Edit in HANDLED]
```

**Huge value:** Contracts are a major pain point for service professionals.

#### Booking Intelligence: Predict No-Shows

AI predicts no-show likelihood based on:

- Communication patterns
- Payment timing
- Booking lead time
- Historical data

```
Agent (to tenant): Heads up — your 3pm tomorrow has some flags:
                   • Booked 6 months ago, no communication since
                   • Similar patterns have 23% no-show rate

                   Want me to send a confirmation reminder?
```

### 18.5 Implementation Priority Matrix

| Priority | Idea                                 | Effort     | Impact | Timeline     |
| -------- | ------------------------------------ | ---------- | ------ | ------------ |
| **P0**   | Guided refinement mode               | 2-3 hours  | HIGH   | This week    |
| **P0**   | Document session state architecture  | 1 hour     | HIGH   | Today        |
| **P1**   | Persona templates                    | 4-8 hours  | HIGH   | This month   |
| **P1**   | Conversion insights (aggregate data) | 8-16 hours | HIGH   | This month   |
| **P2**   | Voice-first onboarding               | 8-16 hours | MEDIUM | This quarter |
| **P2**   | QR code preview                      | 2-4 hours  | MEDIUM | This sprint  |
| **P3**   | Style transfer from URLs             | 8-16 hours | MEDIUM | This quarter |
| **P3**   | Cross-tenant referrals               | 40+ hours  | HIGH   | Next quarter |
| **P4**   | Smart contracts                      | 40+ hours  | HIGH   | Future       |
| **P4**   | Booking intelligence                 | 40+ hours  | MEDIUM | Future       |

### 18.6 Key Insight: Data Advantage

HANDLED's biggest potential moat isn't features — it's **aggregated data**:

1. **Copy that converts** — Learn from all tenants which headlines, CTAs, and descriptions perform best
2. **Pricing intelligence** — Know what photographers in Austin charge vs. Dallas
3. **Booking patterns** — Understand seasonality, lead times, no-show predictors
4. **Cross-vendor insights** — Which photographer-DJ pairs work well together

**No single tenant has this data. HANDLED does.**

This is how to compete with Wix/Squarespace: not on features, but on **intelligence that only comes from vertical focus**.

---

## Appendix D: For External AI Evaluation

### D.1 Key Questions This Document Answers

1. **What is HANDLED?** — AI-powered booking platform for service professionals (Section 1)
2. **How do the agents work?** — Full prompts in Section 6, tools in Section 7
3. **What's the Google Cloud setup?** — Cloud Run deployment, NOT Vertex AI Agent Engine (Section 3)
4. **How does HANDLED compare to competitors?** — Honest assessment in Section 14
5. **What's the vision?** — Be the "Apple" for creatives, agent-to-agent ready (Section 2)
6. **Should they use Vertex AI Agent Engine?** — No, stay on Cloud Run for now (Section 16)
7. **What's the future roadmap?** — Strategic brainstorm with 10+ ideas prioritized (Section 18)
8. **What's the data advantage?** — Aggregated insights across all tenants (Section 18.6)

### D.2 Strengths to Build On

1. **Booking-native architecture** — Unlike page builders, HANDLED is built around bookings
2. **Vertical focus** — Specialized for service professionals, not generic
3. **Project Hub moat** — Post-booking CRM that competitors lack
4. **Agent-first infrastructure** — ADK deployment is more flexible for custom needs
5. **Opinionated voice** — Clear brand that stands out from generic AI

### D.3 Critical Gaps to Address

1. **Guided refinement mode** — Users can't polish section-by-section (HIGH)
2. **Tone variants** — No warm/professional/creative options (MEDIUM)
3. **SEO suggestions** — No keyword guidance (MEDIUM)
4. **Agent-to-agent readiness** — Need structured data, public APIs (FUTURE)

### D.4 Strategic Recommendation Summary

> **Don't compete with Wix on features. Compete on magic.**
>
> HANDLED should feel like hiring a business partner who handles everything you don't want to think about. Every interaction should reinforce: "We've got it handled."
>
> The future is agent-to-agent. Build for structured data, availability APIs, and instant booking protocols. This is where a booking-native platform has a natural advantage over page builders.

---

**Document Version:** 3.0.0
**Last Updated:** 2026-02-03 (with Google Cloud exploration, vision update, and strategic brainstorm)
**Total Sections:** 18 + 4 Appendices
**Word Count:** ~10,000+
**Next Review:** After guided refinement implementation

---

_This document was prepared for external AI evaluation. It contains full system prompts, tool inventories, infrastructure details, honest competitive analysis, and a strategic brainstorm with 10+ prioritized improvement ideas. Use it to assess HANDLED's AI agent ecosystem and provide strategic recommendations._
