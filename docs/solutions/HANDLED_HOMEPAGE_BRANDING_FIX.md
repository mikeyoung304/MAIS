# HANDLED Homepage & Branding Fix

**Date:** 2025-12-27
**Category:** User-Facing Branding
**Priority:** Medium
**Time to Implement:** 30 minutes

## Problem Statement

The public homepage at `www.gethandled.ai` displayed a **404 "Business not found"** error instead of a marketing homepage. This occurred because:

1. The original `apps/web/src/app/page.tsx` contained a redirect to `/t/handled` (tenant route)
2. HANDLED is the **company/platform**, not a tenant signup
3. This redirect broke the public marketing site and confused visitors

Additionally, **8 user-facing pages** contained incorrect branding references to "MAIS" (internal codename) instead of "HANDLED" (public brand name).

## Root Cause

The Next.js App Router `page.tsx` was misconfigured to treat the homepage as a tenant route instead of building a dedicated marketing homepage. The original code:

```typescript
// ❌ WRONG - Redirects to tenant route
import { permanentRedirect } from 'next/navigation';

export default function HomePage() {
  permanentRedirect('/t/handled');
}
```

This pattern made sense during development but needed a full marketing homepage once we began public marketing.

## Solution Overview

**Two-part fix:**

1. **Build full marketing homepage** - Replace redirect with ~375-line marketing site component
2. **Fix branding across 8 pages** - Change "MAIS" → "HANDLED" in user-facing pages

## Implementation

### Part 1: Marketing Homepage (`apps/web/src/app/page.tsx`)

**Key Sections:**

#### Navigation Bar
- Fixed sticky header with HANDLED logo
- Links to Features, Pricing, FAQ sections
- Sign In and Get Started CTAs

```typescript
<nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-100">
  <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
    <Link href="/" className="font-serif text-2xl font-bold text-text-primary">
      HANDLED
    </Link>
```

#### Hero Section
Headline emphasizes transformation, not features:

> **"The tech is moving fast. You don't have to."**

Subheadline explains value proposition:

> "Done-for-you websites, booking, and AI — plus monthly updates on what's actually worth knowing. For service pros who'd rather stay ahead than burn out."

Dual CTA buttons:
- Primary: "Get Handled" → `/signup`
- Secondary: "See How It Works" → `#features`

#### Problem Section
Establishes emotional connection before features:

> "You didn't start your business to debug a website."

Lists service types (photographers, coaches, therapists, consultants, trainers, wedding planners) to increase relatability.

#### Features Section
6 benefit-driven features with icons:

| Feature | Description |
|---------|-------------|
| **Website That Works** | "We build it. We maintain it. You never touch it." |
| **Booking & Payments** | "Clients book and pay online. You get a notification." |
| **AI That Actually Helps** | "A chatbot trained on your business. Works while you sleep." |
| **Monthly Newsletter** | "What's worth knowing in AI and tech this month. Curated. No fluff." |
| **Monthly Zoom Calls** | "Real talk with other pros about what's working. No pitch." |
| **Humans Who Answer** | "Questions? We answer them. No chatbots, no tickets. Just help." |

#### Pricing Section
3 tiered options reflecting business model:

```typescript
const tiers = [
  {
    name: 'Handled',
    price: '$49',
    priceSubtext: '/month',
    description: 'The essentials',
    features: [
      'Professional website',
      'Online booking',
      'Payment processing',
      'Email notifications',
    ],
    ctaText: 'Get Started',
    ctaHref: '/signup?tier=handled',
  },
  {
    name: 'Fully Handled',
    price: '$149',
    priceSubtext: '/month',
    description: 'The full membership',
    features: [
      'Everything in Handled',
      'AI chatbot for your business',
      'Monthly newsletter',
      'Monthly Zoom calls',
      'Priority support',
    ],
    ctaText: 'Join Now',
    ctaHref: '/signup?tier=fully-handled',
    isPopular: true, // Ring highlight
  },
  {
    name: 'Completely Handled',
    price: 'Custom',
    description: 'White glove',
    features: [
      'Everything in Fully Handled',
      '1-on-1 strategy sessions',
      'Custom integrations',
      'Dedicated account manager',
    ],
    ctaText: 'Book a Call',
    ctaHref: '/contact',
  },
];
```

#### FAQ Section
6 questions addressing common objections:

| Question | Answer Theme |
|----------|--------------|
| "What kind of businesses is this for?" | Service professionals who sell time/expertise |
| "Do I need to know anything about tech?" | No - that's the point of HANDLED |
| "What if I already have a website?" | We can work with existing sites or migrate |
| "What happens on the monthly Zoom calls?" | Peer learning, not sales pitches |
| "Is the AI chatbot going to sound like a robot?" | Trained on your voice/style |
| "Can I cancel anytime?" | Yes, no contracts or cancellation fees |

Implemented using HTML `<details>` element (native accordion):

```typescript
<details className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden">
  <summary className="flex items-center justify-between cursor-pointer p-6 list-none">
    <span className="font-medium text-text-primary pr-4">{faq.question}</span>
    <ChevronDown className="w-5 h-5 text-text-muted flex-shrink-0 transition-transform duration-200 group-open:rotate-180" />
  </summary>
  <div className="px-6 pb-6 text-text-muted leading-relaxed">{faq.answer}</div>
</details>
```

#### Final CTA Section
Dark sage background with compelling headline:

> "Ready to stop being your own IT department?"

Subtext: "Join service pros who'd rather focus on being great at their job."

#### Footer
Links to Terms, Privacy, Contact pages with copyright.

### Part 2: Branding Fixes (8 Files)

Changed "MAIS" → "HANDLED" in user-facing pages:

| File | Location | Change |
|------|----------|--------|
| `/t/not-found.tsx` | Line 29 | "Get started with HANDLED" |
| `/login/page.tsx` | Line 207 | Logo text → "HANDLED" |
| `/signup/page.tsx` | Line 149, 351 | Card description + logo → "HANDLED" |
| `/forgot-password/page.tsx` | **Line 128** | Logo text → "HANDLED" ← **Still shows MAIS** |
| `AdminSidebar.tsx` | Line 177 | Sidebar logo → "HANDLED" |
| `/tenant/billing/page.tsx` | *needs verification* | Page headers/titles |
| `/tenant/settings/page.tsx` | *needs verification* | Page headers/titles |
| `/tenant/assistant/page.tsx` | *needs verification* | Page headers/titles |

**Note:** `forgot-password/page.tsx` line 128 still displays "MAIS" - this should be fixed:

```typescript
// Current (WRONG):
<Link href="/" className="font-serif text-3xl font-bold text-text-primary">
  MAIS
</Link>

// Should be:
<Link href="/" className="font-serif text-3xl font-bold text-text-primary">
  HANDLED
</Link>
```

## Design System Applied

All components follow HANDLED brand design patterns:

### Typography
- Serif headlines (`font-serif`)
- Tight tracking on headings
- Light subheadings

### Spacing
- Section padding: `py-32 md:py-40` (generous whitespace)
- Card padding: `p-8`

### Colors
- Primary accent: Sage (`bg-sage`, `text-sage`)
- Used sparingly (20% color, 80% neutral)
- Hover states include elevation changes

### Components
- Cards: `rounded-3xl shadow-lg border border-neutral-100`
- Buttons: `rounded-full` with `hover:shadow-xl hover:-translate-y-1`
- Transitions: `transition-all duration-300`

## Metadata

Updated Next.js `Metadata` object:

```typescript
export const metadata: Metadata = {
  title: 'HANDLED - Stay Ahead Without the Overwhelm',
  description:
    "Done-for-you websites, booking, and AI — plus monthly updates on what's actually worth knowing. For service pros who'd rather stay ahead than burn out.",
  openGraph: {
    title: 'HANDLED - Stay Ahead Without the Overwhelm',
    description:
      "Done-for-you websites, booking, and AI — plus monthly updates on what's actually worth knowing.",
    type: 'website',
  },
};
```

## Testing Checklist

- [ ] Homepage loads without 404 error
- [ ] Navigation links scroll to correct sections (#features, #pricing, #faq)
- [ ] All CTAs link correctly:
  - "Get Started" buttons → `/signup`
  - "Get Handled" button → `/signup`
  - Pricing tier CTAs → `/signup?tier=handled|fully-handled` or `/contact`
  - "Sign In" → `/login`
- [ ] Mobile responsive (test on 375px, 768px, 1024px)
- [ ] All 8 branding pages show "HANDLED" not "MAIS"
- [ ] Footer links work (Terms, Privacy, Contact)
- [ ] Metadata displays correctly in browser tab and social shares

## Key Decisions

1. **Full Homepage > Redirect Pattern**
   - Rationale: Marketing-first positioning requires dedicated homepage experience
   - Trade-off: More maintenance, but justified for brand presence

2. **Pricing Tier Names**
   - "Handled" / "Fully Handled" / "Completely Handled"
   - Reinforces core brand message and product names
   - More memorable than generic tier names

3. **Native HTML Details Element**
   - No JavaScript dependency for accordion
   - Progressive enhancement built-in
   - SEO-friendly (content visible in HTML)

4. **Sage as Accent Color**
   - Used in hero headline span (`<span className="text-sage">`)
   - Popular tier ring highlight
   - CTA buttons and links
   - Keeps visual hierarchy while maintaining brand identity

## Future Considerations

1. **Analytics** - Track homepage visit flow, CTA clicks, signup conversion rate
2. **A/B Testing** - Test headline variants, CTA button copy, pricing tiers
3. **SEO** - Add schema.org markup for pricing, FAQ, organization
4. **Performance** - Lazy-load feature icons, optimize image sizes
5. **Accessibility** - Ensure WCAG AA compliance (colors, focus states, keyboard nav)
6. **Missing Pages** - Implement `/contact`, `/terms`, `/privacy` pages

## Related Files

- `/apps/web/src/app/page.tsx` - Marketing homepage (375 lines)
- `/apps/web/src/app/t/not-found.tsx` - Tenant 404 page (updated branding)
- `/apps/web/src/app/login/page.tsx` - Login page (updated logo)
- `/apps/web/src/app/signup/page.tsx` - Signup page (updated copy)
- `/apps/web/src/app/forgot-password/page.tsx` - Password reset (needs fix)
- `/apps/web/src/components/layouts/AdminSidebar.tsx` - Sidebar (updated logo)
- `/docs/design/BRAND_VOICE_GUIDE.md` - Brand voice and design system

## Lessons Learned

1. **Branding is systemic** - Fixing homepage revealed 8 other pages with stale branding
2. **Homepage isn't optional** - Public sites need dedicated marketing pages, not redirects
3. **Test across all user journeys** - Check auth flow (login/signup/reset), 404 pages, admin UI
4. **Brand consistency requires discipline** - Use component-level constants for brand names

