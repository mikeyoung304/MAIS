import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  getTenantByDomain,
  getTenantPackages,
  getTenantSegments,
  TenantNotFoundError,
  InvalidDomainError,
  validateDomain,
} from '@/lib/tenant';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { TIER_ORDER } from '@/lib/packages';

interface ServicesPageProps {
  searchParams: Promise<{ domain?: string }>;
}

export async function generateMetadata({ searchParams }: ServicesPageProps): Promise<Metadata> {
  const { domain } = await searchParams;

  try {
    const validatedDomain = validateDomain(domain);
    const tenant = await getTenantByDomain(validatedDomain);
    return {
      title: `Services | ${tenant.name}`,
      description: `Explore our services and packages at ${tenant.name}.`,
    };
  } catch {
    return { title: 'Services | Business Not Found', robots: { index: false, follow: false } };
  }
}

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  const { domain } = await searchParams;

  // Validate domain parameter
  let validatedDomain: string;
  try {
    validatedDomain = validateDomain(domain);
  } catch (error) {
    if (error instanceof InvalidDomainError) {
      notFound();
    }
    throw error;
  }

  try {
    const tenant = await getTenantByDomain(validatedDomain);
    const [packages, segments] = await Promise.all([
      getTenantPackages(tenant.apiKeyPublic),
      getTenantSegments(tenant.apiKeyPublic),
    ]);

    // Filter active packages (isActive is new, active is legacy)
    const activePackages = packages.filter((p: { isActive?: boolean; active?: boolean }) => p.isActive ?? p.active);
    const sortedPackages = [...activePackages].sort(
      (a: { tier: keyof typeof TIER_ORDER }, b: { tier: keyof typeof TIER_ORDER }) =>
        (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99)
    );

    // For custom domains, construct links with domain param
    const domainParam = `?domain=${validatedDomain}`;
    const contactHref = `/contact${domainParam}`;
    // Booking links use the slug-based path (booking flow needs full tenant context)
    const bookBasePath = `/t/${tenant.slug}`;

    return (
      <div id="main-content">
        <section className="py-32 md:py-40">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <h1 className="font-serif text-4xl font-bold text-text-primary sm:text-5xl md:text-6xl leading-[1.1] tracking-tight">Our Services.</h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted md:text-xl">Find the perfect package for your needs.</p>
            </div>
          </div>
        </section>

        <section className="bg-surface-alt py-32 md:py-40">
          <div className="mx-auto max-w-6xl px-6">
            {activePackages.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-lg text-text-muted">No packages available at this time.</p>
                <Button asChild variant="sage" className="mt-8">
                  <Link href={contactHref}>Contact Us</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {sortedPackages.map((pkg: {
                  id: string;
                  slug: string;
                  title: string;
                  description: string | null;
                  priceCents: number;
                  tier: string;
                  photoUrl?: string | null;
                  addOns?: Array<{ id: string; title: string; priceCents: number }>;
                }) => {
                  const tierLabel = tenant.tierDisplayNames?.[pkg.tier.toLowerCase() as keyof typeof tenant.tierDisplayNames] || pkg.title;

                  return (
                    <div key={pkg.id} className="flex flex-col rounded-3xl border border-neutral-100 bg-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden">
                      {pkg.photoUrl ? (
                        <div className="relative aspect-[16/9] overflow-hidden">
                          <Image src={pkg.photoUrl} alt={pkg.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                        </div>
                      ) : (
                        <div className="relative aspect-[16/9] bg-gradient-to-br from-sage/20 to-sage/5">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="font-serif text-4xl text-sage/30">{pkg.title.charAt(0)}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-6">
                        <h3 className="text-lg font-semibold text-text-primary">{tierLabel}</h3>
                        <p className="mt-2 text-3xl font-bold text-text-primary">{formatPrice(pkg.priceCents)}</p>
                        {pkg.description && <p className="mt-4 text-sm text-text-muted flex-1">{pkg.description}</p>}
                        {pkg.addOns && pkg.addOns.length > 0 && (
                          <div className="mt-4 border-t border-neutral-100 pt-4">
                            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Available Add-ons</p>
                            <ul className="space-y-1">
                              {pkg.addOns.slice(0, 3).map((addOn) => (
                                <li key={addOn.id} className="text-sm text-text-muted">{addOn.title} (+{formatPrice(addOn.priceCents)})</li>
                              ))}
                              {pkg.addOns.length > 3 && <li className="text-sm text-sage">+{pkg.addOns.length - 3} more</li>}
                            </ul>
                          </div>
                        )}
                        <Button asChild variant="sage" className="mt-6 w-full">
                          <Link href={`${bookBasePath}/book/${pkg.slug}`}>Book {tierLabel}</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="py-32 md:py-40">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl">Not sure which package is right for you?</h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted">We&apos;re happy to help you find the perfect fit.</p>
            <Button asChild variant="sage" size="xl" className="mt-10">
              <Link href={contactHref}>Contact Us</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) notFound();
    throw error;
  }
}

export const revalidate = 60;
