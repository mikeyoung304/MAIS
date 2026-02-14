import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TenantLandingPageClient } from '@/components/tenant';
import {
  getTenantByDomain,
  getTenantPackages,
  getTenantSegments,
  TenantNotFoundError,
  InvalidDomainError,
  validateDomain,
} from '@/lib/tenant';
import { getPublishedSections, SectionsNotFoundError } from '@/lib/sections-api';
import type { SectionContentDto } from '@macon/contracts';
import { logger } from '@/lib/logger';
import {
  injectSectionsIntoData,
  getHeroFromSections,
  generateLocalBusinessSchema,
  safeJsonLd,
} from '@/lib/storefront-utils';

interface DomainPageProps {
  searchParams: Promise<{ domain?: string }>;
}

/**
 * Custom Domain Landing Page
 *
 * Handles custom domain routing via middleware rewrite.
 * When a custom domain like "janephotography.com" is accessed:
 * 1. Middleware rewrites to /t/_domain?domain=janephotography.com
 * 2. This page looks up the tenant by domain
 * 3. Renders the tenant landing page with sections API integration
 *
 * Feature parity with [slug]/(site)/page.tsx (sections, Schema.org, etc.)
 */

export async function generateMetadata({ searchParams }: DomainPageProps): Promise<Metadata> {
  const { domain } = await searchParams;

  try {
    const validatedDomain = validateDomain(domain);
    const tenant = await getTenantByDomain(validatedDomain);

    // Fetch sections for richer metadata
    const sections = await getPublishedSections(tenant.slug).catch(() => [] as SectionContentDto[]);

    const heroFromSections = sections.length > 0 ? getHeroFromSections(sections) : null;
    const metaDescription =
      heroFromSections?.subheadline ||
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

    // Fetch packages, segments, and sections in parallel
    const [packages, segments, sections] = await Promise.all([
      getTenantPackages(tenant.apiKeyPublic),
      getTenantSegments(tenant.apiKeyPublic),
      getPublishedSections(tenant.slug).catch((err) => {
        if (!(err instanceof SectionsNotFoundError)) {
          logger.warn('Failed to fetch sections for domain', {
            domain: validatedDomain,
            error: err.message,
          });
        }
        return [] as SectionContentDto[];
      }),
    ]);

    const data = { tenant, packages, segments };
    const enhancedData = injectSectionsIntoData(data, sections);
    const domainParam = `?domain=${validatedDomain}`;

    if (sections.length > 0) {
      logger.info('[Storefront] Rendering from SectionContent table (domain)', {
        domain: validatedDomain,
        sectionCount: sections.length,
      });
    }

    // Use custom domain as canonical URL
    const canonicalUrl = `https://${validatedDomain}`;
    const localBusinessSchema = generateLocalBusinessSchema(
      enhancedData.tenant,
      canonicalUrl,
      sections
    );

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(localBusinessSchema) }}
        />
        <TenantLandingPageClient data={enhancedData} basePath="" domainParam={domainParam} />
      </>
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
