/**
 * Tenant Admin Scheduling Appointments Page
 *
 * Page for tenant admins to view and manage their appointments.
 */

import { AppointmentsView } from '@/features/tenant-admin/scheduling/AppointmentsView';

export function TenantSchedulingAppointmentsPage() {
  return (
    <div className="min-h-screen bg-macon-navy">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Appointments</h1>
          <p className="text-white/70 mt-2">View and manage your scheduled appointments.</p>
        </div>
        <AppointmentsView />
      </div>
    </div>
  );
}
