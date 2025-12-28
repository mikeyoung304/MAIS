import type { TenantPublicDto } from '@macon/contracts';
import { ContactForm } from '../ContactForm';

interface ContactPageContentProps {
  tenant: TenantPublicDto;
  /** Base path for links (e.g., '/t/slug' for slug routes, '' for domain routes) */
  basePath: string;
  /** Domain query parameter for custom domain routes (e.g., '?domain=example.com') */
  domainParam?: string;
}

/**
 * ContactPageContent - Shared component for Contact page
 *
 * Used by both [slug]/contact and _domain/contact routes.
 * Displays contact information and a contact form.
 */
export function ContactPageContent({ tenant, basePath, domainParam }: ContactPageContentProps) {
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
                Have a question or ready to book? We&apos;d love to hear from you. Fill out the form
                and we&apos;ll get back to you as soon as possible.
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
              <ContactForm tenantName={tenant.name} basePath={basePath} domainParam={domainParam} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
