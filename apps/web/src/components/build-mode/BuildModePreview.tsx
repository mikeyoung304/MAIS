'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw, AlertCircle, ExternalLink, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PageName, PagesConfig } from '@macon/contracts';
import type { BuildModeParentMessage } from '@/lib/build-mode/types';
import { parseChildMessage } from '@/lib/build-mode/protocol';
import { BUILD_MODE_CONFIG } from '@/lib/build-mode/config';

interface BuildModePreviewProps {
  tenantSlug: string;
  currentPage: PageName;
  draftConfig: PagesConfig | null;
  onSectionSelect?: (pageId: PageName, sectionIndex: number) => void;
  highlightedSection?: number | null;
  className?: string;
}

type ViewportMode = 'desktop' | 'mobile';

/**
 * BuildModePreview - Live preview iframe for storefront
 *
 * Features:
 * - Loads tenant storefront in iframe with ?preview=draft
 * - PostMessage communication for real-time updates
 * - Responsive viewport toggle (desktop/mobile)
 * - Loading/error states
 */
export function BuildModePreview({
  tenantSlug,
  currentPage,
  draftConfig,
  onSectionSelect,
  highlightedSection,
  className,
}: BuildModePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReadyTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (iframeReadyTimeoutRef.current) {
        clearTimeout(iframeReadyTimeoutRef.current);
      }
    };
  }, []);

  // Build iframe URL with preview mode
  const iframeUrl = `/t/${tenantSlug}/${currentPage === 'home' ? '' : currentPage}?preview=draft&edit=true`;

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from our own origin
      if (event.origin !== window.location.origin) return;

      // Validate message with Zod schema - silently ignore invalid messages
      const message = parseChildMessage(event.data);
      if (!message) return;

      switch (message.type) {
        case 'BUILD_MODE_READY':
          setIsReady(true);
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
          onSectionSelect?.(message.data.pageId as PageName, message.data.sectionIndex);
          break;

        case 'BUILD_MODE_PAGE_CHANGE':
          // The iframe navigated to a different page
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [draftConfig, onSectionSelect]);

  // Send config updates to iframe
  useEffect(() => {
    if (!isReady || !draftConfig || !iframeRef.current?.contentWindow) return;

    const updateMessage: BuildModeParentMessage = {
      type: 'BUILD_MODE_CONFIG_UPDATE',
      data: { config: draftConfig },
    };
    iframeRef.current.contentWindow.postMessage(updateMessage, window.location.origin);
  }, [isReady, draftConfig]);

  // Send section highlight to iframe
  useEffect(() => {
    if (!isReady || !iframeRef.current?.contentWindow) return;

    if (highlightedSection !== null && highlightedSection !== undefined) {
      const highlightMessage: BuildModeParentMessage = {
        type: 'BUILD_MODE_HIGHLIGHT_SECTION',
        data: { pageId: currentPage, sectionIndex: highlightedSection },
      };
      iframeRef.current.contentWindow.postMessage(highlightMessage, window.location.origin);
    } else {
      const clearMessage: BuildModeParentMessage = {
        type: 'BUILD_MODE_CLEAR_HIGHLIGHT',
      };
      iframeRef.current.contentWindow.postMessage(clearMessage, window.location.origin);
    }
  }, [isReady, highlightedSection, currentPage]);

  // Handle iframe load error
  const handleIframeError = useCallback(() => {
    setError('Failed to load preview. Please try refreshing.');
    setIsLoading(false);
  }, []);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    // Clear any previous timeout
    if (iframeReadyTimeoutRef.current) {
      clearTimeout(iframeReadyTimeoutRef.current);
    }
    // Give the iframe content time to initialize
    iframeReadyTimeoutRef.current = setTimeout(() => {
      if (!isReady) {
        // If not ready after timeout, show a warning
        setIsLoading(false);
      }
    }, BUILD_MODE_CONFIG.timing.iframeReadyTimeout);
  }, [isReady]);

  // Refresh iframe
  const handleRefresh = () => {
    setIsLoading(true);
    setError(null);
    setIsReady(false);
    if (iframeRef.current) {
      iframeRef.current.src = iframeUrl;
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-neutral-100', className)}>
      {/* Preview toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-neutral-200">
        <div className="flex items-center gap-2">
          {/* Viewport toggle */}
          <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
            <button
              onClick={() => setViewportMode('desktop')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewportMode === 'desktop'
                  ? 'bg-white text-sage shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900'
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
                  ? 'bg-white text-sage shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900'
              )}
              title="Mobile view"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          <span className="text-sm text-neutral-500 ml-2">
            Preview: <span className="font-medium text-neutral-700">{currentPage}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="text-neutral-600 hover:text-neutral-900"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <a
            href={`/t/${tenantSlug}?preview=draft`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-600 hover:text-neutral-900 p-2"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Preview container */}
      <div className="flex-1 overflow-hidden p-4">
        <div
          className={cn(
            'h-full mx-auto bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300',
            viewportMode === 'desktop' && 'w-full'
          )}
          style={
            viewportMode === 'mobile'
              ? { maxWidth: BUILD_MODE_CONFIG.viewport.mobileWidth }
              : undefined
          }
        >
          {/* Loading state */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-sage" />
                <span className="text-sm text-neutral-500">Loading preview...</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="flex flex-col items-center gap-3 text-center p-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <span className="text-sm text-neutral-700">{error}</span>
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
          />
        </div>
      </div>
    </div>
  );
}
