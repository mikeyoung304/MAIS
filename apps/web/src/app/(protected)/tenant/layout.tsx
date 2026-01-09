'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminSidebar } from '@/components/layouts/AdminSidebar';
import { ImpersonationBanner } from '@/components/layouts/ImpersonationBanner';
import { GrowthAssistantPanel } from '@/components/agent/GrowthAssistantPanel';
import {
  GrowthAssistantProvider,
  useGrowthAssistantContext,
} from '@/contexts/GrowthAssistantContext';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-client';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useBuildModeRedirect } from '@/hooks/useBuildModeRedirect';

/**
 * Tenant Admin Layout Content
 *
 * Inner component that consumes Growth Assistant context
 * for dynamic content margin when panel is open.
 */
function TenantLayoutContent({ children }: { children: React.ReactNode }) {
  const { isOpen, setIsOpen } = useGrowthAssistantContext();
  const [isMounted, setIsMounted] = useState(false);
  const { tenantId } = useAuth();
  const { currentPhase, isLoading: onboardingLoading } = useOnboardingState();

  // Auto-redirect to Build Mode when reaching MARKETING phase
  useBuildModeRedirect(tenantId, currentPhase, onboardingLoading);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Cmd+K / Ctrl+K keyboard shortcut to toggle Growth Assistant
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        // Don't intercept if user is typing in an input/textarea (except the assistant input)
        const target = e.target as HTMLElement;
        const isAssistantInput = target.hasAttribute('data-growth-assistant-input');
        if (!isAssistantInput && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }

        e.preventDefault();

        if (!isOpen) {
          // Open panel and focus input after animation
          setIsOpen(true);
          setTimeout(() => {
            const input = document.querySelector<HTMLTextAreaElement>(
              '[data-growth-assistant-input]'
            );
            input?.focus();
          }, 350); // Slightly longer than 300ms transition
        } else {
          // If already open, just focus the input
          const input = document.querySelector<HTMLTextAreaElement>(
            '[data-growth-assistant-input]'
          );
          input?.focus();
        }
      }
    },
    [isOpen, setIsOpen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
