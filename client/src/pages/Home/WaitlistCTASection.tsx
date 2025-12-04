import { useState } from "react";
import { Container } from "@/ui/Container";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

/**
 * WaitlistCTASection - Simple final ask
 */
export function WaitlistCTASection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);

    // TODO: Replace with your Mailchimp form action URL
    await new Promise((resolve) => setTimeout(resolve, 800));

    setSubmitted(true);
    setIsSubmitting(false);
  };

  return (
    <section
      id="waitlist-cta"
      aria-labelledby="waitlist-cta-heading"
      className="py-20 sm:py-28 bg-sage"
    >
      <Container>
        <div className="max-w-2xl mx-auto text-center">
          <h2
            id="waitlist-cta-heading"
            className="font-serif text-3xl sm:text-4xl font-bold text-white mb-8"
          >
            Ready?
          </h2>

          {!submitted ? (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                name="EMAIL"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                required
                className="flex-1 px-6 py-4 border-0 rounded-full text-lg bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                aria-label="Email address"
              />
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="bg-white hover:bg-white/90 text-sage font-semibold text-base whitespace-nowrap px-8 py-4 h-14 rounded-full group transition-all duration-300 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-sage/30 border-t-sage rounded-full animate-spin" />
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Get Started
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                  </span>
                )}
              </Button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-3 text-white font-medium text-lg">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              We'll be in touch.
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
