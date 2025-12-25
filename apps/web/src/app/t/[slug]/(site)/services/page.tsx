import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getTenantStorefrontData, TenantNotFoundError } from '@/lib/tenant';
import { Button } from '@/components/ui/button';

interface ServicesPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Format price from cents to dollars
 */
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Services Page - Full package listing with details
 *
 * Displays all active packages grouped by segment (if segments exist).
 * Shows package details including add-ons and pricing.
 */

export async function generateMetadata({ params }: ServicesPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);

    return {
      title: `Services | ${tenant.name}`,
      description: `Explore our services and packages at ${tenant.name}. Find the perfect option for your needs.`,
      openGraph: {
        title: `Services | ${tenant.name}`,
        description: `Explore our services and packages at ${tenant.name}. Find the perfect option for your needs.`,
        images: [],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {
      title: 'Services | Business Not Found',
      description: 'The requested business could not be found.',
      robots: { index: false, follow: false },
    };
  }
}

export default async function ServicesPage({ params }: ServicesPageProps) {
  const { slug } = await params;

  try {
    const { tenant, packages, segments } = await getTenantStorefrontData(slug);

    // Filter to active packages only
    const activePackages = packages.filter((p) => p.active);

    // Group packages by segment
    const packagesBySegment = segments.length > 0
      ? segments.map((segment) => ({
          segment,
          packages: activePackages.filter((p) => p.segmentId === segment.id),
        })).filter((group) => group.packages.length > 0)
      : null;

    // Sort packages by tier for display
    const tierOrder = { BASIC: 0, STANDARD: 1, PREMIUM: 2, CUSTOM: 3 };
    const sortedPackages = [...activePackages].sort(
      (a, b) => tierOrder[a.tier] - tierOrder[b.tier]
    );

    const basePath = `/t/${slug}`;

    return (
      <div id="main-content">
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
                  <Link href={`${basePath}/contact`}>Contact Us</Link>
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
                        .sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier])
                        .map((pkg) => (
                          <PackageCard
                            key={pkg.id}
                            pkg={pkg}
                            tenant={tenant}
                            basePath={basePath}
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
                    basePath={basePath}
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
              <Link href={`${basePath}/contact`}>Contact Us</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }
}

interface PackageCardProps {
  pkg: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    priceCents: number;
    tier: 'BASIC' | 'STANDARD' | 'PREMIUM' | 'CUSTOM';
    photoUrl?: string | null;
    addOns?: Array<{
      id: string;
      title: string;
      description: string | null;
      priceCents: number;
    }>;
  };
  tenant: {
    slug: string;
    name: string;
    tierDisplayNames?: {
      basic?: string;
      standard?: string;
      premium?: string;
      custom?: string;
    };
  };
  basePath: string;
}

function PackageCard({ pkg, tenant, basePath }: PackageCardProps) {
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
            <span className="font-serif text-4xl text-sage/30">
              {pkg.title.charAt(0)}
            </span>
          </div>
        </div>
      )}

      {/* Package details */}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg font-semibold text-text-primary">{tierLabel}</h3>
        <p className="mt-2 text-3xl font-bold text-text-primary">
          {formatPrice(pkg.priceCents)}
        </p>

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
          <Link href={`${basePath}/book/${pkg.slug}`}>Book {tierLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
