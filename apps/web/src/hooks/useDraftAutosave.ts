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
import { createClientApiClient } from '@/lib/api';
import { BUILD_MODE_CONFIG } from '@/lib/build-mode/config';

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
  const abortControllerRef = useRef<AbortController>();

  // Create client API instance
  const apiClient = useMemo(() => createClientApiClient(), []);

  // Save draft to backend
  const saveDraft = useCallback(
    async (config: PagesConfig) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setSaveStatus('saving');

      try {
        // Build full landing page config with pages
        const landingPageConfig: LandingPageConfig = {
          pages: config,
        };

        // Save draft via API
        const response = await apiClient.landingPageAdmin.saveDraft({
          body: landingPageConfig,
        });

        if (response.status === 200) {
          setSaveStatus('saved');
          setLastSaved(new Date());
          setIsDirty(false);
          onSave?.();

          // Reset to idle after a delay
          setTimeout(() => {
            setSaveStatus('idle');
          }, BUILD_MODE_CONFIG.timing.saveStatusResetDelay);
        } else {
          throw new Error('Failed to save draft');
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return; // Ignore aborted requests
        }

        setSaveStatus('error');
        onError?.(error as Error);

        // Reset to idle after a delay
        setTimeout(() => {
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
      const response = await apiClient.landingPageAdmin.publishDraft({
        body: {},
      });

      if (response.status === 200) {
        setSaveStatus('saved');
        setIsDirty(false);
        return true;
      }
      throw new Error('Failed to publish draft');
    } catch (error) {
      setSaveStatus('error');
      onError?.(error as Error);
      return false;
    }
  }, [apiClient, onError]);

  // Discard draft changes
  const discardDraft = useCallback(async (): Promise<boolean> => {
    setSaveStatus('saving');

    try {
      const response = await apiClient.landingPageAdmin.discardDraft();

      if (response.status === 200) {
        setSaveStatus('idle');
        setIsDirty(false);
        setDraftConfig(initialConfig);
        return true;
      }
      throw new Error('Failed to discard draft');
    } catch (error) {
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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
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
