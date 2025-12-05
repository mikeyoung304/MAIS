import { memo } from 'react';
import { ArrowDown } from 'lucide-react';
import { Container } from '@/ui/Container';
import { sanitizeBackgroundUrl } from '@/lib/sanitize-url';

interface HeroConfig {
  headline: string;
  subheadline?: string;
  ctaText: string;
  backgroundImageUrl?: string;
}

interface HeroSectionProps {
  config: HeroConfig;
}

/**
 * Hero section for landing pages
 *
 * Displays a full-height hero section with optional background image, headline,
 * subheadline, and call-to-action button. The CTA button scrolls smoothly to
 * the experiences section (#experiences) while respecting user motion preferences.
 *
 * The background image is decorative and does not convey semantic meaning.
 * All important information is conveyed through the headline and subheadline text.
 *
 * Layout Shift Prevention (TODO-255):
 * Uses aspect-video (16:9) with min-h-[80vh] fallback to prevent CLS.
 *
 * @example
 * ```tsx
 * <HeroSection
 *   config={{
 *     headline: "Welcome to Mountain View Farm",
 *     subheadline: "Experience authentic rural beauty and farm-to-table cuisine",
 *     ctaText: "Explore Experiences",
 *     backgroundImageUrl: "https://example.com/hero-bg.jpg"
 *   }}
 * />
 * ```
 *
 * @param props.config - Hero section configuration from tenant branding
 * @param props.config.headline - Main hero headline text (required)
 * @param props.config.subheadline - Supporting text below headline (optional)
 * @param props.config.ctaText - Call-to-action button text (required)
 * @param props.config.backgroundImageUrl - Background image URL, sanitized before rendering (optional)
 *
 * @see HeroSectionConfigSchema in @macon/contracts for Zod validation
 * @see TODO-212 for background image accessibility decision
 */
export const HeroSection = memo(function HeroSection({ config }: HeroSectionProps) {
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

  // Sanitize background image URL (defense-in-depth)
  const backgroundImage = sanitizeBackgroundUrl(config?.backgroundImageUrl);

  return (
    <section
      className="relative min-h-[80vh] aspect-video flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      /**
       * ACCESSIBILITY NOTE: Background image is decorative.
       * The headline and subheadline convey all meaningful content.
       * Screen readers will correctly skip the CSS background-image.
       *
       * If future requirements need the background to convey semantic meaning,
       * add `backgroundImageAlt` to HeroSectionConfigSchema and use:
       * - role="img"
       * - aria-label={config.backgroundImageAlt}
       *
       * @see TODO-212 resolution
       */
    >
      {/* Overlay for text readability */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <Container className="relative z-10 text-center py-20">
        <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6 leading-tight">
          {config.headline}
        </h1>

        {config.subheadline && (
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto mb-10">
            {config.subheadline}
          </p>
        )}

        <button
          onClick={scrollToExperiences}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-4 rounded-lg text-lg transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {config.ctaText}
          <ArrowDown className="w-5 h-5 animate-bounce" />
        </button>
      </Container>

      {/* Decorative bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
});
