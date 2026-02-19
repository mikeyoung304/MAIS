/**
 * TenantSiteShell — Shared layout wrapper for tenant storefronts
 *
 * Extracted from [slug]/(site)/layout.tsx to enable code sharing
 * between slug-based and domain-based route trees.
 *
 * Renders: Nav, children, Footer, ChatWidget, StickyMobileCTA
 * All wrapped in EditModeGate + Suspense for build mode support.
 */

import { Suspense } from 'react';
import type { TenantPublicDto, PagesConfig, HeroSection } from '@macon/contracts';
import { FONT_PRESETS } from '@macon/contracts';
import { TenantNav } from './TenantNav';
import { TenantFooter } from './TenantFooter';
import { TenantChatWidget } from '../chat/TenantChatWidget';
import { StickyMobileCTA } from './StickyMobileCTA';
import { EditModeGate } from './EditModeGate';
import { getNavItemsFromHomeSections, buildAnchorNavHref } from './navigation';

interface TenantSiteShellProps {
  tenant: TenantPublicDto;
  /** Pages configuration from SectionContent */
  pages?: PagesConfig | null;
  /** Base path for links (e.g., '/t/slug' for slug routes, '' for domain routes) */
  basePath?: string;
  children: React.ReactNode;
}

export function TenantSiteShell({ tenant, pages, basePath, children }: TenantSiteShellProps) {
  // Extract CTA text from hero section in pages config
  const heroSection = pages?.home?.sections?.find((s): s is HeroSection => s.type === 'hero');
  const ctaText = heroSection?.ctaText || 'View Services';

  // Derive nav items on the server so TenantNav (a Client Component) never
  // calls getNavItemsFromHomeSections on every scroll frame.
  const resolvedBasePath = basePath ?? `/t/${tenant.slug}`;
  const navItems = getNavItemsFromHomeSections(pages).map((item) => ({
    label: item.label,
    href: buildAnchorNavHref(resolvedBasePath, item),
  }));

  // Resolve font preset — fall back to 'classic' for unknown values
  const fontPreset = FONT_PRESETS[tenant.fontPreset || 'classic'] || FONT_PRESETS.classic;

  // CSS custom properties for per-tenant theming
  const themeVars = {
    '--color-primary': tenant.primaryColor || '#1C1917',
    '--color-secondary': tenant.secondaryColor || '#A78B5A',
    '--color-accent': tenant.accentColor || '#5A7C65',
    '--color-background': tenant.backgroundColor || '#FAFAF7',
    '--font-heading': `'${fontPreset.heading}', ${fontPreset.headingFallback}`,
    '--font-body': `'${fontPreset.body}', ${fontPreset.bodyFallback}`,
  } as React.CSSProperties;

  return (
    <>
      {/* Google Fonts — preconnect + stylesheet for the tenant's font preset.
          Placed as fragment siblings so React 18.3+ Float hoists them to <head>. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href={fontPreset.googleFontsUrl} rel="stylesheet" />
      <div className="flex min-h-screen flex-col bg-background" style={themeVars}>
        {/* EditModeGate: returns null when in edit iframe (edit + token + iframe).
          Suspense required because useSearchParams() triggers client-side boundary. */}
        <Suspense>
          <EditModeGate>
            <TenantNav tenant={tenant} navItems={navItems} basePath={resolvedBasePath} />
          </EditModeGate>
        </Suspense>

        <div className="flex-1">{children}</div>

        <Suspense>
          <EditModeGate>
            <TenantFooter tenant={tenant} pages={pages} basePath={basePath} />
            <TenantChatWidget
              tenantApiKey={tenant.apiKeyPublic}
              businessName={tenant.name}
              primaryColor={tenant.primaryColor}
              chatEnabled={tenant.chatEnabled}
            />
            <StickyMobileCTA ctaText={ctaText} href="#services" observeElementId="main-content" />
          </EditModeGate>
        </Suspense>
      </div>
    </>
  );
}
