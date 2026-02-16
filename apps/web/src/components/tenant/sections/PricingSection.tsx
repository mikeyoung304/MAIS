import Link from 'next/link';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PricingSection as PricingSectionType, TenantPublicDto } from '@macon/contracts';

interface PricingSectionProps extends PricingSectionType {
  tenant: TenantPublicDto;
}

/**
 * Pricing section component for tenant landing pages
 *
 * Features:
 * - 3-tier pricing card layout
 * - "Most Popular" badge for highlighted tier
 * - Hover effects with shadow and transform
 * - Enterprise variant with "Custom" pricing
 */
export function PricingSection({
  headline,
  subheadline,
  tiers,
  backgroundColor = 'white',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tenant: _tenant,
}: PricingSectionProps) {
  const safeTiers = Array.isArray(tiers) ? tiers : [];
  if (safeTiers.length === 0) return null;

  const bgClass = backgroundColor === 'neutral' ? 'bg-neutral-50' : 'bg-white';

  return (
    <section
      id="pricing"
      className={`${bgClass} py-32 md:py-40 px-6`}
      aria-labelledby="pricing-heading"
    >
      <div className="max-w-3xl mx-auto text-center mb-16">
        <h2
          id="pricing-heading"
          className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-[1.15] tracking-tight"
        >
          {headline}
        </h2>
        {subheadline && (
          <p className="mt-8 text-xl md:text-2xl font-light leading-relaxed text-text-muted">
            {subheadline}
          </p>
        )}
      </div>

      <div className="max-w-5xl mx-auto grid gap-8 lg:grid-cols-3">
        {safeTiers.map((tier) => {
          const isPopular = tier.isPopular === true;
          const isEnterprise = tier.variant === 'enterprise';
          const displayPrice = typeof tier.price === 'number' ? `$${tier.price / 100}` : tier.price;

          return (
            <div
              key={tier.name}
              className={`bg-white rounded-3xl p-8 transition-all duration-300 ${
                isPopular
                  ? 'shadow-2xl border-2 border-accent relative lg:-mt-4 lg:mb-4'
                  : 'shadow-lg border border-neutral-100 hover:shadow-xl hover:-translate-y-1'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-accent text-white text-sm font-medium px-4 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <h3 className="font-semibold text-lg text-text-primary">{tier.name}</h3>
              {tier.description && (
                <p className="mt-2 text-text-muted text-sm">{tier.description}</p>
              )}

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-text-primary">{displayPrice}</span>
                {tier.priceSubtext && <span className="text-text-muted">{tier.priceSubtext}</span>}
              </div>

              <ul className="mt-8 space-y-4">
                {(tier.features ?? []).map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-text-muted">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button variant={isPopular ? 'accent' : 'outline'} className="w-full mt-8" asChild>
                <Link href={tier.ctaHref || '/signup'}>
                  {tier.ctaText || (isEnterprise ? 'Contact Us' : 'Get Started')}
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
