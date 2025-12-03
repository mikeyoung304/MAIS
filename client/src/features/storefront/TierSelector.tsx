/**
 * TierSelector Component
 *
 * Displays tier cards in a responsive grid layout.
 * Filters packages by grouping field to show budget/middle/luxury tiers.
 *
 * Features:
 * - Extracts tiers from packages using grouping field convention
 * - Highlights middle tier as "Most Popular" (only when exactly 3 tiers)
 * - Responsive 1-2-3 column layout based on tier count
 * - Shows warning if fewer than 3 tiers configured
 * - Empty state when no tiers are available
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';
import { Container } from '@/ui/Container';
import { TierCard } from './TierCard';
import { ChoiceGrid } from './ChoiceGrid';
import type { PackageDto } from '@macon/contracts';
import { TIER_LEVELS, extractTiers } from './utils';

interface TierSelectorProps {
  /** All packages for this segment (or root) */
  packages: PackageDto[];
  /** Optional segment slug for routing */
  segmentSlug?: string;
  /** Title to display above tier cards */
  title?: string;
  /** Subtitle/description */
  subtitle?: string;
  /** Link to go back to (e.g., "/" for segments) */
  backLink?: string;
  /** Back link text */
  backLinkText?: string;
}

export function TierSelector({
  packages,
  segmentSlug,
  title = 'Choose Your Experience',
  subtitle = 'Select the tier that best fits your needs',
  backLink,
  backLinkText = 'Back',
}: TierSelectorProps) {
  // Extract tiers from packages
  const tiers = useMemo(() => extractTiers(packages), [packages]);

  // Get list of configured tier levels
  const configuredTiers = useMemo(
    () => TIER_LEVELS.filter((level) => tiers[level] !== undefined),
    [tiers]
  );

  return (
    <div className="py-12">
      <Container>
        {/* Back Link */}
        {backLink && (
          <Link
            to={backLink}
            className="inline-flex items-center text-macon-navy hover:text-macon-orange transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
            <span>{backLinkText}</span>
          </Link>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-neutral-900 mb-4">
            {title}
          </h1>
          <p className="text-xl md:text-2xl text-neutral-600 max-w-3xl mx-auto">
            {subtitle}
          </p>
        </div>

        {/* Admin warning removed - customers shouldn't see incomplete tier warnings */}

        {/* Empty state if no tiers */}
        {configuredTiers.length === 0 && (
          <div className="text-center py-16 bg-neutral-50 rounded-xl border border-neutral-200">
            <Package className="w-12 h-12 mx-auto text-neutral-300 mb-4" aria-hidden="true" />
            <h3 className="text-xl font-semibold text-neutral-900 mb-2">
              Coming Soon
            </h3>
            <p className="text-neutral-600">
              We're preparing something special for you.
            </p>
          </div>
        )}

        {/* Tier Cards Grid */}
        {configuredTiers.length > 0 && (
          <ChoiceGrid itemCount={configuredTiers.length}>
            {TIER_LEVELS.map((tierLevel) => {
              const pkg = tiers[tierLevel];
              if (!pkg) return null;

              return (
                <TierCard
                  key={tierLevel}
                  package={pkg}
                  tierLevel={tierLevel}
                  segmentSlug={segmentSlug}
                  totalTierCount={configuredTiers.length}
                />
              );
            })}
          </ChoiceGrid>
        )}

        {/* Pricing Psychology Note - only show when 3 tiers */}
        {configuredTiers.length === 3 && (
          <div className="mt-12 text-center">
            <p className="text-neutral-500 text-sm">
              Not sure which to choose? Our{' '}
              <span className="font-medium text-macon-orange">Popular</span>{' '}
              tier is perfect for most customers.
            </p>
          </div>
        )}
      </Container>
    </div>
  );
}
