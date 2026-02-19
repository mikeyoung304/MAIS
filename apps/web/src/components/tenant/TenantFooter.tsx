import Link from 'next/link';
import Image from 'next/image';
import type { TenantPublicDto, PagesConfig } from '@macon/contracts';
import { getNavItemsFromHomeSections, buildAnchorNavHref } from './navigation';

interface TenantFooterProps {
  tenant: TenantPublicDto;
  /** Pages configuration from SectionContent */
  pages?: PagesConfig | null;
  /** Base path for navigation links (e.g., '/t/jane-photography' or '') */
  basePath?: string;
}

/**
 * TenantFooter - Server component footer for tenant storefronts
 *
 * Features:
 * - Tenant logo and name
 * - Navigation links to all pages
 * - Copyright with dynamic year
 * - "Powered by HANDLED" attribution
 * - Proper ARIA labels and roles
 */
export function TenantFooter({ tenant, pages, basePath: basePathProp }: TenantFooterProps) {
  // Use provided basePath or default to slug-based path
  const basePath = basePathProp ?? `/t/${tenant.slug}`;
  const currentYear = new Date().getFullYear();

  // Build nav items from home sections (same derivation as TenantNav)
  const navItems = getNavItemsFromHomeSections(pages).map((item) => ({
    label: item.label,
    href: buildAnchorNavHref(basePath, item),
  }));

  return (
    <footer role="contentinfo" className="border-t border-neutral-100 bg-neutral-50 py-12">
      <div className="mx-auto max-w-6xl px-6">
        {/* TODO: Add social links when Tenant model gains socialLinks field */}
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
            <span className="text-lg font-semibold text-primary">{tenant.name}</span>
          </div>

          {/* Navigation links */}
          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap gap-6 md:gap-8">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
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
          <p className="text-sm text-muted-foreground">
            &copy; <time suppressHydrationWarning>{currentYear}</time> {tenant.name}. All rights
            reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Powered by{' '}
            <a
              href="https://gethandled.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-colors hover:text-accent"
            >
              HANDLED
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
