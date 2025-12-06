import { useState } from 'react';
import { Container } from '@/ui/Container';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * WaitlistCTASection - Final conversion moment
 *
 * Generous spacing, emotional headline, clean form.
 */
export function WaitlistCTASection() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await api.requestEarlyAccess(email);
      if (response.status === 200) {
        setSubmitted(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="waitlist-cta"
      aria-labelledby="waitlist-cta-heading"
      className="py-32 md:py-48 bg-sage relative overflow-hidden"
    >
      {/* Subtle ambient decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full blur-3xl" />

      <Container className="relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          {/* Headline */}
          <h2
            id="waitlist-cta-heading"
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-[1.1] tracking-tight"
          >
            From idea to booked.
          </h2>

          {/* Subline */}
          <p className="text-xl text-white/80 mb-12 font-light">
            Your business deserves a professional launch.
          </p>

          {/* Form */}
          {!submitted ? (
            <form
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
                className="flex-1 px-6 py-4 border-0 rounded-full text-lg bg-white text-text-primary
                           transition-all duration-200
                           focus:outline-none focus:ring-4 focus:ring-white/30"
                aria-label="Email address"
              />
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="bg-white hover:bg-white/95 text-sage font-semibold text-base
                           whitespace-nowrap px-10 py-4 h-14 rounded-full
                           transition-all duration-300 ease-out
                           hover:shadow-xl hover:-translate-y-0.5
                           disabled:opacity-70 group"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-sage/30 border-t-sage rounded-full animate-spin" />
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Request Early Access
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                )}
              </Button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-3 text-white font-medium text-xl">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              Welcome. We'll be in touch soon.
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
