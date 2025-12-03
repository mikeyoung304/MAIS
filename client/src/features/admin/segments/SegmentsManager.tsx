import { useState, useEffect } from "react";
import type { SegmentDto } from "@macon/contracts";
import { api } from "@/lib/api";
import { SegmentForm } from "./SegmentForm";
import { SegmentsList } from "./SegmentsList";
import { CreateSegmentButton } from "./CreateSegmentButton";
import { SuccessMessage } from "../packages/SuccessMessage";
import { useSuccessMessage } from "../packages/hooks/useSuccessMessage";
import { useSegmentManager } from "./hooks/useSegmentManager";

export function SegmentsManager() {
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { successMessage, showSuccess } = useSuccessMessage();

  const fetchSegments = async () => {
    setIsLoading(true);
    try {
      const result = await api.tenantAdminGetSegments();
      if (result.status === 200) {
        // Sort segments by sortOrder ascending
        const sortedSegments = [...result.body].sort((a, b) => a.sortOrder - b.sortOrder);
        setSegments(sortedSegments);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSegments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    isCreatingSegment,
    editingSegmentId,
    isSaving,
    segmentForm,
    setSegmentForm,
    handleCreateSegment,
    handleEditSegment,
    handleSaveSegment,
    handleDeleteSegment,
    handleCancelSegmentForm,
  } = useSegmentManager({ onSegmentsChange: fetchSegments, showSuccess });

  return (
    <div className="space-y-6">
      {successMessage && <SuccessMessage message={successMessage} />}

      {/* Header with Create Button */}
      {!isCreatingSegment && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-text-primary">Your Segments</h2>
            <p className="text-text-muted text-sm mt-1">
              {segments.length === 0
                ? "Organize your packages into segments"
                : `${segments.length} segment${segments.length !== 1 ? "s" : ""} created`}
            </p>
          </div>
          <CreateSegmentButton onClick={handleCreateSegment} />
        </div>
      )}

      {isCreatingSegment && (
        <SegmentForm
          segmentForm={segmentForm}
          editingSegmentId={editingSegmentId}
          isSaving={isSaving}
          onFormChange={setSegmentForm}
          onSubmit={handleSaveSegment}
          onCancel={handleCancelSegmentForm}
        />
      )}

      <SegmentsList
        segments={segments}
        onEdit={handleEditSegment}
        onDelete={handleDeleteSegment}
        isLoading={isLoading}
      />
    </div>
  );
}
