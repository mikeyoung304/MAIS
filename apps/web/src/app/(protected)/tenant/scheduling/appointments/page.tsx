'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
  AppointmentFilters,
  type AppointmentFiltersState,
} from '@/components/scheduling/AppointmentFilters';
import {
  AppointmentsList,
  type EnrichedAppointment,
} from '@/components/scheduling/AppointmentsList';

/**
 * Appointment data from API (matching AppointmentDto in contracts)
 */
interface Appointment {
  id: string;
  tenantId: string;
  customerId: string;
  serviceId: string;
  packageId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  clientTimezone: string | null;
  status: 'PENDING' | 'DEPOSIT_PAID' | 'PAID' | 'CONFIRMED' | 'CANCELED' | 'REFUNDED' | 'FULFILLED';
  totalPrice: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
}

/**
 * Service data from API (matching ServiceDto in contracts)
 */
interface Service {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number;
  timezone: string;
  active: boolean;
  sortOrder: number;
  segmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Customer data from API (matching CustomerDto in contracts)
 */
interface Customer {
  id: string;
  tenantId: string;
  email: string | null;
  phone: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
}

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
 * Tenant Appointments Page
 *
 * Displays a filterable list of appointments with enriched customer and service data.
 * Phase 1.4 of the legacy-to-Next.js migration.
 */
export default function TenantAppointmentsPage() {
  const { isAuthenticated } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filters, setFilters] = useState<AppointmentFiltersState>(initialFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Build query string from filters
  const buildQueryString = useCallback((filterState: AppointmentFiltersState): string => {
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
  }, []);

  // Fetch appointments with current filters
  const fetchAppointments = useCallback(
    async (filterState: AppointmentFiltersState) => {
      try {
        const queryString = buildQueryString(filterState);
        const res = await fetch(`/api/tenant-admin/appointments${queryString}`);

        if (res.ok) {
          const data = await res.json();
          setAppointments(Array.isArray(data) ? data : []);
        } else if (res.status === 401) {
          setError('Session expired. Please log in again.');
        } else {
          setError('Failed to load appointments');
        }
      } catch {
        setError('Failed to load appointments');
      }
    },
    [buildQueryString]
  );

  // Initial data fetch
  useEffect(() => {
    async function fetchData() {
      if (!isAuthenticated) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch appointments, services, and customers in parallel
        const [appointmentsRes, servicesRes, customersRes] = await Promise.all([
          fetch(`/api/tenant-admin/appointments${buildQueryString(filters)}`),
          fetch('/api/tenant-admin/services'),
          fetch('/api/tenant-admin/customers'),
        ]);

        if (appointmentsRes.ok) {
          const data = await appointmentsRes.json();
          setAppointments(Array.isArray(data) ? data : []);
        } else if (appointmentsRes.status === 401) {
          setError('Session expired. Please log in again.');
        }

        if (servicesRes.ok) {
          const data = await servicesRes.json();
          setServices(Array.isArray(data) ? data : []);
        }

        if (customersRes.ok) {
          const data = await customersRes.json();
          setCustomers(Array.isArray(data) ? data : []);
        }
      } catch {
        setError('Failed to load appointment data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

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

  // Filter change handlers
  const handleFilterChange = useCallback(
    (newFilters: AppointmentFiltersState) => {
      setFilters(newFilters);
      setIsLoading(true);
      fetchAppointments(newFilters).finally(() => setIsLoading(false));
    },
    [fetchAppointments]
  );

  const handleClearFilters = useCallback(() => {
    setFilters(initialFilters);
    setIsLoading(true);
    fetchAppointments(initialFilters).finally(() => setIsLoading(false));
  }, [fetchAppointments]);

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
          isLoading={isLoading}
          totalCount={appointments.length}
        />
      )}
    </div>
  );
}
