'use client';

import { useState, useEffect, useCallback } from 'react';
import type { OnboardingPhase } from '@macon/contracts';

const API_PROXY = '/api/agent';

/**
 * Onboarding state response from API
 */
interface OnboardingStateResponse {
  phase: OnboardingPhase;
  isComplete: boolean;
  isReturning: boolean;
  lastActiveAt: string | null;
  summaries: {
    discovery: string | null;
    marketContext: string | null;
    preferences: string | null;
    decisions: string | null;
    pendingQuestions: string | null;
  };
  resumeMessage: string | null;
  memory: {
    currentPhase: OnboardingPhase;
    discoveryData: unknown | null;
    marketResearchData: unknown | null;
    servicesData: unknown | null;
    marketingData: unknown | null;
    lastEventVersion: number;
  } | null;
}

/**
 * Hook for managing onboarding state
 *
 * Features:
 * - Fetches onboarding state from API
 * - Provides skip functionality
 * - Tracks loading and error states
 * - Auto-refreshes after skip
 */
export function useOnboardingState() {
  const [state, setState] = useState<OnboardingStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isSkipping, setIsSkipping] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);

  // Fetch onboarding state
  const fetchState = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_PROXY}/onboarding-state`);

      if (!response.ok) {
        if (response.status === 401) {
          // User is not authenticated - track this explicitly
          setIsAuthenticated(false);
          setState(null);
          return;
        }
        throw new Error('Failed to fetch onboarding state');
      }

      setIsAuthenticated(true);
      const data = await response.json();
      setState(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Skip onboarding
  const skipOnboarding = useCallback(
    async (reason?: string) => {
      setIsSkipping(true);
      setSkipError(null);

      try {
        const response = await fetch(`${API_PROXY}/skip-onboarding`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to skip onboarding');
        }

        // Refresh state after skip
        await fetchState();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to skip onboarding';
        setSkipError(message);
        throw err; // Re-throw so caller can handle
      } finally {
        setIsSkipping(false);
      }
    },
    [fetchState]
  );

  // Initial fetch
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Derived values
  const isOnboarding = state ? state.phase !== 'COMPLETED' && state.phase !== 'SKIPPED' : false;

  const currentPhase = state?.phase ?? 'NOT_STARTED';

  return {
    // State
    state,
    currentPhase,
    isOnboarding,
    isComplete: state?.isComplete ?? false,
    isReturning: state?.isReturning ?? false,
    resumeMessage: state?.resumeMessage ?? null,
    summaries: state?.summaries ?? null,

    // Loading/Error/Auth
    isLoading,
    error,
    isAuthenticated,

    // Actions
    skipOnboarding,
    isSkipping,
    skipError,
    refetch: fetchState,
  };
}

export default useOnboardingState;
