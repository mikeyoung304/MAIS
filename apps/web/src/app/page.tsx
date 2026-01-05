import Link from 'next/link';
import { Metadata } from 'next';
import {
  Check,
  TrendingUp,
  FileText,
  Users,
  MessageSquare,
  Sparkles,
  Brain,
  Heart,
  X,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileNav } from '@/components/home/MobileNav';
import { ProjectHubWedge } from '@/components/home/ProjectHubWedge';
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

// Growth Plan features
const growthPlanFeatures = [
  'A customized marketing strategy based on your business',
  'Simple prompts for social and LinkedIn posts',
  'Clear, practical actions that compound into real demand',
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
  'People tired of juggling tools and tabs',
  "People who know they should use AI but don't have time to learn",
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
                href="#problem"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                The Problem
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
          <section className="relative pt-32 pb-8 md:pt-28 md:pb-10 lg:pt-32 lg:pb-12 px-6">
            <div className="max-w-6xl mx-auto w-full">
              <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start lg:items-center">
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

              {/* Scroll indicator - subtle, integrated with page rhythm */}
              <div className="mt-8 md:mt-10 flex flex-col items-center gap-1.5 opacity-40 hover:opacity-60 transition-opacity duration-300 cursor-default">
                <div className="w-px h-6 bg-gradient-to-b from-transparent via-neutral-500 to-neutral-500" />
                <ChevronDown className="w-4 h-4 text-neutral-500" />
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 2: THE PROBLEM
              Two-column contrast: The Grind vs Handled
              ============================================ */}
          <section id="problem" className="py-20 md:py-24 px-6 bg-surface scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              {/* Headline + Subhead */}
              <div className="text-center mb-16">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-[1.1] tracking-tight mb-6">
                  You didn&apos;t start this to become a tech expert.
                </h2>
                <p className="text-lg md:text-xl text-text-muted leading-relaxed max-w-2xl mx-auto">
                  Somewhere along the way, you stopped running your business — and your business
                  started running you.
                </p>
              </div>

              {/* Two-column contrast grid */}
              <div className="grid md:grid-cols-2 gap-6 md:gap-8 mb-16">
                {/* The Grind Card - Dark theme */}
                <div className="relative bg-neutral-800/50 rounded-2xl p-8 border border-neutral-700 overflow-hidden">
                  {/* Subtle dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/20 to-transparent pointer-events-none" />

                  <div className="relative">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-neutral-700/50 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-neutral-400" />
                      </div>
                      <h3 className="text-lg font-medium text-neutral-300">The Grind</h3>
                    </div>

                    <ul className="space-y-4">
                      {[
                        'Answering endless emails, texts, and DMs',
                        'Resending invoices and chasing deposits',
                        'Constant rescheduling and adjustments',
                        'Explaining pricing, policies, and next steps — again and again',
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-neutral-700/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <X className="w-3 h-3 text-neutral-500" />
                          </div>
                          <span className="text-neutral-400 leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Handled Card - Sage accent */}
                <div className="relative bg-sage/[0.08] rounded-2xl p-8 border border-sage/20 overflow-hidden">
                  {/* Subtle sage glow */}
                  <div className="absolute -top-24 -right-24 w-48 h-48 bg-sage/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="relative">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-sage/15 flex items-center justify-center">
                        <Check className="w-5 h-5 text-sage" />
                      </div>
                      <h3 className="text-lg font-medium text-text-primary">Handled</h3>
                    </div>

                    <ul className="space-y-4">
                      {[
                        'Nothing slips through the cracks',
                        'Clients feel understood and supported',
                        'Focus on what you love',
                        'Get back your time',
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-sage" />
                          </div>
                          <span className="text-text-muted leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Bridge copy */}
              <div className="text-center max-w-2xl mx-auto mb-12">
                <p className="text-lg md:text-xl text-text-muted leading-relaxed">
                  Running a modern business quietly demands the majority of your headspace. A dozen
                  systems, constant follow-ups, and a perfect memory — all at once.
                </p>
              </div>

              {/* Closing question */}
              <div className="flex flex-col items-center gap-3">
                <p className="text-xl md:text-2xl text-text-primary font-serif font-medium">
                  What if it was all handled?
                </p>
                <ChevronDown className="w-5 h-5 text-sage animate-bounce" />
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 3: THE PROMISE
              "What if it was all handled?" → Here's how.
              Three pillars: Website, Bookings (anchor), Marketing
              ============================================ */}
          <section className="py-24 md:py-32 px-6 bg-surface-alt">
            <div className="max-w-5xl mx-auto">
              {/* Opening answer to "What if it was all handled?" */}
              <div className="text-center mb-12 md:mb-16">
                <p className="text-sage text-sm font-medium tracking-wide uppercase mb-4">
                  Here&apos;s how it works
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-[1.1] tracking-tight mb-5">
                  One subscription. Your admin on autopilot.
                </h2>
                <p className="text-lg md:text-xl text-text-muted leading-relaxed max-w-2xl mx-auto">
                  Handled is the system that quietly runs your business, so you can focus on the
                  work you love.
                </p>
              </div>

              {/* Three pillars - generous spacing, intentional layout */}
              <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-16 items-stretch">
                {/* Pillar 1: Website */}
                <div className="group relative bg-neutral-800/40 rounded-2xl p-8 lg:p-10 border border-neutral-700/80 overflow-hidden transition-all duration-300 hover:border-neutral-600 hover:bg-neutral-800/50 flex flex-col">
                  {/* Top accent line */}
                  <div className="absolute top-0 left-8 right-8 lg:left-10 lg:right-10 h-px bg-gradient-to-r from-transparent via-neutral-600/50 to-transparent" />

                  <div className="relative flex flex-col flex-1">
                    {/* Top section - grows to fill space, keeps checklist aligned */}
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-sage/10 flex items-center justify-center border border-sage/20">
                          <FileText className="w-6 h-6 text-sage" />
                        </div>
                        <h3 className="text-xl font-medium text-text-primary">Website</h3>
                      </div>

                      {/* Description */}
                      <p className="text-text-muted leading-relaxed">
                        Professional, clear, and built to convert visitors into clients.
                      </p>
                    </div>

                    {/* Checklist - consistent position across all cards */}
                    <ul className="space-y-4 pt-8">
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-sage/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-sage" />
                        </div>
                        <span className="text-text-muted leading-relaxed">
                          Designed for your brand
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-sage/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-sage" />
                        </div>
                        <span className="text-text-muted leading-relaxed">Built for booking</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-sage/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-sage" />
                        </div>
                        <span className="text-text-muted leading-relaxed">
                          Hosted and maintained
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Pillar 2: Bookings - subtle sage accent (anchor) */}
                <div className="group relative bg-neutral-800/40 rounded-2xl p-8 lg:p-10 border border-sage/30 overflow-hidden transition-all duration-300 hover:border-sage/40 hover:bg-neutral-800/50 flex flex-col">
                  {/* Top accent line - sage for anchor */}
                  <div className="absolute top-0 left-8 right-8 lg:left-10 lg:right-10 h-px bg-gradient-to-r from-transparent via-sage/40 to-transparent" />

                  <div className="relative flex flex-col flex-1">
                    {/* Top section - grows to fill space, keeps checklist aligned */}
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-sage/15 flex items-center justify-center border border-sage/25">
                          <Users className="w-6 h-6 text-sage" />
                        </div>
                        <h3 className="text-xl font-medium text-text-primary">Bookings</h3>
                      </div>

                      {/* Description */}
                      <p className="text-text-muted leading-relaxed">
                        Clients book, payments process, details confirmed.{' '}
                        <span className="text-text-primary font-medium">You just show up.</span>
                      </p>
                    </div>

                    {/* Checklist - consistent position across all cards */}
                    <ul className="space-y-4 pt-8">
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-sage" />
                        </div>
                        <span className="text-text-muted leading-relaxed">
                          Online scheduling, no back-and-forth
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-sage" />
                        </div>
                        <span className="text-text-muted leading-relaxed">
                          Deposits and payments handled
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-sage" />
                        </div>
                        <span className="text-text-muted leading-relaxed">
                          Automatic reminders sent
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Pillar 3: Marketing + Community */}
                <div className="group relative bg-neutral-800/40 rounded-2xl p-8 lg:p-10 border border-neutral-700/80 overflow-hidden transition-all duration-300 hover:border-neutral-600 hover:bg-neutral-800/50 flex flex-col">
                  {/* Top accent line */}
                  <div className="absolute top-0 left-8 right-8 lg:left-10 lg:right-10 h-px bg-gradient-to-r from-transparent via-neutral-600/50 to-transparent" />

                  <div className="relative flex flex-col flex-1">
                    {/* Top section - grows to fill space, keeps checklist aligned */}
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-sage/10 flex items-center justify-center border border-sage/20">
                          <TrendingUp className="w-6 h-6 text-sage" />
                        </div>
                        <div>
                          <h3 className="text-xl font-medium text-text-primary">Marketing</h3>
                          <span className="text-xs text-text-muted">+ Community</span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-text-muted leading-relaxed">
                        1-on-1 strategy. Monthly Zooms. A newsletter that filters the AI noise.
                      </p>
                    </div>

                    {/* Checklist - consistent position across all cards */}
                    <ul className="space-y-4 pt-8">
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-sage/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-sage" />
                        </div>
                        <span className="text-text-muted leading-relaxed">
                          Founder builds your playbook
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-sage/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-sage" />
                        </div>
                        <span className="text-text-muted leading-relaxed">
                          Monthly calls, real talk
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-sage/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-sage" />
                        </div>
                        <span className="text-text-muted leading-relaxed">
                          AI tools worth knowing
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Closing statement */}
              <div className="text-center">
                <p className="text-lg text-text-muted mb-6 max-w-2xl mx-auto">
                  No stitched-together tools. No systems to configure. No tech stack to learn.
                </p>
                <p className="text-2xl md:text-3xl text-text-primary font-serif font-medium tracking-tight">
                  Do what you love. The rest is{' '}
                  <span className="text-sage relative inline-block">
                    handled
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-sage/40 rounded-full" />
                  </span>
                  .
                </p>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 4: GROWTH PLAN ($150/mo)
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
              SECTION 4: PROJECT HUB WEDGE
              Pain-first approach with dual dashboards
              ============================================ */}
          <ProjectHubWedge />

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
                Handled is for people who love their work — not the admin.
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
