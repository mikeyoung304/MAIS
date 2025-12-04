/**
 * AppointmentBooking Page
 *
 * Public page for customers to book appointments.
 * Uses the AppointmentBookingFlow component.
 */

import { AppointmentBookingFlow } from '@/features/scheduling/AppointmentBookingFlow';

export function AppointmentBookingPage() {
  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="container mx-auto px-4">
        <AppointmentBookingFlow />
      </div>
    </div>
  );
}
