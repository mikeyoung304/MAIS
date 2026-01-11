# HANDLED Brand Voice & Design Guide

> The definitive guide for maintaining Apple-quality copy and design across all HANDLED surfaces.

---

## Brand Positioning

**Who we serve:** Service professionals—photographers, coaches, therapists, wedding planners, consultants—who are excellent at their work but exhausted by the tech treadmill.

**What we do:** Done-for-you tech (website, booking, payments, AI chatbot) plus done-with-you education (monthly newsletter, monthly Zoom calls).

**How we sound:** Cheeky but professional, self-aware, anti-hype. Warm and human, not cold and corporate.

**Tagline:** "The rest is Handled."

**Hero Pattern:** "You're a [profession], so [verb]." — Identity-first marketing that makes visitors feel seen.

---

## Voice Principles

### 1. Be Self-Aware About AI

We're an AI company. We own it. But we're not obnoxious about it.

```
❌ "Revolutionary AI-powered business transformation platform"
✅ "Yes, it's .ai. The robots do the boring parts."

❌ "Leverage cutting-edge artificial intelligence to optimize your workflow"
✅ "A chatbot trained on your business. Works while you sleep."
```

### 2. Speak to Badass Professionals, Not Beginners

Our audience is excellent at their job. They just don't want to also be IT.

```
❌ "We make tech simple for anyone, even if you're scared of computers!"
✅ "You didn't start your business to debug a website."

❌ "Don't worry, we'll hold your hand through every step!"
✅ "We handle the tech. You stay focused on what you're actually good at."
```

### 3. Anti-Hype, Pro-Shortcut

We cut through the noise. We're the shortcut, not another thing to learn.

```
❌ "This game-changing solution will revolutionize your business!"
✅ "Here's what actually matters this month. Nothing else."

❌ "Join our transformative community experience!"
✅ "Real talk with other pros about what's working. No pitch."
```

### 4. Honest About the Problem

The tech IS moving fast. It IS overwhelming. Don't pretend otherwise.

```
❌ "Managing your business has never been easier!"
✅ "The tech keeps changing. Every week there's something new you 'should' be learning. It's exhausting."

❌ "Seamlessly integrated solutions"
✅ "We watch the tech so you don't have to."
```

### 5. Cheeky, Not Corny

Playful humor that respects intelligence. Never dad jokes, never corporate.

```
❌ "We're like a tech team, but fun! 🎉"
✅ "Done-for-you tech. Done-with-you education. For people who have better things to do."

❌ "Your success is our passion!"
✅ "We earn your business every month."
```

---

## Agent Voice (AI Assistant)

The HANDLED AI assistant is a hip, busy millennial who's competent and knows it. Here to support, not hand-hold. Gets shit done.

### Personality

- **Terse.** 1-2 sentences max unless delivering content.
- **Binary choices.** "Brain dump or I ask questions?"
- **Don't explain.** Just do it, report the result.
- **A little snarky.** When they push back: "ok fine, what do I know. we can always circle back."

### Confirmation Vocabulary

| Use      | Instead of                          |
| -------- | ----------------------------------- |
| bet      | Yes, I will do that for you!        |
| done     | I've completed that task!           |
| got it   | I understand what you're saying     |
| on it    | I'll get started on that right away |
| heard    | I acknowledge your feedback         |
| say less | I understand completely             |

### Never Say

- "Great!"
- "Absolutely!"
- "I'd be happy to help with that!"
- "Let me explain how this works..."
- "I'll now proceed to..."
- Any sentence starting with "Great!" or "Absolutely!"

### Question Style

```
❌ "Would you like me to help you craft your about section? I can either
    ask you some questions to draw out the key details, or you can share
    information and I'll help shape it into compelling copy."

✅ "About section. Brain dump or I ask questions?"
```

### Flow Examples

**When they give content:**

```
User: Here's my about - I'm a wedding photographer in Austin, been doing it 8 years...
Agent: got it. writing.
[tool call]
Agent: done. [highlight about-text-main] check it. tweaks or next section?
```

**When they're stuck:**

```
User: I don't know what to write for my headline
Agent: who's your ideal client?
User: Couples who want authentic photos, not posed stuff
Agent: got it. writing.
[tool call]
Agent: done. "Your love story, unscripted." [highlight home-hero-main] work for you?
```

**When they push back:**

```
User: I only want 2 packages, not 3
Agent: ok fine, what do I know. we can always circle back. what's package 1?
```

### Priority Order

The agent guides users through setup in this order:

1. **Website** — Hero, About, FAQ, Contact sections
2. **Services** — Packages with 3-tier pricing (push for best practice)
3. **Stripe** — Last step before going live (easy wins first)

### Best Practice Nudges

The agent should push for best practices but let the user overrule:

- "Best to knock out all sections now. But you're the boss."
- Push for 3 tiers: "Three tiers works best. Good, better, best."
- If they skip: "heard. we can circle back."

---

## Copy Patterns

### Headlines

- **Serif font** (`font-serif`) for warmth
- **Identity-first** — lead with who they are, not what we do
- **Period at the end** for confidence
- **"The rest is Handled"** as the payoff line

```tsx
// Hero pattern (scrolling identity)
<h1 className="font-serif">
  You're a <ScrollingIdentity />
</h1>
<p className="font-serif text-sage">
  The rest is handled.
</p>

// Section headlines
<h2 className="font-serif">
  What you get. What you skip.
</h2>

// Avoid
<h1>Transform Your Business With Revolutionary AI Solutions!</h1>
```

### Subheadlines

- **Lighter weight** (`font-light`)
- **Conversational** but not casual
- **One clear idea** per subheadline

```tsx
// Good
<p className="text-xl font-light text-text-muted">
  Done-for-you websites, booking, and AI — plus monthly updates on what's
  actually worth knowing.
</p>

// Avoid
<p>
  HANDLED is the comprehensive all-in-one platform designed specifically for
  service professionals who want to leverage AI while focusing on what they love.
</p>
```

### CTAs

- **Action-oriented** but not pushy
- **On-brand phrasing**

```
Primary: "Get Handled"
Secondary: "See How It Works"
Pricing: "Get Started" / "Join Now" / "Book a Call"
Success: "You're in. We'll be in touch."
```

### Microcopy

- **Minimal** - only when necessary
- **Helpful** - guides without condescending

```
Form placeholder: "Your email"
Error: "Please enter a valid email"
Loading: [spinner only, no text]
Cancel note: "No contracts. Cancel anytime."
```

---

## Words to Use

| Use                  | Instead of                      |
| -------------------- | ------------------------------- |
| service pros         | small businesses, entrepreneurs |
| handle / handled     | manage, streamline, optimize    |
| clients              | customers, users                |
| what's worth knowing | insights, learnings             |
| actually             | seamlessly, effortlessly        |
| no pitch             | no obligation, risk-free        |

## Words to Avoid

- Revolutionary, game-changing, cutting-edge, disruptive
- Solutions, synergy, leverage, optimize
- Easy, simple (feels condescending)
- Amazing, incredible, awesome (hype)
- Just, really, very, quite (qualifiers)
- Overwhelmed, struggling, stressed (don't punch down)

---

## Design System

### Spacing Philosophy

**Generous whitespace signals quality.** When in doubt, add more space.

```tsx
// Section padding
<section className="py-32 md:py-40">  // Standard
<section className="py-32 md:py-48">  // Emphasis (CTA sections)

// Content max-widths
<div className="max-w-2xl">   // Tight (forms, focused content)
<div className="max-w-3xl">   // Standard (body copy)
<div className="max-w-5xl">   // Wide (card grids)
```

### Color Usage

**Graphite Dark Theme with Electric Sage** _(Updated 2025-12-28)_

Bold, modern, tech-confident. Dark graphite backgrounds with Electric Sage accent creates a Linear/Vercel-inspired aesthetic that aligns with our punchy, self-aware copy voice. The sage pops dramatically on dark.

```tsx
// Backgrounds (Graphite Dark)
surface: '#18181B'       // Dark graphite (page background)
surface-alt: '#27272A'   // Lighter graphite (cards, sections)

// Primary colors (Electric Sage on dark)
sage: '#45B37F'          // Primary brand color - pops on dark
sage-hover: '#5CC98F'    // Lighter on hover for dark mode
sage-light: '#6BC495'    // Decorative
sage-text: '#45B37F'     // Readable on dark backgrounds

// Text (for dark mode)
text-primary: '#FAFAFA'  // Near-white
text-muted: '#A1A1AA'    // Muted gray

// Border colors (dark mode)
border: '#3F3F46'        // Neutral 700 equivalent
border-light: '#52525B'  // Neutral 600 equivalent

// Usage ratios
85% dark neutrals (graphite, dark gray)
15% Electric Sage (CTAs, icons, accents)

// WCAG Accessibility Notes
// - #45B37F on #18181B = 6.5:1 (excellent contrast, OK for all text)
// - #FAFAFA on #18181B = 17.4:1 (excellent contrast)
// - Dark mode is inherently high-contrast and accessible
```

**Color Application:**

```tsx
// Buttons
variant = 'sage'; // Primary CTAs
variant = 'outline'; // Secondary actions

// Icons & accents
bg - sage / 10; // Icon backgrounds
text - sage; // Accent text, checkmarks

// Section backgrounds
bg - surface; // Default
bg - neutral - 50; // Alternating sections
bg - sage; // Final CTA section
bg - text - primary; // Footer
```

### Typography Scale

```tsx
// Headlines (serif)
text-5xl sm:text-6xl md:text-7xl lg:text-8xl  // Hero
text-4xl sm:text-5xl md:text-6xl              // Section headlines
text-3xl sm:text-4xl md:text-5xl              // Secondary headlines

// Body (sans-serif)
text-xl md:text-2xl lg:text-3xl   // Large body (subheadlines)
text-xl md:text-2xl               // Standard body
text-lg                           // Small body
text-sm                           // Microcopy, labels
```

### Border Radius

```tsx
rounded-full   // Buttons, inputs, avatars
rounded-3xl    // Cards, sections
rounded-2xl    // Secondary cards
rounded-xl     // Small elements
```

### Shadows & Elevation

```tsx
// Cards at rest
shadow-lg border border-neutral-100

// Cards on hover
hover:shadow-xl hover:-translate-y-1

// Emphasized elements
shadow-2xl ring-2 ring-sage/20

// Ambient effects
bg-sage/15 blur-2xl  // Glow behind emphasized cards
bg-sage/8 blur-3xl   // Background ambient shapes
```

### Transitions

```tsx
// Standard
transition-all duration-300

// Buttons
transition-all duration-300 ease-out

// Subtle (focus states)
transition-all duration-200
```

---

## Component Patterns

### Section Structure

```tsx
<section className="py-32 md:py-40 bg-white">
  <Container>
    {/* Header - always centered */}
    <div className="max-w-3xl mx-auto text-center mb-16">
      <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary mb-8 leading-[1.1] tracking-tight">
        Headline here.
      </h2>
      <p className="text-xl md:text-2xl text-text-muted font-light leading-relaxed">
        Supporting copy that expands on the headline.
      </p>
    </div>

    {/* Content */}
    <div className="max-w-5xl mx-auto">{/* Cards, features, etc. */}</div>
  </Container>
</section>
```

### Card Pattern

```tsx
<div
  className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100
                transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
>
  {/* Content */}
</div>
```

### Button Pattern

```tsx
// Primary (sage)
<Button variant="sage" className="rounded-full px-10 py-6 text-lg">
  Get Handled
</Button>

// Secondary (outline)
<Button variant="outline" className="rounded-full px-10 py-6 text-lg
                                      hover:bg-neutral-50">
  See What's Included
</Button>

// On dark background (sage CTA section)
<Button className="bg-white text-sage hover:bg-neutral-100
                   rounded-full px-10 py-6 text-lg shadow-lg">
  Get Handled
</Button>
```

### Form Input Pattern

```tsx
<input
  className="px-6 py-4 border-2 border-neutral-200 rounded-full text-lg bg-white
             transition-all duration-200
             focus:border-sage focus:ring-4 focus:ring-sage/10 focus:outline-none
             hover:border-neutral-300"
/>
```

---

## Page Templates

### Landing Page Structure

```
1. Hero (pt-32 pb-20 md:pt-40 md:pb-32)
   - Headline: "You're a [scrolling identity], so [verb]."
   - Tagline: "The rest is handled." (in sage green)
   - Subheadline: Fragment-style value prop
   - Primary CTA: "Get Handled" (sage)
   - Secondary CTA: "See What's Included" (outline)

2. Problem (py-32 md:py-40, bg-white)
   - Headline: "You didn't start your business to debug a website."
   - Body: Identity statements + honest problem description
   - Close: Validation without pity

3. Features (py-32 md:py-40, bg-surface)
   - Headline: "What you get. What you skip."
   - Subheadline: One sentence value prop (font-light)
   - 6 feature cards with sage icons, shadow-lg

4. Pricing (py-32 md:py-40, bg-neutral-50)
   - Headline: "Pick a plan. Skip the tech anxiety."
   - Three tiers: Handled / Fully Handled / Completely Handled
   - Most Popular tag in sage

5. FAQ (py-32 md:py-40, bg-surface)
   - Headline: "Questions? Answers."
   - Accordion with honest, conversational answers (rounded-3xl)

6. Final CTA (py-32 md:py-48, bg-sage)
   - Headline: "Your clients hired you for your expertise."
   - Subline: "Not your ability to configure a payment processor."
   - CTA: "Get Handled" (white button)

7. Footer (py-12, bg-text-primary)
   - Logo, nav links, copyright
```

---

## Product Experience Patterns

These patterns guide how we design the product mockups shown on our marketing site—the demo storefront, booking flow, and post-booking experience.

### Demo Storefront Design

**Philosophy:** Show a realistic, aspirational example that makes prospects think "I want that for my business."

**The Alex Chen Pattern:**
Our demo uses a college STEM tutor persona. This works because:

- **Relatable:** Anyone can understand tutoring
- **Professional but accessible:** Not too corporate, not too casual
- **Clear value props:** Grades, sessions, outcomes are easy to grasp

```tsx
// Demo tenant structure
const demoTenant = {
  name: 'Alex Chen',
  tagline: 'STEM Tutoring',
  subject: 'Math & Physics',
  initials: 'AC', // Professional initials avatar, not emoji
};
```

**Social Proof Bar:** Always include realistic stats (4.9 rating, 200+ students, 5 yrs experience) to build credibility.

### Psychology-Optimized Pricing Display

**Three-Tier Structure (Research-Backed):**

- 41.4% of successful startups use exactly three tiers
- Three-tier approach yields 25-40% higher average purchase values
- 70% of buyers choose the middle option when properly positioned

**Tier Design Principles:**

| Position             | Role                              | Styling                                                |
| -------------------- | --------------------------------- | ------------------------------------------------------ |
| **Tier 1 (Basic)**   | Entry point, sets low anchor      | Standard card, no emphasis                             |
| **Tier 2 (Middle)**  | Target option, decoy effect       | Elevated, "Most Popular" badge, sage border, scale-105 |
| **Tier 3 (Premium)** | High anchor, sets reference point | Premium features, but visually secondary to middle     |

**Naming Convention:** Use outcome-focused names, not feature-focused:

```
❌ "Basic", "Standard", "Premium"
✅ "Quick Help", "Grade Boost", "Semester Success"
```

**Price Display Pattern:**

```tsx
// Show per-unit value on bulk tiers
<div className="flex items-baseline gap-0.5">
  <span className="font-bold text-lg">{tier.priceDisplay}</span>
  <span className="text-[10px] text-text-muted">{tier.priceSubtext}</span>
</div>;
{
  tier.perSession && (
    <div className="flex items-center gap-1 mt-0.5">
      <span className="text-[9px] text-text-muted">{tier.perSession}</span>
      <span className="text-[8px] font-semibold text-sage bg-sage/15 px-1 py-0.5 rounded">
        {tier.savings}
      </span>
    </div>
  );
}
```

### Booking Flow Design

**Philosophy:** Keep it simple, focused, and reassuring. The booking flow should feel like a conversation, not a form.

**Key Elements:**

1. **Progress indicator** - Simple step dots, not overwhelming stepper
2. **Session summary** - Always visible, confirms what they're booking
3. **Clear pricing** - No surprises, show total upfront
4. **Trust signals** - "Cancel anytime", "Secure payments"

```tsx
// Booking mockup structure
<div className="h-full bg-surface flex flex-col">
  {/* Header with provider info + step indicator */}
  {/* Main content: form fields or calendar */}
  {/* Footer: summary + CTA */}
</div>
```

### Post-Booking Experience (Session Workspace)

**Philosophy:** The post-booking page is NOT a receipt—it's where the client relationship lives.

**The Three Jobs of Post-Booking:**

| Job            | Purpose                 | Implementation                                                       |
| -------------- | ----------------------- | -------------------------------------------------------------------- |
| **Reassure**   | "What's coming up"      | Confirmed badge, session details card, clear next steps              |
| **Coordinate** | "Things to do"          | Action checklist with visual progress (upload docs, confirm details) |
| **Converse**   | "I can talk to someone" | Always-visible chat panel, NOT buried in footer                      |

**Layout Pattern: Two-Column Workspace**

```tsx
<div className="flex-1 flex overflow-hidden">
  {/* Left column (55%): What's happening + Things to do */}
  <div className="flex-1 px-3 py-2.5 bg-surface-alt border-r border-neutral-800">
    {/* "What's Coming Up" card */}
    {/* "Things to Do" checklist */}
  </div>

  {/* Right column (45%): Your Assistant - ELEVATED, not buried */}
  <div className="w-[45%] flex flex-col bg-surface">
    {/* Assistant header with "Online" indicator */}
    {/* Chat preview with welcome message */}
    {/* Quick action suggestions */}
    {/* Always-visible input field */}
  </div>
</div>
```

**Key Design Decisions:**

- **"Your Session Space"** framing (not "Booking Confirmation")
- **Assistant takes 45% width** - signals it's a primary interface, not an afterthought
- **"Online" indicator** - shows the chatbot is ready and available
- **Proactive welcome message** - "Hi! I'm here to help with your Grade Boost session"
- **Quick suggestions** - "What should I bring?", "Reschedule", "Ask a question"

**Anti-Patterns to Avoid:**

```
❌ Receipt-style layout ("Thank you for your booking!")
❌ Assistant buried in footer or behind a chat icon
❌ Static information dump with no next actions
❌ Dashboard-y feel with too many cards and metrics
```

### Mockup Dark Theme Consistency

All product mockups use our graphite dark theme for consistency:

```tsx
// Backgrounds
bg - surface; // #18181B - main background
bg - surface - alt; // #27272A - cards, alternating sections

// Borders
border - neutral - 800; // Standard dividers
border - sage / 30; // Emphasis borders (popular tier)

// Text
text - text - primary; // #FAFAFA - headings, primary content
text - text - muted; // #A1A1AA - secondary content, descriptions

// Accents (use sparingly)
text - sage; // #45B37F - icons, badges, links
bg - sage / 15; // Badge backgrounds
bg - sage / 20; // Icon backgrounds with border-sage/30
```

**Radial Gradient Pattern:** Use for subtle hero emphasis

```tsx
bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.12)_0%,transparent_70%)]
```

---

## Review Checklist

Before shipping any new page or component:

### Copy

- [ ] Headlines are punchy with periods (not exclamation marks)
- [ ] No hype words (revolutionary, game-changing, etc.)
- [ ] No qualifiers (really, very, just)
- [ ] Speaks to competent pros, not beginners
- [ ] Honest about the problem
- [ ] Cheeky where appropriate

### Design

- [ ] Section spacing is py-32 md:py-40 minimum
- [ ] Max-width constraints applied to all content
- [ ] Sage used for CTAs and icons (15% of page)
- [ ] Cards use rounded-3xl with shadow-lg
- [ ] Buttons use rounded-full with variant="sage"
- [ ] Hover states include translate-y and shadow change
- [ ] Surface colors are warm (#FFFBF8)

### Accessibility

- [ ] All sections have aria-labelledby
- [ ] Form inputs have aria-label
- [ ] Focus states are visible (ring-4)
- [ ] Color contrast meets WCAG AA

### Product Mockups

- [ ] Uses graphite dark theme (`bg-surface`, `bg-surface-alt`)
- [ ] Alex Chen persona consistency (initials "AC", STEM Tutoring tagline)
- [ ] Pricing tiers use outcome-focused names (not Basic/Standard/Premium)
- [ ] Middle tier is visually elevated (scale-105, sage border, "Popular" badge)
- [ ] Post-booking shows "Session Space" framing (not receipt/confirmation)
- [ ] Assistant panel is prominent (45% width), not buried
- [ ] Three jobs present: Reassure, Coordinate, Converse
- [ ] Social proof stats included (rating, students helped, experience)

---

## Examples from HANDLED Landing Page

### Hero (Scrolling Identity Pattern)

```
You're a photographer, so capture moments.
You're a therapist, so hold space.
You're a coach, so unlock potential.

The rest is handled.
```

_Why it works: Identity-first, makes them feel SEEN, "so [verb]" gives permission to focus on their craft_

### Subheadline

```
Websites. Booking. Payments. AI.
Plus a monthly filter for what's actually worth knowing.
For people with better things to do.
```

_Why it works: Fragment structure mirrors punchy voice, ends with identity-based hook_

### Features Section

```
What you get. What you skip.

One membership. Website, booking, payments, AI assistant.
We set it up. You show up for clients.
```

_Why it works: Contrast structure, action-oriented, ends with what they care about (clients)_

### Final CTA

```
Your clients hired you for your expertise.
Not your ability to configure a payment processor.
```

_Why it works: Specific pain point (payment processor config is viscerally annoying), validates their expertise_

---

## Maintaining This Standard

1. **Reference this guide** before writing any customer-facing copy
2. **Reference HANDLED_BRAND_POSITIONING.md** for strategic context
3. **Review against checklist** before merging UI changes
4. **When in doubt, remove** - Apple's mantra applies here
5. **Show, don't tell** - if you have to explain quality, you've lost

---

_Last updated: December 30, 2025_
_Brand: HANDLED (gethandled.ai)_
_Added: Product Experience Patterns (demo storefront, psychology-optimized pricing, session workspace)_
