import Link from 'next/link';
import { Metadata } from 'next';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Sparkles,
  BookOpen,
  Camera,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectHubMockup } from '@/components/home/ProjectHubMockup';
import { MobileNav } from '@/components/home/MobileNav';

export const metadata: Metadata = {
  title: "Handled — Your business shouldn't forget people.",
  description:
    'Handled gives every client a shared Project Hub and builds curated Client Memory over time—so projects run cleanly and repeat clients never have to start over.',
  openGraph: {
    title: "Handled — Your business shouldn't forget people.",
    description:
      'Handled gives every client a shared Project Hub and builds curated Client Memory over time—so projects run cleanly and repeat clients never have to start over.',
    type: 'website',
  },
};

// FAQ aligned with Project Hub + Client Memory wedge
const faqs = [
  {
    question: 'Is this just a chatbot?',
    answer:
      "No. The chatbot is the interface. The product is the Project Hub and Client Memory—so details don't get lost and repeat clients don't start over.",
  },
  {
    question: 'Do clients have to use it?',
    answer:
      'Clients get a simple link. Many prefer it to texting because it remembers context and keeps everything in one place.',
  },
  {
    question: 'What does Handled remember?',
    answer:
      "Only what's useful. Memory is curated and controlled by the business, with clear boundaries and summaries—not raw noise.",
  },
  {
    question: 'Can I control what clients can do?',
    answer:
      'Yes. Businesses can enable or disable Hub capabilities and decide what requires approval.',
  },
  {
    question: 'Does this replace my website?',
    answer:
      'Handled can power your storefront and booking—but the biggest difference is what happens after booking: the shared Hub.',
  },
];

// Pricing tiers reframed for continuity/memory
const tiers = [
  {
    id: 'foundation',
    name: 'The Foundation',
    price: '$49',
    priceSubtext: '/month',
    description: 'Project Hub + booking + payments',
    annualSavings: 'Save $118/year',
    features: [
      'Project Hub for every client',
      'Online booking & payments',
      'Done-for-you website',
      'Client communication in one place',
      'Email notifications',
    ],
    ctaText: 'Try the Hub',
    ctaHref: '/signup?tier=handled',
    isPopular: false,
  },
  {
    id: 'system',
    name: 'The System',
    price: '$149',
    priceSubtext: '/month',
    description: 'Client Memory + AI summaries + customization',
    annualSavings: 'Save $358/year',
    features: [
      'Everything in Foundation',
      'Client Memory that compounds',
      'AI summaries & escalation',
      'Smart reminders',
      'Priority support',
      'Custom branding',
    ],
    ctaText: 'Get started',
    ctaHref: '/signup?tier=fully-handled',
    isPopular: true,
  },
  {
    id: 'partnership',
    name: 'The Partnership',
    price: "Let's talk",
    priceSubtext: '',
    description: 'We build it. You focus on clients.',
    annualSavings: null,
    features: [
      'Everything in The System',
      'Custom automations',
      'Voice agents',
      '1-on-1 strategy sessions',
      'We build it for you',
      'Dedicated account manager',
    ],
    ctaText: 'Book a Call',
    ctaHref: '/contact',
    isPopular: false,
  },
];

// Client Memory example cards
const memoryExamples = [
  {
    icon: BookOpen,
    title: 'Tutoring',
    body: "Pick up where you left off. Remember what clicked, what didn't, and what to focus on next time.",
  },
  {
    icon: UtensilsCrossed,
    title: 'Catering',
    body: 'See what was served before, what was loved, and rebook with adjustments—without starting from scratch.',
  },
  {
    icon: Camera,
    title: 'Photography',
    body: 'Carry forward context that affects the session—so families feel seen and supported.',
  },
];

// How it works steps
const steps = [
  {
    number: '1',
    title: 'Book',
    body: 'A client books and gets a Project Hub automatically.',
  },
  {
    number: '2',
    title: 'Collaborate',
    body: 'Clients ask questions, upload files, and request changes inside the Hub.',
  },
  {
    number: '3',
    title: 'Remember',
    body: 'Handled summarizes the project and carries the right details forward—so next time is easier.',
  },
];

export default function HomePage() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Handled',
    url: 'https://gethandled.ai',
    description:
      'Handled gives every client a shared Project Hub and builds curated Client Memory over time—so projects run cleanly and repeat clients never have to start over.',
    sameAs: [],
  };

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Handled',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'Continuity infrastructure for service businesses. Project Hub and Client Memory that makes repeat business effortless.',
    offers: {
      '@type': 'Offer',
      description: 'Month-to-month subscription with 14-day free trial',
      availability: 'https://schema.org/InStock',
    },
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
        {/* ============================================
            SECTION 0 — NAV
            ============================================ */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-md border-b border-neutral-800">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-serif text-2xl font-bold text-text-primary">
              Handled
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="#how-it-works"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                Product
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
                Login
              </Link>
              <Button asChild variant="sage" className="rounded-full px-6 py-2">
                <Link href="/signup">Get started</Link>
              </Button>
            </div>
            <MobileNav />
          </div>
        </nav>

        <main>
          {/* ============================================
              SECTION 1 — HERO (H1)
              ============================================ */}
          <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.1] tracking-tight">
                Your business shouldn&apos;t forget people.
              </h1>
              <p className="mt-8 text-lg md:text-xl text-text-muted leading-relaxed max-w-2xl mx-auto">
                Handled is the continuity layer for service businesses. Every booking gets a shared
                Project Hub—and over time, Handled builds Client Memory so repeat clients don&apos;t
                have to explain themselves again.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-8 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="text-text-muted hover:text-text-primary rounded-full px-8 py-6 text-lg group"
                >
                  <Link href="/signup" className="flex items-center gap-2">
                    Get started
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
              <p className="mt-6 text-sm text-text-muted">
                Calm systems. Real memory. Fewer things to worry about.
              </p>
            </div>
          </section>

          {/* ============================================
              SECTION 2 — RECOGNITION (THE PAIN)
              ============================================ */}
          <section className="py-24 md:py-32 px-6 bg-surface-alt">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-12">
                Every booking resets the relationship.
              </h2>
              <div className="space-y-6 text-lg text-text-muted leading-relaxed">
                <p>Most software treats each job like the first time.</p>
                <p>
                  So you end up re-asking the same questions, relearning preferences, and hoping
                  nothing important slips through.
                </p>
                <p>
                  Clients notice—not because you don&apos;t care, but because your tools don&apos;t
                  remember what matters.
                </p>
              </div>
              <div className="mt-10 grid sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                {[
                  '"What did we do last time?"',
                  '"Any allergies / preferences again?"',
                  '"Where did we talk about that change?"',
                  '"Can you resend that?"',
                ].map((quote) => (
                  <div
                    key={quote}
                    className="bg-surface rounded-xl p-4 border border-neutral-800 text-center"
                  >
                    <p className="text-text-muted italic">{quote}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 3 — THE REAL COST
              ============================================ */}
          <section className="py-24 md:py-32 px-6">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-8">
                Forgetting creates friction.
                <br />
                Remembering creates trust.
              </h2>
              <div className="space-y-6 text-lg text-text-muted leading-relaxed">
                <p>
                  When details get lost, confidence erodes quietly—through extra back-and-forth,
                  small mistakes, and avoidable stress.
                </p>
                <p className="text-text-primary font-medium">
                  The best service businesses don&apos;t just execute well. They remember well.
                </p>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 4 — CATEGORY DEFINITION (WHAT HANDLED IS)
              ============================================ */}
          <section className="py-24 md:py-32 px-6 bg-surface-alt">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-8">
                Handled is institutional memory for your business.
              </h2>
              <div className="space-y-6 text-lg text-text-muted leading-relaxed text-center mb-12">
                <p>Handled doesn&apos;t just manage bookings.</p>
                <p>
                  It carries context forward—so every interaction builds on the last instead of
                  starting over.
                </p>
              </div>
              {/* Kill shot - styled as standout callout */}
              <div className="bg-surface rounded-2xl p-8 border border-sage/30 shadow-lg shadow-sage/5">
                <p className="text-lg md:text-xl text-text-primary leading-relaxed text-center font-medium">
                  Handled is the system that remembers your clients, carries context forward, and
                  makes it impossible for important details to get lost — even over years.
                </p>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 5 — THE PROJECT HUB (THE WEDGE)
              ============================================ */}
          <section id="project-hub" className="py-24 md:py-32 px-6 scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              <div className="max-w-3xl mx-auto text-center mb-16">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-8">
                  Every client gets a shared Project Hub.
                </h2>
                <div className="space-y-6 text-lg text-text-muted leading-relaxed">
                  <p>
                    After booking, clients enter a shared space where everything lives: questions,
                    changes, files, preferences, and decisions.
                  </p>
                  <p>
                    Instead of scattered texts and email threads, the Project Hub becomes the single
                    source of truth.
                  </p>
                </div>
              </div>

              {/* Project Hub Mockup */}
              <ProjectHubMockup />

              {/* Mini list */}
              <div className="mt-12 max-w-md mx-auto">
                <ul className="space-y-4">
                  {[
                    'Clients ask for changes without interrupting you',
                    'AI organizes requests into clear proposals',
                    'History stays searchable forever',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                      <span className="text-text-primary">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 6 — CLIENT MEMORY (REPEAT CLIENTS)
              ============================================ */}
          <section className="py-24 md:py-32 px-6 bg-surface-alt">
            <div className="max-w-5xl mx-auto">
              <div className="max-w-3xl mx-auto text-center mb-16">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-8">
                  Repeat clients don&apos;t repeat themselves.
                </h2>
                <p className="text-lg text-text-muted leading-relaxed">
                  Handled learns what matters—taste, preferences, constraints, and context—so the
                  next project starts with understanding, not re-explaining.
                </p>
              </div>

              {/* Example cards */}
              <div className="grid md:grid-cols-3 gap-6">
                {memoryExamples.map((example) => (
                  <div
                    key={example.title}
                    className="bg-surface rounded-2xl p-8 border border-neutral-800 hover:border-sage/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                  >
                    <div className="w-12 h-12 rounded-xl bg-sage/10 flex items-center justify-center mb-6">
                      <example.icon className="w-6 h-6 text-sage" />
                    </div>
                    <h3 className="font-serif text-xl font-semibold text-text-primary mb-3">
                      {example.title}
                    </h3>
                    <p className="text-text-muted leading-relaxed">{example.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 7 — AI (DE-HYPED, TRUST-BASED)
              ============================================ */}
          <section className="py-24 md:py-32 px-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-sage/10 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-sage" />
                </div>
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-8">
                AI that remembers.
                <br />
                Silence that respects.
              </h2>
              <div className="space-y-6 text-lg text-text-muted leading-relaxed text-center mb-12">
                <p>
                  Handled&apos;s AI curates memory, batches updates, and escalates only what needs
                  your attention.
                </p>
                <p className="text-text-primary font-medium">
                  No prompt babysitting. No notification spam. Just a system that keeps projects
                  clean.
                </p>
              </div>

              {/* Bullets */}
              <div className="max-w-md mx-auto">
                <ul className="space-y-4">
                  {[
                    'Summaries instead of interruptions',
                    'Proposals instead of messy messages',
                    "Human control over what's saved",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                      <span className="text-text-primary">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 8 — HOW IT WORKS (3 STEPS, SIMPLE)
              ============================================ */}
          <section id="how-it-works" className="py-24 md:py-32 px-6 bg-surface-alt scroll-mt-20">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-16">
                How it works
              </h2>
              <div className="grid md:grid-cols-3 gap-8">
                {steps.map((step) => (
                  <div key={step.number} className="text-center">
                    <div className="w-16 h-16 rounded-full bg-sage/10 border border-sage/30 flex items-center justify-center mx-auto mb-6">
                      <span className="text-sage font-serif text-2xl font-bold">{step.number}</span>
                    </div>
                    <h3 className="font-serif text-2xl font-semibold text-text-primary mb-4">
                      {step.title}
                    </h3>
                    <p className="text-text-muted leading-relaxed">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 9 — PRICING (REFRAMED)
              ============================================ */}
          <section id="pricing" className="py-24 md:py-32 px-6 scroll-mt-20">
            <div className="max-w-6xl mx-auto">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
                  Simple pricing. Compounding value.
                </h2>
                <p className="text-lg text-text-muted">
                  The first booking is cleaner. The tenth is effortless—because the system
                  remembers.
                </p>
              </div>

              {/* 3-Tier Grid */}
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

                    <Button
                      asChild
                      variant={tier.isPopular ? 'sage' : 'outline'}
                      className={`w-full mt-8 rounded-full py-5 ${
                        tier.isPopular
                          ? 'shadow-lg hover:shadow-xl'
                          : 'border-sage/50 text-sage hover:bg-sage/10 hover:border-sage'
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

              {/* CTAs under pricing */}
              <div className="text-center mt-12">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    asChild
                    variant="sage"
                    className="rounded-full px-8 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <Link href="#how-it-works">See how it works</Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    className="text-text-muted hover:text-text-primary rounded-full px-8 py-6 text-lg group"
                  >
                    <Link href="/signup" className="flex items-center gap-2">
                      Get started
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 10 — FAQ
              ============================================ */}
          <section id="faq" className="py-24 md:py-32 px-6 bg-surface-alt scroll-mt-20">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary text-center mb-12">
                FAQ
              </h2>
              <div className="space-y-3">
                {faqs.map((faq, index) => (
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
              SECTION 11 — FINAL CTA (CLOSE)
              ============================================ */}
          <section className="py-32 md:py-40 px-6 border-t border-neutral-800">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-tight mb-8">
                Nothing important should ever have to be remembered manually.
              </h2>
              <p className="text-lg text-text-muted leading-relaxed mb-10 max-w-xl mx-auto">
                Handled gives you a system that remembers people, keeps projects clean, and makes
                repeat business feel effortless.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="text-text-muted hover:text-text-primary rounded-full px-8 py-6 text-lg group"
                >
                  <Link href="/signup" className="flex items-center gap-2">
                    Get started
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </main>

        {/* ============================================
            FOOTER
            ============================================ */}
        <footer className="py-12 px-6 bg-neutral-900 border-t border-neutral-800">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="font-serif text-xl font-bold text-text-primary">Handled</div>
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
              <p className="text-text-muted text-sm leading-relaxed">
                Continuity infrastructure for service businesses.
              </p>
              <p className="text-text-muted/60 text-xs mt-4">
                © {new Date().getFullYear()} Handled. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
