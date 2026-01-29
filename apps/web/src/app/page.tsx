import Link from 'next/link';
import { Metadata } from 'next';
import { Check, X, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileNav } from '@/components/home/MobileNav';
import { DemoStorefrontFrame } from '@/components/home/DemoStorefrontShowcase';
import { ProjectHubWedge } from '@/components/home/ProjectHubWedge';

// Revalidate homepage every 60 seconds
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Handled — The storefront for service work',
  description:
    "Bookings, coordination, changes, and follow-ups — all in one calm system that doesn't let things slip. Built for humans and AI agents.",
  openGraph: {
    title: 'Handled — The storefront for service work',
    description:
      "Bookings, coordination, changes, and follow-ups — all in one calm system that doesn't let things slip.",
    type: 'website',
  },
};

// Simplified pricing - outcome-focused
const tiers = [
  {
    id: 'foundation',
    name: 'The Foundation',
    price: '$49',
    priceSubtext: '/month',
    outcome: 'Professional presence. Zero tech headaches.',
    features: [
      'Done-for-you storefront',
      'Online booking & payments',
      'Project spaces for every client',
      'Monthly strategy calls',
    ],
    ctaText: 'Get Handled',
    ctaHref: '/signup',
    isPopular: false,
  },
  {
    id: 'system',
    name: 'The System',
    price: '$149',
    priceSubtext: '/month',
    outcome: 'One extra booking per month pays for itself.',
    features: [
      'Everything in Foundation',
      'AI coordinator (answers, routes, escalates)',
      'Smart reminders that reduce no-shows',
      'Priority support',
    ],
    ctaText: 'Get Handled',
    ctaHref: '/signup',
    isPopular: true,
  },
  {
    id: 'partnership',
    name: 'The Partnership',
    price: "Let's talk",
    priceSubtext: '',
    outcome: 'We build it. You book clients.',
    features: [
      'Everything in The System',
      'Custom automations',
      '1-on-1 strategy sessions',
      'Dedicated account manager',
    ],
    ctaText: 'Get Handled',
    ctaHref: '/signup',
    isPopular: false,
  },
];

export default function HomePage() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Handled',
    url: 'https://gethandled.ai',
    description: 'The storefront for service work — built for humans and AI agents.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <div className="min-h-screen bg-surface">
        {/* NAV */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-md border-b border-neutral-800">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-serif text-2xl font-bold text-text-primary">
              Handled
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="#how-it-works"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                How It Works
              </Link>
              <Link
                href="#pricing"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                Login
              </Link>
              <Button asChild variant="teal" className="rounded-full px-6 py-2">
                <Link href="/signup">Get Handled</Link>
              </Button>
            </div>
            <MobileNav />
          </div>
        </nav>

        <main>
          {/* ============================================
              HERO
              Split layout: Copy left, Storefront visual right
              ============================================ */}
          <section className="relative pt-28 pb-12 md:pt-32 md:pb-20 px-6">
            <div className="max-w-6xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Left: Copy */}
                <div className="text-center lg:text-left">
                  <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-text-primary leading-[1.08] tracking-tight">
                    The storefront for service work
                    <span className="block text-sage mt-2">— built for humans and AI agents.</span>
                  </h1>

                  <p className="mt-6 text-lg md:text-xl text-text-muted leading-relaxed max-w-lg mx-auto lg:mx-0">
                    Bookings, coordination, changes, and follow-ups — all in one calm system that
                    doesn&apos;t let things slip.
                  </p>

                  <div className="mt-8 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4">
                    <Button
                      asChild
                      variant="teal"
                      className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <Link href="/signup">Get Handled</Link>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      className="rounded-full px-8 py-6 text-lg text-text-muted hover:text-text-primary"
                    >
                      <Link href="#how-it-works" className="flex items-center gap-2">
                        See how it works
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Right: Storefront Visual */}
                <div className="hidden lg:block">
                  <DemoStorefrontFrame />
                </div>
              </div>
            </div>
          </section>

          {/* ============================================
              WHAT THIS REPLACES
              Name the enemy. The fragile chain.
              ============================================ */}
          <section className="py-20 md:py-28 px-6 bg-surface-alt">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight">
                  You know this chain.
                </h2>
                <p className="mt-4 text-lg text-text-muted">
                  Interest → Booking → Coordination → Execution → Follow-up → Repeat
                </p>
              </div>

              {/* The fragile chain visual */}
              <div className="grid md:grid-cols-2 gap-8 mb-16">
                {/* Currently held together by... */}
                <div className="bg-neutral-800/40 rounded-2xl p-8 border border-neutral-700">
                  <p className="text-sm text-neutral-400 uppercase tracking-wide mb-6">
                    Currently held together by
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      'Email',
                      'Texts',
                      'DMs',
                      'Notes',
                      'Memory',
                      '"I\'ll remember"',
                      '"Did you see that?"',
                    ].map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-2 bg-neutral-700/50 text-neutral-300 px-4 py-2 rounded-full text-sm"
                      >
                        <X className="w-3 h-3 text-neutral-500" />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Handled replaces it with... */}
                <div className="bg-sage/[0.08] rounded-2xl p-8 border border-sage/20">
                  <p className="text-sm text-sage uppercase tracking-wide mb-6">
                    Handled replaces it with
                  </p>
                  <p className="text-2xl md:text-3xl font-serif text-text-primary leading-snug">
                    One shared reality.
                  </p>
                  <p className="mt-4 text-text-muted">
                    The entire chain — from first click to repeat booking — runs through one system.
                    Nothing slips. Nothing duplicates. Nothing gets lost.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================
              THE 4 PRIMITIVES
              Not features. Inevitabilities.
              ============================================ */}
          <section id="how-it-works" className="py-20 md:py-28 px-6 scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-16">
                <p className="text-sage text-sm font-medium tracking-wide uppercase mb-4">
                  How it works
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight">
                  Four things that just work.
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Primitive 1: Storefront */}
                <div className="bg-surface-alt rounded-2xl p-8 lg:p-10 border border-neutral-800">
                  <div className="text-sage text-sm font-medium tracking-wide uppercase mb-4">
                    01 — Entry
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mb-4">
                    A Storefront That Works Without You
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    Services, pricing, availability, and policies — structured so clients and AI
                    agents can act without back-and-forth.
                  </p>
                </div>

                {/* Primitive 2: Project Space */}
                <div className="bg-surface-alt rounded-2xl p-8 lg:p-10 border border-neutral-800">
                  <div className="text-sage text-sm font-medium tracking-wide uppercase mb-4">
                    02 — Continuity
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mb-4">
                    A Project Space That Becomes Truth
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    One place for messages, changes, files, and decisions — so nothing gets lost and
                    no one has to ask twice.
                  </p>
                </div>

                {/* Primitive 3: Coordinator */}
                <div className="bg-surface-alt rounded-2xl p-8 lg:p-10 border border-neutral-800">
                  <div className="text-sage text-sm font-medium tracking-wide uppercase mb-4">
                    03 — Intelligence
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mb-4">
                    A Coordinator That Knows When to Escalate
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    Handles the routine, flags the important, and never commits without approval.
                    The calm layer between chaos and execution.
                  </p>
                </div>

                {/* Primitive 4: Flywheel */}
                <div className="bg-surface-alt rounded-2xl p-8 lg:p-10 border border-neutral-800">
                  <div className="text-sage text-sm font-medium tracking-wide uppercase mb-4">
                    04 — Retention
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mb-4">
                    A System That Turns One Job Into the Next
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    Follow-ups, reviews, and re-booking happen naturally, in context — without
                    feeling salesy.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================
              PROJECT HUB WEDGE
              Visual proof of Primitives 2 & 3 working together
              ============================================ */}
          <ProjectHubWedge />

          {/* ============================================
              A2A COMMERCE
              Calm. Confident. Short.
              ============================================ */}
          <section className="py-20 md:py-28 px-6 bg-surface">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-text-muted text-lg mb-6">
                The next buyers won&apos;t always be people.
                <br />
                They&apos;ll be agents acting for people.
              </p>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary leading-tight">
                Handled is built so your business can be discovered, booked, and coordinated —
                whether the request comes from a human or an AI.
              </h2>
            </div>
          </section>

          {/* ============================================
              WHO IT'S FOR / NOT FOR
              Builds trust. Repels wrong fit.
              ============================================ */}
          <section className="py-20 md:py-28 px-6">
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-8">
                {/* For */}
                <div>
                  <h3 className="font-serif text-2xl font-bold text-text-primary mb-6">
                    Handled is for service businesses where:
                  </h3>
                  <ul className="space-y-4">
                    {[
                      'Work is custom',
                      'Details matter',
                      'Changes happen',
                      'Trust is everything',
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-sage/15 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3.5 h-3.5 text-sage" />
                        </div>
                        <span className="text-text-primary text-lg">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Not for */}
                <div>
                  <h3 className="font-serif text-2xl font-bold text-text-primary mb-6">
                    It&apos;s not for:
                  </h3>
                  <ul className="space-y-4">
                    {[
                      'Commodity gigs',
                      'One-click deliveries',
                      'High-volume, low-context work',
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-neutral-700/50 flex items-center justify-center flex-shrink-0">
                          <X className="w-3.5 h-3.5 text-neutral-500" />
                        </div>
                        <span className="text-text-muted text-lg">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================
              PRICING
              Simple. Clear. No feature overload.
              ============================================ */}
          <section id="pricing" className="py-20 md:py-28 px-6 bg-surface-alt scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              <div className="text-center max-w-2xl mx-auto mb-16">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
                  Simple pricing.
                </h2>
                <p className="text-xl text-text-muted">No contracts. Cancel anytime.</p>
              </div>

              {/* 3-Tier Grid */}
              <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto items-stretch pt-4">
                {tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className={`relative bg-surface rounded-2xl p-8 border transition-all duration-300 flex flex-col ${
                      tier.isPopular
                        ? 'border-2 border-sage shadow-xl shadow-sage/10 md:-mt-2 md:scale-[1.02] z-10'
                        : 'border-neutral-800 hover:border-sage/40'
                    }`}
                  >
                    {tier.isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                        <span className="inline-flex items-center gap-1.5 bg-sage text-white text-sm font-semibold px-4 py-1.5 rounded-full shadow-lg">
                          <Sparkles className="w-4 h-4" />
                          Most Popular
                        </span>
                      </div>
                    )}

                    <h3
                      className={`font-serif text-xl font-bold text-text-primary ${tier.isPopular ? 'mt-2' : ''}`}
                    >
                      {tier.name}
                    </h3>

                    <div className="mt-4">
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-text-primary text-4xl">{tier.price}</span>
                        {tier.priceSubtext && (
                          <span className="text-text-muted">{tier.priceSubtext}</span>
                        )}
                      </div>
                      <p className="mt-2 text-text-muted text-sm">{tier.outcome}</p>
                    </div>

                    <ul className="mt-6 space-y-3 flex-1">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <Check className="w-4 h-4 text-sage flex-shrink-0 mt-1" />
                          <span className="text-text-primary text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      asChild
                      variant={tier.isPopular ? 'sage' : 'outline'}
                      className={`w-full mt-8 rounded-full py-5 ${
                        tier.isPopular
                          ? 'shadow-lg hover:shadow-xl'
                          : 'border-sage/50 text-sage hover:bg-sage/10'
                      }`}
                    >
                      <Link href={tier.ctaHref}>{tier.ctaText}</Link>
                    </Button>
                  </div>
                ))}
              </div>

              <p className="text-center text-text-muted text-sm mt-10">
                14-day free trial. No credit card required.
              </p>
            </div>
          </section>

          {/* ============================================
              FINAL CTA
              Emotional close. One action.
              ============================================ */}
          <section className="py-24 md:py-32 px-6">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
                Stop juggling tools.
              </h2>
              <p className="text-xl md:text-2xl text-text-muted leading-relaxed mb-10">
                Start running work in one place.
              </p>
              <Button
                asChild
                variant="teal"
                className="rounded-full px-12 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Link href="/signup">Get Handled</Link>
              </Button>
            </div>
          </section>
        </main>

        {/* FOOTER */}
        <footer className="py-10 px-6 bg-neutral-900 border-t border-neutral-800">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="font-serif text-lg font-bold text-text-primary">Handled</div>
              <div className="flex items-center gap-6 text-xs text-text-muted">
                <Link href="/terms" className="hover:text-text-primary transition-colors">
                  Terms
                </Link>
                <Link href="/privacy" className="hover:text-text-primary transition-colors">
                  Privacy
                </Link>
                <Link href="/contact" className="hover:text-text-primary transition-colors">
                  Contact
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
