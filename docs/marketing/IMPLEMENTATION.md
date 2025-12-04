# Marketing Implementation Plan

> **Source of Truth:** [BRANDSCRIPT.md](./BRANDSCRIPT.md)
> **Track Progress:** [CHANGELOG.md](./CHANGELOG.md)
> **StoryBrand Help:** `/storybrand` command

---

## Status: PHASE 4 COMPLETE

- Phase 1: Copy quick wins - DONE
- Phase 2: Homepage transformation - DONE
- Phase 3: Social proof & lead capture - DONE
- Phase 4: Polish - DONE

---

## Phase 1: Copy Quick Wins (2-3 hours)

Ship in one PR. Immediate impact, minimal risk.

### 1.1 Hero Section

**File:** `client/src/pages/Home/HeroSection.tsx`

| Change        | Current                                                                                                                                                           | New                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Headline      | "Unlock Your Business Potential—Join the Macon AI Club"                                                                                                           | "Stop Drowning in Admin. Start Growing Your Business."                                                                                             |
| Subheadline   | "Your all-in-one partner for AI consulting, booking, scheduling, website builds, and business growth. We're your team behind the scenes—let's innovate together." | "We handle your scheduling, payments, and marketing—so you can focus on what you do best. Join 50+ business owners who've escaped the admin trap." |
| Primary CTA   | "Browse Packages"                                                                                                                                                 | "Start My Free Growth Audit"                                                                                                                       |
| Secondary CTA | "Want to learn more? How It Works →"                                                                                                                              | "See How It Works"                                                                                                                                 |
| Trust badge 2 | "Setup in 5 minutes"                                                                                                                                              | "Live in under 2 weeks"                                                                                                                            |
| Trust badge 3 | "Dedicated AI strategist"                                                                                                                                         | "Your dedicated growth partner"                                                                                                                    |

### 1.2 Footer Fix (Critical)

**File:** `client/src/app/AppShell.tsx`

| Change      | Current                                                                                                                          | New                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Description | "Making tenant management effortless through AI-powered automation. Onboard faster, automate smarter, and delight your tenants." | "Helping business owners escape the admin trap and focus on what they do best. Scheduling, websites, and marketing—handled." |

### 1.3 Navigation CTA

**File:** `client/src/app/AppShell.tsx`

| Change    | Current                                  | New                                                     |
| --------- | ---------------------------------------- | ------------------------------------------------------- |
| Nav items | Browse Packages, Log In, Contact Support | How It Works, Pricing, Log In, **[Get Started]** button |

**Phase 1 Deliverable:** PR with copy changes, mobile tested

---

## Phase 2: Problem Section + Rewrites (4-5 hours)

The missing "Problem" section is the biggest gap. Add it, then rewrite supporting sections.

### 2.1 Create Problem Section (NEW)

**File:** `client/src/pages/Home/ProblemSection.tsx` (create)

```
Section: "Sound Familiar?"
Cards:
1. Drowning in Admin - "You started a business to do what you love—not to spend 60 hours a week on scheduling, invoices, and follow-ups."
2. Losing Leads - "While you're juggling tasks, potential clients are booking with competitors who have better systems."
3. Burning Out - "Wearing every hat isn't sustainable. Something has to give—and it's usually your sanity or your growth."

Closer: "You didn't start a business for this. There's a better way."
```

### 2.2 Add to Home Page

**File:** `client/src/pages/Home/index.tsx`

Insert `<ProblemSection />` between `<HeroSection />` and `<ClubAdvantageSection />`

### 2.3 Rewrite Club Advantage

**File:** `client/src/pages/Home/ClubAdvantageSection.tsx`

| Element        | Current                                                    | New                                                   |
| -------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| Section title  | "The Club Advantage"                                       | "Your Growth Partner, Not Another Tool"               |
| Card 1 title   | "Business Growth, Accelerated"                             | "Marketing That Actually Works"                       |
| Card 1 outcome | "Increase revenue, land more clients, scale smarter"       | "Average member sees 30% revenue increase in 90 days" |
| Card 2 title   | "Seamless Scheduling & Bookings"                           | "Bookings on Autopilot"                               |
| Card 2 outcome | "Save 60+ hours/month, never lose a lead, get paid faster" | "Members save 15 hours/week on average"               |
| Card 3 title   | "Your Website, Your Way"                                   | "A Website That Works for You"                        |
| Card 3 outcome | "Professional web presence without hiring developers"      | "From zero to live website in 10 days"                |

### 2.4 Rewrite How It Works

**File:** `client/src/pages/Home/HowItWorksSection.tsx`

| Element       | Current                         | New                                        |
| ------------- | ------------------------------- | ------------------------------------------ |
| Section title | "How It Works"                  | "The Growth Partnership Method"            |
| Subtitle      | "Join. Grow. Succeed."          | "From overwhelmed to automated in 3 steps" |
| Step 1        | "Apply & Onboard" (Week 1)      | "Discovery Call" (Day 1)                   |
| Step 2        | "Tailored Plan" (Week 2-3)      | "Custom Blueprint" (Week 1-2)              |
| Step 3        | "Revenue Partnership" (Ongoing) | "Launch & Partner" (Week 2+)               |

### 2.5 Rewrite Final CTA

**File:** `client/src/pages/Home/FinalCTASection.tsx`

| Element    | Current                              | New                                                                        |
| ---------- | ------------------------------------ | -------------------------------------------------------------------------- |
| Heading    | "Ready to Unlock Your Growth?"       | "Ready to Stop Doing Everything Yourself?"                                 |
| Subheading | "Apply to join the Macon AI Club..." | "Join 50+ business owners who've traded admin chaos for automated growth." |
| CTA        | "Browse Our Packages"                | "Start My Free Growth Audit"                                               |

**Phase 2 Deliverable:** PR with Problem Section + all section rewrites

---

## Phase 3: Social Proof + Testimonials (2-3 hours)

Enhance credibility and trust.

### 3.1 Add Social Proof Bar to Hero

**File:** `client/src/pages/Home/HeroSection.tsx`

Add below trust badges:

```
Trusted by 50+ businesses • $2M+ revenue managed • ★ 4.9 rating
```

### 3.2 Enhance Testimonials

**File:** `client/src/pages/Home/TestimonialsSection.tsx`

Add to each testimonial:

- Avatar (initials in colored circle)
- Location (e.g., "Atlanta, GA")
- Metric badge (e.g., "Revenue up 30%")

Update quotes to be more conversational (see BRANDSCRIPT.md)

### 3.3 Rewrite Target Audience

**File:** `client/src/pages/Home/TargetAudienceSection.tsx`

| Element       | Current                                   | New                                                            |
| ------------- | ----------------------------------------- | -------------------------------------------------------------- |
| Section title | "Who Is This For?"                        | "Is This You?"                                                 |
| Subtitle      | "Entrepreneurs, small business owners..." | "We've helped business owners just like you escape the grind." |

Rewrite persona problems to be more visceral (see BRANDSCRIPT.md)

**Phase 3 Deliverable:** PR with social proof and testimonial enhancements

---

## Phase 4: Lead Capture + Conversion (3-4 hours)

Add transitional CTAs for visitors not ready to buy.

### 4.1 Create Lead Magnet Component (NEW)

**File:** `client/src/components/LeadMagnetCTA.tsx`

```
Title: "The Admin Escape Plan"
Subtitle: "5 Systems Every Small Business Needs"
Description: "Get our step-by-step guide to automating your business—even if you're not tech-savvy."
CTA: [Email input] [Get the Guide]
```

### 4.2 Add to Home Page

**File:** `client/src/pages/Home/index.tsx`

Insert after Target Audience section

### 4.3 Create FAQ Section (NEW)

**File:** `client/src/pages/Home/FAQSection.tsx`

5 FAQs from BRANDSCRIPT.md:

- Revenue-sharing model
- Already have a website
- How long for results
- AI strategist support
- Cancel policy

### 4.4 Footer Email Capture

**File:** `client/src/app/AppShell.tsx`

Add newsletter signup to footer

**Phase 4 Deliverable:** PR with lead capture components

---

## Phase 5: Polish (2-3 hours)

Micro-interactions and refinements.

### 5.1 Button Hover Effects

**File:** `client/src/components/ui/button.tsx`

- Scale 1.02x on hover
- Enhanced shadow
- Smooth transitions

### 5.2 Empty State Improvements

**Files:** Various admin components

Make empty states actionable with CTAs

### 5.3 Form Microcopy

**Files:** Booking flow components

Update helper text and button states

**Phase 5 Deliverable:** PR with polish changes

---

## Summary

| Phase | Focus                       | Time | Dependencies |
| ----- | --------------------------- | ---- | ------------ |
| **1** | Copy quick wins             | 2-3h | None         |
| **2** | Problem section + rewrites  | 4-5h | Phase 1      |
| **3** | Social proof + testimonials | 2-3h | Phase 1      |
| **4** | Lead capture                | 3-4h | Phase 2      |
| **5** | Polish                      | 2-3h | Phase 1-4    |

**Total: 13-18 hours**

---

## Rules

1. **One PR per phase** - easy to review, easy to rollback
2. **Test mobile** after every change
3. **Log in CHANGELOG.md** when complete
4. **Consult BRANDSCRIPT.md** for all copy
5. **Use `/storybrand`** for questions

---

## Quick Start

To begin Phase 1:

```
Read BRANDSCRIPT.md → Edit HeroSection.tsx → Edit AppShell.tsx → Test → PR
```
