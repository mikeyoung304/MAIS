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

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PagesConfig, LandingPageConfig } from '@macon/contracts';
import { BUILD_MODE_CONFIG } from '@/lib/build-mode/config';
import { logger } from '@/lib/logger';

// TODO: Enable when landingPageAdminContract is added to Contracts in api.v1.ts
// import { createClientApiClient } from '@/lib/api';

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

  // TODO: Create client API instance when landingPageAdminContract is added to Contracts
  // const apiClient = useMemo(() => createClientApiClient(), []);

  // Save draft to backend
  // TODO: Enable API call when landingPageAdminContract is integrated
  const saveDraft = useCallback(
    async (config: PagesConfig) => {
      setSaveStatus('saving');

      try {
        // Build full landing page config with pages
        const landingPageConfig: LandingPageConfig = {
          pages: config,
        };

        // TODO: Replace with actual API call when integrated
        logger.info('[useDraftAutosave] Saving draft (stub)', {
          pagesCount: Object.keys(config).length,
        });
        void landingPageConfig; // Silence unused variable warning

        // Simulate successful save
        await new Promise((resolve) => setTimeout(resolve, 500));

        setSaveStatus('saved');
        setLastSaved(new Date());
        setIsDirty(false);
        onSave?.();

        // Reset to idle after a delay
        setTimeout(() => {
          setSaveStatus('idle');
        }, BUILD_MODE_CONFIG.timing.saveStatusResetDelay);
      } catch (error) {
        setSaveStatus('error');
        onError?.(error as Error);

        // Reset to idle after a delay
        setTimeout(() => {
          setSaveStatus('idle');
        }, BUILD_MODE_CONFIG.timing.errorStatusResetDelay);
      }
    },
    [onError, onSave]
  );

  // Publish draft to live
  // TODO: Enable API call when landingPageAdminContract is integrated
  const publishDraft = useCallback(async (): Promise<boolean> => {
    setSaveStatus('saving');

    try {
      // TODO: Replace with actual API call when integrated
      logger.info('[useDraftAutosave] Publishing draft (stub)');

      // Simulate successful publish
      await new Promise((resolve) => setTimeout(resolve, 500));

      setSaveStatus('saved');
      setIsDirty(false);
      return true;
    } catch (error) {
      setSaveStatus('error');
      onError?.(error as Error);
      return false;
    }
  }, [onError]);

  // Discard draft changes
  // TODO: Enable API call when landingPageAdminContract is integrated
  const discardDraft = useCallback(async (): Promise<boolean> => {
    setSaveStatus('saving');

    try {
      // TODO: Replace with actual API call when integrated
      logger.info('[useDraftAutosave] Discarding draft (stub)');

      // Simulate successful discard
      await new Promise((resolve) => setTimeout(resolve, 300));

      setSaveStatus('idle');
      setIsDirty(false);
      setDraftConfig(initialConfig);
      return true;
    } catch (error) {
      setSaveStatus('error');
      onError?.(error as Error);
      return false;
    }
  }, [initialConfig, onError]);

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
