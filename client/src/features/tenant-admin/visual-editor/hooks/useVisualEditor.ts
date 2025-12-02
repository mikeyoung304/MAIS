/**
 * useVisualEditor - React hook for managing visual editor state
 *
 * Handles:
 * - Loading packages with draft fields
 * - Autosave with 1s debounce
 * - Draft count tracking
 * - Publish/discard all changes
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { api, baseUrl } from "@/lib/api";
import { logger } from "@/lib/logger";

// Types for visual editor packages (with draft fields)
export interface PackageWithDraft {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  priceCents: number;
  photoUrl?: string;
  photos?: PackagePhoto[];
  segmentId: string | null;
  grouping: string | null;
  groupingOrder: number | null;
  active: boolean;
  // Draft fields
  draftTitle: string | null;
  draftDescription: string | null;
  draftPriceCents: number | null;
  draftPhotos: PackagePhoto[] | null;
  hasDraft: boolean;
  draftUpdatedAt: string | null;
}

export interface PackagePhoto {
  url: string;
  filename?: string;
  size?: number;
  order?: number;
}

// Draft update payload
export interface DraftUpdate {
  title?: string;
  description?: string;
  priceCents?: number;
  photos?: PackagePhoto[];
}

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
 * Get tenant token from localStorage
 */
function getTenantToken(): string | null {
  // Check if we're impersonating (platform admin)
  const isImpersonating = localStorage.getItem("impersonationTenantKey");
  if (isImpersonating) {
    return localStorage.getItem("adminToken");
  }
  // Normal tenant admin
  return localStorage.getItem("tenantToken");
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
  const pendingSaves = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Calculate draft count
  const draftCount = packages.filter((pkg) => pkg.hasDraft).length;

  /**
   * Load packages with draft fields from API
   */
  const loadPackages = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = getTenantToken();
      const response = await fetch(`${baseUrl}/v1/tenant-admin/packages/drafts`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || `Failed to load packages: ${response.status}`);
      }

      const data = await response.json();
      setPackages(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load packages";
      setError(message);
      toast.error("Failed to load packages", { description: message });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update draft for a package with 1s debounce
   * Includes rollback on save failure to maintain UI consistency with server state
   */
  const updateDraft = useCallback((packageId: string, update: DraftUpdate) => {
    // Clear any pending save for this package
    const existingTimeout = pendingSaves.current.get(packageId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Capture original state BEFORE optimistic update for potential rollback
    let originalPackage: PackageWithDraft | undefined;
    setPackages((prev) => {
      originalPackage = prev.find((pkg) => pkg.id === packageId);
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

    // Debounced save to server (1 second)
    const timeout = setTimeout(async () => {
      pendingSaves.current.delete(packageId);
      setIsSaving(true);

      try {
        const token = getTenantToken();
        const response = await fetch(`${baseUrl}/v1/tenant-admin/packages/${packageId}/draft`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify(update),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          throw new Error(errorBody?.error || "Failed to save draft");
        }

        // Update with server response (may include server-side changes)
        const updatedPackage = await response.json();
        setPackages((prev) =>
          prev.map((pkg) => (pkg.id === packageId ? updatedPackage : pkg))
        );
      } catch (err) {
        logger.error("Failed to save draft", {
          component: "useVisualEditor",
          packageId,
          error: err,
        });

        // Rollback optimistic update on failure
        if (originalPackage) {
          setPackages((prev) =>
            prev.map((pkg) => (pkg.id === packageId ? originalPackage! : pkg))
          );
          toast.error("Failed to save changes", {
            description: "Your changes have been reverted. Please try again.",
          });
        } else {
          toast.error("Failed to save changes", {
            description: "Your changes may not have been saved. Please try again.",
          });
        }
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    pendingSaves.current.set(packageId, timeout);
  }, []);

  /**
   * Publish all drafts to live
   */
  const publishAll = useCallback(async () => {
    if (draftCount === 0) {
      toast.info("No changes to publish");
      return;
    }

    // Flush any pending saves first
    pendingSaves.current.forEach((timeout) => clearTimeout(timeout));
    pendingSaves.current.clear();

    setIsPublishing(true);

    try {
      const token = getTenantToken();
      const response = await fetch(`${baseUrl}/v1/tenant-admin/packages/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || "Failed to publish changes");
      }

      const result = await response.json();
      toast.success(`Published ${result.published} package${result.published !== 1 ? "s" : ""}`);

      // Reload packages to get fresh state
      await loadPackages();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish changes";
      toast.error("Failed to publish changes", { description: message });
    } finally {
      setIsPublishing(false);
    }
  }, [draftCount, loadPackages]);

  /**
   * Discard all drafts without publishing
   */
  const discardAll = useCallback(async () => {
    if (draftCount === 0) {
      toast.info("No changes to discard");
      return;
    }

    // Confirm before discarding
    if (!window.confirm(`Are you sure you want to discard changes to ${draftCount} package${draftCount !== 1 ? "s" : ""}?`)) {
      return;
    }

    // Flush any pending saves first
    pendingSaves.current.forEach((timeout) => clearTimeout(timeout));
    pendingSaves.current.clear();

    try {
      const token = getTenantToken();
      const response = await fetch(`${baseUrl}/v1/tenant-admin/packages/drafts`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || "Failed to discard changes");
      }

      const result = await response.json();
      toast.success(`Discarded changes to ${result.discarded} package${result.discarded !== 1 ? "s" : ""}`);

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
      pendingSaves.current.forEach((timeout) => clearTimeout(timeout));
      pendingSaves.current.clear();
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
