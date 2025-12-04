import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FormActionsProps {
  isSaving: boolean;
  editingPackageId: string | null;
  onCancel: () => void;
}

/**
 * FormActions Component
 *
 * Form action buttons:
 * - Submit button (Create/Update)
 * - Cancel button
 */
export function FormActions({ isSaving, editingPackageId, onCancel }: FormActionsProps) {
  return (
    <div className="flex gap-3 pt-2">
      <Button
        type="submit"
        disabled={isSaving}
        className="bg-macon-navy hover:bg-macon-navy-dark text-lg h-12 px-6"
      >
        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {isSaving ? 'Saving...' : editingPackageId ? 'Update Package' : 'Create Package'}
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
