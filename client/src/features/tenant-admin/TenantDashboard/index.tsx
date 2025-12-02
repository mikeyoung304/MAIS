/**
 * TenantDashboard Component
 *
 * Main dashboard for tenant administrators with modular sub-components
 * Shows impersonation banner when platform admin is impersonating a tenant
 *
 * Design: Apple-minimal aesthetic matching the landing page
 * - Soft cream background with generous whitespace
 * - Sage accent colors, serif headlines
 * - Subtle animations and elegant cards
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles, Pencil } from "lucide-react";
import { TenantPackagesManager } from "../TenantPackagesManager";
import { BlackoutsManager } from "../BlackoutsManager";
import { TenantBookingList } from "../TenantBookingList";
import { BrandingEditor } from "../BrandingEditor";
import { StripeConnectCard } from "./StripeConnectCard";
import { AdminLayout } from "../../../layouts/AdminLayout";
import { MetricsCards } from "./MetricsCards";
import { TabNavigation, type DashboardTab } from "./TabNavigation";
import { useDashboardData } from "./useDashboardData";
import { ImpersonationBanner } from "../../admin/dashboard/components/ImpersonationBanner";
import { useAuth } from "../../../contexts/AuthContext";
import type { TenantDto } from "./types";

interface TenantDashboardProps {
  tenantInfo?: TenantDto;
}

export function TenantDashboard({ tenantInfo }: TenantDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("packages");
  const { isImpersonating, impersonation } = useAuth();

  const {
    packages,
    segments,
    grouped,
    orphanedPackages,
    showGroupedView,
    blackouts,
    bookings,
    branding,
    isLoading,
    loadPackages,
    loadBlackouts,
    loadBranding,
  } = useDashboardData(activeTab);

  return (
    <AdminLayout breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="min-h-screen bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
          {/* Impersonation Banner */}
          {isImpersonating() && impersonation && (
            <ImpersonationBanner
              tenantName={tenantInfo?.name || impersonation.tenantSlug}
              tenantSlug={impersonation.tenantSlug}
              onStopImpersonation={() => {
                // Banner handles the API call and page reload
              }}
            />
          )}

          {/* Header - Apple-minimal style */}
          <header
            className="animate-fade-in-up"
            style={{ animationDelay: "0.1s", animationFillMode: "backwards" }}
          >
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-sage/10 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-sage" />
                  </div>
                  <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary tracking-tight">
                    Dashboard
                  </h1>
                </div>
                {tenantInfo && (
                  <p className="text-text-muted text-lg pl-[52px]">
                    {tenantInfo.name}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Link
                  to="/tenant/editor"
                  className="group inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-sage-light/20 text-sage border border-sage/30 text-sm font-medium rounded-full transition-all duration-300 shadow-soft hover:shadow-medium"
                >
                  <Pencil className="w-4 h-4" />
                  Visual Editor
                </Link>
                <Link
                  to="/packages"
                  className="group inline-flex items-center gap-2 px-5 py-2.5 bg-sage hover:bg-sage-hover text-white text-sm font-medium rounded-full transition-all duration-300 shadow-soft hover:shadow-medium"
                >
                  View Storefront
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </header>

          {/* Metrics Cards */}
          <section
            className="animate-fade-in-up"
            style={{ animationDelay: "0.2s", animationFillMode: "backwards" }}
          >
            <MetricsCards
              packagesCount={packages.length}
              blackoutsCount={blackouts.length}
              bookingsCount={bookings.length}
              hasBranding={!!branding}
            />
          </section>

          {/* Tab Navigation */}
          <section
            className="animate-fade-in-up"
            style={{ animationDelay: "0.3s", animationFillMode: "backwards" }}
          >
            <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          </section>

          {/* Tab Content - WCAG 4.1.2 compliant tabpanel */}
          <section
            role="tabpanel"
            id={`${activeTab}-panel`}
            aria-labelledby={`${activeTab}-tab`}
            tabIndex={0}
            className="animate-fade-in-up focus:outline-none"
            style={{ animationDelay: "0.4s", animationFillMode: "backwards" }}
          >
            {activeTab === "packages" && (
              <TenantPackagesManager
                packages={packages}
                segments={segments}
                grouped={grouped}
                orphanedPackages={orphanedPackages}
                showGroupedView={showGroupedView}
                onPackagesChange={loadPackages}
              />
            )}

            {activeTab === "blackouts" && (
              <BlackoutsManager
                blackouts={blackouts}
                isLoading={isLoading}
                onBlackoutsChange={loadBlackouts}
              />
            )}

            {activeTab === "bookings" && (
              <TenantBookingList bookings={bookings} isLoading={isLoading} />
            )}

            {activeTab === "branding" && (
              <BrandingEditor
                branding={branding}
                isLoading={isLoading}
                onBrandingChange={loadBranding}
              />
            )}

            {activeTab === "payments" && (
              <StripeConnectCard />
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}