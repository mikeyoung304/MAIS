import Link from 'next/link';
import { Metadata } from 'next';
import {
  ArrowRight,
  Check,
  Globe,
  CreditCard,
  TrendingUp,
  FileText,
  Users,
  MessageSquare,
  Sparkles,
  Brain,
  Heart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileNav } from '@/components/home/MobileNav';
import { ProjectHubMockup } from '@/components/home/ProjectHubMockup';
import { DemoStorefrontFrame } from '@/components/home/DemoStorefrontShowcase';
import { BookingFlowDemo } from '@/components/home/BookingFlowDemo';

export const metadata: Metadata = {
  title: 'Handled — Your website, bookings, and marketing — handled.',
  description:
    'Handled builds and runs your professional website, manages bookings and payments, and quietly helps you get more clients — without you learning software or marketing.',
  openGraph: {
    title: 'Handled — Your website, bookings, and marketing — handled.',
    description:
      'Handled builds and runs your professional website, manages bookings and payments, and quietly helps you get more clients — without you learning software or marketing.',
    type: 'website',
  },
};

// What Handled Does - 3 pillars
const pillars = [
  {
    icon: Globe,
    title: 'Your Website',
    description: 'A clean, professional site built for your business',
    bullets: ['Services, pricing, and availability already connected', 'No plugins, no duct tape'],
  },
  {
    icon: CreditCard,
    title: 'Booking & Payments',
    description: 'Clients book and pay without back-and-forth',
    bullets: ['Everything stays in one place', "You don't chase confirmations or invoices"],
  },
  {
    icon: TrendingUp,
    title: 'Built-In Growth Help',
    description: 'A personalized marketing strategy for your business',
    bullets: [
      'Ready-to-use starters for social and LinkedIn posts',
      'Simple actions that lead to real bookings',
    ],
  },
];

// Growth Plan features
const growthPlanFeatures = [
  'A customized marketing strategy based on your business',
  'Simple prompts for social and LinkedIn posts',
  'Clear, practical actions that compound into real demand',
];

// Project Hub bullets
const projectHubBullets = [
  'A dedicated page for each booking or event',
  "A shared, organized breakdown of what's happening, when, and where",
  'Updates, changes, and requests live in one thread — not texts or emails',
  'AI assistants on both sides help clarify details and keep things moving',
  'Everyone always sees the same, current version of the plan',
];

// Memory section bullets
const memoryBullets = [
  'Client preferences remembered across gigs',
  'Past decisions and nuances always accessible',
  'Repeat clients feel recognized, not re-onboarded',
  'AI uses this growing context to make better suggestions and reduce friction',
];

// Who It's For bullets
const whoItsForBullets = [
  'Professionals who sell their time and expertise',
  'People without teams or operators',
  'People tired of juggling tools and tabs',
  'People who want to focus on clients, not systems',
];

export default function HomePage() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Handled',
    url: 'https://gethandled.ai',
    description:
      'Handled builds and runs your professional website, manages bookings and payments, and quietly helps you get more clients.',
    sameAs: [],
  };

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Handled',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'Your website, bookings, and marketing — handled. A complete business system for service professionals.',
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
                href="#growth"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                Growth Plan
              </Link>
              <Link
                href="/login"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                Login
              </Link>
              <Button asChild variant="sage" className="rounded-full px-6 py-2">
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
            <MobileNav />
          </div>
        </nav>

        <main>
          {/* ============================================
              SECTION 1: HERO
              Split layout: 40% text left, 60% visual right
              Scannable in 5 seconds, single primary CTA
              ============================================ */}
          <section className="relative pt-28 pb-12 md:pt-32 md:pb-16 lg:pt-36 lg:pb-20 px-6">
            <div className="max-w-6xl mx-auto w-full">
              <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start lg:items-center">
                {/* Text content - 40% on desktop */}
                <div className="lg:col-span-5 text-center lg:text-left flex flex-col justify-center">
                  <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-text-primary leading-[1.1] tracking-tight">
                    Your Website, Bookings, and Marketing—
                    <span className="text-sage">Handled.</span>
                  </h1>
                  <p className="mt-6 text-lg text-text-muted leading-relaxed max-w-lg mx-auto lg:mx-0">
                    Build a professional site, handle bookings seamlessly, and grow your business
                    without juggling tools.
                  </p>
                  <div className="mt-8">
                    <Button
                      asChild
                      variant="sage"
                      className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <Link href="/signup">Get Started Free</Link>
                    </Button>
                  </div>
                </div>

                {/* Visual - 60% on desktop: Full Booking Flow Demo */}
                <div className="lg:col-span-7 flex items-start justify-center lg:justify-end">
                  <BookingFlowDemo />
                </div>
              </div>

              {/* Scroll indicator - positioned relative to content flow */}
              <div className="mt-10 md:mt-12 flex flex-col items-center gap-2 text-text-muted animate-bounce">
                <span className="text-xs tracking-wide uppercase">Scroll to explore</span>
                <ArrowRight className="w-4 h-4 rotate-90" />
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 2: WHAT HANDLED DOES
              3 pillars: Website, Booking, Growth
              ============================================ */}
          <section id="how-it-works" className="py-24 md:py-32 px-6 bg-surface-alt scroll-mt-20">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
                  What Handled Does
                </h2>
                <p className="text-lg text-text-muted max-w-2xl mx-auto">
                  Everything you need to run your business — without juggling tools.
                </p>
              </div>

              {/* 3 Pillars */}
              <div className="grid md:grid-cols-3 gap-8">
                {pillars.map((pillar) => (
                  <div
                    key={pillar.title}
                    className="bg-surface rounded-2xl p-8 border border-neutral-800 hover:border-sage/50 transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-xl bg-sage/10 flex items-center justify-center mb-6">
                      <pillar.icon className="w-6 h-6 text-sage" />
                    </div>
                    <h3 className="font-serif text-xl font-bold text-text-primary mb-3">
                      {pillar.title}
                    </h3>
                    <p className="text-text-muted mb-4">{pillar.description}</p>
                    <ul className="space-y-2">
                      {pillar.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2 text-sm text-text-muted">
                          <Check className="w-4 h-4 text-sage mt-0.5 flex-shrink-0" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Website Preview */}
              <div className="mt-16">
                <p className="text-center text-sm text-text-muted mb-6">
                  What your clients see — a polished storefront with clear pricing
                </p>
                <div className="max-w-2xl mx-auto">
                  <DemoStorefrontFrame />
                </div>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 3: GROWTH PLAN ($150/mo)
              "When you're ready to grow, Handled steps in."
              ============================================ */}
          <section id="growth" className="py-24 md:py-32 px-6 scroll-mt-20">
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 bg-sage/10 border border-sage/30 rounded-full px-4 py-1.5 mb-6">
                    <TrendingUp className="w-4 h-4 text-sage" />
                    <span className="text-sm text-sage font-medium">Growth Plan • $150/mo</span>
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-6">
                    When you&apos;re ready to grow, Handled steps in.
                  </h2>
                  <p className="text-lg text-text-muted leading-relaxed mb-8">
                    On our growth plan, Handled doesn&apos;t just keep things organized — it
                    actively helps you get booked.
                  </p>
                  <div className="mb-8">
                    <p className="text-text-primary font-medium mb-4">You&apos;ll get:</p>
                    <ul className="space-y-3">
                      {growthPlanFeatures.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-sage" />
                          </div>
                          <span className="text-text-muted">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-text-primary font-medium">
                    No courses. No funnels. No guesswork.
                  </p>
                </div>

                {/* Visual: Growth indicators */}
                <div className="bg-surface-alt rounded-2xl p-8 border border-neutral-800">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-surface rounded-xl border border-neutral-800">
                      <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-sage" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">Social post starter</p>
                        <p className="text-xs text-text-muted">Ready to customize and post</p>
                      </div>
                      <span className="text-xs text-sage font-medium">New</span>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-surface rounded-xl border border-neutral-800">
                      <div className="w-10 h-10 rounded-lg bg-sage/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-sage" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">Weekly action</p>
                        <p className="text-xs text-text-muted">
                          &quot;Reply to 3 comments from last week&quot;
                        </p>
                      </div>
                      <span className="text-xs text-amber-500 font-medium">To-do</span>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-surface rounded-xl border border-emerald-500/30">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Check className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">LinkedIn post</p>
                        <p className="text-xs text-text-muted">Posted yesterday • 340 views</p>
                      </div>
                      <span className="text-xs text-emerald-500 font-medium">Done</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 4: PROJECT HUB
              "After someone books, everything stays in one place."
              ============================================ */}
          <section className="py-24 md:py-32 px-6 bg-surface-alt">
            <div className="max-w-6xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
                    After someone books, everything stays in one place.
                  </h2>
                  <p className="text-lg text-text-muted mb-8">
                    Every booking gets its own dedicated project page — shared by you and your
                    client — so nothing gets lost, forgotten, or scattered.
                  </p>

                  <ul className="space-y-3 mb-8">
                    {projectHubBullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-sage" />
                        </div>
                        <span className="text-text-muted">{bullet}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="text-text-muted leading-relaxed mb-6">
                    Instead of chasing messages across email, texts, DMs, and notes, both you and
                    your client return to the same page — before, during, and after the job.
                  </p>

                  <p className="text-text-primary font-medium mb-4">
                    It becomes the single source of truth for the entire project.
                  </p>

                  {/* Pull quote */}
                  <div className="border-l-2 border-sage pl-4">
                    <p className="text-lg text-text-primary italic">
                      &quot;If it relates to the job, it lives there.&quot;
                    </p>
                  </div>
                </div>

                {/* Project Hub Mockup */}
                <div>
                  <ProjectHubMockup />
                </div>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 5: MEMORY & REPEAT CLIENT EXPERIENCE
              "Handled remembers your clients"
              ============================================ */}
          <section className="py-24 md:py-32 px-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 bg-sage/10 border border-sage/30 rounded-full px-4 py-1.5 mb-6">
                  <Brain className="w-4 h-4 text-sage" />
                  <span className="text-sm text-sage font-medium">Built-in memory</span>
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-6">
                  Handled remembers your clients — so they feel taken care of every time.
                </h2>
                <p className="text-lg text-text-muted max-w-2xl mx-auto">
                  Because each project hub lives forever, Handled quietly builds memory over time.
                  Preferences, patterns, and context from past work carry forward — so repeat
                  clients don&apos;t have to explain themselves again, and nothing important slips
                  through the cracks.
                </p>
              </div>

              {/* Memory Features Grid */}
              <div className="grid sm:grid-cols-2 gap-4 mb-12">
                {memoryBullets.map((bullet, index) => (
                  <div
                    key={bullet}
                    className="flex items-start gap-4 p-5 bg-surface-alt rounded-xl border border-neutral-800"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center flex-shrink-0">
                      {index === 0 && <Heart className="w-4 h-4 text-sage" />}
                      {index === 1 && <FileText className="w-4 h-4 text-sage" />}
                      {index === 2 && <Users className="w-4 h-4 text-sage" />}
                      {index === 3 && <Sparkles className="w-4 h-4 text-sage" />}
                    </div>
                    <p className="text-text-muted">{bullet}</p>
                  </div>
                ))}
              </div>

              <p className="text-center text-lg text-text-primary font-medium">
                The more you work with someone, the easier it gets — for both of you.
              </p>
            </div>
          </section>

          {/* ============================================
              SECTION 6: WHO IT'S FOR
              "Handled is for people who love their work"
              ============================================ */}
          <section className="py-24 md:py-32 px-6 bg-surface-alt">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-12">
                Handled is for people who love their work — not running a business.
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                {whoItsForBullets.map((bullet) => (
                  <div
                    key={bullet}
                    className="flex items-center gap-3 p-5 bg-surface rounded-xl border border-neutral-800 text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-sage/10 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-sage" />
                    </div>
                    <span className="text-text-primary">{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 7: CLOSING CTA
              "Do what you love. The rest is handled."
              ============================================ */}
          <section className="py-24 md:py-32 px-6 border-t border-neutral-800">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
                Do what you love.
              </h2>
              <p className="text-xl md:text-2xl text-text-muted leading-relaxed mb-10">
                The rest is <span className="text-sage font-medium">handled.</span>
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
