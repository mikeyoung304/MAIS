import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight, Check, Sparkles, BookOpen, Camera, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectHubMockup } from '@/components/home/ProjectHubMockup';
import { MobileNav } from '@/components/home/MobileNav';

export const metadata: Metadata = {
  title: 'HANDLED — Stop starting over with every client.',
  description:
    'A storefront that books cleanly. A Project Hub that keeps clients coming back. Built for service professionals who care about relationships.',
  openGraph: {
    title: 'HANDLED — Stop starting over with every client.',
    description:
      'A storefront that books cleanly. A Project Hub that keeps clients coming back. Built for service professionals who care about relationships.',
    type: 'website',
  },
};

const tiers = [
  {
    id: 'foundation',
    name: 'The Foundation',
    price: '$49',
    priceSubtext: '/month',
    description: 'Professional storefront with booking and payments.',
    annualSavings: 'Save $118/year',
    features: [
      'Professional storefront',
      'Online booking & payments',
      'Done-for-you website',
      'Clear tier-based pricing',
    ],
    ctaText: 'Start free trial',
    ctaHref: '/signup?tier=handled',
    isPopular: false,
  },
  {
    id: 'system',
    name: 'The System',
    price: '$149',
    priceSubtext: '/month',
    description: 'Everything in Foundation, plus the Project Hub and Client Memory.',
    annualSavings: 'Save $358/year',
    features: [
      'Everything in Foundation',
      'Project Hub for every client',
      'Client Memory that compounds',
      'AI assistant for questions',
    ],
    ctaText: 'Start free trial',
    ctaHref: '/signup?tier=fully-handled',
    isPopular: true,
  },
  {
    id: 'partnership',
    name: 'The Partnership',
    price: "Let's talk",
    priceSubtext: '',
    description: 'We build and customize it with you. Hands-on support.',
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
    body: "Pick up where you left off—what clicked, what didn't, what to focus on next.",
  },
  {
    icon: UtensilsCrossed,
    title: 'Catering',
    body: 'See what you served last time, what they loved, and repeat it with adjustments.',
  },
  {
    icon: Camera,
    title: 'Photography',
    body: 'Carry forward context—so families feel supported, not managed.',
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
    body: 'They choose, pay, and book—without a thread.',
  },
  {
    number: '3',
    title: 'The Hub keeps it together',
    body: 'Questions, changes, and follow-ups stay in one place.',
  },
];

const problemBullets = [
  "Changes requested in texts you'll never find again",
  'Clients repeating themselves because nothing carries forward',
  "Pricing explanations that should've been clear upfront",
];

export default function HomePage() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Handled',
    url: 'https://gethandled.ai',
    description: 'A storefront that books cleanly. A Project Hub that keeps clients coming back.',
    sameAs: [],
  };

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Handled',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'A storefront that books cleanly. A Project Hub that keeps clients coming back.',
    offers: {
      '@type': 'Offer',
      description: 'Month-to-month subscription',
      availability: 'https://schema.org/InStock',
    },
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
                How it works
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
              <Button asChild variant="sage" className="rounded-full px-6 py-2">
                <Link href="/signup">Try it free</Link>
              </Button>
            </div>
            <MobileNav />
          </div>
        </nav>

        <main>
          {/* ============================================
              SECTION 1: HERO
              Split layout: Copy left, Project Hub right
              Show the product immediately
              ============================================ */}
          <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 px-6">
            <div className="max-w-6xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                {/* Left: Copy */}
                <div className="text-center lg:text-left">
                  <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-[1.1] tracking-tight">
                    Stop starting over with every client.
                  </h1>
                  <p className="mt-6 text-lg md:text-xl text-text-muted leading-relaxed max-w-lg mx-auto lg:mx-0">
                    A storefront that books cleanly. A Project Hub that keeps the relationship
                    together after checkout.
                  </p>
                  <div className="mt-8 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4">
                    <Button
                      asChild
                      variant="sage"
                      className="rounded-full px-8 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <Link href="/signup">Try it free</Link>
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
                  <p className="mt-6 text-sm text-text-muted">
                    Your work can stay human. Your systems should be handled.
                  </p>
                </div>

                {/* Right: Project Hub Visual */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-sage/5 to-sage/10 rounded-3xl blur-3xl" />
                  <div className="relative">
                    <ProjectHubMockup />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 2: SOCIAL PROOF
              Light touch—industry-focused, not fake numbers
              ============================================ */}
          <section className="py-12 md:py-16 px-6 border-y border-neutral-800">
            <div className="max-w-4xl mx-auto">
              <p className="text-center text-text-muted text-sm md:text-base">
                Built for service professionals who care about their clients.{' '}
                <span className="text-text-primary">
                  Photographers. Coaches. Therapists. Tutors. Consultants.
                </span>
              </p>
            </div>
          </section>

          {/* ============================================
              SECTION 3: PROBLEM (Condensed)
              Emotional hook with 3 strongest bullets
              ============================================ */}
          <section className="py-24 md:py-32 px-6">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-8">
                The work isn&apos;t messy. The communication is.
              </h2>
              <p className="text-lg text-text-muted leading-relaxed mb-10">
                Most service businesses don&apos;t struggle with their craft. They struggle with the
                moment after someone says yes—when details scatter across texts, emails, and DMs.
              </p>

              <ul className="space-y-4 max-w-md mx-auto text-left">
                {problemBullets.map((bullet, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="text-sage mt-1">•</span>
                    <span className="text-text-muted">{bullet}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-10 text-xl text-text-primary font-medium">
                You shouldn&apos;t have to run your business on memory.
              </p>
            </div>
          </section>

          {/* ============================================
              SECTION 4: PROJECT HUB (THE WEDGE)
              Full centerpiece with memory examples
              ============================================ */}
          <section id="project-hub" className="py-24 md:py-32 px-6 bg-surface-alt scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              <div className="max-w-2xl mx-auto text-center mb-16">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-6">
                  After booking, everything lives in the Project Hub.
                </h2>
                <p className="text-lg text-text-muted leading-relaxed">
                  One shared link. Not an email chain. Not a DM thread. A single source of truth
                  where questions, changes, and files stay organized—forever.
                </p>
              </div>

              {/* Hub benefits */}
              <div className="grid sm:grid-cols-3 gap-6 mb-16">
                <div className="text-center p-6">
                  <div className="w-12 h-12 rounded-full bg-sage/10 border border-sage/30 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-6 h-6 text-sage" />
                  </div>
                  <p className="text-text-primary font-medium">
                    Clients ask questions in one place
                  </p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 rounded-full bg-sage/10 border border-sage/30 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-6 h-6 text-sage" />
                  </div>
                  <p className="text-text-primary font-medium">You see a summary, not a mess</p>
                </div>
                <div className="text-center p-6">
                  <div className="w-12 h-12 rounded-full bg-sage/10 border border-sage/30 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-6 h-6 text-sage" />
                  </div>
                  <p className="text-text-primary font-medium">
                    Context carries forward to next time
                  </p>
                </div>
              </div>

              {/* Memory examples */}
              <div className="max-w-3xl mx-auto">
                <p className="text-center text-sm text-text-muted uppercase tracking-wide mb-6">
                  Repeat clients don&apos;t have to repeat themselves
                </p>
                <div className="grid md:grid-cols-3 gap-6">
                  {memoryExamples.map((example) => (
                    <div
                      key={example.title}
                      className="bg-surface rounded-2xl p-6 border border-neutral-800"
                    >
                      <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center mb-4">
                        <example.icon className="w-5 h-5 text-sage" />
                      </div>
                      <h3 className="font-serif text-lg font-semibold text-text-primary mb-2">
                        {example.title}
                      </h3>
                      <p className="text-text-muted text-sm leading-relaxed">{example.body}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-8 text-center text-lg text-text-primary font-medium">
                  That&apos;s how trust compounds.
                </p>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 5: HOW IT WORKS
              Simple 3-step flow
              ============================================ */}
          <section id="how-it-works" className="py-24 md:py-32 px-6 scroll-mt-20">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-16">
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

          {/* ============================================
              SECTION 6: PRICING
              Clean 3-tier layout
              ============================================ */}
          <section id="pricing" className="py-24 md:py-32 px-6 bg-surface-alt scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              <div className="text-center max-w-xl mx-auto mb-12">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
                  Simple pricing
                </h2>
                <p className="text-text-muted">
                  14-day free trial. No credit card required. Cancel anytime.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 items-start">
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
                    <p className="mt-1 text-text-muted text-sm leading-relaxed">
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
                          <span className="text-text-primary text-sm">{feature}</span>
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

          {/* ============================================
              SECTION 7: FINAL CTA
              Tight, relief-focused
              ============================================ */}
          <section className="py-24 md:py-32 px-6 border-t border-neutral-800">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-6">
                Your work is personal. Your systems shouldn&apos;t be chaos.
              </h2>
              <p className="text-lg text-text-muted leading-relaxed mb-8">
                Book clients cleanly. Keep them coming back. Stop running your business on memory.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-8 py-5 font-medium shadow-lg hover:shadow-xl transition-all"
                >
                  <Link href="/signup">Try it free</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="text-text-muted hover:text-text-primary rounded-full px-8 py-5"
                >
                  <Link href="#pricing">See pricing</Link>
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
