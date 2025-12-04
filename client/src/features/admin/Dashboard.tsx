import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '../../lib/api';
import type { BookingDto, PackageDto } from '@macon/contracts';
import { PackagesManager } from './packages';
import { BookingList } from './BookingList';
import { DashboardMetrics } from './dashboard/components/DashboardMetrics';
import { TabNavigation } from './dashboard/components/TabNavigation';
import { BlackoutsTab } from './dashboard/tabs/BlackoutsTab';
import { TenantsTab } from './dashboard/tabs/TenantsTab';
import { ImpersonationBanner } from './dashboard/components/ImpersonationBanner';

type Blackout = {
  date: string;
  reason?: string;
};

/**
 * Dashboard Component
 *
 * Main admin dashboard with tabs for bookings, blackouts, and packages.
 * Refactored to use smaller components for better maintainability.
 */
type Tenant = {
  id: string;
  slug: string;
  name: string;
  apiKeyPublic: string;
  commissionPercent: number;
  stripeOnboarded: boolean;
  stripeAccountId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stats: {
    bookings: number;
    packages: number;
    addOns: number;
  };
};

export function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'bookings' | 'blackouts' | 'packages' | 'tenants'>(
    'tenants'
  );
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [impersonating, setImpersonating] = useState<{
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
  } | null>(null);

  // Check if admin is impersonating on mount
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      try {
        // Decode JWT to check for impersonation data (simple base64 decode, no verification)
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.impersonating) {
          setImpersonating({
            tenantId: payload.impersonating.tenantId,
            tenantSlug: payload.impersonating.tenantSlug,
            tenantName: payload.impersonating.tenantEmail || payload.impersonating.tenantSlug,
          });
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to decode JWT:', error);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'bookings') {
      loadBookings();
    } else if (activeTab === 'blackouts') {
      loadBlackouts();
    } else if (activeTab === 'packages') {
      loadPackages();
    } else if (activeTab === 'tenants') {
      loadTenants();
    }
  }, [activeTab]);

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const result = await api.adminGetBookings();
      if (result.status === 200) {
        setBookings(result.body);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to load bookings:', error);
      }
      toast.error('Failed to load bookings', {
        description: 'Please refresh the page or contact support.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadBlackouts = async () => {
    setIsLoading(true);
    try {
      const result = await api.adminGetBlackouts();
      if (result.status === 200) {
        setBlackouts(result.body);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to load blackouts:', error);
      }
      toast.error('Failed to load blackout dates', {
        description: 'Please refresh the page or contact support.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPackages = async () => {
    setIsLoading(true);
    try {
      const result = await api.getPackages();
      if (result.status === 200) {
        setPackages(result.body);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to load packages:', error);
      }
      toast.error('Failed to load packages', {
        description: 'Please refresh the page or contact support.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const result = await api.adminGetTenants();
      if (result.status === 200 && result.body) {
        setTenants(result.body.tenants);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to load tenants:', error);
      }
      toast.error('Failed to load tenants', {
        description: 'Please refresh the page or contact support.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddBlackout = async (date: string, reason: string) => {
    try {
      const result = await api.adminCreateBlackout({
        body: {
          date,
          reason: reason || undefined,
        },
      });

      if (result.status === 200) {
        loadBlackouts();
        toast.success('Blackout date added successfully');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to create blackout:', error);
      }
      toast.error('Failed to create blackout date', {
        description: 'Please try again or contact support.',
      });
    }
  };

  const exportToCSV = () => {
    if (bookings.length === 0) return;

    const headers = ['Couple', 'Email', 'Date', 'Package ID', 'Total'];
    const rows = bookings.map((b) => [
      b.coupleName,
      b.email,
      b.eventDate,
      b.packageId,
      `$${(b.totalCents / 100).toFixed(2)}`,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/login');
  };

  // Calculate metrics with useMemo
  const metrics = useMemo(() => {
    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce((sum, b) => sum + b.totalCents, 0);
    const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;
    return { totalBookings, totalRevenue, averageBookingValue };
  }, [bookings]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
        <Button
          onClick={handleLogout}
          variant="outline"
          size="lg"
          className="border-white/20 text-white/90 hover:bg-macon-navy-800 text-lg"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Logout
        </Button>
      </div>

      {/* Impersonation Banner */}
      {impersonating && (
        <ImpersonationBanner
          tenantName={impersonating.tenantName}
          tenantSlug={impersonating.tenantSlug}
          onStopImpersonation={() => setImpersonating(null)}
        />
      )}

      {/* Metrics Cards */}
      <DashboardMetrics
        totalBookings={metrics.totalBookings}
        totalRevenue={metrics.totalRevenue}
        packagesCount={packages.length}
        blackoutsCount={blackouts.length}
      />

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <BookingList bookings={bookings} isLoading={isLoading} onExportCSV={exportToCSV} />
      )}

      {/* Blackouts Tab */}
      {activeTab === 'blackouts' && (
        <BlackoutsTab
          blackouts={blackouts}
          isLoading={isLoading}
          onAddBlackout={handleAddBlackout}
        />
      )}

      {/* Packages Tab */}
      {activeTab === 'packages' && (
        <PackagesManager packages={packages} onPackagesChange={loadPackages} />
      )}

      {/* Tenants Tab */}
      {activeTab === 'tenants' && (
        <TenantsTab tenants={tenants} isLoading={isLoading} onRefresh={loadTenants} />
      )}
    </div>
  );
}
