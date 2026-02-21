'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { OnboardingStatus } from '@macon/contracts';
import { queryKeys } from '@/lib/query-client';

// Unified Tenant Agent API with bootstrap context injection (Pitfall #83 fix)
const API_PROXY = '/api/tenant-admin/agent/tenant';

/**
 * Onboarding state response from API
 */
interface OnboardingStateResponse {
  status: OnboardingStatus;
  isComplete: boolean;
  isReturning: boolean;
  lastActiveAt: string | null;
  revealCompleted: boolean;
  summaries: {
    discovery: string | null;
    marketContext: string | null;
    preferences: string | null;
    decisions: string | null;
    pendingQuestions: string | null;
  };
  resumeMessage: string | null;
  memory: {
    currentStatus: OnboardingStatus;
    discoveryData: unknown | null;
    marketResearchData: unknown | null;
    servicesData: unknown | null;
    marketingData: unknown | null;
    lastEventVersion: number;
  } | null;
}

/**
 * Result type for unauthenticated state
 */
interface UnauthenticatedResult {
  isAuthenticated: false;
}

/**
 * Fetch onboarding state from API
 * Returns null for 401 (unauthenticated), throws for other errors
 */
async function fetchOnboardingState(): Promise<OnboardingStateResponse | UnauthenticatedResult> {
  const response = await fetch(`${API_PROXY}/onboarding-state`);

  if (!response.ok) {
    if (response.status === 401) {
      // Return a marker object for unauthenticated state
      return { isAuthenticated: false };
    }
    // Include status code in error message for debugging (TODO-758)
    const errorBody = await response.text().catch(() => 'Unable to read response body');
    throw new Error(
      `Failed to fetch onboarding state: ${response.status} ${response.statusText}. ${errorBody}`
    );
  }

  return response.json();
}

/**
 * Type guard to check if result is unauthenticated
 */
function isUnauthenticated(
  result: OnboardingStateResponse | UnauthenticatedResult | undefined
): result is UnauthenticatedResult {
  return result !== undefined && 'isAuthenticated' in result && result.isAuthenticated === false;
}

/**
 * Hook for managing onboarding state
 *
 * Uses TanStack Query for:
 * - Automatic request deduplication (multiple components share one request)
 * - Intelligent caching with staleTime
 * - Coordinated refetching after mutations
 *
 * Features:
 * - Fetches onboarding state from API
 * - Provides skip functionality
 * - Tracks loading and error states
 * - Auto-refreshes after skip
 */
export function useOnboardingState() {
  const queryClient = useQueryClient();

  // Fetch onboarding state with TanStack Query
  // Multiple hook instances share the same cache entry
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.onboarding.state,
    queryFn: fetchOnboardingState,
    staleTime: 60_000, // 1 minute - matches default in query-client.ts
  });

  // Skip onboarding mutation
  const skipMutation = useMutation({
    mutationFn: async (reason?: string) => {
      const response = await fetch(`${API_PROXY}/skip-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to skip onboarding');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch onboarding state after skip
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.state });
    },
  });

  // Determine authentication and state
  const isUnauthenticatedResult = isUnauthenticated(data);
  const state = isUnauthenticatedResult ? null : (data as OnboardingStateResponse | undefined);

  // Derived values
  const isOnboarding = state ? state.status !== 'COMPLETE' : false;
  const currentStatus = state?.status ?? 'PENDING_PAYMENT';

  return {
    // State
    state,
    currentStatus,
    /** @deprecated Use currentStatus */
    currentPhase: currentStatus,
    isOnboarding,
    isComplete: state?.isComplete ?? false,
    isReturning: state?.isReturning ?? false,
    revealCompleted: state?.revealCompleted ?? false,
    resumeMessage: state?.resumeMessage ?? null,
    summaries: state?.summaries ?? null,

    // Loading/Error/Auth
    isLoading,
    error: error?.message ?? null,
    isAuthenticated: data !== undefined ? !isUnauthenticatedResult : null,

    // Actions
    skipOnboarding: skipMutation.mutateAsync,
    isSkipping: skipMutation.isPending,
    skipError: skipMutation.error?.message ?? null,
    refetch: () => queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.state }),
  };
}

export default useOnboardingState;
