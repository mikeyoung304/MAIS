import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AboutPageContent } from '@/components/tenant';
import {
  getTenantByDomain,
  TenantNotFoundError,
  InvalidDomainError,
  validateDomain,
} from '@/lib/tenant';

interface AboutPageProps {
  searchParams: Promise<{ domain?: string }>;
}

export async function generateMetadata({ searchParams }: AboutPageProps): Promise<Metadata> {
  const { domain } = await searchParams;

  try {
    const validatedDomain = validateDomain(domain);
    const tenant = await getTenantByDomain(validatedDomain);
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
    };
  } catch {
    return { title: 'About | Business Not Found', robots: { index: false, follow: false } };
  }
}

export default async function AboutPage({ searchParams }: AboutPageProps) {
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
    const domainParam = `?domain=${validatedDomain}`;

    return <AboutPageContent tenant={tenant} basePath="" domainParam={domainParam} />;
  } catch (error) {
    if (error instanceof TenantNotFoundError) notFound();
    throw error;
  }
}

export const revalidate = 60;
