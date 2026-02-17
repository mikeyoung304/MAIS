'use client';

import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import type { HeroSection as HeroSectionType, TenantPublicDto } from '@macon/contracts';

interface HeroSectionProps extends HeroSectionType {
  tenant: TenantPublicDto;
  basePath?: string;
}

/**
 * Hero section component for tenant landing pages
 *
 * Features:
 * - Full-bleed layout with min-height for visual impact
 * - Optional background image with bottom-heavy gradient overlay
 * - Brand gradient fallback when no image is provided
 * - Staggered scroll-reveal animations (headline, subheadline, CTA)
 * - Bottom-aligned text for editorial feel
 */
export function HeroSection({
  headline,
  subheadline,
  ctaText = 'View Services',
  backgroundImageUrl,
  basePath = '',
  tenant,
}: HeroSectionProps) {
  const hasBackground = Boolean(backgroundImageUrl);
  const revealRef = useScrollReveal();
  const ctaHref = `${basePath}#services`;

  return (
    <section
      className={`relative min-h-[70vh] md:min-h-[80vh] overflow-hidden ${
        hasBackground ? '' : 'bg-gradient-to-br from-accent/15 via-background to-accent/5'
      }`}
      aria-label={`Welcome to ${tenant.name}`}
    >
      {hasBackground && (
        <>
          <Image
            src={backgroundImageUrl!}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </>
      )}
      <div
        ref={revealRef}
        className="relative z-10 mx-auto flex min-h-[70vh] md:min-h-[80vh] max-w-4xl flex-col justify-end px-6 pb-16 md:pb-24 text-center"
      >
        <h1
          className={`font-heading text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl ${
            hasBackground ? 'text-white' : 'text-primary'
          }`}
        >
          {headline}
        </h1>
        {subheadline && (
          <p
            className={`reveal-delay-1 mx-auto mt-6 max-w-2xl text-lg md:text-xl ${
              hasBackground ? 'text-white/90' : 'text-muted-foreground'
            }`}
          >
            {subheadline}
          </p>
        )}
        <div className="reveal-delay-2 mt-10">
          <Button asChild variant="accent" size="xl">
            <a href={ctaHref}>{ctaText}</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
