/**
 * TenantVisualEditorPage - Visual editor page for tenant dashboard
 *
 * Provides WYSIWYG editing for packages with the TenantDashboardLayout.
 */

import { TenantDashboardLayout } from '@/features/tenant-admin/TenantDashboard/TenantDashboardLayout';
import { VisualEditorDashboard } from '@/features/tenant-admin/visual-editor';

export function TenantVisualEditorPage() {
  return (
    <TenantDashboardLayout>
      <VisualEditorDashboard />
    </TenantDashboardLayout>
  );
}
