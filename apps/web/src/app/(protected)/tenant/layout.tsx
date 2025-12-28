'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminSidebar } from '@/components/layouts/AdminSidebar';
import { ImpersonationBanner } from '@/components/layouts/ImpersonationBanner';
import { GrowthAssistantPanel } from '@/components/agent/GrowthAssistantPanel';
import {
  GrowthAssistantProvider,
  useGrowthAssistantContext,
} from '@/contexts/GrowthAssistantContext';
import { cn } from '@/lib/utils';

/**
 * Tenant Admin Layout Content
 *
 * Inner component that consumes Growth Assistant context
 * for dynamic content margin when panel is open.
 */
function TenantLayoutContent({ children }: { children: React.ReactNode }) {
  const { isOpen } = useGrowthAssistantContext();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Match SSR default during hydration to prevent mismatch
  const shouldPushContent = isMounted ? isOpen : true;

  return (
    <div className="min-h-screen bg-surface">
      <AdminSidebar />
      <main
        className={cn(
          'lg:pl-72 transition-[padding-right] duration-300 ease-in-out',
          // Push content left when panel is open (desktop only)
          shouldPushContent && 'lg:pr-[400px]'
        )}
      >
        <div className="p-6 lg:p-8">{children}</div>
      </main>
      {/* Growth Assistant - always visible side panel */}
      <GrowthAssistantPanel />
    </div>
  );
}

/**
 * Tenant Admin Layout
 *
 * Protected layout for all /tenant/* routes.
 * Includes sidebar navigation, Growth Assistant panel, and requires TENANT_ADMIN role.
 * Shows impersonation banner when a PLATFORM_ADMIN is impersonating.
 */
export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['TENANT_ADMIN']}>
      <GrowthAssistantProvider>
        <ImpersonationBanner />
        <TenantLayoutContent>{children}</TenantLayoutContent>
      </GrowthAssistantProvider>
    </ProtectedRoute>
  );
}
