import Image from 'next/image';

import { Button } from '@/components/ui/button';
import type { HeroSection as HeroSectionType, TenantPublicDto } from '@macon/contracts';

interface HeroSectionProps extends HeroSectionType {
  tenant: TenantPublicDto;
  basePath?: string;
}

/**
 * Hero section component for tenant landing pages
 *
 * Features:
 * - Full-width banner with optional background image
 * - Headline and subheadline
 * - CTA button linking to packages
 */
export function HeroSection({
  headline,
  subheadline,
  ctaText = 'View Packages',
  backgroundImageUrl,
  basePath = '',
  tenant,
}: HeroSectionProps) {
  const hasBackground = Boolean(backgroundImageUrl);

  return (
    <section
      className="relative py-32 md:py-40 overflow-hidden"
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
          <div className="absolute inset-0 bg-black/40" />
        </>
      )}
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <h1
          className={`font-serif text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl ${
            hasBackground ? 'text-white' : 'text-text-primary'
          }`}
        >
          {headline}
        </h1>
        {subheadline && (
          <p
            className={`mx-auto mt-6 max-w-2xl text-lg md:text-xl ${
              hasBackground ? 'text-white/90' : 'text-text-muted'
            }`}
          >
            {subheadline}
          </p>
        )}
        <div className="mt-10">
          <Button asChild variant="sage" size="xl">
            <a href={`${basePath}#packages`}>{ctaText}</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
