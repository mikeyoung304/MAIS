'use client';

/**
 * TenantLandingPageClient - Client-side wrapper for Build Mode support
 *
 * This component wraps the TenantLandingPage with Build Mode capabilities.
 * When loaded in the Build Mode iframe (?edit=true), it:
 * - Listens for config updates from the parent editor
 * - Enables section click-to-select
 * - Syncs highlighted sections with the editor
 *
 * For normal storefront viewing, it renders TenantLandingPage directly.
 */

import { useSearchParams } from 'next/navigation';
import type { TenantStorefrontData } from '@/lib/tenant.client';
import { normalizeToPages } from '@/lib/tenant.client';
import { BuildModeWrapper } from './BuildModeWrapper';
import { TenantLandingPage } from './TenantLandingPage';
import type { PagesConfig } from '@macon/contracts';

interface TenantLandingPageClientProps {
  data: TenantStorefrontData;
  basePath?: string;
  domainParam?: string;
}

export function TenantLandingPageClient({
  data,
  basePath = '',
  domainParam = '',
}: TenantLandingPageClientProps) {
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';

  // Normalize config to pages format for Build Mode
  const initialConfig = normalizeToPages(data.tenant.branding?.landingPage);

  // If not in edit mode, render the standard page
  if (!isEditMode) {
    return (
      <TenantLandingPage
        data={data}
        basePath={basePath}
        domainParam={domainParam}
        isEditMode={false}
      />
    );
  }

  // In edit mode, wrap with BuildModeWrapper for real-time updates
  return (
    <BuildModeWrapper initialConfig={initialConfig} pageName="home">
      {(config: PagesConfig | null, editMode: boolean) => (
        <TenantLandingPage
          data={{
            ...data,
            // Override tenant config with the draft from Build Mode
            tenant: {
              ...data.tenant,
              branding: {
                ...data.tenant.branding,
                landingPage: config
                  ? { ...data.tenant.branding?.landingPage, pages: config }
                  : data.tenant.branding?.landingPage,
              },
            },
          }}
          basePath={basePath}
          domainParam={domainParam}
          isEditMode={editMode}
        />
      )}
    </BuildModeWrapper>
  );
}
