import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContactPageContent } from '@/components/tenant';
import { getTenantStorefrontData, TenantNotFoundError } from '@/lib/tenant';

interface ContactPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Contact Page - Server component for SSR and metadata
 *
 * Displays contact information and a contact form.
 */

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);

    return {
      title: `Contact | ${tenant.name}`,
      description: `Get in touch with ${tenant.name}. We'd love to hear from you.`,
      openGraph: {
        title: `Contact | ${tenant.name}`,
        description: `Get in touch with ${tenant.name}. We'd love to hear from you.`,
        images: [],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return {
      title: 'Contact | Business Not Found',
      description: 'The requested business could not be found.',
      robots: { index: false, follow: false },
    };
  }
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);
    const basePath = `/t/${slug}`;

    return <ContactPageContent tenant={tenant} basePath={basePath} />;
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
