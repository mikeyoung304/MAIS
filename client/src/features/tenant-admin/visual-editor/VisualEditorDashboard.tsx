/**
 * VisualEditorDashboard - Main visual editor component
 *
 * Features:
 * - Floating action bar with publish/discard buttons
 * - Draft count indicator
 * - Saving/publishing status indicators
 * - Responsive package grid
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Save, X, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { useVisualEditor } from "./hooks/useVisualEditor";
import { EditablePackageGrid } from "./components/EditablePackageGrid";
import type { PackagePhoto, DraftUpdate } from "./hooks/useVisualEditor";

export function VisualEditorDashboard() {
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const {
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
  } = useVisualEditor();

  const handleDiscardClick = useCallback(() => {
    if (draftCount === 0) return;
    setShowDiscardDialog(true);
  }, [draftCount]);

  const handleConfirmDiscard = useCallback(async () => {
    setShowDiscardDialog(false);
    await discardAll();
  }, [discardAll]);

  const handleUpdatePackage = useCallback(
    (packageId: string, update: DraftUpdate) => {
      updateDraft(packageId, update);
    },
    [updateDraft]
  );

  const handlePhotosChange = useCallback(
    (packageId: string, photos: PackagePhoto[]) => {
      // Update local state immediately for responsive UI
      updateLocalPackage(packageId, {
        draftPhotos: photos,
        hasDraft: true,
      });
    },
    [updateLocalPackage]
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-destructive bg-destructive/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Failed to load packages</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadPackages}
              className="ml-auto"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Visual Editor</h2>
          <p className="text-muted-foreground">
            Edit your packages directly. Changes auto-save as you type.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={loadPackages}
          disabled={loading || isPublishing}
          title="Refresh packages"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Package grid */}
      <EditablePackageGrid
        packages={packages}
        onUpdatePackage={handleUpdatePackage}
        onPhotosChange={handlePhotosChange}
        disabled={isPublishing}
      />

      {/* Floating action bar */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50",
          "bg-background/95 backdrop-blur border-t shadow-lg",
          "transform transition-transform duration-300",
          draftCount === 0 && "translate-y-full"
        )}
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Draft count and status */}
            <div className="flex items-center gap-3">
              {isSaving ? (
                <Badge variant="secondary" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </Badge>
              ) : draftCount > 0 ? (
                <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  {draftCount} unsaved {draftCount === 1 ? "change" : "changes"}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-300">
                  <CheckCircle className="h-3 w-3" />
                  All changes published
                </Badge>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscardClick}
                disabled={draftCount === 0 || isPublishing}
              >
                <X className="h-4 w-4 mr-1" />
                Discard
              </Button>
              <Button
                size="sm"
                onClick={publishAll}
                disabled={draftCount === 0 || isPublishing}
                className="min-w-[100px]"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Publish All
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Discard confirmation dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to discard changes to {draftCount} package{draftCount !== 1 ? "s" : ""}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
