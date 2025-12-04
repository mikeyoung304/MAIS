/**
 * Tenant Admin Scheduling Availability Page
 *
 * Page for tenant admins to manage their availability rules.
 */

import { AvailabilityRulesManager } from '@/features/tenant-admin/scheduling/AvailabilityRulesManager';

export function TenantSchedulingAvailabilityPage() {
  return (
    <div className="min-h-screen bg-macon-navy">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Availability</h1>
          <p className="text-white/70 mt-2">
            Define when you're available for appointments. Set your weekly schedule.
          </p>
        </div>
        <AvailabilityRulesManager />
      </div>
    </div>
  );
}
