# feat: How It Works Dual-Panel Section

> Replace the generic 3-step timeline with a visual dual-panel showing "What You See" (dashboard) and "What Your Clients See" (storefront).

## Overview

One section. One file. Two panels with screenshots and feature badges.

## Problem Statement

The current `HowItWorksSection.tsx` uses abstract language ("personalized system") instead of showing what the platform actually looks like. Creative professionals want to see the product, not read about a process.

## Proposed Solution

Replace the existing section with a simple dual-panel layout:
- **Left Panel:** "What You See" - Dashboard screenshot + 5 feature badges (sage accent)
- **Right Panel:** "What Your Clients See" - Storefront screenshot + 5 feature badges (sage accent)

Both panels use **sage** accent color for design system consistency.

## Implementation

### Single File: `HowItWorksSection.tsx`

```tsx
// client/src/pages/Home/HowItWorksSection.tsx
import { Container } from '@/ui/Container';
import { AnimatedSection } from '@/components/AnimatedSection';
import {
  Calendar,
  Package,
  CreditCard,
  BarChart,
  Bell,
  Zap,
  CheckCircle,
  Smartphone,
  Mail,
} from 'lucide-react';

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="py-32 md:py-40 bg-neutral-50"
    >
      <Container>
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
          <span className="inline-block bg-sage/10 text-sage text-sm font-semibold px-4 py-2 rounded-full mb-6">
            The Platform
          </span>
          <h2
            id="how-it-works-heading"
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary mb-6 leading-[1.1]"
          >
            Your command center. Their booking paradise.
          </h2>
          <p className="text-xl md:text-2xl text-text-muted font-light">
            One platform, two experiences.
          </p>
        </div>

        {/* Dual Panels */}
        <AnimatedSection animation="fade-in-up">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 max-w-6xl mx-auto">
            {/* What You See */}
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100 h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <span className="inline-block bg-sage text-white text-sm font-semibold px-4 py-2 rounded-full shadow-md mb-6">
                What You See
              </span>

              <div className="mb-6 rounded-2xl overflow-hidden bg-neutral-100">
                <img
                  src="/images/screenshots/dashboard-tenant-placeholder.svg"
                  alt="MAIS tenant dashboard showing package management, booking calendar, and revenue analytics"
                  loading="lazy"
                  className="w-full h-auto"
                />
              </div>

              <p className="text-lg text-text-muted mb-6 leading-relaxed">
                Manage packages, bookings, and revenue from one clean dashboard.
              </p>

              <div className="flex flex-wrap gap-2">
                {[
                  { icon: Calendar, label: 'Real-time availability' },
                  { icon: CreditCard, label: 'Instant Stripe payouts' },
                  { icon: Mail, label: 'Client communication hub' },
                  { icon: BarChart, label: 'Revenue analytics' },
                  { icon: Bell, label: 'Automated reminders' },
                ].map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-2 bg-sage/10 text-sage px-3 py-1.5 rounded-full text-sm font-medium"
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* What Your Clients See */}
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100 h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <span className="inline-block bg-sage text-white text-sm font-semibold px-4 py-2 rounded-full shadow-md mb-6">
                What Your Clients See
              </span>

              <div className="mb-6 rounded-2xl overflow-hidden bg-neutral-100">
                <img
                  src="/images/screenshots/storefront-client-placeholder.svg"
                  alt="MAIS storefront showing professional package cards with book now buttons"
                  loading="lazy"
                  className="w-full h-auto"
                />
              </div>

              <p className="text-lg text-text-muted mb-6 leading-relaxed">
                A branded storefront that turns browsers into bookers.
              </p>

              <div className="flex flex-wrap gap-2">
                {[
                  { icon: Package, label: 'Your packages, their pace' },
                  { icon: Zap, label: '3-click checkout' },
                  { icon: CheckCircle, label: 'Instant confirmation' },
                  { icon: Bell, label: 'Booking reminders' },
                  { icon: Smartphone, label: 'Mobile-optimized' },
                ].map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-2 bg-sage/10 text-sage px-3 py-1.5 rounded-full text-sm font-medium"
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </AnimatedSection>
      </Container>
    </section>
  );
}
```

### Placeholder SVG Files

Create two simple wireframe placeholders:

**`/public/images/screenshots/dashboard-tenant-placeholder.svg`**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" fill="none">
  <rect width="1200" height="800" fill="#F5F5F5"/>
  <rect x="40" y="40" width="280" height="720" rx="16" fill="#E5E5E5"/>
  <rect x="360" y="40" width="800" height="200" rx="16" fill="#E5E5E5"/>
  <rect x="360" y="280" width="380" height="480" rx="16" fill="#E5E5E5"/>
  <rect x="780" y="280" width="380" height="230" rx="16" fill="#E5E5E5"/>
  <rect x="780" y="530" width="380" height="230" rx="16" fill="#E5E5E5"/>
  <text x="600" y="420" text-anchor="middle" fill="#9CA3AF" font-family="system-ui" font-size="24">Dashboard Preview</text>
</svg>
```

**`/public/images/screenshots/storefront-client-placeholder.svg`**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" fill="none">
  <rect width="1200" height="800" fill="#F5F5F5"/>
  <rect x="100" y="40" width="1000" height="120" rx="16" fill="#E5E5E5"/>
  <rect x="100" y="200" width="300" height="400" rx="16" fill="#E5E5E5"/>
  <rect x="450" y="200" width="300" height="400" rx="16" fill="#4A7C6F" opacity="0.2"/>
  <rect x="800" y="200" width="300" height="400" rx="16" fill="#E5E5E5"/>
  <rect x="100" y="640" width="1000" height="120" rx="16" fill="#E5E5E5"/>
  <text x="600" y="420" text-anchor="middle" fill="#9CA3AF" font-family="system-ui" font-size="24">Storefront Preview</text>
</svg>
```

## Acceptance Criteria

- [ ] Section displays at `#how-it-works` anchor
- [ ] Two panels visible side-by-side on desktop (lg+)
- [ ] Panels stack vertically on mobile (tenant panel first)
- [ ] Placeholder images display correctly
- [ ] Fade-in animation on scroll
- [ ] Passes basic accessibility check (semantic HTML, alt text)

## Testing

One E2E test:

```typescript
// e2e/tests/landing.spec.ts (add to existing file)
test('how it works section renders dual panels', async ({ page }) => {
  await page.goto('/');

  const section = page.locator('#how-it-works');
  await section.scrollIntoViewIfNeeded();

  await expect(page.getByText('What You See')).toBeVisible();
  await expect(page.getByText('What Your Clients See')).toBeVisible();
  await expect(page.getByAlt(/tenant dashboard/i)).toBeVisible();
  await expect(page.getByAlt(/storefront/i)).toBeVisible();
});
```

## Implementation Steps

1. Replace `client/src/pages/Home/HowItWorksSection.tsx` with new code
2. Create placeholder SVGs in `/public/images/screenshots/`
3. Verify section renders in dev mode
4. Add E2E test
5. Ship it

**Estimated time: 2-3 hours**

## Screenshot Replacement (Later)

When ready to replace placeholders with real screenshots:

```bash
# Capture screenshots (1200x800)
# Place as PNG files:
# - /public/images/screenshots/dashboard-tenant.png
# - /public/images/screenshots/storefront-client.png

# Update image src in component:
# src="/images/screenshots/dashboard-tenant.png"
```

## References

- Existing section: `client/src/pages/Home/HowItWorksSection.tsx`
- Container: `client/src/ui/Container.tsx`
- AnimatedSection: `client/src/components/AnimatedSection.tsx`
- Brand voice guide: `docs/design/BRAND_VOICE_GUIDE.md`

---

*Simplified plan based on reviewer feedback. ~110 lines of code, 1 file, 2-3 hours.*
