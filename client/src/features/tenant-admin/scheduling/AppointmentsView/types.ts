/**
 * Type definitions for AppointmentsView component
 */

import type { AppointmentDto } from '@macon/contracts';

/**
 * Appointment with enriched customer and service data
 */
export interface EnrichedAppointment extends AppointmentDto {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  serviceName?: string;
}

/**
 * Appointment filter state
 */
export interface AppointmentFilters {
  status: string;
  serviceId: string;
  startDate: string;
  endDate: string;
}

/**
 * Customer data shape from API
 */
export interface Customer {
  id: string;
  tenantId: string;
  email: string | null;
  phone: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
}
