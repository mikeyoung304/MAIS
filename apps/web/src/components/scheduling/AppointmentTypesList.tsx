'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, DollarSign, Pencil, Trash2, CheckCircle, XCircle, Timer } from 'lucide-react';
import { formatPriceWithCents, formatDuration } from '@/lib/format';
import type { ServiceDto } from '@macon/contracts';

/**
 * Appointment Type DTO - alias for ServiceDto from contracts
 * UI uses "Appointment Type" terminology.
 */
type AppointmentTypeDto = ServiceDto;

interface AppointmentTypesListProps {
  appointmentTypes: AppointmentTypeDto[];
  onEdit: (type: AppointmentTypeDto) => void;
  onDelete: (type: AppointmentTypeDto) => void;
  onToggleActive: (type: AppointmentTypeDto) => void;
}

/**
 * Appointment Types List Component
 *
 * Displays appointment types in a responsive card grid.
 * Shows duration, buffer time, price, and status for each type.
 */
export function AppointmentTypesList({
  appointmentTypes,
  onEdit,
  onDelete,
  onToggleActive,
}: AppointmentTypesListProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {appointmentTypes.map((type) => (
        <Card
          key={type.id}
          className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg line-clamp-1">{type.name}</CardTitle>
              <button
                onClick={() => onToggleActive(type)}
                className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 rounded-full"
                aria-label={`Toggle status (currently ${type.active ? 'active' : 'inactive'})`}
              >
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
                    type.active
                      ? 'bg-sage/10 text-sage hover:bg-sage/20'
                      : 'bg-neutral-100 text-text-muted hover:bg-neutral-200'
                  }`}
                >
                  {type.active ? (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      Active
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      Inactive
                    </>
                  )}
                </span>
              </button>
            </div>
            <p className="text-sm text-text-muted font-mono">{type.slug}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Description */}
            <p className="text-sm text-text-muted line-clamp-2">
              {type.description || 'No description'}
            </p>

            {/* Duration and Buffer */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-text-primary">
                <Clock className="h-4 w-4 text-sage" />
                <span>{formatDuration(type.durationMinutes)}</span>
              </div>
              {type.bufferMinutes > 0 && (
                <div className="flex items-center gap-1.5 text-text-muted">
                  <Timer className="h-4 w-4" />
                  <span>+{type.bufferMinutes}min buffer</span>
                </div>
              )}
            </div>

            {/* Price */}
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-5 w-5 text-sage" />
              <span className="text-xl font-bold text-text-primary">
                {formatPriceWithCents(type.priceCents)}
              </span>
            </div>

            {/* Sort Order */}
            <p className="text-xs text-text-muted">Sort order: {type.sortOrder}</p>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => onEdit(type)}
              >
                <Pencil className="mr-2 h-3 w-3" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => onDelete(type)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
