import Link from 'next/link';
import { Metadata } from 'next';
import {
  ArrowRight,
  Check,
  Globe,
  Calendar,
  CreditCard,
  MessageSquare,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientHubMockup } from '@/components/home/ClientHubMockup';
import { MobileNav } from '@/components/home/MobileNav';

export const metadata: Metadata = {
  title: 'GetHandled.ai — Your Entire Business, All in One Link',
  description:
    'From first click to final thank-you, every job lives on one beautiful page — built for your services, your clients, and your peace of mind.',
  openGraph: {
    title: 'GetHandled.ai — Your Entire Business, All in One Link',
    description:
      'From first click to final thank-you, every job lives on one beautiful page — built for your services, your clients, and your peace of mind.',
    type: 'website',
  },
};

const systemFeatures = [
  { icon: Globe, label: 'Live storefront' },
  { icon: Calendar, label: 'Smart scheduling' },
  { icon: CreditCard, label: 'Payments & invoices' },
  { icon: MessageSquare, label: 'AI follow-ups' },
  { icon: FileText, label: 'Real-time message thread' },
  { icon: RefreshCw, label: 'Branded client hub' },
];

const beforeAfterItems = [
  {
    before: 'You copy/paste calendar links into emails',
    after: 'Every job has one link, one page',
  },
  {
    before: 'Clients forget forms, send DMs at 11pm',
    after: "They have a hub. They don't need to ask",
  },
  {
    before: 'You chase payments, resend PDFs',
    after: 'Invoices, docs, and messages live in one thread',
  },
  {
    before: 'You miss rebooking windows',
    after: 'Clients get prompted — automatically',
  },
  {
    before: 'Your systems feel like a patchwork',
    after: 'This is quiet, modern infrastructure',
  },
];

export default function HomePage() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Handled',
    url: 'https://gethandled.ai',
    description:
      'From first click to final thank-you, every job lives on one beautiful page — built for your services, your clients, and your peace of mind.',
    sameAs: [],
  };

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Handled',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'Your storefront and your back office — in one. A permanent, branded URL for every job.',
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
                href="#preview"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                Preview
              </Link>
              <Link
                href="/login"
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                Login
              </Link>
              <Button asChild variant="sage" className="rounded-full px-6 py-2">
                <Link href="/signup">See My Client Page</Link>
              </Button>
            </div>
            <MobileNav />
          </div>
        </nav>

        <main>
          {/* ============================================
              SECTION 1: HERO
              Centered, emotional, one-link positioning
              ============================================ */}
          <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.1] tracking-tight">
                Your Entire Business,
                <br />
                <span className="text-sage">All in One Link</span>
              </h1>
              <p className="mt-8 text-lg md:text-xl text-text-muted leading-relaxed max-w-2xl mx-auto">
                From first click to final thank-you, every job lives on one beautiful page — built
                for your services, your clients, and your peace of mind. No more emails, no more
                calendar links, no more missed details. Just one place where everything happens.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-8 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link href="/signup">See My Client Page</Link>
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
              SECTION 2: NOT ANOTHER TOOL — IT'S A SYSTEM
              Callout checklist, back office + storefront
              ============================================ */}
          <section id="how-it-works" className="py-24 md:py-32 px-6 bg-surface-alt scroll-mt-20">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <p className="text-sm font-medium text-sage uppercase tracking-wide mb-4">
                  This isn&apos;t another tool. It&apos;s a system.
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight">
                  Handled is your storefront and your back office — in one.
                </h2>
              </div>

              <div className="space-y-6 text-lg text-text-muted leading-relaxed">
                <p>
                  Imagine this: A client finds you, books you, pays you, messages you, sends you
                  notes, reschedules, shares photos, leaves a review, and books you again — all in
                  the same place.
                </p>
                <p className="text-text-primary font-medium">That&apos;s what Handled creates.</p>
                <p>
                  You get a permanent, branded URL for every job. Clients return to it forever.
                  <br />
                  It&apos;s not a calendar link. It&apos;s not a CRM. It&apos;s the command center
                  for every job you take.
                </p>
              </div>

              {/* Feature Callout Grid */}
              <div className="mt-12 grid grid-cols-2 md:grid-cols-3 gap-4">
                {systemFeatures.map((feature) => (
                  <div
                    key={feature.label}
                    className="flex items-center gap-3 bg-surface rounded-xl p-4 border border-neutral-800"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-4 h-4 text-sage" />
                    </div>
                    <span className="text-sm text-text-primary font-medium">{feature.label}</span>
                  </div>
                ))}
              </div>

              <p className="mt-10 text-center text-lg text-text-muted">
                You don&apos;t duct tape this together.{' '}
                <span className="text-sage font-semibold">You Handled it.</span>
              </p>
            </div>
          </section>

          {/* ============================================
              SECTION 3: BEFORE & AFTER
              Visual comparison table
              ============================================ */}
          <section className="py-24 md:py-32 px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight text-center mb-16">
                Before & After
              </h2>

              {/* Comparison Table */}
              <div className="overflow-hidden rounded-2xl border border-neutral-800">
                {/* Header */}
                <div className="grid grid-cols-2 bg-surface-alt">
                  <div className="px-6 py-4 border-r border-neutral-800">
                    <span className="text-sm font-semibold text-text-muted uppercase tracking-wide">
                      Before Handled
                    </span>
                  </div>
                  <div className="px-6 py-4">
                    <span className="text-sm font-semibold text-sage uppercase tracking-wide">
                      After Handled
                    </span>
                  </div>
                </div>

                {/* Rows */}
                {beforeAfterItems.map((item, index) => (
                  <div
                    key={index}
                    className={`grid grid-cols-2 ${index !== beforeAfterItems.length - 1 ? 'border-b border-neutral-800' : ''}`}
                  >
                    <div className="px-6 py-5 border-r border-neutral-800 bg-surface">
                      <p className="text-text-muted leading-relaxed">{item.before}</p>
                    </div>
                    <div className="px-6 py-5 bg-surface flex items-center gap-3">
                      <Check className="w-5 h-5 text-sage flex-shrink-0" />
                      <p className="text-text-primary font-medium leading-relaxed">{item.after}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Side Copy */}
              <div className="mt-12 text-center max-w-2xl mx-auto">
                <p className="text-lg text-text-muted leading-relaxed">
                  With Handled, there are no &quot;oops&quot; moments.
                  <br />
                  No lost files. No forgotten notes.
                  <br />
                  <span className="text-text-primary font-medium">
                    Just clear, professional communication — from booking to delivery.
                  </span>
                </p>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 4: EMOTIONAL CERTAINTY CLOSE
              Professional. Human. Nothing Slips.
              ============================================ */}
          <section className="py-24 md:py-32 px-6 bg-surface-alt">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-8">
                Professional. Human. Nothing Slips.
              </h2>

              <div className="space-y-6 text-lg text-text-muted leading-relaxed">
                <p>
                  Handled isn&apos;t about saving you clicks.
                  <br />
                  <span className="text-text-primary font-medium">
                    It&apos;s about saving your reputation, your headspace, and your weekends.
                  </span>
                </p>
                <p>
                  It&apos;s not about &quot;automating workflows.&quot;
                  <br />
                  It&apos;s about never forgetting the bride&apos;s note about her uncle not
                  standing next to her mom.
                </p>
                <p>
                  It&apos;s not about &quot;scaling operations.&quot;
                  <br />
                  It&apos;s about your client knowing — instantly — that they&apos;re in good hands.
                </p>
              </div>

              <p className="mt-10 text-xl text-text-primary font-medium">
                You deserve a system that makes you look like you have a team, even when it&apos;s
                just you.
              </p>

              <div className="mt-10">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link href="/signup">See How It Feels</Link>
                </Button>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 5: LIVE PREVIEW DEMO
              Client Hub mockup with labels
              ============================================ */}
          <section id="preview" className="py-24 md:py-32 px-6 scroll-mt-20">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
                  What Your Clients See After They Book You
                </h2>
                <p className="text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
                  Handled gives every client a permanent page where everything lives. They
                  don&apos;t have to search their inbox. They don&apos;t have to text you again.
                  They just go here.
                </p>
                <p className="mt-4 text-xl text-text-primary font-medium">
                  This is what calm looks like.
                </p>
              </div>

              {/* Client Hub Mockup */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-sage/5 to-sage/10 rounded-3xl blur-3xl" />
                <div className="relative">
                  <ClientHubMockup />
                </div>
              </div>

              <div className="mt-12 text-center">
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full px-8 py-5 text-lg border-sage/50 text-sage hover:bg-sage/10 group"
                >
                  <Link href="/signup" className="flex items-center gap-2">
                    Preview My Client Hub
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {/* ============================================
              SECTION 6: FINAL CTA
              Consolidate the chaos
              ============================================ */}
          <section className="py-24 md:py-32 px-6 border-t border-neutral-800">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-6">
                Still juggling systems?
              </h2>
              <p className="text-xl text-text-muted leading-relaxed mb-10">
                Let&apos;s consolidate that chaos.
              </p>
              <Button
                asChild
                variant="sage"
                className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Link href="/signup">Start With Your Own Hub</Link>
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
