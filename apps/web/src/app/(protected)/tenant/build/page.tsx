'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useAuth } from '@/lib/auth-client';
import { BuildModeHeader, BuildModePreview, BuildModeChat, PageSelector, ConfirmDialog } from '@/components/build-mode';
import { DEFAULT_PAGES_CONFIG, type PageName, type PagesConfig } from '@macon/contracts';
import { logger } from '@/lib/logger';
import { Loader2, CheckCircle } from 'lucide-react';
import type { BuildModeChatContext } from '@/lib/build-mode/types';
import { BUILD_MODE_CONFIG } from '@/lib/build-mode/config';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';

/**
 * Build Mode Page
 *
 * Split-screen storefront editor with:
 * - Left panel: AI chat assistant (35% default)
 * - Right panel: Live storefront preview (65% default)
 * - Resizable panels via react-resizable-panels
 *
 * Features:
 * - Edit landing page content via chat
 * - Real-time preview of changes
 * - Draft mode (changes not live until published)
 * - Page selector to switch between pages
 */
export default function BuildModePage() {
  const router = useRouter();
  const { tenantId, slug, isAuthenticated } = useAuth();

  // State
  const [currentPage, setCurrentPage] = useState<PageName>('home');
  const [draftConfig, setDraftConfig] = useState<PagesConfig | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightedSection, setHighlightedSection] = useState<number | null>(null);

  // Dialog state
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Ref for toast timeout cleanup
  const toastTimeoutRef = useRef<NodeJS.Timeout>();

  // Cleanup toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Warn before leaving with unsaved changes
  useUnsavedChangesWarning(isDirty);

  // Fetch initial draft config
  const fetchDraftConfig = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tenant-admin/landing-page/draft');

      if (!response.ok) {
        if (response.status === 404) {
          // No draft exists, initialize with defaults or live config
          const liveResponse = await fetch('/api/tenant-admin/landing-page');
          if (liveResponse.ok) {
            const liveConfig = await liveResponse.json();
            setDraftConfig(liveConfig.pages || DEFAULT_PAGES_CONFIG);
          } else {
            setDraftConfig(DEFAULT_PAGES_CONFIG);
          }
        } else {
          throw new Error('Failed to fetch draft configuration');
        }
      } else {
        const data = await response.json();
        setDraftConfig(data.pages || DEFAULT_PAGES_CONFIG);
        setIsDirty(data.hasDraft || false);
      }
    } catch (err) {
      logger.error('Failed to fetch draft config', err instanceof Error ? err : { error: String(err) });
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchDraftConfig();
  }, [fetchDraftConfig]);

  // Handle page change
  const handlePageChange = (page: PageName) => {
    setCurrentPage(page);
    setHighlightedSection(null);
  };

  // Handle section highlight (from chat)
  const handleSectionHighlight = (pageId: PageName, sectionIndex: number) => {
    if (pageId !== currentPage) {
      setCurrentPage(pageId);
    }
    setHighlightedSection(sectionIndex);
  };

  // Handle config update (from chat)
  const handleConfigUpdate = useCallback(async () => {
    // Refetch draft config after a tool updates it
    await fetchDraftConfig();
    setIsDirty(true);
  }, [fetchDraftConfig]);

  // Handle publish click (show dialog)
  const handlePublishClick = () => {
    setShowPublishDialog(true);
  };

  // Confirm publish
  const handlePublishConfirm = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/tenant-admin/landing-page/publish', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to publish changes');
      }

      setIsDirty(false);
      setShowSuccessToast(true);
      // Hide success toast after configured duration (with cleanup)
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setShowSuccessToast(false), BUILD_MODE_CONFIG.timing.toastDuration);
    } catch (err) {
      logger.error('Failed to publish', err instanceof Error ? err : { error: String(err) });
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle discard click (show dialog)
  const handleDiscardClick = () => {
    setShowDiscardDialog(true);
  };

  // Confirm discard
  const handleDiscardConfirm = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/tenant-admin/landing-page/draft', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to discard draft');
      }

      // Refetch to get live config
      await fetchDraftConfig();
      setIsDirty(false);
    } catch (err) {
      logger.error('Failed to discard', err instanceof Error ? err : { error: String(err) });
      setError(err instanceof Error ? err.message : 'Failed to discard');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle exit click
  const handleExitClick = () => {
    if (isDirty) {
      setShowExitDialog(true);
    } else {
      router.push('/tenant/dashboard');
    }
  };

  // Confirm exit
  const handleExitConfirm = () => {
    router.push('/tenant/dashboard');
  };

  // Chat context (memoized to prevent unnecessary re-renders)
  const chatContext = useMemo<BuildModeChatContext>(() => ({
    currentPage,
    sectionCount: draftConfig?.[currentPage]?.sections?.length ?? 0,
    hasDraft: isDirty,
    tenantSlug: slug || '',
  }), [currentPage, draftConfig, isDirty, slug]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-sage" />
          <span className="text-sm text-neutral-500">Loading Build Mode...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !draftConfig) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center p-8">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/tenant/dashboard')}
            className="text-sage hover:underline"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-50">
      {/* Header */}
      <BuildModeHeader
        isDirty={isDirty}
        isSaving={isSaving}
        onPublish={handlePublishClick}
        onDiscard={handleDiscardClick}
        onExit={handleExitClick}
      />

      {/* Success toast */}
      {showSuccessToast && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 bg-sage text-white px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-right">
          <CheckCircle className="h-5 w-5" />
          <span>Changes published successfully!</span>
        </div>
      )}

      {/* Page selector */}
      <div className="flex items-center justify-center py-2 px-4 bg-white border-b border-neutral-200">
        <PageSelector
          currentPage={currentPage}
          pages={draftConfig}
          onChange={handlePageChange}
        />
      </div>

      {/* Main content: resizable panels */}
      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal" className="h-full">
          {/* Left panel: Chat */}
          <Panel defaultSize={35} minSize={25} maxSize={50}>
            <BuildModeChat
              context={chatContext}
              onConfigUpdate={handleConfigUpdate}
              onSectionHighlight={handleSectionHighlight}
              className="h-full border-r border-neutral-200"
            />
          </Panel>

          {/* Resize handle */}
          <PanelResizeHandle className="w-1 bg-neutral-200 hover:bg-sage transition-colors cursor-col-resize" />

          {/* Right panel: Preview */}
          <Panel defaultSize={65} minSize={50}>
            <BuildModePreview
              tenantSlug={slug || ''}
              currentPage={currentPage}
              draftConfig={draftConfig}
              highlightedSection={highlightedSection}
              onSectionSelect={handleSectionHighlight}
              className="h-full"
            />
          </Panel>
        </PanelGroup>
      </div>

      {/* Publish confirmation dialog */}
      <ConfirmDialog
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        title="Publish Changes"
        description="This will make your draft changes live on your storefront. Your visitors will see the updated content immediately."
        confirmLabel="Publish Now"
        cancelLabel="Keep Editing"
        onConfirm={handlePublishConfirm}
      />

      {/* Discard confirmation dialog */}
      <ConfirmDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        title="Discard Changes?"
        description="All unpublished changes will be lost. Your storefront will remain unchanged."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Changes"
        variant="destructive"
        onConfirm={handleDiscardConfirm}
      />

      {/* Exit confirmation dialog */}
      <ConfirmDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        title="Leave Build Mode?"
        description="You have unsaved changes. If you leave now, your changes will remain as a draft but won't be published."
        confirmLabel="Leave Anyway"
        cancelLabel="Stay"
        onConfirm={handleExitConfirm}
      />
    </div>
  );
}
