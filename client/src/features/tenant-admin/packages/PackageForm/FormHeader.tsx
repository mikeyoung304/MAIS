import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorSummary, type FormError } from '@/components/ui/ErrorSummary';

interface FormHeaderProps {
  editingPackageId: string | null;
  showSuccess: boolean;
  validationErrors: FormError[];
  error: string | null;
  onCancel: () => void;
  onDismissValidation: () => void;
}

/**
 * FormHeader Component
 *
 * Displays the form header, back button, and status messages:
 * - Back button
 * - Title (Create/Edit)
 * - Success message
 * - Validation errors
 * - Server errors
 */
export function FormHeader({
  editingPackageId,
  showSuccess,
  validationErrors,
  error,
  onCancel,
  onDismissValidation,
}: FormHeaderProps) {
  return (
    <>
      {/* Back button */}
      <Button variant="ghost" onClick={onCancel} className="mb-4 min-h-[44px]">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <h2 className="text-2xl font-semibold mb-4 text-white">
        {editingPackageId ? 'Edit Package' : 'Create New Package'}
      </h2>

      {/* Success Message */}
      {showSuccess && (
        <div
          role="status"
          className="flex items-center gap-2 p-4 mb-4 bg-success-50 border-2 border-success-600 rounded-lg"
        >
          <CheckCircle className="w-5 h-5 text-success-700" />
          <span className="text-base text-success-800 font-medium">
            Package {editingPackageId ? 'updated' : 'created'} successfully!
          </span>
        </div>
      )}

      {/* Validation Errors */}
      <ErrorSummary errors={validationErrors} onDismiss={onDismissValidation} />

      {/* Server Error */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 p-4 mb-4 border border-white/20 bg-macon-navy-700 rounded-lg"
        >
          <AlertCircle className="w-5 h-5 text-white/70" />
          <span className="text-base text-white/90">{error}</span>
        </div>
      )}
    </>
  );
}
