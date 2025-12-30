import Link from 'next/link';
import { Metadata } from 'next';
import {
  Check,
  ChevronDown,
  Bot,
  ArrowRight,
  Clock,
  MessageSquare,
  CreditCard,
  ShieldCheck,
  Calendar,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'HANDLED - Bookings, Payments & AI Concierge for Service Businesses',
  description:
    'Turn your website into a calm, conversion-optimized storefront that answers questions, captures leads, and takes deposits — even while you sleep. For anyone who sells time, expertise, or experiences.',
  openGraph: {
    title: 'HANDLED - Bookings, Payments & AI Concierge for Service Businesses',
    description:
      'Turn your website into a calm, conversion-optimized storefront that answers questions, captures leads, and takes deposits — even while you sleep.',
    type: 'website',
  },
};

// Pricing tiers - LOCKED COPY
const tiers = [
  {
    name: 'Essentials',
    price: '$49',
    priceSubtext: '/month',
    description: 'For service pros ready to stop chasing payments.',
    features: [
      'Professional storefront',
      'Request-to-book flow',
      'Secure deposit collection',
      'Email notifications',
      'Mobile-optimized pages',
    ],
    ctaText: 'Get Started',
    ctaHref: '/signup?tier=essentials',
  },
  {
    name: 'Professional',
    price: '$149',
    priceSubtext: '/month',
    description: 'For service pros who want AI handling the back-and-forth.',
    features: [
      'Everything in Essentials',
      'AI concierge trained on your business',
      'FAQ automation',
      'Lead capture + follow-up',
      'Priority support',
    ],
    ctaText: 'Get Started',
    ctaHref: '/signup?tier=professional',
    isPopular: true,
  },
  {
    name: 'Concierge',
    price: 'Custom',
    priceSubtext: '',
    description: 'For service pros who want white-glove setup and ongoing support.',
    features: [
      'Everything in Professional',
      'White-glove setup',
      'Custom integrations',
      'Dedicated account manager',
      '1-on-1 strategy sessions',
    ],
    ctaText: 'Book a Call',
    ctaHref: '/contact',
  },
];

// FAQ data - LOCKED COPY with new question added
const faqs = [
  {
    question: 'What kind of businesses is this for?',
    answer:
      "Anyone who sells time, expertise, or experiences — photographers, coaches, therapists, consultants, trainers, wedding planners. If you're great at what you do but tired of the back-and-forth, we're for you.",
  },
  {
    question: 'Do I need to know anything about tech?',
    answer:
      "Nope. That's the point. We handle the tech so you can focus on what you're actually good at.",
  },
  {
    question: 'What if I already have a website?',
    answer:
      "We can work with it or help you migrate. Most members find our storefronts convert better because they're built for booking, not just information.",
  },
  {
    question: 'Is the AI chatbot going to sound like a robot?',
    answer:
      'No. We train it on your voice, your services, your style. It sounds like a helpful version of you — not a generic bot.',
  },
  {
    question: 'What happens if a customer has a complex question?',
    answer:
      "The AI knows its limits. For anything it can't handle, it flags you immediately. You stay in control of the relationship.",
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. No contracts, no cancellation fees, no guilt trips. We earn your business every month.',
  },
  {
    question: 'Can I use this seasonally or short-term?',
    answer:
      "Yes. HANDLED is month-to-month. Turn your storefront on when you need it and pause when you don't.",
  },
];

export default function HomePage() {
  // JSON-LD structured data for SEO
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'HANDLED',
    url: 'https://gethandled.ai',
    description:
      'Bookings, payments, and an AI concierge — built for service businesses. Turn your website into a calm, conversion-optimized storefront.',
    sameAs: [],
  };

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'HANDLED',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'Turn your website into a calm, conversion-optimized storefront that answers questions, captures leads, and takes deposits — even while you sleep.',
    offers: [
      {
        '@type': 'Offer',
        name: 'Essentials',
        description: 'Professional storefront, request-to-book flow, secure deposit collection',
        price: '49',
        priceCurrency: 'USD',
        priceValidUntil: '2026-12-31',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Professional',
        description: 'Everything in Essentials plus AI concierge, FAQ automation, lead capture',
        price: '149',
        priceCurrency: 'USD',
        priceValidUntil: '2026-12-31',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Concierge',
        description: 'White glove service with 1-on-1 strategy sessions, custom integrations',
        priceSpecification: {
          '@type': 'PriceSpecification',
          priceCurrency: 'USD',
        },
        availability: 'https://schema.org/InStock',
      },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
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
        <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-md border-b border-neutral-800">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-serif text-2xl font-bold text-text-primary">
              HANDLED
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="#how-it-works"
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                How It Works
              </Link>
              <Link
                href="#pricing"
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="#faq"
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                FAQ
              </Link>
              <Link
                href="/login"
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                Sign In
              </Link>
              <Button
                asChild
                variant="sage"
                className="rounded-full px-6"
                data-analytics-cta="nav-get-started"
              >
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
            {/* Mobile menu button */}
            <Button variant="ghost" className="md:hidden p-2">
              <span className="sr-only">Menu</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </Button>
          </div>
        </nav>

        <main>
          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 1: HERO
              LOCKED COPY - Do not modify
          ═══════════════════════════════════════════════════════════════════════ */}
          <section
            id="hero-section"
            className="relative pt-32 pb-24 md:pt-44 md:pb-36 px-6 overflow-hidden min-h-[85vh] flex flex-col justify-center"
          >
            {/* Ambient decorations */}
            <div
              className="absolute top-1/4 right-[15%] w-72 h-72 bg-sage/6 rounded-full blur-3xl pointer-events-none"
              aria-hidden="true"
            />
            <div
              className="absolute bottom-1/4 left-[10%] w-48 h-48 bg-sage/4 rounded-full blur-3xl pointer-events-none"
              aria-hidden="true"
            />

            <div className="relative max-w-4xl mx-auto text-center">
              {/* H1 - LOCKED COPY */}
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.1] tracking-tight">
                Bookings, payments, and an AI concierge — built for service businesses.
              </h1>

              {/* Subheadline - LOCKED COPY */}
              <p className="mt-8 text-xl md:text-2xl text-text-muted font-light max-w-3xl mx-auto leading-relaxed">
                Turn your website into a calm, conversion-optimized storefront that answers
                questions, captures leads, and takes deposits — even while you sleep.
              </p>

              {/* Dual CTAs - LOCKED COPY */}
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                  data-analytics-cta="hero-get-started"
                >
                  <Link href="/signup">Get Started</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full px-10 py-6 text-lg font-medium group"
                  data-analytics-cta="hero-see-how-it-works"
                >
                  <Link href="#how-it-works" className="flex items-center gap-2">
                    See how it works
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>

              {/* Microcopy - LOCKED COPY */}
              <p className="mt-6 text-sm text-text-muted">
                No tech skills. No Franken-stack. Set up in a day.
              </p>

              {/* Audience line - LOCKED COPY */}
              <p className="mt-4 text-base text-text-muted font-medium">
                For anyone who sells time, expertise, or experiences.
              </p>

              {/* Trust cue - LOCKED COPY */}
              <p className="mt-6 text-sm text-sage">
                Month-to-month. No commitment. Request-to-book with approval.
              </p>
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
              <div className="w-5 h-8 rounded-full border-2 border-neutral-600 flex items-start justify-center p-1.5">
                <div className="w-1 h-2 bg-neutral-500 rounded-full" />
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 2: PROOF BAR
              LOCKED COPY - Do not modify
          ═══════════════════════════════════════════════════════════════════════ */}
          <section
            id="proof-bar"
            className="py-16 md:py-20 px-6 bg-surface-alt border-y border-neutral-800"
          >
            <div className="max-w-5xl mx-auto">
              {/* Heading - LOCKED COPY */}
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary text-center mb-12 leading-tight">
                Built to reduce the &quot;am I making a mistake?&quot; feeling.
              </h2>

              {/* Proof points - LOCKED COPY */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-12">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-sage/15 flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-sage" />
                  </div>
                  <p className="text-text-primary font-medium">Save ~10 hours/week on admin</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-sage/15 flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="w-6 h-6 text-sage" />
                  </div>
                  <p className="text-text-primary font-medium">Fewer back-and-forth DMs</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-sage/15 flex items-center justify-center mx-auto mb-3">
                    <CreditCard className="w-6 h-6 text-sage" />
                  </div>
                  <p className="text-text-primary font-medium">Deposit-first booking flow</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-sage/15 flex items-center justify-center mx-auto mb-3">
                    <Bot className="w-6 h-6 text-sage" />
                  </div>
                  <p className="text-text-primary font-medium">AI answers FAQs instantly</p>
                </div>
              </div>

              {/* Testimonial placeholder - LOCKED COPY */}
              <div className="max-w-xl mx-auto">
                <blockquote className="text-center">
                  <p className="text-xl md:text-2xl text-text-muted font-light italic">
                    &quot;It finally feels calm to send people to my site.&quot;
                  </p>
                  <footer className="mt-4 text-text-muted">— Customer (placeholder)</footer>
                </blockquote>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 3: HOW IT WORKS
              LOCKED COPY - Do not modify
          ═══════════════════════════════════════════════════════════════════════ */}
          <section
            id="how-it-works"
            aria-labelledby="how-it-works-heading"
            className="py-32 md:py-40 px-6 bg-surface scroll-mt-20"
          >
            <div className="max-w-5xl mx-auto">
              {/* Section header - LOCKED COPY */}
              <div className="text-center mb-16">
                <h2
                  id="how-it-works-heading"
                  className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-tight"
                >
                  How it works
                </h2>
              </div>

              {/* Steps - LOCKED COPY */}
              <div className="grid md:grid-cols-3 gap-8">
                {/* Step 1 */}
                <div className="bg-surface-alt rounded-3xl p-8 border border-neutral-700 hover:border-sage/30 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sage font-mono text-sm font-bold">01</span>
                    <div className="w-10 h-10 rounded-xl bg-sage/15 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-sage" />
                    </div>
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-text-primary mb-3">
                    Your storefront explains everything
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    Visitors see clear packages, answers, and next steps — without chasing you in
                    DMs.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="bg-surface-alt rounded-3xl p-8 border border-neutral-700 hover:border-sage/30 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sage font-mono text-sm font-bold">02</span>
                    <div className="w-10 h-10 rounded-xl bg-sage/15 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-sage" />
                    </div>
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-text-primary mb-3">
                    Clients request a booking and pay a deposit
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    Pricing stays transparent. Deposits hold intent. You stay in control.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="bg-surface-alt rounded-3xl p-8 border border-neutral-700 hover:border-sage/30 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sage font-mono text-sm font-bold">03</span>
                    <div className="w-10 h-10 rounded-xl bg-sage/15 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-sage" />
                    </div>
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-text-primary mb-3">
                    You approve — and everything stays handled
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    Approve automatically or manually. If details change later, the system creates a
                    clean amendment and collects the difference.
                  </p>
                </div>
              </div>

              {/* Trust line - LOCKED COPY */}
              <div className="text-center mt-12">
                <p className="text-xl text-text-muted font-light">
                  No surprise invoices. No awkward follow-ups.
                </p>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 4: WHY HANDLED
              LOCKED COPY - Do not modify
          ═══════════════════════════════════════════════════════════════════════ */}
          <section
            id="why-handled"
            aria-labelledby="why-handled-heading"
            className="py-32 md:py-40 px-6 bg-surface-alt scroll-mt-20"
          >
            <div className="max-w-5xl mx-auto">
              {/* Section header - LOCKED COPY */}
              <div className="text-center mb-16">
                <h2
                  id="why-handled-heading"
                  className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-tight"
                >
                  Why HANDLED instead of duct-taping tools together?
                </h2>
              </div>

              {/* Two-column comparison */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* DIY Stack - LOCKED COPY */}
                <div className="bg-neutral-800/50 rounded-3xl p-8 border border-neutral-700">
                  <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-6">
                    The DIY Stack
                  </h3>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <X className="w-5 h-5 text-neutral-500 flex-shrink-0 mt-0.5" />
                      <span className="text-text-muted">A website builder</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-5 h-5 text-neutral-500 flex-shrink-0 mt-0.5" />
                      <span className="text-text-muted">A scheduler</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-5 h-5 text-neutral-500 flex-shrink-0 mt-0.5" />
                      <span className="text-text-muted">A payment link</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-5 h-5 text-neutral-500 flex-shrink-0 mt-0.5" />
                      <span className="text-text-muted">
                        A chatbot that doesn&apos;t know your business
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <X className="w-5 h-5 text-neutral-500 flex-shrink-0 mt-0.5" />
                      <span className="text-text-muted">
                        Manual follow-ups when anything changes
                      </span>
                    </li>
                  </ul>
                </div>

                {/* HANDLED - LOCKED COPY */}
                <div className="bg-sage/10 rounded-3xl p-8 border border-sage/30 relative overflow-hidden">
                  <div
                    className="absolute -top-20 -right-20 w-40 h-40 bg-sage/15 rounded-full blur-3xl pointer-events-none"
                    aria-hidden="true"
                  />
                  <div className="relative">
                    <h3 className="text-sm font-medium text-sage uppercase tracking-wide mb-6">
                      HANDLED
                    </h3>
                    <ul className="space-y-4">
                      <li className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                        <span className="text-text-primary">
                          One storefront built for service buyers
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                        <span className="text-text-primary">Request-to-book + deposits</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                        <span className="text-text-primary">
                          AI concierge trained on your offer + FAQs
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                        <span className="text-text-primary">Add-ons now or later</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                        <span className="text-text-primary">
                          Changes become amendments — not chaos
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Closing line - LOCKED COPY */}
              <div className="text-center mt-12">
                <p className="text-xl text-text-primary font-medium">
                  Service commerce isn&apos;t a cart. It&apos;s a trust workflow.
                </p>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 5: AI CONCIERGE
              LOCKED COPY - Do not modify
          ═══════════════════════════════════════════════════════════════════════ */}
          <section
            id="ai-concierge"
            aria-labelledby="ai-heading"
            className="py-32 md:py-40 px-6 bg-surface scroll-mt-20"
          >
            <div className="max-w-5xl mx-auto">
              {/* Section header - LOCKED COPY */}
              <div className="text-center mb-16">
                <span className="inline-block bg-sage/15 text-sage text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wide uppercase">
                  AI Concierge
                </span>
                <h2
                  id="ai-heading"
                  className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-tight"
                >
                  Meet your AI concierge
                </h2>
                <p className="mt-6 text-xl text-text-muted font-light max-w-2xl mx-auto">
                  It handles the common questions — so you don&apos;t have to.
                </p>
              </div>

              {/* Capabilities - LOCKED COPY */}
              <div className="max-w-2xl mx-auto mb-12">
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                    <span className="text-text-primary">Answers FAQs in your voice</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                    <span className="text-text-primary">Collects details when needed</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                    <span className="text-text-primary">
                      Guides clients to a deposit-backed request
                    </span>
                  </li>
                </ul>
              </div>

              {/* Guardrail - LOCKED COPY */}
              <div className="text-center mb-12">
                <p className="text-lg text-text-muted font-medium bg-neutral-800/50 rounded-full px-6 py-3 inline-block">
                  AI helps with the conversation. You stay in control.
                </p>
              </div>

              {/* Chat demo mockup - LOCKED TRANSCRIPT */}
              <div className="max-w-lg mx-auto">
                <div className="bg-surface-alt rounded-3xl p-6 border border-sage/30 shadow-2xl relative overflow-hidden">
                  <div
                    className="absolute -top-20 -right-20 w-40 h-40 bg-sage/15 rounded-full blur-3xl pointer-events-none"
                    aria-hidden="true"
                  />
                  <div className="relative space-y-3">
                    {/* Chat bubble - client */}
                    <div className="flex justify-end">
                      <div className="bg-neutral-700 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%]">
                        <p className="text-sm text-text-primary">
                          Hi! Do you have any Saturday availability next month?
                        </p>
                      </div>
                    </div>
                    {/* Chat bubble - AI */}
                    <div className="flex justify-start">
                      <div className="bg-sage/20 border border-sage/30 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                        <p className="text-sm text-text-primary">
                          Hi! Yes — I have openings on the 8th and 22nd. Are you looking for a full
                          session or a mini session?
                        </p>
                      </div>
                    </div>
                    {/* Chat bubble - client */}
                    <div className="flex justify-end">
                      <div className="bg-neutral-700 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%]">
                        <p className="text-sm text-text-primary">
                          Full session! What&apos;s included?
                        </p>
                      </div>
                    </div>
                    {/* Chat bubble - AI */}
                    <div className="flex justify-start">
                      <div className="bg-sage/20 border border-sage/30 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                        <p className="text-sm text-text-primary">
                          The full session is 2 hours, 40+ edited images, and an online gallery.
                          It&apos;s $450 with a $150 deposit to book. Want me to hold the 8th for
                          you?
                        </p>
                      </div>
                    </div>
                    {/* Chat bubble - client */}
                    <div className="flex justify-end">
                      <div className="bg-neutral-700 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%]">
                        <p className="text-sm text-text-primary">Yes please!</p>
                      </div>
                    </div>
                    {/* Chat bubble - AI */}
                    <div className="flex justify-start">
                      <div className="bg-sage/20 border border-sage/30 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                        <p className="text-sm text-text-primary">
                          Done! I&apos;ve sent a booking link to your email. Once the deposit is in,
                          you&apos;re confirmed for Saturday the 8th at 10am.
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* AI indicator */}
                  <div className="mt-4 pt-3 border-t border-neutral-700 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-sage" />
                    <span className="text-xs text-text-muted">
                      AI Concierge · Trained on your business
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 6: PRICING
              LOCKED COPY - Do not modify
          ═══════════════════════════════════════════════════════════════════════ */}
          <section
            id="pricing"
            aria-labelledby="pricing-heading"
            className="py-32 md:py-40 px-6 bg-surface-alt scroll-mt-20"
          >
            <div className="max-w-6xl mx-auto">
              {/* Section header - LOCKED COPY */}
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2
                  id="pricing-heading"
                  className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary"
                >
                  Simple plans. No long-term commitment.
                </h2>
                <p className="mt-4 text-xl md:text-2xl text-text-muted font-light">
                  Turn your storefront on when you need it. Pause it when you don&apos;t.
                </p>
              </div>

              {/* Pricing cards */}
              <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {tiers.map((tier) => (
                  <div
                    key={tier.name}
                    className={`bg-surface rounded-3xl p-8 shadow-lg border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col ${
                      tier.isPopular ? 'border-sage ring-2 ring-sage' : 'border-neutral-700'
                    }`}
                  >
                    {tier.isPopular && (
                      <span className="inline-block bg-sage text-white text-sm font-medium px-3 py-1 rounded-full mb-4 self-start">
                        Most Popular
                      </span>
                    )}
                    <h3 className="font-serif text-2xl font-bold text-text-primary">{tier.name}</h3>
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-text-primary">{tier.price}</span>
                      {tier.priceSubtext && (
                        <span className="text-text-muted">{tier.priceSubtext}</span>
                      )}
                    </div>
                    <p className="mt-3 text-text-muted text-sm">{tier.description}</p>
                    <ul className="mt-6 space-y-3 flex-1">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                          <span className="text-text-primary text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      asChild
                      variant={tier.isPopular ? 'sage' : 'outline'}
                      className="w-full mt-8 rounded-full py-5"
                      data-analytics-cta={`pricing-${tier.name.toLowerCase()}`}
                    >
                      <Link href={tier.ctaHref}>{tier.ctaText}</Link>
                    </Button>
                  </div>
                ))}
              </div>

              {/* Footnote - LOCKED COPY */}
              <div className="text-center mt-12">
                <p className="text-text-muted">Month-to-month. Upgrade or pause anytime.</p>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 7: OPTIONAL LEARNING
              LOCKED COPY - Do not modify
          ═══════════════════════════════════════════════════════════════════════ */}
          <section
            id="optional-learning"
            className="py-20 md:py-24 px-6 bg-surface border-y border-neutral-800"
          >
            <div className="max-w-3xl mx-auto text-center">
              {/* Heading - LOCKED COPY */}
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-4">
                Want to go deeper?
              </h2>

              {/* Copy - LOCKED COPY */}
              <p className="text-text-muted mb-8 max-w-xl mx-auto">
                Some customers like to learn what&apos;s working across the platform. Others never
                think about AI at all. Both are fine.
              </p>

              {/* Bullets - LOCKED COPY */}
              <ul className="space-y-3 text-left max-w-md mx-auto mb-8">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                  <span className="text-text-primary">Optional monthly AI roundtable</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                  <span className="text-text-primary">
                    Monthly newsletter highlighting what&apos;s working
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                  <span className="text-text-primary">
                    Zero impact on your storefront if you ignore it
                  </span>
                </li>
              </ul>

              {/* Note - LOCKED COPY */}
              <p className="text-sm text-text-muted italic">
                This is optional. Not required to use HANDLED.
              </p>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 8: FOUNDER / PHILOSOPHY
              Previously locked copy - preserved unchanged
          ═══════════════════════════════════════════════════════════════════════ */}
          <section id="founder" className="py-32 md:py-40 px-6 bg-surface">
            <div className="max-w-2xl mx-auto text-center">
              {/* Photo */}
              <img
                src="/mike-young.jpg"
                alt="Mike Young, Founder"
                className="w-40 h-40 md:w-48 md:h-48 rounded-full object-cover mx-auto mb-10 shadow-2xl ring-4 ring-sage/20"
              />
              {/* Story */}
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary mb-8 leading-tight">
                I built this because I needed it.
              </h2>
              <div className="space-y-6 text-lg text-text-muted leading-relaxed">
                <p>
                  I&apos;m a private chef, photographer, drone pilot, restaurant consultant —
                  basically, I can&apos;t sit still. ADHD brain. I love the work. I hate the admin.
                </p>
                <p>
                  When AI tools started getting good, I went deep. Built systems for my own
                  business. Then realized: every photographer, coach, and consultant I know is
                  drowning in the same stuff.
                </p>
                <p className="text-text-primary font-medium">
                  HANDLED is what I wish existed when I started. Professional presence. Smart tools.
                  None of the homework.
                </p>
              </div>
              <div className="mt-10">
                <p className="font-semibold text-text-primary text-lg">Mike Young</p>
                <p className="text-sage">Founder</p>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 9: FAQ
              LOCKED COPY - Do not modify (includes new seasonal question)
          ═══════════════════════════════════════════════════════════════════════ */}
          <section
            id="faq"
            aria-labelledby="faq-heading"
            className="py-32 md:py-40 px-6 bg-surface-alt scroll-mt-20"
          >
            <div className="max-w-3xl mx-auto">
              <h2
                id="faq-heading"
                className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary text-center mb-12"
              >
                Questions? Answers.
              </h2>
              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <details
                    key={index}
                    className="group bg-surface rounded-3xl border border-neutral-700 overflow-hidden"
                  >
                    <summary className="flex items-center justify-between cursor-pointer p-6 list-none">
                      <span className="font-medium text-text-primary pr-4">{faq.question}</span>
                      <ChevronDown className="w-5 h-5 text-text-muted flex-shrink-0 transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="px-6 pb-6 text-text-muted leading-relaxed">{faq.answer}</div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 10: FINAL CTA
              LOCKED COPY - Do not modify
          ═══════════════════════════════════════════════════════════════════════ */}
          <section className="py-32 md:py-48 px-6 bg-gradient-to-br from-neutral-800 to-neutral-900 border-t border-sage/20">
            <div className="max-w-3xl mx-auto text-center">
              {/* Heading - LOCKED COPY */}
              <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold leading-tight text-text-primary">
                Ready to simplify how you sell your service?
              </h2>

              {/* Subheading - LOCKED COPY */}
              <p className="mt-4 text-xl text-text-muted font-light">
                No commitment. No pressure. Just a better way to book.
              </p>

              {/* CTAs - LOCKED COPY */}
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-10 py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300"
                  data-analytics-cta="final-get-started"
                >
                  <Link href="/signup">Get Started</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full px-10 py-6 text-lg group"
                  data-analytics-cta="final-see-how-it-works"
                >
                  <Link href="#how-it-works" className="flex items-center gap-2">
                    See how it works
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </main>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECTION 11: FOOTER
        ═══════════════════════════════════════════════════════════════════════ */}
        <footer className="py-12 px-6 bg-text-primary text-white/60">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="font-serif text-xl font-bold text-white">HANDLED</div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/contact" className="hover:text-white transition-colors">
                Contact
              </Link>
            </div>
            <div className="text-sm">
              © {new Date().getFullYear()} HANDLED. All rights reserved.
            </div>
          </div>
        </footer>

        {/* ═══════════════════════════════════════════════════════════════════════
            SECTION 12: STICKY MOBILE CTA (mobile only)
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="fixed bottom-0 left-0 right-0 md:hidden bg-surface/95 backdrop-blur-md border-t border-neutral-800 p-4 z-40">
          <Button
            asChild
            variant="sage"
            className="w-full rounded-full py-4 text-base font-medium"
            data-analytics-cta="sticky-mobile-get-started"
          >
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
