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
    <div className="flex min-h-screen flex-col bg-background" style={themeVars}>
      {/* Google Fonts — preconnect + stylesheet for the tenant's font preset */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href={fontPreset.googleFontsUrl} rel="stylesheet" />
      {/* EditModeGate: returns null when in edit iframe (edit + token + iframe).
          Suspense required because useSearchParams() triggers client-side boundary. */}
      <Suspense>
        <EditModeGate>
          <TenantNav tenant={tenant} pages={pages} basePath={basePath} />
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
  );
}
