'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Building2, Calendar, CheckCircle, Clock, DollarSign, TrendingUp } from 'lucide-react';
import type { PlatformStats } from '@macon/contracts';

interface DashboardMetricsProps {
  stats: PlatformStats;
  isLoading?: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  color: string;
  isLoading?: boolean;
}

function MetricCard({ title, value, description, icon, color, isLoading }: MetricCardProps) {
  return (
    <Card
      colorScheme="dark"
      className="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-text-muted">{title}</CardTitle>
        <div className={color}>{icon}</div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-neutral-700" />
        ) : (
          <>
            <div className="text-2xl font-bold text-text-primary">{value}</div>
            {description && <p className="text-xs text-text-muted mt-1">{description}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * DashboardMetrics Component
 *
 * Displays platform-wide metrics for the admin dashboard.
 * Shows tenant counts, booking statistics, and revenue data.
 */
export function DashboardMetrics({ stats, isLoading = false }: DashboardMetricsProps) {
  const metrics: MetricCardProps[] = [
    {
      title: 'Total Tenants',
      value: stats.totalTenants,
      description: `${stats.activeTenants} active`,
      icon: <Building2 className="h-5 w-5" />,
      color: 'text-sage',
    },
    {
      title: 'Total Bookings',
      value: stats.totalBookings,
      description: `${stats.confirmedBookings} confirmed`,
      icon: <Calendar className="h-5 w-5" />,
      color: 'text-sky-400',
    },
    {
      title: 'Confirmed',
      value: stats.confirmedBookings,
      icon: <CheckCircle className="h-5 w-5" />,
      color: 'text-emerald-400',
    },
    {
      title: 'Pending',
      value: stats.pendingBookings,
      icon: <Clock className="h-5 w-5" />,
      color: 'text-amber-400',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      description: `Platform: ${formatCurrency(stats.platformCommission)}`,
      icon: <DollarSign className="h-5 w-5" />,
      color: 'text-sage',
    },
    {
      title: 'This Month',
      value: formatCurrency(stats.revenueThisMonth ?? 0),
      description: `${stats.bookingsThisMonth ?? 0} bookings`,
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'text-violet-400',
    },
  ];

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric) => (
        <MetricCard key={metric.title} {...metric} isLoading={isLoading} />
      ))}
    </div>
  );
}
