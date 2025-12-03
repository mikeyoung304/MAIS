/**
 * SegmentForm Component
 *
 * Form for creating and editing segments with modular sub-components
 */

import { Card } from "@/components/ui/card";
import type { SegmentFormData } from "../../types";
import { BasicInfoFields } from "./BasicInfoFields";
import { HeroFields } from "./HeroFields";
import { MetaFields } from "./MetaFields";
import { SettingsFields } from "./SettingsFields";
import { FormActions } from "./FormActions";

interface SegmentFormProps {
  segmentForm: SegmentFormData;
  editingSegmentId: string | null;
  isSaving: boolean;
  onFormChange: (form: SegmentFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function SegmentForm({
  segmentForm,
  editingSegmentId,
  isSaving,
  onFormChange,
  onSubmit,
  onCancel,
}: SegmentFormProps) {
  return (
    <Card className="p-6 bg-macon-navy-800 border-white/20">
      <h2 className="text-2xl font-semibold mb-4 text-white">
        {editingSegmentId ? "Edit Segment" : "Create Segment"}
      </h2>

      <form onSubmit={onSubmit} className="space-y-4">
        <BasicInfoFields
          slug={segmentForm.slug}
          name={segmentForm.name}
          disabled={isSaving}
          onSlugChange={(slug) => onFormChange({ ...segmentForm, slug })}
          onNameChange={(name) => onFormChange({ ...segmentForm, name })}
        />

        <HeroFields
          heroTitle={segmentForm.heroTitle}
          heroSubtitle={segmentForm.heroSubtitle}
          heroImage={segmentForm.heroImage}
          disabled={isSaving}
          onHeroTitleChange={(heroTitle) => onFormChange({ ...segmentForm, heroTitle })}
          onHeroSubtitleChange={(heroSubtitle) => onFormChange({ ...segmentForm, heroSubtitle })}
          onHeroImageChange={(heroImage) => onFormChange({ ...segmentForm, heroImage })}
        />

        <SettingsFields
          sortOrder={segmentForm.sortOrder}
          active={segmentForm.active}
          disabled={isSaving}
          onSortOrderChange={(sortOrder) => onFormChange({ ...segmentForm, sortOrder })}
          onActiveChange={(active) => onFormChange({ ...segmentForm, active })}
        />

        <MetaFields
          description={segmentForm.description}
          metaTitle={segmentForm.metaTitle}
          metaDescription={segmentForm.metaDescription}
          disabled={isSaving}
          onDescriptionChange={(description) => onFormChange({ ...segmentForm, description })}
          onMetaTitleChange={(metaTitle) => onFormChange({ ...segmentForm, metaTitle })}
          onMetaDescriptionChange={(metaDescription) => onFormChange({ ...segmentForm, metaDescription })}
        />

        <FormActions
          isEditing={!!editingSegmentId}
          isSaving={isSaving}
          onCancel={onCancel}
        />
      </form>
    </Card>
  );
}