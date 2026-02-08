'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAgentUIStore, selectPreviewRefreshKey } from '@/stores/agent-ui-store';
import { usePreviewToken } from '@/hooks/usePreviewToken';
import { Monitor, Tablet, Smartphone, RefreshCw, ExternalLink, Loader2 } from 'lucide-react';

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

interface LivePreviewProps {
  tenantSlug: string;
}

const VIEWPORT_SIZES: Record<
  ViewportSize,
  { width: string; label: string; icon: React.ReactNode }
> = {
  desktop: { width: '100%', label: 'Desktop', icon: <Monitor className="h-4 w-4" /> },
  tablet: { width: '768px', label: 'Tablet', icon: <Tablet className="h-4 w-4" /> },
  mobile: { width: '375px', label: 'Mobile', icon: <Smartphone className="h-4 w-4" /> },
};

/**
 * LivePreview - Center iframe showing the tenant's storefront
 *
 * Features:
 * - Responsive viewport toggles (desktop, tablet, mobile)
 * - Auto-refresh when agent makes changes (via store subscription)
 * - Loading state indicator
 * - URL bar showing current preview URL
 *
 * Uses draft mode query param to show unpublished changes.
 * Storefront is a single scrolling page — no page routing needed.
 */
export function LivePreview({ tenantSlug }: LivePreviewProps) {
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const refreshKey = useAgentUIStore(selectPreviewRefreshKey);
  const previousRefreshKeyRef = useRef(refreshKey);

  // Get preview token for authenticated draft access
  // CRITICAL: Without a valid token, the storefront page won't show draft content
  // See: apps/web/src/app/t/[slug]/(site)/page.tsx:79 - isPreviewMode = preview === 'draft' && !!token
  const { token: previewToken } = usePreviewToken();

  // Build the preview URL with draft mode and token
  // Storefront is a single scrolling page — always loads base path
  const previewUrl = useMemo(() => {
    const basePath = `/t/${tenantSlug}`;
    const params = new URLSearchParams();
    params.set('preview', 'draft');
    if (previewToken) {
      params.set('token', previewToken);
    }
    return `${basePath}?${params.toString()}`;
  }, [tenantSlug, previewToken]);

  // Handle iframe load
  const handleLoad = () => {
    setIsLoading(false);
  };

  // Refresh when agent store increments the refresh key
  useEffect(() => {
    if (refreshKey !== previousRefreshKeyRef.current && iframeRef.current) {
      setIsLoading(true);
      // Store src and reassign to force iframe reload (avoids no-self-assign lint)
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = currentSrc;
      previousRefreshKeyRef.current = refreshKey;
    }
  }, [refreshKey]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      // Store src and reassign to force iframe reload (avoids no-self-assign lint)
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = currentSrc;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-alt border-b border-neutral-700">
        {/* Viewport Toggles */}
        <div className="flex items-center gap-1 bg-surface rounded-lg p-1">
          {Object.entries(VIEWPORT_SIZES).map(([key, { label, icon }]) => (
            <button
              key={key}
              onClick={() => setViewport(key as ViewportSize)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all',
                viewport === key
                  ? 'bg-sage text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              )}
              title={label}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* URL Bar */}
        <div className="hidden md:flex items-center flex-1 mx-4 px-3 py-1.5 bg-surface rounded-lg">
          <span className="text-xs text-text-muted truncate">{previewUrl}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                       text-text-muted hover:text-text-primary hover:bg-surface transition-all"
            title="Refresh preview"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </button>
          <a
            href={`/t/${tenantSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                       bg-sage text-white hover:bg-sage/90 transition-all"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">View Live</span>
          </a>
        </div>
      </div>

      {/* Preview Container */}
      <div className="flex-1 overflow-auto bg-neutral-900 p-4">
        <div
          className={cn(
            'mx-auto bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300',
            viewport === 'desktop' && 'w-full h-full',
            viewport === 'tablet' && 'w-[768px] h-full',
            viewport === 'mobile' && 'w-[375px] h-full'
          )}
        >
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/80 z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-sage" />
                <span className="text-sm text-text-muted">Loading preview...</span>
              </div>
            </div>
          )}

          {/* Iframe */}
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="w-full h-full border-0"
            onLoad={handleLoad}
            title="Site Preview"
          />
        </div>
      </div>
    </div>
  );
}
