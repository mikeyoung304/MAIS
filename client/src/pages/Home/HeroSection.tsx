import { Button } from '@/components/ui/button';
import { ArrowRight, Check } from 'lucide-react';
import { useWaitlistForm } from '@/hooks/useWaitlistForm';

/**
 * HeroSection - Apple-quality hero
 *
 * Lead with transformation, not features.
 * Generous typography, subtle ambient animation.
 */
export function HeroSection() {
  const { email, setEmail, submitted, isLoading, error, handleSubmit } = useWaitlistForm();

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative min-h-screen flex items-center justify-center bg-surface overflow-hidden"
    >
      {/* Ambient background elements */}
      <div
        className="absolute top-1/4 right-[15%] w-96 h-96 bg-sage/8 rounded-full blur-3xl"
        style={{ animation: 'pulse 6s ease-in-out infinite' }}
      />
      <div
        className="absolute bottom-1/4 left-[10%] w-72 h-72 bg-sage/5 rounded-full blur-3xl"
        style={{ animation: 'pulse 8s ease-in-out infinite', animationDelay: '2s' }}
      />

      <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
        {/* Overline */}
        <p
          className="text-sage text-sm font-medium tracking-[0.2em] uppercase mb-8 animate-fade-slide-up"
          style={{ animationDelay: '0.1s' }}
        >
          From Idea to Booking
        </p>

        {/* Headline */}
        <h1
          id="hero-heading"
          className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-text-primary leading-[1.05] tracking-tight mb-8 animate-fade-slide-up"
          style={{ animationDelay: '0.2s' }}
        >
          You didn&apos;t start this
          <br />
          <span className="text-sage">to become a tech expert.</span>
        </h1>

        {/* Subheadline */}
        <p
          className="text-xl md:text-2xl text-text-muted font-light mb-6 leading-relaxed max-w-2xl mx-auto animate-fade-slide-up"
          style={{ animationDelay: '0.4s' }}
        >
          Squarespace. Acuity. Stripe. Analytics. SEO.
          <br />
          The subscriptions add up. The learning curve never ends.
          <br />
          <br />
          You need a professional online presence — not a second job.
        </p>

        <p
          className="text-base md:text-lg text-text-muted mb-10 animate-fade-slide-up"
          style={{ animationDelay: '0.5s' }}
        >
          One monthly fee. Everything handled. You focus on your craft.
        </p>

        {/* Email Form */}
        <div className="animate-fade-slide-up" style={{ animationDelay: '0.6s' }}>
          {!submitted ? (
            <>
              <form
                data-testid="hero-waitlist-form"
                aria-label="Early access request form"
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto"
              >
                <input
                  type="email"
                  name="EMAIL"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email"
                  required
                  className="flex-1 px-6 py-4 border-2 border-neutral-200 rounded-full text-lg bg-white
                             transition-all duration-200
                             focus:border-sage focus:ring-4 focus:ring-sage/10 focus:outline-none
                             hover:border-neutral-300"
                  aria-label="Email address"
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={isLoading}
                  className="bg-sage hover:bg-sage-hover text-white font-semibold text-base
                             whitespace-nowrap px-10 py-4 h-14 rounded-full
                             transition-all duration-300 ease-out
                             hover:shadow-xl hover:-translate-y-0.5
                             disabled:opacity-70 group"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Apply for Early Access
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  )}
                </Button>
              </form>
              {error && (
                <p
                  role="alert"
                  aria-live="polite"
                  aria-atomic="true"
                  className="mt-4 text-red-600 text-sm text-center"
                >
                  {error}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center gap-3 text-sage font-medium text-lg">
              <div className="w-10 h-10 bg-sage/10 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              Welcome. We'll be in touch soon.
            </div>
          )}
        </div>

        {/* Trust line */}
        <p
          className="text-sm text-text-muted/60 mt-6 animate-fade-slide-up"
          style={{ animationDelay: '0.7s' }}
        >
          Empowering small business owners and startups to launch and grow.
        </p>
      </div>
    </section>
  );
}
