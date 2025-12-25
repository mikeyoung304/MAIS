import type { Metadata } from 'next';
// import { notFound } from 'next/navigation'; // TODO: Uncomment when API connected
import { TenantLandingPage } from './TenantLandingPage';

interface TenantPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Tenant public landing page
 *
 * This page displays the tenant's storefront with:
 * - Hero section with transformation headline
 * - Service tier cards
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

  // TODO: Fetch tenant data from API
  // const tenant = await getTenantPublic(slug);

  // Placeholder until API is connected
  const tenant = {
    name: `Tenant ${slug}`,
    businessType: 'Photography',
    siteConfig: {
      metaDescription: `Book services with ${slug}`,
    },
    branding: {
      ogImage: null,
    },
  };

  return {
    title: tenant.name,
    description: tenant.siteConfig?.metaDescription || `Book services with ${tenant.name}`,
    openGraph: {
      title: tenant.name,
      description: tenant.siteConfig?.metaDescription,
      images: tenant.branding?.ogImage ? [tenant.branding.ogImage] : [],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function TenantPage({ params }: TenantPageProps) {
  const { slug } = await params;

  // TODO: Fetch tenant data from API
  // const tenant = await getTenantPublic(slug);
  // if (!tenant) notFound();

  // Placeholder tenant data for initial setup
  const tenant = {
    id: 'placeholder',
    slug,
    name: `${slug.charAt(0).toUpperCase()}${slug.slice(1).replace(/-/g, ' ')}`,
    businessType: 'Photography',
    landingPageConfig: {
      hero: {
        headline: 'Capture your story.',
        subheadline: 'Professional photography that brings your moments to life.',
        ctaText: 'Book Now',
      },
      segments: [],
      packages: [],
      testimonials: [],
      faqs: [],
    },
    branding: {
      primaryColor: '#4A7C6F',
      logo: null,
    },
  };

  return <TenantLandingPage tenant={tenant} />;
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
