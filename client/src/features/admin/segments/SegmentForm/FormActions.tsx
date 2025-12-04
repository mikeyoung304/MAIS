/**
 * FormActions Component
 *
 * Submit and cancel buttons for segment form
 */

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FormActionsProps {
  isEditing: boolean;
  isSaving: boolean;
  onCancel: () => void;
}

export function FormActions({ isEditing, isSaving, onCancel }: FormActionsProps) {
  return (
    <div className="flex gap-3 pt-2">
      <Button
        type="submit"
        disabled={isSaving}
        className="bg-macon-navy hover:bg-macon-navy-dark text-lg h-12 px-6"
      >
        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {isSaving
          ? isEditing
            ? 'Updating...'
            : 'Creating...'
          : isEditing
            ? 'Update Segment'
            : 'Create Segment'}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isSaving}
        className="border-white/20 text-white/90 hover:bg-macon-navy-700 text-lg h-12 px-6"
      >
        Cancel
      </Button>
    </div>
  );
}
