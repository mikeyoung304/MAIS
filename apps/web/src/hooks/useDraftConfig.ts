/**
 * useDraftConfig - TanStack Query hook for draft configuration state
 *
 * Complements useDraftAutosave by providing:
 * - Fetching current draft state from the API
 * - Cache invalidation when agent tools modify config
 * - Loading and error states
 * - Derived hasDraft state
 *
 * This hook is used by:
 * - ContentArea to determine what preview to show
 * - PreviewPanel to display current draft
 * - Agent tool handlers (via invalidateDraftConfig) to refresh after modifications
 *
 * @see stores/agent-ui-store.ts for UI state management
 * @see hooks/useDraftAutosave.ts for local autosave logic
 */

'use client';

import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { DEFAULT_PAGES_CONFIG, type PagesConfig } from '@macon/contracts';
import { logger } from '@/lib/logger';
import { createClientApiClient } from '@/lib/api.client';
import { useMemo, useCallback } from 'react';

// ============================================
// TYPES
// ============================================

/**
 * Draft configuration data structure
 */
interface DraftConfigData {
  /** Pages configuration */
  pages: PagesConfig;
  /** Whether there's an unpublished draft */
  hasDraft: boolean;
  /** When the draft was last updated */
  draftUpdatedAt?: string;
  /** Optimistic locking version - tracks concurrent modifications (#620) */
  version: number;
}

/**
 * Return type for useDraftConfig hook
 */
interface UseDraftConfigResult {
  /** Current pages configuration (draft or live) */
  config: PagesConfig;
  /** Whether there's an unpublished draft */
  hasDraft: boolean;
  /** Optimistic locking version for concurrent modification detection (#620) */
  version: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch draft config */
  refetch: () => Promise<void>;
  /** Publish current draft */
  publishDraft: () => Promise<void>;
  /** Discard current draft */
  discardDraft: () => Promise<void>;
  /** Whether publish is in progress */
  isPublishing: boolean;
  /** Whether discard is in progress */
  isDiscarding: boolean;
  /** Invalidate the cache (call after agent tools modify config) */
  invalidate: () => void;
}

// ============================================
// QUERY KEY
// ============================================

const DRAFT_CONFIG_QUERY_KEY = ['draft-config'] as const;

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useDraftConfig(): UseDraftConfigResult {
  const queryClient = useQueryClient();

  // Create API client instance
  const apiClient = useMemo(() => createClientApiClient(), []);

  // Fetch draft configuration
  const query = useQuery({
    queryKey: DRAFT_CONFIG_QUERY_KEY,
    queryFn: async (): Promise<DraftConfigData> => {
      logger.debug('[useDraftConfig] Fetching draft config');

      try {
        // Fetch draft endpoint which returns both draft and published
        const response = await apiClient.getDraft({});

        if (response.status === 200) {
          const body = response.body;
          // API returns: { draft, published, draftUpdatedAt, publishedAt, version }
          // draft and published are LandingPageConfig objects with { pages, branding, ... }
          // Prefer draft over published, with fallback to defaults
          const hasDraft = body.draft !== null;
          const config = body.draft || body.published;
          const pages = config?.pages || DEFAULT_PAGES_CONFIG;

          return {
            pages,
            hasDraft,
            draftUpdatedAt: body.draftUpdatedAt ?? undefined,
            version: body.version,
          };
        }

        // 404 means tenant not found or no config - use defaults (recoverable)
        if (response.status === 404) {
          logger.debug('[useDraftConfig] No config found, using defaults');
          return { pages: DEFAULT_PAGES_CONFIG, hasDraft: false, version: 0 };
        }

        // Auth errors - throw to show error state (user needs to re-login)
        // CRITICAL: Don't silently use defaults - this causes the "DEFAULT config in preview" bug
        // where the preview shows [Your Transformation Headline] instead of actual content
        if (response.status === 401 || response.status === 403) {
          logger.error('[useDraftConfig] Authentication error', { status: response.status });
          throw new Error('Session expired. Please refresh the page to log in again.');
        }

        // Server errors - throw to show error state
        if (response.status >= 500) {
          logger.error('[useDraftConfig] Server error', { status: response.status });
          throw new Error(`Server error (${response.status}). Please try again later.`);
        }

        // Other unexpected errors - throw to surface the problem
        logger.warn('[useDraftConfig] Unexpected response status', { status: response.status });
        throw new Error(`Failed to load draft configuration (${response.status})`);
      } catch (error) {
        // Fix #817: Serialize Error properties explicitly (Error objects have non-enumerable
        // properties that become {} when JSON-serialized)
        logger.error('[useDraftConfig] Failed to fetch draft', {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          errorName: error instanceof Error ? error.name : undefined,
        });
        throw error;
      }
    },
    staleTime: 0, // Real-time updates: agent tools modify config, refetch immediately
    gcTime: 5 * 60_000, // 5 minutes garbage collection
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    retry: 1, // Only retry once
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      logger.info('[useDraftConfig] Publishing draft');
      const response = await apiClient.publishDraft({ body: {} });

      if (response.status !== 200) {
        throw new Error(
          response.body && typeof response.body === 'object' && 'error' in response.body
            ? String(response.body.error)
            : 'Failed to publish draft'
        );
      }

      return response.body;
    },
    onSuccess: () => {
      // Invalidate to refetch fresh state
      // Fix #820: Add refetchType: 'active' for consistent behavior across all invalidations
      queryClient.invalidateQueries({
        queryKey: DRAFT_CONFIG_QUERY_KEY,
        refetchType: 'active',
      });
      logger.info('[useDraftConfig] Draft published successfully');
    },
    onError: (error) => {
      logger.error('[useDraftConfig] Publish failed', { error });
    },
  });

  // Discard mutation
  const discardMutation = useMutation({
    mutationFn: async () => {
      logger.info('[useDraftConfig] Discarding draft');
      const response = await apiClient.discardDraft({});

      if (response.status !== 200) {
        throw new Error(
          response.body && typeof response.body === 'object' && 'error' in response.body
            ? String(response.body.error)
            : 'Failed to discard draft'
        );
      }

      return response.body;
    },
    onSuccess: () => {
      // Invalidate to refetch fresh state
      // Fix #820: Add refetchType: 'active' for consistent behavior across all invalidations
      queryClient.invalidateQueries({
        queryKey: DRAFT_CONFIG_QUERY_KEY,
        refetchType: 'active',
      });
      logger.info('[useDraftConfig] Draft discarded successfully');
    },
    onError: (error) => {
      logger.error('[useDraftConfig] Discard failed', { error });
    },
  });

  // Invalidate cache (for external callers like agent tool handlers)
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: DRAFT_CONFIG_QUERY_KEY });
  }, [queryClient]);

  // Refetch wrapper
  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  // Publish wrapper
  const publishDraft = useCallback(async () => {
    await publishMutation.mutateAsync();
  }, [publishMutation]);

  // Discard wrapper
  const discardDraft = useCallback(async () => {
    await discardMutation.mutateAsync();
  }, [discardMutation]);

  return {
    config: query.data?.pages ?? DEFAULT_PAGES_CONFIG,
    hasDraft: query.data?.hasDraft ?? false,
    version: query.data?.version ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
    publishDraft,
    discardDraft,
    isPublishing: publishMutation.isPending,
    isDiscarding: discardMutation.isPending,
    invalidate,
  };
}

// ============================================
// EXTERNAL ACCESS FOR AGENT TOOLS
// ============================================

/**
 * Module-level QueryClient Reference
 *
 * This singleton pattern allows external code (agent tool handlers) to invalidate
 * the draft config cache without needing React context access.
 *
 * Agent tool handlers need to invalidate the draft config cache after making
 * modifications. Since they run outside React, we provide a way to store and
 * access the query client.
 *
 * DESIGN RATIONALE:
 * - Agent tool handlers execute outside React component tree
 * - They need to trigger cache invalidation after modifying draft config
 * - This pattern provides that bridge without complex context drilling
 *
 * LIMITATIONS (acknowledged and acceptable):
 * - After HMR in development, the ref may briefly point to an old client
 *   → Impact: Cache invalidation may silently fail once, UI shows stale data
 *   → Recovery: Next user action or page refresh resolves it
 *
 * - Multiple QueryClientProvider instances could cause issues
 *   → Not expected in this app (single provider at root)
 *
 * The ref is set during component mount and stays valid for the app lifecycle.
 * This pattern is acceptable because:
 * 1. The app has a single QueryClientProvider at the root
 * 2. Cache invalidation failure is recoverable (UI shows stale data briefly)
 * 3. The alternative (context drilling through props) is significantly more complex
 */
let queryClientRef: QueryClient | null = null;

/**
 * Set the query client reference
 * Call this from a component that has access to useQueryClient
 */
export const setQueryClientRef = (client: QueryClient): void => {
  queryClientRef = client;
};

/**
 * Invalidate draft config from outside React
 * Call this after agent tools modify the draft configuration
 *
 * @example
 * // In agent response handler:
 * if (response.toolResults?.some(t => t.toolName.includes('update_section'))) {
 *   invalidateDraftConfig();
 * }
 */
export const invalidateDraftConfig = (): void => {
  if (queryClientRef) {
    queryClientRef.invalidateQueries({
      queryKey: DRAFT_CONFIG_QUERY_KEY,
      refetchType: 'active', // Force refetch even if query is inactive
    });
    logger.debug('[useDraftConfig] Externally invalidated draft config');
  } else {
    logger.warn('[useDraftConfig] Cannot invalidate - query client not set');
  }
};

/**
 * Get the query key for draft config
 * Useful for components that need to interact with the cache directly
 */
export const getDraftConfigQueryKey = (): readonly ['draft-config'] => {
  return DRAFT_CONFIG_QUERY_KEY;
};
