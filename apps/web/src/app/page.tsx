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
    'The continuity layer for service businesses. Project Hub and Client Memory that compounds over time.',
  openGraph: {
    title: "Handled — Your business shouldn't forget people.",
    description:
      'The continuity layer for service businesses. Project Hub and Client Memory that compounds over time.',
    type: 'website',
  },
};

const faqs = [
  {
    question: 'Is this just a chatbot?',
    answer: 'The chatbot is the interface. The product is the Project Hub and Client Memory.',
  },
  {
    question: 'Do clients have to use it?',
    answer: 'They get a link. Most prefer it to texting.',
  },
  {
    question: 'What does Handled remember?',
    answer: 'What matters. Memory is curated by the business.',
  },
  {
    question: 'Can I control what clients can do?',
    answer: 'Yes. You decide what the Hub includes.',
  },
  {
    question: 'Does this replace my website?',
    answer: 'Handled powers storefronts and booking. The difference is what happens after.',
  },
];

const tiers = [
  {
    id: 'foundation',
    name: 'The Foundation',
    price: '$49',
    priceSubtext: '/month',
    description: 'Project Hub. Booking. Payments.',
    annualSavings: 'Save $118/year',
    features: [
      'Project Hub for every client',
      'Online booking & payments',
      'Done-for-you website',
      'All communication in one place',
    ],
    ctaText: 'Start here',
    ctaHref: '/signup?tier=handled',
    isPopular: false,
  },
  {
    id: 'system',
    name: 'The System',
    price: '$149',
    priceSubtext: '/month',
    description: 'Client Memory. Context that compounds.',
    annualSavings: 'Save $358/year',
    features: ['Everything in Foundation', 'Client Memory', 'AI summaries', 'Priority support'],
    ctaText: 'Get started',
    ctaHref: '/signup?tier=fully-handled',
    isPopular: true,
  },
  {
    id: 'partnership',
    name: 'The Partnership',
    price: "Let's talk",
    priceSubtext: '',
    description: 'We build it. You run it.',
    annualSavings: null,
    features: [
      'Everything in The System',
      'Custom automations',
      'Voice agents',
      'Dedicated support',
    ],
    ctaText: 'Book a call',
    ctaHref: '/contact',
    isPopular: false,
  },
];

const memoryExamples = [
  {
    icon: BookOpen,
    title: 'Tutoring',
    body: 'Start where you left off.',
  },
  {
    icon: UtensilsCrossed,
    title: 'Catering',
    body: 'Remember what worked.',
  },
  {
    icon: Camera,
    title: 'Photography',
    body: 'Context carries forward.',
  },
];

const steps = [
  {
    number: '1',
    title: 'Book',
    body: 'Client books. Hub appears.',
  },
  {
    number: '2',
    title: 'Collaborate',
    body: 'Files, questions, changes—one place.',
  },
  {
    number: '3',
    title: 'Remember',
    body: 'Details carry forward.',
  },
];

export default function HomePage() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Handled',
    url: 'https://gethandled.ai',
    description: 'The continuity layer for service businesses.',
    sameAs: [],
  };

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Handled',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'Continuity infrastructure for service businesses.',
    offers: {
      '@type': 'Offer',
      description: 'Month-to-month subscription',
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
        {/* NAV */}
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
          {/* HERO */}
          <section className="relative pt-36 pb-28 md:pt-48 md:pb-40 px-6">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.1] tracking-tight">
                Your business shouldn&apos;t forget people.
              </h1>
              <p className="mt-10 text-xl md:text-2xl text-text-muted leading-relaxed max-w-xl mx-auto">
                Handled is the continuity layer for service businesses.
              </p>
              <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4">
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
          </section>

          {/* RECOGNITION */}
          <section className="py-32 md:py-40 px-6 bg-surface-alt">
            <div className="max-w-xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-10">
                Every booking resets the relationship.
              </h2>
              <p className="text-lg text-text-muted leading-relaxed">
                Most software treats each job like the first time. Clients notice.
              </p>
            </div>
          </section>

          {/* THE COST */}
          <section className="py-32 md:py-40 px-6">
            <div className="max-w-xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight">
                Forgetting creates friction.
                <br />
                Remembering creates trust.
              </h2>
            </div>
          </section>

          {/* WHAT HANDLED IS */}
          <section className="py-32 md:py-40 px-6 bg-surface-alt">
            <div className="max-w-xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-16">
                Handled is institutional memory for your business.
              </h2>
              <div className="bg-surface rounded-2xl p-10 border border-sage/30 shadow-lg shadow-sage/5">
                <p className="text-lg md:text-xl text-text-primary leading-relaxed font-medium">
                  The system that remembers clients, carries context forward, and makes it
                  impossible for important details to get lost.
                </p>
              </div>
            </div>
          </section>

          {/* PROJECT HUB */}
          <section id="project-hub" className="py-32 md:py-40 px-6 scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              <div className="max-w-xl mx-auto text-center mb-20">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-8">
                  Once someone books, this becomes the relationship.
                </h2>
                <p className="text-lg text-text-muted">
                  One shared space. Everything in one place.
                </p>
              </div>

              <ProjectHubMockup />

              <p className="mt-16 text-center text-sm text-text-muted">
                The single source of truth.
              </p>
            </div>
          </section>

          {/* CLIENT MEMORY */}
          <section className="py-32 md:py-40 px-6 bg-surface-alt">
            <div className="max-w-4xl mx-auto">
              <div className="max-w-xl mx-auto text-center mb-16">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-6">
                  Repeat clients start ahead.
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {memoryExamples.map((example) => (
                  <div
                    key={example.title}
                    className="bg-surface rounded-2xl p-8 border border-neutral-800"
                  >
                    <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center mb-5">
                      <example.icon className="w-5 h-5 text-sage" />
                    </div>
                    <h3 className="font-serif text-lg font-semibold text-text-primary mb-2">
                      {example.title}
                    </h3>
                    <p className="text-text-muted text-sm">{example.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* AI — quietest section */}
          <section className="py-24 md:py-28 px-6">
            <div className="max-w-md mx-auto text-center">
              <p className="text-text-muted leading-relaxed">
                AI batches updates and escalates only what matters. No noise.
              </p>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section id="how-it-works" className="py-32 md:py-40 px-6 bg-surface-alt scroll-mt-20">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-20">
                How it works
              </h2>
              <div className="grid md:grid-cols-3 gap-12">
                {steps.map((step) => (
                  <div key={step.number} className="text-center">
                    <div className="w-14 h-14 rounded-full bg-sage/10 border border-sage/30 flex items-center justify-center mx-auto mb-5">
                      <span className="text-sage font-serif text-xl font-bold">{step.number}</span>
                    </div>
                    <h3 className="font-serif text-xl font-semibold text-text-primary mb-3">
                      {step.title}
                    </h3>
                    <p className="text-text-muted text-sm">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* PRICING */}
          <section id="pricing" className="py-32 md:py-40 px-6 scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              <div className="text-center max-w-xl mx-auto mb-20">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
                  Pricing
                </h2>
                <p className="text-text-muted">Value compounds over time.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 items-start">
                {tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className={`relative bg-surface-alt rounded-2xl p-7 border transition-all duration-300 ${
                      tier.isPopular
                        ? 'border-2 border-sage shadow-xl shadow-sage/20 md:-mt-4 md:scale-[1.02] z-10'
                        : 'border-neutral-800'
                    }`}
                  >
                    {tier.isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                        <span className="inline-flex items-center gap-1.5 bg-sage text-white text-xs font-semibold px-3 py-1 rounded-full">
                          <Sparkles className="w-3 h-3" />
                          Popular
                        </span>
                      </div>
                    )}

                    <h3
                      className={`font-serif text-xl font-bold text-text-primary ${tier.isPopular ? 'mt-1' : ''}`}
                    >
                      {tier.name}
                    </h3>
                    <p className="mt-1 text-text-muted text-xs">{tier.description}</p>

                    <div className="mt-5">
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-text-primary text-3xl">{tier.price}</span>
                        {tier.priceSubtext && (
                          <span className="text-text-muted text-sm">{tier.priceSubtext}</span>
                        )}
                      </div>
                      {tier.annualSavings && (
                        <span className="text-xs text-sage mt-1 block">{tier.annualSavings}</span>
                      )}
                    </div>

                    <ul className="mt-5 space-y-2">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-sage flex-shrink-0 mt-0.5" />
                          <span className="text-text-primary text-xs">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      asChild
                      variant={tier.isPopular ? 'sage' : 'outline'}
                      className={`w-full mt-6 rounded-full py-4 text-sm ${
                        tier.isPopular ? '' : 'border-sage/50 text-sage hover:bg-sage/10'
                      }`}
                    >
                      <Link href={tier.ctaHref}>{tier.ctaText}</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="py-32 md:py-40 px-6 bg-surface-alt scroll-mt-20">
            <div className="max-w-xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary text-center mb-12">
                FAQ
              </h2>
              <div className="space-y-3">
                {faqs.map((faq, index) => (
                  <details
                    key={index}
                    className="group bg-surface rounded-lg border border-neutral-800 overflow-hidden"
                  >
                    <summary className="flex items-center justify-between cursor-pointer p-4 list-none">
                      <span className="font-medium text-text-primary text-sm pr-4">
                        {faq.question}
                      </span>
                      <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 text-text-muted text-sm">{faq.answer}</div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* FINAL CTA — relief, not urgency */}
          <section className="py-36 md:py-44 px-6 border-t border-neutral-800">
            <div className="max-w-xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-10">
                Nothing important should have to be remembered manually.
              </h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild variant="sage" className="rounded-full px-8 py-5 font-medium">
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="text-text-muted hover:text-text-primary rounded-full px-8 py-5"
                >
                  <Link href="/signup">Get started</Link>
                </Button>
              </div>
            </div>
          </section>
        </main>

        {/* FOOTER */}
        <footer className="py-10 px-6 bg-neutral-900 border-t border-neutral-800">
          <div className="max-w-6xl mx-auto">
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
