/**
 * StorefrontHome Page
 *
 * Landing page for tenant storefronts with configurable sections.
 * Falls back to segment selector if no landing page sections are enabled.
 *
 * Route: / (root within tenant storefront)
 *
 * The landing page configuration comes from tenant branding.landingPage.
 * Sections are optional and configurable via tenant admin dashboard.
 */

import { useOutletContext } from 'react-router-dom';
import { FeatureErrorBoundary } from '@/components/errors';
import { LandingPage } from '@/features/storefront/landing';
import type { TenantPublicDto } from '@macon/contracts';

interface StorefrontContext {
  tenant: TenantPublicDto;
}

function StorefrontHomeContent() {
  const { tenant } = useOutletContext<StorefrontContext>();

  return <LandingPage tenant={tenant} />;
}

export function StorefrontHome() {
  return (
    <FeatureErrorBoundary featureName="Storefront">
      <StorefrontHomeContent />
    </FeatureErrorBoundary>
  );
}
