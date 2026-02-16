'use client';

import { useMemo, useState } from 'react';
import { Download, Calendar, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ResponsiveDataTable, type Column } from '@/components/ui/ResponsiveDataTable';
import { formatCurrency, formatDateShort } from '@/lib/utils';

interface BookingWithTenant {
  id: string;
  coupleName: string;
  email: string;
  eventDate: string;
  status: 'PENDING' | 'DEPOSIT_PAID' | 'PAID' | 'CONFIRMED' | 'CANCELED' | 'REFUNDED' | 'FULFILLED';
  totalCents: number;
  createdAt: string;
  tierId: string;
  tenantName?: string;
  tenantSlug?: string;
}

interface BookingsListProps {
  bookings: BookingWithTenant[];
  isLoading: boolean;
  onExportCSV: () => void;
}

const statusConfig: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success'; label: string }
> = {
  PENDING: { variant: 'outline', label: 'Pending' },
  DEPOSIT_PAID: { variant: 'secondary', label: 'Deposit Paid' },
  PAID: { variant: 'success', label: 'Paid' },
  CONFIRMED: { variant: 'success', label: 'Confirmed' },
  CANCELED: { variant: 'destructive', label: 'Cancelled' },
  REFUNDED: { variant: 'outline', label: 'Refunded' },
  FULFILLED: { variant: 'default', label: 'Fulfilled' },
};

/**
 * BookingsList Component
 *
 * Displays a table of all bookings across the platform.
 * Includes status badges, tenant info, and CSV export functionality.
 */
export function BookingsList({ bookings, isLoading, onExportCSV }: BookingsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const matchesSearch =
        booking.coupleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (booking.tenantName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchTerm, statusFilter]);

  const hasBookings = filteredBookings.length > 0;

  const columns: Column<BookingWithTenant>[] = [
    {
      key: 'coupleName',
      header: 'Customer',
      mobilePriority: 1,
      render: (booking) => (
        <div>
          <p className="font-medium text-text-primary">{booking.coupleName}</p>
          <p className="text-sm text-text-muted">{booking.email}</p>
        </div>
      ),
    },
    {
      key: 'tenant',
      header: 'Tenant',
      mobilePriority: 3,
      render: (booking) => (
        <span className="text-text-primary">{booking.tenantName ?? 'Unknown'}</span>
      ),
    },
    {
      key: 'eventDate',
      header: 'Event Date',
      mobilePriority: 2,
      render: (booking) => (
        <span className="text-text-primary">{formatDateShort(booking.eventDate)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      mobilePriority: 4,
      render: (booking) => {
        const config = statusConfig[booking.status] ?? {
          variant: 'outline' as const,
          label: booking.status,
        };
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      mobilePriority: 5,
      render: (booking) => (
        <span className="font-medium text-text-primary">{formatCurrency(booking.totalCents)}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      mobilePriority: 6,
      render: (booking) => (
        <span className="text-text-muted text-sm">{formatDateShort(booking.createdAt)}</span>
      ),
    },
  ];

  const emptyState = (
    <div className="flex flex-col items-center py-12">
      <Calendar className="h-12 w-12 text-text-muted mb-4" />
      <p className="text-lg font-medium text-text-primary mb-2">No bookings found</p>
      <p className="text-text-muted">
        {searchTerm || statusFilter !== 'all'
          ? 'Try adjusting your search or filter criteria'
          : 'Bookings will appear here when tenants receive them'}
      </p>
    </div>
  );

  return (
    <Card colorScheme="dark">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="font-serif text-xl text-text-primary">All Bookings</CardTitle>
        <Button onClick={onExportCSV} variant="outline-light" disabled={!hasBookings}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search by name, email, or tenant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-700 bg-surface-alt text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-sage"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border border-neutral-700 bg-surface-alt text-text-primary focus:outline-none focus:ring-2 focus:ring-sage"
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="DEPOSIT_PAID">Deposit Paid</option>
            <option value="PAID">Paid</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
            <option value="FULFILLED">Fulfilled</option>
          </select>
        </div>

        {/* Table */}
        <ResponsiveDataTable
          data={filteredBookings}
          columns={columns}
          getRowKey={(booking) => booking.id}
          isLoading={isLoading}
          emptyState={emptyState}
          mobileColumns={3}
        />

        {/* Results count */}
        {!isLoading && (
          <p className="text-sm text-text-muted mt-4">
            Showing {filteredBookings.length} of {bookings.length} bookings
          </p>
        )}
      </CardContent>
    </Card>
  );
}
