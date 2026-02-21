# Onboarding Redesign & Tenant Agent Overhaul

**Date:** 2026-02-20
**Status:** Brainstorm complete
**Scope:** Complete redesign of signup → onboarding → website editing experience + tenant agent role/prompt
**Supersedes:** `2026-02-11-onboarding-conversation-redesign-brainstorm.md` (conversation-first approach abandoned)

---

## What We're Building

A fundamentally new onboarding flow that front-loads discovery into a structured signup form, builds the tenant's MVP website in the background during a pre-recorded onboarding video, and delivers them into a hybrid editing environment where AI chat and direct inline editing coexist. The tenant agent is repositioned from "interviewer/onboarder" to "business partner/consultant."

### The New Flow (End-to-End)

```
1. ACCOUNT CREATION (email + password)
         ↓
2. PAYMENT (reverse free trial — pay for first month upfront)
         ↓
3. CONVERSATIONAL INTAKE FORM (~10 questions, chat-style, one at a time)
   + optional photo upload + current website URL
         ↓
4. BACKGROUND BUILD (agent processes form answers, scrapes existing website, generates HERO + ABOUT + SERVICES)
         ↓
5. ONBOARDING VIDEO (pre-recorded, ~60-90s, plays while build runs)
         ↓
   [If build not done: loading state with section-level progress]
         ↓
6. WEBSITE REVEAL (user sees their 3-section MVP website)
         ↓
7. CHECKLIST-DRIVEN SETUP GUIDE ("Your website is 40% complete. Next: Add testimonials...")
         ↓
8. HYBRID EDITING (AI agent panel + inline text/image editing + section visibility controls)
```

**Key architectural note:** The intake form happens AFTER account creation and payment. This means:

- The tenant record exists, so photos upload directly to the tenant's permanent storage
- Payment acts as anti-bot/anti-spam protection — no bots paying $X/month to fill forms
- The conversational form is an authenticated experience inside the dashboard
- Higher-quality intake: anyone who reaches the form has already committed financially

### What Changes From Today

| Aspect            | Current                                             | New                                                               |
| ----------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| Signup flow       | Create account → free trial → form                  | Create account → pay (reverse trial) → conversational intake form |
| Discovery         | Agent interviews conversationally (unreliable)      | Conversational form (~10 questions, chat-style)                   |
| Website URL       | Not collected                                       | Current website scraped for migration                             |
| Photos            | Not collected at signup                             | Optional upload at signup, prompted after                         |
| Onboarding        | Agent greets + explains dashboard                   | Pre-recorded video                                                |
| Initial build     | Agent builds section-by-section during conversation | Background build from form data (no conversation needed)          |
| Starting sections | HERO + ABOUT + SERVICES (but built slowly)          | Same 3 sections, but built instantly in background                |
| Post-reveal       | Agent-driven, open-ended                            | Checklist-driven with progress %                                  |
| Editing model     | AI-only (preview is read-only)                      | Hybrid: inline editing + AI agent coexist                         |
| Agent role        | Interviewer → builder → helper                      | Business partner / consultant from day one                        |

---

## Why This Approach

### Problem: The current conversational onboarding is unreliable

The tenant agent tries to do too much: greet the user, interview them, discover their business, create segments, create tiers, generate copy, build sections, explain the dashboard, and guide refinement — all through a single chat conversation. The prompt can't reliably handle this many responsibilities, and users frequently get stuck.

### Solution: Separate structured data collection from creative generation

Forms are deterministic. AI is creative. By collecting structured data (business type, services, pricing, target market) via a form and letting the AI focus purely on what it's good at (generating compelling copy, placing content, suggesting improvements), we play to each system's strengths.

### Industry validation

Research into Framer, Squarespace Blueprint, Wix Harmony, Webflow, Hostinger, and Brizy AI confirms:

- **Front-loaded questionnaires** are universal — every major builder starts with structured intake
- **AI + manual editing coexistence** (not a toggle) is the frontier pattern (Wix Harmony, Framer)
- **Section-level AI operations** (not full-page regeneration) is the emerging standard
- **Manual edits override AI** — the hierarchy is: direct edit > AI-via-chat
- **Checklist-driven setup guides** are standard product-led growth mechanics

---

## Key Decisions

### 1. Signup Form: ~8-10 Questions (Core + Personality + Segment Discovery)

The form collects enough to build HERO + ABOUT + SERVICES with a rough tier structure. Critically, the form also discovers **customer segments** — most service pros haven't considered tiered pricing, and helping them discover it is a core HANDLED value prop.

**Essential (form must collect):**

- `businessName` — Business name
- `businessType` — What type of service professional (photographer, coach, planner, etc.)
- `location` — City/state
- `servicesOffered` — What services do you offer? (free text or multi-select)
- `targetMarket` — Who are your ideal clients?
- `priceRange` — General pricing tier (budget, mid-range, premium, luxury)

**Segment discovery (key for tier generation):**

- "Do you serve different types of customers?" (e.g., weddings vs. corporate vs. portraits for a photographer)
- "What do you offer each type?" — conditional follow-up per segment identified
- This is how we seed the Segment → Tier hierarchy without the user knowing what "tiers" are yet

**Personality (form should collect for better copy):**

- `uniqueValue` — What makes you different from others in your field?
- `yearsInBusiness` — How long have you been doing this?
- `approach` — How would you describe your style/approach?

**Collected via separate form fields (not discovery facts):**

- Current website URL (for scraping/migration)
- Photo uploads (logo, headshot, portfolio — optional, skip-able)
- _(Email + password collected earlier during account creation, before the form)_

**Form format:** Conversational (chat-style, one question at a time). On-brand with HANDLED — feels like talking to your handler from the very first interaction. Creates a seamless arc: conversational intake → onboarding video → dashboard agent who already knows you.

**Deferred to post-onboarding (agent fills these via conversation):**

- `dreamClient`, `testimonial`, `faq`, `contactInfo`, `specialization`
- Detailed tier configuration (the agent proposes tiers from form data, then refines through conversation)

### 2. Website URL = Current Website Only (Migration Path)

- Only collect "your current website" — no "inspiration" option for V1
- Scrape aggressively: extract business descriptions, service names, pricing, about text, testimonials, photos
- This is a migration story: "Bring your existing website to HANDLED"
- Use the research agent for scraping (already exists: `delegate_to_research` tool)
- Scraped data supplements form answers — form is authoritative, scraped data fills gaps

### 3. Photo Uploads = Optional at Signup, Prompted After

- Signup form includes an optional photo upload step (skip-able)
- Accept: logo, headshot, 3-5 portfolio images
- If skipped: initial build uses placeholder images
- After onboarding video: prompt to upload photos as a checklist item
- If photos were scraped from existing website, use those as starting point

### 4. Editing Model = Coexistence (Wix Harmony Pattern)

**Not a toggle. Both modes live simultaneously.**

- **Left panel:** Storefront preview, but now directly editable:
  - Click text → inline editing
  - Click image → replace/upload
  - Section visibility toggle (show/hide)
  - Section reorder via drag-and-drop
- **Right panel:** AI agent chat (existing `AgentPanel`, ~400px)
  - Agent can still make changes via tools (`update_section`, etc.)
  - Agent changes show immediately in the editable preview
  - Manual edits override agent changes on the same element

**Not in V1:**

- Full drag-and-drop within sections (layout editing)
- Column/grid manipulation
- Spacing/padding controls
- Component-level editing (buttons, icons individually)

**Conflict resolution rule (from Wix Harmony):**

- Manual edits always win over AI changes on the same element
- If the agent updates a section the user has manually edited, the agent's changes apply only to fields the user hasn't touched

### 5. Onboarding = Pre-Recorded Video (~60-90s) — Placeholder for V1

- Plays immediately after intake form submission while website builds in background
- Content: Platform walkthrough (what each dashboard section does, what to expect)
- Mascot/brand character featured (design TBD — "small lady in a briefcase" concept)
- **V1 ships with a placeholder video** (simple animated walkthrough or explainer). Real mascot video produced later — not a launch blocker
- "Skip" button available for impatient users
- If website build finishes before video ends: show subtle "Your website is ready!" indicator

### 6. Initial Build = HERO + ABOUT + SERVICES (Rough Draft Tiers)

- Three sections built from form data + scraped website content
- SERVICES section includes a **rough draft** tier structure:
  - Agent proposes 3 tiers based on segment discovery + services + price range from form
  - These are explicitly a starting point, not final — many tenants have never considered tiered pricing
  - Tier refinement is a **key post-onboarding conversation** topic (part of HANDLED's value prop)
  - The agent acts as a pricing consultant: "Based on what you offer, here's how I'd package this. Let's refine together."
- All other sections (TESTIMONIALS, FAQ, GALLERY, CONTACT, CTA) added post-onboarding via checklist
- **Strategic note:** Tiered pricing + A2A-ready service descriptions are a core differentiator. The questionnaire seeds this, the agent completes it.

### 7. Post-Reveal = Checklist-Driven Setup Guide

Visible progress indicator: "Your website is X% complete"

**Checklist items (ordered by impact):**

1. Review & edit your website sections (HERO, ABOUT, SERVICES) — auto-checked after reveal
2. Upload your photos (logo, headshot, portfolio)
3. Add testimonials section
4. Add FAQ section
5. Add a gallery/portfolio section
6. Connect Stripe for payments
7. Set your availability/scheduling
8. Publish your website

**Each item is one-click actionable:**

- "Add testimonials" → opens agent with pre-loaded prompt: "Let's add a testimonials section. Do you have any client quotes I can use?"
- "Connect Stripe" → navigates to Settings > Payments
- "Upload photos" → opens photo upload modal

### 8. Timing Fallback = Loading State with Progress

If the onboarding video ends before the website build completes:

- Show section-level progress: "Building your hero section... Writing your about page... Setting up services..."
- Animated placeholder sections that fill in as they complete
- Each section appears individually as it's ready (progressive reveal)
- Typical expected build time: 30-60 seconds (form processing + scraping + 3 section generations)

### 9. Tenant Agent = Business Partner / Consultant

**Role shift:** The agent is no longer an interviewer or onboarder. It's a knowledgeable business partner who:

- Already knows the tenant's basics (from form data)
- Proactively encourages best practices ("Adding testimonials increases conversion by 30%")
- Still interviews to fill missing pieces, but from a position of existing knowledge
- Acts as a web optimization consultant
- Wants to see the client succeed and use HANDLED to its full potential
- Drives checklist completion by suggesting next steps contextually

**Voice (aligned with HANDLED brand):**

- Brief, action-oriented: "Got it — adding a gallery with your portfolio shots. Take a look."
- Encouraging but not hype-y: "Your about section could use a personal touch. Want to tell me about how you got started?"
- Opinionated when it helps: "I'd recommend adding testimonials before your FAQ — social proof converts better above the fold."
- Never: "Great! Absolutely! I'd be happy to..."

---

## Technical Implications (High-Level)

### New Infrastructure Needed

- **Conversational intake form**: Chat-style form (one question at a time, ~10 questions + optional photo upload). Runs post-payment, pre-dashboard. Stores answers as discovery facts on the tenant record.
- **Reverse free trial payment flow**: Payment step between account creation and intake form (Stripe Checkout or embedded payment form)
- **Background build pipeline**: Trigger website generation on intake form submit (account already exists, payment already processed)
- **Website scraping service**: Extract content from existing websites (can leverage research agent). Graceful fallback to form-only if scraping fails.
- **Inline editing layer**: Click-to-edit text, click-to-replace images on the storefront preview
- **Section visibility controls**: Show/hide toggles, drag-to-reorder on the preview
- **Checklist derivation service**: Compute setup progress from actual data state (sections, Stripe, photos, etc.). Exposed to agent via `get_setup_progress` tool.
- **Checklist UI component**: Progress bar + actionable items on the dashboard, derived from data state
- **Onboarding video player**: Fullscreen video with skip button + "website ready" indicator (placeholder video for V1)
- **Photo upload during intake**: Standard authenticated upload to tenant's permanent storage (account already exists)

### Existing Systems Modified

- **Signup route** (`auth-signup.routes.ts`): Simplified — just email + password. Payment + intake form are separate steps.
- **Tenant provisioning** (`tenant-provisioning.service.ts`): Split into two phases — (1) account creation on signup, (2) intake data + background build after form submit
- **Tenant agent prompt**: Complete rewrite — remove interviewer role, add consultant role
- **Preview panel** (`PreviewPanel`): Add inline editing capabilities
- **Agent UI store**: New states for video playback, checklist, progressive reveal
- **Discovery facts system**: Pre-populate from form data instead of conversational extraction
- **`build_first_draft` tool**: Accept form data directly instead of requiring conversation

### Unchanged

- `SectionContent` model and service (already supports section-level CRUD)
- Section types and block type enum
- Publish/draft system
- Agent tool infrastructure (update_section, manage_tiers, etc.)
- Stripe integration
- Calendar integration

---

## Resolved Questions

1. **Tier generation from form data**: ~~Can we reliably generate 3 meaningful tier descriptions?~~ **Resolved:** Most tenants haven't considered tiered pricing — this is part of HANDLED's value. The form discovers customer segments and services per segment. The agent proposes a rough tier structure in the initial build, then refines through post-onboarding conversation acting as a pricing consultant.

2. **Edit conflict resolution**: ~~What happens when manual edits conflict with agent changes?~~ **Resolved:** (a) Agent always reads current section state including manual edits before modifying. (b) Manual edits are source of truth — agent incorporates, not replaces. (c) Auto-apply for small changes with review bar (Keep/Undo/Try Again), Action Plan verification for large changes. (d) Section highlighting (sage border + spotlight dimming) makes active section obvious. Full UX spec in "Hybrid Editing UX Design" section.

## Resolved Questions (Round 2)

3. **Scraping reliability**: ~~What % have scrapeable sites?~~ **Resolved:** Most target customers (photographers, coaches, planners) have basic WordPress/Squarespace sites that are scrapeable. For hard-to-scrape sites, graceful fallback to form-only. Don't over-invest in scraping reliability — the form answers are the primary data source, scraping is enhancement.

4. **Photo storage**: ~~Where to store photos before account exists?~~ **Resolved:** The reverse free trial model means account creation + payment happen BEFORE the intake form. Photos upload directly to the tenant's permanent storage. No temporary storage needed.

5. **Checklist persistence**: ~~Where does checklist state live?~~ **Resolved:** Derive from actual data state (section existence, Stripe connection, photo uploads, etc.). No redundant storage. Add a small `dismissedChecklistItems: string[]` field on the Tenant model for items the user explicitly skips. The agent uses the same derivation logic via a `get_setup_progress` tool — always in sync with the UI checklist.

6. **Video production**: ~~Blocker for launch?~~ **Resolved:** Ship V1 with a placeholder video (animated walkthrough or simple explainer). Produce the real mascot video as a follow-up. Not a launch blocker.

7. **Form UX**: ~~Single page vs. multi-step?~~ **Resolved:** Conversational form — chat-style interface where questions appear one at a time like a conversation. On-brand with HANDLED (feels like talking to your handler). Creates a seamless arc from intake conversation → dashboard agent.

## Open Questions

None — all questions resolved. Ready for `/workflows:plan`.

---

## Hybrid Editing UX Design (Research-Informed)

Based on deep research into Framer, Wix Harmony, Webflow, Figma, Sanity, Tiptap, Cursor, Notion, and design system guidance from Cloudscape (AWS), NNGroup, Smashing Magazine, and Shape of AI.

### Design Principle: "AI-Second"

The storefront preview is the primary editing surface. The AI agent chat is a power tool layered onto it. This is NOT "an AI chatbot that can edit websites" — it's a website editor with an AI collaborator. The preview always takes visual priority.

### Section Focus / AI Awareness

When the AI is working on a section, the user must know which one — borrowed from Figma's multiplayer collaboration visual language:

- **AI's visual identity:** A consistent color (HANDLED's sage/green accent) for all AI activity indicators
- **AI references a section in chat:** The preview auto-scrolls to that section + a 2px sage border fades in (200ms)
- **AI is actively generating content:** Border stays solid, section content gets a subtle skeleton shimmer overlay
- **AI finishes:** A floating "review bar" appears at the top of the section: **Keep** | **Undo** | **Try Again**
- **Spotlight effect:** Inactive sections dim to ~70% opacity when AI has focused a specific section (reduces cognitive load)
- **Accessibility:** All animated indicators respect `prefers-reduced-motion` — static color change + text label as fallback

### Inline Editing Interaction

Standard across all major builders — single-click to select, double-click to edit:

- **Hover on section:** Reveal a faint dotted outline + pencil icon in the top-right corner (Sanity pattern)
- **Single-click on section:** Solid selection border appears, section toolbar shows above it (visibility toggle, reorder handle)
- **Double-click on text:** Enter inline text edit mode, cursor placed in text
- **Image hover:** Camera icon overlay appears; clicking opens image replace/upload picker
- **Chat panel awareness:** When user is in inline edit mode, show a subtle banner in the chat panel: "You're editing [Section Name] directly"

### AI Change Visualization

Different patterns for different change types (from Cloudscape design system + Notion AI):

- **Text rewrites (headline, paragraph):** Stream new text character-by-character into the preview while AI generates
- **Structural changes (add section, reorder):** Skeleton shimmer during generation → cross-dissolve new content in (~200ms)
- **After AI finishes any change:** Floating review bar: **Keep** | **Undo** | **Try Again**
- **NOT implementing:** Full diff view (red/green markup) — too complex for non-technical service professionals. Use the Notion model instead: "here's the new version, keep or discard"

### Undo / History

Per-action undo steps, clearly labeled by author:

- Each AI section update = one undo step, labeled "AI: [action description]" (e.g., "AI: Rewrote Hero headline")
- Each manual inline edit = one undo step, labeled with section name
- Per-section "revert to original" button (reverts to last published state)
- Session-level history panel (future enhancement) showing alternating AI and human edits with timestamps

### Conflict Resolution

Proportional to change scope — auto-apply small changes, verify large ones:

- **Small changes** (copy edits, word tweaks): Auto-apply + review bar with Undo option
- **Large changes** (full section rewrite, layout changes): Agent shows an Action Plan in chat first ("I'll update the headline, rewrite the sub-text, and change the CTA. Proceed?") before executing
- **Destructive changes** (delete section, discard all drafts): Always require explicit confirmation (existing T3 trust tier)
- **Manual edit awareness:** If user has made manual edits to a section, the agent reads current state (including manual edits) before modifying. The agent references this in chat: "I see you've updated the headline — I'll work from your version"
- **No hard locking:** Manual edits do not lock a section from AI. The agent always works from the latest state. But manual edits are the source of truth — the agent incorporates them, not replaces them
- **Future consideration:** "Suggestion mode" toggle for power users (all AI changes show as diffs requiring acceptance)

### Agent Communication Patterns (from Shape of AI)

- **Stream of Thought:** Agent shows its reasoning before acting: "Looking at your About section... Your photography experience + personal approach would work well here..."
- **Action Plan:** For multi-step operations, preview what will happen: "I'll: (1) update the headline, (2) add client testimonials, (3) adjust the CTA. Sound good?"
- **Shared Vision:** Real-time section highlighting = both user and AI "see" the same context
- **Start/Stop controls:** User can interrupt a multi-step AI operation (prevents "Sorcerer's Apprentice" runaway agent)

---

## Out of Scope (Deferred)

- Full drag-and-drop visual editor (within-section layout editing)
- Mascot/brand character design
- "Inspiration website" URL option
- Multi-page websites (single-page storefront only for V1)
- A/B testing of onboarding flows
- Mobile editing experience
