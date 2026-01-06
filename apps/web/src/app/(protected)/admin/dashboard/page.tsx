'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardMetrics } from '@/components/admin/DashboardMetrics';
import { AlertCircle, ArrowRight, Building2, Calendar, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/errors';
import type { PlatformStats } from '@macon/contracts';

/**
 * Platform Admin Dashboard Page
 *
 * Shows platform-wide metrics and statistics including:
 * - Tenant counts (total/active)
 * - Booking metrics (total/confirmed/pending)
 * - Revenue data (total/platform commission/this month)
 */
export default function AdminDashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/stats');

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      logger.error(
        'Failed to fetch platform stats',
        err instanceof Error ? err : { error: String(err) }
      );
      setError(getErrorMessage(err));
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const quickActions = [
    {
      title: 'Manage Tenants',
      description: 'View and manage all tenants',
      href: '/admin/tenants',
      icon: <Building2 className="h-5 w-5" />,
    },
    {
      title: 'View Bookings',
      description: 'See all platform bookings',
      href: '/admin/bookings',
      icon: <Calendar className="h-5 w-5" />,
    },
  ];

  // Default stats for loading state
  const displayStats: PlatformStats = stats ?? {
    totalTenants: 0,
    activeTenants: 0,
    totalSegments: 0,
    activeSegments: 0,
    totalBookings: 0,
    confirmedBookings: 0,
    pendingBookings: 0,
    totalRevenue: 0,
    platformCommission: 0,
    tenantRevenue: 0,
    revenueThisMonth: 0,
    bookingsThisMonth: 0,
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Platform Dashboard</h1>
          <p className="mt-2 text-text-muted">
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}. Here&apos;s your
            platform overview.
          </p>
        </div>
        <Button
          variant="outline-light"
          onClick={fetchStats}
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
                <p className="font-medium text-red-300">Failed to load dashboard</p>
                <p className="text-sm text-red-400">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStats}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Grid */}
      <DashboardMetrics stats={displayStats} isLoading={isLoading} />

      {/* Quick Actions */}
      <div>
        <h2 className="font-serif text-xl font-bold text-text-primary mb-4">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.title} href={action.href}>
              <Card
                colorScheme="dark"
                className="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer group h-full"
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="rounded-xl bg-sage/10 p-3 text-sage transition-colors group-hover:bg-sage group-hover:text-white">
                    {action.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-text-primary">{action.title}</h3>
                    <p className="text-sm text-text-muted">{action.description}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-text-muted group-hover:text-sage transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
