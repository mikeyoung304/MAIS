'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import {
  Calendar,
  Loader2,
  AlertCircle,
  CalendarDays,
  CalendarX,
  Clock,
  CalendarClock,
  ArrowRight,
} from 'lucide-react';

interface Booking {
  id: string;
  date: string;
  status: string;
  packageName: string;
  customerEmail: string | null;
}

interface Blackout {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

/**
 * Tenant Scheduling Overview Page
 *
 * Dashboard view with summary stats and quick links to scheduling sub-pages.
 */
export default function TenantSchedulingPage() {
  const { isAuthenticated } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!isAuthenticated) return;

      try {
        const [bookingsRes, blackoutsRes] = await Promise.all([
          fetch('/api/tenant-admin/bookings'),
          fetch('/api/tenant-admin/blackouts'),
        ]);

        if (bookingsRes.ok) {
          const data = await bookingsRes.json();
          setBookings(Array.isArray(data) ? data : []);
        }

        if (blackoutsRes.ok) {
          const data = await blackoutsRes.json();
          setBlackouts(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        setError('Failed to load scheduling data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [isAuthenticated]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'bg-sage/10 text-sage';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-neutral-100 text-text-muted';
    }
  };

  // Get upcoming bookings (next 7 days) - memoized to prevent recalculation on every render
  const upcomingBookings = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    return bookings
      .filter((b) => {
        const bookingDate = new Date(b.date);
        return bookingDate >= now && bookingDate <= weekFromNow;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  }, [bookings]);

  // Get upcoming blackouts - memoized to prevent recalculation on every render
  const upcomingBlackouts = useMemo(() => {
    const now = new Date();
    return blackouts
      .filter((b) => new Date(b.endDate) >= now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 3);
  }, [blackouts]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Scheduling Overview</h1>
          <p className="mt-2 text-text-muted">Manage your bookings and availability</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-sage" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">Scheduling Overview</h1>
        <p className="mt-2 text-text-muted">Manage your bookings and availability</p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/tenant/scheduling/appointments">
          <Card className="cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-sage/10 p-3">
                <CalendarDays className="h-6 w-6 text-sage" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{bookings.length}</p>
                <p className="text-sm text-text-muted">Total Bookings</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/tenant/scheduling/blackouts">
          <Card className="cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-amber-950/30 p-3">
                <CalendarX className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{blackouts.length}</p>
                <p className="text-sm text-text-muted">Blackout Dates</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/tenant/scheduling/appointment-types">
          <Card className="cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-blue-100 p-3">
                <CalendarClock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Appointment Types</p>
                <p className="text-xs text-text-muted">Configure services</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/tenant/scheduling/availability">
          <Card className="cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-purple-100 p-3">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Availability</p>
                <p className="text-xs text-text-muted">Set your hours</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Access Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Bookings */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-text-primary">Upcoming Bookings</h2>
              <Link
                href="/tenant/scheduling/appointments"
                className="flex items-center gap-1 text-sm text-sage hover:text-sage-hover"
              >
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {upcomingBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="mb-3 h-8 w-8 text-text-muted/50" />
                <p className="text-sm text-text-muted">No upcoming bookings this week</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between rounded-lg border border-neutral-100 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-sage/10 p-2">
                        <Calendar className="h-4 w-4 text-sage" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {booking.packageName}
                        </p>
                        <p className="text-xs text-text-muted">{formatDate(booking.date)}</p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(booking.status)}`}
                    >
                      {booking.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Blackouts */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-text-primary">Upcoming Blackouts</h2>
              <Link
                href="/tenant/scheduling/blackouts"
                className="flex items-center gap-1 text-sm text-sage hover:text-sage-hover"
              >
                Manage <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {upcomingBlackouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarX className="mb-3 h-8 w-8 text-text-muted/50" />
                <p className="text-sm text-text-muted">No upcoming blackout dates</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingBlackouts.map((blackout) => (
                  <div
                    key={blackout.id}
                    className="flex items-center justify-between rounded-lg border border-neutral-100 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-amber-950/30 p-2">
                        <CalendarX className="h-4 w-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {formatDate(blackout.startDate)}
                          {blackout.startDate !== blackout.endDate && (
                            <span className="text-text-muted">
                              {' '}
                              - {formatDate(blackout.endDate)}
                            </span>
                          )}
                        </p>
                        {blackout.reason && (
                          <p className="text-xs text-text-muted">{blackout.reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
