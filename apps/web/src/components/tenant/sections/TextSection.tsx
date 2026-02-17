'use client';

import Image from 'next/image';
import type { TextSection as TextSectionType, TenantPublicDto } from '@macon/contracts';
import { useScrollReveal } from '@/hooks/useScrollReveal';

interface TextSectionProps extends TextSectionType {
  tenant: TenantPublicDto;
}

/**
 * Text section component for content blocks with optional image
 *
 * Features:
 * - Headline and content text (headline falls back to "About {tenant}")
 * - Optional image with configurable position (left/right)
 * - Markdown-like paragraph support (split on double newlines)
 * - Scroll-reveal animation via IntersectionObserver
 * - Empty content guard: returns null if no meaningful content
 */
export function TextSection({
  headline,
  content,
  imageUrl,
  imagePosition = 'left',
  tenant,
}: TextSectionProps) {
  const revealRef = useScrollReveal();
  const hasContent = content && content.trim().length > 0;

  if (!hasContent && !headline) return null;

  const displayHeadline = headline || `About ${tenant.name}`;
  const showImage = Boolean(imageUrl);

  return (
    <section className="py-32 md:py-40">
      <div className="mx-auto max-w-6xl px-6">
        <div
          ref={revealRef}
          className={`grid gap-12 md:grid-cols-2 md:items-center ${
            imagePosition === 'right' ? 'md:[&>*:first-child]:order-2' : ''
          }`}
        >
          {/* Image */}
          {showImage ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
              <Image
                src={imageUrl!}
                alt={displayHeadline}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          ) : (
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-gradient-to-br from-accent/15 to-accent/5">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-heading text-6xl text-accent/30">
                  {tenant.name.charAt(0)}
                </span>
              </div>
            </div>
          )}

          {/* Content */}
          <div>
            <h2 className="font-heading text-3xl font-bold text-primary sm:text-4xl">
              {displayHeadline}
            </h2>
            {hasContent && (
              <div className="mt-6 space-y-4">
                {content.split('\n\n').map((paragraph, i) => (
                  <p key={i} className="text-lg text-muted-foreground leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
