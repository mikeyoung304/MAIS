/**
 * ErrorMessage Component
 *
 * Displays form error messages
 */

import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  error: string | null;
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  if (!error) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-2 p-4 mb-4 border border-white/20 bg-macon-navy-700 rounded-lg"
    >
      <AlertCircle className="w-5 h-5 text-white/70" />
      <span className="text-base text-white/90">{error}</span>
    </div>
  );
}
