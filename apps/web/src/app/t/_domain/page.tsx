import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TenantLandingPage } from '@/components/tenant';
import {
  getTenantByDomain,
  getTenantPackages,
  getTenantSegments,
  TenantNotFoundError,
  InvalidDomainError,
  validateDomain,
} from '@/lib/tenant';

interface DomainPageProps {
  searchParams: Promise<{ domain?: string }>;
}

/**
 * Custom Domain Landing Page
 *
 * This page handles custom domain routing via middleware rewrite.
 * When a custom domain like "janephotography.com" is accessed:
 * 1. Middleware rewrites to /t/_domain?domain=janephotography.com
 * 2. This page looks up the tenant by domain
 * 3. Renders the tenant landing page
 *
 * See: middleware.ts for the rewrite logic
 */

// Generate SEO metadata for custom domain
export async function generateMetadata({ searchParams }: DomainPageProps): Promise<Metadata> {
  const { domain } = await searchParams;

  try {
    const validatedDomain = validateDomain(domain);
    const tenant = await getTenantByDomain(validatedDomain);

    const metaDescription =
      tenant.branding?.landingPage?.hero?.subheadline ||
      `Book services with ${tenant.name}`;

    return {
      title: tenant.name,
      description: metaDescription,
      openGraph: {
        title: tenant.name,
        description: metaDescription,
        images: [],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {
      title: 'Site Not Found',
      description: 'This site could not be found.',
      robots: { index: false, follow: false },
    };
  }
}

export default async function DomainPage({ searchParams }: DomainPageProps) {
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
    // Fetch tenant by domain
    const tenant = await getTenantByDomain(validatedDomain);

    // Fetch packages and segments in parallel
    const [packages, segments] = await Promise.all([
      getTenantPackages(tenant.apiKeyPublic),
      getTenantSegments(tenant.apiKeyPublic),
    ]);

    const domainParam = `?domain=${validatedDomain}`;

    return (
      <TenantLandingPage
        data={{ tenant, packages, segments }}
        basePath=""
        domainParam={domainParam}
      />
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }

    // Re-throw other errors
    throw error;
  }
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
