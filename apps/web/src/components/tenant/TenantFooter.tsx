import Link from 'next/link';
import Image from 'next/image';
import type { TenantPublicDto } from '@macon/contracts';

interface TenantFooterProps {
  tenant: TenantPublicDto;
}

/**
 * TenantFooter - Server component footer for tenant storefronts
 *
 * Features:
 * - Tenant logo and name
 * - Navigation links to all pages
 * - Copyright with dynamic year
 * - "Powered by MAIS" attribution
 * - Proper ARIA labels and roles
 */
export function TenantFooter({ tenant }: TenantFooterProps) {
  const basePath = `/t/${tenant.slug}`;
  const currentYear = new Date().getFullYear();

  const navItems = [
    { label: 'Home', href: basePath },
    { label: 'Services', href: `${basePath}/services` },
    { label: 'About', href: `${basePath}/about` },
    { label: 'FAQ', href: `${basePath}/faq` },
    { label: 'Contact', href: `${basePath}/contact` },
  ];

  return (
    <footer role="contentinfo" className="border-t border-neutral-100 bg-white py-12">
      <div className="mx-auto max-w-6xl px-6">
        {/* Top section: Logo and navigation */}
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          {/* Logo and name */}
          <div className="flex items-center gap-3">
            {tenant.branding?.logoUrl && (
              <div className="relative h-10 w-10 flex-shrink-0">
                <Image
                  src={tenant.branding.logoUrl}
                  alt=""
                  fill
                  className="object-contain"
                  sizes="40px"
                />
              </div>
            )}
            <span className="text-lg font-semibold text-text-primary">{tenant.name}</span>
          </div>

          {/* Navigation links */}
          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap gap-6 md:gap-8">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-text-muted transition-colors hover:text-text-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom section: Copyright and attribution */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-neutral-100 pt-8 md:flex-row">
          <p className="text-sm text-text-muted">
            &copy; {currentYear} {tenant.name}. All rights reserved.
          </p>
          <p className="text-xs text-text-muted">
            Powered by{' '}
            <a
              href="https://maconaisolutions.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-colors hover:text-sage"
            >
              Macon AI Solutions
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
