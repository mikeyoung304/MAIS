/**
 * AccommodationSection Component
 *
 * Promotes on-site or partner accommodation (Airbnb, VRBO, etc.).
 * Features image, description, highlights, and external booking link.
 */

import { ExternalLink, Check, Home } from 'lucide-react';
import { Container } from '@/ui/Container';
import { sanitizeImageUrl, sanitizeUrl } from '@/lib/sanitize-url';

interface AccommodationConfig {
  headline: string;
  description: string;
  imageUrl?: string;
  ctaText: string;
  ctaUrl: string;
  highlights: string[];
}

interface AccommodationSectionProps {
  config: AccommodationConfig;
}

export function AccommodationSection({ config }: AccommodationSectionProps) {
  // Sanitize URLs (defense-in-depth)
  const safeImageUrl = sanitizeImageUrl(config?.imageUrl);
  const safeCtaUrl = sanitizeUrl(config?.ctaUrl);
  const highlights = config?.highlights ?? [];

  return (
    <section className="py-16 md:py-24 bg-neutral-900 text-white">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Home className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium uppercase tracking-wider text-primary">
                Stay With Us
              </span>
            </div>

            <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              {config?.headline}
            </h2>

            <p className="text-lg text-neutral-300 mb-8 leading-relaxed">
              {config?.description}
            </p>

            {/* Highlights */}
            {highlights.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-8">
                {highlights.map((highlight, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-neutral-300">{highlight}</span>
                  </div>
                ))}
              </div>
            )}

            {/* CTA Button */}
            {safeCtaUrl && (
              <a
                href={safeCtaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-4 rounded-lg text-lg transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-neutral-900"
              >
                {config?.ctaText}
                <ExternalLink className="w-5 h-5" />
              </a>
            )}
          </div>

          {/* Image */}
          {safeImageUrl && (
            <div className="relative">
              <div className="rounded-2xl overflow-hidden shadow-2xl aspect-[4/3]">
                <img
                  src={safeImageUrl}
                  alt={config?.headline || 'Accommodation'}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Decorative element */}
              <div className="absolute -z-10 -bottom-4 -right-4 w-full h-full rounded-2xl bg-primary/20" />
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
