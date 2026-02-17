import type { ContactSection as ContactSectionType, TenantPublicDto } from '@macon/contracts';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';

interface ContactSectionProps extends ContactSectionType {
  tenant: TenantPublicDto;
}

/**
 * Contact section component for displaying contact information
 *
 * Features:
 * - Email, phone, address, hours display
 * - Icon indicators for each field
 * - Fallback to tenant name as placeholder
 */
export function ContactSection({
  headline = 'Get in Touch',
  email,
  phone,
  address,
  hours,
  tenant,
}: ContactSectionProps) {
  const hasContactInfo = email || phone || address || hours;

  return (
    <section className="py-32 md:py-40">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-bold text-primary sm:text-4xl">{headline}</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            We&apos;d love to hear from you. Reach out to {tenant.name} using the information below.
          </p>
        </div>

        {hasContactInfo ? (
          <div className="mt-16 rounded-3xl border border-neutral-100 bg-white p-8 shadow-lg">
            <div className="grid gap-6 md:grid-cols-2">
              {email && (
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                    <Mail className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-primary">Email</p>
                    <a href={`mailto:${email}`} className="text-accent hover:underline">
                      {email}
                    </a>
                  </div>
                </div>
              )}

              {phone && (
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                    <Phone className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-primary">Phone</p>
                    <a href={`tel:${phone}`} className="text-accent hover:underline">
                      {phone}
                    </a>
                  </div>
                </div>
              )}

              {address && (
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                    <MapPin className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-primary">Address</p>
                    <p className="text-muted-foreground">{address}</p>
                  </div>
                </div>
              )}

              {hours && (
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                    <Clock className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-primary">Hours</p>
                    <p className="text-muted-foreground whitespace-pre-line">{hours}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-16 rounded-3xl border border-neutral-100 bg-white p-8 shadow-lg text-center">
            <p className="text-muted-foreground">
              Contact information coming soon. Check back later!
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
