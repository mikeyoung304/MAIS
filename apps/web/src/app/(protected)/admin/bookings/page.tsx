'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BookingsList } from '@/components/admin/BookingsList';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errors';
import { formatDateShort } from '@/lib/utils';

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

/**
 * Platform Admin Bookings Page
 *
 * Shows all bookings across the platform with filtering and CSV export.
 */
export default function AdminBookingsPage() {
  const { isAuthenticated } = useAuth();
  const [bookings, setBookings] = useState<BookingWithTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/bookings');

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      // Handle both array and object with bookings property
      const bookingsData = Array.isArray(data) ? data : (data.bookings ?? []);
      setBookings(bookingsData);
    } catch (err) {
      logger.error('Failed to fetch bookings', err instanceof Error ? err : { error: String(err) });
      setError(getErrorMessage(err));
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleExportCSV = useCallback(() => {
    if (bookings.length === 0) return;

    const headers = [
      'ID',
      'Customer',
      'Email',
      'Tenant',
      'Event Date',
      'Status',
      'Total',
      'Created',
    ];
    const rows = bookings.map((booking) => [
      booking.id,
      booking.coupleName,
      booking.email,
      booking.tenantName ?? 'Unknown',
      formatDateShort(booking.eventDate),
      booking.status,
      (booking.totalCents / 100).toFixed(2),
      formatDateShort(booking.createdAt),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bookings-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [bookings]);

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Platform Bookings</h1>
          <p className="mt-2 text-text-muted">View and manage all bookings across the platform.</p>
        </div>
        <Button
          variant="outline-light"
          onClick={fetchBookings}
          disabled={isLoading}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-800 bg-red-950/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-red-300">Failed to load bookings</p>
                <p className="text-sm text-red-400">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchBookings}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bookings List */}
      <BookingsList bookings={bookings} isLoading={isLoading} onExportCSV={handleExportCSV} />
    </div>
  );
}
