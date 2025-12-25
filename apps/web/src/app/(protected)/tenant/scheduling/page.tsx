'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calendar,
  Clock,
  Plus,
  Loader2,
  AlertCircle,
  CalendarDays,
  CalendarX,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
 * Tenant Scheduling Page
 *
 * Overview of bookings and blackout dates.
 */
export default function TenantSchedulingPage() {
  const { token } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'bookings' | 'blackouts'>('bookings');

  useEffect(() => {
    async function fetchData() {
      if (!token) return;

      try {
        const [bookingsRes, blackoutsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/v1/tenant-admin/bookings`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/v1/tenant-admin/blackouts`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
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
  }, [token]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Scheduling</h1>
          <p className="mt-2 text-text-muted">Manage your bookings and availability</p>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Scheduling</h1>
          <p className="mt-2 text-text-muted">Manage your bookings and availability</p>
        </div>
        <Button variant="sage" className="rounded-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Blackout
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
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
        <Card className="cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-xl bg-macon-orange/10 p-3">
              <CalendarX className="h-6 w-6 text-macon-orange" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{blackouts.length}</p>
              <p className="text-sm text-text-muted">Blackout Dates</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('bookings')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'bookings'
              ? 'border-b-2 border-sage text-sage'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <CalendarDays className="mr-2 inline-block h-4 w-4" />
          Bookings ({bookings.length})
        </button>
        <button
          onClick={() => setActiveTab('blackouts')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'blackouts'
              ? 'border-b-2 border-sage text-sage'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <CalendarX className="mr-2 inline-block h-4 w-4" />
          Blackouts ({blackouts.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'bookings' ? (
        bookings.length === 0 ? (
          <Card className="border-2 border-dashed border-sage/20">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-sage/10 p-4">
                <Calendar className="h-8 w-8 text-sage" />
              </div>
              <h3 className="mb-2 font-semibold text-text-primary">No bookings yet</h3>
              <p className="max-w-sm text-sm text-text-muted">
                When customers book your services, they&apos;ll appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <Card key={booking.id} className="transition-all hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-sage/10 p-2">
                      <Calendar className="h-5 w-5 text-sage" />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">{booking.packageName}</p>
                      <p className="text-sm text-text-muted">{formatDate(booking.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {booking.customerEmail && (
                      <span className="text-sm text-text-muted">{booking.customerEmail}</span>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                        booking.status
                      )}`}
                    >
                      {booking.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : blackouts.length === 0 ? (
        <Card className="border-2 border-dashed border-sage/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-macon-orange/10 p-4">
              <CalendarX className="h-8 w-8 text-macon-orange" />
            </div>
            <h3 className="mb-2 font-semibold text-text-primary">No blackout dates</h3>
            <p className="mb-6 max-w-sm text-sm text-text-muted">
              Block out dates when you&apos;re unavailable for bookings.
            </p>
            <Button variant="sage" className="rounded-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Blackout Date
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {blackouts.map((blackout) => (
            <Card key={blackout.id} className="transition-all hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-macon-orange/10 p-2">
                    <CalendarX className="h-5 w-5 text-macon-orange" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">
                      {formatDate(blackout.startDate)}
                      {blackout.endDate !== blackout.startDate &&
                        ` - ${formatDate(blackout.endDate)}`}
                    </p>
                    {blackout.reason && (
                      <p className="text-sm text-text-muted">{blackout.reason}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
