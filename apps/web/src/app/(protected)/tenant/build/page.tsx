'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';

import { BuildModeHeader, BuildModePreview, BuildModeChat, ConfirmDialog } from '@/components/build-mode';
import { useAuth } from '@/lib/auth-client';
import { DEFAULT_PAGES_CONFIG, type PageName, type PagesConfig } from '@macon/contracts';
import { logger } from '@/lib/logger';
import { Loader2 } from 'lucide-react';
import type { BuildModeChatContext } from '@/lib/build-mode/types';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { useDraftAutosave } from '@/hooks/useDraftAutosave';


/**
 * Build Mode Page
 *
 * Split-screen storefront editor with AI chat on left and live preview on right.
 * Changes are saved to draft and can be published or discarded.
 */
export default function BuildModePage() {
  const router = useRouter();
  const { slug, isAuthenticated } = useAuth();

  // State
  const [currentPage, setCurrentPage] = useState<PageName>('home');
  const [draftConfig, setDraftConfig] = useState<PagesConfig | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [highlightedSection, setHighlightedSection] = useState<number | null>(null);

  // Dialog state
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  // Ref for toast timeout cleanup
  const toastTimeoutRef = useRef<NodeJS.Timeout>();

  // Cleanup toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Use the draft autosave hook for publish/discard operations
  const { publishDraft, discardDraft, setDirty } = useDraftAutosave({
    initialConfig: draftConfig,
    onError: (err) => {
      logger.error('Draft operation failed', { error: err.message });
    },
  });

  // Warn before leaving with unsaved changes
  useUnsavedChangesWarning(isDirty);

  // Fetch initial draft config
  const fetchDraftConfig = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/tenant-admin/landing-page/draft');

      if (!response.ok) {
        if (response.status === 404) {
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
      setShowErrorToast(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchDraftConfig();
  }, [fetchDraftConfig]);

  // Chat context (memoized)
  const chatContext = useMemo<BuildModeChatContext>(() => ({
    currentPage,
    sectionCount: draftConfig?.[currentPage]?.sections?.length ?? 0,
    hasDraft: isDirty,
    tenantSlug: slug || '',
  }), [currentPage, draftConfig, isDirty, slug]);

  // Loading state - TEST with simple div
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

  // Event handlers
  const handleConfigUpdate = async () => { await fetchDraftConfig(); setIsDirty(true); };
  const handleSectionHighlight = (pageId: PageName, sectionIndex: number) => {
    if (pageId !== currentPage) setCurrentPage(pageId);
    setHighlightedSection(sectionIndex);
  };

  // Publish draft - calls the real API via useDraftAutosave hook
  const handlePublishConfirm = async () => {
    setIsPublishing(true);
    setShowPublishDialog(false);
    try {
      const success = await publishDraft();
      if (success) {
        setIsDirty(false);
        setDirty(false);
        await fetchDraftConfig();
        // Show success toast
        setShowSuccessToast(true);
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => setShowSuccessToast(false), 3000);
      }
    } catch (err) {
      logger.error('Failed to publish draft', err instanceof Error ? err : { error: String(err) });
      setShowErrorToast('Failed to publish changes. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Discard draft - calls the real API via useDraftAutosave hook
  const handleDiscardConfirm = async () => {
    setIsDiscarding(true);
    setShowDiscardDialog(false);
    try {
      const success = await discardDraft();
      if (success) {
        setIsDirty(false);
        setDirty(false);
        await fetchDraftConfig();
      }
    } catch (err) {
      logger.error('Failed to discard draft', err instanceof Error ? err : { error: String(err) });
      setShowErrorToast('Failed to discard changes. Please try again.');
    } finally {
      setIsDiscarding(false);
    }
  };

  // Full Build Mode Layout
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-neutral-100">
      {/* Header */}
      <BuildModeHeader
        isDirty={isDirty}
        isSaving={isPublishing || isDiscarding}
        onExit={() => setShowExitDialog(true)}
        onPublish={() => setShowPublishDialog(true)}
        onDiscard={() => setShowDiscardDialog(true)}
      />

      {/* Main Content - Split Panels */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup orientation="horizontal" className="h-full">
          {/* Left Panel - Chat */}
          <Panel defaultSize={35} minSize={25} maxSize={50}>
            <div className="h-full overflow-hidden bg-white border-r border-neutral-200">
              <BuildModeChat
                context={chatContext}
                onConfigUpdate={handleConfigUpdate}
                onSectionHighlight={handleSectionHighlight}
              />
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-neutral-200 hover:bg-sage transition-colors cursor-col-resize" />

          {/* Right Panel - Preview */}
          <Panel defaultSize={65} minSize={50}>
            <div className="h-full overflow-hidden">
              <BuildModePreview
                tenantSlug={slug || ''}
                currentPage={currentPage}
                draftConfig={draftConfig}
                highlightedSection={highlightedSection}
              />
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        title="Publish Changes"
        description="This will make your draft changes live on your storefront. Are you sure?"
        confirmLabel="Publish"
        onConfirm={handlePublishConfirm}
      />

      <ConfirmDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        title="Discard Changes"
        description="This will permanently delete all your draft changes. This cannot be undone."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={handleDiscardConfirm}
      />

      <ConfirmDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        title="Exit Build Mode"
        description={isDirty ? "You have unsaved changes. Are you sure you want to exit?" : "Are you sure you want to exit Build Mode?"}
        confirmLabel="Exit"
        onConfirm={() => {
          router.push('/tenant/dashboard');
        }}
      />

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-4 right-4 bg-sage text-white px-4 py-2 rounded-lg shadow-lg z-50">
          Changes published successfully!
        </div>
      )}

      {/* Error Toast */}
      {showErrorToast && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <span>{showErrorToast}</span>
          <button
            onClick={() => setShowErrorToast(null)}
            className="ml-2 hover:bg-red-600 rounded p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading overlay during publish/discard */}
      {(isPublishing || isDiscarding) && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-sage" />
            <span>{isPublishing ? 'Publishing changes...' : 'Discarding changes...'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
