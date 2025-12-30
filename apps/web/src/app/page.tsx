import Link from 'next/link';
import { Metadata } from 'next';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Globe,
  MessageSquare,
  Users,
  Layers,
  HeartHandshake,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductPreviewTabs } from '@/components/home/ProductPreviewTabs';
import { MobileNav } from '@/components/home/MobileNav';

export const metadata: Metadata = {
  title: 'HANDLED - Bring Your Passion. The Rest Is Handled.',
  description:
    'HANDLED gives service businesses a professional online presence, a conversion-optimized storefront, and a built-in assistant that answers questions and books clients for you — without the chaos.',
  openGraph: {
    title: 'HANDLED - Bring Your Passion. The Rest Is Handled.',
    description:
      'A professional storefront and booking system for service professionals. Clear pricing, smart assistance, and everything in one place.',
    type: 'website',
  },
};

const features = [
  {
    icon: Globe,
    title: 'A professional storefront that converts',
    description:
      'Your site is structured around proven best practices: clear positioning, tiered offerings, strong calls to action, and layouts that guide people toward booking.',
    bullets: ['No guessing.', 'No endless customization.', 'Just what works.'],
  },
  {
    icon: Layers,
    title: 'Clear pricing — without awkward conversations',
    description:
      'Present your services in a way clients understand, with tiered options that naturally guide them to the right choice.',
    bullets: ['Less explaining.', 'Fewer price objections.', 'Better-fit clients.'],
  },
  {
    icon: MessageSquare,
    title: 'A built-in assistant that handles the front desk',
    description:
      "Clients can ask questions, explore your offerings, and book without waiting on you. It's there when you're busy, offline, or simply done responding to another message — while still feeling personal and human.",
    bullets: [],
  },
];

const steps = [
  {
    number: '1',
    title: 'Set up your storefront',
    description:
      "Add what you offer, how you work, and when you're available. HANDLED guides you with best practices — you stay in control.",
  },
  {
    number: '2',
    title: 'Clients explore and book',
    description:
      'Visitors land on a focused site that explains your services clearly and makes booking easy — without friction or confusion.',
  },
  {
    number: '3',
    title: 'You stay in the loop',
    description:
      'Every booking comes to you for confirmation (or auto-approval, if you choose). No surprises. No double bookings.',
  },
  {
    number: '4',
    title: 'Everything lives in one place',
    description:
      'After booking, clients get a shared space for questions, changes, and add-ons — without endless email threads.',
  },
];

const postBookingItems = [
  'Review what they booked',
  'Ask follow-up questions',
  'Request changes or add-ons',
  'Share notes, ideas, or preferences',
];

const communityItems = [
  "A monthly live call to talk about what's working",
  'Practical insights on pricing, positioning, and booking',
  'Curated updates on useful AI developments — without the noise',
];

// V2 FAQ - replaces original FAQ
const faqsV2 = [
  {
    question: 'Will this feel like my business — or a template?',
    answer:
      'HANDLED gives you a strong structure, not a generic vibe. Your services, voice, and way of working come through — without starting from scratch.',
  },
  {
    question: 'What happens when a client asks something unusual?',
    answer:
      'The assistant handles common questions and knows when to hand things back to you. You stay in control of final decisions.',
  },
  {
    question: 'Does this replace my emails and DMs?',
    answer:
      "It reduces them by keeping booking, questions, and follow-ups in one place. Clients get a shared space so details don't scatter across threads.",
  },
  {
    question: 'Can I use my own domain?',
    answer:
      'If domain connection is available on your plan, yes. If not, you can still launch on a HANDLED link and connect your domain later.',
  },
  {
    question: 'Is this complicated to set up?',
    answer:
      "No. You enter what you offer, how you work, and when you're available. HANDLED handles the structure.",
  },
  {
    question: 'What if I stop using it?',
    answer: "You can cancel anytime. If you pause, you can restart when you're ready.",
  },
];

// 3-Tier Pricing - Psychology Optimized
// Implements: Anchoring, Decoy Effect, Social Proof, Outcome-Focused Naming
const tiers = [
  {
    id: 'foundation',
    name: 'The Foundation',
    price: '$49',
    priceSubtext: '/month',
    description: 'Everything you need to look professional.',
    annualSavings: 'Save $118/year',
    features: [
      'Professional storefront',
      'Online booking',
      'Payment processing',
      'Email notifications',
    ],
    ctaText: 'Get Started',
    ctaHref: '/signup?tier=handled',
    isPopular: false,
  },
  {
    id: 'system',
    name: 'The System',
    price: '$149',
    priceSubtext: '/month',
    description: 'Tech + growth support that works for you.',
    annualSavings: 'Save $358/year',
    features: [
      'Everything in Foundation',
      'AI chatbot for your business',
      'Monthly growth newsletter',
      'Live monthly Zoom calls',
      'Priority support',
    ],
    ctaText: 'Start Growing',
    ctaHref: '/signup?tier=fully-handled',
    isPopular: true,
  },
  {
    id: 'partnership',
    name: 'The Partnership',
    price: '$349',
    priceSubtext: '/month',
    description: 'Hands-on guidance for businesses ready to scale.',
    annualSavings: 'Save $838/year',
    features: [
      'Everything in System',
      '1-on-1 strategy sessions',
      'Custom integrations',
      'Dedicated account manager',
    ],
    ctaText: 'Book a Call',
    ctaHref: '/contact',
    isPopular: false,
  },
];

export default function HomePage() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'HANDLED',
    url: 'https://gethandled.ai',
    description:
      'A professional storefront and booking system for service businesses. Clear pricing, smart assistance, and everything in one place.',
    sameAs: [],
  };

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'HANDLED',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'Professional online presence, conversion-optimized storefront, and built-in assistant for service businesses.',
    offers: {
      '@type': 'Offer',
      description: 'Month-to-month subscription with 30-day free trial',
      availability: 'https://schema.org/InStock',
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqsV2.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="min-h-screen bg-surface">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-md border-b border-neutral-800">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-serif text-2xl font-bold text-text-primary">
              HANDLED
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="#how-it-works"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                How It Works
              </Link>
              <Link
                href="#features"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                Features
              </Link>
              <Link
                href="#pricing"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                Pricing
              </Link>
              <Link
                href="#faq"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                FAQ
              </Link>
              <Link
                href="/login"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                Sign In
              </Link>
              <Button asChild variant="sage" className="rounded-full px-6 py-2">
                <Link href="/signup">Start your storefront</Link>
              </Button>
            </div>
            {/* Mobile hamburger menu */}
            <MobileNav />
          </div>
        </nav>

        <main>
          {/* ============================================
              SECTION 1: HERO
              ============================================ */}
          <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.1] tracking-tight">
                Bring your passion.
                <br />
                <span className="text-sage">The rest is handled.</span>
              </h1>
              <p className="mt-8 text-lg md:text-xl text-text-muted leading-relaxed max-w-2xl mx-auto">
                HANDLED gives service businesses a professional online presence, a
                conversion-optimized storefront, and a built-in assistant that answers questions and
                books clients for you — without the chaos.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-8 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link href="/signup">Start your storefront</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="text-text-muted hover:text-text-primary rounded-full px-8 py-6 text-lg group"
                >
                  <Link href="#how-it-works" className="flex items-center gap-2">
                    See how it works
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 1.5: ABOVE-THE-FOLD PROOF BLOCK (V2 NEW)
              ============================================ */}
          <section className="py-16 md:py-24 px-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary mb-4">
                  See how HANDLED works in practice.
                </h2>
                <p className="text-text-muted leading-relaxed max-w-2xl mx-auto">
                  A storefront with clear offerings and guided booking — plus a shared space that
                  keeps client details organized after they book.
                </p>
                <p className="text-text-muted mt-4">
                  Browse it the way a client would.
                  <br />
                  Then decide if it feels like your business.
                </p>
              </div>

              {/* 3-Tab Product Preview */}
              <ProductPreviewTabs />

              <p className="text-center text-text-muted/70 text-sm mt-6">
                A HANDLED storefront and booking flow.
              </p>
            </div>
          </section>

          {/* ============================================
              SECTION 1.6: "WHAT YOU GET" MICRO-BLOCK (V2 NEW)
              ============================================ */}
          <section className="py-12 px-6 bg-surface-alt border-y border-neutral-800">
            <div className="max-w-3xl mx-auto">
              <h3 className="font-serif text-xl sm:text-2xl font-semibold text-text-primary text-center mb-6">
                What this replaces.
              </h3>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-text-muted text-center">
                <span>Pricing explanations.</span>
                <span>Back-and-forth scheduling.</span>
                <span>Repeating yourself in DMs.</span>
                <span>Scattered follow-ups after someone pays.</span>
              </div>
              <p className="text-text-primary font-medium text-center mt-6">
                HANDLED brings it into one flow.
              </p>
            </div>
          </section>

          {/* ============================================
              SECTION 2: TRUST / POSITIONING BAR
              ============================================ */}
          <section className="py-16 px-6">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-sm font-medium text-sage uppercase tracking-wide mb-4">
                Built for people who sell their time, skill, and experience.
              </p>
              <p className="text-text-muted leading-relaxed">
                For service professionals who want their business to feel calmer, clearer, and more
                put together — without duct-taping tools together or living in their inbox.
              </p>
            </div>
          </section>

          {/* ============================================
              SECTION 3: PROBLEM / EMPATHY
              ============================================ */}
          <section className="py-24 md:py-32 px-6 bg-surface-alt">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-12">
                Running a service business shouldn&apos;t feel this scattered.
              </h2>
              <div className="space-y-6 text-lg text-text-muted leading-relaxed">
                <p>
                  Most service professionals don&apos;t struggle with their craft.
                  <br />
                  They struggle with everything around it.
                </p>
                <ul className="space-y-2 text-text-muted">
                  <li>Pricing questions.</li>
                  <li>Endless emails and DMs.</li>
                  <li>Back-and-forth scheduling.</li>
                  <li>Explaining the same thing over and over.</li>
                  <li>A website that looks fine — but doesn&apos;t actually convert.</li>
                </ul>
                <p>
                  You shouldn&apos;t have to become a marketer, salesperson, or tech expert just to
                  book clients consistently.
                </p>
                <p className="text-text-primary font-medium">
                  HANDLED exists because this part of the job is broken — and it&apos;s been ignored
                  for too long.
                </p>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 4: SOLUTION OVERVIEW
              ============================================ */}
          <section className="py-24 md:py-32 px-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-12">
                We built the system most service businesses wish they had.
              </h2>
              <div className="space-y-6 text-lg text-text-muted leading-relaxed">
                <p>
                  HANDLED isn&apos;t a blank website builder.
                  <br />
                  And it&apos;s not another pile of disconnected tools.
                </p>
                <p>
                  It&apos;s an opinionated system designed around what actually works for service
                  businesses — grounded in real conversion research, proven pricing psychology, and
                  firsthand experience.
                </p>
                <p className="text-text-primary font-medium">
                  You bring what you do best.
                  <br />
                  We give you a storefront and booking flow that&apos;s already figured out.
                </p>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 5: CORE FEATURES
              ============================================ */}
          <section id="features" className="py-24 md:py-32 px-6 bg-surface-alt scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              <div className="grid md:grid-cols-3 gap-8">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="bg-surface rounded-2xl p-8 border border-neutral-800 hover:border-neutral-700 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl bg-sage/10 flex items-center justify-center mb-6">
                      <feature.icon className="w-6 h-6 text-sage" />
                    </div>
                    <h3 className="font-serif text-xl font-semibold text-text-primary mb-4">
                      {feature.title}
                    </h3>
                    <p className="text-text-muted leading-relaxed mb-4">{feature.description}</p>
                    {feature.bullets.length > 0 && (
                      <ul className="space-y-1">
                        {feature.bullets.map((bullet) => (
                          <li key={bullet} className="text-text-muted text-sm">
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 6: HOW IT WORKS
              ============================================ */}
          <section id="how-it-works" className="py-24 md:py-32 px-6 scroll-mt-20">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-16">
                How HANDLED fits into your business
              </h2>
              <div className="grid md:grid-cols-2 gap-8">
                {steps.map((step) => (
                  <div key={step.number} className="flex gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-sage/10 border border-sage/30 flex items-center justify-center">
                        <span className="text-sage font-semibold">{step.number}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-serif text-lg font-semibold text-text-primary mb-2">
                        {step.title}
                      </h3>
                      <p className="text-text-muted leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 6.5: MID-PAGE INTENT CTA (V2 NEW)
              ============================================ */}
          <section className="py-20 md:py-28 px-6 bg-surface-alt border-y border-neutral-800">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary mb-6">
                If this feels like how your business should work, you&apos;re ready.
              </h2>
              <p className="text-text-muted leading-relaxed mb-8">
                You don&apos;t need to optimize, configure, or experiment.
                <br />
                HANDLED gives you a proven structure — you make it yours.
              </p>
              <div className="flex flex-col items-center gap-3">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link href="/signup">Start your storefront</Link>
                </Button>
                <p className="text-text-muted text-sm">Try it free for 30 days.</p>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 7: AI (QUIET, HUMAN-FIRST)
              ============================================ */}
          <section className="py-24 md:py-32 px-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-sage/10 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-sage" />
                </div>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-8">
                Thoughtful automation — not cold software.
              </h2>
              <div className="space-y-6 text-lg text-text-muted leading-relaxed text-center">
                <p>
                  HANDLED uses intelligent assistance only where it helps: answering common
                  questions, guiding clients, and keeping things organized.
                </p>
                <p>
                  It doesn&apos;t replace you.
                  <br />
                  It supports you.
                </p>
                <p>
                  For clients who prefer self-service, it&apos;s there.
                  <br />
                  For clients who want a human touch, it knows when to step aside.
                </p>
                <p className="text-text-primary font-medium">
                  You don&apos;t need to &quot;learn AI&quot; to use HANDLED.
                  <br />
                  It works quietly in the background.
                </p>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 8: FLEXIBILITY
              ============================================ */}
          <section className="py-24 md:py-32 px-6 bg-surface-alt">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-8">
                One system. Many kinds of service businesses.
              </h2>
              <div className="space-y-6 text-lg text-text-muted leading-relaxed text-center">
                <p>
                  HANDLED is built for people who sell expertise, time, or experience — whether
                  that&apos;s one-on-one work, group sessions, or events.
                </p>
                <p>
                  Some businesses charge flat rates.
                  <br />
                  Some price by group size.
                  <br />
                  Some need add-ons, follow-ups, or custom details.
                </p>
                <p className="text-text-primary font-medium">
                  HANDLED adapts to how you work — without becoming complicated.
                </p>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 9: POST-BOOKING EXPERIENCE
              ============================================ */}
          <section className="py-24 md:py-32 px-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-sage/10 flex items-center justify-center">
                  <HeartHandshake className="w-7 h-7 text-sage" />
                </div>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-8">
                The relationship doesn&apos;t end at checkout.
              </h2>
              <div className="space-y-6 text-lg text-text-muted leading-relaxed text-center mb-10">
                <p>After booking, clients aren&apos;t left wondering what happens next.</p>
                <p>They get a shared page where they can:</p>
              </div>
              <div className="bg-surface-alt rounded-2xl p-8 border border-neutral-800 max-w-md mx-auto">
                <ul className="space-y-4">
                  {postBookingItems.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                      <span className="text-text-primary">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-center text-text-muted mt-10 text-lg">
                Everything stays organized, visible, and easy to manage — for both sides.
              </p>
            </div>
          </section>

          {/* ============================================
              SECTION 10: COMMUNITY
              ============================================ */}
          <section className="py-24 md:py-32 px-6 bg-surface-alt">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-sage/10 flex items-center justify-center">
                  <Users className="w-7 h-7 text-sage" />
                </div>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-8">
                You&apos;re not just getting a tool. You&apos;re joining a system.
              </h2>
              <div className="space-y-6 text-lg text-text-muted leading-relaxed text-center mb-10">
                <p>
                  HANDLED is built by people who&apos;ve run service businesses — and who care
                  deeply about where this work is heading.
                </p>
                <p>Members get access to:</p>
              </div>
              <div className="bg-surface rounded-2xl p-8 border border-neutral-800 max-w-lg mx-auto">
                <ul className="space-y-4">
                  {communityItems.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                      <span className="text-text-primary">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-center text-text-muted mt-10 text-lg">
                You don&apos;t have to engage to use HANDLED.
                <br />
                But it&apos;s there if you want to go deeper.
              </p>
            </div>
          </section>

          {/* ============================================
              SECTION 11: PRICING (3-TIER) - PSYCHOLOGY OPTIMIZED
              Implements: Anchoring, Decoy Effect, Elevated Popular Tier
              ============================================ */}
          <section id="pricing" className="py-24 md:py-32 px-6 scroll-mt-20">
            <div className="max-w-6xl mx-auto">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
                  Simple pricing. No guesswork.
                </h2>
                <p className="text-xl text-text-muted">
                  No contracts. No surprises. Cancel anytime.
                </p>
              </div>

              {/* 3-Tier Grid - pt-6 accommodates elevated badge */}
              <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-start pt-6">
                {tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className={`relative bg-surface-alt rounded-2xl p-8 border transition-all duration-300 ${
                      tier.isPopular
                        ? 'border-2 border-sage shadow-xl shadow-sage/20 md:-mt-4 md:scale-[1.02] z-10 ring-1 ring-sage/20'
                        : 'border-neutral-800 hover:shadow-xl hover:-translate-y-1 hover:border-sage/50'
                    }`}
                  >
                    {/* Elevated "Most Popular" badge */}
                    {tier.isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                        <span
                          className="inline-flex items-center gap-1.5 bg-sage text-white text-sm font-semibold px-4 py-1.5 rounded-full shadow-lg"
                          role="status"
                          aria-label="Most popular choice"
                        >
                          <Sparkles className="w-4 h-4" />
                          Most Popular
                        </span>
                      </div>
                    )}

                    <h3
                      className={`font-serif text-2xl font-bold text-text-primary ${tier.isPopular ? 'mt-2' : ''}`}
                    >
                      {tier.name}
                    </h3>
                    <p className="mt-1 text-text-muted text-sm">{tier.description}</p>

                    {/* Price with savings badge */}
                    <div className="mt-6">
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`font-bold text-text-primary ${tier.isPopular ? 'text-5xl' : 'text-4xl'}`}
                        >
                          {tier.price}
                        </span>
                        {tier.priceSubtext && (
                          <span className="text-text-muted">{tier.priceSubtext}</span>
                        )}
                      </div>
                      {tier.annualSavings && (
                        <div className="mt-2">
                          <span className="text-xs font-semibold text-sage bg-sage/15 px-2 py-1 rounded">
                            {tier.annualSavings}
                          </span>
                        </div>
                      )}
                    </div>

                    <ul className="mt-6 space-y-3">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                          <span className="text-text-primary text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA with arrow for popular tier */}
                    <Button
                      asChild
                      variant={tier.isPopular ? 'sage' : 'outline'}
                      className={`w-full mt-8 rounded-full py-5 ${
                        tier.isPopular ? 'shadow-lg hover:shadow-xl' : ''
                      }`}
                    >
                      <Link href={tier.ctaHref} className="flex items-center justify-center gap-2">
                        {tier.ctaText}
                        {tier.isPopular && <ArrowRight className="w-4 h-4" />}
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>

              {/* Fine print */}
              <p className="text-center text-text-muted text-sm mt-10">
                Try it free for 30 days. Pause when things slow down.
              </p>
            </div>
          </section>

          {/* ============================================
              SECTION 12: FAQ V2 (REPLACES ORIGINAL)
              ============================================ */}
          <section id="faq" className="py-24 md:py-32 px-6 bg-surface-alt scroll-mt-20">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary text-center mb-12">
                Common questions
              </h2>
              <div className="space-y-3">
                {faqsV2.map((faq, index) => (
                  <details
                    key={index}
                    className="group bg-surface rounded-xl border border-neutral-800 overflow-hidden"
                  >
                    <summary className="flex items-center justify-between cursor-pointer p-5 list-none">
                      <span className="font-medium text-text-primary pr-4">{faq.question}</span>
                      <ChevronDown className="w-5 h-5 text-text-muted flex-shrink-0 transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="px-5 pb-5 text-text-muted leading-relaxed">{faq.answer}</div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 13: FINAL CTA
              ============================================ */}
          <section className="py-32 md:py-40 px-6 border-t border-neutral-800">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-tight mb-8">
                Bring your passion.
                <br />
                <span className="text-sage">The rest is handled.</span>
              </h2>
              <p className="text-lg text-text-muted leading-relaxed mb-10 max-w-xl mx-auto">
                If your work matters to you, the way it&apos;s presented should too. HANDLED helps
                your business feel clearer, calmer, and more professional — without asking you to
                become someone you&apos;re not.
              </p>
              <Button
                asChild
                variant="sage"
                className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Link href="/signup">Get started</Link>
              </Button>
            </div>
          </section>
        </main>

        {/* ============================================
            FOOTER (with V2 Micro-Credibility Line)
            ============================================ */}
        <footer className="py-12 px-6 bg-neutral-900 border-t border-neutral-800">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="font-serif text-xl font-bold text-text-primary">HANDLED</div>
              <div className="flex items-center gap-6 text-sm text-text-muted">
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
            <div className="mt-8 pt-8 border-t border-neutral-800 text-center">
              {/* V2 Micro-Credibility Line */}
              <p className="text-sage text-sm font-medium mb-4">
                Built by people who&apos;ve run service businesses — not just software.
              </p>
              <p className="text-text-muted text-sm leading-relaxed">
                HANDLED — how service businesses should work in an AI-native world.
              </p>
              <p className="text-text-muted text-sm mt-2">
                Built for service professionals. Powered quietly.
              </p>
              <p className="text-text-muted/60 text-xs mt-4">
                © {new Date().getFullYear()} HANDLED. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
