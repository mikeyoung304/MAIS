/**
 * Dashboard Data Hook
 *
 * Manages data fetching for the tenant dashboard
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../../lib/api';
import { logger } from '../../../lib/logger';
import type { PackageDto, BookingDto, SegmentDto } from '@macon/contracts';

type BlackoutDto = {
  id: string;
  tenantId: string;
  date: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
};

type BrandingDto = {
  id: string;
  tenantId: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
};

/** A segment with its associated packages for grouped view */
export type SegmentWithPackages = SegmentDto & {
  packages: PackageDto[];
};

export function useDashboardData(activeTab: string) {
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [blackouts, setBlackouts] = useState<BlackoutDto[]>([]);
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [branding, setBranding] = useState<BrandingDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /** Load packages and segments in parallel for the packages tab */
  const loadPackagesAndSegments = useCallback(async () => {
    setIsLoading(true);
    try {
      const [packagesResult, segmentsResult] = await Promise.all([
        api.tenantAdminGetPackages(),
        api.tenantAdminGetSegments(),
      ]);
      if (packagesResult.status === 200) {
        setPackages(packagesResult.body);
      }
      if (segmentsResult.status === 200) {
        // Sort segments by sortOrder ascending
        const sortedSegments = [...segmentsResult.body].sort((a, b) => a.sortOrder - b.sortOrder);
        setSegments(sortedSegments);
      }
    } catch (error) {
      logger.error('Failed to load packages/segments:', { error, component: 'useDashboardData' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadBlackouts = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.tenantAdminGetBlackouts();
      if (result.status === 200) {
        setBlackouts(result.body);
      }
    } catch (error) {
      logger.error('Failed to load blackouts:', { error, component: 'useDashboardData' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.tenantAdminGetBookings();
      if (result.status === 200) {
        setBookings(result.body);
      }
    } catch (error) {
      logger.error('Failed to load bookings:', { error, component: 'useDashboardData' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadBranding = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.tenantAdminGetBranding();
      if (result.status === 200) {
        setBranding(result.body);
      }
    } catch (error) {
      logger.error('Failed to load branding:', { error, component: 'useDashboardData' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'packages') {
      loadPackagesAndSegments();
    } else if (activeTab === 'blackouts') {
      loadBlackouts();
    } else if (activeTab === 'bookings') {
      loadBookings();
    } else if (activeTab === 'branding') {
      loadBranding();
    }
  }, [activeTab, loadPackagesAndSegments, loadBlackouts, loadBookings, loadBranding]);

  // Client-side grouping: segments with their packages
  const grouped = useMemo<SegmentWithPackages[]>(() => {
    return segments.map((seg) => ({
      ...seg,
      packages: packages.filter((p) => p.segmentId === seg.id),
    }));
  }, [segments, packages]);

  // Packages not assigned to any segment
  const orphanedPackages = useMemo(() => {
    return packages.filter((p) => !p.segmentId);
  }, [packages]);

  // Show grouped view only when 2+ segments exist
  const showGroupedView = segments.length >= 2;

  return {
    packages,
    segments,
    grouped,
    orphanedPackages,
    showGroupedView,
    blackouts,
    bookings,
    branding,
    isLoading,
    loadPackages: loadPackagesAndSegments,
    loadBlackouts,
    loadBookings,
    loadBranding,
  };
}
