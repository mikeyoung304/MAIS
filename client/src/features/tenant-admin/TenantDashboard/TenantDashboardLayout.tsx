/**
 * TenantDashboardLayout - Shared layout wrapper for tenant admin pages
 *
 * Provides consistent layout with:
 * - AdminLayout wrapper with breadcrumbs
 * - Impersonation banner when applicable
 * - Apple-minimal styling (soft cream background, generous whitespace)
 */

import type { ReactNode } from "react";
import { AdminLayout } from "../../../layouts/AdminLayout";
import { ImpersonationBanner } from "../../admin/dashboard/components/ImpersonationBanner";
import { useAuth } from "../../../contexts/AuthContext";

interface TenantDashboardLayoutProps {
  children: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export function TenantDashboardLayout({
  children,
  breadcrumbs = [{ label: "Dashboard", href: "/tenant/dashboard" }],
}: TenantDashboardLayoutProps) {
  const { isImpersonating, impersonation } = useAuth();

  return (
    <AdminLayout breadcrumbs={breadcrumbs}>
      <div className="min-h-screen bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
          {/* Impersonation Banner */}
          {isImpersonating() && impersonation && (
            <ImpersonationBanner
              tenantName={impersonation.tenantSlug}
              tenantSlug={impersonation.tenantSlug}
              onStopImpersonation={() => {
                // Banner handles the API call and page reload
              }}
            />
          )}

          {children}
        </div>
      </div>
    </AdminLayout>
  );
}
