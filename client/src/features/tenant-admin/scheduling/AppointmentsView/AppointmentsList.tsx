/**
 * AppointmentsList Component
 * Table display for appointments with enriched customer and service data
 */

import { Loader2, CheckCircle, Clock, XCircle, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { EnrichedAppointment } from './types';

interface AppointmentsListProps {
  appointments: EnrichedAppointment[];
  isLoading: boolean;
  totalCount: number;
}

/**
 * Format ISO datetime to readable date/time string
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get badge configuration (color and icon) based on appointment status
 * Icons provide non-color visual cue for accessibility (WCAG compliance)
 */
function getStatusConfig(status: string): { className: string; icon: React.ReactNode; label: string } {
  switch (status) {
    case 'CONFIRMED':
      return {
        className: 'border-green-500 bg-green-900/20 text-green-300',
        icon: <CheckCircle className="h-3 w-3" aria-hidden="true" />,
        label: 'Confirmed',
      };
    case 'PENDING':
      return {
        className: 'border-yellow-500 bg-yellow-900/20 text-yellow-300',
        icon: <Clock className="h-3 w-3" aria-hidden="true" />,
        label: 'Pending',
      };
    case 'CANCELED':
      return {
        className: 'border-red-500 bg-red-900/20 text-red-300',
        icon: <XCircle className="h-3 w-3" aria-hidden="true" />,
        label: 'Canceled',
      };
    case 'FULFILLED':
      return {
        className: 'border-blue-500 bg-blue-900/20 text-blue-300',
        icon: <Check className="h-3 w-3" aria-hidden="true" />,
        label: 'Fulfilled',
      };
    default:
      return {
        className: 'border-white/30 bg-macon-navy-700 text-white/70',
        icon: <Clock className="h-3 w-3" aria-hidden="true" />,
        label: status,
      };
  }
}

export function AppointmentsList({
  appointments,
  isLoading,
  totalCount,
}: AppointmentsListProps) {
  return (
    <Card className="p-6 bg-macon-navy-800 border-white/20">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-white">
          Appointments{' '}
          {appointments.length !== totalCount &&
            `(${appointments.length} of ${totalCount})`}
        </h2>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-white/20 hover:bg-macon-navy-700">
            <TableHead className="text-white/90 text-lg">Date/Time</TableHead>
            <TableHead className="text-white/90 text-lg">Service</TableHead>
            <TableHead className="text-white/90 text-lg">Client</TableHead>
            <TableHead className="text-white/90 text-lg">Contact</TableHead>
            <TableHead className="text-white/90 text-lg">Status</TableHead>
            <TableHead className="text-white/90 text-lg">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow className="hover:bg-macon-navy-700">
              <TableCell colSpan={6} className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/60" />
              </TableCell>
            </TableRow>
          ) : appointments.length === 0 ? (
            <TableRow className="hover:bg-macon-navy-700">
              <TableCell colSpan={6} className="text-center py-12 text-white/90">
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xl font-medium text-white">
                    No appointments found
                  </p>
                  <p className="text-base text-white/70">
                    Try adjusting your filters or date range above.
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            appointments.map((appointment) => (
              <TableRow
                key={appointment.id}
                className="border-white/20 hover:bg-macon-navy-700"
              >
                {/* Date/Time */}
                <TableCell className="font-medium text-white text-base">
                  <div className="flex flex-col gap-1">
                    <span>{formatDateTime(appointment.startTime)}</span>
                    <span className="text-sm text-white/60">
                      {appointment.clientTimezone || 'UTC'}
                    </span>
                  </div>
                </TableCell>

                {/* Service */}
                <TableCell className="text-white/90 text-base">
                  {appointment.serviceName || appointment.serviceId}
                </TableCell>

                {/* Client Name */}
                <TableCell className="text-white/90 text-base">
                  {appointment.customerName || 'Unknown'}
                </TableCell>

                {/* Contact */}
                <TableCell className="text-white/90 text-base">
                  <div className="flex flex-col gap-1">
                    {appointment.customerEmail && (
                      <a
                        href={`mailto:${appointment.customerEmail}`}
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        {appointment.customerEmail}
                      </a>
                    )}
                    {appointment.customerPhone && (
                      <a
                        href={`tel:${appointment.customerPhone}`}
                        className="text-white/70 hover:text-white/90"
                      >
                        {appointment.customerPhone}
                      </a>
                    )}
                    {!appointment.customerEmail && !appointment.customerPhone && (
                      <span className="text-white/50">No contact info</span>
                    )}
                  </div>
                </TableCell>

                {/* Status */}
                <TableCell>
                  {(() => {
                    const config = getStatusConfig(appointment.status);
                    return (
                      <Badge
                        variant="outline"
                        className={`gap-1.5 ${config.className}`}
                      >
                        {config.icon}
                        {config.label}
                      </Badge>
                    );
                  })()}
                </TableCell>

                {/* Notes */}
                <TableCell className="text-white/70 text-base max-w-xs truncate">
                  {appointment.notes || '-'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
