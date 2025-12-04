/**
 * Type definitions for Platform Admin Dashboard
 */

export type TenantDto = {
  id: string;
  slug: string;
  name: string;
  email?: string;
  isActive: boolean;
  stripeOnboarded: boolean;
  commissionPercent: number;
  createdAt: string;
  _count?: {
    packages: number;
    bookings: number;
  };
};

export type SegmentDto = {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SystemStats = {
  totalTenants: number;
  activeTenants: number;
  totalBookings: number;
  totalRevenue: number;
  platformCommission: number;
  totalSegments: number;
  activeSegments: number;
};
