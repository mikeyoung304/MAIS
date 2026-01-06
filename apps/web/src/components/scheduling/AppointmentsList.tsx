'use client';

/**
 * AppointmentsList Component
 * Responsive table/card display for appointments with enriched customer and service data
 */

import { Loader2, CheckCircle, Clock, XCircle, Check, DollarSign, Ban } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResponsiveDataTable, type Column } from '@/components/ui/ResponsiveDataTable';
import { cn } from '@/lib/utils';

/**
 * Enriched appointment with customer and service names
 */
export interface EnrichedAppointment {
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
  // Enriched fields
  serviceName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

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
 * Status badge configuration
 * Icons provide non-color visual cue for accessibility (WCAG compliance)
 */
type StatusConfig = {
  className: string;
  icon: React.ReactNode;
  label: string;
};

function getStatusConfig(status: string): StatusConfig {
  switch (status) {
    case 'CONFIRMED':
      return {
        className: 'bg-sage/10 text-sage border-sage/20',
        icon: <CheckCircle className="h-3 w-3" aria-hidden="true" />,
        label: 'Confirmed',
      };
    case 'PENDING':
      return {
        className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        icon: <Clock className="h-3 w-3" aria-hidden="true" />,
        label: 'Pending',
      };
    case 'DEPOSIT_PAID':
      return {
        className: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: <DollarSign className="h-3 w-3" aria-hidden="true" />,
        label: 'Deposit Paid',
      };
    case 'PAID':
      return {
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        icon: <DollarSign className="h-3 w-3" aria-hidden="true" />,
        label: 'Paid',
      };
    case 'CANCELED':
      return {
        className: 'bg-red-100 text-red-700 border-red-200',
        icon: <XCircle className="h-3 w-3" aria-hidden="true" />,
        label: 'Canceled',
      };
    case 'REFUNDED':
      return {
        className: 'bg-orange-100 text-orange-700 border-orange-200',
        icon: <Ban className="h-3 w-3" aria-hidden="true" />,
        label: 'Refunded',
      };
    case 'FULFILLED':
      return {
        className: 'bg-purple-100 text-purple-700 border-purple-200',
        icon: <Check className="h-3 w-3" aria-hidden="true" />,
        label: 'Fulfilled',
      };
    default:
      return {
        className: 'bg-neutral-100 text-text-muted border-neutral-200',
        icon: <Clock className="h-3 w-3" aria-hidden="true" />,
        label: status,
      };
  }
}

/**
 * Status Badge component
 */
function StatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status);
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', config.className)}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

/**
 * Column definitions for the responsive data table
 */
const columns: Column<EnrichedAppointment>[] = [
  {
    key: 'dateTime',
    header: 'Date/Time',
    mobilePriority: 1,
    render: (appointment) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{formatDateTime(appointment.startTime)}</span>
        <span className="text-xs text-text-muted">
          {appointment.clientTimezone || 'Local time'}
        </span>
      </div>
    ),
  },
  {
    key: 'service',
    header: 'Service',
    mobilePriority: 2,
    render: (appointment) => (
      <span className="text-text-primary">{appointment.serviceName || 'Unknown Service'}</span>
    ),
  },
  {
    key: 'client',
    header: 'Client',
    mobilePriority: 3,
    render: (appointment) => (
      <span className="text-text-primary">{appointment.customerName || 'Unknown'}</span>
    ),
  },
  {
    key: 'contact',
    header: 'Contact',
    mobilePriority: 4,
    render: (appointment) => (
      <div className="flex flex-col gap-0.5">
        {appointment.customerEmail ? (
          <a
            href={`mailto:${appointment.customerEmail}`}
            className="text-sage hover:text-sage/80 hover:underline text-sm"
          >
            {appointment.customerEmail}
          </a>
        ) : null}
        {appointment.customerPhone ? (
          <a
            href={`tel:${appointment.customerPhone}`}
            className="text-text-muted hover:text-text-primary text-sm"
          >
            {appointment.customerPhone}
          </a>
        ) : null}
        {!appointment.customerEmail && !appointment.customerPhone && (
          <span className="text-text-muted text-sm">No contact info</span>
        )}
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    mobilePriority: 5,
    render: (appointment) => <StatusBadge status={appointment.status} />,
  },
  {
    key: 'notes',
    header: 'Notes',
    mobilePriority: 6,
    render: (appointment) => (
      <span className="text-text-muted max-w-xs truncate">{appointment.notes || '-'}</span>
    ),
  },
];

export function AppointmentsList({ appointments, isLoading, totalCount }: AppointmentsListProps) {
  return (
    <Card className="border-neutral-200">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-text-primary">
            Appointments
            {appointments.length !== totalCount && (
              <span className="ml-2 text-text-muted font-normal text-base">
                ({appointments.length} of {totalCount})
              </span>
            )}
          </h2>
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-sage" />}
        </div>

        <ResponsiveDataTable
          data={appointments}
          columns={columns}
          getRowKey={(appointment) => appointment.id}
          mobileColumns={3}
          showExpandOnMobile
          isLoading={isLoading}
          skeletonRows={5}
          emptyState={
            <div className="flex flex-col items-center gap-2 py-8">
              <p className="text-lg font-medium text-text-primary">No appointments found</p>
              <p className="text-sm text-text-muted">Try adjusting your filters or date range.</p>
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
