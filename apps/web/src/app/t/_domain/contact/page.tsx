import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getTenantByDomain,
  TenantNotFoundError,
  InvalidDomainError,
  validateDomain,
} from '@/lib/tenant';
import { ContactForm } from '../../[slug]/(site)/contact/ContactForm';

interface ContactPageProps {
  searchParams: Promise<{ domain?: string }>;
}

export async function generateMetadata({ searchParams }: ContactPageProps): Promise<Metadata> {
  const { domain } = await searchParams;

  try {
    const validatedDomain = validateDomain(domain);
    const tenant = await getTenantByDomain(validatedDomain);
    return {
      title: `Contact | ${tenant.name}`,
      description: `Get in touch with ${tenant.name}.`,
    };
  } catch {
    return { title: 'Contact | Business Not Found', robots: { index: false, follow: false } };
  }
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
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

    // For custom domains, use root path - links will be constructed with domainParam
    const basePath = `/?domain=${validatedDomain}`;

    return (
      <div id="main-content">
        <section className="py-32 md:py-40">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <h1 className="font-serif text-4xl font-bold text-text-primary sm:text-5xl md:text-6xl leading-[1.1] tracking-tight">Get in Touch.</h1>
                <p className="mt-6 text-lg text-text-muted">Have a question or ready to book? We&apos;d love to hear from you.</p>
                <div className="mt-12 space-y-6">
                  <div>
                    <h2 className="font-semibold text-text-primary">Business</h2>
                    <p className="mt-1 text-text-muted">{tenant.name}</p>
                  </div>
                </div>
              </div>
              <div>
                <ContactForm tenantName={tenant.name} basePath={basePath} />
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) notFound();
    throw error;
  }
}

export const revalidate = 60;
