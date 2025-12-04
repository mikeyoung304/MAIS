/**
 * Tenant Admin Scheduling Services Page
 *
 * Page for tenant admins to manage their bookable services.
 */

import { ServicesManager } from '@/features/tenant-admin/scheduling/ServicesManager';

export function TenantSchedulingServicesPage() {
  return (
    <div className="min-h-screen bg-macon-navy">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Services</h1>
          <p className="text-white/70 mt-2">
            Manage the services your customers can book appointments for.
          </p>
        </div>
        <ServicesManager />
      </div>
    </div>
  );
}
