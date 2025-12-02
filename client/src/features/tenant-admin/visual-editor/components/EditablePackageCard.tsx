/**
 * EditablePackageCard - WYSIWYG editable package card
 *
 * Mirrors the public PackageCard layout but with inline editing.
 * Shows draft values with visual indicators when different from live.
 */

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Image, Pencil, AlertCircle } from "lucide-react";
import { EditableText } from "./EditableText";
import { EditablePrice } from "./EditablePrice";
import { PhotoDropZone } from "./PhotoDropZone";
import type { PackageWithDraft, PackagePhoto, DraftUpdate } from "../hooks/useVisualEditor";

interface EditablePackageCardProps {
  package: PackageWithDraft;
  onUpdate: (update: DraftUpdate) => void;
  onPhotosChange: (photos: PackagePhoto[]) => void;
  disabled?: boolean;
}

export function EditablePackageCard({
  package: pkg,
  onUpdate,
  onPhotosChange,
  disabled = false,
}: EditablePackageCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Memoize effective values to prevent recalculation on every render
  const effectiveValues = useMemo(() => ({
    title: pkg.draftTitle ?? pkg.title,
    description: pkg.draftDescription ?? pkg.description ?? "",
    priceCents: pkg.draftPriceCents ?? pkg.priceCents,
    photos: pkg.draftPhotos ?? pkg.photos ?? [],
  }), [
    pkg.draftTitle, pkg.title,
    pkg.draftDescription, pkg.description,
    pkg.draftPriceCents, pkg.priceCents,
    pkg.draftPhotos, pkg.photos
  ]);

  // Memoize draft flags to prevent recalculation on every render
  const draftFlags = useMemo(() => ({
    hasTitle: pkg.draftTitle !== null && pkg.draftTitle !== pkg.title,
    hasDescription: pkg.draftDescription !== null && pkg.draftDescription !== pkg.description,
    hasPrice: pkg.draftPriceCents !== null && pkg.draftPriceCents !== pkg.priceCents,
    hasPhotos: pkg.draftPhotos !== null,
  }), [
    pkg.draftTitle, pkg.title,
    pkg.draftDescription, pkg.description,
    pkg.draftPriceCents, pkg.priceCents,
    pkg.draftPhotos
  ]);

  // Get primary photo for card display
  const primaryPhoto = effectiveValues.photos[0]?.url || pkg.photoUrl;

  const handleTitleChange = useCallback((title: string) => {
    onUpdate({ title });
  }, [onUpdate]);

  const handleDescriptionChange = useCallback((description: string) => {
    onUpdate({ description });
  }, [onUpdate]);

  const handlePriceChange = useCallback((priceCents: number) => {
    onUpdate({ priceCents });
  }, [onUpdate]);

  const handlePhotosUpdate = useCallback((photos: PackagePhoto[]) => {
    onUpdate({ photos });
    onPhotosChange(photos);
  }, [onUpdate, onPhotosChange]);

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all",
        pkg.hasDraft && "ring-2 ring-amber-400",
        !pkg.active && "opacity-60"
      )}
    >
      {/* Draft indicator badge */}
      {pkg.hasDraft && (
        <Badge
          variant="outline"
          className="absolute top-2 right-2 z-10 bg-amber-50 text-amber-700 border-amber-300"
        >
          <Pencil className="h-3 w-3 mr-1" />
          Unsaved changes
        </Badge>
      )}

      {/* Inactive indicator */}
      {!pkg.active && (
        <Badge
          variant="secondary"
          className="absolute top-2 left-2 z-10"
        >
          Inactive
        </Badge>
      )}

      {/* Primary photo / placeholder */}
      <div className="relative aspect-video bg-muted">
        {primaryPhoto ? (
          <img
            src={primaryPhoto}
            alt={effectiveValues.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}

        {/* Photo draft indicator */}
        {draftFlags.hasPhotos && (
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-amber-500/90 text-white text-xs flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Photo changes pending
          </div>
        )}
      </div>

      <CardHeader className="pb-2">
        {/* Editable title */}
        <EditableText
          value={effectiveValues.title}
          onChange={handleTitleChange}
          placeholder="Package name"
          className="font-semibold text-lg"
          maxLength={100}
          hasDraft={draftFlags.hasTitle}
          disabled={disabled}
          aria-label="Package title"
        />
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Editable price */}
        <EditablePrice
          value={effectiveValues.priceCents}
          onChange={handlePriceChange}
          hasDraft={draftFlags.hasPrice}
          disabled={disabled}
          aria-label="Package price"
        />

        {/* Editable description (truncated in collapsed mode) */}
        <EditableText
          value={effectiveValues.description}
          onChange={handleDescriptionChange}
          placeholder="Package description"
          className={cn(
            "text-sm text-muted-foreground",
            !isExpanded && "line-clamp-2"
          )}
          inputClassName="text-sm"
          maxLength={500}
          multiline
          rows={4}
          hasDraft={draftFlags.hasDescription}
          disabled={disabled}
          aria-label="Package description"
        />

        {/* Expand/collapse toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse details" : "Expand details"}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              More
            </>
          )}
        </Button>

        {/* Expanded content - photo management */}
        {isExpanded && (
          <div className="pt-3 border-t space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Photos</h4>
              <PhotoDropZone
                packageId={pkg.id}
                photos={effectiveValues.photos}
                onPhotosChange={handlePhotosUpdate}
                disabled={disabled}
              />
            </div>

            {/* Package metadata (read-only) */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Slug: {pkg.slug}</p>
              {pkg.segmentId && <p>Segment: {pkg.segmentId}</p>}
              {pkg.grouping && <p>Grouping: {pkg.grouping}</p>}
              {pkg.draftUpdatedAt && (
                <p>Last edited: {new Date(pkg.draftUpdatedAt).toLocaleString()}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
