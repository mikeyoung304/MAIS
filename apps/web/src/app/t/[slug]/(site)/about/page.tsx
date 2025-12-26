import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AboutPageContent } from '@/components/tenant';
import { getTenantStorefrontData, TenantNotFoundError } from '@/lib/tenant';

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
