/**
 * HeroSection Component
 *
 * Full-width hero with background image, headline, subheadline, and CTA.
 * Scrolls to #experiences section on CTA click.
 */

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

export function HeroSection({ config }: HeroSectionProps) {
  const scrollToExperiences = () => {
    const experiencesSection = document.getElementById('experiences');
    if (experiencesSection) {
      experiencesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Sanitize background image URL (defense-in-depth)
  const backgroundImage = sanitizeBackgroundUrl(config?.backgroundImageUrl);

  return (
    <section
      className="relative min-h-[80vh] flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
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
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-4 rounded-lg text-lg transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/50"
        >
          {config.ctaText}
          <ArrowDown className="w-5 h-5 animate-bounce" />
        </button>
      </Container>

      {/* Decorative bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}
