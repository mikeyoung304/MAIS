import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { logger } from '../../../lib/logger';
import type { TenantDto, SegmentDto, SystemStats } from './types';

/**
 * useDashboardData Hook
 *
 * Manages loading and state for platform admin dashboard data
 */
export function useDashboardData() {
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalTenants: 0,
    activeTenants: 0,
    totalBookings: 0,
    totalRevenue: 0,
    platformCommission: 0,
    totalSegments: 0,
    activeSegments: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Load all tenants (Platform admin can see all)
      const tenantsResult = await api.platformGetAllTenants();
      if (tenantsResult.status === 200) {
        setTenants(tenantsResult.body);
      }

      // Load system-wide statistics
      const statsResult = await api.platformGetStats();
      if (statsResult.status === 200) {
        setStats(statsResult.body);
      }

      // Fetch segments count across all tenants
      try {
        const segmentsResult = await api.tenantAdminGetSegments();
        if (segmentsResult.status === 200) {
          const segments = segmentsResult.body as SegmentDto[];
          const segmentCount = segments.length;
          const activeSegmentCount = segments.filter((s) => s.active).length;

          setStats((prev) => ({
            ...prev,
            totalSegments: segmentCount,
            activeSegments: activeSegmentCount,
          }));
        }
      } catch (segmentError) {
        // Segments endpoint might not be accessible or might fail
        // Set to 0 as fallback
        logger.warn('Could not fetch segments', {
          error: segmentError,
          component: 'useDashboardData',
        });
        setStats((prev) => ({
          ...prev,
          totalSegments: 0,
          activeSegments: 0,
        }));
      }
    } catch (error) {
      logger.error('Failed to load dashboard data', { error, component: 'useDashboardData' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    tenants,
    stats,
    isLoading,
    refresh: loadDashboardData,
  };
}
