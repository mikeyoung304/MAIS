'use client';

/**
 * PreviewPanel - Clean, full-bleed storefront preview iframe
 *
 * Stripped to minimal chrome: just a refresh button and the iframe.
 * All toolbar elements (page tabs, viewport toggle, publish/discard, close)
 * have been removed — the architecture is a single scrolling page with
 * agent-driven publish.
 *
 * PostMessage protocol:
 * - BUILD_MODE_READY: iframe signals it has loaded and initialized
 * - BUILD_MODE_CONFIG_UPDATE: parent sends config updates for real-time edits
 * - BUILD_MODE_HIGHLIGHT_SECTION_BY_ID: parent highlights a section
 * - BUILD_MODE_CLEAR_HIGHLIGHT: parent clears section highlight
 * - BUILD_MODE_SECTION_SELECTED: iframe signals user clicked a section
 *
 * @see stores/agent-ui-store.ts for view state management
 * @see hooks/useDraftConfig.ts for draft data fetching
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-client';
import {
  agentUIActions,
  useAgentUIStore,
  selectPreviewRefreshKey,
  selectShowConflictDialog,
} from '@/stores/agent-ui-store';
import { usePreviewToken } from '@/hooks/usePreviewToken';
import { Button } from '@/components/ui/button';
import { ConflictDialog } from '@/components/build-mode/ConflictDialog';
import { parseChildMessage } from '@/lib/build-mode/protocol';
import type { BuildModeParentMessage } from '@/lib/build-mode/types';
import type { PagesConfig } from '@macon/contracts';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface PreviewPanelProps {
  /** Section ID to highlight (format: {page}-{type}-{qualifier}) */
  highlightedSectionId: string | null;
  /** Draft configuration */
  draftConfig: PagesConfig;
  /** Callback when config is updated (invalidate cache) */
  onConfigUpdate: () => void;
  /** Whether config is currently loading */
  isConfigLoading?: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PreviewPanel({
  highlightedSectionId,
  draftConfig,
  onConfigUpdate,
  isConfigLoading = false,
}: PreviewPanelProps) {
  const { slug } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Ref to access draftConfig without making it a useEffect dependency
  // This prevents listener re-registration when config changes (Race #1 fix)
  const draftConfigRef = useRef(draftConfig);

  // Preview token for draft access
  const { token: previewToken, isLoading: isTokenLoading, error: tokenError } = usePreviewToken();

  // Local state
  const [isIframeReady, setIsIframeReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to preview refresh key - triggers iframe reload when packages change
  const previewRefreshKey = useAgentUIStore(selectPreviewRefreshKey);

  // Subscribe to conflict dialog state (#620 - optimistic locking)
  const showConflictDialog = useAgentUIStore(selectShowConflictDialog);

  // Build iframe URL with preview token — always loads 'home' (single scrolling page)
  const iframeUrl = useMemo(() => {
    const baseUrl = `/t/${slug}/`;
    const params = new URLSearchParams({
      preview: 'draft',
      edit: 'true',
    });
    if (previewToken) {
      params.set('token', previewToken);
    }
    return `${baseUrl}?${params.toString()}`;
  }, [slug, previewToken]);

  // Keep draftConfigRef in sync with prop changes
  useEffect(() => {
    draftConfigRef.current = draftConfig;
  }, [draftConfig]);

  // Auto-refresh when previewRefreshKey changes (triggered by package updates)
  // Skip initial value (0) to avoid unnecessary refresh on mount
  const prevRefreshKeyRef = useRef(previewRefreshKey);
  useEffect(() => {
    if (previewRefreshKey > 0 && previewRefreshKey !== prevRefreshKeyRef.current) {
      prevRefreshKeyRef.current = previewRefreshKey;
      if (isIframeReady && iframeRef.current?.contentWindow && draftConfig) {
        const updateMessage: BuildModeParentMessage = {
          type: 'BUILD_MODE_CONFIG_UPDATE',
          data: { config: draftConfig },
        };
        iframeRef.current.contentWindow.postMessage(updateMessage, window.location.origin);
      }
    }
  }, [previewRefreshKey, isIframeReady, draftConfig]);

  // Send config to iframe (for real-time updates only — initial load is API-driven)
  const sendConfigToIframe = useCallback(() => {
    if (!isIframeReady || !iframeRef.current?.contentWindow) return;

    const updateMessage: BuildModeParentMessage = {
      type: 'BUILD_MODE_CONFIG_UPDATE',
      data: { config: draftConfig },
    };
    iframeRef.current.contentWindow.postMessage(updateMessage, window.location.origin);
  }, [isIframeReady, draftConfig]);

  // Handle iframe messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const message = parseChildMessage(event.data);
      if (!message) return;

      switch (message.type) {
        case 'BUILD_MODE_READY':
          setIsIframeReady(true);
          setIsLoading(false);
          // Send current config for real-time update channel establishment
          if (draftConfigRef.current && iframeRef.current?.contentWindow) {
            const initMessage: BuildModeParentMessage = {
              type: 'BUILD_MODE_INIT',
              data: { draftConfig: draftConfigRef.current },
            };
            iframeRef.current.contentWindow.postMessage(initMessage, window.location.origin);
          }
          break;

        case 'BUILD_MODE_SECTION_SELECTED':
          if (message.data && typeof message.data === 'object') {
            const { sectionId, pageId, sectionIndex } = message.data as {
              sectionId?: string;
              pageId?: string;
              sectionIndex?: number;
            };

            if (sectionId) {
              agentUIActions.highlightSection(sectionId);
            } else if (pageId !== undefined && sectionIndex !== undefined) {
              const constructedId = `${pageId}-section-${sectionIndex}`;
              agentUIActions.highlightSection(constructedId);
            }
          }
          break;

        case 'BUILD_MODE_PAGE_CHANGE':
          // Single scrolling page — no action needed
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []); // Empty deps - listener never re-registers (Race #1 fix)

  // Send config updates to iframe
  useEffect(() => {
    sendConfigToIframe();
  }, [sendConfigToIframe]);

  // Send section highlight to iframe
  useEffect(() => {
    if (!isIframeReady || !iframeRef.current?.contentWindow) return;

    if (highlightedSectionId) {
      const highlightMessage: BuildModeParentMessage = {
        type: 'BUILD_MODE_HIGHLIGHT_SECTION_BY_ID',
        data: { sectionId: highlightedSectionId },
      };
      iframeRef.current.contentWindow.postMessage(highlightMessage, window.location.origin);
    } else {
      const clearMessage: BuildModeParentMessage = {
        type: 'BUILD_MODE_CLEAR_HIGHLIGHT',
      };
      iframeRef.current.contentWindow.postMessage(clearMessage, window.location.origin);
    }
  }, [isIframeReady, highlightedSectionId]);

  // API-first: when iframe fires onLoad, SSR content is rendered — clear loading overlay.
  // PostMessage channel establishes separately (non-blocking) for real-time updates.
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleIframeError = useCallback(() => {
    setError('Failed to load preview');
    setIsLoading(false);
  }, []);

  // Refresh iframe
  const handleRefresh = () => {
    setIsLoading(true);
    setError(null);
    setIsIframeReady(false);
    if (iframeRef.current) {
      iframeRef.current.src = iframeUrl;
    }
  };

  // Handle conflict refresh - refetch draft and soft-refresh iframe (#620)
  const handleConflictRefresh = async () => {
    onConfigUpdate();
  };

  return (
    <div
      className="h-full flex flex-col bg-neutral-100 dark:bg-surface-alt relative"
      data-testid="preview-panel"
    >
      {/* Minimal top-right refresh button */}
      <div className="absolute top-3 right-3 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          className={cn(
            'h-8 w-8 rounded-full',
            'bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm',
            'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
            'shadow-sm hover:shadow-md transition-all'
          )}
          title="Refresh preview"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Full-bleed preview container */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full w-full relative">
          {/* Loading state */}
          {(isLoading || isConfigLoading || isTokenLoading) && (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-surface z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-sage" />
                <span className="text-sm text-neutral-500 dark:text-text-muted">
                  Loading preview...
                </span>
              </div>
            </div>
          )}

          {/* Error state */}
          {(error || tokenError) && (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-surface z-10">
              <div className="flex flex-col items-center gap-3 text-center p-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <span className="text-sm text-neutral-700 dark:text-text-primary">
                  {error || tokenError?.message || 'Failed to load preview'}
                </span>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try again
                </Button>
              </div>
            </div>
          )}

          {/* Iframe */}
          <iframe
            ref={iframeRef}
            src={iframeUrl}
            className="w-full h-full border-0"
            title="Storefront Preview"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-same-origin allow-scripts allow-forms"
            data-testid="preview-iframe"
          />
        </div>
      </div>

      {/* Conflict dialog for concurrent modification errors (#620) */}
      <ConflictDialog
        open={showConflictDialog}
        onOpenChange={agentUIActions.setShowConflictDialog}
        onRefresh={handleConflictRefresh}
      />
    </div>
  );
}

export default PreviewPanel;
