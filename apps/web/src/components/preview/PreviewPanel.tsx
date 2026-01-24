'use client';

/**
 * PreviewPanel - Storefront preview panel for Agent-First Dashboard
 *
 * Extracted and enhanced from BuildModePreview with:
 * - Page tabs toolbar for navigating between storefront pages
 * - Publish/Discard buttons with T3 confirmation dialogs
 * - Viewport toggle (desktop/mobile)
 * - Section highlighting via PostMessage
 * - Close button to return to dashboard
 *
 * Uses the same PostMessage protocol as BuildModePreview for iframe communication.
 *
 * @see components/build-mode/BuildModePreview.tsx for original implementation
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
import { useDraftConfig } from '@/hooks/useDraftConfig';
import { usePreviewToken } from '@/hooks/usePreviewToken';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/build-mode/ConfirmDialog';
import { ConflictDialog } from '@/components/build-mode/ConflictDialog';
import { parseChildMessage } from '@/lib/build-mode/protocol';
import { BUILD_MODE_CONFIG } from '@/lib/build-mode/config';
import type { BuildModeParentMessage } from '@/lib/build-mode/types';
import type { PageName, PagesConfig } from '@macon/contracts';
import { cn } from '@/lib/utils';
import {
  X,
  Upload,
  Trash2,
  Home,
  Info,
  Briefcase,
  HelpCircle,
  Phone,
  Image,
  MessageSquare,
  Loader2,
  Monitor,
  Smartphone,
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

// ============================================
// CONSTANTS
// ============================================

const PAGE_CONFIG: Array<{
  id: PageName;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'home', label: 'Home', icon: <Home className="h-4 w-4" /> },
  { id: 'about', label: 'About', icon: <Info className="h-4 w-4" /> },
  { id: 'services', label: 'Services', icon: <Briefcase className="h-4 w-4" /> },
  { id: 'faq', label: 'FAQ', icon: <HelpCircle className="h-4 w-4" /> },
  { id: 'contact', label: 'Contact', icon: <Phone className="h-4 w-4" /> },
  { id: 'gallery', label: 'Gallery', icon: <Image className="h-4 w-4" /> },
  { id: 'testimonials', label: 'Testimonials', icon: <MessageSquare className="h-4 w-4" /> },
];

type ViewportMode = 'desktop' | 'mobile';

// ============================================
// TYPES
// ============================================

interface PreviewPanelProps {
  /** Currently selected page */
  currentPage: PageName;
  /** Section ID to highlight (format: {page}-{type}-{qualifier}) */
  highlightedSectionId: string | null;
  /** Draft configuration */
  draftConfig: PagesConfig;
  /** Whether there's an unpublished draft */
  hasDraft: boolean;
  /** Callback when config is updated (invalidate cache) */
  onConfigUpdate: () => void;
  /** Whether config is currently loading */
  isConfigLoading?: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PreviewPanel({
  currentPage,
  highlightedSectionId,
  draftConfig,
  hasDraft,
  onConfigUpdate,
  isConfigLoading = false,
}: PreviewPanelProps) {
  const { slug } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReadyTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const { publishDraft, discardDraft, isPublishing, isDiscarding } = useDraftConfig();

  // Preview token for draft access
  const { token: previewToken, isLoading: isTokenLoading, error: tokenError } = usePreviewToken();

  // Local state
  const [isIframeReady, setIsIframeReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');

  // Subscribe to preview refresh key - triggers iframe reload when packages change
  const previewRefreshKey = useAgentUIStore(selectPreviewRefreshKey);

  // Subscribe to conflict dialog state (#620 - optimistic locking)
  // Set by agent tool handlers when CONCURRENT_MODIFICATION error occurs
  const showConflictDialog = useAgentUIStore(selectShowConflictDialog);

  // T3 confirmation dialogs
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Build iframe URL with preview token
  // Token is included to authenticate draft content access server-side
  const iframeUrl = useMemo(() => {
    const pagePath = currentPage === 'home' ? '' : currentPage;
    const baseUrl = `/t/${slug}/${pagePath}`;
    const params = new URLSearchParams({
      preview: 'draft',
      edit: 'true',
    });
    if (previewToken) {
      params.set('token', previewToken);
    }
    return `${baseUrl}?${params.toString()}`;
  }, [slug, currentPage, previewToken]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (iframeReadyTimeoutRef.current) {
        clearTimeout(iframeReadyTimeoutRef.current);
      }
    };
  }, []);

  // Auto-refresh when previewRefreshKey changes (triggered by package updates)
  // Skip initial value (0) to avoid unnecessary refresh on mount
  // Uses soft refresh via PostMessage for fluid canvas experience
  const prevRefreshKeyRef = useRef(previewRefreshKey);
  useEffect(() => {
    if (previewRefreshKey > 0 && previewRefreshKey !== prevRefreshKeyRef.current) {
      prevRefreshKeyRef.current = previewRefreshKey;
      // Soft refresh - re-send current config to iframe without full reload
      // This preserves the PostMessage connection for smooth updates
      if (isIframeReady && iframeRef.current?.contentWindow && draftConfig) {
        const updateMessage: BuildModeParentMessage = {
          type: 'BUILD_MODE_CONFIG_UPDATE',
          data: { config: draftConfig },
        };
        iframeRef.current.contentWindow.postMessage(updateMessage, window.location.origin);
      }
    }
  }, [previewRefreshKey, isIframeReady, draftConfig]);

  // Send config to iframe
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
      // Only accept messages from our own origin
      if (event.origin !== window.location.origin) return;

      // Validate message with Zod schema
      const message = parseChildMessage(event.data);
      if (!message) return;

      switch (message.type) {
        case 'BUILD_MODE_READY':
          setIsIframeReady(true);
          setIsLoading(false);
          // Send initial config
          if (draftConfig && iframeRef.current?.contentWindow) {
            const initMessage: BuildModeParentMessage = {
              type: 'BUILD_MODE_INIT',
              data: { draftConfig },
            };
            iframeRef.current.contentWindow.postMessage(initMessage, window.location.origin);
          }
          break;

        case 'BUILD_MODE_SECTION_SELECTED':
          // P2-FIX: User clicked a section in preview
          // Extract section ID from message data and update the agent store
          // This enables bidirectional highlighting: agent can highlight sections,
          // and user can click sections to focus them
          if (message.data && typeof message.data === 'object') {
            const { sectionId, pageId, sectionIndex } = message.data as {
              sectionId?: string;
              pageId?: string;
              sectionIndex?: number;
            };

            // Prefer section ID if available (Phase 5.1 adds IDs to legacy sections)
            if (sectionId) {
              agentUIActions.highlightSection(sectionId);
            } else if (pageId !== undefined && sectionIndex !== undefined) {
              // Fallback: construct section ID from page and index
              // Format: {page}-section-{index} (generic format for legacy sections)
              const constructedId = `${pageId}-section-${sectionIndex}`;
              agentUIActions.highlightSection(constructedId);
            }
          }
          break;

        case 'BUILD_MODE_PAGE_CHANGE':
          // Iframe navigated to different page
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [draftConfig]);

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

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    if (iframeReadyTimeoutRef.current) {
      clearTimeout(iframeReadyTimeoutRef.current);
    }
    // Give the iframe content time to initialize
    iframeReadyTimeoutRef.current = setTimeout(() => {
      if (!isIframeReady) {
        setIsLoading(false);
      }
    }, BUILD_MODE_CONFIG.timing.iframeReadyTimeout);
  }, [isIframeReady]);

  // Handle iframe error
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

  // Navigate to page
  const handlePageChange = (page: PageName) => {
    agentUIActions.setPreviewPage(page);
  };

  // Close preview
  const handleClose = () => {
    agentUIActions.showDashboard();
  };

  // Handle publish with T3 confirmation
  const handlePublish = async () => {
    try {
      await publishDraft();
      onConfigUpdate();
      setShowPublishDialog(false);

      // Don't reload iframe - let the config update flow through PostMessage
      // for a smooth canvas experience. The useDraftConfig refetch will
      // trigger sendConfigToIframe() automatically via useEffect.
    } catch (err) {
      setError('Failed to publish changes');
    }
  };

  // Handle discard with T3 confirmation
  const handleDiscard = async () => {
    try {
      await discardDraft();
      onConfigUpdate();
      setShowDiscardDialog(false);

      // Don't reload iframe - let the config update flow through PostMessage
      // for a smooth canvas experience. The useDraftConfig refetch will
      // trigger sendConfigToIframe() automatically via useEffect.
    } catch (err) {
      setError('Failed to discard changes');
    }
  };

  // Handle conflict refresh - refetch draft and soft-refresh iframe (#620)
  const handleConflictRefresh = async () => {
    onConfigUpdate(); // Invalidate cache to refetch latest version
    // Config update will flow through PostMessage automatically
  };

  return (
    <div
      className="h-full flex flex-col bg-neutral-100 dark:bg-surface-alt"
      data-testid="preview-panel"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-surface border-b border-neutral-200 dark:border-neutral-700">
        {/* Page tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {PAGE_CONFIG.map((page) => (
            <button
              key={page.id}
              onClick={() => handlePageChange(page.id)}
              data-testid={`preview-page-tab-${page.id}`}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap',
                currentPage === page.id
                  ? 'bg-sage/10 text-sage font-medium'
                  : 'text-text-muted hover:bg-neutral-100 dark:hover:bg-neutral-700'
              )}
            >
              {page.icon}
              <span>{page.label}</span>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {/* Viewport toggle */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setViewportMode('desktop')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewportMode === 'desktop'
                  ? 'bg-white dark:bg-neutral-700 text-sage shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              )}
              title="Desktop view"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewportMode('mobile')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewportMode === 'mobile'
                  ? 'bg-white dark:bg-neutral-700 text-sage shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
              )}
              title="Mobile view"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          {/* Refresh */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            title="Refresh preview"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          {/* Open in new tab */}
          <a
            href={
              previewToken
                ? `/t/${slug}?preview=draft&token=${previewToken}`
                : `/t/${slug}?preview=draft`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>

          <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-700" />

          {/* Save/Shred buttons - paintbrush metaphor */}
          {hasDraft && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDiscardDialog(true)}
                disabled={isDiscarding}
                className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400"
                data-testid="preview-discard-button"
              >
                {isDiscarding ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1.5" />
                )}
                Shred
              </Button>
              <Button
                variant="sage"
                size="sm"
                onClick={() => setShowPublishDialog(true)}
                disabled={isPublishing}
                data-testid="preview-publish-button"
              >
                {isPublishing ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1.5" />
                )}
                Save
              </Button>
            </>
          )}

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            title="Close preview"
            data-testid="preview-close-button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview container */}
      <div className="flex-1 overflow-hidden p-4">
        <div
          className={cn(
            'h-full mx-auto bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 relative',
            viewportMode === 'desktop' && 'w-full'
          )}
          style={
            viewportMode === 'mobile'
              ? { maxWidth: BUILD_MODE_CONFIG.viewport.mobileWidth }
              : undefined
          }
        >
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

      {/* T3 Confirmation Dialogs */}
      <ConfirmDialog
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        title="Save to Live Site"
        description="This will push your changes to your customer-facing storefront. Your visitors will see these changes immediately."
        confirmLabel="Save"
        onConfirm={handlePublish}
      />

      <ConfirmDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        title="Shred Changes"
        description="This will permanently delete all your draft changes. This action cannot be undone."
        confirmLabel="Shred"
        variant="destructive"
        onConfirm={handleDiscard}
      />

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
