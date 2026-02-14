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
import type { TenantPublicDto } from '@macon/contracts';
import { TenantNav } from './TenantNav';
import { TenantFooter } from './TenantFooter';
import { TenantChatWidget } from '../chat/TenantChatWidget';
import { StickyMobileCTA } from './StickyMobileCTA';
import { EditModeGate } from './EditModeGate';

interface TenantSiteShellProps {
  tenant: TenantPublicDto;
  /** Base path for links (e.g., '/t/slug' for slug routes, '' for domain routes) */
  basePath?: string;
  /** Domain query parameter for custom domain routes (e.g., '?domain=example.com') */
  domainParam?: string;
  children: React.ReactNode;
}

export function TenantSiteShell({ tenant, basePath, domainParam, children }: TenantSiteShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      {/* EditModeGate: returns null when in edit iframe (edit + token + iframe).
          Suspense required because useSearchParams() triggers client-side boundary. */}
      <Suspense>
        <EditModeGate>
          <TenantNav tenant={tenant} basePath={basePath} domainParam={domainParam} />
        </EditModeGate>
      </Suspense>

      <div className="flex-1">{children}</div>

      <Suspense>
        <EditModeGate>
          <TenantFooter tenant={tenant} basePath={basePath} domainParam={domainParam} />
          <TenantChatWidget
            tenantApiKey={tenant.apiKeyPublic}
            businessName={tenant.name}
            primaryColor={tenant.primaryColor}
            chatEnabled={tenant.chatEnabled}
          />
          <StickyMobileCTA
            ctaText={tenant.branding?.landingPage?.hero?.ctaText || 'View Packages'}
            href="#packages"
            observeElementId="main-content"
          />
        </EditModeGate>
      </Suspense>
    </div>
  );
}
