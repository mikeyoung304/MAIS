import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AboutPageContent } from '@/components/tenant';
import { getTenantStorefrontData, TenantNotFoundError, isPageEnabled } from '@/lib/tenant';
import type { LandingPageConfig } from '@macon/contracts';

interface AboutPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * About Page - Tenant story and mission
 *
 * Displays the tenant's about content with optional image.
 * Falls back to default content when not configured.
 * Returns 404 if page is disabled in tenant configuration.
 */

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);
    const config = tenant.branding?.landingPage as LandingPageConfig | undefined;

    // If page is disabled, return noindex metadata
    if (!isPageEnabled(config, 'about')) {
      return {
        title: 'Page Not Found',
        robots: { index: false, follow: false },
      };
    }

    const aboutContent = config?.about?.content || '';
    const description = aboutContent.slice(0, 160) || `Learn more about ${tenant.name}`;

    return {
      title: `About | ${tenant.name}`,
      description,
      openGraph: {
        title: `About | ${tenant.name}`,
        description,
        images: config?.about?.imageUrl
          ? [{ url: config.about.imageUrl }]
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
    const config = tenant.branding?.landingPage as LandingPageConfig | undefined;

    // Check if about page is enabled
    if (!isPageEnabled(config, 'about')) {
      notFound();
    }

    const basePath = `/t/${slug}`;

    return <AboutPageContent tenant={tenant} basePath={basePath} />;
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
