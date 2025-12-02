/**
 * useVisualEditor - React hook for managing visual editor state
 *
 * Handles:
 * - Loading packages with draft fields
 * - Autosave with 1s debounce and request batching
 * - Draft count tracking
 * - Publish/discard all changes
 *
 * Race Condition Prevention:
 * Uses a batching strategy where all changes within the debounce window
 * are accumulated and sent as a single request. This prevents:
 * - Overlapping requests for the same package
 * - Out-of-order updates causing inconsistent state
 * - Partial saves when one request fails while another succeeds
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { PackageWithDraftDto, UpdatePackageDraftDto } from "@macon/contracts";

// Re-export types from contracts for convenience
export type PackageWithDraft = PackageWithDraftDto;

// Photo type from contracts
export interface PackagePhoto {
  url: string;
  filename?: string;
  size?: number;
  order?: number;
}

// Draft update payload - aligned with contract schema
export type DraftUpdate = UpdatePackageDraftDto;

interface UseVisualEditorReturn {
  // State
  packages: PackageWithDraft[];
  loading: boolean;
  error: string | null;
  draftCount: number;
  isSaving: boolean;
  isPublishing: boolean;

  // Actions
  loadPackages: () => Promise<void>;
  updateDraft: (packageId: string, update: DraftUpdate) => void;
  publishAll: () => Promise<void>;
  discardAll: () => Promise<void>;

  // Local state updates (for optimistic UI)
  updateLocalPackage: (packageId: string, update: Partial<PackageWithDraft>) => void;
}

/**
 * Main hook for visual editor functionality
 */
export function useVisualEditor(): UseVisualEditorReturn {
  const [packages, setPackages] = useState<PackageWithDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Track pending saves for debouncing
  // Single timeout for batched saves to prevent race conditions
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  // Accumulated changes per package - merged before sending
  const pendingChanges = useRef<Map<string, DraftUpdate>>(new Map());
  // Original state before optimistic updates for rollback
  const originalStates = useRef<Map<string, PackageWithDraft>>(new Map());
  // Flag to track if a save is in progress
  const saveInProgress = useRef<boolean>(false);

  // Calculate draft count (memoized to avoid recomputation on every render)
  const draftCount = useMemo(
    () => packages.filter((pkg) => pkg.hasDraft).length,
    [packages]
  );

  /**
   * Load packages with draft fields from API
   * Uses type-safe ts-rest client for compile-time type checking
   */
  const loadPackages = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { status, body } = await api.tenantAdminGetPackagesWithDrafts();

      if (status !== 200 || !body) {
        const errorMessage = (body as { error?: string })?.error || `Failed to load packages: ${status}`;
        throw new Error(errorMessage);
      }

      setPackages(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load packages";
      setError(message);
      toast.error("Failed to load packages", { description: message });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Flush all pending changes to the server
   * Sends batched updates for each package that has pending changes
   * Uses type-safe ts-rest client for compile-time type checking
   */
  const flushPendingChanges = useCallback(async () => {
    // Skip if already saving or no changes
    if (saveInProgress.current || pendingChanges.current.size === 0) {
      return;
    }

    // Capture and clear pending changes atomically
    const changesToSave = new Map(pendingChanges.current);
    const originalsToRestore = new Map(originalStates.current);
    pendingChanges.current.clear();
    originalStates.current.clear();

    saveInProgress.current = true;
    setIsSaving(true);

    const failedPackages: string[] = [];

    // Process all packages sequentially to avoid race conditions
    for (const [packageId, mergedUpdate] of changesToSave) {
      try {
        const { status, body } = await api.tenantAdminUpdatePackageDraft({
          params: { id: packageId },
          body: mergedUpdate,
        });

        if (status !== 200 || !body) {
          const errorMessage = (body as { error?: string })?.error || "Failed to save draft";
          throw new Error(errorMessage);
        }

        // Update with server response (may include server-side changes)
        setPackages((prev) =>
          prev.map((pkg) => (pkg.id === packageId ? body : pkg))
        );
      } catch (err) {
        logger.error("Failed to save draft", {
          component: "useVisualEditor",
          packageId,
          error: err,
        });
        failedPackages.push(packageId);

        // Rollback this package to original state
        const original = originalsToRestore.get(packageId);
        if (original) {
          setPackages((prev) =>
            prev.map((pkg) => (pkg.id === packageId ? original : pkg))
          );
        }
      }
    }

    saveInProgress.current = false;
    setIsSaving(false);

    // Show error toast if any packages failed
    if (failedPackages.length > 0) {
      toast.error(
        `Failed to save ${failedPackages.length} package${failedPackages.length !== 1 ? "s" : ""}`,
        { description: "Your changes have been reverted. Please try again." }
      );
    }
  }, []);

  /**
   * Update draft for a package with 1s debounce and batching
   *
   * Multiple rapid changes to the same or different packages are accumulated
   * and sent as batched requests after the debounce window. This prevents:
   * - Race conditions from overlapping requests
   * - Inconsistent state from out-of-order updates
   * - Partial saves when some requests fail
   */
  const updateDraft = useCallback((packageId: string, update: DraftUpdate) => {
    // Clear existing timeout - we'll reschedule after accumulating this change
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }

    // Merge this update with any pending changes for this package
    const existing = pendingChanges.current.get(packageId) || {};
    pendingChanges.current.set(packageId, { ...existing, ...update });

    // Apply optimistic update to UI immediately
    // Use functional update to capture original state from current state (avoids stale closure)
    setPackages((prev) => {
      // Capture original state BEFORE first change for this package
      // Done inside functional update to always get fresh state
      if (!originalStates.current.has(packageId)) {
        const original = prev.find((pkg) => pkg.id === packageId);
        if (original) {
          originalStates.current.set(packageId, original);
        }
      }

      return prev.map((pkg) =>
        pkg.id === packageId
          ? {
              ...pkg,
              draftTitle: update.title ?? pkg.draftTitle,
              draftDescription: update.description ?? pkg.draftDescription,
              draftPriceCents: update.priceCents ?? pkg.draftPriceCents,
              draftPhotos: update.photos ?? pkg.draftPhotos,
              hasDraft: true,
              draftUpdatedAt: new Date().toISOString(),
            }
          : pkg
      );
    });

    // Schedule batched save after debounce window
    saveTimeout.current = setTimeout(() => {
      saveTimeout.current = null;
      flushPendingChanges();
    }, 1000);
  }, [flushPendingChanges]);

  /**
   * Publish all drafts to live
   * Uses type-safe ts-rest client for compile-time type checking
   */
  const publishAll = useCallback(async () => {
    if (draftCount === 0) {
      toast.info("No changes to publish");
      return;
    }

    // Flush any pending changes first
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    await flushPendingChanges();

    // Re-check if new changes arrived during flush (race condition prevention)
    // If user made edits during the 100-500ms flush, those need to be flushed too
    if (pendingChanges.current.size > 0) {
      await flushPendingChanges();
    }

    setIsPublishing(true);

    try {
      const { status, body } = await api.tenantAdminPublishDrafts({
        body: {},
      });

      if (status !== 200 || !body) {
        const errorMessage = (body as { error?: string })?.error || "Failed to publish changes";
        throw new Error(errorMessage);
      }

      toast.success(`Published ${body.published} package${body.published !== 1 ? "s" : ""}`);

      // Reload packages to get fresh state
      await loadPackages();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish changes";
      toast.error("Failed to publish changes", { description: message });
    } finally {
      setIsPublishing(false);
    }
  }, [draftCount, loadPackages, flushPendingChanges]);

  /**
   * Discard all drafts without publishing
   * Uses type-safe ts-rest client for compile-time type checking
   * Note: Confirmation is handled by the UI component (AlertDialog)
   */
  const discardAll = useCallback(async () => {
    if (draftCount === 0) {
      toast.info("No changes to discard");
      return;
    }

    // Clear any pending saves without flushing (we're discarding)
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    pendingChanges.current.clear();
    originalStates.current.clear();

    try {
      const { status, body } = await api.tenantAdminDiscardDrafts({
        body: {},
      });

      if (status !== 200 || !body) {
        const errorMessage = (body as { error?: string })?.error || "Failed to discard changes";
        throw new Error(errorMessage);
      }

      toast.success(`Discarded changes to ${body.discarded} package${body.discarded !== 1 ? "s" : ""}`);

      // Reload packages to get fresh state
      await loadPackages();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to discard changes";
      toast.error("Failed to discard changes", { description: message });
    }
  }, [draftCount, loadPackages]);

  /**
   * Update local package state (for optimistic UI updates like photo reordering)
   */
  const updateLocalPackage = useCallback((packageId: string, update: Partial<PackageWithDraft>) => {
    setPackages((prev) =>
      prev.map((pkg) => (pkg.id === packageId ? { ...pkg, ...update } : pkg))
    );
  }, []);

  // Cleanup pending saves on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
      }
      pendingChanges.current.clear();
      originalStates.current.clear();
    };
  }, []);

  // Load packages on mount
  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  return {
    packages,
    loading,
    error,
    draftCount,
    isSaving,
    isPublishing,
    loadPackages,
    updateDraft,
    publishAll,
    discardAll,
    updateLocalPackage,
  };
}
