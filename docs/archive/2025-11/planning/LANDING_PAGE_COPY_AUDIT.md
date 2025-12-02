# MAIS Landing Page Copy Audit & Recommendations

**Date:** November 26, 2025
**Objective:** Transform landing page copy to embody "focus on what you love, leave the rest to us" while making AI approachable for non-technical small business owners.

---

## Executive Summary

Your current landing page copy is **solid but conventional**. It follows the StoryBrand-adjacent approach well, but doesn't fully capture the unique positioning of MAIS as a **collective/partnership** vs. a typical SaaS platform. The copy also leans slightly too technical and doesn't adequately address the "AI-curious but overwhelmed" audience.

### Key Findings

| Area | Current State | Opportunity |
|------|--------------|-------------|
| **Hero** | Good problem/solution | Could be more emotionally liberating |
| **AI Positioning** | Implicit | Should be explicitly approachable |
| **Partnership Model** | Mentioned in FAQ | Should be front-and-center differentiator |
| **Community Feel** | Weak | Needs "collective" language throughout |
| **Voice** | Professional | Could be warmer, more personal |

---

## Section-by-Section Analysis & Recommendations

### 1. HERO SECTION
**File:** `client/src/pages/Home/HeroSection.tsx`

#### Current Copy
- **Subheading:** "For business owners who want AI working for them—not the other way around"
- **Headline:** "What if growing your business didn't mean losing your life?"
- **Body:** "We become your AI-powered back office. You keep doing what you love. No employees. No tech stack to master. Just growth."
- **CTA:** "Start a conversation"
- **CTA Subtext:** "Free 15-minute call. No pitch, just answers."

#### Analysis
✅ **Strong:** The headline asks a provocative question that resonates
✅ **Strong:** "You keep doing what you love" is on-message
⚠️ **Needs Work:** "AI working for them" assumes they understand/want AI
⚠️ **Needs Work:** "Back office" feels corporate, not personal
❌ **Missing:** The partnership/revenue-share differentiator
❌ **Missing:** Community/collective positioning

#### Recommended Rewrites

**Option A - The Liberation Approach (Breezy-inspired)**
```
Subheading: "For entrepreneurs who'd rather grow their business than manage it"

Headline: "You handle the craft. We handle everything else."

Body: "Marketing, websites, bookings, AI—we take care of the business stuff
that steals your time. You focus on the work you actually love. No monthly
fees. We only get paid when you grow."

CTA: "Join the club"
CTA Subtext: "Free 15-minute call. Real conversation, zero sales pitch."
```

**Option B - The Partnership Approach**
```
Subheading: "The growth partnership for entrepreneurs who want their time back"

Headline: "What if your business had a partner who only won when you did?"

Body: "We're not another software subscription. We're a growth club that handles
your marketing, website, and bookings—powered by AI you don't have to understand.
We take a small cut of revenue we help generate. Your success is literally our
business model."

CTA: "Become a member"
CTA Subtext: "15-minute call. Just clarity."
```

**Option C - The Plain-English AI Approach**
```
Subheading: "AI-powered growth without the AI headache"

Headline: "You know AI could transform your business. We make it actually happen."

Body: "No coding. No complicated tools. No 47-tab tech stack. Just tell us what
you want to achieve—we'll build the AI systems, handle your marketing, and run
your bookings. You do what you love. We do what we love (making you money)."

CTA: "Let's talk"
CTA Subtext: "Free strategy call. We'll show you exactly how it works."
```

---

### 2. PROBLEM SECTION
**File:** `client/src/pages/Home/ProblemSection.tsx`

#### Current Copy
- **"Drowning in Admin"** - Started business to do what you love, now spending 60 hours on scheduling/invoices
- **"Losing Leads"** - Competitors with better systems booking your potential clients
- **"Burning Out"** - Wearing every hat isn't sustainable

#### Analysis
✅ **Strong:** These pain points are accurate and relatable
✅ **Strong:** The transition "You didn't start a business for this" is powerful
⚠️ **Needs Work:** Missing the "AI overwhelm" pain point
⚠️ **Needs Work:** Could be more specific/vivid

#### Recommended Additions

**Add a 4th pain point - The AI Overwhelm:**
```
Title: "AI FOMO"

Description: "You see competitors using ChatGPT and automation. You know AI could
help, but where do you even start? The learning curve feels like climbing Everest
in flip-flops."
```

**Make existing cards more vivid:**

```
CURRENT: "You started a business to do what you love—not to spend 60 hours a week
on scheduling, invoices, and follow-ups."

RECOMMENDED: "You became a [photographer/coach/consultant] because you love the work.
Now you're an email manager, invoice chaser, and late-night booking coordinator who
occasionally gets to do what you actually built this for."
```

---

### 3. STORY SECTION
**File:** `client/src/pages/Home/StorySection.tsx`

#### Current Copy
The friend who closed her photography studio story—she was talented and booked solid but burned out on admin.

#### Analysis
✅ **Strong:** Origin story creates emotional connection
✅ **Strong:** "She needed a partner" is on-message
⚠️ **Needs Work:** Could emphasize the AI angle more
⚠️ **Needs Work:** "50+ business owners" feels like a customer count, not a community

#### Recommended Rewrites

```
CURRENT: "Today, we partner with 50+ business owners across Georgia."

RECOMMENDED: "Today, the Macon AI Club includes 50+ entrepreneurs across Georgia—
photographers, consultants, coaches, event planners. They're not customers.
They're partners. Their success funds our growth. Our growth funds better tools
for them."
```

**Add AI-approachability paragraph:**
```
"And here's the thing about AI that nobody tells you: you don't need to understand
how it works to use it. You don't need to learn prompts or master new software.
You just need to tell us what's eating your time—and we build the solution.
That's what partnership means."
```

---

### 4. VALUE SECTION (Transformation)
**File:** `client/src/pages/Home/ValueSection.tsx`

#### Current Copy
- Before: "15+ hours/week on admin" → After: "Your weekends back"
- Before: "Feast or famine bookings" → After: "Consistent pipeline"
- Before: "Guessing what works" → After: "Data-driven growth"

#### Analysis
✅ **Strong:** Before/After format is effective
⚠️ **Needs Work:** "Data-driven growth" sounds technical
⚠️ **Needs Work:** Could be more emotionally resonant

#### Recommended Rewrites

```
Transformation 1:
Before: "Sunday nights answering emails"
After: "Sunday dinners with family"
Description: "AI handles scheduling, invoicing, and follow-ups while you sleep.
You wake up to a organized inbox and a full calendar."

Transformation 2:
Before: "Anxiety about where the next client comes from"
After: "A waitlist problem"
Description: "Marketing that runs itself. Leads that qualify themselves.
Average member goes from chasing clients to choosing them in 90 days."

Transformation 3:
Before: "Trying 47 apps and mastering none"
After: "One system that just works"
Description: "We built your AI toolkit so you don't have to. No learning curve.
No tech debt. Just tell us what you need—we make it happen."
```

---

### 5. TARGET AUDIENCE SECTION
**File:** `client/src/pages/Home/TargetAudienceSection.tsx`

#### Current Copy
Three personas: The Solopreneur, The Scaling Startup, The Pivot Artist

#### Analysis
✅ **Strong:** Persona approach is effective
⚠️ **Needs Work:** "Scaling Startup" doesn't feel like your core audience
❌ **Missing:** The "AI-Curious but Lost" persona

#### Recommended Persona Swap

**Replace "The Scaling Startup" with "The AI-Curious":**

```
Title: "The AI-Curious"

Description: "You've heard the hype. You know AI is changing business.
You've maybe even tried ChatGPT a few times. But turning that into actual
business growth? That's where you're stuck. You need a guide, not another app."

We Handle: "Building your AI toolkit, training the systems on YOUR business,
making it all work together seamlessly."

You Focus On: "Your clients. Your craft. Your life."
```

---

### 6. CLUB ADVANTAGE SECTION
**File:** `client/src/pages/Home/ClubAdvantageSection.tsx`

#### Current Copy
- "Your Growth Partner, Not Another Tool"
- "We don't hand you software and disappear. We partner in your success."

#### Analysis
✅ **Strong:** This is the right positioning
⚠️ **Needs Work:** "Club" feel isn't fully realized
❌ **Missing:** Revenue-share model explanation here

#### Recommended Enhancement

**Add a "How the Partnership Works" card:**

```
Title: "Aligned Incentives"

Description: "Traditional software charges you whether you make money or not.
We take a small percentage of revenue we help generate. If you don't grow,
we don't get paid. That's not a pricing model—it's a promise."

Metric: "Zero upfront cost. Zero monthly fees. 100% aligned incentives."
```

**Reframe "Marketing That Actually Works":**

```
CURRENT: "We don't hand you a template and disappear. Your dedicated strategist
writes your campaigns..."

RECOMMENDED: "Forget templates and tutorials. Your dedicated strategist builds
campaigns for your specific business, in your voice, targeting your ideal clients.
You approve. They execute. Revenue grows. Simple."
```

---

### 7. HOW IT WORKS SECTION
**File:** `client/src/pages/Home/HowItWorksSection.tsx`

#### Current Copy
Step 1: Discovery Call → Step 2: Custom Blueprint → Step 3: Launch & Partner

#### Analysis
✅ **Strong:** Three-step process is clear
⚠️ **Needs Work:** Could emphasize the AI simplicity more
⚠️ **Needs Work:** "Launch & Partner" is vague

#### Recommended Rewrites

```
Step 1: "Tell Us What's Broken"
Description: "30-minute call. No sales pitch, just questions about what's eating
your time and what growth looks like for you. We'll tell you honestly if we can help."
Timeline: "Day 1"
Badge: "Free. Judgment-free. Actually useful."

Step 2: "We Build Your AI Toolkit"
Description: "Your strategist designs everything: booking system, website,
marketing automation, follow-up sequences. All powered by AI, all customized
to your business. You approve it before we build it."
Timeline: "Week 1-2"
Badge: "No tech skills required"

Step 3: "Grow Together"
Description: "We launch your systems, optimize your marketing, and handle the
tech stuff forever. You take a small percentage of new revenue. When you grow,
we grow. That's the deal."
Timeline: "Week 2+"
Badge: "True partnership"
```

---

### 8. FAQ SECTION
**File:** `client/src/pages/Home/FAQSection.tsx`

#### Current Copy
Good coverage of revenue-sharing, existing websites, timeline, AI support, cancellation.

#### Analysis
✅ **Strong:** Revenue-sharing explanation is clear
⚠️ **Needs Work:** Could add AI-specific questions

#### Recommended Additions

**Add these FAQs:**

```
Q: "Do I need to understand AI to use this?"

A: "Absolutely not. That's literally why we exist. You tell us your goals in
plain English—we build the AI systems. You'll never need to write a prompt,
configure a workflow, or learn a new platform. Our job is to make AI invisible
to you while its benefits are obvious."
```

```
Q: "What's the difference between MAIS and just subscribing to marketing software?"

A: "Software gives you tools. We give you a partner. Software charges you
monthly whether you're making money or not. We take a percentage of growth
we help create. Software assumes you'll figure it out. We assume you have
better things to do with your time. That's the difference."
```

```
Q: "Is this actually a 'club' or is that just marketing speak?"

A: "It's real. Every member gets access to our monthly workshops, our member
community, and direct access to their strategist. We share what's working
across the club (anonymized, of course). Rising tide lifts all boats."
```

---

### 9. LEAD MAGNET SECTION
**File:** `client/src/pages/Home/LeadMagnetSection.tsx`

#### Current Copy
"The Admin Escape Plan" - 5 Systems Every Small Business Needs

#### Analysis
✅ **Strong:** "Escape Plan" is action-oriented
⚠️ **Needs Work:** Could be more AI-specific to qualify leads

#### Recommended Alternative

```
Badge: "Free AI Playbook"

Heading: "The Non-Technical Guide to AI for Small Business"

Subheading: "5 ways to use AI that don't require a tech degree"

Description: "Discover the exact AI systems our members use to save 15+ hours
a week—explained in plain English. No jargon. No fluff. Just actionable strategies
you can implement this week."
```

---

### 10. FINAL CTA SECTION
**File:** `client/src/pages/Home/FinalCTASection.tsx`

#### Current Copy
"Ready to Stop Doing Everything Yourself?"

#### Analysis
✅ **Strong:** Direct challenge
⚠️ **Needs Work:** Could emphasize the partnership more

#### Recommended Rewrite

```
Heading: "Ready to have a growth partner instead of just growth tools?"

Subheading: "Join 50+ entrepreneurs who've traded tech overwhelm for a team
that actually cares if they succeed. Because we literally don't get paid unless
they do."

CTA: "Become a Member"

Benefit Pills:
- "Free strategy call"
- "No credit card"
- "We only win when you win"
```

---

## Global Recommendations

### 1. Language Shifts Throughout

| **Stop Saying** | **Start Saying** |
|----------------|------------------|
| "Customers" | "Members" |
| "Subscribe" | "Join" |
| "Platform/Software" | "Club/Partnership" |
| "AI-powered" | "Powered by AI you don't have to understand" |
| "Sign up" | "Become a member" |
| "Our solution" | "Our partnership" |
| "Tech stack" | "Your AI toolkit" |
| "Automation" | "Systems that work while you sleep" |

### 2. Add "Plain English AI" Positioning

Weave throughout the page:
- "No tech skills required"
- "Explain what you want in your own words"
- "AI that speaks your language"
- "You don't need to understand how it works—just what you want it to do"

### 3. Strengthen Revenue-Share Messaging

Make these points **earlier** and **more prominent**:
- "We only get paid when you grow"
- "Zero monthly fees"
- "Your success is our business model"
- "If this doesn't work for you, it doesn't work for us"

### 4. Build the "Collective" Feeling

Add these elements:
- Member count that feels like community size, not customer count
- "Club" language consistently
- Hints at member-to-member connections
- Shared learnings across the community
- "What's working for members right now" positioning

### 5. Address the AI-Overwhelmed Directly

Create a dedicated section or weave throughout:
- "You've heard AI is transforming business. You're not sure where to start. That's exactly why we exist."
- "We've already done the AI research. We've tested the tools. We've built the systems. You just tell us what you need."

---

## Tone & Voice Guidelines

### Current Tone
Professional, competent, slightly formal, solution-focused

### Recommended Tone Shifts

**More conversational:**
- Use contractions ("we're" not "we are")
- Shorter sentences
- Questions that feel like real conversation

**More emotionally resonant:**
- Paint vivid "before" pictures
- Use specific scenarios over abstract benefits
- Acknowledge the emotional weight of entrepreneurship

**More partnership-focused:**
- "We" language when talking about working together
- "You" language when talking about their success
- Less "our platform" and more "your growth"

### Voice Examples

**Current Style:**
> "Our AI strategist support includes a dedicated strategist who handles your marketing campaigns, booking setup, website updates, and growth strategy."

**Recommended Style:**
> "Your strategist isn't a chatbot—they're a real person who learns your business, writes your campaigns, and actually cares if they work. Think of them as your marketing department, minus the $80k salary."

---

## Quick Wins (Implement Today)

1. **Hero CTA:** Change "Start a conversation" → "Join the club"

2. **Hero body:** Add "No monthly fees—we only get paid when you grow"

3. **Problem section:** Add the "AI FOMO" card for AI-curious audience

4. **FAQ:** Add the "Do I need to understand AI?" question

5. **Final CTA:** Change benefit pill from "Cancel anytime" → "We only win when you win"

6. **Global:** Replace "customers" with "members" throughout

---

## Priority Implementation Order

### Phase 1: Quick Wins (This Week)
- Hero section rewrites
- Add AI-FOMO problem card
- FAQ additions
- Language swap (customers → members)

### Phase 2: Section Enhancements (Next Week)
- Value section transformation rewrites
- How It Works section rewrites
- Club Advantage revenue-share card

### Phase 3: New Content (Week 3)
- New target persona (The AI-Curious)
- Lead magnet alternative
- Story section AI paragraph addition

---

## Appendix: Breezy AI Patterns to Adopt

From our Breezy AI research, these patterns resonate:

1. **Anthropomorphic AI:** "Your AI team" > "AI-powered platform"
2. **Time anchoring:** "Set up in 10 minutes" reduces overwhelm
3. **Physical metaphors:** "Plugs into" makes integration feel tangible
4. **"Without hiring" framing:** Position AI as cost savings
5. **Outcome verbs:** "Handles," "Manages," "Books" > feature nouns
6. **Breathe easy emotional payoff:** Address stress directly

---

## Appendix: Key Phrases Bank

### For Hero/Headlines
- "You handle the craft. We handle everything else."
- "Your growth partner, not your software vendor."
- "AI-powered growth without the AI headache."
- "We only succeed when you do."
- "The business partner you've always wanted."

### For Body Copy
- "Tell us what you want in plain English—we build it."
- "No coding. No learning curve. No 47-tab tech stack."
- "We take a small cut of revenue we help generate."
- "Your success is literally our business model."
- "Think of us as your behind-the-scenes tech team."

### For CTAs
- "Join the club"
- "Become a member"
- "Let's talk growth"
- "Start the conversation"
- "See if we're a fit"

### For Trust/Risk Reversal
- "Zero monthly fees"
- "We only get paid when you grow"
- "No upfront cost"
- "Free strategy call"
- "No tech skills required"

---

*Report generated by analyzing current MAIS landing page copy against Breezy AI patterns, SMB copywriting best practices, community membership positioning, and revenue-share model messaging frameworks.*

---

## REFINED DIRECTION (November 2025 Session)

### Target Niche Confirmed
**Primary clients:** Horse farm rentals, elopement agencies, wedding photographers, event planners
**Common thread:** High-value service businesses that run on **trust and timing**

### Core Offer Crystallized

MAIS builds and runs a **3-tier online storefront** for service businesses:
- Handles booking and payments end-to-end
- Wraps with AI help for people who know they should be using AI but don't know where to start
- Charges **monthly fee + percentage of sales** through the app
- Positions as "skills of the collective" they're bringing on

### Primary CTA
**"Book a Discovery Call"** - 20 minutes to see if a done-for-you AI storefront makes sense

### Tone Direction
**Punchy and enterprise-grade** - think Donald Miller StoryBrand and "Stories That Stick"

---

## FINAL LANDING PAGE COPY (Ready to Implement)

### HERO

**Headline:**
> AI-powered storefronts for high-value service businesses

**Subheadline:**
> MaconaI Solutions builds and runs a 3-tier online storefront for your services—booking, payments, and AI workflows included—so you sell more experiences without adding more admin.

**Context line:**
> Built for horse farm rentals, elopement agencies, wedding photographers, and event planners.

**Primary CTA:**
> Book a Discovery Call

**CTA supporting line:**
> 20 minutes to see if a done-for-you AI storefront makes sense for your business.

---

### PROBLEM / EMPATHY

**Section title:**
> Your services are premium. Your systems shouldn't feel homemade.

**Body:**
> Your clients are ready to buy. They've found the right venue, date, or package.
> Then things slow down: emails, DMs, questions, invoices, contracts, payment links.
>
> You know AI and automation could streamline this, but you don't have the time—or interest—to become a tech team. Meanwhile, opportunities leak out of your pipeline every week.

**Pain bullets:**
- Bookings scattered across email, Instagram, and text
- Payments delayed by manual back-and-forth
- Clients unsure which option to choose or what happens next

**Close:**
> MaconaI turns that chaos into a clean, trustworthy storefront your clients can actually buy from.

---

### WHAT MACONAI DOES

**Section title:**
> A 3-tier storefront, designed for how people actually buy services

**Intro:**
> We design and operate a custom storefront for your business so clients can choose, book, and pay in one place—without you chasing them.

**The three tiers:**

**Tier 1 – Entry Offer**
> A low-friction way for new clients to start working with you, without a big commitment.

**Tier 2 – Core Package**
> Your primary revenue driver, clearly framed so clients instantly understand what's included and why it's the obvious choice.

**Tier 3 – Premium Experience**
> A high-touch, high-ticket offer positioned for clients who want the full, elevated experience.

**Supporting line:**
> Each tier is backed by clear copy, smart intake forms, and automated follow-ups so fewer interested clients fall through the cracks.

---

### THE PSYCHOLOGY BEHIND THE 3-TIER STOREFRONT

**Section title:**
> Why three tiers work better than "DM me for pricing"

**Body:**
> People don't like guessing. They want to feel in control, informed, and confident they're choosing the right level of service. A 3-tier storefront taps into that:

**Clear choices reduce decision friction.**
> With three well-defined options, clients can quickly see "which one is me" instead of feeling overwhelmed or confused.

**A "middle" option anchors value.**
> Most clients gravitate to the clearly positioned core package. The entry tier lowers the barrier to start; the premium tier signals what "top-shelf" looks like and makes your core offer feel like a smart, safe decision.

**Transparency builds trust.**
> Clear pricing, inclusions, and next steps reduce the anxiety that often stalls bookings—especially for high-emotion events like weddings or once-in-a-lifetime experiences.

**Authority close:**
> At MaconaI, we've done the research, tested the flows, and refined the wording. You're not starting from a blank page or guessing at what might work. You're plugging into a proven storefront pattern tuned for service businesses that sell trust, timing, and experience.

---

### AI + "SKILLS OF THE COLLECTIVE"

**Section title:**
> You're not buying software. You're gaining a collective.

**Body:**
> When you join MaconaI Solutions, you're bringing on the skills of the collective—product, UX, and AI specialists who treat your booking flow like a revenue engine.

**Behind the scenes, we use AI to:**
- Qualify inquiries and collect key details before you ever get on a call
- Answer common questions so you're not repeating yourself
- Trigger reminders and follow-ups so clients don't drift between "interested" and "paid"

**Close:**
> You stay focused on delivering unforgettable experiences. We handle the invisible infrastructure.

---

### PARTNERSHIP MODEL

**Section title:**
> A simple partnership that scales with your bookings

**Body:**
> MaconaI works like a growth partner, not just another SaaS tool.

- A predictable monthly fee for hosting, maintenance, and ongoing optimization
- A percentage of sales that go through your storefront

**Close:**
> If your storefront isn't producing, we feel it too. Our incentives are aligned with your growth.

---

### FUTURE-STATE STORY (StoryBrand Style)

**Section title:**
> From inquiry to paid booking—without the chase

**Narrative:**
> A couple finds your elopement services. They land on a page with three clear options. They choose a package, see available dates, answer a few guided questions, sign the agreement, and pay a deposit—without a single email thread.
>
> You wake up to a notification: "New booking confirmed." Your calendar is fuller. Your inbox is quieter.

---

### FINAL CTA

**Headline:**
> Ready for a storefront that sells while you serve?

**Copy:**
> If you're a service business owner who's serious about growth but done with duct-taped systems, MaconaI can help.

**Button:**
> Book a Discovery Call

---

## KEY LESSONS FROM THIS SESSION

### 1. Separate Today's Value from Tomorrow's Vision
- **Today (concrete):** Package catalog, photos, booking, payments, availability, admin dashboard
- **Future (hint):** Agents proposing changes, automated promotions, config versioning
- On landing page: "What you get on day one" vs. "Where this is going"

### 2. Make Internal Language External
| Internal (Builder) | External (Customer) |
|--------------------|---------------------|
| Multi-tenant modular monolith | Your online storefront |
| Config-driven | Customized for your business |
| Agent-powered platform | AI that works behind the scenes |
| Repository pattern | Reliable, tested systems |

### 3. The 3-Tier Psychology is a Selling Point
Don't just show three tiers—**explain why** they work:
- Reduces decision friction
- Anchors value with middle option
- Builds trust through transparency
- **Position MAIS as the expert:** "We've done the research"

### 4. "Skills of the Collective" Needs Concrete Outcomes
Abstract: "You're partnering with a collective"
Concrete: "Product, UX, and AI specialists who treat your booking flow like a revenue engine"

### 5. Revenue-Share Model is a Trust Signal
Frame it as **alignment**, not pricing complexity:
- "If your storefront isn't producing, we feel it too"
- "Our incentives are aligned with your growth"
- "We only win when you win"

### 6. The "Future State Story" Sells Better Than Features
Instead of listing features, paint the transformation:
> "You wake up to a notification: 'New booking confirmed.' Your calendar is fuller. Your inbox is quieter."

### 7. Address the AI-Curious Directly
These people know AI is important but are paralyzed:
- Don't assume they want AI
- Don't explain how AI works
- Show outcomes: "Qualify inquiries before you get on a call"

---

## COPY PRINCIPLES ESTABLISHED

### The "Enterprise-Grade But Human" Balance
- **Enterprise:** Professional, authoritative, trustworthy
- **Human:** Warm, conversational, relatable
- **How:** Short sentences. Specific outcomes. Real scenarios.

### Pain Points for This Niche
1. Bookings scattered across channels (email, IG, text)
2. Payments delayed by manual back-and-forth
3. Clients confused about options and next steps
4. AI overwhelm ("I should use it but where do I start?")
5. Systems feel "homemade" despite premium services

### Value Hierarchy
1. **Primary:** Time back + more bookings (outcomes)
2. **Secondary:** AI without the learning curve (enabler)
3. **Tertiary:** Partnership model (trust signal)

### CTA Progression
- **Hero:** "Book a Discovery Call" (commitment)
- **Mid-page:** "See how it works" (education)
- **Final:** "Book a Discovery Call" (repeat commitment)

---

## NEXT STEPS

1. **Implement hero section** with finalized copy
2. **Build "Psychology of 3-Tier" section** - this is a differentiator
3. **Create future-state story section** - StoryBrand style
4. **Update problem section** with niche-specific pains
5. **Add AI collective section** with concrete outcomes
6. **Test CTA variations:** "Book a Discovery Call" vs "See If We're a Fit"
