/**
 * ServiceSelector Component
 * Customer-facing component for browsing and selecting services
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { ServiceDto } from '@macon/contracts';

interface ServiceSelectorProps {
  onSelect: (service: ServiceDto) => void;
  selectedServiceId?: string;
}

/**
 * Service Card Skeleton
 * Matches the dimensions and layout of ServiceCard
 */
function ServiceCardSkeleton() {
  return (
    <Card className="border-neutral-200 bg-white">
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-3/4" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Format duration in minutes to human-readable string
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  }
  return `${hours} hr${hours > 1 ? 's' : ''} ${remainingMinutes} min`;
}

export function ServiceSelector({ onSelect, selectedServiceId }: ServiceSelectorProps) {
  const {
    data: services,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['scheduling', 'services'],
    queryFn: async () => {
      const response = await api.getServices();
      if (response.status === 200) {
        return response.body;
      }
      throw new Error('Failed to fetch services');
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ServiceCardSkeleton />
        <ServiceCardSkeleton />
        <ServiceCardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-neutral-900 text-lg">
        <p className="font-semibold mb-2">Error loading services</p>
        <p className="text-neutral-600">{error.message}</p>
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-700 text-lg font-semibold mb-2">No services available</p>
        <p className="text-neutral-600">Please check back later or contact us for assistance.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {services.map((service) => {
        const isSelected = selectedServiceId === service.id;

        return (
          <Card
            key={service.id}
            onClick={() => onSelect(service)}
            className={cn(
              'cursor-pointer transition-all duration-300 hover:shadow-elevation-3 hover:-translate-y-1',
              isSelected
                ? 'border-macon-orange border-2 shadow-elevation-2 bg-macon-orange/5'
                : 'border-neutral-200 hover:border-macon-orange/30 shadow-elevation-1 bg-white'
            )}
            data-testid={`service-card-${service.slug}`}
          >
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-2xl md:text-3xl font-semibold text-neutral-900">
                {service.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {service.description && (
                <p className="text-lg text-neutral-600 mb-4 line-clamp-3 leading-relaxed min-h-[4.5rem]">
                  {service.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                <div className="flex flex-col">
                  <span className="text-sm text-neutral-600 mb-1">Duration</span>
                  <span className="text-lg font-semibold text-neutral-900">
                    {formatDuration(service.durationMinutes)}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm text-neutral-600 mb-1">Price</span>
                  <span className="text-3xl md:text-4xl font-heading font-semibold text-macon-orange">
                    {formatCurrency(service.priceCents)}
                  </span>
                </div>
              </div>

              {isSelected && (
                <div className="mt-3 text-center">
                  <span className="inline-block px-3 py-1 bg-macon-orange text-white text-sm font-semibold rounded-full">
                    Selected
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
