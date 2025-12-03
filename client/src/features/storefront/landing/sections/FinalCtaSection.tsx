/**
 * FinalCtaSection Component
 *
 * Bottom-of-page call to action that scrolls to experiences section.
 * Provides final conversion opportunity after all content.
 */

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

export function FinalCtaSection({ config }: FinalCtaSectionProps) {
  const scrollToExperiences = () => {
    const experiencesSection = document.getElementById('experiences');
    if (experiencesSection) {
      experiencesSection.scrollIntoView({ behavior: 'smooth' });
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
            <p className="text-xl text-white/90 mb-10">
              {config.subheadline}
            </p>
          )}

          {/* CTA Button */}
          <button
            onClick={scrollToExperiences}
            className="inline-flex items-center gap-2 bg-white hover:bg-white/95 text-primary font-semibold px-8 py-4 rounded-lg text-lg transition-all hover:scale-105 shadow-xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary"
          >
            {config.ctaText}
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>
      </Container>
    </section>
  );
}
