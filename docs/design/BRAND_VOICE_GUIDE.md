# HANDLED Brand Voice & Design Guide

> The definitive guide for maintaining Apple-quality copy and design across all HANDLED surfaces.

---

## Brand Positioning

**Who we serve:** Service professionals—photographers, coaches, therapists, wedding planners, consultants—who are curious about AI but don't have time to become tech experts.

**What we do:** Done-for-you tech (website, booking, payments, AI chatbot) plus done-with-you education (monthly newsletter, monthly Zoom calls).

**How we sound:** Cheeky but professional, self-aware, anti-hype. Like the calm friend who's already figured this out.

**Tagline:** "Stay ahead without the overwhelm."

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
- **Punchy and honest** — state reality, not aspirations
- **Period at the end** for confidence
- **Line breaks** for rhythm

```tsx
// Good
<h1 className="font-serif">
  The tech is moving fast.
  <br />
  You don't have to.
</h1>

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

**80% neutral, 20% accent.** Sage is precious—use sparingly.

```tsx
// Backgrounds (in order of usage)
bg - white; // Primary
bg - neutral - 50; // Alternating sections
bg - sage; // CTA sections only

// Text
text - text - primary; // Headlines, important text
text - text - muted; // Body copy
text - sage; // Accents, links
text - white; // On dark backgrounds

// Accents
bg - sage / 10; // Subtle backgrounds
ring - sage / 20; // Focus states
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
// Primary
<Button className="bg-sage hover:bg-sage-hover text-white font-semibold
                   px-10 py-4 h-14 rounded-full
                   transition-all duration-300 ease-out
                   hover:shadow-xl hover:-translate-y-0.5">
  Get Handled
</Button>

// Secondary (on dark background)
<Button className="bg-white hover:bg-white/95 text-sage font-semibold
                   px-10 py-4 h-14 rounded-full
                   transition-all duration-300 ease-out
                   hover:shadow-xl hover:-translate-y-0.5">
  See How It Works
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
1. Hero (min-h-screen)
   - Headline: "The tech is moving fast. You don't have to."
   - Subheadline: Value prop + audience
   - Primary CTA: "Get Handled"
   - Secondary CTA: "See How It Works"

2. Problem (py-32 md:py-40, bg-neutral-50)
   - Headline: Identity statement
   - Body: Honest description of the overwhelm
   - Close: Emotional validation

3. Solution (py-32 md:py-40, bg-white)
   - Headline: "We handle the tech. We keep you current. You stay focused."
   - Features grid with icons
   - Both done-for-you AND done-with-you

4. Pricing (py-32 md:py-40, bg-neutral-50)
   - Headline: "Pick your level of handled."
   - Three tiers: Handled / Fully Handled / Completely Handled

5. FAQ (py-32 md:py-40, bg-white)
   - Common questions
   - Honest, conversational answers

6. Final CTA (py-32 md:py-48, bg-sage)
   - Headline: "Ready to stop being your own IT department?"
   - Subline: Aspirational + specific
   - CTA: "Get Handled"
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
- [ ] Sage used as accent only (not primary background except CTA)
- [ ] Cards use rounded-3xl with shadow-lg
- [ ] Buttons use rounded-full
- [ ] Hover states include translate-y and shadow change
- [ ] No more than 2 ambient blur elements per section

### Accessibility

- [ ] All sections have aria-labelledby
- [ ] Form inputs have aria-label
- [ ] Focus states are visible (ring-4)
- [ ] Color contrast meets WCAG AA

---

## Examples from HANDLED Landing Page

### Hero Headline

```
The tech is moving fast.
You don't have to.
```

_Why it works: Acknowledges reality, promises relief, no hype_

### Problem Section

```
You didn't start your business to debug a website.

You became a photographer because you see the world differently.
A therapist because you help people heal. A coach because you unlock potential.

The tech keeps changing. Every week there's something new you 'should' be learning.
It's exhausting.
```

_Why it works: Identity-first, honest about the problem, validates without pitying_

### Solution Section

```
We handle the tech. We keep you current. You stay focused.

A membership that combines done-for-you tech with done-with-you education.
```

_Why it works: Clear value prop, both sides of the offering, no jargon_

### CTA

```
Ready to stop being your own IT department?
```

_Why it works: Cheeky callback to the problem, question format creates momentum_

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
