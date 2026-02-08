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

  /** Currently highlighted section ID (for ID-based highlighting) */
  highlightedSectionId: string | null;

  /** Whether PostMessage channel is established (real-time updates available) */
  isReady: boolean;

  /** Notify parent of section selection */
  selectSection: (pageId: PageName, sectionIndex: number) => void;

  /** Notify parent of page navigation */
  notifyPageChange: (pageId: PageName) => void;
}

/**
 * useBuildModeSync - Hook for storefront pages to sync with Build Mode
 *
 * API-first strategy: iframe loads draft content from SSR (via ?preview=draft&token=JWT).
 * PostMessage is a non-blocking real-time update channel — not required for initial display.
 * If PostMessage never connects, user still sees their draft content.
 *
 * Handles:
 * - Detecting if running in Build Mode iframe
 * - Establishing PostMessage channel for real-time updates (non-blocking)
 * - Receiving config updates from parent
 * - Managing highlighted section state
 */

/**
 * Retry schedule for PostMessage channel establishment (absolute ms from mount).
 * Exponential backoff: if parent isn't ready at 500ms, try 1500ms, then 4000ms.
 * If all retries fail, real-time updates degrade gracefully — content still visible.
 */
const HANDSHAKE_RETRY_DELAYS = [500, 1500, 4000];

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
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Ref for callback to avoid stale closures
  const onConfigChangeRef = useRef(onConfigChange);
  // Track readiness via ref so scheduled retries don't need isReady as a dependency
  const isReadyRef = useRef(false);

  // Keep refs up to date
  useEffect(() => {
    onConfigChangeRef.current = onConfigChange;
  }, [onConfigChange]);

  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  // Detect edit mode and establish non-blocking PostMessage channel.
  // API-first: iframe already has draft content from SSR. This channel
  // enables real-time updates but is NOT required for initial display.
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const isInIframe = window.parent !== window;
    const hasEditParam = params.get('edit') === 'true';

    if (!isInIframe || !hasEditParam) return;

    setIsEditMode(true);

    // Schedule BUILD_MODE_READY at exponential backoff intervals.
    // Each retry checks isReadyRef — once parent responds with BUILD_MODE_INIT,
    // remaining retries become no-ops.
    const timeouts = HANDSHAKE_RETRY_DELAYS.map((delay) =>
      setTimeout(() => {
        if (!isReadyRef.current) {
          sendToParent({ type: 'BUILD_MODE_READY' });
        }
      }, delay)
    );

    return () => timeouts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

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

        case 'BUILD_MODE_HIGHLIGHT_SECTION_BY_ID': {
          // ID-based highlighting - find section by data-section-id attribute
          // Fix #5203: Sanitize section ID to prevent CSS selector injection
          const SAFE_SECTION_ID = /^[a-zA-Z0-9_-]+$/;
          const safeSectionId = SAFE_SECTION_ID.test(message.data.sectionId)
            ? message.data.sectionId
            : null;
          if (!safeSectionId) break;

          const sectionByIdEl = document.querySelector(`[data-section-id="${safeSectionId}"]`);
          // Always set the section ID for ID-based state
          setHighlightedSectionId(safeSectionId);
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
    highlightedSectionId,
    isReady,
    selectSection,
    notifyPageChange,
  };
}
