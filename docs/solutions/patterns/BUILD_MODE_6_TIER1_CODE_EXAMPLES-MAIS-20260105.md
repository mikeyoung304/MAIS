# Build Mode: 6 Tier 1 Fixes - Complete Code Examples

**Quick Reference:** Copy-paste examples for each fix
**Status:** All fixes implemented and tested

---

## Fix 1: Wire Publish/Discard to Real API

### Hook Import and Setup

```typescript
// apps/web/src/app/(protected)/tenant/build/page.tsx

import { useDraftAutosave } from '@/hooks/useDraftAutosave';

export default function BuildModePage() {
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout>();

  // Cleanup toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Import hook for real API calls
  const { publishDraft, discardDraft, setDirty } = useDraftAutosave({
    initialConfig: draftConfig,
    onError: (err) => {
      logger.error('Draft operation failed', { error: err.message });
    },
  });

  // ... rest of component
}
```

### Dialog Handlers

```typescript
// Handle publish confirmation
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

// Handle discard confirmation
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
```

### UI Elements

```typescript
// Loading overlay
{(isPublishing || isDiscarding) && (
  <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 flex items-center gap-3 shadow-xl">
      <Loader2 className="h-5 w-5 animate-spin text-sage" />
      <span>{isPublishing ? 'Publishing changes...' : 'Discarding changes...'}</span>
    </div>
  </div>
)}

// Success toast
{showSuccessToast && (
  <div className="fixed bottom-4 right-4 bg-sage text-white px-4 py-2 rounded-lg shadow-lg z-50">
    Changes published successfully!
  </div>
)}

// Error toast
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
```

---

## Fix 2: Correct Prop Names on Dialogs

```typescript
// apps/web/src/app/(protected)/tenant/build/page.tsx

// Publish dialog
<ConfirmDialog
  open={showPublishDialog}
  onOpenChange={setShowPublishDialog}
  title="Publish Changes"
  description="This will make your draft changes live on your storefront. Are you sure?"
  confirmLabel="Publish"  // ← Correct prop name
  onConfirm={handlePublishConfirm}
/>

// Discard dialog
<ConfirmDialog
  open={showDiscardDialog}
  onOpenChange={setShowDiscardDialog}
  title="Discard Changes"
  description="This will permanently delete all your draft changes. This cannot be undone."
  confirmLabel="Discard"  // ← Correct prop name
  variant="destructive"
  onConfirm={handleDiscardConfirm}
/>

// Exit dialog
<ConfirmDialog
  open={showExitDialog}
  onOpenChange={setShowExitDialog}
  title="Exit Build Mode"
  description={isDirty ? "You have unsaved changes. Are you sure you want to exit?" : "Are you sure you want to exit Build Mode?"}
  confirmLabel="Exit"  // ← Correct prop name
  onConfirm={() => {
    router.push('/tenant/dashboard');
  }}
/>
```

---

## Fix 3: Add Tools to Executor Registry

```typescript
// server/src/agent/proposals/executor-registry.ts

/**
 * List of all tools that require registered executors.
 * When a tool is added to the agent system, add it here to ensure
 * the executor registration is validated at startup.
 *
 * IMPORTANT: If you add a new write tool to the agent system,
 * you MUST add its name to this list AND register its executor
 * in executors/index.ts. Otherwise the server will fail to start.
 */
const REQUIRED_EXECUTOR_TOOLS = [
  // Package management
  'upsert_package',
  'delete_package',

  // Add-on management
  'upsert_addon',
  'delete_addon',

  // Booking management
  'create_booking',
  'cancel_booking',
  'update_booking',
  'process_refund',

  // Blackout/availability management
  'add_blackout_date',
  'remove_blackout_date',
  'manage_blackout',

  // Segment management
  'upsert_segment',
  'delete_segment',

  // Tenant configuration
  'update_branding',
  'update_landing_page',
  'update_deposit_settings',

  // Onboarding
  'start_trial',
  'initiate_stripe_onboarding',

  // Storefront Build Mode
  'update_page_section',
  'remove_page_section',
  'reorder_page_sections',
  'toggle_page_enabled',
  'update_storefront_branding',
  'publish_draft', // ✅ Added
  'discard_draft', // ✅ Added
] as const;
```

### Executor Registration (Already Implemented)

```typescript
// server/src/agent/executors/storefront-executors.ts

// publish_draft - Publish draft changes to live storefront
registerProposalExecutor('publish_draft', async (tenantId, payload) => {
  // P0: Validate payload (empty object expected)
  const validationResult = PublishDraftPayloadSchema.safeParse(payload);
  if (!validationResult.success) {
    throw new ValidationError(
      `Invalid payload: ${validationResult.error.errors.map((e) => e.message).join(', ')}`
    );
  }

  // Get the current draft
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      landingPageConfig: true,
      landingPageConfigDraft: true,
      slug: true,
    },
  });

  if (!tenant) {
    throw new ResourceNotFoundError('tenant', tenantId, 'Please contact support.');
  }

  if (!tenant.landingPageConfigDraft) {
    throw new ValidationError('No draft changes to publish.');
  }

  // Copy draft to live config and clear draft
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      landingPageConfig: tenant.landingPageConfigDraft,
      landingPageConfigDraft: null, // Clear the draft
    },
  });

  logger.info({ tenantId }, 'Draft published to live storefront via Build Mode');

  return {
    action: 'published',
    previewUrl: tenant.slug ? `/t/${tenant.slug}` : undefined,
    note: 'Changes are now live.',
  };
});

// discard_draft - Discard all draft changes
registerProposalExecutor('discard_draft', async (tenantId, payload) => {
  // P0: Validate payload (empty object expected)
  const validationResult = DiscardDraftPayloadSchema.safeParse(payload);
  if (!validationResult.success) {
    throw new ValidationError(
      `Invalid payload: ${validationResult.error.errors.map((e) => e.message).join(', ')}`
    );
  }

  // Get the current draft status
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      landingPageConfigDraft: true,
      slug: true,
    },
  });

  if (!tenant) {
    throw new ResourceNotFoundError('tenant', tenantId, 'Please contact support.');
  }

  if (!tenant.landingPageConfigDraft) {
    throw new ValidationError('No draft changes to discard.');
  }

  // Clear the draft
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      landingPageConfigDraft: null,
    },
  });

  logger.info({ tenantId }, 'Draft discarded via Build Mode');

  return {
    action: 'discarded',
    previewUrl: tenant.slug ? `/t/${tenant.slug}` : undefined,
    note: 'Draft changes have been discarded. Showing live version.',
  };
});
```

---

## Fix 4: Memory Leak Timeout Cleanup in Hook

```typescript
// apps/web/src/hooks/useDraftAutosave.ts

export function useDraftAutosave({
  initialConfig = null,
  debounceMs = BUILD_MODE_CONFIG.timing.debounce.autosave,
  onError,
  onSave,
}: UseDraftAutosaveOptions = {}): UseDraftAutosaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [draftConfig, setDraftConfig] = useState<PagesConfig | null>(initialConfig);

  // Track timeouts for cleanup
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const statusResetRef = useRef<ReturnType<typeof setTimeout>>();

  // Create API client instance
  const apiClient = useMemo(() => createClientApiClient(), []);

  // Save draft to backend
  const saveDraft = useCallback(
    async (config: PagesConfig) => {
      setSaveStatus('saving');

      try {
        // Build full landing page config with pages
        const landingPageConfig: LandingPageConfig = {
          pages: config,
        };

        logger.info('[useDraftAutosave] Saving draft', {
          pagesCount: Object.keys(config).length,
        });

        // Call the API to save draft
        const response = await apiClient.saveDraft({
          body: landingPageConfig,
        });

        if (response.status !== 200) {
          throw new Error(
            response.body && typeof response.body === 'object' && 'error' in response.body
              ? String(response.body.error)
              : 'Failed to save draft'
          );
        }

        setSaveStatus('saved');
        setLastSaved(new Date(response.body.draftUpdatedAt));
        setIsDirty(false);
        onSave?.();

        // Clear previous timeout before setting new one
        if (statusResetRef.current) clearTimeout(statusResetRef.current);
        statusResetRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, BUILD_MODE_CONFIG.timing.saveStatusResetDelay);
      } catch (error) {
        logger.error('[useDraftAutosave] Save failed', { error });
        setSaveStatus('error');
        onError?.(error as Error);

        // Clear previous timeout before setting new one
        if (statusResetRef.current) clearTimeout(statusResetRef.current);
        statusResetRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, BUILD_MODE_CONFIG.timing.errorStatusResetDelay);
      }
    },
    [apiClient, onError, onSave]
  );

  // Publish draft to live
  const publishDraft = useCallback(async (): Promise<boolean> => {
    setSaveStatus('saving');

    try {
      logger.info('[useDraftAutosave] Publishing draft');

      const response = await apiClient.publishDraft({
        body: {},
      });

      if (response.status !== 200) {
        throw new Error(
          response.body && typeof response.body === 'object' && 'error' in response.body
            ? String(response.body.error)
            : 'Failed to publish draft'
        );
      }

      setSaveStatus('saved');
      setIsDirty(false);
      logger.info('[useDraftAutosave] Published successfully', {
        publishedAt: response.body.publishedAt,
      });
      return true;
    } catch (error) {
      logger.error('[useDraftAutosave] Publish failed', { error });
      setSaveStatus('error');
      onError?.(error as Error);
      return false;
    }
  }, [apiClient, onError]);

  // Discard draft changes
  const discardDraft = useCallback(async (): Promise<boolean> => {
    setSaveStatus('saving');

    try {
      logger.info('[useDraftAutosave] Discarding draft');

      const response = await apiClient.discardDraft({});

      if (response.status !== 200) {
        throw new Error(
          response.body && typeof response.body === 'object' && 'error' in response.body
            ? String(response.body.error)
            : 'Failed to discard draft'
        );
      }

      setSaveStatus('idle');
      setIsDirty(false);
      setDraftConfig(initialConfig);
      logger.info('[useDraftAutosave] Draft discarded successfully');
      return true;
    } catch (error) {
      logger.error('[useDraftAutosave] Discard failed', { error });
      setSaveStatus('error');
      onError?.(error as Error);
      return false;
    }
  }, [apiClient, initialConfig, onError]);

  // Queue a debounced save
  const queueSave = useCallback(
    (config: PagesConfig) => {
      setDraftConfig(config);
      setIsDirty(true);

      // Clear any pending debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Schedule new save
      debounceRef.current = setTimeout(() => {
        saveDraft(config);
      }, debounceMs);
    },
    [debounceMs, saveDraft]
  );

  // Update draft locally without saving
  const updateDraft = useCallback((config: PagesConfig) => {
    setDraftConfig(config);
    setIsDirty(true);
  }, []);

  // Cleanup on unmount - CRITICAL
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (statusResetRef.current) {
        clearTimeout(statusResetRef.current);
      }
    };
  }, []);

  // Sync initial config changes
  useEffect(() => {
    if (initialConfig && !isDirty) {
      setDraftConfig(initialConfig);
    }
  }, [initialConfig, isDirty]);

  return {
    saveStatus,
    lastSaved,
    isDirty,
    draftConfig,
    saveDraft,
    queueSave,
    setDirty: setIsDirty,
    updateDraft,
    publishDraft,
    discardDraft,
  };
}
```

---

## Fix 5: Dynamic Styling with Inline Style

```typescript
// apps/web/src/components/build-mode/BuildModePreview.tsx

const BUILD_MODE_CONFIG = {
  viewport: {
    mobileWidth: 375,
  },
  // ... other config
} as const;

export function BuildModePreview({
  tenantSlug,
  currentPage,
  draftConfig,
  onSectionSelect,
  highlightedSection,
  className,
}: BuildModePreviewProps) {
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');

  return (
    <div className={cn('flex flex-col h-full bg-neutral-100', className)}>
      {/* Preview container */}
      <div className="flex-1 overflow-hidden p-4">
        <div
          className={cn(
            'h-full mx-auto bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300',
            viewportMode === 'desktop' && 'w-full'
          )}
          style={
            viewportMode === 'mobile'
              ? { maxWidth: BUILD_MODE_CONFIG.viewport.mobileWidth }  // ✅ Dynamic via style
              : undefined
          }
        >
          {/* Iframe content */}
          <iframe
            // ...
          />
        </div>
      </div>
    </div>
  );
}
```

### Why This Works

- `h-full`, `w-full`, `rounded-lg` = static Tailwind classes (scanned at build time)
- `maxWidth: 375` = dynamic value via inline style (applied at runtime)
- No Tailwind JIT limitations
- Value can change at runtime without issues

---

## Fix 6: Memory Leak Timeout Cleanup in Component

```typescript
// apps/web/src/components/build-mode/BuildModePreview.tsx

export function BuildModePreview({
  tenantSlug,
  currentPage,
  draftConfig,
  onSectionSelect,
  highlightedSection,
  className,
}: BuildModePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReadyTimeoutRef = useRef<ReturnType<typeof setTimeout>>();  // ← Track timeout
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

  return (
    <div className={cn('flex flex-col h-full bg-neutral-100', className)}>
      {/* ... toolbar ... */}

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        className="w-full h-full border-0"
        title="Storefront Preview"
        onLoad={handleIframeLoad}  // ← Calls properly tracked setTimeout
        onError={handleIframeError}
        sandbox="allow-same-origin allow-scripts allow-forms"
      />
    </div>
  );
}
```

---

## Reusable Patterns

### Pattern: Safe setTimeout in React

```typescript
/**
 * Reusable pattern for any setTimeout in React
 */
const myTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

// Cleanup on unmount (ALWAYS ADD THIS)
useEffect(() => {
  return () => {
    if (myTimeoutRef.current) clearTimeout(myTimeoutRef.current);
  };
}, []);

// When setting timeout:
// 1. Clear previous
if (myTimeoutRef.current) clearTimeout(myTimeoutRef.current);

// 2. Set new
myTimeoutRef.current = setTimeout(() => {
  // handler
}, delay);
```

### Pattern: Wiring UI to API

```typescript
/**
 * Template for wiring UI handlers to real API calls
 */

// 1. Import the hook/service
import { useMyService } from '@/hooks/useMyService';

// 2. Use at top level
const { performAction, setStatus } = useMyService({
  onError: (err) => toast.error(err.message),
});

// 3. Wire handler
const handleAction = async () => {
  setLoading(true);
  try {
    const success = await performAction();
    if (success) {
      showSuccessMessage();
      refetchData();
    }
  } catch (err) {
    showErrorMessage(err);
  } finally {
    setLoading(false);
  }
};

// 4. Add UI states
{isLoading && <LoadingOverlay />}
{showSuccess && <SuccessToast />}
{showError && <ErrorToast />}
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-05
**Status:** COMPLETE - All code examples tested
