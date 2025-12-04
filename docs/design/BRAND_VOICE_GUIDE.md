# MaconAI Brand Voice & Design Guide

> The definitive guide for maintaining Apple-quality copy and design across all MaconAI surfaces.

---

## Brand Positioning

**Who we serve:** Creative professionals—photographers, wedding planners, event coordinators, artists—who'd rather be creating than administrating.

**What we do:** Handle the business side (bookings, payments, follow-ups) so they can focus on their craft.

**How we sound:** Confident, warm, respectful. Like a trusted colleague who happens to be really good at systems.

---

## Voice Principles

### 1. Lead with Transformation, Not Features

```
❌ "Our platform offers automated invoice generation and calendar sync"
✅ "You get a text when someone books. That's it."

❌ "3-tier pricing system with customizable packages"
✅ "Your packages. Your pricing. Clients book and pay instantly."
```

### 2. Speak to Identity, Not Pain

```
❌ "Tired of chasing payments?"
✅ "You're a photographer, not a bookkeeper."

❌ "Stop wasting time on admin"
✅ "Every hour on admin is an hour you're not behind the lens."
```

### 3. Be Specific, Not Generic

```
❌ "Handle client communications"
✅ "Instagram DM to final gallery delivery"

❌ "Manage your schedule"
✅ "Calendar Tetris. Deposit tracking."
```

### 4. Confidence Without Arrogance

```
❌ "The best booking platform ever built"
✅ "One link. Complete booking system."

❌ "Revolutionary AI-powered automation"
✅ "We handle the emails, invoices, and follow-ups."
```

### 5. Respect Their Intelligence

```
❌ "Easy-to-use interface anyone can understand!"
✅ [Just show it working]

❌ "Don't worry, it's simple!"
✅ "Clients pick. Book. Pay. Done."
```

---

## Copy Patterns

### Headlines

- **Serif font** (`font-serif`) for warmth
- **Short, punchy** (3-6 words ideal)
- **Period at the end** for confidence
- **Line breaks** for rhythm

```tsx
// Good
<h1 className="font-serif">
  Book more clients.
  <br />
  Build your business.
</h1>

// Avoid
<h1>Book More Clients And Build Your Business Today!</h1>
```

### Subheadlines

- **Lighter weight** (`font-light`)
- **Conversational** but not casual
- **One clear idea** per subheadline

```tsx
// Good
<p className="text-xl font-light text-text-muted">
  The booking platform for creative professionals who'd rather be creating.
</p>

// Avoid
<p>
  MaconAI is the all-in-one booking platform designed specifically
  for creative professionals who want to spend less time on admin
  and more time doing what they love.
</p>
```

### CTAs

- **Action-oriented** but not pushy
- **Consistent phrasing** across the site

```
Primary: "Request Early Access"
Secondary: "Learn More"
Success: "Welcome. We'll be in touch soon."
```

### Microcopy

- **Minimal** - only when necessary
- **Helpful** - guides without condescending

```
Form placeholder: "Your email"
Error: "Please enter a valid email"
Loading: [spinner only, no text]
```

---

## Words to Use

| Use                    | Instead of                      |
| ---------------------- | ------------------------------- |
| book                   | schedule, reserve               |
| clients                | customers, users                |
| craft                  | work, job, services             |
| creative professionals | small businesses, entrepreneurs |
| platform               | software, tool, solution        |
| instantly              | automatically, seamlessly       |

## Words to Avoid

- Revolutionary, game-changing, cutting-edge
- Easy, simple, effortless (show, don't tell)
- Just, really, very, quite (qualifiers)
- Leverage, utilize, optimize (corporate speak)
- Amazing, incredible, awesome (hype)

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

// Emphasized elements (Core tier)
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
  Request Early Access
</Button>

// Secondary (on dark background)
<Button className="bg-white hover:bg-white/95 text-sage font-semibold
                   px-10 py-4 h-14 rounded-full
                   transition-all duration-300 ease-out
                   hover:shadow-xl hover:-translate-y-0.5">
  Get Started
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

### Ambient Decoration Pattern

```tsx
// Use sparingly - one or two per section max
<div
  className="absolute top-1/4 right-[15%] w-96 h-96 bg-sage/8 rounded-full blur-3xl"
  style={{ animation: 'pulse 6s ease-in-out infinite' }}
/>
```

---

## Page Templates

### Landing Page Structure

```
1. Hero (min-h-screen)
   - Overline: Category identifier
   - Headline: Transformation promise
   - Subheadline: One-sentence expansion
   - CTA: Email capture
   - Trust line: Social proof hint

2. Problem (py-32 md:py-40, bg-neutral-50)
   - Headline: Identity statement
   - Body: Specific relatable details
   - Close: Emotional validation

3. Solution (py-32 md:py-40, bg-white)
   - Headline: Clear value prop
   - Body: How it works (brief)
   - Visual: Product representation
   - Close: Outcome statement

4. Social Proof (py-32 md:py-40, bg-neutral-50)
   - Headline: Aspirational framing
   - Content: Testimonials or trust indicators

5. CTA (py-32 md:py-48, bg-sage)
   - Headline: Emotional close question
   - Subline: FOMO/aspiration
   - Form: Email capture (duplicate from hero)
```

---

## Review Checklist

Before shipping any new page or component:

### Copy

- [ ] Headlines are 3-6 words with periods
- [ ] No hype words (revolutionary, amazing, etc.)
- [ ] No qualifiers (really, very, just)
- [ ] Speaks to identity, not pain
- [ ] Specific details, not generic claims
- [ ] Active voice throughout

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

## Examples from Current Landing Page

### Hero Headline

```
Book more clients.
Build your business.
```

_Why it works: Transformation promise, parallel structure, periods for confidence_

### Problem Section

```
You're a photographer, not a bookkeeper.

But somewhere between the Instagram DM and the final gallery delivery,
you became both.
```

_Why it works: Identity statement, specific details (Instagram DM, gallery delivery), empathy without dwelling_

### Solution Section

```
One link. Complete booking system.

Your clients choose a package, pick a date, and pay—all in one flow.
You get a text when someone books. That's it.
```

_Why it works: Clear value prop, client benefit, outcome focus, confidence ("That's it.")_

### CTA

```
Ready to get back to your craft?
```

_Why it works: Question format creates momentum, echoes their core desire_

---

## Maintaining This Standard

1. **Reference this guide** before writing any customer-facing copy
2. **Review against checklist** before merging UI changes
3. **When in doubt, remove** - Apple's mantra applies here
4. **Show, don't tell** - if you have to explain quality, you've lost

_Last updated: December 2025_
