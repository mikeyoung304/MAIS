'use client';

/**
 * AppointmentFilters Component
 * Filter controls for appointments list with status, service, and date range filters
 */

import { Filter, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Service shape for filter dropdown
 */
interface Service {
  id: string;
  name: string;
  active: boolean;
}

/**
 * Filter state shape
 */
export interface AppointmentFiltersState {
  status: string;
  serviceId: string;
  startDate: string;
  endDate: string;
}

interface AppointmentFiltersProps {
  filters: AppointmentFiltersState;
  services: Service[];
  onFilterChange: (filters: AppointmentFiltersState) => void;
  onClearFilters: () => void;
}

/**
 * Appointment status options matching the AppointmentDto status enum
 */
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'DEPOSIT_PAID', label: 'Deposit Paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'CANCELED', label: 'Canceled' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'FULFILLED', label: 'Fulfilled' },
] as const;

export function AppointmentFilters({
  filters,
  services,
  onFilterChange,
  onClearFilters,
}: AppointmentFiltersProps) {
  const hasActiveFilters =
    filters.status !== 'all' || filters.serviceId !== 'all' || filters.startDate || filters.endDate;

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, status: e.target.value });
  };

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, serviceId: e.target.value });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, startDate: e.target.value });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, endDate: e.target.value });
  };

  return (
    <Card className="border-neutral-200">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="rounded-lg bg-sage/10 p-2">
            <Filter className="h-4 w-4 text-sage" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">Filters</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Status Filter */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-text-primary">
              Status
            </Label>
            <select
              id="status"
              value={filters.status}
              onChange={handleStatusChange}
              className={cn(
                'flex h-11 w-full rounded-full border bg-white px-4 py-2.5 text-sm text-neutral-900',
                'shadow-sm hover:shadow-elevation-1',
                'transition-all duration-200 ease-out',
                'hover:border-primary/40',
                'focus:border-sage focus:shadow-elevation-2',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sage/30 focus-visible:ring-offset-0',
                'border-neutral-300'
              )}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Service Filter */}
          <div className="space-y-2">
            <Label htmlFor="service" className="text-text-primary">
              Service Type
            </Label>
            <select
              id="service"
              value={filters.serviceId}
              onChange={handleServiceChange}
              className={cn(
                'flex h-11 w-full rounded-full border bg-white px-4 py-2.5 text-sm text-neutral-900',
                'shadow-sm hover:shadow-elevation-1',
                'transition-all duration-200 ease-out',
                'hover:border-primary/40',
                'focus:border-sage focus:shadow-elevation-2',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sage/30 focus-visible:ring-offset-0',
                'border-neutral-300'
              )}
            >
              <option value="all">All Services</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date Filter */}
          <div className="space-y-2">
            <Label htmlFor="startDate" className="text-text-primary">
              Start Date
            </Label>
            <Input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={handleStartDateChange}
              className="h-11"
            />
          </div>

          {/* End Date Filter */}
          <div className="space-y-2">
            <Label htmlFor="endDate" className="text-text-primary">
              End Date
            </Label>
            <Input
              id="endDate"
              type="date"
              value={filters.endDate}
              onChange={handleEndDateChange}
              className="h-11"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="mt-4 flex justify-end">
            <Button
              onClick={onClearFilters}
              variant="outline"
              size="sm"
              className="gap-2 rounded-full"
            >
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
