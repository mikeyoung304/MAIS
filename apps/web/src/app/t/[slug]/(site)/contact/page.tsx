import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantStorefrontData, TenantNotFoundError } from '@/lib/tenant';
import { ContactForm } from './ContactForm';

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

    return (
      <div id="main-content">
        {/* Hero Section */}
        <section className="py-32 md:py-40">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Left: Info */}
              <div>
                <h1 className="font-serif text-4xl font-bold text-text-primary sm:text-5xl md:text-6xl leading-[1.1] tracking-tight">
                  Get in Touch.
                </h1>
                <p className="mt-6 text-lg text-text-muted">
                  Have a question or ready to book? We&apos;d love to hear from you.
                  Fill out the form and we&apos;ll get back to you as soon as possible.
                </p>

                {/* Business info (optional, could be extended with tenant contact info) */}
                <div className="mt-12 space-y-6">
                  <div>
                    <h2 className="font-semibold text-text-primary">Business</h2>
                    <p className="mt-1 text-text-muted">{tenant.name}</p>
                  </div>
                  {/* Add more contact info here when available from tenant branding */}
                </div>
              </div>

              {/* Right: Form */}
              <div>
                <ContactForm tenantName={tenant.name} basePath={basePath} />
              </div>
            </div>
          </div>
        </section>
      </div>
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
