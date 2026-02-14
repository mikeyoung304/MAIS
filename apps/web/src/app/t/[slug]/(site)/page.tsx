import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TenantLandingPageClient } from '@/components/tenant';
import {
  getTenantStorefrontData,
  getTenantStorefrontDataWithPreview,
  TenantNotFoundError,
  TenantApiError,
} from '@/lib/tenant';
import {
  getPublishedSections,
  getPreviewSections,
  SectionsNotFoundError,
} from '@/lib/sections-api';
import type { SectionContentDto } from '@macon/contracts';
import { logger } from '@/lib/logger';
import {
  sectionsToPages,
  getHeroFromSections,
  generateLocalBusinessSchema,
  safeJsonLd,
} from '@/lib/storefront-utils';

interface TenantPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; token?: string; edit?: string }>;
}

/**
 * Tenant public landing page (slug-based route)
 *
 * Displays the tenant's storefront with sections from the SectionContent table.
 * Supports preview mode for draft content editing.
 *
 * SSR with ISR (Incremental Static Regeneration):
 * - Initial request renders on server
 * - Cached for 60 seconds
 * - Revalidated on tenant config changes via webhook
 */

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const [data, sections] = await Promise.all([
      getTenantStorefrontData(slug),
      getPublishedSections(slug).catch(() => [] as SectionContentDto[]),
    ]);
    const { tenant } = data;

    const heroFromSections = sections.length > 0 ? getHeroFromSections(sections) : null;

    const metaDescription = heroFromSections?.subheadline || `Book services with ${tenant.name}`;

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
      title: 'Business Not Found',
      description: 'The requested business could not be found.',
      robots: { index: false, follow: false },
    };
  }
}

export default async function TenantPage({ params, searchParams }: TenantPageProps) {
  const { slug } = await params;
  const { preview, token } = await searchParams;

  const isPreviewMode = preview === 'draft' && !!token;

  try {
    const [data, sections] = await Promise.all([
      isPreviewMode
        ? getTenantStorefrontDataWithPreview(slug, token)
        : getTenantStorefrontData(slug),
      (isPreviewMode && token ? getPreviewSections(slug, token) : getPublishedSections(slug)).catch(
        (err) => {
          if (!(err instanceof SectionsNotFoundError)) {
            logger.warn('Failed to fetch sections', { slug, error: err.message });
          }
          return [];
        }
      ),
    ]);

    const pages = sectionsToPages(sections);

    if (sections.length > 0) {
      logger.info('[Storefront] Rendering from SectionContent table', {
        slug,
        sectionCount: sections.length,
        isPreviewMode,
      });
    }

    const canonicalUrl = `https://gethandled.ai/t/${slug}`;
    const localBusinessSchema = generateLocalBusinessSchema(data.tenant, canonicalUrl, sections);

    return (
      <>
        {!isPreviewMode && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(localBusinessSchema) }}
          />
        )}
        <TenantLandingPageClient data={data} pages={pages} basePath={`/t/${slug}`} />
      </>
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }

    // Handle expired/invalid preview tokens gracefully
    if (error instanceof TenantApiError && error.statusCode === 401 && isPreviewMode) {
      const [fallbackData, fallbackSections] = await Promise.all([
        getTenantStorefrontData(slug),
        getPublishedSections(slug).catch(() => [] as SectionContentDto[]),
      ]);
      const pages = sectionsToPages(fallbackSections);
      const canonicalUrl = `https://gethandled.ai/t/${slug}`;
      const localBusinessSchema = generateLocalBusinessSchema(
        fallbackData.tenant,
        canonicalUrl,
        fallbackSections
      );
      return (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(localBusinessSchema) }}
          />
          <TenantLandingPageClient data={fallbackData} pages={pages} basePath={`/t/${slug}`} />
        </>
      );
    }

    throw error;
  }
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
