import { notFound } from 'next/navigation';
import {
  getTenantByDomain,
  TenantNotFoundError,
  InvalidDomainError,
  validateDomain,
} from '@/lib/tenant';
import { getPublishedSections, SectionsNotFoundError } from '@/lib/sections-api';
import type { SectionContentDto } from '@macon/contracts';
import { sectionsToPages } from '@/lib/storefront-utils';
import { TenantSiteShell } from '@/components/tenant';
import { logger } from '@/lib/logger';

interface DomainLayoutProps {
  children: React.ReactNode;
  searchParams: Promise<{ domain?: string }>;
}

/**
 * Shared layout for custom domain tenant pages
 *
 * Same shell as [slug]/(site)/layout.tsx but resolves tenant by domain.
 * Fetches sections to derive PagesConfig for navigation.
 * React cache() deduplicates with page.tsx — zero extra API calls.
 */
export default async function DomainLayout({ children, searchParams }: DomainLayoutProps) {
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
    const [tenant, sections] = await Promise.all([
      getTenantByDomain(validatedDomain),
      getPublishedSections(validatedDomain).catch((err) => {
        if (!(err instanceof SectionsNotFoundError)) {
          logger.warn('Failed to fetch sections for domain layout', {
            domain: validatedDomain,
            error: err.message,
          });
        }
        return [] as SectionContentDto[];
      }),
    ]);

    const pages = sectionsToPages(sections);

    return (
      <TenantSiteShell tenant={tenant} pages={pages} basePath="">
        {children}
      </TenantSiteShell>
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }
}
