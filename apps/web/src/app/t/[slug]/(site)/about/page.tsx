import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getTenantStorefrontData, TenantNotFoundError } from '@/lib/tenant';
import { Button } from '@/components/ui/button';

interface AboutPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * About Page - Tenant story and mission
 *
 * Displays the tenant's about content with optional image.
 * Falls back to default content when not configured.
 */

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);
    const aboutContent = tenant.branding?.landingPage?.about?.content || '';
    const description = aboutContent.slice(0, 160) || `Learn more about ${tenant.name}`;

    return {
      title: `About | ${tenant.name}`,
      description,
      openGraph: {
        title: `About | ${tenant.name}`,
        description,
        images: tenant.branding?.landingPage?.about?.imageUrl
          ? [{ url: tenant.branding.landingPage.about.imageUrl }]
          : [],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {
      title: 'About | Business Not Found',
      description: 'The requested business could not be found.',
      robots: { index: false, follow: false },
    };
  }
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);
    const about = tenant.branding?.landingPage?.about;

    // Default content when not configured
    const headline = about?.headline || `About ${tenant.name}`;
    const content =
      about?.content ||
      `Welcome to ${tenant.name}. We're passionate about delivering exceptional service and creating memorable experiences for our clients.`;
    const imageUrl = about?.imageUrl;
    const imagePosition = about?.imagePosition || 'left';

    const basePath = `/t/${slug}`;

    return (
      <div id="main-content">
        {/* Hero Section */}
        <section className="py-32 md:py-40">
          <div className="mx-auto max-w-6xl px-6">
            <div
              className={`grid gap-12 md:grid-cols-2 md:items-center ${
                imagePosition === 'right' ? 'md:[&>*:first-child]:order-2' : ''
              }`}
            >
              {/* Image */}
              {imageUrl ? (
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
                  <Image
                    src={imageUrl}
                    alt={`About ${tenant.name}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                </div>
              ) : (
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-gradient-to-br from-sage/20 to-sage/5">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-serif text-6xl text-sage/30">
                      {tenant.name.charAt(0)}
                    </span>
                  </div>
                </div>
              )}

              {/* Content */}
              <div>
                <h1 className="font-serif text-4xl font-bold text-text-primary sm:text-5xl md:text-6xl leading-[1.1] tracking-tight">
                  {headline}
                </h1>
                <div className="mt-6 space-y-4">
                  {content.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-lg text-text-muted leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-sage py-32 md:py-40">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="font-serif text-3xl font-bold text-white sm:text-4xl">
              Ready to work together?
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80">
              Let&apos;s create something beautiful together.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                asChild
                variant="outline"
                size="xl"
                className="border-white bg-white text-sage hover:bg-white/90"
              >
                <a href={`${basePath}#packages`}>View Packages</a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="xl"
                className="border-white/50 bg-transparent text-white hover:bg-white/10"
              >
                <Link href={`${basePath}/contact`}>Get in Touch</Link>
              </Button>
            </div>
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

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
