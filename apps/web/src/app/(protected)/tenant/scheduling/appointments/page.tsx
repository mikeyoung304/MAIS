'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { queryKeys, queryOptions } from '@/lib/query-client';
import {
  AppointmentFilters,
  type AppointmentFiltersState,
} from '@/components/scheduling/AppointmentFilters';
import {
  AppointmentsList,
  type EnrichedAppointment,
} from '@/components/scheduling/AppointmentsList';
import type { AppointmentDto, ServiceDto, CustomerDto } from '@macon/contracts';

/**
 * Type aliases for clarity - imports from @macon/contracts
 */
type Appointment = AppointmentDto;
type Service = ServiceDto;
type Customer = CustomerDto;

/**
 * Initial filter state
 */
const initialFilters: AppointmentFiltersState = {
  status: 'all',
  serviceId: 'all',
  startDate: '',
  endDate: '',
};

/**
 * Build query string from filters
 */
function buildQueryString(filterState: AppointmentFiltersState): string {
  const params = new URLSearchParams();

  if (filterState.status !== 'all') {
    params.append('status', filterState.status);
  }
  if (filterState.serviceId !== 'all') {
    params.append('serviceId', filterState.serviceId);
  }
  if (filterState.startDate) {
    params.append('startDate', filterState.startDate);
  }
  if (filterState.endDate) {
    params.append('endDate', filterState.endDate);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Build filter key for query cache
 */
function buildFilterKey(filterState: AppointmentFiltersState): Record<string, string> {
  const key: Record<string, string> = {};
  if (filterState.status !== 'all') key.status = filterState.status;
  if (filterState.serviceId !== 'all') key.serviceId = filterState.serviceId;
  if (filterState.startDate) key.startDate = filterState.startDate;
  if (filterState.endDate) key.endDate = filterState.endDate;
  return key;
}

/**
 * Tenant Appointments Page
 *
 * Displays a filterable list of appointments with enriched customer and service data.
 * Phase 1.4 of the legacy-to-Next.js migration.
 */
export default function TenantAppointmentsPage() {
  const { isAuthenticated } = useAuth();
  const [filters, setFilters] = useState<AppointmentFiltersState>(initialFilters);

  // Build filter key for React Query cache
  const filterKey = useMemo(() => buildFilterKey(filters), [filters]);

  // Fetch appointments with React Query (filter-dependent)
  const {
    data: appointments = [],
    isLoading: appointmentsLoading,
    error: appointmentsError,
    isFetching: appointmentsFetching,
  } = useQuery({
    queryKey: queryKeys.tenantAdmin.appointments(filterKey),
    queryFn: async () => {
      const queryString = buildQueryString(filters);
      const res = await fetch(`/api/tenant-admin/appointments${queryString}`);
      if (!res.ok) {
        if (res.status === 401) throw new Error('Session expired. Please log in again.');
        throw new Error('Failed to load appointments');
      }
      const data = await res.json();
      return Array.isArray(data) ? (data as Appointment[]) : [];
    },
    enabled: isAuthenticated,
    ...queryOptions.realtime, // Appointments should refresh frequently
  });

  // Fetch services with React Query (static, for filter dropdown)
  const { data: services = [] } = useQuery({
    queryKey: queryKeys.tenantAdmin.services,
    queryFn: async () => {
      const res = await fetch('/api/tenant-admin/services');
      if (!res.ok) throw new Error('Failed to load services');
      const data = await res.json();
      return Array.isArray(data) ? (data as Service[]) : [];
    },
    enabled: isAuthenticated,
    ...queryOptions.catalog, // Services change less frequently
  });

  // Fetch customers with React Query (for enrichment)
  const { data: customers = [] } = useQuery({
    queryKey: queryKeys.tenantAdmin.customers,
    queryFn: async () => {
      const res = await fetch('/api/tenant-admin/customers');
      if (!res.ok) throw new Error('Failed to load customers');
      const data = await res.json();
      return Array.isArray(data) ? (data as Customer[]) : [];
    },
    enabled: isAuthenticated,
    ...queryOptions.catalog, // Customers change less frequently
  });

  const isLoading = appointmentsLoading;
  const error = appointmentsError ? (appointmentsError as Error).message : null;

  // Build Maps for O(1) lookups instead of O(N*M*K) array searches
  const serviceMap = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  // Enrich appointments with service and customer data
  const enrichedAppointments: EnrichedAppointment[] = useMemo(() => {
    return appointments.map((appointment) => {
      const service = serviceMap.get(appointment.serviceId);
      const customer = customerMap.get(appointment.customerId);

      return {
        ...appointment,
        serviceName: service?.name,
        customerName: customer?.name,
        customerEmail: customer?.email ?? undefined,
        customerPhone: customer?.phone ?? undefined,
      };
    });
  }, [appointments, serviceMap, customerMap]);

  // Filter change handlers - just update state, React Query handles refetch automatically
  const handleFilterChange = useCallback((newFilters: AppointmentFiltersState) => {
    setFilters(newFilters);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(initialFilters);
  }, []);

  // Loading state
  if (isLoading && appointments.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center gap-4">
          <Link href="/tenant/scheduling">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="font-serif text-3xl font-bold text-text-primary">Appointments</h1>
            <p className="mt-2 text-text-muted">View and filter all your appointments</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-sage" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/tenant/scheduling">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Appointments</h1>
          <p className="mt-2 text-text-muted">View and filter all your appointments</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <AppointmentFilters
        filters={filters}
        services={services.filter((s) => s.active)}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />

      {/* Appointments List */}
      {appointments.length === 0 && !isLoading ? (
        <Card className="border-2 border-dashed border-sage/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-sage/10 p-4">
              <Calendar className="h-8 w-8 text-sage" />
            </div>
            <h3 className="mb-2 font-semibold text-text-primary">No appointments found</h3>
            <p className="max-w-sm text-sm text-text-muted">
              {filters.status !== 'all' ||
              filters.serviceId !== 'all' ||
              filters.startDate ||
              filters.endDate
                ? 'Try adjusting your filters to see more results.'
                : 'When customers book your services, appointments will appear here.'}
            </p>
            {(filters.status !== 'all' ||
              filters.serviceId !== 'all' ||
              filters.startDate ||
              filters.endDate) && (
              <Button variant="outline" onClick={handleClearFilters} className="mt-4 rounded-full">
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <AppointmentsList
          appointments={enrichedAppointments}
          isLoading={appointmentsFetching}
          totalCount={appointments.length}
        />
      )}
    </div>
  );
}
