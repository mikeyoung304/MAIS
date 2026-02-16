'use client';

import { useEffect, useState } from 'react';
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
 * API-first strategy: iframe loads draft content from SSR (via ?preview=draft&token=JWT).
 * Content renders immediately — no PostMessage handshake required for initial display.
 * PostMessage establishes a non-blocking real-time update channel for live edits.
 *
 * Enables real-time config updates when in Build Mode:
 * - Detects if running in Build Mode iframe (via ?edit=true)
 * - Listens for config updates from parent (after PostMessage channel established)
 * - Passes updated config to children
 * - Handles section highlighting
 */
export function BuildModeWrapper({ initialConfig, pageName, children }: BuildModeWrapperProps) {
  const [currentConfig, setCurrentConfig] = useState<PagesConfig | null>(initialConfig);

  const { isEditMode, draftConfig, highlightedSection, selectSection } = useBuildModeSync({
    enabled: true,
    initialConfig,
    onConfigChange: setCurrentConfig,
  });

  // Use draft config in edit mode, otherwise use initial/current
  const effectiveConfig = isEditMode && draftConfig ? draftConfig : currentConfig;

  // API-first: render SSR content immediately. No blocking on PostMessage handshake.
  return (
    <div className={cn('relative', isEditMode && 'build-mode-active')}>
      {/* Subtle edit mode indicator — thin sage line instead of green banner */}
      {isEditMode && <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-accent/40" />}

      {/* Render content with effective config */}
      <div>{children(effectiveConfig, isEditMode)}</div>

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
