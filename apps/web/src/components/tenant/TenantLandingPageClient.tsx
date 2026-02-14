'use client';

/**
 * TenantLandingPageClient - Client-side wrapper for Build Mode support
 *
 * When loaded in the Build Mode iframe (?edit=true), it:
 * - Listens for config updates from the parent editor
 * - Enables section click-to-select
 * - Syncs highlighted sections with the editor
 *
 * For normal storefront viewing, it renders TenantLandingPage directly.
 */

import { useSearchParams } from 'next/navigation';
import type { TenantStorefrontData } from '@/lib/tenant.client';
import { BuildModeWrapper } from './BuildModeWrapper';
import { TenantLandingPage } from './TenantLandingPage';
import type { PagesConfig } from '@macon/contracts';

interface TenantLandingPageClientProps {
  data: TenantStorefrontData;
  /** Pages configuration from SectionContent */
  pages: PagesConfig;
  basePath?: string;
  domainParam?: string;
}

export function TenantLandingPageClient({
  data,
  pages,
  basePath = '',
  domainParam = '',
}: TenantLandingPageClientProps) {
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';

  // If not in edit mode, render the standard page
  if (!isEditMode) {
    return (
      <TenantLandingPage
        data={data}
        pages={pages}
        basePath={basePath}
        domainParam={domainParam}
        isEditMode={false}
      />
    );
  }

  // In edit mode, wrap with BuildModeWrapper for real-time updates
  return (
    <BuildModeWrapper initialConfig={pages} pageName="home">
      {(config: PagesConfig | null, editMode: boolean) => (
        <TenantLandingPage
          data={data}
          pages={config || pages}
          basePath={basePath}
          domainParam={domainParam}
          isEditMode={editMode}
        />
      )}
    </BuildModeWrapper>
  );
}
