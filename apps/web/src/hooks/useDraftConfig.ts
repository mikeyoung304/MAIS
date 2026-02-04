/**
 * useDraftConfig - TanStack Query hook for draft configuration state
 *
 * Phase 5.2 Migration: This hook now delegates to useSectionsDraft which
 * fetches from the SectionContent table instead of the legacy JSON column.
 * The external interface remains unchanged for backward compatibility.
 *
 * Provides:
 * - Fetching current draft state from the API (via sections endpoint)
 * - Cache invalidation when agent tools modify config
 * - Loading and error states
 * - Derived hasDraft state
 *
 * This hook is used by:
 * - ContentArea to determine what preview to show
 * - PreviewPanel to display current draft
 * - Agent tool handlers (via invalidateDraftConfig) to refresh after modifications
 *
 * @see useSectionsDraft.ts for the underlying section-based implementation
 * @see stores/agent-ui-store.ts for UI state management
 */

'use client';

import { useQueryClient, QueryClient } from '@tanstack/react-query';
import { type PagesConfig } from '@macon/contracts';
import { logger } from '@/lib/logger';
import { useEffect } from 'react';
import {
  useSectionsDraft,
  setSectionsQueryClientRef,
  invalidateSectionsDraft,
  getSectionsDraftQueryKey,
  type SectionEntity,
} from './useSectionsDraft';

// ============================================
// TYPES
// ============================================

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
  /** Raw section entities for direct access (Phase 5.2 addition) */
  sections?: SectionEntity[];
  /** Find a section by ID (Phase 5.2 addition) */
  findSectionById?: (sectionId: string) => SectionEntity | undefined;
}

// ============================================
// QUERY KEY (for backward compatibility)
// ============================================

const DRAFT_CONFIG_QUERY_KEY = ['draft-config'] as const;

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useDraftConfig(): UseDraftConfigResult {
  const queryClient = useQueryClient();

  // Delegate to the new section-based hook
  const sectionsDraft = useSectionsDraft();

  // Set up the query client reference for external access
  useEffect(() => {
    setSectionsQueryClientRef(queryClient);
    // Also set legacy ref for any code still using it
    setQueryClientRef(queryClient);
  }, [queryClient]);

  return {
    config: sectionsDraft.config,
    hasDraft: sectionsDraft.hasDraft,
    version: sectionsDraft.version,
    isLoading: sectionsDraft.isLoading,
    error: sectionsDraft.error,
    refetch: sectionsDraft.refetch,
    publishDraft: sectionsDraft.publishDraft,
    discardDraft: sectionsDraft.discardDraft,
    isPublishing: sectionsDraft.isPublishing,
    isDiscarding: sectionsDraft.isDiscarding,
    invalidate: sectionsDraft.invalidate,
    // Phase 5.2 additions for direct section access
    sections: sectionsDraft.sections,
    findSectionById: sectionsDraft.findSectionById,
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
 * Phase 5.2: Now delegates to invalidateSectionsDraft() which invalidates
 * the sections-based cache.
 *
 * @example
 * // In agent response handler:
 * if (response.toolResults?.some(t => t.toolName.includes('update_section'))) {
 *   invalidateDraftConfig();
 * }
 */
export const invalidateDraftConfig = (): void => {
  // Invalidate the new sections-based cache
  invalidateSectionsDraft();

  // Also invalidate legacy cache key for any code still using it
  if (queryClientRef) {
    queryClientRef.invalidateQueries({
      queryKey: DRAFT_CONFIG_QUERY_KEY,
      refetchType: 'active',
    });
    logger.debug('[useDraftConfig] Externally invalidated draft config (both caches)');
  } else {
    logger.warn('[useDraftConfig] Cannot invalidate legacy cache - query client not set');
  }
};

/**
 * Get the query key for draft config
 * Useful for components that need to interact with the cache directly
 *
 * Phase 5.2: Returns the new sections-based query key
 */
export const getDraftConfigQueryKey = (): readonly ['sections-draft'] => {
  return getSectionsDraftQueryKey();
};
