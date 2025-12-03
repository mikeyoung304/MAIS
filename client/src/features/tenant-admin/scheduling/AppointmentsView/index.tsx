/**
 * AppointmentsView Component
 * Main component for viewing and filtering tenant appointments
 * Fetches appointments, services, and customer data and enriches the display
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AppointmentDto, ServiceDto, CustomerDto } from '@macon/contracts';
import type { AppointmentFilters, EnrichedAppointment } from './types';
import { AppointmentFilters as Filters } from './AppointmentFilters';
import { AppointmentsList } from './AppointmentsList';

/**
 * Initial filter state
 */
const initialFilters: AppointmentFilters = {
  status: 'all',
  serviceId: 'all',
  startDate: '',
  endDate: '',
};

/**
 * AppointmentsView - Main appointments management component
 * Displays filterable list of appointments with enriched customer and service data
 */
export function AppointmentsView() {
  const [filters, setFilters] = useState<AppointmentFilters>(initialFilters);

  // Fetch appointments from API
  const {
    data: appointmentsResponse,
    isLoading: appointmentsLoading,
    error: appointmentsError,
  } = useQuery({
    queryKey: ['tenant-admin', 'appointments', filters],
    queryFn: async () => {
      // Build query params - only include if not 'all'
      const query: {
        status?: 'PENDING' | 'DEPOSIT_PAID' | 'PAID' | 'CONFIRMED' | 'CANCELED' | 'REFUNDED' | 'FULFILLED';
        serviceId?: string;
        startDate?: string;
        endDate?: string;
      } = {};

      if (filters.status !== 'all') {
        query.status = filters.status as typeof query.status;
      }
      if (filters.serviceId !== 'all') {
        query.serviceId = filters.serviceId;
      }
      if (filters.startDate) {
        query.startDate = filters.startDate;
      }
      if (filters.endDate) {
        query.endDate = filters.endDate;
      }

      const response = await api.tenantAdminGetAppointments({
        query: Object.keys(query).length > 0 ? query : undefined,
      });

      if (response.status !== 200) {
        throw new Error('Failed to fetch appointments');
      }

      return response.body;
    },
  });

  const appointments = appointmentsResponse ?? [];

  // Fetch services to display service names
  const {
    data: servicesResponse,
    isLoading: servicesLoading,
  } = useQuery({
    queryKey: ['tenant-admin', 'services'],
    queryFn: async () => {
      const response = await api.tenantAdminGetServices();

      if (response.status !== 200) {
        throw new Error('Failed to fetch services');
      }

      return response.body;
    },
  });

  const services = servicesResponse ?? [];

  // Fetch customers to display customer details
  // Note: This is a workaround since appointments only return customerId
  // In a production app, the API should return enriched data or we should use a join
  const {
    data: customersResponse,
    isLoading: customersLoading,
  } = useQuery({
    queryKey: ['tenant-admin', 'customers'],
    queryFn: async () => {
      const response = await api.tenantAdminGetCustomers();

      if (response.status !== 200) {
        // If customers endpoint fails, return empty array
        // The UI will still work, just without customer details
        return [];
      }

      return response.body ?? [];
    },
    // Don't show error toast for customers endpoint since it's optional
    retry: false,
  });

  const customers = customersResponse ?? [];

  // Enrich appointments with service and customer data
  const enrichedAppointments: EnrichedAppointment[] = useMemo(() => {
    return appointments.map((appointment) => {
      const service = services.find((s) => s.id === appointment.serviceId);
      const customer = customers.find((c) => c.id === appointment.customerId);

      return {
        ...appointment,
        serviceName: service?.name,
        customerName: customer?.name,
        customerEmail: customer?.email ?? undefined,
        customerPhone: customer?.phone ?? undefined,
      };
    });
  }, [appointments, services, customers]);

  const isLoading = appointmentsLoading || servicesLoading || customersLoading;

  const handleFilterChange = (newFilters: AppointmentFilters) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters(initialFilters);
  };

  // Handle error state
  if (appointmentsError) {
    return (
      <div className="space-y-6">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-300 mb-2">
            Error Loading Appointments
          </h2>
          <p className="text-red-200">
            {appointmentsError instanceof Error
              ? appointmentsError.message
              : 'An unknown error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Filters
        filters={filters}
        services={services.filter((s) => s.active)}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />

      <AppointmentsList
        appointments={enrichedAppointments}
        isLoading={isLoading}
        totalCount={appointments.length}
      />
    </div>
  );
}
