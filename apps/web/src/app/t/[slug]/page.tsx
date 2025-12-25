import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TenantLandingPage } from './TenantLandingPage';
import { getTenantStorefrontData, TenantNotFoundError } from '@/lib/tenant';

interface TenantPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Tenant public landing page
 *
 * This page displays the tenant's storefront with:
 * - Hero section with transformation headline
 * - Service tier cards (packages)
 * - Testimonials
 * - FAQ section
 * - Contact/booking CTAs
 *
 * SSR with ISR (Incremental Static Regeneration):
 * - Initial request renders on server
 * - Cached for 60 seconds
 * - Revalidated on tenant config changes via webhook
 */

// Generate SEO metadata for the tenant page
export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const data = await getTenantStorefrontData(slug);
    const { tenant } = data;

    const metaDescription =
      tenant.branding?.landingPage?.hero?.subheadline ||
      `Book services with ${tenant.name}`;

    return {
      title: tenant.name,
      description: metaDescription,
      openGraph: {
        title: tenant.name,
        description: metaDescription,
        // TODO: Add og:image from tenant branding when available
        images: [],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch (error) {
    // Return minimal metadata for error cases
    // notFound() will be called in the page component
    return {
      title: 'Business Not Found',
      description: 'The requested business could not be found.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

export default async function TenantPage({ params }: TenantPageProps) {
  const { slug } = await params;

  try {
    const data = await getTenantStorefrontData(slug);
    return <TenantLandingPage data={data} />;
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }

    // For other errors, log and show a generic error
    // In production, you might want to show a proper error page
    throw error;
  }
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
