/**
 * AppointmentFilters Component
 * Filter controls for appointments list
 */

import { Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ServiceDto } from '@macon/contracts';
import type { AppointmentFilters as Filters } from './types';

interface AppointmentFiltersProps {
  filters: Filters;
  services: ServiceDto[];
  onFilterChange: (filters: Filters) => void;
  onClearFilters: () => void;
}

export function AppointmentFilters({
  filters,
  services,
  onFilterChange,
  onClearFilters,
}: AppointmentFiltersProps) {
  const hasActiveFilters =
    filters.status !== 'all' || filters.serviceId !== 'all' || filters.startDate || filters.endDate;

  return (
    <Card className="p-6 bg-macon-navy-800 border-white/20">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-white/60" />
        <h3 className="text-xl font-semibold text-white">Filters</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div className="space-y-2">
          <Label htmlFor="status" className="text-white/90 text-base">
            Status
          </Label>
          <select
            id="status"
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className="w-full h-10 px-3 bg-macon-navy-900 border border-white/20 text-white rounded-md focus:border-white/30 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELED">Canceled</option>
            <option value="FULFILLED">Fulfilled</option>
          </select>
        </div>

        {/* Service Filter */}
        <div className="space-y-2">
          <Label htmlFor="service" className="text-white/90 text-base">
            Service
          </Label>
          <select
            id="service"
            value={filters.serviceId}
            onChange={(e) => onFilterChange({ ...filters, serviceId: e.target.value })}
            className="w-full h-10 px-3 bg-macon-navy-900 border border-white/20 text-white rounded-md focus:border-white/30 focus:outline-none"
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
          <Label htmlFor="startDate" className="text-white/90 text-base">
            Start Date
          </Label>
          <Input
            id="startDate"
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })}
            className="bg-macon-navy-900 border-white/20 text-white focus:border-white/30 h-10"
          />
        </div>

        {/* End Date Filter */}
        <div className="space-y-2">
          <Label htmlFor="endDate" className="text-white/90 text-base">
            End Date
          </Label>
          <Input
            id="endDate"
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value })}
            className="bg-macon-navy-900 border-white/20 text-white focus:border-white/30 h-10"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="mt-4">
          <Button
            onClick={onClearFilters}
            variant="outline"
            size="default"
            className="border-white/20 text-white/90 hover:bg-macon-navy-700"
          >
            Clear Filters
          </Button>
        </div>
      )}
    </Card>
  );
}
