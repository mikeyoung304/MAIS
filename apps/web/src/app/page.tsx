'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollingIdentity } from '@/components/home/ScrollingIdentity';
import {
  Check,
  Globe,
  Users,
  Sparkles,
  Calendar,
  CreditCard,
  Phone,
  Loader2,
  ArrowRight,
} from 'lucide-react';

/**
 * MAIS Landing Page v2
 *
 * Positioning: AI Growth Club + Marketing Firm + Tech Consulting
 * 3-tier pricing: Starter ($40) | Growth Club ($99) | Private Consulting
 */
export default function HomePage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    // TODO: Integrate with email list API
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSubmitted(true);
    setIsSubmitting(false);
  };

  return (
    <main className="bg-white">
      {/* ===== HERO SECTION ===== */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden"
        aria-labelledby="hero-heading"
      >
        {/* Ambient decoration */}
        <div
          className="absolute top-1/4 right-[15%] w-96 h-96 bg-sage/8 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-1/4 left-[10%] w-64 h-64 bg-sage/5 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Overline */}
          <p className="text-sm font-medium uppercase tracking-widest text-sage">
            AI Growth Club
          </p>

          {/* Headline with scrolling animation */}
          <h1
            id="hero-heading"
            className="mt-8 font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.15] tracking-tight text-text-primary"
          >
            You didn&apos;t start this
            <br />
            to become a tech expert.
          </h1>

          {/* Scrolling identity */}
          <p className="mt-8 text-xl sm:text-2xl md:text-3xl font-light text-text-muted">
            You&apos;re a <ScrollingIdentity />
          </p>

          {/* Subheadline */}
          <p className="mx-auto mt-8 max-w-2xl text-lg md:text-xl font-light leading-relaxed text-text-muted">
            We handle the tech, the marketing, and the AI—so you can focus on what you actually started this for.
          </p>

          {/* CTA Buttons */}
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="sage"
              size="xl"
              asChild
            >
              <Link href="/signup">
                Join the Club
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="xl"
              asChild
            >
              <Link href="#pricing">
                See Pricing
              </Link>
            </Button>
          </div>

          {/* Trust Signal */}
          <p className="mt-16 text-sm text-text-muted">
            Marketing firm. Tech consulting. AI strategy. All in one membership.
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-neutral-300 flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-neutral-400 rounded-full" />
          </div>
        </div>
      </section>

      {/* ===== PROBLEM SECTION ===== */}
      <section
        className="py-32 md:py-40 bg-neutral-50 px-6"
        aria-labelledby="problem-heading"
      >
        <div className="max-w-3xl mx-auto text-center">
          <h2
            id="problem-heading"
            className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-[1.15] tracking-tight"
          >
            Running a business shouldn&apos;t require
            <br />
            a computer science degree.
          </h2>

          <p className="mt-8 text-xl md:text-2xl font-light leading-relaxed text-text-muted">
            Website builders. Payment processors. Email marketing. Social media schedulers.
            CRM systems. AI tools. The tech stack keeps growing.
          </p>

          <p className="mt-8 text-xl md:text-2xl font-light leading-relaxed text-text-muted">
            You didn&apos;t sign up to manage subscriptions.
            <br />
            You signed up to build something meaningful.
          </p>
        </div>
      </section>

      {/* ===== SOLUTION SECTION ===== */}
      <section
        className="py-32 md:py-40 bg-white px-6"
        aria-labelledby="solution-heading"
      >
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2
            id="solution-heading"
            className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-[1.15] tracking-tight"
          >
            Your growth team. On demand.
          </h2>

          <p className="mt-8 text-xl md:text-2xl font-light leading-relaxed text-text-muted">
            MAIS is a marketing firm, tech consultancy, and AI strategy partner—wrapped
            into one membership. We give you the tools and the guidance to grow.
          </p>
        </div>

        {/* What you get */}
        <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
              <Globe className="h-6 w-6 text-sage" />
            </div>
            <h3 className="font-semibold text-lg text-text-primary mb-2">
              Professional Storefront
            </h3>
            <p className="text-text-muted">
              A beautiful booking site that makes you look as professional as you are.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
              <Calendar className="h-6 w-6 text-sage" />
            </div>
            <h3 className="font-semibold text-lg text-text-primary mb-2">
              Booking & Scheduling
            </h3>
            <p className="text-text-muted">
              Clients pick a time, book, and pay. No back-and-forth.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
              <CreditCard className="h-6 w-6 text-sage" />
            </div>
            <h3 className="font-semibold text-lg text-text-primary mb-2">
              Automatic Payments
            </h3>
            <p className="text-text-muted">
              Deposits, invoices, and payment processing—handled.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
              <Sparkles className="h-6 w-6 text-sage" />
            </div>
            <h3 className="font-semibold text-lg text-text-primary mb-2">
              AI Growth Assistant
            </h3>
            <p className="text-text-muted">
              Get personalized advice on growing your business, powered by AI.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
              <Users className="h-6 w-6 text-sage" />
            </div>
            <h3 className="font-semibold text-lg text-text-primary mb-2">
              Monthly AI Masterclass
            </h3>
            <p className="text-text-muted">
              Group Zoom calls where we share the latest AI tools and strategies.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
              <Phone className="h-6 w-6 text-sage" />
            </div>
            <h3 className="font-semibold text-lg text-text-primary mb-2">
              Real Human Support
            </h3>
            <p className="text-text-muted">
              Questions? We answer them. No chatbots, no tickets—just help.
            </p>
          </div>
        </div>
      </section>

      {/* ===== PRICING SECTION ===== */}
      <section
        id="pricing"
        className="py-32 md:py-40 bg-neutral-50 px-6"
        aria-labelledby="pricing-heading"
      >
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2
            id="pricing-heading"
            className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-[1.15] tracking-tight"
          >
            Simple, honest pricing.
          </h2>

          <p className="mt-8 text-xl md:text-2xl font-light leading-relaxed text-text-muted">
            No hidden fees. No annual contracts. Cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="max-w-5xl mx-auto grid gap-8 lg:grid-cols-3">
          {/* Starter */}
          <div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100">
            <h3 className="font-semibold text-lg text-text-primary">Starter</h3>
            <p className="mt-2 text-text-muted text-sm">The essentials to get going</p>

            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-text-primary">$40</span>
              <span className="text-text-muted">/month</span>
            </div>

            <ul className="mt-8 space-y-4">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
                <span className="text-text-muted">Professional storefront</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
                <span className="text-text-muted">Online booking & scheduling</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
                <span className="text-text-muted">Payment processing</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
                <span className="text-text-muted">Email notifications</span>
              </li>
            </ul>

            <Button variant="outline" className="w-full mt-8" asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>

          {/* Growth Club - HERO */}
          <div className="bg-white rounded-3xl p-8 shadow-2xl border-2 border-sage relative lg:-mt-4 lg:mb-4">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-sage text-white text-sm font-medium px-4 py-1 rounded-full">
                Most Popular
              </span>
            </div>

            <h3 className="font-semibold text-lg text-text-primary">Growth Club</h3>
            <p className="mt-2 text-text-muted text-sm">Everything + AI community</p>

            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-text-primary">$99</span>
              <span className="text-text-muted">/month</span>
            </div>

            <ul className="mt-8 space-y-4">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
                <span className="text-text-muted">Everything in Starter</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
                <span className="text-text-muted">AI Growth Assistant</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
                <span className="text-text-muted font-medium text-text-primary">Monthly AI Masterclass (Zoom)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
                <span className="text-text-muted">Custom branding</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
                <span className="text-text-muted">Priority support</span>
              </li>
            </ul>

            <Button variant="sage" className="w-full mt-8" asChild>
              <Link href="/signup">
                Join the Club
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Private Consulting */}
          <div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100">
            <h3 className="font-semibold text-lg text-text-primary">Private Consulting</h3>
            <p className="mt-2 text-text-muted text-sm">Hands-on AI strategy for your business</p>

            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-text-primary">Custom</span>
            </div>

            <ul className="mt-8 space-y-4">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
                <span className="text-text-muted">Everything in Growth Club</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
                <span className="text-text-muted">1-on-1 AI consulting sessions</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
                <span className="text-text-muted">Custom AI tool development</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
                <span className="text-text-muted">Marketing strategy sessions</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
                <span className="text-text-muted">Dedicated account manager</span>
              </li>
            </ul>

            <Button variant="outline" className="w-full mt-8" asChild>
              <Link href="/contact">Book a Call</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section
        className="py-32 md:py-48 bg-sage px-6"
        aria-labelledby="cta-heading"
      >
        <div className="max-w-3xl mx-auto text-center">
          <h2
            id="cta-heading"
            className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-[1.15] tracking-tight"
          >
            Ready to stop being the IT department?
          </h2>

          <p className="mt-8 text-xl md:text-2xl font-light leading-relaxed text-white/80">
            Join business owners who&apos;ve traded tech headaches for growth.
          </p>

          {/* Email Capture */}
          <form onSubmit={handleSubmit} className="mt-12 flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            {submitted ? (
              <div className="flex items-center justify-center gap-2 w-full py-4 text-white font-medium">
                <Check className="h-5 w-5" />
                <span>You&apos;re in. We&apos;ll be in touch.</span>
              </div>
            ) : (
              <>
                <Input
                  type="email"
                  placeholder="Your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 h-14 px-6 text-lg bg-white border-0 focus:ring-4 focus:ring-white/30"
                  aria-label="Email address"
                />
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-white hover:bg-white/95 text-sage font-semibold px-8 py-4 h-14 rounded-full transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 whitespace-nowrap"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Join the Club'
                  )}
                </Button>
              </>
            )}
          </form>

          {/* Already have account */}
          <p className="mt-8 text-white/70">
            Already a member?{' '}
            <Link href="/login" className="text-white underline hover:no-underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12 bg-white border-t border-neutral-100 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <p className="font-serif text-xl font-bold text-text-primary">
              MAIS
            </p>
            <p className="text-sm text-text-muted mt-1">
              AI Growth Club
            </p>
          </div>
          <nav className="flex gap-6 text-sm text-text-muted">
            <Link href="/login" className="hover:text-sage transition-colors">
              Login
            </Link>
            <Link href="/signup" className="hover:text-sage transition-colors">
              Sign Up
            </Link>
            <Link href="/terms" className="hover:text-sage transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-sage transition-colors">
              Privacy
            </Link>
          </nav>
          <p className="text-sm text-text-muted">
            &copy; {new Date().getFullYear()} Macon AI Solutions
          </p>
        </div>
      </footer>
    </main>
  );
}
