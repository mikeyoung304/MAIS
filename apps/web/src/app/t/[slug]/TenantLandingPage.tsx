'use client';

import { Button } from '@/components/ui/button';

interface TenantData {
  id: string;
  slug: string;
  name: string;
  businessType: string;
  landingPageConfig: {
    hero: {
      headline: string;
      subheadline: string;
      ctaText: string;
    };
    segments: unknown[];
    packages: unknown[];
    testimonials: unknown[];
    faqs: unknown[];
  };
  branding: {
    primaryColor: string;
    logo: string | null;
  };
}

interface TenantLandingPageProps {
  tenant: TenantData;
}

/**
 * Tenant Landing Page - Monolithic Component
 *
 * Following the plan's guidance: "Build monolith first, extract components later"
 * This component contains all sections inline initially.
 * After the page works end-to-end, we'll extract reusable components.
 *
 * Sections:
 * 1. Hero Section
 * 2. Trust Bar (optional)
 * 3. Segment Picker (if multiple segments)
 * 4. Tier Cards
 * 5. Social Proof / Testimonials
 * 6. FAQ Section
 * 7. Final CTA
 * 8. Footer
 */
export function TenantLandingPage({ tenant }: TenantLandingPageProps) {
  const { hero } = tenant.landingPageConfig;

  return (
    <div className="min-h-screen bg-surface">
      {/* ===== HERO SECTION ===== */}
      <section className="py-32 md:py-40">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h1 className="font-serif text-4xl font-bold leading-[1.1] tracking-tight text-text-primary sm:text-5xl md:text-6xl">
            {hero.headline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted md:text-xl">
            {hero.subheadline}
          </p>
          <div className="mt-10">
            <Button variant="sage" size="xl">
              {hero.ctaText}
            </Button>
          </div>
        </div>
      </section>

      {/* ===== TRUST BAR ===== */}
      <section className="border-y border-neutral-100 bg-surface-alt py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-8 px-6 md:gap-16">
          <div className="text-center">
            <p className="text-2xl font-bold text-text-primary">500+</p>
            <p className="text-sm text-text-muted">Happy Clients</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-text-primary">5 Years</p>
            <p className="text-sm text-text-muted">Experience</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-text-primary">4.9/5</p>
            <p className="text-sm text-text-muted">Rating</p>
          </div>
        </div>
      </section>

      {/* ===== TIER CARDS ===== */}
      <section className="py-32 md:py-40">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl">
              Choose your package.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-text-muted">
              Select the perfect option for your needs.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {/* Essential Tier */}
            <div className="rounded-3xl border border-neutral-100 bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <h3 className="text-lg font-semibold text-text-primary">Essential</h3>
              <p className="mt-2 text-3xl font-bold text-text-primary">
                $199<span className="text-base font-normal text-text-muted">/session</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-text-muted">
                <li className="flex items-center gap-2">
                  <span className="text-sage">&#10003;</span> 1-hour session
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-sage">&#10003;</span> 20 edited photos
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-sage">&#10003;</span> Online gallery
                </li>
              </ul>
              <Button variant="outline" className="mt-8 w-full">
                Book Essential
              </Button>
            </div>

            {/* Popular Tier - Emphasized */}
            <div className="relative rounded-3xl border-2 border-sage bg-white p-8 shadow-xl">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-sage px-4 py-1 text-sm font-medium text-white">
                Most Popular
              </div>
              <h3 className="text-lg font-semibold text-text-primary">Popular</h3>
              <p className="mt-2 text-3xl font-bold text-text-primary">
                $349<span className="text-base font-normal text-text-muted">/session</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-text-muted">
                <li className="flex items-center gap-2">
                  <span className="text-sage">&#10003;</span> 2-hour session
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-sage">&#10003;</span> 50 edited photos
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-sage">&#10003;</span> Online gallery
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-sage">&#10003;</span> Print release
                </li>
              </ul>
              <Button variant="sage" className="mt-8 w-full">
                Book Popular
              </Button>
            </div>

            {/* Premium Tier */}
            <div className="rounded-3xl border border-neutral-100 bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <h3 className="text-lg font-semibold text-text-primary">Premium</h3>
              <p className="mt-2 text-3xl font-bold text-text-primary">
                $599<span className="text-base font-normal text-text-muted">/session</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-text-muted">
                <li className="flex items-center gap-2">
                  <span className="text-sage">&#10003;</span> Half-day session
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-sage">&#10003;</span> 100 edited photos
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-sage">&#10003;</span> Online gallery
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-sage">&#10003;</span> Print release
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-sage">&#10003;</span> Album included
                </li>
              </ul>
              <Button variant="outline" className="mt-8 w-full">
                Book Premium
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="bg-surface-alt py-32 md:py-40">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl">
              What clients say.
            </h2>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2">
            <div className="rounded-3xl bg-white p-8 shadow-lg">
              <div className="flex gap-1 text-macon-orange">
                {[...Array(5)].map((_, i) => (
                  <span key={i}>&#9733;</span>
                ))}
              </div>
              <p className="mt-4 text-text-muted">
                &ldquo;Absolutely amazing experience! The photos exceeded all our expectations. So
                professional and easy to work with.&rdquo;
              </p>
              <p className="mt-4 font-semibold text-text-primary">Sarah M.</p>
            </div>
            <div className="rounded-3xl bg-white p-8 shadow-lg">
              <div className="flex gap-1 text-macon-orange">
                {[...Array(5)].map((_, i) => (
                  <span key={i}>&#9733;</span>
                ))}
              </div>
              <p className="mt-4 text-text-muted">
                &ldquo;Best photographer we&apos;ve ever worked with. Captured our family perfectly.
                Will definitely book again!&rdquo;
              </p>
              <p className="mt-4 font-semibold text-text-primary">John & Lisa D.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="py-32 md:py-40">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl">
              Questions? Answers.
            </h2>
          </div>

          <div className="mt-16 space-y-6">
            <div className="rounded-2xl border border-neutral-100 bg-white p-6">
              <h3 className="font-semibold text-text-primary">How do I book a session?</h3>
              <p className="mt-2 text-text-muted">
                Simply choose your package above and click the booking button. You&apos;ll be guided
                through selecting a date and providing your details.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-100 bg-white p-6">
              <h3 className="font-semibold text-text-primary">What&apos;s your cancellation policy?</h3>
              <p className="mt-2 text-text-muted">
                You can reschedule or cancel up to 48 hours before your session for a full refund.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-100 bg-white p-6">
              <h3 className="font-semibold text-text-primary">When will I receive my photos?</h3>
              <p className="mt-2 text-text-muted">
                Your edited photos will be delivered within 2 weeks of your session via a private
                online gallery.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="bg-sage py-32 md:py-40">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-serif text-3xl font-bold text-white sm:text-4xl">
            Ready to book?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80">
            Let&apos;s create something beautiful together.
          </p>
          <div className="mt-10">
            <Button
              variant="outline"
              size="xl"
              className="border-white bg-white text-sage hover:bg-white/90"
            >
              Get Started Today
            </Button>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-neutral-100 bg-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="font-semibold text-text-primary">{tenant.name}</p>
            <p className="text-sm text-text-muted">
              &copy; {new Date().getFullYear()} All rights reserved.
            </p>
          </div>
          <p className="mt-4 text-center text-xs text-text-muted">
            Powered by{' '}
            <a href="https://maconaisolutions.com" className="underline hover:text-sage">
              Macon AI Solutions
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
