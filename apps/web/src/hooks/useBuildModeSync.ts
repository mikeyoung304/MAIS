'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { PagesConfig, PageName, SectionContentDto, BlockType } from '@macon/contracts';
import { parseParentMessage, sendToParent, isSameOrigin } from '@/lib/build-mode/protocol';

/**
 * Section update data from BUILD_MODE_SECTION_UPDATE message
 */
export interface SectionUpdateData {
  sectionId: string;
  blockType: BlockType;
  content: unknown;
  action: 'create' | 'update' | 'delete';
  pageName?: string;
  order?: number;
}

/**
 * Publish notification data from BUILD_MODE_PUBLISH_NOTIFICATION message
 */
export interface PublishNotificationData {
  sectionId?: string;
  publishedAt: string;
  publishedCount?: number;
}

interface UseBuildModeSyncOptions {
  /** Whether this component should listen for Build Mode messages */
  enabled?: boolean;
  /** Initial pages config (used if not in Build Mode) */
  initialConfig?: PagesConfig | null;
  /** Initial sections (for section-based rendering) */
  initialSections?: SectionContentDto[] | null;
  /** Callback when config changes (legacy full-config updates) */
  onConfigChange?: (config: PagesConfig) => void;
  /** Callback when a single section updates (Phase 4 granular updates) */
  onSectionUpdate?: (data: SectionUpdateData) => void;
  /** Callback when sections are published */
  onPublishNotification?: (data: PublishNotificationData) => void;
}

interface UseBuildModeSyncResult {
  /** Whether we're in Build Mode (in iframe with parent communication) */
  isEditMode: boolean;

  /** Current draft config (may be updated by parent) */
  draftConfig: PagesConfig | null;

  /** Current sections array (Phase 4 section-based state) */
  sections: SectionContentDto[] | null;

  /** Currently highlighted section index */
  highlightedSection: number | null;

  /** Currently highlighted section ID (for ID-based highlighting) */
  highlightedSectionId: string | null;

  /** Whether Build Mode is ready (handshake completed) */
  isReady: boolean;

  /** Whether handshake timed out */
  hasTimedOut: boolean;

  /** Whether there are unpublished changes */
  hasDraft: boolean;

  /** Last publish timestamp (if any) */
  lastPublishedAt: string | null;

  /** Notify parent of section selection */
  selectSection: (pageId: PageName, sectionIndex: number) => void;

  /** Notify parent of inline text edit */
  editSection: (pageId: PageName, sectionIndex: number, field: string, value: string) => void;

  /** Notify parent of page navigation */
  notifyPageChange: (pageId: PageName) => void;

  /** Notify parent that a section has finished rendering (Phase 4) */
  notifySectionRendered: (sectionId: string, blockType: string, renderTime?: number) => void;
}

/**
 * useBuildModeSync - Hook for storefront pages to sync with Build Mode
 *
 * Handles:
 * - Detecting if running in Build Mode iframe
 * - Receiving config updates from parent
 * - Sending edit events to parent
 * - Managing highlighted section state
 *
 * Usage in storefront page:
 * ```tsx
 * const { isEditMode, draftConfig, highlightedSection, selectSection } = useBuildModeSync({
 *   enabled: isPreviewMode,
 *   initialConfig: tenant.landingPageConfig?.pages,
 * });
 *
 * // Use draftConfig ?? initialConfig for rendering
 * const config = isEditMode ? draftConfig : initialConfig;
 * ```
 */
/** Timeout for PostMessage handshake in milliseconds */
const HANDSHAKE_TIMEOUT_MS = 5000;

/** Retry interval for re-sending BUILD_MODE_READY if no response */
const HANDSHAKE_RETRY_MS = 1000;

/** Max retries before giving up */
const HANDSHAKE_MAX_RETRIES = 4;

/**
 * Add visual feedback during config updates for fluid canvas feel
 */
function addUpdateFeedback() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-section-index]').forEach((el) => {
    el.classList.add('section-updating');
  });
}

/**
 * Remove updating state and show brief highlight on changed sections
 */
function removeUpdateFeedback() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-section-index]').forEach((el) => {
    el.classList.remove('section-updating');
    el.classList.add('section-updated');
  });
  // Remove the updated class after animation completes
  setTimeout(() => {
    document.querySelectorAll('[data-section-index]').forEach((el) => {
      el.classList.remove('section-updated');
    });
  }, 600);
}

export function useBuildModeSync({
  enabled = true,
  initialConfig = null,
  initialSections = null,
  onConfigChange,
  onSectionUpdate,
  onPublishNotification,
}: UseBuildModeSyncOptions = {}): UseBuildModeSyncResult {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftConfig, setDraftConfig] = useState<PagesConfig | null>(initialConfig);
  const [sections, setSections] = useState<SectionContentDto[] | null>(initialSections);
  const [highlightedSection, setHighlightedSection] = useState<number | null>(null);
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);

  // Refs for callbacks to avoid stale closures
  const onConfigChangeRef = useRef(onConfigChange);
  const onSectionUpdateRef = useRef(onSectionUpdate);
  const onPublishNotificationRef = useRef(onPublishNotification);

  // Keep callback refs up to date
  useEffect(() => {
    onConfigChangeRef.current = onConfigChange;
  }, [onConfigChange]);

  useEffect(() => {
    onSectionUpdateRef.current = onSectionUpdate;
  }, [onSectionUpdate]);

  useEffect(() => {
    onPublishNotificationRef.current = onPublishNotification;
  }, [onPublishNotification]);

  // Check if we're in an iframe with edit query param
  // Implements retry logic for robust handshake with parent
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const isInIframe = window.parent !== window;
    const hasEditParam = params.get('edit') === 'true';

    if (isInIframe && hasEditParam) {
      setIsEditMode(true);

      // Send ready message to parent with retry logic
      // Parent may not be ready to receive immediately after iframe loads
      let retryCount = 0;
      const sendReady = () => {
        if (isReady) return; // Stop retrying once connected
        sendToParent({ type: 'BUILD_MODE_READY' });
        retryCount++;
      };

      // Initial send
      sendReady();

      // Retry periodically until we get BUILD_MODE_INIT or max retries
      const retryInterval = setInterval(() => {
        if (isReady || retryCount >= HANDSHAKE_MAX_RETRIES) {
          clearInterval(retryInterval);
          return;
        }
        sendReady();
      }, HANDSHAKE_RETRY_MS);

      return () => clearInterval(retryInterval);
    }
  }, [enabled, isReady]);

  // Timeout for handshake - if we're in edit mode but not ready within timeout, show error
  useEffect(() => {
    if (!isEditMode || isReady) return;

    const timeoutId = setTimeout(() => {
      if (!isReady) {
        setHasTimedOut(true);
      }
    }, HANDSHAKE_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [isEditMode, isReady]);

  // Listen for messages from parent
  useEffect(() => {
    if (!enabled || !isEditMode) return;

    const handleMessage = (event: MessageEvent) => {
      // Security: validate origin
      if (!isSameOrigin(event.origin)) return;

      // Parse and validate message
      const message = parseParentMessage(event.data);
      if (!message) return;

      switch (message.type) {
        case 'BUILD_MODE_INIT':
          setDraftConfig(message.data.draftConfig);
          setIsReady(true);
          onConfigChangeRef.current?.(message.data.draftConfig);
          break;

        case 'BUILD_MODE_CONFIG_UPDATE':
          // Add visual feedback for fluid canvas feel
          addUpdateFeedback();
          setDraftConfig(message.data.config);
          onConfigChangeRef.current?.(message.data.config);
          // Remove feedback after React re-render settles
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              removeUpdateFeedback();
            });
          });
          break;

        case 'BUILD_MODE_HIGHLIGHT_SECTION': {
          setHighlightedSection(message.data.sectionIndex);
          // Scroll section into view
          const sectionEl = document.querySelector(
            `[data-section-index="${message.data.sectionIndex}"]`
          );
          sectionEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }

        case 'BUILD_MODE_HIGHLIGHT_SECTION_BY_ID': {
          // ID-based highlighting - find section by data-section-id attribute
          const sectionByIdEl = document.querySelector(
            `[data-section-id="${message.data.sectionId}"]`
          );
          // Always set the section ID for ID-based state
          setHighlightedSectionId(message.data.sectionId);
          if (sectionByIdEl) {
            // Get the section index for the highlight state (backward compat)
            const indexAttr = sectionByIdEl.getAttribute('data-section-index');
            const sectionIndex = indexAttr ? parseInt(indexAttr, 10) : null;
            if (sectionIndex !== null && !isNaN(sectionIndex)) {
              setHighlightedSection(sectionIndex);
            }
            // Scroll section into view
            sectionByIdEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          break;
        }

        case 'BUILD_MODE_CLEAR_HIGHLIGHT':
          setHighlightedSection(null);
          setHighlightedSectionId(null);
          break;

        case 'BUILD_MODE_SECTION_UPDATE': {
          // Phase 4: Granular section update
          const updateData: SectionUpdateData = {
            sectionId: message.data.sectionId,
            blockType: message.data.blockType,
            content: message.data.content,
            action: message.data.action,
            pageName: message.data.pageName,
            order: message.data.order,
          };

          // Update local sections state
          setSections((prev) => {
            if (!prev) return prev;

            switch (updateData.action) {
              case 'create': {
                // Add new section at the right position
                const newSection: SectionContentDto = {
                  id: updateData.sectionId,
                  tenantId: '', // Will be filled by parent
                  segmentId: null,
                  blockType: updateData.blockType,
                  pageName: updateData.pageName || 'home',
                  content: updateData.content,
                  order: updateData.order ?? prev.length,
                  isDraft: true,
                  publishedAt: null,
                  versions: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                return [...prev, newSection].sort((a, b) => a.order - b.order);
              }

              case 'update':
                return prev.map((s) =>
                  s.id === updateData.sectionId
                    ? {
                        ...s,
                        content: updateData.content,
                        isDraft: true,
                        updatedAt: new Date().toISOString(),
                      }
                    : s
                );

              case 'delete':
                return prev.filter((s) => s.id !== updateData.sectionId);

              default:
                return prev;
            }
          });

          // Mark as having drafts
          setHasDraft(true);

          // Add visual feedback for the specific section
          const sectionEl = document.querySelector(`[data-section-id="${message.data.sectionId}"]`);
          if (sectionEl) {
            sectionEl.classList.add('section-updating');
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                sectionEl.classList.remove('section-updating');
                sectionEl.classList.add('section-updated');
                setTimeout(() => {
                  sectionEl.classList.remove('section-updated');
                }, 600);
              });
            });
          }

          // Notify callback
          onSectionUpdateRef.current?.(updateData);
          break;
        }

        case 'BUILD_MODE_PUBLISH_NOTIFICATION': {
          // Phase 4: Sections published
          const publishData: PublishNotificationData = {
            sectionId: message.data.sectionId,
            publishedAt: message.data.publishedAt,
            publishedCount: message.data.publishedCount,
          };

          // Update sections state - mark as published
          setSections((prev) => {
            if (!prev) return prev;

            if (publishData.sectionId) {
              // Single section published
              return prev.map((s) =>
                s.id === publishData.sectionId
                  ? { ...s, isDraft: false, publishedAt: publishData.publishedAt }
                  : s
              );
            } else {
              // All sections published
              return prev.map((s) => ({
                ...s,
                isDraft: false,
                publishedAt: publishData.publishedAt,
              }));
            }
          });

          // Update draft state
          if (!publishData.sectionId) {
            // All published - no more drafts
            setHasDraft(false);
          }

          setLastPublishedAt(publishData.publishedAt);

          // Notify callback
          onPublishNotificationRef.current?.(publishData);
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [enabled, isEditMode]);

  // Notify parent of section selection
  const selectSection = useCallback(
    (pageId: PageName, sectionIndex: number) => {
      if (!isEditMode) return;
      sendToParent({
        type: 'BUILD_MODE_SECTION_SELECTED',
        data: { pageId, sectionIndex },
      });
    },
    [isEditMode]
  );

  // Notify parent of inline text edit
  const editSection = useCallback(
    (pageId: PageName, sectionIndex: number, field: string, value: string) => {
      if (!isEditMode) return;
      sendToParent({
        type: 'BUILD_MODE_SECTION_EDIT',
        data: { pageId, sectionIndex, field, value },
      });
    },
    [isEditMode]
  );

  // Notify parent of page navigation
  const notifyPageChange = useCallback(
    (pageId: PageName) => {
      if (!isEditMode) return;
      sendToParent({
        type: 'BUILD_MODE_PAGE_CHANGE',
        data: { pageId },
      });
    },
    [isEditMode]
  );

  // Notify parent that a section has finished rendering (Phase 4)
  const notifySectionRendered = useCallback(
    (sectionId: string, blockType: string, renderTime?: number) => {
      if (!isEditMode) return;
      sendToParent({
        type: 'BUILD_MODE_SECTION_RENDERED',
        data: { sectionId, blockType, renderTime },
      });
    },
    [isEditMode]
  );

  return {
    isEditMode,
    draftConfig,
    sections,
    highlightedSection,
    highlightedSectionId,
    isReady,
    hasTimedOut,
    hasDraft,
    lastPublishedAt,
    selectSection,
    editSection,
    notifyPageChange,
    notifySectionRendered,
  };
}
