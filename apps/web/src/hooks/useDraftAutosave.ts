'use client';

/**
 * useDraftAutosave - Auto-save draft config to backend
 *
 * Handles:
 * - Debounced saves to prevent excessive API calls
 * - Optimistic updates with rollback on failure
 * - Save status tracking (saving, saved, error)
 * - Last saved timestamp
 *
 * Usage:
 * ```tsx
 * const { saveStatus, lastSaved, saveDraft, isDirty } = useDraftAutosave({
 *   tenantId,
 *   onError: (error) => toast.error('Failed to save'),
 * });
 * ```
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { PagesConfig, LandingPageConfig } from '@macon/contracts';
import { BUILD_MODE_CONFIG } from '@/lib/build-mode/config';
import { logger } from '@/lib/logger';
import { createClientApiClient } from '@/lib/api';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseDraftAutosaveOptions {
  /** Initial config to compare for dirty state */
  initialConfig?: PagesConfig | null;
  /** Debounce delay in ms (default: 1000) */
  debounceMs?: number;
  /** Callback on save error */
  onError?: (error: Error) => void;
  /** Callback on successful save */
  onSave?: () => void;
}

interface UseDraftAutosaveResult {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Last successful save timestamp */
  lastSaved: Date | null;
  /** Whether config has unsaved changes */
  isDirty: boolean;
  /** Current draft config */
  draftConfig: PagesConfig | null;
  /** Save draft immediately */
  saveDraft: (config: PagesConfig) => Promise<void>;
  /** Queue a draft save (debounced) */
  queueSave: (config: PagesConfig) => void;
  /** Mark config as dirty */
  setDirty: (dirty: boolean) => void;
  /** Update draft config locally */
  updateDraft: (config: PagesConfig) => void;
  /** Publish draft to live */
  publishDraft: () => Promise<boolean>;
  /** Discard draft changes */
  discardDraft: () => Promise<boolean>;
}

export function useDraftAutosave({
  initialConfig = null,
  debounceMs = BUILD_MODE_CONFIG.timing.debounce.autosave,
  onError,
  onSave,
}: UseDraftAutosaveOptions = {}): UseDraftAutosaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [draftConfig, setDraftConfig] = useState<PagesConfig | null>(initialConfig);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const statusResetRef = useRef<ReturnType<typeof setTimeout>>();

  // Create API client instance
  const apiClient = useMemo(() => createClientApiClient(), []);

  // Save draft to backend
  const saveDraft = useCallback(
    async (config: PagesConfig) => {
      setSaveStatus('saving');

      try {
        // Build full landing page config with pages
        const landingPageConfig: LandingPageConfig = {
          pages: config,
        };

        logger.info('[useDraftAutosave] Saving draft', {
          pagesCount: Object.keys(config).length,
        });

        // Call the API to save draft
        const response = await apiClient.saveDraft({
          body: landingPageConfig,
        });

        if (response.status !== 200) {
          throw new Error(
            response.body && typeof response.body === 'object' && 'error' in response.body
              ? String(response.body.error)
              : 'Failed to save draft'
          );
        }

        setSaveStatus('saved');
        setLastSaved(new Date(response.body.draftUpdatedAt));
        setIsDirty(false);
        onSave?.();

        // Reset to idle after a delay (clear previous timeout first)
        if (statusResetRef.current) clearTimeout(statusResetRef.current);
        statusResetRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, BUILD_MODE_CONFIG.timing.saveStatusResetDelay);
      } catch (error) {
        logger.error('[useDraftAutosave] Save failed', { error });
        setSaveStatus('error');
        onError?.(error as Error);

        // Reset to idle after a delay (clear previous timeout first)
        if (statusResetRef.current) clearTimeout(statusResetRef.current);
        statusResetRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, BUILD_MODE_CONFIG.timing.errorStatusResetDelay);
      }
    },
    [apiClient, onError, onSave]
  );

  // Publish draft to live
  const publishDraft = useCallback(async (): Promise<boolean> => {
    setSaveStatus('saving');

    try {
      logger.info('[useDraftAutosave] Publishing draft');

      // Call the API to publish draft
      const response = await apiClient.publishDraft({
        body: {},
      });

      if (response.status !== 200) {
        throw new Error(
          response.body && typeof response.body === 'object' && 'error' in response.body
            ? String(response.body.error)
            : 'Failed to publish draft'
        );
      }

      setSaveStatus('saved');
      setIsDirty(false);
      logger.info('[useDraftAutosave] Published successfully', {
        publishedAt: response.body.publishedAt,
      });
      return true;
    } catch (error) {
      logger.error('[useDraftAutosave] Publish failed', { error });
      setSaveStatus('error');
      onError?.(error as Error);
      return false;
    }
  }, [apiClient, onError]);

  // Discard draft changes
  const discardDraft = useCallback(async (): Promise<boolean> => {
    setSaveStatus('saving');

    try {
      logger.info('[useDraftAutosave] Discarding draft');

      // Call the API to discard draft (no body required for DELETE)
      const response = await apiClient.discardDraft({});

      if (response.status !== 200) {
        throw new Error(
          response.body && typeof response.body === 'object' && 'error' in response.body
            ? String(response.body.error)
            : 'Failed to discard draft'
        );
      }

      setSaveStatus('idle');
      setIsDirty(false);
      setDraftConfig(initialConfig);
      logger.info('[useDraftAutosave] Draft discarded successfully');
      return true;
    } catch (error) {
      logger.error('[useDraftAutosave] Discard failed', { error });
      setSaveStatus('error');
      onError?.(error as Error);
      return false;
    }
  }, [apiClient, initialConfig, onError]);

  // Queue a debounced save
  const queueSave = useCallback(
    (config: PagesConfig) => {
      setDraftConfig(config);
      setIsDirty(true);

      // Clear any pending debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Schedule new save
      debounceRef.current = setTimeout(() => {
        saveDraft(config);
      }, debounceMs);
    },
    [debounceMs, saveDraft]
  );

  // Update draft locally without saving
  const updateDraft = useCallback((config: PagesConfig) => {
    setDraftConfig(config);
    setIsDirty(true);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (statusResetRef.current) {
        clearTimeout(statusResetRef.current);
      }
    };
  }, []);

  // Sync initial config changes
  useEffect(() => {
    if (initialConfig && !isDirty) {
      setDraftConfig(initialConfig);
    }
  }, [initialConfig, isDirty]);

  return {
    saveStatus,
    lastSaved,
    isDirty,
    draftConfig,
    saveDraft,
    queueSave,
    setDirty: setIsDirty,
    updateDraft,
    publishDraft,
    discardDraft,
  };
}
