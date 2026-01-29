import Link from 'next/link';
import { Metadata } from 'next';
import { Check, X, Globe, Calendar, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileNav } from '@/components/home/MobileNav';
import { ProjectHubWedge } from '@/components/home/ProjectHubWedge';
import { JourneyShowcase } from '@/components/home/JourneyShowcase';
import { HeroWithVerticals } from '@/components/home/HeroWithVerticals';

// Revalidate homepage every 60 seconds
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Handled — The operations layer that keeps bookings moving',
  description:
    "Client communication, booking, and follow-up — handled in one calm system that doesn't rely on memory anymore.",
  openGraph: {
    title: 'Handled — The operations layer that keeps bookings moving',
    description:
      "Client communication, booking, and follow-up — handled in one calm system that doesn't rely on memory anymore.",
    type: 'website',
  },
};

// Pricing tiers
const tiers = [
  {
    id: 'handled',
    name: 'Handled',
    price: '$39',
    priceSubtext: '/month',
    description: 'Core operations coverage',
    features: [
      'Optimized storefront',
      'Booking and payments',
      'Centralized client communication',
      "Clear visibility into what's happening and what's next",
    ],
    targetAudience: 'For professionals who want fewer dropped balls and cleaner bookings.',
    ctaText: 'Get Started',
    ctaHref: '/signup',
    isPopular: false,
  },
  {
    id: 'fully-handled',
    name: 'Fully Handled',
    price: '$99',
    priceSubtext: '/month',
    description: 'Your complete operations layer',
    features: [
      'Everything in Handled',
      'Deeper coordination support',
      'Smarter follow-ups and continuity',
      'Priority handling as your business grows',
    ],
    valueStatement:
      'If Handled does nothing else, it must generate booking revenue and remove operational drag. This is the level where that really happens.',
    ctaText: 'Get Started',
    ctaHref: '/signup',
    isPopular: true,
  },
];

// FAQ items
const faqItems = [
  {
    question: 'Is this just another booking tool?',
    answer:
      'No. Booking is the entry point. Handled is what keeps everything after the booking from fragmenting.',
  },
  {
    question: 'Do I need to be "good at tech" to use this?',
    answer: "No. The point is that you don't have to become someone you're not.",
  },
  {
    question: 'Is this all AI-driven?',
    answer: "Handled uses intelligence where it helps and stays out of the way where it doesn't.",
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. No contracts. No friction.',
  },
];

export default function HomePage() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Handled',
    url: 'https://gethandled.ai',
    description: 'The operations layer that keeps bookings moving.',
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
              HERO - 4-Vertical Selector with Package-First Visual
              ============================================ */}
          <HeroWithVerticals />

          {/* ============================================
              PROBLEM SECTION
              ============================================ */}
          <section className="py-20 md:py-28 px-6 bg-surface-alt">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center">
                You&apos;re great at what you do.
              </h2>
              <p className="mt-4 text-xl md:text-2xl text-text-muted text-center">
                Running the business part shouldn&apos;t feel this hard.
              </p>

              <div className="mt-12 text-lg text-text-muted leading-relaxed">
                <p>
                  You didn&apos;t become a photographer, planner, coach, or consultant because you
                  love designing websites, writing copy, or chasing messages across five places.
                </p>
                <p className="mt-6">But right now, your business probably lives in:</p>

                <ul className="mt-6 space-y-3">
                  {[
                    'one website that never quite feels right',
                    "booking tools that don't talk to each other",
                    'emails, texts, DMs, and phone calls scattered everywhere',
                    "follow-ups you're holding in your head",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <X className="w-5 h-5 text-neutral-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-10 space-y-2 text-text-primary font-medium">
                  <p>That&apos;s how opportunities slip by.</p>
                  <p>That&apos;s how deposits don&apos;t get collected.</p>
                  <p>
                    That&apos;s how really good professionals end up feeling disorganized — even
                    when they&apos;re not.
                  </p>
                </div>

                <p className="mt-10 text-xl text-text-primary font-medium">
                  Handled exists so client communication and coordination don&apos;t rely on memory
                  or vigilance anymore.
                </p>
              </div>
            </div>
          </section>

          {/* ============================================
              SOLUTION INTRO
              ============================================ */}
          <section className="py-20 md:py-28 px-6">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight">
                Handled is the operations layer beneath your business.
              </h2>

              <div className="mt-8 space-y-2 text-lg text-text-muted">
                <p>Not another tool to manage.</p>
                <p>Not software you babysit.</p>
                <p>Not another inbox.</p>
              </div>

              <p className="mt-8 text-xl text-text-muted leading-relaxed">
                Handled sits underneath your service business and quietly holds everything together
                — before, during, and after the booking.
              </p>
            </div>
          </section>

          {/* ============================================
              FEATURES - What that means (with icons)
              ============================================ */}
          <section id="how-it-works" className="py-20 md:py-28 px-6 bg-surface-alt scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              <p className="text-sage text-sm font-medium tracking-wide uppercase text-center mb-4">
                What that means
              </p>

              <div className="grid md:grid-cols-2 gap-8 mt-12">
                {/* Feature 1 */}
                <div className="bg-surface rounded-2xl p-8 lg:p-10 border border-neutral-800">
                  <div className="w-12 h-12 rounded-full bg-sage/15 flex items-center justify-center mb-6">
                    <Globe className="w-6 h-6 text-sage" />
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-text-primary mb-4">
                    An Optimized Storefront
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    Your public front door — services, pricing, availability, booking, and payments
                    — structured so clients can move forward without friction.
                  </p>
                  <p className="mt-4 text-text-primary font-medium">
                    It&apos;s clear. It&apos;s professional. And it&apos;s something you&apos;re
                    actually proud to send people to.
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="bg-surface rounded-2xl p-8 lg:p-10 border border-neutral-800">
                  <div className="w-12 h-12 rounded-full bg-sage/15 flex items-center justify-center mb-6">
                    <Calendar className="w-6 h-6 text-sage" />
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-text-primary mb-4">
                    A Single Source of Truth
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    Every booking becomes a shared space where messages, changes, files, and
                    decisions live — instead of being scattered across email, text, and notes.
                  </p>
                  <p className="mt-4 text-text-primary font-medium">
                    No more digging. No more &quot;did we already cover this?&quot;
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="bg-surface rounded-2xl p-8 lg:p-10 border border-neutral-800">
                  <div className="w-12 h-12 rounded-full bg-sage/15 flex items-center justify-center mb-6">
                    <Users className="w-6 h-6 text-sage" />
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-text-primary mb-4">
                    Built-In Coordination
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    Routine questions get handled, context stays intact, and important moments
                    surface when attention is actually required — not constantly.
                  </p>
                  <p className="mt-4 text-text-primary font-medium">
                    Your business keeps moving, even when you&apos;re not actively managing it.
                  </p>
                </div>

                {/* Feature 4 */}
                <div className="bg-surface rounded-2xl p-8 lg:p-10 border border-neutral-800">
                  <div className="w-12 h-12 rounded-full bg-sage/15 flex items-center justify-center mb-6">
                    <Sparkles className="w-6 h-6 text-sage" />
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-text-primary mb-4">
                    Revenue Continuity
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    Follow-ups, reviews, repeat bookings, and next steps happen naturally, in
                    context — instead of as forgotten to-dos.
                  </p>
                  <p className="mt-4 text-text-primary font-medium">
                    Handled doesn&apos;t just reduce stress.
                    <br />
                    It protects revenue.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================
              PROJECT HUB WEDGE - Single Source of Truth Visual
              ============================================ */}
          <ProjectHubWedge />

          {/* ============================================
              USER JOURNEY - What it feels like (Timeline)
              ============================================ */}
          <section className="py-20 md:py-28 px-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center">
                What it feels like to use Handled
              </h2>
              <p className="mt-6 text-xl text-text-muted text-center">
                Most people expect setup.
                <br />
                They&apos;re surprised by how fast things click.
              </p>

              <div className="mt-16 space-y-12">
                {/* Day one */}
                <div className="border-l-2 border-sage/30 pl-8">
                  <p className="text-sage text-sm font-medium tracking-wide uppercase mb-2">
                    Day one
                  </p>
                  <p className="text-lg text-text-muted leading-relaxed">
                    You have a short conversation to set up your website, services, and
                    availability.
                  </p>
                  <p className="mt-4 text-lg text-text-primary font-medium">
                    Five minutes later, you have a site that looks right — and feels like you.
                  </p>
                </div>

                {/* Week one */}
                <div className="border-l-2 border-sage/30 pl-8">
                  <p className="text-sage text-sm font-medium tracking-wide uppercase mb-2">
                    Week one
                  </p>
                  <p className="text-lg text-text-muted leading-relaxed">
                    Handled looks at your local market and helps you define clear services and
                    pricing that make sense for where you live and who you serve.
                  </p>
                  <p className="mt-4 text-lg text-text-primary font-medium">
                    No guessing. No undercharging &quot;just to be safe.&quot;
                  </p>
                </div>

                {/* One quiet night */}
                <div className="border-l-2 border-sage/30 pl-8">
                  <p className="text-sage text-sm font-medium tracking-wide uppercase mb-2">
                    One quiet night
                  </p>
                  <p className="text-lg text-text-muted leading-relaxed">
                    While you&apos;re asleep, a client books.
                  </p>
                  <p className="mt-4 text-lg text-text-muted leading-relaxed">
                    Handled checks your calendar.
                    <br />
                    Answers their questions.
                    <br />
                    Collects a deposit.
                  </p>
                  <p className="mt-4 text-lg text-text-primary font-medium">
                    You wake up to a notification that money came in — without a single
                    back-and-forth.
                  </p>
                </div>

                {/* The job */}
                <div className="border-l-2 border-sage/30 pl-8">
                  <p className="text-sage text-sm font-medium tracking-wide uppercase mb-2">
                    The job
                  </p>
                  <p className="text-lg text-text-muted leading-relaxed">
                    Everything you need to know about that client lives in one place.
                  </p>
                  <p className="mt-4 text-lg text-text-primary font-medium">
                    The work goes off without friction.
                    <br />
                    The client feels taken care of.
                  </p>
                </div>

                {/* After */}
                <div className="border-l-2 border-sage/30 pl-8">
                  <p className="text-sage text-sm font-medium tracking-wide uppercase mb-2">
                    After
                  </p>
                  <p className="text-lg text-text-muted leading-relaxed">
                    The client leaves a review.
                    <br />
                    The project stays alive.
                    <br />
                    Rebooking is easy — not a restart.
                  </p>
                </div>
              </div>

              <p className="mt-16 text-xl md:text-2xl text-text-primary font-medium text-center leading-relaxed">
                Handled doesn&apos;t make you better at your craft.
                <br />
                It makes everything around your craft stop getting in the way.
              </p>
            </div>
          </section>

          {/* ============================================
              JOURNEY SHOWCASE - Visual demonstration
              ============================================ */}
          <section className="py-20 md:py-28 px-6 bg-surface-alt">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <p className="text-sage text-sm font-medium tracking-wide uppercase mb-4">
                  See it in action
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary leading-tight">
                  The complete client journey
                </h2>
              </div>
              <JourneyShowcase />
            </div>
          </section>

          {/* ============================================
              AGENT READABILITY
              ============================================ */}
          <section className="py-20 md:py-28 px-6">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight">
                Designed for how buying is changing
              </h2>

              <p className="mt-8 text-lg text-text-muted leading-relaxed">
                Clients are starting to rely on personal assistants and intelligent systems to
                research, schedule, and coordinate services.
              </p>

              <p className="mt-6 text-lg text-text-muted leading-relaxed">
                Handled is structured so your business can be clearly understood and correctly
                engaged — whether the request comes from a person or an assistant acting on their
                behalf.
              </p>

              <p className="mt-8 text-lg text-text-primary font-medium">
                You don&apos;t need to manage this shift.
                <br />
                Handled already accounts for it.
              </p>

              <p className="mt-10 text-xl md:text-2xl text-sage font-medium">
                Humans now.
                <br />
                Agent-readable next.
                <br />
                Same calm system underneath.
              </p>
            </div>
          </section>

          {/* ============================================
              WHO IT'S FOR / NOT FOR
              ============================================ */}
          <section className="py-20 md:py-28 px-6 bg-surface-alt">
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-12">
                {/* For */}
                <div>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mb-6">
                    Who Handled is for
                  </h3>
                  <p className="text-text-muted mb-6">
                    Handled is for service professionals where:
                  </p>
                  <ul className="space-y-4">
                    {[
                      'work is custom',
                      'details matter',
                      'client communication continues after the booking',
                      'dropped balls cost real money',
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-sage/15 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3.5 h-3.5 text-sage" />
                        </div>
                        <span className="text-text-primary text-lg">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-8 text-lg text-text-muted">
                    Photographers. Wedding planners. Chefs. Coaches. Consultants.
                  </p>
                  <p className="mt-4 text-lg text-text-primary font-medium">
                    If you sell expertise and trust, this is your operations layer.
                  </p>
                </div>

                {/* Not for */}
                <div>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mb-6">
                    Handled is not for:
                  </h3>
                  <ul className="space-y-4 mt-12">
                    {[
                      'physical product sellers',
                      'one-click, low-context transactions',
                      'businesses built on volume over clarity',
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
              ============================================ */}
          <section id="pricing" className="py-20 md:py-28 px-6 scroll-mt-20">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
                  Choose your level of handling
                </h2>
                <p className="text-xl text-text-muted">No contracts. Cancel anytime.</p>
              </div>

              {/* 2-Tier Grid */}
              <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto items-stretch pt-4">
                {tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className={`relative bg-surface rounded-2xl p-8 border transition-all duration-300 flex flex-col ${
                      tier.isPopular
                        ? 'border-2 border-sage shadow-xl shadow-sage/10'
                        : 'border-neutral-800 hover:border-sage/40'
                    }`}
                  >
                    {tier.isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                        <span className="inline-flex items-center gap-1.5 bg-sage text-white text-sm font-semibold px-4 py-1.5 rounded-full shadow-lg">
                          Most choose this
                        </span>
                      </div>
                    )}

                    <h3
                      className={`font-serif text-2xl font-bold text-text-primary ${tier.isPopular ? 'mt-2' : ''}`}
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
                      <p className="mt-2 text-text-muted">{tier.description}</p>
                    </div>

                    <ul className="mt-6 space-y-3 flex-1">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <Check className="w-4 h-4 text-sage flex-shrink-0 mt-1" />
                          <span className="text-text-primary text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <p className="mt-6 text-sm text-text-muted">{tier.targetAudience}</p>

                    {tier.valueStatement && (
                      <p className="mt-4 text-sm text-text-primary font-medium leading-relaxed">
                        {tier.valueStatement}
                      </p>
                    )}

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
            </div>
          </section>

          {/* ============================================
              FOUNDER STORY
              ============================================ */}
          <section className="py-20 md:py-28 px-6 bg-surface-alt">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary leading-tight">
                Built by someone who lived the problem
              </h2>

              <p className="mt-8 text-lg text-text-muted leading-relaxed">
                Handled was built by a private chef and photographer who spent two decades juggling
                clients, messages, websites, and multiple businesses — not because he lacked
                discipline, but because the systems never existed.
              </p>

              <p className="mt-6 text-lg text-text-primary font-medium">
                Handled is the system he needed then — and the one service professionals need now.
              </p>
            </div>
          </section>

          {/* ============================================
              FAQ
              ============================================ */}
          <section className="py-20 md:py-28 px-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary leading-tight text-center mb-12">
                Common questions
              </h2>

              <div className="space-y-6">
                {faqItems.map((item) => (
                  <div
                    key={item.question}
                    className="bg-surface rounded-2xl p-6 border border-neutral-800"
                  >
                    <h3 className="font-serif text-lg font-bold text-text-primary">
                      {item.question}
                    </h3>
                    <p className="mt-3 text-text-muted leading-relaxed">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============================================
              FINAL CTA
              ============================================ */}
          <section className="py-24 md:py-32 px-6 bg-surface-alt">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-6">
                Stop running your business on memory.
              </h2>
              <p className="text-xl md:text-2xl text-text-muted leading-relaxed mb-10">
                Install the operations layer that keeps bookings moving — and lets you focus on the
                work only you can do.
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
              <div className="font-serif text-lg font-bold text-text-primary">HANDLED</div>
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
