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

| Use                    | Instead of                      |
| ---------------------- | ------------------------------- |
| service pros           | small businesses, entrepreneurs |
| handle / handled       | manage, streamline, optimize    |
| clients                | customers, users                |
| what's worth knowing   | insights, learnings             |
| actually               | seamlessly, effortlessly        |
| no pitch               | no obligation, risk-free        |

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

**Sage Primary Palette**

The sage green evokes calm professionalism and natural warmth—differentiating us from cold tech blues while signaling trust and growth.

```tsx
// Primary colors
sage: '#7B9E87'          // Primary brand color (CTAs, icons, accents)
sage-hover: '#6B8E77'    // Hover state

// Backgrounds
surface: '#FFFBF8'       // Warm cream (page background)
white                    // Cards, clean areas

// Text
text-primary: '#1A1815'  // Near-black
text-muted: '#4A4440'    // Warm gray (body copy)

// Usage ratios
85% neutral (cream, white, warm grays)
15% color (sage for CTAs/icons/accents)
```

**Color Application:**

```tsx
// Buttons
variant="sage"           // Primary CTAs
variant="outline"        // Secondary actions

// Icons & accents
bg-sage/10               // Icon backgrounds
text-sage                // Accent text, checkmarks

// Section backgrounds
bg-surface               // Default
bg-neutral-50            // Alternating sections
bg-sage                  // Final CTA section
bg-text-primary          // Footer
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

_Last updated: December 2025_
_Brand: HANDLED (gethandled.ai)_
