'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Calendar, CreditCard, MessageSquare, Loader2 } from 'lucide-react';

/**
 * MAIS Landing Page
 *
 * Structure follows Brand Voice Guide:
 * 1. Hero - Transformation promise + email capture
 * 2. Problem - Identity statement + specific details
 * 3. Solution - Value prop + how it works
 * 4. Social Proof - Aspirational framing
 * 5. CTA - Question format close
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
        {/* Ambient decoration - subtle */}
        <div
          className="absolute top-1/4 right-[15%] w-96 h-96 bg-sage/8 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-1/4 left-[10%] w-64 h-64 bg-sage/5 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative max-w-3xl mx-auto text-center">
          {/* Overline */}
          <p className="text-sm font-medium uppercase tracking-widest text-sage">
            Business Growth Club
          </p>

          {/* Headline */}
          <h1
            id="hero-heading"
            className="mt-8 font-serif text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.1] tracking-tight text-text-primary"
          >
            Book more clients.
            <br />
            Build your business.
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-8 max-w-xl text-xl md:text-2xl font-light leading-relaxed text-text-muted">
            The booking platform for creative professionals who&apos;d rather be creating.
          </p>

          {/* Email Capture Form */}
          <form onSubmit={handleSubmit} className="mt-12 flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            {submitted ? (
              <div className="flex items-center justify-center gap-2 w-full py-4 text-sage font-medium">
                <Check className="h-5 w-5" />
                <span>Welcome. We&apos;ll be in touch soon.</span>
              </div>
            ) : (
              <>
                <Input
                  type="email"
                  placeholder="Your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 h-14 px-6 text-lg border-2 border-neutral-200 focus:border-sage focus:ring-4 focus:ring-sage/10"
                  aria-label="Email address"
                />
                <Button
                  type="submit"
                  variant="sage"
                  size="xl"
                  disabled={isSubmitting}
                  className="whitespace-nowrap"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Request Early Access'
                  )}
                </Button>
              </>
            )}
          </form>

          {/* Trust Signal */}
          <p className="mt-16 text-sm text-text-muted">
            Partnering with creative professionals through revenue-sharing.
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
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-[1.1] tracking-tight"
          >
            You&apos;re a photographer, not a bookkeeper.
          </h2>

          <p className="mt-8 text-xl md:text-2xl font-light leading-relaxed text-text-muted">
            But somewhere between the Instagram DM and the final gallery delivery,
            you became both. Calendar Tetris. Deposit tracking. Invoice chasing.
          </p>

          <p className="mt-8 text-xl md:text-2xl font-light leading-relaxed text-text-muted">
            Every hour on admin is an hour you&apos;re not behind the lens.
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
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-[1.1] tracking-tight"
          >
            One link. Complete booking system.
          </h2>

          <p className="mt-8 text-xl md:text-2xl font-light leading-relaxed text-text-muted">
            Your clients choose a package, pick a date, and pay&mdash;all in one flow.
            You get a text when someone books. That&apos;s it.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-3">
          <div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
              <Calendar className="h-6 w-6 text-sage" />
            </div>
            <h3 className="font-semibold text-lg text-text-primary mb-2">
              Instant Booking
            </h3>
            <p className="text-text-muted">
              Clients pick a date from your availability. No back-and-forth emails.
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
              Deposits collected upfront. Final payments processed automatically.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
              <MessageSquare className="h-6 w-6 text-sage" />
            </div>
            <h3 className="font-semibold text-lg text-text-primary mb-2">
              AI Growth Assistant
            </h3>
            <p className="text-text-muted">
              Get personalized advice to grow your business. Like a consultant, but always available.
            </p>
          </div>
        </div>
      </section>

      {/* ===== SOCIAL PROOF SECTION ===== */}
      <section
        className="py-32 md:py-40 bg-neutral-50 px-6"
        aria-labelledby="proof-heading"
      >
        <div className="max-w-3xl mx-auto text-center">
          <h2
            id="proof-heading"
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-[1.1] tracking-tight"
          >
            Built for creatives who mean business.
          </h2>

          <p className="mt-8 text-xl md:text-2xl font-light leading-relaxed text-text-muted">
            Photographers. Wedding planners. Event coordinators. Artists.
            If you&apos;d rather be creating than administrating, you&apos;re in the right place.
          </p>

          {/* Trust indicators */}
          <div className="mt-16 flex flex-wrap justify-center gap-8 text-text-muted">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-sage" />
              <span>No setup fees</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-sage" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-sage" />
              <span>Cancel anytime</span>
            </div>
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
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-[1.1] tracking-tight"
          >
            Ready to get back to your craft?
          </h2>

          <p className="mt-8 text-xl md:text-2xl font-light leading-relaxed text-white/80">
            Join creative professionals who&apos;ve reclaimed their time.
          </p>

          {/* CTA Form */}
          <form onSubmit={handleSubmit} className="mt-12 flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            {submitted ? (
              <div className="flex items-center justify-center gap-2 w-full py-4 text-white font-medium">
                <Check className="h-5 w-5" />
                <span>You&apos;re on the list!</span>
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
                  className="bg-white hover:bg-white/95 text-sage font-semibold px-10 py-4 h-14 rounded-full transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 whitespace-nowrap"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Get Started'
                  )}
                </Button>
              </>
            )}
          </form>

          {/* Already have account */}
          <p className="mt-8 text-white/70">
            Already have an account?{' '}
            <Link href="/login" className="text-white underline hover:no-underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12 bg-white border-t border-neutral-100 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="font-serif text-xl font-bold text-text-primary">
            MAIS
          </p>
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
