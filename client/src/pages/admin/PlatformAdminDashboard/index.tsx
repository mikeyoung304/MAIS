/**
 * Platform Admin Dashboard (Refactored)
 *
 * Main orchestrator for platform admin dashboard.
 * Coordinates between smaller specialized components.
 *
 * Full system overview for PLATFORM_ADMIN users:
 * - Manage all tenants
 * - System-wide statistics
 * - Platform configuration
 * - NO tenant-specific content
 */

import { AdminLayout } from '../../../layouts/AdminLayout';
import { DashboardHeader } from './DashboardHeader';
import { StatsSection } from './StatsSection';
import { TenantsTableSection } from './TenantsTableSection';
import { useDashboardData } from './useDashboardData';

export function PlatformAdminDashboard() {
  const { tenants, stats, isLoading } = useDashboardData();

  return (
    <AdminLayout breadcrumbs={[{ label: 'Dashboard' }]}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <DashboardHeader />

        {/* System Metrics Section */}
        <StatsSection stats={stats} isLoading={isLoading} />

        {/* Tenants Management Section */}
        <TenantsTableSection tenants={tenants} isLoading={isLoading} />
      </div>
    </AdminLayout>
  );
}
