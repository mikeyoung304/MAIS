import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileNav } from '@/components/home/MobileNav';
import { ProductCarousel } from '@/components/home/ProductCarousel';
import { ProjectHubMockup } from '@/components/home/ProjectHubMockup';
import { ScrollingIdentity } from '@/components/home/ScrollingIdentity';
import { PricingSection } from '@/components/home/PricingSection';
import { TestimonialsSection } from '@/components/home/TestimonialsSection';
import { FAQSection } from '@/components/home/FAQSection';
import { LazyMountainDemo } from '@/components/home/LazyMountainDemo';

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
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
            <MobileNav />
          </div>
        </nav>

        <main>
          {/* ============================================
              HERO - Brand signature scrolling identity
              ============================================ */}
          <section className="relative pt-32 pb-16 md:pt-44 md:pb-24 px-6">
            <div className="max-w-3xl mx-auto text-center">
              <ScrollingIdentity />
              <p className="mt-6 font-serif text-2xl md:text-3xl text-sage font-medium">
                The rest is handled.
              </p>
              <p className="mt-4 text-lg md:text-xl text-text-muted leading-relaxed max-w-xl mx-auto">
                Done-for-you websites, booking, and AI — plus monthly updates on what's actually
                worth knowing.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link href="/signup">Get started</Link>
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
              TRANSITION - Narrative flow to features
              ============================================ */}
          <section className="py-20 bg-surface-alt">
            <div className="max-w-3xl mx-auto text-center px-6">
              <p className="text-xl md:text-2xl text-text-secondary leading-relaxed">
                Your business runs on trust and transformation. But booking systems, invoices, and
                follow-ups? That's not why you started. We handle the tech. You handle the magic.
              </p>
            </div>
          </section>

          {/* ============================================
              MOUNTAIN DEMO - Experience the difference
              ============================================ */}
          <section className="py-16 md:py-24 bg-surface">
            <div className="max-w-5xl mx-auto px-6">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                {/* Left: Context */}
                <div>
                  <h2 className="font-serif text-3xl md:text-4xl font-bold text-text-primary mb-4">
                    Experience the difference
                  </h2>
                  <p className="text-text-muted">
                    See what it feels like to go from climbing alone to soaring above.
                  </p>
                </div>

                {/* Right: Game */}
                <LazyMountainDemo />
              </div>
            </div>
          </section>

          {/* ============================================
              PRODUCT CAROUSEL - Show, don't tell
              ============================================ */}
          <section id="how-it-works" className="py-16 md:py-24 px-6 scroll-mt-20">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight">
                  See what you get.
                </h2>
              </div>

              <ProductCarousel />
            </div>
          </section>

          {/* ============================================
              TESTIMONIALS - Social proof (conditional)
              ============================================ */}
          <TestimonialsSection />

          {/* ============================================
              PROJECT HUB + MEMORY - Combined
              ============================================ */}
          <section className="py-20 md:py-28 px-6 bg-surface-alt">
            <div className="max-w-5xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-tight mb-4">
                    After they book, everything stays in one place.
                  </h2>
                  <p className="text-lg text-text-muted mb-6">
                    Every booking gets a shared page. Updates, files, questions — all in one thread.
                    No more scattered texts and emails.
                  </p>
                  <p className="text-text-muted mb-6">
                    And Handled remembers your clients. Repeat clients feel recognized, not
                    re-onboarded. The more you work together, the easier it gets.
                  </p>
                  <div className="border-l-2 border-sage pl-4">
                    <p className="text-lg text-text-primary italic">
                      &quot;If it relates to the job, it lives there.&quot;
                    </p>
                  </div>
                </div>

                <div>
                  <ProjectHubMockup />
                </div>
              </div>
            </div>
          </section>

          {/* ============================================
              PRICING - 3-tier with psychology
              ============================================ */}
          <PricingSection />

          {/* ============================================
              FAQ - Conversational accordion
              ============================================ */}
          <FAQSection />

          {/* ============================================
              CLOSING CTA
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
