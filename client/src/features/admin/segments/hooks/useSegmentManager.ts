import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import type {
  SegmentDto,
  CreateSegmentDto,
  UpdateSegmentDto,
} from "@macon/contracts";
import type { SegmentFormData } from "../../types";

interface UseSegmentManagerProps {
  onSegmentsChange: () => void;
  showSuccess: (message: string) => void;
}

export function useSegmentManager({ onSegmentsChange, showSuccess }: UseSegmentManagerProps) {
  const [isCreatingSegment, setIsCreatingSegment] = useState(false);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialogState, handleOpenChange } = useConfirmDialog();

  const [segmentForm, setSegmentForm] = useState<SegmentFormData>({
    slug: "",
    name: "",
    heroTitle: "",
    heroSubtitle: "",
    heroImage: "",
    description: "",
    metaTitle: "",
    metaDescription: "",
    sortOrder: "0",
    active: true,
  });

  // Validate slug format
  const isValidSlug = (slug: string): boolean => {
    return /^[a-z0-9-]+$/.test(slug);
  };

  // Auto-generate slug from name (kebab-case)
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .trim()
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-"); // Replace multiple hyphens with single hyphen
  };

  // Reset form
  const resetSegmentForm = () => {
    setSegmentForm({
      slug: "",
      name: "",
      heroTitle: "",
      heroSubtitle: "",
      heroImage: "",
      description: "",
      metaTitle: "",
      metaDescription: "",
      sortOrder: "0",
      active: true,
    });
    setError(null);
  };

  // Segment handlers
  const handleCreateSegment = () => {
    resetSegmentForm();
    setIsCreatingSegment(true);
    setEditingSegmentId(null);
  };

  const handleEditSegment = (segment: SegmentDto) => {
    setSegmentForm({
      slug: segment.slug,
      name: segment.name,
      heroTitle: segment.heroTitle,
      heroSubtitle: segment.heroSubtitle || "",
      heroImage: segment.heroImage || "",
      description: segment.description || "",
      metaTitle: segment.metaTitle || "",
      metaDescription: segment.metaDescription || "",
      sortOrder: segment.sortOrder.toString(),
      active: segment.active,
    });
    setEditingSegmentId(segment.id);
    setIsCreatingSegment(true);
  };

  const handleSaveSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!segmentForm.slug || !segmentForm.name || !segmentForm.heroTitle) {
      setError("Slug, Name, and Hero Title are required");
      return;
    }

    // Validate slug format
    if (!isValidSlug(segmentForm.slug)) {
      setError("Slug must be lowercase with hyphens only (no spaces)");
      return;
    }

    // Validate sortOrder
    const sortOrder = parseInt(segmentForm.sortOrder, 10);
    if (isNaN(sortOrder) || sortOrder < 0) {
      setError("Sort Order must be a number >= 0");
      return;
    }

    setIsSaving(true);

    try {
      if (editingSegmentId) {
        // Update existing segment
        const updateData: UpdateSegmentDto = {
          slug: segmentForm.slug,
          name: segmentForm.name,
          heroTitle: segmentForm.heroTitle,
          heroSubtitle: segmentForm.heroSubtitle || undefined,
          heroImage: segmentForm.heroImage || undefined,
          description: segmentForm.description || undefined,
          metaTitle: segmentForm.metaTitle || undefined,
          metaDescription: segmentForm.metaDescription || undefined,
          sortOrder,
          active: segmentForm.active,
        };

        const result = await api.tenantAdminUpdateSegment({
          params: { id: editingSegmentId },
          body: updateData,
        });

        if (result.status === 200) {
          showSuccess("Segment updated successfully");
          setIsCreatingSegment(false);
          resetSegmentForm();
          onSegmentsChange();
        } else {
          setError("Failed to update segment");
        }
      } else {
        // Create new segment
        const createData: CreateSegmentDto = {
          slug: segmentForm.slug,
          name: segmentForm.name,
          heroTitle: segmentForm.heroTitle,
          heroSubtitle: segmentForm.heroSubtitle || undefined,
          heroImage: segmentForm.heroImage || undefined,
          description: segmentForm.description || undefined,
          metaTitle: segmentForm.metaTitle || undefined,
          metaDescription: segmentForm.metaDescription || undefined,
          sortOrder,
          active: segmentForm.active,
        };

        const result = await api.tenantAdminCreateSegment({
          body: createData,
        });

        if (result.status === 200) {
          showSuccess("Segment created successfully");
          setIsCreatingSegment(false);
          resetSegmentForm();
          onSegmentsChange();
        } else {
          setError("Failed to create segment");
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to save segment:", err);
      }
      setError("An error occurred while saving the segment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSegment = async (id: string) => {
    const confirmed = await confirm({
      title: "Delete Segment",
      description: "Are you sure you want to delete this segment? This action cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    try {
      const result = await api.tenantAdminDeleteSegment({
        params: { id },
        body: undefined,
      });

      if (result.status === 204) {
        showSuccess("Segment deleted successfully");
        onSegmentsChange();
      } else {
        toast.error("Failed to delete segment", {
          description: "Please try again or contact support.",
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to delete segment:", err);
      }
      toast.error("An error occurred while deleting the segment", {
        description: "Please try again or contact support.",
      });
    }
  };

  const handleCancelSegmentForm = () => {
    setIsCreatingSegment(false);
    resetSegmentForm();
  };

  // Auto-generate slug from name when creating (not editing)
  const handleNameChange = (name: string) => {
    setSegmentForm(prev => {
      const newForm = { ...prev, name };
      // Only auto-generate slug when creating (not editing)
      if (!editingSegmentId) {
        newForm.slug = generateSlug(name);
      }
      return newForm;
    });
  };

  return {
    // State
    isCreatingSegment,
    editingSegmentId,
    isSaving,
    error,
    segmentForm,

    // Actions
    setSegmentForm,
    handleCreateSegment,
    handleEditSegment,
    handleSaveSegment,
    handleDeleteSegment,
    handleCancelSegmentForm,
    handleNameChange,
    confirmDialog: { dialogState, handleOpenChange },
  };
}
