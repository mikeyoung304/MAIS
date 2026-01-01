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
import { ProductPreviewTabs } from '@/components/home/ProductPreviewTabs';
import { MobileNav } from '@/components/home/MobileNav';

export const metadata: Metadata = {
  title: 'HANDLED — Stop starting over with every client.',
  description:
    "A storefront and booking flow that continues after checkout. One shared Project Hub for every client, so details don't scatter—and repeat clients don't reset.",
  openGraph: {
    title: 'HANDLED — Stop starting over with every client.',
    description:
      "A storefront and booking flow that continues after checkout. One shared Project Hub for every client, so details don't scatter—and repeat clients don't reset.",
    type: 'website',
  },
};

const faqs = [
  {
    question: 'Will this feel like my business—or a template?',
    answer:
      "It's a strong structure, not a generic vibe. Your services, voice, and way of working come through—without starting from scratch.",
  },
  {
    question: 'Does this replace my emails and DMs?',
    answer:
      "It reduces them by giving clients one shared Project Hub after booking—so details don't scatter across threads.",
  },
  {
    question: 'What happens when a client asks something unusual?',
    answer:
      'The assistant handles common questions and knows when to hand things back to you. You stay in control.',
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

const tiers = [
  {
    id: 'foundation',
    name: 'The Foundation',
    price: '$49',
    priceSubtext: '/month',
    description: 'Professional storefront, booking, and payments—built to convert.',
    annualSavings: 'Save $118/year',
    features: [
      'Professional storefront',
      'Online booking & payments',
      'Done-for-you website',
      'Clear tier-based pricing',
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
    description: 'The Project Hub, the assistant, and calmer client communication after checkout.',
    annualSavings: 'Save $358/year',
    features: [
      'Everything in Foundation',
      'Project Hub for every client',
      'AI assistant for questions',
      'Client Memory that compounds',
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
    description: 'We build it with you—custom workflows, voice agents, and hands-on support.',
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
    body: "Pick up where you left off—what clicked, what didn't, and what to focus on next.",
  },
  {
    icon: UtensilsCrossed,
    title: 'Catering',
    body: 'See what you served last time, what they loved, and repeat it with adjustments.',
  },
  {
    icon: Camera,
    title: 'Photography',
    body: 'Carry forward context that changes the session—so families feel supported, not managed.',
  },
];

const steps = [
  {
    number: '1',
    title: 'Set up once',
    body: "Add what you offer, how you work, and when you're available.",
  },
  {
    number: '2',
    title: 'Clients book cleanly',
    body: 'They choose a tier, get answers, pay, and book—without a thread.',
  },
  {
    number: '3',
    title: 'The Hub keeps it together',
    body: 'Questions, changes, files, and follow-ups stay in one shared place.',
  },
];

const problemBullets = [
  "Pricing explanations that should've been clear upfront",
  'Back-and-forth scheduling in three different places',
  "Changes requested in texts you'll never find again",
  'Clients repeating themselves because nothing carries forward',
  'Follow-ups that live in your head instead of a system',
];

const hubBullets = [
  'Clients ask questions and request changes in one place',
  'You see a clean summary, not a messy conversation',
  'Everything stays attached to the booking—forever',
];

const storefrontBullets = [
  'Clear offerings clients understand',
  'Pricing that reduces awkward back-and-forth',
  'Booking that feels settled, not fragile',
];

export default function HomePage() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Handled',
    url: 'https://gethandled.ai',
    description:
      'A storefront and booking flow that continues after checkout. One shared Project Hub for every client.',
    sameAs: [],
  };

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Handled',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'A storefront and booking flow that continues after checkout. One shared Project Hub for every client.',
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
                href="#demo"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                Demo
              </Link>
              <Link
                href="#how-it-works"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                How it works
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
                <Link href="/signup">Start your storefront</Link>
              </Button>
            </div>
            <MobileNav />
          </div>
        </nav>

        <main>
          {/* HERO */}
          <section className="relative pt-36 pb-24 md:pt-48 md:pb-32 px-6">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.1] tracking-tight">
                Stop starting over with every client.
              </h1>
              <p className="mt-10 text-lg md:text-xl text-text-muted leading-relaxed max-w-2xl mx-auto">
                You&apos;re great at the work. The stress comes from everything around it—pricing
                questions, scattered messages, and clients repeating themselves across email, text,
                and DMs.
              </p>
              <p className="mt-6 text-lg md:text-xl text-text-muted leading-relaxed max-w-2xl mx-auto">
                HANDLED gives you a storefront that books cleanly—and a shared Project Hub that
                keeps the relationship from falling apart after checkout.
              </p>
              <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
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
                  <Link href="#demo" className="flex items-center gap-2">
                    See how it works
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
              <p className="mt-8 text-sm text-text-muted">
                Your work can stay human. Your systems should be handled.
              </p>
            </div>
          </section>

          {/* DEMO */}
          <section id="demo" className="py-24 md:py-32 px-6 bg-surface-alt scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              <div className="max-w-2xl mx-auto text-center mb-12">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-6">
                  See how HANDLED works in practice.
                </h2>
                <p className="text-lg text-text-muted leading-relaxed">
                  Browse it the way a client would. Notice what&apos;s different: the booking is
                  clean—and the relationship doesn&apos;t disappear into email afterward.
                </p>
                <p className="mt-4 text-sm text-text-muted">Storefront → Booking → Project Hub</p>
              </div>

              <ProductPreviewTabs />
            </div>
          </section>

          {/* THE EMOTIONAL PROBLEM */}
          <section className="py-32 md:py-40 px-6">
            <div className="max-w-2xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-12">
                The work isn&apos;t messy. The communication is.
              </h2>
              <div className="text-lg text-text-muted leading-relaxed text-center mb-10">
                <p>Most service businesses don&apos;t struggle with their craft.</p>
                <p className="mt-4">They struggle with the moment after someone says yes.</p>
                <p className="mt-6">
                  That&apos;s when details drift:
                  <br />a &quot;quick question&quot; turns into a thread,
                  <br />a small change gets buried,
                  <br />
                  and the client assumes you remember everything.
                </p>
              </div>

              <ul className="space-y-3 max-w-xl mx-auto">
                {problemBullets.map((bullet, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="text-sage mt-1.5">•</span>
                    <span className="text-text-muted">{bullet}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-12 text-xl text-text-primary text-center font-medium">
                You shouldn&apos;t have to run your business on memory.
              </p>
            </div>
          </section>

          {/* THE REFRAME */}
          <section className="py-24 md:py-32 px-6 bg-surface-alt">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-8">
                Handled is what happens after the booking.
              </h2>
              <p className="text-lg text-text-muted leading-relaxed">
                Most tools stop at checkout. HANDLED is built for what comes next: questions,
                changes, files, add-ons, and the thousand small details that decide whether a client
                feels taken care of.
              </p>
            </div>
          </section>

          {/* PROJECT HUB (THE WEDGE) */}
          <section id="project-hub" className="py-32 md:py-40 px-6 scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              <div className="max-w-2xl mx-auto text-center mb-12">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-8">
                  After booking, everything moves into the Project Hub.
                </h2>
                <p className="text-lg text-text-muted leading-relaxed mb-8">
                  Clients get one shared link for the project. Not an email chain. Not a DM thread.
                  Not &quot;just text me.&quot;
                </p>
                <p className="text-lg text-text-muted leading-relaxed">
                  A Project Hub where: the booking is visible, requests stay organized, and
                  decisions don&apos;t disappear.
                </p>
              </div>

              <ProjectHubMockup />

              <ul className="mt-12 space-y-3 max-w-xl mx-auto">
                {hubBullets.map((bullet, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                    <span className="text-text-muted">{bullet}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-10 text-center text-sm text-text-muted">
                This is the single source of truth for the project.
              </p>
            </div>
          </section>

          {/* CONTINUITY (REPEAT CLIENTS + MEMORY) */}
          <section className="py-32 md:py-40 px-6 bg-surface-alt">
            <div className="max-w-4xl mx-auto">
              <div className="max-w-2xl mx-auto text-center mb-16">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-8">
                  Repeat clients shouldn&apos;t have to repeat themselves.
                </h2>
                <p className="text-lg text-text-muted leading-relaxed">
                  Over time, the best service businesses feel effortless—not because they&apos;re
                  doing less, but because they remember more.
                </p>
                <p className="mt-6 text-lg text-text-muted leading-relaxed">
                  HANDLED carries forward what matters, so the next booking doesn&apos;t reset:
                  preferences, constraints, and the context that makes people feel seen.
                </p>
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
                    <h3 className="font-serif text-lg font-semibold text-text-primary mb-3">
                      {example.title}
                    </h3>
                    <p className="text-text-muted text-sm leading-relaxed">{example.body}</p>
                  </div>
                ))}
              </div>

              <p className="mt-12 text-center text-xl text-text-primary font-medium">
                That&apos;s how trust compounds.
              </p>
            </div>
          </section>

          {/* STOREFRONT VALUE */}
          <section className="py-24 md:py-32 px-6">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-8">
                A storefront that answers questions before they become messages.
              </h2>
              <p className="text-lg text-text-muted leading-relaxed mb-10">
                Your storefront is structured to help clients choose and book without friction:
                clear positioning, tiered offerings, and pricing that makes sense the first time.
              </p>

              <ul className="space-y-3 max-w-md mx-auto text-left">
                {storefrontBullets.map((bullet, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                    <span className="text-text-muted">{bullet}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-10 text-sm text-text-muted">Then the Project Hub takes over.</p>
            </div>
          </section>

          {/* ASSISTANT (DE-HYPE AI) */}
          <section className="py-24 md:py-32 px-6 bg-surface-alt">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-8">
                Help where it counts. Quiet where it should.
              </h2>
              <p className="text-lg text-text-muted leading-relaxed">
                The assistant handles common questions and guides booking when you&apos;re busy.
                After booking, it helps keep the Project Hub organized—so you stay in the loop
                without living in notifications. It uses AI quietly in the background.
              </p>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section id="how-it-works" className="py-32 md:py-40 px-6 scroll-mt-20">
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
                    <p className="text-text-muted text-sm leading-relaxed">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* PRICING */}
          <section id="pricing" className="py-32 md:py-40 px-6 bg-surface-alt scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              <div className="text-center max-w-xl mx-auto mb-6">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
                  Simple pricing. No guesswork.
                </h2>
                <p className="text-text-muted">Try it free for 14 days. No credit card required.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 items-start mt-16">
                {tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className={`relative bg-surface rounded-2xl p-7 border transition-all duration-300 ${
                      tier.isPopular
                        ? 'border-2 border-sage shadow-xl shadow-sage/20 md:-mt-4 md:scale-[1.02] z-10'
                        : 'border-neutral-800'
                    }`}
                  >
                    {tier.isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                        <span className="inline-flex items-center gap-1.5 bg-sage text-white text-xs font-semibold px-3 py-1 rounded-full">
                          <Sparkles className="w-3 h-3" />
                          Most Popular
                        </span>
                      </div>
                    )}

                    <h3
                      className={`font-serif text-xl font-bold text-text-primary ${tier.isPopular ? 'mt-1' : ''}`}
                    >
                      {tier.name}
                    </h3>
                    <p className="mt-1 text-text-muted text-xs leading-relaxed">
                      {tier.description}
                    </p>

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
          <section id="faq" className="py-32 md:py-40 px-6 scroll-mt-20">
            <div className="max-w-xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary text-center mb-12">
                Common questions
              </h2>
              <div className="space-y-3">
                {faqs.map((faq, index) => (
                  <details
                    key={index}
                    className="group bg-surface-alt rounded-lg border border-neutral-800 overflow-hidden"
                  >
                    <summary className="flex items-center justify-between cursor-pointer p-4 list-none">
                      <span className="font-medium text-text-primary text-sm pr-4">
                        {faq.question}
                      </span>
                      <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 text-text-muted text-sm leading-relaxed">
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* FINAL CTA */}
          <section className="py-36 md:py-44 px-6 bg-surface-alt border-t border-neutral-800">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-8">
                Your work is personal. Your systems shouldn&apos;t be chaos.
              </h2>
              <p className="text-lg text-text-muted leading-relaxed mb-10">
                If your work matters to you, the way it&apos;s presented should too. Book clients
                cleanly. Keep the relationship intact after checkout. Stop running your business on
                memory.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-8 py-5 font-medium shadow-lg hover:shadow-xl transition-all"
                >
                  <Link href="/signup">Start your storefront</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="text-text-muted hover:text-text-primary rounded-full px-8 py-5"
                >
                  <Link href="#demo">See how it works</Link>
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
