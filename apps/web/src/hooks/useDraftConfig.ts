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
}

/**
 * Return type for useDraftConfig hook
 */
interface UseDraftConfigResult {
  /** Current pages configuration (draft or live) */
  config: PagesConfig;
  /** Whether there's an unpublished draft */
  hasDraft: boolean;
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
          // API returns: { draft, published, draftUpdatedAt, publishedAt }
          // draft and published are LandingPageConfig objects with { pages, branding, ... }
          // Prefer draft over published, with fallback to defaults
          const hasDraft = body.draft !== null;
          const config = body.draft || body.published;
          const pages = config?.pages || DEFAULT_PAGES_CONFIG;

          return {
            pages,
            hasDraft,
            draftUpdatedAt: body.draftUpdatedAt ?? undefined,
          };
        }

        // 404 means tenant not found or no config
        if (response.status === 404) {
          logger.debug('[useDraftConfig] No config found, using defaults');
          return { pages: DEFAULT_PAGES_CONFIG, hasDraft: false };
        }

        // Other errors - fallback to defaults
        logger.warn('[useDraftConfig] Unexpected response, using defaults', {
          status: response.status,
        });
        return { pages: DEFAULT_PAGES_CONFIG, hasDraft: false };
      } catch (error) {
        logger.error('[useDraftConfig] Failed to fetch draft', { error });
        throw error;
      }
    },
    staleTime: 30_000, // 30 seconds - draft doesn't change often except via agent
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
      queryClient.invalidateQueries({ queryKey: DRAFT_CONFIG_QUERY_KEY });
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
      queryClient.invalidateQueries({ queryKey: DRAFT_CONFIG_QUERY_KEY });
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
 * Query client reference for external invalidation
 *
 * Agent tool handlers need to invalidate the draft config cache
 * after making modifications. Since they run outside React,
 * we provide a way to store and access the query client.
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
    queryClientRef.invalidateQueries({ queryKey: DRAFT_CONFIG_QUERY_KEY });
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
