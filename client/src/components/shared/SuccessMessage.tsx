import { CheckCircle } from 'lucide-react';

interface SuccessMessageProps {
  message: string | null;
  className?: string;
}

/**
 * SuccessMessage Component
 *
 * Displays a success message with sage accent styling and fade-in animation.
 * Used across tenant-admin features for consistent success feedback.
 */
export function SuccessMessage({ message, className = '' }: SuccessMessageProps) {
  if (!message) return null;

  return (
    <div
      className={`flex items-center gap-3 p-4 bg-sage/10 border border-sage/20 rounded-xl animate-fade-in ${className}`}
    >
      <div className="w-8 h-8 bg-sage/20 rounded-full flex items-center justify-center flex-shrink-0">
        <CheckCircle className="w-4 h-4 text-sage" />
      </div>
      <span className="text-text-primary font-medium">{message}</span>
    </div>
  );
}
