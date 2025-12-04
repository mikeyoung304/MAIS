import { memo } from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';
import { Container } from '@/ui/Container';

interface FinalCtaConfig {
  headline: string;
  subheadline?: string;
  ctaText: string;
}

interface FinalCtaSectionProps {
  config: FinalCtaConfig;
}

/**
 * Final call-to-action section for landing pages
 *
 * Displayed at the bottom of the landing page to provide a final conversion opportunity
 * after users have consumed all content. Features a prominent gradient background,
 * decorative elements, and a call-to-action that scrolls back up to the experiences
 * section for booking.
 *
 * The scroll behavior respects user motion preferences (prefers-reduced-motion) for
 * accessibility. Uses an upward arrow icon to indicate the scroll direction back to
 * the experiences section at the top of the page.
 *
 * @example
 * ```tsx
 * <FinalCtaSection
 *   config={{
 *     headline: "Ready to Experience Farm Life?",
 *     subheadline: "Book your visit today and create lasting memories",
 *     ctaText: "View Experiences"
 *   }}
 * />
 * ```
 *
 * @param props.config - Final CTA section configuration from tenant branding
 * @param props.config.headline - Main CTA headline (required)
 * @param props.config.subheadline - Supporting text below headline (optional)
 * @param props.config.ctaText - Call-to-action button text (required)
 *
 * @see FinalCtaSectionConfigSchema in @macon/contracts for Zod validation
 */
export const FinalCtaSection = memo(function FinalCtaSection({ config }: FinalCtaSectionProps) {
  const scrollToExperiences = () => {
    const experiencesSection = document.getElementById('experiences');
    if (experiencesSection) {
      // Respect user motion preferences
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      experiencesSection.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
  };

  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-primary to-primary/80 text-white relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      </div>

      <Container className="relative z-10">
        <div className="text-center max-w-3xl mx-auto">
          {/* Decorative icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-8">
            <Sparkles className="w-8 h-8" />
          </div>

          {/* Headline */}
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {config.headline}
          </h2>

          {/* Subheadline */}
          {config.subheadline && (
            <p className="text-xl text-white/90 mb-10">{config.subheadline}</p>
          )}

          {/* CTA Button */}
          <button
            onClick={scrollToExperiences}
            className="inline-flex items-center gap-2 bg-white hover:bg-white/95 text-primary font-semibold px-8 py-4 rounded-lg text-lg transition-all hover:scale-105 shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {config.ctaText}
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>
      </Container>
    </section>
  );
});
