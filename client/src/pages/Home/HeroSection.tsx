import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

/**
 * HeroSection - Apple-Minimal Waitlist Landing Page
 *
 * Single viewport, transformation-focused headline, exclusive positioning.
 * Mailchimp form for email capture with staggered fade-in animations.
 */
export function HeroSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);

    // TODO: Replace with your Mailchimp form action URL
    // For now, simulate submission and show success
    // When ready, replace this with actual Mailchimp form post
    await new Promise((resolve) => setTimeout(resolve, 800));

    setSubmitted(true);
    setIsSubmitting(false);
  };

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative min-h-screen flex items-center justify-center bg-surface px-6 sm:px-8"
    >
      <div className="max-w-3xl mx-auto text-center">
        {/* Headline - Staggered animation */}
        <h1
          id="hero-heading"
          className="font-serif text-4xl sm:text-5xl md:text-[56px] font-bold text-text-primary leading-[1.1] tracking-tight mb-6 animate-fade-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          Wake up to
          <br />
          <span className="text-sage">"New booking confirmed."</span>
        </h1>

        {/* Subheadline */}
        <p
          className="text-lg sm:text-xl md:text-[21px] text-text-muted mb-10 leading-relaxed max-w-2xl mx-auto animate-fade-slide-up"
          style={{ animationDelay: "0.4s" }}
        >
          Booking systems for service businesses. Clients go from inquiry to paid while you focus on your craft.
        </p>

        {/* Email Form or Success State */}
        <div
          className="animate-fade-slide-up"
          style={{ animationDelay: "0.6s" }}
        >
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
                className="flex-1 px-6 py-4 border border-sage-light/30 rounded-full text-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent transition-all"
                aria-label="Email address"
              />
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="bg-sage hover:bg-sage-hover text-white font-semibold text-base whitespace-nowrap px-8 py-4 h-14 min-w-[220px] rounded-full group transition-all duration-300 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Request Early Access
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                  </span>
                )}
              </Button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-3 text-sage font-medium text-lg">
              <div className="w-8 h-8 bg-sage/10 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              You're on the list. We'll be in touch.
            </div>
          )}
        </div>

        {/* Exclusivity Line */}
        <p
          className="text-sm text-text-muted mt-4 animate-fade-slide-up"
          style={{ animationDelay: "0.7s" }}
        >
          Currently onboarding founding partners.
        </p>

        {/* Transformation Whisper */}
        <div
          className="mt-16 animate-fade-slide-up"
          style={{ animationDelay: "0.8s" }}
        >
          <p className="text-base sm:text-lg text-text-muted/80 italic leading-relaxed">
            Fuller calendar. Quieter inbox.
            <br />
            Back to doing what you love.
          </p>
        </div>
      </div>
    </section>
  );
}
