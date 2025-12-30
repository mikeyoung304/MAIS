import Link from 'next/link';
import { Metadata } from 'next';
import {
  Check,
  ChevronDown,
  Bot,
  ArrowRight,
  CreditCard,
  Calendar,
  MessageCircle,
  ShieldCheck,
  X,
  Users,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'HANDLED - Booking Storefronts Your Customers Trust',
  description:
    'A storefront your customers actually trust. Pricing visible. Booking simple. Changes handled. Built for service professionals who value professionalism over hacks.',
  openGraph: {
    title: 'HANDLED - Booking Storefronts Your Customers Trust',
    description:
      'Your clients book. You get paid. Changes are handled. Built for photographers, coaches, therapists, and consultants.',
    type: 'website',
  },
};

// Pricing tiers with clearer naming and positioning
const tiers = [
  {
    name: 'Essentials',
    price: '$49',
    priceSubtext: '/month',
    tagline: 'Stop chasing payments.',
    description: 'For service pros who want a professional booking experience.',
    features: [
      'Professional storefront',
      'Online booking',
      'Secure payment processing',
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
    tagline: 'Stop answering the same questions.',
    description: 'For service pros who want AI to handle the back-and-forth.',
    features: [
      'Everything in Essentials',
      'AI chatbot trained on your business',
      'Monthly newsletter + calls',
      'Priority support',
      'Analytics dashboard',
    ],
    ctaText: 'Join Now',
    ctaHref: '/signup?tier=professional',
    isPopular: true,
  },
  {
    name: 'Concierge',
    price: 'Custom',
    priceSubtext: '',
    tagline: 'We do everything.',
    description: 'For service pros who want white-glove setup and support.',
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

// How it works steps
const howItWorksSteps = [
  {
    number: '01',
    title: 'They find your storefront',
    description: 'A clean, professional page that looks like yours. Not a generic template.',
    icon: Users,
  },
  {
    number: '02',
    title: 'They see pricing upfront',
    description: "No forms. No 'request a quote.' Just transparent pricing they can trust.",
    icon: CreditCard,
  },
  {
    number: '03',
    title: 'They book and pay',
    description: 'Deposit or full payment. You choose. Done in 60 seconds.',
    icon: Calendar,
  },
  {
    number: '04',
    title: 'Changes? Handled.',
    description: 'Reschedules, questions, follow-ups—the AI handles the back-and-forth.',
    icon: MessageCircle,
  },
];

// AI capabilities
const aiDoes = [
  'Answers FAQs about your services and availability',
  'Suggests open time slots that work for both parties',
  'Collects deposits and books appointments',
  'Follows up on incomplete bookings',
];

const aiDoesNot = [
  "Promise things you can't deliver",
  'Negotiate prices without your approval',
  'Handle sensitive complaints (humans do that)',
  "Make decisions you didn't authorize",
];

const faqs = [
  {
    question: 'What kind of businesses is this for?',
    answer:
      "Photographers, coaches, therapists, consultants, trainers, wedding planners — anyone who sells their time and expertise. If you're great at what you do but tired of the back-and-forth, we're for you.",
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
];

export default function HomePage() {
  // JSON-LD structured data for SEO
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'HANDLED',
    url: 'https://gethandled.ai',
    description:
      'Booking storefronts your customers trust. Visible pricing, simple booking, AI-assisted client communication for service professionals.',
    sameAs: [],
  };

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'HANDLED',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'A storefront your customers actually trust. Pricing visible. Booking simple. Changes handled.',
    offers: [
      {
        '@type': 'Offer',
        name: 'Essentials',
        description:
          'Professional storefront, online booking, payment processing, email notifications',
        price: '49',
        priceCurrency: 'USD',
        priceValidUntil: '2025-12-31',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Professional',
        description:
          'Everything in Essentials plus AI chatbot, monthly newsletter, monthly Zoom calls, priority support',
        price: '149',
        priceCurrency: 'USD',
        priceValidUntil: '2025-12-31',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Concierge',
        description:
          'White glove service with 1-on-1 strategy sessions, custom integrations, dedicated account manager',
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
              <Button asChild variant="sage" className="rounded-full px-6">
                <Link href="/signup">Start Your Storefront</Link>
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
              Outcome-driven headline, clear value prop, dual CTAs
          ═══════════════════════════════════════════════════════════════════════ */}
          <section className="relative pt-32 pb-24 md:pt-44 md:pb-36 px-6 overflow-hidden min-h-[85vh] flex flex-col justify-center">
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
              {/* Main headline - outcome focused */}
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.1] tracking-tight">
                Your clients book.
                <br />
                <span className="text-sage">You get paid.</span>
                <br />
                Changes are handled.
              </h1>

              {/* Subheadline - clear value prop */}
              <p className="mt-8 text-xl md:text-2xl text-text-muted font-light max-w-2xl mx-auto leading-relaxed">
                A storefront your customers actually trust. Pricing visible. Booking simple. No more
                back-and-forth.
              </p>

              {/* Dual CTAs */}
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link href="/signup">Start Your Storefront</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full px-10 py-6 text-lg font-medium group"
                >
                  <Link href="#how-it-works" className="flex items-center gap-2">
                    See how it works
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
              <div className="w-5 h-8 rounded-full border-2 border-neutral-600 flex items-start justify-center p-1.5">
                <div className="w-1 h-2 bg-neutral-500 rounded-full" />
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 2: TRUST & PROOF
              Social proof immediately after hero - establishes credibility
          ═══════════════════════════════════════════════════════════════════════ */}
          <section className="py-12 px-6 bg-surface-alt border-y border-neutral-800">
            <div className="max-w-5xl mx-auto">
              {/* Early-stage proof (before metrics) */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sage/15 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-sage" />
                  </div>
                  <span className="text-text-muted">
                    Built by a photographer tired of the tech treadmill
                  </span>
                </div>
                <div className="hidden md:block w-px h-8 bg-neutral-700" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sage/15 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-sage" />
                  </div>
                  <span className="text-text-muted">Questions? Humans who actually answer</span>
                </div>
              </div>

              {/* Placeholder for future metrics - uncomment when available
              <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 mt-8">
                <div className="text-center">
                  <p className="text-3xl font-bold text-text-primary">500+</p>
                  <p className="text-sm text-text-muted">Bookings processed</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-text-primary">$100K+</p>
                  <p className="text-sm text-text-muted">Payments handled</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-text-primary">50+</p>
                  <p className="text-sm text-text-muted">Service pros</p>
                </div>
              </div>
              */}
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 3: HOW IT WORKS
              4 clear steps that reduce purchase anxiety
          ═══════════════════════════════════════════════════════════════════════ */}
          <section
            id="how-it-works"
            aria-labelledby="how-it-works-heading"
            className="py-32 md:py-40 px-6 bg-surface scroll-mt-20"
          >
            <div className="max-w-5xl mx-auto">
              {/* Section header */}
              <div className="text-center mb-16">
                <h2
                  id="how-it-works-heading"
                  className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-tight"
                >
                  Here&apos;s how your clients experience it.
                </h2>
                <p className="mt-4 text-xl text-text-muted font-light max-w-2xl mx-auto">
                  Simple for them. Effortless for you.
                </p>
              </div>

              {/* Steps grid */}
              <div className="grid md:grid-cols-2 gap-6">
                {howItWorksSteps.map((step) => (
                  <div
                    key={step.number}
                    className="bg-surface-alt rounded-3xl p-8 border border-neutral-700 hover:border-sage/30 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <span className="text-sage font-mono text-sm font-bold">{step.number}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-sage/15 flex items-center justify-center">
                            <step.icon className="w-5 h-5 text-sage" />
                          </div>
                          <h3 className="font-serif text-xl font-semibold text-text-primary">
                            {step.title}
                          </h3>
                        </div>
                        <p className="text-text-muted leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Transition CTA */}
              <div className="text-center mt-12">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-10 py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300 group"
                >
                  <Link href="#why-handled" className="flex items-center gap-2">
                    See why pros are switching
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 4: VALUE STACK (Why HANDLED vs Alternatives)
              Clear differentiation without being aggressive
          ═══════════════════════════════════════════════════════════════════════ */}
          <section
            id="why-handled"
            aria-labelledby="why-handled-heading"
            className="py-32 md:py-40 px-6 bg-surface-alt scroll-mt-20"
          >
            <div className="max-w-5xl mx-auto">
              {/* Section header */}
              <div className="text-center mb-16">
                <h2
                  id="why-handled-heading"
                  className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-tight"
                >
                  Why service pros are switching.
                </h2>
                <p className="mt-4 text-xl text-text-muted font-light max-w-2xl mx-auto">
                  We&apos;re not another booking tool. We&apos;re the experience your customers wish
                  you had.
                </p>
              </div>

              {/* Comparison table - mobile-friendly card version */}
              <div className="space-y-6">
                {/* Comparison header - desktop only */}
                <div className="hidden md:grid md:grid-cols-4 gap-4 px-6 py-3">
                  <div className="text-text-muted text-sm font-medium">What matters</div>
                  <div className="text-text-muted text-sm font-medium text-center">DIY Website</div>
                  <div className="text-text-muted text-sm font-medium text-center">
                    Calendly + Stripe
                  </div>
                  <div className="text-sage text-sm font-medium text-center">HANDLED</div>
                </div>

                {/* Comparison rows */}
                {[
                  {
                    feature: 'Pricing visible to customers',
                    diy: 'Hidden behind forms',
                    calendly: 'Separate link',
                    handled: 'Built into the page',
                  },
                  {
                    feature: 'Customer trusts the experience',
                    diy: 'Generic template',
                    calendly: 'Feels fragmented',
                    handled: 'Premium, branded',
                  },
                  {
                    feature: 'Handle reschedules & questions',
                    diy: 'Manual email chains',
                    calendly: 'Manual updates',
                    handled: 'AI handles it',
                  },
                  {
                    feature: 'Booking + payments together',
                    diy: 'Separate systems',
                    calendly: 'Stripe integration',
                    handled: 'All-in-one',
                  },
                ].map((row, index) => (
                  <div
                    key={index}
                    className="bg-surface rounded-2xl border border-neutral-700 overflow-hidden"
                  >
                    {/* Mobile view */}
                    <div className="md:hidden p-6 space-y-4">
                      <h3 className="font-medium text-text-primary">{row.feature}</h3>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center">
                          <p className="text-text-muted text-xs mb-1">DIY</p>
                          <p className="text-neutral-400">{row.diy}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-text-muted text-xs mb-1">Cal+Stripe</p>
                          <p className="text-neutral-400">{row.calendly}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sage text-xs mb-1">HANDLED</p>
                          <p className="text-sage font-medium">{row.handled}</p>
                        </div>
                      </div>
                    </div>
                    {/* Desktop view */}
                    <div className="hidden md:grid md:grid-cols-4 gap-4 p-6 items-center">
                      <div className="font-medium text-text-primary">{row.feature}</div>
                      <div className="text-neutral-400 text-center">{row.diy}</div>
                      <div className="text-neutral-400 text-center">{row.calendly}</div>
                      <div className="text-sage text-center font-medium flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" />
                        {row.handled}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 5: AI DIFFERENTIATION
              Human-first AI positioning - explains guardrails and control
          ═══════════════════════════════════════════════════════════════════════ */}
          <section
            id="ai-assistant"
            aria-labelledby="ai-heading"
            className="py-32 md:py-40 px-6 bg-surface scroll-mt-20"
          >
            <div className="max-w-5xl mx-auto">
              {/* Section header */}
              <div className="text-center mb-16">
                <span className="inline-block bg-sage/15 text-sage text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wide uppercase">
                  Your AI Assistant
                </span>
                <h2
                  id="ai-heading"
                  className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-tight"
                >
                  An AI that knows when to help—
                  <br />
                  <span className="text-sage">and when to ask.</span>
                </h2>
                <p className="mt-6 text-xl text-text-muted font-light max-w-2xl mx-auto">
                  Your customers get answers instantly. You stay in control of what matters.
                </p>
              </div>

              {/* Two-column comparison */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* What AI does */}
                <div className="bg-sage/10 rounded-3xl p-8 border border-sage/30 relative overflow-hidden">
                  <div
                    className="absolute -top-20 -right-20 w-40 h-40 bg-sage/15 rounded-full blur-3xl pointer-events-none"
                    aria-hidden="true"
                  />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-sage" />
                      </div>
                      <span className="text-sm font-medium text-sage uppercase tracking-wide">
                        What the AI does
                      </span>
                    </div>
                    <ul className="space-y-4">
                      {aiDoes.map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                          <span className="text-text-primary">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* What AI doesn't do */}
                <div className="bg-neutral-800/50 rounded-3xl p-8 border border-neutral-700">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-neutral-400" />
                    </div>
                    <span className="text-sm font-medium text-neutral-400 uppercase tracking-wide">
                      What it doesn&apos;t do
                    </span>
                  </div>
                  <ul className="space-y-4">
                    {aiDoesNot.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <X className="w-5 h-5 text-neutral-500 flex-shrink-0 mt-0.5" />
                        <span className="text-text-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Closing statement */}
              <div className="text-center mt-12">
                <p className="text-xl text-text-muted font-light max-w-2xl mx-auto">
                  It&apos;s like having a helpful assistant who knows exactly where the boundaries
                  are.
                </p>
              </div>

              {/* Chat demo mockup */}
              <div className="mt-12 max-w-lg mx-auto">
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
                          Do you have Saturday availability?
                        </p>
                      </div>
                    </div>
                    {/* Chat bubble - AI */}
                    <div className="flex justify-start">
                      <div className="bg-sage/20 border border-sage/30 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                        <p className="text-sm text-text-primary">
                          Yes! I have 10am and 2pm open. The 2-hour session is $350. Want me to book
                          one?
                        </p>
                      </div>
                    </div>
                    {/* Chat bubble - client */}
                    <div className="flex justify-end">
                      <div className="bg-neutral-700 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%]">
                        <p className="text-sm text-text-primary">2pm works!</p>
                      </div>
                    </div>
                    {/* Chat bubble - AI */}
                    <div className="flex justify-start">
                      <div className="bg-sage/20 border border-sage/30 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                        <p className="text-sm text-text-primary">
                          Done! Confirmation sent. See you Saturday at 2pm.
                        </p>
                      </div>
                    </div>
                  </div>
                  {/* AI indicator */}
                  <div className="mt-4 pt-3 border-t border-neutral-700 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-sage" />
                    <span className="text-xs text-text-muted">
                      AI Assistant · Trained on your business
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 6: PRICING
              Clear tiers with better naming and positioning
          ═══════════════════════════════════════════════════════════════════════ */}
          <section
            id="pricing"
            aria-labelledby="pricing-heading"
            className="py-32 md:py-40 px-6 bg-surface-alt scroll-mt-20"
          >
            <div className="max-w-6xl mx-auto">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2
                  id="pricing-heading"
                  className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary"
                >
                  Choose what works.
                </h2>
                <p className="mt-4 text-xl md:text-2xl text-text-muted font-light">
                  No contracts. Cancel anytime. Pricing that makes sense.
                </p>
              </div>
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
                    <p className="mt-1 text-sage text-sm font-medium">{tier.tagline}</p>
                    <div className="mt-6">
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
                    >
                      <Link href={tier.ctaHref}>{tier.ctaText}</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 7: FOUNDER STORY
              Humanizes the product - unchanged from original (works well)
          ═══════════════════════════════════════════════════════════════════════ */}
          <section className="py-32 md:py-40 px-6 bg-surface">
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
              SECTION 8: FAQ
              Unchanged structure - works well with accordion
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
              SECTION 9: FINAL CTA
              Calm, confident close - no urgency tricks
          ═══════════════════════════════════════════════════════════════════════ */}
          <section className="py-32 md:py-48 px-6 bg-gradient-to-br from-neutral-800 to-neutral-900 border-t border-sage/20">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold leading-tight text-text-primary">
                Do what you love.
              </h2>
              <p className="mt-4 text-2xl text-sage font-serif">The rest is handled.</p>
              <Button
                asChild
                variant="sage"
                className="mt-10 rounded-full px-10 py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Link href="/signup">Start Your Storefront</Link>
              </Button>
              <p className="mt-6 text-text-muted">
                No contracts. No tech to learn. Just book your first client.
              </p>
            </div>
          </section>
        </main>

        {/* ═══════════════════════════════════════════════════════════════════════
            FOOTER
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
            MOBILE STICKY CTA
            Fixed bottom bar on mobile for constant conversion opportunity
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="fixed bottom-0 left-0 right-0 md:hidden bg-surface/95 backdrop-blur-md border-t border-neutral-800 p-4 z-40">
          <Button asChild variant="sage" className="w-full rounded-full py-4 text-base font-medium">
            <Link href="/signup">Start Your Storefront</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
