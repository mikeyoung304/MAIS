/**
 * ChoiceCardBase Component
 *
 * Pure presentation component for storefront choice cards.
 * Used by both SegmentCard and TierCard wrappers.
 *
 * Features:
 * - Zero conditionals based on card type (all props are explicit)
 * - 4:3 aspect ratio with gradient fallback for missing images
 * - "Most Popular" badge for highlighted cards
 * - Accessible: focus-visible ring, proper alt text, no nested interactives
 * - Memoized for performance
 */

import { memo } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { cardStyles } from './cardStyles';
import { ANIMATION_DURATION, ANIMATION_TRANSITION } from '@/lib/animation-constants';

export interface ChoiceCardBaseProps {
  /** Card title (segment heroTitle or package title) */
  title: string;
  /** Card description text */
  description: string;
  /** Image URL (null shows gradient fallback) */
  imageUrl: string | null;
  /** Alt text for the image */
  imageAlt: string;
  /** Category label shown on image overlay (e.g., "Weddings" or "Popular") */
  categoryLabel: string;
  /** Price in cents (only for tier cards, omit for segments) */
  price?: number;
  /** CTA button text */
  cta: string;
  /** Navigation link */
  href: string;
  /** Whether to highlight this card (shows "Most Popular" badge) */
  highlighted?: boolean;
  /** Test ID for E2E tests */
  testId?: string;
}

export const ChoiceCardBase = memo(function ChoiceCardBase({
  title,
  description,
  imageUrl,
  imageAlt,
  categoryLabel,
  price,
  cta,
  href,
  highlighted = false,
  testId,
}: ChoiceCardBaseProps) {
  return (
    <Link
      to={href}
      className={clsx(cardStyles.base, highlighted ? cardStyles.highlighted : cardStyles.normal)}
      data-testid={testId}
    >
      {/* "Most Popular" badge */}
      {highlighted && (
        <Badge
          className="absolute top-4 right-4 z-10 bg-macon-orange text-white border-0"
          aria-label="Most popular option"
        >
          Most Popular
        </Badge>
      )}

      {/* 4:3 Hero Image with fallback */}
      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
        {imageUrl ? (
          <img
            // NOTE: URL validation already handled by:
            // 1. Backend Zod validation (.url() on create/update)
            // 2. CSP headers enforcing img-src https:
            // Frontend sanitizeImageUrl() optional but not required for public storefronts
            // (admin interfaces use it explicitly; see BrandingPreview.tsx for pattern)
            src={imageUrl}
            alt={imageAlt}
            loading="lazy"
            className={`w-full h-full object-cover transition-transform ${ANIMATION_DURATION.NORMAL} group-hover:scale-105`}
            onError={(e) => {
              // Hide broken image, fallback will show via bg-neutral-100
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div
            role="img"
            aria-label={`${categoryLabel} category`}
            className="w-full h-full bg-gradient-to-br from-macon-navy to-macon-teal/80 flex items-center justify-center"
          >
            <span className="text-white/60 text-lg font-medium">{categoryLabel}</span>
          </div>
        )}

        {/* Gradient overlay with category label */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <span className="text-sm font-medium text-white/90 uppercase tracking-wide">
            {categoryLabel}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6 flex-1 flex flex-col">
        {/* Title */}
        <h3 className="font-heading text-2xl md:text-3xl font-semibold mb-2 text-neutral-900 leading-tight">
          {title}
        </h3>

        {/* Price (only rendered if provided) */}
        {price !== undefined && (
          <div className="mb-4">
            <span className="text-3xl md:text-4xl font-heading font-bold text-macon-orange">
              {formatCurrency(price)}
            </span>
          </div>
        )}

        {/* Description */}
        <p className="text-lg text-neutral-600 mb-6 line-clamp-3 leading-relaxed flex-1">
          {description}
        </p>

        {/* CTA - styled div, not nested button (a11y fix) */}
        <div
          className={clsx(
            `w-full min-h-[52px] text-lg flex items-center justify-center rounded-md border-2 font-medium ${ANIMATION_TRANSITION.COLORS}`,
            highlighted
              ? 'bg-macon-orange text-white border-macon-orange'
              : 'border-macon-orange text-macon-orange group-hover:bg-macon-orange group-hover:text-white'
          )}
        >
          {cta}
        </div>
      </div>
    </Link>
  );
});
