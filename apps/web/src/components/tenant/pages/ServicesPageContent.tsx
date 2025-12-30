import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { TIER_ORDER } from '@/lib/packages';
import type { TenantStorefrontData, PackageData } from '@/lib/tenant';

interface ServicesPageContentProps {
  data: TenantStorefrontData;
  /** Base path for links (e.g., '/t/slug' for slug routes, '' for domain routes) */
  basePath: string;
  /** Domain query parameter for custom domain routes (e.g., '?domain=example.com') */
  domainParam?: string;
}

interface PackageCardProps {
  pkg: PackageData;
  tenant: TenantStorefrontData['tenant'];
  bookHref: string;
}

function PackageCard({ pkg, tenant, bookHref }: PackageCardProps) {
  const tierLabel =
    tenant.tierDisplayNames?.[pkg.tier.toLowerCase() as keyof typeof tenant.tierDisplayNames] ||
    pkg.title;

  return (
    <div className="flex flex-col rounded-3xl border border-neutral-100 bg-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden">
      {/* Package image or placeholder */}
      {pkg.photoUrl ? (
        <div className="relative aspect-[16/9] overflow-hidden">
          <Image
            src={pkg.photoUrl}
            alt={pkg.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      ) : (
        <div className="relative aspect-[16/9] bg-gradient-to-br from-sage/20 to-sage/5">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif text-4xl text-sage/30">{pkg.title.charAt(0)}</span>
          </div>
        </div>
      )}

      {/* Package details */}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg font-semibold text-text-primary">{tierLabel}</h3>
        <p className="mt-2 text-3xl font-bold text-text-primary">{formatPrice(pkg.priceCents)}</p>

        {pkg.description && (
          <p className="mt-4 text-sm text-text-muted flex-1">{pkg.description}</p>
        )}

        {/* Add-ons */}
        {pkg.addOns && pkg.addOns.length > 0 && (
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
              Available Add-ons
            </p>
            <ul className="space-y-1">
              {pkg.addOns.slice(0, 3).map((addOn) => (
                <li key={addOn.id} className="text-sm text-text-muted">
                  {addOn.title} (+{formatPrice(addOn.priceCents)})
                </li>
              ))}
              {pkg.addOns.length > 3 && (
                <li className="text-sm text-sage">+{pkg.addOns.length - 3} more</li>
              )}
            </ul>
          </div>
        )}

        <Button asChild variant="sage" className="mt-6 w-full">
          <Link href={bookHref}>Book {tierLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * ServicesPageContent - Shared component for Services page
 *
 * Used by both [slug]/services and _domain/services routes.
 * Displays all active packages grouped by segment (if segments exist).
 * Shows package details including add-ons and pricing.
 */
export function ServicesPageContent({ data, basePath, domainParam }: ServicesPageContentProps) {
  const { tenant, packages, segments } = data;

  // Filter to active packages only (isActive is new, active is legacy)
  const activePackages = packages.filter((p) => p.isActive ?? p.active);

  // Group packages by segment
  // Only use grouped view if segments exist AND packages have matching segmentIds
  const groupedPackages =
    segments.length > 0
      ? segments
          .map((segment) => ({
            segment,
            packages: activePackages.filter((p) => p.segmentId === segment.id),
          }))
          .filter((group) => group.packages.length > 0)
      : [];

  // Fall back to flat list if no packages match any segment
  const packagesBySegment = groupedPackages.length > 0 ? groupedPackages : null;

  // Sort packages by tier for display
  const sortedPackages = [...activePackages].sort(
    (a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99)
  );

  // Build links based on route type
  const contactHref = domainParam ? `/contact${domainParam}` : `${basePath}/contact`;
  // For domain routes, booking uses slug-based path for full tenant context
  const getBookHref = (packageSlug: string) => {
    if (domainParam) {
      return `/t/${tenant.slug}/book/${packageSlug}`;
    }
    return `${basePath}/book/${packageSlug}`;
  };

  return (
    <>
      {/* Hero Section */}
      <section className="py-32 md:py-40">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h1 className="font-serif text-4xl font-bold text-text-primary sm:text-5xl md:text-6xl leading-[1.1] tracking-tight">
              Our Services.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted md:text-xl">
              Find the perfect package for your needs.
            </p>
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section className="bg-surface-alt py-32 md:py-40">
        <div className="mx-auto max-w-6xl px-6">
          {activePackages.length === 0 ? (
            /* Empty state */
            <div className="text-center py-16">
              <p className="text-lg text-text-muted">
                No packages available at this time. Please check back soon.
              </p>
              <Button asChild variant="sage" className="mt-8">
                <Link href={contactHref}>Contact Us</Link>
              </Button>
            </div>
          ) : packagesBySegment ? (
            /* Grouped by segment */
            <div className="space-y-24">
              {packagesBySegment.map(({ segment, packages: segmentPackages }) => (
                <div key={segment.id}>
                  <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl text-center">
                    {segment.name}
                  </h2>
                  {segment.description && (
                    <p className="mx-auto mt-4 max-w-2xl text-center text-text-muted">
                      {segment.description}
                    </p>
                  )}
                  <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {segmentPackages
                      .sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99))
                      .map((pkg) => (
                        <PackageCard
                          key={pkg.id}
                          pkg={pkg}
                          tenant={tenant}
                          bookHref={getBookHref(pkg.slug)}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Flat list */
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {sortedPackages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  tenant={tenant}
                  bookHref={getBookHref(pkg.slug)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 md:py-40">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl">
            Not sure which package is right for you?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted">
            We&apos;re happy to help you find the perfect fit. Reach out and let&apos;s chat.
          </p>
          <Button asChild variant="sage" size="xl" className="mt-10">
            <Link href={contactHref}>Contact Us</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
