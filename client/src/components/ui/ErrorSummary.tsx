import { AlertCircle, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface FormError {
  field: string;
  message: string;
}

interface ErrorSummaryProps {
  errors: FormError[];
  onDismiss?: () => void;
  className?: string;
}

/**
 * ErrorSummary Component
 *
 * Displays all form validation errors at the top of a form with:
 * - Clear error messaging
 * - Anchor links to jump to each error field
 * - ARIA alert for screen readers
 * - Dismissable with X button
 * - WCAG AA compliant styling
 *
 * @example
 * ```tsx
 * const errors = [
 *   { field: "email", message: "Email is required" },
 *   { field: "password", message: "Password must be at least 8 characters" }
 * ];
 *
 * <ErrorSummary
 *   errors={errors}
 *   onDismiss={() => setErrors([])}
 * />
 * ```
 */
export function ErrorSummary({ errors, onDismiss, className = '' }: ErrorSummaryProps) {
  const summaryRef = useRef<HTMLDivElement>(null);

  // Auto-focus error summary when errors appear (accessibility)
  useEffect(() => {
    if (errors.length > 0 && summaryRef.current) {
      summaryRef.current.focus();
    }
  }, [errors.length]);

  if (errors.length === 0) {
    return null;
  }

  /**
   * Scroll to the error field when user clicks the error link
   */
  const handleErrorClick = (field: string) => {
    const element = document.getElementById(field);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.focus();
    }
  };

  return (
    <div
      ref={summaryRef}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      tabIndex={-1}
      className={`relative p-4 mb-6 bg-danger-50 border-2 border-danger-600 rounded-lg ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-6 h-6 text-danger-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-danger-900 mb-2">
            {errors.length === 1
              ? 'There is 1 error with your submission'
              : `There are ${errors.length} errors with your submission`}
          </h2>
          <ul className="space-y-2">
            {errors.map((error, index) => (
              <li key={`${error.field}-${index}`}>
                <button
                  type="button"
                  onClick={() => handleErrorClick(error.field)}
                  className="text-base text-danger-800 hover:text-danger-900 underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-danger-600 focus:ring-offset-2 rounded"
                >
                  {error.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 text-danger-700 hover:text-danger-900 focus:outline-none focus:ring-2 focus:ring-danger-600 rounded p-1"
            aria-label="Dismiss error summary"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
