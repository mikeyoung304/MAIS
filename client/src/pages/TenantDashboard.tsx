import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TenantDashboard as TenantDashboardComponent } from '../features/tenant-admin/TenantDashboard';
import { FeatureErrorBoundary } from '../components/errors';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { logger } from '../lib/logger';

type TenantDto = {
  id: string;
  slug: string;
  name: string;
  email: string;
  apiKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function TenantDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, isImpersonating, impersonation } = useAuth();
  const [tenantInfo, setTenantInfo] = useState<TenantDto | undefined>(undefined);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;

    // If impersonating, use impersonation data for tenant info
    if (isImpersonating() && impersonation) {
      setTenantInfo({
        id: impersonation.tenantId,
        slug: impersonation.tenantSlug,
        name: impersonation.tenantSlug, // Will be updated from API
        email: impersonation.tenantEmail,
        apiKey: '',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      });
      setIsLoadingInfo(false);
      return;
    }

    // Check for tenant token, redirect to login if not present
    const token = localStorage.getItem('tenantToken');
    if (!token && !isAuthenticated) {
      navigate('/tenant/login');
      return;
    }

    // Fetch tenant info
    const fetchTenantInfo = async () => {
      try {
        const result = await (api as any).tenantGetInfo();
        if (result.status === 200) {
          setTenantInfo(result.body);
        }
      } catch (error) {
        logger.error('Failed to load tenant info', { error, component: 'TenantDashboard' });
      } finally {
        setIsLoadingInfo(false);
      }
    };

    fetchTenantInfo();
  }, [navigate, authLoading, isAuthenticated, isImpersonating, impersonation]);

  // Show nothing while checking auth
  if (authLoading) {
    return null;
  }

  // Allow access if impersonating or has tenant token
  const hasAccess = isImpersonating() || localStorage.getItem('tenantToken');
  if (!hasAccess) {
    return null;
  }

  return (
    <FeatureErrorBoundary featureName="Tenant Dashboard">
      <TenantDashboardComponent tenantInfo={tenantInfo} />
    </FeatureErrorBoundary>
  );
}
