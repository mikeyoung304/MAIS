/**
 * useLandingPageEditor - React hook for managing landing page editor state
 *
 * Handles:
 * - Loading draft + published landing page config
 * - Autosave with 1s debounce and request batching
 * - Section toggle (enable/disable)
 * - Publish/discard draft changes
 * - localStorage draft recovery for browser crash protection (TODO-253)
 *
 * Race Condition Prevention (copied from useVisualEditor.ts):
 * Uses a batching strategy where all changes within the debounce window
 * are accumulated and sent as a single request. This prevents:
 * - Overlapping requests
 * - Out-of-order updates causing inconsistent state
 * - Partial saves when one request fails while another succeeds
 *
 * Draft Recovery (TODO-253):
 * Saves to localStorage immediately on every optimistic update.
 * On mount, compares localStorage timestamp with server draftUpdatedAt.
 * If local is fresher, shows recovery toast with "Restore" action.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';
import type {
  LandingPageConfig,
  LandingPageSections,
  HeroSectionConfig,
  SocialProofBarConfig,
  AboutSectionConfig,
  TestimonialsSectionConfig,
  AccommodationSectionConfig,
  GallerySectionConfig,
  FaqSectionConfig,
  FinalCtaSectionConfig,
} from '@macon/contracts';

// Section types for type-safe operations
export type SectionType = keyof LandingPageSections;

// Section config types union
export type SectionConfig =
  | HeroSectionConfig
  | SocialProofBarConfig
  | AboutSectionConfig
  | TestimonialsSectionConfig
  | AccommodationSectionConfig
  | GallerySectionConfig
  | FaqSectionConfig
  | FinalCtaSectionConfig;

// Draft state from API
interface LandingPageDraftState {
  draft: LandingPageConfig | null;
  published: LandingPageConfig | null;
  draftUpdatedAt: string | null;
  publishedAt: string | null;
}

// localStorage key for draft recovery (TODO-253)
const LOCAL_DRAFT_STORAGE_KEY = 'mais:landingPage:localDraft';

// Local draft backup structure
interface LocalDraftBackup {
  config: LandingPageConfig;
  savedAt: string; // ISO timestamp
}

/**
 * Save draft to localStorage immediately for crash recovery (TODO-253)
 * Fails silently on quota exceeded or other errors
 */
function saveLocalDraft(config: LandingPageConfig): void {
  try {
    const backup: LocalDraftBackup = {
      config,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(LOCAL_DRAFT_STORAGE_KEY, JSON.stringify(backup));
  } catch {
    // Fail silently - server save is the source of truth
    // This can happen if localStorage is full (5MB limit)
  }
}

/**
 * Load local draft backup from localStorage (TODO-253)
 */
function loadLocalDraft(): LocalDraftBackup | null {
  try {
    const stored = localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as LocalDraftBackup;
  } catch {
    return null;
  }
}

/**
 * Clear local draft from localStorage (TODO-253)
 */
function clearLocalDraft(): void {
  try {
    localStorage.removeItem(LOCAL_DRAFT_STORAGE_KEY);
  } catch {
    // Fail silently
  }
}

interface UseLandingPageEditorReturn {
  // State
  draftConfig: LandingPageConfig | null;
  publishedConfig: LandingPageConfig | null;
  loading: boolean;
  error: string | null;
  hasChanges: boolean;
  isSaving: boolean;
  isPublishing: boolean;

  // Actions
  loadConfig: () => Promise<void>;
  toggleSection: (section: SectionType, enabled: boolean) => void;
  updateSectionContent: <T extends SectionType>(
    section: T,
    content: Partial<LandingPageConfig[T]>
  ) => void;
  publishChanges: () => Promise<void>;
  discardChanges: () => Promise<void>;
}

/**
 * Main hook for landing page editor functionality
 */
export function useLandingPageEditor(): UseLandingPageEditorReturn {
  const [draftConfig, setDraftConfig] = useState<LandingPageConfig | null>(null);
  const [publishedConfig, setPublishedConfig] = useState<LandingPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Track pending saves for debouncing (from useVisualEditor pattern)
  // Single timeout for batched saves to prevent race conditions
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  // Accumulated changes - merged before sending
  const pendingChanges = useRef<Partial<LandingPageConfig>>({});
  // Original state before optimistic updates for rollback
  const originalConfig = useRef<LandingPageConfig | null>(null);
  // Flag to track if a save is in progress
  const saveInProgress = useRef<boolean>(false);

  // Calculate if there are unsaved changes
  const hasChanges = draftConfig !== null;

  /**
   * Load draft and published config from API
   * Checks for localStorage recovery if local draft is fresher than server (TODO-253)
   */
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { status, body } = await api.getDraft();

      if (status !== 200 || !body) {
        const errorMessage =
          (body as { error?: string })?.error || `Failed to load config: ${status}`;
        throw new Error(errorMessage);
      }

      const draftState = body as LandingPageDraftState;
      setPublishedConfig(draftState.published);

      // Check for localStorage recovery (TODO-253)
      const localBackup = loadLocalDraft();
      if (localBackup) {
        const serverUpdatedAt = draftState.draftUpdatedAt
          ? new Date(draftState.draftUpdatedAt).getTime()
          : 0;
        const localUpdatedAt = new Date(localBackup.savedAt).getTime();

        // If local is fresher (saved after server version), offer recovery
        if (localUpdatedAt > serverUpdatedAt) {
          // Set server draft initially
          setDraftConfig(draftState.draft);

          // Show recovery toast with action button
          toast.info('Recovered unsaved changes', {
            description: 'Local changes were found from a previous session.',
            duration: 10000, // Show for 10 seconds
            action: {
              label: 'Restore',
              onClick: () => {
                setDraftConfig(localBackup.config);
                toast.success('Draft restored from local backup');
              },
            },
            onDismiss: () => {
              // User dismissed without restoring - clear local backup
              clearLocalDraft();
            },
          });
        } else {
          // Server is fresher or same - clear stale local backup
          clearLocalDraft();
          setDraftConfig(draftState.draft);
        }
      } else {
        setDraftConfig(draftState.draft);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load landing page config';
      setError(message);
      toast.error('Failed to load landing page', { description: message });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Flush all pending changes to the server
   * Sends batched updates as a single request
   *
   * Performance Note (TODO-250):
   * Currently sends full config (~50-100KB) on each save.
   * Target latency: 500ms. Actual: 200-300ms on good networks.
   * If monitoring shows >500ms latency, consider PATCH endpoints for
   * single-section updates. See ADR for details.
   */
  const flushPendingChanges = useCallback(async () => {
    // Skip if already saving or no changes
    if (saveInProgress.current || Object.keys(pendingChanges.current).length === 0) {
      return;
    }

    // Capture and clear pending changes atomically
    const changesToSave = { ...pendingChanges.current };
    const configToRestore = originalConfig.current;
    pendingChanges.current = {};
    originalConfig.current = null;

    saveInProgress.current = true;
    setIsSaving(true);

    // Performance monitoring for TODO-250 optimization decision
    const startTime = performance.now();

    try {
      // Merge changes into current draft config
      const mergedConfig: LandingPageConfig = {
        sections: {
          ...draftConfig?.sections,
          ...changesToSave.sections,
        },
        hero: changesToSave.hero ?? draftConfig?.hero,
        socialProofBar: changesToSave.socialProofBar ?? draftConfig?.socialProofBar,
        about: changesToSave.about ?? draftConfig?.about,
        testimonials: changesToSave.testimonials ?? draftConfig?.testimonials,
        accommodation: changesToSave.accommodation ?? draftConfig?.accommodation,
        gallery: changesToSave.gallery ?? draftConfig?.gallery,
        faq: changesToSave.faq ?? draftConfig?.faq,
        finalCta: changesToSave.finalCta ?? draftConfig?.finalCta,
      };

      const { status, body } = await api.saveDraft({ body: mergedConfig });

      if (status !== 200) {
        const errorMessage = (body as { error?: string })?.error || 'Failed to save draft';
        throw new Error(errorMessage);
      }

      // Draft saved successfully - update draft state and clear local backup (TODO-253)
      setDraftConfig(mergedConfig);
      clearLocalDraft();

      // Log save latency for performance monitoring (TODO-250)
      const duration = performance.now() - startTime;
      if (duration > 500) {
        logger.warn('Landing page save exceeded 500ms target', {
          component: 'useLandingPageEditor',
          durationMs: Math.round(duration),
          payloadSizeKb: Math.round(JSON.stringify(mergedConfig).length / 1024),
        });
      }
    } catch (err) {
      logger.error('Failed to save landing page draft', {
        component: 'useLandingPageEditor',
        error: err,
      });

      // Rollback to original state
      if (configToRestore) {
        setDraftConfig(configToRestore);
      }
      toast.error('Failed to save changes', { description: 'Reverted to last saved state' });
    } finally {
      saveInProgress.current = false;
      setIsSaving(false);
    }
  }, [draftConfig]);

  /**
   * Toggle a section on/off with 1s debounce and batching
   */
  const toggleSection = useCallback(
    (section: SectionType, enabled: boolean) => {
      // Clear existing timeout - we'll reschedule after accumulating this change
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
      }

      // Capture original state BEFORE first change
      if (!originalConfig.current) {
        originalConfig.current = draftConfig;
      }

      // Merge this update with pending changes
      pendingChanges.current = {
        ...pendingChanges.current,
        sections: {
          ...draftConfig?.sections,
          ...pendingChanges.current.sections,
          [section]: enabled,
        },
      };

      // Apply optimistic update to UI immediately
      setDraftConfig((prev) => {
        let newConfig: LandingPageConfig;
        if (!prev) {
          // Initialize with default sections if no draft exists
          newConfig = {
            sections: {
              hero: false,
              socialProofBar: false,
              segmentSelector: true,
              about: false,
              testimonials: false,
              accommodation: false,
              gallery: false,
              faq: false,
              finalCta: false,
              [section]: enabled,
            },
          };
        } else {
          newConfig = {
            ...prev,
            sections: {
              ...prev.sections,
              [section]: enabled,
            },
          };
        }
        // Save to localStorage immediately for crash recovery (TODO-253)
        saveLocalDraft(newConfig);
        return newConfig;
      });

      // Schedule batched save after debounce window
      saveTimeout.current = setTimeout(() => {
        saveTimeout.current = null;
        flushPendingChanges();
      }, 1000);
    },
    [draftConfig, flushPendingChanges]
  );

  /**
   * Update section content with 1s debounce and batching
   */
  const updateSectionContent = useCallback(
    <T extends SectionType>(section: T, content: Partial<LandingPageConfig[T]>) => {
      // Clear existing timeout
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
      }

      // Capture original state BEFORE first change
      if (!originalConfig.current) {
        originalConfig.current = draftConfig;
      }

      // Merge this update with pending changes
      const existingSection = pendingChanges.current[section] ?? draftConfig?.[section] ?? {};
      pendingChanges.current = {
        ...pendingChanges.current,
        [section]: {
          ...existingSection,
          ...content,
        },
      };

      // Apply optimistic update to UI immediately
      setDraftConfig((prev) => {
        if (!prev) return prev;
        const newConfig = {
          ...prev,
          [section]: {
            ...prev[section],
            ...content,
          },
        };
        // Save to localStorage immediately for crash recovery (TODO-253)
        saveLocalDraft(newConfig);
        return newConfig;
      });

      // Schedule batched save after debounce window
      saveTimeout.current = setTimeout(() => {
        saveTimeout.current = null;
        flushPendingChanges();
      }, 1000);
    },
    [draftConfig, flushPendingChanges]
  );

  /**
   * Publish all drafts to live
   */
  const publishChanges = useCallback(async () => {
    if (!hasChanges) {
      toast.info('No changes to publish');
      return;
    }

    // Lock UI early to prevent new edits during publish process
    setIsPublishing(true);

    // Flush any pending changes first
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    await flushPendingChanges();

    try {
      const { status, body } = await api.publishDraft({ body: {} });

      if (status !== 200) {
        const errorMessage = (body as { error?: string })?.error || 'Failed to publish changes';
        throw new Error(errorMessage);
      }

      toast.success('Landing page published');

      // Clear local backup on successful publish (TODO-253)
      clearLocalDraft();

      // Reload config to get fresh state
      await loadConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish changes';
      toast.error('Failed to publish changes', { description: message });
    } finally {
      setIsPublishing(false);
    }
  }, [hasChanges, loadConfig, flushPendingChanges]);

  /**
   * Discard all drafts without publishing
   */
  const discardChanges = useCallback(async () => {
    if (!hasChanges) {
      toast.info('No changes to discard');
      return;
    }

    // Clear any pending saves without flushing (we're discarding)
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    pendingChanges.current = {};
    originalConfig.current = null;

    // Clear local backup immediately since we're discarding (TODO-253)
    clearLocalDraft();

    try {
      const { status, body } = await api.discardDraft();

      if (status !== 200) {
        const errorMessage = (body as { error?: string })?.error || 'Failed to discard changes';
        throw new Error(errorMessage);
      }

      toast.success('Changes discarded');

      // Reload config to get fresh state
      await loadConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to discard changes';
      toast.error('Failed to discard changes', { description: message });
    }
  }, [hasChanges, loadConfig]);

  // Cleanup pending saves on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
      }
      pendingChanges.current = {};
      originalConfig.current = null;
    };
  }, []);

  // Flush on tab blur/close (TODO-254)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && Object.keys(pendingChanges.current).length > 0) {
        flushPendingChanges();
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pendingChanges.current).length > 0) {
        flushPendingChanges();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flushPendingChanges]);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    draftConfig,
    publishedConfig,
    loading,
    error,
    hasChanges,
    isSaving,
    isPublishing,
    loadConfig,
    toggleSection,
    updateSectionContent,
    publishChanges,
    discardChanges,
  };
}
