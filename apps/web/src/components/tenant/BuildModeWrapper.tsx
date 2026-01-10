'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import type { PagesConfig, PageName } from '@macon/contracts';
import { useBuildModeSync } from '@/hooks/useBuildModeSync';
import { cn } from '@/lib/utils';

interface BuildModeWrapperProps {
  /** Initial pages config from server-rendered data */
  initialConfig: PagesConfig | null;
  /** Current page name */
  pageName: PageName;
  /** Children receive the current config */
  children: (config: PagesConfig | null, isEditMode: boolean) => React.ReactNode;
}

/**
 * BuildModeWrapper - Client wrapper for storefront pages
 *
 * Enables real-time config updates when in Build Mode:
 * - Detects if running in Build Mode iframe (via ?edit=true)
 * - Listens for config updates from parent
 * - Passes updated config to children
 * - Handles section highlighting
 *
 * Usage:
 * ```tsx
 * <BuildModeWrapper initialConfig={tenant.landingPageConfig?.pages} pageName="home">
 *   {(config, isEditMode) => (
 *     <TenantLandingPageContent config={config} isEditMode={isEditMode} />
 *   )}
 * </BuildModeWrapper>
 * ```
 */
export function BuildModeWrapper({ initialConfig, pageName, children }: BuildModeWrapperProps) {
  const [currentConfig, setCurrentConfig] = useState<PagesConfig | null>(initialConfig);

  const {
    isEditMode,
    draftConfig,
    highlightedSection,
    isReady,
    hasTimedOut,
    selectSection,
    notifyPageChange,
  } = useBuildModeSync({
    enabled: true,
    initialConfig,
    onConfigChange: setCurrentConfig,
  });

  // Use draft config in edit mode, otherwise use initial/current
  const effectiveConfig = isEditMode && draftConfig ? draftConfig : currentConfig;

  // Notify parent when this page loads
  useEffect(() => {
    notifyPageChange(pageName);
  }, [pageName, notifyPageChange]);

  // Show loading state during handshake (prevents flash of published content)
  if (isEditMode && !isReady && !hasTimedOut) {
    return <PreviewLoadingState />;
  }

  // Show error state if handshake timed out
  if (isEditMode && hasTimedOut) {
    return <PreviewTimeoutError />;
  }

  return (
    <div className={cn('relative', isEditMode && 'build-mode-active')}>
      {/* Edit mode indicator */}
      {isEditMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-sage/90 text-white text-sm text-center py-1.5 font-medium">
          Build Mode Preview — Click sections to select them
        </div>
      )}

      {/* Render content with effective config */}
      <div className={cn(isEditMode && 'mt-10')}>{children(effectiveConfig, isEditMode)}</div>

      {/* Section selection overlay (when in edit mode) */}
      {isEditMode && (
        <BuildModeSectionOverlays
          pageName={pageName}
          config={effectiveConfig}
          highlightedSection={highlightedSection}
          onSelectSection={selectSection}
        />
      )}
    </div>
  );
}

/**
 * Loading state shown during PostMessage handshake
 * Prevents flash of published content before draft appears
 */
function PreviewLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-sage" />
        <p className="mt-4 text-lg font-medium text-text-primary">Loading draft preview...</p>
        <p className="mt-2 text-sm text-text-secondary">Syncing with editor</p>
      </div>
    </div>
  );
}

/**
 * Error state shown when PostMessage handshake times out
 */
function PreviewTimeoutError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="mx-auto max-w-md text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        <h2 className="mt-4 text-xl font-semibold text-text-primary">Preview Connection Failed</h2>
        <p className="mt-2 text-text-secondary">
          Unable to sync with the editor. Please close this preview and try again from the Build
          Mode panel.
        </p>
        <p className="mt-4 text-sm text-text-tertiary">
          If this issue persists, try refreshing the parent page.
        </p>
      </div>
    </div>
  );
}

/**
 * Section overlay components for click-to-select in Build Mode
 */
function BuildModeSectionOverlays({
  pageName,
  config: _config,
  highlightedSection,
  onSelectSection,
}: {
  pageName: PageName;
  config: PagesConfig | null;
  highlightedSection: number | null;
  onSelectSection: (pageId: PageName, sectionIndex: number) => void;
}) {
  // Note: _config is available for future use (e.g., rendering section count)
  // Currently we detect sections via DOM data-section-index attributes
  void _config;

  useEffect(() => {
    // Add click listeners to data-section-index elements
    const handleSectionClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const sectionEl = target.closest('[data-section-index]');
      if (sectionEl) {
        const index = parseInt(sectionEl.getAttribute('data-section-index') || '0', 10);
        onSelectSection(pageName, index);
      }
    };

    document.addEventListener('click', handleSectionClick);
    return () => document.removeEventListener('click', handleSectionClick);
  }, [pageName, onSelectSection]);

  // Add highlight styles via CSS
  useEffect(() => {
    if (highlightedSection === null) {
      document.querySelectorAll('[data-section-index]').forEach((el) => {
        el.classList.remove('build-mode-highlight');
      });
      return;
    }

    document.querySelectorAll('[data-section-index]').forEach((el) => {
      const index = parseInt(el.getAttribute('data-section-index') || '-1', 10);
      if (index === highlightedSection) {
        el.classList.add('build-mode-highlight');
      } else {
        el.classList.remove('build-mode-highlight');
      }
    });
  }, [highlightedSection]);

  return null; // This component just adds event listeners
}

/**
 * Add build mode styles to global CSS
 * Add to globals.css:
 *
 * .build-mode-active [data-section-index] {
 *   cursor: pointer;
 *   transition: box-shadow 0.2s, outline 0.2s;
 * }
 * .build-mode-active [data-section-index]:hover {
 *   box-shadow: inset 0 0 0 2px rgba(79, 113, 97, 0.3);
 * }
 * .build-mode-highlight {
 *   box-shadow: inset 0 0 0 3px rgba(79, 113, 97, 0.8) !important;
 *   outline: 3px solid rgba(79, 113, 97, 0.3);
 *   outline-offset: 2px;
 * }
 */
