'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { PagesConfig, PageName } from '@macon/contracts';
import { parseParentMessage, sendToParent, isSameOrigin } from '@/lib/build-mode/protocol';

interface UseBuildModeSyncOptions {
  /** Whether this component should listen for Build Mode messages */
  enabled?: boolean;
  /** Initial pages config (used if not in Build Mode) */
  initialConfig?: PagesConfig | null;
  /** Callback when config changes */
  onConfigChange?: (config: PagesConfig) => void;
}

interface UseBuildModeSyncResult {
  /** Whether we're in Build Mode (in iframe with parent communication) */
  isEditMode: boolean;

  /** Current draft config (may be updated by parent) */
  draftConfig: PagesConfig | null;

  /** Currently highlighted section index */
  highlightedSection: number | null;

  /** Whether Build Mode is ready (handshake completed) */
  isReady: boolean;

  /** Whether handshake timed out */
  hasTimedOut: boolean;

  /** Notify parent of section selection */
  selectSection: (pageId: PageName, sectionIndex: number) => void;

  /** Notify parent of inline text edit */
  editSection: (pageId: PageName, sectionIndex: number, field: string, value: string) => void;

  /** Notify parent of page navigation */
  notifyPageChange: (pageId: PageName) => void;
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
  onConfigChange,
}: UseBuildModeSyncOptions = {}): UseBuildModeSyncResult {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftConfig, setDraftConfig] = useState<PagesConfig | null>(initialConfig);
  const [highlightedSection, setHighlightedSection] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const onConfigChangeRef = useRef(onConfigChange);

  // Keep callback ref up to date
  useEffect(() => {
    onConfigChangeRef.current = onConfigChange;
  }, [onConfigChange]);

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
          if (sectionByIdEl) {
            // Get the section index for the highlight state
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
          break;
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

  return {
    isEditMode,
    draftConfig,
    highlightedSection,
    isReady,
    hasTimedOut,
    selectSection,
    editSection,
    notifyPageChange,
  };
}
