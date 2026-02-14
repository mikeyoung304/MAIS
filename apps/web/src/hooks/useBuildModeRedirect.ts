'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { OnboardingPhase } from '@macon/contracts';

const STORAGE_KEY_PREFIX = 'handled:buildmode:redirected:';

/**
 * Hook to auto-redirect to Build Mode when tenant reaches MARKETING phase
 *
 * Features:
 * - Only redirects ONCE per tenant (persisted in localStorage)
 * - Skips redirect if already on /tenant/build
 * - Uses localStorage to prevent re-redirect on refresh/back navigation
 *
 * @param tenantId - The tenant's unique identifier (for localStorage key)
 * @param currentPhase - Current onboarding phase from useOnboardingState
 * @param isLoading - Whether onboarding state is still loading
 */
export function useBuildModeRedirect(
  tenantId: string | undefined,
  currentPhase: OnboardingPhase,
  isLoading: boolean
) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip if already on Build Mode (prevents navigation loop)
    if (pathname?.startsWith('/tenant/build')) return;
    // Don't do anything while loading or without tenant
    if (isLoading || !tenantId) return;

    const storageKey = `${STORAGE_KEY_PREFIX}${tenantId}`;

    try {
      // Check if we've already redirected this tenant
      const hasRedirected = localStorage.getItem(storageKey) === 'true';

      // Redirect to Build Mode when tenant reaches MARKETING or BUILDING phase (once only)
      if ((currentPhase === 'MARKETING' || currentPhase === 'BUILDING') && !hasRedirected) {
        localStorage.setItem(storageKey, 'true');
        router.push('/tenant/build');
      }
    } catch {
      // localStorage unavailable (private browsing) - skip redirect
    }
  }, [pathname, tenantId, currentPhase, isLoading, router]);
}

export default useBuildModeRedirect;
