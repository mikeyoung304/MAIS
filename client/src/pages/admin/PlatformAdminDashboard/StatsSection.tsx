import { Building2, DollarSign, Calendar, Layers } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { MetricCardSkeleton } from '../../../components/ui/skeleton';
import { formatCurrency } from '../../../lib/utils';
import type { SystemStats } from './types';

interface StatsSectionProps {
  stats: SystemStats;
  isLoading: boolean;
}

/**
 * StatsSection Component
 *
 * Displays system-wide metrics in a grid of cards
 */
export function StatsSection({ stats, isLoading }: StatsSectionProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {/* Total Tenants Card */}
      <Card className="p-6 border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-macon-navy-50 rounded">
            <Building2 className="w-5 h-5 text-macon-navy-600" />
          </div>
          <div className="text-sm font-medium text-neutral-700">Total Tenants</div>
        </div>
        <div className="text-3xl font-bold text-neutral-900">{stats.totalTenants}</div>
        <p className="text-sm text-neutral-600 mt-1">{stats.activeTenants} active</p>
      </Card>

      {/* Business Segments Card */}
      <Card className="p-6 border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-macon-orange-50 rounded">
            <Layers className="w-5 h-5 text-macon-orange-600" />
          </div>
          <div className="text-sm font-medium text-neutral-700">Business Segments</div>
        </div>
        <div className="text-3xl font-bold text-neutral-900">{stats.totalSegments}</div>
        <p className="text-sm text-neutral-600 mt-1">{stats.activeSegments} active</p>
      </Card>

      {/* Total Bookings Card */}
      <Card className="p-6 border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-macon-navy-50 rounded">
            <Calendar className="w-5 h-5 text-macon-navy-600" />
          </div>
          <div className="text-sm font-medium text-neutral-700">Total Bookings</div>
        </div>
        <div className="text-3xl font-bold text-neutral-900">{stats.totalBookings}</div>
        <p className="text-sm text-neutral-600 mt-1">All tenants</p>
      </Card>

      {/* Total Revenue Card */}
      <Card className="p-6 border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-green-50 rounded">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-sm font-medium text-neutral-700">Total Revenue</div>
        </div>
        <div className="text-3xl font-bold text-neutral-900">
          {formatCurrency(stats.totalRevenue)}
        </div>
        <p className="text-sm text-neutral-600 mt-1">All tenants</p>
      </Card>

      {/* Platform Commission Card */}
      <Card className="p-6 border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-50 rounded">
            <DollarSign className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-sm font-medium text-neutral-700">Platform Commission</div>
        </div>
        <div className="text-3xl font-bold text-neutral-900">
          {formatCurrency(stats.platformCommission)}
        </div>
        <p className="text-sm text-neutral-600 mt-1">From all bookings</p>
      </Card>
    </div>
  );
}
